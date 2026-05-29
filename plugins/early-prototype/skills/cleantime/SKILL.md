---
name: cleantime
description: |
  Aggressive wipe of all PM/Worker/Coach state in the current project. Globs
  and deletes all shortId-scoped marker variants
  (`<cwd>/.claude/pm-session-*.txt`, `active-task-*.txt`, `coach-session-*.txt`,
  `prod-session-*.txt`, `worker-session-id-*.txt`) PLUS the legacy unscoped
  variants for backward
  compatibility. Also deletes `worker-notes.md` and `.archive` siblings, all
  handoff pointers in `<cwd>/.claude/inbox/pm/`, all session logs in
  `<cwd>/.claude/inbox/pm/sessions/`, and all `<cwd>/session-handover-*.md`
  canonical handoffs at the project root. Does NOT touch `_kanban.md` (PM
  responsibility), does NOT call the kanbanger MCP, does NOT sync to GitHub.
  No confirmation prompt — invoking this skill is consent. Bigger-hammer
  equivalent of `/clocktime` + `/sleeptime` + `/coachout` without the niceties.
  Use for testing, recovery from confused state (orphan markers across
  sessions, race-condition artefacts, mismatched files), or "I want to start
  over from scratch in this project."
---

# Cleantime

Aggressive wipe of all PM / Worker / Coach state in this project. No MCP calls, no GitHub sync, no kanban touches — just delete the state files and report what was cleaned. Wipes all shortId-scoped marker variants in a single invocation, regardless of how many concurrent sessions may have written markers in this cwd.

## Tool conventions for this skill

Non-negotiable — violating them triggers the auto-mode classifier and can break the skill mid-flow:

- **Directory existence check (precondition) → use the `Read` tool on a known-presumed-present file inside the directory, or use the `Glob` tool.** Do **NOT** use Bash `test -d`, `Test-Path`, `ls`, or any PowerShell-style probe.
- **Listing files for deletion → use the `Glob` tool** (matches patterns like `pm-session-*.txt`, `worker-notes-*.archive` cleanly).
- **Deletions → Bash `rm` is acceptable** (single command per file, no chaining, no `2>/dev/null`).

## Precondition

`<cwd>/.claude/` must exist. Check via `Glob` on `<cwd>/.claude/*` (or any equivalent that doesn't shell out). If absent, abort with:

```
No .claude/ directory in this cwd. /cleantime is for projects with PM/Worker/Coach state.
If you ran this in the wrong cwd, change directory and re-invoke.
```

This prevents accidentally wiping global state if `/cleantime` is run somewhere unexpected (e.g., your home directory).

## How

1. **Snapshot what's about to be deleted.** Build the list of targets — use `Glob` for the wildcard sets, `Read` for the legacy unscoped singletons:

   ### Posture markers (shortId-scoped — current convention)
   | Target | Glob pattern | Notes |
   |---|---|---|
   | PM session markers | `<cwd>/.claude/pm-session-*.txt` | all sessions' PM markers |
   | Active task markers | `<cwd>/.claude/active-task-*.txt` | all sessions' active-task markers |
   | Coach session markers | `<cwd>/.claude/coach-session-*.txt` | all sessions' coach markers |
   | Product session markers | `<cwd>/.claude/prod-session-*.txt` | all sessions' product markers |
   | Worker session-id markers | `<cwd>/.claude/worker-session-id-*.txt` | session-id gate paired with active-task markers |

   ### Posture markers (legacy unscoped — backward compatibility)
   These are the pre-2026-05-28 marker filenames. Any project that hasn't yet been touched by the scoped-marker skill versions may still have them. `/cleantime` wipes them too so a single invocation gets the project to a known-clean state regardless of which marker generation is in play.

   | Target | Path | Notes |
   |---|---|---|
   | Legacy PM session marker | `<cwd>/.claude/pm-session.txt` | single file; pre-shortId convention |
   | Legacy active task marker | `<cwd>/.claude/active-task.txt` | single file |
   | Legacy coach session marker | `<cwd>/.claude/coach-session.txt` | single file |
   | Legacy product session marker | `<cwd>/.claude/prod-session.txt` | single file |
   | Legacy worker session-id marker | `<cwd>/.claude/worker-session-id.txt` | single file |

   ### Non-marker state
   | Target | Path | Notes |
   |---|---|---|
   | Worker notes | `<cwd>/.claude/worker-notes.md` | single file; content **destroyed**, not archived |
   | Worker note archives | `<cwd>/.claude/worker-notes-*.archive` | all matches |
   | Inbox handoff pointers | `<cwd>/.claude/inbox/pm/handoff-*.md` | all matches |
   | PM session logs | `<cwd>/.claude/inbox/pm/sessions/pm-session-*.md` | all matches |
   | Canonical handoffs | `<cwd>/session-handover-*.md` | project root only, NOT recursive |

2. **Delete each target.** One `rm` invocation per file (single quoted absolute path, no compound commands). `rm` of an absent file is fine — graceful no-op via Bash exit code (don't fail the skill on missing files).

3. **Do NOT touch `_kanban.md`.** PM owns the kanban. If Worker tasks remain in `## DOING` or `## REVIEW`, that's a PM action via kanbanger MCP (`move_task` / `reject_review` / `delete_task`). `/cleantime`'s scope is filesystem state only.

4. **Do NOT remove the `.claude/` directory itself** or its subfolders (`inbox/`, `inbox/pm/`, `inbox/pm/sessions/`). Keep the folder structure intact so subsequent `/teamtime` doesn't need to recreate it from scratch.

5. **Report what was deleted** in a single confirmation block:

   ```
   Cleantime swept <cwd>:
   - PM session markers (scoped):       <N>
   - Active task markers (scoped):      <N>
   - Coach session markers (scoped):    <N>
   - Product session markers (scoped):  <N>
   - Worker session-id markers (scoped):<N>
   - Legacy unscoped markers:           <N>  (pm-session.txt + active-task.txt + coach-session.txt + prod-session.txt + worker-session-id.txt)
   - Worker notes:                      <deleted|absent>
   - Worker note archives:              <N>
   - Inbox handoff pointers:            <N>
   - PM session logs:                   <N>
   - Canonical handoffs:                <N>

   Kanban (_kanban.md) untouched — PM responsibility if entries remain.
   Clean state. Next move: /teamtime to open a fresh PM session.
   ```

   Use real counts. If everything was already absent, the report shows zeroes (still a valid run).

## Why both scoped and unscoped variants

The marker convention changed on 2026-05-28 from unscoped (`pm-session.txt`) to shortId-scoped (`pm-session-<shortId>.txt`). The open-side skills (`/teamtime`, `/worktime`, `/chosetime`, `/coachtime`, `/prodtime`) now only write scoped markers, and the close-side skills (`/sleeptime`, `/clocktime`, `/coachout`) only clear THIS session's scoped marker. That leaves two failure modes `/cleantime` must catch:

- **Stale legacy markers** from before the convention change. Any project that hadn't yet exercised the new skills since the change may still have unscoped files lying around.
- **Stale scoped markers** from sessions that crashed without their close ritual. Each lingering `pm-session-aaaa1111.txt` represents a session that never `/sleeptime`d.

`/cleantime` wipes both classes in one pass — no need to invoke twice or branch on which generation is present.

## What this skill does NOT do

- It does **not** modify `_kanban.md`. Worker tasks left in `## DOING` / `## REVIEW` from prior sessions remain on the board. PM clears them via direct kanbanger MCP calls (`move_task` to `DONE`, `reject_review` with a reason, or `delete_task`).
- It does **not** call the kanbanger MCP at all. No `add_task`, `move_task`, `propose_done`, `approve_done`, `reject_review`, `delete_task`, `sync_to_github`.
- It does **not** push to GitHub. Local-only operation.
- It does **not** archive `worker-notes.md` before deletion — content is **destroyed**. If you want to preserve mid-task notes, run `/clocktime` instead (which archives `worker-notes.md` to `worker-notes-<DATE>-<TASKSLUG>.archive` before clearing).
- It does **not** ask for confirmation. Invoking `/cleantime` is consent. The skill assumes you mean it.
- It does **not** touch anything outside the current project. No global `.claude/` modifications, no other-project state, no hook or skill changes.
- It does **not** restart Claude Code or alter any running session's in-memory state. If you `/cleantime` while a Claude Code session has stale state cached in its conversation window, close and reopen the session for a true fresh start.

## When to use

- **Test setup** — between live runs of the lifecycle, when you want a known-clean starting point without ceremoniously stepping through `/clocktime` + `/sleeptime` + `/coachout` for every active session.
- **Recovery** — when PM/Worker/Coach state is in a confused or contradictory configuration (orphan markers from crashed sessions, mismatched scoped vs unscoped, race-condition artefacts) and ceremonious close-out would be more friction than value.
- **Reset** — when you want to discard everything in this project's posture state and start over from scratch.
- **Migration** — after pulling the 2026-05-28 marker-convention changes for the first time in an old project, `/cleantime` wipes both legacy and scoped artefacts so the next `/teamtime` runs against a clean slate.

Not for:
- Routine task closure → use `/clocktime` (preserves notes, advances kanban, syncs to GitHub).
- Routine session end → use `/sleeptime` (writes session log, prompts for decisions / open items).
- Routine coach end → use `/coachout` (no log, just clears the marker).
- Anything where the kanban state matters → handle the kanban first via PM-side MCP calls, then `/cleantime` for filesystem.

## Related

- Sister skills: `/teamtime` (open PM session), `/worktime` (open Worker task), `/notetime` (mid-task note), `/clocktime` (close Worker task — ceremonious), `/sleeptime` (close PM session — ceremonious), `/coachtime` (open coach session), `/coachout` (close coach session — ceremonious), `/check-handoffs` (manual PM inbox surface)
- After `/cleantime`, the natural next move is `/teamtime` to open a fresh PM session
- Front-door doc: `~/Desktop/AI/EverythingCC/_teamtime/Worker-PM-System.md`
