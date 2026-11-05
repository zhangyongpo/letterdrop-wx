// game.js —— 微信小游戏版（原生 Canvas 2D，无 DOM / 无 WXML）
// 玩法：App 报出目标字母读音，屏幕上 6 个字母（3列×2排）掉落，
// 玩家在落地前点中正确字母消除；不区分大小写；点错（干扰项）扣分（不低于0）；
// 目标字母落地漏点扣 1 命；每 10 组速度 +1 档（无上限）；3 命结束。

const {
  LETTERS, GROUP_SIZE, COLS, MAX_TARGET_COUNT, GROUPS_PER_LEVEL,
  MAX_LIVES, CORRECT_SCORE, WRONG_PENALTY, speedForLevel
} = require('./config/gameConfig');
const { announceLetter, announceWord, speakWord } = require('./utils/audio');

// 英文手写体（Patrick Hand，OFL 开源可商用），用于拼单词页，更接近英语字帖书写风格。
// wx.loadFont 在游戏启动时加载一次，Canvas 用返回的字族名即可，加载完成前自动回退 sans-serif。
const SPELL_FONT = (typeof wx !== 'undefined' && wx.loadFont)
  ? wx.loadFont('/assets/fonts/patrickhand.ttf')
  : null;
const { BOOK } = require('./data/words');

// “拼单词”模式章节列表：各单元 + “全部章节”
const SPELL_CHAPTERS = BOOK.chapters.concat(BOOK.all);

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
// state: 'nav' | 'home' | 'playing' | 'gameover' | 'confirmExit'
//         | 'grade' | 'chapter' | 'spell'
//   nav         —— 模式选择导航页（找字母 / 拼单词）
//   home        —— 找字母模式主页（原首页，含“开始游戏”按钮）
//   playing     —— 找字母游戏中
//   confirmExit —— 找字母游戏中点击“退出”后的二次确认弹框（游戏暂停）
//   grade       —— 拼单词：一级菜单（三年级上册）
//   chapter     —— 拼单词：二级菜单（具体章节 + 全部章节）
//   spell       —— 拼单词：拼写练习（含答对后的弹框）
let state = 'nav';
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
let navFindBtn = null;           // 导航页“找字母”菜单区域
let navSpellBtn = null;          // 导航页“拼单词”菜单区域（置灰，即将到来）
let backBtn = null;              // 返回导航页按钮（主页/结束页左上角）
let exitBtn = null;              // 游戏中左上角“退出”按钮
let exitConfirmBtn = null;       // 退出确认弹框“确定退出”按钮
let exitCancelBtn = null;        // 退出确认弹框“继续游戏”按钮

// ---- 拼单词模式相关状态/变量 ----
let gradeBtn = null;             // 一级菜单“三年级上册”卡片区域
let chapterCards = [];           // 二级菜单各章节卡片区域（数组）
let chapterScrollY = 0;          // 二级菜单列表滚动偏移
let lastTouchY = null;           // 触摸拖动时的上一个触点 Y（用于章节滚动）
let spellChapterName = '';       // 当前章节名（拼写页顶部显示）
let spellList = [];              // 当前章节的单词列表（已打乱）
let spellIndex = 0;              // 当前单词下标
let spellWord = '';              // 当前要拼的单词（小写）
let spellMeaning = '';           // 当前单词中文释义
let spellCandidates = [];        // 候选字母 [{ch, selected}]
let spellOrder = [];             // 已选字母对应的候选下标顺序
let spellSolved = false;         // 当前单词是否已拼对（显示弹框）
let spellBackBtn = null;         // 拼写页返回按钮（左上角）
let spellSpeakerBtn = null;      // 拼写页小喇叭按钮（底部）
let spellNextBtn = null;         // 答对弹框“下一个”按钮
let spellTileRects = [];         // 候选字母方块的可点击区域（{x,y,w,h} 左上角）

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

// ============ 拼单词模式 ============

// 生成候选字母：数量为单词长度的 2~3 倍（至少 6 个），全部小写。
// 必含该单词所需的全部字母（含重复），其余为随机干扰项。
function buildCandidates(word) {
  const need = word.split('');              // 已含单词内的重复字母
  const n = need.length;
  let total = n * 2 + Math.floor(Math.random() * (n + 1)); // 区间 [2n, 3n]
  if (total < 6) total = 6;                 // 最少 6 个
  const pool = need.slice();
  const alpha = 'abcdefghijklmnopqrstuvwxyz';
  let guard = 0;
  while (pool.length < total && guard < 300) {
    pool.push(alpha[Math.floor(Math.random() * 26)]);
    guard++;
  }
  return shuffled(pool).map((ch) => ({ ch, selected: false }));
}

// 载入第 i 个单词（重置候选与选择）
function loadSpellWord(i) {
  const w = spellList[i];
  spellWord = w.en.toLowerCase();
  spellMeaning = w.cn;
  spellCandidates = buildCandidates(spellWord);
  spellOrder = [];
  spellSolved = false;
}

// 进入某章节的拼写练习
function startSpellChapter(chapterId) {
  const ch = SPELL_CHAPTERS.find((c) => c.id === chapterId);
  if (!ch) return;
  spellChapterName = ch.name;
  // 过滤掉含空格的短语（不适合逐字母拼写），再打乱顺序
  spellList = shuffled(ch.words.filter((w) => !/\s/.test(w.en)));
  spellIndex = 0;
  loadSpellWord(0);
  state = 'spell';
  // 进入时默认播放一遍（优先真实发音，回退逐字母拼读）。
  // 延迟约 350ms：刚从菜单切换过来，立即 play 在微信小游戏里偶尔会被静默丢弃，
  // 延迟可避开页面切换瞬间的渲染抢占，确保首个单词一定能出声。
  setTimeout(() => { if (state === 'spell') speakWord(spellWord); }, 350);
}

// 切换到下一个单词；列表结束则返回二级菜单
function nextSpellWord() {
  spellIndex += 1;
  if (spellIndex >= spellList.length) {
    state = 'chapter';
    chapterScrollY = 0;
    return;
  }
  loadSpellWord(spellIndex);
  // 切到下一个单词后自动播放一遍（优先真实发音，回退逐字母拼读），
  // 延迟 ~350ms 避开弹框消失/页面切换瞬间的渲染抢占，确保一定能出声。
  setTimeout(() => { if (state === 'spell') speakWord(spellWord); }, 350);
}

// 点击候选字母：已选则取消（从输入框移除），未选则追加到末尾；每次点击后判断是否拼对
function toggleCandidate(idx) {
  const c = spellCandidates[idx];
  if (!c) return;
  if (c.selected) {
    const oi = spellOrder.indexOf(idx);
    if (oi >= 0) spellOrder.splice(oi, 1);
    c.selected = false;
  } else {
    c.selected = true;
    spellOrder.push(idx);
  }
  const input = spellOrder.map((i) => spellCandidates[i].ch).join('');
  if (input === spellWord) {
    spellSolved = true;
    speakWord(spellWord); // 拼对后再播一遍真实发音强化记忆
  }
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

// 拼单词候选字母方块：复用“找字母”掉落字母的同款视觉
// （彩色圆角方块 + 白字 + 白色描边），保证两处风格统一。
function drawSpellTile(x, y, size, ch, selected, idx) {
  const r = Math.min(14, size / 2);
  ctx.fillStyle = LETTER_COLORS[idx % LETTER_COLORS.length];
  roundRectPath(ctx, x, y, size, size, r);
  ctx.fill();
  ctx.lineWidth = selected ? 5 : 3;
  ctx.strokeStyle = selected ? '#5a2d00' : 'rgba(255,255,255,0.85)';
  roundRectPath(ctx, x, y, size, size, r);
  ctx.stroke();
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = Math.round(size * 0.5) + 'px ' + (SPELL_FONT || 'sans-serif');
  ctx.fillText(ch, x + size / 2, y + size / 2);

  // 选中：右上角绿色对勾徽标
  if (selected) {
    const bx = x + size - 4;
    const by = y + 4;
    const br = size * 0.18;
    ctx.fillStyle = '#2e7d32';
    ctx.beginPath(); ctx.arc(bx, by, br, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(bx - br * 0.4, by);
    ctx.lineTo(bx - br * 0.1, by + br * 0.35);
    ctx.lineTo(bx + br * 0.45, by - br * 0.4);
    ctx.stroke();
  }
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

// 左上角“返回”按钮（圆形圆角，白色底 + ← 箭头），点击回到导航页
function drawBackButton(rect) {
  const r = 24;
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  roundRectPath(ctx, rect.x, rect.y, rect.w, rect.h, r);
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(90,45,0,0.25)';
  roundRectPath(ctx, rect.x, rect.y, rect.w, rect.h, r);
  ctx.stroke();
  ctx.fillStyle = '#5a2d00';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = 'bold 36px sans-serif';
  ctx.fillText('←', rect.x + rect.w / 2, rect.y + rect.h / 2 + 1);
}

function drawHome() {
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, W, H);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // 左上角返回按钮：回到模式选择导航页
  backBtn = { x: 20, y: 20, w: 80, h: 48 };
  drawBackButton(backBtn);

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

// 绘制导航页（模式选择）：找字母（可点）/ 拼单词（置灰，即将到来）
function drawNav() {
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, W, H);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // 标题：随屏宽自适应
  let titleSize = Math.min(80, W * 0.2);
  ctx.font = 'bold ' + titleSize + 'px sans-serif';
  let tW = ctx.measureText('字母拼拼').width;
  if (tW > W * 0.92) titleSize = Math.floor(titleSize * (W * 0.92) / tW);
  ctx.font = 'bold ' + titleSize + 'px sans-serif';
  ctx.fillStyle = '#5a2d00';
  ctx.fillText('字母拼拼', W / 2, H * 0.16);

  // 副标题
  const sub = '选择一个模式开始吧';
  let subSize = Math.min(26, W * 0.07);
  ctx.font = subSize + 'px sans-serif';
  let sW = ctx.measureText(sub).width;
  if (sW > W * 0.9) subSize = Math.floor(subSize * (W * 0.9) / sW);
  ctx.font = subSize + 'px sans-serif';
  ctx.fillStyle = '#8a5a2b';
  ctx.fillText(sub, W / 2, H * 0.24);

  // 两张菜单卡片（宽度随屏宽自适应，上下居中偏下排布）
  const cardW = Math.min(360, W - 80);
  const cardH = 120;
  const gap = 36;
  const totalH = cardH * 2 + gap;
  const startY = (H - totalH) / 2 + H * 0.04;

  navFindBtn = { x: W / 2 - cardW / 2, y: startY, w: cardW, h: cardH };
  drawMenuCard(navFindBtn, '找字母', '听音找字母', true);

  navSpellBtn = { x: W / 2 - cardW / 2, y: startY + cardH + gap, w: cardW, h: cardH };
  drawMenuCard(navSpellBtn, '拼单词', '按序拼单词', true);
}

// 绘制一张菜单卡片（enabled=false 时置灰并显示“即将到来”标签）
function drawMenuCard(rect, title, sub, enabled) {
  const r = 22;
  ctx.fillStyle = enabled ? '#ff7a18' : '#cfcfcf';
  roundRectPath(ctx, rect.x, rect.y, rect.w, rect.h, r);
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = 'rgba(255,255,255,0.6)';
  roundRectPath(ctx, rect.x, rect.y, rect.w, rect.h, r);
  ctx.stroke();

  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 44px sans-serif';
  // 标题过长时自动缩小字号，避免超出卡片（右侧需给箭头/标签留位）
  let tw = ctx.measureText(title).width;
  const maxTW = rect.w - 92;
  if (tw > maxTW) ctx.font = 'bold ' + Math.floor(44 * maxTW / tw) + 'px sans-serif';
  ctx.fillText(title, rect.x + 32, rect.y + rect.h / 2 - 16);

  let subSize = Math.min(24, rect.w * 0.06);
  ctx.font = subSize + 'px sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.fillText(sub, rect.x + 32, rect.y + rect.h / 2 + 22);

  if (enabled) {
    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.font = '40px sans-serif';
    ctx.fillText('›', rect.x + rect.w - 28, rect.y + rect.h / 2);
  } else {
    const tag = '即将到来';
    ctx.font = '22px sans-serif';
    const tw = ctx.measureText(tag).width + 24;
    const th = 36;
    const tx = rect.x + rect.w - tw - 18;
    const ty = rect.y + rect.h / 2 - th / 2;
    ctx.fillStyle = 'rgba(120,120,120,0.9)';
    roundRectPath(ctx, tx, ty, tw, th, 18);
    ctx.fill();
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(tag, tx + tw / 2, rect.y + rect.h / 2);
  }
  ctx.textAlign = 'center'; // 复位，避免影响其它绘制
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

  // 左上角“退出”按钮：游戏中可发起退出（弹框二次确认）
  exitBtn = { x: 20, y: 20, w: 84, h: 44 };
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  roundRectPath(ctx, exitBtn.x, exitBtn.y, exitBtn.w, exitBtn.h, 22);
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = 'rgba(192,57,43,0.5)';
  roundRectPath(ctx, exitBtn.x, exitBtn.y, exitBtn.w, exitBtn.h, 22);
  ctx.stroke();
  ctx.fillStyle = '#c0392b';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = 'bold 28px sans-serif';
  ctx.fillText('退出', exitBtn.x + exitBtn.w / 2, exitBtn.y + exitBtn.h / 2 + 1);
}

// 游戏中“退出”确认弹框（底层先画一次 playing 场景，叠半透明遮罩 + 对话框）
function drawExitConfirm() {
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(0, 0, W, H);

  const cardW = Math.min(320, W - 60);
  const cardH = 230;
  const cardX = W / 2 - cardW / 2;
  const cardY = H / 2 - cardH / 2;
  ctx.fillStyle = '#ffffff';
  roundRectPath(ctx, cardX, cardY, cardW, cardH, 24);
  ctx.fill();

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#5a2d00';
  ctx.font = 'bold 38px sans-serif';
  ctx.fillText('退出当前游戏？', W / 2, cardY + 56);

  ctx.fillStyle = '#8a5a2b';
  ctx.font = '28px sans-serif';
  ctx.fillText('当前得分 ' + score, W / 2, cardY + 104);

  const btnW = (cardW - 60) / 2;
  const btnH = 60;
  const btnY = cardY + cardH - 84;
  // 继续游戏（取消）
  exitCancelBtn = { x: cardX + 20, y: btnY, w: btnW, h: btnH };
  ctx.fillStyle = '#eeeeee';
  roundRectPath(ctx, exitCancelBtn.x, exitCancelBtn.y, exitCancelBtn.w, exitCancelBtn.h, 16);
  ctx.fill();
  ctx.fillStyle = '#555555';
  ctx.font = 'bold 30px sans-serif';
  ctx.fillText('继续', exitCancelBtn.x + btnW / 2, exitCancelBtn.y + btnH / 2);

  // 确定退出（确认）
  exitConfirmBtn = { x: cardX + 40 + btnW, y: btnY, w: btnW, h: btnH };
  ctx.fillStyle = '#ff7a18';
  roundRectPath(ctx, exitConfirmBtn.x, exitConfirmBtn.y, exitConfirmBtn.w, exitConfirmBtn.h, 16);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 30px sans-serif';
  ctx.fillText('退出', exitConfirmBtn.x + btnW / 2, exitConfirmBtn.y + btnH / 2);
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

  // 左上角返回按钮：回到模式选择导航页
  backBtn = { x: 20, y: 20, w: 80, h: 48 };
  drawBackButton(backBtn);
}

// 绘制小喇叭按钮（橙色圆 + 白色喇叭 + 声波）
function drawSpeaker(rect) {
  const cx = rect.x + rect.w / 2;
  const cy = rect.y + rect.h / 2;
  const r = Math.min(rect.w, rect.h) / 2;
  ctx.fillStyle = '#ff7a18';
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();

  const bw = r * 0.42;
  const bh = r * 0.5;
  const bx = cx - bw * 0.9;
  const by = cy - bh / 2;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(bx, by, bw * 0.55, bh);                 // 喇叭主体
  ctx.beginPath();                                      // 喇叭锥
  ctx.moveTo(bx + bw * 0.55, by);
  ctx.lineTo(bx + bw * 1.15, by - bh * 0.35);
  ctx.lineTo(bx + bw * 1.15, by + bh * 1.35);
  ctx.lineTo(bx + bw * 0.55, by + bh);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#ffffff';                          // 声波
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(cx + r * 0.15, cy, r * 0.5, -Math.PI / 3.2, Math.PI / 3.2); ctx.stroke();
  ctx.beginPath(); ctx.arc(cx + r * 0.15, cy, r * 0.78, -Math.PI / 3.2, Math.PI / 3.2); ctx.stroke();
}

// 一级菜单：选择年级（当前仅有“三年级上册”）
function drawGrade() {
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, W, H);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // 返回导航页
  backBtn = { x: 20, y: 20, w: 80, h: 48 };
  drawBackButton(backBtn);

  let titleSize = Math.min(64, W * 0.16);
  ctx.font = 'bold ' + titleSize + 'px sans-serif';
  ctx.fillStyle = '#5a2d00';
  ctx.fillText('选择年级', W / 2, H * 0.16);

  ctx.fillStyle = '#8a5a2b';
  ctx.font = (Math.min(26, W * 0.07)) + 'px sans-serif';
  ctx.fillText('Join In 英语 · 三年级上册', W / 2, H * 0.24);

  const cardW = Math.min(360, W - 80);
  const cardH = 120;
  const y = (H - cardH) / 2 + H * 0.04;
  gradeBtn = { x: W / 2 - cardW / 2, y, w: cardW, h: cardH };
  drawMenuCard(gradeBtn, BOOK.title, '点击进入单词练习', true);
}

// 二级菜单：选择章节（含“全部章节”），列表支持上下拖动滚动
function drawChapter() {
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, W, H);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  backBtn = { x: 20, y: 20, w: 80, h: 48 };
  drawBackButton(backBtn);

  let titleSize = Math.min(64, W * 0.16);
  ctx.font = 'bold ' + titleSize + 'px sans-serif';
  ctx.fillStyle = '#5a2d00';
  ctx.fillText(BOOK.title, W / 2, H * 0.10);

  ctx.fillStyle = '#8a5a2b';
  ctx.font = (Math.min(24, W * 0.06)) + 'px sans-serif';
  ctx.fillText('选择章节开始练习', W / 2, H * 0.17);

  const startY = Math.round(H * 0.22);
  const rowH = 72;
  const gap = 16;
  const listTop = startY;
  const listBottom = H - 24;
  const listH = listBottom - listTop;
  const contentH = SPELL_CHAPTERS.length * (rowH + gap);
  const maxScroll = Math.max(0, contentH - listH);
  if (chapterScrollY > maxScroll) chapterScrollY = maxScroll;

  chapterCards = [];
  SPELL_CHAPTERS.forEach((ch, i) => {
    const y = startY + i * (rowH + gap) - chapterScrollY;
    const rect = { x: 20, y, w: W - 40, h: rowH };
    chapterCards.push({ rect, id: ch.id });
    // 仅绘制落在可视区域内的卡片
    if (y + rowH >= listTop - 4 && y <= listBottom + 4) {
      const count = ch.words.filter((w) => !/\s/.test(w.en)).length;
      drawMenuCard(rect, ch.name, count + ' 个单词', true);
    }
  });
}

// 拼单词练习页
function drawSpell() {
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, W, H);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // 返回按钮（回到章节选择）
  spellBackBtn = { x: 20, y: 20, w: 80, h: 48 };
  drawBackButton(spellBackBtn);

  // 顶部：仅显示当前单词的字母数量（不再显示章节名）
  let headSize = Math.min(34, W * 0.09);
  ctx.font = 'bold ' + headSize + 'px sans-serif';
  ctx.fillStyle = '#5a2d00';
  ctx.fillText('字母数量 ' + spellWord.length, W / 2, 52);
  ctx.fillStyle = '#b06a2b';
  ctx.font = (Math.min(20, W * 0.055)) + 'px sans-serif';
  ctx.fillText('第 ' + (spellIndex + 1) + ' / ' + spellList.length + ' 个', W / 2, 86);

  // 输入框：英文书写四线三格（统一字号、字母按书写规范紧凑连续书写，像字帖）
  const boxW = Math.min(360, W - 60);
  const lineGap = 22;            // 相邻横线间距（即中格高度）
  const pad = 16;
  const boxH = lineGap * 3 + pad * 2;
  const boxX = W / 2 - boxW / 2;
  const boxY = 110;

  // 白底圆角卡片
  ctx.fillStyle = 'rgba(255,255,255,0.97)';
  roundRectPath(ctx, boxX, boxY, boxW, boxH, 20);
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(255,122,24,0.5)';
  roundRectPath(ctx, boxX, boxY, boxW, boxH, 20);
  ctx.stroke();

  // 四线三格的四条横线（中格两条线稍淡，像英语本）
  const lineY = [];
  for (let k = 0; k < 4; k++) lineY.push(boxY + pad + k * lineGap);
  const innerL = boxX + 10, innerR = boxX + boxW - 10;
  for (let k = 0; k < 4; k++) {
    ctx.beginPath();
    ctx.moveTo(innerL, lineY[k]);
    ctx.lineTo(innerR, lineY[k]);
    ctx.lineWidth = (k === 1 || k === 2) ? 1 : 1.5;
    ctx.strokeStyle = (k === 1 || k === 2) ? 'rgba(90,150,210,0.35)' : 'rgba(90,150,210,0.6)';
    ctx.stroke();
  }

  const input = spellOrder.map((i) => spellCandidates[i].ch).join('');
  if (input.length === 0) {
    ctx.fillStyle = '#bbbbbb';
    ctx.font = (Math.min(20, boxW * 0.05)) + 'px ' + (SPELL_FONT || 'sans-serif');
    ctx.fillText('点击下方字母，拼出听到的单词', W / 2, (lineY[1] + lineY[2]) / 2);
  } else {
    // 所有字母统一字号（= 2 个格高，正好填满对应占位的格），按书写规范竖直定位：
    // 中格字母居中于中格；上伸字母(bdfhklt)占上中两格；下伸字母(gpqy)占中下两格。
    // 字母用 measureText 紧凑连续书写并整体居中，像正常写单词，不再逐字分大格。
    const fz = lineGap * 2;
    const ASC = 'bdfhklt';
    const DESC = 'gpqy';
    const stepGap = fz * 0.12;   // 字母间紧凑步距
    const adv = [];
    let totalW = 0;
    ctx.font = Math.round(fz) + 'px ' + (SPELL_FONT || 'sans-serif');
    for (let i = 0; i < input.length; i++) {
      const w = ctx.measureText(input[i]).width;
      adv.push(w);
      totalW += w + (i < input.length - 1 ? stepGap : 0);
    }
    let x = W / 2 - totalW / 2;  // 左起光标（字母左边缘）
    ctx.fillStyle = '#5a2d00';
    for (let i = 0; i < input.length; i++) {
      const ch = input[i];
      let midY;
      if (ASC.indexOf(ch) >= 0) midY = (lineY[0] + lineY[2]) / 2;
      else if (DESC.indexOf(ch) >= 0) midY = (lineY[1] + lineY[3]) / 2;
      else midY = (lineY[1] + lineY[2]) / 2;
      ctx.fillText(ch, x + adv[i] / 2, midY);
      x += adv[i] + stepGap;
    }
  }

  // 候选字母网格：复用“找字母”掉落字母的彩色方块样式，每行 5 个，行间距更小
  const sideMargin = 18;
  const cols = 5;
  const gap = 12;                          // 方块间距（含行间距），紧凑排布
  const areaTop = boxY + boxH + 26;
  const areaBottom = H - 130;              // 给底部小喇叭留位
  const areaW = W - sideMargin * 2;
  const cellW = areaW / cols;
  const maxRows = 6;                       // 以最多 6 行为基准算方块尺寸，长单词也能放下
  const byH = (areaBottom - areaTop - (maxRows - 1) * gap) / maxRows;
  let size = Math.min(cellW - gap, byH);
  if (size > 76) size = 76;                // 上限，避免过大
  const count = spellCandidates.length;
  const gridW = cols * cellW;
  const startX = sideMargin + (areaW - gridW) / 2 + cellW / 2;
  const startY = areaTop + size / 2 + 4;
  spellTileRects = [];
  spellCandidates.forEach((c, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const cx = startX + col * cellW;
    const cy = startY + row * (size + gap);
    const x = cx - size / 2;
    const y = cy - size / 2;
    spellTileRects.push({ x, y, w: size, h: size, idx: i });
    drawSpellTile(x, y, size, c.ch, c.selected, i);
  });

  // 底部小喇叭
  spellSpeakerBtn = { x: W / 2 - 46, y: H - 104, w: 92, h: 92 };
  drawSpeaker(spellSpeakerBtn);

  // 答对弹框
  if (spellSolved) drawSpellDialog();
}

// 答对后的弹框：显示单词与中文释义，附“下一个”按钮
function drawSpellDialog() {
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.fillRect(0, 0, W, H);

  const cardW = Math.min(340, W - 50);
  const cardH = 300;
  const cardX = W / 2 - cardW / 2;
  const cardY = H / 2 - cardH / 2;
  ctx.fillStyle = '#ffffff';
  roundRectPath(ctx, cardX, cardY, cardW, cardH, 24);
  ctx.fill();

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#2e7d32';
  ctx.font = 'bold 38px sans-serif';
  ctx.fillText('拼对啦！', W / 2, cardY + 50);

  ctx.fillStyle = '#5a2d00';
  ctx.font = 'bold 56px sans-serif';
  ctx.fillText(spellWord, W / 2, cardY + 116);

  ctx.fillStyle = '#8a5a2b';
  ctx.font = '30px sans-serif';
  ctx.fillText(spellMeaning, W / 2, cardY + 174);

  const btnW = cardW - 80;
  const btnH = 64;
  const btnY = cardY + cardH - 84;
  spellNextBtn = { x: W / 2 - btnW / 2, y: btnY, w: btnW, h: btnH };
  ctx.fillStyle = '#ff7a18';
  roundRectPath(ctx, spellNextBtn.x, spellNextBtn.y, spellNextBtn.w, spellNextBtn.h, 18);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 32px sans-serif';
  ctx.fillText('下一个', spellNextBtn.x + btnW / 2, spellNextBtn.y + btnH / 2);
}

function draw() {
  if (state === 'nav') drawNav();
  else if (state === 'home') drawHome();
  else if (state === 'playing') drawPlaying();
  else if (state === 'confirmExit') { drawPlaying(); drawExitConfirm(); }
  else if (state === 'gameover') drawGameOver();
  else if (state === 'grade') drawGrade();
  else if (state === 'chapter') drawChapter();
  else if (state === 'spell') drawSpell();
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
// 统一取出触点坐标（不同基础库字段名不一致：优先 clientX，回退 x / pageX）
function getPoint(e) {
  const t = (e.touches && e.touches[0]) || (e.changedTouches && e.changedTouches[0]);
  if (!t) return null;
  const x = (t.clientX !== undefined) ? t.clientX
    : (t.x !== undefined) ? t.x
    : (t.pageX || 0);
  const y = (t.clientY !== undefined) ? t.clientY
    : (t.y !== undefined) ? t.y
    : (t.pageY || 0);
  return { x, y };
}

wx.onTouchStart((e) => {
  const p = getPoint(e);
  if (!p) return;
  const px = p.x, py = p.y;
  if (state === 'nav') {
    // 找字母：进入原首页（主页）；拼单词：进入年级选择
    if (hit(navFindBtn, px, py)) { state = 'home'; return; }
    if (hit(navSpellBtn, px, py)) { state = 'grade'; return; }
  } else if (state === 'grade') {
    if (hit(backBtn, px, py)) { state = 'nav'; return; }
    if (hit(gradeBtn, px, py)) { state = 'chapter'; chapterScrollY = 0; return; }
  } else if (state === 'chapter') {
    if (hit(backBtn, px, py)) { state = 'grade'; return; }
    for (const item of chapterCards) {
      if (hit(item.rect, px, py)) { startSpellChapter(item.id); return; }
    }
  } else if (state === 'home') {
    if (hit(backBtn, px, py)) { state = 'nav'; return; }
    if (hit(startBtn, px, py)) startGame();
  } else if (state === 'gameover') {
    if (hit(backBtn, px, py)) { state = 'nav'; return; }
    if (hit(restartBtn, px, py)) startGame();
  } else if (state === 'playing') {
    if (hit(exitBtn, px, py)) { state = 'confirmExit'; return; } // 发起退出 -> 弹框确认
    onTapLetter(px, py);
  } else if (state === 'confirmExit') {
    if (hit(exitConfirmBtn, px, py)) {
      // 确定退出：保存最高分并返回导航页
      best = Math.max(best, score);
      wx.setStorageSync('letterdrop_best', best);
      state = 'nav';
      return;
    }
    if (hit(exitCancelBtn, px, py)) {
      // 继续游戏：解除暂停
      state = 'playing';
      lastTime = Date.now();
      return;
    }
  } else if (state === 'spell') {
    if (hit(spellBackBtn, px, py)) { state = 'chapter'; chapterScrollY = 0; return; }
    if (spellSolved) {
      if (hit(spellNextBtn, px, py)) nextSpellWord(); // 答对弹框：下一个
      return;
    }
    if (hit(spellSpeakerBtn, px, py)) { speakWord(spellWord); return; } // 重听单词
    for (const tile of spellTileRects) {
      if (hit(tile, px, py)) { toggleCandidate(tile.idx); return; }
    }
  }
});

// 章节列表上下拖动滚动（仅 chapter 状态生效）
wx.onTouchMove((e) => {
  if (state !== 'chapter') { lastTouchY = null; return; }
  const p = getPoint(e);
  if (!p) return;
  if (lastTouchY !== null) {
    const dy = p.y - lastTouchY;
    chapterScrollY -= dy;
    const startY = Math.round(H * 0.22);
    const rowH = 72, gap = 16;
    const listH = (H - 24) - startY;
    const contentH = SPELL_CHAPTERS.length * (rowH + gap);
    const maxScroll = Math.max(0, contentH - listH);
    if (chapterScrollY < 0) chapterScrollY = 0;
    if (chapterScrollY > maxScroll) chapterScrollY = maxScroll;
  }
  lastTouchY = p.y;
});

wx.onTouchEnd(() => { lastTouchY = null; });

// 启动渲染循环
raf(loop);
