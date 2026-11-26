'use strict';

const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { setTimeout: delay } = require('node:timers/promises');

const cliTimeout = 110_000;
const tag = '[kanban-github-sync]';

// Read complete python-dotenv bindings, including multiline values. Variable
// expansion sees earlier bindings before the inherited environment (override=True).
function configured(cwd) {
  const dotenv = path.join(cwd, '.env');
  if (/^(1|true|t|yes|y)$/i.test(process.env.PYTHON_DOTENV_DISABLED)) return false;
  if (![dotenv, path.join(cwd, '_kanban.md')].every(file =>
    fs.statSync(file, { throwIfNoEntry: false })?.isFile())) return false;
  const source = fs.readFileSync(dotenv, 'utf8').replace(/\r\n?/g, '\n');
  const present = new Map();
  const head = /[^\S\n]*(?:export[^\S\n]+)?(?:'([^']+)'|([^'#=\s][^#=\s]*))[^\S\n]*(=[^\S\n]*)?/y;
  const escapes = { a: '\x07', b: '\b', f: '\f', n: '\n', r: '\r', t: '\t', v: '\v' };
  let offset = 0;
  function take(pattern) {
    pattern.lastIndex = offset;
    const match = pattern.exec(source);
    if (match) offset = pattern.lastIndex;
    return match;
  }
  while (offset < source.length) {
    const header = take(head);
    const equal = header?.[3];
    const quote = equal && source[offset];
    let value;
    let valid = Boolean(header);
    if (quote === "'" || quote === '"') {
      const single = quote === "'";
      const quoted = take(single ? /'((?:\\.|[^'\\])*)'/sy : /"((?:\\.|[^"\\])*)"/sy);
      valid = Boolean(quoted);
      value = quoted?.[1].replace(single ? /\\([\\'])/g : /\\([\\'"abfnrtv])/g,
        (_, c) => escapes[c] ?? c);
    } else if (equal) {
      const bare = equal.slice(1) + take(/[^\n]*/y)[0];
      value = bare.replace(/\s+#.*$/, '').trim();
    }
    const tail = take(/[^\n]*(?:\n|$)/y)[0].trim();
    if (!valid || (tail && !tail.startsWith('#'))) continue;
    // Only presence matters. Keep substitutions small even for repeated references.
    value = value?.replace(/\$\{([^}:]*)(?::-([^}]*))?\}/g, (_, name, fallback = '') => {
      const hasValue = present.has(name) ? present.get(name) : (process.env[name] ?? fallback).trim();
      return hasValue ? 'x' : '';
    });
    present.set(header[1] ?? header[2], value === undefined ? undefined : Boolean(value.trim()));
  }
  return present.get('GITHUB_REPO') && (present.get('GITHUB_TOKEN') ?? process.env.GITHUB_TOKEN?.trim());
}

function inside(dir, file) {
  const relative = path.relative(dir, file);
  return relative !== '..' && !relative.startsWith('..' + path.sep) && !path.isAbsolute(relative);
}

function findCli(cwd) {
  const name = process.platform === 'win32' ? 'kanban-sync.exe' : 'kanban-sync';
  for (let dir of (process.env.PATH || '').split(path.delimiter)) {
    if (process.platform === 'win32') dir = dir.replace(/^"(.*)"$/, '$1');
    if (!path.isAbsolute(dir) || inside(cwd, dir)) continue;
    try {
      const file = fs.realpathSync(path.join(dir, name));
      if (inside(cwd, file) || !fs.statSync(file).isFile()) continue;
      fs.accessSync(file, fs.constants.X_OK);
      return file;
    } catch { /* Try the next PATH entry. */ }
  }
}

function runCli(cli, cwd) {
  const result = spawnSync(cli, ['_kanban.md'], {
    cwd, stdio: ['ignore', 'ignore', 'pipe'], windowsHide: true,
    timeout: cliTimeout, killSignal: 'SIGKILL', encoding: 'utf8'
  });
  if (result.error || result.status !== 0) {
    console.error(tag + ' kanban-sync failed (' + (result.error?.code || result.signal || result.status) + ').');
  } else if (/has no matching Status option on the GitHub Project/i.test(result.stderr)) {
    console.error(tag + ' A card status could not be set. Check the Status options on the GitHub Project.');
  } else if (/^\s*warning:/im.test(result.stderr)) {
    console.error(tag + ' kanban-sync reported a warning.');
  }
}

// Publish a nonempty directory with a single rename. A second writer cannot
// replace it. The unique owner file lets waiters clean up an interrupted hook.
function acquire(staging, lock) {
  try {
    fs.renameSync(staging, lock);
    return true;
  } catch (err) {
    if (!['EEXIST', 'ENOTEMPTY', 'EPERM', 'EACCES'].includes(err.code)) throw err;
  }
  try {
    const entries = fs.readdirSync(lock);
    const [owner] = entries;
    if (owner) {
      const match = /^([1-9]\d*)-kanban-sync-[a-zA-Z0-9]{6}$/.exec(owner);
      if (!match || entries.length !== 1) throw new Error('Invalid lock owner');
      const pid = Number(match[1]);
      try { process.kill(pid, 0); return false; } catch (err) {
        if (err.code !== 'ESRCH') throw err;
      }
      fs.unlinkSync(path.join(lock, owner));
    }
    // This fails safely if another waiter already installed a new owner.
    fs.rmdirSync(lock);
  } catch (err) {
    if (!['ENOENT', 'ENOTEMPTY', 'EEXIST'].includes(err.code)) throw err;
  }
  return false;
}

async function queueSync(cwd) {
  const dir = path.join(cwd, '.claude');
  fs.mkdirSync(dir, { recursive: true });
  const pending = path.join(dir, 'kanban-sync.pending');
  const lock = path.join(dir, 'kanban-sync.lock');
  const staging = fs.mkdtempSync(path.join(dir, 'kanban-sync-'));
  const owner = process.pid + '-' + path.basename(staging);
  let acquired = false;
  try {
    fs.writeFileSync(path.join(staging, owner), '');
    fs.closeSync(fs.openSync(pending, 'a'));
    const deadline = Date.now() + cliTimeout + 5000;
    while (fs.existsSync(pending)) {
      acquired = acquire(staging, lock);
      if (acquired) {
        // Claim all mutations so far. A later mutation recreates the marker
        // and its hook waits here until this CLI has saved .kanban.json.
        if (fs.existsSync(pending)) {
          fs.unlinkSync(pending);
          if (configured(cwd)) {
            const cli = findCli(cwd);
            if (cli) runCli(cli, cwd);
            else console.error(tag + ' kanban-sync was not found on the hook PATH.');
          }
        }
        return;
      }
      if (Date.now() >= deadline) throw new Error('Timed out waiting for sync');
      await delay(100);
    }
  } finally {
    if (acquired) fs.renameSync(lock, staging);
    fs.rmSync(path.join(staging, owner), { force: true });
    fs.rmdirSync(staging);
  }
}

async function syncBoard(project) {
  const cwd = fs.realpathSync(project);
  if (configured(cwd)) await queueSync(cwd);
}

module.exports = { syncBoard };
