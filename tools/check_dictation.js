// Copyright (c) 2026 zhangyongpo. SPDX-License-Identifier: Apache-2.0
// 本文件为 letterdrop-wx 项目独立开发源码；许可证见 LICENSE，第三方资产声明见 NOTICE.md。
// tools/check_dictation.js —— 单词听写纯逻辑自检（Node 下运行，不进小游戏代码包）。
// 校验：四种发音模式、非法模式回退、循环翻词边界、间隔档位、中文清单与英文清单一一对齐。
const assert = require('assert');
const { buildDictParts, wrapIndex, DICT_MODES } = require('../utils/dictation');
const {
  DICT_INTERVALS, DICT_DEFAULT_INTERVAL_IDX, DICT_GAP_MS, DICT_DEFAULT_MODE
} = require('../config/gameConfig');
const { WORD_AUDIO } = require('../data/word_audio');
const { CN_AUDIO } = require('../data/cn_audio');

let checks = 0;
function ok(cond, msg) { assert.ok(cond, msg); checks++; }

// 1) 四种模式的发音内容与顺序
ok(DICT_MODES.length === 4, '应有 4 种发音模式');
const modes = {
  cn: [{ type: 'cn' }, { type: 'en' }],
  en: [{ type: 'en' }],
  both: [{ type: 'en' }, { type: 'cn' }],
  cnOnly: [{ type: 'cn' }]
};
for (const m of DICT_MODES) {
  const parts = buildDictParts(m, 'apple');
  ok(parts.length === modes[m].length, m + ' 片段数不符');
  ok(parts.every((p, i) => p.type === modes[m][i].type), m + ' 发音顺序不符');
  ok(parts.every((p) => p.en === 'apple'), m + ' 词条未透传');
}
// 「只中文」模式：单个中文片段，且绝不含英文片段
const cnOnlyParts = buildDictParts('cnOnly', 'apple');
ok(cnOnlyParts.length === 1 && cnOnlyParts[0].type === 'cn', '只中文模式应为单个中文片段');
ok(!cnOnlyParts.some((p) => p.type === 'en'), '只中文模式不应含英文发音');
ok(JSON.stringify(buildDictParts('bogus', 'x')) === JSON.stringify(buildDictParts('cn', 'x')),
  '非法模式应回退为 cn');
ok(DICT_DEFAULT_MODE === 'cn' || DICT_MODES.indexOf(DICT_DEFAULT_MODE) >= 0, '默认模式非法');
ok(DICT_GAP_MS >= 200 && DICT_GAP_MS <= 2000, '片段间隔不合理');

// 2) 循环翻词边界
ok(wrapIndex(0, -1, 5) === 4, '首个词的上一个应到末尾');
ok(wrapIndex(4, 1, 5) === 0, '末尾词的下一个应回到开头');
ok(wrapIndex(2, 0, 5) === 2, 'delta=0 应原地');
ok(wrapIndex(0, -7, 5) === 3, '负向多次回绕错误');
ok(wrapIndex(4, 7, 5) === 1, '正向多次回绕错误');
ok(wrapIndex(0, -1, 1) === 0 && wrapIndex(0, 1, 1) === 0, '单条词应恒为 0');
ok(wrapIndex(0, -1, 0) === 0, '空词表应安全返回 0');

// 3) 间隔档位
ok(JSON.stringify(DICT_INTERVALS) === '[5000,10000,15000,30000]', '间隔档位应为 5/10/15/30 秒');
ok(DICT_INTERVALS.every((v, i) => i === 0 || v > DICT_INTERVALS[i - 1]), '间隔应升序');
ok(DICT_DEFAULT_INTERVAL_IDX >= 0 && DICT_DEFAULT_INTERVAL_IDX < DICT_INTERVALS.length,
  '默认间隔下标越界');

// 4) 中文清单与英文清单一一对齐（若中文音频尚未生成，清单为空则跳过并明确提示）
const grades = Object.keys(WORD_AUDIO);
let cnTotal = 0, missing = 0, firstMiss = [];
for (const g of grades) {
  const en = WORD_AUDIO[g] || [];
  const cn = CN_AUDIO[g] || [];
  cnTotal += cn.length;
  const cnSet = new Set(cn);
  for (const slug of en) if (!cnSet.has(slug)) {
    missing++;
    if (firstMiss.length < 5) firstMiss.push(g + '/' + slug);
  }
}
if (cnTotal === 0) {
  console.log('中文清单为空（音频尚未生成），跳过对齐校验；听写将只播英文。');
} else {
  ok(missing === 0, '中文音频清单缺失 ' + missing + ' 条，例：' + firstMiss.join(', '));
  console.log('中文清单与英文清单一一对齐：' + cnTotal + ' 条，缺失 0');
}

console.log('检查项        : ' + checks);
console.log('DICTATION_OK');
