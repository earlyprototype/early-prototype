---
name: sleeptime
description: |
  PM session end. Closes the PM session opened by `/teamtime`. Writes a
  PM session log entry (decisions made, Worker tasks delegated, handoffs
  reviewed, open items) to `<cwd>/.claude/inbox/pm/sessions/` (per-project,
  not global), prompts to close any still-open Worker task
  (`active-task-<shortId>.txt`) via `/clocktime`, and clears THIS session's
  `pm-session-<shortId>.txt` marker only — never another session's. Companion
  to `/teamtime` (PM session open), `/worktime` (Worker clock-in), and
  `/clocktime` (Worker task end).
---

# Sleeptime

PM session end. Writes a session-log entry summarising what happened in this PM stint, prompts on any open Worker task, and clears THIS session's shortId-scoped `pm-session-<shortId>.txt` marker.

## Tool conventions for this skill

Non-negotiable — violating them triggers the auto-mode classifier and can break the skill mid-flow:

- **File reads / existence checks → use the `Read` tool.** Treat "file does not exist" error as Absent. Do **NOT** use Bash `test -f`, `[[ -f ... ]]`, `Test-Path`, `Get-Content`, `cat`, `ls`, or any PowerShell-style probe.
- **Writing new files (the session log) → use the `Write` tool.**
- **Deletions → Bash `rm` is acceptable** (single command, no chaining).

## How

1. **Discover this session's shortId.** Used to identify which marker belongs to THIS PM session — closing one session must not affect any concurrent siblings.

   - Encode cwd: replace `\`, `/`, `:` with `-`.
   - `Glob` for `~/.claude/projects/<encoded-cwd>/*.jsonl` — the most-recently-modified result's filename minus `.jsonl` is the full UUID; the last 8 hex characters are the **shortId**.
   - **Fallback:** if discovery fails, use the literal string `unknown` as the shortId. The skill will then operate on `pm-session-unknown.txt` — almost certainly absent, in which case step 2 aborts with the "no PM session" message. Never block close-out over identity discovery.

2. **Read `<cwd>/.claude/pm-session-<shortId>.txt`** (use the `Read` tool — do not Bash-probe it):
   - **Absent** → abort with: "No PM session in this cwd for this session's shortId. Run `/teamtime` first if you want to open one. (Note: another session in this cwd may still have an open PM session — check `.claude/pm-session-*.txt`; that one is theirs to close.)"
   - **Present** → the first line is the session description. Strip leading/trailing whitespace.

3. **Check for an open Worker task FOR THIS SESSION.** If `<cwd>/.claude/active-task-<shortId>.txt` exists (matching THIS session's shortId — not any other), prompt the user with a clear choice (use `AskUserQuestion`):

   - **Run `/clocktime` first** (recommended) — abort this skill; user re-invokes `/sleeptime` after `/clocktime` finishes. Cleanest path.
   - **Carry forward** — leave the Worker task open. The next session that reuses the same shortId in this cwd (rare — UUIDs are unique per session) would see it; in practice, the marker becomes stale and is cleaned by `/cleantime`. Continue with PM session close.
   - **Force-close (advanced)** — delete `active-task-<shortId>.txt` and `worker-session-id-<shortId>.txt` without `/clocktime` cleanup. Surface a strong warning: kanban will be left in DOING/REVIEW, `worker-notes.md` will not be archived. Require explicit confirmation. Only then continue with PM session close.

   Other sessions' `active-task-*.txt` markers in the same cwd are intentionally NOT checked — each session manages its own Worker task lifecycle.

4. **Compose the PM session log entry.** Prompt the user for each section. If the user has nothing for a category, accept an empty list — minimal is fine, but write the log anyway:
   - **Decisions made** (bullets) — what PM decided this session
   - **Worker tasks delegated** (bullets) — task titles + outcomes (DONE / still-open / rejected-for-rework)
   - **Handoffs reviewed** (bullets) — inbox pointer paths acknowledged via PM:READ markers added in this session
   - **Open items** (bullets) — anything carrying to next PM session

5. **Write the session log** to `<cwd>/.claude/inbox/pm/sessions/pm-session-<YYYY-MM-DD>-<shortId>.md` (per-project, not global — each project carries its own PM session history):
   - `<YYYY-MM-DD>` is today's date.
   - `<shortId>` is this session's shortId discovered in step 1 — consistent with the marker filename, so logs are attributable to the session that produced them.
   - Body format:

   ```markdown
   # PM session log: <YYYY-MM-DD> (<shortId>)

   - **Session description:** <from pm-session-<shortId>.txt>
   - **Project:** <basename(cwd)>
   - **Started:** <mtime of pm-session-<shortId>.txt if available, else "unknown">
   - **Ended:** <now, YYYY-MM-DD HH:MM>

   ## Decisions made
   <bullets, or "_none recorded_" if empty>

   ## Worker tasks delegated
   <bullets, or "_none recorded_" if empty>

   ## Handoffs reviewed
   <bullets, or "_none recorded_" if empty>

   ## Open items
   <bullets, or "_none recorded_" if empty>

   ---
   _PM session log. Closed via /sleeptime on <YYYY-MM-DD>._
   ```

6. **Delete `<cwd>/.claude/pm-session-<shortId>.txt`.** ONLY this session's marker — never any other `pm-session-*.txt` in the cwd. The cwd is now back to "no PM session for this shortId" — the next `/teamtime` (any session) will treat it as Absent for whichever shortId it discovers.

7. **Confirm to the user** in a single block:

   ```
   PM session '<description>' (shortId <shortId>) ended.
   - Session log written to <log path>
   - pm-session-<shortId>.txt deleted (other sessions' markers untouched)
   - <conditional: Worker task was force-closed without /clocktime cleanup; kanban may need manual repair>
   ```

   Include only the lines that actually applied.

## Solo-dev vs split PM/Worker

In the solo-dev model (single session wears both hats per `Dev-Lead-SOP.md` §2), `/sleeptime` is the explicit close-out for the PM hat. In a split-session model where a separate PM session is running, `/sleeptime` is still the right verb for that PM session — the Worker session has its own `/clocktime` lifecycle, independent of PM's open/close. The shortId scoping ensures `/sleeptime` in PM session A never disturbs PM session B (or Worker session C) running at the same cwd.

## What this skill does NOT do

- It does **not** touch `_kanban.md`. PM doesn't have a kanban entry. Worker kanban state (DONE / REVIEW / etc.) is managed by `/clocktime` and the Stop hook.
- It does **not** mark inbox pointers as PM:READ. That's a separate manual edit per pointer (or a future `/marktime` skill).
- It does **not** push anything to GitHub. PM session logs are local-only by design; only Worker tasks (via `/worktime`/`/clocktime`) sync to GitHub Projects.
- It does **not** auto-close a stuck Worker task. Force-close is opt-in with explicit warning — the default is to abort and require `/clocktime`.
- It does **not** touch OTHER sessions' shortId-scoped markers. Each session manages its own close-out. Use `/cleantime` for cross-session cleanup.

## Related

- Sister skills: `/teamtime` (open PM session), `/worktime` (open Worker task), `/clocktime` (close Worker task), `/notetime` (Worker mid-task note)
- PM session log dir: `<cwd>/.claude/inbox/pm/sessions/` (per-project, written by this skill)
- Front-door doc: `~/Desktop/AI/EverythingCC/_teamtime/Worker-PM-System.md`
