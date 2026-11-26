'use strict';

const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { parseEnv } = require('node:util');

const mutations = new Set([
  'add_task', 'move_task', 'delete_task', 'propose_done', 'approve_done', 'reject_review'
].flatMap(name => [
  `mcp__kanbanger__${name}`,
  `mcp__plugin_kanbanger_kanbanger__${name}`
]));

async function readEvent() {
  const timer = setTimeout(() => process.stdin.destroy(), 5000);
  let json = '';
  try {
    process.stdin.setEncoding('utf8');
    for await (const chunk of process.stdin) {
      if (json.length + chunk.length > 1024 * 1024) return null;
      json += chunk;
    }
    return JSON.parse(json);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function main() {
  const input = await readEvent();
  if (!mutations.has(input?.tool_name || input?.tool)) return;

  const cwd = process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd();
  const board = '_kanban.md';
  const dotenv = path.join(cwd, '.env');
  if (!fs.statSync(path.join(cwd, board), { throwIfNoEntry: false })?.isFile() ||
      !fs.statSync(dotenv, { throwIfNoEntry: false })?.isFile()) return;

  // The project selects the destination. The CLI reads .env with override enabled.
  const config = parseEnv(fs.readFileSync(dotenv, 'utf8'));
  const token = config.GITHUB_TOKEN ?? process.env.GITHUB_TOKEN;
  if (!config.GITHUB_REPO?.trim() || !token?.trim()) return;

  const result = spawnSync('kanban-sync', [board], {
    cwd,
    stdio: 'ignore',
    windowsHide: true,
    timeout: 110000,
    killSignal: 'SIGKILL'
  });
  if (result.error || result.status !== 0) {
    const reason = result.error?.code || result.signal || `exit ${result.status}`;
    console.error(`[kanban-github-sync] kanban-sync failed (${reason}).`);
  }
}

main().catch(() => console.error('[kanban-github-sync] Could not sync the project board.'));
