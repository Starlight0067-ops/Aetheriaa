// Asset discovery + animation library (owner: character agent). Browser only.
// Sources, in priority order:
//   animations: public/assets/anims/<action>.json (baked, tools/characters/bake_mixamo.mjs)
//               -> assets_src/mixamo/*.fbx (dev, discovered by import.meta.glob, retargeted at runtime)
//               -> public/assets/anims/<action>.fbx (copied by tools/characters/sync.mjs)
//   VRM:        assets_src/vroid/<id>.vrm (dev glob) -> public/assets/characters/<id>.vrm
// Vite watches the glob folders, so dropping new files in assets_src reloads the page and lights them up.
import { matchAction } from './names.js';
import { retargetAsset } from './retarget.js';

const devFBX = import.meta.glob('/assets_src/mixamo/*.{fbx,FBX}', { query: '?url', import: 'default' });
const devVRM = import.meta.glob('/assets_src/vroid/*.{vrm,VRM}', { query: '?url', import: 'default' });

const slug = (f) => f.split('/').pop().replace(/\.[^.]+$/, '').trim().toLowerCase().replace(/[\s\-]+/g, '_').replace(/[^a-z0-9_]/g, '');

async function fetchJSON(url) {
  try {
    const r = await fetch(url, { cache: 'no-cache' });
    if (!r.ok || /text\/html/.test(r.headers.get('content-type') || '')) return null;
    return await r.json();
  } catch { return null; }
}
/** True if `url` exists (Vite's SPA fallback answers missing files with index.html, so check the type). */
export async function exists(url) {
  try {
    const r = await fetch(url, { method: 'HEAD', cache: 'no-cache' });
    return r.ok && !/text\/html/.test(r.headers.get('content-type') || '');
  } catch { return false; }
}

let animIndex = null;
export function animationIndex() {
  if (animIndex) return animIndex;
  animIndex = (async () => {
    const idx = {};
    const man = await fetchJSON('/assets/anims/manifest.json');
    for (const [a, info] of Object.entries(man?.actions || {})) idx[a] = { ...info };
    for (const [path, load] of Object.entries(devFBX)) {
      const a = matchAction(path);
      if (a) { idx[a] ??= {}; idx[a].devFbx ??= load; }
    }
    return idx;
  })();
  return animIndex;
}

const normCache = new Map();
let fbxLoader = null;
/** Model-independent normalized clip for `action`, or null. */
export function loadNormClip(action) {
  if (normCache.has(action)) return normCache.get(action);
  const p = (async () => {
    const idx = await animationIndex();
    const info = idx[action];
    if (!info) return null;
    if (info.json) {
      const j = await fetchJSON(info.json);
      if (j?.bones) return j;
    }
    const url = info.devFbx ? await info.devFbx() : info.fbx;
    if (!url) return null;
    if (!fbxLoader) { const { FBXLoader } = await import('three/examples/jsm/loaders/FBXLoader.js'); fbxLoader = new FBXLoader(); }
    const asset = await fbxLoader.loadAsync(url);
    return retargetAsset(asset, { name: action });
  })().catch((e) => { console.warn('[characters] animation', action, 'failed:', e.message); return null; });
  normCache.set(action, p);
  return p;
}

/** URL of a VRM for character `id`, or null. */
export async function findVRM(id) {
  for (const [path, load] of Object.entries(devVRM)) if (slug(path) === id) return await load();
  const man = await fetchJSON('/assets/characters/manifest.json');
  if (man?.vrm?.[id]) return man.vrm[id];
  const url = `/assets/characters/${id}.vrm`;
  return (await exists(url)) ? url : null;
}

/** URL of the fallback GLB for `id` (v2 Blender build first, then the legacy one), or null. */
export async function findGLB(id) {
  for (const url of [`/assets/characters/${id}.glb`, `/assets/characters/legacy/${id}.glb`]) if (await exists(url)) return url;
  return null;
}
