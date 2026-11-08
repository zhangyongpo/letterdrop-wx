// data/book_index.js
// 词库总索引：把六册教材（2024 审定外研剑桥 Join In，三年级起点）统一编号，
// 供 game.js 做年级切换、供 tools/dump_audio_words.js 生成发音清单。
//
// 每册对应一个音频分包（见 game.json 的 subpackages）：
//   g3  -> /subpackages/g3/audio/words/<slug>.mp3    三上
//   g3b -> /subpackages/g3b/audio/words/<slug>.mp3   三下
//   g4  ... g6 同理
// 分包只放发音 mp3；词表 JS 体积极小，留在主包，保证首启即可显示章节列表。
//
// ⚠️ 五下/六下（2027 春新版）教材词汇表尚未公开，暂未收录；
//    网上流传的五下/六下词表均属 2013 审定旧版，已单独存于
//    data/words_b56_legacy.js（不接入游戏），切勿直接加进 BOOKS/GRADES。

const { BOOK } = require('./words');
const { BOOKS_456 } = require('./words_g456');
const { BOOKS_B34 } = require('./words_b34');

const BOOKS = {
  g3: BOOK,
  g3b: BOOKS_B34.g3b,
  g4: BOOKS_456.g4,
  g4b: BOOKS_B34.g4b,
  g5: BOOKS_456.g5,
  g6: BOOKS_456.g6
};

// 年级卡片顺序、显示名与分包名（name 必须与 game.json 的 subpackages.name 一致）
const GRADES = [
  { id: 'g3',  title: '三年级上册', sub: 'Join In · 2024 秋版', pkg: 'g3' },
  { id: 'g3b', title: '三年级下册', sub: 'Join In · 2025 春版', pkg: 'g3b' },
  { id: 'g4',  title: '四年级上册', sub: 'Join In · 2025 秋版', pkg: 'g4' },
  { id: 'g4b', title: '四年级下册', sub: 'Join In · 2026 春版', pkg: 'g4b' },
  { id: 'g5',  title: '五年级上册', sub: 'Join In · 2026 秋版', pkg: 'g5' },
  { id: 'g6',  title: '六年级上册', sub: 'Join In · 2026 秋版', pkg: 'g6' }
];

// 词条 -> 音频文件名。纯单词保持小写；空格转下划线、撇号去掉
// （如 two o'clock -> two_oclock，避免包内路径出现特殊字符）；
// 连字符（如 ping-pong / T-shirt -> t-shirt）保留。
function slug(word) {
  return String(word || '')
    .trim()
    .toLowerCase()
    .replace(/['\u2019]/g, '')
    .replace(/\s+/g, '_');
}

// 某册需要发音的全部词条：{ slug: 原始英文文本 }
// 包含短语（查阅页小喇叭用），拼写练习仍由 game.js 过滤掉含非字母的词条。
function audioWordsFor(gradeId) {
  const book = BOOKS[gradeId];
  const map = {};
  if (!book) return map;
  book.chapters.forEach((ch) => {
    ch.words.forEach((w) => { map[slug(w.en)] = w.en; });
  });
  return map;
}

function audioWordsAll() {
  const out = {};
  GRADES.forEach((g) => { out[g.id] = audioWordsFor(g.id); });
  return out;
}

function packageRoot(gradeId) {
  return '/subpackages/' + gradeId + '/audio/words/';
}

module.exports = { BOOKS, GRADES, slug, audioWordsFor, audioWordsAll, packageRoot };
