# papertime

Writes research answers as dated reading notes in the ATR project's house
format, checks them mechanically, and builds a shareable page from the same
markdown. The markdown file governs; the page is a view of it.

## The format

A reading note is written for one reader: the operator of a project, sharp and
attentive, not a specialist in the note's subject, and the final authority on
what happens next. Everything in the format serves that reader.

- A title that names the subject, and an italic standfirst saying what was
  asked, when, for whom, and where the note sits among the project's documents.
- A provenance block saying where every class of fact came from, whether
  anything was run, and how claims are marked.
- "The answers in brief": one bold lead-in per question, so a reader who stops
  there has the answers.
- One numbered section per question, answer first, evidence next, limits last,
  with every term defined in the sentence that uses it and every number carrying
  its scale and a baseline.
- Claims marked inline as established, inferred, recalled or speculation. The
  page builder renders those words as small tags, and the checker counts the
  same occurrences.
- A closing section that answers, in order, what happened, what it means, what
  remains, and what needs the operator's decision. Then sources, and nothing
  after.
- At most 2,000 words outside code and sources. No em dashes in prose.

## What ships

| Component | Path | What it does |
|---|---|---|
| Skill | `skills/papertime/SKILL.md` | The workflow: research with a provenance trail, write, check, build the page, land it in the repository. |
| Format | `skills/papertime/references/format.md` | The format section by section, the length guide, the four marks, the mechanical conventions, the figure sidecar, the pull-request body pattern. |
| Voice | `skills/papertime/references/voice.md` | The rules for writing to the operator, with the ATR-specific habits set apart at the end. |
| Template | `skills/papertime/assets/TEMPLATE_NOTE.md` | A skeleton to start from. |
| Example | `skills/papertime/assets/EXAMPLE_EXCERPT.md` | The opening of a finished note, vendored so the register can be read offline. |
| Checker | `skills/papertime/scripts/check_note.py` | Fails on em dashes in prose, missing structural parts and, given an identifier register, unregistered identifiers; warns on the rest, including a note over the word ceiling. |
| Page builder | `skills/papertime/scripts/build_note_page.py` | Turns the note into a designed, theme-aware HTML page with a section list, scrolling tables, tagged claims, rewritten links, inlined images and optional figures. Needs the `markdown` package. |

## Install

```bash
/plugin marketplace add earlyprototype/early-prototype
/plugin install papertime@early-prototype
```

The skill loads on its own when a research question deserves a written
answer, when a note, briefing, primer or write-up is asked for, or when a
repository's rules say operator-facing answers land as reading notes. Invoke
it by name as `/papertime:papertime`, or as `/papertime` where the skill
directory is vendored into a repository's `.claude/skills/`.

## Use the scripts on their own

```bash
python3 skills/papertime/scripts/check_note.py docs/MY_NOTE_2026-09-05.md --register path/to/REGISTER.md --allow H100
python3 -m pip install markdown
python3 skills/papertime/scripts/build_note_page.py docs/MY_NOTE_2026-09-05.md \
    --out /tmp/my_note.html --title "Short Name" --for "the operator" --preview
```

The checker exits 1 on errors and 0 otherwise (`--strict` makes warnings
errors; `--self-test` runs its own tests). The builder writes a page body
ready for a hosted artifact and, with `--preview`, a standalone file for a
local browser. Inside a git checkout it links to the branch checked out; pass
`--branch main` after the note merges, and `--repo-url` plus `--source-path`
when the note is not in a checkout.

## Worked example

`skills/papertime/assets/EXAMPLE_EXCERPT.md` is the opening of
`docs/LATENT_CONTEXT_NOTE_2026-09-04.md` in
`earlyprototype/lucier-gpt2-activ-tensor-reson-experiments`. The full note,
with its figure sidecar and figure, is in that repository; it predates the
word ceiling, so read it for register and density, not for length.

## Dependencies

- Python 3.8 or later for both scripts.
- The `markdown` package for the page builder only.
- `git` on `PATH` if you want relative links rewritten to GitHub URLs
  automatically; otherwise pass `--repo-url`.

## Changes

- 1.1.0: a fourth mark, recalled, for knowledge not checked against a source
  today; a 2,000-word ceiling with a per-part guide; the checker and the
  builder share one definition of a mark and report the same counts; the
  builder tags marks anywhere in body prose (table cells, parentheticals,
  mid-sentence) and inserts figures after paragraphs that contain marks or
  start with bold; the register check ignores code and reads the register
  case-insensitively, with `--allow` for tokens that are not identifiers; em dashes inside code
  are a warning rather than an error, for verbatim quotation; the closing
  section's four questions are checked in its body, not its heading; correct
  line numbers on lead-in warnings, and list items are checked too; a
  warning when the provenance block does not say whether anything was run;
  all relative links are rewritten and relative images are inlined; links
  point at the branch checked out, and the footer only says "committed"
  when the file is tracked; the section list uses the headings' own numbers;
  the ATR-specific habits are separated from the general voice rules; the
  worked example's opening is vendored.
- 1.0.0: first release.

## Licence

MIT, as the marketplace.
