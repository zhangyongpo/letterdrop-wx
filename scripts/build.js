// scripts/build.js
// 按平台组装产物：共享源码（唯一真源）+ 对应平台配置 -> dist/<platform>/
//
//   node scripts/build.js                    构建两端
//   node scripts/build.js --platform tt     只构建抖音端
//   node scripts/build.js --platform wx     只构建微信端
//
// 微信端配置直接取仓库根目录的 game.json / project.config.json，
// 抖音端配置取 platform/tt/ 下的两份；共享源码始终只维护一份。
// dist/ 不入库，见 .gitignore。

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const PLATFORMS = ['wx', 'tt'];

// 打进两端产物的共享内容。platform/tt/ 只放配置，不打进产物。
const SHARED = [
  'game.js',
  'config', 'data', 'utils', 'assets', 'subpackages',
  'platform/adapter.js', 'platform/sidebar.js'
];
const SKIP = new Set(['data/words_b56_legacy.js']);

const LIMITS = {
  wx: { label: '微信小游戏', main: 4 * 1024 * 1024, total: 30 * 1024 * 1024, field: 'subpackages' },
  tt: { label: '抖音小游戏', main: 4 * 1024 * 1024, total: 20 * 1024 * 1024, field: 'subPackages' }
};

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

// 护栏：产物里不应再有直接的 wx.* 调用（新增 API 必须走 platform/adapter.js）；
// 同时确认抖音侧边栏复访调用存在于产物中。
function scanRefs(out) {
  const issues = [];
  let sidebarOk = false;
  walkJs(out, (file) => {
    const rel = path.relative(out, file).replace(/\\/g, '/');
    const text = fs.readFileSync(file, 'utf8');
    if (/\bwx\s*\./.test(text)) issues.push(rel + ' 仍有直接的 wx.* 调用');
    if (rel === 'platform/sidebar.js' && text.indexOf('navigateToScene') >= 0) sidebarOk = true;
  });
  if (!sidebarOk) issues.push('platform/sidebar.js 缺少 navigateToScene（抖音侧边栏复访必接）');
  return issues;
}

function build(platform) {
  const cfg = LIMITS[platform];
  const out = path.join(DIST, platform);
  fs.rmSync(out, { recursive: true, force: true });
  fs.mkdirSync(out, { recursive: true });

  for (const item of SHARED) {
    copyInto(path.join(ROOT, item), path.join(out, item), item);
  }

  const cfgDir = platform === 'wx' ? ROOT : path.join(ROOT, 'platform/tt');
  const pc = {};
  for (const f of ['game.json', 'project.config.json']) {
    const src = path.join(cfgDir, f);
    if (!fs.existsSync(src)) throw new Error('缺少平台配置: ' + src);
    pc[f] = JSON.parse(fs.readFileSync(src, 'utf8'));
    fs.writeFileSync(path.join(out, f), JSON.stringify(pc[f], null, 2) + '\n');
  }

  const gj = pc['game.json'];
  const subs = gj[cfg.field];
  if (!Array.isArray(subs) || subs.length === 0) {
    throw new Error(platform + ' 端 game.json 缺少 ' + cfg.field + ' 字段');
  }
  if (platform === 'tt' && gj.subpackages) {
    throw new Error('抖音端误用了小写 subpackages，必须用 subPackages（驼峰）');
  }
  for (const s of subs) {
    if (!fs.existsSync(path.join(out, s.root))) {
      throw new Error('分包目录不存在: ' + s.root);
    }
  }

  const issues = scanRefs(out);
  if (issues.length) throw new Error('源码检查未通过:\n  - ' + issues.join('\n  - '));

  const subSize = subs.reduce((n, s) => n + dirSize(path.join(out, s.root)), 0);
  const total = dirSize(out);
  const main = total - subSize;
  const flag = (v, limit) => (v <= limit ? 'OK' : '超限');

  console.log('[' + platform + '] ' + cfg.label + ' -> ' + path.relative(ROOT, out).replace(/\\/g, '/'));
  console.log('  主包   ' + mib(main).padEnd(12) + '/ ' + mib(cfg.main) + '  ' + flag(main, cfg.main));
  console.log('  分包   ' + mib(subSize).padEnd(12) + '(' + subs.length + ' 个)');
  console.log('  总包   ' + mib(total).padEnd(12) + '/ ' + mib(cfg.total) + '  ' + flag(total, cfg.total));
  console.log('  分包字段 ' + cfg.field + ' / 源码检查 OK');
  if (platform === 'tt' && pc['project.config.json'].appid === 'tt0000000000000000') {
    console.log('  ⚠ appid 仍是占位值，请在 platform/tt/project.config.json 填入抖音小游戏 AppID');
  }
  if (main > cfg.main || total > cfg.total) throw new Error(platform + ' 端包体超限');
}

function main() {
  const args = process.argv.slice(2);
  if (args.indexOf('--help') >= 0) {
    console.log('用法: node scripts/build.js [--platform all|wx|tt]');
    return;
  }
  const i = args.indexOf('--platform');
  const want = i >= 0 ? args[i + 1] : 'all';
  if (!['all', 'wx', 'tt'].includes(want)) throw new Error('--platform 只能是 all / wx / tt');
  const targets = want === 'all' ? PLATFORMS : [want];
  fs.mkdirSync(DIST, { recursive: true });
  for (const p of targets) build(p);
  console.log('BUILD_OK');
}

main();
