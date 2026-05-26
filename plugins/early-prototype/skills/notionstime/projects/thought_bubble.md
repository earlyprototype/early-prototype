# thought-bubble

*MCP server wrapping Mermaid with d3.js and design scaffolding. Externalises visual cognition.*

**Location**: Local MCP server. Not yet hosted publicly.
**Status**: Working tool. Active use.
**Scale in the programme**: Practitioner — externalises visual thinking for daily work.

---

## What it is

Thom's own MCP (Model Context Protocol) server that gives AI assistants a tool surface for producing visual artefacts. Built on Mermaid for diagram syntax, extended with d3.js for richer visualisation, and layered with design scaffolding that makes the outputs visually coherent.

The tool exists because Thom's cognition is visual-first. He thinks in diagrams. Pure-text exchanges with AI assistants lose this; thought-bubble lets him work in his native register through AI collaboration.

---

## What question it addresses

How do we externalise visual cognition into shareable, modifiable artefacts? How does the practitioner make their native cognitive mode available to AI collaboration?

---

## Method or approach

MCP server exposing diagramming operations as tools the AI can call. The AI generates Mermaid syntax (which works in standard markdown) and can extend with d3.js for visualisations Mermaid doesn't handle natively. Design scaffolding ensures the outputs follow consistent visual conventions.

Artefact portability: outputs travel as Mermaid code in markdown, which renders natively in most environments. d3.js extensions add capability without losing the core portability.

---

## Adjacent science and conceptual sources

- Constructionist principle: externalisation as part of cognition rather than record of cognition
- Visual thinking traditions (Tufte, Bret Victor, sketching as cognition)
- Papert — objects to think with, applied to the practitioner's own working mode
- Mermaid — diagram syntax that renders natively in markdown
- d3.js — for richer visualisation

---

## Caveats Thom has named

- Local-only currently. Not hosted; not available to web-only Claude sessions. Hosting is a future learning exercise.
- Built for solo use; not a polished product.
- Used as a personal tool rather than for distribution.

---

## Connections to other projects in the programme

**Established:**

- Same impulse as kanbanger: externalise what attention can't sustainably hold; build the tool that holds it instead. Practitioner artefact demonstrating the constructionist principles in daily practice.

- Same impulse as the cognitive prosthetic architecture: provide structured ways for AI to engage with material that match the practitioner's cognitive mode. Visual-first cognition supported by a tool surface designed for it.

- Evidence the practitioner was practising the principles before formalising them. The cognitive prosthetic framework names what thought-bubble already does for visual cognition in daily work.

**Emergent:**

- Thought-bubble's design scaffolding may itself be a small instance of the cognitive geometry concept — providing structural constraints that shape what visual outputs are coherent. Worth surfacing if relevant.

---

## Current state

Active use locally. Hosting it on a server (Cloudflare Workers, Fly.io, or similar) is on the future development queue as a learning exercise.

Canonical state: the local codebase.
