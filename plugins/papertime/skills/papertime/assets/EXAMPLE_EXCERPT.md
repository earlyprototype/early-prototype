<!--
The opening of docs/LATENT_CONTEXT_NOTE_2026-09-04.md from
earlyprototype/lucier-gpt2-activ-tensor-reson-experiments, vendored here so
the register and density can be read offline. It is the head, the answers in
brief and the first paragraph of the first question section; the full note is
5,461 words and predates the 2,000-word ceiling and the "recalled" mark. Copy
its sentences, not its length.
-->

# Latent context, small chat models, and the J-space on GPT-2

*A reading note written 2026-09-04 for TC, the operator, in answer to four questions asked in session: whether a chat-trained version of GPT-2 exists; how far the small modern chat models (Qwen, Gemma and Llama at under two billion parameters) differ from GPT-2, and whether this project's harnesses could be turned over to one; whether the method of Anthropic's J-space paper can find "orthogonal context" inside GPT-2's internal state; and where, relative to the ordinary flow of that internal state, the paper's injected "thoughts" sit, and how they were discovered. It sits beside [JSPACE_PRIMER.md](JSPACE_PRIMER.md), which explains the paper itself, and does not repeat it.*

> **Provenance.** Facts about this project were read from the committed record: [FINDINGS.md](FINDINGS.md) findings F11 and F16, and, in the Stage 2 repository `ATR_research`, the operator report of 2026-07-31, the identifier register, and the Medium lens results. Facts about the paper were read from its web page and checked against the primer. Architecture numbers were read from the TransformerLens 3.8.1 source and from the models' published configuration files. The list of pre-fitted lenses was read from the Hugging Face repository `neuronpedia/jacobian-lens` through its file-listing interface on the day of writing. Nothing here was run: this note contains no new measurements, and each claim is marked as established (read from a record or a paper), inferred (reasoned from established facts), or speculation.

---

## 1. The answers in brief

**A chat-trained GPT-2 exists, though not from OpenAI.** The LaMini-GPT family (MBZUAI, 2023) is GPT-2 Small, Large and XL fine-tuned to follow written instructions, and its smallest member loads into this project's existing scripts with no code change, because its architecture, tokenizer and weight layout are exactly those of `gpt2`. Section 3 has the details.

**The small modern chat models are the same kind of object as GPT-2 with four parts changed and about a thousand times more training.** The four parts are how position is encoded, how activations are normalised, the shape of the feed-forward block, and how attention keys are shared between heads. The loop in `atr_engine.py` ports with a configuration change, because the named points at which it reads and writes the model's state are the same for every model the TransformerLens library loads. What breaks is not the code but three of this project's conventions: the injection point no longer erases position, the loudness convention lands at a very different multiple of natural strength, and the first token carries activations large enough to dominate a whole-tensor rescale. Section 4 has the table and the hazards.

**The paper's method applies to GPT-2, and this project has already applied it twice,** once as a restricted pilot on GPT-2 Small and once as a full fit on GPT-2 Medium. The new fact is that a pre-fitted, full-vocabulary lens for GPT-2 Small is now published by Neuronpedia, so the planned overlap test on Small no longer needs a seven-hour refit. Section 5 has the details.

**The "thoughts" are ordinary directions inside the model's residual stream, in the middle band of layers, not a separate channel and not orthogonal to the normal flow.** They were found by asking which directions, if nudged, most change what the model would say now or later, averaged over a thousand contexts. The workspace properties were, in the authors' own words, a surprise found afterwards. Section 5 has the details.

## 2. Where this project sits in the latent-reasoning literature

The survey the question cites, "A Survey on Latent Reasoning" (Zhu and thirty-two co-authors, arXiv 2507.06203, July 2025), collects methods in which a model carries out several steps of reasoning in its own internal numbers rather than in written-out words. Its sorting principle is where the repetition happens. Vertical methods send a layer's output back through the stack again: looped and universal transformers reuse the same layers several times; Coconut feeds the model's final hidden state back in as its next input; CoTFormer and Huginn do versions of the same with a depth that varies per token. Horizontal methods carry a state along the sequence instead: linear attention, state-space models, and test-time training, which updates a small set of weights as the text is read. A third family trains the repetition in, either by removing written reasoning steps during fine-tuning (the stepwise internalisation of Deng and colleagues) or by distilling a written chain of thought into a few continuous vectors (CODI). A fourth treats diffusion language models, which revise a whole text at once over many rounds, as reasoning of unbounded depth.

