// game.js —— 微信小游戏版（原生 Canvas 2D，无 DOM / 无 WXML）
// 玩法：App 报出目标字母读音，屏幕上 6 个字母（3列×2排）掉落，
// 玩家在落地前点中正确字母消除；不区分大小写；点错（干扰项）扣分（不低于0）；
// 目标字母落地漏点扣 1 命；每 10 组速度 +1 档（无上限）；3 命结束。

const {
  LETTERS, GROUP_SIZE, COLS, MAX_TARGET_COUNT, GROUPS_PER_LEVEL,
  MAX_LIVES, CORRECT_SCORE, WRONG_PENALTY, speedForLevel
} = require('./config/gameConfig');
const {
  announceLetter, announceWord, speakWord, unlockAudio,
  setGrade, isGradeReady, loadGradeAudio
} = require('./utils/audio');

// 英文印刷体（Andika，SIL 出品，OFL 开源可商用），专为初学者识字设计，字母形态清晰规范，
// 小写 a/g 为课本标准双体结构，最贴近小学英语书写印刷体。用于拼单词页。
// wx.loadFont 在游戏启动时加载一次，Canvas 用返回的字族名即可，加载完成前自动回退 sans-serif。
const SPELL_FONT = (typeof wx !== 'undefined' && wx.loadFont)
  ? wx.loadFont('assets/fonts/andika.ttf')
  : null;
const { BOOKS, GRADES } = require('./data/book_index');

// 当前年级词库：六册教材（2024 审定外研剑桥 Join In 三起，三/四上+下册、五/六上）全部内置。
// 切换年级时由 setCurrentGrade 重算以下三个 let 变量，其余代码在运行时读取，无需改调用点。
let currentGradeId = 'g3';
let BOOK = BOOKS.g3;
let SPELL_CHAPTERS = BOOK.chapters.concat(BOOK.all);
// 六册发音 mp3 已全部生成并放入各册分包，所有章节（含 Plays）均开放，不再置灰。
let SPELL_OPEN = BOOK.chapters.map((c) => c.id);

function setCurrentGrade(id) {
  currentGradeId = BOOKS[id] ? id : 'g3';
  BOOK = BOOKS[currentGradeId];
  SPELL_CHAPTERS = BOOK.chapters.concat(BOOK.all);
  SPELL_OPEN = BOOK.chapters.map((c) => c.id);
  chapterScrollY = 0;
  setGrade(currentGradeId); // 切换 audio.js 的发音查找年级
}

// 字母徽标配色（彩色圆角方块，白字）
const LETTER_COLORS = ['#ff7a18', '#ff5252', '#42a5f5', '#66bb6a', '#ab47bc', '#ffca28', '#26c6da', '#ec407a'];

// iOS 音频会话解锁标记：首次用户触摸时激活，确保后续异步报音（字母掉落/拼词）在 iOS 出声
let touchUnlocked = false;

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
//         | 'grade' | 'loading' | 'loadFail' | 'chapter' | 'spellMode'
//         | 'spell' | 'wordList' | 'match'
//   nav         —— 模式选择导航页（找字母 / 拼单词）
//   home        —— 找字母模式主页（原首页，含“开始游戏”按钮）
//   playing     —— 找字母游戏中
//   confirmExit —— 找字母游戏中点击“退出”后的二次确认弹框（游戏暂停）
//   grade       —— 拼单词：一级菜单（三~六年级共 6 册，卡片可上下滑动）
//   loading     —— 年级发音分包下载中（进度条）
//   loadFail    —— 分包下载失败（可重试 / 仍要进入，发音回退逐字母拼读）
//   chapter     —— 拼单词：二级菜单（具体章节 + 全部章节）
//   spellMode   —— 练习模式选择（听音拼 / 中文转 / 查阅 / 对对碰）
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
let gradeCards = [];             // 一级菜单各年级卡片 [{rect, id}]（仅可见卡片）
let gradeScrollY = 0;            // 一级菜单滚动偏移（册数变多后可上下滑动）
let gradePendingCard = null;     // 按下时命中的册 id，抬手且未拖动才真正进入
let gradeTouchStartY = 0;        // 按下时的 Y，用于区分点击与滑动
let gradeTouchMoved = false;     // 是否已判定为滑动
let pendingGradeId = 'g3';       // 正在下载 / 下载失败的年级
let loadingProgress = 0;         // 分包下载进度 0~100
let loadingGradeName = '';       // 正在下载的年级名
let loadingErrMsg = '';          // 下载失败原因
let loadFailBtns = null;         // 失败页「重试 / 仍要进入」按钮
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
let spellDialogSpeakBtn = null;  // 答对弹框“听发音”按钮

// 单词表（查阅）相关
let wordListChapterId = '';      // 来自哪个章节（返回时用）
let wordListName = '';           // 章节名（标题展示）
let wordListItems = [];          // 单词列表：{ en, cn }
let wordListScrollY = 0;         // 列表滚动偏移
let wordListBackBtn = null;      // 返回按钮（左上角）
let wordListSpeakers = [];       // 每行喇叭按钮：{ rect, word }
let spellTileRects = [];         // 候选字母方块的可点击区域（{x,y,w,h} 左上角）
let spellChapterId = '';         // 当前选中的章节 id（模式选择页进入时用）
let spellMode = 'listen';        // 拼写模式：'listen' 听音拼单词 / 'cn' 中文转单词
let spellModeCards = [];         // 模式选择页两张卡片区域（{rect, mode}）
let spellModeBackBtn = null;     // 模式选择页返回按钮（左上角）

// ---- 单词对对碰（match）相关状态 ----
let matchBlocks = [];            // 棋盘块：{x,y,w,h,text,type:'en'|'cn',pairId,removed}
let matchCols = 0, matchRows = 0;
let matchSel = null;             // 当前选中的块（等待第二块）
let matchDone = false;           // 是否全部消除
let matchMsg = '';               // 临时提示（如“不匹配”）
let matchMsgTimer = 0;           // 提示剩余显示时间(ms)
let matchBackBtn = null;         // 返回按钮（左上角）
let matchChapterName = '';       // 章节名（标题展示）
let FLIP_DUR = 380;              // 配对成功翻转消失动画时长(ms)
// 对对碰块字号/内边距（测量宽度与绘制共用，保证宽度自适应下字体大小一致）
const MATCH_EN_FS = 30, MATCH_CN_FS = 28, MATCH_PAD = 14;

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
function startSpellChapter(chapterId, mode) {
  const ch = SPELL_CHAPTERS.find((c) => c.id === chapterId);
  if (!ch) return;
  spellChapterName = ch.name;
  spellMode = (mode === 'cn') ? 'cn' : 'listen';   // 默认听音模式
  let words;
  if (chapterId === 'all') {
    // “全部章节”合并所有已开放单元（welcome/u1-u5）的单词；未开放单元仍置灰不会进来
    words = [];
    SPELL_OPEN.forEach((id) => {
      const c = BOOK.chapters.find((x) => x.id === id);
      if (c) words.push(...c.words);
    });
  } else {
    words = ch.words;
  }
  // 过滤掉含空格的短语（不适合逐字母拼写），再打乱顺序
  spellList = shuffled(words.filter((w) => /^[a-z]+$/i.test(w.en)));
  spellIndex = 0;
  loadSpellWord(0);
  state = 'spell';
  // 进入时默认播放一遍（仅“听音拼单词”模式才自动发音；中文转单词模式靠看中文释义，不发音）。
  // 延迟约 350ms：刚从菜单切换过来，立即 play 在微信小游戏里偶尔会被静默丢弃，
  // 延迟可避开页面切换瞬间的渲染抢占，确保首个单词一定能出声。
  if (spellMode === 'listen') {
    setTimeout(() => { if (state === 'spell') speakWord(spellWord); }, 350);
  }
}

// 进入某章节的“全部单词”查阅页：列出该单元下所有单词（中英文 + 小喇叭）
function enterWordList(chapterId) {
  const ch = SPELL_CHAPTERS.find((c) => c.id === chapterId);
  if (!ch) return;
  wordListChapterId = chapterId;
  wordListName = ch.name;
  let words;
  if (chapterId === 'all') {
    // “全部章节”合并所有已开放单元（与 startSpellChapter 实际合并范围一致）
    words = [];
    SPELL_OPEN.forEach((id) => {
      const c = BOOK.chapters.find((x) => x.id === id);
      if (c) words.push(...c.words);
    });
  } else {
    words = ch.words;
  }
  // 去重（按英文小写），避免 welcome 与单元重复词反复出现；保留首次出现的中文
  const seen = {};
  wordListItems = [];
  words.forEach((w) => {
    const k = w.en.toLowerCase();
    if (!seen[k]) { seen[k] = 1; wordListItems.push({ en: w.en, cn: w.cn }); }
  });
  wordListScrollY = 0;
  state = 'wordList';
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
  // 切到下一个单词后自动播放一遍（仅听音模式；中文转单词模式靠看中文释义，不发音），
  // 延迟 ~350ms 避开弹框消失/页面切换瞬间的渲染抢占，确保一定能出声。
  if (spellMode === 'listen') {
    setTimeout(() => { if (state === 'spell') speakWord(spellWord); }, 350);
  }
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
    if (spellMode === 'listen') speakWord(spellWord); // 仅听音模式在拼对后播一遍真实发音强化记忆
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
  ctx.font = 'bold 32px sans-serif';
  ctx.fillText(label, rect.x + rect.w / 2, rect.y + rect.h / 2);
}

// 左上角“返回”按钮：轻量圆角白底 + 细线条返回箭头（‹ 形，尖朝左、圆角端点），
// 贴近微信小程序导航栏返回图标的风格；尺寸小巧，避免与顶部标题重合
function drawBackButton(rect) {
  ctx.save();
  const r = 10;
  // 轻量圆角白底（仅作底衬，保证在彩色背景上清晰）
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  roundRectPath(ctx, rect.x, rect.y, rect.w, rect.h, r);
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = 'rgba(90,45,0,0.22)';
  roundRectPath(ctx, rect.x, rect.y, rect.w, rect.h, r);
  ctx.stroke();

  // 两段式线条返回箭头（指向左）
  const cy = rect.y + rect.h / 2;
  const tipX = rect.x + rect.w * 0.40;        // 顶点（最左）
  const armX = rect.x + rect.w * 0.62;         // 右端（两臂汇聚的反向点）
  const armY = rect.h * 0.22;                  // 垂直臂长
  ctx.strokeStyle = '#5a2d00';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(armX, cy - armY);
  ctx.lineTo(tipX, cy);
  ctx.lineTo(armX, cy + armY);
  ctx.stroke();
  ctx.restore();
}

function drawHome() {
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, W, H);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // 左上角返回按钮：回到模式选择导航页
  backBtn = { x: 14, y: 14, w: 52, h: 40 };
  drawBackButton(backBtn);

  // 标题：字号随屏宽自适应，并保证不超出屏宽（避免两侧被截）
  let titleSize = Math.min(52, W * 0.13);
  ctx.font = 'bold ' + titleSize + 'px sans-serif';
  let tW = ctx.measureText('字母掉落').width;
  if (tW > W * 0.92) titleSize = Math.floor(titleSize * (W * 0.92) / tW);
  ctx.font = 'bold ' + titleSize + 'px sans-serif';
  ctx.fillStyle = '#5a2d00';
  ctx.fillText('字母掉落', W / 2, H * 0.28);

  // 副标题：超长时自动缩小以适配屏宽（实测写死 30px 在窄屏会左右截断）
  const subtitle = '听发音，在字母落地前点中它！';
  let subSize = Math.min(24, W * 0.06);
  ctx.font = subSize + 'px sans-serif';
  let sW = ctx.measureText(subtitle).width;
  const maxSubW = W * 0.9;
  if (sW > maxSubW) subSize = Math.floor(subSize * maxSubW / sW);
  ctx.font = subSize + 'px sans-serif';
  ctx.fillStyle = '#8a5a2b';
  ctx.fillText(subtitle, W / 2, H * 0.38);

  // 开始按钮：宽度随屏宽自适应，左右各留边
  const btnW = Math.min(320, W - 80);
  startBtn = { x: W / 2 - btnW / 2, y: H * 0.55, w: btnW, h: 80 };
  drawButton(startBtn, '开始游戏');

  // 最高分：超长自动缩小
  const bestText = '最高分：' + best;
  let bestSize = 24;
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
  let titleSize = Math.min(60, W * 0.15);
  ctx.font = 'bold ' + titleSize + 'px sans-serif';
  let tW = ctx.measureText('字母拼拼').width;
  if (tW > W * 0.92) titleSize = Math.floor(titleSize * (W * 0.92) / tW);
  ctx.font = 'bold ' + titleSize + 'px sans-serif';
  ctx.fillStyle = '#5a2d00';
  ctx.fillText('字母拼拼', W / 2, H * 0.16);

  // 副标题
  const sub = '选择一个模式开始吧';
  let subSize = Math.min(22, W * 0.055);
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
function drawMenuCard(rect, title, sub, enabled, titleSize) {
  const r = 22;
  ctx.fillStyle = enabled ? '#ff7a18' : '#cfcfcf';
  roundRectPath(ctx, rect.x, rect.y, rect.w, rect.h, r);
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = 'rgba(255,255,255,0.6)';
  roundRectPath(ctx, rect.x, rect.y, rect.w, rect.h, r);
  ctx.stroke();

  if (!titleSize || titleSize < 12) titleSize = 34;  // 未指定时沿用默认
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold ' + titleSize + 'px sans-serif';
  // 标题过长时仅在统一字号仍放不下时才缩小（避免各卡片字号不一致）
  let tw = ctx.measureText(title).width;
  const maxTW = rect.w - 92;
  if (tw > maxTW) ctx.font = 'bold ' + Math.floor(titleSize * maxTW / tw) + 'px sans-serif';
  ctx.fillText(title, rect.x + 32, rect.y + rect.h / 2 - 16);

  let subSize = Math.min(20, rect.w * 0.05);
  ctx.font = subSize + 'px sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.fillText(sub, rect.x + 32, rect.y + rect.h / 2 + 22);

  if (enabled) {
    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.font = '32px sans-serif';
    ctx.fillText('›', rect.x + rect.w - 28, rect.y + rect.h / 2);
  } else {
    const tag = '即将到来';
    ctx.font = '20px sans-serif';
    const tw = ctx.measureText(tag).width + 24;
    const th = 32;
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
  ctx.font = 'bold 24px sans-serif';
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
  ctx.font = 'bold 32px sans-serif';
  ctx.fillText('退出当前游戏？', W / 2, cardY + 56);

  ctx.fillStyle = '#8a5a2b';
  ctx.font = '24px sans-serif';
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
  ctx.font = 'bold 26px sans-serif';
  ctx.fillText('继续', exitCancelBtn.x + btnW / 2, exitCancelBtn.y + btnH / 2);

  // 确定退出（确认）
  exitConfirmBtn = { x: cardX + 40 + btnW, y: btnY, w: btnW, h: btnH };
  ctx.fillStyle = '#ff7a18';
  roundRectPath(ctx, exitConfirmBtn.x, exitConfirmBtn.y, exitConfirmBtn.w, exitConfirmBtn.h, 16);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 26px sans-serif';
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
  let overTitleSize = Math.min(48, W * 0.13);
  ctx.font = 'bold ' + overTitleSize + 'px sans-serif';
  let otW = ctx.measureText('游戏结束').width;
  if (otW > W * 0.92) overTitleSize = Math.floor(overTitleSize * (W * 0.92) / otW);
  ctx.font = 'bold ' + overTitleSize + 'px sans-serif';
  ctx.fillStyle = '#5a2d00';
  ctx.fillText('游戏结束', W / 2, H * 0.3);

  ctx.fillStyle = '#ff7a18';
  ctx.font = 'bold 36px sans-serif';
  ctx.fillText('本局得分 ' + score, W / 2, H * 0.42);

  ctx.fillStyle = '#8a5a2b';
  ctx.font = '28px sans-serif';
  ctx.fillText('最高分 ' + best, W / 2, H * 0.5);

  restartBtn = { x: W / 2 - 160, y: H * 0.62, w: 320, h: 80 };
  drawButton(restartBtn, '再来一局');

  // 左上角返回按钮：回到模式选择导航页
  backBtn = { x: 14, y: 14, w: 52, h: 40 };
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

// 一级菜单：选择年级/册次（三~六年级共 6 册，卡片超出屏幕时可上下滑动）
function drawGrade() {
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, W, H);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  backBtn = { x: 14, y: 14, w: 52, h: 40 };
  drawBackButton(backBtn);

  ctx.font = 'bold ' + Math.min(48, W * 0.12) + 'px sans-serif';
  ctx.fillStyle = '#5a2d00';
  ctx.fillText('选择年级', W / 2, H * 0.11);

  ctx.fillStyle = '#8a5a2b';
  ctx.font = (Math.min(20, W * 0.05)) + 'px sans-serif';
  ctx.fillText('Join In 英语 · 三~六年级（' + GRADES.length + ' 册）', W / 2, H * 0.18);

  const cardW = Math.min(360, W - 80);
  const topY = Math.round(H * 0.22);
  const gap = 12, bottomPad = 20;
  const listH = (H - bottomPad) - topY;
  const cardH = Math.max(62, Math.min(88, (listH - gap * (GRADES.length - 1)) / GRADES.length));
  const contentH = GRADES.length * cardH + gap * (GRADES.length - 1);
  const maxScroll = Math.max(0, contentH - listH);
  if (gradeScrollY < 0) gradeScrollY = 0;
  if (gradeScrollY > maxScroll) gradeScrollY = maxScroll;

  gradeCards = [];
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, topY, W, listH);
  ctx.clip();
  GRADES.forEach((g, i) => {
    const y = topY + i * (cardH + gap) - gradeScrollY;
    if (y + cardH < topY || y > topY + listH) return; // 不可见的卡片不参与命中判定
    const rect = { x: W / 2 - cardW / 2, y, w: cardW, h: cardH };
    gradeCards.push({ rect, id: g.id });
    const sub = isGradeReady(g.id) ? '已下载 · 点击进入' : (g.sub + ' · 点此下载发音');
    drawMenuCard(rect, g.title, sub, true, Math.min(28, cardH * 0.32));
  });
  ctx.restore();

  if (maxScroll > 0) {
    ctx.fillStyle = '#a9713d';
    ctx.font = '13px sans-serif';
    ctx.fillText('上下滑动查看更多册次', W / 2, H - 10);
  }
}

// 进入某年级：已加载则直接进章节页，否则先下载该年级的发音分包
function enterGrade(id) {
  if (isGradeReady(id)) {
    setCurrentGrade(id);
    chapterScrollY = 0;
    state = 'chapter';
    return;
  }
  startGradeLoad(id);
}

function startGradeLoad(id) {
  const g = GRADES.find((x) => x.id === id) || GRADES[0];
  pendingGradeId = g.id;
  loadingGradeName = g.title;
  loadingProgress = 0;
  loadingErrMsg = '';
  state = 'loading';
  loadGradeAudio(
    g.id,
    (p) => { loadingProgress = p || 0; },
    () => {
      setCurrentGrade(g.id);
      chapterScrollY = 0;
      state = 'chapter';
    },
    (msg) => {
      loadingErrMsg = msg || '下载失败';
      state = 'loadFail';
    }
  );
}

// 分包下载中：显示进度条（下载后由微信本地缓存，之后进入无需再等）
function drawLoading() {
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  ctx.font = 'bold ' + Math.min(36, W * 0.095) + 'px sans-serif';
  ctx.fillStyle = '#5a2d00';
  ctx.fillText('正在准备发音', W / 2, H * 0.32);
  ctx.font = Math.min(20, W * 0.05) + 'px sans-serif';
  ctx.fillStyle = '#8a5a2b';
  ctx.fillText(loadingGradeName + ' · 首次进入需下载', W / 2, H * 0.40);

  const bw = Math.min(280, W - 80), bx = W / 2 - bw / 2, by = H * 0.48, bh = 16;
  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  roundRectPath(ctx, bx, by, bw, bh, 8);
  ctx.fill();
  const p = Math.max(0, Math.min(100, loadingProgress));
  const fw = Math.max(2, bw * p / 100);
  if (p > 0) {
    ctx.fillStyle = '#ff7a18';
    roundRectPath(ctx, bx, by, Math.min(fw, bw), bh, Math.min(8, fw / 2));
    ctx.fill();
  }
  ctx.fillStyle = '#8a5a2b';
  ctx.font = '16px sans-serif';
  ctx.fillText(Math.round(p) + '%', W / 2, H * 0.56);
  ctx.font = '14px sans-serif';
  ctx.fillText('下载后本地缓存，之后无需联网', W / 2, H * 0.63);
}

// 下载失败：可重试，也可直接进入（发音自动回退为逐字母拼读，不阻塞玩法）
function drawLoadFail() {
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  ctx.font = 'bold ' + Math.min(34, W * 0.09) + 'px sans-serif';
  ctx.fillStyle = '#5a2d00';
  ctx.fillText('发音下载失败', W / 2, H * 0.24);
  ctx.font = Math.min(16, W * 0.042) + 'px sans-serif';
  ctx.fillStyle = '#8a5a2b';
  ctx.fillText(loadingErrMsg, W / 2, H * 0.32);
  ctx.fillText('可重试，或先进入（发音改为逐字母拼读）', W / 2, H * 0.38);

  const cardW = Math.min(340, W - 70), cardH = 92, gap = 18;
  const y = H * 0.46;
  const retry = { x: W / 2 - cardW / 2, y, w: cardW, h: cardH };
  const fallback = { x: retry.x, y: y + cardH + gap, w: cardW, h: cardH };
  loadFailBtns = { retry, fallback };
  drawMenuCard(retry, '重试下载', '重新下载该年级发音', true, 28);
  drawMenuCard(fallback, '仍要进入', '暂不下载，继续玩拼词', true, 28);
}

// 二级菜单：选择章节（含“全部章节”），列表支持上下拖动滚动
function drawChapter() {
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, W, H);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  backBtn = { x: 14, y: 14, w: 52, h: 40 };
  drawBackButton(backBtn);

  let titleSize = Math.min(52, W * 0.13);
  ctx.font = 'bold ' + titleSize + 'px sans-serif';
  ctx.fillStyle = '#5a2d00';
  ctx.fillText(BOOK.title, W / 2, H * 0.10);

  ctx.fillStyle = '#8a5a2b';
  ctx.font = (Math.min(20, W * 0.05)) + 'px sans-serif';
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
  // 先算出能容纳最长单元名的统一标题字号，保证所有单元按钮字号一致（不再各自缩放）
  const chMaxTW = (W - 40) - 92;
  let uniTitleSize = 34;
  SPELL_CHAPTERS.forEach((ch) => {
    ctx.font = 'bold 34px sans-serif';
    const w = ctx.measureText(ch.name).width;
    if (w > chMaxTW) {
      const s = Math.floor(34 * chMaxTW / w);
      if (s < uniTitleSize) uniTitleSize = s;
    }
  });
  SPELL_CHAPTERS.forEach((ch, i) => {
    const y = startY + i * (rowH + gap) - chapterScrollY;
    const rect = { x: 20, y, w: W - 40, h: rowH };
    // 已开放章节（含“全部章节”）可点击进入；“全部章节”合并所有已开放单元单词且已打乱顺序
    const enabled = (ch.id === 'all') || (SPELL_OPEN.indexOf(ch.id) >= 0);
    chapterCards.push({ rect, id: ch.id, enabled });
    // 仅绘制落在可视区域内的卡片
    if (y + rowH >= listTop - 4 && y <= listBottom + 4) {
      let count;
      if (ch.id === 'all') {
        // “全部章节”只统计已开放单元的单词（与 startSpellChapter 实际合并的范围一致）
        count = SPELL_OPEN.reduce((s, id) => {
          const c = BOOK.chapters.find((x) => x.id === id);
          return s + (c ? c.words.filter((w) => /^[a-z]+$/i.test(w.en)).length : 0);
        }, 0);
      } else {
        count = ch.words.filter((w) => /^[a-z]+$/i.test(w.en)).length;
      }
      drawMenuCard(rect, ch.name, count + ' 个单词', enabled, uniTitleSize);
    }
  });
}

// 模式选择页：单元点击后先选“听音拼单词 / 中文转单词”再进入练习
function drawSpellMode() {
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, W, H);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // 左上角返回按钮：回到章节选择
  spellModeBackBtn = { x: 14, y: 14, w: 52, h: 40 };
  drawBackButton(spellModeBackBtn);

  // 标题
  let titleSize = Math.min(36, W * 0.095);
  ctx.font = 'bold ' + titleSize + 'px sans-serif';
  ctx.fillStyle = '#5a2d00';
  ctx.fillText('选择练习模式', W / 2, H * 0.15);

  // 模式卡片（上下排布：听音拼单词 / 中文转单词 / 全部单词 / 单词对对碰）
  const cardW = Math.min(360, W - 80);
  const modes = [
    { mode: 'listen', title: '听音拼单词', sub: '听发音，拼出单词' },
    { mode: 'cn', title: '中文转单词', sub: '看中文意思，拼出单词' },
    { mode: 'words', title: '全部单词', sub: '浏览本单元所有单词' },
    { mode: 'match', title: '单词对对碰', sub: '点击英文与中文配对消除' },
  ];
  const n = modes.length;
  // 卡片高度自适应：保证从标题区下到屏幕底能完整放下 n 张（不溢出小屏）
  const topY = H * 0.22;
  const bottomPad = 20;
  const gap = 16;
  const cardH = Math.max(72, Math.min(96, (H - topY - bottomPad - gap * (n - 1)) / n));
  const startY = topY;

  spellModeCards = [];
  modes.forEach((m, i) => {
    const rect = { x: W / 2 - cardW / 2, y: startY + i * (cardH + gap), w: cardW, h: cardH };
    spellModeCards.push({ rect, mode: m.mode });
    drawMenuCard(rect, m.title, m.sub, true, Math.min(32, cardH * 0.34));
  });
}

// 单词表查阅页：列出该单元（或全部章节）下的所有单词，提供中英文与发音喇叭
function drawWordList() {
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, W, H);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // 返回按钮（回到模式选择页）
  wordListBackBtn = { x: 14, y: 14, w: 52, h: 40 };
  drawBackButton(wordListBackBtn);

  // 标题
  ctx.fillStyle = '#5a2d00';
  ctx.font = 'bold ' + Math.min(30, W * 0.08) + 'px sans-serif';
  ctx.fillText(wordListName + ' · 全部单词', W / 2, H * 0.09);

  // 列表区域（与 onTouchMove 滚动参数保持一致）
  const listTop = Math.round(H * 0.18);
  const listBottom = H - 20;
  const listH = listBottom - listTop;
  const rowH = 60, gap = 8;
  const contentH = wordListItems.length * (rowH + gap);
  const maxScroll = Math.max(0, contentH - listH);
  if (wordListScrollY > maxScroll) wordListScrollY = maxScroll;

  wordListSpeakers = [];
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, listTop, W, listH);
  ctx.clip();

  wordListItems.forEach((it, i) => {
    const y = listTop + i * (rowH + gap) - wordListScrollY;
    if (y + rowH < listTop || y > listBottom) return; // 不可见行跳过
    const rx = 16, rw = W - 32;
    // 行背景卡片
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    roundRectPath(ctx, rx, y, rw, rowH, 14);
    ctx.fill();
    // 英文（粗体）
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#2e7d32';
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText(it.en, rx + 16, y + 22);
    // 中文释义（小一号）
    ctx.fillStyle = '#8a5a2b';
    ctx.font = '18px sans-serif';
    ctx.fillText(it.cn, rx + 16, y + 43);
    // 右侧小喇叭：点击播放真实发音（靠左一点，避免贴右边）
    const spSize = 40;
    const spRect = { x: W - 32 - spSize, y: y + (rowH - spSize) / 2, w: spSize, h: spSize };
    drawSpeaker(spRect);
    wordListSpeakers.push({ rect: spRect, word: it.en.toLowerCase() });
  });

  ctx.restore();

  // 滚动到底提示
  if (maxScroll > 0) {
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(138,90,43,0.6)';
    ctx.font = '14px sans-serif';
    ctx.fillText('上滑查看更多', W / 2, H - 8);
  }
}

// 获取某章节单词（去重 + 过滤含空格短语），返回 [{en,cn}]
function getChapterWordsPlain(chapterId) {
  let words;
  if (chapterId === 'all') {
    words = [];
    SPELL_OPEN.forEach((id) => {
      const c = BOOK.chapters.find((x) => x.id === id);
      if (c) words.push(...c.words);
    });
  } else {
    const ch = SPELL_CHAPTERS.find((c) => c.id === chapterId);
    words = ch ? ch.words : [];
  }
  const seen = new Set();
  const res = [];
  words.forEach((w) => {
    const en = (w.en || '').trim();
    if (!en || /\s/.test(en)) return;            // 跳过含空格短语（不适合单块展示）
    const key = en.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    res.push({ en, cn: w.cn || '' });
  });
  return res;
}

// 进入“单词对对碰”：根据屏幕尺寸自动计算能铺满的网格，随机取词，生成英文/中文块
function startMatch(chapterId) {
  const ch = SPELL_CHAPTERS.find((c) => c.id === chapterId);
  matchChapterName = ch ? ch.name : '';
  const words = getChapterWordsPlain(chapterId);
  if (words.length === 0) { state = 'spellMode'; return; }

  const padX = 14;
  const padTop = Math.round(H * 0.16);           // 顶部标题区高度
  const padBottom = 18;
  const gap = 10;                                // 块最小间距
  const availW = W - padX * 2;
  const availH = H - padTop - padBottom;
  const enFam = SPELL_FONT || 'sans-serif';

  // 按内容自适应估算单块宽度：宽块配宽字，字体大小差异大幅减小
  function blockW(text, type) {
    ctx.font = (type === 'en' ? 'bold ' + MATCH_EN_FS + 'px ' : MATCH_CN_FS + 'px ') +
      (type === 'en' ? enFam : 'sans-serif');
    const w = ctx.measureText(text).width + MATCH_PAD * 2;
    return Math.max(54, Math.min(W * 0.46, w));
  }

  // 流式换行布局 + 行高铺满垂直方向
  function layout(blocks) {
    blocks.forEach((b) => { b._w = blockW(b.text, b.type); });
    const rows = [];
    let cur = [];
    let curW = 0;
    for (const b of blocks) {
      const add = cur.length === 0 ? b._w : b._w + gap;
      if (curW + add > availW && cur.length > 0) { rows.push(cur); cur = []; curW = 0; }
      cur.push(b);
      curW += (cur.length === 1 ? b._w : b._w + gap);
    }
    if (cur.length) rows.push(cur);
    const rowH = (availH - gap * (rows.length - 1)) / rows.length;
    return { rows, rowH };
  }

  // 随机选词 + 自适应单词对数（行高保持在合理范围）
  let need = Math.min(words.length, 14);
  let rows = [], rowH = 0;
  for (let attempt = 0; attempt < 6; attempt++) {
    const chosen = shuffled(words).slice(0, need);
    const blocks = [];
    chosen.forEach((w, i) => {
      blocks.push({ text: w.en, type: 'en', pairId: i });
      blocks.push({ text: w.cn, type: 'cn', pairId: i });
    });
    const sh = shuffled(blocks);
    const res = layout(sh);
    rows = res.rows; rowH = res.rowH;
    if (rowH < 44) { need = Math.max(4, Math.floor(need * 0.7)); continue; }
    if (rowH > 120 && need < words.length) { need = Math.min(words.length, need + 3); continue; }
    break;
  }
  matchCols = 0;
  matchRows = rows.length;

  // 计算坐标：每行水平铺满（间距自适应补齐），垂直按行高分布
  matchBlocks = [];
  let y = padTop;
  for (const row of rows) {
    const sumW = row.reduce((s, b) => s + b._w, 0);
    if (row.length > 1) {
      // 剩余空间平分到各间隔（已含基础 gap），使整行左右贴边
      const extra = Math.max(0, (availW - sumW - gap * (row.length - 1)) / (row.length - 1));
      let x = padX;
      for (const b of row) {
        b.x = x; b.y = y; b.w = b._w; b.h = rowH;
        b.removed = false; b.flip = -1;
        matchBlocks.push(b);
        x += b._w + gap + extra;
      }
    } else {
      const b = row[0];
      b.x = padX + (availW - sumW) / 2;   // 单行单块时居中
      b.y = y; b.w = b._w; b.h = rowH;
      b.removed = false; b.flip = -1;
      matchBlocks.push(b);
    }
    y += rowH + gap;
  }
  matchSel = null;
  matchDone = false;
  matchMsg = '';
  matchMsgTimer = 0;
  state = 'match';
}

// 单词对对碰：渲染棋盘
function drawMatch() {
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // 返回按钮（回到模式选择页）
  matchBackBtn = { x: 14, y: 14, w: 52, h: 40 };
  drawBackButton(matchBackBtn);

  // 标题
  ctx.fillStyle = '#5a2d00';
  ctx.font = 'bold ' + Math.min(30, W * 0.08) + 'px sans-serif';
  ctx.fillText('单词对对碰', W / 2, Math.round(H * 0.07));
  ctx.font = '13px sans-serif';
  ctx.fillStyle = 'rgba(138,90,43,0.75)';
  ctx.fillText('点击英文卡与中文卡配对，消除全部卡片', W / 2, Math.round(H * 0.115));

  // 块
  for (const b of matchBlocks) {
    if (b.removed) continue;
    drawMatchBlock(b);
  }

  // 完成态
  if (matchDone) {
    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,0.82)';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#2e7d32';
    ctx.font = 'bold 38px sans-serif';
    ctx.fillText('全部消除！', W / 2, H / 2 - 22);
    ctx.fillStyle = '#8a5a2b';
    ctx.font = '18px sans-serif';
    ctx.fillText('点击任意处返回', W / 2, H / 2 + 24);
    ctx.restore();
  } else if (matchMsgTimer > 0) {
    ctx.fillStyle = '#e53935';
    ctx.font = 'bold 17px sans-serif';
    ctx.fillText(matchMsg, W / 2, H - 22);
  }
}

// 颜色插值（用于翻转时原色 -> 成功绿）
function hexToRgb(h) {
  h = h.replace('#', '');
  return [parseInt(h.substr(0, 2), 16), parseInt(h.substr(2, 2), 16), parseInt(h.substr(4, 2), 16)];
}
function lerpColor(a, b, t) {
  t = Math.max(0, Math.min(1, t));
  const pa = hexToRgb(a), pb = hexToRgb(b);
  const r = Math.round(pa[0] + (pb[0] - pa[0]) * t);
  const g = Math.round(pa[1] + (pb[1] - pa[1]) * t);
  const bl = Math.round(pa[2] + (pb[2] - pa[2]) * t);
  return 'rgb(' + r + ',' + g + ',' + bl + ')';
}

// 渲染单个块（英文浅蓝、中文浅橙；选中高亮；配对成功翻转消失）
function drawMatchBlock(b) {
  const r = Math.min(18, b.w * 0.12, b.h * 0.12);
  const flipping = (b.flip !== undefined && b.flip >= 0 && !b.removed);
  let sx = 1, alpha = 1, showFront = true;
  let bg = b.type === 'en' ? '#e3f2fd' : '#fff3e0';
  if (flipping) {
    const t = b.flip / FLIP_DUR;
    if (t < 0.5) {
      sx = 1 - 2 * t;                                   // 1 -> 0（翻到侧面）
      bg = lerpColor(b.type === 'en' ? '#e3f2fd' : '#fff3e0', '#2e7d32', t * 2);
    } else {
      sx = -(2 * t - 1);                                // 0 -> -1（翻到背面）
      alpha = Math.max(0, 1 - (t - 0.5) * 2);           // 1 -> 0（淡出）
      bg = '#2e7d32';
      showFront = false;                                // 背面显示对勾，不显示原文字
    }
  }
  const isSel = (matchSel === b) && !flipping;
  ctx.save();
  ctx.globalAlpha = alpha;
  if (sx !== 1) {
    const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
    ctx.translate(cx, cy);
    ctx.scale(sx, 1);
    ctx.translate(-cx, -cy);
  }
  // 背景
  ctx.fillStyle = bg;
  roundRectPath(ctx, b.x, b.y, b.w, b.h, r);
  ctx.fill();
  // 边框
  ctx.lineWidth = isSel ? 4 : 2;
  ctx.strokeStyle = isSel
    ? '#ff7a18'
    : (b.type === 'en' ? 'rgba(21,101,192,0.55)' : 'rgba(138,90,43,0.55)');
  roundRectPath(ctx, b.x, b.y, b.w, b.h, r);
  ctx.stroke();

  if (showFront) {
    const maxW = b.w - MATCH_PAD * 2;
    if (b.type === 'en') {
      ctx.fillStyle = '#1565c0';
      let fs = Math.min(MATCH_EN_FS, b.h * 0.5);
      const fam = (SPELL_FONT || 'sans-serif');
      ctx.font = 'bold ' + fs + 'px ' + fam;
      while (ctx.measureText(b.text).width > maxW && fs > 10) {
        fs -= 1; ctx.font = 'bold ' + fs + 'px ' + fam;
      }
      ctx.fillText(b.text, b.x + b.w / 2, b.y + b.h / 2);
    } else {
      ctx.fillStyle = '#8a5a2b';
      let fs = Math.min(MATCH_CN_FS, b.h * 0.5);
      ctx.font = fs + 'px sans-serif';
      while (ctx.measureText(b.text).width > maxW && fs > 10) {
        fs -= 1; ctx.font = fs + 'px sans-serif';
      }
      ctx.fillText(b.text, b.x + b.w / 2, b.y + b.h / 2);
    }
  } else {
    // 背面：白色对勾（抵消镜像使正立）
    const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
    ctx.save();
    if (sx < 0) { ctx.translate(cx, cy); ctx.scale(-1, 1); ctx.translate(-cx, -cy); }
    const s = Math.min(b.w, b.h) * 0.3;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = Math.max(3, s * 0.22);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(cx - s * 0.5, cy);
    ctx.lineTo(cx - s * 0.1, cy + s * 0.35);
    ctx.lineTo(cx + s * 0.55, cy - s * 0.4);
    ctx.stroke();
    ctx.restore();
  }
  ctx.restore();
}

// 点击某块的处理：选中 -> 再点配对
function onMatchTap(b) {
  if (b.flip !== undefined && b.flip >= 0 && !b.removed) return;  // 正在翻转消失，忽略
  if (!matchSel) { matchSel = b; return; }
  if (matchSel === b) { matchSel = null; return; }   // 再次点同一块则取消
  const a = matchSel;
  if (a.type !== b.type && a.pairId === b.pairId) {
    a.flip = 0; b.flip = 0;            // 进入翻转消失动画（由主循环推进后移除）
    matchSel = null;
    matchMsg = ''; matchMsgTimer = 0;
  } else {
    matchSel = null;
    matchMsg = '不匹配，再试试～';
    matchMsgTimer = 1100;
  }
}

// 拼单词练习页
function drawSpell() {
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, W, H);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // 返回按钮（回到模式选择页）
  spellBackBtn = { x: 14, y: 14, w: 52, h: 40 };
  drawBackButton(spellBackBtn);

  // 顶部：仅保留进度提示（不再显示字母数量），整体下移使画面更居中
  ctx.fillStyle = '#b06a2b';
  ctx.font = (Math.min(20, W * 0.055)) + 'px sans-serif';
  ctx.fillText('第 ' + (spellIndex + 1) + ' / ' + spellList.length + ' 个', W / 2, 96);

  // 输入框：英文书写四线三格（统一字号、字母按书写规范紧凑连续书写，像字帖）
  const boxW = Math.min(360, W - 60);
  const lineGap = 22;            // 相邻横线间距（即中格高度）
  const pad = 16;
  const boxH = lineGap * 3 + pad * 2;
  const boxX = W / 2 - boxW / 2;
  const boxY = 152;

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
    ctx.fillText(spellMode === 'cn' ? '根据中文意思，拼出单词'
                                     : '点击下方字母，拼出听到的单词', W / 2, (lineY[1] + lineY[2]) / 2);
  } else {
    // 所有字母统一字号，以“书写基线”对齐四线格的基线 lineY[2]，按字体自身度量自然落位：
    // 中格字母正好落在中格、上伸字母自然上伸、下伸字母自然下伸，不会踩线。
    // 先用小写 'x' 的实际字高（x-height）校准字号，使 x-height 正好等于中格高度 lineGap。
    const family = SPELL_FONT || 'sans-serif';
    let fz = lineGap * 2;
    ctx.font = fz + 'px ' + family;
    const m0 = ctx.measureText('x');
    const xh = m0.actualBoundingBoxAscent || (fz * 0.5);
    fz = fz * (lineGap / xh);                // 校准：x-height => lineGap
    ctx.font = fz + 'px ' + family;
    ctx.textBaseline = 'alphabetic';          // 基线对齐 lineY[2]
    const stepGap = fz * 0.12;               // 字母间紧凑步距
    const adv = [];
    let totalW = 0;
    for (let i = 0; i < input.length; i++) {
      const w = ctx.measureText(input[i]).width;
      adv.push(w);
      totalW += w + (i < input.length - 1 ? stepGap : 0);
    }
    let x = W / 2 - totalW / 2;              // 左起光标（字母左边缘）
    ctx.fillStyle = '#5a2d00';
    for (let i = 0; i < input.length; i++) {
      const ch = input[i];
      ctx.fillText(ch, x + adv[i] / 2, lineY[2]);
      x += adv[i] + stepGap;
    }
    ctx.textBaseline = 'middle';              // 恢复，避免影响后续绘制
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

  // 底部区域：听音模式显示小喇叭（点击重听）；中文转单词模式显示中文释义（替代喇叭位置）
  if (spellMode === 'listen') {
    spellSpeakerBtn = { x: W / 2 - 46, y: H - 104, w: 92, h: 92 };
    drawSpeaker(spellSpeakerBtn);
  } else {
    spellSpeakerBtn = null;
    const zhW = Math.min(360, W - 80);
    const zhH = 84;
    const zhX = W / 2 - zhW / 2;
    const zhY = H - 104;
    ctx.fillStyle = 'rgba(255,255,255,0.97)';
    roundRectPath(ctx, zhX, zhY, zhW, zhH, 20);
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(255,122,24,0.5)';
    roundRectPath(ctx, zhX, zhY, zhW, zhH, 20);
    ctx.stroke();
    ctx.fillStyle = '#5a2d00';
    ctx.font = (Math.min(30, zhW * 0.075)) + 'px sans-serif';
    ctx.fillText(spellMeaning, W / 2, zhY + zhH / 2);
  }

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
  ctx.font = 'bold 32px sans-serif';
  ctx.fillText('拼对啦！', W / 2, cardY + 50);

  ctx.fillStyle = '#5a2d00';
  ctx.font = 'bold 46px sans-serif';
  ctx.fillText(spellWord, W / 2, cardY + 116);

  ctx.fillStyle = '#8a5a2b';
  ctx.font = '26px sans-serif';
  ctx.fillText(spellMeaning, W / 2, cardY + 174);

  // 底部两个并排按钮：左“听发音”（白底橙框），右“下一个”（橙底白字）
  const btnH = 64;
  const btnY = cardY + cardH - 84;
  const gap = 14;
  const totalW = cardW - 80;
  const btnW = (totalW - gap) / 2;
  const leftX = W / 2 - totalW / 2;
  const rightX = leftX + btnW + gap;

  // 左侧：听发音（两种模式都可用，弹框里再听一遍真实发音）
  spellDialogSpeakBtn = { x: leftX, y: btnY, w: btnW, h: btnH };
  ctx.fillStyle = '#ffffff';
  roundRectPath(ctx, leftX, btnY, btnW, btnH, 18);
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#ff7a18';
  roundRectPath(ctx, leftX, btnY, btnW, btnH, 18);
  ctx.stroke();
  ctx.fillStyle = '#ff7a18';
  ctx.font = 'bold 28px sans-serif';
  ctx.fillText('听发音', leftX + btnW / 2, btnY + btnH / 2);

  // 右侧：下一个
  spellNextBtn = { x: rightX, y: btnY, w: btnW, h: btnH };
  ctx.fillStyle = '#ff7a18';
  roundRectPath(ctx, rightX, btnY, btnW, btnH, 18);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 28px sans-serif';
  ctx.fillText('下一个', rightX + btnW / 2, btnY + btnH / 2);
}

function draw() {
  if (state === 'nav') drawNav();
  else if (state === 'home') drawHome();
  else if (state === 'playing') drawPlaying();
  else if (state === 'confirmExit') { drawPlaying(); drawExitConfirm(); }
  else if (state === 'gameover') drawGameOver();
  else if (state === 'grade') drawGrade();
  else if (state === 'loading') drawLoading();
  else if (state === 'loadFail') drawLoadFail();
  else if (state === 'chapter') drawChapter();
  else if (state === 'spellMode') drawSpellMode();
  else if (state === 'spell') drawSpell();
  else if (state === 'wordList') drawWordList();
  else if (state === 'match') drawMatch();
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
  if (matchMsgTimer > 0) matchMsgTimer -= dt;
  if (state === 'match') {
    let allGone = true;
    for (const b of matchBlocks) {
      if (b.flip !== undefined && b.flip >= 0 && !b.removed) {
        b.flip += dt;
        if (b.flip >= FLIP_DUR) b.removed = true;
      }
      if (!b.removed) allGone = false;
    }
    if (allGone) matchDone = true;
  }
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

  // iOS 音频解锁：首次触摸时激活 AudioSession（高版本 iOS 必须，否则异步报音被静默），
  // 并全局关闭静音开关，避免 iPhone 静音键/系统策略导致无声音。
  if (!touchUnlocked) {
    touchUnlocked = true;
    if (wx.setInnerAudioOption) {
      try { wx.setInnerAudioOption({ obeyMuteSwitch: false, mixWithOther: true }); } catch (e) {}
    }
    unlockAudio();
  }

  if (state === 'nav') {
    // 找字母：进入原首页（主页）；拼单词：进入年级选择
    if (hit(navFindBtn, px, py)) { state = 'home'; return; }
    if (hit(navSpellBtn, px, py)) { state = 'grade'; gradeScrollY = 0; return; }
  } else if (state === 'grade') {
    if (hit(backBtn, px, py)) { state = 'nav'; return; }
    // 册数较多时列表可滚动：按下先记录命中卡片，抬手且未判定为滑动才真正进入，
    // 避免上下滑动时误触卡片直接跳页。
    gradePendingCard = null;
    gradeTouchStartY = py;
    gradeTouchMoved = false;
    for (const c of gradeCards) {
      if (hit(c.rect, px, py)) { gradePendingCard = c.id; break; }
    }
  } else if (state === 'loading') {
    // 下载中不响应操作，等分包回调切页
  } else if (state === 'loadFail') {
    if (!loadFailBtns) return;
    if (hit(loadFailBtns.retry, px, py)) { startGradeLoad(pendingGradeId); return; }
    if (hit(loadFailBtns.fallback, px, py)) {
      setCurrentGrade(pendingGradeId);
      chapterScrollY = 0;
      state = 'chapter';
      return;
    }
  } else if (state === 'chapter') {
    if (hit(backBtn, px, py)) { state = 'grade'; return; }
    for (const item of chapterCards) {
      if (hit(item.rect, px, py)) {
        if (item.enabled) { spellChapterId = item.id; state = 'spellMode'; } // 进入模式选择页
        return;
      }
    }
  } else if (state === 'spellMode') {
    if (hit(spellModeBackBtn, px, py)) { state = 'chapter'; chapterScrollY = 0; return; }
    for (const item of spellModeCards) {
      if (hit(item.rect, px, py)) {
        if (item.mode === 'words') enterWordList(spellChapterId);
        else if (item.mode === 'match') startMatch(spellChapterId);
        else startSpellChapter(spellChapterId, item.mode);
        return;
      }
    }
  } else if (state === 'match') {
    if (hit(matchBackBtn, px, py)) { state = 'spellMode'; return; }
    if (matchDone) { state = 'spellMode'; return; }   // 完成态点任意处返回
    for (const b of matchBlocks) {
      if (b.removed) continue;
      if (hit(b, px, py)) { onMatchTap(b); return; }
    }
  } else if (state === 'wordList') {
    if (hit(wordListBackBtn, px, py)) { state = 'spellMode'; return; }
    for (const sp of wordListSpeakers) {
      if (hit(sp.rect, px, py)) { speakWord(sp.word); return; }
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
    if (hit(spellBackBtn, px, py)) { state = 'spellMode'; return; } // 返回模式选择页
    if (spellSolved) {
      if (hit(spellDialogSpeakBtn, px, py)) { speakWord(spellWord); return; } // 答对弹框：再听一遍发音
      if (hit(spellNextBtn, px, py)) nextSpellWord(); // 答对弹框：下一个
      return;
    }
    if (spellSpeakerBtn && hit(spellSpeakerBtn, px, py)) { speakWord(spellWord); return; } // 重听单词（仅听音模式）
    for (const tile of spellTileRects) {
      if (hit(tile, px, py)) { toggleCandidate(tile.idx); return; }
    }
  }
});

// 列表上下拖动滚动（grade / chapter / wordList 三个状态生效）
wx.onTouchMove((e) => {
  if (state !== 'grade' && state !== 'chapter' && state !== 'wordList') { lastTouchY = null; return; }
  const p = getPoint(e);
  if (!p) return;
  if (lastTouchY !== null) {
    const dy = p.y - lastTouchY;
    if (state === 'grade') {
      if (Math.abs(p.y - gradeTouchStartY) > 8) gradeTouchMoved = true;
      gradeScrollY -= dy;
      const topY = Math.round(H * 0.22);
      const gap = 12, bottomPad = 20;
      const listH = (H - bottomPad) - topY;
      const cardH = Math.max(62, Math.min(88, (listH - gap * (GRADES.length - 1)) / GRADES.length));
      const contentH = GRADES.length * cardH + gap * (GRADES.length - 1);
      const maxScroll = Math.max(0, contentH - listH);
      if (gradeScrollY < 0) gradeScrollY = 0;
      if (gradeScrollY > maxScroll) gradeScrollY = maxScroll;
    } else if (state === 'chapter') {
      chapterScrollY -= dy;
      const startY = Math.round(H * 0.22);
      const rowH = 72, gap = 16;
      const listH = (H - 24) - startY;
      const contentH = SPELL_CHAPTERS.length * (rowH + gap);
      const maxScroll = Math.max(0, contentH - listH);
      if (chapterScrollY < 0) chapterScrollY = 0;
      if (chapterScrollY > maxScroll) chapterScrollY = maxScroll;
    } else { // wordList
      wordListScrollY -= dy;
      const listTop = Math.round(H * 0.18);
      const listBottom = H - 20;
      const listH = listBottom - listTop;
      const rowH = 60, gap = 8;
      const contentH = wordListItems.length * (rowH + gap);
      const maxScroll = Math.max(0, contentH - listH);
      if (wordListScrollY < 0) wordListScrollY = 0;
      if (wordListScrollY > maxScroll) wordListScrollY = maxScroll;
    }
  }
  lastTouchY = p.y;
});

wx.onTouchEnd(() => {
  if (state === 'grade' && !gradeTouchMoved && gradePendingCard) {
    const id = gradePendingCard;
    gradePendingCard = null;
    enterGrade(id);
  }
  gradePendingCard = null;
  lastTouchY = null;
});

// 启动渲染循环
raf(loop);
