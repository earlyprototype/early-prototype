---
name: prodout
description: |
  Product session end. The close ritual for the product-planning session that
  `/prodtime` opens — the seat that decides what a development cycle should
  build, for whom, and why. Reads this session's product session marker in the
  current folder, deletes it, and confirms with a timestamp. If there's no open
  product session for this session in this folder, it says so and exits cleanly.
  Touches only this session's own marker — never another session's, and never a
  planning, worker, or mentor marker. Companion close ritual for `/prodtime`,
  the same way `/sleeptime` closes the planning session and `/coachout` closes
  the mentor session.
---

# Prodout

Product session end. Clears THIS session's own product session marker so any Product-side tooling sees the product session as closed for this Claude instance. Sister close ritual to `/prodtime`; mirrors the role `/sleeptime` plays for `/teamtime` and `/clocktime` plays for `/worktime`.

## When to Use

At the explicit end of a product-planning session — when you're stepping out of the seat that frames what a cycle should build and into the planning or worker seat, or wrapping for the day. Without this, the product session marker persists until the 18-hour stale-skip rule lets any Product-side tooling treat it as expired (built-in forget-safety, but an explicit close is cleaner).

## Tool conventions for this skill

Non-negotiable — violating them triggers the auto-mode classifier and can break the skill mid-flow:

- **File reads / existence checks → use the `Read` tool.** Treat "file does not exist" error as Absent. Do **NOT** use Bash `test -f`, `[[ -f ... ]]`, `Test-Path`, `Get-Content`, `cat`, `ls`, or any PowerShell-style probe.
- **Deletions → Bash `rm` is acceptable** (single command, no chaining).

## How

1. **Discover this session's shortId.** Used to identify which marker belongs to THIS product session — closing one session must not affect any concurrent siblings.

   - Encode cwd: replace `\`, `/`, `:` with `-`.
   - `Glob` for `~/.claude/projects/<encoded-cwd>/*.jsonl` — the most-recently-modified result's filename minus `.jsonl` is the full UUID; the last 8 hex characters are the **shortId**.
   - **Fallback:** if discovery fails, use the literal string `unknown` as the shortId. The skill will then operate on `prod-session-unknown.txt` — almost certainly absent, in which case step 2 emits the "no product session" message and exits clean. Never block close-out over identity discovery.

2. **Read `<cwd>/.claude/prod-session-<shortId>.txt`** (use the `Read` tool — do not Bash-probe it):
   - **Absent** → emit (non-error, this is fine):
     ```
     No product session in this folder for this session. Nothing to close.
     (Note: another session in this folder may still have an open product session — check `.claude/prod-session-*.txt`; that one is theirs to close.)
     ```
     Exit clean.
   - **Present** → continue. (The file's content is just the open-timestamp line; we don't need to parse it — we just need to confirm it exists before deleting.)

3. **Delete `<cwd>/.claude/prod-session-<shortId>.txt`.** ONLY this session's marker — never any other `prod-session-*.txt` in the folder, and never a planning, worker, or mentor marker. Any Product-side tooling will treat the product session as closed for THIS session on its next read.

4. **Confirm to the user** in a single line:

   ```
   Product session closed at <ISO-8601 timestamp>.
   ```

   Use the current ISO-8601 timestamp (with seconds precision, e.g. `2026-05-28T14:32:17Z` — UTC suffix optional but conventional).

## Posture after `/prodout`

The Product seat is released. No more cycle-framing from this session. Any Product-side tooling treats the product session as closed for this session.

If you want to switch into the planning seat after closing the product session, run `/teamtime` to open a planning session in the same folder. The two seats are independent; `/prodout` does not auto-open anything else.

## What this skill does NOT do

- It does **not** write a session log. Unlike `/sleeptime`, there's no equivalent "decisions made / handoffs reviewed" output for product work — the durable artifacts of a cycle are the written brief and capability contract at the project root (`PRODUCT-BRIEF.md`, `PRODUCT.md`), not a narrative close-out summary.
- It does **not** tear down, archive, or disconnect the kanban board. The board (`_kanban.md`) is a permanent project artifact — `/prodtime` connects to it at open (through the Haiku `kanban-worker`), and closing the Product session simply leaves it live and untouched. Product still creates no task entries of its own; those belong to the project-planning seat.
- It does **not** touch OTHER sessions' product session markers. Each session manages its own close-out. Use `/cleantime` for cross-session cleanup.
- It does **not** end any other seat's session (planning via `/sleeptime`, worker via `/clocktime`, mentor via `/coachout`). One verb, one job.

## Related

- Companion open ritual: `/prodtime` (writes the marker this skill deletes).
- Sister close rituals: `/sleeptime` (planning session end), `/clocktime` (worker task end), `/coachout` (mentor session end).
- Persona source: `C:\Users\Fab2\timeteam\docs\Prod-SOP.md`
- Standing context: `C:\Users\Fab2\timeteam\docs\prodtime-context.md`
