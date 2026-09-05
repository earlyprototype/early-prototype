---
name: graphtime
description: Enable, inspect, or disable persistent Project Knowledge Map context for the current Codex project when the user invokes /graphtime, /graphtime:graphtime, $graphtime, or $graphtime:graphtime. Do not activate other projects implicitly.
---

Enable the Project Knowledge Map for the user's current project folder. `/graphtime off` disables it; `/graphtime status` inspects the opt-in. The activation adapter targets Codex.

Use the existing `core/map_activation.py` helper in the user's Knowledge Graph Kit checkout. Locate that checkout from session context or an existing sibling `knowledge-graph-kit` directory, and resolve the helper's absolute path. Do not recreate its registration logic or copy the toolkit into the target project.

Resolve an available Python 3 command (`python3`, `python`, or Windows `py -3`) and check its version before running the helper. Use that command for every helper call; do not assume the `python` alias exists.

Run the helper from the current session's chosen workspace folder, substituting the verified Python command and actual helper path:

```text
python3 "/absolute/path/to/knowledge-graph-kit/core/map_activation.py" enable
```

Map `off` or `disable` to `disable`, and `status` to `status`. The helper reuses the nearest saved project root, stopping at a separate Git repository. For a first opt-in it uses that exact working folder. If the user or current session explicitly identifies a chosen project root, pass its absolute path with `--root <folder>` before the command, including when that folder is inside an activated parent project. Preserve a deliberate subproject root; never replace it with `git rev-parse --show-toplevel`. Do not ask for a path already identified by the session.

Read the returned JSON and report the selected root and opt-in state briefly. Configuration persists across restarts. It merges one project hook, keeps `.project-map/` local, and does not change hook trust. A disabled subproject remains a boundary against its parent hook.

After enabling, say that Codex may still require the user to enable and trust this project hook through `/hooks`. That platform step belongs to the user; never edit trust state or use a trust-bypass flag. Successful adapter output alone does not prove that Codex injected context into a fresh session.

If the helper is missing, locate the user's existing Knowledge Graph Kit checkout before changing files. This plugin does not bundle the toolkit; a checkout containing `core/map_activation.py` is required. Ask for its location only if it cannot be found from available context. If activation fails, report its specific error; do not change unrelated hooks or ask for a root already supplied by the current workspace.
