---
name: coachout
description: |
  Coach session end. Parallel to `/sleeptime` for the PM lane.
  Reads `<cwd>/.claude/coach-session-<shortId>.txt` for THIS session's
  shortId, deletes it, and confirms — the `coach-drift-flag`
  PreToolUse hook will then stay silent for this session until the
  next `/coachtime`. Companion close ritual for `/coachtime`.
---

# Coachout

Coach session end. Clears THIS session's shortId-scoped `coach-session-<shortId>.txt` marker so the `coach-drift-flag` hook stops flagging this session's editor tool calls. Sister close ritual to `/coachtime`; mirrors the role `/sleeptime` plays for `/teamtime` and `/clocktime` plays for `/worktime`.

## When to Use

At the explicit end of a coach session — when you're switching out of mentor posture and into PM or Worker mode, or wrapping for the day. Without this, the coach marker persists until the 18h TTL inside `coach-drift-flag.js` expires it (built-in forget-safety, but explicit close is cleaner).

## Tool conventions for this skill

Non-negotiable — violating them triggers the auto-mode classifier and can break the skill mid-flow:

- **File reads / existence checks → use the `Read` tool.** Treat "file does not exist" error as Absent. Do **NOT** use Bash `test -f`, `[[ -f ... ]]`, `Test-Path`, `Get-Content`, `cat`, `ls`, or any PowerShell-style probe.
- **Deletions → Bash `rm` is acceptable** (single command, no chaining).

## How

1. **Discover this session's shortId.** Used to identify which marker belongs to THIS coach session — closing one session must not affect any concurrent siblings.

   - Encode cwd: replace `\`, `/`, `:` with `-`.
   - `Glob` for `~/.claude/projects/<encoded-cwd>/*.jsonl` — the most-recently-modified result's filename minus `.jsonl` is the full UUID; the last 8 hex characters are the **shortId**.
   - **Fallback:** if discovery fails, use the literal string `unknown` as the shortId. The skill will then operate on `coach-session-unknown.txt` — almost certainly absent, in which case step 2 emits the "no coach session" message and exits clean. Never block close-out over identity discovery.

2. **Read `<cwd>/.claude/coach-session-<shortId>.txt`** (use the `Read` tool — do not Bash-probe it):
   - **Absent** → emit (non-error, this is fine):
     ```
     No coach session in this cwd for this session's shortId. Nothing to close.
     (Note: another session in this cwd may still have an open coach session — check `.claude/coach-session-*.txt`; that one is theirs to close.)
     ```
     Exit clean.
   - **Present** → continue. (The file's content is just the open-timestamp line; we don't need to parse it — we just need to confirm it exists before deleting.)

3. **Delete `<cwd>/.claude/coach-session-<shortId>.txt`.** ONLY this session's marker — never any other `coach-session-*.txt` in the cwd. The `coach-drift-flag` hook will go silent for THIS session on its next PreToolUse fire (it checks the scoped marker every call, so the change is immediate).

4. **Confirm to the user** in a single line:

   ```
   Coach session closed at <ISO-8601 timestamp>. Drift hook silent until next /coachtime.
   ```

   Use the current ISO-8601 timestamp (with seconds precision, e.g. `2026-05-28T14:32:17Z` — UTC suffix optional but conventional).

## Posture after `/coachout`

The coach role is released. No more on-demand tool recommendations from this session. PreToolUse drift flag goes silent for this session's editor calls.

If the user wants to switch into PM mode after closing the coach session, they should run `/teamtime` to open a PM session in the same cwd. The two postures are independent; `/coachout` does not auto-open anything else.

## What this skill does NOT do

- It does **not** write a session log. Unlike `/sleeptime`, there's no equivalent "decisions made / handoffs reviewed" output for coach work — the coach's value is in-the-moment recommendations, not durable artifacts. The permanent `coach-history.jsonl` (written by the `coach-history-mirror` hook) already captures what was actually invoked during the session; no narrative summary needed.
- It does **not** touch the kanbanger MCP. Coach has no kanban entries.
- It does **not** touch OTHER sessions' shortId-scoped coach markers. Each session manages its own close-out. Use `/cleantime` for cross-session cleanup.
- It does **not** end any other posture's session (PM via `/sleeptime`, Worker via `/clocktime`). One verb, one job.

## Related

- Companion open ritual: `/coachtime` (writes the marker this skill deletes).
- Sister close rituals: `/sleeptime` (PM session end), `/clocktime` (Worker task end).
- The hook that respects the marker: `~/.claude/hooks/coach-drift-flag.js`.
- Front-door doc: `~/Desktop/AI/EverythingCC/_teamtime/Worker-PM-System.md` (PM/Worker side); `~/Desktop/AI/EverythingCC/Coaching/Coach-SOP.md` (coach side).
