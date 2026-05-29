# early-prototype

A personal [Claude Code](https://code.claude.com) **plugin marketplace**.

Ships two plugins: **`early-prototype`** — the **timeteam** suite (Product/PM/Worker session lifecycle as installable skills, hooks, and an agent) — and **`coachtime`**, a standalone mentor layer installed separately.

## What it gives you (in 30 seconds)

You sit down to work. `/early-prototype:teamtime` opens a PM session (you're now in "review, decide, delegate" mode). `/early-prototype:worktime` clocks in a Worker task — your description goes on `_kanban.md` and the Stop hook starts producing handoffs. `/early-prototype:clocktime` closes the task (moves it to DONE via a review gate). `/early-prototype:sleeptime` closes the PM session and writes a session log.

When a Worker session ends, a §6-format handoff lands in `.claude/inbox/pm/` automatically. Next time you `/early-prototype:teamtime`, unread handoffs are surfaced.

`/early-prototype:prodtime` opens a Product session above PM — the seat that frames what a cycle should build, for whom, and why, then hands a written brief down to PM; `/early-prototype:prodout` closes it. (The coach/mentor layer now lives in its own `coachtime` plugin, installed separately.)

It's session lifecycle as ambient infrastructure: kanban state, handoffs, and session-end audit happen via hooks, not via you remembering to invoke them.

## Install

```bash
# 1. Register this marketplace (once)
/plugin marketplace add earlyprototype/early-prototype

# 2. Install the plugin
/plugin install early-prototype@early-prototype
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
- `/early-prototype:workcoachtime` — coach session (work variant)
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
        │   ├── coach-drift-flag.js            (PreToolUse)
        │   ├── coach-intent-capture.js        (SessionStart + UserPromptSubmit)
        │   ├── coach-history-mirror.js        (PostToolUse)
        │   ├── lib/                  # shared modules (handoff template, kanban mover)
        │   └── tests/                # hook unit tests
        └── agents/
            └── kanban-worker.md      # Haiku subagent for kanban MCP grunt
```

## Dependencies

- **kanbanger MCP** — the lifecycle skills delegate kanban mutations to it. Without kanbanger, `worktime`/`chosetime`/`clocktime`/`queuetime` lose their kanban-side effect.
- **Node.js** on `PATH` — the hooks are Node scripts.

## Notes

- Skills inside a plugin are always namespaced as `/<plugin-name>:<skill-name>`. Here that means `early-prototype:`.
- Plugins execute code (hooks). Only install marketplaces you trust.
- Session state lives in each project's `.claude/` folder (markers, inbox, notes). The plugin reads/writes there at runtime; no global state.
