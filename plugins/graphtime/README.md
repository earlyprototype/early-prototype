# Graphtime

Enable, inspect, or disable Project Knowledge Map context for the current Codex
project. Activation persists across restarts; turning it off keeps stored knowledge.

## Requirements

Codex, Python 3 and Git, plus an existing Knowledge Graph Kit checkout containing
`core/map_activation.py` and its supporting core modules. The toolkit is not
bundled here. The activation helper is currently part of the local Project Map
implementation; a fresh clone of the published kit may not contain it yet.

The skill locates the checkout from available session context. Keep the target
project as the working folder when invoking it. The adapter configures Codex hooks.

## Install

From a Codex terminal:

```text
codex plugin marketplace add earlyprototype/early-prototype
codex plugin add graphtime@early-prototype
```

If the marketplace is already registered, refresh it first with
`codex plugin marketplace upgrade early-prototype`.

In Codex CLI, invoke `$graphtime:graphtime` or select the plugin skill through
`/skills`. Use the skill selector in other Codex interfaces. For a personal copy,
copy the complete `skills/graphtime/` directory, including `agents/`, to
`~/.agents/skills/graphtime/` and invoke `$graphtime` in Codex CLI.
Start a new session if it has not appeared. Update any personal copy when
updating the plugin.

## Use

| Codex CLI plugin invocation | Effect |
|---|---|
| `$graphtime:graphtime` | Enable the chosen project's opt-in and prepare its hook. |
| `$graphtime:graphtime status` | Show the saved project root and opt-in state. |
| `$graphtime:graphtime off` | Stop delivery while retaining stored knowledge. |

For a personal copy, use the same arguments after `$graphtime`.
Nested folders reuse their nearest saved root. Deliberate subprojects and
independent Git repositories retain their own boundaries.

Codex may require the owner to enable and trust the prepared command through
`/hooks`. The helper never changes that trust state. After trust, the project
hook supplies the toolkit's deterministic context package; host curation remains
the toolkit's existing prepare/judge/deliver workflow.

MIT, as the marketplace.
