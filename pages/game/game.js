// pages/game/game.js —— 游戏核心逻辑
const { LETTERS, speedForLevel, levelForScore, BASE_LEVEL } = require('../../config/gameConfig');
const { createSpeechManager } = require('../../utils/speech');

// 字母徽标配色（彩色，增加可读性，像"图标方块"）
const LETTER_COLORS = ['#ff7a18', '#ff5252', '#42a5f5', '#66bb6a', '#ab47bc', '#ffca28', '#26c6da', '#ec407a'];

// 绘制圆角矩形路径（兼容各基础库，不依赖 ctx.roundRect）
function roundRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

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
    // 画布就绪后再创建语音并自动开始游戏（避免空白）
    this.initCanvas(() => {
      this.speech = createSpeechManager(
        (letter) => this.onSpeechLetter(letter),
        () => {}
      );
      this.setData({ mode: this.speech.mode });
      this.startGame();
    });
  },

  initCanvas(cb) {
    const query = wx.createSelectorQuery();
    query.select('#gameCanvas').fields({ node: true, size: true }).exec((res) => {
      if (!res || !res[0] || !res[0].node) {
        // 画布尚未布局完成，稍后重试
        setTimeout(() => this.initCanvas(cb), 100);
        return;
      }
      const canvas = res[0].node;
      const ctx = canvas.getContext('2d');
      const info = (wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync());
      const dpr = info.pixelRatio || 2;
      // 取渲染尺寸，若为 0 则回退到窗口尺寸，避免画布尺寸为 0 导致空白
      const w = res[0].width || info.windowWidth || 320;
      const h = res[0].height || info.windowHeight || 568;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.scale(dpr, dpr);
      this.canvas = canvas;
      this.ctx = ctx;
      this.cw = w;
      this.ch = h;
      if (typeof cb === 'function') cb();
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
    if (this.speech) this.speech.start();
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
    const size = 34; // 徽标半边长（实际边长 = 2*size）
    const x = Math.random() * (this.cw - size * 2) + size;
    const color = LETTER_COLORS[Math.floor(Math.random() * LETTER_COLORS.length)];
    this.letters.push({ char: upper, display, x, y: -size * 2, size, color });
  },

  update(dt) {
    const speed = speedForLevel(this.data.level); // 逻辑像素/毫秒
    for (const l of this.letters) {
      l.y += speed * dt;
    }
    const remaining = [];
    for (const l of this.letters) {
      if (l.y + l.size > this.ch) {
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
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const l of this.letters) {
      const s = l.size;
      const x = l.x - s;
      const y = l.y - s;
      const w = s * 2;
      const r = Math.min(14, s); // 圆角半径
      // 背景色圆角徽标（像图标方块）
      ctx.fillStyle = l.color || '#ff7a18';
      roundRectPath(ctx, x, y, w, w, r);
      ctx.fill();
      // 白色描边，提升层次感
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(255,255,255,0.85)';
      roundRectPath(ctx, x, y, w, w, r);
      ctx.stroke();
      // 字母（白字，加粗）
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold ' + Math.round(s * 1.05) + 'px sans-serif';
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

  // 点击消除（语音模式下也保留为兜底/辅助）
  onTapCanvas(e) {
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
