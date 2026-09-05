# early-prototype

A personal **plugin marketplace** for Claude Code and Codex. Each plugin's guide lists its host requirements.

Ships six plugins:

- **`early-prototype`** — the **timeteam** suite: Product/PM/Worker session lifecycle as installable skills, hooks, and an agent.
- **`peer-board`** — agent-to-agent coordination over GitHub Discussions, so parallel Claude Code sessions on one repo stop duplicating each other's work.
- **`dewormer`** — an optional output style and skill that strip the performed-quality tics out of Claude's prose: the praise reflex, the emphasis markers, the borrowed engineering slang.
- **`papertime`** — a skill that writes research answers as dated reading notes in the ATR house format (answer first, provenance, claims marked established, inferred, recalled or speculation, a 2,000-word ceiling, a closing section on what remains and what needs the operator's decision), with a checker and a page builder.
- **`baton`** — an explicitly invoked session handover: the main agent briefs a subagent, the subagent writes with bundled DrDoc guidance, and the main agent reviews the result.
- **`graphtime`** — persistent Project Knowledge Map opt-in for one Codex project, using an existing Knowledge Graph Kit checkout.

## What it gives you (in 30 seconds)

You sit down to work. `/early-prototype:teamtime` opens a PM session (you're now in "review, decide, delegate" mode). `/early-prototype:worktime` clocks in a Worker task — your description goes on `_kanban.md` and the Stop hook starts producing handoffs. `/early-prototype:clocktime` closes the task (moves it to DONE via a review gate). `/early-prototype:sleeptime` closes the PM session and writes a session log.

After an agent turn ends with a Worker task marker present, the Stop hook writes a §6-format handoff and a pointer in `.claude/inbox/pm/`. This event does not establish that the task or development session is complete. Next time you `/early-prototype:teamtime`, unread handoffs are surfaced.

`/early-prototype:prodtime` opens a Product session above PM — the seat that frames what a cycle should build, for whom, and why, then hands a written brief down to PM; `/early-prototype:prodout` closes it.

The lifecycle commands and hooks maintain kanban state and handoffs. For a session handover you choose to request, use Baton; its writer checks evidence and its main agent reviews the result.

## Install

```bash
# 1. Register this marketplace (once)
/plugin marketplace add earlyprototype/early-prototype

# 2. Install whichever plugin you want
/plugin install early-prototype@early-prototype
/plugin install peer-board@early-prototype
/plugin install dewormer@early-prototype
/plugin install papertime@early-prototype
/plugin install baton@early-prototype
```

For Graphtime in Codex, run `codex plugin marketplace add earlyprototype/early-prototype`
and `codex plugin add graphtime@early-prototype`. If the marketplace is already
registered, refresh it with `codex plugin marketplace upgrade early-prototype`.
See the [Graphtime guide](plugins/graphtime/README.md) for the required toolkit and
the short personal `/graphtime` command.

After installing, skills are namespaced under the plugin:

- `/early-prototype:prodtime` — open Product session
- `/early-prototype:prodout` — close Product session
- `/early-prototype:teamtime` — open PM session
- `/early-prototype:sleeptime` — close PM session
- `/early-prototype:worktime` — open Worker task (fresh)
- `/early-prototype:chosetime` — open Worker task (from queue)
- `/early-prototype:clocktime` — close Worker task
- `/early-prototype:notetime` — mid-task note
- `/early-prototype:queuetime` — queue a task for later
- `/early-prototype:readtime` — acknowledge a handoff
- `/early-prototype:check-handoffs` — surface inbox
- `/early-prototype:cleantime` — wipe all session state in this project
- `/baton:baton` — create a reviewed session handover; see the [Baton installation notes](plugins/baton/README.md#install) for the short personal `/baton` command
- `$graphtime:graphtime` — enable, inspect or disable project context in Codex CLI

## What's inside

```
early-prototype/                      # marketplace repository
├── .claude-plugin/marketplace.json   # catalog
├── README.md
└── plugins/                         # each plugin has .claude-plugin/plugin.json
    ├── early-prototype/
    │   ├── skills/                  # Product / PM / Worker lifecycle
    │   ├── hooks/                   # Stop, SessionStart and shared modules
    │   └── agents/kanban-worker.md
    ├── peer-board/
    │   ├── commands/                # board, board-install
    │   ├── skills/peer-board/
    │   └── assets/                  # GitHub Actions workflows and scripts
    ├── dewormer/
    │   ├── output-styles/dewormer.md
    │   └── skills/dewormer/
    ├── papertime/
    │   └── skills/papertime/        # instructions, references, assets, scripts
    ├── baton/
    │   └── skills/baton/            # instructions, invocation policy, DrDoc
    └── graphtime/
        └── skills/graphtime/        # project activation instructions and policy
```

### peer-board in one paragraph

Several Claude Code sessions on one repo can't see each other, so they duplicate work and collide on hand-assigned identifiers. `peer-board` gives them GitHub Discussions threads they can open, join, reply in, leave and close, plus a snapshot branch they can read to see who is in a thread and whether anyone replied. Run `/peer-board:board-install` in a repo to copy the workflows in; full detail in [`plugins/peer-board/README.md`](plugins/peer-board/README.md).

### dewormer in one paragraph

Substance carries itself, so prose should never label itself. A sentence saying "the key insight is" has produced an announcement, not an insight; a reply opening "let me be blunt" has asked to be read as blunt instead of being blunt. Preference training gave every desirable property a cheap lexical proxy, and the proxy costs one phrase where the property costs work, so it arrives first. `dewormer` names the nine families this happens in and lists the roughly ninety phrases that carry it. Select the `Dewormer` output style for every turn, or invoke the `dewormer` skill when editing a document; detail in [`plugins/dewormer/README.md`](plugins/dewormer/README.md).

### papertime in one paragraph

A research answer for the operator of a project lands as a dated markdown note, not a chat reply: title, italic standfirst, a provenance block saying where each fact came from and whether anything was run, the answers in brief, one section per question with every term defined in its sentence and every number carrying its scale and a baseline, claims marked inline as established, inferred, recalled or speculation, at most 2,000 words, and a closing section that says what happened, what it means, what remains and what needs the operator's decision. `papertime` carries the format and the voice rules, a template, a checker that fails on em dashes and missing parts (and, given an identifier register, on unregistered identifiers), and a builder that renders the note as a designed, theme-aware HTML page. The markdown file governs; the page is a view. Detail in [`plugins/papertime/README.md`](plugins/papertime/README.md).

## Dependencies

**graphtime**
- **Codex, Python and Git**, plus an existing **Knowledge Graph Kit** checkout containing `core/map_activation.py`. The toolkit is not bundled; see the [requirements](plugins/graphtime/README.md#requirements).

**baton**
- A host with native subagents. DrDoc is bundled; no hooks, MCP server or additional runtime.

**early-prototype**
- **kanbanger MCP** — the lifecycle skills delegate kanban mutations to it. Without kanbanger, `worktime`/`chosetime`/`clocktime`/`queuetime` lose their kanban-side effect.
- **Node.js** on `PATH` — the hooks are Node scripts.

**dewormer**
- None. Markdown only, no hooks and no code.

**papertime**
- **Python 3** for the checker and the page builder; the `markdown` package for the page builder only.

**peer-board**
- **GitHub MCP server** — agents reach the board through `actions_run_trigger` and `get_file_contents`.
- **GitHub Discussions enabled** on each repo, with `Agent Board` and `PR Board` categories. No PAT or secrets needed.

## Notes

- Claude Code plugin commands use `/<plugin-name>:<name>`. In Codex CLI, select plugin skills through `/skills` or `$<plugin-name>:<skill-name>`, such as `$graphtime:graphtime`. Personal skills use their short name.
- The `Dewormer` output style is opt-in. Installing the plugin does not switch it on; pick it in `/config` under **Output style**, or set `"outputStyle": "Dewormer"` in a settings file.
- Plugins execute code (hooks). Only install marketplaces you trust.
- The early-prototype lifecycle suite stores session state in each project's `.claude/` folder (markers, inbox, notes). Graphtime uses `.project-map/` for map state and `.codex/hooks.json` for its project hook.
