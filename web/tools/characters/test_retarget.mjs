// Round-trip test: retarget an FBX clip -> bind to a NormalizedRig built on the SAME source skeleton
// -> compare limb directions with the source animation played directly. Also cross-tests against the cast.fbx rig.
//   node tools/characters/test_retarget.mjs
import * as THREE from 'three';
import { loadFBX } from './fbx_node.mjs';
import { retargetAsset, bindClip, detectSourceRig } from '../../src/characters/retarget.js';
import { NormalizedRig } from '../../src/characters/humanoid.js';
import { Animator } from '../../src/characters/animator.js';
import { buildProceduralClips } from '../../src/characters/procedural.js';

const LIMBS = [['leftUpperArm', 'leftLowerArm'], ['leftLowerArm', 'leftHand'], ['rightUpperArm', 'rightLowerArm'], ['rightLowerArm', 'rightHand'],
  ['leftUpperLeg', 'leftLowerLeg'], ['leftLowerLeg', 'leftFoot'], ['rightUpperLeg', 'rightLowerLeg'], ['rightLowerLeg', 'rightFoot'], ['spine', 'neck'], ['neck', 'head']];
function dirs(root, map) {
  root.updateMatrixWorld(true);
  const out = {};
  for (const [a, b] of LIMBS) {
    if (!map[a] || !map[b]) continue;
    const pa = root.worldToLocal(map[a].getWorldPosition(new THREE.Vector3()));
    const pb = root.worldToLocal(map[b].getWorldPosition(new THREE.Vector3()));
    out[a] = pb.sub(pa).normalize();
  }
  return out;
}
let worst = 0;
for (const [action, srcFile, modelFile] of [['walk', 'walk', 'idle'], ['attack1', 'attack_1', 'idle'], ['dodge', 'dodge_roll', 'idle'], ['cast', 'cast', 'cast'], ['run', 'run', 'cast']]) {
  const src = loadFBX(`assets_src/mixamo/${srcFile}.fbx`);
  const nc = retargetAsset(src, { name: action, inPlace: false });
  // target model = a fresh copy of a skeleton (possibly a different rig)
  const model = loadFBX(`assets_src/mixamo/${modelFile}.fbx`); model.quaternion.identity();
  const wrap = new THREE.Group(); wrap.add(model);
  const tmap = detectSourceRig(model).map;
  const rig = new NormalizedRig(wrap, tmap, { tpose: true, prefix: 'T' });
  const clip = bindClip(nc, rig, action);
  const mixer = new THREE.AnimationMixer(rig.root);
  const act = mixer.clipAction(clip); act.setLoop(THREE.LoopOnce); act.clampWhenFinished = true; act.play();
  const smix = new THREE.AnimationMixer(src); const sact = smix.clipAction(src.animations[0]); sact.setLoop(THREE.LoopOnce); sact.clampWhenFinished = true; sact.play();
  const smap = detectSourceRig(src).map;
  let maxErr = 0;
  for (const t of [0.1, 0.3, 0.5, 0.7, 0.9].map((k) => k * nc.duration)) {
    mixer.setTime(t); rig.update(); smix.setTime(t);
    const a = dirs(src, smap), b = dirs(wrap, tmap);
    for (const k of Object.keys(a)) if (b[k]) maxErr = Math.max(maxErr, a[k].angleTo(b[k]) * 180 / Math.PI);
  }
  worst = Math.max(worst, maxErr);
  console.log(`${action.padEnd(8)} src=${nc.sourceRig.padEnd(6)} -> model=${modelFile.padEnd(5)} max limb direction error ${maxErr.toFixed(2)} deg | speed ${(nc.speed * rig.hipsHeight).toFixed(2)} m/s`);
}
// animator smoke test with procedural clips
{
  const model = loadFBX('assets_src/mixamo/idle.fbx'); const wrap = new THREE.Group(); wrap.add(model);
  const rig = new NormalizedRig(wrap, detectSourceRig(model).map, { prefix: 'P' });
  const clips = buildProceduralClips(rig);
  const an = new Animator(rig.root, clips);
  for (let i = 0; i < 120; i++) { an.setLocomotion(i < 60 ? 0 : 3, true, 0); an.update(1 / 30); rig.update(); }
  an.play('attack1'); an.update(0.1);
  console.log('animator ok, current =', an.current, 'natural', JSON.stringify(an.natural));
}
console.log(worst < 3 ? 'PASS' : 'CHECK', 'worst', worst.toFixed(2));
