---
name: queuetime
description: |
  PM ritual to queue a Worker task for later execution. Adds a one-line
  task to `## TODO` (default) or `## BACKLOG` of `_kanban.md` via the
  kanbanger MCP, without spawning a Worker session or writing
  `active-task.txt`. Use during PM planning to populate the queue with
  work to be picked up later via `/chosetime`. Requires an open PM
  session (`<cwd>/.claude/pm-session.txt` must exist — run `/teamtime`
  first). Companion to `/chosetime` (Worker picks from queue and
  promotes to DOING) and `/worktime` (Worker spawns brand-new task
  directly to DOING, no queue stage).
---

# Queuetime

PM-side queuing ritual. Adds a task to the kanban's `## TODO` (default) or `## BACKLOG` column without becoming a Worker. The task sits in the queue until a Worker picks it via `/chosetime`. PM stays in PM mode.

## Tool conventions for this skill

Non-negotiable — violating them triggers the auto-mode classifier and can break the skill mid-flow:

- **File existence / content checks → use the `Read` tool.** Treat "file does not exist" error as Absent. Do **NOT** use Bash `test -f`, `[[ -f ... ]]`, `Test-Path`, `Get-Content`, `cat`, `ls`, or any PowerShell-style probe.
- **Kanbanger MCP calls → delegated to the Haiku `kanban-worker` subagent via `Task`** (see "MCP delegation" below). Do NOT invoke `mcp__kanbanger__*` tools directly from this session.

## MCP delegation (Haiku kanban-worker subagent)

**All kanbanger MCP calls in this skill are delegated to the `kanban-worker` Haiku subagent via the `Task` tool.** Do NOT invoke `mcp__kanbanger__*` tools directly from this session — that burns Opus/Sonnet context on deterministic grunt work.

When the steps below name a kanbanger operation (e.g. `add_task`, `list_tasks`, `sync_to_github`), execute it as:

```
Task(
  description: "<3-5 word task description>",
  subagent_type: "kanban-worker",
  prompt: "<instruction string — see below for shape>"
)
```

Instruction shape (matches the kanban-worker's input contract at `~/.claude/agents/kanban-worker.md`):

- Single step: `add_task(title="X", column="TODO")`
- Multi-step: `add_task(title="X", column="TODO") then sync_to_github()` (semicolon `;` also works as separator)

The kanban-worker returns one line per step in the form `OK: <summary>` or `ERR <error_code>: <explanation>`. Parse on the first 3 chars; branch on the structured error code per the existing recovery logic. The agent does NOT retry — that's the caller's job.

**Batching is cheaper than fan-out.** One `Task` invocation that bundles `add_task(...) then sync_to_github()` costs less round-trip than two separate invocations. Use multi-step instructions wherever steps don't require caller judgement between them.

Per `~/.claude/rules/performance.md`: Haiku is 3× cheaper than Sonnet for "worker agents in multi-agent systems" — kanban MCP calls fit exactly. The main session's context stays clean.

## Precondition

`<cwd>/.claude/pm-session.txt` must exist. If absent, abort with:

```
No PM session in this cwd. Run /teamtime first to open one, then /queuetime to populate the queue.
```

Queueing requires PM mode — without an open PM session there's no posture for "planning ahead" vs "starting work now". Worker-side tasks bypass the queue entirely via `/worktime`.

## How

1. **STOP and explicitly prompt the user for a one-line task description.** Do NOT synthesize, infer, or auto-generate it from conversation context, the inbox listing, or any other source. The description MUST come from a direct user reply — via `AskUserQuestion` or plain text prompt + wait for the next message. Reject empty input and ask again. If the user replies "whatever" / "you decide" / similar non-answer, ask again and explain why: the title is what goes onto the kanban and is later picked by `/chosetime`, so it must be the user's own words.

2. **Prompt for queue column.** Ask the user to pick:
   - **TODO** (default) — task is ready to be picked up next; Worker will see it in the available queue
   - **BACKLOG** — task is on the radar but not yet ready; less prominent in `/chosetime`'s default listing

   Use `AskUserQuestion` with the two options. If the user says "no preference" / "you pick", default to TODO.

3. **Duplicate check.** Before adding, call kanbanger MCP `list_tasks` (no column filter) and search for the new title across `TODO`, `BACKLOG`, `DOING`, `REVIEW`, `DONE`. If a match is found, abort with:

   ```
   Task '<title>' already exists in <column>. Pick a more specific title, or use /chosetime if you meant to start work on the existing entry.
   ```

   Prevents silent duplication of titles across the board.

4. **Call kanbanger MCP `add_task`** with `title=<the new task>`, `column=<TODO or BACKLOG>`.
   - On `ERROR_KANBAN_NOT_FOUND`: the project has no `_kanban.md`. Abort with: "No `_kanban.md` in this project. Create one (or use a project that has kanbanger configured) before `/queuetime`."
   - On any other error: surface the structured error to the user and stop.

5. **Call kanbanger MCP `sync_to_github`** to push the new task to GitHub Projects. Best-effort — on any error, emit a one-line warning ("kanban-sync warning: <code>") but don't abort.

6. **Confirm to the user:**

   ```
   Queued: <task title> → <column>.
   Pick it up later with /chosetime (lists queued tasks and promotes to DOING).
   PM session remains open. Run /queuetime again to add more, or /sleeptime to close PM.
   ```

## What this skill does NOT do

- It does **not** write `active-task.txt`. PM is still PM — Worker mode is only entered via `/chosetime` (pick a queued task) or `/worktime` (spawn fresh to DOING).
- It does **not** move existing entries between columns. If a task is already on the board, this skill refuses (see step 3) — to promote a queued task, use `/chosetime`; to move via PM action, call `move_task` directly.
- It does **not** push to GitHub if `sync_to_github` fails — local kanban update succeeds either way, but you may need a manual sync later.
- It does **not** open a Worker context, fire the Stop hook, or produce any handoffs. Queueing is silent on PM's side.

## Related

- Sister skills: `/teamtime` (open PM session), `/chosetime` (Worker picks from queue), `/worktime` (Worker spawns fresh task to DOING, bypassing queue), `/sleeptime` (close PM session)
- Front-door doc: `~/Desktop/AI/EverythingCC/_teamtime/Worker-PM-System.md`
- Kanbanger MCP tool reference: `~/Desktop/AI/_tools/kanbanger-partymix/kanbanger_mcp/tools.py`
