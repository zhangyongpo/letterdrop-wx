// tools/dump_audio_words.js
// 供 gen_words_audio.py 调用：把四个年级需要的发音词条（slug -> 原文）输出为 JSON。
// 单一数据源为 data/*.js，避免 Python 侧再维护一份词表。
// 用法：node tools/dump_audio_words.js > words.json
const { audioWordsAll } = require('../data/book_index');
process.stdout.write(JSON.stringify(audioWordsAll()));
