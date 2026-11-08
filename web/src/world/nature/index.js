// Nature (owner: nature agent): trees, grass, flowers, bushes, hedges, reeds, rocks, cliffs, logs.
// Placement is designed in worlddata.js (forests north/south/west + eastern ridge, meadow trees, the
// windmill orchard, riverside willows, gate/screenshot framing trees). Everything is optional-safe:
// a failing sub-system logs an error instead of breaking boot.
import * as THREE from 'three';
import { heightAt } from '../../core/layout.js';
import { getWorldData, PATHS, forestField, inTown, splatAt } from './worlddata.js';
import { loadNatureTextures } from './textures.js';
import { WIND, updateWind } from './common.js';
import { createTreeMaterials, TreeSystem, createTreeObject } from './trees.js';
import { createGrass } from './grass.js';
import { createProps } from './props.js';
import { terrainShared } from '../terrain.js';

export async function create(ctx) {
  const { camera, quality } = ctx;
  const t0 = performance.now();
  const data = getWorldData(quality);
  const tex = await loadNatureTextures(ctx);
  if (!WIND.uNoiseTex.value) WIND.uNoiseTex.value = tex.noise;
  ctx.updaters.push((dt, time) => updateWind(time));

  const api = { paths: PATHS, heightAt, forestDensity: forestField, inTown, surfaceAt: splatAt, trees: [] };
  const gardens = [];

  // ---------------- trees
  let treeMats = null, trees = null;
  try {
    treeMats = createTreeMaterials(tex);
    trees = new TreeSystem(ctx, treeMats, {});
    for (const t of data.trees) trees.add(t);
    trees.finalize();
    api.trees = trees.instances;
    for (const t of trees.instances) {
      if (t.species === 'conifer' && t.s < 0.85) continue;
      const r = (t.species === 'birch' ? 0.18 : 0.38) * t.s;
      ctx.colliders.push({ kind: 'box', center: [t.x, t.y + 2, t.z], half: [r, 2.2, r], rotationY: 0 });
    }
  } catch (e) { console.error('[nature] trees failed', e); }

  // ---------------- grass + flowers
  let grass = null;
  try { grass = createGrass(ctx, tex, terrainShared.splatB, gardens); } catch (e) { console.error('[nature] grass failed', e); }

  // ---------------- props
  let props = null;
  try { props = createProps(ctx, tex, data.trees); } catch (e) { console.error('[nature] props failed', e); }

  const updateAll = (force) => {
    trees?.update(camera, force);
    grass?.update(camera, force);
    props?.update(camera, force);
  };
  ctx.updaters.push(() => updateAll(false));
  console.log(`[nature] ready in ${(performance.now() - t0).toFixed(0)} ms: ${data.trees.length} trees, ${props ? props.count() : 0} props`);

  /** Add a garden grass/flower patch (e.g. from the town module): {x, z, r}. */
  api.addGrassPatch = (x, z, r = 4) => { gardens.push({ x, z, r }); grass?.invalidate(); };
  /** Standalone tree Object3D (not instanced) for hand placement by other modules. */
  api.createTree = (species = 'broadleaf', seed = 1, scale = 1) => (treeMats ? createTreeObject(treeMats, species, seed, scale) : new THREE.Group());
  /** Plant an extra instanced tree at runtime is not supported after finalize; use createTree instead. */
  api.stats = () => ({ trees: trees?.stats(), grass: grass?.grass.count, flowers: grass?.flowers.count });
  api.textures = tex;
  window.__AETHERIA_NATURE = api;
  return api;
}
