'use strict';

const assert = require('node:assert/strict');
const { execFile } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const hooksDir = path.resolve(__dirname, '..');
const skillsDir = path.resolve(hooksDir, '../skills');
const sessionStart = path.join(hooksDir, 'pm-handoff-discovery.js');
const first = '10000000-0000-4000-8000-0000DC7BA899';
const second = '20000000-0000-4000-8000-0000abcd1234';

function project(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'session-id-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const cwd = path.join(root, '_daily', '10_06_26');
  fs.mkdirSync(cwd, { recursive: true });
  return cwd;
}

function runHook(cwd, input, envId = '') {
  return new Promise((resolve, reject) => {
    const child = execFile(process.execPath, [sessionStart], {
      cwd, env: { ...process.env, CLAUDE_SESSION_ID: envId }
    }, (err, stdout) => err ? reject(err) : resolve(stdout));
    child.stdin.end(typeof input === 'string' ? input : JSON.stringify(input));
  });
}

test('two sessions in the same daily folder resolve distinct /teamtime marker paths', async t => {
  const cwd = project(t);
  const run = session_id => runHook(path.dirname(cwd), { cwd, session_id }, second);
  await Promise.all([run(first), run(second)]);
  await run(first); // SessionStart also runs on resume.

  const teamtime = fs.readFileSync(path.join(skillsDir, 'teamtime/SKILL.md'), 'utf8');
  const readPath = teamtime.match(/Use `Read` on `<cwd>\/(\.claude\/session-id-[^`]+)`/)[1];
  const writePath = teamtime.match(/Write the user-provided description to `<cwd>\/([^`]+)`/)[1];
  // Apply Claude Code's skill substitution and the documented PM marker write.
  for (const [uuid, expected] of [[first, 'dc7ba899'], [second, 'abcd1234']]) {
    const marker = readPath.replace('${CLAUDE_SESSION_ID}', uuid);
    const shortId = fs.readFileSync(path.join(cwd, marker), 'utf8').trim();
    assert.equal(shortId, expected);
    const pmMarker = writePath.replace('<shortId>', shortId);
    fs.writeFileSync(path.join(cwd, pmMarker), uuid, { flag: 'wx' });
  }
  for (const [shortId, uuid] of [['dc7ba899', first], ['abcd1234', second]]) {
    assert.equal(fs.readFileSync(path.join(cwd, '.claude', `pm-session-${shortId}.txt`), 'utf8'), uuid);
  }
});

test('SessionStart can use its transcript filename or environment when the payload lacks an ID', async t => {
  const cwd = project(t);
  await runHook(cwd, { transcript_path: `project/${first}.jsonl` }, second);
  assert.deepEqual(fs.readdirSync(path.join(cwd, '.claude')), [`session-id-${first}.txt`]);
  await runHook(cwd, { transcript_path: 'subagents/workflows/journal.jsonl' }, second);
  assert.equal(fs.readFileSync(path.join(cwd, '.claude', `session-id-${second}.txt`), 'utf8').trim(), 'abcd1234');
});

test('manual inbox checks and malformed identities still return the inbox', async t => {
  const cwd = project(t);
  for (const input of ['', '{', { session_id: '../bad', transcript_path: 'subagents/agent-other.jsonl' }]) {
    const output = JSON.parse(await runHook(cwd, input)).hookSpecificOutput;
    assert.equal(output.hookEventName, 'SessionStart');
    assert.match(output.additionalContext, /no unread handoffs/);
    assert.equal(fs.existsSync(path.join(cwd, '.claude')), false);
  }
});

test('a marker write failure still surfaces unread handoffs', async t => {
  const cwd = project(t);
  const inbox = path.join(cwd, '.claude/inbox/pm');
  fs.mkdirSync(inbox, { recursive: true });
  fs.writeFileSync(path.join(inbox, 'handoff-2026-06-10-abcd1234-task.md'), '- **Active task:** Review request');
  fs.mkdirSync(path.join(cwd, '.claude', `session-id-${first}.txt`));
  const output = JSON.parse(await runHook(cwd, { session_id: first })).hookSpecificOutput;
  assert.match(output.additionalContext, /Active task: Review request/);
});

test('the registered SessionStart hook and eight lifecycle skills agree on the identity marker', () => {
  const config = JSON.parse(fs.readFileSync(path.join(hooksDir, 'hooks.json'), 'utf8'));
  const commands = config.hooks.SessionStart.flatMap(entry => entry.hooks.map(hook => hook.command));
  assert.ok(commands.includes('node "${CLAUDE_PLUGIN_ROOT}/hooks/pm-handoff-discovery.js"'));
  for (const name of ['teamtime', 'worktime', 'sleeptime', 'readtime', 'prodtime', 'prodout', 'clocktime', 'chosetime']) {
    const skill = fs.readFileSync(path.join(skillsDir, name, 'SKILL.md'), 'utf8');
    assert.ok(skill.includes('Use `Read` on `<cwd>/.claude/session-id-${CLAUDE_SESSION_ID}.txt`'), name);
    assert.doesNotMatch(skill, /encoded-cwd|\.claude\/projects\/|session-id-\*/, name);
  }
});
