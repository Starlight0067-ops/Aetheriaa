const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 960, height: 540 } });
  const errs = []; p.on('console', (m) => { if (['error', 'warning'].includes(m.type())) errs.push(m.type() + ': ' + m.text().slice(0, 300)); }); p.on('pageerror', (e) => errs.push('PAGEERR ' + e.message));
  await p.goto('http://127.0.0.1:5173/?test=1&quality=low&nosave=1');
  await p.waitForFunction(() => window.__game && window.__game.ctx.tick, null, { timeout: 180000 });
  console.log(JSON.stringify(await p.evaluate(() => __game.step(10))));
  console.log(errs.join('\n') || 'no errors');
  await p.screenshot({ path: '/tmp/smoke.png' });
  await b.close();
})();
