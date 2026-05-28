---
name: readtime
description: |
  PM ritual to acknowledge an unread Worker handoff. Lists unread handoff
  pointers in `<cwd>/.claude/inbox/pm/` (i.e., files without a
  `<!-- PM:READ:YYYY-MM-DD -->` marker), lets the user pick one, opens
  the canonical §6 handoff for review, then appends the PM:READ marker
  to the pointer so it's filtered out of future SessionStart and
  `/check-handoffs` surfacing. Requires an open PM session
  (`<cwd>/.claude/pm-session.txt`). Companion to `/check-handoffs`
  (lists without acknowledging) and the SessionStart auto-discovery hook.
---

# Readtime

PM-side acknowledgement ritual. Lists unread handoffs, opens the chosen one's canonical §6 handoff for review, then marks the pointer as PM:READ. Closes the "Worker → PM → acknowledged" loop without leaving the discipline implicit.

## Tool conventions for this skill

Non-negotiable — violating them triggers the auto-mode classifier and can break the skill mid-flow:

- **File existence / content checks → use the `Read` tool.** Treat "file does not exist" error as Absent. Do **NOT** use Bash `test -f`, `[[ -f ... ]]`, `Test-Path`, `Get-Content`, `cat`, `ls`, or any PowerShell-style probe.
- **Listing inbox files → use the `Glob` tool** (e.g., `<cwd>/.claude/inbox/pm/handoff-*.md`).
- **Globbing for the transcript path (PM identity discovery) → use the `Glob` tool** against `~/.claude/projects/<encoded-cwd>/*.jsonl`.
- **Appending the PM:READ marker → use the `Edit` tool** (append the marker line to the existing pointer file). Not Bash redirection (`>>`) — `Edit` is cleaner and explicit.

## PM identity (shortId)

When marking a pointer PM:READ, stamp the marker with the **current PM session's shortId** — the last 8 hex characters of the Claude Code session UUID. This attributes the acknowledgement to a specific PM session (matters in split-session and audit contexts).

**Discovery:** identical pattern to `/notetime`'s Worker identity discovery, but the value is labelled `pm:` instead of `worker:` in the marker.

1. Encode cwd: replace `\` `/` `:` with `-`.
2. `Glob` `~/.claude/projects/<encoded-cwd>/*.jsonl`.
3. Take the most recently-modified file's name, drop `.jsonl`, take last 8 hex chars.
4. If discovery fails, use `unknown` literally — don't fail the acknowledgement over identity.

The marker format is:

```
<!-- PM:READ:YYYY-MM-DD pm:XXXXXXXX -->
```

The legacy form (no `pm:` suffix) remains valid for backward compatibility — the SessionStart hook's regex accepts both shapes.

## Precondition

`<cwd>/.claude/pm-session.txt` must exist. If absent, abort with:

```
No PM session in this cwd. Run /teamtime first to open one, then /readtime to acknowledge handoffs.
```

Acknowledging handoffs is a PM action — needs an open PM posture, not Worker mode.

## How

1. **List unread pointers in the per-project inbox.** Use `Glob` to enumerate `<cwd>/.claude/inbox/pm/handoff-*.md`. For each file:
   - Use `Read` to load its content.
   - Check whether it contains a line matching `<!-- PM:READ:YYYY-MM-DD -->` (regex tolerant of whitespace: `<!--\s*PM:READ:\d{4}-\d{2}-\d{2}\s*-->`).
   - **Skip files that already have the marker** — they're already acknowledged.
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

6. **If "Mark PM:READ":** use `Edit` to append a new marker line at the end of the pointer file:

   ```
   <!-- PM:READ:YYYY-MM-DD pm:XXXXXXXX -->
   ```

   - Use today's date (cwd-local).
   - `XXXXXXXX` is the PM session's shortId discovered per the "PM identity (shortId)" section above. If discovery failed, use `unknown` literally.
   - The marker line should be the last line of the file. Use `Edit` to add it (read the file, find a unique tail-anchor like the closing `---\n_Pointer only...` line, replace that with the same line plus the marker on a new line).

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
- SessionStart auto-discovery hook: `~/.claude/hooks/pm-handoff-discovery.js` (uses the same PM:READ marker convention)
- Front-door doc: `~/Desktop/AI/EverythingCC/_teamtime/Worker-PM-System.md`
