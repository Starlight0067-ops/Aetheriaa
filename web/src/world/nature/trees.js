// Procedural anime trees (owner: nature): broadleaf, birch, conifer, flowering (blossom) and willow.
// Branch skeletons -> tube trunks; canopies are painted alpha leaf cards clustered in clumps with normals
// blended toward the clump/crown sphere (soft anime shading) and a `sphereNormal` attribute.
// Rendering: per variant x LOD InstancedMeshes (LOD0 full, LOD1 reduced, LOD2 crossed-card impostor),
// CPU distance LOD + frustum culling, vertex-shader wind with gusts and leaf flutter.
import * as THREE from 'three';
import { createToonMaterial } from '../../render/toon.js';
import { mulberry32, patchMaterial, WIND, WIND_GLSL, HAZE, HAZE_PARS, HAZE_FRAG } from './common.js';

const V3 = THREE.Vector3;
const UP = new V3(0, 1, 0);

// ------------------------------------------------------------------ geometry builder
export class Builder {
  constructor() { this.pos = []; this.nor = []; this.uv = []; this.col = []; this.sph = []; this.wind = []; this.idx = []; }
  get count() { return this.pos.length / 3; }
  vert(p, n, u, v, c, s, w) {
    this.pos.push(p.x, p.y, p.z); this.nor.push(n.x, n.y, n.z); this.uv.push(u, v);
    this.col.push(c[0], c[1], c[2]); this.sph.push(s.x, s.y, s.z); this.wind.push(w[0], w[1], w[2], w[3]);
    return this.count - 1;
  }
  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.setAttribute('sphereNormal', new THREE.Float32BufferAttribute(this.sph, 3));
    g.setAttribute('aWind', new THREE.Float32BufferAttribute(this.wind, 4));
    g.setIndex(this.count > 65535 ? new THREE.Uint32BufferAttribute(this.idx, 1) : new THREE.Uint16BufferAttribute(this.idx, 1));
    g.computeBoundingSphere();
    return g;
  }
}

/** Tube along a polyline with per-point radius (parallel-transport frames). */
function tube(B, pts, radii, sides, H, barkCol, rnd, opts = {}) {
  const n = pts.length;
  const tangents = pts.map((p, i) => new V3().subVectors(pts[Math.min(n - 1, i + 1)], pts[Math.max(0, i - 1)]).normalize());
  let normal = new V3(1, 0, 0);
  if (Math.abs(tangents[0].dot(normal)) > 0.9) normal.set(0, 0, 1);
  normal.sub(tangents[0].clone().multiplyScalar(normal.dot(tangents[0]))).normalize();
  const start = B.count;
  let vAcc = opts.v0 || 0;
  const uRep = Math.max(1, Math.round((2 * Math.PI * radii[0]) / 1.1));
  const ph = rnd() * 10;
  for (let i = 0; i < n; i++) {
    if (i > 0) {
      const axis = new V3().crossVectors(tangents[i - 1], tangents[i]);
      const l = axis.length();
      if (l > 1e-5) normal.applyAxisAngle(axis.divideScalar(l), Math.asin(Math.min(1, l)));
      vAcc += pts[i].distanceTo(pts[i - 1]) / (2 * Math.PI * Math.max(0.12, radii[i]) / uRep) / uRep * 0.5;
    }
    const bin = new V3().crossVectors(normal, tangents[i]).normalize();
    const hw = Math.pow(Math.max(0, pts[i].y) / H, 2);
    const ao = opts.aoBase !== undefined ? Math.min(1, opts.aoBase + pts[i].y * 0.25) : 1;
    for (let s = 0; s <= sides; s++) {
      const a = (s / sides) * Math.PI * 2;
      const d = new V3().addScaledVector(normal, Math.cos(a)).addScaledVector(bin, Math.sin(a));
      const p = pts[i].clone().addScaledVector(d, radii[i]);
      const c = [barkCol[0] * ao, barkCol[1] * ao, barkCol[2] * ao];
      B.vert(p, d, (s / sides) * uRep, vAcc, c, d, [hw, ph, 0, 0]);
    }
  }
  for (let i = 0; i < n - 1; i++) for (let s = 0; s < sides; s++) {
    const a = start + i * (sides + 1) + s, b = a + sides + 1;
    B.idx.push(a, b, a + 1, a + 1, b, b + 1);
  }
}

/** Leaf card. normal blended toward sphere directions; returns nothing. */
export function card(B, center, nrm, tang, w, h, uvRect, col, sphereFn, windW, phase, flutter, anchorTop = false) {
  const bin = new V3().crossVectors(nrm, tang).normalize();
  const t = tang.clone().normalize();
  const i0 = B.count;
  const corners = anchorTop ? [[-0.5, 0], [0.5, 0], [0.5, -1], [-0.5, -1]] : [[-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5]];
  const uvs = [[uvRect[0], uvRect[1]], [uvRect[2], uvRect[1]], [uvRect[2], uvRect[3]], [uvRect[0], uvRect[3]]];
  for (let k = 0; k < 4; k++) {
    const p = center.clone().addScaledVector(t, corners[k][0] * w).addScaledVector(bin, corners[k][1] * h);
    const s = sphereFn(p);
    const n = nrm.clone().multiplyScalar(0.22).add(s).normalize();
    const c = typeof col === 'function' ? col(p, s) : col;
    const ww = typeof windW === 'function' ? windW(p, k) : windW;
    B.vert(p, n, uvs[k][0], uvs[k][1], c, s, [ww, phase, flutter, 0]);
  }
  B.idx.push(i0, i0 + 1, i0 + 2, i0, i0 + 2, i0 + 3);
}

export function randUnit(rnd) {
  const u = rnd() * 2 - 1, a = rnd() * Math.PI * 2, r = Math.sqrt(1 - u * u);
  return new V3(r * Math.cos(a), u, r * Math.sin(a));
}

// ------------------------------------------------------------------ skeletons
/** Grows a branch polyline from p0 along dir with upward curl. */
function grow(p0, dir, len, segs, curl, rnd, wobble = 0.15) {
  const pts = [p0.clone()];
  const d = dir.clone().normalize();
  const step = len / segs;
  for (let i = 1; i <= segs; i++) {
    d.addScaledVector(UP, curl).add(new V3((rnd() - 0.5) * wobble, (rnd() - 0.5) * wobble * 0.5, (rnd() - 0.5) * wobble)).normalize();
    pts.push(pts[i - 1].clone().addScaledVector(d, step));
  }
  return pts;
}
const taper = (n, r0, r1) => Array.from({ length: n }, (_, i) => r0 + (r1 - r0) * (i / (n - 1)));

function skeletonBroadleaf(rnd, s) {
  const H = 11.5 * s, trunkH = (2.5 + rnd() * 0.7) * s;
  const branches = [], clumps = [];
  const trunk = grow(new V3(0, 0, 0), new V3((rnd() - 0.5) * 0.15, 1, (rnd() - 0.5) * 0.15), trunkH + 1.6 * s, 5, 0, rnd, 0.06);
  const r0 = 0.46 * s;
  const tr = trunk.map((p, i) => r0 * (1 - 0.45 * i / (trunk.length - 1)) * (i === 0 ? 1.35 : 1));
  branches.push({ pts: trunk, r: tr, level: 0 });
  const np = 4 + ((rnd() * 2) | 0);
  const crownC = new V3(0, trunkH + 3.6 * s, 0);
  for (let b = 0; b < np; b++) {
    const az = b * 2.4 + rnd() * 0.6, pitch = 0.6 + rnd() * 0.35;
    const k = 0.45 + 0.5 * (b / np);
    const p0 = trunk[Math.min(trunk.length - 1, 2 + Math.floor(k * (trunk.length - 3)))].clone();
    const dir = new V3(Math.cos(az) * Math.sin(pitch), Math.cos(pitch), Math.sin(az) * Math.sin(pitch));
    const len = (3.9 + rnd() * 1.6) * s;
    const pts = grow(p0, dir, len, 4, 0.1, rnd);
    branches.push({ pts, r: taper(pts.length, r0 * 0.52, r0 * 0.16), level: 1 });
    const tip = pts[pts.length - 1];
    clumps.push({ c: tip.clone().add(new V3(0, 0.5 * s, 0)), r: (2.0 + rnd() * 0.6) * s });
    for (let j = 0; j < 2; j++) {
      const q = pts[2 + j];
      const d2 = dir.clone().applyAxisAngle(UP, (j ? 1 : -1) * (0.7 + rnd() * 0.5)).add(new V3(0, 0.4, 0));
      const sp = grow(q, d2, (1.6 + rnd() * 1.2) * s, 3, 0.15, rnd);
      branches.push({ pts: sp, r: taper(sp.length, r0 * 0.2, r0 * 0.06), level: 2 });
      clumps.push({ c: sp[sp.length - 1].clone().add(new V3(0, 0.3 * s, 0)), r: (1.6 + rnd() * 0.6) * s });
    }
  }
  clumps.push({ c: new V3(0, H - 1.8 * s, 0), r: 2.7 * s });
  clumps.push({ c: crownC.clone(), r: 2.6 * s });
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2 + rnd() * 0.5, e = -0.15 + rnd() * 0.9;
    clumps.push({ c: crownC.clone().add(new V3(Math.cos(a) * Math.cos(e) * 4.3 * s, Math.sin(e) * 2.8 * s, Math.sin(a) * Math.cos(e) * 4.3 * s)), r: (1.8 + rnd() * 0.6) * s });
  }
  return { branches, clumps, H, crownC, crownR: new V3(5.6 * s, 4.0 * s, 5.6 * s) };
}

function skeletonBirch(rnd, s) {
  const H = 13 * s;
  const branches = [], clumps = [];
  const lean = new V3((rnd() - 0.5) * 0.25, 1, (rnd() - 0.5) * 0.25);
  const trunk = grow(new V3(0, 0, 0), lean, H - 0.8 * s, 8, 0.02, rnd, 0.08);
  branches.push({ pts: trunk, r: trunk.map((p, i) => (0.2 * s) * (1 - 0.8 * i / (trunk.length - 1)) * (i === 0 ? 1.3 : 1)), level: 0 });
  const nb = 9;
  for (let b = 0; b < nb; b++) {
    const k = 0.35 + 0.6 * (b / nb);
    const p0 = trunk[Math.floor(k * (trunk.length - 1))].clone();
    const az = b * 2.4 + rnd() * 0.5, pitch = 0.45 + rnd() * 0.35;
    const dir = new V3(Math.cos(az) * Math.sin(pitch), Math.cos(pitch), Math.sin(az) * Math.sin(pitch));
    const pts = grow(p0, dir, (1.6 + rnd() * 1.4) * s * (1.2 - k * 0.5), 3, 0.06, rnd);
    branches.push({ pts, r: taper(pts.length, 0.06 * s, 0.025 * s), level: 1 });
    clumps.push({ c: pts[pts.length - 1].clone(), r: (1.05 + rnd() * 0.35) * s });
    clumps.push({ c: pts[1].clone().lerp(pts[2], 0.5).add(new V3(0, 0.2, 0)), r: (0.85 + rnd() * 0.3) * s });
  }
  clumps.push({ c: trunk[trunk.length - 1].clone(), r: 1.1 * s });
  return { branches, clumps, H, crownC: new V3(0, H * 0.68, 0), crownR: new V3(2.6 * s, 4.4 * s, 2.6 * s) };
}

function skeletonConifer(rnd, s) {
  const H = 16 * s;
  const trunk = grow(new V3(0, 0, 0), new V3(0, 1, 0), H, 6, 0, rnd, 0.02);
  const branches = [{ pts: trunk, r: trunk.map((p, i) => 0.36 * s * (1 - 0.92 * i / (trunk.length - 1)) * (i === 0 ? 1.3 : 1)), level: 0 }];
  const tiers = [];
  const y0 = 2.2 * s, n = 10;
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const y = y0 + (H - y0 - 0.6 * s) * Math.pow(t, 0.9);
    const R = (0.45 + 3.5 * Math.pow(1 - t, 0.95)) * s * (0.9 + rnd() * 0.2);
    tiers.push({ y, R, rot: rnd() * 6.28 });
  }
  return { branches, tiers, clumps: tiers.map((t) => ({ c: new V3(0, t.y, 0), r: t.R })), H, crownC: new V3(0, H * 0.5, 0), crownR: new V3(4 * s, H * 0.5, 4 * s) };
}

function skeletonBlossom(rnd, s) {
  const H = 7 * s, trunkH = (2.0 + rnd() * 0.5) * s;
  const branches = [], clumps = [];
  const trunk = grow(new V3(0, 0, 0), new V3((rnd() - 0.5) * 0.3, 1, (rnd() - 0.5) * 0.3), trunkH, 3, 0, rnd, 0.2);
  branches.push({ pts: trunk, r: trunk.map((p, i) => 0.32 * s * (1 - 0.3 * i / (trunk.length - 1)) * (i === 0 ? 1.3 : 1)), level: 0 });
  const np = 5;
  const top = trunk[trunk.length - 1];
  for (let b = 0; b < np; b++) {
    const az = b * 2.4 + rnd() * 0.5, pitch = 0.85 + rnd() * 0.35;
    const dir = new V3(Math.cos(az) * Math.sin(pitch), Math.cos(pitch), Math.sin(az) * Math.sin(pitch));
    const pts = grow(top, dir, (3.0 + rnd() * 1.0) * s, 4, 0.1, rnd, 0.3);
    branches.push({ pts, r: taper(pts.length, 0.17 * s, 0.05 * s), level: 1 });
    clumps.push({ c: pts[pts.length - 1].clone().add(new V3(0, 0.35 * s, 0)), r: (1.5 + rnd() * 0.4) * s });
    const q = pts[2];
    const d2 = dir.clone().applyAxisAngle(UP, (rnd() < 0.5 ? 1 : -1) * 0.9).add(new V3(0, 0.5, 0));
    const sp = grow(q, d2, 1.6 * s, 2, 0.1, rnd);
    branches.push({ pts: sp, r: taper(sp.length, 0.07 * s, 0.03 * s), level: 2 });
    clumps.push({ c: sp[sp.length - 1].clone().add(new V3(0, 0.25 * s, 0)), r: (1.25 + rnd() * 0.3) * s });
  }
  const cc = new V3(0, trunkH + 2.4 * s, 0);
  clumps.push({ c: cc.clone().add(new V3(0, 1.4 * s, 0)), r: 1.9 * s });
  for (let i = 0; i < 5; i++) {
    const a = i * 1.26 + rnd();
    clumps.push({ c: cc.clone().add(new V3(Math.cos(a) * 2.6 * s, 0.6 * s + rnd() * 0.8 * s, Math.sin(a) * 2.6 * s)), r: (1.4 + rnd() * 0.3) * s });
  }
  return { branches, clumps, H, crownC: cc, crownR: new V3(4.3 * s, 2.5 * s, 4.3 * s) };
}

function skeletonWillow(rnd, s) {
  const H = 9.5 * s;
  const branches = [], clumps = [], strands = [];
  const trunk = grow(new V3(0, 0, 0), new V3(0.25, 1, 0.1), 2.8 * s, 3, 0, rnd, 0.1);
  branches.push({ pts: trunk, r: trunk.map((p, i) => 0.5 * s * (1 - 0.3 * i / (trunk.length - 1)) * (i === 0 ? 1.3 : 1)), level: 0 });
  const top = trunk[trunk.length - 1];
  const crownC = new V3(top.x, 7.2 * s, top.z);
  for (let b = 0; b < 4; b++) {
    const az = b * 1.57 + rnd() * 0.5, pitch = 0.45 + rnd() * 0.3;
    const dir = new V3(Math.cos(az) * Math.sin(pitch), Math.cos(pitch), Math.sin(az) * Math.sin(pitch));
    const pts = grow(top, dir, 4.6 * s, 4, -0.02, rnd, 0.15);
    branches.push({ pts, r: taper(pts.length, 0.26 * s, 0.07 * s), level: 1 });
  }
  for (let i = 0; i < 9; i++) {
    const a = i * 0.7 + rnd() * 0.4, e = 0.2 + rnd() * 0.7, R = 3.6 * s;
    clumps.push({ c: crownC.clone().add(new V3(Math.cos(a) * Math.cos(e) * R, Math.sin(e) * 1.8 * s, Math.sin(a) * Math.cos(e) * R)), r: (1.6 + rnd() * 0.5) * s });
  }
  clumps.push({ c: crownC.clone().add(new V3(0, 1.6 * s, 0)), r: 2.2 * s });
  const ns = 46;
  for (let i = 0; i < ns; i++) {
    const a = (i / ns) * Math.PI * 2 + rnd() * 0.2, R = (3.2 + rnd() * 1.6) * s;
    const p = crownC.clone().add(new V3(Math.cos(a) * R, (0.2 + rnd() * 1.2) * s, Math.sin(a) * R));
    strands.push({ p, a, len: (3.2 + rnd() * 2.6) * s });
  }
  return { branches, clumps, strands, H, crownC, crownR: new V3(4.6 * s, 2.8 * s, 4.6 * s) };
}

const SPEC = {
  broadleaf: { skel: skeletonBroadleaf, tex: 'broadleaf', bark: 'bark', barkCol: [0.75, 0.62, 0.5], card: 1.9, dens: 3.6, tint: [1.0, 1.0, 1.0], windScale: 0.32 },
  birch: { skel: skeletonBirch, tex: 'broadleaf', bark: 'birch', barkCol: [1, 1, 1], card: 1.15, dens: 3.6, tint: [1.12, 1.1, 0.62], windScale: 0.45 },
  conifer: { skel: skeletonConifer, tex: 'pine', bark: 'bark', barkCol: [0.62, 0.5, 0.42], card: 1, dens: 1, tint: [0.92, 1.0, 0.95], windScale: 0.22 },
  blossom: { skel: skeletonBlossom, tex: 'blossom', bark: 'bark', barkCol: [0.62, 0.45, 0.42], card: 1.5, dens: 3.6, tint: [1.0, 1.0, 1.0], windScale: 0.28 },
  willow: { skel: skeletonWillow, tex: 'willow', bark: 'bark', barkCol: [0.7, 0.62, 0.52], card: 1.7, dens: 2.6, tint: [1.0, 1.0, 1.0], windScale: 0.35 },
};

// ------------------------------------------------------------------ canopy builders
function leafColorFn(sk, tint) {
  const bottom = sk.crownC.y - sk.crownR.y, top = sk.crownC.y + sk.crownR.y;
  return (p, s) => {
    const t = Math.min(1, Math.max(0, (p.y - bottom) / (top - bottom)));
    const rel = new V3().subVectors(p, sk.crownC).divide(sk.crownR).length();
    const ao = 0.58 + 0.3 * t + 0.22 * Math.min(1, Math.max(0, (rel - 0.4) / 0.6)) + 0.08 * s.y;
    const a = Math.min(1.08, ao);
    return [tint[0] * a, tint[1] * a, tint[2] * (a * 0.92 + 0.06)];
  };
}

function sphereFnFor(clump, sk, wClump = 0.7) {
  return (p) => {
    const a = new V3().subVectors(p, clump.c).normalize();
    const b = new V3().subVectors(p, sk.crownC).divide(sk.crownR).normalize();
    return a.multiplyScalar(wClump).addScaledVector(b, 1 - wClump).normalize();
  };
}

function buildCanopy(B, sk, spec, rnd, density, sizeMul) {
  const colFn = leafColorFn(sk, spec.tint);
  const H = sk.H;
  const windOf = (p) => Math.min(1.3, Math.pow(Math.max(0, p.y) / H, 2) * 1.1 + 0.1);
  if (sk.tiers) { // conifer
    for (const t of sk.tiers) {
      const cone = (p) => {
        const out = new V3(p.x, 0, p.z); const l = out.length() || 1; out.divideScalar(l);
        return out.multiplyScalar(0.78).add(new V3(0, 0.62, 0)).normalize();
      };
      const nArms = Math.max(3, Math.round(6 * density));
      const tierPh = rnd();
      // flat star disc on top of the tier
      card(B, new V3(0, t.y + 0.15, 0), new V3(Math.sin(t.rot) * 0.15, 1, Math.cos(t.rot) * 0.15).normalize(), new V3(Math.cos(t.rot), 0, Math.sin(t.rot)), t.R * 2.1 * sizeMul, t.R * 2.1 * sizeMul, [0, 0, 1, 1], colFn, cone, windOf, tierPh, 0.3);
      for (let k = 0; k < nArms; k++) {
        const a = t.rot + (k / nArms) * Math.PI * 2 + rnd() * 0.3;
        const out = new V3(Math.cos(a), 0, Math.sin(a));
        const c = new V3(out.x * t.R * 0.52, t.y - t.R * 0.22, out.z * t.R * 0.52);
        const nrm = out.clone().multiplyScalar(0.62).add(new V3(0, 0.78, 0)).normalize();
        const tang = new V3(-out.z, 0, out.x);
        card(B, c, nrm, tang, t.R * 1.25 * sizeMul, t.R * 1.15 * sizeMul, [0, 0, 1, 1], colFn, cone, windOf, tierPh + k * 0.1, 0.3);
      }
    }
    // tip
    card(B, new V3(0, H - 0.5, 0), new V3(1, 0, 0), new V3(0, 0, 1), 1.4, 1.8, [0, 0, 1, 1], colFn, () => new V3(0, 1, 0), windOf, 0.5, 0.2);
    card(B, new V3(0, H - 0.5, 0), new V3(0, 0, 1), new V3(1, 0, 0), 1.4, 1.8, [0, 0, 1, 1], colFn, () => new V3(0, 1, 0), windOf, 0.5, 0.2);
    return;
  }
  for (const cl of sk.clumps) {
    const sf = sphereFnFor(cl, sk);
    const n = Math.max(2, Math.round(spec.dens * cl.r * cl.r * density));
    const ph = rnd();
    for (let i = 0; i < n; i++) {
      const d = randUnit(rnd);
      if (d.y < -0.55) d.y = -d.y * 0.5; // fewer cards pointing straight down
      d.normalize();
      const rr = cl.r * (0.45 + 0.55 * Math.sqrt(rnd()));
      const c = cl.c.clone().addScaledVector(d, rr);
      const nrm = d.clone().add(randUnit(rnd).multiplyScalar(0.6)).normalize();
      const tang = randUnit(rnd).cross(nrm).normalize();
      const sz = spec.card * sizeMul * (0.8 + rnd() * 0.4);
      card(B, c, nrm, tang, sz, sz, [0, 0, 1, 1], colFn, sf, windOf, ph, 1);
    }
  }
  if (sk.strands) { // willow hanging strands
    const step = Math.max(1, Math.round(1 / density));
    for (let i = 0; i < sk.strands.length; i += step) {
      const st = sk.strands[i];
      const out = new V3(Math.cos(st.a), 0, Math.sin(st.a));
      const tang = new V3(-out.z, 0, out.x);
      const sf = () => out.clone().multiplyScalar(0.8).add(new V3(0, 0.25, 0)).normalize();
      const len = st.len;
      card(B, st.p, out, tang, 1.1 * sizeMul * (density < 0.5 ? 1.6 : 1), len, [0, 0, 1, 1], colFn, sf,
        (p, k) => (k >= 2 ? 1.6 : 0.5), rnd(), 0.4, true);
    }
  }
}

function buildImpostor(B, sk, spec, rnd) {
  // LOD2: crossed cards per clump (clump-sized), plus a dark trunk prism mapped to an opaque texel
  const colFn = leafColorFn(sk, spec.tint);
  const windOf = (p) => Math.pow(Math.max(0, p.y) / sk.H, 2);
  const list = sk.tiers ? sk.tiers.filter((_, i) => i % 2 === 0).map((t) => ({ c: new V3(0, t.y, 0), r: t.R * 1.15 })) : sk.clumps.filter((_, i) => i % 2 === 0 || sk.clumps.length < 8);
  for (const cl of list) {
    const sf = sphereFnFor(cl, sk, 0.5);
    const r = cl.r * (sk.tiers ? 1.0 : 1.55);
    const a = rnd() * Math.PI;
    for (let k = 0; k < 2; k++) {
      const n = new V3(Math.cos(a + k * Math.PI / 2), 0, Math.sin(a + k * Math.PI / 2));
      card(B, cl.c, n, UP.clone(), r * 2, r * 2 * (sk.tiers ? 0.9 : 1), [0, 0, 1, 1], colFn, sf, windOf, 0, 0);
    }
    card(B, cl.c.clone().add(new V3(0, r * 0.15, 0)), UP.clone(), new V3(1, 0, 0), r * 1.8, r * 1.8, [0, 0, 1, 1], colFn, sf, windOf, 0, 0);
  }
  if (sk.strands) {
    for (let i = 0; i < sk.strands.length; i += 4) {
      const st = sk.strands[i]; const out = new V3(Math.cos(st.a), 0, Math.sin(st.a));
      card(B, st.p, out, new V3(-out.z, 0, out.x), 2.4, st.len, [0, 0, 1, 1], colFn, () => out, () => 0.5, 0, 0, true);
    }
  }
  // trunk prism (uv at the opaque centre of the leaf texture, dark vertex colour)
  const tr = sk.branches[0];
  const top = tr.pts[tr.pts.length - 1].clone();
  top.y = Math.min(top.y, sk.crownC.y);
  const r0 = tr.r[0] * 0.9, i0 = B.count;
  const dark = [0.38, 0.27, 0.2];
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * Math.PI * 2;
    const d = new V3(Math.cos(a), 0, Math.sin(a));
    B.vert(new V3(d.x * r0, 0, d.z * r0), d, 0.5, 0.5, dark, d, [0, 0, 0, 0]);
    B.vert(new V3(top.x + d.x * r0 * 0.5, top.y, top.z + d.z * r0 * 0.5), d, 0.5, 0.52, dark, d, [0.3, 0, 0, 0]);
  }
  for (let k = 0; k < 4; k++) {
    const a = i0 + k * 2, b = i0 + ((k + 1) % 4) * 2;
    B.idx.push(a, b, a + 1, a + 1, b, b + 1);
  }
}

/** Builds all LOD geometries for a species variant. */
export function buildTreeVariant(species, seed) {
  const spec = SPEC[species];
  const rnd = mulberry32(seed * 7919 + species.length * 131);
  const sk = spec.skel(rnd, 1);
  const out = {};
  // LOD0
  const t0 = new Builder(), l0 = new Builder();
  for (const b of sk.branches) tube(t0, b.pts, b.r, b.level === 0 ? 10 : b.level === 1 ? 6 : 4, sk.H, spec.barkCol, rnd, { aoBase: 0.55 });
  buildCanopy(l0, sk, spec, mulberry32(seed + 5), 1, 1);
  // LOD1
  const t1 = new Builder(), l1 = new Builder();
  for (const b of sk.branches) if (b.level <= 1) tube(t1, b.pts.filter((_, i) => i % 2 === 0 || i === b.pts.length - 1), b.r.filter((_, i) => i % 2 === 0 || i === b.r.length - 1), b.level === 0 ? 6 : 4, sk.H, spec.barkCol, rnd, { aoBase: 0.55 });
  buildCanopy(l1, sk, spec, mulberry32(seed + 9), 0.38, 1.45);
  // LOD2
  const l2 = new Builder();
  buildImpostor(l2, sk, spec, mulberry32(seed + 13));
  out.lod = [{ trunk: t0.geometry(), leaves: l0.geometry() }, { trunk: t1.geometry(), leaves: l1.geometry() }, { trunk: null, leaves: l2.geometry() }];
  out.height = sk.H;
  out.radius = Math.max(sk.crownR.x, sk.crownR.z) + 0.5;
  out.trunkRadius = sk.branches[0].r[1];
  return out;
}

// ------------------------------------------------------------------ materials
const TREE_VERT = /* glsl */`
#ifdef USE_INSTANCING
  vec3 natIP = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
  mat3 natIM = mat3(instanceMatrix);
#else
  vec3 natIP = vec3(0.0); mat3 natIM = mat3(1.0);
#endif
  float natG = natGust(natIP.xz);
  float natPh = dot(natIP.xz, vec2(0.071, 0.053)) + aWind.y * 6.2831;
  float natS = sin(uTime * 1.05 + natPh) * 0.5 + sin(uTime * 2.2 + natPh * 1.7) * 0.25;
  vec3 natWL = normalize(transpose(natIM) * vec3(uWind.x, 0.0, uWind.y));
  float natAmp = uWind.z * (0.35 + 1.15 * natG);
  transformed += natWL * aWind.x * natAmp * (0.6 + natS) * uWindScale;
  transformed += normal * aWind.z * sin(uTime * 4.7 + aWind.y * 37.0 + natIP.x * 0.7 + position.y) * 0.045 * natAmp;
`;

export function windPatch(mat, key, windScale, leaves) {
  const fragment = [['#include <opaque_fragment>', HAZE_FRAG, 'before']];
  if (leaves) {
    fragment.push(['#include <normal_fragment_begin>', 'normal = normalize( vNormal );']);
    fragment.push(['#include <alphatest_fragment>', `
#ifdef USE_MAP
  { vec2 natTs = vec2(textureSize(map, 0));
    vec2 natD = max(abs(dFdx(vMapUv * natTs)), abs(dFdy(vMapUv * natTs)));
    float natLod = max(0.0, log2(max(natD.x, natD.y)));
    diffuseColor.a = min(1.0, diffuseColor.a * (1.0 + natLod * 0.16)); }
#endif`, 'before']);
  }
  patchMaterial(mat, {
    key, uniforms: { uTime: WIND.uTime, uWind: WIND.uWind, uNoiseTex: WIND.uNoiseTex, uWindScale: { value: windScale }, uHaze: HAZE.uHaze },
    vertexPars: WIND_GLSL + '\nattribute vec4 aWind;\nuniform float uWindScale;\n',
    fragmentPars: HAZE_PARS,
    vertex: [['#include <begin_vertex>', TREE_VERT]],
    fragment,
  });
  return mat;
}

export function depthMaterialFor(mat, key, windScale) {
  const d = new THREE.MeshDepthMaterial({ map: mat.map, alphaTest: mat.alphaTest, side: THREE.DoubleSide });
  patchMaterial(d, {
    key: key + '-depth', uniforms: { uTime: WIND.uTime, uWind: WIND.uWind, uNoiseTex: WIND.uNoiseTex, uWindScale: { value: windScale } },
    vertexPars: WIND_GLSL + '\nattribute vec4 aWind;\nuniform float uWindScale;\n',
    vertex: [['#include <begin_vertex>', TREE_VERT]],
  });
  return d;
}

export function createTreeMaterials(tex) {
  const mats = {};
  const leafTex = { broadleaf: tex.broadleaf, pine: tex.pine, blossom: tex.blossom, willow: tex.willow };
  for (const sp in SPEC) {
    const spec = SPEC[sp];
    const leaves = createToonMaterial({ kind: 'foliage', map: leafTex[spec.tex], alphaTest: 0.5, side: THREE.DoubleSide, vertexColors: true });
    windPatch(leaves, 'tree-leaves', spec.windScale, true);
    const trunk = createToonMaterial({ kind: 'wood', map: spec.bark === 'birch' ? tex.birch : tex.bark, vertexColors: true });
    windPatch(trunk, 'tree-trunk', spec.windScale, false);
    mats[sp] = { leaves, trunk, leavesDepth: depthMaterialFor(leaves, 'tree-leaves', spec.windScale) };
  }
  return mats;
}

// ------------------------------------------------------------------ instanced renderer with LOD
export class TreeSystem {
  constructor(ctx, mats, opts) {
    this.ctx = ctx;
    this.mats = mats;
    const low = ctx.quality.name === 'low';
    this.lodDist = opts.lodDist || (low ? [36, 105] : [75, 210]);
    this.maxDist = ctx.quality.drawDistance * 0.92;
    this.variantsPerSpecies = low ? 2 : 3;
    this.group = new THREE.Group();
    this.group.name = 'trees';
    ctx.scene.add(this.group);
    this.variants = {};
    this.kitVariants = {};
    this.instances = [];
    this.lastPos = new THREE.Vector3(1e9, 0, 0);
    this.lastDir = new THREE.Vector3();
    this.frustum = new THREE.Frustum();
    this.m4 = new THREE.Matrix4();
  }
  variant(species, v) {
    const key = species + v;
    if (!this.variants[key]) {
      const geo = buildTreeVariant(species, v + 1);
      const m = this.mats[species];
      const buckets = geo.lod.map((L, li) => ({
        li,
        parts: [
          ...(L.trunk ? [{ geometry: L.trunk, material: m.trunk, cast: li < 2, receive: true }] : []),
          { geometry: L.leaves, material: m.leaves, depth: m.leavesDepth, cast: li < 2, receive: false },
        ],
      }));
      this.variants[key] = { key, species, radius: geo.radius, height: geo.height, buckets, lodMap: [0, 1, 2], list: [] };
    }
    return this.variants[key];
  }
  /** Register a kit (glTF) tree: model parts for LOD0, a crossed-card impostor for everything farther. */
  addKitVariant(key, model, impostor) {
    const near = { li: 0, parts: model.parts.map((p) => ({ geometry: p.geometry, material: p.material, depth: p.depth, cast: true, receive: !p.foliage })) };
    const far = { li: 1, parts: [{ geometry: impostor.geometry, material: impostor.material, depth: impostor.depth, cast: true, receive: false }] };
    this.variants[key] = { key, species: key, kit: true, radius: model.radius + 0.5, height: model.height, buckets: [near, far], lodMap: [0, 1, 1], list: [] };
    return this.variants[key];
  }
  /** t: {species, x, y, z, rot, s, variant, tint, white, kitKey?} */
  add(t) {
    const v = t.kitKey ? this.variants[t.kitKey] : this.variant(t.species, t.variant % this.variantsPerSpecies);
    const inst = { ...t, v, r: v.radius * t.s, h: v.height * t.s, m: new THREE.Matrix4(), c: new THREE.Color() };
    inst.m.compose(new THREE.Vector3(t.x, t.y - 0.15, t.z), new THREE.Quaternion().setFromAxisAngle(UP, t.rot), new THREE.Vector3(t.s, t.s * (0.92 + (t.tint || 0) * 0.16), t.s));
    const tv = t.tint ?? 0.5;
    if (t.color) inst.c.copy(t.color);
    else if (t.white) inst.c.setRGB(1.0, 1.32, 1.3);
    else inst.c.setRGB(0.9 + tv * 0.18, 0.92 + (1 - tv) * 0.14, 0.88 + tv * 0.1);
    v.list.push(inst);
    this.instances.push(inst);
    return inst;
  }
  finalize() {
    for (const key in this.variants) {
      const v = this.variants[key];
      const n = Math.max(1, v.list.length);
      for (const b of v.buckets) {
        b.meshes = [];
        let first = null;
        for (const p of b.parts) {
          const im = new THREE.InstancedMesh(p.geometry, p.material, n);
          if (first) { im.instanceMatrix = first.instanceMatrix; im.instanceColor = first.instanceColor; }
          else im.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3);
          im.frustumCulled = false;
          im.castShadow = p.cast;
          im.receiveShadow = p.receive;
          if (p.depth) im.customDepthMaterial = p.depth;
          im.count = 0;
          this.group.add(im);
          b.meshes.push(im);
          first = first || im;
        }
      }
    }
  }
  update(camera, force = false) {
    const p = camera.position;
    const dir = camera.getWorldDirection(new THREE.Vector3());
    if (!force && p.distanceToSquared(this.lastPos) < 1 && dir.dot(this.lastDir) > 0.9995) return;
    this.lastPos.copy(p); this.lastDir.copy(dir);
    camera.updateMatrixWorld();
    this.m4.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    this.frustum.setFromProjectionMatrix(this.m4);
    const sphere = new THREE.Sphere();
    const [d0, d1] = this.lodDist, maxD = this.maxDist;
    for (const key in this.variants) {
      const v = this.variants[key];
      const counts = v.buckets.map(() => 0);
      for (const t of v.list) {
        const dx = t.x - p.x, dz = t.z - p.z, dy = t.y + t.h * 0.5 - p.y;
        const d = Math.sqrt(dx * dx + dz * dz + dy * dy * 0.5);
        if (d > maxD) continue;
        sphere.center.set(t.x, t.y + t.h * 0.5, t.z);
        sphere.radius = Math.max(t.r, t.h * 0.6) + (d < d1 ? 22 : 0);
        if (!this.frustum.intersectsSphere(sphere)) continue;
        const bi = v.lodMap[d < d0 ? 0 : d < d1 ? 1 : 2];
        const m0 = v.buckets[bi].meshes[0];
        const i = counts[bi]++;
        t.m.toArray(m0.instanceMatrix.array, i * 16);
        t.c.toArray(m0.instanceColor.array, i * 3);
      }
      v.buckets.forEach((b, bi) => {
        for (const im of b.meshes) { im.count = counts[bi]; im.visible = counts[bi] > 0; }
        b.meshes[0].instanceMatrix.needsUpdate = true;
        b.meshes[0].instanceColor.needsUpdate = true;
      });
    }
  }
  stats() {
    let draws = 0, tris = 0;
    for (const key in this.variants) for (const b of this.variants[key].buckets) for (const m of b.meshes) {
      if (m.visible) { draws++; tris += ((m.geometry.index ? m.geometry.index.count : m.geometry.attributes.position.count) / 3) * m.count; }
    }
    return { draws, tris };
  }
}

/** Standalone (non-instanced) tree for other modules, e.g. a plaza tree. */
export function createTreeObject(mats, species = 'broadleaf', seed = 1, scale = 1) {
  const geo = buildTreeVariant(species, seed);
  const g = new THREE.Group();
  const l = new THREE.Mesh(geo.lod[0].leaves, mats[species].leaves);
  l.customDepthMaterial = mats[species].leavesDepth;
  const t = new THREE.Mesh(geo.lod[0].trunk, mats[species].trunk);
  l.castShadow = t.castShadow = true; t.receiveShadow = true;
  g.add(t, l);
  g.scale.setScalar(scale);
  return g;
}

/** Haze-only patch for static nature materials (rocks, logs). */
export function hazePatch(mat, key) {
  return patchMaterial(mat, { key, uniforms: { uHaze: HAZE.uHaze }, fragmentPars: HAZE_PARS, fragment: [['#include <opaque_fragment>', HAZE_FRAG, 'before']] });
}
