#!/usr/bin/env node
/**
 * Integration tests for coach-drift-flag.js
 *
 * Spawns the hook as a child process (matching how Claude Code runs it),
 * feeds JSON envelopes on stdin, and asserts on:
 *   - exit code (always 0 — flag, not block)
 *   - stderr (warning text only when coach session active)
 *   - the drift log file (written only when flagged)
 *
 * Per the 2026-05-28 redesign (timeteam Task 2): the marker is now scoped to
 * shortId — `coach-session-<shortId>.txt` — and is 18h TTL'd. Tests cover:
 *   - shortId from stdin (session_id field — coach-intent-capture.js style)
 *   - shortId from stdin (transcript_path field — worker-completion-signal.js style)
 *   - shortId discovery fallback via transcript glob (Worker-PM-System.md §10)
 *   - TTL boundary (stale > 18h → silent; fresh → flag)
 *   - Split-session isolation (marker for shortA does NOT trigger for shortB)
 *
 * Self-contained: builds an isolated cwd per test under the OS temp dir,
 * cleans up after, no shared state. CLAUDE_SESSION_ID and CLAUDE_TRANSCRIPT_PATH
 * are stripped from the child env so harness-set values don't bleed into tests.
 *
 * Run:  node coach-drift-flag.test.js
 */

'use strict';

const assert = require('assert');
const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const HOOK_SCRIPT = path.resolve(__dirname, '..', 'coach-drift-flag.js');
const DRIFT_LOG = 'coach-drift-log.jsonl';
const TTL_MS = 18 * 60 * 60 * 1000;

// A stable fake UUID used by most tests. ShortId = last 8 hex chars.
const FAKE_UUID_A = 'aaaaaaaa-1111-2222-3333-444455550000';
const SHORT_A = '55550000';
const FAKE_UUID_B = 'bbbbbbbb-1111-2222-3333-44445555ffff';
const SHORT_B = '5555ffff';
const FAKE_UUID_C = 'cccccccc-1111-2222-3333-4444cccc1234';
const SHORT_C = 'cccc1234';

// ---------- fixtures ----------
function makeTempCwd() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'coach-drift-test-'));
  fs.mkdirSync(path.join(dir, '.claude'), { recursive: true });
  return dir;
}

function makeTempHome() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'coach-drift-home-'));
}

function rimraf(p) {
  try { fs.rmSync(p, { recursive: true, force: true }); } catch (_) { /* ignore */ }
}

function markerPath(cwd, shortId) {
  return path.join(cwd, '.claude', `coach-session-${shortId}.txt`);
}

function writeScopedMarker(cwd, shortId, opts = {}) {
  const p = markerPath(cwd, shortId);
  fs.writeFileSync(p, `coach session opened ${new Date().toISOString()}\n`, 'utf8');
  if (opts.ageMs !== undefined) {
    const t = new Date(Date.now() - opts.ageMs);
    fs.utimesSync(p, t, t);
  }
  return p;
}

function runHook(envelope, opts = {}) {
  // Strip harness-set values that would otherwise override the test's stdin.
  const env = { ...process.env };
  delete env.CLAUDE_SESSION_ID;
  delete env.CLAUDE_TRANSCRIPT_PATH;
  if (opts.env) Object.assign(env, opts.env);
  const result = spawnSync(process.execPath, [HOOK_SCRIPT], {
    input: JSON.stringify(envelope),
    encoding: 'utf8',
    timeout: 5000,
    env
  });
  return {
    status: result.status,
    stderr: result.stderr || '',
    stdout: result.stdout || ''
  };
}

function readDriftLog(cwd) {
  const p = path.join(cwd, '.claude', DRIFT_LOG);
  try {
    return fs.readFileSync(p, 'utf8')
      .split('\n')
      .filter(Boolean)
      .map(line => JSON.parse(line));
  } catch (_) {
    return [];
  }
}

// ---------- test runner ----------
const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

async function run() {
  let passed = 0;
  let failed = 0;
  for (const t of tests) {
    try {
      await t.fn();
      console.log(`  PASS  ${t.name}`);
      passed++;
    } catch (err) {
      console.error(`  FAIL  ${t.name}`);
      console.error(`        ${err.message}`);
      if (err.stack) console.error(err.stack.split('\n').slice(1, 4).join('\n'));
      failed++;
    }
  }
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed === 0 ? 0 : 1);
}

// ---------- tests ----------

test('silent when no coach-session-<shortId>.txt exists for current session', () => {
  const cwd = makeTempCwd();
  try {
    const res = runHook({
      cwd,
      session_id: FAKE_UUID_A,
      tool_name: 'Edit',
      tool_input: { file_path: path.join(cwd, 'foo.js'), old_string: 'a', new_string: 'b' }
    });
    assert.strictEqual(res.status, 0, 'should exit 0');
    assert.strictEqual(res.stderr.trim(), '', `expected empty stderr, got: ${res.stderr}`);
    assert.deepStrictEqual(readDriftLog(cwd), [], 'should not write drift log');
  } finally {
    rimraf(cwd);
  }
});

test('warns + logs when Edit attempted during coach session (shortId from session_id)', () => {
  const cwd = makeTempCwd();
  writeScopedMarker(cwd, SHORT_A);
  try {
    const target = path.join(cwd, 'foo.js');
    const res = runHook({
      cwd,
      session_id: FAKE_UUID_A,
      tool_name: 'Edit',
      tool_input: { file_path: target, old_string: 'a', new_string: 'b' }
    });
    assert.strictEqual(res.status, 0, 'should exit 0');
    assert.ok(res.stderr.includes('[Coach-Drift]'), `expected tag in stderr, got: ${res.stderr}`);
    assert.ok(res.stderr.includes('Edit'), 'stderr should name the tool');
    assert.ok(res.stderr.includes(target), 'stderr should name the target file');
    assert.ok(res.stderr.includes('coach session'), 'stderr should mention coach session');
    assert.ok(res.stderr.includes('drift'), 'stderr should frame the question as approved-or-drift');

    const records = readDriftLog(cwd);
    assert.strictEqual(records.length, 1, 'should write one drift record');
    const rec = records[0];
    assert.strictEqual(rec.tool, 'Edit');
    assert.strictEqual(rec.target_file, target);
    assert.strictEqual(rec.cwd, cwd);
    assert.strictEqual(rec.short_id, SHORT_A, 'drift record should carry the discovered shortId');
    assert.ok(typeof rec.timestamp === 'string' && rec.timestamp.length > 0);
    assert.ok(typeof rec.input_summary === 'string');
  } finally {
    rimraf(cwd);
  }
});

test('warns when shortId discovered from transcript_path field', () => {
  const cwd = makeTempCwd();
  writeScopedMarker(cwd, SHORT_A);
  try {
    const res = runHook({
      cwd,
      transcript_path: `/some/path/${FAKE_UUID_A}.jsonl`,
      tool_name: 'Write',
      tool_input: { file_path: path.join(cwd, 'foo.js'), content: 'hi' }
    });
    assert.strictEqual(res.status, 0);
    assert.ok(res.stderr.includes('[Coach-Drift]'));
    const records = readDriftLog(cwd);
    assert.strictEqual(records.length, 1);
    assert.strictEqual(records[0].short_id, SHORT_A);
  } finally {
    rimraf(cwd);
  }
});

test('always exits 0 across all matched editor tools', () => {
  const cwd = makeTempCwd();
  writeScopedMarker(cwd, SHORT_A);
  try {
    for (const tool of ['Edit', 'Write', 'MultiEdit', 'NotebookEdit']) {
      const res = runHook({
        cwd,
        session_id: FAKE_UUID_A,
        tool_name: tool,
        tool_input: { file_path: path.join(cwd, `x.${tool}.txt`) }
      });
      assert.strictEqual(res.status, 0, `${tool} should exit 0`);
    }
  } finally {
    rimraf(cwd);
  }
});

test('ignores non-editor tools even with coach session active', () => {
  const cwd = makeTempCwd();
  writeScopedMarker(cwd, SHORT_A);
  try {
    const res = runHook({
      cwd,
      session_id: FAKE_UUID_A,
      tool_name: 'Read',
      tool_input: { file_path: path.join(cwd, 'foo.js') }
    });
    assert.strictEqual(res.status, 0, 'should exit 0');
    assert.strictEqual(res.stderr.trim(), '', 'Read should not be flagged');
    assert.deepStrictEqual(readDriftLog(cwd), [], 'Read should not log drift');
  } finally {
    rimraf(cwd);
  }
});

test('handles malformed stdin without crashing', () => {
  const cwd = makeTempCwd();
  writeScopedMarker(cwd, SHORT_A);
  try {
    const env = { ...process.env };
    delete env.CLAUDE_SESSION_ID;
    delete env.CLAUDE_TRANSCRIPT_PATH;
    const result = spawnSync(process.execPath, [HOOK_SCRIPT], {
      input: 'this is not JSON',
      encoding: 'utf8',
      timeout: 5000,
      env
    });
    assert.strictEqual(result.status, 0, 'should exit 0 on bad input');
  } finally {
    rimraf(cwd);
  }
});

test('NotebookEdit captures notebook_path as target_file', () => {
  const cwd = makeTempCwd();
  writeScopedMarker(cwd, SHORT_A);
  try {
    const nbPath = path.join(cwd, 'analysis.ipynb');
    const res = runHook({
      cwd,
      session_id: FAKE_UUID_A,
      tool_name: 'NotebookEdit',
      tool_input: { notebook_path: nbPath, cell_id: '1', new_source: 'print(1)' }
    });
    assert.strictEqual(res.status, 0);
    const records = readDriftLog(cwd);
    assert.strictEqual(records.length, 1);
    assert.strictEqual(records[0].target_file, nbPath);
  } finally {
    rimraf(cwd);
  }
});

test('silent when marker mtime is past 18h TTL (stale → skip)', () => {
  const cwd = makeTempCwd();
  // 19 hours old — past the 18h TTL.
  writeScopedMarker(cwd, SHORT_A, { ageMs: TTL_MS + (60 * 60 * 1000) });
  try {
    const res = runHook({
      cwd,
      session_id: FAKE_UUID_A,
      tool_name: 'Edit',
      tool_input: { file_path: path.join(cwd, 'foo.js') }
    });
    assert.strictEqual(res.status, 0, 'should exit 0');
    assert.strictEqual(res.stderr.trim(), '', `expected silent on stale marker, got: ${res.stderr}`);
    assert.deepStrictEqual(readDriftLog(cwd), [], 'should not write drift log for stale marker');
  } finally {
    rimraf(cwd);
  }
});

test('warns when marker mtime is well within TTL (fresh)', () => {
  const cwd = makeTempCwd();
  // 17 hours old — still within the 18h TTL.
  writeScopedMarker(cwd, SHORT_A, { ageMs: TTL_MS - (60 * 60 * 1000) });
  try {
    const res = runHook({
      cwd,
      session_id: FAKE_UUID_A,
      tool_name: 'Edit',
      tool_input: { file_path: path.join(cwd, 'foo.js') }
    });
    assert.strictEqual(res.status, 0);
    assert.ok(res.stderr.includes('[Coach-Drift]'), 'should still flag within TTL');
    assert.strictEqual(readDriftLog(cwd).length, 1);
  } finally {
    rimraf(cwd);
  }
});

test('split-session: marker for shortA does not trigger when hook fires for shortB', () => {
  const cwd = makeTempCwd();
  writeScopedMarker(cwd, SHORT_A);
  try {
    // Hook fires for instance B — its shortId is SHORT_B; only A's marker is present.
    const res = runHook({
      cwd,
      session_id: FAKE_UUID_B,
      tool_name: 'Edit',
      tool_input: { file_path: path.join(cwd, 'foo.js') }
    });
    assert.strictEqual(res.status, 0);
    assert.strictEqual(res.stderr.trim(), '', `B should be silent — only A has a marker; got: ${res.stderr}`);
    assert.deepStrictEqual(readDriftLog(cwd), [], 'B should not write drift log');

    // Sanity: now fire for shortA — should flag.
    const resA = runHook({
      cwd,
      session_id: FAKE_UUID_A,
      tool_name: 'Edit',
      tool_input: { file_path: path.join(cwd, 'foo.js') }
    });
    assert.ok(resA.stderr.includes('[Coach-Drift]'), 'A should still flag');
    assert.strictEqual(readDriftLog(cwd).length, 1, 'only A flagged');
  } finally {
    rimraf(cwd);
  }
});

test('discovery fallback: no stdin shortId — discovers via transcript glob', () => {
  const cwd = makeTempCwd();
  const tempHome = makeTempHome();
  try {
    // Stub the home-dir transcript directory layout:
    //   <tempHome>/.claude/projects/<encoded(cwd)>/<UUID>.jsonl
    const encoded = cwd.replace(/[\\/:]/g, '-');
    const projDir = path.join(tempHome, '.claude', 'projects', encoded);
    fs.mkdirSync(projDir, { recursive: true });
    fs.writeFileSync(path.join(projDir, `${FAKE_UUID_C}.jsonl`), '', 'utf8');

    // Marker matching the UUID-derived shortId.
    writeScopedMarker(cwd, SHORT_C);

    // Envelope intentionally omits session_id and transcript_path.
    const res = runHook(
      {
        cwd,
        tool_name: 'Edit',
        tool_input: { file_path: path.join(cwd, 'foo.js') }
      },
      { env: { USERPROFILE: tempHome, HOME: tempHome } }
    );

    assert.strictEqual(res.status, 0);
    assert.ok(res.stderr.includes('[Coach-Drift]'), `expected flag, got: ${res.stderr}`);
    const records = readDriftLog(cwd);
    assert.strictEqual(records.length, 1);
    assert.strictEqual(records[0].short_id, SHORT_C, 'discovered shortId should be in drift record');
  } finally {
    rimraf(cwd);
    rimraf(tempHome);
  }
});

run().catch(err => {
  console.error('runner crashed:', err);
  process.exit(1);
});
