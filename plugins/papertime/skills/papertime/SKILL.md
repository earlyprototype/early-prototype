---
name: papertime
description: Papertime. Write an operator-facing reading note (the paper format) that answers research questions from the record and the literature in the ATR house format, then check it and build its shareable page. Use whenever the user asks a research question that deserves a written answer rather than a chat reply, asks for a note, briefing, primer, write-up, reading note or explainer on a paper, method, model or tool, asks "how different is X from Y", "could our harness run on Z", "does this technique apply to our model", "where does this sit in the literature", or asks to turn an answer you already gave into a document or a page. Triggers on "papertime", "/papertime", "paper time", "paper format", "reading note". Also use when asked to check an existing note against the format, to rebuild a note's page, or when a repository's rules say operator-facing answers land as reading notes. Reach for it even when the user does not say "note": a multi-part research question with a knowledgeable but non-specialist reader is this skill's case.
---

# Papertime

Papertime writes a reading note. A reading note is the written form of a
research answer for one reader: the operator of a project, sharp and
attentive, not a specialist in the note's subject, and the final authority on
what happens next. The note exists so that person can decide something.
Everything in the format serves that: the answer comes first, every claim
says how it is known, every number carries its scale and a baseline, the
whole thing fits in 2,000 words, and the note ends by saying what remains
and what only the operator can decide.

The markdown file is the record. The page built from it is a convenience for
reading and sharing; where they differ, the file governs.

Paths below are written for the installed plugin, where the skill directory
is `${CLAUDE_PLUGIN_ROOT}/skills/papertime`. Vendored into a repository it is
`.claude/skills/papertime`; substitute accordingly. Note paths are relative
to the repository the note lands in.

## Before writing

1. Read `references/voice.md`. Those rules are not style preferences; they
   are what makes the note usable by its reader. Two of them are the ones
   most often broken, and the checker cannot see either: define every term
   and identifier in the sentence that uses it, and give every number its
   scale and a baseline. Tables are where both slip; define the term in the
   column header or the sentence that introduces the table.
2. Read `references/format.md` for the shape of the note, the length guide
   and the reasons for each part. `assets/TEMPLATE_NOTE.md` is a skeleton to
   start from, and `assets/EXAMPLE_EXCERPT.md` is the opening of a finished
   note to calibrate the register against.
3. Research before drafting, and keep a provenance trail as you go: which
   file, which page, which command produced each fact. The provenance block
   at the top of the note is written from that trail, and "nothing here was
   run" is a sentence you can only write if it is true; if you ran anything,
   say what. Verify what can be verified: read the model configuration
   rather than recalling it, check the file listing rather than assuming the
   file exists, quote the paper's wording rather than paraphrasing from
   memory. What you could not verify today is marked recalled, not
   established.
4. If the repository has an identifier register (a file that allocates
   hypothesis numbers such as H16 and experiment identifiers such as
   EXP_011), use only identifiers that already have a row there. Never coin
   one inside a note; a note proposes, the register allocates. The checker
   can verify this for you.

## Writing

Follow `references/format.md` section by section. In short: a title that
names the subject; an italic standfirst saying what was asked, when, for
whom and where the note sits; a provenance block; "the answers in brief",
one bold lead-in per question asked; one numbered section per question with
tables where numbers compare; claims marked inline as established, inferred,
recalled or speculation; and a closing section that answers, in this order,
what happened, what it means, what remains and what needs the operator's
decision. Then sources.

Write the whole note before polishing any part of it. Answers first, then
evidence, then limits. Then cut to the ceiling: at most 2,000 words outside
code and sources, and usually well under. If the project has a founding
analogy, use it only where it carries the idea, and say where it stops
holding; if it has none, do not invent one.

## Checking

Run the checker on the finished file, from the repository root:

```bash
python3 "${CLAUDE_PLUGIN_ROOT}/skills/papertime/scripts/check_note.py" docs/MY_NOTE_2026-09-05.md \
    [--register path/to/REGISTER.md] [--allow H100,H2] [--strict]
```

`--self-test` runs the checker's own tests.

It fails on em dashes in prose, on missing structural parts (title,
standfirst, provenance block, the answers-in-brief section, the closing
section, sources) and, when a register is given, on any hypothesis or
experiment identifier in prose that has no register row (`--allow` names
tokens that look like identifiers but are not, such as a GPU model). It
warns on em dashes inside code, en dashes, arrows, exclamation marks, a bad
file name, sections out of order, a lead-in without bold, a closing section
missing one of its four questions, a provenance block that does not say
whether anything was run, missing marks and a note over the 2,000-word
ceiling. Fix what it reports and run it again; a clean run is the bar for
committing. The checker is mechanical and cannot judge the writing; reread
the note once as the reader would, and find the sentence a smart outsider
would stumble on.

## Building the page

The page builder turns the markdown into a designed, theme-aware HTML page
with the epistemic marks rendered as small tags, a sticky section list and a
scrolling table container:

```bash
python3 -m pip install markdown   # once per environment
python3 "${CLAUDE_PLUGIN_ROOT}/skills/papertime/scripts/build_note_page.py" docs/MY_NOTE_2026-09-05.md \
    --out /tmp/my_note.html --title "Short Name" --for "the operator" --project "My project" --preview
```

Give `--title` a short, specific name (two to four words) for the browser tab
and gallery; the page's heading still carries the note's full title. `--for`
and `--project` fill the line above the title and may be left out. Relative
links are rewritten to the repository's GitHub URLs on the branch currently
checked out, and relative images are inlined; pass `--repo-url`, `--branch`
and `--source-path` when the note is not in a checkout, and rebuild with
`--branch main` once it has merged. `--preview` also writes a standalone
`.preview.html` you can open in a browser to check the page before
publishing. The builder prints how many marks it tagged, by kind; the
numbers match the checker's. To embed a figure, put an HTML fragment beside
the note and list it in a sidecar `<note>.figures.json` (see
`references/format.md`); the builder picks the sidecar up by name.

Publish the built file with the Artifact tool (pass a one-emoji favicon and a
one-sentence description; the artifact starts private) and give the user
the link beside the file path. If the environment has no Artifact tool, the
built file itself is the deliverable. If the note judges the operator's own
work, ask before publishing.

## Landing it in a repository

- File name: `docs/<TOPIC>_NOTE_<YYYY-MM-DD>.md`, uppercase topic with
  underscores (no hyphens), the date it was written. The checker only warns
  on the name; `--strict` makes it an error.
- Add one pointer line to the document readers would start from (a primer,
  an index, a README section) so the note is discoverable.
- Commit the note in its own commit; the page is not committed unless the
  repository keeps pages.
- The PR body states what questions the note answers and what decisions it
  raises, what it does not change (usually no code or results), and any
  register or closing-line conventions the repository requires. On a public
  repository it does not state the answers; a note is advice to one reader
  first, and the operator reads it before anyone else does.

## What not to do

- Do not restate the source paper or the repository's own findings at length;
  point to them and say what is new.
- Do not pad with hedges; mark the claim's status once, inline, and move on.
- Do not put numbers in prose without their scale and baseline, and do not
  put them in prose at all when a table would carry them.
- Do not use the words established, inferred, recalled or speculation in the
  body in any sense other than as a mark; the page tags every one.
- Do not end with an offer or a summary of the summary; end with the four
  closing questions and stop.
