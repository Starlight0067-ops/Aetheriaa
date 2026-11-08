// Vael Harrow town plan: street network, house lots, wall ring, towers, gates and prop spots.
// Pure layout (no THREE objects): everything derives from src/core/layout.js so the town follows
// any change of the shared POIs / street backbone.
import { POI, STREETS, TOWN, heightAt, riverDistance, distToPolyline } from '../../core/layout.js';

export function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// ------------------------------------------------------------------ streets
export function streetList() {
  const hs = STREETS.hallStairs;
  return [
    { name: 'main', pts: STREETS.main, w: 6.5, kind: 'street' },
    { name: 'hallStairs', pts: hs, w: 7.5, kind: 'grand' },
    { name: 'south', pts: STREETS.south, w: 6, kind: 'street' },
    { name: 'east', pts: STREETS.east, w: 6, kind: 'street' },
    { name: 'market', pts: STREETS.market, w: 7, kind: 'street' },
    { name: 'westWall', pts: [[-57, -4], [-61, -28], [-56, -54], [-42, -76]], w: 4.5, kind: 'lane' },
    { name: 'southWest', pts: [[-40, 22], [-36, 44], [-20, 66], [4, 80]], w: 5, kind: 'lane' },
    { name: 'southEast', pts: [[6, 66], [30, 52], [52, 34], [70, 16]], w: 5, kind: 'lane' },
    { name: 'north', pts: [[-31, -56], [-10, -50], [10, -46], [22, -54]], w: 5, kind: 'lane' },
    { name: 'eastUpper', pts: [[60, 12], [76, 34], [86, 58]], w: 5, kind: 'lane' },
    { name: 'gateLane', pts: [[-58, 6], [-50, 26], [-40, 22]], w: 4.5, kind: 'lane' },
  ];
}

export function polyLength(pts) {
  let L = 0;
  for (let i = 0; i < pts.length - 1; i++) L += Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]);
  return L;
}

/** Point, unit tangent and left normal at arc length s. */
export function sampleAt(pts, s) {
  let acc = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az] = pts[i], [bx, bz] = pts[i + 1];
    const L = Math.hypot(bx - ax, bz - az);
    if (s <= acc + L || i === pts.length - 2) {
      const t = Math.min(1, Math.max(0, (s - acc) / L));
      const tx = (bx - ax) / L, tz = (bz - az) / L;
      return { x: ax + (bx - ax) * t, z: az + (bz - az) * t, tx, tz, nx: -tz, nz: tx };
    }
    acc += L;
  }
  const p = pts[pts.length - 1];
  return { x: p[0], z: p[1], tx: 1, tz: 0, nx: 0, nz: 1 };
}

// ------------------------------------------------------------------ wall ring
export function wallPath() {
  const pts = [];
  const N = 120;
  for (let i = 0; i < N; i++) {
    const t = (i / N) * Math.PI * 2;
    let r = TOWN.radius;
    let x = TOWN.cx + r * Math.cos(t), z = TOWN.cz + r * Math.sin(t);
    while (riverDistance(x, z) < 34 && r > 40) { r -= 0.5; x = TOWN.cx + r * Math.cos(t); z = TOWN.cz + r * Math.sin(t); }
    pts.push([x, z]);
  }
  // smooth twice (closed)
  let p = pts;
  for (let k = 0; k < 3; k++) p = p.map((q, i) => { const a = p[(i - 1 + N) % N], b = p[(i + 1) % N]; return [(a[0] + 2 * q[0] + b[0]) / 4, (a[1] + 2 * q[1] + b[1]) / 4]; });
  return p;
}

function resampleClosed(pts, step) {
  const closed = [...pts, pts[0]];
  const L = polyLength(closed);
  const n = Math.round(L / step);
  const out = [];
  for (let i = 0; i < n; i++) { const s = sampleAt(closed, (i / n) * L); out.push([s.x, s.z]); }
  return out;
}

function nearestOnRing(ring, x, z) {
  let best = 0, bd = Infinity;
  ring.forEach((p, i) => { const d = Math.hypot(p[0] - x, p[1] - z); if (d < bd) { bd = d; best = i; } });
  return best;
}

// ------------------------------------------------------------------ main plan
export function makePlan(houseDefs) {
  const R = rng(20251108);
  const streets = streetList();
  const ring = resampleClosed(wallPath(), 8.0);
  const gates = [
    { name: 'west', x: POI.westGate.x, z: POI.westGate.z, yaw: -Math.PI / 2, y: heightAt(POI.westGate.x, POI.westGate.z) },
  ];
  const sgi = nearestOnRing(ring, POI.southGate.x, POI.southGate.z);
  {
    const a = ring[(sgi - 1 + ring.length) % ring.length], b = ring[(sgi + 1) % ring.length];
    const tx = b[0] - a[0], tz = b[1] - a[1];
    // outward = away from the town centre
    let ox = tz, oz = -tx;
    const cx = ring[sgi][0] - TOWN.cx, cz = ring[sgi][1] - TOWN.cz;
    if (ox * cx + oz * cz < 0) { ox = -ox; oz = -oz; }
    gates.push({ name: 'south', x: ring[sgi][0], z: ring[sgi][1], yaw: Math.atan2(ox, oz), y: heightAt(ring[sgi][0], ring[sgi][1]) });
  }

  // wall segments and towers
  const segs = [], towers = [];
  const n = ring.length;
  for (let i = 0; i < n; i++) {
    const a = ring[i], b = ring[(i + 1) % n];
    const mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2;
    if (gates.some((g) => Math.hypot(g.x - mx, g.z - mz) < 10)) continue;
    const tx = b[0] - a[0], tz = b[1] - a[1];
    const L = Math.hypot(tx, tz);
    let ox = tz / L, oz = -tx / L;
    if (ox * (mx - TOWN.cx) + oz * (mz - TOWN.cz) < 0) { ox = -ox; oz = -oz; }
    segs.push({ a, b, L, ox, oz, ya: heightAt(a[0], a[1]), yb: heightAt(b[0], b[1]) });
  }
  for (let i = 0; i < n; i += 6) {
    const p = ring[i];
    if (gates.some((g) => Math.hypot(g.x - p[0], g.z - p[1]) < 16)) continue;
    let y = Infinity;
    for (let k = 0; k < 8; k++) { const t = k / 8 * Math.PI * 2; y = Math.min(y, heightAt(p[0] + 3.6 * Math.cos(t), p[1] + 3.6 * Math.sin(t))); }
    towers.push({ x: p[0], z: p[1], y: y - 0.3, tall: (i / 6) % 2 === 0 });
  }

  // keep-out discs (camera views, plaza, gates, fountain square, hall terrace)
  const keep = [
    { x: POI.plaza.x, z: POI.plaza.z, r: POI.plaza.r + 0.2 },
    { x: POI.hall.x, z: POI.hall.z, r: 31 },
    { x: 15, z: 31, r: 9 }, { x: 8, z: 21, r: 7 },            // plaza view
    { x: -50, z: 13, r: 7 }, { x: -46, z: 10, r: 6 },         // street view / gate square
    ...gates.map((g) => ({ x: g.x, z: g.z, r: 13 })),
  ];
  // gate square south of the main street (view corridor of the "street" camera)
  const noHouseRegion = (x, z) => (x > -62 && x < -22 && z > 5 && z < 21) || (x > -16 && x < 18 && z > 18 && z < 44 && x > 2);

  const placed = [];
  const obbs = [];
  const inWall = (x, z) => {
    // inside the ring and >7 m from it
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, zi] = ring[i], [xj, zj] = ring[j];
      if (((zi > z) !== (zj > z)) && (x < (xj - xi) * (z - zi) / (zj - zi) + xi)) inside = !inside;
    }
    return inside && distToPolyline(x, z, [...ring, ring[0]]) > 8;
  };
  const corners = (cx, cz, yaw, hw, hd, frontOff) => {
    // house local: x across, z towards the street (front at z=frontOff, back at -hd*2)
    const c = Math.cos(yaw), s = Math.sin(yaw);
    const pts = [];
    for (const [lx, lz] of [[-hw, frontOff], [hw, frontOff], [hw, -hd * 2], [-hw, -hd * 2], [0, -hd], [-hw, -hd], [hw, -hd], [0, frontOff], [0, -hd * 2]]) {
      pts.push([cx + lx * c + lz * s, cz - lx * s + lz * c]);
    }
    return pts;
  };
  const overlaps = (A) => {
    for (const B of obbs) {
      if (Math.hypot(A.cx - B.cx, A.cz - B.cz) > A.r + B.r) continue;
      if (satOverlap(A, B)) return true;
    }
    return false;
  };

  function tryHouse(def, x, z, yaw, street, opts = {}) {
    const hw = def.W / 2, hd = def.D / 2;
    const pts = corners(x, z, yaw, hw - 0.15, hd - 0.1, 0.0);
    for (const [px, pz] of pts) {
      if (!inWall(px, pz)) return null;
      if (noHouseRegion(px, pz)) return null;
      for (const k of keep) if (Math.hypot(px - k.x, pz - k.z) < k.r) return null;
      for (const st of streets) {
        const d = distToPolyline(px, pz, st.pts);
        if (d < st.w / 2 + 0.25) return null;
      }
    }
    // terrain
    const front = pts.slice(0, 2).concat([pts[7]]);
    let floorY = -Infinity;
    for (const [px, pz] of front) floorY = Math.max(floorY, heightAt(px, pz));
    let minY = Infinity, maxY = -Infinity;
    for (const [px, pz] of pts) { const h = heightAt(px, pz); minY = Math.min(minY, h); maxY = Math.max(maxY, h); }
    if (minY < 7.5) return null;                               // river valley
    const wallTop = floorY + def.g + def.f * def.U;
    if (maxY > wallTop - 1.0) return null;                      // buried too deep
    if (floorY - minY > (opts.maxDrop ?? 9)) return null;
    const c = Math.cos(yaw), s = Math.sin(yaw);
    const ob = makeOBB(x - hd * s, z - hd * c, yaw, hw, hd + Math.max(0, def.front) / 2);
    if (overlaps(ob)) return null;
    obbs.push(ob);
    const h = { def, x, z, yaw, floorY, minY, street, ob };
    placed.push(h);
    return h;
  }

  // weighted variant picker (avoid repeating the previous variant)
  let last = null;
  const pick = (maxW, prefShop) => {
    const cands = houseDefs.filter((d) => d.W <= maxW && d !== last);
    if (!cands.length) return null;
    let d = cands[Math.floor(R() * cands.length)];
    if (prefShop && !d.shop && R() < 0.5) { const sh = cands.filter((c) => c.shop); if (sh.length) d = sh[Math.floor(R() * sh.length)]; }
    last = d;
    return d;
  };

  // ---- plaza ring
  const ringArcs = [[-127, -63], [-40, -5], [18, 35], [110, 166], [-166, -149]];
  for (const [a0, a1] of ringArcs) {
    const rf = POI.plaza.r + 0.6;
    let a = a0 * Math.PI / 180;
    const aEnd = a1 * Math.PI / 180;
    let guard = 0;
    while (a < aEnd && guard++ < 50) {
      const remain = (aEnd - a) * rf;
      const d = pick(Math.min(9.8, remain), true);
      if (!d) break;
      const am = a + (d.W / 2) / rf;
      const x = POI.plaza.x + rf * Math.cos(am), z = POI.plaza.z + rf * Math.sin(am);
      const yaw = Math.atan2(-Math.cos(am), -Math.sin(am));
      const hh = tryHouse(d, x, z, yaw, 'plaza', { maxDrop: 9 });
      a += (hh ? d.W + 0.05 : 1.0) / rf;
    }
  }

  // ---- street rows
  for (const st of streets) {
    const L = polyLength(st.pts);
    for (const side of [1, -1]) {
      let s = st.kind === 'grand' ? 1 : 0.5;
      let guard = 0;
      while (s < L - 2 && guard++ < 200) {
        const d = pick(9.8, st.name === 'main' || st.name === 'market');
        if (!d) break;
        const sm = sampleAt(st.pts, s + d.W / 2);
        const off = st.w / 2 + 0.6;
        const x = sm.x + sm.nx * side * off, z = sm.z + sm.nz * side * off;
        // front faces the street: local +Z towards -normal*side
        const yaw = Math.atan2(-sm.nx * side, -sm.nz * side);
        const hh = tryHouse(d, x, z, yaw, st.name, { maxDrop: st.kind === 'grand' ? 10 : 8 });
        s += hh ? d.W + (R() < 0.15 ? 1.2 : 0.06) : 1.0;
      }
    }
  }

  // tints per house: neighbours differ
  const T = { roof: 8, plaster: 8, timber: 5, stone: 5, paint: 10 };
  let prev = {};
  for (const h of placed) {
    h.tint = {};
    for (const [k, nOpts] of Object.entries(T)) {
      let i = Math.floor(R() * nOpts);
      if (i === prev[k]) i = (i + 1) % nOpts;
      h.tint[k] = i; prev[k] = i;
    }
  }

  return { streets, ring, segs, towers, gates, houses: placed, rng: R };
}

// ------------------------------------------------------------------ OBB helpers (xz)
function makeOBB(cx, cz, yaw, hx, hz) {
  const c = Math.cos(yaw), s = Math.sin(yaw);
  return { cx, cz, ax: [c, -s], az: [s, c], hx, hz, r: Math.hypot(hx, hz) };
}

function satOverlap(A, B) {
  const axes = [A.ax, A.az, B.ax, B.az];
  const dx = B.cx - A.cx, dz = B.cz - A.cz;
  for (const [ux, uz] of axes) {
    const ra = A.hx * Math.abs(A.ax[0] * ux + A.ax[1] * uz) + A.hz * Math.abs(A.az[0] * ux + A.az[1] * uz);
    const rb = B.hx * Math.abs(B.ax[0] * ux + B.ax[1] * uz) + B.hz * Math.abs(B.az[0] * ux + B.az[1] * uz);
    if (Math.abs(dx * ux + dz * uz) > ra + rb) return false;
  }
  return true;
}
