# papertime

Turns any body of material into a dated reading note, checks the note
mechanically, and builds a shareable page from the same markdown. The
markdown file governs; the page is a view of it.

## The format

A reading note is written for one reader: the operator, sharp and attentive,
not a specialist in the subject, and the final authority on what happens
next. The material can be anything, a paper or a codebase, a month of
meetings, a spreadsheet, a supplier's quotation, an archive of your own.
Everything in the format serves that reader.

- A title that names the subject, and an italic standfirst saying what was
  asked, when, for whom, and where the note sits among the documents the
  reader already has.
- A provenance block saying where each class of material came from, whether
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

The format is content agnostic. A short section at the top of the skill
carries the extra directions a research note needs: keeping a source trail,
verifying what can be verified, and using only identifiers a register has
already allocated.

## What ships

| Component | Path | What it does |
|---|---|---|
| Skill | `skills/papertime/SKILL.md` | The workflow: settle the questions, gather the material with a trail, write, check, build the page, land it. |
| Format | `skills/papertime/references/format.md` | The format section by section, the length guide, the four marks, the mechanical conventions, the figure sidecar. |
| Voice | `skills/papertime/references/voice.md` | The rules for writing to the operator. |
| Template | `skills/papertime/assets/TEMPLATE_NOTE.md` | A skeleton to start from. |
| Example | `skills/papertime/assets/EXAMPLE_NOTE_2026-09-07.md` | A complete note on an ordinary subject, clean under `--strict`. |
| Checker | `skills/papertime/scripts/check_note.py` | Fails on em dashes in prose, missing structural parts and, given an identifier register, unregistered identifiers; warns on the rest, including a note over the word ceiling. |
| Page builder | `skills/papertime/scripts/build_note_page.py` | Turns the note into a designed HTML page with a section list, scrolling tables, tagged claims, rewritten links, inlined images and optional figures. Needs the `markdown` package. |

## Install

```bash
/plugin marketplace add earlyprototype/early-prototype
/plugin install papertime@early-prototype
```

The skill loads on its own when a question deserves a written answer, when a
note, briefing, primer, explainer or write-up is asked for, or when a
repository's rules say operator-facing answers land as reading notes. Invoke
it by name as `/papertime:papertime`, or as `/papertime` where the skill
directory is vendored into a repository's `.claude/skills/`.

## Use the scripts on their own

```bash
python3 skills/papertime/scripts/check_note.py docs/MY_NOTE_2026-09-07.md --register path/to/REGISTER.md --allow ADR14
python3 -m pip install markdown
python3 skills/papertime/scripts/build_note_page.py docs/MY_NOTE_2026-09-07.md \
    --out /tmp/my_note.html --title "Short Name" --for "the operator" --preview
```

The checker exits 1 on errors and 0 otherwise (`--strict` makes warnings
errors; `--self-test` runs its own tests). The builder writes a page body
ready for a hosted artifact and, with `--preview`, a standalone file for a
local browser. Pages render light for every reader unless `--theme dark` or
`--theme auto` says otherwise. Inside a git checkout the builder links to the
branch checked out; pass `--branch main` after the note merges, and
`--repo-url` plus `--source-path` when the note is not in a checkout.

## Worked example

`skills/papertime/assets/EXAMPLE_NOTE_2026-09-07.md` is a complete note in
the format, on a deliberately ordinary subject (whether a weekly status
meeting should become a written update). It passes the checker with no
errors and no warnings, so it also serves as a regression fixture.

## Dependencies

- Python 3.8 or later for both scripts.
- The `markdown` package for the page builder only.
- `git` on `PATH` if you want relative links rewritten to repository URLs
  automatically; otherwise pass `--repo-url`.

## Changes

- 1.2.0: the format is content agnostic, and the research directions are
  compacted into one special-case section at the top of the skill; every
  reference to a particular project, repository or file is gone from the
  skill, and the worked example is a self-contained note that ships with the
  plugin; pages render light by default, with `--theme dark` and
  `--theme auto`; link queries are no longer double-escaped, `srcset`
  candidates are handled, and the word ceiling counts the real Sources
  section rather than the first heading that says "source".
- 1.1.0: a fourth mark, recalled, for knowledge not checked against a source
  today; a 2,000-word ceiling with a per-part guide; the checker and the
  builder share one definition of a mark and report the same counts; the
  builder tags marks anywhere in body prose and inserts figures after
  paragraphs that contain marks or start with bold; the register check
  ignores code and reads the register case-insensitively, with `--allow` for
  tokens that are not identifiers; em dashes inside code are a warning
  rather than an error, for verbatim quotation; the closing section's four
  questions are checked in its body, not its heading; all relative links are
  rewritten and relative images are inlined, confined to the repository;
  branch names and paths are encoded before they reach the page.
- 1.0.0: first release.

## Licence

MIT, as the marketplace.
