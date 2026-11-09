// Copyright (c) 2026 zhangyongpo. SPDX-License-Identifier: Apache-2.0
// 本文件为 letterdrop-wx 项目独立开发源码；许可证见 LICENSE，第三方资产声明见 NOTICE.md。
// data/words_g456.js
// 外研剑桥《Join In》（三年级起点，2024 国家教材委员会审核通过）四/五/六年级上册词表。
// 与封面照片及现有 data/words.js（三上）为同一套教材的后续册次：
//   四上：2025 秋版   五上：2026 秋版   六上：2026 秋版
// 教育部《2024 年义务教育国家课程教学用书目录》中该系列（刘兆义主编，外研社）
// 为「三年级上册至六年级下册」整套送审，故三册均属同版本。
//
// 数据来源（公开网络资料，课本 Words and expressions / Vocabulary 页 OCR 整理）：
//   四上：2025 秋外研剑桥 Join in 四上单词表（教英语的 Jessica）、左手英语四上词表
//   五上：2026 年秋外研剑桥 Join in 五上单词表（教英语的 Jessica）、音标对照版全册词表
//   六上：2026 外研剑桥 Join In 六上全册单词表（教习网英语朗读）、26 秋六上知识清单/课件
//   目录核对：电子课本网 dzkbw.com 外研版 Join In 各册电子课本目录
//
// ⚠️ 整理自 OCR，接入前建议对照纸质课本词汇表页核一遍（尤其六上 Unit 4：
//    源资料该单元仅 12 词，明显少于其他单元，疑似抓取不全）。
// ⚠️ 含空格的短语（如 on top of the world / ice hockey）不适合逐字母拼写，
//    与三上词库一样保留释义供「全部单词查阅」，由 game.js 过滤，不进拼写练习。
// ⚠️ 本文件只是词表数据，尚未接入 game.js / audio.js / word_audio.js，也未生成发音 mp3。

// ---------------------------------------------------------------- 四年级上册
const G4_U1 = [
  { en: 'report', cn: '报告，汇报' }, { en: 'wheelchair', cn: '轮椅' },
  { en: 'star', cn: '明星，名角' }, { en: 'far', cn: '远' },
  { en: 'ping-pong', cn: '乒乓球运动' }, { en: 'from', cn: '来自' },
  { en: 'band', cn: '圈，箍，带' }, { en: 'very', cn: '很，非常' },
  { en: 'fast', cn: '快地，快速地' }, { en: 'sure', cn: '肯定的，确信的' },
  { en: 'hurt', cn: '感到疼痛' }, { en: 'think', cn: '想，思考' },
  { en: 'really', cn: '真的' }, { en: 'wind', cn: '风' },
  { en: 'ride', cn: '骑，骑自行车' }, { en: 'kick', cn: '踢' }
];

const G4_U2 = [
  { en: 'town', cn: '镇，城镇' }, { en: 'train', cn: '火车，列车' },
  { en: 'station', cn: '车站；所；局' }, { en: 'train station', cn: '火车站' },
  { en: 'supermarket', cn: '超市' }, { en: 'cinema', cn: '电影院' },
  { en: 'bus', cn: '公交车' }, { en: 'stop', cn: '车站' },
  { en: 'bus stop', cn: '公交车站' }, { en: 'hospital', cn: '医院' },
  { en: 'police', cn: '警察' }, { en: 'police station', cn: '派出所' },
  { en: 'shop', cn: '商店' }, { en: 'street', cn: '大街，街道' },
  { en: 'live', cn: '住，居住' }, { en: 'place', cn: '地方，地点' },
  { en: 'near', cn: '接近，靠近' }, { en: 'map', cn: '地图' },
  { en: 'first', cn: '先，首先' }, { en: 'left', cn: '向左，朝左' },
  { en: 'then', cn: '接下来，然后' }, { en: 'straight', cn: '笔直地' },
  { en: 'turn', cn: '转弯；改变方向' }, { en: 'there', cn: '在那里' },
  { en: 'surprise', cn: '意想不到的事' }, { en: 'restaurant', cn: '饭店，餐馆' },
  { en: 'excuse me', cn: '劳驾' }, { en: 'way', cn: '路，道路' },
  { en: 'us', cn: '我们' }, { en: 'thanks', cn: '谢谢你，多谢' },
  { en: 'buy', cn: '买，购买' }, { en: 'our', cn: '我们的' },
  { en: 'writer', cn: '作家，作者' }, { en: 'often', cn: '经常，时常' }
];

const G4_U3 = [
  { en: 'everyone', cn: '每个人，人人' }, { en: 'work', cn: '工作，干活' },
  { en: 'hard', cn: '费劲地；努力地' }, { en: 'teacher', cn: '教师' },
  { en: 'driver', cn: '司机，驾驶员' }, { en: 'firefighter', cn: '消防队员' },
  { en: 'policeman', cn: '男警察' }, { en: 'worker', cn: '工作人员' },
  { en: 'doctor', cn: '医生' }, { en: 'nurse', cn: '护士' },
  { en: 'scientist', cn: '科学家' }, { en: 'gardener', cn: '园丁，花匠' },
  { en: 'cleaner', cn: '清洁工人' }, { en: 'grow', cn: '种植' },
  { en: 'taxi', cn: '出租车' }, { en: 'drive', cn: '驾车送（人）' },
  { en: 'around', cn: '到处，四处' }, { en: 'farmer', cn: '农民' },
  { en: 'science', cn: '科学' }, { en: 'ask', cn: '问，提问' },
  { en: 'question', cn: '问题，疑问' }, { en: 'astronaut', cn: '宇航员' },
  { en: 'learn', cn: '学习；学到' }, { en: 'space', cn: '太空' },
  { en: 'moon', cn: '月亮，月球' }, { en: 'because', cn: '因为' },
  { en: 'teach', cn: '教授，讲授' }, { en: 'sick', cn: '生病的' },
  { en: 'centre', cn: '中心' }, { en: 'shape', cn: '形状，外形' },
  { en: 'tall', cn: '高的，高大的' }, { en: 'strong', cn: '强健的，健壮的' },
  { en: 'prepare', cn: '准备' }, { en: 'kind', cn: '种，类' },
  { en: 'dream job', cn: '梦想中的工作' }, { en: 'healthy', cn: '健康的' },
  { en: 'house', cn: '房屋，房子' }, { en: 'fire', cn: '火；火灾' },
  { en: 'team', cn: '工作队，工作组' }, { en: 'animal', cn: '动物' },
  { en: 'panda', cn: '大熊猫' }, { en: 'keeper', cn: '饲养员' },
  { en: 'zookeeper', cn: '动物园饲养员' }, { en: 'bee', cn: '蜜蜂' }
];

const G4_U4 = [
  { en: 'hundred', cn: '一百' }, { en: 'forty-three', cn: '四十三' },
  { en: 'fifty', cn: '五十' }, { en: 'thirty-three', cn: '三十三' },
  { en: 'forty-four', cn: '四十四' }, { en: 'thirteen', cn: '十三' },
  { en: 'seventy', cn: '七十' }, { en: 'eleven', cn: '十一' },
  { en: 'thirty', cn: '三十' }, { en: 'eighteen', cn: '十八' },
  { en: 'eighty', cn: '八十' }, { en: 'nineteen', cn: '十九' },
  { en: 'sixteen', cn: '十六' }, { en: 'sixty-six', cn: '六十六' },
  { en: 'twenty', cn: '二十' }, { en: 'twelve', cn: '十二' },
  { en: 'flea market', cn: '跳蚤市场' }, { en: 'early', cn: '在早期' },
  { en: 'skateboard', cn: '滑板' }, { en: 'noon', cn: '正午，中午' },
  { en: 'yuan', cn: '元' }, { en: 'skateboarding', cn: '滑板运动' },
  { en: 'friend', cn: '朋友' }, { en: 'bakery', cn: '面包店' },
  { en: 'carrot', cn: '胡萝卜' }, { en: 'flower', cn: '花，花朵' },
  { en: 'toy', cn: '玩具' }, { en: 'pair', cn: '一双，一对' },
  { en: 'give', cn: '赠送，给予' }, { en: 'spend', cn: '花费' },
  { en: 'box', cn: '盒；箱' }, { en: 'use', cn: '使用' },
  { en: 'save', cn: '储蓄，存（钱）' }, { en: 'holiday', cn: '假期' },
  { en: 'share', cn: '共享' }, { en: 'money', cn: '钱' },
  { en: 'should', cn: '应当，应该' }
];

const G4_U5 = [
  { en: 'chocolate', cn: '巧克力' }, { en: 'triangle', cn: '三角形' },
  { en: 'circle', cn: '圆（形）' }, { en: 'rectangle', cn: '长方形，矩形' },
  { en: 'square', cn: '正方形' }, { en: 'into', cn: '进入，到……里面' },
  { en: 'tummy', cn: '肚子' }, { en: 'yummy', cn: '美味的' },
  { en: 'wheel', cn: '车轮' }, { en: 'another', cn: '另一，又一' },
  { en: 'a lot', cn: '大量，许多' }, { en: 'its', cn: '它的' },
  { en: 'line', cn: '线，线条' }
];

const G4_U6 = [
  { en: 'zoo', cn: '动物园' }, { en: 'sky', cn: '天，天空' },
  { en: 'neck', cn: '颈，脖子' }, { en: 'brave', cn: '勇敢的' },
  { en: 'heavy', cn: '重的' }, { en: 'giraffe', cn: '长颈鹿' },
  { en: 'lion', cn: '狮子' }, { en: 'elephant', cn: '象' },
  { en: 'horse', cn: '马' }, { en: 'pig', cn: '猪' },
  { en: 'sheep', cn: '羊，绵羊' }, { en: 'cow', cn: '牛，奶牛' },
  { en: 'climb', cn: '攀登，爬' }, { en: 'slow', cn: '慢的' },
  { en: 'perfect', cn: '完美的' }, { en: 'talk', cn: '说话' },
  { en: 'pet', cn: '宠物' }, { en: 'animal shelter', cn: '动物收容所' },
  { en: 'boy', cn: '男孩' }, { en: 'girl', cn: '女孩' },
  { en: 'hamster', cn: '仓鼠' }, { en: 'cute', cn: '漂亮的，可爱的' },
  { en: 'parrot', cn: '鹦鹉' }, { en: 'grass', cn: '草，青草' },
  { en: 'farm', cn: '农场' }, { en: 'tail', cn: '尾巴' },
  { en: 'catch', cn: '接住' }
];

const G4_PLAYS = [
  { en: 'city', cn: '城市' }, { en: 'party', cn: '聚会，宴会' },
  { en: 'gift', cn: '礼物' }, { en: 'address', cn: '地址' },
  { en: 'snow', cn: '雪' }, { en: 'knock', cn: '敲（门、窗）' },
  { en: 'wolf', cn: '狼' }, { en: 'paw', cn: '（动物的）爪子' },
  { en: 'bag', cn: '袋；包' }, { en: 'story', cn: '故事' },
  { en: 'tie', cn: '把……系起来' }, { en: 'never', cn: '决不，永不' },
  { en: 'trust', cn: '信任，信赖' }, { en: 'bad', cn: '坏的' },
  { en: 'hunter', cn: '猎人' }, { en: 'guy', cn: '家伙' },
  { en: 'life', cn: '生命' }
];

// ---------------------------------------------------------------- 五年级上册
const G5_U1 = [
  { en: 'toilet', cn: '厕所，洗手间' }, { en: 'computer', cn: '计算机，电脑' },
  { en: 'mountain', cn: '高山，山岳' }, { en: 'thin', cn: '（身体）瘦的' },
  { en: 'team', cn: '（比赛）队' }, { en: 'musical', cn: '音乐的' },
  { en: 'instrument', cn: '乐器' }, { en: 'musical instrument', cn: '乐器' },
  { en: 'bring', cn: '带来' }, { en: 'painting', cn: '绘画（作品）' },
  { en: 'subject', cn: '学科，科目' }, { en: 'maths', cn: '数学' },
  { en: 'also', cn: '还' }, { en: 'deaf', cn: '耳聋的，失聪的' },
  { en: 'student', cn: '学生，学员' }, { en: 'hear', cn: '听到，听见' },
  { en: 'always', cn: '总是，一直' }, { en: 'interesting', cn: '有趣的' },
  { en: 'drama', cn: '戏剧' }, { en: 'play', cn: '剧本；戏剧' },
  { en: 'Mrs', cn: '夫人，太太' }, { en: 'PE', cn: '体育课' }
];

const G5_U2 = [
  { en: 'match', cn: '体育比赛' }, { en: 'festival', cn: '节，节庆' },
  { en: 'fancy', cn: '花哨的；别致的' }, { en: 'party', cn: '聚会，宴会' },
  { en: 'lantern', cn: '提灯；灯笼' }, { en: 'wish', cn: '祝愿' },
  { en: 'writing', cn: '用以写的' }, { en: 'brush', cn: '毛笔' },
  { en: 'dragon', cn: '龙' }, { en: 'boat', cn: '小船，小舟' },
  { en: 'first', cn: '第一（位）的' }, { en: 'whose', cn: '谁的' },
  { en: 'story', cn: '故事，小说' }, { en: 'storyteller', cn: '讲故事的人' }
];

const G5_U3 = [
  { en: 'polar', cn: '极地的' }, { en: 'bear', cn: '熊' },
  { en: 'polar bear', cn: '北极熊' }, { en: 'most', cn: '大多数，大部分' },
  { en: 'penguin', cn: '企鹅' }, { en: 'skin', cn: '（动物的）皮' },
  { en: 'north', cn: '北方的，北部的' }, { en: 'middle', cn: '中间，中央' },
  { en: 'land', cn: '陆地' }, { en: 'ocean', cn: '海洋，大海' },
  { en: 'which', cn: '哪一个' }, { en: 'earth', cn: '地球' },
  { en: 'fresh water', cn: '淡水' }, { en: 'TV', cn: '电视' },
  { en: 'wake', cn: '睡醒，醒来' }, { en: 'wake up', cn: '醒，醒来' },
  { en: 'lunch', cn: '午餐' }, { en: 'fishing', cn: '钓鱼；捕鱼' },
  { en: 'real', cn: '真的，真正的' }, { en: 'visit', cn: '参观，游览' },
  { en: 'end', cn: '尽头；末端' }, { en: 'on top of the world', cn: '极其高兴的' },
  { en: 'whale', cn: '鲸' }, { en: 'northern', cn: '北部的' },
  { en: 'light', cn: '光，光线' }, { en: 'guide', cn: '导游，向导' },
  { en: 'sunshine', cn: '阳光，日照' }, { en: 'igloo', cn: '冰屋' },
  { en: 'less', cn: '更少，较少' }, { en: 'energy', cn: '能源' },
  { en: 'reuse', cn: '再使用，重复使用' }
];

const G5_U4 = [
  { en: 'sea', cn: '海洋' }, { en: 'everybody', cn: '每个人，人人' },
  { en: 'seal', cn: '海豹' }, { en: 'snorkelling', cn: '浮潜' },
  { en: 'jet ski', cn: '喷气式滑艇' }, { en: 'blood', cn: '血，血液' },
  { en: 'badly', cn: '严重地，厉害地' }, { en: 'man', cn: '成年男子，男人' },
  { en: 'woman', cn: '成年女子，妇女' }, { en: 'sand', cn: '沙滩；沙子' },
  { en: 'shell', cn: '贝壳' }, { en: 'dirty', cn: '脏的' },
  { en: 'turtle', cn: '海龟' }, { en: 'plastic', cn: '塑料' },
  { en: 'die', cn: '死去，死亡' }, { en: 'coral', cn: '珊瑚' },
  { en: 'reef', cn: '礁' }, { en: 'coral reef', cn: '珊瑚礁' },
  { en: 'choose', cn: '挑选，选择' }, { en: 'sentence', cn: '句子' },
  { en: 'poster', cn: '海报' }, { en: 'rubbish', cn: '垃圾，废弃物' }
];

const G5_U5 = [
  { en: 'assistant', cn: '助手，助理' }, { en: 'teen', cn: '（青）少年' },
  { en: 'knock', cn: '敲（门、窗）' }, { en: 'must', cn: '必须' },
  { en: 'answer', cn: '答案' }, { en: 'key', cn: '钥匙' },
  { en: 'detective', cn: '侦探' }, { en: 'problem', cn: '问题，难题' },
  { en: 'hole', cn: '洞' }, { en: 'deep', cn: '深的' },
  { en: 'other', cn: '其余的，另外的' }, { en: 'diary', cn: '日记' },
  { en: 'something', cn: '某物；某事' }, { en: 'complete', cn: '完成' },
  { en: 'card', cn: '卡片' }
];

const G5_U6 = [
  { en: 'thief', cn: '小偷，贼' }, { en: 'could', cn: '能，会（can 的过去式）' },
  { en: 'ladder', cn: '梯子' }, { en: 'mooncake', cn: '月饼' },
  { en: 'forget', cn: '忘记，遗忘' }, { en: 'celebrate', cn: '庆祝' },
  { en: 'outside', cn: '在室外' }, { en: 'suddenly', cn: '突然' },
  { en: 'lunar', cn: '阴历的' }, { en: 'smile', cn: '微笑' },
  { en: 'ago', cn: '以前' }
];

const G5_PLAYS = [
  { en: 'difficult', cn: '困难的' }, { en: 'wife', cn: '妻子' },
  { en: 'grandchild', cn: '孙子（女）' }, { en: 'god', cn: '神' },
  { en: 'heaven', cn: '天堂' }, { en: 'giant', cn: '巨人' },
  { en: 'break', cn: '使破裂，使破碎' }, { en: 'vat', cn: '大缸' },
  { en: 'hide-and-seek', cn: '捉迷藏' }, { en: 'hide', cn: '把……藏起来' },
  { en: 'push', cn: '推' }, { en: 'stone', cn: '石头' },
  { en: 'monster', cn: '怪兽' }, { en: 'down', cn: '向下（的）' },
  { en: 'noisy', cn: '喧闹的' }, { en: 'plan', cn: '计划' },
  { en: 'torch', cn: '火把；火炬' }, { en: 'firework', cn: '烟火，烟花' },
  { en: 'drum', cn: '鼓' }, { en: 'shine', cn: '闪光，发亮' },
  { en: 'celebration', cn: '庆祝会，庆祝活动' }
];

// ---------------------------------------------------------------- 六年级上册
const G6_U1 = [
  { en: 'health', cn: '健康（状况）' }, { en: 'healthy', cn: '有益健康的' },
  { en: 'bean', cn: '豆' }, { en: 'blueberry', cn: '蓝莓' },
  { en: 'eating', cn: '饮食' }, { en: 'fat', cn: '脂肪' },
  { en: 'sugar', cn: '糖' }, { en: 'biscuit', cn: '饼干' },
  { en: 'unhealthy', cn: '对健康有害的' }, { en: 'sweet', cn: '糖果' },
  { en: 'normal', cn: '平常的' }, { en: 'kcal', cn: '卡（路里）' },
  { en: 'tofu', cn: '豆腐' }, { en: 'auntie', cn: '姑妈；姨妈' },
  { en: 'habit', cn: '习惯' }, { en: 'hamburger', cn: '汉堡包' },
  { en: 'sugary', cn: '含糖的；甜的' }, { en: 'exercise', cn: '运动；锻炼' },
  { en: 'couch', cn: '长沙发' }, { en: 'couch potato', cn: '老泡在电视机前的人' },
  { en: 'cola', cn: '可乐' }, { en: 'stomach', cn: '胃' },
  { en: 'diet', cn: '日常饮食' }, { en: 'yoghurt', cn: '酸奶' }
];

const G6_U2 = [
  { en: 'pack', cn: '（把……）打包' }, { en: 'kangaroo', cn: '袋鼠' },
  { en: 'chip', cn: '马铃薯条' }, { en: 'island', cn: '岛；岛屿' },
  { en: 'secret', cn: '秘密的' }, { en: 'message', cn: '信息' },
  { en: 'thousand', cn: '一千' }, { en: 'maple', cn: '枫树' },
  { en: 'fantastic', cn: '极好的' }, { en: 'collect', cn: '收集' },
  { en: 'arrive', cn: '到达' }, { en: 'hold', cn: '握住；抱住' },
  { en: 'koala', cn: '树袋熊，考拉' }, { en: 'third', cn: '第三个（的）' },
  { en: 'fourth', cn: '第四个（的）' }, { en: 'palace', cn: '王宫；宫殿' },
  { en: 'middle', cn: '中间；中央' }, { en: 'gift', cn: '礼物' },
  { en: 'postcard', cn: '明信片' }
];

const G6_U3 = [
  { en: 'fight', cn: '打斗；斗争' }, { en: 'clean', cn: '弄干净；清洁' },
  { en: 'usually', cn: '通常地' }, { en: 'chimp', cn: '黑猩猩' },
  { en: 'afraid', cn: '害怕的' }, { en: 'lake', cn: '湖；湖泊' },
  { en: 'crane', cn: '鹤' }, { en: 'strange', cn: '奇怪的' },
  { en: 'noise', cn: '噪声' }, { en: 'flood', cn: '洪水；水灾' },
  { en: 'village', cn: '村庄' }, { en: 'age', cn: '年龄段' },
  { en: 'rhino', cn: '犀牛' }, { en: 'kill', cn: '杀死；弄死' },
  { en: 'horn', cn: '（牛、羊的）角' }, { en: 'leopard', cn: '豹' },
  { en: 'fur', cn: '毛皮' }, { en: 'kingfisher', cn: '翠鸟' },
  { en: 'river', cn: '江；河' }, { en: 'include', cn: '将……列为一部分' },
  { en: 'gorilla', cn: '大猩猩' }
];

// ⚠️ 该单元源资料仅收录 12 词，疑似不全，待对照课本 Vocabulary 页补全。
const G6_U4 = [
  { en: 'break', cn: '损坏；失灵' }, { en: 'ring', cn: '鸣响' },
  { en: 'word', cn: '字；词' }, { en: 'yesterday', cn: '昨天' },
  { en: 'spade', cn: '铲；铁锹' }, { en: 'capsule', cn: '胶囊；小容器' },
  { en: 'schoolwork', cn: '功课；作业' }, { en: 'garden', cn: '园艺工作' },
  { en: 'list', cn: '名单；清单' }, { en: 'date', cn: '日期；日子' },
  { en: 'piece', cn: '一张' }, { en: 'village', cn: '乡村' }
];

const G6_U5 = [
  { en: 'powerful', cn: '强烈的；有力的' }, { en: 'cover', cn: '盖；覆盖' },
  { en: 'heavily', cn: '大量地' }, { en: 'smoke', cn: '烟' },
  { en: 'snowstorm', cn: '雪暴；暴风雪' }, { en: 'volcanic', cn: '火山的' },
  { en: 'eruption', cn: '爆发' }, { en: 'tsunami', cn: '海啸' },
  { en: 'hurricane', cn: '飓风' }, { en: 'wildfire', cn: '野火' },
  { en: 'heart', cn: '心' }, { en: 'storm', cn: '暴风雪' },
  { en: 'helper', cn: '帮手' }, { en: 'push', cn: '推；推动' },
  { en: 'seventeen', cn: '十七' }, { en: 'shout', cn: '大声说；喊叫' },
  { en: 'count', cn: '计数' }, { en: 'rescue', cn: '营救；救援' },
  { en: 'terrible', cn: '糟糕的；严重的' }, { en: 'disaster', cn: '灾难' },
  { en: 'miracle', cn: '奇迹' }, { en: 'asleep', cn: '睡着的' },
  { en: 'voice', cn: '说话声；声音' }, { en: 'drop', cn: '落下' },
  { en: 'onto', cn: '到……上' }
];

const G6_U6 = [
  { en: 'yours', cn: '你的（东西）' }, { en: 'hockey', cn: '冰球；曲棍球' },
  { en: 'ice hockey', cn: '冰球运动' }, { en: 'dogsled', cn: '狗拉雪橇' },
  { en: 'skate', cn: '滑冰' }, { en: 'ski', cn: '滑雪' },
  { en: 'excitedly', cn: '兴奋地' }, { en: 'receive', cn: '收到' },
  { en: 'second', cn: '第二（个）的' }, { en: 'gold', cn: '金色的' },
  { en: 'medal', cn: '奖牌' }, { en: 'interview', cn: '采访' },
  { en: 'mascot', cn: '吉祥物' }, { en: 'athlete', cn: '运动员' },
  { en: 'meaning', cn: '意义' }, { en: 'feeder', cn: '饲料容器' },
  { en: 'bowl', cn: '碗' }, { en: 'chopstick', cn: '筷子' },
  { en: 'through', cn: '穿过' }, { en: 'hungry', cn: '饥饿的' },
  { en: 'freeze', cn: '（使）结冰' }, { en: 'candle', cn: '蜡烛' },
  { en: 'mail', cn: '邮政，邮递' }, { en: 'step', cn: '步骤' },
  { en: 'friendship', cn: '友情，友谊' }
];

// ---------------------------------------------------------------- 组装
function makeBook(title, chapters) {
  const all = [];
  chapters.forEach((c) => { all.push(...c.words); });
  return { title, chapters, all: { id: 'all', name: '全部章节', words: all } };
}

const G4 = makeBook('四年级上册', [
  { id: 'u1', name: 'Unit 1 · I love sports!', words: G4_U1 },
  { id: 'u2', name: 'Unit 2 · In town', words: G4_U2 },
  { id: 'u3', name: 'Unit 3 · Cool jobs', words: G4_U3 },
  { id: 'u4', name: 'Unit 4 · Let\'s shop', words: G4_U4 },
  { id: 'u5', name: 'Unit 5 · Shapes are fun', words: G4_U5 },
  { id: 'u6', name: 'Unit 6 · Our animal friends', words: G4_U6 },
  { id: 'plays', name: 'Plays · 剧本词汇', words: G4_PLAYS }
]);

const G5 = makeBook('五年级上册', [
  { id: 'u1', name: 'Unit 1 · My school is cool.', words: G5_U1 },
  { id: 'u2', name: 'Unit 2 · School events are fun!', words: G5_U2 },
  { id: 'u3', name: 'Unit 3 · The ends of the earth', words: G5_U3 },
  { id: 'u4', name: 'Unit 4 · I love the sea!', words: G5_U4 },
  { id: 'u5', name: 'Unit 5 · Work it out!', words: G5_U5 },
  { id: 'u6', name: 'Unit 6 · Special days', words: G5_U6 },
  { id: 'plays', name: 'Plays · 剧本词汇', words: G5_PLAYS }
]);

const G6 = makeBook('六年级上册', [
  { id: 'u1', name: 'Unit 1 · Good food, good health', words: G6_U1 },
  { id: 'u2', name: 'Unit 2 · Let\'s travel!', words: G6_U2 },
  { id: 'u3', name: 'Unit 3 · Call of the wild', words: G6_U3 },
  { id: 'u4', name: 'Unit 4 · Time flies!', words: G6_U4 },
  { id: 'u5', name: 'Unit 5 · Powerful earth', words: G6_U5 },
  { id: 'u6', name: 'Unit 6 · Winter fun', words: G6_U6 }
]);

const BOOKS_456 = { g4: G4, g5: G5, g6: G6 };

module.exports = { BOOKS_456, G4, G5, G6 };
