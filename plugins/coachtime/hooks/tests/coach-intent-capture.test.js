#!/usr/bin/env node
/**
 * Integration tests for coach-intent-capture.js
 *
 * Spawns the hook in both modes — default "prompt" (UserPromptSubmit) and
 * "start" (SessionStart) — feeds JSON envelopes on stdin, and asserts on exit
 * code, the coach-intent.txt side effect, and the SessionStart
 * additionalContext stdout payload.
 *
 * Focus: the 2026-05-28 coach-aware gate (`.coachtime` project marker, required
 * because both modes fire before any per-session marker exists) and the
 * nosessid unbounded-append fix.
 *
 * Self-contained: isolated temp cwd per test, cleaned up after. CLAUDE_SESSION_ID
 * and CLAUDE_TRANSCRIPT_PATH are stripped from the child env so harness-set
 * values don't bleed into the nosessid test.
 *
 * Run:  node coach-intent-capture.test.js
 */

'use strict';

const assert = require('assert');
const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const HOOK_SCRIPT = path.resolve(__dirname, '..', 'coach-intent-capture.js');
const INTENT = 'coach-intent.txt';
const FAKE_UUID = 'aaaaaaaa-1111-2222-3333-444455550000';

// ---------- fixtures ----------
function makeTempCwd() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'coach-intent-test-'));
}

function rimraf(p) {
  try { fs.rmSync(p, { recursive: true, force: true }); } catch (_) { /* ignore */ }
}

function enableCoach(cwd) {
  fs.writeFileSync(path.join(cwd, '.coachtime'), 'test marker\n', 'utf8');
}

function readIntent(cwd) {
  try { return fs.readFileSync(path.join(cwd, '.claude', INTENT), 'utf8'); } catch (_) { return null; }
}

function runHook(envelope, opts = {}) {
  const env = { ...process.env };
  delete env.CLAUDE_SESSION_ID;
  delete env.CLAUDE_TRANSCRIPT_PATH;
  if (opts.env) Object.assign(env, opts.env);
  const args = opts.args ? [HOOK_SCRIPT, ...opts.args] : [HOOK_SCRIPT];
  const result = spawnSync(process.execPath, args, {
    input: JSON.stringify(envelope),
    encoding: 'utf8',
    timeout: 5000,
    env
  });
  return { status: result.status, stderr: result.stderr || '', stdout: result.stdout || '' };
}

function startContext(stdout) {
  try { return JSON.parse(stdout).hookSpecificOutput.additionalContext || ''; } catch (_) { return ''; }
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

// ---------- prompt mode (UserPromptSubmit) ----------

test('prompt: silent (no coach-intent.txt) when .coachtime absent', () => {
  const cwd = makeTempCwd();
  try {
    const res = runHook({ cwd, session_id: FAKE_UUID, prompt: 'do the thing' });
    assert.strictEqual(res.status, 0);
    assert.strictEqual(readIntent(cwd), null, 'should not write intent in a non-coach project');
  } finally {
    rimraf(cwd);
  }
});

test('prompt: captures first message as intent when .coachtime present', () => {
  const cwd = makeTempCwd();
  enableCoach(cwd);
  try {
    const res = runHook({ cwd, session_id: FAKE_UUID, prompt: 'ship the hooks' });
    assert.strictEqual(res.status, 0);
    const content = readIntent(cwd);
    assert.ok(content && content.includes('ship the hooks'), `intent should be recorded, got: ${content}`);
    assert.ok(content.includes(`<!-- session:${FAKE_UUID.toLowerCase()} -->`), 'should write the session sentinel');
  } finally {
    rimraf(cwd);
  }
});

test('prompt: idempotent — second prompt in same session does not append again', () => {
  const cwd = makeTempCwd();
  enableCoach(cwd);
  try {
    runHook({ cwd, session_id: FAKE_UUID, prompt: 'first message' });
    runHook({ cwd, session_id: FAKE_UUID, prompt: 'second message' });
    const content = readIntent(cwd);
    assert.ok(content.includes('first message'), 'first message recorded');
    assert.ok(!content.includes('second message'), 'second message must NOT be recorded (only the first is the intent)');
  } finally {
    rimraf(cwd);
  }
});

test('prompt: nosessid does NOT append (unbounded-growth bug fix)', () => {
  const cwd = makeTempCwd();
  enableCoach(cwd);
  try {
    // No transcript_path / session_id and env stripped -> deriveSessionId == 'nosessid'.
    runHook({ cwd, prompt: 'message one' });
    runHook({ cwd, prompt: 'message two' });
    runHook({ cwd, prompt: 'message three' });
    assert.strictEqual(readIntent(cwd), null, 'nosessid must not write or grow coach-intent.txt');
  } finally {
    rimraf(cwd);
  }
});

// ---------- start mode (SessionStart) ----------

test('start: empty additionalContext when .coachtime absent', () => {
  const cwd = makeTempCwd();
  try {
    const res = runHook({ cwd }, { args: ['start'] });
    assert.strictEqual(res.status, 0);
    assert.strictEqual(startContext(res.stdout).trim(), '', 'should surface nothing in a non-coach project');
  } finally {
    rimraf(cwd);
  }
});

test('start: surfaces the intent prompt when .coachtime present', () => {
  const cwd = makeTempCwd();
  enableCoach(cwd);
  try {
    const res = runHook({ cwd }, { args: ['start'] });
    assert.strictEqual(res.status, 0);
    assert.ok(
      startContext(res.stdout).includes('What are you about to do this session?'),
      'should surface the intent prompt in a coach project'
    );
  } finally {
    rimraf(cwd);
  }
});

test('start: surfaces prior recorded intent when present', () => {
  const cwd = makeTempCwd();
  enableCoach(cwd);
  try {
    // Seed a prior intent via a prompt-mode fire.
    runHook({ cwd, session_id: FAKE_UUID, prompt: 'previous intent text' });
    const res = runHook({ cwd }, { args: ['start'] });
    const ctx = startContext(res.stdout);
    assert.ok(ctx.includes('previous intent text'), `should surface prior intent, got: ${ctx}`);
    assert.ok(ctx.includes('last time'), 'should frame it as last-time context');
  } finally {
    rimraf(cwd);
  }
});

test('start: malformed stdin exits 0 with empty payload', () => {
  const cwd = makeTempCwd();
  enableCoach(cwd);
  try {
    const env = { ...process.env };
    delete env.CLAUDE_SESSION_ID;
    delete env.CLAUDE_TRANSCRIPT_PATH;
    const result = spawnSync(process.execPath, [HOOK_SCRIPT, 'start'], {
      input: 'this is not JSON',
      encoding: 'utf8',
      timeout: 5000,
      env
    });
    assert.strictEqual(result.status, 0);
    assert.strictEqual(startContext(result.stdout).trim(), '', 'malformed stdin -> empty payload');
  } finally {
    rimraf(cwd);
  }
});

run().catch(err => {
  console.error('runner crashed:', err);
  process.exit(1);
});
