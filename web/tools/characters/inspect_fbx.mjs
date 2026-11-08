// node tools/characters/inspect_fbx.mjs [file...]  -> skeleton + clip summary
import path from 'node:path';
import fs from 'node:fs';
import { loadFBX } from './fbx_node.mjs';
const files = process.argv.slice(2).length ? process.argv.slice(2) : fs.readdirSync('assets_src/mixamo').filter(f=>/\.fbx$/i.test(f)).map(f=>'assets_src/mixamo/'+f);
const full = process.argv.includes('--bones');
for (const f of files) {
  if (f.startsWith('--')) continue;
  try {
    const a = loadFBX(f);
    const bones = []; a.traverse(o => { if (o !== a) bones.push(o.name); });
    const c = a.animations[0];
    const hips = a.getObjectByName('pelvis') || a.getObjectByName('Hips') || a.getObjectByName('mixamorigHips');
    const posTracks = c.tracks.filter(t => t.name.endsWith('.position'));
    const info = posTracks.slice(0,3).map(t => { const v=t.values, n=v.length; return `${t.name} first=[${[...v.slice(0,3)].map(x=>x.toFixed(1))}] last=[${[...v.slice(n-3)].map(x=>x.toFixed(1))}]`; });
    console.log(path.basename(f), '| clips', a.animations.map(x=>x.name).join(','), '| dur', c.duration.toFixed(2), '| tracks', c.tracks.length, '| nodes', bones.length, '| scale', a.scale.toArray().join(','), '| rootChildren', a.children.map(x=>x.name+'@'+x.rotation.toArray().slice(0,3).map(v=>v.toFixed(2))+' s'+x.scale.x).join(';'));
    console.log('   ', info.join('\n    '));
    if (full) console.log('   bones:', bones.join(' '));
  } catch (e) { console.log(f, 'ERROR', e.message); }
}
