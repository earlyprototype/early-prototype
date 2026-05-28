---
name: clocktime
description: |
  Worker task end. Reads `<cwd>/.claude/active-task-<shortId>.txt`, moves the
  kanban task to `## DONE` via the kanbanger MCP review-gate (propose_done +
  approve_done), archives the Worker notes file, and clears THIS session's
  shortId-scoped markers so the Stop hook stops producing handoffs for this
  task. Other sessions' markers in the same cwd are intentionally not touched.
  The PM session (`pm-session-<shortId>.txt`) is NOT touched — multiple
  `/worktime` → `/clocktime` cycles can run inside one PM session.
  Companion to `/worktime` (Worker clock-in) and `/notetime` (mid-task
  notes). Use `/sleeptime` to close the containing PM session.
---

# Clocktime

Worker task end. Approves the task as done through kanbanger's review gate, syncs to GitHub, archives the Worker notes, and clears THIS session's shortId-scoped active-task + worker-session-id markers. The containing PM session continues — use `/sleeptime` to end it.

## Tool conventions for this skill

Non-negotiable — violating them triggers the auto-mode classifier and can break the skill mid-flow:

- **File reads / existence checks → use the `Read` tool.** Do **NOT** use Bash `test -f`, `[[ -f ... ]]`, `Test-Path`, `Get-Content`, `cat`, `ls`, or any PowerShell-style probe.
- **Renames / archives → Bash `mv` is acceptable** (single command per file, no chaining).
- **Deletions → Bash `rm` is acceptable** (single command per file, no chaining).
- **Kanbanger MCP calls → delegated to the Haiku `kanban-worker` subagent via `Task`** (see "MCP delegation" below). Do NOT invoke `mcp__kanbanger__*` tools directly from this session.

## MCP delegation (Haiku kanban-worker subagent)

**All kanbanger MCP calls in this skill are delegated to the `kanban-worker` Haiku subagent via the `Task` tool.** Do NOT invoke `mcp__kanbanger__*` tools directly from this session.

When the steps below name a kanbanger operation (e.g. `approve_done`, `propose_done`, `sync_to_github`), execute it as:

```
Task(
  description: "<3-5 word task description>",
  subagent_type: "kanban-worker",
  prompt: "<instruction string>"
)
```

The kanban-worker returns one line per step (`OK: <summary>` or `ERR <code>: <explanation>`). Parse and branch in main context.

**Review-gate recovery pattern** — `/clocktime`'s most-frequent case. The Stop hook usually has already moved the task DOING → REVIEW, so `approve_done` alone usually succeeds. When it doesn't (Stop hadn't fired, or task was reverted), the recovery is `propose_done` + `approve_done`. Implement as two Task invocations driven by main-context judgement:

1. First call: `Task(prompt: "approve_done(title=\"<X>\") then sync_to_github()")`
2. If the first OK line is `ERR ERROR_INVALID_STATE`: second call: `Task(prompt: "propose_done(title=\"<X>\") then approve_done(title=\"<X>\") then sync_to_github()")`
3. If either step in the second call ERRs: surface the structured error to user, abort cleanup (don't archive notes or delete `active-task-<shortId>.txt` if the kanban-side state isn't reconciled).

Don't try to encode this branching as a single Haiku instruction — the recovery is judgement-dependent (caller decides whether to retry, abort, or escalate). Haiku executes one path at a time and reports; main context decides what comes next.

Per `~/.claude/rules/performance.md`: Haiku for the MCP grunt, Opus/Sonnet for the recovery judgement.

## How

1. **Discover this session's shortId.** Used to identify which markers belong to THIS session — clocking out one session must not affect any concurrent siblings.

   - Encode cwd: replace `\`, `/`, `:` with `-`.
   - `Glob` for `~/.claude/projects/<encoded-cwd>/*.jsonl` — the most-recently-modified result's filename minus `.jsonl` is the full UUID; the last 8 hex characters are the **shortId**.
   - **Fallback:** if discovery fails, use the literal string `unknown` as the shortId. The skill will then operate on `active-task-unknown.txt` / `worker-session-id-unknown.txt` — almost certainly absent, in which case step 2 aborts with the "no active task" message. Never block clock-out over identity discovery; the cleanup is still safe.

2. **Read `<cwd>/.claude/active-task-<shortId>.txt`** (use the `Read` tool — do not Bash-probe it):
   - **Absent** → abort with: "No active Worker task in this cwd for this session's shortId. Run `/worktime` first if you want to open one. (Note: another session in this cwd may still have an open task — check `.claude/active-task-*.txt`; that one is theirs to close.)"
   - **Present** → the first line is the task title. Strip leading/trailing whitespace.

3. Approve the task via the kanbanger MCP. Try **`approve_done(title)`** first (assumes the Stop hook already moved the task DOING→REVIEW):
   - **Success** → continue to step 4.
   - **`ERROR_INVALID_STATE`** → the task is still in DOING (the Stop hook never fired, or fired but a manual edit reverted state, or you're clocking out before any response from the agent). Recover by calling **`propose_done(title)`** to move DOING→REVIEW, then call **`approve_done(title)`** again. If the second call still fails, surface the error and stop.
   - **`ERROR_TASK_NOT_FOUND`** → surface the structured error including the available titles. Ask the user whether to:
     - retry with a corrected title (e.g. typo in the active-task marker)
     - skip kanban entirely and continue with cleanup (steps 5-7)
     - abort the skill
   - **`ERROR_KANBAN_NOT_FOUND`** → the project has no `_kanban.md`. Skip kanban silently; continue with cleanup.

4. If kanban moves succeeded, call kanbanger MCP **`sync_to_github`** to push the DONE state to GitHub Projects. Best-effort — on any error, emit a one-line warning ("kanban-sync warning: <code>") and continue. Don't abort cleanup.

5. Archive Worker notes if present. Look for `<cwd>/.claude/worker-notes.md`. If it exists:
   - Compute `<TASKSLUG>` from the task title: lowercase, non-alphanumeric → `-`, strip leading/trailing `-`, cap at 40 chars (mirror the slugify used by the Stop hook so archive filenames match the canonical handoff family).
   - Rename to `<cwd>/.claude/worker-notes-<YYYY-MM-DD>-<TASKSLUG>.archive`.
   - If the archive path already exists (multiple `/clocktime` calls same task same day), append a numeric suffix `-1`, `-2`, etc., until a free name is found.

   Note: `worker-notes.md` is currently NOT shortId-scoped — it's a single file per cwd. Two concurrent sessions clocking out in the same cwd race on this file. Acceptable as a v1 trade-off — `/notetime` writes are append-only and ISO-timestamped per entry, so notes from both sessions land coherently in whichever archive lands first; the second `/clocktime` finds an empty `worker-notes.md` and skips the archive step. If split-session note attribution becomes important, scope this marker too in a future iteration.

6. Delete `<cwd>/.claude/active-task-<shortId>.txt`. The Stop hook (for THIS session) will go silent in this cwd until the next `/worktime`. The PM session marker (`pm-session-<shortId>.txt`) is left intact. Other sessions' active-task markers are not touched.

6a. **Delete `<cwd>/.claude/worker-session-id-<shortId>.txt`** if present. This is the session-id gate paired with the active-task marker — clear it together so the Stop hook fully releases for this session. Skip silently if the file doesn't exist (legacy projects without the marker, or step 1's shortId fallback hit `unknown`).

7. Confirm to the user in a single block:

   ```
   Worker task '<title>' marked DONE.
   - Worker mode cleared for shortId <shortId> (.claude/active-task-<shortId>.txt + worker-session-id-<shortId>.txt deleted)
   - Worker notes archived to <archive-path> (if any)
   - PM session remains open. Use /worktime to delegate another task, or /sleeptime to end the PM session.
   ```

   Include only the lines that actually applied (skip the notes line if no archive happened, etc.).

## Solo-dev vs split PM/Worker

This skill represents the Worker's own "done" — in the solo-dev model (single session wears both hats per Dev-Lead-SOP §2), the Worker also acts as PM and approves their own work via `approve_done`. For a multi-session PM/Worker split, replace step 3 with `propose_done` only and let a separate PM-side invocation perform the approval. That variant is out of scope here; `/clocktime` assumes solo authority.

## What this skill does NOT do

- It does **not** mark related inbox pointers as PM:READ. Worker has no business marking PM's read state — that stays manual on the PM side (or a future `/marktime` skill).
- It does **not** archive or delete the canonical `session-handover-<DATE>-<TASKSLUG>.md` in the project folder. Those persist as the historical record; clean them up manually or via a separate housekeeping skill if the project grows noisy.
- It does **not** create the Rework path that kanbanger's `reject_review(title, reason)` provides. If the work isn't actually done and needs rework, don't `/clocktime` — leave the task in REVIEW and let PM call `reject_review` from their side.
- It does **not** end the PM session. `pm-session-<shortId>.txt` is untouched. Use `/sleeptime` for PM session end.
- It does **not** touch OTHER sessions' shortId-scoped markers. Each session manages its own clock-out. Use `/cleantime` for cross-session cleanup.

## Related

- Sister skills: `/teamtime` (open PM session), `/worktime` (open Worker task), `/notetime` (Worker mid-task note), `/sleeptime` (close PM session)
- Stop hook: `~/.claude/hooks/worker-completion-signal.js`
- Kanbanger review-gate semantics: `~/Desktop/AI/_tools/kanbanger-partymix/kanbanger_mcp/tools.py`
