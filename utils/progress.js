// Copyright (c) 2026 zhangyongpo. SPDX-License-Identifier: Apache-2.0
// 本文件为 letterdrop-wx 项目独立开发源码；许可证见 LICENSE，第三方资产声明见 NOTICE.md。
// utils/progress.js
// 学习进度：错词本 + 基础统计（练习次数 / 答对次数 / 掌握词数）。
// 数据全部存本地 Storage，单一 JSON key，纯逻辑不依赖 Canvas；可在 Node 下自检。
// 错词按「年级 + 英文小写」去重，记录错误次数与最近中文释义，供「错词复习」入口使用。

const adapter = require('../platform/adapter');

const STORE_KEY = 'letter_progress_v1';

// 内存态：{ wrong: { "g3:apple": { en, cn, grade, n } }, stats: { practice, correct } }
let data = load();

function blank() {
  return { wrong: {}, stats: { practice: 0, correct: 0 } };
}

function load() {
  try {
    const raw = adapter.getStorageSync(STORE_KEY);
    if (!raw) return blank();
    const obj = (typeof raw === 'string') ? JSON.parse(raw) : raw;
    if (!obj || typeof obj !== 'object') return blank();
    return {
      wrong: (obj.wrong && typeof obj.wrong === 'object') ? obj.wrong : {},
      stats: {
        practice: Number(obj.stats && obj.stats.practice) || 0,
        correct: Number(obj.stats && obj.stats.correct) || 0
      }
    };
  } catch (e) {
    return blank();
  }
}

function save() {
  try {
    adapter.setStorageSync(STORE_KEY, JSON.stringify(data));
  } catch (e) {
    // 存储失败不影响游戏进行，仅放弃持久化
  }
}

function keyOf(grade, en) {
  return String(grade || '') + ':' + String(en || '').toLowerCase();
}

// 记录一次作答。correct=true 时：若该词在错词本中则降低权重（n-1，降到 0 移除），
// correct=false 时：加入/累加错词。practice 恒 +1，correct 按结果 +1。
function record(grade, en, cn, correct) {
  if (!en) return;
  const k = keyOf(grade, en);
  data.stats.practice += 1;
  if (correct) {
    data.stats.correct += 1;
    const w = data.wrong[k];
    if (w) {
      w.n -= 1;
      if (w.n <= 0) delete data.wrong[k];
    }
  } else {
    const w = data.wrong[k];
    if (w) {
      w.n += 1;
      if (cn) w.cn = cn;
    } else {
      data.wrong[k] = { en: String(en).toLowerCase(), cn: cn || en, grade: grade || '', n: 1 };
    }
  }
  save();
}

function recordCorrect(grade, en, cn) { record(grade, en, cn, true); }
function recordWrong(grade, en, cn) { record(grade, en, cn, false); }

// 返回错词本（按错误次数降序），元素 {en, cn, grade, n}
function getWrongWords() {
  return Object.keys(data.wrong)
    .map((k) => data.wrong[k])
    .sort((a, b) => b.n - a.n);
}

function getStats() {
  return {
    practice: data.stats.practice,
    correct: data.stats.correct,
    wrongKinds: Object.keys(data.wrong).length
  };
}

function clearAll() {
  data = blank();
  save();
}

// 供自检/测试注入重置内存态（不写盘）
function _reset() { data = blank(); }

module.exports = {
  record, recordCorrect, recordWrong, getWrongWords, getStats, clearAll, _reset, STORE_KEY
};
