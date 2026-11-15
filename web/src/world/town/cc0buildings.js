import { asset } from '../../core/paths.js';
// Third-party CC0 building models (public/assets/cc0/buildings, see LICENSES.md there) placed on the
// town plan instead of the generated half-timbered kit. The plan (positions, yaw, footprints, colliders)
// is untouched: each model is scaled to the footprint of the house it replaces. One InstancedMesh per
// model mesh keeps the draw calls low. Disable with ?buildings=kit.
import * as THREE from 'three';
import { createToonMaterial } from '../../render/toon.js';
import { deriveNormalMap } from '../../render/detailmaps.js';

const DIR = asset('assets/cc0/buildings/');
const NAMES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map((k) => 'building_' + k);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

/** Loads every building model. Resolves [] when none is available (caller falls back to the kit). */
export async function loadCC0Buildings(ctx) {
  const res = await Promise.allSettled(NAMES.map((n) => ctx.assets.loadGLTF(DIR + n + '.glb')));
  const models = [];
  const matCache = new Map();
  res.forEach((r, i) => {
    if (r.status !== 'fulfilled') { console.warn('[town] cc0 building missing', NAMES[i]); return; }
    const scene = r.value.scene;
    scene.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(scene);
    const size = box.getSize(new THREE.Vector3());
    if (!(size.x > 0 && size.y > 0 && size.z > 0)) return;
    const meshes = [];
    scene.traverse((o) => {
      if (!o.isMesh) return;
      const src = Array.isArray(o.material) ? o.material[0] : o.material;
      let m = matCache.get(src);
      if (!m) {
        if (src.map) { src.map.colorSpace = THREE.SRGBColorSpace; src.map.anisotropy = ctx.quality.anisotropy || 4; }
        const nrm = src.map && ctx.quality.normalMaps ? deriveNormalMap(src.map, { strength: 2.2 }) : null;
        m = createToonMaterial({ map: src.map || null, color: src.color ? src.color.clone() : 0xffffff, kind: 'plaster', ...(nrm ? { normalMap: nrm } : {}) });
        m.name = 'cc0_building';
        matCache.set(src, m);
      }
      meshes.push({ geometry: o.geometry, material: m, matrix: o.matrixWorld.clone() });
    });
    models.push({ name: NAMES[i], meshes, size, center: box.getCenter(new THREE.Vector3()), minY: box.min.y, matrices: [] });
  });
  return models;
}

/** Queue one building for a plan house. `variant` picks the model. Returns the placed height. */
export function addCC0House(models, h, variant) {
  const { W, D, height } = h.def;
  // prefer models whose footprint aspect is close to the plot (less stretching), keep some variety
  const want = W / D;
  const ranked = models.map((m) => ({ m, err: Math.abs(Math.log((m.size.x / m.size.z) / want)) })).sort((a, b) => a.err - b.err);
  const pool = ranked.slice(0, Math.max(3, Math.ceil(ranked.length * 0.6)));
  const m = pool[variant % pool.length].m;
  const sx = W / m.size.x, sz = D / m.size.z;
  const base = Math.sqrt(sx * sz);
  const sy = clamp(height / m.size.y, base * 0.85, base * 1.3);
  const c = Math.cos(h.yaw), s = Math.sin(h.yaw);
  const pos = new THREE.Vector3(h.x - s * D / 2, h.floorY, h.z - c * D / 2);
  const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), h.yaw);
  const place = new THREE.Matrix4().compose(pos, q, new THREE.Vector3(sx, sy, sz));
  // recentre the model on its footprint, base on y = 0
  const recentre = new THREE.Matrix4().makeTranslation(-m.center.x, -m.minY, -m.center.z);
  m.matrices.push(place.multiply(recentre));
  return m.size.y * sy;
}

/** Build the InstancedMeshes for everything queued with addCC0House. */
export function buildCC0Houses(models, group, { shadows = true } = {}) {
  let count = 0;
  for (const m of models) {
    if (!m.matrices.length) continue;
    for (const part of m.meshes) {
      const im = new THREE.InstancedMesh(part.geometry, part.material, m.matrices.length);
      const tmp = new THREE.Matrix4();
      m.matrices.forEach((mat, i) => im.setMatrixAt(i, tmp.multiplyMatrices(mat, part.matrix)));
      im.instanceMatrix.needsUpdate = true;
      im.computeBoundingSphere(); im.computeBoundingBox();
      im.castShadow = shadows; im.receiveShadow = true;
      im.name = 'cc0_' + m.name;
      group.add(im);
    }
    count += m.matrices.length;
  }
  return count;
}
