// Normalized humanoid rig (owner: character agent).
//
// Every animation source (procedural clips, Mixamo retargets, legacy GLB clips) is authored against a
// "normalized" humanoid in VRM 1.0 convention: T-pose rest with identity rotations, model facing +Z,
// character-left = +X, Y up. For VRM models three-vrm provides that rig; for plain GLB skeletons this
// module builds an equivalent one (re-posing the raw skeleton into a T-pose first) and copies the
// normalized pose back to the raw bones every frame.
import * as THREE from 'three';
import { HUMAN_PARENT } from './names.js';

/** Bones we animate, parents first. */
export const HUMAN_BONES = [
  'hips', 'spine', 'chest', 'upperChest', 'neck', 'head',
  'leftShoulder', 'leftUpperArm', 'leftLowerArm', 'leftHand',
  'rightShoulder', 'rightUpperArm', 'rightLowerArm', 'rightHand',
  'leftUpperLeg', 'leftLowerLeg', 'leftFoot', 'leftToes',
  'rightUpperLeg', 'rightLowerLeg', 'rightFoot', 'rightToes',
];
export const FINGER_BONES = [];
for (const s of ['left', 'right']) {
  for (const f of ['Thumb', 'Index', 'Middle', 'Ring', 'Little']) {
    const seg = f === 'Thumb' ? ['Metacarpal', 'Proximal', 'Distal'] : ['Proximal', 'Intermediate', 'Distal'];
    for (const g of seg) FINGER_BONES.push(s + f + g);
  }
}
export const ALL_HUMAN_BONES = [...HUMAN_BONES, ...FINGER_BONES];

// Raw-skeleton naming schemes we recognise (after three.js name sanitising, which drops "." and ":").
const SCHEMES = {
  vrm: (h) => [h, h.charAt(0).toUpperCase() + h.slice(1)],
  legacy: (h) => ({
    hips: 'hips', spine: 'spine', chest: 'chest', neck: 'neck', head: 'head',
    leftShoulder: 'clavL', leftUpperArm: 'upper_armL', leftLowerArm: 'forearmL', leftHand: 'handL',
    rightShoulder: 'clavR', rightUpperArm: 'upper_armR', rightLowerArm: 'forearmR', rightHand: 'handR',
    leftUpperLeg: 'thighL', leftLowerLeg: 'shinL', leftFoot: 'footL',
    rightUpperLeg: 'thighR', rightLowerLeg: 'shinR', rightFoot: 'footR',
  })[h],
  mixamo: (h) => {
    const m = {
      hips: 'Hips', spine: 'Spine', chest: 'Spine1', upperChest: 'Spine2', neck: 'Neck', head: 'Head',
      leftShoulder: 'LeftShoulder', leftUpperArm: 'LeftArm', leftLowerArm: 'LeftForeArm', leftHand: 'LeftHand',
      rightShoulder: 'RightShoulder', rightUpperArm: 'RightArm', rightLowerArm: 'RightForeArm', rightHand: 'RightHand',
      leftUpperLeg: 'LeftUpLeg', leftLowerLeg: 'LeftLeg', leftFoot: 'LeftFoot', leftToes: 'LeftToeBase',
      rightUpperLeg: 'RightUpLeg', rightLowerLeg: 'RightLeg', rightFoot: 'RightFoot', rightToes: 'RightToeBase',
    }[h];
    return m ? ['mixamorig' + m, 'mixamorig1' + m, m] : null;
  },
};

/** Find raw bones for each humanoid bone in an arbitrary skeleton. Returns { boneName: Object3D }. */
export function detectHumanBones(root) {
  const byName = new Map();
  root.traverse((o) => { if (o.isBone || o.type === 'Object3D' || o.isObject3D) if (!byName.has(o.name)) byName.set(o.name, o); });
  let best = {}, bestCount = 0;
  for (const scheme of Object.values(SCHEMES)) {
    const found = {};
    for (const h of ALL_HUMAN_BONES) {
      let names = scheme(h);
      if (!names) continue;
      if (!Array.isArray(names)) names = [names];
      for (const n of names) {
        const o = byName.get(n);
        if (o && (o.isBone || o.children.length || h.includes('Toes'))) { found[h] = o; break; }
      }
    }
    const count = Object.keys(found).length;
    if (count > bestCount) { best = found; bestCount = count; }
  }
  return bestCount >= 10 && best.hips && best.head ? best : null;
}

/**
 * Re-pose a skeleton (in place) into the canonical normalized T-pose, expressed in `root`'s frame:
 * pelvis upright facing +Z, spine chain vertical, clavicles/arms/hands/fingers along +-X, legs straight down.
 * Used for BOTH animation sources and target rigs so their rests agree whatever the authored rest was.
 */
export function alignToTPose(root, m) {
  const qRoot = () => root.getWorldQuaternion(new THREE.Quaternion()).invert();
  const pos = (o) => root.worldToLocal(o.getWorldPosition(new THREE.Vector3()));
  const rotateWorld = (bone, delta) => {          // apply a root-frame rotation to `bone`
    const ri = qRoot();
    const wq = bone.getWorldQuaternion(new THREE.Quaternion()).premultiply(ri);
    const pq = bone.parent.getWorldQuaternion(new THREE.Quaternion()).premultiply(ri);
    bone.quaternion.copy(pq.invert().multiply(delta.clone().multiply(wq)));
    bone.updateMatrixWorld(true);
  };
  const align = (bone, child, dir) => {
    if (!bone || !child) return;
    root.updateMatrixWorld(true);
    const cur = pos(child).sub(pos(bone));
    if (cur.lengthSq() < 1e-12) return;
    rotateWorld(bone, new THREE.Quaternion().setFromUnitVectors(cur.normalize(), dir));
  };
  root.updateMatrixWorld(true);
  // pelvis: thigh-to-thigh axis -> +X, pelvis-to-spine -> +Y
  if (m.hips && m.leftUpperLeg && m.rightUpperLeg && m.spine) {
    const x = pos(m.leftUpperLeg).sub(pos(m.rightUpperLeg)).normalize();
    const y = pos(m.spine).sub(pos(m.hips)).normalize();
    const z = new THREE.Vector3().crossVectors(x, y).normalize();
    y.crossVectors(z, x).normalize();
    const cur = new THREE.Matrix4().makeBasis(x, y, z);
    const delta = new THREE.Quaternion().setFromRotationMatrix(cur).invert();
    rotateWorld(m.hips, delta);
  }
  const Y = new THREE.Vector3(0, 1, 0), X = new THREE.Vector3(1, 0, 0), NX = new THREE.Vector3(-1, 0, 0), NY = new THREE.Vector3(0, -1, 0);
  const chain = ['spine', 'chest', 'upperChest', 'neck', 'head'].filter((h) => m[h]);
  for (let i = 0; i < chain.length - 1; i++) align(m[chain[i]], m[chain[i + 1]], Y);
  for (const [S, D] of [['left', X], ['right', NX]]) {
    align(m[S + 'Shoulder'], m[S + 'UpperArm'], D);
    align(m[S + 'UpperArm'], m[S + 'LowerArm'], D);
    align(m[S + 'LowerArm'], m[S + 'Hand'], D);
    align(m[S + 'Hand'], m[S + 'MiddleProximal'] || m[S + 'IndexProximal'], D);
    for (const F of ['Index', 'Middle', 'Ring', 'Little']) {
      align(m[S + F + 'Proximal'], m[S + F + 'Intermediate'], D);
      align(m[S + F + 'Intermediate'], m[S + F + 'Distal'], D);
    }
    align(m[S + 'UpperLeg'], m[S + 'LowerLeg'], NY);
    align(m[S + 'LowerLeg'], m[S + 'Foot'], NY);
  }
  root.updateMatrixWorld(true);
}

const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _v = new THREE.Vector3(), _v2 = new THREE.Vector3();
const _m = new THREE.Matrix4();

function nearestPresentParent(name, present) {
  let p = HUMAN_PARENT[name];
  while (p && !present[p]) p = HUMAN_PARENT[p];
  return p || null;
}

/** World rotation of `o` expressed in `root`'s frame. */
function rotIn(root, o, out) {
  root.getWorldQuaternion(_q2).invert();
  return o.getWorldQuaternion(out).premultiply(_q2);
}
function posIn(root, o, out) {
  o.getWorldPosition(out);
  return root.worldToLocal(out);
}

/**
 * Normalized rig for a raw (non-VRM) skeleton.
 * @param modelRoot Object3D containing the skinned meshes (its frame defines "forward = +Z").
 * @param raw { humanBone: Object3D }
 */
export class NormalizedRig {
  constructor(modelRoot, raw, { tpose = true, prefix = 'N' } = {}) {
    this.modelRoot = modelRoot;
    this.raw = raw;
    this.isVRM = false;
    modelRoot.updateMatrixWorld(true);
    if (tpose) alignToTPose(modelRoot, raw);
    modelRoot.updateMatrixWorld(true);

    this.root = new THREE.Object3D();
    this.root.name = prefix + '_root';
    modelRoot.add(this.root);
    this.nodes = {};
    this._rest = {};
    const order = ALL_HUMAN_BONES.filter((h) => raw[h]);
    for (const h of order) {
      const node = new THREE.Object3D();
      node.name = `${prefix}_${h}`;
      const parentName = nearestPresentParent(h, raw);
      const parentNode = parentName ? this.nodes[parentName] : this.root;
      const wp = posIn(modelRoot, raw[h], new THREE.Vector3());
      const pp = parentName ? posIn(modelRoot, raw[parentName], new THREE.Vector3()) : new THREE.Vector3();
      node.position.copy(wp).sub(pp);
      parentNode.add(node);
      this.nodes[h] = node;
      const parentRot = raw[h].parent ? rotIn(modelRoot, raw[h].parent, new THREE.Quaternion()) : new THREE.Quaternion();
      this._rest[h] = {
        P: parentRot, Pinv: parentRot.clone().invert(), B: raw[h].quaternion.clone(),
        pos: node.position.clone(), rawPos: raw[h].position.clone(),
      };
    }
    this.order = order;
    this.hipsRest = this.nodes.hips.position.clone();
    this.hipsHeight = this.hipsRest.y;
  }

  has(h) { return !!this.nodes[h]; }
  node(h) { return this.nodes[h] || null; }

  /** Rotate limbs of the raw skeleton so the rest pose is a T-pose (arms +-X, legs -Y). */
  _tpose() {
    const r = this.raw, root = this.modelRoot;
    const align = (bone, childBone, dir) => {
      if (!bone || !childBone) return;
      root.updateMatrixWorld(true);
      const a = posIn(root, bone, new THREE.Vector3());
      const b = posIn(root, childBone, new THREE.Vector3());
      const cur = b.sub(a);
      if (cur.lengthSq() < 1e-10) return;
      cur.normalize();
      const delta = new THREE.Quaternion().setFromUnitVectors(cur, dir);
      // world (root-frame) rotation of bone -> delta * current, then back to local
      const wq = rotIn(root, bone, new THREE.Quaternion());
      const pq = bone.parent ? rotIn(root, bone.parent, new THREE.Quaternion()) : new THREE.Quaternion();
      bone.quaternion.copy(pq.invert().multiply(delta.multiply(wq)));
      bone.updateMatrixWorld(true);
    };
    const X = new THREE.Vector3(1, 0, 0), NX = new THREE.Vector3(-1, 0, 0), NY = new THREE.Vector3(0, -1, 0);
    const handChild = (s) => r[s + 'MiddleProximal'] || r[s + 'IndexProximal'] || null;
    align(r.leftUpperArm, r.leftLowerArm, X);
    align(r.leftLowerArm, r.leftHand, X);
    align(r.leftHand, handChild('left'), X);
    align(r.rightUpperArm, r.rightLowerArm, NX);
    align(r.rightLowerArm, r.rightHand, NX);
    align(r.rightHand, handChild('right'), NX);
    align(r.leftUpperLeg, r.leftLowerLeg, NY);
    align(r.leftLowerLeg, r.leftFoot, NY);
    align(r.rightUpperLeg, r.rightLowerLeg, NY);
    align(r.rightLowerLeg, r.rightFoot, NY);
  }

  /** Reset the normalized pose to the T-pose rest. */
  resetPose() {
    for (const h of this.order) { this.nodes[h].quaternion.identity(); this.nodes[h].position.copy(this._rest[h].pos); }
  }

  /** Copy normalized pose -> raw bones. */
  update() {
    for (const h of this.order) {
      const n = this.nodes[h], rest = this._rest[h], bone = this.raw[h];
      // raw local = P^-1 * qn * P * B   (three-vrm VRMHumanoidRig convention)
      bone.quaternion.copy(rest.Pinv).multiply(n.quaternion).multiply(rest.P).multiply(rest.B);
    }
    // hips translation: put the raw hips where the normalized hips are (in model-root space)
    const hips = this.raw.hips, nh = this.nodes.hips;
    if (hips && nh) {
      this.modelRoot.updateMatrixWorld(true);
      _v.copy(nh.position);                         // normalized root == model root frame
      this.modelRoot.localToWorld(_v);
      hips.parent.updateWorldMatrix(true, false);
      _m.copy(hips.parent.matrixWorld).invert();
      hips.position.copy(_v.applyMatrix4(_m));
    }
  }

  /** Inverse: raw local rotation -> normalized rotation (used to convert legacy clips). */
  rawToNormalized(h, rawLocal, out) {
    const rest = this._rest[h];
    // qn = P * raw * B^-1 * P^-1
    return out.copy(rest.P).multiply(rawLocal).multiply(_q.copy(rest.B).invert()).multiply(rest.Pinv);
  }
}

/** Adapter exposing a VRM's own normalized rig through the same interface. */
export class VRMRigAdapter {
  constructor(vrm) {
    this.vrm = vrm;
    this.isVRM = true;
    this.root = vrm.scene;
    this.nodes = {};
    for (const h of ALL_HUMAN_BONES) {
      const n = vrm.humanoid?.getNormalizedBoneNode(h);
      if (n) this.nodes[h] = n;
    }
    this.order = ALL_HUMAN_BONES.filter((h) => this.nodes[h]);
    vrm.scene.updateMatrixWorld(true);
    this.hipsRest = this.nodes.hips.position.clone();
    const hw = this.nodes.hips.getWorldPosition(new THREE.Vector3());
    const rw = vrm.scene.getWorldPosition(new THREE.Vector3());
    this.hipsHeight = Math.abs(hw.y - rw.y) || this.hipsRest.y;
    this._restPos = {};
    for (const h of this.order) this._restPos[h] = this.nodes[h].position.clone();
    this.isVRM0 = vrm.meta?.metaVersion === '0';
  }
  has(h) { return !!this.nodes[h]; }
  node(h) { return this.nodes[h] || null; }
  resetPose() { for (const h of this.order) { this.nodes[h].quaternion.identity(); this.nodes[h].position.copy(this._restPos[h]); } }
  update() { /* vrm.update(dt) copies the normalized pose to the raw bones */ }
}

/** World position of a normalized node in the rig's root frame (for analysis). */
export function nodePosInRoot(rig, h, out = new THREE.Vector3()) {
  const n = rig.node(h);
  if (!n) return out.set(0, 0, 0);
  rig.root.updateMatrixWorld(true);
  n.getWorldPosition(out);
  return rig.root.worldToLocal(out);
}
