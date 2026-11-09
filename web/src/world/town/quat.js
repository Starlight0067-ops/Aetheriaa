// CC0 Quaternius "Medieval Village MegaKit" (Standard) pieces -> town kit pieces.
// Every glTF is converted into the same { parts: Map(slot -> geometry) } format as our Blender kit so it
// goes through the StaticBatcher (one BatchedMesh per material). Their painted base-colour textures are
// kept as maps on toon materials created through createToonMaterial.
import * as THREE from 'three';
import { createToonMaterial } from '../../render/toon.js';
import { normalizeGeometry } from './batch.js';

const DIR = '/assets/free/medieval/';

const SLOT = {
  MI_WoodTrim: ['q_wood', 'wood'], MI_WoodTrim_Wear: ['q_wear', 'wood'], MI_Plaster: ['q_plaster', 'plaster'],
  MI_Brick: ['q_brick', 'stone'], MI_RedBrick: ['q_redbrick', 'stone'], MI_UnevenBrick: ['q_uneven', 'stone'],
  MI_RockTrim: ['q_rock', 'stone'], MI_RoundTiles: ['q_tiles', 'roof'], MI_MetalOrnaments: ['q_metal', 'metal'],
  MI_WindowGlass: ['q_glass', 'metal'], MI_Vine: ['q_vine', 'foliage'],
};

export const QUAT_PIECES = [
  'Prop_Wagon', 'Prop_Crate', 'Prop_MetalFence_Ornament', 'Prop_MetalFence_Simple', 'Prop_Vine1', 'Prop_Vine2', 'Prop_Vine5',
  'Prop_Vine6', 'Prop_Vine9', 'Prop_WoodenFence_Single', 'Prop_WoodenFence_Extension1', 'Prop_ExteriorBorder_Straight1',
  'Prop_ExteriorBorder_Corner', 'Prop_Brick1', 'Prop_Brick2', 'Prop_Brick3', 'Prop_Chimney', 'Balcony_Cross_Straight',
  'Balcony_Simple_Straight', 'WindowShutters_Wide_Round_Open', 'Wall_Arch', 'Roof_Dormer_RoundTile', 'Prop_Support', 'Floor_WoodDark',
];

/** Loads the listed pieces (missing files are skipped) and registers their materials into mats. */
export async function loadQuaternius(ctx, mats, names = QUAT_PIECES) {
  const pieces = new Map();
  const texCache = new Map();
  const results = await Promise.allSettled(names.map((n) => ctx.assets.loadGLTF(DIR + n + '.gltf').then((g) => [n, g])));
  for (const r of results) {
    if (r.status !== 'fulfilled') continue;
    const [name, gltf] = r.value;
    const parts = new Map();
    gltf.scene.updateMatrixWorld(true);
    gltf.scene.traverse((o) => {
      if (!o.isMesh) return;
      const src = Array.isArray(o.material) ? o.material[0] : o.material;
      const slot = SLOT[src?.name] || ['q_wood', 'wood'];
      if (!mats[slot[0]]) {
        let map = src?.map || null;
        if (map) { map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = ctx.quality.anisotropy || 4; }
        const isVine = slot[0] === 'q_vine';
        const isGlass = slot[0] === 'q_glass';
        mats[slot[0]] = createToonMaterial({
          map: isGlass ? null : map, vertexColors: true, kind: slot[1], side: THREE.DoubleSide,
          color: isGlass ? 0x5d8fb0 : (isVine ? 0x6fae4a : 0xffffff),
          alphaTest: isVine ? 0.5 : 0, alphaMap: isVine ? map : null,
        });
        mats[slot[0]].name = 'town_' + slot[0];
      }
      const geo = normalizeGeometry(o.geometry, o.matrixWorld);
      // soft AO: darken low vertices a little (pieces have no baked AO)
      const p = geo.attributes.position, c = geo.attributes.color;
      for (let i = 0; i < p.count; i++) { const t = 0.82 + 0.18 * Math.min(1, Math.max(0, p.getY(i) / 1.2)); c.setXYZ(i, t, t, t); }
      if (parts.has(slot[0])) {
        const merged = mergeBoth(parts.get(slot[0]), geo);
        parts.set(slot[0], merged);
      } else parts.set(slot[0], geo);
    });
    const box = new THREE.Box3();
    for (const g of parts.values()) box.union(g.boundingBox);
    pieces.set('q:' + name, { parts, box });
  }
  return pieces;
}

function mergeBoth(a, b) {
  const g = new THREE.BufferGeometry();
  for (const k of ['position', 'normal', 'uv', 'color']) {
    const A = a.attributes[k], B = b.attributes[k];
    const arr = new Float32Array(A.array.length + B.array.length);
    arr.set(A.array, 0); arr.set(B.array, A.array.length);
    g.setAttribute(k, new THREE.BufferAttribute(arr, A.itemSize));
  }
  const off = a.attributes.position.count;
  const ia = a.index.array, ib = b.index.array;
  const idx = new Uint32Array(ia.length + ib.length);
  idx.set(ia, 0);
  for (let i = 0; i < ib.length; i++) idx[ia.length + i] = ib[i] + off;
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  g.computeBoundingBox(); g.computeBoundingSphere();
  return g;
}
