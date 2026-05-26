# Attentionless Knowledge Graph Architecture (AKGA)

*Also known as the Realisation Engine (dev title). A scaffolding architecture for LLM operational agents, using context graphs as cognitive geometry with an SLM-driven update pipeline.*

**Repo / location**: No public repo yet. Working documents include `product_spec.md`, `working_context.md`, seven concept pieces, `insights_register.md`.
**Status**: Active development. Spec drafted, concept pieces drafted, names chosen.
**Scale in the programme**: Operational — modifiable context geometry wrapped around the model.

**Naming notes**: *Attentionless Knowledge Graph Architecture (AKGA)* is the formal name. It locates the work in the KG tradition (honest about lineage) while naming what's distinctive (operates outside attention). *Realisation Engine* is the dev title, used in code, repos, and builder-facing materials. Both refer to the same architecture; the names exist for different audiences.

---

## What it is

An architecture for deploying LLM operational agents in complex environments. The architecture builds on standard knowledge graph + vector store patterns (Neo4j and similar — graph for structure, vectors for similarity, complementary technologies). What is distinctive is the update mechanism layered on top:

- **Pre-encoding pre-audit** by a small language model (SLM 0) at the input boundary, agnostic to the existing graph schema, preserving situation texture before schema encoding loses it
- **Structural diff** between the retrieved subgraph (what the ontology says situations like this look like) and the fresh local graph (built from pre-audit data using the same construction method as the main graph) — measures where the geometry is failing
- **Pattern-finding across diffs** (SLM 1), surfaced to a frontier model for frame-search, with human governance over schema evolution
- **Realisation interface** delivering surfaced patterns to the agent as context (integrated into reasoning) rather than as flags (interrupting reasoning)

The framing is cognitive prosthetic — the architecture extends what the agent can notice and reason from, without constraining what the agent is permitted to do. Substrate richness as alignment property: the agent's reasoning happens with relevant context as working material, so behaviour reflects the fuller picture without external check.

---

## What question it addresses

How does the modifiable shape we wrap around an LLM determine what cognition it produces operationally? How do we keep that shape alive under reality contact rather than letting it calcify into competent extension of past patterns?

---

## Method or approach

The architecture instantiates constructionist principles for LLM cognitive agents:

- The graph is the material the agent thinks with
- The diff is the friction that surfaces where understanding is failing
- The realisation interface is the moment of construction (the *oh, that's what's been happening*)
- Schema evolution under reality contact is conceptual change

Each design move is a response to a specific question about what cognition requires. The series of concept pieces (seven drafted) develops these moves: graph as cognitive geometry, diff as residual signal, pre-encoding pre-audit, realisation as interface, cognitive prosthetic over supervisor, scaffolding as product category, and the bridge to broader cognitive agents.

---

## Adjacent science and conceptual sources

- Papert / constructionism — objects to think with, externalised artefacts as part of cognition
- Vygotsky — Zone of Proximal Development, more knowledgeable other
- Marton — variation theory
- Talisman article on ontologies, context graphs, and semantic layers (the triggering article)
- Anthropic on context engineering for AI agents
- Standard knowledge graph + vector store architecture (Neo4j with vector indexes, GraphRAG patterns)
- Predictive processing — residuals as signal

---

## Caveats Thom has named

- The architecture handles shallow misalignment (agent lacks relevant context) but does not solve deep misalignment (agent has different goals).
- Substrate richness at the plastic schema layer does not eliminate gravity wells at the fixed weight-geometry layer underneath (see ATR).
- Generalisation to human cognitive agents is speculative — the principles transfer but the mechanisms require different implementation.
- The "scaffolding as product category" framing is positioning, not boasting. Defensibility comes from execution and accumulated operational data, not from the design itself.

---

## Connections to other projects in the programme

**Established:**

- The architecture operates at the modifiable layer; ATR exposes the fixed layer underneath. Two scales of cognitive geometry.
- The architecture's SLM 0 / SLM 1 / frontier model / human governance pipeline matches ATR's two-phase architecture of discovery — data generation cheap, interpretation expensive.
- The pre-audit is the same gesture as ATR's information bottleneck bypass — preserve information before lossy compression to see what gets lost.
- The architecture's relationship to smooth/striated cognitive space directly implements fold's Deleuzian framework. This is named explicitly in concept piece 7's "intellectual location worth naming" section.

**Emergent:**

- The architecture's principles describe how the conversation that produced them was itself a constructionist practice — materials to think with, friction as diagnostic, realisation as the moment of construction. The framework recognising itself operating on itself.
- The practitioner tools (kanbanger, thought-bubble) operate on the same impulse as the architecture, in domains Thom uses daily.

---

## Current state

Spec drafted and revised to incorporate late-session framing corrections (KG+vector substrate acknowledged, two-scales-of-cognitive-geometry section added, constructionist foundation made explicit, Core Mechanisms intro softened). Seven concept pieces drafted and revised in line with the same corrections. Working context, insights register, and the Brouwer/attractor distinction (corrected after technical review — see spec's two-scales section and concept piece 7's "Why mathematics matters here" section) are current.

Canonical continuity document: `working_context.md` in the working files.
