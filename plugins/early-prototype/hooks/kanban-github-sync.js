'use strict';

const { syncBoard } = require('./lib/github-sync');

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

function rejected(result) {
  if (typeof result === 'string') {
    try { return rejected(JSON.parse(result)); } catch { return false; }
  }
  if (Array.isArray(result)) return result.some(rejected);
  if (!result || typeof result !== 'object') return false;
  return result.success === false || result.isError === true ||
    rejected(result.structuredContent) || rejected(result.content) ||
    (result.type === 'text' && rejected(result.text));
}

async function main() {
  const input = await readEvent();
  if (!mutations.has(input?.tool_name || input?.tool) || rejected(input.tool_response)) return;
  await syncBoard(process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd());
}

main().catch(() => console.error('[kanban-github-sync] Could not sync the project board.'));
