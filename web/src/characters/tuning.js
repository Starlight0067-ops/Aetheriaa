// Clip tuning (owner: character agent): small, model-independent corrections applied to retargeted
// NormalizedClips at load time (browser and offline bake both go through library.loadNormClip / tuneClip).
//
// The animation pack's standing clips use a wide "guarded" stance (feet ~0.5 m apart, fists, head pitched
// down ~15 deg). On anime characters (skirts, slim legs) that reads as aggressive, so standing actions are
// blended toward a relaxed contrapposto. Locomotion and combat clips are left untouched.
import * as THREE from 'three';

const D = THREE.MathUtils.DEG2RAD;
const q = (x, y, z, order = 'XYZ') => new THREE.Quaternion().setFromEuler(new THREE.Euler(x * D, y * D, z * D, order));

// Natural standing targets in normalized (+Z forward, +X = character-left) convention.
const STAND = {
  leftUpperLeg: q(-5, 7, 3.5), leftLowerLeg: q(9, 0, 0), leftFoot: q(-3, 0, 0),
  rightUpperLeg: q(1, -5, -2), rightLowerLeg: q(2.5, 0, 0), rightFoot: q(-1, 0, 0),
};
// Relaxed half-curl for the four fingers (left curls about -Z, right about +Z).
const FINGERS = ['Index', 'Middle', 'Ring', 'Little'];
const CURL = { Proximal: 16, Intermediate: 24, Distal: 12 };
const RELAX = {};
for (const F of FINGERS) for (const [seg, deg] of Object.entries(CURL)) {
  const k = 1 + FINGERS.indexOf(F) * 0.12;             // little finger curls a bit more than the index
  RELAX['left' + F + seg] = q(0, 0, -deg * k);
  RELAX['right' + F + seg] = q(0, 0, deg * k);
}

/** Per-action weights: legs -> STAND, fingers -> RELAX, headLift (deg, positive = look up). */
const PLAN = {
  idle: { legs: 0.8, fingers: 0.65, headLift: 12, arms: 0.25 },
  talk: { legs: 0.7, fingers: 0.35, headLift: 7 },
  wave: { legs: 0.7, fingers: 0.0, headLift: 6 },
  interact: { legs: 0.5, fingers: 0.0, headLift: 0 },
  cast: { legs: 0.0, fingers: 0.0, headLift: 0 },
};

const _a = new THREE.Quaternion(), _b = new THREE.Quaternion();
function blendTrack(arr, target, w) {
  if (!arr || w <= 0) return;
  for (let i = 0; i < arr.length; i += 4) {
    _a.fromArray(arr, i).slerp(target, w).normalize();
    _a.toArray(arr, i);
  }
}
function premulTrack(arr, rot) {
  if (!arr) return;
  for (let i = 0; i < arr.length; i += 4) { _a.fromArray(arr, i); _b.copy(rot).multiply(_a).normalize(); _b.toArray(arr, i); }
}

/** Mutates and returns a NormalizedClip. Idempotent per clip object (marks nc.tuned). */
export function tuneClip(action, nc) {
  if (!nc || nc.tuned) return nc;
  const p = PLAN[action];
  if (p) {
    const B = nc.bones;
    if (p.legs) {
      // thighs: targets are root-relative (undo the per-frame pelvis tilt), shins/feet are parent-relative
      const H = B.hips, inv = new THREE.Quaternion(), tgt = new THREE.Quaternion();
      for (const b of ['leftUpperLeg', 'rightUpperLeg']) {
        const arr = B[b]; if (!arr) continue;
        for (let i = 0; i < arr.length; i += 4) {
          if (H) inv.fromArray(H, i).invert(); else inv.identity();
          tgt.copy(inv).multiply(STAND[b]);
          _a.fromArray(arr, i).slerp(tgt, p.legs).normalize();
          _a.toArray(arr, i);
        }
      }
      for (const b of ['leftLowerLeg', 'rightLowerLeg', 'leftFoot', 'rightFoot']) blendTrack(B[b], STAND[b], p.legs);
    }
    if (p.fingers) for (const [b, t] of Object.entries(RELAX)) blendTrack(B[b], t, p.fingers);
    if (p.headLift) {
      // lift the gaze: split between neck and head (rotation about +X is "look down" in this convention)
      premulTrack(B.neck, q(-p.headLift * 0.4, 0, 0));
      premulTrack(B.head, q(-p.headLift * 0.6, 0, 0));
    }
    if (p.arms) {
      // bring the hanging arms ~25% closer to the body (abduction about Z), keep the source swing
      for (const [b, s] of [['leftUpperArm', 1], ['rightUpperArm', -1]]) {
        const arr = B[b]; if (!arr) continue;
        for (let i = 0; i < arr.length; i += 4) {
          _a.fromArray(arr, i);
          _b.setFromAxisAngle(new THREE.Vector3(0, 0, 1), -s * 5 * D * p.arms * 4).multiply(_a).normalize();
          _b.toArray(arr, i);
        }
      }
    }
  }
  nc.tuned = true;
  return nc;
}
