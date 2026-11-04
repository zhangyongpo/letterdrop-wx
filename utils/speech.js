// utils/speech.js
// 语音识别接口：腾讯云 ASR（一句话识别，云函数 asr）+ 录音循环。
// 对应安卓版 Vosk 离线识别的"念字母读音消除"能力；云环境不可用时降级为"点击消除"模式。
//
// 前置（一次性）：
//   1. 微信开发者工具开启云开发，创建环境，把环境ID填进 app.js 的 wx.cloud.init({env})；
//   2. 部署 cloudfunctions/asr 云函数（右键 -> 上传并部署：云端安装依赖）；
//   3. 在云函数 asr 的配置里设置环境变量 TENCENT_SECRET_ID / TENCENT_SECRET_KEY（腾讯云账号，实名后开通 ASR）；
//      可选 ASR_REGION、ASR_HOTWORD_ID（热词表ID，提升字母识别率）。

function matchLetter(text) {
  if (!text) return null;
  const { SPEECH_MAP } = require('../config/gameConfig');
  const t = String(text).toLowerCase().trim();
  if (SPEECH_MAP[t]) return SPEECH_MAP[t];
  // 包含匹配（识别结果可能带标点或多词，如 "bee" / "letter b"）
  for (const key in SPEECH_MAP) {
    if (t.indexOf(key) !== -1) return SPEECH_MAP[key];
  }
  // 直接是单个字母（A-Z）
  if (/^[a-z]$/.test(t)) return t.toUpperCase();
  return null;
}

function createSpeechManager(onResult, onError) {
  // 无云环境 -> 降级点击模式
  const hasCloud = typeof wx !== 'undefined' && wx.cloud && typeof wx.cloud.callFunction === 'function';
  if (!hasCloud) {
    return { mode: 'tap', start() {}, stop() {} };
  }

  const recorder = wx.getRecorderManager();
  let active = false;
  let bound = false;

  const startRecording = () => {
    if (!active) return;
    try {
      recorder.start({
        duration: 1300,        // 每段短录音，循环实现"持续聆听"
        sampleRate: 16000,
        numberOfChannels: 1,
        encodeBitRate: 48000,
        format: 'wav'
      });
    } catch (e) {
      if (typeof onError === 'function') onError(e);
    }
  };

  const sendChunk = (tempFilePath) => {
    if (!active || !tempFilePath) return;
    wx.getFileSystemManager().readFile({
      filePath: tempFilePath,
      encoding: 'base64',
      success: (res) => {
        if (!active) return;
        wx.cloud.callFunction({
          name: 'asr',
          data: { audioBase64: res.data }
        }).then((r) => {
          const text = r && r.result && r.result.text;
          if (text) {
            const letter = matchLetter(text);
            if (letter && typeof onResult === 'function') onResult(letter);
          }
        }).catch((err) => {
          if (typeof onError === 'function') onError(err);
        });
      },
      fail: (err) => { if (typeof onError === 'function') onError(err); }
    });
  };

  if (!bound) {
    bound = true;
    recorder.onStop((res) => {
      if (!active) return;
      sendChunk(res.tempFilePath);
      startRecording(); // 持续聆听：立即开始下一段
    });
    recorder.onError((err) => {
      if (typeof onError === 'function') onError(err);
    });
  }

  return {
    mode: 'voice',
    start() {
      active = true;
      startRecording();
    },
    stop() {
      active = false;
      try { recorder.stop(); } catch (e) { /* ignore */ }
    }
  };
}

module.exports = { createSpeechManager, matchLetter };
