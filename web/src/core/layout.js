// AETHERIA — authored layout of the Vael Harrow vertical slice (original design).
// Units: metres. Y up, -Z north. Shared by every world module: change only via the orchestrator.

export const WORLD = { half: 400, waterLevel: 4.0 };

export const POI = {
  plaza:     { x: 0,    z: 0,    y: 22, r: 24 },     // fountain plaza (Choir fountain)
  hall:      { x: 62,   z: -62,  y: 42, r: 34 },     // Concord Hall keep on the hilltop
  westGate:  { x: -64,  z: 3,    y: 15 },            // town gate at the end of the bridge
  bridge:    { x0: -132, x1: -62, z: 3, deckY: 15, width: 8 },   // arched stone viaduct over the river valley
  southGate: { x: 10,   z: 112,  y: 14 },
  spawn:     { x: 0,    z: 15 },     // south edge of the plaza paving (clear of houses)
  core:      { x: 245,  z: -150 },                    // the Elyndra Core: giant crystal spire, landmark
  windmills: [{ x: -190, z: -48 }, { x: -168, z: 78 }, { x: -236, z: 22 }],
  lake:      { x: 165,  z: -235, r: 70, y: 11 },
};

/** River centre line (polyline) and half width. */
export const RIVER = [[-255, -400], [-195, -232], [-128, -96], [-97, 3], [-112, 120], [-168, 262], [-216, 400]];
export const RIVER_HALF_WIDTH = 13;

/** Town wall ring and street backbone (the town module adds detail on top). */
export const TOWN = { cx: 18, cz: -12, radius: 122 };
export const STREETS = {
  main:       [[-62, 3], [-42, 5], [-22, 3], [-6, 1]],          // gate -> plaza (stair flights where steep)
  hallStairs: [[9, -11], [24, -27], [40, -43], [52, -54]],       // plaza -> hall, grand staircase
  south:      [[2, 24], [5, 62], [10, 108]],                     // plaza -> south gate
  east:       [[24, 3], [60, 12], [104, -6]],
  market:     [[-18, -16], [-34, -40], [-30, -70]],
};

/** Camera viewpoints used by screenshots and judges (?view=name). */
export const VIEWS = {
  overview: { pos: [-150, 78, 150], target: [10, 22, -10], fov: 50 },
  plaza:    { pos: [15, 27.5, 31], target: [0, 23.5, -2], fov: 55 },
  street:   { pos: [-56, 18.8, 3.2], target: [4, 23, 1], fov: 58 },
  bridge:   { pos: [-170, 40, 55], target: [-100, 15, 3], fov: 50 },
  hall:     { pos: [5, 26.4, -13], target: [52, 49, -54], fov: 55 },   // outside the plaza bunting ring
  meadow:   { pos: [-128, 23, 44], target: [-200, 33, 0], fov: 55 },
  portrait: { follow: 'player', offset: [0, 1.6, 1.0], look: [0, 1.57, 0], fov: 32 },
  fullbody: { follow: 'player', offset: [0, 1.05, 3.3], look: [0, 0.92, 0], fov: 40 },
};

// ---------------------------------------------------------------- terrain height
const clamp01 = (v) => Math.min(1, Math.max(0, v));
export const smoothstep = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
export const lerp = (a, b, t) => a + (b - a) * t;
const gauss = (dx, dz, r) => Math.exp(-(dx * dx + dz * dz) / (r * r));
const dist = (x, z, px, pz) => Math.hypot(x - px, z - pz);

export function distToPolyline(x, z, pts) {
  let best = Infinity;
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az] = pts[i], [bx, bz] = pts[i + 1];
    const abx = bx - ax, abz = bz - az;
    const t = clamp01(((x - ax) * abx + (z - az) * abz) / (abx * abx + abz * abz || 1));
    best = Math.min(best, Math.hypot(x - (ax + abx * t), z - (az + abz * t)));
  }
  return best;
}

export const riverDistance = (x, z) => distToPolyline(x, z, RIVER);

/** Analytic terrain height. Deterministic; every module samples the same function. */
export function heightAt(x, z) {
  let h = 8 + 3.5 * Math.sin(x * 0.012) * Math.cos(z * 0.010) + 1.6 * Math.sin(x * 0.031 + z * 0.023) + 0.8 * Math.sin(z * 0.07 - x * 0.04);
  h += 30 * gauss(x - 50, z + 50, 110);       // town hill
  h += 22 * gauss(x + 190, z + 44, 70);       // windmill hills (west)
  h += 18 * gauss(x + 168, z - 80, 60);
  h += 15 * gauss(x + 236, z - 24, 55);
  h += 42 * gauss(x - 248, z + 150, 95);      // eastern ridge under the Core
  const e = Math.max(Math.abs(x), Math.abs(z));
  if (e > 320) h += Math.pow(e - 320, 1.4) * 0.8;   // rim mountains
  // terraces
  h = lerp(h, POI.plaza.y, 1 - smoothstep(POI.plaza.r * 0.9, POI.plaza.r + 16, dist(x, z, POI.plaza.x, POI.plaza.z)));
  h = lerp(h, POI.hall.y, 1 - smoothstep(POI.hall.r * 0.8, POI.hall.r + 18, dist(x, z, POI.hall.x, POI.hall.z)));
  // bridge abutments level with the deck
  for (const bx of [POI.bridge.x0 - 8, POI.bridge.x1 + 6]) {
    h = lerp(h, POI.bridge.deckY - 0.2, 1 - smoothstep(8, 22, dist(x, z, bx, POI.bridge.z)));
  }
  // lake basin
  const ld = dist(x, z, POI.lake.x, POI.lake.z);
  h = lerp(h, POI.lake.y - 4, 1 - smoothstep(POI.lake.r * 0.7, POI.lake.r + 10, ld));
  // river valley
  const rd = riverDistance(x, z);
  h = lerp(h, 0.5, 1 - smoothstep(RIVER_HALF_WIDTH * 0.6, RIVER_HALF_WIDTH + 18, rd));
  return h;
}

/** Surface normal from central differences. */
export function normalAt(x, z, e = 0.5) {
  const hx = heightAt(x + e, z) - heightAt(x - e, z);
  const hz = heightAt(x, z + e) - heightAt(x, z - e);
  const nx = -hx, ny = 2 * e, nz = -hz;
  const l = Math.hypot(nx, ny, nz);
  return [nx / l, ny / l, nz / l];
}
