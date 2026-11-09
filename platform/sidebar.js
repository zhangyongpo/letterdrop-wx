// Copyright (c) 2026 zhangyongpo. SPDX-License-Identifier: Apache-2.0
// 本文件为 letterdrop-wx 项目独立开发源码；许可证见 LICENSE，第三方资产声明见 NOTICE.md。
// platform/sidebar.js
// 抖音小游戏「侧边栏复访」必接能力：包内需出现 tt.navigateToScene 调用，
// 且游戏内要有可见入口（导航页底部按钮）。微信端 available() 恒为 false，
// 不绘制、不调用，行为与适配前完全一致。

const IS_TT = typeof tt !== 'undefined';
const TT = IS_TT ? tt : null;

function available() {
  return !!(TT && typeof TT.navigateToScene === 'function');
}

function navigate(onDone) {
  if (!available()) { if (onDone) onDone(false); return; }
  try {
    TT.navigateToScene({
      scene: 'sidebar',
      success: () => { if (onDone) onDone(true); },
      fail: () => { if (onDone) onDone(false); }
    });
  } catch (e) {
    if (onDone) onDone(false);
  }
}

module.exports = { available, navigate };
