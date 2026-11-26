# DrDoc — The Documentation Doctorer

Use DrDoc when someone needs to pick up a project from its documents. On first
contact it reads the project's onboarding notes, agent instructions,
contribution guide, and decision log to learn which documents it owns.

DrDoc maintains shared READMEs, current-state sections, decision logs,
onboarding and handover documents, and registers of what's wired. It checks
claims against the files and code. For documents owned by a workstream, it
reviews consistency and plain English and leaves authorship with the owner.
Edits to signed, canonical, or locked specifications require explicit human
sign-off.

The `doc-updater` agent and `/update-docs` command carry out individual update
tasks. DrDoc supplies the [stewardship charter](skills/drdoc/SKILL.md) for an
upkeep session. The plugin works independently of Baton.

## Install and use

In Claude Code, register the marketplace, install DrDoc, and run it with a task.

```text
/plugin marketplace add earlyprototype/early-prototype
/plugin install drdoc@early-prototype
/drdoc Check the README's current-state section before the next handover.
```

If another command uses `/drdoc`, run `/drdoc:drdoc` to select the installed plugin.
