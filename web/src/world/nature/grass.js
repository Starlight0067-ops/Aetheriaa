// GPU-instanced painterly grass and meadow flowers (owner: nature).
// Tiles of instances are generated deterministically around the camera, cached, frustum-culled per tile and
// packed into one instanced draw per layer. Blades: curved, tapered, root-to-tip gradient that matches the
// terrain colour underneath, wind sway with travelling gusts (brighter gust waves), distance thinning.
import * as THREE from 'three';
import { heightAt } from '../../core/layout.js';
import { createToonMaterial } from '../../render/toon.js';
import { mulberry32, hash2i, vnoise, patchMaterial, WIND, WIND_GLSL, sstep } from './common.js';
import { splatAt, isWater, slopeAt, inTown, heightFast, dTown } from './worlddata.js';

const TILE = 12;

function clumpGeometry(blades, segs, rnd) {
  const pos = [], nor = [], bl = [], idx = [];
  for (let b = 0; b < blades; b++) {
    const a = (b / blades) * Math.PI * 2 + rnd() * 0.8;
    const r0 = 0.03 + rnd() * 0.09;
    const ox = Math.cos(a) * r0, oz = Math.sin(a) * r0;
    const h = 0.42 + rnd() * 0.3, w = 0.06 + rnd() * 0.035;
    const lean = 0.1 + rnd() * 0.22;
    const face = a + Math.PI / 2 + (rnd() - 0.5) * 0.9; // blade plane orientation
    const tx = Math.cos(face), tz = Math.sin(face);
    const lx = Math.cos(a) * lean, lz = Math.sin(a) * lean;
    const r = rnd();
    const base = pos.length / 3;
    for (let s = 0; s <= segs; s++) {
      const t = s / segs;
      const cx = ox + lx * t * t, cz = oz + lz * t * t, cy = h * t * (1 - 0.18 * t * t);
      if (s === segs) { pos.push(cx, cy, cz); nor.push(0, 1, 0); bl.push(t, 0, r, 0); break; }
      const hw = w * 0.5 * (1 - Math.pow(t, 1.4) * 0.85);
      pos.push(cx - tx * hw, cy, cz - tz * hw, cx + tx * hw, cy, cz + tz * hw);
      nor.push(0, 1, 0, 0, 1, 0);
      bl.push(t, -1, r, 0, t, 1, r, 0);
    }
    for (let s = 0; s < segs - 1; s++) { const i = base + s * 2; idx.push(i, i + 1, i + 2, i + 1, i + 3, i + 2); }
    const i = base + (segs - 1) * 2; idx.push(i, i + 1, i + 2);
  }
  const g = new THREE.InstancedBufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('aBlade', new THREE.Float32BufferAttribute(bl, 4));
  g.setIndex(idx);
  return g;
}

function flowerGeometry() {
  // two crossed cards, bottom-anchored, 1 m nominal (scaled per instance)
  const pos = [], nor = [], uv = [], idx = [];
  for (let k = 0; k < 2; k++) {
    const a = k * Math.PI / 2, cx = Math.cos(a) * 0.5, cz = Math.sin(a) * 0.5, b = pos.length / 3;
    pos.push(-cx, 0, -cz, cx, 0, cz, cx, 1, cz, -cx, 1, -cz);
    for (let i = 0; i < 4; i++) nor.push(0, 1, 0);
    uv.push(0, 0, 1, 0, 1, 1, 0, 1);
    idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
  }
  const g = new THREE.InstancedBufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

const GRASS_VERT_PARS = WIND_GLSL + /* glsl */`
attribute vec4 iPos;
attribute vec4 iPar;
attribute vec4 aBlade;
uniform float uGrassR;
uniform sampler2D uSplatB;
uniform vec3 uLush; uniform vec3 uLight; uniform vec3 uDeep; uniform vec3 uGolden; uniform vec3 uForest;
varying vec3 vGrassCol;
`;
const GRASS_NORMAL = /* glsl */`
objectNormal = vec3(iPar.z, sqrt(max(0.0, 1.0 - iPar.z * iPar.z - iPar.w * iPar.w)), iPar.w);
`;
const GRASS_VERT = /* glsl */`
{
  float natT = aBlade.x;
  float natC = cos(iPar.x), natSn = sin(iPar.x);
  vec3 natLp = vec3(position.x * natC - position.z * natSn, position.y, position.x * natSn + position.z * natC);
  vec3 natRoot = iPos.xyz;
  float natDist = distance(natRoot.xz, cameraPosition.xz);
  float natFade = 1.0 - smoothstep(uGrassR * 0.55, uGrassR, natDist);
  float natKeep = smoothstep(0.0, 0.18, natFade - fract(iPar.y * 7.13) * 0.82);
  float natScale = iPos.w * natKeep * (1.0 + natDist / uGrassR * 0.55);
  natLp *= natScale;
  float natG = natGust(natRoot.xz);
  float natW = sin(uTime * 2.1 + dot(natRoot.xz, vec2(0.41, 0.33)) + iPar.y * 6.28) * 0.5 + 0.5;
  float natBend = uWind.z * (0.1 + 0.6 * natG * natG + 0.16 * natW);
  natLp.xz += uWind.xy * natBend * natT * natT * natScale * 0.9;
  natLp.y -= natBend * natBend * 0.22 * natT * natT * natScale;
  transformed = natRoot + natLp;
  // colour matched to the terrain splat under the root
  vec2 wxz = natRoot.xz;
  vec4 sB = textureLod(uSplatB, (wxz + 400.0) / 800.0, 0.0);
  vec4 nL = textureLod(uNoiseTex, wxz * 0.0023, 0.0);
  vec4 nM = textureLod(uNoiseTex, wxz * 0.012 + 0.31, 0.0);
  vec4 nS = textureLod(uNoiseTex, wxz * 0.065 + 0.57, 0.0);
  float pLight = smoothstep(0.38, 0.72, nL.r * 0.65 + nM.g * 0.35);
  float pDeep = smoothstep(0.55, 0.8, nL.g * 0.6 + nM.r * 0.4);
  vec3 macro = mix(uLush, uLight, pLight);
  macro = mix(macro, uDeep, pDeep * 0.75);
  macro = mix(macro, uGolden, sB.b * smoothstep(0.3, 0.6, nM.a) * 0.85);
  macro *= 0.92 + 0.16 * nS.r;
  macro = mix(macro, uForest * (0.85 + 0.3 * nS.g), sB.g * 0.8);
  float natV = 0.85 + 0.3 * fract(iPar.y * 13.7);
  vec3 tip = macro * vec3(1.28, 1.25, 1.0) * natV + vec3(0.05, 0.06, 0.0);
  vec3 root = macro * vec3(0.62, 0.7, 0.78);
  vGrassCol = mix(root, tip, smoothstep(0.0, 1.0, natT));
  vGrassCol += vec3(0.10, 0.11, 0.03) * natG * natG * natT * uWind.z;
}
`;

const FLOWER_VERT_PARS = WIND_GLSL + /* glsl */`
attribute vec4 iPos;
attribute vec4 iPar;
uniform float uGrassR;
`;
const FLOWER_VERT = /* glsl */`
{
  float natC = cos(iPar.x), natSn = sin(iPar.x);
  vec3 natLp = vec3(position.x * natC - position.z * natSn, position.y, position.x * natSn + position.z * natC);
  float natDist = distance(iPos.xz, cameraPosition.xz);
  float natKeep = 1.0 - smoothstep(uGrassR * 0.7, uGrassR, natDist);
  natLp *= iPos.w * natKeep;
  float natG = natGust(iPos.xz);
  natLp.xz += uWind.xy * uWind.z * (0.08 + 0.3 * natG) * position.y * position.y * iPos.w;
  transformed = iPos.xyz + natLp;
  vMapUv = vec2(mod(iPar.z, 2.0) * 0.5, floor(iPar.z / 2.0) * 0.5) + vec2(uv.x * 0.5, uv.y * 0.5);
}
`;

class ScatterLayer {
  constructor(ctx, { geometry, material, radius, maxInstances, gen }) {
    this.ctx = ctx;
    this.R = radius;
    this.gen = gen;
    this.max = maxInstances;
    this.cache = new Map();
    this.iPos = new THREE.InstancedBufferAttribute(new Float32Array(maxInstances * 4), 4);
    this.iPar = new THREE.InstancedBufferAttribute(new Float32Array(maxInstances * 4), 4);
    this.iPos.setUsage(THREE.DynamicDrawUsage); this.iPar.setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute('iPos', this.iPos);
    geometry.setAttribute('iPar', this.iPar);
    geometry.instanceCount = 0;
    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = false;
    this.mesh.receiveShadow = true;
    ctx.scene.add(this.mesh);
    this.last = new THREE.Vector3(1e9, 0, 0);
    this.lastDir = new THREE.Vector3();
    this.frustum = new THREE.Frustum();
    this.box = new THREE.Box3();
    this.m4 = new THREE.Matrix4();
  }
  tile(i, j) {
    const key = i + ',' + j;
    let t = this.cache.get(key);
    if (!t) {
      t = this.gen(i, j);
      this.cache.set(key, t);
      if (this.cache.size > 900) { const k0 = this.cache.keys().next().value; this.cache.delete(k0); }
    }
    return t;
  }
  update(camera, force = false) {
    const p = camera.position;
    const dir = camera.getWorldDirection(new THREE.Vector3());
    if (!force && p.distanceToSquared(this.last) < 1.0 && dir.dot(this.lastDir) > 0.998) return;
    this.last.copy(p); this.lastDir.copy(dir);
    camera.updateMatrixWorld();
    this.m4.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    this.frustum.setFromProjectionMatrix(this.m4);
    const R = this.R;
    const groundY = heightFast(p.x, p.z);
    const heightAbove = Math.max(0, p.y - groundY);
    if (heightAbove > R) { this.mesh.geometry.instanceCount = 0; return; }
    const i0 = Math.floor((p.x - R) / TILE), i1 = Math.floor((p.x + R) / TILE);
    const j0 = Math.floor((p.z - R) / TILE), j1 = Math.floor((p.z + R) / TILE);
    const list = [];
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const cx = (i + 0.5) * TILE, cz = (j + 0.5) * TILE;
      const d = Math.max(0, Math.hypot(cx - p.x, cz - p.z) - TILE * 0.71);
      if (d > R) continue;
      const t = this.tile(i, j);
      if (!t.count) continue;
      this.box.min.set(i * TILE - 1, t.minY - 1, j * TILE - 1);
      this.box.max.set((i + 1) * TILE + 1, t.maxY + 1.5, (j + 1) * TILE + 1);
      if (!this.frustum.intersectsBox(this.box)) continue;
      list.push([d, t]);
    }
    list.sort((a, b) => a[0] - b[0]);
    let n = 0;
    const P = this.iPos.array, Q = this.iPar.array;
    for (const [d, t] of list) {
      const keep = Math.max(0.2, Math.min(1, 1 - (d - R * 0.3) / (R * 0.85)));
      const k = Math.min(t.count, Math.ceil(t.count * keep), this.max - n);
      if (k <= 0) break;
      P.set(t.pos.subarray(0, k * 4), n * 4);
      Q.set(t.par.subarray(0, k * 4), n * 4);
      n += k;
    }
    this.mesh.geometry.instanceCount = n;
    this.iPos.clearUpdateRanges(); this.iPar.clearUpdateRanges();
    this.iPos.addUpdateRange(0, n * 4); this.iPar.addUpdateRange(0, n * 4);
    this.iPos.needsUpdate = true; this.iPar.needsUpdate = true;
    this.count = n;
  }
}

export function createGrass(ctx, tex, splatB, gardens) {
  const { quality } = ctx;
  const gd = quality.grassDensity ?? 1;
  const low = quality.name === 'low';
  const R = low ? 26 : Math.min(60, 34 + 10 * gd);
  const dens = (low ? 3.6 : 4.4) * Math.min(1.3, 0.6 + gd * 0.5); // clumps per m² near the camera
  const c = (hex) => new THREE.Color(hex);
  const uni = {
    uTime: WIND.uTime, uWind: WIND.uWind, uNoiseTex: WIND.uNoiseTex, uGrassR: { value: R }, uSplatB: { value: splatB },
    uLush: { value: c(0x5fb444) }, uLight: { value: c(0x9ad25c) }, uDeep: { value: c(0x3f9440) }, uGolden: { value: c(0xc2c25e) }, uForest: { value: c(0x3c7a3c) },
  };
  // ---------------- grass
  const gmat = createToonMaterial({ kind: 'grass', side: THREE.DoubleSide });
  patchMaterial(gmat, {
    key: 'grass-blades', uniforms: uni, vertexPars: GRASS_VERT_PARS, fragmentPars: 'varying vec3 vGrassCol;',
    vertex: [['#include <beginnormal_vertex>', GRASS_NORMAL], ['#include <begin_vertex>', GRASS_VERT]],
    fragment: [['#include <color_fragment>', 'diffuseColor.rgb *= vGrassCol;', 'replace'], ['#include <normal_fragment_begin>', 'normal = normalize( vNormal );']],
  });
  const ggeo = clumpGeometry(low ? 5 : 7, 3, mulberry32(9));
  const spacing = 1 / Math.sqrt(dens);
  const inGarden = (x, z) => gardens.some((g) => Math.hypot(x - g.x, z - g.z) < g.r);
  const genGrass = (ti, tj) => {
    const rnd = mulberry32((ti * 73856093) ^ (tj * 19349663));
    const items = [];
    let minY = 1e9, maxY = -1e9;
    const n = Math.ceil(TILE / spacing);
    for (let a = 0; a < n; a++) for (let b = 0; b < n; b++) {
      const x = ti * TILE + (a + rnd()) * spacing, z = tj * TILE + (b + rnd()) * spacing;
      const garden = inGarden(x, z);
      if (!garden && inTown(x, z)) continue;
      if (isWater(x, z, 0.35)) continue;
      const s = splatAt(x, z);
      if (s.cobble > 0.25 || s.sand > 0.45) continue;
      const pathEdge = 1 - sstep(0.12, 0.42, s.path);
      if (pathEdge <= 0.02) continue;
      if (slopeAt(x, z) > 0.42) continue;
      let keep = 1 - s.forest * 0.55;
      keep *= pathEdge;
      if (rnd() > keep) continue;
      const y = heightAt(x, z);
      const e = 0.6;
      const hx = heightAt(x + e, z) - heightAt(x - e, z), hz = heightAt(x, z + e) - heightAt(x, z - e);
      const L = Math.hypot(hx, 2 * e, hz);
      const scale = (0.75 + rnd() * 0.5) * (0.6 + 0.4 * pathEdge) * (1 + s.meadow * 0.25) * (1 - s.forest * 0.3) * (1 - s.town * 0.35) * (1 - s.damp * 0.15);
      items.push([rnd(), x, y - 0.03, z, scale, rnd() * 6.283, -hx / L, -hz / L]);
      if (y < minY) minY = y; if (y + 1 > maxY) maxY = y + 1;
    }
    items.sort((p, q) => p[0] - q[0]);
    const pos = new Float32Array(items.length * 4), par = new Float32Array(items.length * 4);
    items.forEach((it, k) => { pos.set([it[1], it[2], it[3], it[4]], k * 4); par.set([it[5], it[0], it[6], it[7]], k * 4); });
    return { pos, par, count: items.length, minY, maxY };
  };
  const grass = new ScatterLayer(ctx, { geometry: ggeo, material: gmat, radius: R, maxInstances: low ? 9000 : 40000, gen: genGrass });

  // ---------------- flowers (2x2 sheet: pink petunia, white daisy, yellow buttercup, blue forget-me-not)
  const fmat = createToonMaterial({ kind: 'foliage', map: tex.flowers, alphaTest: 0.5, side: THREE.DoubleSide });
  patchMaterial(fmat, {
    key: 'meadow-flowers', uniforms: uni, vertexPars: FLOWER_VERT_PARS,
    vertex: [['#include <begin_vertex>', FLOWER_VERT]],
    fragment: [['#include <normal_fragment_begin>', 'normal = normalize( vNormal );']],
  });
  const FR = low ? 22 : R * 0.85;
  const genFlowers = (ti, tj) => {
    const rnd = mulberry32((ti * 19349663) ^ (tj * 83492791) ^ 77);
    const items = [];
    let minY = 1e9, maxY = -1e9;
    const tries = low ? 26 : 46;
    for (let k = 0; k < tries; k++) {
      const x = ti * TILE + rnd() * TILE, z = tj * TILE + rnd() * TILE;
      if (inTown(x, z) && !inGarden(x, z)) continue;
      if (isWater(x, z, 0.6)) continue;
      const s = splatAt(x, z);
      if (s.cobble > 0.2 || s.sand > 0.3 || s.path > 0.3) continue;
      const patch = vnoise(x * 0.09, z * 0.09, 5);
      const pathSide = (s.path > 0.03 ? 0.7 : 0);
      const want = Math.max(s.meadow * sstep(0.45, 0.62, patch), pathSide * sstep(0.35, 0.6, patch), inGarden(x, z) ? 0.8 : 0) * (1 - s.forest * 0.8);
      if (rnd() > want) continue;
      if (slopeAt(x, z) > 0.4) continue;
      const y = heightAt(x, z);
      const type = Math.floor(vnoise(x * 0.05 + 30, z * 0.05, 8) * 4.999 + (rnd() < 0.15 ? 1 : 0)) % 4;
      items.push([rnd(), x, y - 0.02, z, 0.55 + rnd() * 0.3, rnd() * 6.283, type]);
      if (y < minY) minY = y; if (y + 1 > maxY) maxY = y + 1;
    }
    items.sort((p, q) => p[0] - q[0]);
    const pos = new Float32Array(items.length * 4), par = new Float32Array(items.length * 4);
    items.forEach((it, k) => { pos.set([it[1], it[2], it[3], it[4]], k * 4); par.set([it[5], it[0], it[6], 0], k * 4); });
    return { pos, par, count: items.length, minY, maxY };
  };
  const flowers = new ScatterLayer(ctx, { geometry: flowerGeometry(), material: fmat, radius: FR, maxInstances: low ? 2500 : 9000, gen: genFlowers });
  flowers.mesh.receiveShadow = true;

  return {
    grass, flowers,
    update(camera, force) { grass.update(camera, force); flowers.update(camera, force); },
    invalidate() { grass.cache.clear(); flowers.cache.clear(); grass.last.set(1e9, 0, 0); flowers.last.set(1e9, 0, 0); },
  };
}
