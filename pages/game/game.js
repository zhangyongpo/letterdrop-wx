// pages/game/game.js —— 游戏核心逻辑
const { LETTERS, speedForLevel, levelForScore, BASE_LEVEL } = require('../../config/gameConfig');
const { createSpeechManager } = require('../../utils/speech');

Page({
  data: {
    started: false,
    gameOver: false,
    score: 0,
    lives: 3,
    level: BASE_LEVEL,
    best: 0,
    scoreBump: false,
    mode: 'tap' // 'voice' | 'tap'
  },

  onLoad() {
    this.letters = [];
    this.lastSpawn = 0;
    this.lastTime = 0;
    this.running = false;
  },

  onReady() {
    this.initCanvas();
    this.speech = createSpeechManager(
      (letter) => this.onSpeechLetter(letter),
      () => {}
    );
    this.setData({ mode: this.speech.mode });
  },

  initCanvas() {
    const query = wx.createSelectorQuery();
    query.select('#gameCanvas').fields({ node: true, size: true }).exec((res) => {
      if (!res || !res[0]) return;
      const canvas = res[0].node;
      const ctx = canvas.getContext('2d');
      const info = (wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync());
      const dpr = info.pixelRatio || 2;
      canvas.width = res[0].width * dpr;
      canvas.height = res[0].height * dpr;
      ctx.scale(dpr, dpr);
      this.canvas = canvas;
      this.ctx = ctx;
      this.cw = res[0].width;
      this.ch = res[0].height;
    });
  },

  startGame() {
    // 确保画布已就绪
    if (!this.canvas) {
      this.initCanvas();
      setTimeout(() => this.startGame(), 60);
      return;
    }
    this.setData({
      started: true,
      gameOver: false,
      score: 0,
      lives: 3,
      level: BASE_LEVEL,
      scoreBump: false
    });
    this.letters = [];
    this.running = true;
    this.lastTime = Date.now();
    this.lastSpawn = 0;
    if (this.speech && this.speech.mode === 'voice') this.speech.start();
    this.loop();
  },

  loop() {
    if (!this.running) return;
    const now = Date.now();
    const dt = Math.min(now - this.lastTime, 50); // 防止后台切回时巨跳
    this.lastTime = now;

    // 按速度档动态生成间隔（越快越密）
    this.lastSpawn += dt;
    const interval = Math.max(450, 1400 - (this.data.level - BASE_LEVEL) * 80);
    if (this.lastSpawn > interval) {
      this.spawnLetter();
      this.lastSpawn = 0;
    }

    this.update(dt);
    this.draw();
    this.canvas.requestAnimationFrame(() => this.loop());
  },

  spawnLetter() {
    const upper = LETTERS[Math.floor(Math.random() * LETTERS.length)];
    // 大小写随机显示（与安卓版一致），读音匹配按字母名、不受大小写影响
    const display = Math.random() < 0.5 ? upper : upper.toLowerCase();
    const size = 46;
    const x = Math.random() * (this.cw - size) + size / 2;
    this.letters.push({ char: upper, display, x, y: -size, size });
  },

  update(dt) {
    const speed = speedForLevel(this.data.level); // 逻辑像素/毫秒
    for (const l of this.letters) {
      l.y += speed * dt;
    }
    const remaining = [];
    for (const l of this.letters) {
      if (l.y - l.size / 2 > this.ch) {
        this.loseLife(); // 落地 = 失败
      } else {
        remaining.push(l);
      }
    }
    this.letters = remaining;
  },

  draw() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.cw, this.ch);
    ctx.font = 'bold 46px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const l of this.letters) {
      ctx.fillStyle = '#ff7a18';
      ctx.fillText(l.display, l.x, l.y);
    }
  },

  // 语音识别到字母 -> 消除最下方匹配字母
  onSpeechLetter(letter) {
    let target = null;
    for (const l of this.letters) {
      if (l.char.toUpperCase() === String(letter).toUpperCase()) {
        if (!target || l.y > target.y) target = l;
      }
    }
    if (target) {
      this.letters = this.letters.filter((x) => x !== target);
      this.bumpScore();
    }
  },

  // 降级：点击消除
  onTapCanvas(e) {
    if (this.speech && this.speech.mode !== 'tap') return;
    if (!this.running) return;
    const x = e.detail.x;
    const y = e.detail.y;
    for (let i = this.letters.length - 1; i >= 0; i--) {
      const l = this.letters[i];
      if (Math.abs(l.x - x) < l.size && Math.abs(l.y - y) < l.size) {
        this.letters.splice(i, 1);
        this.bumpScore();
        break;
      }
    }
  },

  bumpScore() {
    const score = this.data.score + 1;
    const level = levelForScore(score);
    this.setData({ score, level, scoreBump: true });
    if (this._bumpTimer) clearTimeout(this._bumpTimer);
    this._bumpTimer = setTimeout(() => this.setData({ scoreBump: false }), 250);

    const best = wx.getStorageSync('letterdrop_best') || 0;
    if (score > best) {
      wx.setStorageSync('letterdrop_best', score);
      this.setData({ best: score });
    }
  },

  loseLife() {
    const lives = this.data.lives - 1;
    this.setData({ lives });
    if (lives <= 0) this.endGame();
  },

  endGame() {
    this.running = false;
    if (this.speech && this.speech.mode === 'voice') this.speech.stop();
    const best = Math.max(wx.getStorageSync('letterdrop_best') || 0, this.data.score);
    wx.setStorageSync('letterdrop_best', best);
    this.setData({ gameOver: true, best, started: true });
  },

  restart() {
    this.startGame();
  },

  onUnload() {
    this.running = false;
    if (this.speech && this.speech.mode === 'voice') this.speech.stop();
  }
});
