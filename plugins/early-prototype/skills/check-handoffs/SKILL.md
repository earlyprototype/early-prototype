---
name: check-handoffs
description: |
  Manually surface unread Worker handoffs from this project's
  <cwd>/.claude/inbox/pm/. Use when the user is in a PM session and wants
  to see what Worker sessions have finished, or asks to "check the inbox",
  "any handoffs", "what's waiting from worker", or "/check-handoffs". This
  is the manual fallback for the SessionStart auto-discovery hook
  (pm-handoff-discovery.js); both produce the same listing. The inbox is
  per-project — each project's handoffs live in its own `.claude/inbox/pm/`.
  Each handoff is a pointer file written by the Stop hook
  worker-completion-signal.js; the canonical §6 handoff lives in the
  Worker's project folder alongside it.
---

# Check Handoffs

Surface up to 6 most-recent unread handoffs from `<cwd>/.claude/inbox/pm/` and
present them inline. Mirror of what the `pm-handoff-discovery.js`
SessionStart hook auto-injects at PM-session-start, but invokable on demand
when the PM wants to re-check the inbox mid-session. The inbox is per-project
— if you've switched cwd, the listing reflects the current project's inbox only.

## How

The hook script does all the scanning, filtering, and rendering. The skill
shells out to it and presents the rendered text.

1. Run the discovery script. Redirect stdin so the script exits
   promptly instead of waiting on its 3s stdin timeout:

   ```
   node "C:\Users\Fab2\.claude\hooks\pm-handoff-discovery.js" < /dev/null
   ```

   `/dev/null` is the right answer regardless of host OS, because the
   Claude Code Bash tool runs git-bash / POSIX bash everywhere — including
   on Windows. Don't use `< NUL` (cmd.exe only) even when on Windows; the
   Bash tool isn't cmd and will fail with "NUL: No such file or directory".

2. The script writes a SessionStart JSON envelope to stdout:

   ```json
   { "hookSpecificOutput": { "hookEventName": "SessionStart",
                             "additionalContext": "<rendered listing>" } }
   ```

   Parse the `additionalContext` field and present it to the user as a
   markdown listing.

3. If the script fails or returns empty context, fall back to a direct
   inline scan:
   - `Glob("<cwd>/.claude/inbox/pm/handoff-*.md")` (use the absolute cwd
     path; do NOT use `~` — the Windows Glob ENAMETOOLONG skill warns
     against globbing into `.claude` paths from `~`)
   - Read each match. Skip files containing a line that matches
     `<!-- PM:READ:YYYY-MM-DD -->` (the marker convention).
   - Sort by file mtime descending; take top 6.
   - From each file, pull the four header lines: `Active task`, `Project`,
     `Status`, `Canonical handoff`. Present in the same shape as the hook.

## PM:READ marker convention

The PM acknowledges a handoff by adding a single line to the pointer file:

```
<!-- PM:READ:YYYY-MM-DD -->
```

The discovery script and this skill both skip any file containing that
marker. Adding it is a manual edit in v2 (a future `/mark-read` skill could
automate it — that's v3 territory, not in scope here).

## What to surface to the user

Present the listing exactly as the script renders it. Don't reformat or
infer extra context — the canonical §6 handoff in the Worker's project
folder is the source of truth for any subjective sections. If the user
asks to "open" a handoff, read the file at the `Canonical handoff:` path
from the pointer.

## Out of scope

- Modifying inbox files (mark-read is a manual step in v2).
- Modifying handoffs in the Worker's project folder.
- Patching kanbanger-partymix or anything outside `<cwd>/.claude/inbox/pm/` and
  the project handoffs the pointers reference.

## Related

- Front-door doc: `C:\Users\Fab2\Desktop\AI\EverythingCC\_teamtime\Worker-PM-System.md`
- Stop hook (the writer): `C:\Users\Fab2\.claude\hooks\worker-completion-signal.js`
- Inbox folder: `<cwd>/.claude/inbox/pm/` (per-project; one folder per project root)
- Historical briefs (do not use as templates): `C:\Users\Fab2\Desktop\AI\EverythingCC\_teamtime\archive\`
