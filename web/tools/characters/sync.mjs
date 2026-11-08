// AETHERIA character asset sync (owner: character agent).
//
//   node tools/characters/sync.mjs            copy + manifest
//   node tools/characters/sync.mjs --bake     also bake Mixamo FBX into compact JSON clips (needs no browser)
//
// 1. Legacy Blender characters  ../assets/models/characters/<id>.glb  ->  public/assets/characters/legacy/<id>.glb
// 2. VRoid exports              assets_src/vroid/<id>.vrm             ->  public/assets/characters/<id>.vrm
// 3. Mixamo FBX                 assets_src/mixamo/<anything>.fbx      ->  public/assets/anims/<action>.fbx
//    File names are matched loosely (case, spaces, dashes, "Mixamo" defaults such as "Standard Run").
// 4. Manifests: public/assets/characters/manifest.json, public/assets/anims/manifest.json
//
// In dev the runtime also discovers assets_src/** directly (import.meta.glob), so running this script is
// only required for production builds; it is safe to run at any time and never deletes anything.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { matchAction, ACTION_FILES } from '../../src/characters/names.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const legacySrc = path.resolve(root, '..', 'assets', 'models', 'characters');
const vroidSrc = path.join(root, 'assets_src', 'vroid');
const mixamoSrc = path.join(root, 'assets_src', 'mixamo');
const charOut = path.join(root, 'public', 'assets', 'characters');
const animOut = path.join(root, 'public', 'assets', 'anims');
const bake = process.argv.includes('--bake');

fs.mkdirSync(path.join(charOut, 'legacy'), { recursive: true });
fs.mkdirSync(animOut, { recursive: true });

const list = (dir, re) => { try { return fs.readdirSync(dir).filter((f) => re.test(f)); } catch { return []; } };
const newer = (a, b) => !fs.existsSync(b) || fs.statSync(a).mtimeMs > fs.statSync(b).mtimeMs || fs.statSync(a).size !== fs.statSync(b).size;
const copy = (a, b) => { if (newer(a, b)) { fs.copyFileSync(a, b); console.log('copied', path.relative(root, a), '->', path.relative(root, b)); return true; } return false; };
const slug = (f) => path.basename(f, path.extname(f)).trim().toLowerCase().replace(/[\s\-]+/g, '_').replace(/[^a-z0-9_]/g, '');

// 1. legacy GLBs
for (const f of list(legacySrc, /\.glb$/i)) copy(path.join(legacySrc, f), path.join(charOut, 'legacy', f.toLowerCase()));

// 2. VRMs
const vrms = {};
for (const f of list(vroidSrc, /\.vrm$/i)) {
  const id = slug(f);
  copy(path.join(vroidSrc, f), path.join(charOut, id + '.vrm'));
  vrms[id] = `/assets/characters/${id}.vrm`;
}
for (const f of list(charOut, /\.vrm$/i)) vrms[slug(f)] ??= `/assets/characters/${f}`;

// 3. Mixamo FBX
const actions = {};
const unmatched = [];
for (const f of list(mixamoSrc, /\.fbx$/i)) {
  const action = matchAction(f);
  if (!action) { unmatched.push(f); continue; }
  if (actions[action]) { console.warn(`duplicate match for "${action}": ${f} (keeping ${actions[action].src})`); continue; }
  const dst = path.join(animOut, action + '.fbx');
  copy(path.join(mixamoSrc, f), dst);
  actions[action] = { src: f, fbx: `/assets/anims/${action}.fbx` };
}
for (const f of list(animOut, /\.fbx$/i)) {
  const a = matchAction(f);
  if (a && !actions[a]) actions[a] = { src: f, fbx: `/assets/anims/${f}` };
}

// 4. optional offline bake (FBX -> normalized humanoid JSON, model independent)
if (bake && Object.keys(actions).length) {
  const { bakeFBXFile } = await import('./bake_mixamo.mjs');
  for (const [action, info] of Object.entries(actions)) {
    try {
      const src = path.join(root, 'public', info.fbx);
      const out = path.join(animOut, action + '.json');
      if (newer(src, out)) {
        const json = await bakeFBXFile(src, action);
        fs.writeFileSync(out, JSON.stringify(json));
        console.log('baked', action, '->', path.relative(root, out), `${(fs.statSync(out).size / 1024).toFixed(0)} KB`);
      }
      info.json = `/assets/anims/${action}.json`;
    } catch (e) { console.warn('bake failed for', action, e.message); }
  }
} else {
  for (const [action, info] of Object.entries(actions)) {
    if (fs.existsSync(path.join(animOut, action + '.json'))) info.json = `/assets/anims/${action}.json`;
  }
}

const glbs = {};
for (const f of list(charOut, /\.glb$/i)) glbs[slug(f)] = `/assets/characters/${f}`;
const legacy = {};
for (const f of list(path.join(charOut, 'legacy'), /\.glb$/i)) legacy[slug(f)] = `/assets/characters/legacy/${f}`;

const charManifest = { generated: new Date().toISOString(), vrm: vrms, glb: glbs, legacy };
fs.writeFileSync(path.join(charOut, 'manifest.json'), JSON.stringify(charManifest, null, 2));
const animManifest = { generated: new Date().toISOString(), actions, unmatched, wanted: ACTION_FILES };
fs.writeFileSync(path.join(animOut, 'manifest.json'), JSON.stringify(animManifest, null, 2));

console.log(`VRM: ${Object.keys(vrms).join(', ') || 'none'}`);
console.log(`GLB: ${Object.keys(glbs).join(', ') || 'none'} | legacy: ${Object.keys(legacy).join(', ') || 'none'}`);
console.log(`Mixamo: ${Object.keys(actions).join(', ') || 'none'}`);
if (unmatched.length) console.log('Unmatched FBX (rename or extend src/characters/names.js):', unmatched.join(', '));
const missing = ACTION_FILES.filter((a) => !actions[a]);
if (missing.length) console.log('Still missing Mixamo clips:', missing.join(', '));
