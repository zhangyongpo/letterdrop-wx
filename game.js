// game.js —— 微信小游戏版（原生 Canvas 2D，无 DOM / 无 WXML）
// 玩法：App 报出目标字母读音，屏幕上 6 个字母（3列×2排）掉落，
// 玩家在落地前点中正确字母消除；不区分大小写；点错（干扰项）扣分（不低于0）；
// 目标字母落地漏点扣 1 命；每 10 组速度 +1 档（无上限）；3 命结束。

const {
  LETTERS, GROUP_SIZE, COLS, MAX_TARGET_COUNT, GROUPS_PER_LEVEL,
  MAX_LIVES, CORRECT_SCORE, WRONG_PENALTY, speedForLevel
} = require('./config/gameConfig');
const { announceLetter } = require('./utils/audio');

// 字母徽标配色（彩色圆角方块，白字）
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

// 点是否落在矩形内（矩形以左上角 x,y 描述）
function hit(rect, px, py) {
  return rect && px >= rect.x && px <= rect.x + rect.w && py >= rect.y && py <= rect.y + rect.h;
}

// ---- 初始化画布 ----
const canvas = wx.createCanvas();
const ctx = canvas.getContext('2d');
const sys = (wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync()) || wx.getSystemInfoSync();
const dpr = sys.pixelRatio || 2;
const W = sys.windowWidth || sys.screenWidth || 320;
const H = sys.windowHeight || sys.screenHeight || 568;
canvas.width = W * dpr;
canvas.height = H * dpr;
ctx.scale(dpr, dpr);

// 背景渐变（一次性创建）
const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
bgGrad.addColorStop(0, '#fff3e0');
bgGrad.addColorStop(1, '#ffe0b2');

// ---- 游戏状态 ----
// state: 'home' | 'playing' | 'gameover'
let state = 'home';
let best = wx.getStorageSync('letterdrop_best') || 0;
let score = 0;
let lives = MAX_LIVES;
let groupLevel = 1;
let groupsPlayed = 0;
let letters = [];
let target = '';                 // 当前要找的字母（大写）
let foundThisGroup = 0;
let totalTargetsThisGroup = 0;
let groupActive = false;
let spokenThisGroup = false;     // 本组是否已在第一排出现后播报过目标
let lastTime = Date.now();
let groupTimer = null;
let scoreBumpTimer = 0;          // 得分 +分 放大动画剩余时间(ms)
let startBtn = null;             // 首页“开始游戏”按钮区域
let restartBtn = null;           // 结束页“再来一局”按钮区域

// ---- 流程控制 ----
function startGame() {
  if (groupTimer) clearTimeout(groupTimer);
  score = 0;
  lives = MAX_LIVES;
  groupLevel = 1;
  groupsPlayed = 0;
  letters = [];
  groupActive = false;
  scoreBumpTimer = 0;
  lastTime = Date.now();
  state = 'playing';
  startGroup();
}

// 开始一组：生成 6 个字母（3列 × 2排），含 1~2 个目标字母，播报目标读音
function startGroup() {
  groupsPlayed += 1;
  groupLevel = 1 + Math.floor((groupsPlayed - 1) / GROUPS_PER_LEVEL);

  target = LETTERS[Math.floor(Math.random() * LETTERS.length)];
  const targetCount = Math.random() < 0.5 ? 1 : 2;   // 最多 2 个正确答案

  // 构造 6 个“字母身份”互不重复的字母（忽略大小写，即 'A' 与 'a' 视为不同）
  // 目标字母占 targetCount 个；若为 2 个则明确拆成 大写 + 小写，
  // 既满足“最多 2 个正确答案（大小写合计）”，又避免屏幕上出现两个一模一样的字母
  const groupLetters = [];
  if (targetCount === 2) {
    groupLetters.push({ char: target, display: target });                  // 大写目标
    groupLetters.push({ char: target, display: target.toLowerCase() });    // 小写目标
  } else {
    const tDisp = Math.random() < 0.5 ? target : target.toLowerCase();
    groupLetters.push({ char: target, display: tDisp });
  }
  // 干扰项：从其余 25 个字母随机取 (6 - targetCount) 个互不相同的，随机大小写
  const others = shuffled(LETTERS.filter((l) => l !== target));
  for (let k = 0; k < GROUP_SIZE - targetCount; k++) {
    const c = others[k];
    groupLetters.push({ char: c, display: Math.random() < 0.5 ? c : c.toLowerCase() });
  }

  const size = 34;                 // 徽标半边长
  const colW = W / COLS;
  const rowGap = size * 2.5;       // 两排之间的纵向间距（已调小到约一半）

  // 打乱这 6 个字母并分配到 3列 × 2排 的位置
  letters = [];
  shuffled(groupLetters).forEach((g, idx) => {
    const col = idx % COLS;
    const row = Math.floor(idx / COLS);
    const x = colW * (col + 0.5);
    const y = -size * 2 - row * rowGap;
    letters.push({
      char: g.char,
      display: g.display,
      x, y, size,
      row,
      color: LETTER_COLORS[idx % LETTER_COLORS.length]
    });
  });

  foundThisGroup = 0;
  totalTargetsThisGroup = targetCount;
  groupActive = true;
  spokenThisGroup = false; // 等第一排完全出现后再播报，避免字母还在屏幕外就念
}

function loseLife() {
  lives -= 1;
  if (lives <= 0) endGame();
}

function endGame() {
  groupActive = false;
  if (groupTimer) clearTimeout(groupTimer);
  best = Math.max(best, score);
  wx.setStorageSync('letterdrop_best', best);
  state = 'gameover';
}

// ---- 更新 ----
function update(dt) {
  if (state !== 'playing' || !groupActive) return;
  const speed = speedForLevel(groupLevel);
  const remaining = [];
  let missedTarget = false;

  for (const l of letters) {
    l.y += speed * dt;
    if (l.y + l.size > H) {
      if (l.char.toUpperCase() === target) missedTarget = true; // 漏掉目标字母 -> 扣命
      // 干扰项落地不扣分
    } else {
      remaining.push(l);
    }
  }
  letters = remaining;

  // 第一排字母完全滑入屏幕（整块可见）后，再播报目标读音两遍（每组仅一次）
  if (groupActive && !spokenThisGroup) {
    const firstRow = letters.filter((l) => l.row === 0);
    if (firstRow.length && firstRow.every((l) => l.y >= l.size)) {
      spokenThisGroup = true;
      announceLetter(target, 600); // 第一遍自然结束后间隔 600ms 再播第二遍
    }
  }

  if (missedTarget) loseLife();

  // 本组字母全部清空 -> 进入下一组
  if (groupActive && letters.length === 0) {
    groupActive = false;
    groupTimer = setTimeout(() => {
      if (state === 'playing') startGroup();
    }, 450);
  }
}

// ---- 点击判定 ----
function onTapLetter(px, py) {
  if (!groupActive) return;
  for (let i = letters.length - 1; i >= 0; i--) {
    const l = letters[i];
    if (Math.abs(l.x - px) < l.size && Math.abs(l.y - py) < l.size) {
      if (l.char.toUpperCase() === target) {
        letters.splice(i, 1);
        foundThisGroup += 1;
        score += CORRECT_SCORE;
        scoreBumpTimer = 250;
        if (score > best) {
          best = score;
          wx.setStorageSync('letterdrop_best', best);
        }
        // 本组目标全部找到 -> 立即清场进入下一组
        if (foundThisGroup >= totalTargetsThisGroup) {
          letters = [];
          groupActive = false;
          groupTimer = setTimeout(() => {
            if (state === 'playing') startGroup();
          }, 300);
        }
      } else {
        // 点错（点到干扰项）-> 扣分并移除
        letters.splice(i, 1);
        score = Math.max(0, score - WRONG_PENALTY); // 扣分，不低于 0
      }
      break;
    }
  }
}

// ---- 绘制 ----
function drawLetter(l) {
  const s = l.size;
  const x = l.x - s;
  const y = l.y - s;
  const w = s * 2;
  const r = Math.min(14, s);
  ctx.fillStyle = l.color;
  roundRectPath(ctx, x, y, w, w, r);
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  roundRectPath(ctx, x, y, w, w, r);
  ctx.stroke();
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = 'bold ' + Math.round(s * 1.05) + 'px sans-serif';
  ctx.fillText(l.display, l.x, l.y);
}

function drawButton(rect, label) {
  const r = 20;
  ctx.fillStyle = '#ff7a18';
  roundRectPath(ctx, rect.x, rect.y, rect.w, rect.h, r);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = 'bold 40px sans-serif';
  ctx.fillText(label, rect.x + rect.w / 2, rect.y + rect.h / 2);
}

function drawHome() {
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, W, H);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // 标题：字号随屏宽自适应，并保证不超出屏宽（避免两侧被截）
  let titleSize = Math.min(88, W * 0.22);
  ctx.font = 'bold ' + titleSize + 'px sans-serif';
  let tW = ctx.measureText('字母掉落').width;
  if (tW > W * 0.92) titleSize = Math.floor(titleSize * (W * 0.92) / tW);
  ctx.font = 'bold ' + titleSize + 'px sans-serif';
  ctx.fillStyle = '#5a2d00';
  ctx.fillText('字母掉落', W / 2, H * 0.28);

  // 副标题：超长时自动缩小以适配屏宽（实测写死 30px 在窄屏会左右截断）
  const subtitle = '听发音，在字母落地前点中它！';
  let subSize = Math.min(30, W * 0.08);
  ctx.font = subSize + 'px sans-serif';
  let sW = ctx.measureText(subtitle).width;
  const maxSubW = W * 0.9;
  if (sW > maxSubW) subSize = Math.floor(subSize * maxSubW / sW);
  ctx.font = subSize + 'px sans-serif';
  ctx.fillStyle = '#8a5a2b';
  ctx.fillText(subtitle, W / 2, H * 0.38);

  // 开始按钮：宽度随屏宽自适应，左右各留边
  const btnW = Math.min(320, W - 80);
  startBtn = { x: W / 2 - btnW / 2, y: H * 0.55, w: btnW, h: 92 };
  drawButton(startBtn, '开始游戏');

  // 最高分：超长自动缩小
  const bestText = '最高分：' + best;
  let bestSize = 30;
  ctx.font = bestSize + 'px sans-serif';
  let bW = ctx.measureText(bestText).width;
  if (bW > W * 0.9) bestSize = Math.floor(bestSize * (W * 0.9) / bW);
  ctx.font = bestSize + 'px sans-serif';
  ctx.fillStyle = '#b06a2b';
  ctx.fillText(bestText, W / 2, H * 0.75);
}

function drawPlaying() {
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, W, H);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const l of letters) drawLetter(l);

  // 顶部仅显示得分（带 +分 放大动画）
  const bump = scoreBumpTimer > 0 ? 1.3 : 1;
  ctx.save();
  ctx.translate(W / 2, 56);
  ctx.scale(bump, bump);
  ctx.fillStyle = '#ff7a18';
  ctx.font = 'bold 44px sans-serif';
  ctx.fillText('得分 ' + score, 0, 0);
  ctx.restore();
}

function drawGameOver() {
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, W, H);

  // 半透明遮罩
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(0, 0, W, H);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // 标题：字号随屏宽自适应，保证不超出屏宽
  let overTitleSize = Math.min(56, W * 0.15);
  ctx.font = 'bold ' + overTitleSize + 'px sans-serif';
  let otW = ctx.measureText('游戏结束').width;
  if (otW > W * 0.92) overTitleSize = Math.floor(overTitleSize * (W * 0.92) / otW);
  ctx.font = 'bold ' + overTitleSize + 'px sans-serif';
  ctx.fillStyle = '#5a2d00';
  ctx.fillText('游戏结束', W / 2, H * 0.3);

  ctx.fillStyle = '#ff7a18';
  ctx.font = 'bold 44px sans-serif';
  ctx.fillText('本局得分 ' + score, W / 2, H * 0.42);

  ctx.fillStyle = '#8a5a2b';
  ctx.font = '32px sans-serif';
  ctx.fillText('最高分 ' + best, W / 2, H * 0.5);

  restartBtn = { x: W / 2 - 160, y: H * 0.62, w: 320, h: 92 };
  drawButton(restartBtn, '再来一局');
}

function draw() {
  if (state === 'home') drawHome();
  else if (state === 'playing') drawPlaying();
  else if (state === 'gameover') drawGameOver();
}

// 小游戏渲染循环：优先用 canvas.requestAnimationFrame（Canvas 2D 节点方法，官方推荐）
// 该环境（基础库 3.17.6 / 模拟器）下全局与 wx.requestAnimationFrame 均未注入，故挂在 canvas 上最稳
function raf(cb) {
  if (typeof canvas !== 'undefined' && typeof canvas.requestAnimationFrame === 'function') {
    return canvas.requestAnimationFrame(cb);
  }
  if (typeof wx !== 'undefined' && typeof wx.requestAnimationFrame === 'function') {
    return wx.requestAnimationFrame(cb);
  }
  if (typeof requestAnimationFrame === 'function') {
    return requestAnimationFrame(cb);
  }
  return setTimeout(cb, 16); // 兜底：用定时器模拟约 60fps，保证任何环境都能跑
}

// ---- 主循环 ----
function loop() {
  const now = Date.now();
  const dt = Math.min(now - lastTime, 50); // 防止后台切回时巨跳
  lastTime = now;
  if (scoreBumpTimer > 0) scoreBumpTimer -= dt;
  update(dt);
  draw();
  raf(loop);
}

// ---- 触摸输入 ----
wx.onTouchStart((e) => {
  const t = (e.touches && e.touches[0]) || (e.changedTouches && e.changedTouches[0]);
  if (!t) return;
  // 不同基础库 touch 坐标字段名不一致：优先 clientX，回退 x / pageX
  const px = (t.clientX !== undefined) ? t.clientX
    : (t.x !== undefined) ? t.x
    : (t.pageX || 0);
  const py = (t.clientY !== undefined) ? t.clientY
    : (t.y !== undefined) ? t.y
    : (t.pageY || 0);
  if (state === 'home') {
    if (hit(startBtn, px, py)) startGame();
  } else if (state === 'gameover') {
    if (hit(restartBtn, px, py)) startGame();
  } else if (state === 'playing') {
    onTapLetter(px, py);
  }
});

// 启动渲染循环
raf(loop);
