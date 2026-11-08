// Fallback hero used until (or if) src/characters/index.js provides the real character.
// Original procedural figure (teal travelling coat, brass hex buckle, navy hair with an Aether-cyan streak)
// with a small procedural animation set. Same API as the character contract. Faces -Z, feet at y = 0.
import * as THREE from 'three';
import { createToonMaterial, createOutline } from '../render/toon.js';
import { clamp, damp, lerp } from './math.js';

const PAL = { coat: 0x2b9c9a, coatDark: 0x1f6f78, shirt: 0x24304a, pants: 0x3a3550, boot: 0x4e3526, skin: 0xf7dcc9,
  hair: 0x1f2848, streak: 0x7ff5ff, gold: 0xe2b95b, scarf: 0xf1e6d0, eye: 0x2a1d3a, iris: 0x2fc6d8 };

export function createPlaceholder(ctx) {
  const mats = {};
  const mat = (key, color, kind, extra = {}) => (mats[key] ||= createToonMaterial({ color, kind, ...extra }));
  const root = new THREE.Group(); root.name = 'kael-placeholder';
  const meshes = [];
  const add = (parent, geo, m, x = 0, y = 0, z = 0) => {
    const mesh = new THREE.Mesh(geo, m);
    mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true;
    parent.add(mesh); meshes.push(mesh);
    return mesh;
  };
  const joint = (parent, x, y, z) => { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g; };
  const limb = (r0, r1, len) => { const g = new THREE.CapsuleGeometry((r0 + r1) / 2, len, 4, 10); g.translate(0, -len / 2, 0); return g; };

  const cloth = mat('coat', PAL.coat, 'cloth'), coatDark = mat('coatDark', PAL.coatDark, 'cloth');
  const shirt = mat('shirt', PAL.shirt, 'cloth'), pants = mat('pants', PAL.pants, 'cloth');
  const boot = mat('boot', PAL.boot, 'cloth'), skin = mat('skin', PAL.skin, 'skin');
  const hair = mat('hair', PAL.hair, 'hair'), streak = mat('streak', PAL.streak, 'hair', { emissive: 0x2a8a96, emissiveIntensity: 0.35 });
  const gold = mat('gold', PAL.gold, 'metal'), scarfM = mat('scarf', PAL.scarf, 'cloth');
  const glow = mat('glow', PAL.streak, 'glow', { emissive: PAL.streak, emissiveIntensity: 1.6 });

  // ---- skeleton
  const hips = joint(root, 0, 0.95, 0);
  const spine = joint(hips, 0, 0.06, 0);
  const chest = joint(spine, 0, 0.26, 0);
  const neck = joint(chest, 0, 0.17, 0);
  const head = joint(neck, 0, 0.1, 0);
  const legs = [], arms = [];
  for (const side of [-1, 1]) {
    const thigh = joint(hips, side * 0.095, -0.02, 0);
    add(thigh, limb(0.075, 0.06, 0.34), pants);
    const knee = joint(thigh, 0, -0.43, 0);
    add(knee, limb(0.058, 0.048, 0.32), pants);
    const foot = joint(knee, 0, -0.42, 0);
    const b = add(foot, new THREE.BoxGeometry(0.1, 0.09, 0.22), boot, 0, -0.035, -0.045);
    b.geometry.translate(0, 0, 0);
    add(knee, new THREE.CylinderGeometry(0.064, 0.058, 0.2, 10), boot, 0, -0.32, 0);
    legs.push({ thigh, knee, foot, side });

    const shoulder = joint(chest, side * 0.2, 0.12, 0);
    add(shoulder, new THREE.SphereGeometry(0.068, 12, 8), cloth);
    const upper = joint(shoulder, 0, 0, 0);
    add(upper, limb(0.052, 0.045, 0.2), cloth);
    const elbow = joint(upper, 0, -0.27, 0);
    add(elbow, limb(0.044, 0.036, 0.18), shirt);
    add(elbow, new THREE.CylinderGeometry(0.05, 0.05, 0.05, 10), gold, 0, -0.2, 0);
    const hand = joint(elbow, 0, -0.25, 0);
    add(hand, new THREE.SphereGeometry(0.045, 10, 8), skin, 0, -0.02, 0).scale.set(0.8, 1.1, 1);
    arms.push({ shoulder, upper, elbow, hand, side });
  }

  // ---- body
  const torsoProfile = [[0.0, 0], [0.15, 0], [0.16, 0.08], [0.15, 0.18], [0.17, 0.3], [0.18, 0.4], [0.12, 0.47], [0.0, 0.48]]
    .map(([r, y]) => new THREE.Vector2(r, y));
  add(spine, new THREE.LatheGeometry(torsoProfile, 16), shirt, 0, -0.06, 0).scale.set(1, 1, 0.72);
  // open coat: lathe from chest to knees, slit at the front
  const coatProfile = [[0.185, 0.42], [0.19, 0.3], [0.17, 0.12], [0.17, 0.0], [0.2, -0.18], [0.25, -0.42], [0.28, -0.55]]
    .map(([r, y]) => new THREE.Vector2(r, y));
  const coat = add(spine, new THREE.LatheGeometry(coatProfile, 20, Math.PI * 0.62, Math.PI * 1.76), cloth, 0, -0.06, 0);
  coat.scale.set(1, 1, 0.78); coat.material = mat('coat2', PAL.coat, 'cloth', { side: THREE.DoubleSide });
  add(spine, new THREE.TorusGeometry(0.165, 0.022, 6, 20), coatDark, 0, 0.0, 0).rotation.x = Math.PI / 2;
  // belt + hex buckle with Aether gem
  const belt = add(hips, new THREE.TorusGeometry(0.16, 0.025, 6, 22), mat('belt', 0x5e3d27, 'cloth'), 0, 0.07, 0);
  belt.rotation.x = Math.PI / 2; belt.scale.set(1, 0.76, 1);
  const buckle = add(hips, new THREE.CylinderGeometry(0.045, 0.045, 0.02, 6), gold, 0, 0.07, -0.125);
  buckle.rotation.x = Math.PI / 2;
  add(hips, new THREE.CylinderGeometry(0.02, 0.02, 0.025, 6), glow, 0, 0.07, -0.137).rotation.x = Math.PI / 2;
  add(hips, new THREE.SphereGeometry(0.15, 14, 10), pants, 0, -0.02, 0).scale.set(1, 0.7, 0.8);
  // shoulder pauldron (brass) on the left side
  add(arms[0].shoulder, new THREE.SphereGeometry(0.085, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), gold, 0, 0.01, 0);
  // scarf + tail
  const scarf = add(neck, new THREE.TorusGeometry(0.075, 0.035, 8, 18), scarfM, 0, -0.02, 0);
  scarf.rotation.x = Math.PI / 2;
  const tailPivot = joint(neck, 0.05, -0.02, 0.07);
  const tail = add(tailPivot, new THREE.BoxGeometry(0.08, 0.36, 0.015), mat('scarf2', PAL.scarf, 'cloth', { side: THREE.DoubleSide }), 0, -0.18, 0);
  add(neck, new THREE.CylinderGeometry(0.04, 0.045, 0.1, 10), skin, 0, 0.03, 0);

  // ---- head (big anime head, eyes on the -Z face)
  const skull = add(head, new THREE.SphereGeometry(0.125, 24, 18), skin, 0, 0.11, 0);
  skull.scale.set(0.93, 1.05, 1.0);
  add(head, new THREE.SphereGeometry(0.075, 14, 10), skin, 0, 0.05, -0.04).scale.set(1, 0.8, 1); // jaw
  const eyeGeo = new THREE.CircleGeometry(0.024, 16), irisGeo = new THREE.CircleGeometry(0.014, 14), hlGeo = new THREE.CircleGeometry(0.006, 8);
  const eyeM = mat('eye', PAL.eye, 'skin'), irisM = mat('iris', PAL.iris, 'glow', { emissive: 0x1a6f7a, emissiveIntensity: 0.6 });
  const hlM = mat('hl', 0xffffff, 'glow', { emissive: 0xffffff, emissiveIntensity: 1 });
  for (const s of [-1, 1]) {
    const e = new THREE.Group(); e.position.set(s * 0.045, 0.1, -0.118); e.rotation.y = Math.PI + s * 0.32; head.add(e);
    add(e, eyeGeo, eyeM).scale.set(0.85, 1.25, 1);
    add(e, irisGeo, irisM, 0, -0.004, 0.001).scale.set(0.9, 1.2, 1);
    add(e, hlGeo, hlM, s * 0.006, 0.01, 0.002);
    const brow = add(e, new THREE.BoxGeometry(0.04, 0.006, 0.004), hair, 0, 0.042, 0.002);
    brow.rotation.z = s * -0.12;
  }
  // hair: cap + clumps
  add(head, new THREE.SphereGeometry(0.138, 22, 14, 0, Math.PI * 2, 0, Math.PI * 0.58), hair, 0, 0.125, 0.012).scale.set(0.98, 1.0, 1.04);
  const clump = (x, y, z, rx, rz, len = 0.17, r = 0.045, m = hair) => {
    const g = new THREE.ConeGeometry(r, len, 7); g.translate(0, -len / 2, 0);
    const c = add(head, g, m, x, y, z); c.rotation.set(rx, 0, rz); return c;
  };
  for (let i = 0; i < 7; i++) { const a = (i / 6 - 0.5) * 1.9; clump(Math.sin(a) * 0.1, 0.2, -0.1 + Math.abs(a) * 0.03, -0.35, -a * 0.35, 0.13 + (i % 2) * 0.04, 0.04); } // bangs
  for (let i = 0; i < 9; i++) { const a = (i / 8) * Math.PI - Math.PI / 2; clump(Math.sin(a) * 0.12, 0.17, 0.05 + Math.cos(a) * 0.07, 0.5 + Math.cos(a) * 0.35, -Math.sin(a) * 0.6, 0.2, 0.05); } // back
  clump(-0.115, 0.13, -0.03, -0.1, 0.25, 0.2, 0.035, streak); // cyan inner streak
  clump(0.118, 0.13, -0.02, -0.1, -0.25, 0.19, 0.038);
  clump(0.0, 0.27, 0.0, -0.9, 0.2, 0.12, 0.022);              // cowlick

  for (const m of meshes) { const o = createOutline?.(m, 0.012); if (o) m.parent.add(o); }

  // ---- animation state
  const st = { speed: 0, grounded: true, vy: 0, phase: 0, t: 0, one: null, oneT: 0, look: null, lookYaw: 0, lookPitch: 0 };
  const pose = {}; // smoothed joint targets
  const set = (obj, prop, axis, target, rate, dt) => {
    const k = obj.uuid + prop + axis;
    pose[k] = pose[k] === undefined ? target : damp(pose[k], target, rate, dt);
    obj[prop][axis] = pose[k];
  };
  const _v = new THREE.Vector3(), _w = new THREE.Vector3();

  function update(dt) {
    st.t += dt;
    if (st.one) { st.oneT += dt; if (st.oneT > ({ land: 0.28, dodge: 0.36, jump: 0.3, hit: 0.3 }[st.one] ?? 0.5)) st.one = null; }
    const sp = st.speed, amp = clamp(sp / 5.6, 0, 1.25);
    const stride = lerp(1.1, 2.4, clamp(sp / 8.6, 0, 1));
    st.phase += (sp * dt) / stride;
    const cyc = st.phase * Math.PI * 2;
    const air = !st.grounded;
    const dodge = st.one === 'dodge', land = st.one === 'land';
    const R = 16;
    // legs
    for (const L of legs) {
      const ph = cyc + (L.side > 0 ? Math.PI : 0);
      let th = Math.sin(ph) * 0.75 * amp, kn = -Math.max(0, Math.sin(ph + Math.PI / 2)) * 1.25 * amp - 0.05;
      if (air) { th = L.side > 0 ? 0.75 : 0.15; kn = L.side > 0 ? -1.3 : -0.45; if (st.vy < -2) { th = 0.25 + L.side * 0.15; kn = -0.6; } }
      if (dodge) { th = L.side > 0 ? 1.0 : -0.3; kn = L.side > 0 ? -1.5 : -0.9; }
      if (land) { th = 0.55; kn = -1.0; }
      set(L.thigh, 'rotation', 'x', th, R, dt);
      set(L.thigh, 'rotation', 'z', L.side * 0.04, R, dt);
      set(L.knee, 'rotation', 'x', kn, R, dt);
      set(L.foot, 'rotation', 'x', air ? 0.35 : -kn * 0.3 - th * 0.4, R, dt);
    }
    // arms
    for (const A of arms) {
      const ph = cyc + (A.side > 0 ? 0 : Math.PI);
      let ux = Math.sin(ph) * 0.65 * amp, uz = A.side * (0.12 + 0.08 * amp), el = 0.25 + 0.6 * amp;
      if (sp < 0.2) { ux = Math.sin(st.t * 1.6 + A.side) * 0.03; el = 0.18; }
      if (air) { ux = -0.5; uz = A.side * 0.9; el = 0.5; }
      if (dodge) { ux = 0.9; uz = A.side * 0.4; el = 1.2; }
      if (land) { ux = 0.3; uz = A.side * 0.6; el = 0.8; }
      set(A.upper, 'rotation', 'x', ux, R, dt);
      set(A.upper, 'rotation', 'z', uz, R, dt);
      set(A.elbow, 'rotation', 'x', el, R, dt);
    }
    // body
    const bob = st.grounded && sp > 0.2 ? Math.abs(Math.sin(cyc)) * 0.045 * amp - 0.03 * amp : 0;
    let hy = 0.95 + bob + Math.sin(st.t * 2) * 0.004;
    if (dodge) hy = 0.62; if (land) hy = 0.74;
    set(hips, 'position', 'y', hy, 20, dt);
    set(spine, 'rotation', 'x', -0.1 * amp - (dodge ? 0.6 : 0) - (land ? 0.35 : 0), 12, dt);
    set(spine, 'rotation', 'y', Math.sin(cyc) * 0.12 * amp, 12, dt);
    set(chest, 'rotation', 'x', Math.sin(st.t * 1.9) * 0.015, 8, dt);
    chest.scale.setScalar(1 + Math.sin(st.t * 1.9) * 0.008);
    // look-at (head turns toward a world target, clamped)
    let ly = 0, lp = 0;
    if (st.look) {
      head.getWorldPosition(_w);
      _v.copy(st.look).sub(_w);
      const inv = root.getWorldQuaternion(new THREE.Quaternion()).invert();
      _v.applyQuaternion(inv);
      ly = clamp(Math.atan2(-_v.x, -_v.z), -1.0, 1.0);
      lp = clamp(Math.atan2(_v.y, Math.hypot(_v.x, _v.z)), -0.4, 0.4);
    }
    set(head, 'rotation', 'y', ly, 6, dt);
    set(head, 'rotation', 'x', lp, 6, dt);
    // scarf tail trails with speed
    set(tailPivot, 'rotation', 'x', 0.15 + clamp(sp / 8, 0, 1) * 1.0 + Math.sin(st.t * 9) * 0.05 * amp + (air ? 0.5 : 0), 6, dt);
    set(tailPivot, 'rotation', 'z', Math.sin(st.t * 2.3) * 0.08, 6, dt);
  }

  return {
    object: root, height: 1.7, isPlaceholder: true,
    play(name) { if (['jump', 'land', 'dodge', 'hit', 'attack1', 'attack2', 'attack3', 'cast'].includes(name)) { st.one = name; st.oneT = 0; } },
    setLocomotion(speed, grounded, vy) { st.speed = speed; st.grounded = grounded; st.vy = vy; },
    update,
    lookAt(t) { st.look = t ? (st.look || new THREE.Vector3()).copy(t) : null; },
    setExpression() {},
  };
}
