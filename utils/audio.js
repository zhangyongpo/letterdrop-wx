// Copyright (c) 2026 zhangyongpo. SPDX-License-Identifier: Apache-2.0
// 本文件为 letterdrop-wx 项目独立开发源码；许可证见 LICENSE，第三方资产声明见 NOTICE.md。
// utils/audio.js
// 播放字母 A~Z 的读音（主包 /assets/audio/<字母>.mp3）与单词真实发音（年级分包内 mp3）。
// 全部资源随包分发、下载后由客户端本地缓存，完全离线，无网络请求 / 无后端。
//
// 分包结构见各端 game.json：g3/g3b/g4/g4b/g5/g6 各自只放该册的单词发音 mp3，
// 主包保留字体与 A~Z.mp3（找字母模式首启必需）。进入某册前由
// game.js 调用 loadGradeAudio() 触发平台分包加载，成功后才能播放该册音频。

const { WORD_AUDIO } = require('../data/word_audio');
const { slug, packageRoot } = require('../data/book_index');
const adapter = require('../platform/adapter');

const ctxMap = {};

// 当前正在播放的单词音频：快速连点不同卡片时先停上一条，避免多个发音叠在一起
let activeWordCtx = null;
// 逐字母拼读回退链的代号：新的一次点读会让旧链自行终止
let fallbackGen = 0;

// 统一创建音频上下文：按平台优先顺序设置包内路径，加载失败时自动换下一种写法重试。
// 微信端优先 '/assets/...'（历史行为不变）；抖音端优先 'assets/...'（官方教程写法，
// PC 模拟器下前导斜杠会被当成站点根 URL 而 404）。全部候选失败才回调 onFinalError。
// 每次失败都会打印实际尝试的路径，便于在开发者工具 Console 里定位。
function createCtx(pkgPath, onFinalError) {
  const c = adapter.createInnerAudioContext();
  const candidates = adapter.audioSrcCandidates
    ? adapter.audioSrcCandidates(pkgPath)
    : [pkgPath];
  let idx = 0;
  c.src = candidates[0];
  c.obeyMuteSwitch = false; // 静音模式下也播报，方便孩子使用
  c.onError((res) => {
    console.log('[audio] 路径加载失败', candidates[idx], res && (res.errMsg || res.errCode));
    idx += 1;
    if (idx < candidates.length) {
      try {
        c.stop();
        c.src = candidates[idx];
        c.play();
      } catch (e) {}
      return;
    }
    if (onFinalError) {
      try { onFinalError(res, c); } catch (e) { console.log('[audio] 失败回调异常', e); }
    }
  });
  return c;
}

function letterSrc(up) { return '/assets/audio/' + up + '.mp3'; }

function getCtx(letter) {
  const up = String(letter).toUpperCase();
  if (!ctxMap[up]) {
    ctxMap[up] = createCtx(letterSrc(up));
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
      const c = createCtx(letterSrc(up), (res, ctx) => {
        try { ctx.destroy(); } catch (e) {}
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

// 逐字母拼读回退：跳过空格/连字符，只念字母名（短语也能有声音反馈）。
// 用于分包尚未加载、或个别词条没有预生成发音时，保证任何单词都能出声。
function announceWord(word, gapMs) {
  // 新的一次点读先终止上一条尚未播完的拼读链，避免连点时字母音叠加
  const gen = ++fallbackGen;
  if (activeWordCtx) {
    try { activeWordCtx.stop(); } catch (e) {}
    activeWordCtx = null;
  }
  const letters = String(word).toLowerCase().replace(/[^a-z]/g, '').split('');
  const gap = typeof gapMs === 'number' ? gapMs : 260;
  let i = 0;
  const playNext = () => {
    if (gen !== fallbackGen || i >= letters.length) return;
    const up = letters[i].toUpperCase();
    i += 1;
    try {
      const c = createCtx(letterSrc(up), (res, ctx) => {
        try { ctx.destroy(); } catch (e) {}
        setTimeout(playNext, gap);
      });
      c.onEnded(() => { c.destroy(); setTimeout(playNext, gap); });
      c.play();
    } catch (e) {
      setTimeout(playNext, gap);
    }
  };
  playNext();
}

// ---- 年级分包状态 ----
let currentGrade = 'g3';
const readyMap = {};     // grade -> 是否已加载完成
const loadingMap = {};   // grade -> 等待中的回调数组（避免重复触发下载）

function setGrade(g) { currentGrade = g || 'g3'; }
function getGrade() { return currentGrade; }
function isGradeReady(g) { return !!readyMap[g || currentGrade]; }

// 触发某年级音频分包下载；已加载则立即成功。
// onProgress(percent) / onSuccess() / onFail(errMsg) 均为可选回调。
function loadGradeAudio(g, onProgress, onSuccess, onFail) {
  const grade = g || currentGrade;
  const cb = { onProgress, onSuccess, onFail };
  if (readyMap[grade]) { if (onSuccess) onSuccess(); return; }

  // 客户端不支持分包加载时（老版本基础库）：后台会下发整包兼容版，
  // 目录结构保持不变，直接按路径播放即可。
  if (typeof adapter.loadSubpackage !== 'function') {
    readyMap[grade] = true;
    if (onSuccess) onSuccess();
    return;
  }

  if (loadingMap[grade]) { loadingMap[grade].push(cb); return; }
  const cbs = [cb];
  loadingMap[grade] = cbs;

  const finish = (ok, errMsg) => {
    const list = loadingMap[grade] || [];
    delete loadingMap[grade];
    if (ok) readyMap[grade] = true;
    list.forEach((c) => {
      try {
        if (ok) {
          if (c.onProgress) c.onProgress(100);
          if (c.onSuccess) c.onSuccess();
        } else if (c.onFail) {
          c.onFail(errMsg || '下载失败');
        }
      } catch (e) { console.log('[audio] 分包回调异常', e); }
    });
  };

  try {
    const task = adapter.loadSubpackage({
      name: grade,
      success: () => finish(true),
      fail: (res) => finish(false, (res && res.errMsg) || '下载失败')
    });
    if (task && task.onProgressUpdate) {
      task.onProgressUpdate((res) => {
        (loadingMap[grade] || []).forEach((c) => {
          try { if (c.onProgress) c.onProgress(res.progress || 0); } catch (e) {}
        });
      });
    }
  } catch (e) {
    finish(false, String(e));
  }
}

// 单词真实发音上下文缓存：按「年级 + 词条」复用，反复调用时先 stop 再 play。
const wordCtxMap = {};

// 播放单词真实发音：优先播分包内 edge-tts 预生成的 mp3；
// 分包未加载 / 清单未覆盖 / 播放失败时回退为逐字母拼读。
function speakWord(word) {
  const f = slug(word);
  const list = (WORD_AUDIO && WORD_AUDIO[currentGrade]) || [];
  if (list.indexOf(f) < 0 || !readyMap[currentGrade]) {
    announceWord(word);
    return;
  }
  const key = currentGrade + ':' + f;
  try {
    let c = wordCtxMap[key];
    if (!c) {
      c = createCtx(packageRoot(currentGrade) + f + '.mp3', (res, ctx) => {
        console.log('[audio] 单词发音所有路径均失败，回退拼读', f, res && res.errMsg);
        if (wordCtxMap[key] === ctx) delete wordCtxMap[key];
        announceWord(word);
      });
      // 首次播放在「刚切页 / 文件未缓存」时偶尔被静默丢弃；
      // 用 onCanplay 兜底：若加载完成后仍未开始播放，再补一次 play。
      let started = false;
      c.onPlay(() => { started = true; });
      c.onCanplay(() => { if (!started) c.play(); });
      wordCtxMap[key] = c;
    }
    // 切到不同单词时先停掉上一条；同一单词则是重播（配对成功时完整念一遍）
    if (activeWordCtx && activeWordCtx !== c) {
      try { activeWordCtx.stop(); } catch (e) {}
    }
    activeWordCtx = c;
    c.stop();
    c.play();
  } catch (e) {
    announceWord(word);
  }
}

// iOS 微信小游戏（尤其高版本 iOS / 新版微信）要求音频的「首次播放」必须在用户手势链内触发，
// 否则会被系统静默拦截——表现为低版本 iOS 能出声、高版本 iOS 完全没声、安卓正常。
// 在首次用户触摸时真实播放一次并按住（onPlay 立刻停止，几乎无声），激活 AudioSession。
let audioUnlocked = false;
function unlockAudio() {
  if (audioUnlocked) return;
  audioUnlocked = true; // 只在首次用户手势内调用一次
  try {
    const c = createCtx(letterSrc('A'), (res, ctx) => {
      try { ctx.destroy(); } catch (e) {}
    });
    c.onPlay(() => { try { c.stop(); } catch (e) {} });
    c.play();
    setTimeout(() => { try { c.destroy(); } catch (e) {} }, 400); // 兜底释放
  } catch (e) {}
}

module.exports = {
  speakLetter, announceLetter, announceWord, speakWord, unlockAudio,
  setGrade, getGrade, isGradeReady, loadGradeAudio
};
