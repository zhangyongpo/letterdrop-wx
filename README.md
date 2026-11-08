# 字母拼拼 · 微信 / 抖音双端小游戏（letterdrop-wx）

一款面向幼儿英语启蒙的**原生小游戏**（Canvas 2D，无 DOM / 无 WXML）。同一份源码构建出微信小游戏与抖音小游戏两个产物。两个主模式：

- **找字母**：App 播报一个字母，6 个字母分两排从顶部掉落，落地前点中对应字母（听音辨形，带计分/闯关）。
- **拼单词**：六册教材词库 + 四种练习（听音拼单词 / 中文转单词 / 全部单词查阅 / 单词对对碰），含单词级真实发音。

> 完全离线：所有发音为包内 mp3，运行时不联网、无后端、无插件。
> 单仓库：游戏逻辑、词库、944 个发音 mp3 都只有一份，平台差异收敛在 `platform/`；`dist/` 产物不入库。

## 教材与词库

统一使用 **2024 国家教材委员会审核通过 · 外语教学与研究出版社 · 外研剑桥《Join In》（三年级起点，刘兆义主编）**，与纸质课本封面左上角的绿色「2024」审定标志一致。注意外研社同时有「新标准三起」「新交际」等其它系列，单元名相近但词表完全不同，扩充词库时勿混用。

| 册次 | 教材版次 | 章节 | 词条 | 发音 mp3 | 分包 |
|---|---|---|---|---|---|
| 三年级上册 | 2024 秋 | Welcome + Unit 1~6 | 210 | 198 | `g3` |
| 三年级下册 | 2025 春 | Unit 1~6 | 199 | 199 | `g3b` |
| 四年级上册 | 2025 秋 | Unit 1~6 + Plays | 188 | 188 | `g4` |
| 四年级下册 | 2026 春 | Unit 1~6 | 98 | 98 | `g4b` |
| 五年级上册 | 2026 秋 | Unit 1~6 + Plays | 136 | 136 | `g5` |
| 六年级上册 | 2026 秋 | Unit 1~6 | 126 | 125 | `g6` |

词表整理自课本 Words and expressions 页的公开资料（OCR），**接入前建议对照纸质课本词汇表页核对**，已知待核点：六上 Unit 4、四下 Unit 6 收录词数明显偏少，疑似源资料抓取不全；三下个别单元标题在 OCR 资料中与课本目录略有出入（已按电子课本目录统一）。

### 关于五下 / 六下

截至 2026-11，新版（2024 审定）五下、六下预计 **2027 春**启用，电子课本网 Join In 系列仅收录到「五上 / 六上 2026 秋版」，五下、六下仍是旧版无年份页面；网上能找到的五下、六下词表**全部属于 2013 审定旧版 Join In**（Starter unit Join in again / A phone call / Life in the Arctic …），与孩子现行课本不配套。

这些旧版词表已整理在 `data/words_b56_legacy.js`（五下 168 条、六下 124 条），**仅供资料留存，未接入游戏、未生成发音、已从构建产物中排除**。待新版课本词汇表公开后，新建 `data/words_b56.js`，把 `g5b` / `g6b` 加进 `data/book_index.js` 的 `BOOKS/GRADES`、两份 `game.json` 的分包列表，再跑一次生成脚本即可接入（年级页已是数据驱动的滚动列表，无需改 `game.js`）。

## 玩法规则

**找字母**：每组 6 个字母（3 列 × 2 排）；正确答案最多 2 个（大小写合计）；点中 +1 分、点错倒扣（不低于 0）、目标落地漏点扣 1 命；3 命结束结算；每 10 组速度 +1 档；最高分存本地存储 `letterdrop_best`；游戏中退出有二次确认。

**拼单词**：路径为 `导航 → 年级/册次 → 章节（各单元 + 全部章节）→ 练习模式`。年级页为可上下滑动的卡片列表，按下记录命中、抬手且未判定为滑动才进入，避免滑动误触。
- **听音拼单词 / 中文转单词**：共用拼写页，前者自动播真实发音、底部小喇叭可重听；后者不发音、显示中文释义。候选字母为词长 2~3 倍（≥6，全小写），点击追加、再点取消，完全一致即拼对并弹框展示单词 + 释义。
- **全部单词查阅**：去重后按章节列出中英文，可上下拖动，每行小喇叭点播发音。
- **单词对对碰**：自适应流式网格，随机取最多 14 词，**点击英文卡播放该词的发音**（中文卡保持安静，避免提前念出英文、削弱配对练习；连续点不同英文卡会自动停掉上一条，不叠音），英文卡 + 中文卡配对消除，成功有翻转变绿动画。分包未就绪时静默回退逐字母拼读并后台补下载。

含空格的短语（如 `on top of the world`）、连字符词（如 `forty-five`）和撇号词（如 `two o'clock`）有真实发音、可在查阅页播放，但不进入逐字母拼写练习。拼写页用 `assets/fonts/andika.ttf`（SIL 开源印刷体）绘制英语四线三格。

## 双端构建

**源码只有一份，不按平台复制整套代码。** 微信端可继续直接用仓库根目录开发调试；抖音端由构建脚本产出。

```bash
node scripts/build.js                  # 构建两端 -> dist/wx/ 与 dist/tt/
node scripts/build.js --platform wx    # 只构建微信端
node scripts/build.js --platform tt    # 只构建抖音端
```

构建脚本做的事：拷贝共享源码（含六个音频分包）→ 写入对应平台的 `game.json` / `project.config.json` → 校验分包字段与目录存在 → 扫描产物里是否有人绕过适配层直接调用平台 API → 打印主包 / 分包 / 总包体积并对照上限。

| 项 | 微信端 | 抖音端 |
|---|---|---|
| 配置文件来源 | 仓库根目录 | `platform/tt/` |
| 分包字段 | `subpackages`（小写 p） | `subPackages`（**驼峰 P**，官方明确要求） |
| 主包 / 总包上限 | 4 M / 30 M | 4 M / 20 M |
| 当前产物 | 主包 0.95 MiB、总包 13.13 MiB | 同左 |
| 侧边栏复访 | 不需要，入口自动隐藏 | 必接，导航页底部「加入侧边栏」按钮 |
| AppID | 根目录 `project.config.json`：`wx4de65122514bb5e0` | `platform/tt/project.config.json`：`tt23d95564bda660c602` |

`game.js` 与 `utils/audio.js` 只依赖 `platform/adapter.js`。适配层把两端 API 统一为 `adapter.*`（微信 → `wx`，抖音 → `tt`），并在抖音端补齐：`getWindowInfo` 回退到 `getSystemInfoSync`、`loadFont` 自动补包根绝对路径、缺失 `setInnerAudioOption` 时跳过全局设置（每个音频实例仍单独设 `obeyMuteSwitch=false`）。**新增平台 API 必须同步加进 `adapter.js` 的 `API_LIST`**，否则构建时的静态检查会拦截。

`platform/sidebar.js` 提供抖音必接的侧边栏复访能力，包内含 `tt.navigateToScene` 调用；微信端 `available()` 恒为 `false`，不绘制也不调用。

**音频路径（两端唯一实质差异）**：抖音小游戏官方教程里包内音效写的是 `audio/click.mp3`（相对路径、无前导斜杠），而 PC 模拟器是 Web 环境，会把 `/assets/audio/A.mp3` 当成站点根 URL 请求而 404，表现就是 `NotSupportedError: Failed to load because no supported source was found.`、全程无声。`adapter.audioSrcCandidates()` 按平台给出候选顺序（微信 `/assets/... → assets/...`，抖音 `assets/... → ./assets/... → /assets/...`），`utils/audio.js` 的 `createCtx()` 在 `onError` 时自动换下一种写法重试，全部失败才回退逐字母拼读。每次失败都会把实际尝试的路径打到 Console，方便定位。微信端首选路径未变，行为零变化。

## 目录结构

```
letterdrop-wx/
├── game.js                 ★ 入口：状态机 / 渲染 / 动画 / 触摸分发（双端共享）
├── game.json               微信端运行配置 + 六个册次音频分包声明
├── project.config.json     微信端工程配置（compileType: game）
├── platform/
│   ├── adapter.js          ★ 平台适配层：wx / tt 统一为 adapter.*
│   ├── sidebar.js          抖音侧边栏复访能力（微信端自动隐藏）
│   └── tt/
│       ├── game.json       抖音端配置（subPackages 驼峰）
│       └── project.config.json  抖音端工程配置（appid: tt23d95564bda660c602）
├── scripts/build.js        ★ 双端构建脚本 + 静态护栏 + 体积检查
├── assets/
│   ├── audio/A…Z.mp3       26 个字母发音（主包，找字母首启必需）
│   └── fonts/andika.ttf    拼写页印刷体
├── config/gameConfig.js    找字母玩法参数
├── data/
│   ├── words.js            三上词库（Welcome + Unit 1~6）
│   ├── words_b34.js        三下 / 四下词库（2024 审定新版）
│   ├── words_g456.js       四/五/六上词库
│   ├── words_b56_legacy.js 五下 / 六下旧版词表（未接入，已排除打包）
│   ├── book_index.js       ★ 六册总索引、册次列表、slug 规则、分包路径
│   └── word_audio.js       自动生成：按册次记录已生成发音的文件名
├── utils/audio.js          ★ 字母/单词发音、分包加载状态、iOS 手势解锁、失败回退
├── subpackages/            ★ 六个分包，各含 game.js 占位入口 + audio/words/*.mp3
│   ├── g3/ g3b/ g4/ g4b/ g5/ g6/
├── tools/
│   ├── dump_audio_words.js 供 Python 读取全部册次词表（输出 JSON）
│   └── gen_words_audio.py  批量生成发音 mp3 + 重建清单
└── dist/                   构建产物（wx/、tt/），已加入 .gitignore
```

> `project.private.config.json` 目前仍被 Git 跟踪，`.gitignore` 对已跟踪文件不生效。若要将其转为本地文件，执行一次 `git rm --cached project.private.config.json` 再提交即可（本地文件不会删除）。

## 分包与包体

主包只保留启动必需内容，六册发音各放一个分包（微信用 `subpackages`，抖音用 `subPackages`）。点册次卡片时调用平台的分包加载 API，显示进度条；下载由客户端本地缓存，之后进入无需再等；失败可重试或「仍要进入」（发音自动回退为逐字母拼读，不阻塞玩法）。分包内容仍受内容合规约束。

抖音小游戏加载分包时会自动把 `root` 目录下的 `game.js` 作为入口执行，现有占位入口是纯注释，两端都安全。

音频格式统一为 **MPEG-1 Layer3 / 44100Hz / 单声道 / 64kbps**——低采样率 MPEG-2 mp3 在 iOS 上会拒播，不要改采样率。

| 项 | 当前体积 | 微信上限 | 抖音上限 |
|---|---|---|---|
| 主包 | 0.95 MiB | 4 M | 4 M |
| 六个分包合计 | 12.18 MiB（944 个 mp3） | 单个不限 | 单分包 ≤20 M |
| 总包 | 13.13 MiB | 30 M（部分情形按 20 M 计） | 20 M |

## 生成 / 更新发音

```bash
python -m pip install edge-tts imageio-ffmpeg
python tools/gen_words_audio.py                 # 全部册次，跳过已存在文件（可断点续跑）
python tools/gen_words_audio.py --grades g3b    # 只补某一册
python tools/gen_words_audio.py --force         # 全部重新生成
python tools/gen_words_audio.py --manifest-only # 只按现有 mp3 重建 data/word_audio.js
```

脚本通过 `node tools/dump_audio_words.js` 读取 JS 词表（单一数据源），词条转文件名的规则见 `data/book_index.js` 的 `slug()`：小写、空格转下划线、撇号去掉（`two o'clock → two_oclock`）、连字符保留。生成完自动写入按册次分组的 `data/word_audio.js`。个别缩写有发音覆盖（`PE → P E`、`TV → T V`、`Mr → Mister`、`Ms/Mrs → Miss`、`OK → okay`）。改完词表后需重新执行 `node scripts/build.js` 更新产物。

## 运行 / 调试

1. **微信**：开发者工具 → 导入项目 → 选择本目录；`compileType: game`，AppID `wx4de65122514bb5e0`。（也可导入 `dist/wx/` 验证构建产物。）
2. **抖音**：AppID 已配置为 `tt23d95564bda660c602`；执行 `node scripts/build.js --platform tt`，用抖音开发者工具导入 `dist/tt/`（首次导入时若工具提示 AppID 不匹配，以工具内填写的为准，构建脚本只负责写入配置）。
3. **务必真机（iOS + 安卓）验证**：选任一册次，等分包下载完成后听单词发音是否出声。抖音模拟器中若曾出现 `no supported source was found` 导致无声，是前导斜杠绝对路径解析问题，已改为相对路径优先 + 失败自动切换（见上节）；重新构建并在 IDE 点「编译」刷新后复测。诊断时看 Console 的 `[audio] 路径加载失败 <路径>`：若三种写法都失败，说明该端 `InnerAudioContext` 不接受包内路径，需改用 `tt.getFileSystemManager().readFileSync()` 读包内文件 → 写入 `tt.env.USER_DATA_PATH` → 用该临时路径播放（官方明确支持临时路径，包内目录读取无需协议头）。若字母音有声而单词音仍是逐字母拼读，则问题只在分包资源访问，需单独验证分包映射。
4. 抖音端还需确认 `tt.loadFont` 在目标基础库是否生效（低版本自动回退 `sans-serif`，只影响四线三格字形，不崩溃）。
5. 发布：微信走「类目设置 → 资质审核 → 小程序备案 → 版本审核 → 发布」，不走虚拟支付的 IAA 路径预计 13~37 个工作日；抖音另需**软著（强制，游戏名须与登记名一致）+ ICP 备案**，宜与开发并行办理。分包不改变审核链路，也不额外收费。

## 费用与授权

- 代码包托管与分包下载由平台免费提供；本游戏完全离线，运行成本 ¥0。
- 企业主体微信认证 ¥300/年（账号资质，非托管费）；个人主体以 MP 后台提示为准。
- 发音由 edge-tts（微软在线 TTS）在**构建期**生成；公开发布前请确认所用 TTS/音频的授权范围。

## 提交记录（关键节点）

- 微信小程序骨架 → 腾讯 ASR/云开发方案（后废弃）→ 反向玩法重构 → 完全离线的字母 mp3。
- **转为微信小游戏**：`game.js + game.json` 入口，全 Canvas 绘制。
- **新增「拼单词」模式**：年级 → 章节 → 四种练习、Andika 四线三格、单词级真实发音。
- **四册上册词库与分包改造**：补齐三上 Unit 6；新增四/五/六上词表；647 个发音 mp3 按年级拆入四个分包；年级选择页加下载进度与失败回退。
- **新增三下 / 四下**：新增 297 个发音 mp3 与 `g3b` / `g4b` 两个分包，册次增至 6 册、mp3 共 944 个；年级页改数据驱动滚动列表（点击/滑动分离）；slug 兼容撇号词。五下/六下新版未出版，旧版词表单独留存未接入。
- **对对碰点读发音**：点击英文卡播该词发音、中文卡保持安静；发音模块加入连点互斥与拼读回退链终止，避免多词叠音；进入对对碰时若分包未下载会后台补下载。
- **双端单仓库改造**：新增 `platform/adapter.js` 收口 13 个平台 API、`platform/sidebar.js` 侧边栏复访、`platform/tt/` 抖音配置（驼峰 `subPackages`）、`scripts/build.js` 双端构建与静态护栏；`dist/` 不入库。微信端冒烟测试行为不变。
- **修复抖音模拟器无声**：包内音频路径改为按平台候选（抖音相对路径优先）+ `onError` 自动换写法重试 + Console 打印实际路径；`build.js` 在产物目录被 IDE 占用时退化为覆盖写入，不再中断构建。
