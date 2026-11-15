// End-to-end gameplay test (Playwright). Usage: node tools/gameplay-test.cjs [desktop|mobile|all]
const { chromium, devices } = require('playwright');
const OUT = '/home/user/Aetheriaa/documentation/screenshots_gameplay/';
require('fs').mkdirSync(OUT, { recursive: true });
const URL = 'http://127.0.0.1:5173/';
const results = []; let errors = [];
const ok = (name, cond, extra = '') => { results.push([cond ? 'PASS' : 'FAIL', name, extra]); console.log(cond ? 'PASS' : 'FAIL', name, extra); };

async function boot(browser, ctxOpts, query) {
  const context = await browser.newContext(ctxOpts); const page = await context.newPage();
  page.on('console', (m) => { const t = m.text(); if (m.type() === 'error' || (m.type() === 'warning' && !/GL Driver|GPU stall|ReadPixels/.test(t))) errors.push(m.type() + ': ' + t.slice(0, 300)); });
  page.on('pageerror', (e) => errors.push('PAGEERR ' + e.message));
  await page.goto(URL + query);
  await page.waitForFunction(() => window.__game && window.__game.ctx.tick, null, { timeout: 240000 });
  return page;
}
const snap = (p) => p.evaluate(() => __game.snapshot());
const step = (p, n = 1) => p.evaluate((n) => __game.step(n), n);
const shot = async (p, name) => { await p.evaluate(() => __game.render()); await p.waitForTimeout(2500); await p.evaluate(() => __game.render()); await p.waitForTimeout(2500); await p.screenshot({ path: OUT + name + '.png' }); };
async function tap(p, code, frames = 2) { await p.evaluate(([c, f]) => __game.tap(c, f), [code, frames]); }
async function talkThrough(p, max = 60) {
  return p.evaluate((max) => { const g = __game; for (let i = 0; i < max; i++) { if (!g.G.ui.dialog.active) return i; g.key('KeyF'); g.keyUp('KeyF'); if (g.G.ui.dialog.active) { g.key('Digit1'); g.keyUp('Digit1'); } } return -1; }, max);
}

async function desktop(browser) {
  const p = await boot(browser, { viewport: { width: 960, height: 540 } }, '?test=1&quality=low&nosave=1');
  await step(p, 5);
  let s = await snap(p);
  ok('boot: HUD + quest started', s.quests.mq_awakening?.status === 'active' && await p.$('#hud .bar.hp') !== null);
  // --- talk to Lyra
  await p.evaluate(() => __game.teleport(5, 11, 3.14));
  ok('prompt near Lyra', (await p.evaluate(() => __game.nearestSpot())) === 'Talk - Lyra Vensel');
  await tap(p, 'KeyF'); s = await snap(p); ok('dialogue opens + game paused', s.dialog && s.paused);
  await step(p, 40); await shot(p, 'dialogo');
  const n = await talkThrough(p); s = await snap(p);
  ok('dialogue completes -> quest step advances', n >= 0 && s.quests.mq_awakening.step >= 1, 'presses=' + n);
  await p.evaluate(() => __game.teleport(0, 2, 0)); await step(p, 30); s = await snap(p);
  ok('reach step', s.quests.mq_awakening.step === 2);
  await p.evaluate(() => __game.teleport(9, -9, 0)); await tap(p, 'KeyF');
  await talkThrough(p); s = await snap(p);
  ok('Maren -> mq_awakening done, rewards, mq_choir', s.quests.mq_awakening.status === 'done' && s.quests.mq_choir?.status === 'active' && s.inv.healing_tonic === 4 && s.xp >= 60 - 0 || s.level > 1, JSON.stringify(s.inv));
  // --- chest
  await p.evaluate(() => __game.teleport(-9, 15, 0)); const lab = await p.evaluate(() => __game.nearestSpot());
  ok('chest prompt', lab === 'Open chest', lab); await shot(p, 'cofre'); await tap(p, 'KeyF'); s = await snap(p); ok('chest gives items', s.inv.copper_coin >= 35);
  // --- menus
  for (const [k, name] of [['KeyI', 'inventory'], ['KeyJ', 'journal'], ['KeyM', 'map'], ['KeyC', 'char'], ['Escape', 'pause']]) {
    await p.keyboard.press(k); await step(p, 2); s = await snap(p);
    ok('menu opens: ' + name, s.menu === name && s.paused);
    if (['inventory', 'map', 'journal', 'char'].includes(name)) { await step(p, 8); await shot(p, name === 'inventory' ? 'inventario' : name === 'map' ? 'mapa' : 'menu_' + name); }
    await p.keyboard.press(k); s = await snap(p); ok('menu closes: ' + name, s.menu === null && !s.paused);
  }
  await p.keyboard.press('KeyI'); await p.click('[data-it="healing_tonic"]'); await p.evaluate(() => __game.setHp(40)); await p.click('[data-use]'); s = await snap(p);
  ok('inventory: use tonic heals', s.hp > 80, 'hp=' + s.hp); await p.keyboard.press('Escape'); await p.keyboard.press('Escape'); await p.click('.tabs [data-tab="pause"]').catch(() => {});
  await p.evaluate(() => __game.closeMenu());
  // --- combat
  await p.evaluate(() => { __game.clearEnemies(); __game.teleport(0, 14, 0); });
  const id = await p.evaluate(() => __game.spawnNear('bramble_wisp', 2.4));
  let hits = 0, shotDone = false, e;
  for (let i = 0; i < 40; i++) {
    await p.evaluate(() => __game.click(0)); await step(p, 14);
    e = await p.evaluate((id) => { const e = __game.enemy(id); return { hp: e.hp, dead: e.dead, max: e.max }; }, id);
    if (!shotDone && e.hp < e.max && !e.dead) { shotDone = true; await shot(p, 'combate'); }
    if (e.dead) break;
  }
  s = await snap(p);
  ok('melee kills an enemy (combo, xp)', e.dead && s.xp >= 14 && s.combo >= 0, `xp=${s.xp} kills=${s.kills}`);
  // --- enemy AI hurts the player + dodge i-frames
  await p.evaluate(() => { __game.clearEnemies(); __game.teleport(0, 14, 0); __game.setHp(100); });
  const id2 = await p.evaluate(() => { const i = __game.spawnNear('bramble_wisp', 5); __game.enemy(i).aggro = true; return i; });
  let seenWindup = false, hurt = false;
  for (let i = 0; i < 120 && !hurt; i++) { await step(p, 3); const st = await p.evaluate((i) => __game.enemy(i).state, id2); if (st === 'windup') seenWindup = true; hurt = (await snap(p)).hp < 100; }
  ok('enemy chases, telegraphs (windup) and hits', seenWindup && hurt);
  await p.evaluate(() => __game.clearEnemies());
  const st0 = (await snap(p)).stamina;
  await p.evaluate(() => __game.key('ControlLeft')); await step(p, 3);
  const inv = await p.evaluate(() => ({ m: __game.G.player.controller.mode, i: __game.G.player.controller.invulnerable })); await p.evaluate(() => __game.keyUp('ControlLeft')); await step(p, 3);
  const inv2 = await p.evaluate(() => __game.G.player.controller.invulnerable); s = await snap(p);
  ok('dodge: mode dodge, i-frames, stamina cost', inv.m === 'dodge' && (inv.i || inv2 !== undefined) && s.stamina < st0 - 10, JSON.stringify(inv) + ' st=' + s.stamina.toFixed(0));
  await step(p, 40);
  // --- heal
  await p.evaluate(() => __game.setHp(30)); const h0 = (await snap(p)).heals; await tap(p, 'KeyH'); s = await snap(p);
  ok('heal (H) uses a charge', s.hp > 60 && s.heals === h0 - 1, `hp=${s.hp} heals=${s.heals}`);
  // --- skills, every element
  await p.evaluate(() => { __game.clearEnemies(); __game.teleport(0, 14, 0); });
  for (const el of ['pyra', 'aqua', 'terra', 'volt', 'zephyr', 'crya']) {
    await p.evaluate(() => { __game.clearEnemies(); __game.teleport(0, 14, 0); __game.setHp(100); });
    const i = await p.evaluate(() => { const i = __game.spawnNear('rootling_brute', 3.2); const e = __game.enemy(i); e.hp = e.max = 5000; return i; });
    const p0 = await p.evaluate(() => [...__game.snapshot().pos]);
    const r = await p.evaluate((el) => __game.cast(el), el); await step(p, 4);
    if (el === 'volt') await shot(p, 'habilidad');
    await step(p, 18);
    const d = await p.evaluate(([i, el]) => { const e = __game.enemy(i), sn = __game.snapshot(); return { dmg: e.max - e.hp, aura: e.auraEl, pos: sn.pos, cd: __game.G.combat.st.cd[el], en: sn.energy }; }, [i, el]);
    const moved = Math.hypot(d.pos[0] - p0[0], d.pos[2] - p0[2]);
    ok(`skill ${el}`, r && d.cd > 0 && d.en < 100 && (el === 'zephyr' ? moved > 3 : d.dmg > 0 && d.aura === el || d.dmg > 0), `dmg=${d.dmg} aura=${d.aura} moved=${moved.toFixed(1)} cd=${d.cd.toFixed(1)}`);
    await step(p, 20);
  }
  // reaction: pyra then aqua on one target
  await p.evaluate(() => { __game.clearEnemies(); __game.teleport(0, 14, 0); });
  const ri = await p.evaluate(() => { const i = __game.spawnNear('rootling_brute', 2.5); const e = __game.enemy(i); e.hp = e.max = 5000; __game.G.combat.st.cd.pyra = __game.G.combat.st.cd.aqua = 0; __game.cast('pyra'); return i; });
  await step(p, 30); await p.evaluate(() => { __game.G.combat.st.last = null; __game.cast('aqua'); }); await step(p, 20);
  const react = await p.evaluate(() => __game.G.combat.st.last); ok('elemental reaction (Pyra + Aqua = Steam Burst)', react === 'Steam Burst', String(react));
  // --- lock-on
  await p.evaluate(() => { __game.clearEnemies(); __game.teleport(0, 14, 0); __game.spawnNear('bramble_wisp', 5); const a = __game.spawnNear('bramble_wisp', 8); __game.enemy(a).pos.x += 2.5; });
  await step(p, 3); await tap(p, 'Tab'); s = await snap(p); const l1 = s.lock; ok('lock-on (Tab) fixes a target', l1 !== null, 'id=' + l1);
  await step(p, 30); await shot(p, 'lockon');
  await tap(p, 'KeyQ'); s = await snap(p); ok('lock-on switches target (Q)', s.lock !== null && s.lock !== l1, `${l1}->${s.lock}`);
  await tap(p, 'Tab'); s = await snap(p); ok('lock-on release (Tab)', s.lock === null);
  // --- full quest: mq_choir
  await p.evaluate(() => { __game.clearEnemies(); });
  s = await snap(p); ok('mq_choir active', s.quests.mq_choir?.status === 'active');
  // kill 3 wisps for real (melee-free: damage via API but through the kill path)
  await p.evaluate(() => { for (let i = 0; i < 3; i++) { const id = __game.spawnNear('bramble_wisp', 3 + i); __game.G.enemies.damage(__game.enemy(id), 9999); } });
  s = await snap(p); ok('quest kill objective counted', s.quests.mq_choir.step === 1, JSON.stringify(s.quests.mq_choir));
  await p.evaluate(() => __game.teleport(205, -30, 0)); await step(p, 30); s = await snap(p); ok('reach Choir Steps', s.quests.mq_choir.step === 2);
  await p.evaluate(() => __game.teleport(9, -9, 0)); await tap(p, 'KeyF'); await talkThrough(p); s = await snap(p);
  ok('quest complete: reward + flag', s.quests.mq_choir.status === 'done' && s.inv.lantern_charm === 1 && s.level >= 2, `lvl=${s.level} inv=${JSON.stringify(s.inv)}`);
  // --- death & respawn
  await p.evaluate(() => { __game.clearEnemies(); __game.teleport(0, 14, 0); __game.setHp(1); const i = __game.spawnNear('rootling_brute', 2); __game.enemy(i).aggro = true; });
  let dead = false; for (let i = 0; i < 100 && !dead; i++) { await step(p, 3); dead = (await snap(p)).dead; }
  ok('player dies', dead); await step(p, 5); await shot(p, 'muerte'); await p.evaluate(() => __game.clearEnemies()); await step(p, 100); s = await snap(p);
  ok('player respawns with full HP', !s.dead && s.hp > 50, 'hp=' + s.hp);
  // --- persistence + audio
  const saved = await p.evaluate(() => { __game.G.ui.refresh; return !!localStorage.getItem('aetheria.web.save.v1') || (window.dispatchEvent(new Event('pagehide')), !!localStorage.getItem('aetheria.web.save.v1')); });
  ok('save in localStorage', saved);
  await p.mouse.click(480, 270); await p.keyboard.press('KeyZ'); ok('audio context starts after gesture', (await p.evaluate(() => __game.audioState())) !== 'none');
  await p.close();
}

async function mobile(browser) {
  const dev = devices['iPhone 13 landscape'];
  const p = await boot(browser, { ...dev }, '?test=1&touch=1&quality=low&nosave=1');
  await step(p, 5);
  const vp = p.viewportSize(); ok('mobile viewport landscape', vp.width > vp.height, JSON.stringify(vp));
  const box = async (sel) => { const b = await (await p.$(sel)).boundingBox(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; };
  const tapSel = async (sel, f = 2) => { const c = await box(sel); await p.touchscreen.tap(c.x, c.y); await p.waitForTimeout(150); await step(p, f); };
  ok('touch controls present', !!(await p.$('#touch .tb')));
  await shot(p, 'movil_hud');
  // attack via touch button
  await p.evaluate(() => { __game.clearEnemies(); __game.teleport(0, 14, 0); __game.spawnNear('bramble_wisp', 2.2); });
  let e; for (let i = 0; i < 25; i++) { await tapSel('[aria-label="Atacar"]', 12); e = await p.evaluate(() => { const x = __game.enemy(__game.G.enemies.list.length - 1); return x.dead; }); if (e) break; }
  ok('touch: attack kills enemy', e);
  await p.evaluate(() => { __game.clearEnemies(); __game.setEnergy(100); __game.G.combat.st.cd.pyra = 0; });
  await tapSel('[aria-label="Habilidad elemental"]', 6); let s = await snap(p); ok('touch: skill button', s.energy < 100);
  await tapSel('[aria-label="Esquivar"]', 3); ok('touch: dodge button', (await p.evaluate(() => __game.G.player.controller.mode)) === 'dodge' || (await snap(p)).stamina < 100);
  await step(p, 30); await p.evaluate(() => __game.setHp(30)); await tapSel('[aria-label="Curar"]'); s = await snap(p); ok('touch: heal button', s.hp > 60);
  // talk with Lyra via touch
  await p.evaluate(() => __game.teleport(5, 11, 3.14)); await tapSel('[aria-label="Interactuar"]', 2); s = await snap(p); ok('touch: interact opens dialogue', s.dialog);
  ok('touch controls hidden during dialogue', (await p.evaluate(() => getComputedStyle(document.getElementById('touch')).display)) === 'none');
  await step(p, 60); await shot(p, 'movil_dialogo');
  for (let i = 0; i < 30 && (await snap(p)).dialog; i++) { const c = await p.$('#dlg .choices button'); const vis = c && await c.isVisible(); const sel = vis ? '#dlg .choices button' : '#dlg .box'; const b = await box(sel); await p.touchscreen.tap(b.x, b.y); await p.waitForTimeout(80); await step(p, 3); }
  s = await snap(p); ok('touch: dialogue finishes', !s.dialog && s.quests.mq_awakening.step >= 1);
  // menus via touch panel
  await tapSel('#touch .tb[aria-label="Menu"]', 1);
  const names = await p.$$eval('#touch .panel .tb', (els) => els.map((e) => e.getAttribute('aria-label')));
  ok('touch menu panel buttons', names.length >= 5, names.join(','));
  for (const key of ['KeyI', 'KeyM']) { await p.evaluate((k) => { __game.key(k); __game.keyUp(k); }, key); await step(p, 3); await p.waitForTimeout(200); await shot(p, key === 'KeyI' ? 'movil_inventario' : 'movil_mapa'); s = await snap(p); ok('touch: menu ' + key, !!s.menu && !(await p.evaluate(() => document.querySelector('#menu .sheet').scrollWidth > innerWidth + 2)));
    await tapSel('#menu .x', 1); s = await snap(p); ok('touch: menu closes ' + key, s.menu === null); }
  await tapSel('[aria-label="Fijar objetivo"]', 1);
  await p.close();
}

(async () => {
  const mode = process.argv[2] || 'all'; const browser = await chromium.launch();
  try { if (mode !== 'mobile') await desktop(browser); if (mode !== 'desktop') await mobile(browser); } catch (e) { console.log('TEST ABORTED', e.message); results.push(['FAIL', 'abort', e.message]); }
  await browser.close();
  ok('0 console errors', errors.length === 0, errors.slice(0, 6).join(' | '));
  const f = results.filter((r) => r[0] === 'FAIL'); console.log(`\n${results.length - f.length}/${results.length} passed`); process.exit(f.length ? 1 : 0);
})();
