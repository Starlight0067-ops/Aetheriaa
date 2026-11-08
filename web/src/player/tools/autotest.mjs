// Playwright runner for the in-page player autotest (?autotest=walk).
// Usage (always under the heavy-work lock):
//   node tools/lock.mjs node src/player/tools/autotest.mjs [--quality low] [--out shots/player/autotest] [--mode walk]
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const quality = arg('quality', 'low'), out = arg('out', 'shots/player/autotest'), mode = arg('mode', 'walk');
const base = arg('url', 'http://127.0.0.1:5173');
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((p) => fs.existsSync(p));
fs.mkdirSync(out, { recursive: true });

const browser = await chromium.launch({
  executablePath: CHROME, headless: true,
  args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--disable-background-timer-throttling', '--disable-renderer-backgrounding'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('console', (m) => {
  const t = m.text();
  if (m.type() === 'error' && !/pointer ?lock|requestPointerLock|WrongDocument|NotAllowedError/i.test(t)) errors.push(t);
  if (t.startsWith('[autotest]') || t.startsWith('[player]') || t.startsWith('[physics]')) console.log(t);
});
page.on('pageerror', (e) => { if (!/pointer ?lock|NotAllowedError/i.test(String(e))) errors.push(String(e)); });

await page.goto(`${base}/?autotest=${mode}&quality=${quality}`, { waitUntil: 'load' });
const t0 = Date.now();
let result = null;
while (Date.now() - t0 < 240000) {
  const s = await page.evaluate(() => {
    const T = window.__AETHERIA_TEST;
    return T ? { done: T.done, snap: T.snapRequest, snapDone: T.snapDone, err: window.__AETHERIA_ERROR } : { err: window.__AETHERIA_ERROR };
  });
  if (s.err) { errors.push(s.err); break; }
  if (s.snap && s.snap !== s.snapDone) {
    await page.waitForTimeout(150);
    const file = path.join(out, `${s.snap}.png`);
    await page.screenshot({ path: file });
    console.log('screenshot', file);
    await page.evaluate((n) => { window.__AETHERIA_TEST.snapDone = n; }, s.snap);
  }
  if (s.done) { result = await page.evaluate(() => window.__AETHERIA_TEST); break; }
  await page.waitForTimeout(100);
}
await page.screenshot({ path: path.join(out, 'final.png') });
if (!result) console.log('AUTOTEST DID NOT FINISH');
else {
  console.log(JSON.stringify(result.results, null, 1));
  console.log(`AUTOTEST ${result.pass ? 'PASS' : 'FAIL'} in ${Math.round((Date.now() - t0) / 1000)}s`);
}
if (errors.length) console.log('CONSOLE ERRORS:\n' + [...new Set(errors)].slice(0, 20).join('\n'));
await browser.close();
process.exit(result && result.pass && !errors.length ? 0 : 1);
