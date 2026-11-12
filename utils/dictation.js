// Copyright (c) 2026 zhangyongpo. SPDX-License-Identifier: Apache-2.0
// 本文件为 letterdrop-wx 项目独立开发源码；许可证见 LICENSE，第三方资产声明见 NOTICE.md。
// utils/dictation.js —— 单词听写的纯逻辑（不依赖平台 API，可在 Node 下单独自检）。
// 只负责「四种发音模式」与「循环翻词下标」，player 侧按返回的 parts 逐段播放即可。

// 发音模式：
//   cn     —— 先读中文释义，再读英文单词（看着中文听、最后揭晓读音）
//   en     —— 只念英文单词（看中文想拼写，最贴近课堂听写）
//   both   —— 先念英文单词，再读中文释义（先听后对答案）
//   cnOnly —— 只念中文释义（屏幕已给出中文，仅作听音巩固，不读英文）
const DICT_MODES = ['cn', 'en', 'both', 'cnOnly'];

// 构造发音序列。parts: [{type:'cn'|'en', en:'词条英文'}]，中文片段按同 slug 查 audio/cn/。
// 未知 mode 一律回退为 'cn'，保证任何情况下都有声音。
function buildDictParts(mode, en) {
  const word = String(en || '');
  if (mode === 'en') return [{ type: 'en', en: word }];
  if (mode === 'cnOnly') return [{ type: 'cn', en: word }];
  if (mode === 'both') return [{ type: 'en', en: word }, { type: 'cn', en: word }];
  return [{ type: 'cn', en: word }, { type: 'en', en: word }]; // 'cn' 及非法值
}

// 循环翻词：delta=1 下一个、-1 上一个、0 原地；到头/到尾回绕。
// n=0 时返回 0，调用方据此判定空词表并跳过播放。
function wrapIndex(index, delta, n) {
  if (!n || n <= 0) return 0;
  return ((((Number(index) || 0) + (Number(delta) || 0)) % n) + n) % n;
}

module.exports = { DICT_MODES, buildDictParts, wrapIndex };
