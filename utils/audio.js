// utils/audio.js
// 离线播放字母发音：使用包内预录的 wav 文件，无需插件 / 云端 / 网络。
// 文件位于 /assets/audio/<字母>.wav（绝对包路径，真机可用）。
// 彻底替代原先的腾讯云 ASR 方案——游戏改为“App 报字母、玩家点击”。

const { WORD_AUDIO } = require('../data/word_audio');

const ctxMap = {};

function getCtx(letter) {
  const up = String(letter).toUpperCase();
  if (!ctxMap[up]) {
    const c = wx.createInnerAudioContext();
    c.src = '/assets/audio/' + up + '.mp3';
    c.obeyMuteSwitch = false; // 静音模式下也播报，方便孩子使用
    c.onError((res) => {
      console.log('[audio] 播放失败', up, res && res.errMsg);
    });
    ctxMap[up] = c;
  }
  return ctxMap[up];
}

// 播报某个字母的读音
function speakLetter(letter) {
  try {
    const c = getCtx(letter);
    c.stop();   // 先停止，避免快速连播叠加
    c.play();
  } catch (e) {
    console.log('[audio] speakLetter 异常', e);
  }
}

// 播报两遍：第一遍自然结束后，间隔 gapMs 再播第二遍。
// 每遍使用独立的临时 InnerAudioContext，避免复用 stop/play 截断上一遍。
function announceLetter(letter, gapMs) {
  const up = String(letter).toUpperCase();
  const gap = typeof gapMs === 'number' ? gapMs : 600;
  let played = 0;
  const playOne = () => {
    try {
      const c = wx.createInnerAudioContext();
      c.src = '/assets/audio/' + up + '.mp3';
      c.obeyMuteSwitch = false;
      c.onError((res) => {
        console.log('[audio] 播放失败', up, res && res.errMsg);
        c.destroy();
      });
      c.onEnded(() => {
        played += 1;
        c.destroy();
        if (played < 2) setTimeout(playOne, gap); // 间隔后播第二遍
      });
      c.play();
    } catch (e) {
      console.log('[audio] announceLetter 异常', e);
    }
  };
  playOne();
}

// 拼读整个单词：逐字母播放包内字母发音（A.mp3 等），每个字母间间隔 gapMs。
// 用于“拼单词”模式——目前仅有单字母音频，故以“字母名逐个念”的方式朗读单词，
// 无需任何云端 / 网络 / 额外音频文件。若日后需要真实单词发音，可替换为单词级 mp3。
function announceWord(word, gapMs) {
  const letters = String(word).toLowerCase().split('');
  const gap = typeof gapMs === 'number' ? gapMs : 260;
  let i = 0;
  const playNext = () => {
    if (i >= letters.length) return;
    const up = letters[i].toUpperCase();
    i += 1;
    try {
      const c = wx.createInnerAudioContext();
      c.src = '/assets/audio/' + up + '.mp3';
      c.obeyMuteSwitch = false;
      c.onError(() => { c.destroy(); setTimeout(playNext, gap); });
      c.onEnded(() => { c.destroy(); setTimeout(playNext, gap); });
      c.play();
    } catch (e) {
      setTimeout(playNext, gap);
    }
  };
  playNext();
}

// 播放单词真实发音：优先使用 edge-tts 预生成的单词级 mp3（清单 data/word_audio.js 覆盖的词）；
// 清单未覆盖（如尚未生成发音的单元）时，自动回退为逐字母拼读，保证任何单词都能出声。
function speakWord(word) {
  const f = String(word).toLowerCase();
  if (WORD_AUDIO.indexOf(f) < 0) {
    announceWord(word);
    return;
  }
  try {
    const c = wx.createInnerAudioContext();
    c.src = '/assets/audio/words/' + f + '.mp3';
    c.obeyMuteSwitch = false;
    c.onError((res) => {
      console.log('[audio] 单词发音播放失败，回退拼读', f, res && res.errMsg);
      c.destroy();
      announceWord(word);
    });
    c.onEnded(() => { c.destroy(); });
    c.play();
  } catch (e) {
    announceWord(word);
  }
}

module.exports = { speakLetter, announceLetter, announceWord, speakWord };
