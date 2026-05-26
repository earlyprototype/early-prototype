# Notionstime — Programme Overview

Thom's research programme. Multiple projects working a shared underlying question through different substrates.

**The question**: *How does shape determine what cognition produces, and how do we design with that honestly?*

This document gives the programme map and the connections between projects. Individual project summaries in `projects/` provide detail on each project's content, methods, and current state.

---

## Vocabulary used in this document

A few terms recur. Definitions here so the rest of the document is self-contained.

**Cognitive geometry.** The structural properties of a system that shape what reasoning is available within it. A neural network's weight matrices have geometry (the directions that produce strong responses, the relationships between concepts encoded in the weights). A knowledge graph's schema has geometry (the entity types and relationships that define what can be represented). Both shape what the system using them can think.

**Attractor / attractor basin.** A region of a system's state space that nearby starting points converge to under iteration. In ATR's case (defined below), regions of activation space that any input eventually settles into when the model's forward pass is run repeatedly. The "basin" is the set of starting points that lead to the same attractor.

**Substrate.** The material or layer cognition operates on. A pretrained model's weights are one substrate (fixed by training). A context graph wrapped around the model is another substrate (modifiable through operational use).

**ATR (Activation Tensor Resonance).** Thom's experimental method, detailed in `projects/atr.md`. Iterative re-injection of a model's internal state through its own forward pass, revealing the attractors encoded in its weight geometry.

**SLM (small language model).** A smaller, cheaper language model used for narrow tasks within a larger architecture. In the cognitive prosthetic architecture, an SLM at the input boundary (called SLM 0) processes each incoming situation before it's encoded into the main graph; another SLM (SLM 1) looks for patterns across many situations.

**Pre-audit.** The output of SLM 0. A structured description of an incoming situation produced before the main system encodes that situation into its existing categories.

**Schema.** The set of entity types and relationship types a knowledge graph allows. The graph's structural layer, distinct from the specific data populated within it. Changes to the schema change what the graph can represent.

---

## Project index

Listed by scale, from deepest (the fixed geometry of pretrained models) to most surface (practitioner tools for daily work).

### Deep scale — weight geometry

**[ATR — Activation Tensor Resonance](projects/atr.md)**
Maps the attractor landscape of GPT-2 Small's weight geometry through iterative feedback. The method dissolves prompt-specific content by feeding the model's activations back through itself repeatedly; what remains reveals the dominant modes encoded in the weights.
*Repo: earlyprototype/lucier-gpt2-activ-tensor-reson-experiments*

### Methodological substrate

**[fold](projects/fold.md)**
A Deleuzian methodology lab for LLM experiments. Directory structure follows *A Thousand Plateaus* (SEED, SMOOTHSPACE, STRIATEDSPACE, MECHINIPHYLUM). The framework from which other LLM experiments in the programme emerge.
*Repo: earlyprototype/fold*

### Operational scale — context geometry

**[Attentionless Knowledge Graph Architecture (AKGA)](projects/cognitive_prosthetic_architecture.md)** *(dev title: Realisation Engine)*
A scaffolding architecture for deploying LLM agents in operational settings. The agent operates against a context graph held as provisional theory; small language models at the input boundary detect when situations don't fit the graph's existing schema; patterns from those detections drive schema evolution over time. The framing is cognitive prosthetic — the architecture extends what the agent can reason from, without constraining what the agent is permitted to do. Distinctive move: the architecture operates *outside the attention mechanism*, providing the agent with knowledge attention itself cannot hold.
*Working documents in current development; no public repo*

### Practitioner scale — externalisation tools

**[kanbanger](projects/kanbanger.md)**
Markdown-first AI-managed kanban that syncs to GitHub Projects V2. Solves the problem of AI assistants corrupting markdown files when given direct file access by providing a defined tool surface (an MCP server) the AI calls instead.
*Repo: earlyprototype/kanbanger*

**[thought-bubble](projects/thought_bubble.md)**
Thom's MCP server wrapping Mermaid syntax with d3.js and design scaffolding. Provides AI assistants a tool surface for producing visual artefacts that travel with markdown.
*Local MCP server*

---

## How the projects connect

Five substantive intersections across the programme. Each is built out below — claim, scaffolding, payoff. The structure for each: *what's true in each project separately*, then *what's the same across them*, then *what that sameness means*.

### 1. Two scales of cognitive geometry

**In ATR**: GPT-2 Small has weight geometry — the structural properties of its weight matrices, set by training. ATR's iterative-feedback method exposes this geometry empirically. Five attractor basins were identified in GPT-2 Small, suggesting the model has dominant modes encoded in its weights that any sufficiently-iterated activation eventually settles into.

**In the cognitive prosthetic architecture**: the LLM agent operates against a context graph whose schema acts as a kind of geometry — the entity types and relationships define what can be represented and reasoned about. The architecture treats this schema as provisional theory, updateable through operational use.

**What's the same**: both projects identify a structural layer that shapes what the system using it can think. Both treat the shape itself as the object of attention, not just the content the shape holds.

**What this means**: the cognitive prosthetic architecture operates at the modifiable schema layer; ATR exposes the fixed weight layer underneath. Two scales of the same phenomenon. Honest framing: substrate richness at the plastic schema layer does not eliminate gravity wells at the fixed weight layer. A well-designed schema cannot override what the underlying model is structurally pulled toward. The architecture handles shallow misalignment (agent lacks relevant context); it does not solve deep misalignment (model's training shapes what it can think regardless of context). This is a real constraint worth naming.

### 2. Two-phase architecture of discovery

**In ATR**: the experimental workflow has two phases. Phase one is data generation — iterate prompts through the model, save activation tensors, parallelisable, cheap once set up. Phase two is interpretation — analyse what the basins mean, examine semantic clustering, look for patterns. Phase two is slow, human-dependent, and is consistently the bottleneck.

**In the cognitive prosthetic architecture**: the update pipeline has the same structure at different scales of cost. SLM 0 produces pre-audits cheaply at every input. The structural diff between fresh local graph and retrieved subgraph is computed cheaply per situation. SLM 1 finds patterns across many diffs, more expensively. A frontier model does frame-search on the patterns, more expensively still. Human governance reviews schema-evolution proposals, most expensively.

**What's the same**: in both projects, the architecture concentrates cheap, automated work at the boundary where data is generated, and expensive, judgement-laden work at the point where the data needs to be interpreted into meaning.

**What this means**: this isn't a project-specific design — it's a general principle for research and operational pipelines alike. Detection scales cheaply; interpretation doesn't. Architectures that don't separate these end up either bottlenecked on interpretation everywhere, or skipping interpretation entirely. The two-phase pattern is worth recognising when designing any system that needs to find meaningful signal in lots of cheap data.

### 3. Information bottleneck bypass

**In ATR**: normal LLM operation passes the model's internal state through an argmax operation at each step, collapsing a high-dimensional activation tensor into a single token. Most of the information in the tensor is discarded. ATR's method bypasses this — it preserves the full activation tensor and feeds it back as input to the next forward pass. The model's internal state remains intact across iterations, which is why ATR can reveal structure that token-level analysis can't see.

**In the cognitive prosthetic architecture**: normal context-graph operation encodes incoming situations into the existing schema before processing. Situations that don't fit the schema lose their texture in the encoding — they're forced into the categories the schema allows, and the misfit is lost. The architecture's pre-encoding pre-audit bypasses this — SLM 0 captures the incoming situation in its own terms, agnostic to the existing schema, before encoding loses what doesn't fit.

**What's the same**: both projects preserve information before a lossy compression step, so that what would otherwise be lost can be examined. Both treat the lossy compression as the place where structure becomes invisible to the system that operates on the compressed output.

**What this means**: information loss happens at specific architectural points (argmax in normal generation; schema-encoding in normal graph ingestion). Detecting what's missing requires capturing the signal *before* the lossy step, not after. This is the same gesture at two scales. It generalises beyond either project — wherever a system compresses information lossily, the structure invisible to the compressed output remains visible to whatever observes the input.

### 4. Constructionist disposition throughout

**In ATR**: the work treats the model as material to investigate experimentally — running iterative feedback, observing what emerges, documenting what the experiments reveal, refining the method based on what each round shows. The JOURNEY_MAP document captures the unfolding investigation. Hypotheses are held provisionally and updated as data comes in.

**In the cognitive prosthetic architecture**: the work treats the architecture itself as material being constructed through iteration. Concept pieces are drafted, critiqued, refined. Friction in the writing surfaces where original thinking is happening. The conversation that produced the architecture is itself an instance of the architecture's principles operating.

**In kanbanger and thought-bubble**: the tools externalise what attention can't sustainably hold (project state, visual thinking). The act of building the tool is the act of working out how the cognition wants to be supported.

**What's the same**: in all the projects, materials are treated as things to think with, not records of thinking that happened elsewhere. Iteration is the default. Friction surfaces signal. Externalisation is part of cognition rather than a step after cognition.

**What this means**: this is Papert's constructionist tradition applied at adult research scale. The methodology is consistent across projects because it reflects how Thom actually does cognitive work, not because it was imposed deliberately on each project. The programme's coherence partly reflects this — same disposition, applied to different substrates, produces work with recognisable family resemblance.

### 5. Deleuzian framework available throughout

**In fold**: the framework is explicit. The directory structure (SEED, SMOOTHSPACE, STRIATEDSPACE, MECHINIPHYLUM) names concepts from Deleuze and Guattari's *A Thousand Plateaus*. Smooth space is the undifferentiated, possibility-rich; striated space is gridded, structured, constraining. The machinic phylum is the lineage of technical objects. The Body without Organs is the substrate before differentiation.

**In ATR**: the framework is referenced in the journey-map's adjacent-science table — the Body without Organs is invoked as a metaphor for weight geometry before prompt input (the undifferentiated substrate that iteration eventually striates into specific attractors).

**In the cognitive prosthetic architecture**: the framework operates implicitly. The schema striates cognitive space. The diff catches when the striation fails the smooth space of operational reality (situations that don't fit). The realisation interface lets the agent navigate between striated structure and unmapped territory. The architecture isn't decoratively Deleuzian — the framework names what the architecture actually does.

**What's the same**: across the programme, the smooth/striated distinction provides language for what each project is working with. Where structure exists, it's striated. Where situations exceed structure, they're smooth. Productive work lives in the relationship between them.

**What this means**: the philosophical framework isn't ornamental. It's a working tool that names dynamics the projects are actually engaging with. When working on any project in the programme, the Deleuzian frame is available — surface it when it helps articulate what's happening, not as decoration.

---

## The programme's intellectual location

At the intersection of:

- Constructionist pedagogy (Papert, the Maker Movement, FabLab practice)
- Dynamical systems theory (basins of attraction, asymptotic stability)
- Mechanistic interpretability (logit lens, activation patching, sparse autoencoders as adjacent methods)
- Post-structuralist philosophy (Deleuze, *A Thousand Plateaus*)
- Maker-centred learning (Agency by Design, Blikstein)
- AI architecture (context engineering, knowledge graphs, scaffolding for operational agents)

Few people are positioned to work in this intersection. Thom is, partly because of his background designing learning environments for FabLab contexts internationally, and partly because his cross-pollination instincts are strong.

---

## How to engage with the programme

When working on any single project, hold the broader programme in awareness. The five intersections above are well-established; other connections may be emergent. When a possible intersection appears, surface it to Thom rather than asserting it independently.

Read individual project files for project-specific context. Each file follows the structure in `projects/_template.md`.

When a project intersects with one not yet in `projects/`, propose adding it (see `SKILL.md` for the process).
