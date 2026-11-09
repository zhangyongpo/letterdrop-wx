// Copyright (c) 2026 zhangyongpo. SPDX-License-Identifier: Apache-2.0
// 本文件为 letterdrop-wx 项目独立开发源码；许可证见 LICENSE，第三方资产声明见 NOTICE.md。
// data/words.js
// 外研剑桥《Join In 三年级上册》（2024 秋版）单词表，按单元整理，含中文释义。
// 用于“拼单词”模式。注意：含空格的短语（如 good morning）不适合逐字母拼写，
// 在 game.js 接入时会被过滤，不参与拼写练习，但释义仍保留供查阅。

const WELCOME = [
  { en: 'let', cn: '让' }, { en: 'begin', cn: '开始' }, { en: 'join', cn: '加入' },
  { en: 'in', cn: '在……中' }, { en: 'English', cn: '英语' }, { en: 'be', cn: '是' },
  { en: 'easy', cn: '容易的' }, { en: 'come', cn: '来' }, { en: 'and', cn: '和' },
  { en: 'you', cn: '你；你们' }, { en: 'ready', cn: '准备好的' }, { en: 'kid', cn: '小孩' },
  { en: 'yes', cn: '是' }, { en: 'OK', cn: '行，可以' }, { en: 'listen', cn: '听' },
  { en: 'sing', cn: '唱' }, { en: 'speak', cn: '说' }, { en: 'act', cn: '表演' },
  { en: 'draw', cn: '画' }, { en: 'look', cn: '看' }, { en: 'guess', cn: '猜' },
  { en: 'write', cn: '写' }, { en: 'think', cn: '思考' }, { en: 'read', cn: '阅读' },
  { en: 'colour', cn: '给……涂色' }, { en: 'play', cn: '玩' }, { en: 'hello', cn: '你好' },
  { en: 'mime', cn: '比画着表达' }
];

const UNIT1 = [
  { en: 'speak', cn: '说话' }, { en: 'draw', cn: '画' }, { en: 'look', cn: '看' },
  { en: 'guess', cn: '猜' }, { en: 'write', cn: '写' }, { en: 'think', cn: '思考' },
  { en: 'read', cn: '读' }, { en: 'colour', cn: '涂色' }, { en: 'play', cn: '玩' },
  { en: 'hello', cn: '你好' }, { en: 'what', cn: '什么' }, { en: 'your', cn: '你的' },
  { en: 'name', cn: '名字' }, { en: 'go', cn: '去' }, { en: 'we', cn: '我们' },
  { en: 'all', cn: '每一个' }, { en: 'love', cn: '喜爱' }, { en: 'clever', cn: '聪明的' },
  { en: 'bird', cn: '鸟' }, { en: 'him', cn: '他' }, { en: 'good', cn: '好的' },
  { en: 'morning', cn: '早晨' }, { en: 'this', cn: '这，这个' }, { en: 'nice', cn: '令人愉快的' },
  { en: 'to', cn: '向，到' }, { en: 'meet', cn: '认识，结识' }, { en: 'happy', cn: '快乐的' },
  { en: 'birthday', cn: '生日' }, { en: 'afternoon', cn: '下午' }, { en: 'Ms', cn: '女士' },
  { en: 'how', cn: '怎样' }, { en: 'today', cn: '今天' }, { en: 'too', cn: '也' },
  { en: 'fine', cn: '很好' }, { en: 'children', cn: '儿童' }, { en: 'cut', cn: '剪' },
  { en: 'my', cn: '我的' }, { en: 'hi', cn: '你好' }, { en: 'goodbye', cn: '再见' }
];

const UNIT2 = [
  { en: 'colourful', cn: '色彩丰富的' }, { en: 'world', cn: '世界' }, { en: 'red', cn: '红色（的）' },
  { en: 'pink', cn: '粉色（的）' }, { en: 'yellow', cn: '黄色（的）' }, { en: 'green', cn: '绿色（的）' },
  { en: 'orange', cn: '橙色（的）' }, { en: 'black', cn: '黑色（的）' }, { en: 'brown', cn: '棕色（的）' },
  { en: 'blue', cn: '蓝色（的）' }, { en: 'white', cn: '白色（的）' }, { en: 'purple', cn: '紫色（的）' },
  { en: 'the', cn: '这，那' }, { en: 'rainbow', cn: '彩虹' }, { en: 'it', cn: '它' },
  { en: 'start', cn: '开始' }, { en: 'necklace', cn: '项链' }, { en: 'for', cn: '给' },
  { en: 'mum', cn: '妈妈' }, { en: 'old', cn: '旧的' }, { en: 'can', cn: '能，可以' },
  { en: 'paint', cn: '给……涂颜料' }, { en: 'only', cn: '只有，仅' }, { en: 'me', cn: '我' },
  { en: 'thank', cn: '感谢' }, { en: 'dear', cn: '亲爱的' }, { en: 'at', cn: '在' },
  { en: 'butterfly', cn: '蝴蝶' }, { en: 'lovely', cn: '美丽的' }, { en: 'little', cn: '小的' },
  { en: 'favourite', cn: '最喜欢的' }, { en: 'no', cn: '不，不是' }, { en: 'yes', cn: '是，对' },
  { en: 'that', cn: '那，那个' }, { en: 'right', cn: '正确的' }
];

const UNIT3 = [
  { en: 'number', cn: '数字' }, { en: 'fun', cn: '有趣的' }, { en: 'tiger', cn: '老虎' },
  { en: 'jump', cn: '跳，跃' }, { en: 'do', cn: '做' }, { en: 'ten', cn: '十' },
  { en: 'nine', cn: '九' }, { en: 'eight', cn: '八' }, { en: 'seven', cn: '七' },
  { en: 'six', cn: '六' }, { en: 'five', cn: '五' }, { en: 'four', cn: '四' },
  { en: 'three', cn: '三' }, { en: 'two', cn: '二' }, { en: 'one', cn: '一' },
  { en: 'duck', cn: '鸭子' }, { en: 'show', cn: '节目' }, { en: 'about', cn: '大约' },
  { en: 'dad', cn: '爸爸' }, { en: 'please', cn: '请' }, { en: 'hurry', cn: '赶紧' },
  { en: 'up', cn: '向上' }, { en: 'wrong', cn: '有问题的' }, { en: 'see', cn: '看见' },
  { en: 'many', cn: '许多' }, { en: 'get', cn: '移动，去' }, { en: 'out', cn: '向外' },
  { en: 'have', cn: '有' }, { en: 'help', cn: '帮助' }, { en: 'great', cn: '极好的' },
  { en: 'late', cn: '迟到的' }, { en: 'safe', cn: '安全的' }, { en: 'call', cn: '打电话' },
  { en: 'people', cn: '人' }
];

const UNIT4 = [
  { en: 'school', cn: '学校' }, { en: 'thing', cn: '东西' }, { en: 'pencil', cn: '铅笔' },
  { en: 'case', cn: '盒子' }, { en: 'pen', cn: '钢笔' }, { en: 'eraser', cn: '橡皮' },
  { en: 'schoolbag', cn: '书包' }, { en: 'ruler', cn: '尺子' }, { en: 'book', cn: '书' },
  { en: 'home', cn: '家' }, { en: 'where', cn: '在哪里' }, { en: 'picture', cn: '图画' },
  { en: 'on', cn: '在……上面' }, { en: 'wall', cn: '墙' }, { en: 'paper', cn: '纸' },
  { en: 'open', cn: '打开' }, { en: 'take', cn: '拿' }, { en: 'rope', cn: '绳' }
];

const UNIT5 = [
  { en: 'classroom', cn: '教室' }, { en: 'blackboard', cn: '黑板' }, { en: 'door', cn: '门' },
  { en: 'window', cn: '窗户' }, { en: 'desk', cn: '书桌' }, { en: 'chair', cn: '椅子' },
  { en: 'floor', cn: '地面' }, { en: 'ball', cn: '球' }, { en: 'behind', cn: '在……后面' },
  { en: 'front', cn: '前面' }, { en: 'of', cn: '……的' }, { en: 'beside', cn: '在……旁边' },
  { en: 'under', cn: '在……下面' }, { en: 'now', cn: '现在' }, { en: 'class', cn: '班，班级' },
  { en: 'wow', cn: '哇' }, { en: 'next', cn: '紧接着的' }, { en: 'keep', cn: '饲养' },
  { en: 'with', cn: '和……一起' }, { en: 'over', cn: '结束' }, { en: 'clean', cn: '打扫' },
  { en: 'sweep', cn: '清扫' }, { en: 'put', cn: '放' }, { en: 'tomorrow', cn: '明天' },
  { en: 'they', cn: '他们' }
];

// Unit 6 · Family（2024 审定新版三上第 6 单元，此前词库遗漏，2026-11 补齐）
const UNIT6 = [
  { en: 'family', cn: '家，家庭' }, { en: 'job', cn: '工作，任务' },
  { en: 'brother', cn: '哥哥；弟弟' }, { en: 'sister', cn: '姐姐；妹妹' },
  { en: 'grandpa', cn: '爷爷；外公' }, { en: 'grandma', cn: '奶奶；外婆' },
  { en: 'uncle', cn: '叔叔；舅舅' }, { en: 'aunt', cn: '阿姨；姑妈' },
  { en: 'grandfather', cn: '祖父；外祖父' }, { en: 'grandmother', cn: '祖母；外祖母' },
  { en: 'mother', cn: '母亲' }, { en: 'father', cn: '父亲' },
  { en: 'cousin', cn: '堂（表）兄弟姐妹' }, { en: 'who', cn: '谁' },
  { en: 'her', cn: '她的' }, { en: 'their', cn: '他们的' },
  { en: 'he', cn: '他' }, { en: 'she', cn: '她' },
  { en: 'sport', cn: '体育运动' }, { en: 'day', cn: '一天' },
  { en: 'time', cn: '时间' }, { en: 'long', cn: '长时间的' },
  { en: 'some', cn: '一些' }, { en: 'tea', cn: '茶' },
  { en: 'well', cn: '令人满意地' }, { en: 'all', cn: '完全' },
  { en: 'best', cn: '最好的' }, { en: 'win', cn: '获胜，赢' },
  { en: 'good job', cn: '干得好' }, { en: 'all right', cn: '没问题的' },
  { en: 'sports day', cn: '运动日' }
];

const CHAPTERS = [
  { id: 'welcome', name: 'Welcome unit（起始单元）', words: WELCOME },
  { id: 'u1', name: 'Unit 1 · 交友问候', words: UNIT1 },
  { id: 'u2', name: 'Unit 2 · 颜色世界', words: UNIT2 },
  { id: 'u3', name: 'Unit 3 · 数字动物', words: UNIT3 },
  { id: 'u4', name: 'Unit 4 · 学习用品', words: UNIT4 },
  { id: 'u5', name: 'Unit 5 · 教室方位', words: UNIT5 },
  { id: 'u6', name: 'Unit 6 · 家庭成员', words: UNIT6 }
];

// “全部”章节：合并所有单元
const ALL_WORDS = [];
CHAPTERS.forEach((c) => { ALL_WORDS.push(...c.words); });

const BOOK = {
  title: '三年级上册',
  chapters: CHAPTERS,
  all: { id: 'all', name: '全部章节', words: ALL_WORDS }
};

module.exports = { BOOK, CHAPTERS, ALL_WORDS };
