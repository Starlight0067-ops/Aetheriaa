// Diagnostic: load a view and dump player / physics / camera state (no input).
// Usage: node tools/lock.mjs node src/player/tools/probe.mjs --view fullbody [--quality low] [--shot out.png]
import { chromium } from 'playwright-core';
import fs from 'node:fs';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const view = arg('view', ''), quality = arg('quality', 'low'), shot = arg('shot', ''), base = arg('url', 'http://127.0.0.1:5173');
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((p) => fs.existsSync(p));
const browser = await chromium.launch({ executablePath: CHROME, headless: true,
  args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--disable-background-timer-throttling'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const logs = [];
page.on('console', (m) => { const t = m.text(); if (m.type() === 'error' || m.type() === 'warning' || /\[(player|physics|town|char)/i.test(t)) logs.push(m.type() + ': ' + t); });
page.on('pageerror', (e) => logs.push('pageerror: ' + e));
await page.goto(`${base}/?${view ? 'view=' + view + '&' : ''}quality=${quality}`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__AETHERIA_READY === true || window.__AETHERIA_ERROR, null, { timeout: 180000 }).catch(() => logs.push('timeout'));
const info = await page.evaluate(() => {
  const A = window.__AETHERIA, P = A.systems.player, ph = A.systems.physics;
  if (!P) return { error: window.__AETHERIA_ERROR };
  const c = P.controller, p = c.position, r3 = (v) => Math.round(v * 1000) / 1000;
  const near = [];
  ph.world.forEachCollider((col) => {
    const t = col.translation(), d = Math.hypot(t.x - p.x, t.z - p.z);
    if (d < 12 && col !== c.collider && col.shapeType() !== 7) near.push({ d: r3(d), t: [r3(t.x), r3(t.y), r3(t.z)], type: col.shapeType(), he: col.halfExtents ? (() => { const h = col.halfExtents(); return h && [r3(h.x), r3(h.y), r3(h.z)]; })() : null });
  });
  near.sort((a, b) => a.d - b.d);
  const obj = P.visual.object, THREE = A.THREE;
  let meshes = 0, visibleMeshes = 0, skinned = 0;
  obj.updateWorldMatrix(true, true);
  obj.traverse((o) => { if (o.isMesh) { meshes++; if (o.isSkinnedMesh) skinned++; let v = true; for (let q = o; q; q = q.parent) v = v && q.visible; if (v) visibleMeshes++; } });
  const box = new THREE.Box3().setFromObject(obj, true);
  const charInfo = { meshes, visibleMeshes, skinned, box: box.isEmpty() ? null : [box.min.toArray().map(r3), box.max.toArray().map(r3)],
    inScene: (() => { let q = obj; while (q.parent) q = q.parent; return q === A.scene; })(), raw: Object.keys(P.visual.character || {}).slice(0, 20) };
  return {
    charInfo,
    pos: [r3(p.x), r3(p.y), r3(p.z)], facing: r3(c.facing), grounded: c.grounded, mode: c.mode,
    overlapping: c.overlapsAt(p.x, p.y, p.z), respawns: c.respawns,
    rootPos: P.object.position.toArray().map(r3), rootYaw: r3(P.object.rotation.y), modelYaw: r3(P.visual.model.rotation.y),
    visible: P.visual.pivot.visible, placeholder: P.visual.isPlaceholder,
    camera: A.camera.position.toArray().map(r3), fov: A.camera.fov, locked: A.cameraLocked,
    colliders: ph.stats.colliders, pending: ph.stats.pending, frameMs: r3(ph.stats.frameMs), stepMs: r3(ph.stats.stepMs), fps: Math.round(window.__AETHERIA_FPS || 0),
    near: near.slice(0, 8),
  };
});
console.log(JSON.stringify(info, null, 1));
if (shot) await page.screenshot({ path: shot });
console.log(logs.slice(0, 30).join('\n'));
await browser.close();
