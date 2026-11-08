// Screenshot tool for builders and judges.
// Usage: node tools/shoot.mjs --views plaza,street --quality high --out shots [--w 1280 --h 720] [--tag name]
// Requires the dev server at http://127.0.0.1:5173 (started by the orchestrator; do not start another).
// Always run through the heavy-work lock:  node tools/lock.mjs node tools/shoot.mjs ...
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const views = arg('views', 'plaza').split(',');
const quality = arg('quality', 'high');
const out = arg('out', 'shots');
const tag = arg('tag', '');
const w = +arg('w', 1280), h = +arg('h', 720);
const base = arg('url', 'http://127.0.0.1:5173');
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((p) => fs.existsSync(p));

fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({
  executablePath: CHROME, headless: true,
  args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-gpu-rasterization', '--disable-background-timer-throttling'],
});
const page = await browser.newPage({ viewport: { width: w, height: h } });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(String(e)));
for (const v of views) {
  const t0 = Date.now();
  await page.goto(`${base}/?view=${v}&quality=${quality}`, { waitUntil: 'load' });
  try {
    await page.waitForFunction(() => window.__AETHERIA_READY === true || window.__AETHERIA_ERROR, null, { timeout: 180000 });
  } catch { errors.push(`timeout waiting for view ${v}`); }
  const info = await page.evaluate(() => ({ gpu: window.__AETHERIA_GPU, fps: window.__AETHERIA_FPS, err: window.__AETHERIA_ERROR }));
  const file = path.join(out, `${v}${tag ? '_' + tag : ''}.png`);
  await page.screenshot({ path: file });
  console.log(JSON.stringify({ view: v, file, ms: Date.now() - t0, gpu: info.gpu, fps: Math.round(info.fps || 0), error: info.err || null }));
}
if (errors.length) console.log('CONSOLE ERRORS:\n' + [...new Set(errors)].slice(0, 20).join('\n'));
await browser.close();
