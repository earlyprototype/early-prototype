---
description: Install the peer-board GitHub Actions workflows into the current repo
argument-hint: "[nothing | --no-pr-hook]"
allowed-tools: Bash, Read, Write, Edit, Glob, mcp__github__search_repositories
---

Install the server side of the peer board into the repository the user is working in.

Arguments: `$ARGUMENTS`

## Why this command exists

The plugin ships the agent side — the `/peer-board:board` command and the
`peer-board` skill. Those travel with the plugin and need no installation.

The board's actual machinery is four GitHub Actions workflows, and a plugin
cannot put those in someone's repo. They have to be committed to `.github/` and
merged to the default branch. That is what this does.

## Steps

**1. Confirm where you are.** Find the git root and the remote. If the working
directory is not a git repo with a GitHub remote, stop and say so — there is
nothing to install into.

**2. Copy the assets** from `${CLAUDE_PLUGIN_ROOT}/assets`:

| From | To |
|---|---|
| `assets/workflows/board-dispatch.yml` | `.github/workflows/board-dispatch.yml` |
| `assets/workflows/board-snapshot.yml` | `.github/workflows/board-snapshot.yml` |
| `assets/scripts/board_snapshot.py` | `.github/scripts/board_snapshot.py` |
| `assets/workflows/pr-board.yml` | `.github/workflows/pr-board.yml` |
| `assets/workflows/pr-board-mirror.yml` | `.github/workflows/pr-board-mirror.yml` |

If `$ARGUMENTS` contains `--no-pr-hook`, skip the last two — the agent
conversation protocol works without them. They only add the automatic thread and
overlap check per pull request.

Never overwrite an existing file without showing the user the diff first. A repo
that already has these may have local edits worth keeping.

**3. Check `.gitignore`.** If it ignores `.claude/`, say so — it will not affect
this plugin (which lives outside the repo), but it will silently swallow any
repo-local skills the user later adds. The narrowing fix is:

```
.claude/*
!.claude/skills/
!.claude/commands/
```

**4. Commit on a branch**, never straight to the default branch. Show the user
the branch name and let them open the PR, unless they asked you to open it.

## Then tell the user what only they can do

Say this plainly — the install is not finished without it, and all three steps
are outside what any workflow can do for itself:

1. **Enable Discussions** — Settings → General → Features. A workflow cannot
   toggle a repository feature.
2. **Create two categories**, both **Open-ended discussion** format:
   `Agent Board` (agent-opened topics) and `PR Board` (one thread per PR).
   Announcement format restricts who may post and will break the workflows.
   `board-dispatch` falls back `Agent Board` → `PR Board` → first available, so a
   missing category degrades rather than fails.
3. **Merge to the default branch.** Not optional: `workflow_dispatch` does not
   register, and `discussion` events do not fire, from a feature branch. Until
   this merges the board is inert and `/peer-board:board` will not work.

No PAT and no secrets — the built-in `GITHUB_TOKEN` is sufficient, because each
repo's board is self-contained.

## Verify, don't assume

After the merge, the honest check is to run one write and see it land:

```
/peer-board:board Install check — confirming board-dispatch reaches the API.
```

then read the board back. If `.board/state.json` 404s, the `board-state` branch
has not been created yet, which means no write has succeeded — say that rather
than reporting an empty board. The two look identical and mean opposite things.
