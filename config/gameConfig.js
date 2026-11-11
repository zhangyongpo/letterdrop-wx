// Copyright (c) 2026 zhangyongpo. SPDX-License-Identifier: Apache-2.0
// 本文件为 letterdrop-wx 项目独立开发源码；许可证见 LICENSE，第三方资产声明见 NOTICE.md。
// config/gameConfig.js
// 反向玩法（App 报出字母 → 玩家在掉落字母中点击）核心配置

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

// 找字母模式是否开放。false 时导航页卡片置灰并显示「即将到来」，点击不进入。
// 玩法代码（home / playing / gameover 等状态）一直保留，切换开关无需重写逻辑。
// 双端共用本配置，改动后需重新执行 node scripts/build.js 重建产物。
const FIND_LETTER_ENABLED = true;

const GROUP_SIZE = 6;          // 每组掉落的字母数量
const COLS = 3;                // 每排列数（每组分两排，每排 3 个）
const ROWS = 2;                // 排数
const MAX_TARGET_COUNT = 2;    // 每组中“正确答案”最多出现次数（大小写合计，最多 2 个）
const GROUPS_PER_LEVEL = 10;   // 每完成多少组，速度 +1 档
const MAX_LIVES = 3;           // 生命数（漏掉目标字母落地则扣 1 命）
const CORRECT_SCORE = 1;       // 点中正确字母得分
const WRONG_PENALTY = 1;       // 点错（点到干扰项）扣分

const BASE_SPEED = 0.09;       // 第 1 档基础下落速度（逻辑像素/毫秒）
const SPEED_STEP = 0.15;       // 每升一档速度增加的比例

// 字母连连：从章节词库抽词，把字母摆进网格，玩家拖动相邻字母连成单词。
// 路径允许横连、竖连或一次转弯（L 形）；剩余格子填干扰字母。
// 每局目标词数量按「单词长度」动态决定：短词多放、长词少放，
// 以目标词字母累计占用的格数达到网格容量的 LINK_FILL_RATIO 为准（其余留作干扰字母）。
const LINK_WORD_MIN = 4;       // 每局最少目标词数（长词章节也不会只有两三个）
const LINK_WORD_MAX = 8;       // 每局最多目标词数（对应中文提示 4 行，仍可一屏放下）
const LINK_FILL_RATIO = 0.62;  // 目标词字母占用的格数 / 网格总格数
const LINK_GRID_COLS = 6;      // 网格列数（每行几个字母候选项，保持不变）
const LINK_GRID_ROWS = 8;      // 网格行数（原 6 行 +2；改成 9 即 +3 行，格子会自动缩小）
const LINK_MAX_WORD_LEN = 8;   // 参与抽词的最长单词，超过则跳过（避免路径占满网格）
// 默认字母版本：false = 大写版（网格显示 A~Z），true = 小写英文版（网格显示 a~z）。
// 只影响「字母连连」网格字母的显示，词库数据与连线判定始终按大写内部值处理；
// 玩家在页面右上角可随时切换，切换后本次游戏会话内保持。
const LINK_DEFAULT_LOWERCASE = false;

// 根据速度档计算当前下落速度（无上限，慢慢变快）
function speedForLevel(level) {
  return BASE_SPEED * (1 + (level - 1) * SPEED_STEP);
}

// 词库：外研版（三起）三年级上册 Module 1–10（备用，未来可做“读单词”模式）
const WORD_BANK = [
  { en: 'I', zh: '我', module: 1 }, { en: 'am', zh: '是(我是)', module: 1 },
  { en: 'hello', zh: '你好', module: 1 }, { en: 'goodbye', zh: '再见', module: 1 },
  { en: 'good', zh: '好的', module: 1 }, { en: 'morning', zh: '早晨', module: 1 },
  { en: 'fine', zh: '健康的', module: 1 }, { en: 'thank', zh: '谢谢', module: 1 },
  { en: 'you', zh: '你', module: 1 },
  { en: 'Ms', zh: '女士', module: 2 }, { en: 'boy', zh: '男孩', module: 2 },
  { en: 'girl', zh: '女孩', module: 2 }, { en: 'and', zh: '和', module: 2 },
  { en: 'too', zh: '也', module: 2 }, { en: 'what', zh: '什么', module: 2 },
  { en: 'your', zh: '你的', module: 2 }, { en: 'name', zh: '名字', module: 2 },
  { en: 'please', zh: '请', module: 2 }, { en: 'afternoon', zh: '下午', module: 2 },
  { en: 'Mr', zh: '先生', module: 2 },
  { en: 'point', zh: '指', module: 3 }, { en: 'door', zh: '门', module: 3 },
  { en: 'sit', zh: '坐', module: 3 }, { en: 'stand', zh: '站', module: 3 },
  { en: 'window', zh: '窗户', module: 3 }, { en: 'blackboard', zh: '黑板', module: 3 },
  { en: 'bird', zh: '鸟', module: 3 }, { en: 'desk', zh: '书桌', module: 3 },
  { en: 'chair', zh: '椅子', module: 3 },
  { en: 'red', zh: '红色的', module: 4 }, { en: 'yellow', zh: '黄色的', module: 4 },
  { en: 'blue', zh: '蓝色的', module: 4 }, { en: 'green', zh: '绿色的', module: 4 },
  { en: 'black', zh: '黑色的', module: 4 }, { en: 'panda', zh: '熊猫', module: 4 },
  { en: 'dog', zh: '狗', module: 4 }, { en: 'cat', zh: '猫', module: 4 },
  { en: 'cap', zh: '帽子', module: 4 },
  { en: 'one', zh: '一', module: 5 }, { en: 'two', zh: '二', module: 5 },
  { en: 'three', zh: '三', module: 5 }, { en: 'four', zh: '四', module: 5 },
  { en: 'five', zh: '五', module: 5 }, { en: 'six', zh: '六', module: 5 },
  { en: 'seven', zh: '七', module: 5 }, { en: 'eight', zh: '八', module: 5 },
  { en: 'nine', zh: '九', module: 5 }, { en: 'ten', zh: '十', module: 5 },
  { en: 'eleven', zh: '十一', module: 5 }, { en: 'twelve', zh: '十二', module: 5 },
  { en: 'happy', zh: '快乐的', module: 6 }, { en: 'birthday', zh: '生日', module: 6 },
  { en: 'present', zh: '礼物', module: 6 }, { en: 'pencil', zh: '铅笔', module: 6 },
  { en: 'pen', zh: '钢笔', module: 6 }, { en: 'cake', zh: '蛋糕', module: 6 },
  { en: 'old', zh: '…岁的', module: 6 },
  { en: 'teacher', zh: '教师', module: 7 }, { en: 'pupil', zh: '小学生', module: 7 },
  { en: 'school', zh: '学校', module: 7 }, { en: 'classroom', zh: '教室', module: 7 },
  { en: 'English', zh: '英语', module: 7 }, { en: 'schoolbag', zh: '书包', module: 7 },
  { en: 'ball', zh: '球', module: 7 }, { en: 'book', zh: '书', module: 7 },
  { en: 'monster', zh: '怪物', module: 8 }, { en: 'new', zh: '新的', module: 8 },
  { en: 'kite', zh: '风筝', module: 8 }, { en: 'know', zh: '知道', module: 8 },
  { en: 'help', zh: '救命', module: 8 }, { en: 'where', zh: '在哪里', module: 8 },
  { en: 'bag', zh: '包', module: 8 },
  { en: 'mother', zh: '母亲', module: 9 }, { en: 'father', zh: '父亲', module: 9 },
  { en: 'sister', zh: '姐妹', module: 9 }, { en: 'brother', zh: '兄弟', module: 9 },
  { en: 'grandma', zh: '祖母', module: 9 }, { en: 'grandpa', zh: '祖父', module: 9 },
  { en: 'doctor', zh: '医生', module: 9 }, { en: 'policeman', zh: '警察', module: 9 },
  { en: 'nurse', zh: '护士', module: 9 }, { en: 'driver', zh: '司机', module: 9 },
  { en: 'farmer', zh: '农民', module: 9 },
  { en: 'head', zh: '头', module: 10 }, { en: 'leg', zh: '腿', module: 10 },
  { en: 'foot', zh: '脚', module: 10 }, { en: 'arm', zh: '胳膊', module: 10 },
  { en: 'hand', zh: '手', module: 10 }, { en: 'nose', zh: '鼻子', module: 10 },
  { en: 'eye', zh: '眼睛', module: 10 }, { en: 'mouth', zh: '嘴', module: 10 },
  { en: 'ear', zh: '耳朵', module: 10 }
];

module.exports = {
  LETTERS,
  FIND_LETTER_ENABLED,
  GROUP_SIZE,
  COLS,
  ROWS,
  MAX_TARGET_COUNT,
  GROUPS_PER_LEVEL,
  MAX_LIVES,
  CORRECT_SCORE,
  WRONG_PENALTY,
  BASE_SPEED,
  SPEED_STEP,
  speedForLevel,
  LINK_WORD_MIN,
  LINK_WORD_MAX,
  LINK_FILL_RATIO,
  LINK_GRID_COLS,
  LINK_GRID_ROWS,
  LINK_MAX_WORD_LEN,
  LINK_DEFAULT_LOWERCASE,
  WORD_BANK
};
