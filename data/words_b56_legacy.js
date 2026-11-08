// data/words_b56_legacy.js
// ⚠️⚠️ 旧版词表，未接入游戏，切勿与现行词库混用 ⚠️⚠️
//
// 这是「外研剑桥 Join In（2013 审定旧版，刘兆义主编）」五/六年级下册词表，
// 与本项目其他词库（2024 国家教材委员会审核通过的新版）不是同一版教材：
//   · 新版五上单元：My school is cool. / School events are fun! / ...
//   · 旧版五下单元：Starter unit Join in again! / A phone call / Life in the Arctic /
//                  Television / In town / On the beach / Adventures
//   · 新版六上单元：Good food, good health / Let's travel! / ...
//   · 旧版六下单元：Starter unit Join us / My cousin and I / Food and health /
//                  Mary's diary / My heroes / I love reading / The world of my dreams
//
// 截至 2026-11，新版（2024 审定）五下、六下预计 2027 春启用，电子课本网
// dzkbw.com 的 Join In 系列仅收录到「五上 2026 秋版 / 六上 2026 秋版」，
// 五下、六下仍是旧版无年份页面（joinin5x / joinin6x）；教习网、教辅资料的
// 五下六下词表也均为旧版内容。为避免把跟孩子课本对不上的单词教出去，
// 本文件只作为「已找到的资料」留存，不加入 data/book_index.js，
// 不生成发音 mp3、不出现在游戏年级选择页。
//
// 待 2027 春新版课本词汇表公开后，请新建 data/words_b56.js 替换本文件，
// 再按 README 的分包流程接入 g5b / g6b。
//
// 数据来源：教习网英语朗读全册单词表（51jiaoxi 五下/六下）、
//           电子课本网 dzkbw.com Join In 旧版五下/六下目录与单词表页。
// 整理自 OCR，个别释义做了精简，专有名词大小写保留原貌。

// ---------------------------------------------------------------- 五年级下册（旧版）
const L_G5B_STARTER = [
  { en: 'alphabet', cn: '字母表' }, { en: 'enjoy', cn: '享受……的乐趣' },
  { en: 'everyone', cn: '每人，人人' }, { en: 'fun', cn: '乐趣' },
  { en: 'head', cn: '头' }, { en: 'hey', cn: '嘿，喂' },
  { en: 'near', cn: '接近，在附近' }, { en: 'notebook', cn: '笔记本' },
  { en: 'school', cn: '学校；上课' }, { en: 'until', cn: '直到……为止' },
  { en: 'ping-pong', cn: '乒乓球' }, { en: 'shake hands', cn: '握手' }
];

const L_G5B_U1 = [
  { en: 'ask', cn: '问，询问' }, { en: 'before', cn: '在……之前' },
  { en: 'call', cn: '呼叫；打电话给' }, { en: 'Easter', cn: '复活节' },
  { en: 'ill', cn: '有病，不舒服' }, { en: 'moment', cn: '片刻，瞬间' },
  { en: 'paint', cn: '用颜料绘画' }, { en: 'programme', cn: '节目；计划' },
  { en: 'something', cn: '某事，某物' }, { en: 'squirrel', cn: '松鼠' },
  { en: 'storybook', cn: '故事书' }, { en: 'website', cn: '网站，网址' },
  { en: 'wrong', cn: '有毛病，不正常' }, { en: 'CD-ROM', cn: '只读光盘' },
  { en: 'do shopping', cn: '购物' }, { en: 'Easter Bunny', cn: '复活节小兔子' },
  { en: 'get', cn: '收到，得到' }, { en: 'mobile phone', cn: '移动电话，手机' },
  { en: 'over there', cn: '在那边' }, { en: 'phone box', cn: '电话亭' },
  { en: 'phone call', cn: '电话' }, { en: 'wait a minute', cn: '等一会儿' },
  { en: 'work', cn: '运转，运行' }, { en: 'See you tomorrow', cn: '明天见' }
];

const L_G5B_U2 = [
  { en: 'Arctic', cn: '北极的' }, { en: 'earth', cn: '地球；大地' },
  { en: 'fishing', cn: '钓鱼，捕鱼' }, { en: 'grandad', cn: '爷爷；外公' },
  { en: 'grandma', cn: '奶奶；外婆' }, { en: 'grandpa', cn: '爷爷；外公' },
  { en: 'hare', cn: '野兔' }, { en: 'hill', cn: '小山，山丘' },
  { en: 'ice', cn: '冰' }, { en: 'lake', cn: '湖，湖泊' },
  { en: 'pull', cn: '拉，拖，拽' }, { en: 'seal', cn: '海豹' },
  { en: 'snow', cn: '雪；下雪' }, { en: 'come to a stop', cn: '停止' },
  { en: 'early', cn: '早期的，初期的' }, { en: 'go fishing', cn: '去钓鱼' },
  { en: 'South Pole', cn: '南极' }, { en: 'will', cn: '将，会' },
  { en: 'North Pole', cn: '北极' }, { en: 'polar bear', cn: '北极熊' },
  { en: 'shopping mall', cn: '大型购物中心' }
];

const L_G5B_U3 = [
  { en: 'detective', cn: '侦探，警探' }, { en: 'different', cn: '不同的' },
  { en: 'interesting', cn: '有趣的' }, { en: 'nature', cn: '自然界，大自然' },
  { en: 'only', cn: '只有，仅仅' }, { en: 'romantic', cn: '浪漫的' },
  { en: 'television', cn: '电视机；电视节目' }, { en: 'telly', cn: '电视机（口语）' },
  { en: 'thousand', cn: '一千' }, { en: 'true', cn: '真实的' },
  { en: 'usually', cn: '通常地' }, { en: 'want', cn: '要，想要' },
  { en: 'while', cn: '当……的时候；一会儿' }, { en: 'call', cn: '名叫，叫做' },
  { en: 'Kung Fu Panda', cn: '功夫熊猫' }, { en: 'science fiction', cn: '科幻小说；科幻电影' },
  { en: 'star', cn: '明星；高手' }, { en: 'sweet', cn: '糖果；甜点' }
];

const L_G5B_U4 = [
  { en: 'ahead', cn: '向前' }, { en: 'beside', cn: '在旁边' },
  { en: 'church', cn: '教堂' }, { en: 'hospital', cn: '医院' },
  { en: 'late', cn: '晚，迟' }, { en: 'left', cn: '左，左边' },
  { en: 'museum', cn: '博物馆' }, { en: 'neighbour', cn: '邻居' },
  { en: 'next', cn: '下一个；接下来' }, { en: 'on', cn: '在……上；关于' },
  { en: 'opposite', cn: '在……的对面' }, { en: 'past', cn: '经过，路过' },
  { en: 'side', cn: '侧面；一方' }, { en: 'straight', cn: '直的，笔直地' },
  { en: 'tell', cn: '告诉' }, { en: 'town', cn: '城镇，市镇' },
  { en: 'bus stop', cn: '公共汽车站' }, { en: 'just', cn: '仅仅，只是' },
  { en: 'next to', cn: '接近，靠近' }, { en: 'police station', cn: '警察（分）局' },
  { en: 'post office', cn: '邮局' }, { en: 'right', cn: '右，右边' },
  { en: 'tourist office', cn: '旅游信息咨询处' }, { en: 'train station', cn: '火车站' },
  { en: 'excuse me', cn: '劳驾；打扰一下' }
];

const L_G5B_U5 = [
  { en: 'badly', cn: '差地；严重地' }, { en: 'blood', cn: '血，血液' },
  { en: 'boat', cn: '小船，舟' }, { en: 'call', cn: '呼叫；打电话给' },
  { en: 'city', cn: '城市' }, { en: 'clear', cn: '清晰的；清澈的' },
  { en: 'cloudy', cn: '阴天的，多云的' }, { en: 'island', cn: '岛' },
  { en: 'most', cn: '大部分，大多数' }, { en: 'nearby', cn: '附近的；在附近' },
  { en: 'rain', cn: '下雨；雨' }, { en: 'rock', cn: '岩石' },
  { en: 'sand', cn: '沙子，沙滩' }, { en: 'snorkel', cn: '（潜水者的）呼吸管' },
  { en: 'snorkelling', cn: '徒手潜水' }, { en: 'starfish', cn: '海星' },
  { en: 'sun', cn: '太阳，阳光' }, { en: 'sunny', cn: '晴朗的' },
  { en: 'too', cn: '太，过于' }, { en: 'tourist', cn: '游客，旅行者' },
  { en: 'windy', cn: '多风的' }, { en: 'baby', cn: '幼兽' },
  { en: "Children's Day", cn: '儿童节' }, { en: 'close', cn: '接近的；关闭' },
  { en: 'come along', cn: '（和某人）一起去' }, { en: 'fine', cn: '晴朗的；健康的' },
  { en: 'hurt', cn: '（使）疼痛；受伤' }, { en: 'jet-ski', cn: '喷气式划艇' },
  { en: 'pass by', cn: '经过' }
];

const L_G5B_U6 = [
  { en: 'adventure', cn: '冒险；冒险经历' }, { en: 'afraid', cn: '担心，害怕' },
  { en: 'age', cn: '年龄' }, { en: 'ago', cn: '以前' },
  { en: 'alone', cn: '单独，独自' }, { en: 'bank', cn: '银行；岸' },
  { en: 'boot', cn: '靴子，长筒靴' }, { en: 'cactus', cn: '仙人掌' },
  { en: 'coat', cn: '外衣，外套' }, { en: 'dark', cn: '黑暗的；深色的' },
  { en: 'ground', cn: '地，地面' }, { en: 'hero', cn: '偶像；英雄' },
  { en: 'pancake', cn: '薄煎饼' }, { en: 'proud', cn: '自豪的，骄傲的' },
  { en: 'ride', cn: '骑；驾驶' }, { en: 'robber', cn: '盗贼，抢劫者' },
  { en: 'sheriff', cn: '县治安官' }, { en: 'short', cn: '矮的；短的' },
  { en: 'soup', cn: '汤' }, { en: 'strong', cn: '强壮的' },
  { en: 'swimmer', cn: '游泳运动员' }, { en: 'thin', cn: '瘦的；薄的' },
  { en: 'worry', cn: '担心，担忧' }, { en: 'be afraid of', cn: '害怕' },
  { en: 'Cowboy hat', cn: '牛仔帽' }, { en: 'good at', cn: '擅长' },
  { en: 'Hands up!', cn: '举起手来！' }, { en: 'horror film', cn: '恐怖片' },
  { en: 'hot', cn: '辣的；热的' }, { en: 'last', cn: '最后；最终' },
  { en: 'born to', cn: '天生注定' }
];

const L_G5B_SUPP = [
  { en: 'build', cn: '建造，建筑' }, { en: 'butter', cn: '黄油，奶油' },
  { en: 'childish', cn: '幼稚的' }, { en: 'daughter', cn: '女儿' },
  { en: 'drink', cn: '喝；饮料' }, { en: 'really', cn: '真的，的确' },
  { en: 'quite a lot', cn: '许多' }, { en: 'sand castle', cn: '沙堡' }
];

// ---------------------------------------------------------------- 六年级下册（旧版）
const L_G6B_STARTER = [
  { en: 'blink', cn: '眨（眼）' }, { en: 'boss', cn: '老板；上司' },
  { en: 'cowboy', cn: '牛仔' }, { en: 'pilot', cn: '飞行员；驾驶员' },
  { en: 'pm', cn: '下午' }, { en: 'pony', cn: '小马' },
  { en: 'spacecraft', cn: '宇宙飞船，航天器' }, { en: 'supersonic', cn: '超音速的' },
  { en: 'for now', cn: '目前，暂时' }, { en: 'really', cn: '确实，的确' }
];

const L_G6B_U1 = [
  { en: 'auntie', cn: '姑妈；姨妈；婶婶' }, { en: 'Australian', cn: '澳大利亚的；澳大利亚人' },
  { en: 'baby', cn: '婴儿；动物幼崽' }, { en: 'Canberra', cn: '堪培拉' },
  { en: 'climb', cn: '攀爬，攀登' }, { en: 'fact', cn: '事实，真相' },
  { en: 'friendly', cn: '友好的' }, { en: 'koala', cn: '考拉' },
  { en: 'little', cn: '小的' }, { en: 'outgoing', cn: '外向的，开朗的' },
  { en: 'sixth', cn: '第六' }, { en: 'tail', cn: '尾巴' },
  { en: 'Australia Day', cn: '澳大利亚国庆节' }, { en: 'Spring Festival', cn: '春节' }
];

const L_G6B_U2 = [
  { en: 'active', cn: '积极的，活跃的' }, { en: 'celery', cn: '芹菜' },
  { en: 'cherry', cn: '樱桃' }, { en: 'glass', cn: '玻璃；玻璃杯' },
  { en: 'habit', cn: '习惯' }, { en: 'health', cn: '健康（状况）' },
  { en: 'healthy', cn: '健康的' }, { en: 'memory', cn: '记忆力；回忆' },
  { en: 'own', cn: '自己的；拥有' }, { en: 'protein', cn: '蛋白质' },
  { en: 'sugar', cn: '食糖，糖' }, { en: 'corn-on-the-cob', cn: '玉米棒子' },
  { en: 'fit', cn: '健壮的，健康的' }, { en: 'kind', cn: '种类；友好的' },
  { en: 'not...at all', cn: '一点也不' }, { en: 'stay', cn: '保持' },
  { en: 'warm', cn: '热情的，热忱的' }, { en: 'weight', cn: '体重；重量' },
  { en: 'look after', cn: '照顾，照料' }, { en: 'plenty of', cn: '大量的，许多' },
  { en: 'string bean', cn: '菜豆' }, { en: 'whole grains', cn: '天然谷物' }
];

const L_G6B_U3 = [
  { en: 'diary', cn: '日记；日记簿' }, { en: 'difficult', cn: '困难的' },
  { en: 'flavour', cn: '味道，风味' }, { en: 'gentleman', cn: '先生；男士' },
  { en: 'horrible', cn: '糟糕的，可怕的' }, { en: 'lady', cn: '女士；夫人' },
  { en: 'rope', cn: '绳子，绳索' }, { en: 'saying', cn: '格言，谚语' },
  { en: 'share', cn: '分享，共用' }, { en: 'show', cn: '演出，秀' },
  { en: 'strawberry', cn: '草莓' }, { en: 'tour', cn: '参观，游览' },
  { en: 'vanilla', cn: '香草精' }, { en: 'guide', cn: '导游，向导' }
];

const L_G6B_U4 = [
  { en: 'almost', cn: '几乎，差不多' }, { en: 'around', cn: '遍及；围绕' },
  { en: 'blind', cn: '瞎的，失明的' }, { en: 'brave', cn: '勇敢的' },
  { en: 'camp', cn: '野营，度假' }, { en: 'college', cn: '学院；大学' },
  { en: 'confident', cn: '自信的' }, { en: 'dead', cn: '死的' },
  { en: 'deer', cn: '鹿' }, { en: 'die', cn: '死，死亡' },
  { en: 'everything', cn: '每件事，一切' }, { en: 'fight', cn: '争论；打仗' },
  { en: 'footballer', cn: '足球运动员' }, { en: 'forest', cn: '森林' },
  { en: 'heart', cn: '心，内心；心脏' }, { en: 'king', cn: '国王，君主' },
  { en: 'Nottingham', cn: '诺丁汉' }, { en: 'shy', cn: '害羞的' },
  { en: 'soldier', cn: '士兵，战士' }, { en: 'wise', cn: '有智慧的' },
  { en: 'woman', cn: '成年女子，妇女' }, { en: 'writer', cn: '作家，作者' },
  { en: 'young', cn: '年轻的' }, { en: 'hold on', cn: '紧紧抓住' },
  { en: 'leave', cn: '把……留在某处' }, { en: 'move', cn: '打动，使感动' },
  { en: 'the poor', cn: '穷人' }, { en: 'hybrid rice', cn: '杂交水稻' }
];

const L_G6B_U5 = [
  { en: 'bookworm', cn: '书虫，书呆子' }, { en: 'California', cn: '加利福尼亚州' },
  { en: 'celebrate', cn: '庆祝，庆贺' }, { en: 'competition', cn: '竞赛，比赛' },
  { en: 'heroine', cn: '女主人公' }, { en: 'hood', cn: '风帽' },
  { en: 'joy', cn: '愉快，欢乐' }, { en: 'nonsense', cn: '胡说' },
  { en: 'read', cn: '看；读，阅读' }, { en: 'rest', cn: '休息；其余' },
  { en: 'shock', cn: '吃惊，震惊' }, { en: 'Spiderman', cn: '蜘蛛侠' },
  { en: 'trick', cn: '计谋；恶作剧' }, { en: 'win', cn: '获胜，赢得' },
  { en: 'Sherwood Forest', cn: '舍伍德森林' }
];

const L_G6B_U6 = [
  { en: 'dangerous', cn: '危险的' }, { en: 'enough', cn: '足够地，充分地' },
  { en: 'glad', cn: '高兴的，快乐的' }, { en: 'ocean', cn: '海洋' },
  { en: 'owl', cn: '猫头鹰' }, { en: 'robot', cn: '机器人' },
  { en: 'situation', cn: '形势，情况' }, { en: 'sure', cn: '当然；确信' },
  { en: 'every now and then', cn: '偶尔，有时' }, { en: 'wish', cn: '愿望；祝愿' }
];

const L_G6B_SUPP = [
  { en: 'become', cn: '开始变得，变成' }, { en: 'colourful', cn: '颜色鲜艳的' },
  { en: 'Edinburgh', cn: '爱丁堡' }, { en: 'Glasgow', cn: '格拉斯哥' },
  { en: 'goldfish', cn: '金鱼' }, { en: 'gun', cn: '枪，炮' },
  { en: 'hiding', cn: '藏匿，躲藏' }, { en: 'Nessie', cn: '尼斯湖水怪' },
  { en: 'painting', cn: '（一幅）画；绘画作品' },
  { en: 'Dunvegan Castle', cn: '邓韦根城堡' }, { en: 'Loch Ness', cn: '尼斯湖' }
];

// ---------------------------------------------------------------- 组装
function makeBook(title, chapters) {
  const all = [];
  chapters.forEach((c) => { all.push(...c.words); });
  return { title, chapters, all: { id: 'all', name: '全部章节', words: all } };
}

const G5B_LEGACY = makeBook('五年级下册（旧版）', [
  { id: 'starter', name: 'Starter unit · Join in again!', words: L_G5B_STARTER },
  { id: 'u1', name: 'Unit 1 · A phone call', words: L_G5B_U1 },
  { id: 'u2', name: 'Unit 2 · Life in the Arctic', words: L_G5B_U2 },
  { id: 'u3', name: 'Unit 3 · Television', words: L_G5B_U3 },
  { id: 'u4', name: 'Unit 4 · In town', words: L_G5B_U4 },
  { id: 'u5', name: 'Unit 5 · On the beach', words: L_G5B_U5 },
  { id: 'u6', name: 'Unit 6 · Adventures', words: L_G5B_U6 },
  { id: 'supp', name: 'Supplementary activities', words: L_G5B_SUPP }
]);

const G6B_LEGACY = makeBook('六年级下册（旧版）', [
  { id: 'starter', name: 'Starter unit · Join us', words: L_G6B_STARTER },
  { id: 'u1', name: 'Unit 1 · My cousin and I', words: L_G6B_U1 },
  { id: 'u2', name: 'Unit 2 · Food and health', words: L_G6B_U2 },
  { id: 'u3', name: "Unit 3 · Mary's diary", words: L_G6B_U3 },
  { id: 'u4', name: 'Unit 4 · My heroes', words: L_G6B_U4 },
  { id: 'u5', name: 'Unit 5 · I love reading', words: L_G6B_U5 },
  { id: 'u6', name: 'Unit 6 · The world of my dreams', words: L_G6B_U6 },
  { id: 'supp', name: 'Supplementary activities', words: L_G6B_SUPP }
]);

const BOOKS_B56_LEGACY = { g5b: G5B_LEGACY, g6b: G6B_LEGACY };

module.exports = { BOOKS_B56_LEGACY, G5B_LEGACY, G6B_LEGACY };
