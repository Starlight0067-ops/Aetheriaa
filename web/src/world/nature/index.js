// Nature (owner: nature agent): trees, grass, flowers, bushes, hedges, reeds, rocks, cliffs, logs and
// ground detail. Placement is designed in worlddata.js (forests north/south/west + eastern ridge, meadow
// trees, the windmill orchard, riverside willows, gate/screenshot framing trees). Procedural painterly trees
// are mixed with CC0 Quaternius kit trees (common, pine, red twisted) for species variety.
// Every sub-system is optional-safe: a failure logs an error instead of breaking boot.
import * as THREE from 'three';
import { heightAt } from '../../core/layout.js';
import { getWorldData, PATHS, forestField, inTown, splatAt } from './worlddata.js';
import { loadNatureTextures } from './textures.js';
import { WIND, updateWind, hash2i } from './common.js';
import { createTreeMaterials, TreeSystem, createTreeObject } from './trees.js';
import { createGrass } from './grass.js';
import { createProps } from './props.js';
import { loadKitModel, makeImpostor } from './freemodels.js';
import { createKitDetail } from './detail.js';
import { terrainShared } from '../terrain.js';

const KIT_TREES = {
  q_common: { files: ['CommonTree_1', 'CommonTree_2', 'CommonTree_3', 'CommonTree_4', 'CommonTree_5'], low: [0, 2], scale: 1.45, tint: [1.08, 1.2, 0.92] },
  q_pine: { files: ['Pine_1', 'Pine_2', 'Pine_3', 'Pine_4', 'Pine_5'], low: [1, 3], scale: 1.75, tint: [0.95, 1.12, 1.02] },
  q_twisted: { files: ['TwistedTree_1', 'TwistedTree_3'], low: [0], scale: 0.82, tint: [1.08, 0.96, 0.9] },
};

async function loadKitTrees(ctx, trees) {
  const low = ctx.quality.name === 'low';
  const out = {};
  for (const sp in KIT_TREES) {
    const def = KIT_TREES[sp];
    const files = low ? def.low.map((i) => def.files[i]) : def.files;
    out[sp] = [];
    const models = await Promise.all(files.map((f) => loadKitModel(ctx, f, { tint: def.tint }).catch((e) => { console.warn('[nature] kit tree failed', f, e); return null; })));
    models.forEach((m, i) => {
      if (!m) return;
      try {
        const imp = makeImpostor(ctx.renderer, m, [1, 1, 1]);
        const key = sp + '_' + i;
        trees.addKitVariant(key, m, imp);
        out[sp].push(key);
      } catch (e) { console.warn('[nature] impostor failed', files[i], e); }
    });
  }
  return out;
}

export async function create(ctx) {
  const { camera, quality } = ctx;
  const t0 = performance.now();
  const data = getWorldData(quality);
  const tex = await loadNatureTextures(ctx);
  if (!WIND.uNoiseTex.value) WIND.uNoiseTex.value = tex.noise;
  ctx.updaters.push((dt, time) => updateWind(time));

  const api = { paths: PATHS, heightAt, forestDensity: forestField, inTown, surfaceAt: splatAt, trees: [] };
  const gardens = [];

  // ---------------- trees (procedural species + CC0 kit species)
  let treeMats = null, trees = null;
  try {
    treeMats = createTreeMaterials(tex);
    trees = new TreeSystem(ctx, treeMats, {});
    let kit = {};
    try { kit = await loadKitTrees(ctx, trees); } catch (e) { console.warn('[nature] kit trees skipped', e); }
    let i = 0;
    for (const t of data.trees) {
      i++;
      const h = hash2i(Math.round(t.x * 10), Math.round(t.z * 10), 909);
      const natural = !t.framing && !t.orchard;
      if (natural && t.species === 'broadleaf' && kit.q_twisted?.length && h < 0.05) {
        trees.add({ ...t, kitKey: kit.q_twisted[i % kit.q_twisted.length], s: KIT_TREES.q_twisted.scale * (0.85 + t.s * 0.2) });
      } else if (natural && t.species === 'broadleaf' && kit.q_common?.length && h < 0.42) {
        trees.add({ ...t, kitKey: kit.q_common[i % kit.q_common.length], s: KIT_TREES.q_common.scale * t.s });
      } else if (natural && t.species === 'conifer' && kit.q_pine?.length && h < 0.36) {
        trees.add({ ...t, kitKey: kit.q_pine[i % kit.q_pine.length], s: KIT_TREES.q_pine.scale * t.s });
      } else trees.add(t);
    }
    trees.finalize();
    api.trees = trees.instances;
    for (const t of trees.instances) {
      if (t.s < 0.6) continue;
      const r = (t.species === 'birch' ? 0.18 : 0.38) * Math.min(1.4, t.s);
      ctx.colliders.push({ kind: 'box', center: [t.x, t.y + 2, t.z], half: [r, 2.2, r], rotationY: 0 });
    }
  } catch (e) { console.error('[nature] trees failed', e); }

  // ---------------- grass + flowers
  let grass = null;
  try { grass = createGrass(ctx, tex, terrainShared.splatB, gardens); } catch (e) { console.error('[nature] grass failed', e); }

  // ---------------- props + kit ground detail
  let props = null, detail = null;
  try { props = createProps(ctx, tex, data.trees); } catch (e) { console.error('[nature] props failed', e); }
  try { detail = await createKitDetail(ctx, data.trees); } catch (e) { console.error('[nature] kit detail failed', e); }

  const frustum = new THREE.Frustum(), m4 = new THREE.Matrix4(), sphere = new THREE.Sphere();
  const last = new THREE.Vector3(1e9, 0, 0), lastDir = new THREE.Vector3();
  const updateAll = (force) => {
    trees?.update(camera, force);
    grass?.update(camera, force);
    props?.update(camera, force);
    if (detail) {
      const dir = camera.getWorldDirection(new THREE.Vector3());
      if (force || camera.position.distanceToSquared(last) > 1 || dir.dot(lastDir) < 0.999) {
        last.copy(camera.position); lastDir.copy(dir);
        camera.updateMatrixWorld();
        m4.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
        frustum.setFromProjectionMatrix(m4);
        detail.update(camera.position, frustum, sphere);
      }
    }
  };
  ctx.updaters.push(() => updateAll(false));
  console.log(`[nature] ready in ${(performance.now() - t0).toFixed(0)} ms: ${data.trees.length} trees, ${props ? props.count() : 0} props`);

  /** Add a garden grass/flower patch (e.g. from the town module): {x, z, r}. */
  api.addGrassPatch = (x, z, r = 4) => { gardens.push({ x, z, r }); grass?.invalidate(); };
  /** Standalone tree Object3D (not instanced) for hand placement by other modules. */
  api.createTree = (species = 'broadleaf', seed = 1, scale = 1) => (treeMats ? createTreeObject(treeMats, species, seed, scale) : new THREE.Group());
  api.stats = () => ({ trees: trees?.stats(), grass: grass?.grass.count, flowers: grass?.flowers.count });
  api.textures = tex;
  window.__AETHERIA_NATURE = api;
  return api;
}
