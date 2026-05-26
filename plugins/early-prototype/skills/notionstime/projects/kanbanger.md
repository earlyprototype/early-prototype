# kanbanger

*Markdown-first AI-managed kanban that syncs to GitHub Projects V2.*

**Repo**: github.com/earlyprototype/kanbanger
**Status**: Working tool. Active use.
**Scale in the programme**: Practitioner — externalises project state for daily work.

---

## What it is

An MCP-driven kanban tool with markdown as the source of truth. Built because AI assistants kept breaking the kanban file when given direct file access — the solution was to let the AI use a defined tool surface instead of editing the file directly.

Key features:

- Markdown as source of truth, with one-way sync to GitHub Projects V2
- MCP server exposing kanban operations as tools the AI can call
- Atomic writes and sidecar state to prevent file corruption
- `kanban-doctor` as a first-class preflight diagnostic
- Specific care around configuration gotchas (telemetry banners corrupting JSON-RPC stdio, fine-grained PAT limitations with GitHub Projects V2 GraphQL)

The tool is shipped with operational care that signals empathy for the next person to use it — documented gotchas in the README, the doctor command as preflight, clear setup wizard, explicit explanations of vendor limitations.

---

## What question it addresses

How do we externalise project state into a structure that survives AI assistance? How do we give an AI a tool surface that supports the work without breaking the underlying artefact?

This is the same question the cognitive prosthetic architecture addresses at operational scale — how to provide cognitive infrastructure that lets an AI do useful work without breaking what it touches.

---

## Method or approach

The design move: don't let the AI edit the markdown directly. Define a tool surface (the MCP server) that exposes the operations the AI needs. The AI calls tools; the tools handle atomic writes, validation, and sync. The markdown stays consistent because no one is writing to it without going through the contract.

Markdown remains primary so the artefact stays editable by humans, version-controllable in git, and portable across tools.

---

## Adjacent science and conceptual sources

- Constructionist principle: externalise what attention can't sustainably hold; build the tool that holds it instead
- MCP (Model Context Protocol) — the standard for tool exposure to AI assistants
- GitHub Projects V2 GraphQL API
- The broader pattern of tool surfaces as a way of giving AI agents structured capability

---

## Caveats Thom has named

- Built for solo and small-team use; not tested at organisational scale
- Sync is one-way (markdown → GitHub Projects); bidirectional sync would require different design
- Specific to GitHub Projects V2; not generalised to other project management systems

---

## Connections to other projects in the programme

**Established:**

- Same impulse as the cognitive prosthetic architecture: don't let the agent operate on opaque blobs; give it a defined contract. The architecture's realisation interface and the kanbanger's tool surface are the same gesture at different scales — structured ways of letting an AI engage with material without breaking the structure.

- Practitioner artefact demonstrating the principles before they were formalised. Thom built kanbanger before articulating the cognitive prosthetic framework; the framework names what kanbanger already does in a smaller domain.

- The README's operational care (gotchas-in-context, doctor as first-class) demonstrates the constructionist disposition — empathy for the next person, treating documentation as cognitive work rather than overhead.

---

## Current state

In active use. The mainline product is the cleaner version (`kanbanger`); there is an experimental fork (`partymix`) that explored a REVIEW-gate framing as the centrepiece. The mainline is the canonical artefact for portfolio purposes.

Canonical state: the repo README and the codebase itself.
