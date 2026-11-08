// World data shared by terrain + nature: countryside paths, mask grids (paths, streets, water, sand, damp,
// town, meadow, forest floor) and the designed tree placement. Computed once, deterministic.
import { WORLD, POI, RIVER, RIVER_HALF_WIDTH, TOWN, STREETS, heightAt, distToPolyline } from '../../core/layout.js';
import { mulberry32, hash2i, fbm, sstep, clamp01, smoothPolyline } from './common.js';

export const HALF = WORLD.half;
export const MASK_RES = 1024;
const CELL = (HALF * 2) / MASK_RES;
const HRES = 512; // height grid cells (HRES+1 samples)
const HCELL = (HALF * 2) / HRES;

// ------------------------------------------------------------------ countryside paths (nature-owned)
const RAW_PATHS = [
  // west road from the bridge abutment up the windmill hills
  { w: 3.4, pts: [[-136, 3], [-150, 1], [-163, -6], [-174, -18], [-183, -31], [-188, -40]] },
  { w: 2.6, pts: [[-163, -6], [-178, 0], [-196, 8], [-212, 14], [-226, 19]] },
  { w: 2.6, pts: [[-150, 1], [-153, 18], [-156, 36], [-160, 54], [-164, 68]] },
  // south road from the south gate into the southern woods and to the pond
  { w: 3.4, pts: [[10, 116], [14, 138], [20, 162], [28, 190], [42, 218], [62, 242], [92, 256], [116, 258]] },
  // east road from the east wall towards the Core, branch to the lake
  { w: 3.4, pts: [[136, -8], [160, -16], [184, -36], [204, -64], [220, -96], [228, -118]] },
  { w: 2.6, pts: [[184, -36], [182, -70], [178, -104], [172, -140], [168, -158]] },
  // riverside trail on the west bank, north of the bridge
  { w: 2.2, pts: [[-150, 1], [-146, -24], [-150, -52], [-160, -84], [-174, -112]] },
];
export const PATHS = RAW_PATHS.map((p) => ({ width: p.w, pts: smoothPolyline(p.pts, 6) }));

const STREET_W = { main: 6, hallStairs: 6, south: 5, east: 5, market: 4.5 };

// ------------------------------------------------------------------ helpers
export const dTown = (x, z) => Math.hypot(x - TOWN.cx, z - TOWN.cz);
/** Inside the walled town (west side is bounded by the river valley / west gate). */
export const inTown = (x, z) => dTown(x, z) < TOWN.radius - 1 && x > -68;
export const dLake = (x, z) => Math.hypot(x - POI.lake.x, z - POI.lake.z);
export const waterLevelAt = (x, z) => (dLake(x, z) < POI.lake.r + 30 ? POI.lake.y : WORLD.waterLevel);
export const nearBridge = (x, z, m = 0) => x > POI.bridge.x0 - 14 - m && x < POI.bridge.x1 + 4 + m && Math.abs(z - POI.bridge.z) < 10 + m;

let DATA = null;

function rasterDistance(field, polyline, maxR) {
  for (let s = 0; s < polyline.length - 1; s++) {
    const [ax, az] = polyline[s], [bx, bz] = polyline[s + 1];
    const i0 = Math.max(0, Math.floor((Math.min(ax, bx) - maxR + HALF) / CELL));
    const i1 = Math.min(MASK_RES - 1, Math.ceil((Math.max(ax, bx) + maxR + HALF) / CELL));
    const j0 = Math.max(0, Math.floor((Math.min(az, bz) - maxR + HALF) / CELL));
    const j1 = Math.min(MASK_RES - 1, Math.ceil((Math.max(az, bz) + maxR + HALF) / CELL));
    const abx = bx - ax, abz = bz - az, L2 = abx * abx + abz * abz || 1;
    for (let j = j0; j <= j1; j++) {
      const z = -HALF + (j + 0.5) * CELL;
      for (let i = i0; i <= i1; i++) {
        const x = -HALF + (i + 0.5) * CELL;
        const t = clamp01(((x - ax) * abx + (z - az) * abz) / L2);
        const d = Math.hypot(x - ax - abx * t, z - az - abz * t);
        const k = j * MASK_RES + i;
        if (d < field[k]) field[k] = d;
      }
    }
  }
}

/** Fast bilinear height from the precomputed grid (approximate; use heightAt for exact placement). */
export function heightFast(x, z) {
  const H = DATA.hgrid;
  const fx = clamp01((x + HALF) / (HALF * 2)) * HRES, fz = clamp01((z + HALF) / (HALF * 2)) * HRES;
  const i = Math.min(HRES - 1, Math.floor(fx)), j = Math.min(HRES - 1, Math.floor(fz));
  const tx = fx - i, tz = fz - j, N = HRES + 1;
  const a = H[j * N + i], b = H[j * N + i + 1], c = H[(j + 1) * N + i], d = H[(j + 1) * N + i + 1];
  return a + (b - a) * tx + (c - a) * tz + (a - b - c + d) * tx * tz;
}
/** 1 - normal.y (0 flat … 1 vertical), from the height grid. */
export function slopeAt(x, z) {
  const e = HCELL;
  const hx = heightFast(x + e, z) - heightFast(x - e, z), hz = heightFast(x, z + e) - heightFast(x, z - e);
  return 1 - (2 * e) / Math.hypot(hx, 2 * e, hz);
}
function idx(x, z) {
  const i = Math.min(MASK_RES - 1, Math.max(0, Math.floor((x + HALF) / CELL)));
  const j = Math.min(MASK_RES - 1, Math.max(0, Math.floor((z + HALF) / CELL)));
  return j * MASK_RES + i;
}
export const pathDist = (x, z) => DATA.pathD[idx(x, z)];
export const streetDist = (x, z) => DATA.streetD[idx(x, z)];
export const riverDist = (x, z) => DATA.riverD[idx(x, z)];
/** Splat channel values (0..1) at a world point. */
export function splatAt(x, z) {
  const k = idx(x, z) * 4, A = DATA.splatA, B = DATA.splatB;
  return { path: A[k] / 255, sand: A[k + 1] / 255, cobble: A[k + 2] / 255, damp: A[k + 3] / 255, meadow: B[k] / 255, forest: B[k + 1] / 255, golden: B[k + 2] / 255, town: B[k + 3] / 255 };
}
export function isWater(x, z, margin = 0) { return heightFast(x, z) < waterLevelAt(x, z) + margin; }

// ------------------------------------------------------------------ design fields
export function forestField(x, z) {
  const n = fbm(x * 0.011, z * 0.011, 4, 3);
  const north = sstep(-140, -235, z), south = sstep(165, 245, z);
  const west = sstep(-258, -305, x), east = sstep(272, 312, x);
  const dc = Math.hypot(x - POI.core.x, z - POI.core.z);
  const ridge = sstep(58, 80, dc) * sstep(150, 100, dc) * 0.75;
  const base = Math.max(north, south, west, east * 0.85, ridge);
  let f = base * sstep(0.3, 0.52, n + base * 0.22);
  // copses on the plains
  const copse = sstep(0.7, 0.8, fbm(x * 0.022 + 50, z * 0.022 - 20, 3, 9)) * 0.85;
  f = Math.max(f, copse);
  return f;
}
export function meadowField(x, z) {
  const n = fbm(x * 0.018 + 11, z * 0.018 - 7, 4, 21);
  let m = sstep(0.48, 0.7, n);
  for (const w of POI.windmills) m = Math.max(m, sstep(70, 25, Math.hypot(x - w.x, z - w.z)) * (0.55 + 0.45 * n));
  return m;
}

// ------------------------------------------------------------------ tree placement
export const SPECIES = ['broadleaf', 'birch', 'conifer', 'blossom', 'willow'];

function treeAllowed(x, z, h, sl, opts = {}) {
  if (h < waterLevelAt(x, z) + (opts.willow ? 0.4 : 1.2)) return false;
  if (sl > (opts.maxSlope ?? 0.5)) return false;
  if (h > 110) return false;
  if (Math.max(Math.abs(x), Math.abs(z)) > 318) return false;
  if (!opts.town && dTown(x, z) < TOWN.radius + 7 && x > -112) return false;
  if (pathDist(x, z) < (opts.pathClear ?? 4.5)) return false;
  if (streetDist(x, z) < 6) return false;
  if (nearBridge(x, z, 6)) return false;
  for (const w of POI.windmills) if (Math.hypot(x - w.x, z - w.z) < 16) return false;
  if (Math.hypot(x - POI.core.x, z - POI.core.z) < 55) return false;
  if (dLake(x, z) < POI.lake.r * 0.85) return false;
  return true;
}

function placeTrees(quality) {
  const out = [];
  const td = quality.treeDensity ?? 1;
  const rnd = mulberry32(4242);
  const add = (species, x, z, s = 1, extra = {}) => {
    out.push({ species, x, z, y: heightAt(x, z), rot: rnd() * Math.PI * 2, s, variant: (rnd() * 3) | 0, tint: rnd(), ...extra });
  };
  // --- forests & copses: jittered grid
  const C = 8.5;
  for (let gz = -HALF + C / 2; gz < HALF; gz += C) {
    for (let gx = -HALF + C / 2; gx < HALF; gx += C) {
      const ci = Math.round(gx / C), cj = Math.round(gz / C);
      const x = gx + (hash2i(ci, cj, 1) - 0.5) * C * 0.9, z = gz + (hash2i(ci, cj, 2) - 0.5) * C * 0.9;
      const f = forestField(x, z);
      if (f < 0.04) continue;
      if (hash2i(ci, cj, 3) > f * td * 0.95) continue;
      const h = heightFast(x, z), sl = slopeAt(x, z);
      if (!treeAllowed(x, z, h, sl)) continue;
      const deep = Math.max(sstep(-200, -300, z), sstep(215, 300, z), sstep(-290, -330, x), sstep(85, 120, Math.hypot(x - POI.core.x, z - POI.core.z)) * sstep(150, 100, Math.hypot(x - POI.core.x, z - POI.core.z)));
      const r = hash2i(ci, cj, 4);
      const birchy = fbm(x * 0.03 - 70, z * 0.03 + 40, 2, 33);
      let sp;
      if (r < 0.15 + deep * 0.6 + sstep(30, 70, h) * 0.3) sp = 'conifer';
      else if (birchy > 0.6) sp = 'birch';
      else if (f < 0.5 && r > 0.95) sp = 'blossom';
      else sp = 'broadleaf';
      add(sp, x, z, 0.8 + hash2i(ci, cj, 5) * 0.5);
    }
  }
  // --- meadow trees: sparse landmarks
  const C2 = 34;
  for (let gz = -HALF + C2 / 2; gz < HALF; gz += C2) for (let gx = -HALF + C2 / 2; gx < HALF; gx += C2) {
    const ci = Math.round(gx / C2), cj = Math.round(gz / C2);
    if (hash2i(ci, cj, 11) > 0.3 * Math.min(1, td + 0.2)) continue;
    const x = gx + (hash2i(ci, cj, 12) - 0.5) * C2 * 0.8, z = gz + (hash2i(ci, cj, 13) - 0.5) * C2 * 0.8;
    if (forestField(x, z) > 0.1) continue;
    const h = heightFast(x, z);
    if (!treeAllowed(x, z, h, slopeAt(x, z), { pathClear: 6 })) continue;
    const r = hash2i(ci, cj, 14);
    add(r < 0.6 ? 'broadleaf' : r < 0.8 ? 'blossom' : 'birch', x, z, 1.0 + hash2i(ci, cj, 15) * 0.35);
  }
  // --- orchard on the east-facing slope below the western windmills (rows of blossom trees)
  {
    const cx = -197, cz = -6, ang = -0.35, rows = 5, cols = 7, sx = 7.5, sz = 7.0;
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const lx = (c - (cols - 1) / 2) * sx + (r % 2) * 1.5, lz = (r - (rows - 1) / 2) * sz;
      const x = cx + lx * Math.cos(ang) - lz * Math.sin(ang), z = cz + lx * Math.sin(ang) + lz * Math.cos(ang);
      if (hash2i(r, c, 21) > 0.35 + 0.6 * td) continue;
      if (pathDist(x, z) < 3.2) continue;
      add('blossom', x + (rnd() - 0.5), z + (rnd() - 0.5), 0.72 + rnd() * 0.18, { orchard: true, white: hash2i(r, c, 22) < 0.35 });
    }
  }
  // --- riverside willows (and birch) along the banks, lake shore and the southern pond
  for (let s = 0; s < RIVER.length - 1; s++) {
    const [ax, az] = RIVER[s], [bx, bz] = RIVER[s + 1];
    const L = Math.hypot(bx - ax, bz - az), nx = -(bz - az) / L, nz = (bx - ax) / L;
    for (let d = 0; d < L; d += 15) {
      for (const side of [-1, 1]) {
        const k = s * 1000 + Math.round(d) * 2 + (side > 0 ? 1 : 0);
        if (hash2i(k, 7, 31) > 0.5 * td + 0.15) continue;
        const off = RIVER_HALF_WIDTH + 5 + hash2i(k, 8, 31) * 9;
        const x = ax + (bx - ax) * d / L + nx * off * side, z = az + (bz - az) * d / L + nz * off * side;
        if (Math.abs(x) > 330 || Math.abs(z) > 330) continue;
        const h = heightFast(x, z);
        if (h < WORLD.waterLevel + 0.5 || h > 11) continue;
        if (!treeAllowed(x, z, h, slopeAt(x, z), { willow: true, maxSlope: 0.6, pathClear: 3 })) continue;
        add(hash2i(k, 9, 31) < 0.72 ? 'willow' : 'birch', x, z, 0.9 + hash2i(k, 10, 31) * 0.3);
      }
    }
  }
  for (let a = 0; a < Math.PI * 2; a += 0.21) {
    const k = Math.round(a * 100);
    if (hash2i(k, 3, 41) > 0.55) continue;
    const r = POI.lake.r + 4 + hash2i(k, 4, 41) * 14;
    const x = POI.lake.x + Math.cos(a) * r, z = POI.lake.z + Math.sin(a) * r;
    const h = heightFast(x, z);
    if (Math.abs(x) > 325 || Math.abs(z) > 325) continue;
    if (!treeAllowed(x, z, h, slopeAt(x, z), { willow: true, maxSlope: 0.6 })) continue;
    add(hash2i(k, 5, 41) < 0.5 ? 'willow' : hash2i(k, 6, 41) < 0.5 ? 'blossom' : 'birch', x, z, 0.9 + hash2i(k, 7, 41) * 0.3);
  }
  // --- framing trees: gates and screenshot views (hand-placed)
  const framing = [
    ['broadleaf', -74, -16, 1.15], ['blossom', -73, 20, 0.95], ['broadleaf', -80, 28, 1.0],      // west gate, outside the wall
    ['broadleaf', -6, 128, 1.15], ['blossom', 28, 129, 0.95],                                      // south gate
    ['broadleaf', -146, 52, 1.3], ['birch', -138, 66, 1.05], ['blossom', -168, 46, 0.95],        // meadow view framing
    ['broadleaf', -161, 24, 1.25], ['willow', -126, 30, 1.05], ['willow', -128, -22, 1.0],       // bridge view framing
    ['broadleaf', -112, 150, 1.3], ['blossom', -150, 120, 1.0],
  ];
  for (const [sp, x, z, s] of framing) {
    const h = heightFast(x, z);
    if (h < waterLevelAt(x, z) + 0.4) continue;
    if (pathDist(x, z) < 2.5) continue;
    add(sp, x, z, s, { framing: true });
  }
  return out;
}

// ------------------------------------------------------------------ build
export function getWorldData(quality) {
  if (DATA) return DATA;
  const t0 = performance.now();
  const N = HRES + 1;
  const hgrid = new Float32Array(N * N);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) hgrid[j * N + i] = heightAt(-HALF + i * HCELL, -HALF + j * HCELL);
  DATA = { hgrid };
  const R = MASK_RES, NN = R * R;
  const pathD = new Float32Array(NN).fill(99), streetD = new Float32Array(NN).fill(99), riverD = new Float32Array(NN).fill(99);
  const pathWidth = new Float32Array(NN).fill(3);
  for (const p of PATHS) {
    const tmp = new Float32Array(NN).fill(99);
    rasterDistance(tmp, p.pts, 10);
    for (let k = 0; k < NN; k++) if (tmp[k] < 99) { const d = tmp[k] - p.width * 0.5; if (d < pathD[k]) { pathD[k] = d; pathWidth[k] = p.width; } }
  }
  for (const key in STREETS) {
    const tmp = new Float32Array(NN).fill(99);
    rasterDistance(tmp, STREETS[key], 12);
    const w = STREET_W[key] || 5;
    for (let k = 0; k < NN; k++) { const d = tmp[k] - w * 0.5; if (d < streetD[k]) streetD[k] = d; }
  }
  rasterDistance(riverD, RIVER, 48);
  DATA.pathD = pathD; DATA.streetD = streetD; DATA.riverD = riverD;

  const splatA = new Uint8Array(NN * 4), splatB = new Uint8Array(NN * 4);
  DATA.splatA = splatA; DATA.splatB = splatB;
  const toB = (v) => Math.round(clamp01(v) * 255);
  // coarse design fields (fbm is expensive): 257^2 grid, bilinear lookups
  const G = 256, GC = (HALF * 2) / G, mg = new Float32Array((G + 1) ** 2), gg = new Float32Array((G + 1) ** 2);
  for (let j = 0; j <= G; j++) for (let i = 0; i <= G; i++) {
    const x = -HALF + i * GC, z = -HALF + j * GC;
    mg[j * (G + 1) + i] = meadowField(x, z);
    gg[j * (G + 1) + i] = fbm(x * 0.009 - 30, z * 0.009 + 60, 3, 51);
  }
  const coarse = (A, x, z) => {
    const fx = (x + HALF) / GC, fz = (z + HALF) / GC, i = Math.min(G - 1, fx | 0), jj = Math.min(G - 1, fz | 0), tx = fx - i, tz = fz - jj, W = G + 1;
    const a = A[jj * W + i], b = A[jj * W + i + 1], c = A[(jj + 1) * W + i], d = A[(jj + 1) * W + i + 1];
    return a + (b - a) * tx + (c - a) * tz + (a - b - c + d) * tx * tz;
  };
  DATA.meadowAt = (x, z) => coarse(mg, x, z);
  for (let j = 0; j < R; j++) {
    const z = -HALF + (j + 0.5) * CELL;
    for (let i = 0; i < R; i++) {
      const x = -HALF + (i + 0.5) * CELL, k = j * R + i;
      const h = heightFast(x, z), wl = waterLevelAt(x, z);
      const town = inTown(x, z);
      const pd = pathD[k], sd = streetD[k];
      // dirt: countryside paths + worn margins of town streets
      let dirt = 1 - sstep(-0.6, 1.4, pd);
      dirt = Math.max(dirt, (1 - sstep(0.3, 2.6, sd)) * 0.9);
      if (Math.hypot(x - POI.bridge.x0 + 6, z - POI.bridge.z) < 9) dirt = Math.max(dirt, 1 - sstep(5, 9, Math.hypot(x - POI.bridge.x0 + 6, z - POI.bridge.z)));
      for (const w of POI.windmills) dirt = Math.max(dirt, 1 - sstep(6, 10, Math.hypot(x - w.x, z - w.z)));
      // cobble: town streets, plaza, hall terrace
      let cob = 1 - sstep(-0.5, 0.6, sd);
      cob = Math.max(cob, 1 - sstep(POI.plaza.r - 1, POI.plaza.r + 1.5, Math.hypot(x - POI.plaza.x, z - POI.plaza.z)));
      cob = Math.max(cob, (1 - sstep(POI.hall.r * 0.75, POI.hall.r * 0.9, Math.hypot(x - POI.hall.x, z - POI.hall.z))) * 0.85);
      // water edge
      const lakeSide = dLake(x, z) < POI.lake.r + 30;
      const sand = (1 - sstep(wl + 0.9, wl + 2.0, h)) * (lakeSide ? sstep(wl - 3.0, wl - 1.5, h) : 1);
      const damp = (1 - sstep(wl + 2.0, wl + 4.5, h)) * (1 - sand * 0.6);
      splatA[k * 4] = toB(dirt * (1 - cob)); splatA[k * 4 + 1] = toB(sand); splatA[k * 4 + 2] = toB(cob); splatA[k * 4 + 3] = toB(damp);
      const meadow = town ? 0 : coarse(mg, x, z) * (1 - sand) * sstep(1.5, 4, pd);
      const golden = town ? 0 : sstep(0.58, 0.75, coarse(gg, x, z)) * sstep(14, 26, h);
      splatB[k * 4] = toB(meadow); splatB[k * 4 + 2] = toB(golden); splatB[k * 4 + 3] = toB(town ? 1 - sstep(TOWN.radius - 8, TOWN.radius - 1, dTown(x, z)) : 0);
    }
  }
  // trees, then forest floor raster from canopy footprints
  const trees = placeTrees(quality);
  DATA.trees = trees;
  const forest = new Float32Array(NN);
  for (const t of trees) {
    const rr = (t.species === 'conifer' ? 4.5 : t.species === 'blossom' ? 4 : 5.5) * t.s;
    const r2 = rr + 2;
    const i0 = Math.max(0, Math.floor((t.x - r2 + HALF) / CELL)), i1 = Math.min(R - 1, Math.ceil((t.x + r2 + HALF) / CELL));
    const j0 = Math.max(0, Math.floor((t.z - r2 + HALF) / CELL)), j1 = Math.min(R - 1, Math.ceil((t.z + r2 + HALF) / CELL));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const x = -HALF + (i + 0.5) * CELL, z = -HALF + (j + 0.5) * CELL;
      const v = 1 - sstep(rr * 0.4, r2, Math.hypot(x - t.x, z - t.z));
      const k = j * R + i;
      forest[k] = Math.min(1, forest[k] + v * 0.75);
    }
  }
  for (let k = 0; k < NN; k++) splatB[k * 4 + 1] = toB(forest[k] * (1 - splatA[k * 4 + 1] / 255));
  console.log(`[nature] world data ${(performance.now() - t0).toFixed(0)} ms, trees ${trees.length}`);
  return DATA;
}
