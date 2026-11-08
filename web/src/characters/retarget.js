// Animation retargeting (owner: character agent). Browser + Node safe (only depends on three).
//
// Source rigs supported (auto-detected by bone names): Mixamo (mixamorig*), Unreal mannequin
// (pelvis/spine_01/upperarm_l/...), "B-" rigs (B-hips/B-upperArmL/...), VRM-named rigs.
// Any rest pose works (A-pose or T-pose): the source rest is first re-posed to a T-pose, then every
// frame is expressed as world-space deltas from that T-pose == VRM 1.0 "normalized" bone rotations.
//
// Output = model-independent NormalizedClip:
//   { name, duration, fps, frames, bones: { humanBone: number[4*frames] }, hips: number[3*frames]
//     (in units of rest hips height, XZ drift removed), speed (forward speed in hips-heights / s), loopable }
// bindClip(normClip, rig) turns it into a THREE.AnimationClip for a concrete rig.
import * as THREE from 'three';
import { HUMAN_PARENT } from './names.js';
import { alignToTPose } from './humanoid.js';
import { UNREAL_REST } from './rest_unreal.js';

const CANON_REST = { unreal: UNREAL_REST };

// ---- source rig name tables: humanBone -> candidate node names (three.js-sanitised names)
const FINGERS = [['Thumb', 'thumb', ['Metacarpal', 'Proximal', 'Distal']], ['Index', 'index', ['Proximal', 'Intermediate', 'Distal']],
  ['Middle', 'middle', ['Proximal', 'Intermediate', 'Distal']], ['Ring', 'ring', ['Proximal', 'Intermediate', 'Distal']],
  ['Little', 'pinky', ['Proximal', 'Intermediate', 'Distal']]];

function unrealTable() {
  const t = { hips: 'pelvis', spine: 'spine_01', chest: 'spine_02', upperChest: 'spine_03', neck: 'neck_01', head: 'Head' };
  for (const [S, s] of [['left', 'l'], ['right', 'r']]) {
    Object.assign(t, {
      [S + 'Shoulder']: `clavicle_${s}`, [S + 'UpperArm']: `upperarm_${s}`, [S + 'LowerArm']: `lowerarm_${s}`, [S + 'Hand']: `hand_${s}`,
      [S + 'UpperLeg']: `thigh_${s}`, [S + 'LowerLeg']: `calf_${s}`, [S + 'Foot']: `foot_${s}`, [S + 'Toes']: `ball_${s}`,
    });
    for (const [F, f, seg] of FINGERS) seg.forEach((g, i) => { t[S + F + g] = `${f}_0${i + 1}_${s}`; });
  }
  return t;
}
function bRigTable() {
  const t = { hips: 'B-hips', spine: 'B-spine', chest: 'B-chest', upperChest: 'B-upperChest', neck: 'B-neck', head: 'B-head' };
  const fn = { Thumb: 'thumb', Index: 'indexFinger', Middle: 'middleFinger', Ring: 'ringFinger', Little: 'pinky' };
  for (const [S, s] of [['left', 'L'], ['right', 'R']]) {
    Object.assign(t, {
      [S + 'Shoulder']: `B-shoulder${s}`, [S + 'UpperArm']: `B-upperArm${s}`, [S + 'LowerArm']: `B-forearm${s}`, [S + 'Hand']: `B-hand${s}`,
      [S + 'UpperLeg']: `B-thigh${s}`, [S + 'LowerLeg']: `B-shin${s}`, [S + 'Foot']: `B-foot${s}`, [S + 'Toes']: `B-toe${s}`,
    });
    for (const [F, , seg] of FINGERS) seg.forEach((g, i) => { t[S + F + g] = `B-${fn[F]}0${i + 1}${s}`; });
  }
  return t;
}
function mixamoTable() {
  const t = { hips: 'Hips', spine: 'Spine', chest: 'Spine1', upperChest: 'Spine2', neck: 'Neck', head: 'Head' };
  for (const [S, s] of [['left', 'Left'], ['right', 'Right']]) {
    Object.assign(t, {
      [S + 'Shoulder']: `${s}Shoulder`, [S + 'UpperArm']: `${s}Arm`, [S + 'LowerArm']: `${s}ForeArm`, [S + 'Hand']: `${s}Hand`,
      [S + 'UpperLeg']: `${s}UpLeg`, [S + 'LowerLeg']: `${s}Leg`, [S + 'Foot']: `${s}Foot`, [S + 'Toes']: `${s}ToeBase`,
    });
    const mf = { Thumb: 'Thumb', Index: 'Index', Middle: 'Middle', Ring: 'Ring', Little: 'Pinky' };
    for (const [F, , seg] of FINGERS) seg.forEach((g, i) => { t[S + F + g] = `${s}Hand${mf[F]}${i + 1}`; });
  }
  return t;
}
export const SOURCE_RIGS = { unreal: unrealTable(), brig: bRigTable(), mixamo: mixamoTable() };

/** Find humanBone -> node in a loaded animation asset. Returns { rig, map } or null. */
export function detectSourceRig(asset) {
  const nodes = new Map();
  asset.traverse((o) => {
    if (o === asset) return;
    const n = o.name || '';
    if (!nodes.has(n)) nodes.set(n, o);
    const stripped = n.replace(/^.*?mixamorig\d*[:_]?/i, '');
    if (stripped !== n && !nodes.has(stripped)) nodes.set(stripped, o);
  });
  let best = null;
  for (const [rig, table] of Object.entries(SOURCE_RIGS)) {
    const map = {};
    for (const [h, name] of Object.entries(table)) { const o = nodes.get(name); if (o) map[h] = o; }
    const c = Object.keys(map).length;
    if (map.hips && (!best || c > best.count)) best = { rig, map, count: c };
  }
  // VRM-named fallback
  const vmap = {};
  for (const h of Object.keys(HUMAN_PARENT)) { const o = nodes.get(h); if (o) vmap[h] = o; }
  if (vmap.hips && (!best || Object.keys(vmap).length > best.count)) best = { rig: 'vrm', map: vmap, count: Object.keys(vmap).length };
  return best && best.count >= 12 ? best : null;
}

const ORDER = Object.keys(HUMAN_PARENT); // parents first (HUMAN_PARENT is declared in hierarchy order)
function presentParent(h, map) { let p = HUMAN_PARENT[h]; while (p && !map[p]) p = HUMAN_PARENT[p]; return p || null; }

const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion();

function worldQuatIn(rootInv, o, out) { return o.getWorldQuaternion(out).premultiply(rootInv); }

/** Re-pose the source rest skeleton into the canonical T-pose; returns T-rest world rotations (asset frame). */
function tposeRest(asset, map, rig) {
  // Some exporters (the Unreal-style files) store frame 0 as the node rest: start from a shared reference rest.
  const canon = CANON_REST[rig];
  if (canon) asset.traverse((o) => { const q = canon[o.name]; if (q && o !== asset) o.quaternion.fromArray(q); });
  alignToTPose(asset, map);
  const rootInv = asset.getWorldQuaternion(new THREE.Quaternion()).invert();
  const rest = {};
  for (const h of Object.keys(map)) rest[h] = worldQuatIn(rootInv, map[h], new THREE.Quaternion());
  return rest;
}

/**
 * Convert a loaded animation asset (FBXLoader / GLTF scene with .animations) into a NormalizedClip.
 * opts: { name, fps=30, inPlace=true, loopable }
 */
export function retargetAsset(asset, opts = {}) {
  const src = detectSourceRig(asset);
  if (!src) throw new Error('unrecognised source skeleton');
  const clip = opts.clip || asset.animations?.[0];
  if (!clip) throw new Error('no animation in asset');
  const map = src.map;
  // remember the original rest locals, build the T-rest, restore
  const saved = [];
  asset.traverse((o) => saved.push([o, o.position.clone(), o.quaternion.clone(), o.scale.clone()]));
  // Work in the asset's native frame: ignore any transform on the asset root itself (FBXLoader's axis
  // correction, or root tracks such as cast.fbx's "Rig.quaternion" which fight that correction).
  const neutralRoot = () => { asset.position.set(0, 0, 0); asset.quaternion.identity(); asset.scale.set(1, 1, 1); asset.updateMatrixWorld(true); };
  neutralRoot();
  // facing check: source left side should be +X when facing +Z. If not, rotate the frame 180 deg.
  const rootInv0 = asset.getWorldQuaternion(new THREE.Quaternion()).invert();
  const lp = map.leftUpperArm?.getWorldPosition(new THREE.Vector3()), rp = map.rightUpperArm?.getWorldPosition(new THREE.Vector3());
  let flip = false;
  if (lp && rp) { const d = asset.worldToLocal(lp.clone()).sub(asset.worldToLocal(rp.clone())); flip = d.x < 0; }
  const restT = tposeRest(asset, map, src.rig);
  const restHips = map.hips.getWorldPosition(new THREE.Vector3()); asset.worldToLocal(restHips);
  for (const [o, p, q, s] of saved) { o.position.copy(p); o.quaternion.copy(q); o.scale.copy(s); }
  neutralRoot();
  // hips height above the ground plane (the asset origin is on the floor for all supported rigs)
  const hipsHeight = Math.max(1e-6, restHips.y);
  const flipQ = flip ? new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI) : null;

  const fps = opts.fps || 30;
  const frames = Math.max(2, Math.round(clip.duration * fps) + 1);
  const mixer = new THREE.AnimationMixer(asset);
  const action = mixer.clipAction(clip);
  action.setLoop(THREE.LoopOnce, 1);
  action.clampWhenFinished = true;
  action.play();
  const humans = ORDER.filter((h) => map[h]);
  const out = {}; for (const h of humans) out[h] = new Array(frames * 4);
  const hips = new Array(frames * 3);
  const W = {};
  const rootInv = new THREE.Quaternion();
  for (let f = 0; f < frames; f++) {
    const t = Math.min(clip.duration, f / fps);
    mixer.setTime(t);
    neutralRoot();
    rootInv.copy(rootInv0);
    for (const h of humans) {
      const w = worldQuatIn(rootInv, map[h], new THREE.Quaternion());
      w.multiply(_q.copy(restT[h]).invert());           // accumulated normalized rotation
      if (flipQ) w.premultiply(flipQ).multiply(_q2.copy(flipQ).invert());
      W[h] = w;
      const p = presentParent(h, map);
      const local = p ? _q.copy(W[p]).invert().multiply(w) : w.clone();
      local.normalize();
      // keep quaternion sign continuous across frames (avoids slerp flips)
      if (f > 0) { const o = out[h]; const i = (f - 1) * 4; if (o[i] * local.x + o[i + 1] * local.y + o[i + 2] * local.z + o[i + 3] * local.w < 0) local.set(-local.x, -local.y, -local.z, -local.w); }
      local.toArray(out[h], f * 4);
    }
    const hp = map.hips.getWorldPosition(new THREE.Vector3()); asset.worldToLocal(hp);
    if (flip) { hp.x = -hp.x; hp.z = -hp.z; }
    hips[f * 3] = hp.x / hipsHeight; hips[f * 3 + 1] = hp.y / hipsHeight; hips[f * 3 + 2] = hp.z / hipsHeight;
  }
  mixer.stopAllAction();
  for (const [o, p, q, s] of saved) { o.position.copy(p); o.quaternion.copy(q); o.scale.copy(s); }

  // root motion: measure, then remove linear XZ drift (characters are moved by the controller)
  const n = frames - 1;
  const dx = hips[n * 3] - hips[0], dz = hips[n * 3 + 2] - hips[2];
  const travel = Math.hypot(dx, dz);
  const speed = travel / Math.max(clip.duration, 1e-3);
  const inPlace = opts.inPlace !== false;
  if (inPlace) {
    for (let f = 0; f < frames; f++) {
      const k = f / n;
      hips[f * 3] -= dx * k; hips[f * 3 + 2] -= dz * k;
    }
  }
  const round = (arr, d) => arr.map((v) => Math.round(v * d) / d);
  const bones = {}; for (const h of humans) bones[h] = round(out[h], 1e5);
  return {
    format: 'aetheria-normclip-1', name: opts.name || clip.name, sourceClip: clip.name, sourceRig: src.rig,
    duration: clip.duration, fps, frames, bones, hips: round(hips, 1e4),
    speed, travel: { x: dx, z: dz }, inPlace, flipped: flip,
  };
}

/** Bind a NormalizedClip to a rig (NormalizedRig / VRMRigAdapter). Returns THREE.AnimationClip. */
export function bindClip(nc, rig, name = nc.name) {
  const times = new Float32Array(nc.frames);
  for (let f = 0; f < nc.frames; f++) times[f] = Math.min(nc.duration, f / nc.fps);
  // fold rotations of bones the rig lacks into the nearest present ancestor
  const vals = {};
  for (const h of ORDER) {
    const v = nc.bones[h];
    if (!v) continue;
    if (rig.has(h)) { vals[h] = vals[h] ? mulTracks(vals[h], v) : Float32Array.from(v); continue; }
    let p = HUMAN_PARENT[h]; while (p && !rig.has(p)) p = HUMAN_PARENT[p];
    if (!p) continue;
    if (!vals[p]) vals[p] = identityTrack(nc.frames);
    vals[p] = mulTracks(vals[p], v);
  }
  const tracks = [];
  const vrm0 = !!rig.isVRM0;
  for (const [h, v] of Object.entries(vals)) {
    const node = rig.node(h);
    if (!node) continue;
    if (vrm0) for (let i = 0; i < v.length; i += 4) { v[i] = -v[i]; v[i + 2] = -v[i + 2]; }
    tracks.push(new THREE.QuaternionKeyframeTrack(`${node.name}.quaternion`, times, v));
  }
  if (nc.hips && rig.node('hips')) {
    const s = rig.hipsHeight;
    const hv = new Float32Array(nc.frames * 3);
    for (let f = 0; f < nc.frames; f++) {
      let x = nc.hips[f * 3] * s, y = nc.hips[f * 3 + 1] * s, z = nc.hips[f * 3 + 2] * s;
      if (vrm0) { x = -x; z = -z; }
      hv[f * 3] = x; hv[f * 3 + 1] = y; hv[f * 3 + 2] = z;
    }
    tracks.push(new THREE.VectorKeyframeTrack(`${rig.node('hips').name}.position`, times, hv));
  }
  const clip = new THREE.AnimationClip(name, nc.duration, tracks);
  clip.userData = { speed: nc.speed * rig.hipsHeight, source: nc.sourceClip, normalized: true };
  return clip;
}

function identityTrack(frames) { const a = new Float32Array(frames * 4); for (let i = 0; i < frames; i++) a[i * 4 + 3] = 1; return a; }
function mulTracks(a, b) {
  const out = new Float32Array(a.length);
  const qa = new THREE.Quaternion(), qb = new THREE.Quaternion();
  for (let i = 0; i < a.length; i += 4) {
    qa.fromArray(a, i); qb.fromArray(b, i); qa.multiply(qb).normalize();
    if (i > 0 && out[i - 4] * qa.x + out[i - 3] * qa.y + out[i - 2] * qa.z + out[i - 1] * qa.w < 0) qa.set(-qa.x, -qa.y, -qa.z, -qa.w);
    qa.toArray(out, i);
  }
  return out;
}
