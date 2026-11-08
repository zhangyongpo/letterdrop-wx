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
