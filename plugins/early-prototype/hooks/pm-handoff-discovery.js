#!/usr/bin/env node
/**
 * PM Handoff Discovery - SessionStart hook for PM Claude Code sessions.
 *
 * On SessionStart:
 *   1. Scans <cwd>/.claude/inbox/pm/ for handoff-*.md pointers (written by the
 *      worker-completion-signal.js Stop hook). Per-project inbox: each project's
 *      Worker handoffs live in its own `.claude/inbox/pm/` so PM in projectA
 *      doesn't see noise from projectB.
 *   2. Excludes any file containing a PM:READ:<date> marker (manual ack).
 *   3. Sorts by mtime descending, takes the top 6.
 *   4. Renders a compact additionalContext block summarising each handoff
 *      (Active task, Project, Status, Canonical handoff path).
 *   5. Emits the SessionStart payload to stdout:
 *        {"hookSpecificOutput": {"hookEventName": "SessionStart",
 *                                "additionalContext": "..."}}
 *
 * Hook NEVER blocks SessionStart. Always exits 0. If cwd has no
 * .claude/inbox/pm/ folder, the empty-context payload is emitted (no error).
 *
 * Patterns mirrored from
 *   ~/.claude/plugins/cache/.../scripts/hooks/session-start.js (lines 639-671:
 *   the hookSpecificOutput stdout convention)
 *   ~/.claude/hooks/worker-completion-signal.js (stdin parsing, error/exit).
 *
 * Marker convention (matches v2 brief):
 *   <!-- PM:READ:YYYY-MM-DD -->     (case-sensitive, may have leading/trailing whitespace on line)
 *
 * See: C:\Users\Fab2\Desktop\AI\EverythingCC\_teamtime\Worker-PM-System.md (front-door doc)
 * Historical briefs (archived): C:\Users\Fab2\Desktop\AI\EverythingCC\_teamtime\archive\
 */

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const MAX_STDIN = 1024 * 1024;
const STDIN_TIMEOUT_MS = 3000;
const MAX_HANDOFFS = 6;
const TAG = '[PM-Handoff-Discovery]';
const HANDOFF_FILENAME_RE = /^handoff-\d{4}-\d{2}-\d{2}-[0-9a-f]{8}-.*\.md$/i;
// Marker accepts both legacy form `<!-- PM:READ:YYYY-MM-DD -->` and the
// shortId-attributed form `<!-- PM:READ:YYYY-MM-DD pm:XXXXXXXX -->`.
// shortId is 8 lowercase hex chars (last-8 of the PM session UUID).
const PM_READ_LINE_RE = /^\s*<!--\s*PM:READ:\d{4}-\d{2}-\d{2}(?:\s+pm:[0-9a-f]{8})?\s*-->\s*$/m;

// ---------- stdin (mirrors worker-completion-signal.js 41-58) ----------
let stdinData = '';
let ran = false;

process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => {
  if (stdinData.length < MAX_STDIN) {
    stdinData += chunk.substring(0, MAX_STDIN - stdinData.length);
  }
});
process.stdin.on('end', () => runMain());
process.stdin.on('error', () => runMain());

const stdinTimer = setTimeout(() => {
  try { process.stdin.destroy(); } catch (_) { /* ignore */ }
  runMain();
}, STDIN_TIMEOUT_MS);
stdinTimer.unref();

function runMain() {
  if (ran) return;
  ran = true;
  clearTimeout(stdinTimer);
  try {
    main();
  } catch (err) {
    console.error(`${TAG} unexpected error: ${err && err.message ? err.message : err}`);
    emitEmptyContextAndExit();
  }
}

// ---------- helpers ----------
function getHomeDir() {
  return process.env.USERPROFILE || process.env.HOME || os.homedir();
}

function getInboxDir() {
  // Per-project inbox: cwd of the SessionStart hook is the session's project root
  // (inherited from the parent Claude Code process). Each project's Worker
  // handoffs land in its own <project>/.claude/inbox/pm/ — no cross-project noise.
  return path.join(process.cwd(), '.claude', 'inbox', 'pm');
}

function listHandoffs(inboxDir) {
  let entries;
  try {
    entries = fs.readdirSync(inboxDir);
  } catch (_) {
    return [];
  }

  const results = [];
  for (const name of entries) {
    if (!HANDOFF_FILENAME_RE.test(name)) continue;
    const full = path.join(inboxDir, name);
    let stat;
    try {
      stat = fs.statSync(full);
    } catch (_) {
      continue;
    }
    if (!stat.isFile()) continue;
    results.push({ name, path: full, mtime: stat.mtimeMs });
  }
  return results;
}

function isMarkedRead(content) {
  return PM_READ_LINE_RE.test(content);
}

function extractField(content, label) {
  // Match `- **Label:** value` (the canonical inbox-pointer shape).
  const re = new RegExp(`^-\\s*\\*\\*${label}:\\*\\*\\s*(.+?)\\s*$`, 'm');
  const m = content.match(re);
  return m ? m[1].trim() : '';
}

function summariseHandoff(entry, content) {
  // Pull the four pointer-header fields. Path is wrapped in backticks in the source.
  const taskTitle = extractField(content, 'Active task') || '[unknown]';
  const project = extractField(content, 'Project') || '[unknown]';
  const status = extractField(content, 'Status') || '[unknown]';
  const canonicalRaw = extractField(content, 'Canonical handoff') || '';
  const canonical = canonicalRaw.replace(/^`|`$/g, '').trim();

  // Date + shortId + slug fall out of the filename per v1's convention.
  // handoff-<YYYY-MM-DD>-<SHORTID>-<TASKSLUG>.md
  const nameMatch = entry.name.match(/^handoff-(\d{4}-\d{2}-\d{2})-([0-9a-f]{8})-(.+)\.md$/i);
  const date = nameMatch ? nameMatch[1] : '';
  const shortId = nameMatch ? nameMatch[2] : '';
  const taskSlug = nameMatch ? nameMatch[3] : '';

  return { entry, date, shortId, taskSlug, taskTitle, project, status, canonical };
}

function renderContext(summaries) {
  if (summaries.length === 0) {
    return [
      'PM inbox: no unread handoffs.',
      '',
      'Acknowledge handoffs by adding `<!-- PM:READ:YYYY-MM-DD -->` on its own line in the file.',
      `Inbox folder: ${getInboxDir()}`
    ].join('\n');
  }

  const header = [
    `PM inbox: ${summaries.length} unread Worker handoff${summaries.length === 1 ? '' : 's'} (most recent first, max ${MAX_HANDOFFS}).`,
    'Each entry below is a pointer; open the canonical handoff path for full §6 sections.',
    'Mark an entry read by adding `<!-- PM:READ:YYYY-MM-DD -->` on its own line in the source file.',
    ''
  ];

  const blocks = summaries.map((s, i) => {
    const heading = `## ${i + 1}. ${s.date} ${s.shortId} - ${s.project}`;
    return [
      heading,
      `- Active task: ${s.taskTitle}`,
      `- Project: ${s.project}`,
      `- Status: ${s.status}`,
      `- Canonical handoff: ${s.canonical || '[missing in pointer]'}`,
      `- Pointer file: ${s.entry.path}`
    ].join('\n');
  });

  return header.concat(blocks).join('\n');
}

function emitPayload(additionalContext) {
  const payload = JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'SessionStart',
      additionalContext
    }
  });
  process.stdout.write(payload);
  process.exit(0);
}

function emitEmptyContextAndExit() {
  try {
    emitPayload('');
  } catch (_) {
    process.exit(0);
  }
}

// ---------- main ----------
function main() {
  // We accept (but don't currently use) the SessionStart stdin envelope; v1
  // pattern is to be tolerant of malformed/missing stdin. We never block.
  try { JSON.parse(stdinData || '{}'); } catch (_) { /* ignore */ }

  const inboxDir = getInboxDir();
  const all = listHandoffs(inboxDir);
  if (all.length === 0) {
    return emitPayload(renderContext([]));
  }

  // Filter unread, sort by mtime desc, slice top N.
  const unread = [];
  for (const entry of all) {
    let content;
    try {
      content = fs.readFileSync(entry.path, 'utf8');
    } catch (_) {
      continue;
    }
    if (isMarkedRead(content)) continue;
    unread.push(summariseHandoff(entry, content));
  }

  unread.sort((a, b) => b.entry.mtime - a.entry.mtime);
  const top = unread.slice(0, MAX_HANDOFFS);

  console.error(`${TAG} surfaced ${top.length} of ${unread.length} unread handoff(s) from ${inboxDir}`);
  emitPayload(renderContext(top));
}
