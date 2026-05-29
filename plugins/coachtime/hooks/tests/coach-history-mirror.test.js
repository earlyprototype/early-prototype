#!/usr/bin/env node
/**
 * Integration tests for coach-history-mirror.js
 *
 * Spawns the hook as a child process (matching how Claude Code runs it), feeds
 * JSON envelopes on stdin, and asserts on exit code and the coach-history.jsonl
 * side effect. Focus: the 2026-05-28 coach-aware gate — capture happens only
 * when a `.coachtime` project marker exists at the cwd root; silent otherwise.
 *
 * Self-contained: isolated temp cwd per test, cleaned up after.
 *
 * Run:  node coach-history-mirror.test.js
 */

'use strict';

const assert = require('assert');
const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const HOOK_SCRIPT = path.resolve(__dirname, '..', 'coach-history-mirror.js');
const HISTORY = 'coach-history.jsonl';

// ---------- fixtures ----------
function makeTempCwd() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'coach-history-test-'));
}

function rimraf(p) {
  try { fs.rmSync(p, { recursive: true, force: true }); } catch (_) { /* ignore */ }
}

function enableCoach(cwd) {
  fs.writeFileSync(path.join(cwd, '.coachtime'), 'test marker\n', 'utf8');
}

function runHook(envelope) {
  const env = { ...process.env };
  delete env.CLAUDE_SESSION_ID;
  delete env.CLAUDE_TRANSCRIPT_PATH;
  const result = spawnSync(process.execPath, [HOOK_SCRIPT], {
    input: JSON.stringify(envelope),
    encoding: 'utf8',
    timeout: 5000,
    env
  });
  return { status: result.status, stderr: result.stderr || '', stdout: result.stdout || '' };
}

function readHistory(cwd) {
  const p = path.join(cwd, '.claude', HISTORY);
  try {
    return fs.readFileSync(p, 'utf8').split('\n').filter(Boolean).map(line => JSON.parse(line));
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
      failed++;
    }
  }
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed === 0 ? 0 : 1);
}

// ---------- tests ----------

test('silent (no coach-history.jsonl) when .coachtime is absent', () => {
  const cwd = makeTempCwd();
  try {
    const res = runHook({ cwd, tool_name: 'Read', tool_input: { file_path: 'x' } });
    assert.strictEqual(res.status, 0, 'should exit 0');
    assert.deepStrictEqual(readHistory(cwd), [], 'should not write history in a non-coach project');
  } finally {
    rimraf(cwd);
  }
});

test('captures one record when .coachtime is present', () => {
  const cwd = makeTempCwd();
  enableCoach(cwd);
  try {
    const res = runHook({ cwd, tool_name: 'Read', tool_input: { file_path: 'x' } });
    assert.strictEqual(res.status, 0);
    const recs = readHistory(cwd);
    assert.strictEqual(recs.length, 1, 'should append one record');
    assert.strictEqual(recs[0].tool, 'Read');
    assert.strictEqual(recs[0].cwd, cwd);
    assert.strictEqual(recs[0].project, path.basename(cwd));
    assert.ok(typeof recs[0].timestamp === 'string' && recs[0].timestamp.length > 0);
    assert.ok(typeof recs[0].input_summary === 'string');
  } finally {
    rimraf(cwd);
  }
});

test('records skill name for Skill tool invocations', () => {
  const cwd = makeTempCwd();
  enableCoach(cwd);
  try {
    const res = runHook({ cwd, tool_name: 'Skill', tool_input: { skill: 'coachtime' } });
    assert.strictEqual(res.status, 0);
    const recs = readHistory(cwd);
    assert.strictEqual(recs.length, 1);
    assert.strictEqual(recs[0].skill, 'coachtime', 'skill name should be captured');
  } finally {
    rimraf(cwd);
  }
});

test('does not misread a Bash command as a skill', () => {
  const cwd = makeTempCwd();
  enableCoach(cwd);
  try {
    const res = runHook({ cwd, tool_name: 'Bash', tool_input: { command: 'ls -la' } });
    assert.strictEqual(res.status, 0);
    const recs = readHistory(cwd);
    assert.strictEqual(recs.length, 1);
    assert.strictEqual(recs[0].skill, undefined, 'Bash command must not be captured as a skill name');
  } finally {
    rimraf(cwd);
  }
});

test('appends across multiple fires (permanent record, no overwrite)', () => {
  const cwd = makeTempCwd();
  enableCoach(cwd);
  try {
    runHook({ cwd, tool_name: 'Read', tool_input: {} });
    runHook({ cwd, tool_name: 'Edit', tool_input: {} });
    assert.strictEqual(readHistory(cwd).length, 2, 'should accumulate, not overwrite');
  } finally {
    rimraf(cwd);
  }
});

test('handles malformed stdin without crashing', () => {
  const cwd = makeTempCwd();
  enableCoach(cwd);
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

run().catch(err => {
  console.error('runner crashed:', err);
  process.exit(1);
});
