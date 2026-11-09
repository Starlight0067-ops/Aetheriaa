// Evaluates a JS expression in the running game once it is ready and prints the JSON result.
// Usage: node tools/lock.mjs node tools/probe.mjs "<query string>" "<js expression>" [waitMs]
import { chromium } from 'playwright-core';
import fs from 'node:fs';

const [query = '', expr = 'null', waitMs = '0'] = process.argv.slice(2);
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((p) => fs.existsSync(p));
const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto('http://127.0.0.1:5173/?' + query, { waitUntil: 'load' });
await page.waitForFunction(() => window.__AETHERIA_READY === true || window.__AETHERIA_ERROR, null, { timeout: 180000 }).catch(() => errors.push('timeout'));
if (+waitMs) await page.waitForTimeout(+waitMs);
const out = await page.evaluate((e) => { try { return eval(e); } catch (err) { return 'ERR ' + err.message; } }, expr);
console.log(JSON.stringify(out, null, 1));
if (errors.length) console.log('ERRORS:\n' + [...new Set(errors)].slice(0, 15).join('\n'));
await browser.close();
