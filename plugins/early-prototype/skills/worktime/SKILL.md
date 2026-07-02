---
name: worktime
description: |
  Worker clock-in ritual. Prompts the user for a one-line task description,
  writes it to `<cwd>/.claude/active-task-<shortId>.txt` (shortId-scoped so
  concurrent Claude instances in the same cwd don't collide), and adds the
  task to `_kanban.md`'s `## DOING` column via the kanbanger MCP. Requires an
  open PM session (`<cwd>/.claude/pm-session-<shortId>.txt` must exist — run
  `/teamtime` first). Without the active-task marker the Stop hook stays
  silent and no handoffs are produced. Companion to `/notetime` (mid-task
  notes) and `/clocktime` (Worker task end). `/teamtime` opens the PM
  session that contains the Worker task; `/sleeptime` closes the PM
  session.
---

# Worktime

Worker clock-in. Sets the `active-task-<shortId>.txt` marker so the Stop hook produces handoffs, and adds the task to the kanban board's `## DOING` column. Runs inside a PM session opened by `/teamtime`.

## Precondition

`<cwd>/.claude/pm-session-<shortId>.txt` must exist (for this session's shortId — see discovery in step 1). If absent, abort with:

```
No PM session in this cwd for this shortId. Run /teamtime first to open one, then /worktime to delegate a task.
```

PM-before-Worker is the canonical lifecycle: PM decides what to delegate, then `/worktime` spawns the Worker task inside that PM session.

## Tool conventions for this skill

Non-negotiable — violating them triggers the auto-mode classifier and the classifier can become "sticky" (continuing to deny non-PowerShell calls afterwards, breaking the rest of the skill mid-flow):

- **File existence / content checks → use the `Read` tool.** Treat the "file does not exist" error as Absent; successful read as Present. Do **NOT** use Bash `test -f`, `[[ -f ... ]]`, `Test-Path`, `Get-Content`, `cat`, `ls`, or any PowerShell-style probe.
- **Writing new files → use the `Write` tool.** Not Bash redirection or `Set-Content`.
- **Modifying existing files → use the `Edit` tool.**
- **Directory creation (when needed) → Bash `mkdir -p` only**, one directory per invocation, no compound chaining.
- **Kanbanger MCP calls → delegated to the Haiku `kanban-worker` subagent via `Task`** (see "MCP delegation" below). Do NOT invoke `mcp__kanbanger__*` tools directly from this session.

## MCP delegation (Haiku kanban-worker subagent)

**All kanbanger MCP calls in this skill are delegated to the `kanban-worker` Haiku subagent via the `Task` tool.** Do NOT invoke `mcp__kanbanger__*` tools directly from this session — that burns Opus/Sonnet context on deterministic grunt work.

When the steps below name a kanbanger operation (e.g. `list_tasks`, `add_task`, `sync_to_github`), execute it as:

```
Task(
  description: "<3-5 word task description>",
  subagent_type: "kanban-worker",
  prompt: "<instruction string — see below for shape>"
)
```

Instruction shape:

- Single step: `list_tasks()` or `add_task(title="X", column="DOING")`
- Multi-step: `add_task(title="X", column="DOING") then sync_to_github()`

The kanban-worker returns one line per step in the form `OK: <summary>` or `ERR <error_code>: <explanation>`. Parse and branch per the existing recovery logic. The agent does NOT retry — caller's job.

**For the orphan-gate and duplicate-detection checks (steps 1 and 2):** delegate `list_tasks()` (no column filter) to the kanban-worker once, parse the returned listing in main context, then apply the judgement (orphan? duplicate? proceed?). Don't fan out to multiple `list_tasks` invocations per column — one call returns everything.

**For step 4 + step 5 (add to DOING + sync):** batch as one `Task` invocation: `add_task(title="<X>", column="DOING") then sync_to_github()`.

Per `~/.claude/rules/performance.md`: Haiku for worker-agent grunt work, Opus/Sonnet reserved for the conversation and judgement. Main session context stays lean.

## How

1. **Discover this session's shortId, then check `<cwd>/.claude/active-task-<shortId>.txt`.**

   **Discovery** (per `Worker-PM-System.md §10` / timeteam `DESIGN-GUIDELINES.md §2` — the skill-side method):
   - Encode cwd: replace `\`, `/`, `:` with `-` (e.g. `C:\Users\<user>\timeteam` → `C--Users-<user>-timeteam`).
   - `Glob` for `~/.claude/projects/<encoded-cwd>/*.jsonl` — the most-recently-modified result is this session's transcript. The full filename minus `.jsonl` is this session's **full UUID** (saved for step 3a); the last 8 hex characters are the **shortId** (used here and in step 3).
   - **Fallback:** if any step fails, use the literal string `unknown` as the shortId AND skip the full-UUID write in step 3a. Never block Worker open over identity discovery.

   **Marker check** (use the `Read` tool — do not Bash-probe it):
   - **Absent** → continue.
   - **Present** → read its first line as the existing task title. **Before any user prompt, gate on kanban orphan risk.** Call the kanbanger MCP `list_tasks` (no column filter; verbose not required) and search for the existing title in `DOING` or `REVIEW`.

     **If the existing title is found in `DOING` or `REVIEW`**, ABORT the skill with:

     ```
     Previous Worker task '<title>' is still live on the kanban (column: <column>).
     Run /clocktime first to close it cleanly. Overwriting or appending here would
     orphan the existing kanban entry — a stuck task in REVIEW that no /clocktime
     invocation will ever match (because /clocktime reads active-task-<shortId>.txt
     and only touches whatever title is named there).
     ```

     The user must either (a) run `/clocktime` to retire the previous task, or (b) PM-side `move_task` / `reject_review` the kanban entry manually before `/worktime` will accept a switch.

     **If the existing title is in `DONE`, `BACKLOG`, `TODO`, or absent from the board entirely**, the orphan risk is gone — proceed to show the user the existing task title and ask them to pick one of:
     - **Overwrite** — replace with new task (proceed to step 2)
     - **Cancel** — leave existing in place, abort the skill (do nothing further)
     - **Append** — keep both, multi-line. The Stop hook treats the first line as the active task; subsequent lines are inert notes inside the marker file.

     **If `list_tasks` fails or kanbanger MCP isn't available** (no `_kanban.md`, MCP not registered): treat the gate as inconclusive and warn — "Could not verify kanban state (`<error>`); proceeding without orphan check, but be aware Overwrite/Append may leave a previous entry stranded." Then offer Overwrite / Cancel / Append as above. Graceful degradation — don't block the skill on infrastructure absence.

   **Note on cross-session orphans:** the gate above only checks the CURRENT session's `active-task-<shortId>.txt`. Markers from other sessions in the same cwd (e.g. `active-task-aaaa1111.txt` from a crashed sibling) are intentionally not checked here — each session manages its own state. To clean up stale cross-session markers, use `/cleantime`.

2. **STOP and explicitly prompt the user for a one-line task description.** Do NOT synthesize, infer, or auto-generate it from conversation context, the inbox listing, the previous task title, or any other source. The description MUST come from a direct user reply to a prompt — either via `AskUserQuestion` or by asking in plain text and waiting for the user's next message. Reject empty input and ask again. If the user replies "whatever" / "you decide" / "anything" / similar non-answer, ask again and explain why: the description is the title that goes onto the kanban and into the canonical handoff filename, so it must be the user's own words.

   **Duplicate-detection gate.** Once the user provides the title, call kanbanger MCP `list_tasks` (no column filter) and search for the title in `TODO` or `BACKLOG`. If found, abort with:

   ```
   Task '<title>' is already queued in <column>. Use /chosetime to pick it up cleanly
   (moves TODO/BACKLOG → DOING via move_task). /worktime would create a duplicate
   entry on the board.
   ```

   This prevents the trap where PM queues "X" via `/queuetime` and Worker `/worktime "X"` silently creates a second "X" in DOING. The right move when a title already exists in the queue is `/chosetime`. If the title is in `DOING` or `REVIEW`, the orphan-gate at step 1 has already caught it; if in `DONE` or absent, proceed as normal.

3. Write the description to `<cwd>/.claude/active-task-<shortId>.txt`:
   - Create `<cwd>/.claude/` if absent (`mkdir -p`).
   - For Overwrite: write the single line.
   - For Append: prepend the new line to the existing content.

3a. **Write `<cwd>/.claude/worker-session-id-<shortId>.txt`** containing the current Claude Code session's full UUID on one line. This is the session-id gate that the Stop hook uses to attribute handoffs — without it, other concurrent sessions in the same cwd would also produce Worker handoffs, doubling the inbox. The full UUID was already discovered in step 1 (the `.jsonl` basename minus the extension). `Write` it to `worker-session-id-<shortId>.txt` (single line, no trailing newline necessary but tolerable). If step 1's discovery returned `unknown`, skip writing this marker — the Stop hook will fall back to the legacy gate.

4. Call the kanbanger MCP **`add_task`** tool with `title=<the new task>`, `column="DOING"`. The MCP handles `_kanban.md` formatting, validation, and the canonical column rebuild. Note: `add_task`'s default column is `TODO` — passing `"DOING"` explicitly is required for Worker clock-in.
   - On `ERROR_KANBAN_NOT_FOUND`: the project has no `_kanban.md`. Skip the kanban steps silently; tell the user "active-task marker set; no kanban in this project so no board update".
   - On any other error code: surface the structured error to the user and stop. Don't try to recover via markdown surgery — the MCP is the source of truth.

5. If step 4 succeeded, call the kanbanger MCP **`sync_to_github`** tool to push the new task to GitHub Projects. Best-effort — on any error, emit a one-line warning ("kanban-sync warning: <code>") but don't abort.

6. Confirm to the user with a single block:

   ```
   Worker task open for: <task title>.
   Stop hook will write §6 handoffs to <cwd>/session-handover-<DATE>-<TASKSLUG>.md and to <cwd>/.claude/inbox/pm/ on each response.
   Use /clocktime to close this task. The containing PM session stays open until /sleeptime.
   ```

## Posture for the Worker task

You are executing against the named task. Stay focused. If the user redirects to work unrelated to it, flag the scope drift before proceeding ("That looks unrelated to <task>; is this a scope change or a side-trip?"). When the work is complete or paused, prompt the user about running `/clocktime` to close the task cleanly — without it the marker persists and every response continues to produce Worker handoffs.

## Lifecycle context

Multiple `/worktime` → `/clocktime` cycles can run inside one PM session. PM stays open across them. `/sleeptime` (PM session end) is a separate action; it does not auto-fire when `/clocktime` runs.

## What this skill does NOT do

- It does **not** invoke the Stop hook or write any handoff — that's the Stop hook's job, fired automatically per response after this skill runs.
- It does **not** check whether a kanbanger MCP is actually registered. If the `add_task` tool isn't available, the agent will surface "tool not found" — investigate registration separately.
- It does **not** mark prior handoff pointers in `<cwd>/.claude/inbox/pm/` as PM:READ. That's a PM-side action.
- It does **not** end the PM session. Use `/sleeptime` for that.
- It does **not** clean up stale `active-task-*.txt` markers from other sessions. Use `/cleantime` for that.

## Related

- Sister skills: `/teamtime` (open PM session), `/notetime` (Worker mid-task note), `/clocktime` (close Worker task), `/sleeptime` (close PM session)
- Stop hook (the writer of handoffs): `~/.claude/hooks/worker-completion-signal.js`
- Canonical §6 format: `Dev-Lead-SOP.md` Phase 9
