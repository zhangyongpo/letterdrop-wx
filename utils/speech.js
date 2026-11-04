// utils/speech.js
// 语音识别接口：使用腾讯官方「微信同声传译」插件（WechatSI，provider wx069ba97219f66d99），
// 对应安卓版 Vosk 离线识别的"念字母读音消除"能力；不可用时降级为"点击消除"模式。
//
// 启用语音识别的前提（一次性的后台配置）：
//   1. 登录 mp.weixin.qq.com，进入你的小程序（appid: wxe988a5f8708ecad3）；
//   2. 设置 -> 第三方设置 -> 插件 -> 添加「微信同声传译」；
//   3. app.json 已声明 WechatSI 插件（见 plugins 字段）；
//   4. 未在后台添加插件前，开发者工具会因插件未授权而无法编译，
//      此时可临时删除 app.json 的 "plugins" 块，先用 tap 模式验证玩法。

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
    let active = false;
    manager.onRecognize = (res) => {
      const letter = matchLetter(res && res.result);
      if (letter && typeof onResult === 'function') onResult(letter);
    };
    manager.onError = (err) => {
      if (typeof onError === 'function') onError(err);
    };
    // 到时长上限自动停止后，若仍在游戏中则立即重新开始，实现"持续聆听"
    manager.onStop = () => {
      if (active) {
        try { manager.start({ lang: 'en_US', duration: 60000 }); } catch (e) { /* ignore */ }
      }
    };
    return {
      mode: 'voice',
      start() {
        active = true;
        try {
          manager.start({ lang: 'en_US', duration: 60000 });
        } catch (e) {
          if (typeof onError === 'function') onError(e);
        }
      },
      stop() {
        active = false;
        try { manager.stop(); } catch (e) { /* ignore */ }
      }
    };
  }

  // 降级：点击消除模式
  return { mode: 'tap', start() {}, stop() {} };
}

module.exports = { createSpeechManager, matchLetter };
