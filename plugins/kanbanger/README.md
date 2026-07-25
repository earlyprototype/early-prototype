# kanbanger

A kanban board you and your agents share, as an MCP server. The board is a
plain markdown file (`_kanban.md`) in each project — readable and diffable by
humans, driven by agents through 11 tools (add / move / list / delete tasks,
propose / approve / reject review, sync, sync status, project setup, doctor).

The core rule: **REVIEW gates DONE**. Agent-completed work parks in REVIEW
until a human approves it, so DONE always means human-approved. Optionally,
the board mirrors one-way to a GitHub Projects V2 board.

## Requirements

The server launches via [uv](https://docs.astral.sh/uv/)'s `uvx` runner —
install uv once:

- **macOS / Linux**: `curl -LsSf https://astral.sh/uv/install.sh | sh`
- **Windows**: `powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"`

`git` must also be on `PATH` (the server is currently fetched from its git
repo). No Python setup needed — `uvx` fetches, builds, and caches the server
on first launch. The first launch downloads and builds, so give it a moment;
later launches start from cache.

## Install

```sh
# add the marketplace (once)
/plugin marketplace add earlyprototype/early-prototype

# install kanbanger
/plugin install kanbanger@early-prototype
```

Or in-session: `/plugin` → marketplace `early-prototype` → install `kanbanger`.

## First use in a project

1. Ask the assistant to run the `setup_project` tool. It scaffolds
   `_kanban.md` (BACKLOG → TODO → DOING → REVIEW → DONE, with a stable board
   key) and adds board etiquette to `CLAUDE.md`. Idempotent — an existing
   board is never clobbered.
2. Restart the session so the new `CLAUDE.md` guidance loads.

`setup_project` also writes a project `.mcp.json` aimed at the standalone
(pipx) install path. With the plugin installed you don't need it — if you
never installed kanbanger standalone, it's safe to delete.

## Use

Just talk to the assistant in any set-up project:

- *"add a task: wire up the export button"* → `add_task`
- *"what's in review?"* → `list_tasks`
- *"propose the parser task as done"* → `propose_done` (a human approves via `approve_done`)
- *"sync the board to GitHub"* → `sync_to_github`

## GitHub sync (optional)

Sync needs credentials in the server's environment:

| Variable | What |
|---|---|
| `GITHUB_TOKEN` | PAT with repo + project scopes |
| `GITHUB_REPO` | `owner/name` of the target repo |
| `GITHUB_PROJECT_NUMBER` | Project number (optional — auto-detected) |

Put them in the project's `.claude/settings.local.json` `env` block (local
and untracked) — **never in committed files**:

```json
{
  "env": {
    "GITHUB_TOKEN": "<your-pat>",
    "GITHUB_REPO": "owner/name"
  }
}
```

Without them the board still works fully locally — only sync is off.

## Health check

Board not found, sync failing, anything odd: ask the assistant to run the
`doctor` tool. It prints the workspace → board → key binding and diagnoses
sync configuration (with `network=true` it also tests GitHub reachability).

## Update

```sh
/plugin update kanbanger@early-prototype
```

Auto-update is OFF by default for third-party marketplaces; toggle it
per-marketplace in `/plugin` to pull updates at session start.

## How it launches

The manifest declares one MCP server:

```sh
uvx --from git+https://github.com/earlyprototype/kanbanger-partymix.git kanbanger-mcp
```

with `KANBANGER_WORKSPACE` set to the session's project root, so each session
binds the board of the project it runs in (the server's walk-up discovery and
board keys handle the rest). GitHub credentials are deliberately **not**
declared in the manifest — the server reads them from your ambient
environment (see GitHub sync above), so an unset variable never leaks a
literal placeholder into the server.

## Maintainer notes

- The plugin `version` tracks kanbanger releases and is the plugin-update
  cache key — bump it with every release.
- Once `kanbanger` ships on PyPI, switch the server args from
  `["--from", "git+https://github.com/earlyprototype/kanbanger-partymix.git", "kanbanger-mcp"]`
  to `["--from", "kanbanger", "kanbanger-mcp"]` — the PyPI dist is
  `kanbanger`, the executable is `kanbanger-mcp`, so `--from` stays. That
  drops the `git` requirement and resolves releases from PyPI.

## Related

The **early-prototype** plugin (same marketplace) builds a PM/Worker session
lifecycle on top of this board — its skills queue, claim, and close kanban
tasks through these tools.
