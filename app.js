// app.js —— 小程序入口，负责全局最高分读取
App({
  globalData: {
    bestScore: 0
  },
  onLaunch() {
    const best = wx.getStorageSync('letterdrop_best') || 0;
    this.globalData.bestScore = best;
  }
});
