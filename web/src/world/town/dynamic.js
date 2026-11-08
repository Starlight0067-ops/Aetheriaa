// Animated town dressing: gate/hall banners, tower flags, lighthouse-style lantern glows and the
// windmill/crystal spinners registered by landmarks.js. One updater for the whole town.
import * as THREE from 'three';
import { createToonMaterial } from '../../render/toon.js';

const TAU = Math.PI * 2;

/** Painted banner: teal or crimson field, gold border, hexagon + crystal-shard crest. */
function bannerTexture(bg, trim) {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = bg; g.fillRect(0, 0, 128, 256);
  g.strokeStyle = trim; g.lineWidth = 7; g.strokeRect(7, 7, 114, 242);
  g.lineWidth = 2; g.strokeRect(15, 15, 98, 226);
  // hexagon crest
  const cx = 64, cy = 102, r = 31;
  g.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = Math.PI / 6 + i * TAU / 6;
    const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
    if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
  }
  g.closePath();
  g.fillStyle = trim; g.fill();
  g.fillStyle = bg; g.beginPath(); g.arc(cx, cy, 21, 0, TAU); g.fill();
  // crystal shard
  g.beginPath(); g.moveTo(cx, cy - 17); g.lineTo(cx + 9, cy - 2); g.lineTo(cx + 3, cy + 16);
  g.lineTo(cx - 8, cy + 10); g.lineTo(cx - 9, cy - 4); g.closePath();
  g.fillStyle = '#7ff5ff'; g.fill();
  g.strokeStyle = '#d8ffff'; g.lineWidth = 2; g.stroke();
  // lower chevrons
  g.strokeStyle = trim; g.lineWidth = 3;
  for (let i = 0; i < 3; i++) {
    const y = 178 + i * 20;
    g.beginPath(); g.moveTo(40, y); g.lineTo(64, y + 9); g.lineTo(88, y); g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function bannerMaterial(kind) {
  const gate = kind !== 'hall';
  return createToonMaterial({
    kind: 'cloth',
    map: bannerTexture(gate ? '#7c2f34' : '#1f7f86', gate ? '#e2b95b' : '#f1e6d0'),
    side: THREE.DoubleSide,
    vertexColors: false,
  });
}

/** Soft radial sprite for the lantern points cloud. */
function glowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,246,210,1)');
  grad.addColorStop(0.18, 'rgba(255,214,126,0.95)');
  grad.addColorStop(0.5, 'rgba(255,164,64,0.28)');
  grad.addColorStop(1, 'rgba(255,150,50,0)');
  g.fillStyle = grad; g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function addBanner(group, mats, b, matsCache) {
  const kind = b.kind || (b.y > 45 ? 'hall' : 'gate');
  const mat = matsCache[kind] || (matsCache[kind] = bannerMaterial(kind));
  const geo = new THREE.PlaneGeometry(b.w, b.h, 6, 10);
  geo.translate(0, -b.h / 2, 0);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true; mesh.receiveShadow = true;
  // rod above the cloth
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, b.w + 0.55, 6), mats.metal);
  rod.rotation.z = Math.PI / 2;
  rod.castShadow = true;
  const grp = new THREE.Group();
  grp.position.set(b.x, b.y, b.z);
  grp.rotation.y = b.yaw || 0;
  grp.add(mesh, rod);
  for (const sx of [-1, 1]) {
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.085, 6, 5), mats.gold || mats.metal);
    tip.position.x = sx * (b.w / 2 + 0.28);
    tip.castShadow = true;
    grp.add(tip);
  }
  group.add(grp);
  return {
    mesh,
    base: Float32Array.from(geo.attributes.position.array),
    phase: (b.x * 0.13 + b.z * 0.17) % TAU,
    h: b.h,
    amp: 0.075,
  };
}

function addFlag(group, mats, f, mat) {
  const grp = new THREE.Group();
  grp.position.set(f.x, f.y, f.z);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.06, 2.7, 5), mats.metal);
  pole.position.y = 1.35;
  pole.castShadow = true;
  grp.add(pole);
  const geo = new THREE.PlaneGeometry(1.15, 0.62, 5, 2);
  geo.translate(0.575, -0.31, 0);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.y = 2.62;
  mesh.castShadow = true;
  grp.add(mesh);
  grp.rotation.y = Math.atan2(f.x, f.z) + 0.7;
  group.add(grp);
  return { mesh, base: Float32Array.from(geo.attributes.position.array), phase: (f.x * 0.07 + f.z * 0.11) % TAU, amp: 0.11, h: 0.62 };
}

export function createDynamics(ctx, plan, mats, dyn, group) {
  const spinners = (dyn.spinners || []).map((s) => ({
    ...s,
    phase: (s.obj.position.x * 0.17 + s.obj.position.z * 0.11) % TAU,
  }));
  const banners = [];
  const flags = [];
  const matsCache = {};
  for (const b of dyn.banners || []) {
    try { banners.push(addBanner(group, mats, b, matsCache)); }
    catch (e) { console.warn('[town] banner failed', e); }
  }
  const flagMat = createToonMaterial({ kind: 'cloth', color: 0x2b9c9a, side: THREE.DoubleSide, vertexColors: false });
  const wantFlags = ctx.quality.name !== 'low';
  if (wantFlags) {
    for (const f of dyn.flags || []) {
      try { flags.push(addFlag(group, mats, f, flagMat)); }
      catch (e) { console.warn('[town] flag failed', e); }
    }
  }

  // Lantern heads as one additive points cloud (one draw call, no real lights).
  let lanternMat = null;
  const lanterns = dyn.lanterns || [];
  if (lanterns.length && ctx.quality.name !== 'low') {
    const pos = new Float32Array(lanterns.length * 3);
    lanterns.forEach((l, i) => { pos[i * 3] = l.x; pos[i * 3 + 1] = l.y; pos[i * 3 + 2] = l.z; });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    lanternMat = new THREE.PointsMaterial({
      map: glowTexture(), size: 1.15, sizeAttenuation: true, transparent: true,
      blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.75,
      color: 0xffc46a,
    });
    const pts = new THREE.Points(geo, lanternMat);
    pts.frustumCulled = false;
    group.add(pts);
  }

  function wave(item, time, normal) {
    const p = item.mesh.geometry.attributes.position;
    const a = p.array, base = item.base;
    for (let i = 0; i < p.count; i++) {
      const bx = base[i * 3], by = base[i * 3 + 1], bz = base[i * 3 + 2];
      const t = Math.max(0, -by / Math.max(0.01, item.h || 0.62));
      const w = Math.sin(time * 1.55 + bx * 1.3 + by * 0.7 + item.phase);
      a[i * 3] = bx + w * item.amp * t;
      a[i * 3 + 2] = bz + Math.cos(time * 1.15 + by * 0.9 + item.phase) * item.amp * t;
    }
    p.needsUpdate = true;
    if (normal) item.mesh.geometry.computeVertexNormals();
  }

  ctx.updaters.push((dt, time) => {
    for (const s of spinners) {
      if (!s.obj) continue;
      s.obj.rotation[s.axis] += (s.speed || 0.4) * dt;
      if (s.bob) s.obj.position.y = s.baseY + Math.sin(time * 1.2 + s.phase) * s.bob;
    }
    // banners are the hero cloth: per-vertex wave + normal update
    for (const b of banners) wave(b, time, true);
    // flags: cheaper normals (they are small)
    for (const f of flags) wave(f, time, false);
    if (lanternMat) lanternMat.opacity = 0.66 + Math.sin(time * 2.1) * 0.07 + Math.sin(time * 5.7) * 0.035;
    if (mats.glow?.emissiveIntensity !== undefined) mats.glow.emissiveIntensity = 1.55 + Math.sin(time * 3.1) * 0.09;
    if (mats.aether?.emissiveIntensity !== undefined) mats.aether.emissiveIntensity = 2.2 + Math.sin(time * 1.7) * 0.12;
  });

  return { banners: banners.length, flags: flags.length, lanterns: lanterns.length, spinners: spinners.length };
}
