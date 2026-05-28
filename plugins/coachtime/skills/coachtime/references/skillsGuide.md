# Daily Set — Thom's curated working kit

Generated 2026-05-20. The ~43 skills you actually reach for, grouped by the seat/hat model. Scan this; fall back to `SKILLS-DEPLOY-INDEX-v3.md` (full 291-entry library) only when nothing here fits.

Derived from the user-level carve-out (`~/.claude/skills/`, 40) minus 2 trims, plus 5 promotes. ⬆ = promoted from library this curation. Promotes are not yet installed to `~/.claude/skills/` — see "To apply" at the bottom.

---

## MENTOR — Coach (helps you learn; not a work seat)
- **continuous-learning-v2** — observes sessions, accretes confidence-scored instincts
- **strategic-compact** — suggests `/compact` at logical task boundaries

## PRODUCT seat (what should exist + how it hangs together)
- **knowledge-ops** — ingest/sync/retrieve across your knowledge layers
- **architecture-decision-records** — capture decisions + rationale as ADRs
- **iterative-retrieval** — orchestrator-dispatches-to-subagents context pattern
- **mcp-server-patterns** ⬆ — build MCP servers (your Neo4j build domain)
- **codebase-onboarding** ⬆ — map a cold/paused repo on re-entry

## PM / Worker lifecycle (the ritual system)
- **teamtime** — open PM session, surface handoffs
- **plantime** — phased project plan
- **queuetime** — queue a task to kanban TODO/BACKLOG
- **chosetime** — Worker picks a queued task → DOING
- **worktime** — Worker clock-in (fresh task → DOING)
- **notetime** — mid-task note → embedded in handoff
- **clocktime** — Worker task end → DONE
- **readtime** — acknowledge an unread handoff
- **check-handoffs** — list unread handoffs
- **sleeptime** — close PM session
- **cleantime** — wipe PM/Worker state (recovery/testing)

## Orchestration
- **dag-task-runner** — decompose into a DAG, run ranks in parallel
- **dmux-workflows** — parallel agent sessions via tmux panes

## Researcher hat (gather external truth)
- **deep-research** — multi-source cited research
- **exa-search** — neural web/code/company/people search
- **market-research** — competitive analysis, due diligence
- **horizon-scan** — landscape orientation for an operator
- **excavate-paused-project** — forensically reconstruct an abandoned project

## Designer hat (surface look/feel)
- **frontend-slides** — animation-rich HTML decks

## Writer hat (compose with voice)
- **article-writing** — long-form in your voice
- **content-engine** — platform-native social content systems
- **investor-materials** — decks, memos, models (internally consistent)
- **investor-outreach** — cold/warm/follow-up investor emails

## Worker hat (build to spec)
- **backend-patterns** — Node/Express/Next API patterns
- **frontend-patterns** — React/Next state, perf, UI
- **postgres-patterns** — query/schema/index/RLS
- **python-patterns** — Pythonic idioms, type hints
- **python-testing** — pytest/TDD/coverage
- **tdd-workflow** — tests-first, 80%+ coverage
- **coding-standards** — cross-project naming/immutability floor

## Reviewer hat (adversarial verification)
- **security-review** — auth/input/secrets/endpoint checklist
- **verification-loop** — build/type/test/quality gates
- **eval-harness** — eval-driven dev, pass@k, regression suites
- **gateguard** ⬆ — ambient fact-forcing gate before edit/write/bash

## Ambient / ship
- **hookify** ⬆ — turn a repeated correction into an ambient hook
- **opensource-pipeline** ⬆ — fork → sanitise → package a repo for public release

---

## Trimmed from the carve-out
- **jpa-patterns** — Java/Hibernate; no evidence you do Java
- **clickhouse-io** — ClickHouse OLAP; no evidence you use it

## To apply (separate explicit step — not yet done)
- Install the 5 promotes (`mcp-server-patterns`, `codebase-onboarding`, `gateguard`, `hookify`, `opensource-pipeline`) to `~/.claude/skills/` via `/configure-ecc` or manual copy.
- Remove the 2 trims from `~/.claude/skills/`.
- This sheet reflects the intended set; the carve-out on disk still has the old 40 until you run the install step.

_Full library + all facet tags: `SKILLS-DEPLOY-INDEX-v3.md`. Daily count: 43 (40 − 2 + 5)._
