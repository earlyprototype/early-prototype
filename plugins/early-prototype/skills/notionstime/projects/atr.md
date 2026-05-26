# ATR — Activation Tensor Resonance

*Mapping the attractor landscape of GPT-2 Small's weight geometry through iterative activation re-injection.*

**Repo**: github.com/earlyprototype/lucier-gpt2-activ-tensor-reson-experiments
**Status**: Exploratory research project. Single-model evidence base. Statistical validation pending.
**Scale in the programme**: Deep — exposes the fixed weight geometry layer of a pretrained model.

---

## What it is

Inspired by Alvin Lucier's *I Am Sitting in a Room* (1969) — where Lucier recorded himself speaking, played the recording back into the room, re-recorded the result, and repeated until speech dissolved into the room's resonant frequencies — ATR applies an analogous operation to GPT-2 Small. The model's activation tensor is excited through iterative forward-pass feedback. As semantic content dissolves, dominant attractor states emerge, revealing the model's "naked inner voice."

Five attractor basins were identified in GPT-2 Small: `prolet` (35%), `Divine` (27%), `Anarch` (21%), `till` (15%), and `solidarity` (2%). Four of five cluster semantically in the embedding matrix around political philosophy, theology, and collective action — read as a possible thematic fingerprint of WebText (Reddit-curated content circa 2018), the model's training corpus.

The empirical findings are stable and reproducible on the same machine. The interpretive frame — that the basins reflect the training corpus's thematic centre of mass — is hypothesis-shaped rather than data-shaped. Cross-model evidence that would test this has not yet been produced.

---

## What question it addresses

How does the fixed shape of a pretrained model's weight geometry determine what cognition it produces? What is *there*, underneath the prompt-dependent surface generation, in the architecture itself?

---

## Method or approach

Nonlinear power iteration on the transformer forward pass:

1. Feed a prompt into GPT-2 Small
2. Extract the entire internal activation tensor across all token positions from the final layer
3. L2-normalise the tensor (energy conservation)
4. Re-inject as input to the next forward pass, overwriting token embeddings
5. Repeat ~100 times
6. Observe what the model converges to

The mathematical correspondence with Lucier's acoustic process: Lucier's iteration is linear power iteration on an acoustic transfer function, guaranteed by the spectral theorem to converge to the dominant eigenvector. The transformer forward pass is nonlinear (LayerNorm, softmax attention, GeLU MLP), so no spectral-theorem guarantee holds — the system can have multiple fixed points with distinct basins of attraction. ATR maps the landscape of these basins empirically.

---

## Adjacent science and conceptual sources

- Lucier, *I Am Sitting in a Room* (1969) — the structural inspiration
- Dynamical systems theory — basins of attraction, asymptotic stability
- Mixing time analogies from acoustics
- Mechanistic interpretability (logit lens, activation patching, SAEs as adjacent methods)
- Deleuze — Body without Organs as the undifferentiated substrate metaphor
- Levin — TAME, morphogenesis (attractor basins as the body plan of the model)
- Mary Shelley framing — making something whose nature is not fully grasped at the moment of making

---

## Caveats Thom has named

- **Single model, single architecture.** All results specific to GPT-2 Small (124M parameters). Cross-model validation is the most important pending experimental programme. No claimed continuum to modern models.
- **GPT-2 Small's "naked geometry" is partly a function of being small, old, and trained on a narrow corpus.** Modern models almost certainly have more layered, distributed, harder-to-expose geometry. Whether ATR-style dissolution would surface anything comparable in them is genuinely unknown.
- **Repeatability, not reproducibility.** N=2 same-machine runs produce identical terminal basins. Independent re-implementation on different hardware has not been attempted.
- **Per-prompt prediction was poor (~25%).** Structural claims (basins exist, these are their shares) are supported. Predictive claims (which prompt goes where) are not.
- **No null-model control yet.** Iterating on random unit-norm tensors (no real prompt) has not been tested. This is the single most important pending experiment.
- **Statistical validation pending.** Random-baseline comparison and permutation tests are designed but not yet run.

---

## Connections to other projects in the programme

**Established:**

- ATR exposes the *fixed* weight geometry layer. The cognitive prosthetic architecture wraps the *modifiable* schema geometry layer around the model. Both shape cognition; substrate richness at the plastic layer does not eliminate gravity wells at the fixed layer.

- ATR's two-phase architecture of discovery (data generation cheap, interpretation expensive, interpretation as the bottleneck) is structurally identical to the cognitive prosthetic architecture's SLM 0 / SLM 1 / frontier model / human governance pipeline.

- ATR's information bottleneck bypass — preserving the full activation tensor rather than passing through argmax — is the same gesture as the architecture's pre-encoding pre-audit (preserving situation texture before schema encoding loses it). Different scales, same principle.

---

## Current state

Phase 3 complete (Attractor Dominance, 125 prompts). Phase 4 supervisory analysis in progress. Cross-model scaling programme planned but not started. Null-model control experiment is the immediate next priority.

Canonical continuity document: `docs/JOURNEY_MAP.md` in the repo. Supervisor session reviews in `docs/supervisor/`.
