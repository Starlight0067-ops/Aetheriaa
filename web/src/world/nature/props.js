// Nature props (owner: nature): mossy rocks, cliff outcrops, fallen logs, stumps, bushes (green and
// flowering), hedges and riverside reeds/cattails. Instanced, CPU distance + frustum culled.
import * as THREE from 'three';
import { WORLD, POI, RIVER, TOWN, heightAt } from '../../core/layout.js';
import { createToonMaterial } from '../../render/toon.js';
import { mulberry32, hash2i, vnoise, sstep } from './common.js';
import { Builder, card, randUnit, windPatch, depthMaterialFor } from './trees.js';
import { forestField, heightFast, slopeAt, splatAt, pathDist, streetDist, inTown, dTown, dLake, waterLevelAt, nearBridge, riverDist, PATHS } from './worlddata.js';

const V3 = THREE.Vector3;
const UP = new V3(0, 1, 0);

// ------------------------------------------------------------------ geometry
function rockGeometry(seed, opts = {}) {
  const rnd = mulberry32(seed);
  let g = new THREE.IcosahedronGeometry(1, opts.detail ?? 1);
  g = g.toNonIndexed();
  const p = g.attributes.position;
  // displace by smooth noise on the unit sphere (per original direction so shared corners stay welded)
  const k1 = 1.3 + rnd(), off = rnd() * 50;
  const disp = (x, y, z) => 1 + 0.32 * (vnoise(x * k1 + off, z * k1 + y * 0.7, seed) - 0.5) + 0.18 * (vnoise(y * 2.3 + off, x * 2.1 + z, seed + 3) - 0.5);
  const sx = opts.sx ?? (0.9 + rnd() * 0.5), sy = opts.sy ?? (0.55 + rnd() * 0.35), sz = opts.sz ?? (0.8 + rnd() * 0.4);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const d = disp(x, y, z);
    let ny = y * d * sy;
    if (ny < -0.25) ny = -0.25 + (ny + 0.25) * 0.3; // flattened base, sits in the ground
    p.setXYZ(i, x * d * sx, ny + 0.2, z * d * sz);
  }
  g.computeVertexNormals(); // non-indexed -> faceted planes
  const n = g.attributes.normal;
  const col = new Float32Array(p.count * 3), uv = new Float32Array(p.count * 2);
  const moss = new THREE.Color(0x6f9a3c), stone = new THREE.Color(1, 1, 1), c = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    const ny = n.getY(i), x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const m = sstep(0.45, 0.8, ny + (vnoise(x * 3, z * 3, seed + 9) - 0.5) * 0.5) * (opts.moss ?? 1);
    c.copy(stone).lerp(moss, m * 0.85);
    const ao = 0.62 + 0.38 * sstep(-0.1, 0.6, y);
    col.set([c.r * ao, c.g * ao, c.b * ao], i * 3);
    const ax = Math.abs(n.getX(i)), az = Math.abs(n.getZ(i));
    const s = opts.uvScale ?? 0.35;
    if (Math.abs(ny) > Math.max(ax, az)) uv.set([x * s, z * s], i * 2); else if (ax > az) uv.set([z * s, y * s], i * 2); else uv.set([x * s, y * s], i * 2);
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.computeBoundingSphere();
  return g;
}

function logGeometry(len, r, stump) {
  const B = new Builder();
  const sides = 9, rings = stump ? 3 : 5;
  const H = stump ? len : 0;
  const pts = [];
  for (let i = 0; i < rings; i++) {
    const t = i / (rings - 1);
    pts.push(stump ? new V3(0, t * len, 0) : new V3(0, r * 0.82, (t - 0.5) * len));
  }
  const tan = stump ? UP : new V3(0, 0, 1);
  const a0 = stump ? new V3(1, 0, 0) : new V3(0, 1, 0), b0 = stump ? new V3(0, 0, 1) : new V3(1, 0, 0);
  const start = B.count;
  for (let i = 0; i < rings; i++) {
    const t = i / (rings - 1);
    const rr = stump ? r * (1 + 0.55 * Math.pow(1 - t, 3)) : r * (1 - 0.12 * t);
    for (let s = 0; s <= sides; s++) {
      const a = (s / sides) * Math.PI * 2;
      const d = a0.clone().multiplyScalar(Math.cos(a)).addScaledVector(b0, Math.sin(a));
      const p = pts[i].clone().addScaledVector(d, rr * (1 + 0.06 * Math.sin(a * 3 + i)));
      const mossy = stump ? 0.0 : sstep(0.3, 0.9, d.y);
      const c = [0.8 - mossy * 0.25, 0.72 + mossy * 0.05, 0.6 - mossy * 0.25];
      B.vert(p, d, s / sides * 2, t * len * 0.6, c, d, [0, 0, 0, 0]);
    }
  }
  for (let i = 0; i < rings - 1; i++) for (let s = 0; s < sides; s++) {
    const a = start + i * (sides + 1) + s, b = a + sides + 1;
    B.idx.push(a, b, a + 1, a + 1, b, b + 1);
  }
  // end caps (light wood with rings via uv into a light part of the bark is fine; colour carries it)
  const caps = stump ? [[pts[rings - 1], UP.clone(), r]] : [[pts[0], new V3(0, 0, -1), r], [pts[rings - 1], new V3(0, 0, 1), r * 0.88]];
  for (const [c, n, rr] of caps) {
    const ci = B.vert(c, n, 0.5, 0.5, [1.25, 1.05, 0.75], n, [0, 0, 0, 0]);
    for (let s = 0; s <= sides; s++) {
      const a = (s / sides) * Math.PI * 2;
      const d = a0.clone().multiplyScalar(Math.cos(a)).addScaledVector(b0, Math.sin(a));
      B.vert(c.clone().addScaledVector(d, rr), n, 0.5 + Math.cos(a) * 0.05, 0.5 + Math.sin(a) * 0.05, [1.0, 0.8, 0.55], n, [0, 0, 0, 0]);
    }
    // winding: compare the first triangle's facing with the cap normal
    const P = (i) => new V3(B.pos[i * 3], B.pos[i * 3 + 1], B.pos[i * 3 + 2]);
    const f = new V3().subVectors(P(ci + 1), P(ci)).cross(new V3().subVectors(P(ci + 2), P(ci)));
    const flip = f.dot(n) < 0;
    for (let s = 0; s < sides; s++) {
      const a = ci + 1 + s, b = ci + 2 + s;
      if (flip) B.idx.push(ci, b, a); else B.idx.push(ci, a, b);
    }
  }
  return B.geometry();
}

function bushGeometry(seed, kind) {
  const rnd = mulberry32(seed);
  const B = new Builder();
  const clumps = [];
  if (kind === 'hedge') {
    for (let i = 0; i < 4; i++) clumps.push({ c: new V3((i - 1.5) * 0.75, 0.75, (rnd() - 0.5) * 0.15), r: 0.75 });
  } else {
    const n = 1 + ((rnd() * 3) | 0);
    for (let i = 0; i < n; i++) {
      const a = rnd() * 6.28, d = i === 0 ? 0 : 0.6 + rnd() * 0.4;
      const r = (i === 0 ? 0.95 : 0.7) * (0.85 + rnd() * 0.3);
      clumps.push({ c: new V3(Math.cos(a) * d, r * 0.8, Math.sin(a) * d), r });
    }
  }
  const all = new V3(); clumps.forEach((c) => all.add(c.c)); all.divideScalar(clumps.length);
  const ext = kind === 'hedge' ? new V3(2.2, 1.0, 1.0) : new V3(1.5, 1.1, 1.5);
  for (const cl of clumps) {
    const n = Math.round(cl.r * cl.r * (kind === 'hedge' ? 14 : 12));
    for (let i = 0; i < n; i++) {
      const d = randUnit(rnd); if (d.y < -0.3) d.y = -d.y * 0.3; d.normalize();
      const c = cl.c.clone().addScaledVector(d, cl.r * (0.4 + 0.6 * Math.sqrt(rnd())));
      const nrm = d.clone().add(randUnit(rnd).multiplyScalar(0.5)).normalize();
      const tang = randUnit(rnd).cross(nrm).normalize();
      const sz = (kind === 'hedge' ? 1.0 : 0.95) * (0.8 + rnd() * 0.4);
      const sf = (p) => new V3().subVectors(p, cl.c).normalize().multiplyScalar(0.6).add(new V3().subVectors(p, all).divide(ext).normalize().multiplyScalar(0.4)).normalize();
      const colFn = (p, s) => { const a = Math.min(1.05, 0.6 + 0.35 * Math.min(1, Math.max(0, p.y / 1.6)) + 0.12 * s.y); return [a, a, a * 0.92 + 0.05]; };
      card(B, c, nrm, tang, sz, sz, [0, 0, 1, 1], colFn, sf, (p) => Math.min(1, p.y * 0.5), rnd(), 1);
    }
  }
  return B.geometry();
}

function reedGeometry() {
  const B = new Builder();
  for (let k = 0; k < 3; k++) {
    const a = k * Math.PI / 3;
    const n = new V3(Math.cos(a), 0, Math.sin(a));
    const t = new V3(-n.z, 0, n.x);
    card(B, new V3(0, 0, 0), n, t, 1.1, 2.0, [0, 0, 1, 1], [1, 1, 1], () => new V3(0, 1, 0), (p) => p.y * p.y * 0.25, k * 0.3, 0.3, false);
  }
  // card() is centred: lift so the base sits at y=0
  const p = B.pos; for (let i = 1; i < p.length; i += 3) p[i] += 1.0;
  return B.geometry();
}

// ------------------------------------------------------------------ instanced prop layer
class PropLayer {
  constructor(group, geometry, material, { maxDist, castShadow = true, receiveShadow = true, depth = null, radius = 2 }) {
    this.geometry = geometry; this.material = material;
    this.maxDist = maxDist; this.radius = radius;
    this.items = [];
    this.opts = { castShadow, receiveShadow, depth };
    this.group = group;
  }
  add(x, y, z, rotY, sx, sy = sx, sz = sx, color = null, tilt = null) {
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion().setFromAxisAngle(UP, rotY);
    if (tilt) q.premultiply(tilt);
    m.compose(new V3(x, y, z), q, new V3(sx, sy, sz));
    this.items.push({ x, y, z, m, c: color || new THREE.Color(1, 1, 1), s: Math.max(sx, sy, sz) });
  }
  finalize() {
    const n = Math.max(1, this.items.length);
    this.mesh = new THREE.InstancedMesh(this.geometry, this.material, n);
    this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3);
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = this.opts.castShadow;
    this.mesh.receiveShadow = this.opts.receiveShadow;
    if (this.opts.depth) this.mesh.customDepthMaterial = this.opts.depth;
    this.mesh.count = 0;
    this.group.add(this.mesh);
  }
  update(p, frustum, sphere) {
    let k = 0;
    const M = this.mesh.instanceMatrix.array, C = this.mesh.instanceColor.array;
    const md2 = this.maxDist * this.maxDist;
    for (const it of this.items) {
      const dx = it.x - p.x, dz = it.z - p.z;
      const d2 = dx * dx + dz * dz;
      if (d2 > md2 * (0.6 + Math.min(it.s, 6) * 0.15)) continue;
      sphere.center.set(it.x, it.y + it.s * 0.5, it.z); sphere.radius = this.radius * it.s + 6;
      if (!frustum.intersectsSphere(sphere)) continue;
      it.m.toArray(M, k * 16); it.c.toArray(C, k * 3); k++;
    }
    this.mesh.count = k;
    this.mesh.visible = k > 0;
    this.mesh.instanceMatrix.needsUpdate = true;
    this.mesh.instanceColor.needsUpdate = true;
  }
}

// ------------------------------------------------------------------ placement
function clearOf(x, z, trees, r) {
  // cheap rejection against nearby tree trunks (grid hash built by caller)
  const key = Math.floor(x / 10) + ',' + Math.floor(z / 10);
  const list = trees.get(key);
  if (!list) return true;
  for (const t of list) if (Math.hypot(t.x - x, t.z - z) < r) return false;
  return true;
}

export function createProps(ctx, tex, treeList) {
  const { quality } = ctx;
  const low = quality.name === 'low';
  const dmul = low ? 0.55 : 1;
  const group = new THREE.Group();
  group.name = 'nature-props';
  ctx.scene.add(group);
  const treeHash = new Map();
  for (const t of treeList) for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) {
    const key = (Math.floor(t.x / 10) + a) + ',' + (Math.floor(t.z / 10) + b);
    if (!treeHash.has(key)) treeHash.set(key, []);
    treeHash.get(key).push(t);
  }
  const ok = (x, z, opts = {}) => {
    if (Math.abs(x) > 316 || Math.abs(z) > 316) return false;
    if (!opts.town && (inTown(x, z) || (dTown(x, z) < TOWN.radius + 3 && x > -112))) return false;
    if (pathDist(x, z) < (opts.path ?? 1.6) || streetDist(x, z) < 3) return false;
    if (nearBridge(x, z, opts.bridge ?? 2)) return false;
    for (const w of POI.windmills) if (Math.hypot(x - w.x, z - w.z) < 12) return false;
    if (Math.hypot(x - POI.core.x, z - POI.core.z) < 45) return false;
    if (!opts.water && heightFast(x, z) < waterLevelAt(x, z) + 0.3) return false;
    return true;
  };

  // materials
  const rockMat = createToonMaterial({ kind: 'stone', map: tex.rock, vertexColors: true });
  const woodMat = createToonMaterial({ kind: 'wood', map: tex.bark, vertexColors: true });
  const bushMat = windPatch(createToonMaterial({ kind: 'foliage', map: tex.broadleaf, alphaTest: 0.5, side: THREE.DoubleSide, vertexColors: true }), 'bush-leaves', 0.12, true);
  const bloomMat = windPatch(createToonMaterial({ kind: 'foliage', map: tex.blossom, alphaTest: 0.5, side: THREE.DoubleSide, vertexColors: true }), 'bush-leaves', 0.12, true);
  const reedMat = windPatch(createToonMaterial({ kind: 'foliage', map: tex.reed, alphaTest: 0.5, side: THREE.DoubleSide, vertexColors: true }), 'reed', 0.35, true);
  const bushDepth = depthMaterialFor(bushMat, 'bush-leaves', 0.12);
  const bloomDepth = depthMaterialFor(bloomMat, 'bush-leaves', 0.12);

  const layers = [];
  const rockLayers = [0, 1, 2, 3].map((i) => new PropLayer(group, rockGeometry(11 + i * 7), rockMat, { maxDist: 190 * (low ? 0.7 : 1), radius: 1.2 }));
  const cliffLayers = [0, 1].map((i) => new PropLayer(group, rockGeometry(101 + i * 13, { sx: 1.6, sy: 1.1, sz: 0.9, uvScale: 0.18, moss: 0.8 }), rockMat, { maxDist: 380, radius: 1.8 }));
  const logLayer = new PropLayer(group, logGeometry(5, 0.36, false), woodMat, { maxDist: 120, radius: 3 });
  const stumpLayer = new PropLayer(group, logGeometry(0.75, 0.42, true), woodMat, { maxDist: 100, radius: 1 });
  const bushLayers = [0, 1, 2].map((i) => new PropLayer(group, bushGeometry(31 + i, 'bush'), bushMat, { maxDist: low ? 110 : 190, depth: bushDepth, radius: 1.6, castShadow: !low }));
  const bloomLayer = new PropLayer(group, bushGeometry(77, 'bush'), bloomMat, { maxDist: low ? 110 : 190, depth: bloomDepth, radius: 1.6, castShadow: !low });
  const hedgeLayer = new PropLayer(group, bushGeometry(55, 'hedge'), bushMat, { maxDist: low ? 120 : 200, depth: bushDepth, radius: 2.2, castShadow: !low });
  const reedLayer = new PropLayer(group, reedGeometry(), reedMat, { maxDist: low ? 70 : 120, castShadow: false, radius: 1.5 });
  layers.push(...rockLayers, ...cliffLayers, logLayer, stumpLayer, ...bushLayers, bloomLayer, hedgeLayer, reedLayer);
  const rnd = mulberry32(2024);
  const tint = (v) => new THREE.Color(0.9 + v * 0.2, 0.9 + v * 0.15, 0.88 + v * 0.18);
  const tilt = (x, z, amt = 1) => {
    const e = 0.8, hx = heightAt(x + e, z) - heightAt(x - e, z), hz = heightAt(x, z + e) - heightAt(x, z - e);
    const n = new V3(-hx, 2 * e, -hz).normalize();
    return new THREE.Quaternion().setFromUnitVectors(UP, n.lerp(UP, 1 - amt).normalize());
  };

  // --- meadow & forest rocks (small clusters)
  const C = 15;
  for (let gz = -340; gz < 340; gz += C) for (let gx = -340; gx < 340; gx += C) {
    const ci = Math.round(gx / C), cj = Math.round(gz / C);
    const f = forestField(gx, gz);
    if (hash2i(ci, cj, 61) > (0.12 + f * 0.12) * dmul) continue;
    const x = gx + (hash2i(ci, cj, 62) - 0.5) * C, z = gz + (hash2i(ci, cj, 63) - 0.5) * C;
    if (!ok(x, z) || !clearOf(x, z, treeHash, 2.5)) continue;
    const n = 1 + ((hash2i(ci, cj, 64) * 3) | 0);
    for (let k = 0; k < n; k++) {
      const a = rnd() * 6.28, d = k === 0 ? 0 : 1.2 + rnd() * 1.5;
      const px = x + Math.cos(a) * d, pz = z + Math.sin(a) * d;
      const s = (k === 0 ? 0.7 + rnd() * 0.9 : 0.3 + rnd() * 0.4);
      rockLayers[(rnd() * 4) | 0].add(px, heightAt(px, pz) - 0.12 * s, pz, rnd() * 6.28, s * (1 + rnd() * 0.3), s, s * (1 + rnd() * 0.3), tint(rnd()), tilt(px, pz, 0.7));
    }
  }
  // --- rocks along paths (accents) and river banks
  for (const p of PATHS) for (let i = 0; i < p.pts.length; i += 2) {
    if (rnd() > 0.32 * dmul) continue;
    const [px0, pz0] = p.pts[i];
    const side = rnd() < 0.5 ? -1 : 1, off = p.width * 0.5 + 0.8 + rnd() * 1.5;
    const nx = p.pts[Math.min(p.pts.length - 1, i + 1)][1] - pz0, nz = -(p.pts[Math.min(p.pts.length - 1, i + 1)][0] - px0);
    const l = Math.hypot(nx, nz) || 1;
    const x = px0 + nx / l * off * side, z = pz0 + nz / l * off * side;
    if (!ok(x, z, { path: 0.8 })) continue;
    const s = 0.35 + rnd() * 0.5;
    rockLayers[(rnd() * 4) | 0].add(x, heightAt(x, z) - 0.08, z, rnd() * 6.28, s * 1.2, s, s, tint(rnd()), tilt(x, z, 0.8));
  }
  for (let s = 0; s < RIVER.length - 1; s++) {
    const [ax, az] = RIVER[s], [bx, bz] = RIVER[s + 1];
    const L = Math.hypot(bx - ax, bz - az), nx = -(bz - az) / L, nz = (bx - ax) / L;
    for (let d = 0; d < L; d += 6) for (const side of [-1, 1]) {
      if (rnd() > 0.45 * dmul) continue;
      const off = 9 + rnd() * 9;
      const x = ax + (bx - ax) * d / L + nx * off * side, z = az + (bz - az) * d / L + nz * off * side;
      if (!ok(x, z, { water: true, bridge: 0 })) continue;
      const h = heightFast(x, z);
      if (h < WORLD.waterLevel - 1.2 || h > WORLD.waterLevel + 3) continue;
      const sc = 0.5 + rnd() * 1.1;
      rockLayers[(rnd() * 4) | 0].add(x, heightAt(x, z) - 0.2 * sc, z, rnd() * 6.28, sc * 1.2, sc * 0.8, sc, new THREE.Color(0.85, 0.88, 0.92), tilt(x, z, 0.6));
    }
  }
  // --- cliff outcrops on steep slopes (river valley, abutments, hills, rim foot)
  const CC = 9;
  for (let gz = -345; gz < 345; gz += CC) for (let gx = -345; gx < 345; gx += CC) {
    const ci = Math.round(gx / CC), cj = Math.round(gz / CC);
    const x = gx + (hash2i(ci, cj, 71) - 0.5) * CC, z = gz + (hash2i(ci, cj, 72) - 0.5) * CC;
    const sl = slopeAt(x, z);
    if (sl < 0.3) continue;
    if (hash2i(ci, cj, 73) > (sl > 0.45 ? 0.75 : 0.35) * (low ? 0.7 : 1)) continue;
    if (Math.max(Math.abs(x), Math.abs(z)) > 316) continue;
    if (inTown(x, z) || nearBridge(x, z, -2) || pathDist(x, z) < 2 || streetDist(x, z) < 3) continue;
    if (heightFast(x, z) < WORLD.waterLevel - 0.5) continue;
    const e = 1.5, hx = heightAt(x + e, z) - heightAt(x - e, z), hz = heightAt(x, z + e) - heightAt(x, z - e);
    const downhill = Math.atan2(-hz, -hx);
    const s = 2.2 + rnd() * 2.8 + (sl > 0.5 ? 2 : 0);
    const q = tilt(x, z, 0.45);
    cliffLayers[(rnd() * 2) | 0].add(x, heightAt(x, z) - s * 0.35, z, -downhill + Math.PI / 2 + (rnd() - 0.5) * 0.6, s * 1.3, s * (0.8 + rnd() * 0.5), s, tint(rnd()), q);
  }
  // --- logs & stumps in forests and edges
  const CL = 22;
  for (let gz = -330; gz < 330; gz += CL) for (let gx = -330; gx < 330; gx += CL) {
    const ci = Math.round(gx / CL), cj = Math.round(gz / CL);
    const f = forestField(gx, gz);
    if (f < 0.15 || hash2i(ci, cj, 81) > 0.5 * dmul) continue;
    const x = gx + (hash2i(ci, cj, 82) - 0.5) * CL, z = gz + (hash2i(ci, cj, 83) - 0.5) * CL;
    if (!ok(x, z) || slopeAt(x, z) > 0.3 || !clearOf(x, z, treeHash, 3.5)) continue;
    if (hash2i(ci, cj, 84) < 0.55) {
      const rot = rnd() * 6.28, s = 0.8 + rnd() * 0.5;
      logLayer.add(x, heightAt(x, z) - 0.12, z, rot, s, s, s, tint(rnd()), tilt(x, z, 1));
    } else stumpLayer.add(x, heightAt(x, z) - 0.1, z, rnd() * 6.28, 0.8 + rnd() * 0.5, 0.8 + rnd() * 0.6, 0.8 + rnd() * 0.5, tint(rnd()));
  }
  // --- bushes: forest edges, tree bases in meadows, town wall foot, path sides
  const CB = 8;
  for (let gz = -340; gz < 340; gz += CB) for (let gx = -340; gx < 340; gx += CB) {
    const ci = Math.round(gx / CB), cj = Math.round(gz / CB);
    const x = gx + (hash2i(ci, cj, 91) - 0.5) * CB, z = gz + (hash2i(ci, cj, 92) - 0.5) * CB;
    const f = forestField(x, z);
    const edge = f > 0.08 && f < 0.7 ? 0.55 : f >= 0.7 ? 0.18 : 0.03;
    const wall = Math.abs(dTown(x, z) - (TOWN.radius + 6)) < 3 && x > -100 ? 0.7 : 0;
    if (hash2i(ci, cj, 93) > Math.max(edge, wall) * dmul) continue;
    if (!ok(x, z, { path: 2.2 }) || slopeAt(x, z) > 0.45 || !clearOf(x, z, treeHash, 1.8)) continue;
    const s = 0.75 + rnd() * 0.6;
    const flowering = hash2i(ci, cj, 94) < 0.12;
    const layer = flowering ? bloomLayer : bushLayers[(rnd() * 3) | 0];
    layer.add(x, heightAt(x, z) - 0.1, z, rnd() * 6.28, s, s * (0.85 + rnd() * 0.3), s, tint(rnd()));
  }
  for (const t of treeList) { // a bush or two at the foot of solitary trees
    if (t.species === 'conifer' || forestField(t.x, t.z) > 0.2 || rnd() > 0.55 * dmul) continue;
    const a = rnd() * 6.28, d = 2.2 + rnd() * 1.5, x = t.x + Math.cos(a) * d, z = t.z + Math.sin(a) * d;
    if (!ok(x, z, { path: 2 })) continue;
    const s = 0.7 + rnd() * 0.4;
    (rnd() < 0.2 ? bloomLayer : bushLayers[(rnd() * 3) | 0]).add(x, heightAt(x, z) - 0.1, z, rnd() * 6.28, s, s, s, tint(rnd()));
  }
  // --- hedges along the west road near the windmills (field boundaries)
  for (const p of PATHS.slice(0, 3)) {
    for (let i = 4; i < p.pts.length - 3; i++) {
      const [x0, z0] = p.pts[i], [x1, z1] = p.pts[i + 1];
      const dx = x1 - x0, dz = z1 - z0, L = Math.hypot(dx, dz) || 1;
      for (const side of [-1, 1]) {
        if (hash2i(i, side + 5, 101) < 0.35) continue;
        const off = p.width * 0.5 + 2.3;
        const x = (x0 + x1) / 2 - dz / L * off * side, z = (z0 + z1) / 2 + dx / L * off * side;
        if (!ok(x, z, { path: 1.2 })) continue;
        const rot = -Math.atan2(dz, dx);
        hedgeLayer.add(x, heightAt(x, z) - 0.15, z, rot, Math.max(1, L / 2.6), 1, 1, tint(rnd()));
      }
    }
  }
  // --- reeds & cattails along the river, lake and pond shores
  const CR = 2.6;
  for (let gz = -340; gz < 340; gz += CR) for (let gx = -340; gx < 340; gx += CR) {
    const x = gx + (rnd() - 0.5) * CR, z = gz + (rnd() - 0.5) * CR;
    const wl = waterLevelAt(x, z), h = heightFast(x, z);
    if (h < wl - 0.6 || h > wl + 0.9) continue;
    if (rnd() > 0.55 * dmul) continue;
    if (nearBridge(x, z, -6) || inTown(x, z)) continue;
    if (vnoise(x * 0.07, z * 0.07, 4) < 0.38) continue; // in clumps, with gaps
    const s = 0.8 + rnd() * 0.6;
    reedLayer.add(x, heightAt(x, z) - 0.2, z, rnd() * 6.28, s, s * (0.85 + rnd() * 0.4), s, new THREE.Color(0.95 + rnd() * 0.1, 1, 0.9 + rnd() * 0.1));
  }

  for (const l of layers) l.finalize();
  const frustum = new THREE.Frustum(), m4 = new THREE.Matrix4(), sphere = new THREE.Sphere();
  const last = new V3(1e9, 0, 0), lastDir = new V3();
  return {
    group, layers,
    update(camera, force = false) {
      const dir = camera.getWorldDirection(new V3());
      if (!force && camera.position.distanceToSquared(last) < 2 && dir.dot(lastDir) > 0.999) return;
      last.copy(camera.position); lastDir.copy(dir);
      camera.updateMatrixWorld();
      m4.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
      frustum.setFromProjectionMatrix(m4);
      for (const l of layers) l.update(camera.position, frustum, sphere);
    },
    count() { return layers.reduce((a, l) => a + l.items.length, 0); },
  };
}
