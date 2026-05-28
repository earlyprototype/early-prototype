#!/usr/bin/env node
/**
 * Coach Intent Capture + Parrot.
 *
 * Two hook modes in one script (selected by CLI arg "prompt" | "start"):
 *
 *   prompt  (UserPromptSubmit) — If no intent is recorded for THIS session yet,
 *           writes the first user message of the session as the intent to
 *           <cwd>/.claude/coach-intent.txt (timestamped, session-tagged). A hook
 *           can't hold a conversation, so "what are you about to do this session?"
 *           is answered by capturing the session's first prompt. Subsequent
 *           prompts in the same session are ignored (intent already recorded).
 *
 *   start   (SessionStart) — Reads the PRIOR intent back and surfaces it via the
 *           SessionStart additionalContext channel ("last time you said you were
 *           doing X"), and injects the "What are you about to do this session?"
 *           prompt so the next user message becomes this session's intent.
 *
 * Session identity is derived from the transcript filename UUID (fallback:
 * CLAUDE_SESSION_ID, then session_id from stdin). A per-session sentinel line in
 * coach-intent.txt ("<!-- session:<uuid> -->") makes "first message of THIS
 * session" idempotent across multiple UserPromptSubmit fires.
 *
 * Per-project: <cwd>/.claude/, never a global path. Exits 0 always, never blocks.
 *
 * Patterns mirrored from:
 *   ~/.claude/hooks/worker-completion-signal.js  (stdin parsing, shortId/UUID
 *     derivation 80-88, readFileSafe, exit-0 discipline)
 *   ~/.claude/hooks/pm-handoff-discovery.js       (SessionStart hookSpecificOutput
 *     additionalContext stdout convention 177-186)
 */

'use strict';

const fs = require('fs');
const path = require('path');

const MAX_STDIN = 1024 * 1024;
const STDIN_TIMEOUT_MS = 3000;
const INTENT_FILENAME = 'coach-intent.txt';
const INTENT_TEXT_MAX = 1000;
const TAG = '[Coach-Intent]';
const START_PROMPT = 'What are you about to do this session?';

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
    // For SessionStart we still want a clean (empty) payload; for prompt mode a
    // bare exit is fine. emitForMode handles both safely.
    safeExit(getMode(), '');
  }
}

// ---------- helpers ----------
function getMode() {
  const arg = (process.argv[2] || '').toLowerCase();
  return arg === 'start' ? 'start' : 'prompt';
}

function isoTimestamp() {
  return new Date().toISOString();
}

function readFileSafe(p) {
  try { return fs.readFileSync(p, 'utf8'); } catch { return null; }
}

// Session UUID: transcript filename first (most reliable across fires), then
// env, then stdin session_id. Mirrors worker-completion-signal.js deriveShortId.
function deriveSessionId(input) {
  const transcriptPath = (input && typeof input.transcript_path === 'string')
    ? input.transcript_path
    : process.env.CLAUDE_TRANSCRIPT_PATH;
  if (transcriptPath) {
    const m = path.basename(transcriptPath).match(/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.jsonl$/i);
    if (m) return m[1].toLowerCase();
  }
  if (process.env.CLAUDE_SESSION_ID && process.env.CLAUDE_SESSION_ID.trim()) {
    return process.env.CLAUDE_SESSION_ID.trim().toLowerCase();
  }
  if (input && typeof input.session_id === 'string' && input.session_id.trim()) {
    return input.session_id.trim().toLowerCase();
  }
  return 'nosessid';
}

function sessionSentinel(sessionId) {
  return `<!-- session:${sessionId} -->`;
}

function getCwd(input) {
  return (input && typeof input.cwd === 'string' && input.cwd.length > 0)
    ? input.cwd
    : process.cwd();
}

function extractPromptText(input) {
  // UserPromptSubmit envelope: the user's message is in `prompt`. Be liberal
  // about field names in case the envelope shape differs.
  const raw = (typeof input.prompt === 'string' && input.prompt)
    || (typeof input.user_prompt === 'string' && input.user_prompt)
    || (typeof input.message === 'string' && input.message)
    || '';
  return raw.replace(/\s+/g, ' ').trim();
}

function safeExit(mode, additionalContext) {
  if (mode === 'start') {
    try {
      process.stdout.write(JSON.stringify({
        hookSpecificOutput: {
          hookEventName: 'SessionStart',
          additionalContext: additionalContext || ''
        }
      }));
    } catch (_) { /* ignore */ }
  }
  process.exit(0);
}

// Pull the most recent recorded intent (text + its timestamp) from the file,
// skipping the sentinel/comment lines. Returns null if none.
function readLastIntent(content) {
  if (!content) return null;
  const lines = content.split('\n').map(l => l.trim()).filter(Boolean);
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i];
    if (line.startsWith('<!--')) continue;
    // Stored shape: "<ISO timestamp>\t<intent text>"
    const tab = line.indexOf('\t');
    if (tab > 0) {
      return { timestamp: line.slice(0, tab), text: line.slice(tab + 1) };
    }
    return { timestamp: '', text: line };
  }
  return null;
}

// ---------- mode: prompt (UserPromptSubmit) ----------
function runPromptMode(input) {
  const cwd = getCwd(input);
  const sessionId = deriveSessionId(input);
  const claudeDir = path.join(cwd, '.claude');
  const intentPath = path.join(claudeDir, INTENT_FILENAME);
  const sentinel = sessionSentinel(sessionId);

  const existing = readFileSafe(intentPath) || '';
  // Intent already captured for THIS session -> do nothing (only the FIRST
  // user message of the session becomes the intent).
  if (sessionId !== 'nosessid' && existing.includes(sentinel)) {
    process.exit(0);
  }

  const promptText = extractPromptText(input);
  if (!promptText) {
    // Nothing to record (e.g. empty / non-text prompt). Never block.
    process.exit(0);
  }

  // Append: sentinel line + "<timestamp>\t<intent>". Append (not overwrite) so
  // prior sessions' stated intents remain as history; readLastIntent() always
  // surfaces the most recent one.
  const block = `${sentinel}\n${isoTimestamp()}\t${promptText.slice(0, INTENT_TEXT_MAX)}\n`;
  try {
    fs.mkdirSync(claudeDir, { recursive: true });
    fs.appendFileSync(intentPath, block, 'utf8');
  } catch (err) {
    console.error(`${TAG} intent write failed: ${err.message}`);
  }

  process.exit(0);
}

// ---------- mode: start (SessionStart) ----------
function runStartMode(input) {
  const cwd = getCwd(input);
  const intentPath = path.join(cwd, '.claude', INTENT_FILENAME);
  const last = readLastIntent(readFileSafe(intentPath));

  const lines = [];
  if (last && last.text) {
    const when = last.timestamp ? ` (${last.timestamp})` : '';
    lines.push(`Coach intent — last time${when} you said you were doing:`);
    lines.push(`  "${last.text}"`);
    lines.push('');
  }
  lines.push(START_PROMPT);
  lines.push('(Your first message this session is captured as this session\'s intent.)');

  safeExit('start', lines.join('\n'));
}

// ---------- main ----------
function main() {
  const mode = getMode();
  let input = {};
  try {
    input = JSON.parse(stdinData || '{}');
  } catch (_) {
    return safeExit(mode, mode === 'start' ? START_PROMPT : '');
  }

  if (mode === 'start') {
    return runStartMode(input);
  }
  return runPromptMode(input);
}
