"""Offline checks for the DrDoc marketplace package."""

import json
import re
from pathlib import Path
import unittest


PLUGIN = Path(__file__).resolve().parents[1]
ROOT = PLUGIN.parents[1]


class DrDocPackageTests(unittest.TestCase):
    def test_marketplace_resolves_to_standalone_plugin(self):
        catalog = json.loads((ROOT / ".claude-plugin/marketplace.json").read_text(encoding="utf-8"))
        entries = [entry for entry in catalog["plugins"] if entry["name"] == "drdoc"]
        self.assertEqual(len(entries), 1)
        entry = entries[0]
        self.assertEqual((ROOT / entry["source"]).resolve(), PLUGIN)
        manifest = json.loads((PLUGIN / ".claude-plugin/plugin.json").read_text(encoding="utf-8"))
        self.assertEqual(manifest["name"], entry["name"])
        self.assertEqual(manifest["version"], entry["version"])

    def test_install_guides_show_the_short_command_first(self):
        for guide in (ROOT / "README.md", PLUGIN / "README.md"):
            with self.subTest(guide=guide.relative_to(ROOT)):
                text = guide.read_text(encoding="utf-8")
                _, _, usage = text.partition("/plugin install drdoc@early-prototype")
                commands = re.findall(r"(?:^|`)(/drdoc(?::drdoc)?)(?=[`\s]|$)", usage, re.MULTILINE)
                self.assertEqual(commands[:1], ["/drdoc"])
                self.assertIn("/drdoc:drdoc", commands)
                self.assertNotIn("~/.claude/skills/drdoc", usage)

    def test_discoverable_skill_contains_the_full_drdoc_charter(self):
        skill = PLUGIN / "skills/drdoc/SKILL.md"
        self.assertTrue(skill.is_file(), "Missing standalone DrDoc skill")
        text = skill.read_text(encoding="utf-8")
        start, metadata, document = text.split("---\n", 2)
        self.assertEqual(start, "")
        self.assertIn("name: drdoc", metadata.splitlines())
        self.assertIn("origin: ECC", metadata.splitlines())
        self.assertRegex(metadata, r"(?m)^description: \S")
        title, body = document.strip().split("\n", 1)
        self.assertEqual(title, "# DrDoc — The Documentation Doctorer")

        reference = ROOT / "plugins/baton/skills/baton/references/drdoc.md"
        charter = reference.read_text(encoding="utf-8").split("\n# ", 1)[1]
        self.assertEqual(body, charter.strip().split("\n", 1)[1])


if __name__ == "__main__":
    unittest.main()
