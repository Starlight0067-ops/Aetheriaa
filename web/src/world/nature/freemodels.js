import { asset } from '../../core/paths.js';
// CC0 Quaternius "Stylized Nature MegaKit" integration (public/assets/free/nature, licence CC0 1.0).
// Loads glTF models, bakes them into per-material parts (foliage parts get wind weights, soft sphere
// normals and AO vertex colours), builds render-to-texture impostors for distant trees, and provides an
// instanced, distance-culled layer for ground detail (bushes, ferns, plants, flowers, mushrooms, pebbles,
// stepping stones, rocks). All materials are created through the toon factory with the kit's textures.
import * as THREE from 'three';
import { createToonMaterial } from '../../render/toon.js';
import { windPatch, depthMaterialFor, hazePatch } from './trees.js';

const BASE = asset('assets/free/nature/');
const matCache = new Map();

function kindOf(name) {
  if (/bark/i.test(name)) return 'wood';
  if (/rock/i.test(name)) return 'stone';
  if (/grass/i.test(name)) return 'grass';
  return 'foliage';
}

/** Toon material for a kit material (shared by name). */
function toonFor(src, foliage) {
  const key = src.name + (foliage ? ':f' : '');
  if (matCache.has(key)) return matCache.get(key);
  const map = src.map || null;
  if (map) { map.anisotropy = 4; }
  const alpha = src.alphaTest > 0 || src.transparent || /leaf|leaves|flower/i.test(src.name);
  const m = createToonMaterial({
    kind: kindOf(src.name), map, vertexColors: true,
    alphaTest: alpha ? 0.5 : 0, side: alpha || src.side === THREE.DoubleSide ? THREE.DoubleSide : THREE.FrontSide,
  });
  const scale = /bark/i.test(src.name) ? 0.15 : 0.3;
  if (foliage || /bark/i.test(src.name)) windPatch(m, foliage ? 'kit-foliage' : 'kit-bark', scale, foliage);
  else hazePatch(m, 'kit-static');
  const entry = { mat: m, depth: alpha ? depthMaterialFor(m, 'kit-foliage', scale) : null };
  matCache.set(key, entry);
  return entry;
}

/** Load a kit model and bake it into parts [{geometry, material, depth, foliage}]. */
export async function loadKitModel(ctx, name, opts = {}) {
  const gltf = await ctx.assets.loadGLTF(BASE + name + '.gltf');
  gltf.scene.updateMatrixWorld(true);
  const groups = new Map();
  gltf.scene.traverse((o) => {
    if (!o.isMesh) return;
    const g = o.geometry.clone();
    g.applyMatrix4(o.matrixWorld);
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    const key = o.material.name;
    if (!groups.has(key)) groups.set(key, { src: o.material, geos: [] });
    groups.get(key).geos.push(g);
  });
  const box = new THREE.Box3();
  for (const { geos } of groups.values()) for (const g of geos) { g.computeBoundingBox(); box.union(g.boundingBox); }
  const H = Math.max(0.1, box.max.y);
  const parts = [];
  for (const { src, geos } of groups.values()) {
    const g = geos.length === 1 ? geos[0] : mergeSimple(geos);
    const foliage = /leaf|leaves|flower|grass/i.test(src.name) && !/bark/i.test(src.name);
    decorate(g, foliage, box, H, opts);
    const t = toonFor(src, foliage);
    parts.push({ geometry: g, material: t.mat, depth: t.depth, foliage, name: src.name });
  }
  return { name, parts, box, height: H, radius: Math.max(box.max.x - box.min.x, box.max.z - box.min.z) * 0.5 };
}

function mergeSimple(geos) {
  let count = 0, icount = 0;
  for (const g of geos) { count += g.attributes.position.count; icount += g.index ? g.index.count : g.attributes.position.count; }
  const pos = new Float32Array(count * 3), nor = new Float32Array(count * 3), uv = new Float32Array(count * 2), idx = new Uint32Array(icount);
  let vo = 0, io = 0;
  for (const g of geos) {
    const n = g.attributes.position.count;
    pos.set(g.attributes.position.array, vo * 3); nor.set(g.attributes.normal.array, vo * 3); uv.set(g.attributes.uv.array, vo * 2);
    if (g.index) { for (let i = 0; i < g.index.count; i++) idx[io++] = g.index.array[i] + vo; } else for (let i = 0; i < n; i++) idx[io++] = vo + i;
    vo += n;
  }
  const m = new THREE.BufferGeometry();
  m.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  m.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  m.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  m.setIndex(new THREE.BufferAttribute(idx, 1));
  return m;
}

/** Adds aWind, AO colour and (for foliage) sphere-blended normals + a sphereNormal attribute. */
function decorate(g, foliage, box, H, opts) {
  const p = g.attributes.position, n = g.attributes.normal, N = p.count;
  const wind = new Float32Array(N * 4), col = new Float32Array(N * 3), sph = new Float32Array(N * 3);
  // canopy centre/extent from foliage vertices
  const c = new THREE.Vector3(), ext = new THREE.Vector3(1, 1, 1);
  if (foliage) {
    const fb = new THREE.Box3().setFromBufferAttribute(p);
    fb.getCenter(c); fb.getSize(ext).multiplyScalar(0.5).max(new THREE.Vector3(0.2, 0.2, 0.2));
  }
  const v = new THREE.Vector3(), s = new THREE.Vector3(), nn = new THREE.Vector3();
  const tint = opts.tint || [1, 1, 1];
  for (let i = 0; i < N; i++) {
    v.fromBufferAttribute(p, i);
    const h = Math.max(0, v.y) / H;
    wind[i * 4] = foliage ? Math.min(1.2, h * h * 1.1 + 0.08) : h * h * 0.6;
    wind[i * 4 + 1] = (Math.sin(v.x * 1.7 + v.z * 2.3) * 0.5 + 0.5);
    wind[i * 4 + 2] = foliage ? 1 : 0;
    if (foliage) {
      s.copy(v).sub(c).divide(ext);
      const rel = Math.min(1, s.length());
      s.normalize();
      nn.fromBufferAttribute(n, i).multiplyScalar(0.25).add(s).normalize();
      n.setXYZ(i, nn.x, nn.y, nn.z);
      sph[i * 3] = s.x; sph[i * 3 + 1] = s.y; sph[i * 3 + 2] = s.z;
      const ao = Math.min(1.08, 0.6 + 0.28 * Math.min(1, Math.max(0, (v.y - (c.y - ext.y)) / (2 * ext.y))) + 0.25 * Math.max(0, rel - 0.35) + 0.06 * s.y);
      col[i * 3] = tint[0] * ao; col[i * 3 + 1] = tint[1] * ao; col[i * 3 + 2] = tint[2] * ao;
    } else {
      nn.fromBufferAttribute(n, i);
      sph[i * 3] = nn.x; sph[i * 3 + 1] = nn.y; sph[i * 3 + 2] = nn.z;
      const ao = 0.62 + 0.38 * Math.min(1, v.y / Math.max(0.6, H * 0.35));
      col[i * 3] = ao; col[i * 3 + 1] = ao; col[i * 3 + 2] = ao;
    }
  }
  g.setAttribute('aWind', new THREE.BufferAttribute(wind, 4));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setAttribute('sphereNormal', new THREE.BufferAttribute(sph, 3));
  g.computeBoundingSphere();
}

/**
 * Render-to-texture impostor: two orthographic side views (front | side) of the model's albedo into one
 * texture, mapped onto two crossed cards with sphere-blended normals.
 */
export function makeImpostor(renderer, model, tint = [1, 1, 1]) {
  const W = 512, Hh = 512;
  const rt = new THREE.WebGLRenderTarget(W * 2, Hh, { generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter, colorSpace: THREE.NoColorSpace });
  const scene = new THREE.Scene();
  const mats = [];
  for (const part of model.parts) {
    const m = new THREE.MeshBasicMaterial({ map: part.material.map, alphaTest: 0.5, side: THREE.DoubleSide, vertexColors: true });
    mats.push(m);
    scene.add(new THREE.Mesh(part.geometry, m));
  }
  const b = model.box;
  const half = Math.max(b.max.x - b.min.x, b.max.z - b.min.z, b.max.y - b.min.y) * 0.5 + 0.1;
  const cy = (b.max.y + b.min.y) * 0.5;
  const cam = new THREE.OrthographicCamera(-half, half, half, -half, 0.1, 200);
  const prev = { rt: renderer.getRenderTarget(), tm: renderer.toneMapping, clear: renderer.getClearColor(new THREE.Color()), alpha: renderer.getClearAlpha(), auto: renderer.autoClear, shadow: renderer.shadowMap.enabled };
  renderer.setRenderTarget(rt);
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.shadowMap.enabled = false;
  renderer.setClearColor(0x4a6a3a, 0);
  renderer.autoClear = false;
  renderer.clear(true, true, true);
  const cx = (b.max.x + b.min.x) * 0.5, cz = (b.max.z + b.min.z) * 0.5;
  for (let k = 0; k < 2; k++) {
    rt.viewport.set(k * W, 0, W, Hh);
    rt.scissor.set(k * W, 0, W, Hh); rt.scissorTest = true;
    if (k === 0) cam.position.set(cx, cy, cz + 100); else cam.position.set(cx + 100, cy, cz);
    cam.lookAt(cx, cy, cz);
    cam.updateProjectionMatrix();
    renderer.setRenderTarget(rt);
    renderer.render(scene, cam);
  }
  rt.scissorTest = false;
  renderer.setRenderTarget(prev.rt);
  renderer.toneMapping = prev.tm;
  renderer.setClearColor(prev.clear, prev.alpha);
  renderer.autoClear = prev.auto;
  renderer.shadowMap.enabled = prev.shadow;
  mats.forEach((m) => m.dispose());
  // crossed cards
  const pos = [], nor = [], uv = [], col = [], sph = [], wnd = [], idx = [];
  const center = new THREE.Vector3(cx, cy + half * 0.1, cz);
  const quad = (axis, u0) => {
    const b0 = pos.length / 3;
    const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
    for (const [a, c] of corners) {
      const x = axis === 0 ? cx + a * half : cx, z = axis === 0 ? cz : cz - a * half, y = cy + c * half;
      pos.push(x, y, z);
      const sv = new THREE.Vector3(x, y, z).sub(center).normalize();
      const fn = axis === 0 ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(1, 0, 0);
      const nv = fn.multiplyScalar(0.2).add(sv).normalize();
      nor.push(nv.x, nv.y, nv.z); sph.push(sv.x, sv.y, sv.z);
      uv.push(u0 + (a * 0.5 + 0.5) * 0.5, c * 0.5 + 0.5);
      const ao = c < 0 ? 0.78 : 1.0;
      col.push(tint[0] * ao, tint[1] * ao, tint[2] * ao);
      wnd.push(c > 0 ? 0.6 : 0, 0, 0, 0);
    }
    idx.push(b0, b0 + 1, b0 + 2, b0, b0 + 2, b0 + 3);
  };
  quad(0, 0); quad(1, 0.5);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setAttribute('sphereNormal', new THREE.Float32BufferAttribute(sph, 3));
  g.setAttribute('aWind', new THREE.Float32BufferAttribute(wnd, 4));
  g.setIndex(idx);
  g.computeBoundingSphere();
  rt.texture.colorSpace = THREE.NoColorSpace;
  const mat = createToonMaterial({ kind: 'foliage', map: rt.texture, alphaTest: 0.5, side: THREE.DoubleSide, vertexColors: true });
  windPatch(mat, 'kit-impostor', 0.2, true);
  return { geometry: g, material: mat, depth: depthMaterialFor(mat, 'kit-impostor', 0.2), texture: rt.texture };
}

/** Instanced multi-part model layer with CPU distance + frustum culling. */
export class ModelLayer {
  constructor(group, model, { maxDist = 100, castShadow = false, receiveShadow = true } = {}) {
    this.model = model; this.group = group; this.maxDist = maxDist;
    this.castShadow = castShadow; this.receiveShadow = receiveShadow;
    this.items = [];
    this.radius = Math.max(0.5, model.radius);
  }
  add(x, y, z, rotY, sx, sy = sx, sz = sx, color = null, tilt = null) {
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rotY);
    if (tilt) q.premultiply(tilt);
    m.compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(sx, sy, sz));
    this.items.push({ x, y, z, m, c: color || new THREE.Color(1, 1, 1), s: Math.max(sx, sy, sz) });
  }
  finalize() {
    const n = Math.max(1, this.items.length);
    this.meshes = [];
    let first = null;
    for (const part of this.model.parts) {
      const im = new THREE.InstancedMesh(part.geometry, part.material, n);
      if (first) im.instanceMatrix = first.instanceMatrix;
      im.instanceColor = first ? first.instanceColor : new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3);
      im.frustumCulled = false;
      im.castShadow = this.castShadow;
      im.receiveShadow = this.receiveShadow;
      if (part.depth) im.customDepthMaterial = part.depth;
      im.count = 0;
      this.group.add(im);
      this.meshes.push(im);
      first = first || im;
    }
  }
  update(p, frustum, sphere) {
    if (!this.meshes.length) return;
    const first = this.meshes[0];
    const M = first.instanceMatrix.array, C = first.instanceColor.array;
    const md2 = this.maxDist * this.maxDist;
    let k = 0;
    for (const it of this.items) {
      const dx = it.x - p.x, dz = it.z - p.z;
      if (dx * dx + dz * dz > md2) continue;
      sphere.center.set(it.x, it.y + it.s * 0.5, it.z); sphere.radius = this.radius * it.s + 3;
      if (!frustum.intersectsSphere(sphere)) continue;
      it.m.toArray(M, k * 16); it.c.toArray(C, k * 3); k++;
    }
    for (const im of this.meshes) { im.count = k; im.visible = k > 0; }
    first.instanceMatrix.needsUpdate = true;
    first.instanceColor.needsUpdate = true;
  }
}
