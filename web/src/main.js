// AETHERIA web — bootstrap and frame loop.
// Module contract: every system exports `async function create(ctx)` and returns its API.
// Per-frame work is registered with ctx.updaters.push((dt, time) => ...).
import * as THREE from 'three';
import { resolveQuality } from './core/quality.js';
import { createAssets, loadMobileManifest, loadProgress } from './core/assets.js';
import { SAFE, SAFE_REASON, PREV_CRASH, armBootFlag } from './core/profile.js';
import { createInput } from './core/input.js';
import { VIEWS } from './core/layout.js';
import * as lighting from './render/lighting.js';
import * as sky from './render/sky.js';
import * as pipeline from './render/pipeline.js';
import * as world from './world/index.js';
import * as player from './player/player.js';
import * as game from './game/index.js';
import { installMem } from './core/mem.js';

const params = new URLSearchParams(location.search);
const shot = params.has('view');
if (shot) document.body.classList.add('shot');
const quality = resolveQuality(params.get('quality'));

const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance', stencil: false, preserveDrawingBuffer: shot });
renderer.setPixelRatio(quality.safe ? quality.pixelRatio : Math.min(window.devicePixelRatio || 1, quality.pixelRatio));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = quality.shadows;
renderer.shadowMap.type = quality.safe ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap;
renderer.info.autoReset = false;          // per-frame draw-call stats are reset in the pipeline (see __mem)
document.getElementById('app').appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, quality.drawDistance);
const timer = new THREE.Timer();

const ctx = {
  THREE, renderer, scene, camera, quality, params, shot,
  assets: createAssets(renderer, quality),
  input: createInput(renderer.domElement, { shot }),
  updaters: [],      // (dt, time) => void, run every frame in registration order
  colliders: [],     // static collider descriptors pushed by world modules (consumed by player/physics)
  pending: [],       // promises that must settle before the frame counts as "ready" for screenshots
  systems: {},
  uiUpdaters: [],    // (rawDt) => void, run every frame even while paused (UI, hit-stop timer)
  hooks: {},         // gameplay hooks called from player.js (preControl)
  paused: false, timeScale: 1,
  testMode: params.has('test'),   // ?test=1: simulation only advances through window.__game.step()
  cameraLocked: false,
  time: 0,
};
window.__AETHERIA = ctx;
window.__AETHERIA_SAFE = { level: SAFE, reason: SAFE_REASON, prevCrash: PREV_CRASH };
installMem(ctx);

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  ctx.systems.pipeline?.resize?.(innerWidth, innerHeight);
});

function applyView() {
  const name = params.get('view');
  const v = name && VIEWS[name];
  if (!v) return;
  ctx.cameraLocked = true;
  camera.fov = v.fov || 55;
  camera.updateProjectionMatrix();
  if (v.follow === 'player') {
    ctx.viewUpdate = () => {
      const p = ctx.systems.player?.object;
      if (!p) return;
      const yaw = p.rotation.y;
      const off = new THREE.Vector3(...v.offset).applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
      camera.position.copy(p.position).add(off);
      camera.lookAt(p.position.clone().add(new THREE.Vector3(...v.look)));
    };
  } else {
    camera.position.set(...v.pos);
    camera.lookAt(new THREE.Vector3(...v.target));
  }
}

// ---- loading screen + fatal (context lost / crash) overlay
const ldFill = document.getElementById('ld-fill'), ldMsg = document.getElementById('ld-msg');
const STAGES = ['lighting', 'sky', 'world', 'player', 'post', 'game'];
let stageIdx = 0;
function setStage(i) { stageIdx = i; progress(); memLog('stage ' + STAGES[i]); }
export function memLog(tag) { if (params.has('memlog') && performance.memory) console.info('[mem]', tag, (performance.memory.usedJSHeapSize / 1048576).toFixed(0) + ' MB, tex ' + renderer.info.memory.textures + ' geo ' + renderer.info.memory.geometries); }
window.__memLog = memLog;
function progress() {
  const f = loadProgress.total ? Math.min(1, loadProgress.done / loadProgress.total) : 0;
  const pct = Math.min(99, ((stageIdx + (stageIdx === 2 ? f : 0.5)) / STAGES.length) * 100);
  if (ldFill) ldFill.style.width = pct.toFixed(0) + '%';
  if (ldMsg) ldMsg.textContent = (quality.safe ? 'mobile-safe · ' : '') + STAGES[stageIdx] + '…';
}
const progTimer = setInterval(progress, 250);
function showFatal(msg) {
  const f = document.getElementById('fatal');
  if (!f) return;
  document.getElementById('fatal-msg').textContent = msg;
  const b = document.getElementById('fatal-btn');
  b.onclick = () => { try { localStorage.setItem('aetheria.boot', String(Date.now())); } catch { /* ignore */ } location.reload(); };
  f.style.display = 'grid';
}
renderer.domElement.addEventListener('webglcontextlost', (e) => {
  e.preventDefault();
  renderer.setAnimationLoop(null);
  showFatal(quality.safe
    ? 'The graphics context was lost (the device ran out of memory). Reload to continue in an even lighter mode.'
    : 'The graphics context was lost. Reload the page to continue.');
}, false);

let fpsAvg = 60;
// iOS: free decoded-image copies once they live on the GPU (the glTF/texture caches keep the Source objects alive)
function sweepTextures() {
  if (!quality.safe) return;
  const props = renderer.properties;
  const bySource = new Map();
  scene.traverse((o) => {
    if (!o.isMesh) return;
    for (const m of (Array.isArray(o.material) ? o.material : [o.material])) {
      if (!m) continue;
      for (const k in m) {
        const t = m[k];
        if (!t || !t.isTexture || t.isCompressedTexture || t.isCanvasTexture || t.isDataTexture || t.isCubeTexture || t.isRenderTargetTexture) continue;
        const src = t.source; if (!src || !src.data) continue;
        const up = !!props.has(t) && !!props.get(t).__webglTexture;
        const e = bySource.get(src) || { all: true };
        e.all = e.all && up; bySource.set(src, e);
      }
    }
  });
  for (const [src, e] of bySource) {
    if (!e.all) continue;
    try { src.data.close?.(); } catch { /* not an ImageBitmap */ }
    src.data = null;
  }
}

async function boot() {
  armBootFlag(ctx);
  await loadMobileManifest();
  setStage(0);
  ctx.systems.lighting = await lighting.create(ctx);
  setStage(1);
  ctx.systems.sky = await sky.create(ctx);
  setStage(2);
  ctx.systems.world = await world.create(ctx);
  setStage(3);
  ctx.systems.player = await player.create(ctx);
  setStage(4);
  ctx.systems.pipeline = await pipeline.create(ctx);
  setStage(5);
  try { ctx.systems.game = await game.create(ctx); } catch (e) { console.error('[game] failed', e); }
  applyView();
  clearInterval(progTimer);
  const loading = document.getElementById('loading');
  loading.style.opacity = '0';
  setTimeout(() => loading.remove(), 700);
  await Promise.allSettled(ctx.pending);
  let frames = 0;
  timer.update();
  ctx.tick = (raw) => {
    const dt = raw * ctx.timeScale;
    ctx.rawDt = raw;
    ctx.time += dt;
    if (!ctx.paused) for (const u of ctx.updaters) u(dt, ctx.time);
    for (const u of ctx.uiUpdaters) u(raw);
    ctx.viewUpdate?.();
  };
  renderer.setAnimationLoop(() => {
    timer.update();
    const raw = Math.min(timer.getDelta(), 1 / 20);
    if (!ctx.testMode) { ctx.tick(raw); ctx.input.endFrame(); }
    if (!ctx.testMode || ctx.renderOnce) { ctx.renderOnce = false; ctx.systems.pipeline.render(raw); }   // ?test=1 renders only on demand (__game.render())
    fpsAvg = fpsAvg * 0.95 + (1 / Math.max(raw, 1e-4)) * 0.05;
    window.__AETHERIA_FPS = fpsAvg;
    if (++frames === 90) { window.__AETHERIA_READY = true; ctx.assets.releaseDecoders?.(); setTimeout(sweepTextures, 1500); setTimeout(sweepTextures, 8000); setInterval(sweepTextures, 30000); }
  });
}

boot().catch((e) => {
  console.error(e);
  clearInterval(progTimer);
  document.getElementById('loading').textContent = 'Error: ' + e.message;
  if (quality.safe) showFatal('The game could not start (' + e.message + '). Reload to try again.');
  window.__AETHERIA_ERROR = String(e && e.stack || e);
});
