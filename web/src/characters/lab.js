// Character Lab (owner: character agent): /character_lab.html
//   ?shot=lineup                 whole cast in a row (default)
//   ?shot=kael                   one character, full body (add &rot=45 to turn, &action=run, &t=0.4 to scrub)
//   ?shot=portrait-kael          head-and-shoulders close-up
//   ?shot=turnaround-kael        front / side / back / side
//   &quality=low|medium|high|ultra   &w=..&h=.. ignored (use the viewport)
// Sets window.__AETHERIA_READY = true once every model and clip is loaded and a few frames have rendered.
import * as THREE from 'three';
import { resolveQuality } from '../core/quality.js';
import { createAssets } from '../core/assets.js';
import { createToonMaterial } from '../render/toon.js';
import { createCharacter, CATALOG } from './index.js';

const params = new URLSearchParams(location.search);
const shotParam = params.get('shot');
const isShot = !!shotParam;
if (isShot) document.body.classList.add('shot');
const shot = shotParam || 'lineup';
const quality = resolveQuality(params.get('quality') || 'high');

const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: isShot, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, Math.max(1, quality.pixelRatio)));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.getElementById('app').appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(30, innerWidth / innerHeight, 0.05, 200);

// studio backdrop: vertical gradient with a soft cyan glow behind the cast
{
  const c = document.createElement('canvas'); c.width = 16; c.height = 512;
  const g = c.getContext('2d');
  const grd = g.createLinearGradient(0, 0, 0, 512);
  grd.addColorStop(0, '#1b2440'); grd.addColorStop(0.55, '#33476a'); grd.addColorStop(0.78, '#6c86a8'); grd.addColorStop(1, '#2a3550');
  g.fillStyle = grd; g.fillRect(0, 0, 16, 512);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  scene.background = t;
}
// lights: warm key (sun), sky-tinted hemisphere fill, cool back rim
const hemi = new THREE.HemisphereLight(0xcfe6ff, 0x5c6a9c, 1.1);
scene.add(hemi);
const key = new THREE.DirectionalLight(0xfff0dc, 2.7);
key.position.set(-3.5, 6, 6);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
Object.assign(key.shadow.camera, { left: -7, right: 7, top: 5, bottom: -2, near: 0.5, far: 30 });
key.shadow.bias = -0.0004; key.shadow.normalBias = 0.02;
scene.add(key, key.target);
const rim = new THREE.DirectionalLight(0xa9e9ff, 1.6);
rim.position.set(4, 4, -6);
scene.add(rim);
// floor: soft disc
const floor = new THREE.Mesh(new THREE.CircleGeometry(9, 64), createToonMaterial({ color: 0x8fa0b8, kind: 'stone' }));
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);
const ringMat = createToonMaterial({ color: 0x7ff5ff, kind: 'glow', emissive: 0x7ff5ff, emissiveIntensity: 0.6 });

const ctx = { THREE, renderer, scene, camera, quality, params, shot: isShot, assets: createAssets(renderer, quality), updaters: [], pending: [], systems: {}, time: 0 };
window.__AETHERIA = ctx;

const ORDER = ['toma', 'lyra', 'ostin', 'kael', 'hesk', 'maren', 'wenna', 'veyra'];
const chars = [];
const hud = document.getElementById('hud');

function frame(center, height, dist, lookY) {
  camera.position.set(center.x, lookY, center.z + dist);
  camera.lookAt(center.x, lookY, center.z);
}

async function build() {
  const action = params.get('action');
  const rot = THREE.MathUtils.degToRad(+params.get('rot') || 0);
  let spec;
  if (shot === 'lineup') spec = ORDER.map((id, i) => ({ id, x: (i - (ORDER.length - 1) / 2) * 1.05, ry: 0 }));
  else if (shot.startsWith('turnaround-')) {
    const id = shot.slice(11);
    spec = [0, -90, 180, 90].map((d, i) => ({ id, x: (i - 1.5) * 1.1, ry: THREE.MathUtils.degToRad(d) }));
  } else {
    const id = shot.replace(/^portrait-/, '');
    spec = [{ id, x: 0, ry: rot }];
  }
  const made = await Promise.all(spec.map(async (s) => {
    const c = await createCharacter(ctx, s.id, { npc: s.id !== 'kael' });
    // model faces -Z in its group; the lab camera looks down -Z, so turn it to face the camera
    c.object.rotation.y = Math.PI + s.ry;
    c.object.position.x = s.x;
    scene.add(c.object);
    if (action) c.play(action, { loop: true });
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.34, 0.36, 48), ringMat);
    ring.rotation.x = -Math.PI / 2; ring.position.set(s.x, 0.004, 0);
    scene.add(ring);
    chars.push(c);
    return c;
  }));
  const maxH = Math.max(...made.map((c) => c.height || 1.7));
  if (shot === 'lineup') frame(new THREE.Vector3(0, 0, 0), maxH, 9.2, maxH * 0.52);
  else if (shot.startsWith('turnaround-')) frame(new THREE.Vector3(0, 0, 0), maxH, 6.6, maxH * 0.52);
  else if (shot.startsWith('portrait-')) { camera.fov = 22; camera.updateProjectionMatrix(); const h = made[0].height; frame(new THREE.Vector3(0, 0, 0), h, 1.55, h * 0.9); }
  else { const h = made[0].height; frame(new THREE.Vector3(0, 0, 0), h, h * 2.25 + 0.6, h * 0.53); }
  hud.textContent = made.map((c) => `${CATALOG[c.id]?.name || c.id}: ${c.kind} · ${c.height.toFixed(2)} m · clips ${c.actions.length}`).join('   |   ');
  window.__AETHERIA_CHARACTERS = made.map((c) => ({ id: c.id, kind: c.kind, height: c.height, actions: c.actions }));
  buildBar(made);
}

function buildBar(made) {
  if (isShot) return;
  const bar = document.getElementById('bar');
  const acts = ['idle', 'walk', 'run', 'sprint', 'jump', 'fall', 'land', 'dodge', 'attack1', 'attack2', 'attack3', 'cast', 'hit', 'death', 'talk', 'wave', 'interact', 'sit'];
  for (const a of acts) {
    const b = document.createElement('button'); b.textContent = a;
    b.onclick = () => { for (const c of made) c.play(a); };
    bar.appendChild(b);
  }
  const spin = document.createElement('button'); spin.textContent = 'turntable'; spin.className = 'on';
  spin.onclick = () => { turntable = !turntable; spin.classList.toggle('on', turntable); };
  bar.appendChild(spin);
  for (const e of ['happy', 'angry', 'sad', 'surprised']) {
    const b = document.createElement('button'); b.textContent = e;
    b.onclick = () => { b.classList.toggle('on'); for (const c of made) c.setExpression(e, b.classList.contains('on') ? 1 : 0); };
    bar.appendChild(b);
  }
}

let turntable = !isShot;
addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });

const clock = new THREE.Clock();
build().then(async () => {
  const scrub = +params.get('t') || 0;
  // deterministic warm-up so screenshots show a settled pose (and the scrub time if requested)
  for (let i = 0; i < 30; i++) for (const u of ctx.updaters) u(1 / 30, (ctx.time += 1 / 30));
  if (scrub) for (let t = 0; t < scrub; t += 1 / 60) for (const u of ctx.updaters) u(1 / 60, (ctx.time += 1 / 60));
  let frames = 0;
  renderer.setAnimationLoop(() => {
    const dt = Math.min(clock.getDelta(), 1 / 20);
    if (!isShot || !params.has('freeze')) { ctx.time += dt; for (const u of ctx.updaters) u(isShot ? 0 : dt, ctx.time); }
    if (turntable) for (const c of chars) c.object.rotation.y += dt * 0.4;
    renderer.render(scene, camera);
    if (++frames === 10) window.__AETHERIA_READY = true;
  });
}).catch((e) => {
  console.error(e);
  window.__AETHERIA_ERROR = String(e && e.stack || e);
  hud.textContent = 'Error: ' + e.message;
});
