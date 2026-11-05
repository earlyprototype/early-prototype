"""Real packaged uvx stdio smoke; Claude workspace interpolation is simulated.

No host UI, model call, GitHub sync or credentials. All writes are scratch-only.
"""

import asyncio
import json
import os
import re
import sys
from contextlib import asynccontextmanager
from datetime import timedelta
from pathlib import Path
from tempfile import TemporaryDirectory

from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client


ROOT = Path(__file__).resolve().parents[3]
TOOLS = {
    "add_task", "move_task", "delete_task", "list_tasks", "sync_to_github",
    "get_sync_status", "propose_done", "approve_done", "reject_review",
    "setup_project", "doctor",
}
SOURCE_SHA = "27389e6a590f282d9bca2b07061d803682d0687f"


def launch_config():
    plugin = json.loads((ROOT / "plugins/kanbanger/.claude-plugin/plugin.json").read_text(encoding="utf-8"))
    catalog = json.loads((ROOT / ".claude-plugin/marketplace.json").read_text(encoding="utf-8"))
    names = [p["name"] for p in catalog["plugins"]]
    assert len(names) == len(set(names)) == 7, "Expected seven unique plugins"
    assert set(names) == {"early-prototype", "peer-board", "dewormer", "papertime", "baton", "graphtime", "kanbanger"}
    entry = next(p for p in catalog["plugins"] if p["name"] == "kanbanger")
    assert entry["version"] == plugin["version"] == "3.0.1"
    assert entry["source"] == "./plugins/kanbanger"
    server = plugin["mcpServers"]["kanbanger"]
    assert server["command"] == "uvx"
    assert server["args"] == [
        "--from", f"git+https://github.com/earlyprototype/kanbanger.git@{SOURCE_SHA}",
        "kanbanger-mcp",
    ], "Packaged launch must use the tested immutable source"
    assert re.fullmatch(r"[0-9a-f]{40}", SOURCE_SHA)
    assert server["env"] == {
        "KANBANGER_WORKSPACE": "${CLAUDE_PROJECT_DIR}",
        "KANBANGER_INSTALL_MODE": "plugin",
    }
    return server


@asynccontextmanager
async def connect(server, project, process_cwd):
    env = dict(os.environ)
    for key in list(env):
        if key.upper() in {
            "GITHUB_TOKEN", "GH_TOKEN", "GITHUB_REPO", "GITHUB_PROJECT_NUMBER",
            "KANBANGER_WORKSPACE", "KANBANGER_INSTALL_MODE", "CLAUDE_PLUGIN_ROOT",
            "CLAUDE_PROJECT_DIR", "PYTHONPATH",
        }:
            del env[key]
    # Deliberate simulation of the documented Claude MCP env interpolation.
    interpolated = {
        key: value.replace("${CLAUDE_PROJECT_DIR}", str(project.resolve()))
        for key, value in server["env"].items()
    }
    assert all("${" not in value for value in interpolated.values())
    env.update(interpolated)
    assert env["KANBANGER_INSTALL_MODE"] == "plugin"
    env["UV_PYTHON"] = sys.executable
    params = StdioServerParameters(
        command=server["command"], args=server["args"], env=env, cwd=process_cwd,
    )
    async with stdio_client(params) as (read, write):
        async with ClientSession(read, write, read_timeout_seconds=timedelta(seconds=180)) as session:
            await session.initialize()
            yield session


async def call(session, name, arguments=None, expected_error=None):
    result = await session.call_tool(name, arguments or {})
    text = "\n".join(block.text for block in result.content if hasattr(block, "text"))
    assert not result.isError, f"{name}: MCP tool error: {text}"
    try:
        payload = json.loads(text)
    except ValueError:
        payload = text
    if expected_error:
        assert isinstance(payload, dict), f"{name}: expected structured gate rejection"
        assert payload.get("success") is False and payload.get("error_code") == expected_error, text
    elif isinstance(payload, dict):
        assert payload.get("success") is not False and "error" not in payload, f"{name}: {text}"
    return payload


def snapshot(project):
    return {str(p.relative_to(project)): p.read_bytes()
            for p in project.rglob("*") if p.is_file()}


def assert_config(project, original):
    config = project / ".mcp.json"
    if original is None:
        assert not config.exists(), "Plugin setup created unwanted standalone config"
    else:
        assert config.read_bytes() == original, "Plugin setup altered user MCP config"


async def check_setup(server, project, process_cwd, original):
    async with connect(server, project, process_cwd) as session:
        tools = (await session.list_tools()).tools
        assert {tool.name for tool in tools} == TOOLS, "Unexpected MCP tool surface"
        schema = next(tool.inputSchema for tool in tools if tool.name == "setup_project")
        assert "install_mode" in schema["properties"]
        assert "install_mode" not in schema.get("required", [])
        summary = await call(session, "setup_project")
        assert isinstance(summary, str), f"setup_project returned an error payload: {summary}"
        assert all(word in summary.lower() for word in ("skipped", "plugin", "mcp wiring"))
        board = (project / "_kanban.md").read_text(encoding="utf-8")
        assert re.findall(r"^## (.+)$", board, re.MULTILINE) == ["BACKLOG", "TODO", "DOING", "REVIEW", "DONE"]
        key = re.search(r"<!-- kanbanger:board-id: ([0-9A-Za-z-]{8,64}) -->", board)
        assert key, "Setup failed to mint stable board identity"
        guidance = (project / "CLAUDE.md").read_text(encoding="utf-8")
        assert "REVIEW gates DONE" in guidance and "re-enable" in guidance
        assert "pipx install" not in guidance and "kanbanger init" not in guidance
        assert (project / ".gitignore").is_file()
        if (project / "AGENTS.md").exists():
            assert (project / "AGENTS.md").read_bytes().startswith(b"User-owned instructions\r\n")
        assert_config(project, original)
        before = snapshot(project)
        again = await call(session, "setup_project")
        assert "Created:" not in again and "Updated:" not in again, again
        assert snapshot(project) == before, "Repeat setup changed project bytes"
    async with connect(server, project, process_cwd) as session:
        await call(session, "setup_project")
        assert snapshot(project) == before, "Reconnect/setup changed stable project state"
    assert_config(project, original)
    assert not (process_cwd / "_kanban.md").exists(), "Workspace pin was ignored"
    print(f"PASS setup/config/reconnect: {project.name}", flush=True)
    return key.group(1)


async def check_lifecycle(server, project, process_cwd):
    title = "Packaged A task"
    async with connect(server, project, process_cwd) as session:
        added = await call(session, "add_task", {"title": title, "column": "TODO"})
        assert added["success"] is True
        assert title in (await call(session, "list_tasks"))["TODO"]
        await call(session, "move_task", {
            "title": title, "from_column": "TODO", "to_column": "DONE",
        }, expected_error="gate_violation")
        assert title in (await call(session, "list_tasks"))["TODO"]
        moved = await call(session, "move_task", {
            "title": title, "from_column": "TODO", "to_column": "DOING",
        })
        assert moved["success"] is True
        proposed = await call(session, "propose_done", {"title": title})
        assert proposed["success"] is True
        tasks = await call(session, "list_tasks")
        assert title in tasks["REVIEW"] and title not in tasks["DONE"]
        # TEST-ONLY simulated approval, never authorization for real user work.
        approved = await call(session, "approve_done", {"title": title})
        assert approved["success"] is True
        tasks = await call(session, "list_tasks")
        assert title in tasks["DONE"] and title not in tasks["REVIEW"]
        report = await call(session, "doctor", {"network": False})
        assert isinstance(report, str) and "verdict: healthy (local-only)" in report, report
        assert str(project.resolve()) in report, "Doctor reported wrong workspace"
        status = await call(session, "get_sync_status")
        assert status["synced_tasks"] == 0 and status["state_file"] == "not found"
    print("PASS lifecycle/REVIEW gate/doctor/local-only state", flush=True)


async def main():
    server = launch_config()
    async with asyncio.timeout(600):
        with TemporaryDirectory(prefix="kanbanger-packaged-") as temp:
            base = Path(temp).resolve()
            a, b, c, process_cwd = [base / name for name in (
                "project-a", "project with spaces", "malformed-project", "server-cwd",
            )]
            for directory in (a, b, c, process_cwd):
                directory.mkdir()
            valid = b'{\r\n  "mcpServers": {"other": {"command": "other-server"}}\r\n}\r\n'
            malformed = b"user-owned malformed config\r\n"
            (b / ".mcp.json").write_bytes(valid)
            (b / "AGENTS.md").write_bytes(b"User-owned instructions\r\n")
            (c / ".mcp.json").write_bytes(malformed)
            keys = []
            for project, original in ((a, None), (b, valid), (c, malformed)):
                keys.append(await check_setup(server, project, process_cwd, original))
            assert len(set(keys)) == 3, "Distinct projects share a board identity"
            await check_lifecycle(server, a, process_cwd)
            async with connect(server, b, process_cwd) as session:
                added = await call(session, "add_task", {"title": "Packaged B task"})
                assert added["success"] is True
            for project, own, other in ((a, "Packaged A task", "Packaged B task"),
                                        (b, "Packaged B task", "Packaged A task")):
                async with connect(server, project, process_cwd) as session:
                    tasks = await call(session, "list_tasks")
                    titles = [title for column in tasks.values() for title in column]
                    assert own in titles and other not in titles, "Cross-project board leakage"
            for project, original in ((a, None), (b, valid), (c, malformed)):
                assert_config(project, original)
                assert not (project / ".kanban.json").exists(), "Unexpected sync state"
            assert not (process_cwd / "_kanban.md").exists()
            print("PASS isolated workspace binding including spaces", flush=True)
    print(f"PASS packaged source {SOURCE_SHA}; host interpolation simulated", flush=True)


if __name__ == "__main__":
    asyncio.run(main())
