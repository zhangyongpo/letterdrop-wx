// config/gameConfig.js
// 游戏核心配置：字母集、速度公式、语音映射、外研版（三起）三年级上册词库
// 与安卓版（letterdrop）设计保持一致，便于双端复用同一套数值。

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

const BASE_LEVEL = 5;        // 起始速度档（对应安卓版 BASE_LEVEL = 5）
const POINTS_PER_LEVEL = 20; // 每多少分升一档（安卓版为 20，无上限）
const BASE_SPEED = 0.11;     // 基础下落速度（逻辑像素/毫秒，档位 = BASE_LEVEL 时）

// 速度随档位提升：无上限，每升一档 +15%
function speedForLevel(level) {
  return BASE_SPEED * (1 + (level - BASE_LEVEL) * 0.15);
}

// 根据当前得分推导速度档
function levelForScore(score) {
  return BASE_LEVEL + Math.floor(score / POINTS_PER_LEVEL);
}

// 字母读音 -> 字母（源自安卓版 Vosk 47 词 grammar；小程序云端识别可复用为热词）
const SPEECH_MAP = {
  'a': 'A', 'ay': 'A', 'apple': 'A',
  'b': 'B', 'bee': 'B',
  'c': 'C', 'see': 'C', 'sea': 'C',
  'd': 'D', 'dee': 'D',
  'e': 'E', 'eel': 'E',
  'f': 'F', 'eff': 'F',
  'g': 'G', 'jee': 'G',
  'h': 'H', 'aitch': 'H',
  'i': 'I', 'eye': 'I',
  'j': 'J', 'jay': 'J',
  'k': 'K', 'kay': 'K',
  'l': 'L', 'el': 'L',
  'm': 'M', 'em': 'M',
  'n': 'N', 'en': 'N',
  'o': 'O', 'oh': 'O',
  'p': 'P', 'pee': 'P',
  'q': 'Q', 'cue': 'Q', 'queue': 'Q',
  'r': 'R', 'ar': 'R',
  's': 'S', 'ess': 'S',
  't': 'T', 'tee': 'T',
  'u': 'U', 'you': 'U',
  'v': 'V', 'vee': 'V',
  'w': 'W', 'doubleu': 'W', 'double you': 'W',
  'x': 'X', 'ex': 'X',
  'y': 'Y', 'why': 'Y',
  'z': 'Z', 'zee': 'Z', 'zed': 'Z'
};

// 词库：外研版（三起）三年级上册 Module 1–10（供未来"读单词"模式使用）
// 格式：{ en, zh, module }
const WORD_BANK = [
  // Module 1 问候
  { en: 'I', zh: '我', module: 1 }, { en: 'am', zh: '是(我是)', module: 1 },
  { en: 'hello', zh: '你好', module: 1 }, { en: 'goodbye', zh: '再见', module: 1 },
  { en: 'good', zh: '好的', module: 1 }, { en: 'morning', zh: '早晨', module: 1 },
  { en: 'fine', zh: '健康的', module: 1 }, { en: 'thank', zh: '谢谢', module: 1 },
  { en: 'you', zh: '你', module: 1 },
  // Module 2 个人信息
  { en: 'Ms', zh: '女士', module: 2 }, { en: 'boy', zh: '男孩', module: 2 },
  { en: 'girl', zh: '女孩', module: 2 }, { en: 'and', zh: '和', module: 2 },
  { en: 'too', zh: '也', module: 2 }, { en: 'what', zh: '什么', module: 2 },
  { en: 'your', zh: '你的', module: 2 }, { en: 'name', zh: '名字', module: 2 },
  { en: 'please', zh: '请', module: 2 }, { en: 'afternoon', zh: '下午', module: 2 },
  { en: 'Mr', zh: '先生', module: 2 },
  // Module 3 课堂指令
  { en: 'point', zh: '指', module: 3 }, { en: 'door', zh: '门', module: 3 },
  { en: 'sit', zh: '坐', module: 3 }, { en: 'stand', zh: '站', module: 3 },
  { en: 'window', zh: '窗户', module: 3 }, { en: 'blackboard', zh: '黑板', module: 3 },
  { en: 'bird', zh: '鸟', module: 3 }, { en: 'desk', zh: '书桌', module: 3 },
  { en: 'chair', zh: '椅子', module: 3 },
  // Module 4 颜色/动物
  { en: 'red', zh: '红色的', module: 4 }, { en: 'yellow', zh: '黄色的', module: 4 },
  { en: 'blue', zh: '蓝色的', module: 4 }, { en: 'green', zh: '绿色的', module: 4 },
  { en: 'black', zh: '黑色的', module: 4 }, { en: 'panda', zh: '熊猫', module: 4 },
  { en: 'dog', zh: '狗', module: 4 }, { en: 'cat', zh: '猫', module: 4 },
  { en: 'cap', zh: '帽子', module: 4 },
  // Module 5 数字
  { en: 'one', zh: '一', module: 5 }, { en: 'two', zh: '二', module: 5 },
  { en: 'three', zh: '三', module: 5 }, { en: 'four', zh: '四', module: 5 },
  { en: 'five', zh: '五', module: 5 }, { en: 'six', zh: '六', module: 5 },
  { en: 'seven', zh: '七', module: 5 }, { en: 'eight', zh: '八', module: 5 },
  { en: 'nine', zh: '九', module: 5 }, { en: 'ten', zh: '十', module: 5 },
  { en: 'eleven', zh: '十一', module: 5 }, { en: 'twelve', zh: '十二', module: 5 },
  // Module 6 生日/年龄
  { en: 'happy', zh: '快乐的', module: 6 }, { en: 'birthday', zh: '生日', module: 6 },
  { en: 'present', zh: '礼物', module: 6 }, { en: 'pencil', zh: '铅笔', module: 6 },
  { en: 'pen', zh: '钢笔', module: 6 }, { en: 'cake', zh: '蛋糕', module: 6 },
  { en: 'old', zh: '…岁的', module: 6 },
  // Module 7 学校
  { en: 'teacher', zh: '教师', module: 7 }, { en: 'pupil', zh: '小学生', module: 7 },
  { en: 'school', zh: '学校', module: 7 }, { en: 'classroom', zh: '教室', module: 7 },
  { en: 'English', zh: '英语', module: 7 }, { en: 'schoolbag', zh: '书包', module: 7 },
  { en: 'ball', zh: '球', module: 7 }, { en: 'book', zh: '书', module: 7 },
  // Module 8 物品/方位
  { en: 'monster', zh: '怪物', module: 8 }, { en: 'new', zh: '新的', module: 8 },
  { en: 'kite', zh: '风筝', module: 8 }, { en: 'know', zh: '知道', module: 8 },
  { en: 'help', zh: '救命', module: 8 }, { en: 'where', zh: '在哪里', module: 8 },
  { en: 'bag', zh: '包', module: 8 },
  // Module 9 家庭/职业
  { en: 'mother', zh: '母亲', module: 9 }, { en: 'father', zh: '父亲', module: 9 },
  { en: 'sister', zh: '姐妹', module: 9 }, { en: 'brother', zh: '兄弟', module: 9 },
  { en: 'grandma', zh: '祖母', module: 9 }, { en: 'grandpa', zh: '祖父', module: 9 },
  { en: 'doctor', zh: '医生', module: 9 }, { en: 'policeman', zh: '警察', module: 9 },
  { en: 'nurse', zh: '护士', module: 9 }, { en: 'driver', zh: '司机', module: 9 },
  { en: 'farmer', zh: '农民', module: 9 },
  // Module 10 身体部位
  { en: 'head', zh: '头', module: 10 }, { en: 'leg', zh: '腿', module: 10 },
  { en: 'foot', zh: '脚', module: 10 }, { en: 'arm', zh: '胳膊', module: 10 },
  { en: 'hand', zh: '手', module: 10 }, { en: 'nose', zh: '鼻子', module: 10 },
  { en: 'eye', zh: '眼睛', module: 10 }, { en: 'mouth', zh: '嘴', module: 10 },
  { en: 'ear', zh: '耳朵', module: 10 }
];

module.exports = {
  LETTERS,
  BASE_LEVEL,
  POINTS_PER_LEVEL,
  BASE_SPEED,
  speedForLevel,
  levelForScore,
  SPEECH_MAP,
  WORD_BANK
};
