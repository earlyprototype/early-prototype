---
name: chosetime
description: |
  Worker ritual to pick a queued task from `## TODO` (or `## BACKLOG`)
  and promote it to `## DOING` via kanbanger `move_task`. Writes
  `<cwd>/.claude/active-task-<shortId>.txt` so the Stop hook starts producing
  handoffs for the chosen task. Requires an open PM session
  (`<cwd>/.claude/pm-session-<shortId>.txt`) and at least one task queued via
  `/queuetime` (or any prior kanbanger action). Use when starting
  work on a previously-queued task. Companion to `/queuetime` (PM
  queues), `/worktime` (Worker spawns fresh, no queue stage), `/notetime`
  (mid-task notes), and `/clocktime` (close Worker task).
---

# Chosetime

Worker clock-in via the queue: picks a task from `## TODO` (or `## BACKLOG`) and promotes it to `## DOING`. Writes `active-task-<shortId>.txt` so the Stop hook produces handoffs. Use when work was queued ahead by PM via `/queuetime`; use `/worktime` instead for brand-new tasks not in the queue.

## Tool conventions for this skill

Non-negotiable — violating them triggers the auto-mode classifier and can break the skill mid-flow:

- **File existence / content checks → use the `Read` tool.** Treat "file does not exist" error as Absent. Do **NOT** use Bash `test -f`, `[[ -f ... ]]`, `Test-Path`, `Get-Content`, `cat`, `ls`, or any PowerShell-style probe.
- **Writing `active-task-<shortId>.txt` → use the `Write` tool.**
- **Kanbanger MCP calls → delegated to the Haiku `kanban-worker` subagent via `Task`** (see "MCP delegation" below). Do NOT invoke `mcp__kanbanger__*` tools directly from this session.
- **Directory creation (if `.claude/` is missing) → Bash `mkdir -p`**, one directory per invocation, no chaining.

## MCP delegation (Haiku kanban-worker subagent)

**All kanbanger MCP calls in this skill are delegated to the `kanban-worker` Haiku subagent via the `Task` tool.** Do NOT invoke `mcp__kanbanger__*` tools directly from this session.

When the steps below name a kanbanger operation (e.g. `list_tasks`, `move_task`, `sync_to_github`), execute it as:

```
Task(
  description: "<3-5 word task description>",
  subagent_type: "kanban-worker",
  prompt: "<instruction string>"
)
```

The kanban-worker returns one line per step (`OK: <summary>` or `ERR <code>: <explanation>`). Parse in main context, apply judgement, decide next move.

**For the orphan-gate check + queue enumeration:** one `Task` call with `list_tasks()` (no column filter) returns all columns at once — parse the result in main context to handle both the orphan check (is the existing `active-task-<shortId>.txt` title in DOING/REVIEW?) and the queue listing (what's in TODO/BACKLOG to offer the user?). One Haiku call covers both.

**For step 5 + step 6 (move from queue + sync):** batch as one `Task` invocation: `move_task(title="<X>", from_column="<TODO|BACKLOG>", to_column="DOING") then sync_to_github()`.

Per `~/.claude/rules/performance.md`: Haiku is the correct cost tier for deterministic kanban grunt work.

## Preconditions

0. **Discover this session's shortId.** Used by every step below.

   - Encode cwd: replace `\`, `/`, `:` with `-`.
   - `Glob` for `~/.claude/projects/<encoded-cwd>/*.jsonl` — the most-recently-modified result's filename minus `.jsonl` is the **full UUID** (kept for step 4a); the last 8 hex characters are the **shortId**.
   - **Fallback:** if discovery fails, use the literal string `unknown` as the shortId AND skip the full-UUID write in step 4a. Never block Worker open over identity discovery.

1. **`<cwd>/.claude/pm-session-<shortId>.txt` must exist.** If absent, abort with:

   ```
   No PM session in this cwd for this shortId. Run /teamtime first to open one.
   ```

2. **Orphan-gate (same as `/worktime`).** If `<cwd>/.claude/active-task-<shortId>.txt` already exists, read its first line as the existing title, then call kanbanger MCP `list_tasks` and search for that title in `DOING` or `REVIEW`. If found, abort with:

   ```
   Previous Worker task '<title>' is still live on the kanban (column: <column>).
   Run /clocktime first to close it cleanly. Choosing a new task here would orphan
   the existing kanban entry.
   ```

   If the existing title is in `DONE` / `TODO` / `BACKLOG` / absent, the skill may proceed (it will overwrite `active-task-<shortId>.txt` cleanly). Markers from other sessions in the same cwd (e.g. `active-task-bbbb2222.txt`) are intentionally not checked — each session manages its own state; `/cleantime` handles cross-session cleanup.

## How

1. **Get the queue.** Call kanbanger MCP `list_tasks(column="TODO")` to fetch the TODO queue. Optionally also call `list_tasks(column="BACKLOG")` if you want to offer BACKLOG entries as a secondary pool.

   - If both TODO and BACKLOG are empty, abort with:
     ```
     Nothing queued. Run /queuetime to populate the queue, or /worktime to spawn a fresh task directly to DOING.
     ```

2. **Present the queue to the user and let them pick.** Use `AskUserQuestion` with the TODO entries (and optionally BACKLOG entries flagged separately) as options. Do **NOT** auto-pick — the choice MUST come from the user. If the user says "you pick" / "whatever" / similar, ask again and explain: this is the title that goes into `active-task-<shortId>.txt`, onto the kanban, and into the canonical handoff filename, so it must be the user's own pick.

3. **Confirm the source column.** Once the user picks a title, note which column it came from (`TODO` or `BACKLOG`). You'll need this for `move_task`.

4. **Write `<cwd>/.claude/active-task-<shortId>.txt`** with the chosen title (single line). Create `<cwd>/.claude/` via `mkdir -p` if absent.

4a. **Write `<cwd>/.claude/worker-session-id-<shortId>.txt`** containing the current Claude Code session's full UUID on one line. Session-id gate for the Stop hook (prevents concurrent sessions in the same cwd from producing duplicate handoffs). The full UUID was already discovered in step 0; just `Write` it now. If step 0's discovery returned `unknown`, skip writing this marker — Stop hook falls back to legacy gate.

5. **Call kanbanger MCP `move_task`** with `title=<chosen title>`, `from_column=<TODO|BACKLOG>`, `to_column="DOING"`.
   - On `ERROR_TASK_NOT_FOUND`: someone else moved the task between `list_tasks` and `move_task`. Re-fetch the queue (`list_tasks` again) and either retry with a fresh pick or abort if queue is now empty.
   - On `ERROR_INVALID_STATE`: the task isn't actually in `from_column` (concurrent edit). Re-fetch and retry.
   - On other errors: surface the structured error and stop. Don't try markdown surgery.

6. **Call kanbanger MCP `sync_to_github`** to push the column move to GitHub Projects. Best-effort — on any error, emit a one-line warning ("kanban-sync warning: <code>") but don't abort.

7. **Confirm to the user:**

   ```
   Worker task open for: <task title>.
   Promoted from <TODO|BACKLOG> → DOING via /chosetime.
   Stop hook will write §6 handoffs to <cwd>/session-handover-<DATE>-<TASKSLUG>.md and to <cwd>/.claude/inbox/pm/ on each response.
   Use /clocktime to close this task. The containing PM session stays open until /sleeptime.
   ```

## Posture for the Worker task

Identical to `/worktime`'s posture: stay focused on the named task, flag scope drift, prompt for `/clocktime` when the work is done. The only difference from `/worktime` is the origin of the task — queue vs fresh spawn — and the kanban operation (`move_task` vs `add_task`). The Stop hook, marker files, handoff format, and close-out are all the same.

## What this skill does NOT do

- It does **not** invoke the Stop hook directly. That fires automatically per response once `active-task-<shortId>.txt` is present.
- It does **not** add a new task — only moves an existing one. For fresh tasks, use `/worktime` (or `/queuetime` for PM-side queuing).
- It does **not** check whether the kanbanger MCP is registered. If `list_tasks` or `move_task` isn't available, the agent surfaces "tool not found" and the user investigates registration.
- It does **not** mark related inbox pointers as PM:READ. That's a PM-side action.
- It does **not** end the PM session.
- It does **not** clean up stale markers from other sessions. Use `/cleantime` for that.

## Related

- Sister skills: `/teamtime` (open PM session), `/queuetime` (PM queues tasks for later), `/worktime` (Worker spawns fresh task), `/notetime` (Worker mid-task notes), `/clocktime` (close Worker task), `/sleeptime` (close PM session)
- Stop hook: `~/.claude/hooks/worker-completion-signal.js`
- Front-door doc: `~/Desktop/AI/EverythingCC/_teamtime/Worker-PM-System.md`
