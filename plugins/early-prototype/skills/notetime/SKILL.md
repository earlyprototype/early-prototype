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
- **Globbing for the transcript path (Worker identity discovery) → use the `Glob` tool.**
- **Appending the note → use the `Edit` tool** to add a new entry to `<cwd>/.claude/worker-notes.md` (or `Write` if the file doesn't yet exist). Not Bash redirection.

## Worker identity (shortId)

Each note must be stamped with the writing session's **shortId** — the last 8 hex characters of the current Claude Code session UUID. This makes notes attributable across split-session work (two Worker sessions in the same cwd → distinguishable note streams).

**Discovery (do this before composing the entry):**

1. Compute the cwd-encoded subdir name: `<cwd>` with all `\` and `/` and `:` replaced by `-`. E.g. `C:\Users\Fab2\Desktop\AI\junk2\worker-signal-test` → `C--Users-Fab2-Desktop-AI-junk2-worker-signal-test`.
2. `Glob` for `~/.claude/projects/<encoded-cwd>/*.jsonl`. The most recently-modified one (top of the Glob result) is the current session's transcript.
3. Extract the UUID from the filename (it's the full filename minus `.jsonl`). Take the last 8 hex characters → that's the shortId.
4. If the Glob returns nothing (transcript path not found), use the literal placeholder `unknown` as the shortId — never fail the note write over identity discovery.

## Precondition

`<cwd>/.claude/active-task.txt` must exist (i.e. a Worker task is open). If absent, abort with:

```
No active Worker task in this cwd. /notetime is a Worker-side mid-task ritual.
- Open a task first with /worktime, then re-invoke /notetime.
- If you wanted a PM-side observation, capture it for /sleeptime's decisions / open-items prompts at PM session close.
```

Without an open Worker task, `/notetime`'s notes have no canonical handoff to land in — the Stop hook is silent (no `active-task.txt` gate), so notes written here would sit dormant on disk. Hard-gate, don't silently write.

## How

1. **Get the note text:**
   - If the user supplied text as the slash command argument (e.g. `/notetime Found GraphQL 500 on empty filter`), use that text directly.
   - Otherwise, prompt: "What's the note? (one or more sentences)". Reject empty input and ask again.

2. **Compute timestamp** in `YYYY-MM-DD HH:MM` format (local time).

3. **Discover the Worker shortId** per the "Worker identity (shortId)" section above. Glob the transcript path, take the most recent `.jsonl`, extract last-8-hex from its filename. Fall back to `unknown` if discovery fails.

4. **Append** to `<cwd>/.claude/worker-notes.md`:
   - Create `<cwd>/.claude/` if absent
   - Create the file if absent (no header needed; entries are self-describing)
   - Always append (never overwrite). The entry shape is:

     ```

     ## <timestamp> [worker:<SHORTID>]
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
