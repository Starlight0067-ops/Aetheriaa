// Vael Harrow street furniture, market props and small set dressing.
//
// The town kit only ships the buildings and landmarks; these pieces are built here from
// primitives so the streets read as a lived-in town without another Blender export.
// Everything static goes through the same StaticBatcher as the kit pieces (one draw call per
// material); animated bits (lantern glows, flags, banners) are registered on `dyn` and built by
// dynamic.js. Placements are deterministic through plan.rng.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { POI, heightAt, distToPolyline } from '../../core/layout.js';
import { normalizeGeometry } from './batch.js';
import { PALETTE } from './materials.js';
import { sampleAt, polyLength } from './plan.js';

const UP = new THREE.Vector3(0, 1, 0);
const ONE = new THREE.Vector3(1, 1, 1);

/** Compose a local transform. */
function M(x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
  return new THREE.Matrix4().compose(
    new THREE.Vector3(x, y, z),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)),
    new THREE.Vector3(sx, sy, sz),
  );
}

/** Bake a per-vertex colour into a geometry so vertex-coloured toon materials can tint it. */
function paintGeometry(geo, color) {
  const n = geo.attributes.position.count;
  const c = new THREE.Color(color);
  const a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
  geo.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return geo;
}

/** Striped canopy geometry: alternating bolts of cloth across local X. */
function stripedGeometry(geo, a, b, stripe = 0.4) {
  const pos = geo.attributes.position;
  const ca = new THREE.Color(a), cb = new THREE.Color(b);
  const out = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const c = Math.floor((pos.getX(i) + 2.0) / stripe) % 2 === 0 ? ca : cb;
    out[i * 3] = c.r; out[i * 3 + 1] = c.g; out[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(out, 3));
  return geo;
}

/** Merge primitive parts into the { parts: Map(mat -> geometry), box } kit-piece shape. */
function makePiece(defs) {
  const parts = new Map();
  for (const d of defs) {
    const g = normalizeGeometry(d.geo, d.matrix || null);
    if (parts.has(d.mat)) parts.set(d.mat, mergeGeometries([parts.get(d.mat), g]));
    else parts.set(d.mat, g);
  }
  const box = new THREE.Box3();
  for (const g of parts.values()) { g.computeBoundingBox(); box.union(g.boundingBox); }
  return { parts, box };
}

// ------------------------------------------------------------------ kit pieces
function buildPieces() {
  const P = {};

  P.barrel = makePiece([
    { mat: 'planks', geo: new THREE.CylinderGeometry(0.30, 0.24, 0.78, 10, 1), matrix: M(0, 0.39, 0) },
    { mat: 'metal', geo: new THREE.CylinderGeometry(0.305, 0.305, 0.055, 10, 1, true), matrix: M(0, 0.16, 0) },
    { mat: 'metal', geo: new THREE.CylinderGeometry(0.295, 0.295, 0.055, 10, 1, true), matrix: M(0, 0.62, 0) },
    { mat: 'planks', geo: new THREE.CylinderGeometry(0.24, 0.24, 0.05, 10, 1), matrix: M(0, 0.79, 0) },
  ]);

  const S = 0.66;
  const crate = [
    { mat: 'planks', geo: new THREE.BoxGeometry(S, 0.60, S), matrix: M(0, 0.31, 0) },
  ];
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    crate.push({ mat: 'timber', geo: new THREE.BoxGeometry(0.07, 0.64, 0.07), matrix: M(sx * (S / 2 - 0.035), 0.32, sz * (S / 2 - 0.035)) });
  }
  for (const y of [0.10, 0.50]) {
    crate.push({ mat: 'timber', geo: new THREE.BoxGeometry(S + 0.03, 0.055, 0.055), matrix: M(0, y, S / 2) });
    crate.push({ mat: 'timber', geo: new THREE.BoxGeometry(S + 0.03, 0.055, 0.055), matrix: M(0, y, -S / 2) });
    crate.push({ mat: 'timber', geo: new THREE.BoxGeometry(0.055, 0.055, S + 0.03), matrix: M(S / 2, y, 0) });
    crate.push({ mat: 'timber', geo: new THREE.BoxGeometry(0.055, 0.055, S + 0.03), matrix: M(-S / 2, y, 0) });
  }
  P.crate = makePiece(crate);

  P.bench = makePiece([
    { mat: 'planks', geo: new THREE.BoxGeometry(1.7, 0.09, 0.44), matrix: M(0, 0.46, 0) },
    { mat: 'planks', geo: new THREE.BoxGeometry(1.7, 0.46, 0.07), matrix: M(0, 0.72, -0.20, -0.10) },
    ...[-0.68, 0.68].flatMap((x) => [-0.14, 0.14].map((z) => (
      { mat: 'metal', geo: new THREE.BoxGeometry(0.07, 0.46, 0.07), matrix: M(x, 0.23, z) }
    ))),
  ]);

  // Iron lantern: post + arm + cage + emissive core. The core position is mirrored in addLamp().
  const lamp = [
    { mat: 'metal', geo: new THREE.CylinderGeometry(0.24, 0.30, 0.18, 8), matrix: M(0, 0.09, 0) },
    { mat: 'metal', geo: new THREE.CylinderGeometry(0.055, 0.075, 3.12, 7), matrix: M(0, 1.64, 0) },
    { mat: 'metal', geo: new THREE.BoxGeometry(0.72, 0.055, 0.055), matrix: M(0.32, 3.16, 0) },
    { mat: 'metal', geo: new THREE.CylinderGeometry(0.025, 0.025, 0.16, 5), matrix: M(0.62, 3.06, 0) },
    { mat: 'glow', geo: new THREE.BoxGeometry(0.17, 0.30, 0.17), matrix: M(0.62, 2.83, 0) },
  ];
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    lamp.push({ mat: 'metal', geo: new THREE.BoxGeometry(0.035, 0.40, 0.035), matrix: M(0.62 + sx * 0.105, 2.84, sz * 0.105) });
  }
  for (const y of [2.64, 3.04]) {
    lamp.push({ mat: 'metal', geo: new THREE.BoxGeometry(0.26, 0.035, 0.26), matrix: M(0.62, y, 0) });
  }
  lamp.push({ mat: 'metal', geo: new THREE.ConeGeometry(0.23, 0.16, 4), matrix: M(0.62, 3.13, 0, 0, Math.PI / 4) });
  P.lamp = makePiece(lamp);

  // Market stall: painted counter, four posts, striped awning, small sign.
  const canopy = paintGeometry(new THREE.BoxGeometry(3.0, 0.07, 1.35), 0xffffff);
  stripedGeometry(canopy, 0x2b9c9a, 0xf1e6d0, 0.38);
  P.stall = makePiece([
    { mat: 'planks', geo: new THREE.BoxGeometry(2.6, 0.86, 0.82), matrix: M(0, 0.46, 0) },
    { mat: 'paint', geo: new THREE.BoxGeometry(2.62, 0.62, 0.06), matrix: M(0, 0.48, 0.44) },
    { mat: 'planks', geo: new THREE.BoxGeometry(2.82, 0.09, 0.94), matrix: M(0, 0.94, 0) },
    ...[-1.24, 1.24].flatMap((x) => [-0.42, 0.42].map((z) => (
      { mat: 'timber', geo: new THREE.BoxGeometry(0.08, 2.44, 0.08), matrix: M(x, 1.22, z) }
    ))),
    { mat: 'cloth', geo: canopy, matrix: M(0, 2.40, 0, 0.06) },
    { mat: 'cloth', geo: paintGeometry(new THREE.BoxGeometry(3.0, 0.22, 0.04), 0xf1e6d0), matrix: M(0, 2.28, 0.67) },
    { mat: 'planks', geo: new THREE.BoxGeometry(0.9, 0.38, 0.05), matrix: M(0, 1.98, 0.66) },
    { mat: 'gold', geo: new THREE.BoxGeometry(0.96, 0.05, 0.06), matrix: M(0, 2.19, 0.66) },
    { mat: 'gold', geo: new THREE.BoxGeometry(0.96, 0.05, 0.06), matrix: M(0, 1.77, 0.66) },
  ]);
  // a few wares on the counter
  for (const [x, z, s] of [[-0.85, -0.05, 0.15], [-0.55, 0.10, 0.12], [0.15, -0.08, 0.16], [0.55, 0.06, 0.12], [0.88, -0.02, 0.14]]) {
    P.stall.parts.set('leaf', mergeGeometries([P.stall.parts.get('leaf'), normalizeGeometry(new THREE.SphereGeometry(s, 7, 5), M(x, 1.06, z))].filter(Boolean)));
  }

  // Hand cart.
  const cart = [
    { mat: 'planks', geo: new THREE.BoxGeometry(1.9, 0.20, 1.02), matrix: M(0, 0.60, 0) },
    { mat: 'planks', geo: new THREE.BoxGeometry(1.9, 0.36, 0.06), matrix: M(0, 0.80, 0.50) },
    { mat: 'planks', geo: new THREE.BoxGeometry(1.9, 0.36, 0.06), matrix: M(0, 0.80, -0.50) },
    { mat: 'timber', geo: new THREE.BoxGeometry(0.06, 0.36, 1.0), matrix: M(-0.95, 0.80, 0) },
    { mat: 'timber', geo: new THREE.BoxGeometry(0.06, 0.36, 1.0), matrix: M(0.95, 0.80, 0) },
    { mat: 'timber', geo: new THREE.BoxGeometry(0.09, 0.09, 1.08), matrix: M(0, 0.42, 0) },
  ];
  for (const x of [-0.78, 0.78]) for (const z of [-0.54, 0.54]) {
    cart.push({ mat: 'timber', geo: new THREE.TorusGeometry(0.38, 0.065, 6, 12), matrix: M(x, 0.40, z, 0, Math.PI / 2) });
    for (let k = 0; k < 3; k++) {
      cart.push({ mat: 'timber', geo: new THREE.BoxGeometry(0.74, 0.035, 0.035), matrix: M(x, 0.40, z, 0, Math.PI / 2, k * Math.PI / 3) });
    }
  }
  for (const x of [-0.72, 0.72]) {
    cart.push({ mat: 'timber', geo: new THREE.CylinderGeometry(0.035, 0.045, 1.15, 5), matrix: M(x, 0.66, -1.02, 1.15, 0, 0) });
  }
  P.cart = makePiece(cart);

  P.planter = makePiece([
    { mat: 'planks', geo: new THREE.BoxGeometry(0.92, 0.30, 0.34), matrix: M(0, 0.22, 0) },
    { mat: 'timber', geo: new THREE.BoxGeometry(0.80, 0.05, 0.24), matrix: M(0, 0.40, 0) },
    ...[[-0.28, 0, 0.12], [0, 0.04, 0.16], [0.27, -0.02, 0.12], [-0.12, 0.04, 0.09], [0.14, 0.06, 0.10]].map(([x, z, s]) => (
      { mat: 'leaf', geo: paintGeometry(new THREE.IcosahedronGeometry(s, 1), 0x6fae48), matrix: M(x, 0.51 + s * 0.3, z) }
    )),
  ]);

  P.sack = makePiece([
    { mat: 'cloth', geo: new THREE.CylinderGeometry(0.16, 0.26, 0.48, 7), matrix: M(0, 0.24, 0) },
    { mat: 'cloth', geo: new THREE.SphereGeometry(0.17, 7, 5), matrix: M(0, 0.50, 0, 0, 0, 0, 1, 0.7, 1) },
    { mat: 'gold', geo: new THREE.TorusGeometry(0.12, 0.018, 4, 8), matrix: M(0, 0.43, 0, Math.PI / 2) },
  ]);

  return P;
}

let CACHE = null;
const pieces = () => (CACHE ||= buildPieces());

// ------------------------------------------------------------------ placement helpers
const pick = (arr, R) => arr[Math.floor(R() * arr.length) % arr.length];

function tints(R) {
  return {
    planks: pick(PALETTE.timber, R),
    timber: pick(PALETTE.timber, R),
    paint: pick(PALETTE.paint, R),
    cloth: 0xffffff,
    metal: 0xffffff,
    glow: 0xffffff,
    gold: 0xffffff,
    leaf: 0xffffff,
  };
}

function add(batch, name, x, y, z, yaw, tint, scale = 1) {
  const q = new THREE.Quaternion().setFromAxisAngle(UP, yaw);
  const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(scale, scale, scale));
  batch.add(pieces()[name], m, tint);
}

function streetClearance(plan, x, z) {
  let d = Infinity;
  for (const st of plan.streets) d = Math.min(d, distToPolyline(x, z, st.pts) - st.w / 2);
  return d;
}

/** True when (x,z) is outside every house footprint (with a little margin). */
function houseClear(plan, x, z, margin = 0.7) {
  for (const h of plan.houses) {
    const c = Math.cos(h.yaw), s = Math.sin(h.yaw);
    const dx = x - h.x, dz = z - h.z;
    const lx = dx * c - dz * s;
    const lz = dx * s + dz * c;
    if (Math.abs(lx) < h.def.W / 2 + margin && lz > -(h.def.D + margin) && lz < margin) return false;
  }
  return true;
}

function goodSpot(plan, x, z, clearance = 0.25) {
  return streetClearance(plan, x, z) > clearance && houseClear(plan, x, z) && heightAt(x, z) > 7.2;
}

/** Add a lamp post and register its glowing head for dynamic.js. */
function addLamp(ctx, plan, batch, dyn, x, z, yaw, R, y = null) {
  const gy = y ?? heightAt(x, z);
  add(batch, 'lamp', x, gy, z, yaw, tints(R));
  const headX = x + Math.cos(yaw) * 0.62;
  const headZ = z - Math.sin(yaw) * 0.62;
  dyn.lanterns.push({ x: headX, y: gy + 2.84, z: headZ });
  return gy;
}

// ------------------------------------------------------------------ main
export function placeProps(ctx, plan, piece, batch, dyn) {
  const R = plan.rng;
  dyn.lanterns ||= [];
  dyn.signs ||= [];
  const W = ctx.systems.world;

  const stallAngles = [];   // plaza market ring lives in plazadress.js
  for (const a of [1.4, 3.25, 5.15]) {
    const r = POI.plaza.r - 2.3;
    const x = POI.plaza.x + Math.cos(a) * r, z = POI.plaza.z + Math.sin(a) * r;
    if (goodSpot(plan, x, z, -0.5)) addLamp(ctx, plan, batch, dyn, x, z, a + Math.PI, R);
  }

  // ---- lamps and benches along the main streets
  for (const name of ['main', 'market', 'south']) {
    const st = plan.streets.find((s) => s.name === name);
    if (!st) continue;
    const L = polyLength(st.pts);
    let side = 1;
    for (let s = 5.5; s < L - 3.5; s += 13) {
      const m = sampleAt(st.pts, s);
      const off = st.w / 2 + 0.95;
      const x = m.x + m.nx * side * off, z = m.z + m.nz * side * off;
      if (goodSpot(plan, x, z, 0.35)) {
        // arm points toward the street
        const yaw = Math.atan2(m.nz * side, -m.nx * side);
        addLamp(ctx, plan, batch, dyn, x, z, yaw, R);
      }
      side = -side;
    }
  }

  // ---- shop fronts: signs, barrels, crates, planters and sacks
  let shopProps = 0;
  for (const h of plan.houses) {
    if (shopProps >= 22) break;
    if (!(h.def.shop || h.street === 'plaza' || h.street === 'main' || h.street === 'market')) continue;
    if (R() < 0.25) continue;
    const off = 0.95;
    const side = R() < 0.5 ? -1 : 1;
    const lx = side * (h.def.W / 2 - 0.55);
    const c = Math.cos(h.yaw), s = Math.sin(h.yaw);
    const x = h.x + lx * c + off * s;
    const z = h.z - lx * s + off * c;
    if (!goodSpot(plan, x, z, 0.15)) continue;
    const y = heightAt(x, z);
    if (R() < 0.45) add(batch, 'planter', x, y, z, h.yaw + (R() < 0.5 ? 0 : Math.PI), tints(R));
    else if (R() < 0.55) add(batch, 'sack', x, y, z, R() * 6.28, tints(R));
    else add(batch, R() < 0.5 ? 'barrel' : 'crate', x, y, z, R() * 6.28, tints(R), 0.85 + R() * 0.2);
    // a second prop tucked against the facade
    if (R() < 0.5) {
      const x2 = h.x + (lx + side * 0.55) * c + 0.62 * s;
      const z2 = h.z - (lx + side * 0.55) * s + 0.62 * c;
      if (goodSpot(plan, x2, z2, 0.1)) add(batch, R() < 0.5 ? 'crate' : 'barrel', x2, heightAt(x2, z2), z2, R() * 6.28, tints(R), 0.8 + R() * 0.15);
    }
    shopProps++;
  }

  // ---- gate squares: a cart at each gate and a few crates/barrels
  for (const g of plan.gates) {
    const inward = Math.atan2(POI.plaza.x - g.x, POI.plaza.z - g.z);
    const cx = g.x + Math.sin(inward) * 6.5;
    const cz = g.z + Math.cos(inward) * 6.5;
    if (goodSpot(plan, cx, cz, 0.45)) {
      const y = heightAt(cx, cz);
      add(batch, 'cart', cx, y, cz, inward + Math.PI * 0.5, tints(R));
      ctx.colliders.push({ kind: 'box', center: [cx, y + 0.7, cz], half: [1.05, 0.7, 0.7], rotationY: inward + Math.PI * 0.5 });
    }
    for (let k = 0; k < 3; k++) {
      const a = inward + (k - 1) * 0.55;
      const x = g.x + Math.sin(a) * (3.8 + R() * 2.2);
      const z = g.z + Math.cos(a) * (3.8 + R() * 2.2);
      if (goodSpot(plan, x, z, 0.1)) add(batch, k === 1 ? 'barrel' : 'crate', x, heightAt(x, z), z, R() * 6.28, tints(R), 0.8 + R() * 0.2);
    }
  }

  // ---- bridge ends
  {
    const B = POI.bridge;
    for (const [x, yaw] of [[B.x0 + 2.5, Math.PI / 2], [B.x1 - 2.5, -Math.PI / 2]]) {
      const z = B.z + 3.2;
      add(batch, 'lamp', x, B.deckY, z, yaw, tints(R));
      dyn.lanterns.push({ x, y: B.deckY + 2.84, z });
    }
  }

  // expose counts for the town stats line / debugging
  if (W?.town) W.town.props = { lamps: dyn.lanterns.length, shopProps, stalls: stallAngles.length };
  return { lamps: dyn.lanterns.length, shopProps };
}

export { pieces, add, tints, addLamp, makePiece, paintGeometry, stripedGeometry, M as composeM, goodSpot, houseClear };
