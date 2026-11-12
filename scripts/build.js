// scripts/build.js
// 组装微信小游戏产物：共享源码（唯一真源）+ 仓库根目录配置 -> dist/wx/
//
//   node scripts/build.js
//
// 配置直接取仓库根目录的 game.json / project.config.json；源码始终只维护一份。
// dist/ 不入库，见 .gitignore。

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'dist', 'wx');

// 打进产物的共享内容。
const SHARED = [
  'game.js',
  'LICENSE', 'NOTICE.md',
  'config', 'data', 'utils', 'assets', 'subpackages',
  'platform/adapter.js'
];
const SKIP = new Set(['data/words_b56_legacy.js']);

const LIMIT = { label: '微信小游戏', main: 4 * 1024 * 1024, total: 30 * 1024 * 1024, field: 'subpackages' };

function mib(n) { return (n / 1048576).toFixed(2) + ' MiB'; }

function dirSize(dir) {
  let total = 0;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    total += e.isDirectory() ? dirSize(p) : fs.statSync(p).size;
  }
  return total;
}

function copyInto(src, dst, rel) {
  if (!fs.existsSync(src)) throw new Error('缺少共享内容: ' + rel);
  if (SKIP.has(rel)) return;
  const st = fs.statSync(src);
  if (st.isDirectory()) {
    fs.mkdirSync(dst, { recursive: true });
    for (const name of fs.readdirSync(src)) {
      copyInto(path.join(src, name), path.join(dst, name), rel + '/' + name);
    }
  } else {
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    fs.copyFileSync(src, dst);
  }
}

function walkJs(dir, cb) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walkJs(p, cb);
    else if (e.name.endsWith('.js')) cb(p);
  }
}

// 护栏：产物里不应再有直接的 wx.* 调用（新增 API 必须走 platform/adapter.js）。
function scanRefs(out) {
  const issues = [];
  walkJs(out, (file) => {
    const rel = path.relative(out, file).replace(/\\/g, '/');
    const text = fs.readFileSync(file, 'utf8');
    if (/\bwx\s*\./.test(text)) issues.push(rel + ' 仍有直接的 wx.* 调用');
  });
  return issues;
}

function build() {
  try {
    fs.rmSync(OUT, { recursive: true, force: true });
  } catch (e) {
    // 开发者工具可能正打开 dist/wx/（Windows 文件占用导致整目录删除失败）。
    // 此时退化为「保留目录 + 覆盖写入」，不中断构建；IDE 里手动点一次编译即可刷新。
    console.log('  ! 产物目录被占用，跳过整目录清理，改为覆盖写入（请在 IDE 中点「编译」刷新）');
  }
  fs.mkdirSync(OUT, { recursive: true });

  for (const item of SHARED) {
    copyInto(path.join(ROOT, item), path.join(OUT, item), item);
  }

  const pc = {};
  for (const f of ['game.json', 'project.config.json']) {
    const src = path.join(ROOT, f);
    if (!fs.existsSync(src)) throw new Error('缺少配置: ' + src);
    pc[f] = JSON.parse(fs.readFileSync(src, 'utf8'));
    fs.writeFileSync(path.join(OUT, f), JSON.stringify(pc[f], null, 2) + '\n');
  }

  const gj = pc['game.json'];
  const subs = gj[LIMIT.field];
  if (!Array.isArray(subs) || subs.length === 0) {
    throw new Error('game.json 缺少 ' + LIMIT.field + ' 字段');
  }
  for (const s of subs) {
    if (!fs.existsSync(path.join(OUT, s.root))) {
      throw new Error('分包目录不存在: ' + s.root);
    }
  }

  const issues = scanRefs(OUT);
  if (issues.length) throw new Error('源码检查未通过:\n  - ' + issues.join('\n  - '));

  const subSize = subs.reduce((n, s) => n + dirSize(path.join(OUT, s.root)), 0);
  const total = dirSize(OUT);
  const main = total - subSize;
  const flag = (v, limit) => (v <= limit ? 'OK' : '超限');

  console.log('[wx] ' + LIMIT.label + ' -> ' + path.relative(ROOT, OUT).replace(/\\/g, '/'));
  console.log('  主包   ' + mib(main).padEnd(12) + '/ ' + mib(LIMIT.main) + '  ' + flag(main, LIMIT.main));
  console.log('  分包   ' + mib(subSize).padEnd(12) + '(' + subs.length + ' 个)');
  console.log('  总包   ' + mib(total).padEnd(12) + '/ ' + mib(LIMIT.total) + '  ' + flag(total, LIMIT.total));
  console.log('  分包字段 ' + LIMIT.field + ' / 源码检查 OK');
  if (main > LIMIT.main || total > LIMIT.total) throw new Error('包体超限');
}

function main() {
  if (process.argv.indexOf('--help') >= 0) {
    console.log('用法: node scripts/build.js');
    return;
  }
  fs.mkdirSync(path.join(ROOT, 'dist'), { recursive: true });
  build();
  console.log('BUILD_OK');
}

main();
