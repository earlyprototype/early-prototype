# early-prototype

A personal [Claude Code](https://code.claude.com) **plugin marketplace**.

Ships four plugins:

- **`early-prototype`** — the **timeteam** suite: Product/PM/Worker session lifecycle as installable skills, hooks, and an agent.
- **`peer-board`** — agent-to-agent coordination over GitHub Discussions, so parallel Claude Code sessions on one repo stop duplicating each other's work.
- **`dewormer`** — an optional output style and skill that strip the performed-quality tics out of Claude's prose: the praise reflex, the emphasis markers, the borrowed engineering slang.
- **`papertime`** — a skill that writes research answers as dated reading notes in the ATR house format (answer first, provenance, claims marked established, inferred or speculation, a closing section on what remains and what needs the operator's decision), with a checker and a page builder.

## What it gives you (in 30 seconds)

You sit down to work. `/early-prototype:teamtime` opens a PM session (you're now in "review, decide, delegate" mode). `/early-prototype:worktime` clocks in a Worker task — your description goes on `_kanban.md` and the Stop hook starts producing handoffs. `/early-prototype:clocktime` closes the task (moves it to DONE via a review gate). `/early-prototype:sleeptime` closes the PM session and writes a session log.

When a Worker session ends, a §6-format handoff lands in `.claude/inbox/pm/` automatically. Next time you `/early-prototype:teamtime`, unread handoffs are surfaced.

`/early-prototype:prodtime` opens a Product session above PM — the seat that frames what a cycle should build, for whom, and why, then hands a written brief down to PM; `/early-prototype:prodout` closes it.

It's session lifecycle as ambient infrastructure: kanban state, handoffs, and session-end audit happen via hooks, not via you remembering to invoke them.

## Install

```bash
# 1. Register this marketplace (once)
/plugin marketplace add earlyprototype/early-prototype

# 2. Install whichever plugin you want
/plugin install early-prototype@early-prototype
/plugin install peer-board@early-prototype
/plugin install dewormer@early-prototype
/plugin install papertime@early-prototype
```

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

## What's inside

```
early-prototype/                      (this repo = the marketplace)
├── .claude-plugin/
│   └── marketplace.json              # catalog (lists plugins)
├── README.md
└── plugins/
    └── early-prototype/              # the plugin
        ├── .claude-plugin/
        │   └── plugin.json
        ├── skills/                   # 13 skills, each a folder with SKILL.md
        ├── hooks/
        │   ├── hooks.json            # hook registration
        │   ├── worker-completion-signal.js   (Stop)
        │   ├── pm-handoff-discovery.js        (SessionStart)
        │   └── lib/                  # shared modules (handoff template, kanban mover)
        │   └── agents/
        │       └── kanban-worker.md  # Haiku subagent for kanban MCP grunt
        └── peer-board/               # the second plugin
            ├── .claude-plugin/
            │   └── plugin.json
            ├── commands/             # /peer-board:board, /peer-board:board-install
            ├── skills/peer-board/    # the protocol agents follow unprompted
            └── assets/               # GitHub Actions workflows, copied into your repo
        └── dewormer/                # the third plugin
            ├── .claude-plugin/
            │   └── plugin.json
            ├── output-styles/
            │   └── dewormer.md      # the optional `Dewormer` style
            └── skills/dewormer/     # full term list, rewrites, audit grep
        └── papertime/               # the fourth plugin
            ├── .claude-plugin/
            │   └── plugin.json
            └── skills/papertime/    # SKILL.md, references/ (format, voice),
                                     # assets/ (template), scripts/ (checker, page builder)
```

### peer-board in one paragraph

Several Claude Code sessions on one repo can't see each other, so they duplicate work and collide on hand-assigned identifiers. `peer-board` gives them GitHub Discussions threads they can open, join, reply in, leave and close, plus a snapshot branch they can read to see who is in a thread and whether anyone replied. Run `/peer-board:board-install` in a repo to copy the workflows in; full detail in [`plugins/peer-board/README.md`](plugins/peer-board/README.md).

### dewormer in one paragraph

Substance carries itself, so prose should never label itself. A sentence saying "the key insight is" has produced an announcement, not an insight; a reply opening "let me be blunt" has asked to be read as blunt instead of being blunt. Preference training gave every desirable property a cheap lexical proxy, and the proxy costs one phrase where the property costs work, so it arrives first. `dewormer` names the nine families this happens in and lists the roughly ninety phrases that carry it. Select the `Dewormer` output style for every turn, or invoke the `dewormer` skill when editing a document; detail in [`plugins/dewormer/README.md`](plugins/dewormer/README.md).

### papertime in one paragraph

A research answer for the operator of a project lands as a dated markdown note, not a chat reply: title, italic standfirst, a provenance block saying where each fact came from and whether anything was run, the answers in brief, one section per question with every term defined in its sentence and every number carrying its scale and a baseline, claims marked inline as established, inferred or speculation, and a closing section that says what happened, what it means, what remains and what needs the operator's decision. `papertime` carries the format and the voice rules, a template, a checker that fails on em dashes and missing parts (and, given an identifier register, on unregistered identifiers), and a builder that renders the note as a designed, theme-aware HTML page. The markdown file governs; the page is a view. Detail in [`plugins/papertime/README.md`](plugins/papertime/README.md).

## Dependencies

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

- Skills and commands inside a plugin are always namespaced as `/<plugin-name>:<name>` — so `early-prototype:`, `peer-board:`, `dewormer:` and `papertime:` respectively.
- The `Dewormer` output style is opt-in. Installing the plugin does not switch it on; pick it in `/config` under **Output style**, or set `"outputStyle": "Dewormer"` in a settings file.
- Plugins execute code (hooks). Only install marketplaces you trust.
- Session state lives in each project's `.claude/` folder (markers, inbox, notes). The plugin reads/writes there at runtime; no global state.
