#!/usr/bin/env python3
"""Focused regression checks for build_note_page.py."""

import tempfile
from contextlib import redirect_stderr
from io import StringIO
from pathlib import Path

import build_note_page as page


def test_srcset_candidates_stay_usable():
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        note = root / "NOTE.md"
        image = root / "chart.png"
        note.write_text("# Note\n", encoding="utf-8")
        image.write_bytes(b"png")
        markup = '<picture><source srcset="chart.png 1x"><img src="chart.png"></picture>'

        hosted = page.inline_images(
            markup, str(note), "https://github.com/acme/project", "main", "docs/NOTE.md", str(root)
        )
        assert 'srcset="https://github.com/acme/project/raw/main/docs/chart.png 1x"' in hosted, hosted
        assert 'src="data:image/png;base64,' in hosted, hosted

        warnings = StringIO()
        with redirect_stderr(warnings):
            local = page.inline_images(markup, str(note), None, None, None, str(root))
        assert 'srcset="chart.png 1x"' in local, local
        assert not warnings.getvalue(), warnings.getvalue()


def test_default_theme_is_fixed_white_light():
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        note = root / "NOTE.md"
        output = root / "note.html"
        note.write_text("# Note\n", encoding="utf-8")

        page.main([str(note), "--out", str(output)])
        built = output.read_text(encoding="utf-8")
        assert "<style>:root{\n  --bg:#FFFFFF" in built, built[:500]
        assert "@media (prefers-color-scheme: dark)" not in built, built[:1000]


if __name__ == "__main__":
    test_srcset_candidates_stay_usable()
    test_default_theme_is_fixed_white_light()
    print("builder tests OK")
