/**
 * Kanban Mover - Move a task from ## DOING to ## REVIEW in _kanban.md.
 *
 * Pure Node, no deps. Per kanbanger-partymix LLM_GUIDANCE.md format rules:
 *   - Level 2 headers (## COLUMN), case-insensitive, may be numbered (## 1. DOING)
 *   - Task format: `*   [ ] Task title`  (asterisk + 3 spaces + checkbox)
 *   - REVIEW sits between DOING and DONE in canonical 5-column boards
 *     (confirmed in kanbanger-partymix/kanban_io.py:ensure_review_column).
 *
 * Idempotent: when the task is already in ## REVIEW, no-op and report moved=false.
 */

const fs = require('fs');

const SOURCE_COLUMN = 'DOING';
const TARGET_COLUMN = 'REVIEW';
const DONE_COLUMN = 'DONE';
const TASK_LINE_PATTERN = /^\*\s{3}\[\s\]\s+(.+?)\s*$/;

function parseKanban(content) {
  const lines = content.split('\n');
  const preamble = [];
  const sections = [];
  let current = null;

  for (const line of lines) {
    const m = line.match(/^##\s+(?:\d+\.\s*)?(.+?)\s*$/);
    if (m) {
      if (current) sections.push(current);
      current = { header: m[1].trim().toUpperCase(), headerLine: line, body: [] };
    } else if (current === null) {
      preamble.push(line);
    } else {
      current.body.push(line);
    }
  }
  if (current) sections.push(current);
  return { preamble, sections };
}

function serializeKanban(parsed) {
  const out = [...parsed.preamble];
  for (const s of parsed.sections) {
    out.push(s.headerLine, ...s.body);
  }
  return out.join('\n');
}

function findTaskIndex(body, taskTitle) {
  const norm = taskTitle.trim();
  for (let i = 0; i < body.length; i++) {
    const m = body[i].match(TASK_LINE_PATTERN);
    if (m && m[1].trim() === norm) return i;
  }
  return -1;
}

function findInColumn(parsed, taskTitle, columnName) {
  const s = parsed.sections.find(x => x.header === columnName);
  return s ? findTaskIndex(s.body, taskTitle) : -1;
}

function moveTask(content, taskTitle) {
  const parsed = parseKanban(content);

  if (findInColumn(parsed, taskTitle, TARGET_COLUMN) >= 0) {
    return { content, moved: false, reason: `already in ${TARGET_COLUMN}` };
  }

  const source = parsed.sections.find(s => s.header === SOURCE_COLUMN);
  if (!source) return { content, moved: false, reason: `no ## ${SOURCE_COLUMN} column` };

  const idx = findTaskIndex(source.body, taskTitle);
  if (idx < 0) return { content, moved: false, reason: `task not found in ${SOURCE_COLUMN}` };

  const [taskLine] = source.body.splice(idx, 1);

  let target = parsed.sections.find(s => s.header === TARGET_COLUMN);
  if (!target) {
    target = { header: TARGET_COLUMN, headerLine: `## ${TARGET_COLUMN}`, body: ['', ''] };
    const doneIdx = parsed.sections.findIndex(s => s.header === DONE_COLUMN);
    if (doneIdx >= 0) parsed.sections.splice(doneIdx, 0, target);
    else parsed.sections.push(target);
  }

  // Place the task. For an all-blank body (freshly created column, or
  // an empty existing one), seed the conventional `<header><blank><task><blank>`
  // shape. Otherwise insert before any trailing blanks to preserve the
  // separator from the following column.
  if (target.body.every(l => l.trim() === '')) {
    target.body = ['', taskLine, ''];
  } else {
    let insertAt = target.body.length;
    while (insertAt > 0 && target.body[insertAt - 1].trim() === '') insertAt--;
    target.body.splice(insertAt, 0, taskLine);
  }

  return { content: serializeKanban(parsed), moved: true, reason: `${SOURCE_COLUMN}->${TARGET_COLUMN}` };
}

function moveTaskInFile(kanbanPath, taskTitle) {
  if (!fs.existsSync(kanbanPath)) return { moved: false, reason: 'kanban file not found', kanbanPath };
  const content = fs.readFileSync(kanbanPath, 'utf8');
  const result = moveTask(content, taskTitle);
  if (!result.moved) return { moved: false, reason: result.reason, kanbanPath };

  const tmp = kanbanPath + '.tmp';
  fs.writeFileSync(tmp, result.content, 'utf8');
  fs.renameSync(tmp, kanbanPath);
  return { moved: true, reason: result.reason, kanbanPath };
}

module.exports = { moveTask, moveTaskInFile, parseKanban, serializeKanban };
