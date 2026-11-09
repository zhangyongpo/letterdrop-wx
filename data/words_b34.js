// Copyright (c) 2026 zhangyongpo. SPDX-License-Identifier: Apache-2.0
// 本文件为 letterdrop-wx 项目独立开发源码；许可证见 LICENSE，第三方资产声明见 NOTICE.md。
// data/words_b34.js
// 外研剑桥《Join In》（三年级起点，2024 国家教材委员会审核通过）三/四年级下册词表。
// 与项目现有 data/words.js（三上 2024 秋版）、data/words_g456.js（四上 2025 秋版等）
// 为同一套教材，主编刘兆义，外语教学与研究出版社。
//
//   三下：2025 春版（电子课本网 joinin3b_2025）
//   四下：2026 春版（电子课本网 joinin4b_2026）
// 单元标题取自电子课本目录；词条与释义取自课本 Words and expressions 的公开
// OCR 整理资料（教习网英语朗读 51jiaoxi 三下/四下全册单词表）。
//
// ⚠️ 注意：OCR 资料中部分单元标题与课本目录略有出入（如三下 Unit 2 写作
//    "Know your body"、Unit 4 写作 "Rain or sun, it's fun"），本文件统一采用
//    电子课本目录标题（From head to toe / Rain or shine），词条内容不受影响。
// ⚠️ 四下 Unit 6 源资料仅 10 词，明显少于其他单元，疑似抓取不全，建议对照
//    课本词汇表页核一遍；补全后重跑 python tools/gen_words_audio.py --grades g4b 即可。
// ⚠️ 两册的 Plays / More activities 剧本词汇公开资料未给出完整词表，暂未收录
//    （与三上词库处理方式一致）。
// ⚠️ 含空格/连字符/撇号的短语（如 two o'clock / T-shirt / try sth on）保留释义
//    供「全部单词查阅」，由 game.js 的 /^[a-z]+$/i 过滤，不进拼写练习。

// ---------------------------------------------------------------- 三年级下册
const G3B_U1 = [
  { en: 'feeling', cn: '感觉' }, { en: 'tired', cn: '疲惫的' },
  { en: 'sad', cn: '难过的' }, { en: 'angry', cn: '生气的' },
  { en: 'scared', cn: '害怕的' }, { en: 'cry', cn: '哭' },
  { en: 'laugh', cn: '笑' }, { en: 'stamp', cn: '跺（脚）' },
  { en: 'sleep', cn: '睡觉' }, { en: 'new', cn: '新的' },
  { en: 'game', cn: '游戏' }, { en: 'excited', cn: '兴奋的' },
  { en: 'sorry', cn: '对不起' }, { en: 'like', cn: '喜欢' },
  { en: 'but', cn: '但是' }, { en: 'unhappy', cn: '不开心的' },
  { en: 'worried', cn: '担心的' }, { en: 'not', cn: '不，不是' },
  { en: 'feel', cn: '感觉到，觉得' }, { en: 'find', cn: '找到' },
  { en: 'doll', cn: '玩偶' }, { en: 'football', cn: '足球' },
  { en: 'eat', cn: '吃' }, { en: 'his', cn: '他的' },
  { en: 'cake', cn: '蛋糕' }, { en: 'big', cn: '大的' },
  { en: 'mouse', cn: '老鼠' }
];

const G3B_U2 = [
  { en: 'know', cn: '了解' }, { en: 'body', cn: '身体；躯干' },
  { en: 'rock', cn: '摇滚乐' }, { en: 'song', cn: '歌曲' },
  { en: 'touch', cn: '触摸' }, { en: 'head', cn: '头' },
  { en: 'eye', cn: '眼睛' }, { en: 'hair', cn: '头发' },
  { en: 'ear', cn: '耳朵' }, { en: 'wave', cn: '摆动' },
  { en: 'leg', cn: '腿' }, { en: 'foot', cn: '脚' },
  { en: 'nose', cn: '鼻子' }, { en: 'face', cn: '脸' },
  { en: 'arm', cn: '手臂' }, { en: 'hand', cn: '手' },
  { en: 'mouth', cn: '嘴' }, { en: 'tooth', cn: '牙' },
  { en: 'prize', cn: '奖品' }, { en: 'bike', cn: '自行车' },
  { en: 'race', cn: '竞赛' }, { en: 'stretch', cn: '伸展' },
  { en: 'shake', cn: '摇动' }, { en: 'here', cn: '在这里' },
  { en: 'Mr', cn: '先生' }, { en: 'back', cn: '回到原处' },
  { en: 'worry', cn: '担心' }, { en: 'short', cn: '短的' },
  { en: 'small', cn: '小的' }, { en: 'robot', cn: '机器人' }
];

const G3B_U3 = [
  { en: 'so', cn: '这么，如此' }, { en: 'cool', cn: '酷的' },
  { en: 'clothes', cn: '衣服' }, { en: 'wear', cn: '穿' },
  { en: 'cap', cn: '（有帽舌的）帽子' }, { en: 'T-shirt', cn: 'T恤' },
  { en: 'trousers', cn: '裤子' }, { en: 'sock', cn: '袜子' },
  { en: 'shiny', cn: '有光泽的' }, { en: 'shoe', cn: '鞋' },
  { en: 'dress', cn: '连衣裙' }, { en: 'sweater', cn: '毛线衣' },
  { en: 'skirt', cn: '半身裙' }, { en: 'shirt', cn: '衬衫' },
  { en: 'coat', cn: '外套' }, { en: 'shorts', cn: '短裤' },
  { en: 'king', cn: '国王' }, { en: 'want', cn: '想要' },
  { en: 'beautiful', cn: '美丽的' }, { en: 'make', cn: '做' },
  { en: 'magic', cn: '神奇的' }, { en: 'people', cn: '人' },
  { en: 'them', cn: '它们' }, { en: 'after', cn: '在……后' },
  { en: 'month', cn: '一个月；月' }, { en: 'try', cn: '试' },
  { en: 'try sth on', cn: '试穿' }, { en: 'why', cn: '为什么' },
  { en: 'wonderful', cn: '令人惊叹的' }, { en: 'most', cn: '最' },
  { en: 'any', cn: '任何的' }, { en: 'or', cn: '或' },
  { en: 'fox', cn: '狐狸' }, { en: 'monkey', cn: '猴子' },
  { en: 'tell', cn: '告诉；说出' }, { en: 'truth', cn: '真相' },
  { en: 'wash', cn: '洗' }, { en: 'hang', cn: '悬挂' },
  { en: 'hat', cn: '帽子' }, { en: 'jeans', cn: '牛仔裤' },
  { en: 'boot', cn: '靴子' }, { en: 'robe', cn: '长袍' }
];

const G3B_U4 = [
  { en: 'rain', cn: '雨' }, { en: 'sun', cn: '阳光' },
  { en: 'rainy', cn: '多雨的' }, { en: 'run', cn: '跑' },
  { en: 'windy', cn: '多风的' }, { en: 'fly', cn: '放飞' },
  { en: 'kite', cn: '风筝' }, { en: 'park', cn: '公园' },
  { en: 'hot', cn: '炎热的' }, { en: 'sunny', cn: '阳光充足的' },
  { en: 'swim', cn: '游泳' }, { en: 'water', cn: '水' },
  { en: 'cold', cn: '寒冷的' }, { en: 'snowy', cn: '多雪的' },
  { en: 'throw', cn: '投，扔' }, { en: 'snowball', cn: '雪球' },
  { en: 'umbrella', cn: '雨伞' }, { en: 'warm', cn: '保暖的' },
  { en: 'music', cn: '音乐' }, { en: 'weather', cn: '天气' },
  { en: 'bookshop', cn: '书店' }, { en: 'wait', cn: '等' },
  { en: 'wet', cn: '湿的' }, { en: 'again', cn: '又' },
  { en: 'dry', cn: '干燥的' }, { en: 'sell', cn: '卖' },
  { en: 'these', cn: 'this 的复数形式' }, { en: 'idea', cn: '主意' },
  { en: 'club', cn: '俱乐部' }, { en: 'welcome', cn: '欢迎' },
  { en: 'stand', cn: '站立' }, { en: 'board', cn: '公告牌' },
  { en: 'walk', cn: '走' }, { en: 'carefully', cn: '小心地' },
  { en: 'tree', cn: '树' }, { en: 'spring', cn: '春天' },
  { en: 'summer', cn: '夏天' }, { en: 'autumn', cn: '秋天' },
  { en: 'winter', cn: '冬天' }, { en: 'season', cn: '季节' },
  { en: 'drawing', cn: '图画' }, { en: 'cloudy', cn: '多云的' }
];

const G3B_U5 = [
  { en: 'week', cn: '星期' }, { en: 'Monday', cn: '星期一' },
  { en: 'Tuesday', cn: '星期二' }, { en: 'Wednesday', cn: '星期三' },
  { en: 'Thursday', cn: '星期四' }, { en: 'Friday', cn: '星期五' },
  { en: 'Saturday', cn: '星期六' }, { en: 'Sunday', cn: '星期日' },
  { en: 'before', cn: '在……以前' }, { en: 'room', cn: '房间' },
  { en: 'close', cn: '关，闭合' }, { en: 'much', cn: '非常' },
  { en: 'of course', cn: '当然' }, { en: 'rabbit', cn: '兔' },
  { en: 'cat', cn: '猫' }, { en: 'fish', cn: '鱼' },
  { en: 'busy', cn: '忙碌的' }, { en: 'every', cn: '每一个' },
  { en: 'cooking', cn: '做饭' }, { en: 'cook', cn: '烹调' },
  { en: 'Chinese', cn: '中国的' }, { en: 'chess', cn: '国际象棋' },
  { en: 'Chinese chess', cn: '中国象棋' }, { en: 'study', cn: '学习' },
  { en: 'basketball', cn: '篮球' }, { en: 'activity', cn: '活动' }
];

const G3B_U6 = [
  { en: 'apple', cn: '苹果' }, { en: 'egg', cn: '鸡蛋' },
  { en: 'bread', cn: '面包' }, { en: 'milk', cn: '奶' },
  { en: 'rice', cn: '米；米饭' }, { en: 'tomato', cn: '西红柿' },
  { en: 'juice', cn: '果汁' }, { en: 'candy', cn: '糖果' },
  { en: 'ice', cn: '冰' }, { en: 'cream', cn: '奶油' },
  { en: 'ice cream', cn: '冰激凌' }, { en: 'chicken', cn: '鸡肉' },
  { en: 'noodles', cn: '面条' }, { en: 'banana', cn: '香蕉' },
  { en: 'dinner', cn: '正餐' }, { en: 'parent', cn: '父，母' },
  { en: 'dish', cn: '一道菜' }, { en: 'meat', cn: '肉' },
  { en: 'mushroom', cn: '蘑菇' }, { en: 'potato', cn: '土豆' },
  { en: 'eggplant', cn: '茄子' }, { en: 'food', cn: '食物' },
  { en: 'amazing', cn: '惊人的' }, { en: 'say', cn: '说' },
  { en: 'grape', cn: '葡萄' }, { en: 'vegetable', cn: '蔬菜' },
  { en: 'soup', cn: '汤' }, { en: 'drink', cn: '饮料' },
  { en: 'need', cn: '需要' }, { en: 'oil', cn: '食用油' },
  { en: 'salt', cn: '盐' }, { en: 'beat', cn: '搅拌，搅打' }
];

// ---------------------------------------------------------------- 四年级下册
const G4B_U1 = [
  { en: 'clock', cn: '（时）钟' }, { en: "two o'clock", cn: '两点钟' },
  { en: 'fifteen', cn: '十五' }, { en: 'half', cn: '半，一半' },
  { en: 'past', cn: '晚于；在……之后' }, { en: 'half past eight', cn: '八点半' },
  { en: 'forty-five', cn: '四十五' }, { en: 'beat the clock', cn: '提前完成' },
  { en: 'life', cn: '生命' }, { en: 'task', cn: '任务' },
  { en: 'hour', cn: '小时' }, { en: 'salad', cn: '蔬菜沙拉' },
  { en: 'evening', cn: '傍晚；晚上' }, { en: 'breakfast', cn: '早餐，早饭' },
  { en: 'activity', cn: '活动' }
];

const G4B_U2 = [
  { en: 'year', cn: '年' }, { en: 'all year round', cn: '全年' },
  { en: 'when', cn: '什么时候' }, { en: 'January', cn: '一月' },
  { en: 'February', cn: '二月' }, { en: 'March', cn: '三月' },
  { en: 'April', cn: '四月' }, { en: 'May', cn: '五月' },
  { en: 'June', cn: '六月' }, { en: 'July', cn: '七月' },
  { en: 'August', cn: '八月' }, { en: 'September', cn: '九月' },
  { en: 'October', cn: '十月' }, { en: 'November', cn: '十一月' },
  { en: 'remember', cn: '记得' }, { en: 'December', cn: '十二月' },
  { en: 'swallow', cn: '燕子' }, { en: 'lunchtime', cn: '午餐时间' },
  { en: 'baby', cn: '雏鸟' }, { en: 'art', cn: '美术，艺术' },
  { en: 'lesson', cn: '课；课程' }, { en: 'photo', cn: '照片，相片' },
  { en: 'move', cn: '迁移' }, { en: 'the south', cn: '南方，南部' }
];

const G4B_U3 = [
  { en: 'bookshelf', cn: '书架' }, { en: 'lamp', cn: '灯' },
  { en: 'sofa', cn: '长沙发' }, { en: 'table', cn: '桌子' },
  { en: 'bed', cn: '床' }, { en: 'leave', cn: '把……留在某处' },
  { en: 'bag', cn: '袋；包' }, { en: 'cup', cn: '杯子' },
  { en: 'kitchen', cn: '厨房' }, { en: 'living room', cn: '起居室，客厅' },
  { en: 'bathroom', cn: '浴室，卫生间' }, { en: 'bedroom', cn: '卧室' },
  { en: 'tidy', cn: '使整洁，整理，收拾' }
];

const G4B_U4 = [
  { en: 'car', cn: '汽车' }, { en: 'different', cn: '不同的，有差异的' },
  { en: 'together', cn: '一起' }, { en: 'maybe', cn: '也许，大概' },
  { en: 'anymore', cn: '而今再也' }, { en: 'both', cn: '两者，双方' },
  { en: 'phone', cn: '电话' }, { en: 'gift', cn: '礼物' },
  { en: 'will', cn: '将，会' }, { en: 'indeed', cn: '真正地' },
  { en: 'friendly', cn: '友好的，友善的' }
];

const G4B_U5 = [
  { en: 'trip', cn: '旅行，出行' }, { en: 'history', cn: '历史' },
  { en: 'plant', cn: '植物' }, { en: 'museum', cn: '博物馆' },
  { en: 'forest', cn: '森林，林区' }, { en: 'last', cn: '最后的' },
  { en: 'shopping', cn: '购物' }, { en: 'soon', cn: '不久，很快' },
  { en: 'note', cn: '笔记，记录' }, { en: 'beech', cn: '山毛榉' },
  { en: 'lark', cn: '百灵鸟' }, { en: 'letter', cn: '信' },
  { en: 'newspaper', cn: '报社' }, { en: 'nature', cn: '大自然，自然界' },
  { en: 'reserve', cn: '（野生生物）保护区' }, { en: 'nature reserve', cn: '自然保护区' },
  { en: 'beach', cn: '海滩，沙滩' }, { en: 'off', cn: '不在（某物）上面' },
  { en: 'running', cn: '跑，跑步' }, { en: 'playground', cn: '（学校的）操场' },
  { en: 'library', cn: '图书馆' }, { en: 'hill', cn: '小山' },
  { en: 'watch', cn: '观看；观察' }, { en: 'rule', cn: '规则，规定' },
  { en: 'follow', cn: '遵循' }
];

const G4B_U6 = [
  { en: 'time', cn: '时光，时日' }, { en: 'super', cn: '极好的，了不起的' },
  { en: 'dance', cn: '跳（舞）' }, { en: 'piano', cn: '钢琴' },
  { en: 'play the piano', cn: '弹钢琴' }, { en: 'sit', cn: '坐' },
  { en: 'singer', cn: '歌手，歌唱家' }, { en: 'snow', cn: '雪' },
  { en: 'snowman', cn: '雪人' }, { en: 'fan', cn: '狂热崇拜者，……迷' }
];

// ---------------------------------------------------------------- 组装
function makeBook(title, chapters) {
  const all = [];
  chapters.forEach((c) => { all.push(...c.words); });
  return { title, chapters, all: { id: 'all', name: '全部章节', words: all } };
}

const G3B = makeBook('三年级下册', [
  { id: 'u1', name: 'Unit 1 · All about feelings', words: G3B_U1 },
  { id: 'u2', name: 'Unit 2 · From head to toe', words: G3B_U2 },
  { id: 'u3', name: 'Unit 3 · Looking good!', words: G3B_U3 },
  { id: 'u4', name: 'Unit 4 · Rain or shine', words: G3B_U4 },
  { id: 'u5', name: 'Unit 5 · Days of the week', words: G3B_U5 },
  { id: 'u6', name: 'Unit 6 · Time to eat!', words: G3B_U6 }
]);

const G4B = makeBook('四年级下册', [
  { id: 'u1', name: 'Unit 1 · Around the clock', words: G4B_U1 },
  { id: 'u2', name: 'Unit 2 · All year round', words: G4B_U2 },
  { id: 'u3', name: "Unit 3 · That's my room", words: G4B_U3 },
  { id: 'u4', name: 'Unit 4 · Friends for life', words: G4B_U4 },
  { id: 'u5', name: 'Unit 5 · A great day out', words: G4B_U5 },
  { id: 'u6', name: 'Unit 6 · Fun times', words: G4B_U6 }
]);

const BOOKS_B34 = { g3b: G3B, g4b: G4B };

module.exports = { BOOKS_B34, G3B, G4B };
