# kanbanger

A plain markdown kanban board (`_kanban.md`) shared by humans and agents through
11 MCP tools: add, move, list and delete tasks; propose, approve and reject review;
sync, sync status, project setup and doctor. **REVIEW gates DONE**: agents propose
completion, then call `approve_done` only with the user's explicit approval.
The server enforces the transition, but does not authenticate a human identity.
Optional one-way GitHub Projects V2 sync is separate from local board operation.

This marketplace wrapper supports **Claude Code**. Cursor and Codex use the
[manual MCP routes](#manual-mcp-setup) below; their plugin loaders are not claimed
to support this Claude-specific manifest.

## Requirements

- [uv/uvx](https://docs.astral.sh/uv/getting-started/installation/) and Git on the
  MCP host process's `PATH`. On Windows the official uv installation command is:

  ```powershell
  powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"
  ```

- Python **3.10+**, available locally or downloadable by uv. A separate global
  Kanbanger or pipx installation is unnecessary: uvx builds an isolated environment.
- First launch needs network access for source, dependencies and possibly Python.
  Later launches use caches where available; offline startup is not guaranteed.

Restart the host after changing `PATH`. If a Windows GUI cannot find `uvx`, use
its full `uvx.exe` path in a manual MCP configuration. GitHub credentials are
optional; local boards work without them.

## Install in Claude Code

In an interactive Claude Code session:

```text
/plugin marketplace add earlyprototype/early-prototype
/plugin install kanbanger@early-prototype
```

Complete installation in the plugin panel. Kanbanger supplies MCP tools, with no
skills or slash commands. Ask the assistant to call the tools by name.

## First use in a project

1. Open the intended project and confirm the Kanbanger MCP server is connected.
   Ask for `doctor` to inspect its workspace binding; an unprovisioned board is
   expected at this point.
2. Ask for `setup_project`. The wrapper sets `KANBANGER_INSTALL_MODE=plugin`, so
   setup creates or maintains the board, stable board key, `.gitignore` hygiene
   and `CLAUDE.md` guidance (also `AGENTS.md` when it already exists). It skips
   `.mcp.json` entirely, preserving any existing file, including malformed content.
   Repeated setup preserves the board and refreshes only managed guidance.
3. Restart the session to load project guidance, then run `doctor` again and
   confirm the workspace and board belong to this project.

No standalone executable or extra project MCP registration is needed. If the
plugin becomes unavailable, re-enable or reinstall it, reconnect, and rerun
`setup_project`. Explicit `setup_project(install_mode="plugin")` is also supported;
an explicit mode overrides the marker. Standalone `kanbanger init` keeps its
standalone behavior.

### Migrating an older wrapper installation

Older setup could create a root `.mcp.json` pointing at a global `kanbanger-mcp`.
Before restarting, inspect and back up that file. If the plugin replaces that
registration, remove **only the confirmed duplicate Kanbanger entry**. Preserve
unrelated servers and custom settings. Delete the file only if otherwise empty
and no longer needed. Inspect malformed files manually; do not overwrite them.

## Use

- "Add a task: wire up export" → `add_task`
- "What is in review?" → `list_tasks`
- "Propose the parser task as done" → `propose_done`
- After explicit user approval → `approve_done`
- "Sync the board to GitHub" → `sync_to_github`

For binding or configuration problems, call `doctor`. Its default `network=false`
does not contact GitHub; `network=true` also checks GitHub connectivity.

## Manual MCP setup

These routes configure the server directly, independently of marketplace plugin
installation. They use `KANBANGER_INSTALL_MODE=plugin` to reuse the registration
you manage here and avoid generating an additional standalone `.mcp.json`.
Merge the example into existing configuration, preserving other servers.

### Cursor

Create or update the project's `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "kanbanger": {
      "type": "stdio",
      "command": "uvx",
      "args": [
        "--from",
        "git+https://github.com/earlyprototype/kanbanger.git@27389e6a590f282d9bca2b07061d803682d0687f",
        "kanbanger-mcp"
      ],
      "env": {
        "KANBANGER_WORKSPACE": "${workspaceFolder}",
        "KANBANGER_INSTALL_MODE": "plugin"
      }
    }
  }
}
```

[Cursor resolves `${workspaceFolder}`](https://cursor.com/docs/mcp#config-interpolation)
to the project folder containing `.cursor/mcp.json`. Enable/restart the server in
Cursor, then follow the doctor → setup_project → session restart → doctor steps
above. Claude's root `.mcp.json` alone does not configure Cursor.

### Codex

Merge into the project's `.codex/config.toml`. Replace both example absolute
paths with the intended workspace; TOML literal strings preserve Windows slashes:

```toml
[mcp_servers.kanbanger]
command = "uvx"
args = ["--from", "git+https://github.com/earlyprototype/kanbanger.git@27389e6a590f282d9bca2b07061d803682d0687f", "kanbanger-mcp"]
cwd = 'C:\Users\you\Projects\Project With Spaces'

[mcp_servers.kanbanger.env]
KANBANGER_WORKSPACE = 'C:\Users\you\Projects\Project With Spaces'
KANBANGER_INSTALL_MODE = "plugin"
```

See [Codex MCP configuration](https://learn.chatgpt.com/docs/extend/mcp?surface=cli).
Use `codex mcp list` and `/mcp` to inspect the server; restart the session and
follow the first-use steps above. Project configuration must be trusted according
to the host's normal controls. Use separate project-scoped configurations for two
projects. A personal/global configuration with a fixed workspace always binds to
that one workspace until deliberately changed. Do not use Claude's workspace
placeholder or rely on a plugin cache directory as the working directory.

## GitHub sync (optional)

The server reads `GITHUB_TOKEN`, `GITHUB_REPO` (`owner/name`) and optionally
`GITHUB_PROJECT_NUMBER` from its environment or a local, gitignored `.env`.
Use credentials with access to the target repository and Projects V2 board.
Keep secrets in local configuration, never committed manifests. Without sync
configuration the board remains fully usable locally.

## Update and uninstall

Run these in a terminal, then start a new Claude Code session:

```sh
claude plugin marketplace update early-prototype
claude plugin update kanbanger@early-prototype
```

To uninstall, run `claude plugin uninstall kanbanger@early-prototype`, adding
`--scope project` or `--scope local` if that is where you installed it. Your
project board and guidance remain project files. Retain `_kanban.md` by default;
remove only the managed Kanbanger guidance block if you no longer want it.
For manual routes, remove only that host's Kanbanger MCP registration.
See the [official Claude plugin commands](https://code.claude.com/docs/en/plugins/cli-reference).

## How it launches and is verified

Wrapper version **3.0.1** pins upstream source version **3.0.0** at
`27389e6a590f282d9bca2b07061d803682d0687f`:

```sh
uvx --from git+https://github.com/earlyprototype/kanbanger.git@27389e6a590f282d9bca2b07061d803682d0687f kanbanger-mcp
```

The manifest sets `KANBANGER_WORKSPACE=${CLAUDE_PROJECT_DIR}` and
`KANBANGER_INSTALL_MODE=plugin`. [Claude documents this workspace expansion for
MCP env values](https://code.claude.com/docs/en/plugins-reference#environment-variables).
Credentials are deliberately absent from the manifest.

The smoke workflow launches this actual pinned command through native MCP on
Ubuntu and Windows with scratch workspaces and **simulated host interpolation**.
It checks setup, configuration preservation, restart, isolation and REVIEW gates.
Separate native Claude CLI steps validate the marketplace and plugin, install
from the local checkout at project scope, and inspect the installed-plugin list.
Those steps make no model calls and supply no API keys or authentication bypass.
This test does not establish installed-IDE startup on a particular laptop.
Check the workflow result for runtime evidence; the presence of test code is
not a pass.

Maintainers must update the source pin deliberately after testing, and bump the
wrapper's matching manifest/catalog versions when changing its launch. Wrapper
version and upstream source version are independent; no upstream release is
implied. The source pin does not lock transitive dependencies. Switch to a PyPI
version only after that package release is verified, using an explicit version.

The **early-prototype** lifecycle plugin uses these MCP tools to queue, claim and
close kanban tasks; it remains a separate plugin in this marketplace.
