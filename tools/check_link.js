// Copyright (c) 2026 zhangyongpo. SPDX-License-Identifier: Apache-2.0
// tools/check_link.js —— 字母连连算法自检（Node 下运行，不进小游戏代码包）
// 用法：node tools/check_link.js
// 校验两部分：
//   1) 路径：四邻接、不越界、不自交、不与已放置词冲突、最多一次转弯、可按路径回读出单词；
//   2) 动态选词：按单词长度决定每局词数，短词多放、长词少放，数量与占格均落在预期区间。

const { buildPath, isValidPath } = require('../utils/link');

const COLS = 6;              // 与 config/gameConfig.js 的 LINK_GRID_COLS 保持一致
const ROWS = 8;              // 与 LINK_GRID_ROWS 保持一致
const WORD_MIN = 4;          // 与 LINK_WORD_MIN 保持一致
const WORD_MAX = 8;          // 与 LINK_WORD_MAX 保持一致
const FILL_RATIO = 0.62;    // 与 LINK_FILL_RATIO 保持一致
const ROUNDS = 600;

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const cellBudget = Math.round(COLS * ROWS * FILL_RATIO);
const maxTries = 120;        // 与 startLink 的候选尝试上限一致
const MODES = [
  { name: '短词章节 2~3 字母', lo: 2, hi: 3 },
  { name: '混合章节 2~8 字母', lo: 2, hi: 8 },
  { name: '长词章节 6~8 字母', lo: 6, hi: 8 },
];

let failures = 0;
let straight = 0;            // 纯横/竖路径数
let bent = 0;                // 带一次转弯路径数
const stats = MODES.map(() => ({ rounds: 0, words: 0, cells: 0, minWords: Infinity, maxWords: 0 }));

function dirChanges(cells) {
  let n = 0;
  for (let j = 2; j < cells.length; j++) {
    const a = cells[j - 2], b = cells[j - 1], c = cells[j];
    const d1 = [Math.floor(b / COLS) - Math.floor(a / COLS), (b % COLS) - (a % COLS)];
    const d2 = [Math.floor(c / COLS) - Math.floor(b / COLS), (c % COLS) - (b % COLS)];
    if (d1[0] !== d2[0] || d1[1] !== d2[1]) n++;
  }
  return n;
}

for (let round = 0; round < ROUNDS; round++) {
  const mi = round % MODES.length;
  const mode = MODES[mi];
  const occupied = new Set();
  const grid = new Array(COLS * ROWS).fill('');
  const targets = [];
  let tries = 0;

  // 与 startLink 完全相同的收手条件
  while (true) {
    if (targets.length >= WORD_MAX) break;
    if (targets.length >= WORD_MIN && occupied.size >= cellBudget) break;
    if (++tries > maxTries) break;

    const len = mode.lo + Math.floor(Math.random() * (mode.hi - mode.lo + 1));
    const cells = buildPath(COLS, ROWS, len, occupied);
    if (!cells) continue;                       // 放不下就跳过，与 startLink 行为一致
    if (!isValidPath(cells, COLS, ROWS)) { failures++; console.error('非法路径', cells); break; }
    if (cells.some((i) => occupied.has(i))) { failures++; console.error('与已占位冲突', cells); break; }

    const changes = dirChanges(cells);
    if (changes > 1) { failures++; console.error('转弯超过一次', cells); break; }
    if (changes === 1) bent++; else straight++;

    let word = '';
    for (let j = 0; j < len; j++) word += LETTERS[Math.floor(Math.random() * LETTERS.length)];
    cells.forEach((idx, j) => { grid[idx] = word[j]; occupied.add(idx); });
    targets.push({ word, cells });
  }

  for (const t of targets) {
    const read = t.cells.map((i) => grid[i]).join('');
    if (read !== t.word) { failures++; console.error('回读不一致', read, t.word); break; }
  }
  if (occupied.size > COLS * ROWS) { failures++; console.error('占格超出网格容量'); }
  if (targets.length > WORD_MAX) { failures++; console.error('词数超过上限'); }

  // 模拟干扰字母填充后，网格应无空格
  for (let i = 0; i < grid.length; i++) {
    if (!grid[i]) grid[i] = LETTERS[Math.floor(Math.random() * LETTERS.length)];
  }
  if (grid.some((x) => !x)) { failures++; console.error('存在未填充格子'); }

  const s = stats[mi];
  s.rounds++; s.words += targets.length; s.cells += occupied.size;
  s.minWords = Math.min(s.minWords, targets.length);
  s.maxWords = Math.max(s.maxWords, targets.length);
}

// isValidPath 应能拒绝明显非法输入（含跨行折返）
const bad = [
  [0, 2],            // 不相邻
  [0, 0],            // 重复
  [COLS - 1, COLS],  // 行尾到下一行行首：视觉相邻但曼哈顿距离不是 1
  [-1],              // 越界
  null,              // 非数组
];
bad.forEach((cells) => {
  if (isValidPath(cells, COLS, ROWS)) { failures++; console.error('未拒绝非法输入', cells); }
});

console.log('网格            : ' + ROWS + ' 行 × ' + COLS + ' 列 = ' + (COLS * ROWS) + ' 格，预算 ' + cellBudget + ' 格');
console.log('轮数            : ' + ROUNDS);
MODES.forEach((m, i) => {
  const s = stats[i];
  console.log(m.name + '：平均 ' + (s.words / s.rounds).toFixed(1) + ' 词（' +
    s.minWords + '~' + s.maxWords + '），平均占格 ' + (s.cells / s.rounds).toFixed(0) +
    '/' + (COLS * ROWS) + '，中文约 ' + Math.ceil(s.words / s.rounds / 2) + ' 行');
});
console.log('纯横/竖路径     : ' + straight);
console.log('带一次转弯路径  : ' + bent);
console.log('非法/失败次数   : ' + failures);
if (bent === 0 || straight === 0) { console.error('路径形态不全（应同时有直线与折线）'); failures++; }
// 短词章节应比长词章节放得更多，验证「按词长动态调整」确实生效
if (stats[0].words / stats[0].rounds <= stats[2].words / stats[2].rounds) {
  console.error('动态选词未生效：短词章节词数未多于长词章节'); failures++;
}
console.log(failures === 0 ? 'LINK_ALGO_OK' : 'LINK_ALGO_FAILED');
process.exit(failures === 0 ? 0 : 1);
