'use strict';

const assert = require('node:assert/strict');
const { execFile, spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { after, before, beforeEach, test } = require('node:test');
const { promisify } = require('node:util');

const hooks = require('../hooks/hooks.json').hooks;
const script = path.resolve(__dirname, '../hooks/kanban-github-sync.js');
const mutation = { tool_name: 'mcp__kanbanger__add_task' };
const config = 'export GITHUB_REPO = "example/board" # target\nGITHUB_TOKEN=test-only\n';
let scratch, bin, project, board, dotenv, calls;

before(() => {
  scratch = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'kanban-hook-')));
  bin = path.join(scratch, 'bin');
  fs.mkdirSync(bin);
  // Node stands in for the CLI on both platforms. Its board argument runs the fixture below.
  const cli = process.platform === 'win32' ? 'kanban-sync.exe' : 'kanban-sync';
  fs.copyFileSync(process.execPath, path.join(bin, cli));
});

after(() => fs.rmSync(scratch, { recursive: true, force: true }));

beforeEach(() => {
  project = fs.mkdtempSync(path.join(scratch, 'project with spaces '));
  board = path.join(project, '_kanban.md');
  dotenv = path.join(project, '.env');
  calls = path.join(project, 'calls');
  fs.writeFileSync(dotenv, config);
  fs.writeFileSync(board, `
    require('node:fs').appendFileSync('calls', JSON.stringify([process.cwd(), ...process.argv.slice(1)]) + '\\n');
    console.log('private CLI output');
    console.error('private CLI diagnostic');
    process.exitCode = Number(process.env.CLI_STATUS || 0);
  `);
});

function run(input, env = {}) {
  const result = spawnSync(process.execPath, [script], {
    cwd: scratch,
    input: typeof input === 'string' ? input : JSON.stringify(input),
    env: { SystemRoot: process.env.SystemRoot, PATH: bin, CLAUDE_PROJECT_DIR: project, ...env },
    encoding: 'utf8',
    timeout: 10000
  });
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, '');
  return result.stderr;
}

test('registers an asynchronous PostToolUse command', () => {
  const commands = (hooks.PostToolUse || []).filter(group => group.matcher === '*')
    .flatMap(group => group.hooks);
  const matches = commands.filter(hook =>
    hook.command === 'node "${CLAUDE_PLUGIN_ROOT}/hooks/kanban-github-sync.js"');
  assert.equal(matches.length, 1);
  assert.equal(matches[0].type, 'command');
  assert.equal(matches[0].async, true);
});

test('each named mutation syncs the pinned project board once', () => {
  const mutations = ['add_task', 'move_task', 'delete_task', 'propose_done', 'approve_done', 'reject_review'];
  for (const name of mutations) {
    assert.equal(run({ tool_name: 'mcp__kanbanger__' + name, cwd: scratch }), '');
  }
  const entries = fs.readFileSync(calls, 'utf8').trim().split('\n').map(line => JSON.parse(line));
  assert.deepEqual(entries, mutations.map(() => [project, board]));
});

test('the marketplace kanbanger server uses the same mutation allowlist', () => {
  assert.equal(run({ tool_name: 'mcp__plugin_kanbanger_kanbanger__delete_task' }), '');
  assert.equal(run({ tool_name: 'mcp__plugin_kanbanger_kanbanger__list_tasks' }), '');
  assert.equal(run({ tool_name: 'mcp__plugin_other_kanbanger__delete_task' }), '');
  assert.deepEqual(JSON.parse(fs.readFileSync(calls, 'utf8')), [project, board]);
});

test('accepts the tool and cwd fallbacks and a privately supplied token', () => {
  fs.writeFileSync(dotenv, "GITHUB_REPO='example/board'\r\n");
  assert.equal(run({ tool: mutation.tool_name, cwd: project }, {
    CLAUDE_PROJECT_DIR: '', GITHUB_TOKEN: 'test-only'
  }), '');
  assert.deepEqual(JSON.parse(fs.readFileSync(calls, 'utf8')), [project, board]);
});

test('reads, manual sync, other tools and malformed events stay silent', () => {
  const tools = ['mcp__kanbanger__list_tasks', 'mcp__kanbanger__get_sync_status',
    'mcp__kanbanger__sync_to_github', 'mcp__kanbanger__setup_project', 'mcp__kanbanger__doctor',
    'mcp__other__add_task', 'mcp__kanbanger__add_task_extra', 'Bash'];
  for (const tool_name of tools) {
    assert.equal(run({ tool_name, tool: mutation.tool_name }), '');
  }
  for (const input of ['', '{', 'null', {}]) assert.equal(run(input), '');
  assert.equal(fs.existsSync(calls), false);
});

test('exits silently if the caller leaves stdin open', async () => {
  const result = await promisify(execFile)(process.execPath, [script], { cwd: scratch, timeout: 15000 });
  assert.equal(result.stdout, '');
  assert.equal(result.stderr, '');
});

test('requires a local board and a locally configured GitHub target', () => {
  const inherited = { GITHUB_REPO: 'other/board', GITHUB_TOKEN: 'test-only' };
  for (const contents of ['', 'UNRELATED=value', '# GITHUB_REPO=example/board',
    "GITHUB_REPO=''\n", "GITHUB_REPO=example/board\nGITHUB_TOKEN=''"]) {
    fs.writeFileSync(dotenv, contents);
    assert.equal(run(mutation, inherited), '');
  }
  fs.writeFileSync(dotenv, 'GITHUB_REPO=example/board');
  assert.equal(run(mutation), '');
  fs.unlinkSync(dotenv);
  assert.equal(run(mutation, inherited), '');
  fs.writeFileSync(dotenv, config);
  fs.unlinkSync(board);
  assert.equal(run(mutation), '');
  assert.equal(fs.existsSync(calls), false);
});

test('a missing or failing CLI returns success with one safe diagnostic', () => {
  for (const env of [{ PATH: scratch }, { CLI_STATUS: '7' }]) {
    const stderr = run(mutation, env);
    assert.match(stderr, /^[^\r\n]+\r?\n$/);
    assert.doesNotMatch(stderr, /test-only|private CLI/);
  }
});
