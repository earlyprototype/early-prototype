# The reading-note format, section by section

Every part below exists for the reader named in `voice.md`: one operator who
will decide something after reading. The format does not care what the
material is. A paper, a codebase, a month of meeting notes, a spreadsheet, a
supplier's quotation and a half-remembered conversation all enter the same
way, as material with a source and a status. Keep the order; each part
answers a question the reader has at that moment.

## Length

A note is at most 2,000 words, counted over everything except fenced code
and the Sources section. The checker warns above that. The ceiling is not a
target: a two-question note often needs 1,200. A guide to the parts:

| Part | Words |
|---|---|
| Standfirst | 60 to 120 |
| Provenance block | 60 to 150 |
| Each answer in brief | 60 to 120 |
| Each question section | 300 to 500 |
| Closing section | under 250 |

When the draft runs long, cut evidence that shows work rather than
supporting a decision, move comparisons from prose into one table, and point
at the material instead of restating it. The operator can ask for more; they
cannot get the time back.

## 1. Title

A heading that names the subject, not the occasion: "Where the invoice
backlog comes from, and what clears it", not "Notes from Friday's questions".

## 2. Standfirst

One italic paragraph directly under the title. It says what was asked, when,
for whom, and where the note sits among the documents the reader already has
("It sits beside the onboarding guide, which describes the system itself,
and does not repeat it"). If there is nothing for it to sit beside, say that
it stands alone. This is where the reader learns whether to read on.

## 3. Provenance block

A blockquote beginning `**Provenance.**` that accounts for the material. For
each class of it, say where it came from, how it was read or checked, and
when. Name the actual sources rather than their kind: which files, which
pages, which people, which listings, which measurements, on which day. State
plainly whether anything was run, computed or measured for this note, and if
so what; "nothing here was run" is a sentence you may only write when it is
true. End with the marking convention: each claim is marked as established,
inferred, recalled or speculation.

## The four marks

- **Established**: read today from a source named in the note, whether that
  is a file, a page, a person, a measurement or a command's output.
- **Inferred**: reasoned from established facts, with the reasoning in the
  note.
- **Recalled**: from the writer's general knowledge, not checked against a
  source today. Most of a note written without access to the material is
  recalled; say so rather than promoting it to established.
- **Speculation**: a guess, the writer's or a source's, flagged as one.

Mark claims inline using exactly these words: "This is established.", "That
is inferred, not measured.", "Recalled, not checked today:", "Speculation,
flagged by the source itself:". The page builder tags every occurrence of
established, inferred, an inference, recalled and speculation in body prose
(outside code, headings, links and figures), and the checker counts the same
occurrences, so do not use these words in any other sense in the body ("a
well-established firm" with the hyphen is left alone; "an established
supplier" would be tagged as a claim).

## 4. The answers in brief

A section whose heading contains "in brief". One paragraph per question,
each opening with a bold lead-in that states the answer as a sentence,
followed by one to three sentences of the essential why, and a pointer to
the section that carries the detail. If a question's premise is wrong, the
correction is one more bold paragraph here. A reader who stops here has the
answers; everything after is evidence and limits.

## 5. One section per question

Numbered sections, in the order the questions were asked. Inside each:

- Lead with the answer again, then the evidence, then the limits.
- Define every term and identifier in the sentence that uses it, every time.
  In a table, define it in the column header or in the sentence that
  introduces the table.
- Give every number its scale and a baseline: "a median wait of 12 minutes
  against the 30 minute target", never "12 minutes".
- Put comparisons in tables; write wide tables as markdown tables and let
  the page scroll them.
- Mark claims inline with the four marks above.
- Where the subject carries an analogy the reader already uses, use it only
  where it carries the idea, and say where it stops holding.
- Correct the reader's premise where it is wrong, plainly and early ("the
  two outages you are remembering were one incident"), then answer the
  question they meant.

## 6. What remains, and what needs the operator's decision

The closing section answers four questions in this order and then stops:

1. What happened (what the note did, what was found, including new facts).
2. What it means (the reading, with its status marked).
3. What remains (numbered, ordered by information per unit cost, each with a
   cost estimate, none of it started).
4. What needs the operator's decision (only decisions that are genuinely
   theirs; each with the choice stated and, where you have one, your
   recommendation marked as offered).

The checker looks for the phrases "what happened", "what it means", "what
remains" and "decision" in the section's body. No closing offer, no summary
of the summary.

## 7. Sources

A bulleted list of everything cited, with URLs where they exist and file
paths, names or dates for material that has none.

## Mechanical conventions

- No em dashes in prose. Use a comma, a colon, or a new sentence. Number
  ranges use "to" ("5 to 10"), not a dash. When quoting a source verbatim
  and the quotation contains an em dash, put the quotation in a code span or
  fenced block; the checker warns rather than fails there.
- No bare identifiers or acronyms: "ADR 14, the decision record that chose
  the queue", not "ADR 14".
- Percentages carry their counts: "64 percent, 27 of 42".
- Dates are ISO (2026-09-07) in file names and provenance; prose may spell
  them out.
- File name `<TOPIC>_NOTE_<YYYY-MM-DD>.md`: uppercase topic, words joined
  with underscores (no hyphens), the date the note was written.
- Relative links to other files beside the note are allowed; the page
  builder rewrites them to repository URLs and inlines relative images.

## Figures

The page builder accepts an optional sidecar `<note>.figures.json` beside the
note:

```json
[
  { "after": "The figure below puts the two costs on one scale", "file": "figures/costs.html" }
]
```

`after` is the opening words of the paragraph the figure follows, compared
against the paragraph's plain text (formatting, marks and case ignored);
`file` is an HTML fragment (a `<figure>` element with a `<figcaption>`,
inline SVG welcome) relative to the sidecar, or give `html` with the
fragment inline. Draw figures to one scale and label every value. Take
colours from the page's CSS variables so the figure reads in either theme:
`--fig-1` (blue), `--fig-2` (grey) and `--fig-3` (gold) for data, `--ink-2`
for labels, `--surface` for gaps between cells; the text classes `svg-lbl`
and `svg-num` and the line classes `svg-tick` and `svg-cell` are styled by
the page. Give every shape a plain fill as well, as a fallback. A figure
earns its place only when it shows something the prose cannot.

## Worked example

`assets/EXAMPLE_NOTE_2026-09-07.md` is a complete note in this format, on a
deliberately ordinary subject. It passes the checker with no errors and no
warnings. Read it to calibrate the register and the density before writing
your own.
