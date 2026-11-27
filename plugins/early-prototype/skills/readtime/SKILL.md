---
name: readtime
description: |
  PM ritual to acknowledge an unread Worker handoff. Lists unread handoff
  pointers in `<cwd>/.claude/inbox/pm/`, lets the user pick one, opens
  the canonical §6 handoff for review, then appends the PM:READ marker
  to the pointer so it's filtered out of future SessionStart and
  `/check-handoffs` surfacing. Requires an open PM session
  (`<cwd>/.claude/pm-session-<shortId>.txt`). Companion to `/check-handoffs`
  (lists without acknowledging) and the SessionStart auto-discovery hook.
---

# Readtime

PM-side acknowledgement ritual. Lists unread handoffs, opens the chosen one's canonical §6 handoff for review, then marks the pointer as PM:READ. Closes the "Worker → PM → acknowledged" loop without leaving the discipline implicit.

## Tool conventions for this skill

Non-negotiable — violating them triggers the auto-mode classifier and can break the skill mid-flow:

- **File existence / content checks → use the `Read` tool.** Treat "file does not exist" error as Absent. Do **NOT** use Bash `test -f`, `[[ -f ... ]]`, `Test-Path`, `Get-Content`, `cat`, `ls`, or any PowerShell-style probe.
- **Listing inbox files → use the `Glob` tool** (e.g., `<cwd>/.claude/inbox/pm/handoff-*.md`).
- **Appending the PM:READ marker → use the `Edit` tool** (append the marker line to the existing pointer file). Not Bash redirection (`>>`) — `Edit` is cleaner and explicit.

## PM identity (shortId)

Match `${CLAUDE_SESSION_ID}` against `/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{4}([0-9a-f]{8})$/i`. If the UUID is missing or invalid, report that session identity is unavailable and use `unknown`. Otherwise, the lowercase capture is `<shortId>`. Use `Read` on `<cwd>/.claude/session-id-${CLAUDE_SESSION_ID}.txt` to confirm it. Keep the captured shortId if the file is missing, empty, or disagrees.

## Precondition

`<cwd>/.claude/pm-session-<shortId>.txt` must exist. If absent, abort with:

```
No PM session in this cwd. Run /teamtime first to open one, then /readtime to acknowledge handoffs.
```

Acknowledging handoffs is a PM action — needs an open PM posture, not Worker mode.

## How

1. **List unread pointers in the per-project inbox.** Use `Glob` to enumerate `<cwd>/.claude/inbox/pm/handoff-*.md`. For each file:
   - Use `Read` to load its content.
   - Skip any pointer with an acknowledgement on its own line. Match each line against `^[ \t]*<!--[ \t]*PM:READ:\d{4}-\d{2}-\d{2}(?:[ \t]+pm:(?:[0-9A-Fa-f]{8}|unknown))?[ \t]*-->[ \t]*\r?$`. This accepts a date alone, a PM shortId, and the older `pm:unknown` suffix.
   - Build a list of unread pointers, sorted by file mtime descending (most recent first).

   If the list is empty, confirm:
   ```
   No unread handoffs in this project's inbox. Nothing to acknowledge.
   ```
   And exit.

2. **Present the unread list to the user.** For each unread pointer, extract the four header fields (`Active task`, `Project`, `Status`, `Canonical handoff`) by reading the markdown. Display as a numbered list:

   ```
   Unread Worker handoffs in this project (most recent first):

   1. [<DATE> <SHORTID>] <Active task title>
      Status: <Status line>
      Canonical: <Canonical handoff path>

   2. [<DATE> <SHORTID>] <Active task title>
      ...
   ```

   Then ask via `AskUserQuestion`:
   - "Which handoff to read and acknowledge?" — options: each numbered handoff + "Cancel"

3. **STOP and explicitly wait for the user to pick.** Do NOT synthesize a choice. The user must select.

4. **Open the chosen canonical handoff.** Use `Read` on the path from the pointer's "Canonical handoff" line. Present the full §6 content to the user — all sections, including the auto-filled "Issues encountered + resolutions" (which embeds any worker-notes via the Stop hook) and the file index.

   If the canonical handoff path is missing or unreadable, surface the error and present the pointer-only content instead, with a warning: "Canonical handoff not found at <path>; presenting pointer only."

5. **Ask the user whether to mark PM:READ.** Via `AskUserQuestion` with three options:
   - **Mark PM:READ** — append the marker to the pointer and exit
   - **Skip (don't mark)** — leave pointer unread, exit (user can re-invoke `/readtime` later)
   - **Show another** — return to step 2's list (user wants to review more without acknowledging this one yet)

6. **If "Mark PM:READ"**, use `Edit` to append one line to the pointer. Use today's local date in place of `YYYY-MM-DD`.

   - With a valid shortId, append `<!-- PM:READ:YYYY-MM-DD pm:<shortId> -->`.
   - If the shortId is `unknown`, append `<!-- PM:READ:YYYY-MM-DD -->`.

   On success, confirm:

   ```
   Acknowledged: <Active task title> (<DATE> <SHORTID>).
   Pointer marked PM:READ:<YYYY-MM-DD>. It will no longer surface in /check-handoffs or SessionStart.
   PM session remains open. Run /readtime again to acknowledge more, or /sleeptime to close PM.
   ```

7. **If "Show another":** return to step 2 (re-present the unread list, refreshed to exclude any newly-marked entries). Loop until the user picks "Cancel" or "Skip".

## What this skill does NOT do

- It does **not** modify the canonical §6 handoff in the project root — only the pointer file in `.claude/inbox/pm/`. The canonical stays the source of truth for the work's content; the pointer is just the inbox-side acknowledgement.
- It does **not** delete the pointer. Acknowledged pointers remain on disk (with the marker) as historical record. If the user wants to purge old pointers, that's a separate housekeeping action (or a future skill).
- It does **not** touch `_kanban.md` or call the kanbanger MCP. Acknowledging a handoff is filesystem-only — it doesn't move the kanban entry. If the Worker task is in REVIEW and PM wants to approve/reject the work itself, use `approve_done` / `reject_review` via the kanbanger MCP separately.
- It does **not** mark multiple pointers in a single invocation. v1 is one-at-a-time. A future v2 could add `--all` for batch acknowledgement.
- It does **not** archive or move the canonical handoff. That stays in the project root for the historical record.

## Lifecycle context

`/readtime` sits between *receiving a signal* and *deciding what to do about it*:

1. Worker `/clocktime` → Stop hook writes canonical + pointer in PM inbox.
2. PM `/teamtime` next session → SessionStart hook surfaces pointer in injected context.
3. PM reads the pointer's summary, decides whether to action it.
4. PM `/readtime` → opens canonical, acknowledges with PM:READ marker.
5. PM (optional) takes action — `approve_done` if the Worker work is good, `reject_review` if it needs rework, or just files it.
6. Next `/check-handoffs` no longer shows the acknowledged handoff.

The acknowledgement is *separate* from the kanban approval — they're different signals. `/readtime` says "PM has seen this"; `approve_done` says "PM has approved the work as complete."

## Related

- Sister skills: `/teamtime` (open PM session), `/check-handoffs` (list unread without acknowledging), `/sleeptime` (close PM session)
- SessionStart uses the plugin's `hooks/pm-handoff-discovery.js` to list unread pointers.
- Front-door doc: `~/Desktop/AI/EverythingCC/_teamtime/Worker-PM-System.md`
