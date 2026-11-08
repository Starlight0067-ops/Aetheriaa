// Screenshot the Character Lab. Always run through the lock:
//   node tools/lock.mjs node tools/characters/shoot_lab.mjs --shots lineup,kael,portrait-kael --out shots/characters/r1 [--quality high --w 1600 --h 900 --extra "&action=run&t=0.3"]
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const shots = arg('shots', 'lineup').split(',');
const out = arg('out', 'shots/characters');
const quality = arg('quality', 'high');
const extra = arg('extra', '');
const w = +arg('w', 1600), h = +arg('h', 900);
const base = arg('url', process.argv.includes('--dist') ? 'http://lab.local' : 'http://127.0.0.1:5173');
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((p) => fs.existsSync(p));
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: CHROME, headless: true,
  args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--disable-background-timer-throttling'] });
const page = await browser.newPage({ viewport: { width: w, height: h } });
// --dist <folder>: serve a `vite build` output through request routing (no server process needed)
const dist = arg('dist', '');
if (dist) {
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png',
    '.jpg': 'image/jpeg', '.glb': 'model/gltf-binary', '.vrm': 'application/octet-stream', '.fbx': 'application/octet-stream', '.wasm': 'application/wasm' };
  await page.route(base + '/**', async (route) => {
    const u = new URL(route.request().url());
    let f = path.join(dist, decodeURIComponent(u.pathname));
    if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html');
    if (!fs.existsSync(f)) return route.fulfill({ status: 404, body: 'missing' });
    const body = route.request().method() === 'HEAD' ? '' : fs.readFileSync(f);
    return route.fulfill({ status: 200, body, headers: { 'content-type': types[path.extname(f).toLowerCase()] || 'application/octet-stream' } });
  });
}
const errors = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.type() + ': ' + m.text()); });
page.on('pageerror', (e) => errors.push(String(e)));
for (const s of shots) {
  const t0 = Date.now();
  await page.goto(`${base}/character_lab.html?shot=${s}&quality=${quality}${extra}`, { waitUntil: 'load' });
  try { await page.waitForFunction(() => window.__AETHERIA_READY === true || window.__AETHERIA_ERROR, null, { timeout: 180000 }); }
  catch { errors.push('timeout ' + s); }
  const info = await page.evaluate(() => ({ err: window.__AETHERIA_ERROR, chars: window.__AETHERIA_CHARACTERS }));
  const file = path.join(out, `${s}${arg('tag', '') ? '_' + arg('tag', '') : ''}.png`);
  await page.screenshot({ path: file });
  console.log(JSON.stringify({ shot: s, file, ms: Date.now() - t0, error: info.err || null, chars: info.chars }));
}
if (errors.length) console.log('CONSOLE:\n' + [...new Set(errors)].slice(0, 25).join('\n'));
await browser.close();
