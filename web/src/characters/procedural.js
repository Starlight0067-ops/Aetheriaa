// Procedural fallback clips (owner: character agent), authored on the normalized humanoid
// (T-pose rest, +Z forward, +X = character left). Used only for actions without a baked/FBX clip.
import * as THREE from 'three';

const D = THREE.MathUtils.DEG2RAD;
const BONES = ['hips', 'spine', 'chest', 'upperChest', 'neck', 'head', 'leftShoulder', 'rightShoulder', 'leftUpperArm', 'rightUpperArm',
  'leftLowerArm', 'rightLowerArm', 'leftHand', 'rightHand', 'leftUpperLeg', 'rightUpperLeg', 'leftLowerLeg', 'rightLowerLeg', 'leftFoot', 'rightFoot'];
const LIMB = /Arm|Leg|Hand|Foot|Shoulder/;

// pose helpers: a pose is { bone: [x, y, z] degrees }, hips offset in metres: pose._hips = [x, y, z]
function arms(p, down, fwdL, fwdR, elbowL, elbowR) {
  p.leftUpperArm = [-fwdL, 0, -down]; p.rightUpperArm = [-fwdR, 0, down];
  p.leftLowerArm = [0, -elbowL, 0]; p.rightLowerArm = [0, elbowR, 0];
  p.leftHand = [0, 0, -8]; p.rightHand = [0, 0, 8];
}
function legs(p, thighL, kneeL, footL, thighR, kneeR, footR) {
  p.leftUpperLeg = [thighL, 0, 1.5]; p.leftLowerLeg = [kneeL, 0, 0]; p.leftFoot = [footL, 0, 0];
  p.rightUpperLeg = [thighR, 0, -1.5]; p.rightLowerLeg = [kneeR, 0, 0]; p.rightFoot = [footR, 0, 0];
}

const POSES = {
  idle(t, T) {
    const b = Math.sin(t / T * Math.PI * 2), b2 = Math.sin(t / T * Math.PI * 4 + 1);
    const p = { hips: [2, 4, 2], spine: [1, -2, -1], chest: [-1.5 * b - 1, -1, 0], upperChest: [-1 * b, 0, 0], neck: [2, 3, 1], head: [3 + b2, 4, 3] };
    arms(p, 72 + 1.2 * b, -6, -4, 12, 16);
    p.leftShoulder = [0, 0, -1 * b]; p.rightShoulder = [0, 0, 1 * b];
    legs(p, -3, 4, -1, 2, 2, -2); p.leftUpperLeg[2] = 4; p.rightUpperLeg[2] = -2;
    p._hips = [0.012, -0.008 + 0.003 * b, 0];
    return p;
  },
  walk(t, T) { return gait(t / T, { swing: 26, knee: 58, arm: 22, elbow: 18, bob: 0.025, lean: 3, twist: 6 }); },
  run(t, T) { return gait(t / T, { swing: 42, knee: 100, arm: 38, elbow: 85, bob: 0.05, lean: 12, twist: 9, drop: 0.06 }); },
  sprint(t, T) { return gait(t / T, { swing: 52, knee: 115, arm: 50, elbow: 95, bob: 0.06, lean: 20, twist: 11, drop: 0.08 }); },
  fall(t, T) {
    const b = Math.sin(t / T * Math.PI * 2);
    const p = { spine: [-4, 0, 0], chest: [-3, 0, 0], head: [-6, 0, 0] };
    arms(p, 35 + 6 * b, 10, 10, 30, 30); legs(p, -25 - 5 * b, 40, 10, -8 + 5 * b, 55, 15);
    return p;
  },
};

function gait(ph, o) {
  const a = ph * Math.PI * 2, s = Math.sin(a), c = Math.cos(a);
  const swingL = -o.swing * c, swingR = o.swing * c;                 // left leg forward at phase 0
  const kneeL = Math.max(0, Math.sin(a + Math.PI * 0.95)) * o.knee + 6, kneeR = Math.max(0, Math.sin(a - 0.05 * Math.PI)) * o.knee + 6;
  const p = { hips: [o.lean * 0.5, -o.twist * c, 2 * s], spine: [o.lean * 0.4, o.twist * 0.6 * c, -s], chest: [o.lean * 0.3, o.twist * 0.5 * c, 0],
    neck: [-o.lean * 0.4, 0, 0], head: [-o.lean * 0.4, 0, -s] };
  arms(p, 74 - o.elbow * 0.05, o.arm * c, -o.arm * c, o.elbow + 6 * Math.max(0, c), o.elbow + 6 * Math.max(0, -c));
  legs(p, swingL, kneeL, -10 * c, swingR, kneeR, 10 * c);
  p._hips = [0.02 * s, -(o.drop || 0) - o.bob * 0.5 + o.bob * Math.abs(Math.cos(a)), 0];
  return p;
}

/** Build THREE clips for the actions in `wanted` against `rig`. */
export function buildProceduralClips(rig, wanted = ['idle', 'walk', 'run', 'sprint', 'fall']) {
  const out = {};
  const len = { idle: 3.2, walk: 1.05, run: 0.7, sprint: 0.56, fall: 1.2 };
  const natural = { walk: 1.35, run: 4.6, sprint: 7.6 };
  const h = rig.hipsHeight || 0.9;
  for (const name of wanted) {
    const fn = POSES[name]; if (!fn) continue;
    const T = len[name], fps = 30, frames = Math.round(T * fps) + 1;
    const times = new Float32Array(frames);
    const tracks = {}; const hips = new Float32Array(frames * 3);
    const e = new THREE.Euler(), q = new THREE.Quaternion();
    for (let f = 0; f < frames; f++) {
      const t = (f / (frames - 1)) * T; times[f] = t;
      const p = fn(t, T);
      for (const b of BONES) {
        if (!rig.has(b)) continue;
        const v = p[b] || [0, 0, 0];
        e.set(v[0] * D, v[1] * D, v[2] * D, LIMB.test(b) ? 'XYZ' : 'YXZ');
        q.setFromEuler(e);
        (tracks[b] ??= new Float32Array(frames * 4)).set([q.x, q.y, q.z, q.w], f * 4);
      }
      const o = p._hips || [0, 0, 0];
      hips.set([rig.hipsRest.x + o[0] * h / 0.9, rig.hipsRest.y + o[1] * h / 0.9, rig.hipsRest.z + o[2]], f * 3);
    }
    const kt = Object.entries(tracks).map(([b, v]) => new THREE.QuaternionKeyframeTrack(`${rig.node(b).name}.quaternion`, times, v));
    kt.push(new THREE.VectorKeyframeTrack(`${rig.node('hips').name}.position`, times, hips));
    const clip = new THREE.AnimationClip(name, T, kt);
    clip.userData = { speed: (natural[name] || 0) * h / 0.9, phase: 0, procedural: true };
    out[name] = clip;
  }
  return out;
}
