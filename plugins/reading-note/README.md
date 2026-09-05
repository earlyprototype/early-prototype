# reading-note

Writes research answers as dated reading notes in the ATR project's house
format, checks them mechanically, and builds a shareable page from the same
markdown. The markdown file governs; the page is a view of it.

## The format

A reading note is written for one reader: the operator of a project, sharp and
attentive, without a machine-learning background, and the final authority on
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
- Claims marked inline as established, inferred or speculation. The page builder
  renders those words as small tags.
- A closing section that answers, in order, what happened, what it means, what
  remains, and what needs the operator's decision. Then sources, and nothing
  after.
- No em dashes anywhere.

## What ships

| Component | Path | What it does |
|---|---|---|
| Skill | `skills/reading-note/SKILL.md` | The workflow: research with a provenance trail, write, check, build the page, land it in the repository. |
| Format | `skills/reading-note/references/format.md` | The format section by section, the mechanical conventions, the figure sidecar, the pull-request body pattern. |
| Voice | `skills/reading-note/references/voice.md` | The eight rules for writing to the operator. |
| Template | `skills/reading-note/assets/TEMPLATE_NOTE.md` | A skeleton to start from. |
| Checker | `skills/reading-note/scripts/check_note.py` | Fails on em dashes, missing structural parts and, given an identifier register, unregistered hypothesis or experiment identifiers; warns on the rest. |
| Page builder | `skills/reading-note/scripts/build_note_page.py` | Turns the note into a designed, theme-aware HTML page with a section list, scrolling tables, tagged claims and optional figures. Needs the `markdown` package. |

## Install

```bash
/plugin marketplace add earlyprototype/early-prototype
/plugin install reading-note@early-prototype
```

The skill loads on its own when a research question deserves a written
answer, when a note, briefing, primer or write-up is asked for, or when a
repository's rules say operator-facing answers land as reading notes. Invoke
it by name as `/reading-note:reading-note`.

## Use the scripts on their own

```bash
python3 skills/reading-note/scripts/check_note.py docs/MY_NOTE_2026-09-05.md --register path/to/REGISTER.md
python3 -m pip install markdown
python3 skills/reading-note/scripts/build_note_page.py docs/MY_NOTE_2026-09-05.md \
    --out /tmp/my_note.html --title "Short Name" --for "TC, the operator" --preview
```

The checker exits 1 on errors and 0 otherwise (`--strict` makes warnings
errors). The builder writes a page body ready for a hosted artifact and, with
`--preview`, a standalone file for a local browser.

## Worked example

`docs/LATENT_CONTEXT_NOTE_2026-09-04.md` in
`earlyprototype/lucier-gpt2-activ-tensor-reson-experiments`, with its figure
sidecar `docs/LATENT_CONTEXT_NOTE_2026-09-04.figures.json` and figure
`docs/figures/depth_band.html`. Read its first two screens to calibrate the
register and the density before writing your own.

## Dependencies

- Python 3.8 or later for both scripts.
- The `markdown` package for the page builder only.
- `git` on `PATH` if you want relative links rewritten to GitHub URLs
  automatically; otherwise pass `--repo-url`.

## Licence

MIT, as the marketplace.
