# early-prototype

A personal [Claude Code](https://code.claude.com) **plugin marketplace** — a catalog of Thom's prototype skills, installable with one command.

## Install

```bash
# 1. Register this marketplace (once)
/plugin marketplace add earlyprototype/early-prototype

# 2. Install the plugin
/plugin install early-prototype@early-prototype
```

After installing, the skills are available (namespaced under the plugin):

- `/early-prototype:notionstime` — research-programme context
- `/early-prototype:thomtime` — collaboration profile (placeholder, pending rebuild)

## What's inside

```
early-prototype/
├── .claude-plugin/
│   └── marketplace.json         # the catalog (lists plugins)
└── plugins/
    └── early-prototype/         # one plugin, bundling skills
        ├── .claude-plugin/
        │   └── plugin.json      # plugin manifest
        └── skills/
            ├── notionstime/     # a skill = folder with SKILL.md (+ support files)
            └── thomtime/
```

## Adding more skills later

Skills from another machine slot straight in:

1. Copy the skill folder (the one containing `SKILL.md`) into `plugins/early-prototype/skills/`.
2. Bump `version` in `plugins/early-prototype/.claude-plugin/plugin.json` (e.g. `0.1.0` → `0.2.0`) so installers pick up the change.
3. Commit and push.
4. Users refresh with `/plugin marketplace update early-prototype`, then reinstall.

To publish a skill as its *own* separately-installable plugin instead, create a new folder under `plugins/` with its own `.claude-plugin/plugin.json`, and add an entry to the `plugins` array in `.claude-plugin/marketplace.json`.

## Notes

- Skills published inside a plugin are always namespaced as `/plugin-name:skill-name`.
- Plugins can execute code (hooks, scripts, MCP servers). Only install marketplaces you trust.
