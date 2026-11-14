// Choir Plaza set dressing: market ring, carts, flower beds, festival poles + bunting canopy, the
// Lantern Steps in front of the plaza view, vines on facades and street bunting between facing houses.
import * as THREE from 'three';
import { POI, heightAt } from '../../core/layout.js';
import { pieces, add, tints, addLamp, makePiece, paintGeometry, stripedGeometry, composeM as M, houseClear } from './props.js';

const UP = new THREE.Vector3(0, 1, 0);
const deg = (d) => (d * Math.PI) / 180;

function flowerCard(w, h, quad, x, y, z, rot) {
  const g = new THREE.PlaneGeometry(w, h);
  const [u0, v0] = [[0, 0.5], [0.5, 0.5], [0, 0], [0.5, 0]][quad];
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, u0 + uv.getX(i) * 0.5, v0 + uv.getY(i) * 0.5);
  return { mat: 'flowers', geo: paintGeometry(g, 0xffffff), matrix: M(x, y + h / 2, z, 0, rot) };
}

let EXTRA = null;
function extraPieces() {
  if (EXTRA) return EXTRA;
  const P = pieces();
  P.pole = makePiece([
    { mat: 'stone', geo: new THREE.CylinderGeometry(0.42, 0.5, 0.45, 6), matrix: M(0, 0.22, 0) },
    { mat: 'timber', geo: new THREE.CylinderGeometry(0.07, 0.1, 6.0, 8), matrix: M(0, 3.2, 0) },
    { mat: 'gold', geo: new THREE.CylinderGeometry(0.2, 0.2, 0.12, 6), matrix: M(0, 6.25, 0) },
    { mat: 'gold', geo: new THREE.ConeGeometry(0.11, 0.55, 6), matrix: M(0, 6.55, 0) },
    { mat: 'cloth', geo: stripedGeometry(paintGeometry(new THREE.CylinderGeometry(0.11, 0.11, 0.8, 8, 1, true), 0xffffff), 0x2b9c9a, 0xf1e6d0, 0.2), matrix: M(0, 4.6, 0) },
  ]);
  const bed = [
    { mat: 'stone', geo: new THREE.BoxGeometry(1.9, 0.42, 0.9), matrix: M(0, 0.21, 0) },
    { mat: 'leaf', geo: paintGeometry(new THREE.BoxGeometry(1.7, 0.08, 0.7), 0x4f7a34), matrix: M(0, 0.43, 0) },
  ];
  for (let i = 0; i < 4; i++) {
    const x = -0.65 + i * 0.43, qd = (i * 3 + 1) % 4;
    bed.push(flowerCard(0.62, 0.55, qd, x, 0.42, 0, 0.6), flowerCard(0.62, 0.55, (qd + 1) % 4, x, 0.42, 0, -0.7));
  }
  P.flowerbed = makePiece(bed);
  const pot = [
    { mat: 'stone', geo: paintGeometry(new THREE.CylinderGeometry(0.34, 0.24, 0.5, 10), 0xd9825a), matrix: M(0, 0.25, 0) },
    { mat: 'stone', geo: paintGeometry(new THREE.CylinderGeometry(0.38, 0.38, 0.08, 10), 0xc8704a), matrix: M(0, 0.5, 0) },
  ];
  pot.push(flowerCard(0.8, 0.7, 0, 0, 0.45, 0, 0.3), flowerCard(0.8, 0.7, 3, 0, 0.45, 0, 1.9));
  P.potflowers = makePiece(pot);
  P.topiary = makePiece([
    { mat: 'stone', geo: new THREE.BoxGeometry(0.75, 0.6, 0.75), matrix: M(0, 0.3, 0) },
    { mat: 'stone', geo: new THREE.BoxGeometry(0.85, 0.08, 0.85), matrix: M(0, 0.62, 0) },
    { mat: 'timber', geo: new THREE.CylinderGeometry(0.05, 0.06, 0.7, 6), matrix: M(0, 0.95, 0) },
    { mat: 'leaf', geo: paintGeometry(new THREE.IcosahedronGeometry(0.62, 1), 0x5e9e42), matrix: M(0, 1.6, 0) },
    { mat: 'leaf', geo: paintGeometry(new THREE.IcosahedronGeometry(0.38, 1), 0x6fb04c), matrix: M(0.25, 1.95, 0.1) },
  ]);
  EXTRA = P;
  return P;
}

const mat4 = (x, y, z, yaw, s = 1) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromAxisAngle(UP, yaw), new THREE.Vector3(s, s, s));

export function dressPlaza(ctx, plan, piece, batch, dyn) {
  extraPieces();
  const R = plan.rng;
  const { x: cx, z: cz, y: py } = POI.plaza;
  const Y = py + 0.04;
  const low = ctx.quality.name === 'low';
  const pol = (r, a) => [cx + r * Math.cos(a), cz + r * Math.sin(a)];
  const faceC = (a) => Math.atan2(-Math.cos(a), -Math.sin(a));   // local +Z towards the centre
  const q = (n) => piece('q:' + n);
  dyn.bunting ||= [];
  let count = 0;

  // ---------- festival poles around the fountain + bunting canopy
  const poles = [];
  for (let k = 0; k < 6; k++) {
    const a = deg(30 + 60 * k);
    const [x, z] = pol(9.6, a);
    add(batch, 'pole', x, Y, z, a, tints(R));
    poles.push({ a, top: [x, Y + 6.1, z] });
    ctx.colliders.push({ kind: 'box', center: [x, Y + 1, z], half: [0.4, 1, 0.4], rotationY: 0 });
  }
  for (let k = 0; k < 6; k++) dyn.bunting.push({ a: poles[k].top, b: poles[(k + 1) % 6].top, sag: 0.9, palette: k });
  const ring = plan.houses.filter((h) => h.street === 'plaza');
  const facade = (h, up = 1.5) => {
    const c = Math.cos(h.yaw), s = Math.sin(h.yaw), f = Math.max(0, h.def.J || 0) + 0.25;
    return [h.x + s * f, h.floorY + h.def.g + up, h.z + c * f];
  };
  for (const p of poles) {
    const cand = ring.map((h) => ({ h, d: Math.abs(((Math.atan2(h.z - cz, h.x - cx) - p.a + Math.PI * 3) % (Math.PI * 2)) - Math.PI) }))
      .filter((c) => c.d < 0.5).sort((a, b) => a.d - b.d).slice(0, 2);
    for (const c of cand) dyn.bunting.push({ a: p.top, b: facade(c.h, 1.8), palette: Math.floor(R() * 7) });
  }
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i], b = ring[(i + 2) % ring.length];
    const A = facade(a, 1.2), B = facade(b, 1.2);
    const d = Math.hypot(A[0] - B[0], A[2] - B[2]);
    if (d > 6 && d < 22 && R() < 0.6) dyn.bunting.push({ a: A, b: B, palette: i });
  }

  // ---------- market ring (stalls face the fountain) with wares, carts and flowers
  const stallAngles = [-166, -112, -92, -70, -30, 24, 118, 138, 158];
  for (const ad of stallAngles) {
    const a = deg(ad);
    const [x, z] = pol(18.4, a);
    if (!houseClear(plan, x, z, 1.2)) continue;
    add(batch, 'stall', x, Y, z, faceC(a), tints(R), 1.0);
    ctx.colliders.push({ kind: 'box', center: [x, Y + 1.2, z], half: [1.5, 1.2, 0.7], rotationY: faceC(a) });
    count++;
    for (const side of [-1, 1]) {
      const at = a + side * (2.3 / 18.4);
      const [px, pz] = pol(18.6 + R() * 0.6, at);
      const roll = R();
      if (roll < 0.3 && q('Prop_Crate')) {
        batch.add(q('Prop_Crate'), mat4(px, Y, pz, R() * 6.28, 0.7));
        if (R() < 0.6) batch.add(q('Prop_Crate'), mat4(px, Y + 0.74, pz, R() * 6.28, 0.6));
      } else if (roll < 0.5) add(batch, 'barrel', px, Y, pz, R() * 6.28, tints(R));
      else if (roll < 0.7) add(batch, 'potflowers', px, Y, pz, R() * 6.28, {});
      else if (roll < 0.85) add(batch, 'sack', px, Y, pz, R() * 6.28, tints(R));
      else add(batch, 'flowerbed', px, Y, pz, faceC(at), {});
      count++;
    }
  }
  for (const [ad, r] of [[-128, 15.5], [140, 14.8], [8, 16.5]]) {
    const a = deg(ad);
    const [x, z] = pol(r, a);
    if (!q('Prop_Wagon') || !houseClear(plan, x, z, 2)) continue;
    const yaw = faceC(a) + Math.PI / 2 + 0.25;
    batch.add(q('Prop_Wagon'), mat4(x, Y, z, yaw, 1.0));
    ctx.colliders.push({ kind: 'box', center: [x, Y + 0.8, z], half: [1.0, 0.8, 2.0], rotationY: yaw });
    const c = Math.cos(yaw), s = Math.sin(yaw);
    for (const lz of [-0.4, -1.4]) add(batch, R() < 0.5 ? 'sack' : 'barrel', x + lz * s, Y + 0.72, z + lz * c, R() * 6.28, tints(R), 0.85);
    count++;
  }
  for (let k = 0; k < 6; k++) {
    if (Math.abs(((60 * k - 64 + 540) % 360) - 180) < 22) continue;
    const a = deg(60 * k);
    const [x, z] = pol(7.9, a);
    add(batch, k % 2 ? 'topiary' : 'flowerbed', x, Y, z, faceC(a), {});
    count++;
  }
  for (const ad of [0, 120, 180, -60, -120]) {
    const a = deg(ad);
    const [x, z] = pol(12.2, a);
    add(batch, 'bench', x, Y, z, faceC(a) + Math.PI, tints(R));
    count++;
  }
  for (const h of ring) {
    const c = Math.cos(h.yaw), s = Math.sin(h.yaw);
    for (const lx of [-h.def.W / 2 + 0.9, h.def.W / 2 - 0.9]) {
      if (R() < 0.45) continue;
      const lz = 1.1;
      const x = h.x + lx * c + lz * s, z = h.z - lx * s + lz * c;
      if (Math.hypot(x - cx, z - cz) > POI.plaza.r - 0.6) continue;
      add(batch, R() < 0.5 ? 'potflowers' : 'flowerbed', x, Y, z, h.yaw, {});
      count++;
    }
  }

  // ---------- Lantern Steps
  const sector = { cx, cz, y0: py + 0.04, a0: deg(37), a1: deg(79), r0: POI.plaza.r - 0.1, r1: 41 };
  for (const [a, r] of [[sector.a0 + 0.05, 25], [sector.a1 - 0.05, 25], [sector.a0 + 0.04, 36], [sector.a1 - 0.03, 36]]) {
    const [x, z] = pol(r, a);
    addLamp(ctx, plan, batch, dyn, x, z, a + Math.PI, R, Math.max(heightAt(x, z), py) + 0.5);
  }
  for (const r of [28, 31.5, 34]) {
    for (const a of [sector.a0 + 0.035, sector.a1 - 0.03]) {
      if (R() < 0.3) continue;
      const [x, z] = pol(r, a);
      add(batch, 'potflowers', x, Math.max(heightAt(x, z), py) + 0.5, z, R() * 6.28, {});
    }
  }

  // ---------- vines on plaza / main street / market facades (CC0 Quaternius)
  const vines = ['Prop_Vine1', 'Prop_Vine2'].map(q).filter(Boolean);
  if (vines.length && !plan.cc0Houses) {
    for (const h of plan.houses) {
      if (!(h.street === 'plaza' || h.street === 'main' || h.street === 'market') || R() < 0.45) continue;
      const c = Math.cos(h.yaw), s = Math.sin(h.yaw);
      const lx = (R() - 0.5) * (h.def.W - 2.2);
      const top = h.floorY + h.def.g + h.def.f * h.def.U - 0.35;
      const lz = Math.max(0, h.def.J || 0) * h.def.U + 0.1;
      batch.add(vines[Math.floor(R() * vines.length)], mat4(h.x + lx * c + lz * s, top, h.z - lx * s + lz * c, h.yaw, 1.2 + R() * 0.5));
    }
  }

  // ---------- CC0 kit balconies (wood floor + cross railing + braces) on first floors facing the plaza / main street
  const rail = q('Balcony_Cross_Straight'), floor = q('Floor_WoodDark'), brace = q('Prop_Support');
  if (rail && floor && !plan.cc0Houses) {
    for (const h of plan.houses) {
      if (!(h.street === 'plaza' || h.street === 'main') || h.def.U < 1 || R() < 0.5) continue;
      const n = Math.max(1, Math.floor((h.def.W - 0.8) / 1.75));
      if (n < 2) continue;
      const avail = h.def.W - 1.3;
      const i = R() < 0.5 ? 0 : n - 1;
      const lx = -h.def.W / 2 + 0.65 + avail * (i + 0.5) / n;
      const J = Math.max(0, h.def.J || 0);
      const c = Math.cos(h.yaw), s = Math.sin(h.yaw);
      const wx = (lx2, lz2) => [h.x + lx2 * c + lz2 * s, h.z - lx2 * s + lz2 * c];
      const y = h.floorY + h.def.g + 0.02;
      let [x, z] = wx(lx, J + 0.5);
      const mf = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromAxisAngle(UP, h.yaw), new THREE.Vector3(0.62, 1, 0.5));
      batch.add(floor, mf);
      [x, z] = wx(lx, J - 0.02);
      batch.add(rail, new THREE.Matrix4().compose(new THREE.Vector3(x, y + 0.02, z), new THREE.Quaternion().setFromAxisAngle(UP, h.yaw), new THREE.Vector3(0.62, 0.95, 1)));
      if (brace) for (const sx of [-0.5, 0.5]) {
        [x, z] = wx(lx + sx, J);
        batch.add(brace, new THREE.Matrix4().compose(new THREE.Vector3(x, y - 1.5, z), new THREE.Quaternion().setFromAxisAngle(UP, h.yaw), new THREE.Vector3(0.5, 0.5, 0.5)));
      }
      count++;
    }
  }

  // ---------- street bunting between facing houses
  let strings = 0;
  const byStreet = new Map();
  for (const h of plan.houses) { if (h.street === 'plaza') continue; if (!byStreet.has(h.street)) byStreet.set(h.street, []); byStreet.get(h.street).push(h); }
  const maxStrings = low ? 40 : 90;
  for (const [name, list] of byStreet) {
    const st = plan.streets.find((s) => s.name === name);
    if (!st || st.kind === 'grand') continue;
    for (let i = 0; i < list.length && strings < maxStrings; i++) {
      const h = list[i];
      if (R() < 0.35) continue;
      let best = null, bd = Infinity;
      for (const o of list) {
        if (o === h) continue;
        const dot = Math.sin(h.yaw) * Math.sin(o.yaw) + Math.cos(h.yaw) * Math.cos(o.yaw);
        if (dot > -0.7) continue;
        const d = Math.hypot(o.x - h.x, o.z - h.z);
        if (d < bd && d > st.w * 0.8 && d < st.w + 9) { bd = d; best = o; }
      }
      if (!best || best._bunt) continue;
      best._bunt = true;
      const up = 1.4 + R() * 0.8;
      dyn.bunting.push({ a: facade(h, up), b: facade(best, up), palette: strings });
      strings++;
    }
  }
  // ---------- gate square market (right half of the street view)
  for (const [x, z, yaw] of [[-40.5, 14.5, -2.2], [-44.5, 19.5, -2.8], [-54, 21, 2.9]]) {
    if (!houseClear(plan, x, z, 1.0)) continue;
    const y = heightAt(x, z) + 0.16;
    add(batch, 'stall', x, y, z, yaw, tints(R), 1.0);
    ctx.colliders.push({ kind: 'box', center: [x, y + 1.2, z], half: [1.5, 1.2, 0.7], rotationY: yaw });
    for (const side of [-1, 1]) {
      const px = x + Math.cos(yaw) * side * 2.1, pz = z - Math.sin(yaw) * side * 2.1;
      const r = R();
      if (r < 0.35 && q('Prop_Crate')) batch.add(q('Prop_Crate'), mat4(px, heightAt(px, pz) + 0.16, pz, R() * 6.28, 0.72));
      else add(batch, r < 0.6 ? 'barrel' : (r < 0.8 ? 'potflowers' : 'sack'), px, heightAt(px, pz) + 0.16, pz, R() * 6.28, tints(R));
    }
  }
  if (q('Prop_Wagon')) {
    const x = -37.5, z = 18.5, y = heightAt(x, z) + 0.16;
    if (houseClear(plan, x, z, 1.5)) batch.add(q('Prop_Wagon'), mat4(x, y, z, 2.6, 1.0));
  }
  for (const [x, z] of [[-43, 8.2], [-38.5, 9.5], [-58, 8], [-57.5, 18]]) add(batch, 'flowerbed', x, heightAt(x, z) + 0.16, z, Math.atan2(-50 - x, 13 - z), {});
  return { plazaProps: count, streetBunting: strings, sector };
}
