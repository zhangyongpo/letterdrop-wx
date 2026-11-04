// utils/audio.js
// 离线播放字母发音：使用包内预录的 wav 文件，无需插件 / 云端 / 网络。
// 文件位于 /assets/audio/<字母>.wav（绝对包路径，真机可用）。
// 彻底替代原先的腾讯云 ASR 方案——游戏改为“App 报字母、玩家点击”。

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

module.exports = { speakLetter };
