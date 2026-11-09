// Festival bunting: catenary strings with triangular pennants in the town palette, one geometry for all
// strings (one draw call). Pennants sway around their string on the CPU (only the tip vertex moves).
import * as THREE from 'three';
import { createToonMaterial } from '../../render/toon.js';

const COLORS = ['#2b9c9a', '#e2b95b', '#d9573b', '#f1e6d0', '#3f63a6', '#e07a9a', '#5aa04a'].map((c) => new THREE.Color(c));

export function createBunting(group, strings, quality) {
  if (!strings.length) return null;
  const pos = [], nrm = [], col = [], idx = [];
  const flags = [];
  const rope = new THREE.Color('#4a3a30');
  const v = (p, n, c) => { pos.push(p.x, p.y, p.z); nrm.push(n.x, n.y, n.z); col.push(c.r, c.g, c.b); return pos.length / 3 - 1; };
  const step = quality === 'low' ? 0.75 : 0.55;
  let k = 0;
  for (const s of strings) {
    const A = new THREE.Vector3(...s.a), B = new THREE.Vector3(...s.b);
    const L = A.distanceTo(B);
    if (L < 2 || L > 40) continue;
    const sag = s.sag ?? Math.min(2.2, 0.35 + L * 0.06);
    const P = (t) => new THREE.Vector3().lerpVectors(A, B, t).add(new THREE.Vector3(0, -sag * 4 * t * (1 - t), 0));
    const n = Math.max(2, Math.round(L / step));
    const side = new THREE.Vector3().subVectors(B, A).setY(0).normalize();
    const across = new THREE.Vector3(-side.z, 0, side.x);
    // rope: thin vertical ribbon
    for (let i = 0; i < n; i++) {
      const p0 = P(i / n), p1 = P((i + 1) / n);
      const a = v(p0, across, rope), b = v(p1, across, rope);
      const c = v(p1.clone().add(new THREE.Vector3(0, 0.035, 0)), across, rope), d = v(p0.clone().add(new THREE.Vector3(0, 0.035, 0)), across, rope);
      idx.push(a, b, c, a, c, d);
    }
    const pal = (s.palette ?? k++) % COLORS.length;
    for (let i = 0; i < n; i++) {
      const t0 = (i + 0.12) / n, t1 = (i + 0.88) / n;
      const p0 = P(t0), p1 = P(t1);
      const mid = p0.clone().lerp(p1, 0.5);
      const len = Math.min(0.55, p0.distanceTo(p1) * 1.15);
      const c = COLORS[(pal + i) % COLORS.length];
      const tipBase = new THREE.Vector3(0, -len, 0);
      const ia = v(p0, across, c), ib = v(p1, across, c), it = v(mid.clone().add(tipBase), across, c);
      idx.push(ia, ib, it);
      flags.push({ ia, ib, it, mid, axis: p1.clone().sub(p0).normalize(), len, phase: (mid.x * 0.9 + mid.z * 0.7 + i * 0.37) % 6.28 });
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.setIndex(idx);
  geo.computeBoundingSphere();
  const mat = createToonMaterial({ kind: 'cloth', vertexColors: true, side: THREE.DoubleSide });
  mat.name = 'town_bunting';
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = quality !== 'low';
  mesh.receiveShadow = false;
  mesh.name = 'town_bunting';
  group.add(mesh);
  const P = geo.attributes.position.array, N = geo.attributes.normal.array;
  const q = new THREE.Quaternion(), tip = new THREE.Vector3(), e1 = new THREE.Vector3(), e2 = new THREE.Vector3();
  return {
    mesh,
    count: flags.length,
    update(time) {
      for (const f of flags) {
        const ang = 0.28 + Math.sin(time * 2.2 + f.phase) * 0.32 + Math.sin(time * 5.1 + f.phase * 2) * 0.06;
        q.setFromAxisAngle(f.axis, ang);
        tip.set(0, -f.len, 0).applyQuaternion(q).add(f.mid);
        P[f.it * 3] = tip.x; P[f.it * 3 + 1] = tip.y; P[f.it * 3 + 2] = tip.z;
        e1.set(P[f.ib * 3] - P[f.ia * 3], P[f.ib * 3 + 1] - P[f.ia * 3 + 1], P[f.ib * 3 + 2] - P[f.ia * 3 + 2]);
        e2.set(tip.x - P[f.ia * 3], tip.y - P[f.ia * 3 + 1], tip.z - P[f.ia * 3 + 2]);
        e1.cross(e2).normalize();
        for (const vi of [f.ia, f.ib, f.it]) { N[vi * 3] = e1.x; N[vi * 3 + 1] = e1.y; N[vi * 3 + 2] = e1.z; }
      }
      geo.attributes.position.needsUpdate = true;
      geo.attributes.normal.needsUpdate = true;
    },
  };
}
