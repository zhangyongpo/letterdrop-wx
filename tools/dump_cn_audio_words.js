// Copyright (c) 2026 zhangyongpo. SPDX-License-Identifier: Apache-2.0
// 本文件为 letterdrop-wx 项目独立开发源码；许可证见 LICENSE，第三方资产声明见 NOTICE.md。
// tools/dump_cn_audio_words.js
// 供 gen_cn_audio.py 调用：按年级输出 {slug: 中文 TTS 文本}，与英文发音清单一一对应。
// 数据源仍是 data/*.js（单一数据源），按 slug 去重后与 tools/dump_audio_words.js 的键集合一致。
// 用法：node tools/dump_cn_audio_words.js > cn_words.json

const { BOOKS, GRADES, slug } = require('../data/book_index');

// 中文释义含括号补充、分号、省略号等，直接交给 TTS 会读成「括号」「分号」或长时间停顿。
// 这里只清洗用于「朗读」的文本，屏幕上显示的释义仍用词表原文，不受影响。
function ttsText(cn) {
  let s = String(cn || '').trim();
  s = s.replace(/[（(][^）)]*[）)]/g, '');        // 去掉括号及其补充说明
  s = s.replace(/[;；/]/g, '，');
  s = s.replace(/[、,]/g, '，');
  s = s.replace(/[…．.]{2,}/g, '，');
  s = s.replace(/[：:]/g, '，');
  s = s.replace(/\s+/g, ' ').replace(/^[，\s]+|[，\s]+$/g, '');
  return s || String(cn || '').trim();            // 极端情况回退原文
}

const out = {};
GRADES.forEach((g) => {
  const map = {};
  const book = BOOKS[g.id];
  if (book) {
    book.chapters.forEach((ch) => {
      ch.words.forEach((w) => {
        const key = slug(w.en);
        if (key && !(key in map)) map[key] = ttsText(w.cn);
      });
    });
  }
  out[g.id] = map;
});

process.stdout.write(JSON.stringify(out));
