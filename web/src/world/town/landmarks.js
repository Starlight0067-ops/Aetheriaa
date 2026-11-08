// Places the landmark kit: wall ring (sheared segments on the slope), towers, gates, viaduct,
// Concord Hall, Choir fountain, windmills and the hall terrace balustrade.
import * as THREE from 'three';
import { POI, STREETS, heightAt } from '../../core/layout.js';

const UP = new THREE.Vector3(0, 1, 0);

export function matrixFor(x, y, z, yaw, sx = 1, sy = 1, sz = 1, shear = 0) {
  const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromAxisAngle(UP, yaw), new THREE.Vector3(1, 1, 1));
  if (shear) m.multiply(new THREE.Matrix4().set(1, 0, 0, 0, shear, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1));
  if (sx !== 1 || sy !== 1 || sz !== 1) m.multiply(new THREE.Matrix4().makeScale(sx, sy, sz));
  return m;
}

/** Build a standalone (animated) object from a kit piece: one mesh per material. */
export function pieceObject(piece, mats) {
  const g = new THREE.Group();
  for (const [mat, geo] of piece.parts) {
    const m = new THREE.Mesh(geo, mats[mat] || mats.stone);
    m.castShadow = true; m.receiveShadow = true;
    g.add(m);
  }
  return g;
}

export function placeLandmarks(ctx, plan, piece, batch, dyn, group) {
  const R = plan.rng;
  const mats = batch.mats || ctx.systems.world?.town?.materials || null;
  // ---------------- wall ring
  for (const s of plan.segs) {
    const mx = (s.a[0] + s.b[0]) / 2, mz = (s.a[1] + s.b[1]) / 2;
    const yaw = Math.atan2(s.ox, s.oz);
    const lx = [Math.cos(yaw), -Math.sin(yaw)];
    const sgn = Math.sign((s.b[0] - mx) * lx[0] + (s.b[1] - mz) * lx[1]) || 1;
    const k = ((s.yb - s.ya) / s.L) * sgn;
    const base = (s.ya + s.yb) / 2 - 0.15;
    const p = piece(R() < 0.22 ? 'wall_seg_ivy' : 'wall_seg') || piece('wall_seg');
    batch.add(p, matrixFor(mx, base, mz, yaw, (s.L + 0.15) / 8, 1, 1, k));
    ctx.colliders.push({ kind: 'box', center: [mx, base + 2.5, mz], half: [s.L / 2, 6 + Math.abs(s.yb - s.ya) / 2, 1.5], rotationY: yaw });
  }
  for (const t of plan.towers) {
    batch.add(piece(t.tall ? 'tower' : 'tower_flat') || piece('tower'), matrixFor(t.x, t.y, t.z, R() * 6.28));
    ctx.colliders.push({ kind: 'box', center: [t.x, t.y + 7, t.z], half: [3.9, 9, 3.9], rotationY: 0 });
    dyn.flags?.push({ x: t.x, y: t.y + (t.tall ? 23.5 : 14.5), z: t.z });
  }
  // ---------------- gates
  for (const g of plan.gates) {
    const y = g.name === 'west' ? POI.westGate.y : g.y;
    batch.add(piece('gate'), matrixFor(g.x, y, g.z, g.yaw));
    const c = Math.cos(g.yaw), s = Math.sin(g.yaw);
    // side blocks + towers, passage left open
    for (const side of [-1, 1]) {
      const ox = side * 6.2;
      ctx.colliders.push({ kind: 'box', center: [g.x + ox * c, y + 8, g.z - ox * s], half: [3.8, 9, 5], rotationY: g.yaw });
    }
    // banners on the gate front (local +Z is outward)
    for (const side of [-1, 1]) {
      const lx = side * 3.6, lz = 4.95;
      dyn.banners.push({ x: g.x + lx * c + lz * s, y: y + 12.0, z: g.z - lx * s + lz * c, yaw: g.yaw, w: 1.5, h: 5.2, kind: 'gate' });
    }
  }
  // ---------------- bridge
  {
    const B = POI.bridge;
    batch.add(piece('bridge'), matrixFor(B.x0, B.deckY, B.z, 0, (B.x1 - B.x0) / 70, 1, 1));
    const cx = (B.x0 + B.x1) / 2, L = (B.x1 - B.x0) / 2 + 6;
    ctx.colliders.push({ kind: 'box', center: [cx, B.deckY - 0.6, B.z], half: [L, 0.6, 4.0], rotationY: 0 });
    for (const side of [-1, 1]) ctx.colliders.push({ kind: 'box', center: [cx, B.deckY + 0.6, B.z + side * 3.75], half: [L, 0.7, 0.25], rotationY: 0 });
  }
  // ---------------- Concord Hall + terrace balustrade
  {
    const H = POI.hall;
    const end = STREETS.hallStairs[2];
    const yaw = Math.atan2(end[0] - H.x, end[1] - H.z);
    batch.add(piece('hall'), matrixFor(H.x, H.y - 0.35, H.z, yaw));
    const c = Math.cos(yaw), s = Math.sin(yaw);
    const loc = (lx, lz) => [H.x + lx * c + lz * s, H.z - lx * s + lz * c];
    let p = loc(0, -2); ctx.colliders.push({ kind: 'box', center: [p[0], H.y + 6, p[1]], half: [11.5, 7, 6.5], rotationY: yaw });
    p = loc(0, -10.5); ctx.colliders.push({ kind: 'box', center: [p[0], H.y + 15, p[1]], half: [7, 16, 7], rotationY: yaw });
    for (const side of [-1, 1]) {
      const q = loc(side * 4.6, 8.4);
      dyn.banners.push({ x: q[0], y: H.y + 9.6, z: q[1], yaw, w: 1.6, h: 5.5, kind: 'hall' });
    }
    // balustrade ring
    const rr = 28.5, n = Math.round((2 * Math.PI * rr) / 6);
    const stairA = Math.atan2(end[1] - H.z, end[0] - H.x);
    for (let i = 0; i < n; i++) {
      const a = (i + 0.5) / n * Math.PI * 2;
      let d = Math.abs(((a - stairA + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
      if (d < 0.2) continue;
      const x = H.x + rr * Math.cos(a), z = H.z + rr * Math.sin(a);
      const yawB = Math.atan2(Math.cos(a), Math.sin(a));
      batch.add(piece('balustrade'), matrixFor(x, H.y + 0.05, z, yawB, (2 * Math.PI * rr / n) / 6 * 1.01));
    }
  }
  // ---------------- fountain + crystal
  {
    const P = POI.plaza;
    batch.add(piece('fountain'), matrixFor(P.x, P.y + 0.02, P.z, 0));
    ctx.colliders.push({ kind: 'box', center: [P.x, P.y + 1, P.z], half: [5.4, 1.2, 5.4], rotationY: 0 });
    const cr = piece('crystal');
    if (cr && mats) {
      const o = pieceObject(cr, mats);
      o.position.set(P.x, P.y + 5.75, P.z);
      group.add(o);
      dyn.spinners.push({ obj: o, axis: 'y', speed: 0.45, bob: 0.12, baseY: o.position.y });
    }
  }
  // ---------------- windmills
  for (const w of POI.windmills) {
    const y = heightAt(w.x, w.z) - 0.3;
    const yaw = Math.atan2(POI.plaza.x - w.x, POI.plaza.z - w.z) + 0.5;
    batch.add(piece('windmill'), matrixFor(w.x, y, w.z, yaw));
    ctx.colliders.push({ kind: 'box', center: [w.x, y + 6, w.z], half: [3.4, 7, 3.4], rotationY: yaw });
    const sp = piece('sails');
    if (sp && mats) {
      const pivot = new THREE.Group();
      const o = pieceObject(sp, mats);
      pivot.add(o);
      const c = Math.cos(yaw), s = Math.sin(yaw);
      const lz = 3.6, ly = 12.55;
      pivot.position.set(w.x + lz * s, y + ly, w.z + lz * c);
      pivot.rotation.y = yaw;
      group.add(pivot);
      dyn.spinners.push({ obj: o, axis: 'z', speed: 0.55 + R() * 0.2 });
    }
  }
}
