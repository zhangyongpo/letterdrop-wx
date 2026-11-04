// app.js —— 小程序入口，负责全局最高分读取 + 初始化云开发
App({
  globalData: {
    bestScore: 0
  },
  onLaunch() {
    const best = wx.getStorageSync('letterdrop_best') || 0;
    this.globalData.bestScore = best;

    // 初始化云开发（语音识别走云函数）
    // TODO: 把 'YOUR_CLOUD_ENV_ID' 替换为你自己的云开发环境 ID
    if (typeof wx !== 'undefined' && wx.cloud) {
      wx.cloud.init({
        env: 'YOUR_CLOUD_ENV_ID',
        traceUser: true
      });
    }
  }
});
