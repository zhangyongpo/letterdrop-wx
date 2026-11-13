// Copyright (c) 2026 zhangyongpo. SPDX-License-Identifier: Apache-2.0
// 本文件为 letterdrop-wx 项目独立开发源码；许可证见 LICENSE，第三方资产声明见 NOTICE.md。
// game.js —— 微信小游戏版（原生 Canvas 2D，无 DOM / 无 WXML）
// 玩法：App 报出目标字母读音，屏幕上 6 个字母（3列×2排）掉落，
// 玩家在落地前点中正确字母消除；不区分大小写；点错（干扰项）扣分（不低于0）；
// 目标字母落地漏点扣 1 命；每 10 组速度 +1 档（无上限）；3 命结束。
// 所有平台 API 统一经 platform/adapter.js 收口，本文件不直接引用 wx。

const {
  LETTERS, GROUP_SIZE, COLS, MAX_TARGET_COUNT, GROUPS_PER_LEVEL,
  MAX_LIVES, CORRECT_SCORE, WRONG_PENALTY, speedForLevel, FIND_LETTER_ENABLED,
  LINK_WORD_MIN, LINK_WORD_MAX, LINK_FILL_RATIO,
  LINK_GRID_COLS, LINK_GRID_ROWS, LINK_MAX_WORD_LEN, LINK_DEFAULT_LOWERCASE,
  DICT_INTERVALS, DICT_DEFAULT_INTERVAL_IDX, DICT_DEFAULT_MODE, DICT_GAP_MS
} = require('./config/gameConfig');
const {
  announceLetter, announceWord, speakWord, unlockAudio,
  speakSequence, stopSpeakSequence,
  setGrade, isGradeReady, loadGradeAudio
} = require('./utils/audio');
const adapter = require('./platform/adapter');
const { buildPath: linkBuildPath } = require('./utils/link');
const { buildDictParts, wrapIndex } = require('./utils/dictation');

// 英文印刷体（Andika，SIL 出品，OFL 开源可商用），专为初学者识字设计，字母形态清晰规范，
// 小写 a/g 为课本标准双体结构，最贴近小学英语书写印刷体。用于拼单词页。
// 平台的 loadFont 在游戏启动时加载一次，Canvas 用返回的字族名即可，加载完成前自动回退 sans-serif。
const SPELL_FONT = (typeof adapter.loadFont === 'function')
  ? adapter.loadFont('assets/fonts/andika.ttf')
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
const canvas = adapter.createCanvas();
const ctx = canvas.getContext('2d');
const sys = (adapter.getWindowInfo ? adapter.getWindowInfo() : adapter.getSystemInfoSync()) || adapter.getSystemInfoSync();
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
//         | 'spell' | 'wordList' | 'match' | 'link' | 'dictation'
//   nav         —— 模式选择导航页（找字母 / 拼单词 两个模式均可进入）
//   home        —— 找字母模式主页（由 FIND_LETTER_ENABLED 控制是否开放）
//   playing     —— 找字母游戏中
//   confirmExit —— 找字母游戏中点击“退出”后的二次确认弹框（游戏暂停）
//   grade       —— 拼单词：一级菜单（三~六年级共 6 册，卡片可上下滑动）
//   loading     —— 年级发音分包下载中（进度条）
//   loadFail    —— 分包下载失败（可重试 / 仍要进入，发音回退逐字母拼读）
//   chapter     —— 拼单词：二级菜单（具体章节 + 全部章节）
//   spellMode   —— 练习模式选择（听音拼 / 中文转 / 查阅 / 对对碰 / 字母连连 / 单词听写）
//   spell       —— 拼单词：拼写练习（含答对后的弹框）
//   link        —— 字母连连：字母网格拖动连线找单词（含答对弹框与完成态）
//   dictation   —— 单词听写：按间隔自动翻词并循环，四种发音模式，可手动上/下一个
let state = 'nav';
let best = adapter.getStorageSync('letterdrop_best') || 0;
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
let navSpellBtn = null;          // 导航页“拼单词”菜单区域
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
// 干扰强度（进入听音拼单词 / 中文转单词前手动选择）：0=无干扰，1=一倍字母干扰，2=两倍字母干扰
let spellDistractLevel = 1;      // 默认一倍字母干扰
let spellDistractSelMode = 'listen'; // 正在配置的模式（'listen' / 'cn'）
let spellDistractSelOpts = [];   // 干扰强度选择页三个选项区域（{rect, level}）
let spellDistractSelBack = null; // 干扰强度选择页返回按钮（左上角）
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
let matchBlocks = [];            // 棋盘块：{x,y,w,h,text,type:'en'|'cn',pairId,word,removed}，word 为该卡对应英文词条
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

// ---- 字母连连（link）相关状态 ----
// 弹框复用 drawSpellDialog(opts)，按钮区域沿用 spellDialogSpeakBtn / spellNextBtn；
// 同一时刻只会有一种弹框，不会与拼写练习冲突。
let linkCols = LINK_GRID_COLS;     // 网格列数（每行几个字母）
let linkRows = LINK_GRID_ROWS;     // 网格行数（比早期版本多 2 行）
let linkGrid = [];                 // 网格字母（大写字符串数组）
let linkCellRects = [];            // 每格可点区域 {x,y,w,h}
let linkTargets = [];              // 目标词 [{en, cn, found, cells}]
let linkPath = [];                 // 本次拖动经过的格子下标
let linkDragging = false;          // 是否正在拖动连线
let linkLastPoint = null;          // 上一个触点（拖动插值用，避免快速划过漏格）
let linkSolved = false;            // 连对弹框是否显示
let linkDone = false;              // 是否全部找齐
let linkFoundWord = '';            // 刚连对的单词（弹框显示）
let linkFoundCn = '';              // 刚连对的中文释义（弹框显示）
let linkMsg = '';                  // 连错时的短暂提示
let linkMsgTimer = 0;              // 提示剩余显示时间(ms)
let linkBackBtn = null;            // 返回按钮（左上角）
let linkCaseBtn = null;            // 大小写版本切换按钮（返回键右侧，避开微信右上角胶囊按钮）
// 当前字母版本：false = 大写版(A~Z)，true = 小写英文版(a~z)。
// 仅控制网格字母的显示形态；linkGrid 内部始终存大写，判定统一转小写比较，互不影响。
// 不随 startLink() 重置，玩家切换一次后在本次游戏会话内保持。
let linkLowercase = LINK_DEFAULT_LOWERCASE;
let linkChapterName = '';          // 章节名（标题展示）
let linkListTop = 0;               // 底部释义列表可视区上沿
let linkListBottom = 0;            // 底部释义列表可视区下沿
let linkListContentH = 0;          // 释义列表内容总高（含折行）
let linkListScrollY = 0;           // 释义列表滚动偏移
let linkListDragging = false;      // 是否正在拖动释义列表（与网格连线互斥）
let linkListLastY = null;          // 拖动释义列表时的上一个触点 Y

// ---- 单词听写（dictation）相关状态 ----
// 按玩家选定的间隔自动翻词并循环；中文→英 / 只英文 / 英→中文 / 只中文四种模式只控制「发音内容与顺序」，
// 屏幕始终给出中文释义作为听写题目，英文默认遮住、点卡片可揭晓。
let dictWords = [];                // 当前章节词条 [{en, cn}]（含短语）
let dictIndex = 0;                 // 当前词条下标
let dictMode = DICT_DEFAULT_MODE;  // 'cn' 中文→英文 | 'en' 只英文 | 'both' 英文→中文 | 'cnOnly' 只中文
let dictIntervalIdx = DICT_DEFAULT_INTERVAL_IDX;  // DICT_INTERVALS 的下标
let dictTimerMs = 0;               // 距下一次自动翻词的剩余时间(ms)
let dictPlaying = true;            // 是否自动翻词（可暂停，手动切换仍可用）
let dictShowEn = false;            // 是否揭晓英文
let dictBackBtn = null;
let dictPrevBtn = null;
let dictNextBtn = null;
let dictPlayBtn = null;
let dictCardRect = null;
let dictModeBtns = [];             // [{rect, mode}]
let dictIntervalBtns = [];         // [{rect, idx}]
let dictChapterName = '';

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
  adapter.setStorageSync('letterdrop_best', best);
  state = 'gameover';
}

// ============ 拼单词模式 ============

// 生成候选字母：数量为单词长度的 2~3 倍（至少 6 个），全部小写。
// 必含该单词所需的全部字母（含重复），其余为随机干扰项。
// level: 0=无干扰（仅单词本身字母），1=一倍字母干扰（额外混入 1×词长 的字母），2=两倍字母干扰
function buildCandidates(word, level) {
  const need = word.split('');              // 已含单词内的重复字母
  const n = need.length;
  const extra = n * level;                   // 干扰字母数量 = level × 词长
  const pool = need.slice();
  const alpha = 'abcdefghijklmnopqrstuvwxyz';
  let guard = 0;
  while (pool.length < n + extra && guard < 300) {
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
  spellCandidates = buildCandidates(spellWord, spellDistractLevel);
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
          adapter.setStorageSync('letterdrop_best', best);
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

// 绘制导航页（模式选择）：找字母（由 FIND_LETTER_ENABLED 决定，关闭时置灰显示「即将到来」）/ 拼单词（可点）
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
  drawMenuCard(navFindBtn, '找字母',
    FIND_LETTER_ENABLED ? '听音找字母' : '暂未开放', FIND_LETTER_ENABLED);

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
  // 置灰卡片底色是浅灰 #cfcfcf，文字改用深灰，避免白字压浅底看不清
  ctx.fillStyle = enabled ? '#ffffff' : '#5f5f5f';
  ctx.font = 'bold ' + titleSize + 'px sans-serif';
  // 标题过长时仅在统一字号仍放不下时才缩小（避免各卡片字号不一致）
  let tw = ctx.measureText(title).width;
  const maxTW = rect.w - 92;
  if (tw > maxTW) ctx.font = 'bold ' + Math.floor(titleSize * maxTW / tw) + 'px sans-serif';
  ctx.fillText(title, rect.x + 32, rect.y + rect.h / 2 - 16);

  let subSize = Math.min(20, rect.w * 0.05);
  ctx.font = subSize + 'px sans-serif';
  ctx.fillStyle = enabled ? 'rgba(255,255,255,0.92)' : 'rgba(80,80,80,0.85)';
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

  // 模式卡片（上下排布：听音拼单词 / 中文转单词 / 全部单词 / 对对碰 / 字母连连）
  const cardW = Math.min(360, W - 80);
  const modes = [
    { mode: 'listen', title: '听音拼单词', sub: '听发音，拼出单词' },
    { mode: 'cn', title: '中文转单词', sub: '看中文意思，拼出单词' },
    { mode: 'words', title: '全部单词', sub: '浏览本单元所有单词' },
    { mode: 'match', title: '单词对对碰', sub: '点英文卡听发音，英中配对消除' },
    { mode: 'link', title: '字母连连', sub: '拖动字母连成单词' },
    { mode: 'dict', title: '单词听写', sub: '按节奏听发音，写单词' },
  ];
  const n = modes.length;
  // 卡片高度自适应：卡数越多越收紧间距与最小高度，保证小屏也能完整放下（不溢出）
  const topY = H * 0.205;
  const bottomPad = 20;
  const gap = n >= 6 ? 8 : (n >= 5 ? 10 : 16);
  const cardH = Math.max(56, Math.min(96, (H - topY - bottomPad - gap * (n - 1)) / n));
  const startY = topY;

  spellModeCards = [];
  modes.forEach((m, i) => {
    const rect = { x: W / 2 - cardW / 2, y: startY + i * (cardH + gap), w: cardW, h: cardH };
    spellModeCards.push({ rect, mode: m.mode });
    drawMenuCard(rect, m.title, m.sub, true, Math.min(32, cardH * 0.34));
  });
}

// 干扰强度选择页：从听音拼单词 / 中文转单词进入时先弹此页，手动选「无干扰 / 一倍字母干扰 / 两倍字母干扰」
function enterSpellDistractSel(mode) {
  spellDistractSelMode = (mode === 'cn') ? 'cn' : 'listen';
  state = 'spellDistractSel';
}

function drawSpellDistractSel() {
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, W, H);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // 左上角返回按钮：回到模式选择页
  spellDistractSelBack = { x: 14, y: 14, w: 52, h: 40 };
  drawBackButton(spellDistractSelBack);

  // 标题：当前模式 + 选择干扰强度
  ctx.fillStyle = '#5a2d00';
  ctx.font = 'bold ' + Math.min(30, W * 0.08) + 'px sans-serif';
  ctx.fillText(spellDistractSelMode === 'cn' ? '中文转单词' : '听音拼单词', W / 2, H * 0.13);
  ctx.fillStyle = '#b06a2b';
  ctx.font = Math.min(20, W * 0.055) + 'px sans-serif';
  ctx.fillText('选择干扰强度', W / 2, H * 0.19);

  // 三个选项卡片（上下排布、居中）：无干扰 / 一倍字母干扰 / 两倍字母干扰
  const opts = [
    { level: 0, title: '无干扰', sub: '只用单词本身字母' },
    { level: 1, title: '一倍字母干扰', sub: '额外混入 1×词长 的字母' },
    { level: 2, title: '两倍字母干扰', sub: '额外混入 2×词长 的字母' },
  ];
  const cardW = Math.min(360, W - 80);
  const n = opts.length;
  const gap = 16;
  const cardH = 76;
  const totalH = n * cardH + (n - 1) * gap;
  const startY = Math.max(H * 0.28, (H - totalH) / 2);

  spellDistractSelOpts = [];
  opts.forEach((o, i) => {
    const rect = { x: W / 2 - cardW / 2, y: startY + i * (cardH + gap), w: cardW, h: cardH };
    spellDistractSelOpts.push({ rect, level: o.level });
    const active = (spellDistractLevel === o.level);
    ctx.fillStyle = active ? 'rgba(255,224,196,0.98)' : 'rgba(255,255,255,0.97)';
    roundRectPath(ctx, rect.x, rect.y, rect.w, rect.h, 18);
    ctx.fill();
    ctx.lineWidth = active ? 3 : 2;
    ctx.strokeStyle = active ? 'rgba(255,122,24,0.9)' : 'rgba(255,122,24,0.4)';
    roundRectPath(ctx, rect.x, rect.y, rect.w, rect.h, 18);
    ctx.stroke();
    ctx.textAlign = 'left';
    ctx.fillStyle = '#5a2d00';
    ctx.font = 'bold ' + Math.min(26, cardH * 0.34) + 'px sans-serif';
    ctx.fillText(o.title, rect.x + 24, rect.y + cardH * 0.38);
    ctx.fillStyle = '#9a6a3a';
    ctx.font = Math.min(17, cardH * 0.22) + 'px sans-serif';
    ctx.fillText(o.sub, rect.x + 24, rect.y + cardH * 0.72);
    if (active) {
      ctx.fillStyle = 'rgba(255,122,24,0.95)';
      ctx.beginPath();
      ctx.arc(rect.x + rect.w - 30, rect.y + cardH / 2, 9, 0, Math.PI * 2);
      ctx.fill();
    }
  });
  ctx.textAlign = 'center';
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

  // 若用户曾在分包下载失败时选了「仍要进入」，这里静默补下载：
  // 下载完成后后续点击即可听到真实单词发音（此前会回退逐字母拼读）。
  if (!isGradeReady(currentGradeId)) loadGradeAudio(currentGradeId);

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
      // word 统一保存该卡对应的英文词条；当前只有英文卡用它点读发音，中文卡仅作数据记录
      blocks.push({ text: w.en, type: 'en', pairId: i, word: w.en });
      blocks.push({ text: w.cn, type: 'cn', pairId: i, word: w.en });
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
  ctx.fillText('点英文卡听发音 · 与中文卡配对消除', W / 2, Math.round(H * 0.115));

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

// 点击某块：只有英文卡播放该词读音（中文卡保持安静，避免一按中文就提前念出英文、
// 削弱配对练习），再执行选中 / 配对判定。点中正在翻转消失的块不响应。
function onMatchTap(b) {
  if (b.flip !== undefined && b.flip >= 0 && !b.removed) return;  // 正在翻转消失，忽略
  if (b.type === 'en') speakWord(b.word || b.text);
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
  const areaBottom = H - 130;              // 给底部小喇叭/中文卡留位
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

// ============ 字母连连（link）============
// 玩法：从章节词库抽词，把每个词的字母按「横 / 竖 / 一次转弯的 L 形」路径摆进 N×N 网格，
// 剩余格子填干扰字母；玩家按住拖动经过上下左右相邻的格子，松手时把路径字母拼成字符串，
// 命中未找到的目标词即判定连对（正向、反向都算，允许从词尾往回连）。
// 字母版本：返回键右侧按钮可在「大写版 A~Z」与「小写英文版 a~z」间切换，
// 只改网格字母（含干扰字母）的显示形态与连对弹框里的单词；
// 内部 linkGrid 恒为大写、判定恒转小写比较，底部中文提示始终显示中文。

// 路径生成算法抽到 utils/link.js（纯函数，不依赖平台 API，可单独校验）

// 进入「字母连连」：抽词 → 放置路径 → 填干扰字母 → 计算网格坐标
function startLink(chapterId) {
  const ch = SPELL_CHAPTERS.find((c) => c.id === chapterId);
  linkChapterName = ch ? ch.name : '';
  const words = getChapterWordsPlain(chapterId).filter((w) =>
    /^[a-z]+$/i.test(w.en) && w.en.length >= 2 && w.en.length <= LINK_MAX_WORD_LEN
  );
  if (words.length === 0) { state = 'spellMode'; return; }

  // 与对对碰一致：若此前分包下载失败选了「仍要进入」，这里静默补下载
  if (!isGradeReady(currentGradeId)) loadGradeAudio(currentGradeId);

  const cols = LINK_GRID_COLS;
  const rows = LINK_GRID_ROWS;
  linkCols = cols;
  linkRows = rows;
  linkGrid = new Array(cols * rows).fill('');
  const occupied = new Set();
  linkTargets = [];

  // 目标词数量按单词长度动态决定：短词多放、长词少放。
  // 收手条件 = 已占用格数达到网格容量的 LINK_FILL_RATIO（其余留作干扰字母），
  // 同时保证不少于 LINK_WORD_MIN 个、不多于 LINK_WORD_MAX 个；
  // 后期网格拥挤时个别词放不下会自动跳过，用后面的候选补上。
  const cellBudget = Math.round(cols * rows * LINK_FILL_RATIO);
  const candidates = shuffled(words);
  // 候选上限跟随章节实际词数（大章节不因固定次数被截断），但设 120 封顶防极端耗时
  const maxTries = Math.min(candidates.length, 120);
  let tries = 0;
  for (const w of candidates) {
    if (linkTargets.length >= LINK_WORD_MAX) break;
    if (linkTargets.length >= LINK_WORD_MIN && occupied.size >= cellBudget) break;
    if (++tries > maxTries) break;
    const upper = w.en.toUpperCase();
    const path = linkBuildPath(cols, rows, upper.length, occupied);
    if (!path) continue;                         // 放不下就跳过该词
    for (let k = 0; k < upper.length; k++) linkGrid[path[k]] = upper[k];
    path.forEach((i) => occupied.add(i));
    linkTargets.push({ en: w.en.toLowerCase(), cn: w.cn || '', found: false, cells: [] });
  }
  if (linkTargets.length === 0) { state = 'spellMode'; return; }

  // 干扰字母：七成取自目标词字母池（更像真词），三成取随机字母
  const pool = linkTargets.map((t) => t.en.toUpperCase()).join('').split('');
  for (let i = 0; i < linkGrid.length; i++) {
    if (linkGrid[i]) continue;
    linkGrid[i] = (pool.length && Math.random() < 0.7)
      ? pool[Math.floor(Math.random() * pool.length)]
      : LETTERS[Math.floor(Math.random() * LETTERS.length)];
  }

  // 网格布局：rows 行 × cols 列（行数比列数多），底部为释义列表预留固定空间；
  // 格子同时受可用宽、高约束，行再加多也不会把中文挤出屏幕（超出部分可滑动）。
  const padX = 16;
  const gap = 6;
  const gridTop = Math.round(H * 0.22);
  const bottomReserve = Math.min(120, H * 0.20);
  const availW = W - padX * 2;
  const availH = Math.max(120, H - gridTop - bottomReserve - 12);
  const cell = Math.max(24, Math.min(
    (availW - gap * (cols - 1)) / cols,
    (availH - gap * (rows - 1)) / rows
  ));
  const gridW = cols * cell + gap * (cols - 1);
  const gridX = W / 2 - gridW / 2;
  linkCellRects = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      linkCellRects.push({
        x: gridX + c * (cell + gap),
        y: gridTop + r * (cell + gap),
        w: cell, h: cell
      });
    }
  }

  linkPath = [];
  linkDragging = false;
  linkLastPoint = null;
  linkListScrollY = 0;
  linkListDragging = false;
  linkListLastY = null;
  linkSolved = false;
  linkDone = false;
  linkMsg = '';
  linkMsgTimer = 0;
  state = 'link';
}

function linkCellIndexAt(px, py) {
  // 向外放宽 3px：手指划过格子间隙时不中断连线（间隙本身只有 6px）
  const PAD = 3;
  for (let i = 0; i < linkCellRects.length; i++) {
    const r = linkCellRects[i];
    if (px >= r.x - PAD && px <= r.x + r.w + PAD &&
        py >= r.y - PAD && py <= r.y + r.h + PAD) return i;
  }
  return -1;
}

// 只允许上下左右相邻，不允许斜连
function linkAdjacent(a, b) {
  const ra = Math.floor(a / linkCols), ca = a % linkCols;
  const rb = Math.floor(b / linkCols), cb = b % linkCols;
  return Math.abs(ra - rb) + Math.abs(ca - cb) === 1;
}

function linkExtendPath(idx) {
  if (linkPath.length === 0) { linkPath.push(idx); return; }
  const last = linkPath[linkPath.length - 1];
  if (idx === last) return;
  if (linkPath.length >= 2 && idx === linkPath[linkPath.length - 2]) {
    linkPath.pop();                            // 往回划 = 撤销上一格
    return;
  }
  if (linkPath.indexOf(idx) >= 0) return;     // 路径不自交
  if (linkAdjacent(last, idx)) linkPath.push(idx);
}

// 松手结算：路径字母拼成单词，命中未找到的目标词则连对
function resolveLinkPath() {
  const cells = linkPath.slice();
  linkPath = [];
  if (cells.length < 2) return;
  const s = cells.map((i) => linkGrid[i]).join('').toLowerCase();
  const rev = s.split('').reverse().join('');
  const t = linkTargets.find((x) => !x.found && (x.en === s || x.en === rev));
  if (!t) {
    linkMsg = '再试试';
    linkMsgTimer = 900;
    return;
  }
  t.found = true;
  t.cells = cells;
  // 连对后列表会重排（未找到的顶到前面），顺手回到顶部，省掉一次手动滑回
  linkListScrollY = 0;
  linkFoundWord = t.en;
  linkFoundCn = t.cn;
  linkSolved = true;
  linkDone = linkTargets.every((x) => x.found);
  speakWord(t.en);                             // 连对即播一遍真实发音
}

function drawLink() {
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  linkBackBtn = { x: 14, y: 14, w: 52, h: 40 };
  drawBackButton(linkBackBtn);

  // 返回键右侧：字母版本切换（原置右上角会与微信系统胶囊按钮重合，故移到左上与返回键相邻）。只改网格字母显示（大写 A~Z / 小写 a~z），
  // 底部中文提示与连线判定都不受影响；切换后不重置本局进度，可随时来回切。
  linkCaseBtn = { x: 14 + 52 + 8, y: 14, w: 84, h: 40 };  // 返回键（x:14,w:52）右侧 8px，避开微信右上角胶囊
  const cb = linkCaseBtn;
  ctx.fillStyle = linkLowercase ? 'rgba(255,204,128,0.95)' : 'rgba(255,255,255,0.9)';
  roundRectPath(ctx, cb.x, cb.y, cb.w, cb.h, 10);
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = 'rgba(90,45,0,0.22)';
  roundRectPath(ctx, cb.x, cb.y, cb.w, cb.h, 10);
  ctx.stroke();
  ctx.fillStyle = '#5a2d00';
  ctx.font = 'bold 17px ' + (SPELL_FONT || 'sans-serif');
  ctx.fillText(linkLowercase ? 'aa' : 'Aa', cb.x + cb.w * 0.26, cb.y + cb.h / 2);
  ctx.font = '13px sans-serif';
  ctx.fillText(linkLowercase ? '小写版' : '大写版', cb.x + cb.w * 0.68, cb.y + cb.h / 2);

  ctx.fillStyle = '#5a2d00';
  ctx.font = 'bold ' + Math.min(30, W * 0.08) + 'px sans-serif';
  ctx.fillText('字母连连', W / 2 + 30, Math.round(H * 0.09));
  ctx.fillStyle = '#8a5a2b';
  ctx.font = Math.min(17, W * 0.042) + 'px sans-serif';
  ctx.fillText('拖动连成单词 · 横 / 竖 / 转弯 · 释义可滑动', W / 2 + 30, Math.round(H * 0.145));
  // 连错提示与章节名共用该行，避免文字叠在一起
  if (linkMsgTimer > 0 && linkMsg) {
    ctx.fillStyle = '#d84315';
    ctx.font = 'bold ' + Math.min(19, W * 0.048) + 'px sans-serif';
    ctx.fillText(linkMsg, W / 2 + 30, Math.round(H * 0.185));
  } else if (linkChapterName) {
    ctx.font = Math.min(15, W * 0.038) + 'px sans-serif';
    ctx.fillText(linkChapterName, W / 2 + 30, Math.round(H * 0.185));
  }

  const cellW = linkCellRects.length ? linkCellRects[0].w : 40;
  const radius = Math.min(12, cellW * 0.22);

  // 画一条路径连线（已找到的用浅绿，正在拖的用橙色）
  function drawPathLine(cells, color) {
    if (!cells || cells.length < 2) return;
    ctx.beginPath();
    cells.forEach((idx, k) => {
      const r = linkCellRects[idx];
      if (!r) return;
      const cx = r.x + r.w / 2, cy = r.y + r.h / 2;
      if (k === 0) ctx.moveTo(cx, cy); else ctx.lineTo(cx, cy);
    });
    ctx.lineWidth = Math.max(8, cellW * 0.24);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = color;
    ctx.stroke();
  }

  const foundSet = new Set();
  linkTargets.forEach((t) => { if (t.found) t.cells.forEach((i) => foundSet.add(i)); });
  const pathSet = new Set(linkPath);

  // 1) 格子底色与边框
  linkCellRects.forEach((r, i) => {
    let fill = '#ffffff';
    if (foundSet.has(i)) fill = '#c8e6c9';
    if (pathSet.has(i)) fill = '#ffcc80';
    ctx.fillStyle = fill;
    roundRectPath(ctx, r.x, r.y, r.w, r.h, radius);
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = foundSet.has(i) ? '#66bb6a'
      : (pathSet.has(i) ? '#ff7a18' : 'rgba(120,80,40,0.18)');
    roundRectPath(ctx, r.x, r.y, r.w, r.h, radius);
    ctx.stroke();
  });

  // 2) 连线（在格子之上、字母之下）
  linkTargets.forEach((t) => { if (t.found) drawPathLine(t.cells, 'rgba(56,142,60,0.45)'); });
  drawPathLine(linkPath, 'rgba(255,122,24,0.55)');

  // 3) 字母：linkGrid 内部一律存大写，这里只按当前版本决定显示形态
  ctx.font = 'bold ' + Math.min(30, cellW * 0.56) + 'px ' + (SPELL_FONT || 'sans-serif');
  ctx.fillStyle = '#5a2d00';
  linkCellRects.forEach((r, i) => {
    const ch = linkLowercase ? linkGrid[i].toLowerCase() : linkGrid[i];
    ctx.fillText(ch, r.x + r.w / 2, r.y + r.h / 2);
  });

  // 4) 底部目标词提示：仍为 2 列、每行几个与文案截断逻辑不变，但按「未找到在前、
  //    已找到沉底」动态排序，让用户视线固定在最上面几行，尽量少滑动。
  //    词数按词长动态变化，行高/字号跟着自适应，尽量让全部中文一屏放下；
  //    仅这一块区域可上下拖动（网格区拖动作连线），真放不下时才「滑出来」。
  const lastCell = linkCellRects[linkCellRects.length - 1];
  linkListTop = (lastCell ? lastCell.y + cellW + 12 : Math.round(H * 0.70));
  linkListBottom = H - 12;
  const listCols = 2;
  const listColW = (W - 32) / listCols;
  const listH = Math.max(0, linkListBottom - linkListTop);
  const listRows = Math.max(1, Math.ceil(linkTargets.length / listCols));
  const listRowH = Math.max(24, Math.min(34, listH / listRows));
  const listFont = Math.max(13, Math.min(19, W * 0.048, listRowH * 0.62));
  linkListContentH = listRows * listRowH;

  const linkMaxScroll = Math.max(0, linkListContentH - listH);
  if (linkListScrollY < 0) linkListScrollY = 0;
  if (linkListScrollY > linkMaxScroll) linkListScrollY = linkMaxScroll;

  // 需要滚动时给释义区一块浅底，提示「这一块可以上下滑」
  if (linkMaxScroll > 0 && listH > 0) {
    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    roundRectPath(ctx, 8, linkListTop, W - 16, listH, 10);
    ctx.fill();
  }

  ctx.save();
  ctx.beginPath();
  ctx.rect(0, linkListTop, W, listH);
  ctx.clip();
  ctx.font = listFont + 'px sans-serif';
  // 动态排序：未找到的顶到前面，连对过的自动沉到末尾。
  // 只改显示顺序，不动 linkTargets 原数组（结算与已找到连线仍按原数组）。
  const shownTargets = linkTargets
    .filter((t) => !t.found)
    .concat(linkTargets.filter((t) => t.found));
  shownTargets.forEach((t, i) => {
    const cx = 16 + (i % listCols) * listColW + listColW / 2;
    const cy = linkListTop + Math.floor(i / listCols) * listRowH + listRowH / 2 - linkListScrollY;
    ctx.fillStyle = t.found ? '#2e7d32' : '#8a5a2b';
    // 释义过长会在两列布局里溢出，统一截断到 7 字；连对后仍显示中文并打勾，
    // 不替换成英文单词——大小写版本切换只作用于网格字母。
    const hint = String(t.cn || t.en).slice(0, 7);
    ctx.fillText(t.found ? '✓ ' + hint : hint + '（' + t.en.length + '）', cx, cy);
  });
  ctx.restore();

  // 内容超出可视区时画细滚动条，提示「还能往下滑」
  if (linkMaxScroll > 0 && listH > 0) {
    const barH = Math.max(24, listH * listH / linkListContentH);
    const barY = linkListTop + (listH - barH) * (linkListScrollY / linkMaxScroll);
    ctx.fillStyle = 'rgba(120,80,40,0.28)';
    roundRectPath(ctx, W - 7, barY, 3, barH, 2);
    ctx.fill();
  }

  // 全部找齐后的完成态（弹框关闭后显示）
  if (linkDone && !linkSolved) {
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(0, 0, W, H);
    const cw = Math.min(320, W - 50), chh = 180;
    const cx = W / 2 - cw / 2, cy = H / 2 - chh / 2;
    ctx.fillStyle = '#ffffff';
    roundRectPath(ctx, cx, cy, cw, chh, 24);
    ctx.fill();
    ctx.fillStyle = '#2e7d32';
    ctx.font = 'bold 32px sans-serif';
    ctx.fillText('全部找齐！', W / 2, cy + 66);
    ctx.fillStyle = '#8a5a2b';
    ctx.font = '22px sans-serif';
    ctx.fillText('点击任意处返回', W / 2, cy + 124);
  }

  // 连对弹框：复用拼写练习的弹框，仅标题 / 内容 / 按钮文案不同。
  // 弹框里的单词跟随当前字母版本显示（大写版 CAT / 小写版 cat），
  // 发音仍按词库原始小写 en 查找音频文件。
  if (linkSolved) {
    drawSpellDialog({
      title: '连对啦！',
      word: linkLowercase ? linkFoundWord.toLowerCase() : linkFoundWord.toUpperCase(),
      meaning: linkFoundCn,
      nextLabel: '继续'
    });
  }
}

// 答对后的弹框：显示单词与中文释义，附“下一个”按钮
// opts 可选：{title, word, meaning, nextLabel}，不传时保持拼写练习原行为
function drawSpellDialog(opts) {
  const o = opts || {};
  const word = (o.word !== undefined) ? o.word : spellWord;
  const meaning = (o.meaning !== undefined) ? o.meaning : spellMeaning;
  const title = o.title || '拼对啦！';
  const nextLabel = o.nextLabel || '下一个';
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
  ctx.fillText(title, W / 2, cardY + 50);

  ctx.fillStyle = '#5a2d00';
  ctx.font = 'bold 46px sans-serif';
  ctx.fillText(word, W / 2, cardY + 116);

  ctx.fillStyle = '#8a5a2b';
  ctx.font = '26px sans-serif';
  ctx.fillText(meaning, W / 2, cardY + 174);

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
  ctx.fillText(nextLabel, rightX + btnW / 2, btnY + btnH / 2);
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
  else if (state === 'spellDistractSel') drawSpellDistractSel();
  else if (state === 'spell') drawSpell();
  else if (state === 'wordList') drawWordList();
  else if (state === 'match') drawMatch();
  else if (state === 'link') drawLink();
  else if (state === 'dictation') drawDictation();
}

// ============ 单词听写（dictation）============
// 与拼单词的其它练习同级，位于模式选择页第 6 张卡。
// 屏幕始终给出中文释义作题目，英文默认遮住（点卡片揭晓）；
// 四种模式只决定「发音内容与顺序」：cn=中文→英文，en=只英文，both=英文→中文，cnOnly=只中文。
// 到点自动翻下一个词并循环；上一个/下一个/暂停由玩家随时干预，手动操作后重新计时。

function startDictation(chapterId) {
  const ch = SPELL_CHAPTERS.find((c) => c.id === chapterId);
  dictChapterName = ch ? ch.name : '';
  dictWords = shuffled(getChapterWordsPlain(chapterId));   // 已按英文去重、打乱顺序，避免按书本章节顺序背出
  if (!dictWords.length) { state = 'spellMode'; return; }
  if (!isGradeReady(currentGradeId)) loadGradeAudio(currentGradeId); // 静默补下载音频分包
  dictIndex = 0;
  dictTimerMs = DICT_INTERVALS[dictIntervalIdx];
  dictPlaying = true;
  dictShowEn = false;
  state = 'dictation';
  dictPlayCurrent();  // 在点击手势链内播第一词，满足 iOS 首次发音解锁要求
}

// 按当前模式构造发音序列并播放
function dictPlayCurrent() {
  const w = dictWords[dictIndex];
  if (!w) return;
  speakSequence(buildDictParts(dictMode, w.en), DICT_GAP_MS);
}

// delta=1 下一个、-1 上一个、0 重播当前；到头/到尾循环
function dictGoto(delta) {
  const n = dictWords.length;
  if (!n) return;
  dictIndex = wrapIndex(dictIndex, delta, n);
  dictTimerMs = DICT_INTERVALS[dictIntervalIdx];  // 手动切换后重新计时
  dictShowEn = false;
  dictPlayCurrent();
}

// 听写页通用小按钮
function dictDrawButton(rect, label, active, size) {
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = active ? '#ff7a18' : 'rgba(255,255,255,0.94)';
  roundRectPath(ctx, rect.x, rect.y, rect.w, rect.h, 14);
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = active ? 'rgba(255,255,255,0.72)' : 'rgba(255,122,24,0.45)';
  roundRectPath(ctx, rect.x, rect.y, rect.w, rect.h, 14);
  ctx.stroke();
  ctx.fillStyle = active ? '#ffffff' : '#8a5a2b';
  ctx.font = 'bold ' + (size || 16) + 'px sans-serif';
  ctx.fillText(label, rect.x + rect.w / 2, rect.y + rect.h / 2);
}

function drawDictation() {
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  dictBackBtn = { x: 14, y: 14, w: 52, h: 40 };
  drawBackButton(dictBackBtn);

  ctx.fillStyle = '#5a2d00';
  ctx.font = 'bold ' + Math.min(30, W * 0.08) + 'px sans-serif';
  ctx.fillText('单词听写', W / 2, Math.round(H * 0.09));
  ctx.fillStyle = '#8a5a2b';
  ctx.font = Math.min(16, W * 0.042) + 'px sans-serif';
  ctx.fillText('听发音，写单词 · 可手动翻词', W / 2, Math.round(H * 0.145));
  if (dictChapterName) {
    ctx.font = Math.min(14, W * 0.036) + 'px sans-serif';
    ctx.fillText(dictChapterName, W / 2, Math.round(H * 0.185));
  }

  const w = dictWords[dictIndex];
  ctx.fillStyle = '#8a5a2b';
  ctx.font = 'bold ' + Math.min(16, W * 0.042) + 'px sans-serif';
  ctx.fillText('第 ' + (dictIndex + 1) + ' / ' + dictWords.length + ' 个', W / 2, Math.round(H * 0.225));

  // 主卡片：中文释义（题目）+ 可揭晓的英文
  const padX = 24;
  const cardW = W - padX * 2;
  const cardY = Math.round(H * 0.26);
  const cardH = Math.round(Math.min(H * 0.23, 220));
  dictCardRect = { x: padX, y: cardY, w: cardW, h: cardH };
  ctx.fillStyle = '#ffffff';
  roundRectPath(ctx, padX, cardY, cardW, cardH, 22);
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(255,122,24,0.35)';
  roundRectPath(ctx, padX, cardY, cardW, cardH, 22);
  ctx.stroke();

  if (w) {
    const cn = w.cn || w.en;
    let cnSize = Math.min(38, W * 0.095);
    ctx.font = 'bold ' + cnSize + 'px sans-serif';
    while (ctx.measureText(cn).width > cardW - 36 && cnSize > 18) {
      cnSize -= 2;
      ctx.font = 'bold ' + cnSize + 'px sans-serif';
    }
    ctx.fillStyle = '#5a2d00';
    ctx.fillText(cn, W / 2, cardY + cardH * 0.38);

    if (dictShowEn) {
      let enSize = Math.min(30, W * 0.075);
      ctx.font = 'bold ' + enSize + 'px ' + (SPELL_FONT || 'sans-serif');
      while (ctx.measureText(w.en).width > cardW - 36 && enSize > 14) {
        enSize -= 2;
        ctx.font = 'bold ' + enSize + 'px ' + (SPELL_FONT || 'sans-serif');
      }
      ctx.fillStyle = '#2e7d32';
      ctx.fillText(w.en, W / 2, cardY + cardH * 0.70);
    } else {
      ctx.fillStyle = '#b08968';
      ctx.font = Math.min(16, W * 0.042) + 'px sans-serif';
      ctx.fillText('点一下卡片看英文', W / 2, cardY + cardH * 0.70);
    }
  }

  // 倒计时进度条：暂停时清空，提示「不在自动翻页」
  const barY = cardY + cardH + 12;
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  roundRectPath(ctx, padX, barY, cardW, 7, 4);
  ctx.fill();
  const ratio = dictPlaying
    ? Math.max(0, Math.min(1, dictTimerMs / DICT_INTERVALS[dictIntervalIdx])) : 0;
  if (ratio > 0) {
    ctx.fillStyle = '#ff7a18';
    roundRectPath(ctx, padX, barY, Math.max(6, cardW * ratio), 7, 4);
    ctx.fill();
  }

  // 发音模式（4 档）
  let y = barY + 26;
  ctx.fillStyle = '#8a5a2b';
  ctx.font = Math.min(14, W * 0.036) + 'px sans-serif';
  ctx.fillText('发音模式', W / 2, y);
  const modeDefs = [
    { mode: 'cn', label: '中文→英' },
    { mode: 'en', label: '只英文' },
    { mode: 'both', label: '英→中文' },
    { mode: 'cnOnly', label: '只中文' }
  ];
  const mGap = 6, mH = 42, mW = (W - 32 - mGap * 3) / 4, mY = y + 12;
  dictModeBtns = [];
  modeDefs.forEach((m, i) => {
    const rect = { x: 16 + i * (mW + mGap), y: mY, w: mW, h: mH };
    dictModeBtns.push({ rect, mode: m.mode });
    // 4 个中文标签挤在一行，字号按宽度收敛，避免最窄机型溢出
    dictDrawButton(rect, m.label, dictMode === m.mode, Math.min(15, W * 0.037));
  });

  // 时间间隔（5 / 10 / 15 / 30 秒）
  y = mY + mH + 18;
  ctx.fillStyle = '#8a5a2b';
  ctx.font = Math.min(14, W * 0.036) + 'px sans-serif';
  ctx.fillText('每词间隔', W / 2, y);
  const iGap = 6, iH = 38, iW = (W - 32 - iGap * 3) / 4, iY = y + 12;
  dictIntervalBtns = [];
  DICT_INTERVALS.forEach((ms, i) => {
    const rect = { x: 16 + i * (iW + iGap), y: iY, w: iW, h: iH };
    dictIntervalBtns.push({ rect, idx: i });
    dictDrawButton(rect, (ms / 1000) + '秒', dictIntervalIdx === i, Math.min(16, W * 0.042));
  });

  // 上一个 / 暂停·继续 / 下一个
  const cY = iY + iH + 18, cH = 54, cGap = 10, cW = (W - 32 - cGap * 2) / 3;
  dictPrevBtn = { x: 16, y: cY, w: cW, h: cH };
  dictPlayBtn = { x: 16 + cW + cGap, y: cY, w: cW, h: cH };
  dictNextBtn = { x: 16 + (cW + cGap) * 2, y: cY, w: cW, h: cH };
  dictDrawButton(dictPrevBtn, '上一个', false, 17);
  dictDrawButton(dictPlayBtn, dictPlaying ? '暂停' : '继续', true, 17);
  dictDrawButton(dictNextBtn, '下一个', false, 17);

  // 操作提示（按钮文案「中文→英 / 只英文 / 英→中文 / 只中文」已直接表达发音内容，不再重复一行）
  ctx.fillStyle = '#a98261';
  ctx.font = Math.min(13, W * 0.034) + 'px sans-serif';
  ctx.fillText('到点自动下一个并循环 · 手动切换会重新计时', W / 2, cY + cH + 26);
}

// 小游戏渲染循环：优先用 canvas.requestAnimationFrame（Canvas 2D 节点方法，官方推荐）
// 该环境（基础库 3.17.6 / 模拟器）下全局与平台 raf 均未注入，故挂在 canvas 上最稳
function raf(cb) {
  if (typeof canvas !== 'undefined' && typeof canvas.requestAnimationFrame === 'function') {
    return canvas.requestAnimationFrame(cb);
  }
  if (typeof adapter.requestAnimationFrame === 'function') {
    return adapter.requestAnimationFrame(cb);
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
  if (linkMsgTimer > 0) linkMsgTimer -= dt;
  // 单词听写：到点自动翻下一个词并循环；暂停或手动切换后重新计时
  if (state === 'dictation' && dictPlaying && dictWords.length) {
    dictTimerMs -= dt;
    if (dictTimerMs <= 0) dictGoto(1);
  }
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

adapter.onTouchStart((e) => {
  const p = getPoint(e);
  if (!p) return;
  const px = p.x, py = p.y;

  // iOS 音频解锁：首次触摸时激活 AudioSession（高版本 iOS 必须，否则异步报音被静默），
  // 并全局关闭静音开关，避免 iPhone 静音键/系统策略导致无声音。
  if (!touchUnlocked) {
    touchUnlocked = true;
    if (adapter.setInnerAudioOption) {
      try { adapter.setInnerAudioOption({ obeyMuteSwitch: false, mixWithOther: true }); } catch (e) {}
    }
    unlockAudio();
  }

  if (state === 'nav') {
    // 找字母：开关关闭时卡片置灰，点击直接忽略；拼单词：进入年级选择
    if (hit(navFindBtn, px, py)) {
      if (FIND_LETTER_ENABLED) state = 'home';
      return;
    }
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
        else if (item.mode === 'link') startLink(spellChapterId);
        else if (item.mode === 'dict') startDictation(spellChapterId);
        else enterSpellDistractSel(item.mode);
        return;
      }
    }
  } else if (state === 'spellDistractSel') {
    if (hit(spellDistractSelBack, px, py)) { state = 'spellMode'; return; }
    for (const opt of spellDistractSelOpts) {
      if (hit(opt.rect, px, py)) {
        spellDistractLevel = opt.level;          // 选定干扰强度后进入拼写
        startSpellChapter(spellChapterId, spellDistractSelMode);
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
  } else if (state === 'link') {
    // 连对弹框优先响应（按钮区域由 drawSpellDialog 写入，与拼写练习共用）
    if (linkSolved) {
      linkDragging = false;
      linkLastPoint = null;
      if (hit(spellDialogSpeakBtn, px, py)) { speakWord(linkFoundWord); return; }
      if (hit(spellNextBtn, px, py)) { linkSolved = false; return; }
      return;
    }
    if (hit(linkBackBtn, px, py)) { state = 'spellMode'; return; }
    if (linkDone) { state = 'spellMode'; return; }   // 完成态点任意处返回
    // 大小写版本切换：只翻显示标志，本局网格数据、进度、中文提示都不变
    if (hit(linkCaseBtn, px, py)) { linkLowercase = !linkLowercase; return; }
    // 底部释义区按下 = 滚动列表（与网格连线互斥，避免一边滑一边连线）
    if (linkListTop > 0 && py >= linkListTop && py <= linkListBottom && linkListContentH > 0) {
      linkListDragging = true;
      linkListLastY = py;
      linkDragging = false;
      linkLastPoint = null;
      return;
    }
    const idx = linkCellIndexAt(px, py);
    if (idx >= 0) {
      linkDragging = true;
      linkPath = [idx];
      linkLastPoint = { x: px, y: py };
    }
  } else if (state === 'dictation') {
    if (hit(dictBackBtn, px, py)) { stopSpeakSequence(); state = 'spellMode'; return; }
    if (hit(dictPrevBtn, px, py)) { dictGoto(-1); return; }
    if (hit(dictNextBtn, px, py)) { dictGoto(1); return; }
    if (hit(dictPlayBtn, px, py)) {
      dictPlaying = !dictPlaying;
      if (dictPlaying) {
        dictTimerMs = DICT_INTERVALS[dictIntervalIdx];
        dictPlayCurrent();
      } else {
        stopSpeakSequence();
      }
      return;
    }
    for (const b of dictModeBtns) {
      if (hit(b.rect, px, py)) { dictMode = b.mode; dictGoto(0); return; }
    }
    for (const b of dictIntervalBtns) {
      // 只调整节奏，不打断正在念的片段
      if (hit(b.rect, px, py)) {
        dictIntervalIdx = b.idx;
        dictTimerMs = DICT_INTERVALS[b.idx];
        return;
      }
    }
    if (hit(dictCardRect, px, py)) { dictShowEn = !dictShowEn; return; }
    return;
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
      adapter.setStorageSync('letterdrop_best', best);
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
adapter.onTouchMove((e) => {
  // 字母连连：拖动经过相邻格子时延长连线路径
  if (state === 'link') {
    // 释义列表滚动优先：手指上下拖时把剩余中文滑进可视区
    if (linkListDragging) {
      const p = getPoint(e);
      if (p) {
        if (linkListLastY !== null) {
          const dy = p.y - linkListLastY;
          const listH = Math.max(0, linkListBottom - linkListTop);
          const maxScroll = Math.max(0, linkListContentH - listH);
          linkListScrollY = Math.max(0, Math.min(maxScroll, linkListScrollY - dy));
        }
        linkListLastY = p.y;
      }
      lastTouchY = null;
      return;
    }
    if (linkDragging && !linkSolved && !linkDone) {
      const p = getPoint(e);
      if (p) {
        const from = linkLastPoint || p;
        const dx = p.x - from.x, dy = p.y - from.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        // 按 8px 步长插值：手指快速划过时补齐中间格子，
        // 否则 touchMove 采样稀疏，会因「必须四邻接」而中途断线。
        const steps = Math.min(80, Math.max(1, Math.ceil(dist / 8)));
        for (let s = 1; s <= steps; s++) {
          const x = from.x + dx * s / steps;
          const y = from.y + dy * s / steps;
          const idx = linkCellIndexAt(x, y);
          if (idx >= 0) linkExtendPath(idx);
        }
        linkLastPoint = { x: p.x, y: p.y };
      }
    } else {
      linkLastPoint = null;
    }
    lastTouchY = null;
    return;
  }
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

adapter.onTouchEnd(() => {
  // 释义列表拖动结束（无论当前什么状态都清掉，避免残留）
  linkListDragging = false;
  linkListLastY = null;
  if (state === 'grade' && !gradeTouchMoved && gradePendingCard) {
    const id = gradePendingCard;
    gradePendingCard = null;
    enterGrade(id);
  }
  // 字母连连：抬手结算本次连线
  if (state === 'link' && linkDragging) {
    linkDragging = false;
    linkLastPoint = null;
    resolveLinkPath();
  }
  gradePendingCard = null;
  lastTouchY = null;
});

// ============ 转发分享 ============
// 微信小游戏的「转发给朋友 / 分享到朋友圈」菜单默认置灰、不可点击，必须由游戏代码
// 主动调用 showShareMenu 打开；否则即使正式版+已认证，右上角这两个图标仍是灰的。
// 认证/发布只给「使用资格」，开关本身要代码来开。全部经 adapter 收口，不直接碰 wx。
const SHARE_TITLE = '字母拼拼 · 听音辨形，边玩边学英语字母和单词';
const SHARE_QUERY = 'from=share';
let shareImagePath = '';  // 5:4 转发图临时路径；生成失败则留空，回退微信默认 logo

// 用离屏 Canvas 现画一张 5:4 转发卡片图，导出为临时文件路径。
// 不指定 imageUrl 时微信会用后台配置的小游戏 logo，故生成失败不影响分享可用性。
function buildShareImage() {
  if (typeof adapter.createCanvas !== 'function') return;
  try {
    const sc = adapter.createCanvas();           // 第二次调用返回离屏画布
    const sw = 500, sh = 400;                    // 官方推荐 5:4
    sc.width = sw;
    sc.height = sh;
    const c = sc.getContext('2d');
    const g = c.createLinearGradient(0, 0, 0, sh);
    g.addColorStop(0, '#fff3e0');
    g.addColorStop(1, '#ffd28a');
    c.fillStyle = g;
    c.fillRect(0, 0, sw, sh);
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillStyle = '#5a2d00';
    c.font = 'bold 76px sans-serif';
    c.fillText('字母拼拼', sw / 2, sh / 2 - 46);
    c.fillStyle = '#8a5a2b';
    c.font = '34px sans-serif';
    c.fillText('听音辨形 · 拼词启蒙', sw / 2, sh / 2 + 38);
    c.font = '26px sans-serif';
    c.fillStyle = '#a8703a';
    c.fillText('点开一起学英语', sw / 2, sh / 2 + 96);
    if (typeof sc.toTempFilePathSync === 'function') {
      shareImagePath = sc.toTempFilePathSync({
        x: 0, y: 0, width: sw, height: sh, destWidth: sw, destHeight: sh
      }) || '';
    }
  } catch (e) {
    shareImagePath = '';  // 任何异常都回退默认 logo，不影响分享
  }
}

// 组装自定义转发卡片；图片仅在成功生成时带上。
function shareCard() {
  const card = { title: SHARE_TITLE, query: SHARE_QUERY };
  if (shareImagePath) card.imageUrl = shareImagePath;
  return card;
}

// 初始化分享能力：打开右上角菜单、设置被动/朋友圈卡片、预生成转发图。
function initShare() {
  if (typeof adapter.showShareMenu === 'function') {
    try { adapter.showShareMenu({ menus: ['shareAppMessage', 'shareTimeline'] }); } catch (e) {}
  }
  if (typeof adapter.onShareAppMessage === 'function') {
    try { adapter.onShareAppMessage(shareCard); } catch (e) {}
  }
  if (typeof adapter.onShareTimeline === 'function') {
    // 朋友圈为 beta、仅 Android；不指定 imageUrl 时用默认 logo，标题用同一句
    try { adapter.onShareTimeline(() => ({ title: SHARE_TITLE, query: SHARE_QUERY })); } catch (e) {}
  }
  buildShareImage();
}

initShare();

// 启动渲染循环
raf(loop);
