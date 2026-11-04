// cloudfunctions/asr/index.js
// 腾讯云 ASR「一句话识别」云函数。
// 密钥从环境变量读取（不要写进代码）：
//   TENCENT_SECRET_ID / TENCENT_SECRET_KEY —— 腾讯云账号（实名后开通「语音识别」）
//   ASR_REGION —— 可选，默认 ap-guangzhou
//   ASR_HOTWORD_ID —— 可选，控制台创建的热词表 ID（提升 A-Z 字母识别率）
//
// 部署：微信开发者工具 -> 云开发 -> 右键 cloudfunctions/asr -> 上传并部署：云端安装依赖

const tc = require('tencentcloud-sdk-nodejs-asr');
// 不同版本导出结构略有差异，做兼容解析
const AsrClient =
  (tc.asr && tc.asr.v20190614 && tc.asr.v20190614.Client) ||
  (tc.v20190614 && tc.v20190614.Client);

exports.main = async (event) => {
  const audioBase64 = event && event.audioBase64;
  if (!audioBase64) {
    return { text: '' };
  }

  const client = new AsrClient({
    credential: {
      secretId: process.env.TENCENT_SECRET_ID,
      secretKey: process.env.TENCENT_SECRET_KEY
    },
    region: process.env.ASR_REGION || 'ap-guangzhou',
    profile: {
      httpProfile: { endpoint: 'asr.tencentcloudapi.com' }
    }
  });

  try {
    const resp = await client.SentenceRecognition({
      ProjectId: 0,
      SubServiceType: 2,
      EngSerViceType: '16k_en', // 念的是英文字母名，用英语模型
      SourceType: 1, // 1 = 语音数据（Base64）
      VoiceFormat: 'wav',
      UsrAudioKey: Date.now() + '_' + Math.floor(Math.random() * 1e6),
      Data: audioBase64,
      ...(process.env.ASR_HOTWORD_ID ? { HotWordId: process.env.ASR_HOTWORD_ID } : {})
    });
    // 兼容不同 SDK 版本的返回结构
    const text = (resp && (resp.Result || (resp.Response && resp.Response.Result))) || '';
    return { text };
  } catch (e) {
    return { text: '', error: e && e.message ? e.message : String(e) };
  }
};
