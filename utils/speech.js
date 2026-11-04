// utils/speech.js
// 语音识别接口：优先使用微信「同声传译」插件（WechatSI），不可用时降级为"点击消除"模式。
// 对应安卓版 Vosk 离线识别 + 点字模式降级。
//
// 接入真·语音识别的步骤：
//   1. 在微信公众平台 -> 设置 -> 第三方设置 -> 插件，添加「微信同声传译」插件；
//   2. 在 app.json 的 "plugins" 中声明 WechatSI（骨架未声明，便于游客模式预览）；
//   3. 本文件会自动 requirePlugin 并启用 voice 模式。
//
// 若不接入插件，游戏自动进入 tap 模式：直接点击下落的字母即可消除（用于开发调试）。

function matchLetter(text) {
  if (!text) return null;
  const { SPEECH_MAP } = require('../config/gameConfig');
  const t = String(text).toLowerCase().trim();
  if (SPEECH_MAP[t]) return SPEECH_MAP[t];
  // 包含匹配（识别结果可能带标点或多词）
  for (const key in SPEECH_MAP) {
    if (t.indexOf(key) !== -1) return SPEECH_MAP[key];
  }
  return null;
}

function createSpeechManager(onResult, onError) {
  let plugin = null;
  try {
    plugin = requirePlugin('WechatSI');
  } catch (e) {
    plugin = null;
  }

  if (plugin && typeof plugin.getRecordRecognitionManager === 'function') {
    const manager = plugin.getRecordRecognitionManager();
    manager.onRecognize = (res) => {
      const letter = matchLetter(res && res.result);
      if (letter && typeof onResult === 'function') onResult(letter);
    };
    manager.onError = (err) => {
      if (typeof onError === 'function') onError(err);
    };
    return {
      mode: 'voice',
      start() {
        try {
          manager.start({ lang: 'en_US', duration: 10000 });
        } catch (e) {
          if (typeof onError === 'function') onError(e);
        }
      },
      stop() {
        try { manager.stop(); } catch (e) { /* ignore */ }
      }
    };
  }

  // 降级：点击消除模式
  return { mode: 'tap', start() {}, stop() {} };
}

module.exports = { createSpeechManager, matchLetter };
