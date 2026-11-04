// pages/game/game.js —— 反向玩法：App 报字母，玩家点击掉落字母
const {
  LETTERS, GROUP_SIZE, COLS, MAX_TARGET_COUNT, GROUPS_PER_LEVEL,
  MAX_LIVES, CORRECT_SCORE, WRONG_PENALTY, speedForLevel
} = require('../../config/gameConfig');
const { speakLetter } = require('../../utils/audio');

// 字母徽标配色（彩色，增加可读性，像“图标方块”）
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

// 返回打乱后的数组副本
function shuffled(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

Page({
  data: {
    started: false,
    gameOver: false,
    score: 0,
    lives: MAX_LIVES,
    level: 1,        // 速度档（由已完成组数推导）
    best: 0,
    scoreBump: false,
    target: '',      // 当前要找的字母（大写）
    groupNo: 0       // 已开始的组序号
  },

  onLoad() {
    this.letters = [];
    this.running = false;
    this.lastTime = 0;
    this.groupLevel = 1;
    this.groupsPlayed = 0;
    this.target = '';
    this.foundThisGroup = 0;
    this.totalTargetsThisGroup = 0;
    this.groupActive = false;
    this._groupTimer = null;
    this._bumpTimer = null;
  },

  onReady() {
    // 画布就绪后再自动开始（避免空白）
    this.initCanvas(() => this.startGame());
  },

  initCanvas(cb) {
    const query = wx.createSelectorQuery();
    query.select('#gameCanvas').fields({ node: true, size: true }).exec((res) => {
      if (!res || !res[0] || !res[0].node) {
        setTimeout(() => this.initCanvas(cb), 100);
        return;
      }
      const canvas = res[0].node;
      const ctx = canvas.getContext('2d');
      const info = (wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync());
      const dpr = info.pixelRatio || 2;
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
    if (!this.canvas) {
      this.initCanvas();
      setTimeout(() => this.startGame(), 60);
      return;
    }
    if (this._groupTimer) clearTimeout(this._groupTimer);
    this.setData({
      started: true, gameOver: false, score: 0,
      lives: MAX_LIVES, level: 1, scoreBump: false, target: '', groupNo: 0
    });
    this.letters = [];
    this.running = true;
    this.groupLevel = 1;
    this.groupsPlayed = 0;
    this.lastTime = Date.now();
    this.startGroup();
    this.loop();
  },

  // 开始一组：生成 6 个字母（3列 × 2排），含 1~2 个目标字母，播报目标读音
  startGroup() {
    this.groupsPlayed += 1;
    this.groupLevel = 1 + Math.floor((this.groupsPlayed - 1) / GROUPS_PER_LEVEL);

    const target = LETTERS[Math.floor(Math.random() * LETTERS.length)];
    this.target = target;

    // 目标出现次数：1 或 2（最多 2 个）
    const targetCount = Math.random() < 0.5 ? 1 : 2;

    // 6 个槽位，随机挑选 targetCount 个放目标，其余放干扰项
    const slots = shuffled([0, 1, 2, 3, 4, 5]);
    const targetSlots = slots.slice(0, targetCount);
    const distractorSlots = slots.slice(targetCount);

    // 干扰项：与目标不同、且彼此不同
    const others = shuffled(LETTERS.filter((l) => l !== target));

    const size = 34;                 // 徽标半边长
    const colW = this.cw / COLS;
    const rowGap = size * 2.5;       // 两排之间的纵向间距（已按要求调小到约一半）

    const letters = [];
    const pushLetter = (idx, char) => {
      const col = idx % COLS;
      const row = Math.floor(idx / COLS);
      const x = colW * (col + 0.5);
      const y = -size * 2 - row * rowGap;
      const display = Math.random() < 0.5 ? char : char.toLowerCase(); // 大小写随机，不区分大小写
      letters.push({
        char,
        display,
        x, y, size,
        color: LETTER_COLORS[idx % LETTER_COLORS.length]
      });
    };

    targetSlots.forEach((idx) => pushLetter(idx, target));
    distractorSlots.forEach((idx, k) => pushLetter(idx, others[k]));

    this.letters = letters;
    this.foundThisGroup = 0;
    this.totalTargetsThisGroup = targetCount;
    this.groupActive = true;

    this.setData({ target, level: this.groupLevel, groupNo: this.groupsPlayed });
    speakLetter(target); // 开局播报目标字母
    console.log('[game] 第', this.groupsPlayed, '组 目标=', target, ' 目标数=', targetCount);
  },

  loop() {
    if (!this.running) return;
    const now = Date.now();
    const dt = Math.min(now - this.lastTime, 50); // 防止后台切回时巨跳
    this.lastTime = now;
    this.update(dt);
    this.draw();
    this.canvas.requestAnimationFrame(() => this.loop());
  },

  update(dt) {
    if (!this.groupActive) return;
    const speed = speedForLevel(this.groupLevel);
    const remaining = [];
    let missedTarget = false;

    for (const l of this.letters) {
      l.y += speed * dt;
      if (l.y + l.size > this.ch) {
        // 落地
        if (l.char.toUpperCase() === this.target) {
          missedTarget = true; // 漏掉目标字母 -> 扣命
        }
        // 干扰项落地不扣分
      } else {
        remaining.push(l);
      }
    }
    this.letters = remaining;

    if (missedTarget) this.loseLife();

    // 本组字母全部清空 -> 进入下一组
    if (this.groupActive && this.letters.length === 0) {
      this.groupActive = false;
      this._groupTimer = setTimeout(() => {
        if (this.running) this.startGroup();
      }, 450);
    }
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
      const r = Math.min(14, s);
      ctx.fillStyle = l.color || '#ff7a18';
      roundRectPath(ctx, x, y, w, w, r);
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(255,255,255,0.85)';
      roundRectPath(ctx, x, y, w, w, r);
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold ' + Math.round(s * 1.05) + 'px sans-serif';
      ctx.fillText(l.display, l.x, l.y);
    }
  },

  // 点击：命中字母则判定对错
  onTapCanvas(e) {
    if (!this.running || !this.groupActive) return;
    const x = e.detail.x;
    const y = e.detail.y;
    for (let i = this.letters.length - 1; i >= 0; i--) {
      const l = this.letters[i];
      if (Math.abs(l.x - x) < l.size && Math.abs(l.y - y) < l.size) {
        if (l.char.toUpperCase() === this.target) {
          // 点中正确字母
          this.letters.splice(i, 1);
          this.foundThisGroup += 1;
          this.bumpScore(CORRECT_SCORE);
          // 本组目标全部找到 -> 立即清场进入下一组
          if (this.foundThisGroup >= this.totalTargetsThisGroup) {
            this.letters = [];
            this.groupActive = false;
            this._groupTimer = setTimeout(() => {
              if (this.running) this.startGroup();
            }, 300);
          }
        } else {
          // 点错（点到干扰项）-> 扣分并移除
          this.letters.splice(i, 1);
          this.penalize(WRONG_PENALTY);
        }
        break;
      }
    }
  },

  bumpScore(n) {
    const score = this.data.score + n;
    this.setData({ score, scoreBump: true });
    if (this._bumpTimer) clearTimeout(this._bumpTimer);
    this._bumpTimer = setTimeout(() => this.setData({ scoreBump: false }), 250);
    const best = wx.getStorageSync('letterdrop_best') || 0;
    if (score > best) {
      wx.setStorageSync('letterdrop_best', score);
      this.setData({ best: score });
    }
  },

  penalize(n) {
    const score = Math.max(0, this.data.score - n); // 扣分，不低于 0
    this.setData({ score });
  },

  loseLife() {
    const lives = this.data.lives - 1;
    this.setData({ lives });
    if (lives <= 0) this.endGame();
  },

  endGame() {
    this.running = false;
    if (this._groupTimer) clearTimeout(this._groupTimer);
    const best = Math.max(wx.getStorageSync('letterdrop_best') || 0, this.data.score);
    wx.setStorageSync('letterdrop_best', best);
    this.setData({ gameOver: true, best, started: true });
  },

  restart() {
    this.startGame();
  },

  onUnload() {
    this.running = false;
    if (this._groupTimer) clearTimeout(this._groupTimer);
  }
});
