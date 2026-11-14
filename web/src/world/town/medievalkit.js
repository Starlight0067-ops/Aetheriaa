// Houses assembled from the third-party CC0 Quaternius "Medieval Village MegaKit" modules that ship in
// public/assets/free/medieval (walls, windows, doors, tiled roofs, gables, chimneys).
// One merged piece is built per house definition of the plan (same footprint W x D, same wall heights), so
// plan positions, colliders and the StaticBatcher path stay exactly as they were for the generated kit.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export const HOUSE_KIT_PIECES = [
  'Wall_UnevenBrick_Straight', 'Wall_UnevenBrick_Door_Flat', 'Wall_UnevenBrick_Door_Round', 'Wall_UnevenBrick_Window_Wide_Flat',
  'Wall_UnevenBrick_Window_Wide_Round', 'Wall_Plaster_Straight', 'Wall_Plaster_WoodGrid', 'Wall_Plaster_Window_Wide_Flat',
  'Wall_Plaster_Window_Wide_Round', 'Wall_Plaster_Window_Thin_Round', 'Window_Wide_Flat1', 'Window_Wide_Round1', 'Window_Thin_Round1',
  'WindowShutters_Wide_Flat_Open', 'Door_1_Flat', 'Door_1_Round', 'Corner_Exterior_Wood', 'Wall_BottomCover',
  'Roof_RoundTiles_6x8', 'Roof_RoundTiles_8x8', 'Roof_RoundTiles_8x10', 'Roof_Front_Brick6', 'Roof_Front_Brick8', 'Prop_Chimney',
];

const UP = new THREE.Vector3(0, 1, 0);
const WALL_H = 3.0;                       // nominal module height (m); modules are 2 m wide
const ROOF_H = { 6: 4.9, 8: 6.0 };

function rng(seed) { let s = (seed * 2654435761) >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

/** Returns Map(def.name -> piece) for every def that could be assembled (empty when the kit is missing). */
export function buildKitHouses(pieces, defs) {
  const get = (n) => pieces.get('q:' + n);
  const required = ['Wall_UnevenBrick_Straight', 'Wall_Plaster_Straight', 'Roof_RoundTiles_6x8', 'Roof_RoundTiles_8x8', 'Roof_Front_Brick6', 'Roof_Front_Brick8'];
  const out = new Map();
  if (!required.every(get)) return out;
  defs.forEach((def, di) => {
    try { const p = assemble(get, def, di); if (p) out.set(def.name, p); } catch (e) { console.warn('[town] kit house failed', def.name, e); }
  });
  return out;
}

function assemble(get, def, di) {
  const R = rng(di + 11);
  const { W, D } = def;
  const U = Math.max(0, def.U | 0);
  const nx = Math.max(2, Math.round(W / 2)), nz = Math.max(2, Math.round(D / 2));
  const mx = W / nx, mz = D / nz;
  const bySlot = new Map();
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion();
  const put = (name, x, y, z, yaw = 0, sx = 1, sy = 1, sz = 1) => {
    const p = get(name);
    if (!p) return false;
    m4.compose(new THREE.Vector3(x, y, z), q.setFromAxisAngle(UP, yaw), new THREE.Vector3(sx, sy, sz));
    for (const [slot, geo] of p.parts) {
      const g = geo.clone().applyMatrix4(m4);
      if (y > 0.01) g.attributes.color.array.fill(1);   // the kit's baked ground-contact shade only belongs on the ground floor
      if (!bySlot.has(slot)) bySlot.set(slot, []);
      bySlot.get(slot).push(g);
    }
    return true;
  };
  // the four facades: [origin x, origin z, step x, step z, yaw, module count, module width]
  const sides = {
    front: { n: nx, w: mx, yaw: 0, at: (i) => [-W / 2 + (i + 0.5) * mx, 0] },
    back: { n: nx, w: mx, yaw: Math.PI, at: (i) => [W / 2 - (i + 0.5) * mx, -D] },
    right: { n: nz, w: mz, yaw: Math.PI / 2, at: (i) => [W / 2, -(i + 0.5) * mz] },
    left: { n: nz, w: mz, yaw: -Math.PI / 2, at: (i) => [-W / 2, -D + (i + 0.5) * mz] },
  };
  const wall = (side, i, y, h, name, extras = []) => {
    const S = sides[side];
    const [x, z] = S.at(i);
    const sx = S.w / 2, sy = h / WALL_H;
    if (!put(name, x, y, z, S.yaw, sx, sy, 1)) put(name.includes('UnevenBrick') ? 'Wall_UnevenBrick_Straight' : 'Wall_Plaster_Straight', x, y, z, S.yaw, sx, sy, 1);
    for (const e of extras) put(e, x, y, z, S.yaw, sx, sy, 1);
  };
  const WIN = {
    Wall_UnevenBrick_Window_Wide_Flat: 'Window_Wide_Flat1', Wall_UnevenBrick_Window_Wide_Round: 'Window_Wide_Round1',
    Wall_Plaster_Window_Wide_Flat: 'Window_Wide_Flat1', Wall_Plaster_Window_Wide_Round: 'Window_Wide_Round1',
    Wall_Plaster_Window_Thin_Round: 'Window_Thin_Round1',
  };
  const windowWall = (side, i, y, h, name, shutters = false) => {
    const ex = [WIN[name]];
    if (shutters && name.endsWith('Wide_Flat')) ex.push('WindowShutters_Wide_Flat_Open');
    wall(side, i, y, h, name, ex);
  };

  // ---- ground floor: rough stone, door + shop windows on the street side
  const g = def.g;
  const doorAt = Math.floor(R() * nx);
  const roundDoor = R() < 0.5;
  for (let i = 0; i < nx; i++) {
    if (i === doorAt) wall('front', i, 0, g, roundDoor ? 'Wall_UnevenBrick_Door_Round' : 'Wall_UnevenBrick_Door_Flat', [roundDoor ? 'Door_1_Round' : 'Door_1_Flat']);
    else windowWall('front', i, 0, g, R() < 0.5 ? 'Wall_UnevenBrick_Window_Wide_Flat' : 'Wall_UnevenBrick_Window_Wide_Round', true);
    wall('back', i, 0, g, 'Wall_UnevenBrick_Straight');
  }
  for (let i = 0; i < nz; i++) { wall('right', i, 0, g, 'Wall_UnevenBrick_Straight'); wall('left', i, 0, g, 'Wall_UnevenBrick_Straight'); }

  // ---- upper floors: plaster and timber
  const upper = ['Wall_Plaster_Window_Wide_Flat', 'Wall_Plaster_Window_Wide_Round', 'Wall_Plaster_Window_Thin_Round'];
  let y = g;
  for (let f = 0; f < U; f++) {
    const style = upper[Math.floor(R() * upper.length)];
    const shut = R() < 0.6;
    for (let i = 0; i < nx; i++) {
      const edgeGrid = nx >= 4 && (i === 0 || i === nx - 1) && R() < 0.5;
      if (edgeGrid) wall('front', i, y, def.f, 'Wall_Plaster_WoodGrid'); else windowWall('front', i, y, def.f, style, shut);
      if (i % 2 === 1) windowWall('back', i, y, def.f, 'Wall_Plaster_Window_Thin_Round'); else wall('back', i, y, def.f, 'Wall_Plaster_WoodGrid');
    }
    for (let i = 0; i < nz; i++) for (const s of ['right', 'left']) {
      if (i === 1 || i === nz - 2) windowWall(s, i, y, def.f, 'Wall_Plaster_Window_Thin_Round');
      else wall(s, i, y, def.f, i % 2 ? 'Wall_Plaster_Straight' : 'Wall_Plaster_WoodGrid');
    }
    // timber band where the floors meet
    for (const [s, S] of Object.entries(sides)) for (let i = 0; i < S.n; i++) { const [x, z] = S.at(i); put('Wall_BottomCover', x, y, z, S.yaw, S.w / 2, 1, 1); }
    y += def.f;
  }
  const wallTop = y;
  // corner posts, full height
  for (const [cx, cz] of [[-W / 2, 0], [W / 2, 0], [W / 2, -D], [-W / 2, -D]]) put('Corner_Exterior_Wood', cx, 0, cz, 0, 1.25, wallTop / WALL_H, 1.25);

  // ---- roof: gable to the street ("front") or ridge along the street ("side")
  let roofH;
  if (def.roof === 'side') {
    const L = W > 9 ? 10 : 8;
    const s = D / 8, sy = (s + 1) / 2;
    put(`Roof_RoundTiles_8x${L}`, 0, wallTop, -D / 2, Math.PI / 2, s, sy, W / L) || put('Roof_RoundTiles_8x8', 0, wallTop, -D / 2, Math.PI / 2, s, sy, W / 8);
    put('Roof_Front_Brick8', W / 2, wallTop, -D / 2, Math.PI / 2, s, sy, 1);
    put('Roof_Front_Brick8', -W / 2, wallTop, -D / 2, -Math.PI / 2, s, sy, 1);
    roofH = ROOF_H[8] * sy;
    if (get('Prop_Chimney')) put('Prop_Chimney', (R() < 0.5 ? -1 : 1) * W * 0.28, wallTop + roofH * 0.25, -D * 0.72, 0, 1, 1, 1);
  } else {
    const rw = nx <= 3 ? 6 : 8;
    const s = W / rw, sy = (s + 1) / 2;
    put(`Roof_RoundTiles_${rw}x8`, 0, wallTop, -D / 2, 0, s, sy, D / 8);
    put(`Roof_Front_Brick${rw}`, 0, wallTop, 0, 0, s, sy, 1);
    put(`Roof_Front_Brick${rw}`, 0, wallTop, -D, Math.PI, s, sy, 1);
    roofH = ROOF_H[rw] * sy;
    if (get('Prop_Chimney')) put('Prop_Chimney', (R() < 0.5 ? -1 : 1) * W * 0.27, wallTop + roofH * 0.2, -D * (0.35 + R() * 0.4), 0, 1, 1, 1);
  }

  const parts = new Map();
  const box = new THREE.Box3();
  for (const [slot, list] of bySlot) {
    const merged = mergeGeometries(list, false);
    if (!merged) continue;
    merged.computeBoundingBox(); merged.computeBoundingSphere();
    box.union(merged.boundingBox);
    parts.set(slot, merged);
    for (const gg of list) gg.dispose();
  }
  return { parts, box, height: wallTop + roofH };
}
