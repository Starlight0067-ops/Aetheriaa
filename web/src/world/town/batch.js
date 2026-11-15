// Kit loading and static batching for Vael Harrow.
// Every placement (piece + matrix + per-material tint) ends up in one BatchedMesh per material
// (multi-draw, per-instance frustum culling, per-instance colour). Fallback: plain merged meshes.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/** Normalise a glTF primitive to indexed Float32 position/normal/uv/color(rgb). */
export function normalizeGeometry(src, matrix) {
  const g = new THREE.BufferGeometry();
  const n = src.attributes.position.count;
  const take = (name, size, def) => {
    const a = src.attributes[name];
    const out = new Float32Array(n * size);
    for (let i = 0; i < n; i++) {
      for (let k = 0; k < size; k++) {
        let v = def[k];
        if (a) {
          if (k === 0) v = a.getX(i); else if (k === 1) v = a.getY(i); else if (k === 2) v = (a.itemSize > 2 ? a.getZ(i) : def[k]);
        }
        out[i * size + k] = v;
      }
    }
    return new THREE.BufferAttribute(out, size);
  };
  g.setAttribute('position', take('position', 3, [0, 0, 0]));
  g.setAttribute('normal', take('normal', 3, [0, 1, 0]));
  g.setAttribute('uv', take('uv', 2, [0, 0]));
  g.setAttribute('color', take('color', 3, [1, 1, 1]));
  if (src.index) g.setIndex(new THREE.BufferAttribute(Uint32Array.from(src.index.array), 1));
  else { const idx = new Uint32Array(n); for (let i = 0; i < n; i++) idx[i] = i; g.setIndex(new THREE.BufferAttribute(idx, 1)); }
  if (matrix) g.applyMatrix4(matrix);
  g.computeBoundingBox();
  g.computeBoundingSphere();
  return g;
}

/** Load a kit GLB: returns Map(pieceName -> { parts: Map(matName -> geometry), box }) */
export async function loadKit(ctx, url) {
  const gltf = await ctx.assets.loadGLTF(url);
  const pieces = new Map();
  gltf.scene.updateMatrixWorld(true);
  for (const root of gltf.scene.children) {
    const parts = new Map();
    const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
    root.traverse((o) => {
      if (!o.isMesh) return;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      const m = new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld);
      const name = (mats[0]?.name || 'stone').replace(/\.\d+$/, '');
      const geo = normalizeGeometry(o.geometry, m);
      if (parts.has(name)) parts.set(name, mergeGeometries([parts.get(name), geo]));
      else parts.set(name, geo);
    });
    const box = new THREE.Box3();
    for (const g of parts.values()) box.union(g.boundingBox);
    pieces.set(root.name, { parts, box });
  }
  return pieces;
}

const _c = new THREE.Color();

/** Free a geometry's CPU arrays right after its buffers are uploaded (static meshes that are never read back). */
export function dropAfterUpload(geometry) {
  const drop = function () { this.array = null; };
  for (const k in geometry.attributes) { const a = geometry.attributes[k]; if (a.usage === THREE.StaticDrawUsage) a.onUpload(drop); }
  // the index stays: BatchedMesh reads index.array.BYTES_PER_ELEMENT every frame
}

export class StaticBatcher {
  constructor(mats, { useBatched = true, dropCpu = false } = {}) {
    this.mats = mats;
    this.dropCpu = dropCpu;       // mobile-safe: free the CPU copy of vertex data once it is on the GPU
    this.useBatched = useBatched;
    this.entries = [];          // { piece, lodPiece, matrix, tints, lodGroup }
    this.objects = [];
  }

  /** piece: kit piece; tints: { matName: hex|THREE.Color } ; lod: optional low-detail piece */
  add(piece, matrix, tints = {}, lod = null) {
    if (!piece) return null;
    const e = { piece, lod, matrix: matrix.clone(), tints, ids: {} };
    this.entries.push(e);
    return e;
  }

  build(scene) {
    const byMat = new Map();
    for (const e of this.entries) {
      for (const [mat, geo] of e.piece.parts) {
        if (!byMat.has(mat)) byMat.set(mat, { geos: new Map(), list: [] });
        const b = byMat.get(mat);
        b.geos.set(geo.uuid, geo);
        const lg = e.lod ? e.lod.parts.get(mat) : null;
        if (lg) b.geos.set(lg.uuid, lg);
        b.list.push({ e, geo, lg });
      }
      if (e.lod) {
        // materials only present in the LOD piece
        for (const [mat, lg] of e.lod.parts) {
          if (e.piece.parts.has(mat)) continue;
          if (!byMat.has(mat)) byMat.set(mat, { geos: new Map(), list: [] });
          const b = byMat.get(mat);
          b.geos.set(lg.uuid, lg);
          b.list.push({ e, geo: null, lg });
        }
      }
    }
    this.lodItems = [];
    let tris = 0;
    for (const [matName, b] of byMat) {
      const material = this.mats[matName] || this.mats.stone;
      let made = null;
      if (this.useBatched) {
        try { made = this._batched(matName, material, b); } catch (err) { console.warn('[town] BatchedMesh failed, merging', err); this.useBatched = false; }
      }
      if (!made) made = this._merged(matName, material, b);
      made.castShadow = matName !== 'glow';
      made.receiveShadow = true;
      made.name = 'town_' + matName;
      if (this.dropCpu) dropAfterUpload(made.geometry);
      scene.add(made);
      this.objects.push(made);
      for (const it of b.list) { const g = it.geo || it.lg; tris += g.index.count / 3; }
    }
    this.tris = tris;
    this.release();
    return this.objects;
  }

  /** Forget the kit pieces / source geometries (only matrices + LOD ids are needed from here on). */
  release() {
    for (const e of this.entries) { e.piece = null; e.lod = null; }
    for (const it of this.lodItems || []) { if (it.e) { it.e.piece = null; it.e.lod = null; } }
    this.entries.length = 0;
  }

  _batched(matName, material, b) {
    let verts = 0, idx = 0;
    for (const g of b.geos.values()) { verts += g.attributes.position.count; idx += g.index.count; }
    const bm = new THREE.BatchedMesh(b.list.length, verts, idx, material);
    const gid = new Map();
    for (const [uuid, g] of b.geos) gid.set(uuid, bm.addGeometry(g));
    for (const it of b.list) {
      const start = it.geo ? gid.get(it.geo.uuid) : gid.get(it.lg.uuid);
      const id = bm.addInstance(start);
      bm.setMatrixAt(id, it.e.matrix);
      const t = it.e.tints[matName];
      _c.set(t ?? 0xffffff);
      bm.setColorAt(id, _c);
      if (it.e.lod) {
        this.lodItems.push({ bm, id, g0: it.geo ? gid.get(it.geo.uuid) : -1, g1: it.lg ? gid.get(it.lg.uuid) : -1, e: it.e, cur: 0 });
        if (!it.geo) bm.setVisibleAt(id, false);
      }
    }
    return bm;
  }

  _merged(matName, material, b) {
    const geos = [];
    for (const it of b.list) {
      const src = it.geo || null;
      if (!src) continue;
      const g = src.clone();
      g.applyMatrix4(it.e.matrix);
      const t = it.e.tints[matName];
      if (t !== undefined) {
        _c.set(t);
        const c = g.attributes.color;
        for (let i = 0; i < c.count; i++) c.setXYZ(i, c.getX(i) * _c.r, c.getY(i) * _c.g, c.getZ(i) * _c.b);
      }
      geos.push(g);
    }
    const merged = geos.length ? mergeGeometries(geos) : new THREE.BufferGeometry();
    return new THREE.Mesh(merged, material);
  }

  /** Swap LOD per instance by distance to the camera (BatchedMesh path only). */
  updateLOD(camPos, dist) {
    if (!this.lodItems?.length) return;
    const d2 = dist * dist;
    const p = new THREE.Vector3();
    for (const it of this.lodItems) {
      p.setFromMatrixPosition(it.e.matrix);
      const want = p.distanceToSquared(camPos) > d2 ? 1 : 0;
      if (want === it.cur) continue;
      it.cur = want;
      const g = want ? it.g1 : it.g0;
      if (g < 0) it.bm.setVisibleAt(it.id, false);
      else { it.bm.setGeometryIdAt(it.id, g); it.bm.setVisibleAt(it.id, true); }
    }
  }
}
