// AETHERIA web — bootstrap and frame loop.
// Module contract: every system exports `async function create(ctx)` and returns its API.
// Per-frame work is registered with ctx.updaters.push((dt, time) => ...).
import * as THREE from 'three';
import { resolveQuality } from './core/quality.js';
import { createAssets } from './core/assets.js';
import { createInput } from './core/input.js';
import { VIEWS } from './core/layout.js';
import * as lighting from './render/lighting.js';
import * as sky from './render/sky.js';
import * as pipeline from './render/pipeline.js';
import * as world from './world/index.js';
import * as player from './player/player.js';

const params = new URLSearchParams(location.search);
const shot = params.has('view');
if (shot) document.body.classList.add('shot');
const quality = resolveQuality(params.get('quality'));

const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance', stencil: false, preserveDrawingBuffer: shot });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, quality.pixelRatio));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = quality.shadows;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.getElementById('app').appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, quality.drawDistance);
const clock = new THREE.Clock();

const ctx = {
  THREE, renderer, scene, camera, quality, params, shot,
  assets: createAssets(renderer, quality),
  input: createInput(renderer.domElement, { shot }),
  updaters: [],      // (dt, time) => void, run every frame in registration order
  colliders: [],     // static collider descriptors pushed by world modules (consumed by player/physics)
  pending: [],       // promises that must settle before the frame counts as "ready" for screenshots
  systems: {},
  cameraLocked: false,
  time: 0,
};
window.__AETHERIA = ctx;

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

let fpsAvg = 60;
async function boot() {
  ctx.systems.lighting = await lighting.create(ctx);
  ctx.systems.sky = await sky.create(ctx);
  ctx.systems.world = await world.create(ctx);
  ctx.systems.player = await player.create(ctx);
  ctx.systems.pipeline = await pipeline.create(ctx);
  applyView();
  const loading = document.getElementById('loading');
  loading.style.opacity = '0';
  setTimeout(() => loading.remove(), 700);
  await Promise.allSettled(ctx.pending);
  let frames = 0;
  renderer.setAnimationLoop(() => {
    const dt = Math.min(clock.getDelta(), 1 / 20);
    ctx.time += dt;
    for (const u of ctx.updaters) u(dt, ctx.time);
    ctx.viewUpdate?.();
    ctx.systems.pipeline.render(dt);
    ctx.input.endFrame();
    fpsAvg = fpsAvg * 0.95 + (1 / Math.max(dt, 1e-4)) * 0.05;
    window.__AETHERIA_FPS = fpsAvg;
    if (++frames === 90) window.__AETHERIA_READY = true;
  });
}

boot().catch((e) => {
  console.error(e);
  document.getElementById('loading').textContent = 'Error: ' + e.message;
  window.__AETHERIA_ERROR = String(e && e.stack || e);
});
