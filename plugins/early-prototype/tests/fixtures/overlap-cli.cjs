'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { setTimeout: delay } = require('node:timers/promises');

// Both hooks launch this copy of Node as the CLI. Snapshot the board and state
// before the first remote write, as Kanbanger does when building its sync plan.
async function sync() {
  const board = fs.readFileSync('_kanban.md', 'utf8');
  const tasks = fs.existsSync('.kanban.json') ? JSON.parse(fs.readFileSync('.kanban.json')).tasks : {};
  if (process.env.FIRST) {
    fs.writeFileSync('snapshot', '');
    await delay(1500);
  }
  let status;
  for (const line of board.split(/\r?\n/)) {
    if (line.startsWith('## ')) status = line.slice(3);
    const title = line.match(/^\* +\[ \] (.+)$/)?.[1];
    if (!title) continue;
    if (!tasks[title]) {
      const item_id = process.pid + '-' + title;
      fs.appendFileSync('cards', JSON.stringify({ title, item_id }) + '\n');
      tasks[title] = { item_id };
    }
    tasks[title].status = status;
  }
  fs.writeFileSync('.kanban.json', JSON.stringify({ tasks }));
}

if (/^kanban-sync(?:\.exe)?$/.test(path.basename(process.execPath))) {
  require.extensions['.md'] = () => {};
  sync();
}
