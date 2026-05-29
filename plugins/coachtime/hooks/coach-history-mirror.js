#!/usr/bin/env node
/**
 * Coach History Mirror - PostToolUse hook (matcher "*").
 *
 * Permanent, Thom-controlled deployment record. continuous-learning-v2 already
 * logs every tool/skill to ~/.claude/homunculus/projects/<id>/observations.jsonl,
 * but that file auto-purges (~30 days) and rotates at 10 MB. This hook mirrors
 * the same capture into a file that NEVER auto-purges:
 *
 *   <cwd>/.claude/coach-history.jsonl
 *
 * On each fire it appends ONE JSON line:
 *   { timestamp, tool, skill?, input_summary, cwd, project }
 *
 * - skill is set only when the tool is a Skill / slash-command invocation
 *   (read from tool_input.skill).
 * - input_summary is a truncated (~500 char) JSON/string summary of the input.
 *
 * Dumb capture only — no reasoning, no model calls. Reasoning over this file is
 * the coach's job (see skills/coachtime/SKILL.md). Capture is deterministic, so
 * it lives in a hook (per CLAUDE.md: determinism for capture, probabilism for
 * reasoning).
 *
 * Coach-aware (added 2026-05-28): only mirrors when the cwd is a coach-enabled
 * project — i.e. a `.coachtime` marker file exists at the project root. Silent
 * (no coach-history.jsonl) in any other cwd, so the user-level PostToolUse
 * registration no longer drops capture files into every project touched. The
 * project marker (not the per-session coach-session-<shortId>.txt marker) is
 * used so capture is broad across coach-enabled projects.
 *
 * Per-project: writes to the cwd's .claude/, never a global path.
 * Async, never blocks, always exits 0.
 *
 * Patterns mirrored from ~/.claude/hooks/worker-completion-signal.js
 * (stdin parsing 41-58, readFileSafe, exit-0 discipline) and the
 * continuous-learning-v2 observe.sh capture shape (tool_name/tool_input/cwd).
 */

'use strict';

const fs = require('fs');
const path = require('path');

const MAX_STDIN = 1024 * 1024;
const STDIN_TIMEOUT_MS = 3000;
const INPUT_SUMMARY_MAX = 500;
const HISTORY_FILENAME = 'coach-history.jsonl';
const PROJECT_MARKER = '.coachtime';
const TAG = '[Coach-History-Mirror]';

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

// Coach-aware gate: coach is "enabled" in a cwd when a `.coachtime` marker file
// exists at the project root. Persistent (install-time / hand-created) signal,
// available even before any per-session marker. When absent, this hook captures
// nothing — keeping coach-history.jsonl out of non-coach projects.
function coachProjectEnabled(cwd) {
  try {
    return fs.statSync(path.join(cwd, PROJECT_MARKER)).isFile();
  } catch (_) {
    return false;
  }
}

// Skill / slash-command name lives in tool_input.skill for Skill invocations.
// Only populate `skill` for actual Skill-shaped tools — NOT for Bash (whose
// tool_input.command would otherwise be misread as a skill name). The Skill
// tool surfaces as tool_name "Skill"; slash commands route through it too.
function extractSkillName(toolName, toolInput) {
  if (!toolInput || typeof toolInput !== 'object') return undefined;
  const isSkillTool = typeof toolName === 'string'
    && (toolName === 'Skill' || /(^|_)skill$/i.test(toolName));
  if (!isSkillTool) return undefined;
  const candidate = toolInput.skill || toolInput.command || toolInput.name;
  if (typeof candidate === 'string' && candidate.trim()) {
    return candidate.trim();
  }
  return undefined;
}

// ---------- main ----------
function main() {
  let input = {};
  try {
    input = JSON.parse(stdinData || '{}');
  } catch (_) {
    // Malformed stdin: capture nothing rather than guessing. Never block.
    process.exit(0);
  }

  // cwd from the hook envelope is authoritative; fall back to process.cwd().
  const cwd = (typeof input.cwd === 'string' && input.cwd.length > 0)
    ? input.cwd
    : process.cwd();

  // Coach-aware: silent unless this cwd is a coach-enabled project.
  if (!coachProjectEnabled(cwd)) {
    process.exit(0);
  }

  const toolName = input.tool_name || input.tool || 'unknown';
  const toolInput = input.tool_input || input.input || {};
  const skill = extractSkillName(toolName, toolInput);

  const record = {
    timestamp: isoTimestamp(),
    tool: toolName
  };
  if (skill) record.skill = skill;
  record.input_summary = summariseInput(toolInput);
  record.cwd = cwd;
  record.project = path.basename(cwd);

  // Permanent record — no rotation, no purge. Append one line.
  const claudeDir = path.join(cwd, '.claude');
  const historyPath = path.join(claudeDir, HISTORY_FILENAME);
  try {
    fs.mkdirSync(claudeDir, { recursive: true });
    fs.appendFileSync(historyPath, `${JSON.stringify(record)}\n`, 'utf8');
  } catch (err) {
    console.error(`${TAG} append failed: ${err.message}`);
  }

  process.exit(0);
}
