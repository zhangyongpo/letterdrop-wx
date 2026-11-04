// pages/index/index.js
Page({
  data: {
    best: 0
  },
  onShow() {
    this.setData({ best: wx.getStorageSync('letterdrop_best') || 0 });
  },
  startGame() {
    wx.navigateTo({ url: '/pages/game/game' });
  }
});
