---
name: notetime
description: |
  Append a timestamped Worker note to `<cwd>/.claude/worker-notes.md`. The
  Stop hook embeds these notes into the "Issues encountered + resolutions"
  section of the canonical §6 handoff so PM sees them on every read.
  Use mid-session when Worker hits a tricky bug, makes a non-obvious
  decision, or wants to leave a breadcrumb for PM beyond the auto-generated
  summary. Companion to `/worktime` (Worker clock-in) and `/clocktime` (Worker clock-out).
---

# Notetime

Append one timestamped note from Worker to the project's `worker-notes.md`. The Stop hook embeds these into the canonical §6 handoff (capped at 4096 chars with elision) so PM sees them automatically.

## Tool conventions for this skill

Non-negotiable — violating them triggers the auto-mode classifier and can break the skill mid-flow:

- **File existence / content checks → use the `Read` tool.** Do **NOT** use Bash `test -f`, `[[ -f ... ]]`, `Test-Path`, `Get-Content`, `cat`, `ls`, or any PowerShell-style probe.
- **Appending the note → use the `Edit` tool** to add a new entry to `<cwd>/.claude/worker-notes.md` (or `Write` if the file doesn't yet exist). Not Bash redirection.

## Worker identity (shortId)

Match `${CLAUDE_SESSION_ID}` against `/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{4}([0-9a-f]{8})$/i`. If the UUID is missing or invalid, report that session identity is unavailable and use `unknown`. Otherwise, the lowercase capture is `<shortId>`. Use `Read` on `<cwd>/.claude/session-id-${CLAUDE_SESSION_ID}.txt` to confirm it. Keep the captured shortId if the file is missing, empty, or disagrees.

## Precondition

Use `Read` on `<cwd>/.claude/active-task-<shortId>.txt` to check that this Worker has an open task. If the file is absent, stop with the following message.

```
No active Worker task in this cwd. /notetime is a Worker-side mid-task ritual.
- Open a task first with /worktime, then re-invoke /notetime.
- If you wanted a PM-side observation, capture it for /sleeptime's decisions / open-items prompts at PM session close.
```

## How

1. **Get the note text:**
   - If the user supplied text as the slash command argument (e.g. `/notetime Found GraphQL 500 on empty filter`), use that text directly.
   - Otherwise, prompt: "What's the note? (one or more sentences)". Reject empty input and ask again.

2. **Compute timestamp** in `YYYY-MM-DD HH:MM` format (local time).

3. **Append** to `<cwd>/.claude/worker-notes.md` using the same shortId as the task check.
   - Create `<cwd>/.claude/` if absent
   - Create the file if absent (no header needed; entries are self-describing)
   - Always append (never overwrite). The entry shape is:

     ```

     ## <timestamp> [worker:<shortId>]
     <note text, trimmed>
     ```

     The blank line before the new `## <timestamp>` separates it cleanly from any prior entry.

4. **Confirm** to the user in a single line:

   ```
   Note added at <timestamp>. Will appear in the next §6 handoff under "Issues encountered + resolutions".
   ```

## When to use

- Worker hit a tricky bug and wants PM to know the workaround
- Worker made a non-obvious decision PM should understand later
- Worker noticed something out of scope worth flagging
- Worker wants to leave a breadcrumb for the next session

## When NOT to use

- For content that belongs in `## How to resume` or `## Open architectural questions` of the canonical §6 handoff — those sections are filled by Worker manually before stop. `/notetime` is for in-flight, time-stamped commentary, not the structured close-out.
- For tasks that need actual PM action (use a separate communication channel — `/notetime` is one-way).

## Size cap

The Stop hook embeds at most 4096 chars of `worker-notes.md` content in the canonical handoff (older notes elided with a pointer to the full file). Notes are unbounded on disk; only the embed is capped. If notes are getting long, consider running `/clocktime` to archive them and reset for the next task.

## What this skill does NOT do

- It does **not** push the note to `<cwd>/.claude/inbox/pm/` directly. The note flows into PM's view via the canonical §6 handoff that inbox pointers link to.
- It does **not** modify or trigger the Stop hook. The hook fires automatically per response after this skill runs.
- It does **not** require the kanbanger MCP. Notes are pure-filesystem.

## Related

- Sister skills: `/teamtime` (PM session open), `/worktime` (Worker clock-in), `/clocktime` (Worker clock-out, archives notes), `/sleeptime` (PM session close)
- Where notes are embedded: handoff template's "Issues encountered + resolutions" section
- Notes archive (created by `/clocktime`): `<cwd>/.claude/worker-notes-<DATE>-<TASKSLUG>.archive`
