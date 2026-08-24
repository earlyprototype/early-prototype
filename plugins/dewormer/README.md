# dewormer

Strips the performed-quality tics out of Claude's prose.

## The principle

**Substance carries itself. Never label your own prose.**

Writing delivers a quality by containing it. The moment a sentence names the
quality it wants credit for, the label has replaced the thing. A sentence that
says "the key insight is" has not produced an insight, it has produced an
announcement. A reply opening "let me be blunt" has not been blunt, it has asked
to be read as blunt.

Nine families of phrase do this. They perform insight, candour, rigour, warmth,
care, and expertise instead of supplying any of them:

1. Anthropomorphised code-speak (`load-bearing`, `footgun`, `the culprit`)
2. Self-important spotlighting (`the key insight`, `why this matters`)
3. Performative candor (`let me be direct`, `my honest read`)
4. Unsolicited validation (`great question`, `you're absolutely right`)
5. Adverb inflation (`actually`, `genuinely`, `empirically`)
6. The em-dash reframe (`isn't X, it's Y`)
7. Hedging connective tissue (`worth noting`, `that said`)
8. Metaphor soup (`happy path`, `blast radius`, `under the hood`)
9. Sign-off tics (`Verdict:`, `want me to...?`, `happy to`)

The full list runs to about ninety terms and lives in the skill.

## The trap it disarms

Under preference training, every desirable property of a reply has a cheap
lexical proxy. Insight costs work, "the key insight is" costs one phrase. Raters
rewarded replies carrying the proxy, because in human writing the proxy usually
travels with the property. Gradient descent reaches the proxy first. Goodhart's
law running on vocabulary: a marker that once indexed quality becomes a
substitute for it.

A second mechanism produces the same output. Under next-token generation the
writer often does not know its point before writing it. "The real question is"
buys a beat and commits the sentence to producing something question-shaped.
These phrases are private scaffolding for thinking that leaked into delivery,
which is why deleting them costs nothing.

**Test:** delete the phrase. If the sentence still stands, it was decoration. If
the sentence collapses, there was no sentence, only a label.

Headings are the exception, since a heading is a pointer and deleting it leaves
nothing to judge. There the test is substitution: replace the heading with the
section's own conclusion.

## What ships

| Component | Name | Behaviour |
|---|---|---|
| Output style | `Dewormer` | Always on once selected. Rewrites the system prompt. Keeps Claude Code's coding instructions. Folds in lead-with-the-result brevity. |
| Skill | `dewormer` | Loaded on demand. Full term list, before/after rewrites, exceptions, a 5-step edit procedure, and a grep audit line for checking a draft file. |

Use the style if you want it on every turn. Use the skill alone if you only want
it when editing a document.

## Install

```bash
/plugin marketplace add earlyprototype/early-prototype
/plugin install dewormer@early-prototype
```

## Turn the output style on

The style is optional. Installing the plugin does not switch it on.

**Terminal:** run `/config`, choose **Output style**, select **Dewormer**.

**By hand:** set `outputStyle` in a settings file.

```json
{
  "outputStyle": "Dewormer"
}
```

- `~/.claude/settings.json` for every project
- `.claude/settings.local.json` for one project, and this is the file `/config`
  writes, so a project value overrides the global one

Output style is part of the system prompt, read once at session start. Run
`/clear` or start a new session for the change to land.

`Dewormer` replaces whichever style was active. It already contains the
lead-with-the-result rules from the built-in `Concise` style, so switching from
`Concise` loses nothing.

To turn it off, pick another style in `/config` or set `outputStyle` back.

## Use without the plugin

Copy either file straight into your own config:

```bash
# output style
curl -o ~/.claude/output-styles/dewormer.md \
  https://raw.githubusercontent.com/earlyprototype/early-prototype/main/plugins/dewormer/output-styles/dewormer.md

# skill
mkdir -p ~/.claude/skills/dewormer && curl -o ~/.claude/skills/dewormer/SKILL.md \
  https://raw.githubusercontent.com/earlyprototype/early-prototype/main/plugins/dewormer/skills/dewormer/SKILL.md
```

## Rewrites

| Wormed | Clean |
|---|---|
| Great catch, you're absolutely right. The culprit is that this quietly swallows the error. | The `except` block returns `None` without logging, so the caller sees a missing record instead of a failure. |
| Worth flagging: the real question isn't whether it scales, it's whether it's correct under concurrency. | Two writers can hit this at once and the second overwrites the first. |
| The key insight is that caching here has a large blast radius. | The cache is process-wide, so one stale entry affects every request until restart. |
| Verdict: solid. Want me to add tests? | Tests cover the parser, not the retry path. |

## What it does not do

Removing the label never means withholding the substance. When you are correct,
you get told what was wrong rather than told you were right. Literal artifact
names survive, so a function called `sanity_check` keeps its name. Error output,
failing tests, and security warnings keep their full content.

Epistemic status markers survive too. In a witness statement, incident report,
clinical note or audit finding, "this is my account" and "I would verify this
before relying on it" look like performative candor or hedging and are neither.
A worm claims a property of the prose; an epistemic marker claims a property of
the evidence. Run mechanically over an evidential document, the term list strips
the exact lines that make it credible.

Overcorrection is the failure mode. The target is the removal of announcements,
not the removal of personality.

## Licence

MIT. See `LICENSE`.
