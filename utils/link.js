// Copyright (c) 2026 zhangyongpo. SPDX-License-Identifier: Apache-2.0
// 本文件为 letterdrop-wx 项目独立开发源码；许可证见 LICENSE，第三方资产声明见 NOTICE.md。
// utils/link.js —— 字母连连的纯算法：为单词在网格内生成字母路径
// 不依赖 wx / Canvas 等平台 API，可单独在 Node 下运行与测试。
// 网格为 rows 行 × cols 列（竖屏下行多于列），格子下标 idx = r * cols + c。

const DIRS = [[0, 1], [0, -1], [1, 0], [-1, 0]]; // 右 / 左 / 下 / 上

// 生成一条四邻接、不自交、不与已占用格冲突的路径；最多一次转弯（L 形）。
// cols/rows：网格列数/行数；len：单词长度；occupied：已占用格子下标 Set；
// rand：可注入随机函数便于测试。成功返回格子下标数组，失败返回 null。
function buildPath(cols, rows, len, occupied, rand) {
  const R = rand || Math.random;
  const taken = occupied || new Set();
  for (let attempt = 0; attempt < 300; attempt++) {
    let r = Math.floor(R() * rows);
    let c = Math.floor(R() * cols);
    const d0 = DIRS[Math.floor(R() * DIRS.length)];
    const turnAt = (len >= 3 && R() < 0.55)
      ? 1 + Math.floor(R() * (len - 2)) : len;
    let d1 = d0;
    if (turnAt < len) {
      const perp = Math.abs(d0[0]) > 0 ? [[0, 1], [0, -1]] : [[1, 0], [-1, 0]];
      d1 = perp[Math.floor(R() * perp.length)];
    }
    const cells = [];
    const used = new Set();
    let ok = true;
    for (let k = 0; k < len; k++) {
      if (r < 0 || r >= rows || c < 0 || c >= cols) { ok = false; break; }
      const idx = r * cols + c;
      if (used.has(idx) || taken.has(idx)) { ok = false; break; }
      used.add(idx);
      cells.push(idx);
      if (k < len - 1) {
        const d = (k + 1 < turnAt) ? d0 : d1;
        r += d[0]; c += d[1];
      }
    }
    if (ok && cells.length === len) return cells;
  }
  return null;
}

// 校验路径：全部格子在界内、无重复、相邻两格上下左右相邻（曼哈顿距离为 1）
function isValidPath(cells, cols, rows) {
  if (!Array.isArray(cells) || cells.length === 0) return false;
  const used = new Set();
  for (let k = 0; k < cells.length; k++) {
    const idx = cells[k];
    if (!Number.isInteger(idx) || idx < 0 || idx >= cols * rows) return false;
    if (used.has(idx)) return false;
    used.add(idx);
    if (k > 0) {
      const a = cells[k - 1], b = idx;
      const d = Math.abs(Math.floor(a / cols) - Math.floor(b / cols)) +
                Math.abs((a % cols) - (b % cols));
      if (d !== 1) return false;
    }
  }
  return true;
}

module.exports = { DIRS, buildPath, isValidPath };
