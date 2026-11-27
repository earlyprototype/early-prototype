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

function skill(name) {
  return fs.readFileSync(path.join(skillsDir, name, 'SKILL.md'), 'utf8');
}

// Exercise the UUID capture in the skill after Claude Code's string substitution.
function captureSuffix(instructions, uuid) {
  const expanded = instructions.replaceAll('${CLAUDE_SESSION_ID}', uuid);
  const rule = expanded.match(/Match `([^`]+)` against `\/([^`]+)\/i`/);
  assert.ok(rule, 'missing UUID capture in skill');
  return new RegExp(rule[2], 'i').exec(rule[1])?.[1]?.toLowerCase();
}

test('two sessions starting in the same daily folder get distinct identity markers', async t => {
  const cwd = project(t);
  const run = session_id => runHook(path.dirname(cwd), { cwd, session_id }, second);
  await Promise.all([run(first), run(second)]);
  for (const [uuid, expected] of [[first, 'dc7ba899'], [second, 'abcd1234']]) {
    assert.equal(fs.readFileSync(path.join(cwd, '.claude', `session-id-${uuid}.txt`), 'utf8').trim(), expected);
  }
});

test('two sessions entering the same child directory resolve distinct /teamtime write paths', async t => {
  const child = project(t);
  const parent = path.dirname(child);
  await Promise.all([first, second].map(session_id => runHook(parent, { cwd: parent, session_id })));
  assert.equal(fs.existsSync(path.join(child, '.claude')), false);
  const instructions = skill('teamtime');
  const writePath = instructions.match(/Write the user-provided description to `<cwd>\/([^`]+)`/)[1];
  for (const [uuid, filename] of [[first, 'pm-session-dc7ba899.txt'], [second, 'pm-session-abcd1234.txt']]) {
    const shortId = captureSuffix(instructions, uuid);
    assert.equal(path.join(child, writePath.replace('<shortId>', shortId)), path.join(child, '.claude', filename));
  }
});

test('resume repairs an empty identity marker and an incorrect eight-hex marker', async t => {
  const cwd = project(t);
  await runHook(cwd, { cwd, session_id: first, source: 'startup' });
  const marker = path.join(cwd, '.claude', `session-id-${first}.txt`);
  for (const invalid of ['', 'abcd1234\n']) {
    fs.writeFileSync(marker, invalid);
    await runHook(cwd, { cwd, session_id: first, source: 'resume' });
    assert.equal(fs.readFileSync(marker, 'utf8'), 'dc7ba899\n');
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

test('the registered hook and public session skills use the live session identity', () => {
  const config = JSON.parse(fs.readFileSync(path.join(hooksDir, 'hooks.json'), 'utf8'));
  const commands = config.hooks.SessionStart.flatMap(entry => entry.hooks.map(hook => hook.command));
  assert.ok(commands.includes('node "${CLAUDE_PLUGIN_ROOT}/hooks/pm-handoff-discovery.js"'));
  for (const name of fs.readdirSync(skillsDir)) {
    const instructions = skill(name);
    assert.doesNotMatch(instructions, /encoded-cwd|\.claude\/projects\/|\.claude\/session-id-\*/, name);
    if (!/<cwd>\/\.claude\/[^\s`]*<shortId>|\[worker:<shortId>\]/i.test(instructions)) continue;
    assert.ok(instructions.includes('<cwd>/.claude/session-id-${CLAUDE_SESSION_ID}.txt'), name);
    assert.match(instructions, /Keep the captured shortId if the file is missing, empty, or disagrees/, name);
    assert.equal(captureSuffix(instructions, first), 'dc7ba899', name);
    assert.equal(captureSuffix(instructions, 'invalid-abcd1234'), undefined, name);
  }
});

test('/notetime uses the /worktime task path and the same shortId for its stamp', () => {
  const notes = skill('notetime');
  const taskPath = skill('worktime').match(/Write the description to `([^`]+)`/)[1];
  assert.ok(notes.split('## Precondition')[1].split('## How')[0].includes(`\`${taskPath}\``));
  assert.doesNotMatch(notes, /active-task\.txt/);
  assert.match(notes, /## <timestamp> \[worker:<shortId>\]/);
  assert.equal(captureSuffix(notes, second), 'abcd1234');
});

test('a second inbox listing excludes all acknowledged pointers and keeps malformed markers unread', async t => {
  const cwd = project(t);
  const inbox = path.join(cwd, '.claude/inbox/pm');
  fs.mkdirSync(inbox, { recursive: true });
  const readtime = skill('readtime');
  const attributed = readtime.match(/With a valid shortId, append `([^`]+)`/)[1];
  const dateOnly = readtime.match(/If the shortId is `unknown`, append `([^`]+)`/)[1];
  assert.equal(dateOnly, '<!-- PM:READ:YYYY-MM-DD -->');
  const markers = [
    attributed.replace('YYYY-MM-DD', '2026-06-10').replace('<shortId>', 'dc7ba899'),
    dateOnly.replace('YYYY-MM-DD', '2026-06-10'),
    '\t<!-- PM:READ:2026-06-10 pm:unknown --> ',
    '<!-- PM:READ:2026-06-10 pm:DC7BA899 -->',
    '<!-- PM:READ:2026-06-10 pm:bad -->',
    'Example: <!-- PM:READ:2026-06-10 -->'
  ];
  const pointers = markers.map((_, i) => path.join(inbox, `handoff-2026-06-10-abcd1234-task-${i}.md`));
  for (const [i, file] of pointers.entries()) fs.writeFileSync(file, `- **Active task:** Task ${i}\r\n`);

  async function checkListings(expected) {
    const context = JSON.parse(await runHook(cwd, {})).hookSpecificOutput.additionalContext;
    assert.deepEqual(pointers.filter(file => context.includes(file)), expected, 'SessionStart');
    for (const name of ['readtime', 'check-handoffs']) {
      const pattern = skill(name).match(/`([^`\n]*PM:READ:\\d\{4\}[^`\n]+)`/)[1];
      const filter = new RegExp(pattern, 'm');
      assert.deepEqual(pointers.filter(file => !filter.test(fs.readFileSync(file, 'utf8'))), expected, name);
    }
  }
  await checkListings(pointers);
  for (const [i, file] of pointers.entries()) fs.appendFileSync(file, markers[i] + '\r\n');
  await checkListings(pointers.slice(4));
});
