---
name: papertime
description: >-
  Use when a user asks for papertime, paper time, paper format, a reading note,
  briefing, primer, explainer, write-up, comparison, summary or decision memo;
  asks to turn an answer into a document or page; asks to check a note or
  rebuild its page; or when repository rules require operator-facing reading
  notes. Also use for a multi-part question that deserves a written answer for
  a knowledgeable non-specialist, including "how different is X from Y",
  "should we do X", "what is going on with Y" and "where does this sit". The
  material can be a paper, codebase, meeting, dataset, plan, product, market or
  archive.
---

# Papertime

Papertime writes a reading note. A reading note is a body of material broken
down and set out for one reader: the operator, sharp and attentive, not a
specialist in the subject, and the final authority on what happens next. The
material can be anything, a paper or a codebase, a month of meetings, a
spreadsheet, a supplier's quotation, a product you are considering, your own
archive. The note exists so that person can decide something. Everything in
the format serves that: the answer comes first, every claim says how it is
known, every number carries its scale and a baseline, the whole thing fits
in 2,000 words, and the note ends by saying what remains and what only the
operator can decide.

The markdown file is the record. The page built from it is a convenience for
reading and sharing; where they differ, the file governs.

Paths below are written for the installed plugin, where the skill directory
is `${CLAUDE_PLUGIN_ROOT}/skills/papertime`. Vendored into a repository it is
`.claude/skills/papertime`; substitute accordingly. Note paths are relative
to the directory the note lands in.

## Special case: a research note

When the material is research, a paper, a literature, or a record you are
reading for the first time, these hold as well. None of them is a format
rule; the format is the same for every note.

- Keep a source trail as you read: which file, which page, which command
  produced each fact. The provenance block is written from that trail.
- Verify what can be verified. Read the configuration rather than recalling
  it, check the listing rather than assuming the file exists, quote the
  wording rather than paraphrasing from memory.
- Anything you could not check today is recalled, not established. If you
  ran, computed or measured something, say what it was and what kind of check
  it was.
- Do not restate the source at length. Point to it and say what is new.
- Correct the reader's premise where it is wrong, plainly and early, then
  answer the question they meant.
- Where a project allocates identifiers centrally in a register file, use
  only identifiers that already have a row there. A note proposes, the
  register allocates. With `--register`, the checker verifies `H` followed by
  digits and an optional lowercase suffix (for example `H12a`), and `EXP_`
  followed by three digits and optional alphanumeric or hyphenated suffixes
  (for example `EXP_012b-run`). Check ADRs, tickets and other identifier
  schemes against their registers manually. `--allow` names H-number or
  `EXP_`-shaped tokens that are not identifiers.

## Before writing

1. Read `references/voice.md`. Those rules are what make the note usable by
   its reader. Two of them are the ones most often broken, and the checker
   cannot see either: define every term and identifier in the sentence that
   uses it, and give every number its scale and a baseline. Tables are where
   both slip; define the term in the column header or in the sentence that
   introduces the table.
2. Read `references/format.md` for the shape of the note, the length guide
   and the reason for each part. `assets/TEMPLATE_NOTE.md` is a skeleton to
   start from, and `assets/EXAMPLE_NOTE_2026-09-07.md` is a finished note to
   calibrate register and density against.
3. Settle two things before drafting and write them down: the questions the
   note answers, in the order the reader asked them or would ask them, and
   the decision the note serves. A question the reader would not act on does
   not earn a section.
4. Gather the material, noting as you go where each piece came from: the
   file, the page, the person, the command, the date. The provenance block
   is written from those notes, and whatever you cannot attribute is marked
   recalled rather than established.

## Writing

Follow `references/format.md` section by section. In short: a title that
names the subject; an italic standfirst saying what was asked, when, for
whom and where the note sits; a provenance block; "the answers in brief",
one bold lead-in per question; one numbered section per question, with
tables where things compare; claims marked inline as established, inferred,
recalled or speculation; and a closing section that answers, in this order,
what happened, what it means, what remains and what needs the operator's
decision. Then sources.

Write the whole note before polishing any part of it. Answers first, then
evidence, then limits. Then cut to the ceiling: at most 2,000 words outside
code and sources, and usually well under. If the subject carries an analogy
the reader already uses, use it only where it carries the idea, and say
where it stops holding; if there is none, do not invent one.

## Checking

Run the checker on the finished file, from the directory the note path is
relative to:

```bash
python3 "${CLAUDE_PLUGIN_ROOT}/skills/papertime/scripts/check_note.py" docs/MY_NOTE_2026-09-07.md \
    [--register path/to/REGISTER.md] [--allow H100] [--strict]
```

`--self-test` runs the checker's own tests.

It fails on em dashes in prose, on missing structural parts (title,
standfirst, provenance block, the answers-in-brief section, the closing
section, sources) and, when a register is given, on any supported H-number or
`EXP_` identifier in prose that has no register row. Other identifier schemes
need a manual check. It warns on em dashes inside code, en dashes, arrows,
exclamation marks, a bad file name, sections out of order, a lead-in without
bold, a closing section missing one of its four questions, a provenance block
that does not say whether anything was run, computed or measured, missing
marks and a note over the 2,000-word ceiling. Fix what it reports and run it
again; a clean run is the bar for publishing or committing. The checker is
mechanical and cannot judge the writing; reread the note once as the reader
would, and find the sentence a smart outsider would stumble on.

## Building the page

The page builder turns the markdown into a designed HTML page with the
epistemic marks rendered as small tags, a sticky section list and a
scrolling table container:

```bash
python3 -m pip install markdown   # once per environment
python3 "${CLAUDE_PLUGIN_ROOT}/skills/papertime/scripts/build_note_page.py" docs/MY_NOTE_2026-09-07.md \
    --out /tmp/my_note.html --title "Short Name" --for "the operator" --project "My project" \
    --theme light --preview
```

Give `--title` a short, specific name (two to four words) for the browser tab
and gallery; the page's heading still carries the note's full title. `--for`
and `--project` fill the line above the title and may be left out. Use
`--theme light`, with its white `#FFFFFF` background, unless the user asks for
another theme. Light is also the default and never follows the reader's
system setting; `--theme dark` makes a dark page and `--theme auto` follows
the system setting. Relative links are rewritten to the repository's GitHub
URLs on the branch currently checked out, and relative images are inlined;
pass `--repo-url`, `--branch` and `--source-path` when the note is not in a
checkout, and rebuild with `--branch main` once it has merged. `--preview`
also writes a standalone `.preview.html` you can open in a browser to check
the page before publishing. The builder prints how many marks it tagged, by
kind; the numbers match the checker's. To embed a figure, put an HTML
fragment beside the note and list it in a sidecar `<note>.figures.json` (see
`references/format.md`); the builder picks the sidecar up by name.

Publish the built file with the Artifact tool (pass a one-emoji favicon and a
one-sentence description; the artifact starts private) and give the user
the link beside the file path. If the environment has no Artifact tool, the
built file itself is the deliverable. If the note judges the operator's own
work, ask before publishing.

## Landing it in a repository

When the note belongs in a repository rather than a chat:

- File name: `docs/<TOPIC>_NOTE_<YYYY-MM-DD>.md`, uppercase topic with
  underscores (no hyphens), the date it was written. The checker only warns
  on the name; `--strict` makes it an error.
- Add one pointer line to the document readers would start from (an index, a
  primer, a README section) so the note is discoverable.
- Commit the note in its own commit; the page is not committed unless the
  repository keeps pages.
- A pull request body follows this pattern:

```
## What this adds
<one paragraph: the note, its date, the questions it answers and the
decisions it raises, without stating the answers>

## What this does not change
No code, no results, no artifacts. Nothing was run.

<any closing-line convention the repository requires>
```

On a public repository that body is public, and a note is advice to one
reader first, so it names the questions and the decisions, not the
conclusions. On a private repository say what you like.

## What not to do

- Do not restate the material at length; point to it and say what is new.
- Do not pad with hedges; mark the claim's status once, inline, and move on.
- Do not put numbers in prose without their scale and baseline, and do not
  put them in prose at all when a table would carry them.
- Do not use the words established, inferred, recalled or speculation in the
  body in any sense other than as a mark; the page tags every one.
- Do not end with an offer or a summary of the summary; end with the four
  closing questions and stop.
