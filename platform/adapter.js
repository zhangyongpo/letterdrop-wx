// Copyright (c) 2026 zhangyongpo. SPDX-License-Identifier: Apache-2.0
// 本文件为 letterdrop-wx 项目独立开发源码；许可证见 LICENSE，第三方资产声明见 NOTICE.md。
// platform/adapter.js
// 微信小游戏平台 API 收口层：游戏代码只依赖 adapter.*，不直接引用 wx 全局对象。
//
// 新增平台 API 时必须同步加进 API_LIST，否则该调用不会暴露到 adapter 上；
// scripts/build.js 会扫描产物里直接调用平台全局对象的残留作为兜底检查。

const HOST = (typeof wx !== 'undefined') ? wx : {};

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
  'requestAnimationFrame',
  // 转发分享：打开右上角菜单 + 自定义卡片 + 游戏内主动转发
  'showShareMenu',
  'onShareAppMessage',
  'onShareTimeline',
  'shareAppMessage'
];

// 显式 bind 到宿主，避免某些平台 API 依赖 this。
const adapter = { PLATFORM: 'wx' };
API_LIST.forEach((name) => {
  const fn = HOST[name];
  adapter[name] = (typeof fn === 'function') ? fn.bind(HOST) : undefined;
});

// 包内音频资源路径候选。
// 微信小游戏历史行为优先 '/assets/...' 绝对路径；部分环境（如 PC 模拟器的 Web 容器）
// 会把前导斜杠当成站点根 URL 请求而 404，因此保留不带前导斜杠的相对路径作为回退。
// utils/audio.js 在 onError 时依次切换重试，全部失败才回退逐字母拼读。
function audioSrcCandidates(pkgPath) {
  const rel = String(pkgPath).replace(/^\/+/, '');
  const abs = '/' + rel;
  const list = [abs, rel];
  return list.filter((p, i) => list.indexOf(p) === i);
}
adapter.audioSrcCandidates = audioSrcCandidates;

module.exports = adapter;
