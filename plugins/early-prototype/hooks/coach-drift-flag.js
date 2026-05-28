#!/usr/bin/env node
/**
 * Coach Drift Flag - PreToolUse hook (matcher Edit|Write|MultiEdit|NotebookEdit).
 *
 * Flags (does not block) file-editing tool calls during an active coach session.
 * The coach posture is propose-not-execute (Coach-SOP §7 NN#6: never blur the
 * role boundary; coachtime-context Tenet 7: never execute in-line — spawn Opus
 * 4.7 1M MAX subagents). When a coach session is open and an editor tool fires,
 * that is signal — either the coach drifted into dev work, or the user
 * sanctioned the edit. Either way we want it visible, not silent.
 *
 * Trigger condition:
 *   <cwd>/.claude/coach-session-<shortId>.txt exists AND mtime <= 18h old.
 *
 * Per-session marker (added 2026-05-28): the marker is shortId-scoped so two
 * concurrent Claude instances at the same cwd — only the one in coach mode
 * gets flagged. ShortId discovery chain: input.transcript_path → input.session_id
 * → CLAUDE_SESSION_ID env → transcript-glob (~/.claude/projects/<encoded-cwd>/).
 *
 * 18h TTL: stale markers (e.g. a session that ended without /coachout) silently
 * skip. Prevents drift warnings from lingering for days when a marker is
 * forgotten.
 *
 * Behaviour when triggered:
 *   - Emit a one-line warning to stderr naming the tool and target file with
 *     the NN#6 / Tenet 7 reminder.
 *   - Append one JSON line to <cwd>/.claude/coach-drift-log.jsonl (mirrors the
 *     coach-history.jsonl shape: timestamp, tool, target_file, input_summary,
 *     cwd, project, short_id).
 *   - Exit 0 — flag, not block. Friction without prevention so legitimate
 *     coach-config edits still pass.
 *
 * Silent (no warning, no log) when:
 *   - No coach-session-<shortId>.txt for the current session.
 *   - The marker exists but mtime > 18h (stale).
 *   - The tool is not in MATCHED_TOOLS.
 *
 * Per-project: writes to <cwd>/.claude/, never a global path. Always exits 0.
 *
 * Patterns mirrored from ~/.claude/hooks/coach-history-mirror.js (stdin
 * parsing 41-58, summariseInput, exit-0 discipline), coach-intent-capture.js
 * (readFileSafe, getCwd helpers, session_id stdin field), and
 * worker-completion-signal.js (transcript_path → shortId regex extraction).
 */

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const MAX_STDIN = 1024 * 1024;
const STDIN_TIMEOUT_MS = 3000;
const INPUT_SUMMARY_MAX = 500;
const SESSION_MARKER_PREFIX = 'coach-session-';
const SESSION_MARKER_SUFFIX = '.txt';
const DRIFT_LOG = 'coach-drift-log.jsonl';
const TAG = '[Coach-Drift]';
const MATCHED_TOOLS = new Set(['Edit', 'Write', 'MultiEdit', 'NotebookEdit']);
const TTL_MS = 18 * 60 * 60 * 1000; // 18 hours

// ---------- stdin (mirrors coach-history-mirror.js 41-58) ----------
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
  try {
    main();
  } catch (err) {
    console.error(`${TAG} unexpected error: ${err && err.message ? err.message : err}`);
    process.exit(0);
  }
}

// ---------- helpers ----------
function isoTimestamp() {
  return new Date().toISOString();
}

function truncate(str, max) {
  if (typeof str !== 'string') return '';
  return str.length > max ? `${str.slice(0, max)}...` : str;
}

function summariseInput(toolInput) {
  if (toolInput === undefined || toolInput === null) return '';
  let str;
  if (typeof toolInput === 'string') {
    str = toolInput;
  } else {
    try {
      str = JSON.stringify(toolInput);
    } catch (_) {
      str = String(toolInput);
    }
  }
  return truncate(str, INPUT_SUMMARY_MAX);
}

function getCwd(input) {
  return (input && typeof input.cwd === 'string' && input.cwd.length > 0)
    ? input.cwd
    : process.cwd();
}

function extractTargetFile(toolInput) {
  if (!toolInput || typeof toolInput !== 'object') return '';
  const candidate = toolInput.file_path
    || toolInput.notebook_path
    || toolInput.path
    || '';
  return typeof candidate === 'string' ? candidate : '';
}

// Extract a UUID's last 8 hex chars from a path like
// /.../<UUID>.jsonl or any string ending in <UUID> (with or without extension).
const UUID_RE = /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i;
function shortIdFromUuidLike(s) {
  if (typeof s !== 'string' || s.length === 0) return '';
  const m = s.match(UUID_RE);
  if (m) return m[1].slice(-8).toLowerCase();
  // Fallback: if it's already short, just take last 8 if hex-shaped.
  const tail = s.slice(-8);
  return /^[0-9a-f]{8}$/i.test(tail) ? tail.toLowerCase() : '';
}

// Transcript-glob discovery (Worker-PM-System.md §10 method).
// Replace `\`, `/`, `:` with `-` in cwd; find most-recent .jsonl in
// ~/.claude/projects/<encoded>; extract shortId from filename UUID.
function discoverShortIdFromTranscript(cwd) {
  try {
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
    if (!best) return '';
    return shortIdFromUuidLike(best.name);
  } catch (_) {
    return '';
  }
}

// Discovery chain: transcript_path → session_id → CLAUDE_SESSION_ID env → glob.
function deriveShortId(input, cwd) {
  if (input && typeof input.transcript_path === 'string' && input.transcript_path.length > 0) {
    const s = shortIdFromUuidLike(input.transcript_path);
    if (s) return s;
  }
  if (input && typeof input.session_id === 'string' && input.session_id.length > 0) {
    const s = shortIdFromUuidLike(input.session_id);
    if (s) return s;
  }
  if (process.env.CLAUDE_SESSION_ID) {
    const s = shortIdFromUuidLike(process.env.CLAUDE_SESSION_ID);
    if (s) return s;
  }
  return discoverShortIdFromTranscript(cwd) || 'nosessid';
}

// Active coach session = scoped marker exists AND mtime <= TTL old.
function coachSessionActive(cwd, shortId) {
  if (!shortId || shortId === 'nosessid') return false;
  const markerPath = path.join(cwd, '.claude', `${SESSION_MARKER_PREFIX}${shortId}${SESSION_MARKER_SUFFIX}`);
  try {
    const stat = fs.statSync(markerPath);
    if (!stat.isFile()) return false;
    const age = Date.now() - stat.mtimeMs;
    return age <= TTL_MS;
  } catch (_) {
    return false;
  }
}

// ---------- main ----------
function main() {
  let input = {};
  try {
    input = JSON.parse(stdinData || '{}');
  } catch (_) {
    // Malformed stdin: never block. Exit clean.
    process.exit(0);
  }

  const cwd = getCwd(input);
  const shortId = deriveShortId(input, cwd);

  // Silent when no scoped marker or marker is stale — dominant path.
  if (!coachSessionActive(cwd, shortId)) {
    process.exit(0);
  }

  const toolName = input.tool_name || input.tool || 'unknown';

  // Only flag editor tools. Other tools are out of scope for drift signal.
  if (!MATCHED_TOOLS.has(toolName)) {
    process.exit(0);
  }

  const toolInput = input.tool_input || input.input || {};
  const targetFile = extractTargetFile(toolInput);

  const target = targetFile || '(no file path)';
  console.error(
    `${TAG} About to ${toolName} on ${target}. You're in a coach session — coach is meant to discuss and recommend, not edit files. If you meant this, ignore. If not, that's drift.`
  );

  const record = {
    timestamp: isoTimestamp(),
    tool: toolName,
    target_file: targetFile,
    input_summary: summariseInput(toolInput),
    cwd,
    project: path.basename(cwd),
    short_id: shortId
  };

  const claudeDir = path.join(cwd, '.claude');
  const driftPath = path.join(claudeDir, DRIFT_LOG);
  try {
    fs.mkdirSync(claudeDir, { recursive: true });
    fs.appendFileSync(driftPath, `${JSON.stringify(record)}\n`, 'utf8');
  } catch (err) {
    console.error(`${TAG} append failed: ${err.message}`);
  }

  // Flag, not block.
  process.exit(0);
}
