#!/usr/bin/env node
/**
 * Worker Completion Signal - Stop hook for Worker Claude Code sessions.
 *
 * On Stop:
 *   1. Writes a Dev-SOP-§6 handoff to <project>/session-handover-<DATE>.md
 *   2. Writes a short pointer to ~/.claude/inbox/pm/handoff-<DATE>-<SHORT>-<TASKSLUG>.md
 *   3. If <project>/.claude/active-task.txt and <project>/_kanban.md both exist,
 *      moves the named task from ## DOING to ## REVIEW and spawns `kanban-sync`.
 *
 * Three tiers of graceful degradation (see plan, "Failure tiers"):
 *   T1: no .claude/active-task.txt  -> handoffs written, kanban skipped, stderr warn
 *   T2: no _kanban.md               -> handoffs written, kanban skipped, stderr warn
 *   T3: kanban-sync fails / absent  -> handoffs written, local kanban edited, stderr warn
 *
 * Hook NEVER blocks the Stop event. Always exits 0.
 *
 * Patterns mirrored from
 * ~/.claude/plugins/cache/everything-claude-code/.../scripts/hooks/session-end.js:
 *   - stdin parsing (113-134)
 *   - transcript resolution + shortId derivation (181-220)
 *   - idempotent write convention (256-274)
 *
 * See: ~/.claude/plans/actually-move-on-from-that-polished-fog.md (v1 scope only).
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const handoffTemplate = require('./lib/handoff-template');
const kanbanMover = require('./lib/kanban-mover');

const MAX_STDIN = 1024 * 1024;
const STDIN_TIMEOUT_MS = 5000;
const KANBAN_SYNC_TIMEOUT_MS = 20000;
const TAG = '[Worker-Signal]';

// ---------- stdin (mirrors session-end.js 113-134) ----------
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

// Safety: if 'end' never fires (no stdin connected), proceed anyway.
const stdinTimer = setTimeout(() => {
  try { process.stdin.destroy(); } catch (_) { /* ignore */ }
  runMain();
}, STDIN_TIMEOUT_MS);
stdinTimer.unref();

function runMain() {
  if (ran) return;
  ran = true;
  clearTimeout(stdinTimer);
  main().catch(err => {
    console.error(`${TAG} unexpected error: ${err && err.message ? err.message : err}`);
    process.exit(0);
  });
}

// ---------- helpers ----------
function getHomeDir() {
  return process.env.USERPROFILE || process.env.HOME || os.homedir();
}

function dateStr() {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
}

// 5-step discovery chain per DESIGN-GUIDELINES.md §2 (hook side).
// Returns the last-8-hex shortId or 'nosessid' if every source is empty.
function deriveShortId(input, transcriptPath) {
  if (transcriptPath) {
    const m = path.basename(transcriptPath).match(/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.jsonl$/i);
    if (m) return m[1].slice(-8).toLowerCase();
  }
  if (input && typeof input.session_id === 'string' && input.session_id.length >= 8) {
    return input.session_id.slice(-8).toLowerCase();
  }
  const env = process.env.CLAUDE_SESSION_ID;
  if (env && env.length >= 8) return env.slice(-8).toLowerCase();
  // Glob fallback: derive shortId from most-recent transcript in the
  // encoded-cwd projects dir. Last resort before 'nosessid'.
  try {
    const cwd = process.cwd();
    const encoded = cwd.replace(/[\\/:]/g, '-');
    const projDir = path.join(os.homedir(), '.claude', 'projects', encoded);
    const entries = fs.readdirSync(projDir);
    let best = null;
    for (const name of entries) {
      if (!name.endsWith('.jsonl')) continue;
      const full = path.join(projDir, name);
      let mtimeMs = 0;
      try { mtimeMs = fs.statSync(full).mtimeMs; } catch (_) { continue; }
      if (!best || mtimeMs > best.mtimeMs) best = { name, mtimeMs };
    }
    if (best) {
      const m = best.name.match(/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.jsonl$/i);
      if (m) return m[1].slice(-8).toLowerCase();
    }
  } catch (_) { /* fall through */ }
  return 'nosessid';
}

function slugify(s) {
  return (s || 'unknown')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'unknown';
}

function readFileSafe(p) {
  try { return fs.readFileSync(p, 'utf8'); } catch { return null; }
}

function gitBranch(cwd) {
  try {
    const r = spawnSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd, stdio: 'pipe', timeout: 3000 });
    if (r.status === 0) return String(r.stdout).trim() || 'unknown';
  } catch (_) { /* ignore */ }
  return 'unknown';
}

function stripAnsi(s) {
  if (typeof s !== 'string') return '';
  // eslint-disable-next-line no-control-regex
  return s.replace(/\x1b(?:\[[0-9;?]*[A-Za-z]|\][^\x07\x1b]*(?:\x07|\x1b\\)|\([A-Z]|[A-Z])/g, '');
}

function extractSummary(transcriptPath) {
  const content = readFileSafe(transcriptPath);
  if (!content) return null;
  const lines = content.split('\n').filter(Boolean);
  const userMessages = [];
  const toolsUsed = new Set();
  const filesModified = new Set();

  for (const line of lines) {
    try {
      const e = JSON.parse(line);
      if (e.type === 'user' || e.role === 'user' || (e.message && e.message.role === 'user')) {
        const raw = (e.message && e.message.content) || e.content;
        const text = typeof raw === 'string' ? raw :
          Array.isArray(raw) ? raw.map(c => (c && c.text) || '').join(' ') : '';
        const cleaned = stripAnsi(text).trim();
        if (cleaned) userMessages.push(cleaned.slice(0, 200));
      }
      if (e.type === 'tool_use' || e.tool_name) {
        const t = e.tool_name || e.name || '';
        if (t) toolsUsed.add(t);
        const fp = (e.tool_input && e.tool_input.file_path) || (e.input && e.input.file_path) || '';
        if (fp && (t === 'Edit' || t === 'Write')) filesModified.add(fp);
      }
      if (e.type === 'assistant' && e.message && Array.isArray(e.message.content)) {
        for (const b of e.message.content) {
          if (b.type === 'tool_use') {
            const t = b.name || '';
            if (t) toolsUsed.add(t);
            const fp = (b.input && b.input.file_path) || '';
            if (fp && (t === 'Edit' || t === 'Write')) filesModified.add(fp);
          }
        }
      }
    } catch { /* skip unparseable */ }
  }
  return {
    userMessages: userMessages.slice(-10),
    toolsUsed: Array.from(toolsUsed).slice(0, 20),
    filesModified: Array.from(filesModified).slice(0, 30)
  };
}

// ---------- main ----------
async function main() {
  // Parse stdin JSON for use by both transcript-path resolution and the
  // shortId discovery chain (input.session_id is one of the fallback sources).
  let input = {};
  try {
    input = JSON.parse(stdinData || '{}');
  } catch { /* malformed stdin, keep input as {} */ }

  let transcriptPath = null;
  if (typeof input.transcript_path === 'string' && input.transcript_path.length > 0) {
    transcriptPath = input.transcript_path;
  }
  if (!transcriptPath && process.env.CLAUDE_TRANSCRIPT_PATH) {
    transcriptPath = process.env.CLAUDE_TRANSCRIPT_PATH;
  }

  const cwd = process.cwd();

  // Derive shortId early — needed to construct the scoped marker filename.
  // Discovery chain: input.transcript_path → input.session_id → CLAUDE_SESSION_ID env → glob → 'nosessid'.
  const shortId = deriveShortId(input, transcriptPath);

  // Worker-session marker. Per the 2026-05-28 marker-convention change, the
  // primary path is the shortId-scoped `.claude/active-task-<shortId>.txt`.
  // Legacy unscoped `.claude/active-task.txt` is checked as a fallback so
  // pre-migration projects keep working. Without either, this is general
  // chat or a non-Worker project — exit silently.
  const scopedActiveTaskPath = path.join(cwd, '.claude', `active-task-${shortId}.txt`);
  const legacyActiveTaskPath = path.join(cwd, '.claude', 'active-task.txt');
  let activeTaskRaw = readFileSafe(scopedActiveTaskPath);
  let usingScopedMarker = !!activeTaskRaw;
  if (!activeTaskRaw) {
    activeTaskRaw = readFileSafe(legacyActiveTaskPath);
  }
  const taskTitle = activeTaskRaw ? activeTaskRaw.split('\n')[0].trim() : null;
  if (!taskTitle) {
    console.error(`${TAG} no active-task marker (scoped or legacy); not a Worker session, exiting silently`);
    process.exit(0);
  }

  // Session-id gate. Only applies when we resolved via the LEGACY marker —
  // the scoped marker is self-attributing (its filename embeds this session's
  // shortId, so it can only be present if THIS session wrote it via /worktime).
  // Skipping the gate for scoped markers eliminates a redundant check; keeping
  // it for legacy markers preserves the 2026-05-20 split-session inbox-doubling
  // fix for pre-migration projects.
  if (!usingScopedMarker) {
    const workerSessionIdPath = path.join(cwd, '.claude', 'worker-session-id.txt');
    const workerSessionIdRaw = readFileSafe(workerSessionIdPath);
    if (workerSessionIdRaw) {
      const recordedUuid = workerSessionIdRaw.trim();
      const uuidMatch = transcriptPath
        ? path.basename(transcriptPath).match(/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.jsonl$/i)
        : null;
      const currentSessionUuid = uuidMatch ? uuidMatch[1].toLowerCase() : null;
      if (recordedUuid && currentSessionUuid && recordedUuid.toLowerCase() !== currentSessionUuid) {
        console.error(`${TAG} session ${currentSessionUuid} is not the Worker session (recorded: ${recordedUuid}); exiting silently`);
        process.exit(0);
      }
      // If we can't derive the current session's UUID (transcript missing,
      // older Claude Code, etc.), fail-open — fire anyway. Better to over-
      // signal than to silently drop legitimate Worker handoffs.
    }
  }

  const date = dateStr();
  const project = path.basename(cwd);
  const branch = gitBranch(cwd);
  const summary = transcriptPath && fs.existsSync(transcriptPath) ? extractSummary(transcriptPath) : null;

  const kanbanPath = path.join(cwd, '_kanban.md');
  let kanbanResult;
  if (!fs.existsSync(kanbanPath)) {
    kanbanResult = { moved: false, reason: 'no _kanban.md', kanbanPath };
    console.error(`${TAG} no _kanban.md in cwd, skipping kanban`);
  } else {
    try {
      kanbanResult = kanbanMover.moveTaskInFile(kanbanPath, taskTitle);
      if (!kanbanResult.moved) {
        console.error(`${TAG} kanban no-op: ${kanbanResult.reason}`);
      }
    } catch (err) {
      kanbanResult = { moved: false, reason: `move failed: ${err.message}`, kanbanPath };
      console.error(`${TAG} kanban move failed: ${err.message}`);
    }
  }

  // Compute output paths. Canonical handoff filename includes the task
  // slug so multiple `/worktime -> /clocktime` cycles in the same day on
  // the same project don't overwrite each other's records.
  const taskSlug = slugify(taskTitle || project);
  const projectHandoffPath = path.join(cwd, `session-handover-${date}-${taskSlug}.md`);
  const inboxDir = path.join(cwd, '.claude', 'inbox', 'pm');
  const inboxPath = path.join(inboxDir, `handoff-${date}-${shortId}-${taskSlug}.md`);

  const metadata = { taskTitle, sessionShortId: shortId, date, project, branch, worktree: cwd, kanbanResult };

  // Write handoffs unconditionally (never gated on kanban result).
  try {
    fs.writeFileSync(projectHandoffPath, handoffTemplate.renderProjectHandoff(summary, metadata), 'utf8');
  } catch (err) {
    console.error(`${TAG} project handoff write failed: ${err.message}`);
  }
  try {
    fs.mkdirSync(inboxDir, { recursive: true });
    fs.writeFileSync(inboxPath, handoffTemplate.renderInboxPointer(summary, metadata, projectHandoffPath), 'utf8');
  } catch (err) {
    console.error(`${TAG} inbox pointer write failed: ${err.message}`);
  }

  // Tier 3: push to GitHub via kanban-sync, only when we actually moved something
  // locally. Captured stdio prevents auth-header leakage if kanban-sync ever
  // logs request internals.
  if (kanbanResult.moved) {
    try {
      const r = spawnSync('kanban-sync', [kanbanPath], {
        cwd,
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout: KANBAN_SYNC_TIMEOUT_MS,
        shell: process.platform === 'win32'
      });
      if (r.status === 0) {
        console.error(`${TAG} kanban-sync ok`);
      } else {
        console.error(`${TAG} kanban-sync exit=${r.status}; handoff at ${projectHandoffPath}`);
      }
    } catch (err) {
      console.error(`${TAG} kanban-sync spawn failed: ${err.message}; handoff at ${projectHandoffPath}`);
    }
  }

  process.exit(0);
}
