/**
 * 软著登记「源程序鉴别材料」排版工具
 *
 * 作用：仅把项目内【真实存在的 JS 源码】按中国版权保护中心的格式要求做机械分页，
 *       不生成、不改写、不补充任何一行代码内容。
 * 规范：源程序连续的前 30 页 + 后 30 页；不足 60 页则全部提交；
 *       每页不少于 50 行；页眉标注软件全称与版本号；右上角标注页码；去掉空行。
 *
 * 用法：
 *   node docs/copyright/gen_source_doc.js --name "软件全称" --version V1.0
 *   node docs/copyright/gen_source_doc.js --name "字母拼拼" --version V1.0 --lines-per-page 50
 * 输出：docs/copyright/源代码鉴别材料.html（浏览器打开后 Ctrl+P 另存为 PDF）
 *
 * 注意：--name / --version 必须与申请表填报内容完全一致（有无 V 也以申请表为准）。
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const OUT_DIR = __dirname;

function arg(name, fallback) {
  const i = process.argv.indexOf('--' + name);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const SOFTWARE_NAME = arg('name', '【软件全称·须与申请表一致】');
const VERSION = arg('version', 'V1.0');
const LINES_PER_PAGE = parseInt(arg('lines-per-page', '50'), 10);
const FONT_ARG = arg('font-size', 'auto');
const OUT_FILE = path.join(OUT_DIR, arg('out', '源代码鉴别材料.html'));

// 核心逻辑优先排序，确保前 30 页与后 30 页都能覆盖到主要程序而非只落在数据文件上
const PRIORITY = [
  'game.js',
  'config/gameConfig.js',
  'platform/adapter.js',
  'utils/audio.js',
  'scripts/build.js',
  'data/book_index.js',
  'data/words.js',
  'data/words_b34.js',
  'data/words_g456.js',
  'data/words_b56_legacy.js',
  'data/word_audio.js',
  'tools/dump_audio_words.js',
];

const SKIP_DIRS = new Set(['.git', 'node_modules', 'dist', 'docs']);

function walk(dir, acc = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) walk(path.join(dir, entry.name), acc);
    } else if (entry.name.endsWith('.js')) {
      acc.push(path.relative(ROOT, path.join(dir, entry.name)).replace(/\\/g, '/'));
    }
  }
  return acc;
}

const found = walk(ROOT);
const ordered = [
  ...PRIORITY.filter((f) => found.includes(f)),
  ...found.filter((f) => !PRIORITY.includes(f)).sort(),
];

const lines = [];
let maxLineLen = 0;
let maxUnits = 0;
let totalPhysicalLines = 0;

// 估算一行的显示宽度：中文/全角按 2 个单位，ASCII 按 1 个单位
function displayUnits(s) {
  let u = 0;
  for (const ch of s) u += /[\u2E80-\uFFFF]/.test(ch) ? 2 : 1;
  return u;
}

for (const rel of ordered) {
  const raw = fs.readFileSync(path.join(ROOT, rel), 'utf8');
  const srcLines = raw.split(/\r?\n/);
  lines.push('// ---------- ' + rel + ' ----------');
  for (const line of srcLines) {
    if (/^\s*$/.test(line)) continue; // 去掉非代码空行
    totalPhysicalLines++;
    maxLineLen = Math.max(maxLineLen, line.length);
    maxUnits = Math.max(maxUnits, displayUnits(line));
    lines.push(line.replace(/\s+$/, ''));
  }
}

const totalPages = Math.ceil(lines.length / LINES_PER_PAGE);
const takeAll = totalPages <= 60;
const pageIndices = takeAll
  ? Array.from({ length: totalPages }, (_, i) => i)
  : [...Array.from({ length: 30 }, (_, i) => i),
     ...Array.from({ length: 30 }, (_, i) => totalPages - 30 + i)];

// A4 可用正文宽度约 178mm ≈ 504pt；等宽字体 ASCII 约 0.55em/单位。
// 自动选一个能让最长行完整落在一页内的字号（6–8.5pt），避免打印溢出产生空白页。
const AVAIL_PT = 504;
const autoSize = Math.min(8.5, Math.max(6, AVAIL_PT / (maxUnits * 0.55)));
const FONT_SIZE = FONT_ARG === 'auto' ? autoSize.toFixed(1) : FONT_ARG;

function esc(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function pageHtml(idx, displayNo) {
  const chunk = lines.slice(idx * LINES_PER_PAGE, (idx + 1) * LINES_PER_PAGE);
  return [
    '<div class="page">',
    '  <div class="head"><span class="nm">' + esc(SOFTWARE_NAME) + ' ' + esc(VERSION) +
      '</span><span class="pg">第 ' + displayNo + ' 页</span></div>',
    '  <pre>' + chunk.map(esc).join('\n') + '</pre>',
    '</div>',
  ].join('\n');
}

const body = pageIndices.map((idx, n) => pageHtml(idx, n + 1)).join('\n');

const html = `<!DOCTYPE html>
<html lang="zh-CN"><head><meta charset="utf-8">
<title>${esc(SOFTWARE_NAME)} ${esc(VERSION)} 源程序鉴别材料</title>
<style>
  @page { size: A4 portrait; margin: 12mm 14mm 14mm 18mm; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: #fff; color: #000; }
  body { font-family: Consolas, "Courier New", "Microsoft YaHei", monospace; }
  .page { page-break-after: always; break-after: page; }
  .page:last-child { page-break-after: auto; break-after: auto; }
  .head {
    display: flex; justify-content: space-between; align-items: baseline;
    font-size: 9pt; border-bottom: 0.5pt solid #666;
    padding-bottom: 1.5mm; margin-bottom: 2mm;
  }
  .nm { font-weight: 600; }
  .pg { font-variant-numeric: tabular-nums; }
  pre {
    margin: 0; font-family: inherit; font-size: ${FONT_SIZE}pt; line-height: 1.28;
    white-space: pre; overflow: visible; tab-size: 2;
  }
  @media screen {
    body { background: #f0f0f0; padding: 16px 0; }
    .page {
      width: 210mm; min-height: 297mm; margin: 0 auto 16px; padding: 12mm 14mm 14mm 18mm;
      background: #fff; box-shadow: 0 1px 6px rgba(0,0,0,.18);
    }
  }
</style></head><body>
${body}
</body></html>`;

fs.writeFileSync(OUT_FILE, html, 'utf8');

console.log('软件全称      : ' + SOFTWARE_NAME);
console.log('版本号        : ' + VERSION);
console.log('参与文件      : ' + ordered.length + ' 个 JS');
console.log('有效代码行    : ' + totalPhysicalLines + ' 行（已去空行，另加 ' + ordered.length + ' 行文件分隔标注）');
console.log('总页数        : ' + totalPages + ' 页（每页 ' + LINES_PER_PAGE + ' 行）');
console.log('交存方式      : ' + (takeAll ? '不足 60 页，全部提交' : '一般交存：前 30 页 + 后 30 页'));
console.log('实际输出      : ' + pageIndices.length + ' 页');
console.log('最长行        : ' + maxLineLen + ' 字符 / ' + maxUnits + ' 显示单位');
console.log('正文字号      : ' + FONT_SIZE + 'pt' + (FONT_ARG === 'auto' ? '（自动适配，可用 --font-size 手动指定）' : '（手动指定）'));
console.log('输出文件      : ' + OUT_FILE);
console.log('下一步        : 浏览器打开 → Ctrl+P → 目标「另存为 PDF」→ A4 / 缩放 100% / 关闭页眉页脚');
