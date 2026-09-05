# Baton

Create a session handover when you invoke `/baton`. The main agent briefs one
subagent, the subagent checks the project and writes with DrDoc, and the main
agent reviews the document before presenting it. The writer can ask the main
agent for missing context.

The handover records the current state, decisions and reasons, evidence and
checks, unfinished work and the next action. It follows the project's existing
handover convention and preserves historical handovers.

## Install

From the marketplace in Claude Code:

```text
/plugin marketplace add earlyprototype/early-prototype
/plugin install baton@early-prototype
```

From a Codex terminal:

```text
codex plugin marketplace add earlyprototype/early-prototype
codex plugin add baton@early-prototype
```

If the marketplace is already registered, refresh it first with
`/plugin marketplace update early-prototype` in Claude Code or
`codex plugin marketplace upgrade early-prototype` in Codex.

The plugin's qualified command is `/baton:baton`. For the short personal command,
copy the complete `skills/baton/` directory, including its `references/` and
`agents/` folders, to `~/.claude/skills/baton/` for Claude Code or
`~/.agents/skills/baton/` for Codex. In Codex, `$baton` also invokes the skill.
Start a new session if the new skill has not appeared. Refresh a personal copy
from the same directory when updating the plugin.

## Use

```text
/baton
/baton Focus on the import work; write docs/HANDOVER-imports.md
```

Invocation captures the development session at that point. It does not depend
on a task being finished or an agent turn ending. Both hosts have explicit
invocation controls in the package ([Claude Code](https://code.claude.com/docs/en/skills#control-who-invokes-a-skill),
[Codex](https://learn.chatgpt.com/docs/build-skills)). The workflow requires native subagents;
the main agent remains available for questions and reviews the result.

Baton saves and reviews a handover. Task completion, kanban changes, session
closure and publishing remain separate actions. It adds no hooks and needs no
MCP server or additional runtime.

## DrDoc

`skills/baton/references/drdoc.md` bundles the existing DrDoc skill so the writer
can read it without a separate installation. It retains DrDoc's `origin: ECC`
metadata and documentation rules. The orientation checklist includes both
`AGENTS.md` and `CLAUDE.md`. Baton limits its remit to the assigned handover.

MIT, as the marketplace.
