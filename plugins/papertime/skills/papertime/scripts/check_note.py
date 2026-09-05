#!/usr/bin/env python3
"""Check a reading note against the house format.

Usage:
    python3 check_note.py NOTE.md [--register REGISTER.md] [--allow H100,EXP_999]
                          [--strict]
    python3 check_note.py --self-test

Errors (exit status 1):
    an em dash in prose (outside code spans and fenced blocks);
    no level-one title as the first line;
    no italic standfirst paragraph directly under the title;
    no provenance blockquote (a line beginning "> **Provenance.**") above
        the first section;
    no section whose heading contains "in brief";
    no closing section whose heading contains "what remains";
    no "Sources" section;
    with --register, any hypothesis number (H-number, pattern
        \\bH\\d+[a-z]?\\b) or experiment identifier (EXP-identifier, pattern
        \\bEXP_\\d{3}[a-z0-9]*(-[A-Za-z0-9]+)*\\b) in prose that the register
        does not mention and --allow does not list. Code spans and fenced
        blocks are not searched. Identifiers in the note are matched as the
        ATR_research CI matches them, in their uppercase form; the register
        is read case-insensitively so a lowercase register still counts.

Warnings (exit status 0 unless --strict):
    an em dash inside a code span or fenced block (allowed only for a
    verbatim quotation); en dashes; arrows ("->" or the arrow character)
    outside code; exclamation marks outside code; a file name that does not
    follow <TOPIC>_NOTE_<YYYY-MM-DD>.md; sections out of the expected order;
    a paragraph or list item in the "in brief" section that does not open
    with a bold lead-in; a closing section whose body is missing one of its
    four questions; a body with no claim marked established or inferred; a
    provenance block that does not state the marking convention or does not
    say whether anything was run; a standfirst with no date; a body longer
    than the ceiling (2,000 words over the head and every section except
    Sources, fenced code excluded).

Marks. The checker counts the words established, inferred, an inference,
speculation and recalled in the body prose (outside code spans, fenced
blocks, headings and link text; a hyphenated compound such as
"well-established" does not count). The page builder tags exactly the same
occurrences, so the two tools report the same numbers, and a word used in
any other sense will be tagged as a claim.

The checker is mechanical. It cannot tell whether a number carries its scale
and baseline or whether a term is defined in its sentence; reread the note
for those.
"""

import argparse
import os
import re
import sys

WORD_CEILING = 2000

HYP_RE = re.compile(r"\bH\d+[a-z]?\b")
EXP_RE = re.compile(r"\bEXP_\d{3}[a-z0-9]*(?:-[A-Za-z0-9]+)*\b")
HYP_RE_I = re.compile(HYP_RE.pattern, re.I)
EXP_RE_I = re.compile(EXP_RE.pattern, re.I)
FILENAME_RE = re.compile(r"^[A-Z0-9]+(?:_[A-Z0-9]+)*_NOTE_\d{4}-\d{2}-\d{2}\.md$")
H1_RE = re.compile(r"^#\s+\S")
H2_RE = re.compile(r"^##\s+(.*\S)\s*$")
STANDFIRST_RE = re.compile(r"^(\*(?!\*).+(?<!\*)\*|_(?!_).+(?<!_)_)\s*$")
PROVENANCE_RE = re.compile(r"^>\s*\*\*Provenance\.?\*\*")
LIST_MARKER_RE = re.compile(r"^\s*(?:[-*+]|\d+\.)\s+")
# A code span is any run of backticks closed by an equal run: `a`, ``a`b``.
CODE_SPAN_RE = re.compile(r"(`+)(?!`)(.+?)(?<!`)\1(?!`)")
EM_DASH = "—"
HORIZONTAL_BAR = "―"
EN_DASH = "–"
ARROW_RE = re.compile("(?:->|→|=>)")

# The one definition of an epistemic mark, shared in spirit with
# build_note_page.py (which carries the same pattern). Keep them identical.
MARK_RE = re.compile(r"(?<![\w-])(established|inferred|an inference|speculation|recalled)\b", re.I)
MARK_KEYS = {"established": "established", "inferred": "inferred", "an inference": "inferred",
             "speculation": "speculation", "recalled": "recalled"}


class Report:
    def __init__(self, path):
        self.path = path
        self.errors = []
        self.warnings = []
        self.marks = {"established": 0, "inferred": 0, "speculation": 0, "recalled": 0}
        self.words = 0

    def error(self, msg, line=None):
        self.errors.append((line, msg))

    def warn(self, msg, line=None):
        self.warnings.append((line, msg))

    def render(self):
        out = []
        for kind, items in (("error", self.errors), ("warning", self.warnings)):
            for line, msg in items:
                where = f"{self.path}:{line}" if line else self.path
                out.append(f"{where}: {kind}: {msg}")
        return out


def blank_code(lines):
    """Return a copy of the lines with fenced blocks and inline code spans
    replaced by spaces, so line numbers survive and prose checks do not fire
    on code."""
    out = []
    in_fence = False
    for line in lines:
        if line.startswith("```"):
            in_fence = not in_fence
            out.append("")
            continue
        if in_fence:
            out.append("")
            continue
        out.append(CODE_SPAN_RE.sub(" ", line))
    return out


def prose_only(text):
    """Body text reduced to the prose the marks rule applies to: no code, no
    headings, no link text, no URLs."""
    lines = blank_code(text.split("\n"))
    lines = [l for l in lines if not l.startswith("#")]
    text = "\n".join(lines)
    text = re.sub(r"!?\[[^\]]*\]\([^)]*\)", " ", text)          # inline links and images
    text = re.sub(r"!?\[[^\]]*\]\[[^\]]*\]", " ", text)         # reference-style links
    text = re.sub(r"(?m)^\s*\[[^\]]+\]:\s*\S.*$", " ", text)     # link definitions
    text = re.sub(r"(?is)<a\b[^>]*>.*?</a>", " ", text)           # raw HTML links, text included
    text = re.sub(r"<[^>\n]+>", " ", text)
    text = re.sub(r"https?://\S+", " ", text)
    return text


def count_marks(text):
    counts = {"established": 0, "inferred": 0, "speculation": 0, "recalled": 0}
    for m in MARK_RE.finditer(prose_only(text)):
        counts[MARK_KEYS[m.group(1).lower()]] += 1
    return counts


def split_sections(lines):
    """Return (head_lines, [(heading_text, start_line_no, body_lines), ...]).
    Line numbers are 1-based. The head is everything before the first
    level-two heading."""
    head = []
    sections = []
    current = None
    in_fence = False
    for i, line in enumerate(lines, start=1):
        if line.startswith("```"):
            in_fence = not in_fence
        m = H2_RE.match(line) if not in_fence else None
        if m:
            current = (m.group(1), i, [])
            sections.append(current)
        elif current is None:
            head.append(line)
        else:
            current[2].append(line)
    return head, sections


def paragraphs(lines):
    """Blank-line separated paragraphs as (first_line_no, text), 1-based
    within the given lines."""
    out = []
    buf = []
    start = None
    for i, line in enumerate(lines, start=1):
        if line.strip():
            if not buf:
                start = i
            buf.append(line)
        elif buf:
            out.append((start, "\n".join(buf)))
            buf = []
    if buf:
        out.append((start, "\n".join(buf)))
    return out


def check_text(path, text, register_text=None, allow=()):
    rep = Report(path)
    lines = text.split("\n")
    prose_lines = blank_code(lines)

    # Dashes. An em dash in prose is an error; inside code it is a warning,
    # because the only legitimate reason for one is a verbatim quotation.
    for i, (line, prose) in enumerate(zip(lines, prose_lines), start=1):
        has_dash = EM_DASH in line or HORIZONTAL_BAR in line
        if not has_dash:
            continue
        if EM_DASH in prose or HORIZONTAL_BAR in prose:
            rep.error("em dash; use a comma, a colon, or a new sentence", i)
        else:
            rep.warn("em dash inside code; allowed only when quoting a source verbatim", i)
    for i, prose in enumerate(prose_lines, start=1):
        if EN_DASH in prose:
            rep.warn('en dash; write ranges as "5 to 10" and joins with a hyphen', i)
        if ARROW_RE.search(prose):
            rep.warn("arrow chain; write the relation as a sentence", i)
        if re.search(r"!(?![\[=])", prose):
            rep.warn("exclamation mark; the number beside its baseline does the striking", i)

    # File name.
    base = os.path.basename(path)
    if path != "<string>" and not FILENAME_RE.match(base):
        rep.warn("file name does not follow <TOPIC>_NOTE_<YYYY-MM-DD>.md "
                 "(uppercase topic, underscores not hyphens, ISO date)")

    # Title.
    first = next((l for l in lines if l.strip()), "")
    if not H1_RE.match(first):
        rep.error("the first line must be a level-one heading (# Title) naming the subject", 1)

    head, sections = split_sections(lines)

    # Standfirst: the first paragraph after the title.
    head_paras = paragraphs(head)
    stand = None
    for ln, para in head_paras:
        if H1_RE.match(para.split("\n")[0]):
            continue
        stand = (ln, para)
        break
    if stand is None or not STANDFIRST_RE.match(stand[1].replace("\n", " ")):
        rep.error("no italic standfirst paragraph directly under the title "
                  "(one paragraph wrapped in single asterisks saying what was "
                  "asked, when, for whom, and where the note sits)",
                  stand[0] if stand else None)
    elif not re.search(r"\d{4}", stand[1]):
        rep.warn("the standfirst does not say when the note was written", stand[0])

    # Provenance block.
    prov_lines = [(i, l) for i, l in enumerate(head, start=1) if PROVENANCE_RE.match(l)]
    if not prov_lines:
        rep.error('no provenance blockquote above the first section '
                  '(a line beginning "> **Provenance.**")')
    else:
        i0 = prov_lines[0][0]
        block = []
        for l in head[i0 - 1:]:
            if l.startswith(">"):
                block.append(l.lstrip("> ").strip())
            else:
                break
        prov_text = " ".join(block).lower()
        for word in ("established", "inferred", "speculation"):
            if word not in prov_text:
                rep.warn(f'the provenance block does not state the marking convention (missing "{word}")', i0)
                break
        if not re.search(r"\b(was|were|is|are)\s+(not\s+)?run\b|\bran\b|\bnothing\s+(here\s+)?was\s+run", prov_text):
            rep.warn("the provenance block does not say whether anything was run", i0)

    # Sections.
    def find(pred):
        for idx, (title, ln, body) in enumerate(sections):
            if pred(title.lower()):
                return idx
        return None

    if not sections:
        rep.error("no level-two sections (## heading)")
    brief = find(lambda t: "in brief" in t)
    closing = find(lambda t: "what remains" in t)
    sources = find(lambda t: re.search(r"\bsources?\b", t) is not None)
    if brief is None:
        rep.error('no section whose heading contains "in brief"')
    if closing is None:
        rep.error('no closing section whose heading contains "what remains"')
    if sources is None:
        rep.error('no "Sources" section')

    if brief is not None and brief != 0:
        rep.warn('the "in brief" section should be the first section', sections[brief][1])
    if sources is not None and sources != len(sections) - 1:
        rep.warn('"Sources" should be the last section', sections[sources][1])
    if closing is not None and sources is not None and closing != sources - 1:
        rep.warn('the closing section should sit directly before "Sources"', sections[closing][1])

    if brief is not None:
        title, ln, body = sections[brief]
        for pln, para in paragraphs(body):
            plines = para.split("\n")
            if LIST_MARKER_RE.match(plines[0]):
                items = [(k, l) for k, l in enumerate(plines) if LIST_MARKER_RE.match(l)]
            else:
                items = [(0, plines[0])]
            for k, l in items:
                lead = LIST_MARKER_RE.sub("", l.lstrip(), count=1)
                if lead.startswith(("**", "__")):
                    continue
                rep.warn('a paragraph in the "in brief" section does not open with a bold '
                         'lead-in stating the answer', ln + pln + k)
    if closing is not None:
        title, ln, body = sections[closing]
        joined = "\n".join(body).lower()
        for phrase in ("what happened", "what it means", "what remains", "decision"):
            if phrase not in joined:
                rep.warn(f'the closing section does not answer "{phrase}"', ln)

    # Marks and length, over the body (everything after the head).
    body_md = "\n".join("## " + t + "\n" + "\n".join(b) for t, _, b in sections)
    rep.marks = count_marks(body_md)
    if rep.marks["established"] == 0:
        rep.warn("no claim in the body is marked established")
    if rep.marks["inferred"] == 0:
        rep.warn("no claim in the body is marked inferred")

    counted = [("", head)] + [(t, b) for i, (t, _, b) in enumerate(sections) if i != sources]
    words = 0
    for t, b in counted:
        words += len(t.split())
        in_fence = False
        for l in b:
            if l.startswith("```"):
                in_fence = not in_fence
                continue
            if not in_fence:
                words += len(l.split())
    rep.words = words
    if words > WORD_CEILING:
        rep.warn(f"the note runs {words:,} words against a ceiling of {WORD_CEILING:,} "
                 "(fenced code and Sources excluded); cut evidence that shows work "
                 "rather than supporting a decision")

    # Register: prose only, case-insensitive on both sides.
    if register_text is not None:
        registered = {t.upper() for t in HYP_RE_I.findall(register_text)} | \
                     {t.upper() for t in EXP_RE_I.findall(register_text)} | \
                     {a.strip().upper() for a in allow if a.strip()}
        for i, line in enumerate(prose_lines, start=1):
            for tok in set(HYP_RE.findall(line)) | set(EXP_RE.findall(line)):
                if tok.upper() not in registered:
                    rep.error(f"identifier '{tok}' has no row in the register; a note "
                              f"proposes, the register allocates (pass --allow {tok} "
                              f"if it is not an identifier)", i)
    return rep


GOOD = """# A subject

*A reading note written 2026-09-05 for the operator, in answer to one question.*

> **Provenance.** Read from the record. Nothing here was run. Each claim is marked as established, inferred, or speculation.

---

## 1. The answers in brief

**Yes.** Because of the record. Section 2 has the details.

## 2. The question

The fact is established. The reading is inferred, not measured.

## 3. What remains, and what needs the operator's decision

What happened: a note. What it means: little. What remains: nothing. What needs the operator's decision: none.

## Sources

- The record.
"""


def self_test():
    rep = check_text("GOOD_NOTE_2026-09-05.md", GOOD)
    assert not rep.errors, rep.render()
    assert not rep.warnings, rep.render()
    assert rep.marks == {"established": 1, "inferred": 1, "speculation": 0, "recalled": 0}, rep.marks
    assert 0 < rep.words < 100, rep.words

    bad = GOOD.replace("Because of the record", "Because " + EM_DASH + " of the record")
    bad = bad.replace("## Sources", "## Bibliography")
    bad = bad.replace("*A reading note", "A reading note").replace("one question.*", "one question.")
    rep = check_text("bad.md", bad)
    msgs = " | ".join(m for _, m in rep.errors)
    assert "em dash" in msgs and "Sources" in msgs and "standfirst" in msgs, msgs
    assert any("file name" in m for _, m in rep.warnings)

    # An em dash inside code is a warning, not an error.
    coded = GOOD.replace("The fact is established.",
                         "The fact is established. The paper says `a " + EM_DASH + " b`.\n\n```\nx " + EM_DASH + " y\n```")
    rep = check_text("GOOD_NOTE_2026-09-05.md", coded)
    assert not rep.errors, rep.render()
    assert sum("em dash inside code" in m for _, m in rep.warnings) == 2, rep.render()

    # Register: prose only, case-insensitive, --allow.
    reg = "| h1 | something |\n| exp_001 | something |\n"
    noted = GOOD.replace("The fact is established.",
                         "H1 and EXP_001 are established; H2 is not registered; `H5` is code and H100 is a GPU.")
    rep = check_text("GOOD_NOTE_2026-09-05.md", noted, reg)
    msgs = [m for _, m in rep.errors]
    assert len(msgs) == 2 and "'H2'" in msgs[0] + msgs[1] and "'H100'" in msgs[0] + msgs[1], msgs
    rep = check_text("GOOD_NOTE_2026-09-05.md", noted, reg, allow=["H100"])
    msgs = [m for _, m in rep.errors]
    assert len(msgs) == 1 and "'H2'" in msgs[0], msgs

    # Lead-in check: list items count, line numbers point at the paragraph.
    warn = GOOD.replace("**Yes.** Because", "- Yes. Because").replace(
        "marked as established, inferred, or speculation", "marked").replace(
        "Nothing here was run.", "")
    rep = check_text("GOOD_NOTE_2026-09-05.md", warn)
    kinds = " | ".join(m for _, m in rep.warnings)
    assert "bold" in kinds and "marking convention" in kinds and "was run" in kinds, kinds
    bold_line = next(l for l, m in rep.warnings if "bold" in m)
    assert warn.split("\n")[bold_line - 1].startswith("- Yes."), bold_line

    # Closing questions are looked for in the body, not the heading.
    thin = GOOD.replace("What remains: nothing. What needs the operator's decision: none.", "")
    rep = check_text("GOOD_NOTE_2026-09-05.md", thin)
    kinds = " | ".join(m for _, m in rep.warnings)
    assert '"what remains"' in kinds and '"decision"' in kinds, kinds

    # Marks: hyphenated compounds, headings, links and code do not count;
    # "an inference" and "recalled" do.
    marked = GOOD.replace("The fact is established.",
                          "A well-established firm. That is an inference. Recalled, not checked: x. "
                          "`established` [established](a.md)\n\n### Established heads\n\nSpeculation: y.")
    rep = check_text("GOOD_NOTE_2026-09-05.md", marked)
    assert rep.marks == {"established": 0, "inferred": 2, "speculation": 1, "recalled": 1}, rep.marks
    assert any("marked established" in m for _, m in rep.warnings)

    # Length, head included.
    long = GOOD.replace("The fact is established.", "The fact is established. " + "word " * 2100)
    rep = check_text("GOOD_NOTE_2026-09-05.md", long)
    assert any("ceiling" in m for _, m in rep.warnings), rep.render()
    split = GOOD.replace("The fact is established.", "The fact is established. " + "word " * 1900)
    split = split.replace("in answer to one question.*", "in answer to one question. " + "head " * 150 + "*")
    rep = check_text("GOOD_NOTE_2026-09-05.md", split)
    assert any("ceiling" in m for _, m in rep.warnings), rep.render()

    # Multi-backtick code spans are code.
    spans = GOOD.replace("The fact is established.",
                         "The fact is established. See ``H9 " + EM_DASH + " established`` and `H8`.")
    rep = check_text("GOOD_NOTE_2026-09-05.md", spans, "| H1 |")
    assert not rep.errors, rep.render()
    assert rep.marks["established"] == 1, rep.marks

    # Reference-style and raw HTML links do not count as marks.
    refs = GOOD.replace("The fact is established.",
                        "The fact is [established][src] and <a href=\"x\">established</a>.\n\n[src]: http://example.org/established")
    rep = check_text("GOOD_NOTE_2026-09-05.md", refs)
    assert rep.marks["established"] == 0, rep.marks

    # Every item of a tight list in the brief is checked.
    tight = GOOD.replace("**Yes.** Because of the record. Section 2 has the details.",
                         "- **Yes.** Because.\n- No bold here.\n- **Also.** Fine.")
    rep = check_text("GOOD_NOTE_2026-09-05.md", tight)
    bold = [l for l, m in rep.warnings if "bold" in m]
    assert len(bold) == 1 and tight.split("\n")[bold[0] - 1] == "- No bold here.", (bold, rep.render())
    print("self-test OK")


def main(argv=None):
    ap = argparse.ArgumentParser(description="Check a reading note against the house format.")
    ap.add_argument("note", nargs="?", help="the markdown note to check")
    ap.add_argument("--register", help="identifier register; every H-number and "
                    "EXP-identifier in the note's prose must appear in it")
    ap.add_argument("--allow", default="", help="comma-separated tokens that look like "
                    "identifiers but are not (for example H100,H2)")
    ap.add_argument("--strict", action="store_true", help="treat warnings as errors")
    ap.add_argument("--self-test", action="store_true", help="run the checker's own tests")
    args = ap.parse_args(argv)
    if args.self_test:
        self_test()
        return 0
    if not args.note:
        ap.error("a note path is required (or --self-test)")
    text = open(args.note, encoding="utf-8").read()
    register_text = open(args.register, encoding="utf-8").read() if args.register else None
    rep = check_text(args.note, text, register_text, allow=args.allow.split(","))
    for line in rep.render():
        print(line)
    m = rep.marks
    print(f"{args.note}: {len(rep.errors)} errors, {len(rep.warnings)} warnings; "
          f"{rep.words:,} words; marks: established {m['established']}, inferred {m['inferred']}, "
          f"speculation {m['speculation']}, recalled {m['recalled']}")
    failed = bool(rep.errors) or (args.strict and bool(rep.warnings))
    print("FAIL" if failed else "OK")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
