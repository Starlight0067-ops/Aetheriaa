import { asset } from '../core/paths.js';
// Vael Harrow — town assembly (owner: town agent).
// Kit pieces come from tools/blender/town/*.py (GLBs in public/assets/town). The plan (plan.js) places
// houses along the street backbone on heightAt; everything static is batched per material.
import * as THREE from 'three';
import { POI, heightAt } from '../core/layout.js';
import { createMaterials, PALETTE } from './town/materials.js';
import { loadKit, StaticBatcher, normalizeGeometry } from './town/batch.js';
import { makePlan } from './town/plan.js';
import { buildStreets, buildPlaza, buildSteps, buildPaving } from './town/streets.js';
import { dressPlaza } from './town/plazadress.js';
import { loadQuaternius, QUAT_PIECES } from './town/quat.js';
import { placeLandmarks } from './town/landmarks.js';
import { placeProps } from './town/props.js';
import { createDynamics } from './town/dynamic.js';
import { HOUSE_KIT_PIECES, buildKitHouses } from './town/medievalkit.js';
import { loadCC0Buildings, addCC0House, buildCC0Houses } from './town/cc0buildings.js';

const BASE = asset('assets/town/');
// per-house tints for the Quaternius kit houses (multiplied with the kit's plaster / roof-tile textures)
const KIT_PLASTER = [0xffffff, 0xfff1d6, 0xf6e3c4, 0xffe9dc, 0xe9eef2, 0xf7f0e2, 0xf3dcc0, 0xfdf6e8];
const KIT_ROOF = [0xffffff, 0xf2d9cc, 0xffe2cf, 0xdcc0b4, 0xf5cdb5, 0xcfd6dc, 0xffffff, 0xe8c4ae];

async function fetchJSON(url) {
  try { const r = await fetch(url); if (!r.ok) return null; return await r.json(); } catch { return null; }
}

/** A simple stone block piece (foundations / plinths) with metre UVs. */
function blockPiece() {
  const g = new THREE.BoxGeometry(1, 1, 1);
  g.translate(0, -0.5, 0);
  const pos = g.attributes.position, nrm = g.attributes.normal, uv = g.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    const ax = Math.abs(nrm.getX(i)), ay = Math.abs(nrm.getY(i));
    uv.setXY(i, ay > 0.5 ? pos.getX(i) : (ax > 0.5 ? pos.getZ(i) : pos.getX(i)), ay > 0.5 ? pos.getZ(i) : pos.getY(i));
  }
  const col = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) { const t = 0.75 + 0.25 * (pos.getY(i) + 1); col.set([t, t, t], i * 3); }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return { parts: new Map([['stone', normalizeGeometry(g)]]), box: new THREE.Box3(new THREE.Vector3(-0.5, -1, -0.5), new THREE.Vector3(0.5, 0, 0.5)) };
}

export async function create(ctx) {
  const { scene } = ctx;
  const group = new THREE.Group();
  group.name = 'town';
  scene.add(group);
  const api = { group, stats: {} };
  const t0 = performance.now();
  try {
    const [{ mats, missing }, houseDefs] = await Promise.all([createMaterials(ctx), fetchJSON(BASE + 'houses.json')]);
    if (missing.length) console.info('[town] textures missing, using procedural fallback:', missing.join(', '));
    api.materials = mats;
    const kits = {};
    const loads = ['houses', 'landmarks'].map(async (k) => {
      try { kits[k] = await loadKit(ctx, BASE + k + '.glb'); } catch (e) { console.warn('[town] kit missing', k, e?.message || e); kits[k] = new Map(); }
    });
    // House visuals (?buildings=): 'medieval' (default) = houses assembled from the third-party CC0 Quaternius
    // Medieval Village kit; 'blocks' = CC0 low-poly block buildings from /assets/cc0; 'kit' = generated half-timbered kit.
    const mode = ctx.params.get('buildings') || 'medieval';
    let quat = new Map();
    loads.push(loadQuaternius(ctx, mats, mode === 'medieval' ? [...new Set([...QUAT_PIECES, ...HOUSE_KIT_PIECES])] : QUAT_PIECES).then((m) => { quat = m; }).catch((e) => console.warn('[town] quaternius kit', e)));
    let cc0 = [];
    if (mode === 'blocks') loads.push(loadCC0Buildings(ctx).then((m) => { cc0 = m; }).catch((e) => console.warn('[town] cc0 buildings', e)));
    const pending = Promise.all(loads);
    ctx.pending.push(pending);
    await pending;
    const allPieces = new Map([...kits.houses, ...kits.landmarks, ...quat]);
    allPieces.set('block', blockPiece());
    const piece = (n) => allPieces.get(n);

    const plan = makePlan((houseDefs || []).filter((d) => kits.houses.has(d.name)));
    api.plan = plan;
    const useCC0 = cc0.length > 0;
    let kitHouses = new Map();
    if (mode === 'medieval') { try { kitHouses = buildKitHouses(quat, plan.defs || houseDefs || []); } catch (e) { console.warn('[town] medieval kit houses', e); } }
    plan.cc0Houses = useCC0 || kitHouses.size > 0;   // facade dressing made for the generated kit (vines, balconies) is skipped
    const useBatched = ctx.params.get('townBatch') !== '0';
    const batch = new StaticBatcher(mats, { useBatched, dropCpu: !!ctx.quality.safe });
    const tmpM = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
    const col = (pal, i) => PALETTE[pal][i % PALETTE[pal].length];

    // ---------------- houses
    for (const h of plan.houses) {
      const p = piece(h.def.name);
      if (!p) continue;
      if (ctx.quality.safe >= 2 && Math.hypot(h.x, h.z) > 85) continue;   // safe=2: reduced world (outer districts omitted)
      q.setFromAxisAngle(up, h.yaw);
      tmpM.compose(new THREE.Vector3(h.x, h.floorY, h.z), q, new THREE.Vector3(1, 1, 1));
      const tints = { roof: col('roof', h.tint.roof), plaster: col('plaster', h.tint.plaster), timber: col('timber', h.tint.timber),
        stone: col('stone', h.tint.stone), paint: col('paint', h.tint.paint) };
      const c0 = Math.cos(h.yaw), s0 = Math.sin(h.yaw);
      const kh = kitHouses.get(h.def.name);
      const replaced = useCC0 || !!kh;
      if (useCC0) addCC0House(cc0, h, Math.floor(Math.abs(h.x * 7.3 + h.z * 3.1)) + h.tint.roof);
      else if (kh) batch.add(kh, tmpM, { q_plaster: KIT_PLASTER[h.tint.plaster % KIT_PLASTER.length], q_tiles: KIT_ROOF[h.tint.roof % KIT_ROOF.length] });
      else batch.add(p, tmpM, tints, piece(h.def.name + '_L1'));
      // stone plinth down to the lowest ground under the footprint (third-party models have no foundation)
      if (replaced && h.floorY - h.minY > 0.15) {
        tmpM.compose(new THREE.Vector3(h.x - s0 * h.def.D / 2, h.floorY + 0.02, h.z - c0 * h.def.D / 2), q, new THREE.Vector3(h.def.W + 0.3, h.floorY - h.minY + 1.0, h.def.D + 0.3));
        batch.add(piece('block'), tmpM, { stone: tints.stone });
      }
      // deep foundations on steep ground
      if (!replaced && h.floorY - h.minY > 3.6) {
        const depth = h.floorY - h.minY + 1.0;
        const c = Math.cos(h.yaw), s = Math.sin(h.yaw);
        const cx = h.x - s * h.def.D / 2, cz = h.z - c * h.def.D / 2;
        tmpM.compose(new THREE.Vector3(cx, h.floorY - 3.5, cz), q, new THREE.Vector3(h.def.W + 0.1, depth, h.def.D + 0.1));
        batch.add(piece('block'), tmpM, { stone: tints.stone });
      }
      const c = Math.cos(h.yaw), s = Math.sin(h.yaw);
      ctx.colliders.push({ kind: 'box', center: [h.x - s * h.def.D / 2, h.floorY + h.def.height / 2 - 1, h.z - c * h.def.D / 2],
        half: [h.def.W / 2, h.def.height / 2 + 1, h.def.D / 2], rotationY: h.yaw });
    }

    // ---------------- landmarks (walls, towers, gates, bridge, hall, fountain, windmills)
    const dyn = { spinners: [], banners: [], flags: [], anchors: [], lanterns: [] };
    try { placeLandmarks(ctx, plan, piece, batch, dyn, group); } catch (e) { console.error('[town] landmarks failed', e); }
    try { placeProps(ctx, plan, piece, batch, dyn); } catch (e) { console.error('[town] props failed', e); }
    let dressing = null;
    try { dressing = dressPlaza(ctx, plan, piece, batch, dyn); } catch (e) { console.error('[town] plaza dressing failed', e); }

    // a few plaza / square trees from the nature module (blossom + broadleaf) in stone planters
    try {
      const nat = ctx.systems.world?.nature || window.__AETHERIA_NATURE;
      if (nat?.createTree) {
        const spots = [[158, 20.8, 'blossom', 0.55], [-20, 21.0, 'blossom', 0.5], [-150, 21.0, 'broadleaf', 0.45]];
        for (const [ad, r, sp, sc] of spots) {
          const a = ad * Math.PI / 180, x = POI.plaza.x + r * Math.cos(a), z = POI.plaza.z + r * Math.sin(a);
          const tr = nat.createTree(sp, 3 + Math.round(r), sc);
          tr.position.set(x, POI.plaza.y + 0.55, z);
          group.add(tr);
          tmpM.compose(new THREE.Vector3(x, POI.plaza.y + 0.6, z), q.identity(), new THREE.Vector3(2.4, 0.6, 2.4));
          batch.add(piece('block'), tmpM, { stone: 0xf3ece0 });
          ctx.colliders.push({ kind: 'box', center: [x, POI.plaza.y + 0.5, z], half: [1.2, 0.5, 1.2], rotationY: 0 });
        }
        const g = nat.createTree('broadleaf', 41, 0.5);
        g.position.set(-58.5, heightAt(-58.5, 19) + 0.1, 19);
        group.add(g);
      }
    } catch (e) { console.warn('[town] plaza trees', e); }

    batch.build(group);
    api.batch = batch;
    if (ctx.quality.safe) {
      // kit pieces and glTF scenes are only needed to assemble the town: release them (decoded copies of ~180 files)
      allPieces.clear(); quat = null; kitHouses = null;
      for (const k of Object.keys(kits)) kits[k] = null;
      ctx.assets.evict?.('assets/free/medieval/'); ctx.assets.evict?.('assets/town/');
    }
    const cc0Count = useCC0 ? buildCC0Houses(cc0, group, { shadows: ctx.quality.shadows }) : 0;
    if (ctx.quality.safe) { cc0 = null; ctx.assets.evict?.('assets/cc0/buildings/'); }

    // ---------------- streets + plaza
    try {
      const { meshes, colliders } = buildStreets(plan.streets, mats);
      meshes.forEach((m) => group.add(m));
      ctx.colliders.push(...colliders);
      buildPlaza(mats).forEach((m) => group.add(m));
      // gate square inside the West Gate (foreground of the street view)
      const gatePoly = [[-61, 4.5], [-42, 6.5], [-37, 11], [-39, 21], [-50, 24], [-61, 15]];
      group.add(buildPaving(mats, gatePoly));
      // thin pavement slabs: walkable and they tell the grass system where the town is paved
      const inPoly = (x, z, poly) => { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, zi] = poly[i], [xj, zj] = poly[j]; if (((zi > z) !== (zj > z)) && (x < (xj - xi) * (z - zi) / (zj - zi) + xi)) c = !c; } return c; };
      for (let x = -61; x < -36; x += 4) for (let z = 4; z < 25; z += 4) {
        if (!inPoly(x + 2, z + 2, gatePoly)) continue;
        const y = Math.min(heightAt(x, z), heightAt(x + 4, z), heightAt(x, z + 4), heightAt(x + 4, z + 4));
        ctx.colliders.push({ kind: 'box', center: [x + 2, y - 0.05, z + 2], half: [2, 0.12, 2], rotationY: 0, pavement: true });
      }
      if (dressing?.sector) {
        const st = buildSteps(mats, dressing.sector);
        st.meshes.forEach((m) => group.add(m));
        ctx.colliders.push(st.collider);
        const sec = dressing.sector;
        for (let r = sec.r0 + 1.5; r < sec.r1; r += 3) for (let a = sec.a0 + 0.05; a < sec.a1; a += 0.1) {
          const x = sec.cx + r * Math.cos(a), z = sec.cz + r * Math.sin(a);
          ctx.colliders.push({ kind: 'box', center: [x, st.heightAtCell(x, z) - 0.3, z], half: [1.5, 0.12, 1.5], rotationY: -a, pavement: true });
        }
      }
    } catch (e) { console.error('[town] streets failed', e); }

    // ---------------- animated cloth, sails, bunting
    try { api.dynamics = createDynamics(ctx, plan, mats, dyn, group); } catch (e) { console.error('[town] dynamics failed', e); }

    // LOD swapping (BatchedMesh)
    const lodDist = ctx.quality.safe ? 40 : ctx.quality.name === 'low' ? 55 : ctx.quality.name === 'medium' ? 80 : 110;
    let acc = 1;
    ctx.updaters.push((dt) => {
      acc += dt;
      if (acc < 0.25) return;
      acc = 0;
      batch.updateLOD(ctx.camera.position, lodDist);
    });
    batch.updateLOD(ctx.camera.position, lodDist);
    api.stats = { houses: plan.houses.length, tris: Math.round(batch.tris), ms: Math.round(performance.now() - t0), batched: batch.useBatched, cc0Houses: cc0Count };
    console.info('[town]', JSON.stringify(api.stats));
  } catch (e) {
    console.error('[town] failed to build Vael Harrow', e);
  }
  return api;
}
