# timeteam — model & lifecycle reference

This is the canonical architecture and lifecycle reference for the `timeteam`
suite. It is self-contained: a person installing the suite from the
marketplace can read just this file to understand what the suite is, how
it is shaped, and how to operate it. Pointers to broader context sit at the
end and are optional.

---

## 1. What this is

`timeteam` is a multi-posture session-lifecycle toolkit for agentic work in
Claude Code. It is distributed as the `timeteam` project under the
`early-prototype` marketplace at
`github.com/earlyprototype/early-prototype`.

The suite supports three postures in the **work hierarchy**
(Product → PM → Worker). Each posture has open and close ritual
skills, a shortId-scoped marker convention so concurrent Claude Code
instances at the same working directory do not collide, and ambient
hooks that deterministically capture state changes (handoffs,
history).

**Product (prodtime) is the ideal-state top of the hierarchy** — not
yet built. See `C:\Users\Fab2\timeteam\.claude\inbox\pm\prodtime-build-brief-2026-05-29.md`
for the build plan.

The point of the suite is to make session discipline ambient rather than
remembered: the rituals open and close cleanly, the hooks fire whether
or not anyone is paying attention, and the audit trail accretes on disk.

---

## 2. The postures

The three postures shape development cycles top-down (see §6.2 for who runs each cycle):

**Product (cycle orchestration).** *Ideal state — not yet built; see the
prodtime PM brief.* Sits at the top of the work hierarchy. Owns *"what
should this cycle build, for whom, why."* Directs PM. Does NOT
coordinate execution within a cycle (PM's job) and does NOT implement
(Worker's job). Hands a capability contract (`PRODUCT.md`) down to PM.

**PM (work-orchestration within a cycle).** Reviews handoffs, decides
what to delegate, holds scope. The default posture for any work session
today (until Product is built). A PM session contains zero or more
Worker tasks across its lifetime. **Sets Worker tasks and presents them
to the user; the user normally runs the Worker cycle.** PM only runs
the Worker cycle itself when the user explicitly hands ownership of it
to PM (see §6.2).

**Worker (task execution).** Opened against a PM session — normally by
the user, by PM only when PM has been given ownership of the cycle
(§6.2). Single task at a time. Produces a structured handoff at every
assistant response so the PM can resume oversight at any point.

---

## 3. Lifecycle rituals

Every posture has an open ritual, optional mid-session rituals, and a
close ritual. All ritual skills are invoked as slash commands.

### Product lane *(not yet built — see the prodtime PM brief)*

| Skill | Role | When |
|---|---|---|
| `prodtime` | Open Product session; write `prod-session-<shortId>.txt` marker; load `Prod-SOP.md` + `prodtime-context.md`; surface `PRODUCT.md` / `PRODUCT-BRIEF.md` if present | Start of a development cycle — when deciding *"what should this cycle build, for whom, why"* |
| `prodout` | Close Product session; clear this session's `prod-session-<shortId>.txt` marker | End of a Product session — when handing the cycle plan down to PM via `PRODUCT.md` |

**Build status:** Both skills are unbuilt. The full implementation plan
is in `C:\Users\Fab2\timeteam\.claude\inbox\pm\prodtime-build-brief-2026-05-29.md`.

### PM lane

| Skill | Role | When |
|---|---|---|
| `teamtime` | Open PM session; write PM marker; surface unread handoffs | Start of any work session |
| `queuetime` | Add a task line to `_kanban.md` `## TODO` (or `## BACKLOG`) without spawning a Worker | Planning ahead |
| `readtime` | Open an unread handoff pointer from the inbox and mark it acknowledged | When the inbox has unread items |
| `check-handoffs` | Manually surface unread handoffs (fallback for the SessionStart hook) | On demand |
| `sleeptime` | Close PM session; write a PM session log entry; clear this session's PM marker | End of work session |

### Worker lane

| Skill | Role | When |
|---|---|---|
| `worktime` | Worker clock-in for a brand-new task; write active-task marker; add task to `## DOING` | Starting fresh work inside a PM session |
| `chosetime` | Worker clock-in for a queued task; promote from `## TODO`/`## BACKLOG` to `## DOING` | Starting work that was queued earlier |
| `notetime` | Append a timestamped mid-task note that the Stop hook embeds in the next handoff | Mid-task breadcrumbs |
| `clocktime` | Worker clock-out; move task DOING → DONE through the review gate; archive notes; clear this session's Worker markers | End of a single task |

### Recovery

| Skill | Role | When |
|---|---|---|
| `cleantime` | Aggressive wipe of all PM/Worker state in the current project (markers, notes, handoff pointers, session logs). Does not touch `_kanban.md` and does not call the kanban MCP. | Recovery from confused state; testing; starting over |

---

## 4. The shortId-scoped marker convention

Every active posture writes a small marker file under `<cwd>/.claude/`.
The matching close ritual deletes its own marker. Markers are scoped by
**shortId** — the last 8 hex characters of the Claude Code session UUID
— so two concurrent Claude Code instances in the same working directory
do not overwrite each other.

| Marker | Written by | Cleared by |
|---|---|---|
| `<cwd>/.claude/pm-session-<shortId>.txt` | `/teamtime` | `/sleeptime` |
| `<cwd>/.claude/active-task-<shortId>.txt` | `/worktime` or `/chosetime` | `/clocktime` |
| `<cwd>/.claude/worker-session-id-<shortId>.txt` | `/worktime` or `/chosetime` | `/clocktime` |
| `<cwd>/.claude/prod-session-<shortId>.txt` *(not yet built — see PM brief)* | `/prodtime` | `/prodout` |

The `worker-session-id-<shortId>.txt` marker is the session-id gate the
Stop hook checks before producing a handoff — it ensures only the
Worker session that opened a task can close it.

Why shortId scoping: without it, two Claude Code windows in the same cwd
would each clobber the other's markers, producing cross-session
handoffs and corrupted state. ShortId discovery method is documented in
`DESIGN-GUIDELINES.md §2`.

---

## 5. The hooks

The hooks turn ritual state into deterministic artifacts. They run
whether the user remembers to invoke anything or not.

**`worker-completion-signal.js`** — Stop hook, async, timeout 30s.
When an `active-task-<shortId>.txt` marker exists for the closing
session, it writes the canonical §6-section handoff to
`<project>/session-handover-<DATE>-<TASKSLUG>.md` and a pointer to
`<project>/.claude/inbox/pm/handoff-<DATE>-<shortId>-<TASKSLUG>.md`. It
also moves the kanban task from `## DOING` to `## REVIEW`. With no
marker, it exits silently.

**`pm-handoff-discovery.js`** — SessionStart hook, timeout 5s. Scans
`<cwd>/.claude/inbox/pm/` for unread handoff pointers (pointer files
that do not yet contain a `<!-- PM:READ:<date> -->` marker) and
surfaces up to six most-recent into the model's context for the new
session.

---

## 6. Lifecycle frame is the frame; dispatch pattern is contextual

### 6.1 The lifecycle is mandatory

The open → work → close cadence — opened and closed by the ritual
skills, captured by the hooks — is the part that is **mandatory**. It
is what produces the audit trail.

**Who** runs a Worker cycle is the user by default. PM sets tasks and
presents them; the user opens (`/worktime` or `/chosetime`) and closes
(`/clocktime`) the cycle. PM runs the Worker cycle itself only when
the user explicitly hands ownership of it to PM — see §6.2.

**How** the Worker cycle dispatches to subagents is **contextual**.
Work may go through the `Agent` tool inside the running session, or
through a separate Claude Code session for the Worker — driven by the
weight of the work (context budget, parallelism needs, isolation
requirements).

The lifecycle frame works regardless of who runs the cycle or which
dispatch pattern they choose.

### 6.2 PM coordinates; PM does not execute

PM's role is to **set Worker tasks** (queue them in `_kanban.md` via
`/queuetime` or directly via the kanbanger MCP) and present them to
the user. Inside any Worker cycle PM does run, the actual edits go
through **subagents** via the `Agent` tool — PM does not do the writes
itself.

**Important**: The Worker cycle is not dispatched directly by the PM.
The PM sets the tasks and presents them to the user. The user takes
responsibility for the task **UNLESS** they ask the PM to take
ownership. If the PM is given ownership of the Worker cycle, PM
**MUST** dispatch the cycle via subagents, review what comes back, and
produce the handoff.

The tell that PM has drifted into execution (when PM owns a cycle):
PM finds itself reaching for `Write` or `Edit` directly. That is the
signal to stop, write a subagent prompt, and dispatch instead.

The same principle applies upstream: Product coordinates cycles, but
the actual research / design / writing / synthesis goes to subagents.
Product does not draft the PRDs themselves; Product assembles the
capability contract from what subagents return. The same user-vs-seat
ownership rule applies: the user runs the hat cycle by default;
Product runs it only when given ownership.

### 6.3 DAG pattern for multi-task builds

When a Worker task decomposes into multiple subtasks with dependencies
and natural parallelism, whoever owns the Worker cycle (user by
default; PM if it has been given ownership — §6.2) uses
**`dag-task-runner`** (`~/.claude/skills/dag-task-runner/SKILL.md`)
inside the cycle. It:

1. Reads a DAG of subtasks (rank structure: rank N runs in parallel;
   rank N+1 depends on rank N).
2. Dispatches each rank's tasks concurrently via `Agent` tool calls.
3. Stitches upstream outputs into downstream prompts.
4. Reports outcomes back to the cycle owner; the handoff lands in the
   PM inbox either way.

**One Worker cycle wraps the entire DAG; one §6 handoff covers the
whole build.** Internal DAG audit lives in the subagent outputs the
runner returns. This is cleaner than queueing N kanban entries when
the N subtasks are tightly coupled.

For a worked example DAG, see
`C:\Users\Fab2\timeteam\.claude\inbox\pm\prodtime-build-brief-2026-05-29.md`
(8 tasks, 5 ranks, two ranks of natural parallelism).

### 6.4 Operating discipline (best practices)

- **PM coordinates; PM does not execute.** PM sets Worker tasks and
  presents them; the user normally runs the Worker cycle. When PM is
  given ownership of a cycle (§6.2), all edits still go through
  subagents via the `Agent` tool — PM never reaches for `Write` /
  `Edit` directly.
- **The lifecycle is the execution mechanism.** Whoever runs a Worker
  cycle uses `/worktime`/`/chosetime` + `/clocktime`; PM bookends the
  work session with `/teamtime` + `/sleeptime`. Direct `Write` /
  `Edit` outside a Worker lifecycle leaves no audit trail.
- **Mirror existing patterns; do not reinvent.** New rituals mirror
  existing ones (e.g., `/prodtime` mirrors `/teamtime` in structure).
  New marker conventions follow §4. New hooks follow §5.
- **ShortId-scoped markers throughout.** All new posture markers use
  `<name>-<shortId>.txt`. ShortId discovery method documented in
  `DESIGN-GUIDELINES.md §2`.
- **Subagent prompt vocabulary split.** Any subagent prompt where the
  subagent produces user-facing strings must separate spec language
  (internal — directs the subagent) from output language (plain
  English — what humans will read). See
  `~/.claude/skills/learned/subagent-prompt-vocabulary-split.md`.
- **Tool conventions** (per `DESIGN-GUIDELINES.md §4`): `Read` for
  existence checks, `Write` for new files, `mkdir -p` (single quoted
  absolute path, no chaining) for directories. Avoid Bash `test -f`,
  PowerShell probes, and `echo > file` — they trip the auto-mode
  classifier mid-flow.

---

## 7. Marketplace identity

- **Marketplace:** `early-prototype` at `github.com/earlyprototype/early-prototype`
- **Project:** `timeteam` (this suite)
- **Invocation:** `early-prototype:teamtime`, `early-prototype:worktime`,
  and (once built) `early-prototype:prodtime` and
  `early-prototype:prodout`, and so on. Claude Code prepends the
  marketplace name to the skill name per its plugin namespace
  convention.
- **Packaging shape:**
  - `.claude-plugin/plugin.json` manifest at the project root
  - Skills under `plugins/early-prototype/skills/<name>/SKILL.md`
  - Hooks under `plugins/early-prototype/hooks/`
  - Agents under `plugins/early-prototype/agents/`

---

## 8. Glossary

- **Posture** — the current role context (Product, PM, or Worker).
- **Seat** — a work-orchestration session that sets hat tasks and
  presents them to the user. This suite has two seats: **Product**
  (top, ideal state — to be built per the prodtime PM brief) and
  **PM** (middle, built). Both coordinate; neither executes directly.
  A seat runs a hat cycle itself only when the user hands ownership
  of the cycle to it (§6.2).
- **Hat** — an execution role. A hat cycle is run by the user by
  default; a seat runs it only when the user hands ownership of the
  cycle to the seat (§6.2). Worker is the primary hat in this suite.
  Designer, Researcher, Writer, and Reviewer are also hats — used by
  Product or PM depending on the level of the hierarchy that needs
  them.
- **Marker** — a small file in `<cwd>/.claude/` signaling an active
  posture. Cleared by the matching close ritual.
- **shortId** — the last 8 hex characters of the Claude Code session
  UUID, used to scope markers so concurrent Claude Code instances at
  the same cwd do not collide.
- **Lifecycle frame** — the open → work → close cadence wrapping
  every task, produced by the ritual skills.
- **Handoff** — the structured §6-section markdown file the Stop hook
  writes at Worker task end, plus its pointer in the PM inbox.

---

## 9. Further context (optional reading)

**Precedence rule.** Where any of the docs below conflicts with **§2
(postures)** or **§6 (lifecycle / coordination / DAG / best practices)**
of THIS doc, **this doc wins.** The corrected hierarchy
(Product → PM → Worker) was established 2026-05-29 and propagation
through the supporting docs is in flight, not complete.

### Aligned with the corrected hierarchy (safe to read)

- `C:\Users\Fab2\Desktop\AI\EverythingCC\Coaching\WORK-SUMMARY.md` — the
  broader arc: why the system exists, full design history, the
  tool-picker thesis. Updated 2026-05-29.
- `C:\Users\Fab2\Desktop\AI\EverythingCC\Coaching\SKILLS-DEPLOY-INDEX-v3.md`
  — the full 291-entry skill catalog tagged by role facet (nine-role
  vocabulary). Catalog data; makes no hierarchy claims.
- `C:\Users\Fab2\Desktop\AI\EverythingCC\Coaching\prodtime-spec.md` —
  Product seat ritual spec (deferred build). §1, §2, §7 updated
  2026-05-29 with the corrected hierarchy.
- `C:\Users\Fab2\timeteam\.claude\inbox\pm\prodtime-build-brief-2026-05-29.md`
  — the PM brief that builds `/prodtime` and `/prodout` and finalises
  this doc.

### Pre-correction docs — read with caution

These predate the 2026-05-29 hierarchy correction. **For hierarchy or
coordination questions, defer to this doc's §2 and §6.** Read these
for the non-hierarchy content they uniquely carry.

- `C:\Users\Fab2\timeteam\docs\DESIGN-GUIDELINES.md` — conventions for
  extending the suite. §1 (postures) carries the three-peer-posture
  framing — **stale; use this doc's §2 instead.** §2 (shortId
  convention), §4 (skill structure), §5 (hook discipline), §6
  (subagent delegation), §9 (anti-patterns) are canonical and worth
  reading. Task 7 of the prodtime PM brief updates §1.

---

## 10. What this doc is NOT

- Not the broader system's canonical arc — that lives in
  `WORK-SUMMARY.md`.
- Not the full Product seat spec — that lives in `prodtime-spec.md`.
- Not the prodtime build plan — that lives in the prodtime PM brief
  (`C:\Users\Fab2\timeteam\.claude\inbox\pm\prodtime-build-brief-2026-05-29.md`).
- Not the skill catalog — that is the v3 index.
- Not the conventions for extending the suite — those live in
  `DESIGN-GUIDELINES.md`.

It **is** the timeteam suite's self-contained architectural and
lifecycle reference. Product is included as the ideal-state top of
the work hierarchy; once `/prodtime` and `/prodout` are built per the
PM brief, the "not yet built" notes throughout this doc come out.
