// app.js —— 小程序入口，负责全局最高分读取 + 初始化云开发
App({
  globalData: {
    bestScore: 0
  },
  onLaunch() {
    const best = wx.getStorageSync('letterdrop_best') || 0;
    this.globalData.bestScore = best;

    // 初始化云开发（语音识别走云函数）
    if (typeof wx !== 'undefined' && wx.cloud) {
      wx.cloud.init({
        env: 'cloud1-d0gnprjtba84fda2f',
        traceUser: true
      });
    }
  }
});
