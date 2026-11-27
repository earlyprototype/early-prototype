#!/usr/bin/env node
/**
 * PM Handoff Discovery - SessionStart hook for PM Claude Code sessions.
 *
 * Records the session's shortId for the lifecycle skills before checking the inbox.
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
 * See: ~/Desktop/AI/EverythingCC/_teamtime/Worker-PM-System.md (front-door doc)
 * Historical briefs (archived): ~/Desktop/AI/EverythingCC/_teamtime/archive/
 */

'use strict';

const fs = require('fs');
const path = require('path');

const MAX_STDIN = 1024 * 1024;
const STDIN_TIMEOUT_MS = 3000;
const MAX_HANDOFFS = 6;
const TAG = '[PM-Handoff-Discovery]';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
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
function writeSessionMarker(input, cwd) {
  const transcript = typeof input.transcript_path === 'string'
    ? path.win32.basename(input.transcript_path) : '';
  const transcriptId = transcript.endsWith('.jsonl') ? transcript.slice(0, -6) : null;
  const uuid = [input.session_id, transcriptId, process.env.CLAUDE_SESSION_ID]
    .find(id => typeof id === 'string' && UUID_RE.test(id));
  if (!uuid) return;

  // Claude Code expands ${CLAUDE_SESSION_ID} in each skill to this filename's UUID.
  const dir = path.join(cwd, '.claude');
  const marker = path.join(dir, `session-id-${uuid}.txt`);
  const shortId = uuid.slice(-8).toLowerCase();
  try {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(marker, shortId + '\n', { flag: 'wx' });
  } catch (err) {
    // A resumed session already has its marker.
    if (err.code !== 'EEXIST') console.error(`${TAG} session marker write failed: ${err.message}`);
  }
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

function renderContext(summaries, inboxDir) {
  if (summaries.length === 0) {
    return [
      'PM inbox: no unread handoffs.',
      '',
      'Acknowledge handoffs by adding `<!-- PM:READ:YYYY-MM-DD -->` on its own line in the file.',
      `Inbox folder: ${inboxDir}`
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
  let input;
  try { input = JSON.parse(stdinData); } catch (_) { /* Manual inbox checks have no payload. */ }
  const cwd = typeof input?.cwd === 'string' && input.cwd ? input.cwd : process.cwd();
  if (input) writeSessionMarker(input, cwd);

  const inboxDir = path.join(cwd, '.claude', 'inbox', 'pm');
  const all = listHandoffs(inboxDir);
  if (all.length === 0) {
    return emitPayload(renderContext([], inboxDir));
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
  emitPayload(renderContext(top, inboxDir));
}
