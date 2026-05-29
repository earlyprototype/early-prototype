# coachtime

Thom's ECC **coach** — the mentor layer that helps you recognise and pick the
right Claude Code tool the moment you ask. It does not write code. It names the
tool, says what it does, and teaches the thinking around when it pays off.

**Pull-primary**: ask when you need a tool (*"what should I use for X?"*) and
coach answers from a curated pool, grounded in what you've actually been doing in
the project. It never nags or interrupts.

## When to reach for it

- The start of a learning / orientation session.
- Any *"which tool should I reach for?"* moment.
- When you're about to reinvent something a Claude Code primitive already does.

Not for: implementation (that's a Worker session — `/worktime`) or deciding what
to build (that's cycle-framing).

## Install

Coach ships as the `coachtime` plugin in the early-prototype marketplace.

```sh
# add the marketplace (once)
claude plugin marketplace add earlyprototype/early-prototype

# install coach
claude plugin install coachtime@early-prototype
```

Or in-session: `/plugin` → marketplace `early-prototype` → install `coachtime`.

## Use

```
/coachtime     # open a coach session (adopts the persona, loads the pool)
...            # ask tool questions on demand
/coachout      # close the coach session
```

Running `/coachtime` in a project also drops a `.coachtime` marker, which opts
that project into coach's capture hooks. In any project without that marker,
coach's capture hooks stay completely silent — nothing is written into projects
you haven't opted in.

## What's inside

| Path | What |
|---|---|
| `skills/coachtime/` | The coach skill — persona, standing context, curated pool, references |
| `skills/coachout/` | The close ritual |
| `hooks/coach-history-mirror.js` | PostToolUse — permanent per-project tool/skill log (gated on `.coachtime`) |
| `hooks/coach-intent-capture.js` | SessionStart + UserPromptSubmit — records/surfaces session intent (gated on `.coachtime`) |
| `hooks/coach-drift-flag.js` | PreToolUse — flags editor use during a live coach session (gated on the session marker) |
| `hooks/tests/` | Integration tests (`node hooks/tests/<name>.test.js`) |
| `.claude-plugin/plugin.json` | Plugin manifest |

## How coach stays scoped

Coach's hooks are registered by the plugin and fire wherever the plugin is
enabled — so they **self-gate**:

- **Capture** (history + intent) runs only in projects marked with `.coachtime`.
- **Drift detection** runs only during an active `/coachtime` session (18h TTL).

## Related

Coach is the mentor layer for the **timeteam** PM/Worker lifecycle suite (the
`early-prototype` plugin in the same marketplace). Coach mentors about it but
ships independently.
