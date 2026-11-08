// Terrain (owner: nature). Quadtree-chunked terrain sampled from the shared heightAt with distance LOD
// (fine near the camera, coarse far), skirts against cracks, analytic smooth normals, and a painterly
// splat shader (grass variants, meadow flowers, dirt paths, triplanar cliffs, riverbank sand/pebbles,
// damp soil, town cobbles, forest floor, snow on the rim peaks) injected into the toon 'ground' material.
import * as THREE from 'three';
import { WORLD, heightAt } from '../core/layout.js';
import { createToonMaterial } from '../render/toon.js';
import { getWorldData, MASK_RES, splatAt, pathDist, inTown } from './nature/worlddata.js';
import { loadNatureTextures } from './nature/textures.js';
import { patchMaterial, WIND, vnoise, sstep } from './nature/common.js';

const HALF = WORLD.half;
/** Shared with the nature systems (grass colour matching). */
export const terrainShared = { splatA: null, splatB: null, material: null };

/**
 * Visual-only mountain range on the outer rim (beyond the playable area, |x| or |z| > 320): the analytic
 * rim is a sheer square wall, so the rendered surface blends into ridged peaks and valleys instead.
 * Inside the playable area the rendered terrain matches heightAt exactly.
 */
export function visualHeightAt(x, z) {
  const h = heightAt(x, z);
  const e = Math.max(Math.abs(x), Math.abs(z));
  if (e <= 320) return h;
  const k = sstep(320, 342, e);
  const t = Math.min(1, (e - 320) / 80);
  let r = 0, a = 1, f = 0.0075, n = 0;
  for (let o = 0; o < 4; o++) { r += a * (1 - Math.abs(2 * vnoise(x * f, z * f, 90 + o) - 1)); n += a; a *= 0.5; f *= 2.05; }
  r /= n; // 0..1, ridged
  const massif = 0.5 + 0.5 * vnoise(x * 0.004 + 7, z * 0.004 - 3, 77);
  const m = 9 + t * 55 + Math.pow(t, 0.6) * (r * r * 210 * (0.55 + 0.7 * massif));
  return h + (m - h) * k;
}

function makeSplatTexture(data) {
  const t = new THREE.DataTexture(data, MASK_RES, MASK_RES, THREE.RGBAFormat);
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter;
  t.generateMipmaps = true; t.needsUpdate = true;
  return t;
}

const TERRAIN_VERT_PARS = /* glsl */`
varying vec3 vTW;
varying vec3 vTN;
`;
const TERRAIN_FRAG_PARS = /* glsl */`
varying vec3 vTW;
varying vec3 vTN;
uniform sampler2D uSplatA;
uniform sampler2D uSplatB;
uniform sampler2D uNoiseTex;
uniform sampler2D uGrassTex;
uniform sampler2D uDirtTex;
uniform sampler2D uRockTex;
uniform sampler2D uCobbleTex;
uniform vec3 uGrassAvg;
uniform vec3 uLush;
uniform vec3 uLight;
uniform vec3 uDeep;
uniform vec3 uGolden;
uniform vec3 uForest;
uniform vec3 uSand;
uniform vec3 uSnow;
vec3 natLuma3(vec3 c) { return vec3(dot(c, vec3(0.299, 0.587, 0.114))); }
`;
const TERRAIN_FRAG = /* glsl */`
{
  vec2 wxz = vTW.xz;
  vec2 suv = (wxz + ${HALF.toFixed(1)}) / ${(HALF * 2).toFixed(1)};
  vec4 sA = texture2D(uSplatA, suv);
  vec4 sB = texture2D(uSplatB, suv);
  vec4 nL = texture2D(uNoiseTex, wxz * 0.0023);
  vec4 nM = texture2D(uNoiseTex, wxz * 0.012 + 0.31);
  vec4 nS = texture2D(uNoiseTex, wxz * 0.065 + 0.57);
  vec4 nX = texture2D(uNoiseTex, wxz * 0.37 + 0.13);

  // ---- grass: dual-scale sampling (anti-tiling) re-tinted to the palette through macro colour patches
  float camDist = distance(vTW, cameraPosition);
  vec2 warp = (nM.rg - 0.5) * 2.2 + (nS.ba - 0.5) * 0.6;
  vec3 g1 = texture2D(uGrassTex, wxz * 0.23 + warp).rgb;
#ifndef TERRAIN_LQ
  vec3 g2 = texture2D(uGrassTex, mat2(0.8, -0.6, 0.6, 0.8) * wxz * 0.071 + 0.37 - warp * 0.5).rgb;
  vec3 gt = mix(g1, g2, smoothstep(0.25, 0.75, nM.b * 0.7 + nS.r * 0.3));
#else
  vec3 gt = g1;
#endif
  vec3 gdet = clamp(gt / uGrassAvg, vec3(0.35), vec3(1.9));
  gdet.b = gdet.g;
  gdet = mix(vec3(1.0), gdet, mix(0.85, 0.28, smoothstep(25.0, 200.0, camDist)));
  float pLight = smoothstep(0.42, 0.62, nL.r * 0.55 + nM.g * 0.45);
  float pDeep = smoothstep(0.5, 0.72, nL.g * 0.5 + nM.r * 0.5);
  vec3 macro = mix(uLush, uLight, pLight);
  macro = mix(macro, uDeep, pDeep * 0.75);
  macro = mix(macro, uGolden, sB.b * smoothstep(0.3, 0.6, nM.a) * 0.85);
  macro *= 0.88 + 0.24 * nS.r;
  // forest floor: deeper, cooler, with leaf litter
  float ff = sB.g;
  vec3 litter = mix(vec3(0.20, 0.13, 0.06), vec3(0.30, 0.22, 0.09), nX.r);
  macro = mix(macro, uForest * (0.85 + 0.3 * nS.g), ff * 0.8);
  vec3 col = macro * gdet;
  col = mix(col, litter, ff * smoothstep(0.55, 0.75, nX.g * 0.6 + nS.b * 0.4) * 0.6);
  // town lawn: tidier, a little darker
  col = mix(col, col * vec3(0.92, 0.96, 0.95), sB.a * 0.5);

  // ---- meadow flowers (speckles; geometry flowers are added near the camera)
  vec4 nF = texture2D(uNoiseTex, wxz * 0.95 + 0.71);
  float fl = smoothstep(0.80, 0.86, nF.a) * smoothstep(0.15, 0.6, sB.r);
  vec3 flc = nF.r < 0.3 ? vec3(1.0, 0.95, 0.85) : nF.r < 0.5 ? vec3(1.0, 0.78, 0.12) : nF.r < 0.7 ? vec3(0.95, 0.35, 0.62) : vec3(0.42, 0.55, 1.0);
  col = mix(col, flc, fl * 0.9);

  // ---- damp soil near water
  col *= mix(vec3(1.0), vec3(0.62, 0.70, 0.66), sA.a * 0.85);

  // ---- dirt paths with organic edges (grass encroaches)
  vec3 dirt = texture2D(uDirtTex, wxz * 0.26).rgb;
  float dw = smoothstep(0.42, 0.62, sA.r + (nS.r - 0.5) * 0.45 + (nX.g - 0.5) * 0.35);
  dirt *= mix(vec3(1.0), vec3(0.8, 0.82, 0.85), sA.a);
  col = mix(col, dirt, dw);

  // ---- riverbank sand and pebbles
  vec3 sand = uSand * clamp(natLuma3(dirt) / 0.25, vec3(0.75), vec3(1.25));
  vec3 peb = texture2D(uCobbleTex, wxz * 1.35).rgb;
  sand = mix(sand, peb * 1.05, smoothstep(0.45, 0.7, nS.g) * 0.75);
  float sw = smoothstep(0.35, 0.6, sA.g + (nX.b - 0.5) * 0.3);
  col = mix(col, sand, sw);

  // ---- cobbles (town streets / plaza)
  vec3 cob = texture2D(uCobbleTex, wxz * 0.36).rgb;
  float cw = smoothstep(0.4, 0.6, sA.b + (nX.r - 0.5) * 0.35);
  col = mix(col, cob, cw);

  // ---- rock and cliffs on steep slopes (triplanar)
  vec3 tn = normalize(vTN);
  float ny = tn.y;
  float rw = smoothstep(0.80, 0.68, ny + (nS.g - 0.5) * 0.14 + (nX.a - 0.5) * 0.05);
#ifndef TERRAIN_LQ
  vec3 bw = pow(abs(tn), vec3(4.0)); bw /= dot(bw, vec3(1.0));
  vec3 rx = texture2D(uRockTex, vec2(vTW.z, -vTW.y) * 0.085).rgb;
  vec3 rz = texture2D(uRockTex, vec2(vTW.x, -vTW.y) * 0.085).rgb;
  vec3 ry = texture2D(uRockTex, wxz * 0.085).rgb;
  vec3 rock = rx * bw.x + ry * bw.y + rz * bw.z;
#else
  vec3 rock = abs(tn.x) > abs(tn.z) ? texture2D(uRockTex, vec2(vTW.z, -vTW.y) * 0.085).rgb : texture2D(uRockTex, vec2(vTW.x, -vTW.y) * 0.085).rgb;
#endif
  rock *= mix(vec3(1.0), vec3(0.93, 0.96, 1.04), nM.r);
  // moss on the less steep parts of the rock
  rock = mix(rock, col * 0.85, smoothstep(0.62, 0.78, ny) * 0.55);
  col = mix(col, rock, rw);

  // ---- snow on the high rim peaks
  float sn = smoothstep(175.0, 215.0, vTW.y + (nM.b - 0.5) * 70.0) * smoothstep(0.35, 0.6, ny + 0.25);
  col = mix(col, uSnow * (0.9 + 0.1 * nS.r), sn);

  diffuseColor.rgb *= col;
}
`;

function createTerrainMaterial(tex, quality) {
  const mat = createToonMaterial({ kind: 'ground', color: 0xffffff });
  const c = (hex) => new THREE.Color(hex);
  patchMaterial(mat, {
    key: 'terrain-splat' + (quality.name === 'low' ? '-lq' : ''),
    defines: quality.name === 'low' ? { TERRAIN_LQ: '' } : {},
    uniforms: {
      uSplatA: { value: tex.splatA }, uSplatB: { value: tex.splatB }, uNoiseTex: WIND.uNoiseTex,
      uGrassTex: { value: tex.grass }, uDirtTex: { value: tex.dirt }, uRockTex: { value: tex.rock }, uCobbleTex: { value: tex.cobble },
      uGrassAvg: { value: c(0x63ae25) },
      uLush: { value: c(0x5fb444) }, uLight: { value: c(0x9ad25c) }, uDeep: { value: c(0x3f9440) },
      uGolden: { value: c(0xc2c25e) }, uForest: { value: c(0x3c7a3c) }, uSand: { value: c(0xd8c79c) }, uSnow: { value: c(0xf2f6ff) },
    },
    vertexPars: TERRAIN_VERT_PARS,
    fragmentPars: TERRAIN_FRAG_PARS,
    vertex: [['#include <begin_vertex>', 'vTW = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvTN = normalize(mat3(modelMatrix) * objectNormal);']],
    fragment: [['#include <color_fragment>', TERRAIN_FRAG, 'replace']],
  });
  return mat;
}

// ------------------------------------------------------------------ quadtree LOD
class TerrainLOD {
  constructor(scene, material, quality) {
    this.scene = scene;
    this.material = material;
    const low = quality.name === 'low';
    this.N = low ? 20 : 32;
    this.K = low ? 1.7 : 2.3;
    this.maxLevel = 5; // 800 m root → 25 m leaves
    this.cache = new Map();
    this.group = new THREE.Group();
    this.group.name = 'terrain';
    scene.add(this.group);
    this.last = new THREE.Vector3(1e9, 0, 0);
    this.index = this.buildIndex();
    this.frame = 0;
  }
  buildIndex() {
    const N = this.N, V = N + 1, idx = [];
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const a = j * V + i, b = (j + 1) * V + i, c = j * V + i + 1, d = (j + 1) * V + i + 1;
      if ((i + j) & 1) idx.push(a, b, c, b, d, c); else idx.push(a, b, d, a, d, c);
    }
    const border = this.borderList();
    const base = V * V;
    for (let k = 0; k < border.length; k++) {
      const b0 = border[k], b1 = border[(k + 1) % border.length], s0 = base + k, s1 = base + (k + 1) % border.length;
      idx.push(b0, s0, b1, b1, s0, s1, b0, b1, s0, b1, s1, s0);
    }
    return new THREE.BufferAttribute(new Uint16Array(idx), 1);
  }
  borderList() {
    const N = this.N, V = N + 1, out = [];
    for (let i = 0; i < N; i++) out.push(i);                 // top
    for (let j = 0; j < N; j++) out.push(j * V + N);         // right
    for (let i = N; i > 0; i--) out.push(N * V + i);         // bottom
    for (let j = N; j > 0; j--) out.push(j * V);             // left
    return out;
  }
  buildNode(x0, z0, size) {
    const N = this.N, V = N + 1, P = N + 3, s = size / N;
    const hp = new Float32Array(P * P);
    for (let j = 0; j < P; j++) for (let i = 0; i < P; i++) hp[j * P + i] = visualHeightAt(x0 + (i - 1) * s, z0 + (j - 1) * s);
    const border = this.borderList();
    const count = V * V + border.length;
    const pos = new Float32Array(count * 3), nor = new Float32Array(count * 3);
    for (let j = 0; j < V; j++) for (let i = 0; i < V; i++) {
      const k = j * V + i, h = hp[(j + 1) * P + i + 1];
      pos[k * 3] = x0 + i * s; pos[k * 3 + 1] = h; pos[k * 3 + 2] = z0 + j * s;
      const hx = hp[(j + 1) * P + i + 2] - hp[(j + 1) * P + i], hz = hp[(j + 2) * P + i + 1] - hp[j * P + i + 1];
      const nx = -hx, ny = 2 * s, nz = -hz, l = Math.hypot(nx, ny, nz);
      nor[k * 3] = nx / l; nor[k * 3 + 1] = ny / l; nor[k * 3 + 2] = nz / l;
    }
    const drop = Math.max(0.6, s * 1.5);
    for (let b = 0; b < border.length; b++) {
      const src = border[b], k = V * V + b;
      pos[k * 3] = pos[src * 3]; pos[k * 3 + 1] = pos[src * 3 + 1] - drop; pos[k * 3 + 2] = pos[src * 3 + 2];
      nor[k * 3] = nor[src * 3]; nor[k * 3 + 1] = nor[src * 3 + 1]; nor[k * 3 + 2] = nor[src * 3 + 2];
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    g.setIndex(this.index);
    g.computeBoundingSphere();
    g.computeBoundingBox();
    const m = new THREE.Mesh(g, this.material);
    m.receiveShadow = true;
    m.castShadow = false;
    m.matrixAutoUpdate = false;
    m.updateMatrix();
    return m;
  }
  update(cam, force = false) {
    if (!force && cam.distanceToSquared(this.last) < 4) return;
    this.last.copy(cam);
    const leaves = [];
    const visit = (x0, z0, size, level) => {
      const cx = x0 + size / 2, cz = z0 + size / 2;
      const dx = Math.max(0, Math.abs(cam.x - cx) - size / 2), dz = Math.max(0, Math.abs(cam.z - cz) - size / 2);
      const dy = Math.max(0, cam.y - visualHeightAt(cx, cz) - 10);
      const d = Math.hypot(dx, dz, dy);
      if (level < this.maxLevel && d < size * this.K) {
        const h = size / 2;
        visit(x0, z0, h, level + 1); visit(x0 + h, z0, h, level + 1); visit(x0, z0 + h, h, level + 1); visit(x0 + h, z0 + h, h, level + 1);
      } else leaves.push([x0, z0, size, level]);
    };
    visit(-HALF, -HALF, HALF * 2, 0);
    const want = new Set();
    for (const [x0, z0, size, level] of leaves) {
      const key = level + ':' + x0 + ':' + z0;
      want.add(key);
      let m = this.cache.get(key);
      if (!m) { m = this.buildNode(x0, z0, size); this.cache.set(key, m); }
      m.userData.used = ++this.frame;
      if (m.parent !== this.group) this.group.add(m);
    }
    for (const [key, m] of this.cache) {
      if (!want.has(key) && m.parent) this.group.remove(m);
    }
    if (this.cache.size > 420) {
      const old = [...this.cache.entries()].filter(([k]) => !want.has(k)).sort((a, b) => a[1].userData.used - b[1].userData.used);
      for (let i = 0; i < old.length && this.cache.size > 300; i++) { old[i][1].geometry.dispose(); this.cache.delete(old[i][0]); }
    }
    this.leafCount = leaves.length;
  }
}

export async function create(ctx) {
  const { scene, camera, quality } = ctx;
  const data = getWorldData(quality);
  const tex = await loadNatureTextures(ctx);
  WIND.uNoiseTex.value = tex.noise;
  const splatA = makeSplatTexture(data.splatA), splatB = makeSplatTexture(data.splatB);
  const material = createTerrainMaterial({ ...tex, splatA, splatB }, quality);
  Object.assign(terrainShared, { splatA, splatB, material });
  const lod = new TerrainLOD(scene, material, quality);
  lod.update(camera.position, true);
  ctx.updaters.push(() => lod.update(camera.position));
  ctx.colliders.push({ kind: 'heightfield', heightAt, size: HALF * 2, resolution: 256 });
  return {
    heightAt,
    visualHeightAt,
    material,
    group: lod.group,
    /** Splat/mask lookup at a world point: {path, sand, cobble, damp, meadow, forest, golden, town}. */
    surfaceAt: splatAt,
    pathDistance: pathDist,
    inTown,
    stats: () => ({ leaves: lod.leafCount, cached: lod.cache.size }),
  };
}
