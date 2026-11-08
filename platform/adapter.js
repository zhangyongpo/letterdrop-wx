// platform/adapter.js
// 双端统一入口：微信小游戏 -> wx，抖音小游戏 -> tt。
// 游戏代码只依赖 adapter.*，不再直接引用平台全局对象。
//
// 新增平台 API 时必须同步加进 API_LIST，否则该调用在另一端会静默失效；
// scripts/build.js 会扫描产物里直接调用平台全局对象的残留作为兜底检查。

const IS_TT = typeof tt !== 'undefined';
const HOST = IS_TT ? tt : (typeof wx !== 'undefined' ? wx : {});

const API_LIST = [
  'createCanvas',
  'getWindowInfo',
  'getSystemInfoSync',
  'getStorageSync',
  'setStorageSync',
  'createInnerAudioContext',
  'setInnerAudioOption',
  'loadFont',
  'loadSubpackage',
  'onTouchStart',
  'onTouchMove',
  'onTouchEnd',
  'requestAnimationFrame'
];

// 显式 bind 到宿主，避免某些平台 API 依赖 this。
const adapter = { PLATFORM: IS_TT ? 'tt' : 'wx' };
API_LIST.forEach((name) => {
  const fn = HOST[name];
  adapter[name] = (typeof fn === 'function') ? fn.bind(HOST) : undefined;
});

// 包内音频资源路径候选。
// 两端对「代码包内路径」的解析规则不同：
//   - 抖音小游戏官方教程写的是不带前导斜杠的包内相对路径（'audio/click.mp3'）；
//     PC 模拟器是 Web 环境，'/assets/audio/A.mp3' 会被当成站点根 URL 请求而 404，
//     表现为 NotSupportedError: Failed to load because no supported source was found.
//   - 微信小游戏历史上用 '/assets/...' 可正常播放，保持绝对路径优先，行为零变化。
// 返回按优先级排列的候选，utils/audio.js 在 onError 时依次切换重试。
function audioSrcCandidates(pkgPath) {
  const rel = String(pkgPath).replace(/^\/+/, '');
  const abs = '/' + rel;
  const list = IS_TT ? [rel, './' + rel, abs] : [abs, rel];
  return list.filter((p, i) => list.indexOf(p) === i);
}
adapter.audioSrcCandidates = audioSrcCandidates;

if (IS_TT) {
  // tt 没有 getWindowInfo，用 getSystemInfoSync 提供同结构数据，
  // 让 game.js 取屏幕尺寸的分支在两端一致。
  if (!adapter.getWindowInfo && adapter.getSystemInfoSync) {
    adapter.getWindowInfo = adapter.getSystemInfoSync;
  }

  // tt.loadFont 要求包根绝对路径，且低版本基础库没有该 API（返回 null 自动回退 sans-serif）。
  const rawLoadFont = adapter.loadFont;
  adapter.loadFont = (p) => {
    if (typeof rawLoadFont !== 'function') return null;
    const abs = String(p).charAt(0) === '/' ? p : '/' + p;
    try { return rawLoadFont(abs); } catch (e) { return null; }
  };

  // tt.setInnerAudioOption 在部分基础库缺失：保持 undefined，
  // game.js 会跳过全局设置；每个 InnerAudioContext 仍单独设置 obeyMuteSwitch = false。
}

module.exports = adapter;
