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

// 单词真实发音上下文缓存：同一单词复用，反复调用时先 stop 再 play，避免叠加。
const wordCtxMap = {};

// 播放单词真实发音：优先使用 edge-tts 预生成的单词级 mp3（清单 data/word_audio.js 覆盖的词）；
// 清单未覆盖（如尚未生成发音的单元）时，自动回退为逐字母拼读，保证任何单词都能出声。
function speakWord(word) {
  const f = String(word).toLowerCase();
  if (WORD_AUDIO.indexOf(f) < 0) {
    announceWord(word);
    return;
  }
  try {
    let c = wordCtxMap[f];
    if (!c) {
      c = wx.createInnerAudioContext();
      c.src = '/assets/audio/words/' + f + '.mp3';
      c.obeyMuteSwitch = false;
      // 首次播放在“刚切页 / 文件未缓存”时偶尔被静默丢弃；
      // 用 onCanplay 兜底：若加载完成后仍未开始播放，再补一次 play。
      let started = false;
      c.onPlay(() => { started = true; });
      c.onCanplay(() => { if (!started) c.play(); });
      c.onError((res) => {
        console.log('[audio] 单词发音播放失败，回退拼读', f, res && res.errMsg);
        if (wordCtxMap[f] === c) delete wordCtxMap[f];
        announceWord(word);
      });
      wordCtxMap[f] = c;
    }
    c.stop();
    c.play();
  } catch (e) {
    announceWord(word);
  }
}

// iOS 微信小游戏（尤其高版本 iOS / 新版微信）要求音频的“首次播放”必须在用户手势链内触发，
// 否则会被系统静默拦截——表现为低版本 iOS 能出声、高版本 iOS 完全没声、安卓正常。
// 在首次用户触摸时真实播放一次并按住（onPlay 立刻停止，几乎无声），激活 AudioSession，
// 之后所有异步报音（字母掉落自动报音、切页后自动发音）才能正常出声。
let audioUnlocked = false;
function unlockAudio() {
  if (audioUnlocked) return;
  audioUnlocked = true; // 只在首次用户手势内调用一次
  try {
    const c = wx.createInnerAudioContext();
    c.src = '/assets/audio/A.mp3';
    c.obeyMuteSwitch = false;
    // 真实播放一次以激活 iOS AudioSession；拿到 onPlay 立即停，几乎听不到，
    // 但足以让系统音频会话进入“已激活”状态，后续异步 play 不再被拦截。
    c.onPlay(() => { try { c.stop(); } catch (e) {} });
    c.onError(() => { try { c.destroy(); } catch (e) {} });
    c.play();
    setTimeout(() => { try { c.destroy(); } catch (e) {} }, 400); // 兜底释放
  } catch (e) {}
}

module.exports = { speakLetter, announceLetter, announceWord, speakWord, unlockAudio };
