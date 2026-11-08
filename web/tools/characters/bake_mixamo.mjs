// Offline bake: animation FBX -> model-independent normalized clip JSON (see src/characters/retarget.js).
//   node tools/characters/bake_mixamo.mjs            bakes every assets_src/mixamo/*.fbx into public/assets/anims/<action>.json
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadFBX } from './fbx_node.mjs';
import { retargetAsset } from '../../src/characters/retarget.js';
import { matchAction } from '../../src/characters/names.js';

const LOOP = new Set(['idle', 'walk', 'run', 'sprint', 'fall', 'talk', 'sit']);
export async function bakeFBXFile(file, action) {
  const asset = loadFBX(file);
  return retargetAsset(asset, { name: action, loopable: LOOP.has(action) });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
  const srcDir = path.join(root, 'assets_src', 'mixamo');
  const outDir = path.join(root, 'public', 'assets', 'anims');
  fs.mkdirSync(outDir, { recursive: true });
  const manifest = { generated: new Date().toISOString(), actions: {} };
  for (const f of fs.readdirSync(srcDir).filter((x) => /\.fbx$/i.test(x))) {
    const action = matchAction(f);
    if (!action) { console.log('skip (no action match):', f); continue; }
    try {
      const nc = await bakeFBXFile(path.join(srcDir, f), action);
      nc.loopable = LOOP.has(action);
      fs.writeFileSync(path.join(outDir, action + '.json'), JSON.stringify(nc));
      manifest.actions[action] = { src: f, json: `/assets/anims/${action}.json`, sourceClip: nc.sourceClip, sourceRig: nc.sourceRig,
        duration: +nc.duration.toFixed(3), speedHipsPerSec: +nc.speed.toFixed(3), travel: { x: +nc.travel.x.toFixed(3), z: +nc.travel.z.toFixed(3) } };
      console.log(action.padEnd(9), nc.sourceRig.padEnd(7), nc.sourceClip.padEnd(30), `dur ${nc.duration.toFixed(2)}s`, `travel x=${nc.travel.x.toFixed(2)} z=${nc.travel.z.toFixed(2)} (hips units)`, `bones ${Object.keys(nc.bones).length}`, nc.flipped ? 'FLIPPED' : '');
    } catch (e) { console.log('FAILED', f, e.message); }
  }
  fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
}
