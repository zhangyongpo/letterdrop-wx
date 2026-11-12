# NOTICE — 版权与第三方资产声明

> 本文件随代码包一并分发，供平台审核与使用者核验代码来源。

## 0. 名称与独立性说明

本小游戏在游戏内的显示名称为「**字母拼拼**」，源码仓库与工程名为 `letterdrop-wx`；微信公众平台登记名称以 MP 后台为准。本代码包为本项目独立开发，与任何第三方小程序 / 小游戏（包括本次代码比对所涉及的第三方产品）分属不同主体，不存在代码复用、代码授权或合作关系。

## 1. 本游戏代码

- Copyright (c) 2026 zhangyongpo
- 开源许可：Apache License, Version 2.0（全文见同目录 `LICENSE`）
- 源码仓库（public）：<https://github.com/zhangyongpo/letterdrop-wx>
- 本游戏为独立开发，使用微信小游戏原生 Canvas 2D + CommonJS 编写，**未使用任何第三方游戏引擎、SDK、公共库、商业源码或外包代码**；无 npm 依赖、无运行时网络请求。
- 上传的 JS 均为带中文注释的可读源码，未加密、未混淆；核心逻辑集中在 `game.js`（状态机 / 渲染 / 触摸分发），微信小游戏平台 API 收口在 `platform/adapter.js`。

## 2. 代码中与其他小游戏可能相似的部分（说明）

| 部分                                                                    | 性质                                               |
| --------------------------------------------------------------------- | ------------------------------------------------ |
| `platform/adapter.js`                                                  | 对微信小游戏 `wx` 平台 API 的统一收口，属平台接口的有限表达，不含本游戏业务逻辑  |
| `game.js` 中 canvas 初始化、`requestAnimationFrame` 主循环、触摸命中判断、数组洗牌、圆角矩形绘制 | 小游戏开发的通用惯用写法                                     |
| `data/words*.js`、`data/book_index.js`                                 | 教材词汇表（公开资料整理的事实性数据）与册次索引，非程序逻辑                   |
| `data/word_audio.js`                                                  | 由 `tools/gen_words_audio.py` 自动生成的音频文件名清单，属事实性数据 |

年级/章节/练习模式的状态机、绘制、动画与交互逻辑，以及词库组织方式、发音回退链、分包加载策略，均为本项目独立设计与实现。

## 3. 第三方资产

| 资产                                                          | 权利人与许可                                                              | 说明                                                                 |
| ----------------------------------------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `assets/fonts/andika.ttf`                                   | Copyright (c) 2004-2022 SIL International，SIL Open Font License 1.1 | 许可全文见 `assets/fonts/OFL.txt`；字体未修改，未以保留字体名发布衍生版本                   |
| `assets/audio/A-Z.mp3`、各册 `subpackages/*/audio/words/*.mp3` | 构建期使用 edge-tts 生成，随包离线分发                                            | 生成脚本为 `tools/gen_words_audio.py`（不入上传包）；公开发布前应以所用 TTS 服务条款核对商用授权范围 |
| 教材词汇表                                                       | 依据公开课本 Words and expressions / Vocabulary 页整理                       | 词汇及释义属事实性数据，仅用于英语学习练习                                              |

## 4. 联系与核验

- 仓库提交历史：<https://github.com/zhangyongpo/letterdrop-wx/commits>
- 问题反馈：<https://github.com/zhangyongpo/letterdrop-wx/issues>
- 联系邮箱：zyp081107@126.com
