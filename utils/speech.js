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

// 确保录音权限已授权：未决定则请求（首次弹系统窗），已拒绝则引导去设置
function ensureRecordAuth(onOk, onFail) {
  if (typeof wx === 'undefined' || !wx.getSetting) { onOk(); return; }
  wx.getSetting({
    success(res) {
      const auth = res.authSetting['scope.record'];
      if (auth === false) {
        // 之前拒绝过 -> 引导去设置（系统不会再次弹窗）
        if (wx.showModal) {
          wx.showModal({
            title: '需要麦克风权限',
            content: '念字母消除需要麦克风。请在设置中开启"录音"权限，或直接在屏幕上点字母消除。',
            confirmText: '去设置',
            cancelText: '用点击',
            success(m) { if (m.confirm && wx.openSetting) wx.openSetting(); }
          });
        }
        if (typeof onFail === 'function') onFail();
      } else if (auth === true) {
        onOk();
      } else {
        // 尚未决定 -> 请求授权（首次会弹系统窗）
        wx.authorize({
          scope: 'scope.record',
          success: onOk,
          fail: () => { if (typeof onFail === 'function') onFail(); }
        });
      }
    },
    fail() { onOk(); } // 取不到设置就直接尝试，由系统弹窗兜底
  });
}

function createSpeechManager(onResult, onError) {
  // 无云环境 -> 降级点击模式
  const hasCloud = typeof wx !== 'undefined' && wx.cloud && typeof wx.cloud.callFunction === 'function';
  if (!hasCloud) {
    console.log('[speech] 无云环境，降级 tap 模式');
    return { mode: 'tap', start() {}, stop() {} };
  }

  const recorder = wx.getRecorderManager();
  let active = false;
  let bound = false;

  const startRecording = () => {
    if (!active) return;
    try {
      console.log('[speech] recorder.start 开始录音');
      recorder.start({
        duration: 1300,        // 每段短录音，循环实现"持续聆听"
        sampleRate: 16000,
        numberOfChannels: 1,
        encodeBitRate: 48000,
        format: 'wav'
      });
    } catch (e) {
      console.error('[speech] recorder.start 异常', e);
      if (typeof onError === 'function') onError(e);
    }
  };

  const sendChunk = (tempFilePath) => {
    if (!active || !tempFilePath) return;
    console.log('[speech] onStop 录音结束，读取文件', tempFilePath);
    wx.getFileSystemManager().readFile({
      filePath: tempFilePath,
      encoding: 'base64',
      success: (res) => {
        if (!active) return;
        console.log('[speech] 调用云函数 asr, base64 长度 =', (res.data || '').length);
        wx.cloud.callFunction({
          name: 'asr',
          data: { audioBase64: res.data }
        }).then((r) => {
          const result = r && r.result;
          console.log('[speech] asr 返回:', JSON.stringify(result));
          const text = result && result.text;
          if (text) {
            const letter = matchLetter(text);
            if (letter && typeof onResult === 'function') onResult(letter);
          }
        }).catch((err) => {
          console.error('[speech] callFunction asr 失败', err);
          if (typeof onError === 'function') onError(err);
        });
      },
      fail: (err) => { console.error('[speech] 读取录音文件失败', err); if (typeof onError === 'function') onError(err); }
    });
  };

  if (!bound) {
    bound = true;
    recorder.onStart(() => {
      console.log('[speech] onStart 录音已启动');
    });
    recorder.onStop((res) => {
      if (!active) return;
      sendChunk(res.tempFilePath);
      // 短暂停顿再开下一段，避免与上一会话抢资源
      setTimeout(() => startRecording(), 30);
    });
    recorder.onError((err) => {
      console.error('[speech] recorder.onError', JSON.stringify(err));
      if (typeof onError === 'function') onError(err);
    });
  }

  return {
    mode: 'voice',
    start() {
      active = true;
      ensureRecordAuth(
        () => startRecording(),
        () => { /* 授权失败：保持 tap 兜底，由 onError 提示 */ }
      );
    },
    stop() {
      active = false;
      try { recorder.stop(); } catch (e) { /* ignore */ }
    }
  };
}

module.exports = { createSpeechManager, matchLetter };
