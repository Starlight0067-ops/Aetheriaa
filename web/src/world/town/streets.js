// Cobbled streets, stair flights, curbs, retaining skirts and the plaza paving, generated on heightAt.
import * as THREE from 'three';
import { heightAt, POI } from '../../core/layout.js';
import { polyLength, sampleAt } from './plan.js';

class GeoBuf {
  constructor() { this.p = []; this.n = []; this.uv = []; this.c = []; this.i = []; }
  v(x, y, z, nx, ny, nz, u, w, c = 1) { this.p.push(x, y, z); this.n.push(nx, ny, nz); this.uv.push(u, w); this.c.push(c, c, c); return this.p.length / 3 - 1; }
  quad(a, b, c, d) { this.i.push(a, b, c, a, c, d); }
  /** flat quad from 4 points (counter-clockwise seen from the front), uv by world xz or wall coords */
  face(P, uvMode = 'xz', shade = 1) {
    const [a, b, c] = P;
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
    const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
    const ids = P.map((q, k) => {
      let u, w;
      if (uvMode === 'xz') { u = q[0]; w = q[2]; }
      else { u = Math.abs(nx) > Math.abs(nz) ? q[2] : q[0]; w = q[1]; }
      return this.v(q[0], q[1], q[2], nx, ny, nz, u, w, Array.isArray(shade) ? shade[k] : shade);
    });
    if (ids.length === 4) this.quad(...ids); else for (let k = 1; k < ids.length - 1; k++) this.i.push(ids[0], ids[k], ids[k + 1]);
  }
  /** like face() but flips the winding so the normal points along want=[x,y,z] */
  toward(P, want, uvMode = 'xz', shade = 1) {
    const [a, b, c] = P;
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
    const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    if (nx * want[0] + ny * want[1] + nz * want[2] < 0) {
      P = P.slice().reverse();
      if (Array.isArray(shade)) shade = shade.slice().reverse();
    }
    this.face(P, uvMode, shade);
  }
  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
    g.setIndex(this.i);
    g.computeBoundingSphere();
    return g;
  }
}

const RISE = 0.17;
const UP = [0, 1, 0];

/** Height profile along a street: max terrain across the width, stairs where steep. */
function profile(st, ds) {
  const L = polyLength(st.pts);
  const n = Math.max(2, Math.ceil(L / ds));
  const S = [];
  for (let i = 0; i <= n; i++) {
    const s = (i / n) * L;
    const m = sampleAt(st.pts, s);
    let h = -Infinity;
    for (const k of [-0.5, -0.25, 0, 0.25, 0.5]) h = Math.max(h, heightAt(m.x + m.nx * st.w * k, m.z + m.nz * st.w * k));
    S.push({ s, ...m, h: h + 0.08 });
  }
  // light smoothing, never below terrain
  for (let it = 0; it < 2; it++) {
    for (let i = 1; i < S.length - 1; i++) S[i].hs = Math.max(S[i].h, (S[i - 1].h + S[i].h * 2 + S[i + 1].h) / 4);
    for (let i = 1; i < S.length - 1; i++) S[i].h = S[i].hs;
  }
  // stairs: quantize where slope is steep
  for (let i = 0; i < S.length; i++) {
    const a = S[Math.max(0, i - 2)], b = S[Math.min(S.length - 1, i + 2)];
    const slope = Math.abs(b.h - a.h) / Math.max(0.01, b.s - a.s);
    S[i].steep = slope > 0.13 || st.kind === 'grand' && slope > 0.06;
  }
  for (const p of S) p.hq = p.steep ? Math.ceil(p.h / RISE) * RISE : p.h;
  return S;
}

export function buildStreets(streets, mats, opts = {}) {
  const top = new GeoBuf();      // cobbles
  const edge = new GeoBuf();     // curbs, risers, skirts (stone)
  const colliders = [];
  const ds = 0.5;
  for (const st of streets) {
    const S = profile(st, ds);
    const hw = st.w / 2;
    const col = new GeoBuf();
    for (let i = 0; i < S.length - 1; i++) {
      const a = S[i], b = S[i + 1];
      const ya = a.hq, yb = a.steep || b.steep ? a.hq : b.hq;   // treads are flat
      const L = (q, y, k) => [q.x + q.nx * hw * k, y, q.z + q.nz * hw * k];
      // tread
      top.toward([L(a, ya, -1), L(b, yb, -1), L(b, yb, 1), L(a, ya, 1)], UP);
      // riser to the next tread
      const yn = b.hq;
      if (Math.abs(yn - yb) > 0.01) {
        const lo = Math.min(yn, yb), hi = Math.max(yn, yb);
        const P = [L(b, lo, -1), L(b, lo, 1), L(b, hi, 1), L(b, hi, -1)];
        edge.toward(P, yn > yb ? [-b.tx, 0, -b.tz] : [b.tx, 0, b.tz], 'wall', 0.85);
        // stone nosing strip
        const sg = yn > yb ? 1 : -1;
        edge.toward([L(b, hi + 0.02, -1), L(b, hi + 0.02, 1), [b.x + b.nx * hw + sg * b.tx * 0.12, hi + 0.02, b.z + b.nz * hw + sg * b.tz * 0.12], [b.x - b.nx * hw + sg * b.tx * 0.12, hi + 0.02, b.z - b.nz * hw + sg * b.tz * 0.12]], UP, 'xz', 1.05);
      }
      // curbs + skirts on both sides
      for (const side of [-1, 1]) {
        const cw = st.kind === 'grand' ? 0.55 : 0.28, chh = st.kind === 'grand' ? 0.75 : 0.14;
        const o0 = hw, o1 = hw + cw;
        const P = (q, y, o) => [q.x + q.nx * o * side, y, q.z + q.nz * o * side];
        const ta = ya + chh, tb = yb + chh;
        // curb top
        let F = [P(a, ta, o0), P(b, tb, o0), P(b, tb, o1), P(a, ta, o1)];
        edge.toward(F, UP, 'xz', 1.0);
        // inner face
        F = [P(a, ya, o0), P(b, yb, o0), P(b, tb, o0), P(a, ta, o0)];
        edge.toward(F, [-a.nx * side, 0, -a.nz * side], 'wall', 0.9);
        // outer skirt down into the ground
        const ga = Math.min(heightAt(...[P(a, 0, o1)[0], P(a, 0, o1)[2]]), ya) - 0.6;
        const gb = Math.min(heightAt(...[P(b, 0, o1)[0], P(b, 0, o1)[2]]), yb) - 0.6;
        F = [P(a, ga, o1), P(b, gb, o1), P(b, tb, o1), P(a, ta, o1)];
        edge.toward(F, [a.nx * side, 0, a.nz * side], 'wall', [0.7, 0.7, 1, 1]);
        // end caps between steps
        if (Math.abs(yn - yb) > 0.01) {
          const lo = Math.min(yn, yb) + chh, hi = Math.max(yn, yb) + chh;
          const G = [P(b, lo, o0), P(b, lo, o1), P(b, hi, o1), P(b, hi, o0)];
          edge.toward(G, yn > yb ? [-b.tx, 0, -b.tz] : [b.tx, 0, b.tz], 'wall', 0.85);
        }
      }
      // collider: smooth ramp strip (every 2 m)
      if (i % 4 === 0) {
        const j = Math.min(S.length - 1, i + 4), c = S[j];
        col.toward([[a.x - a.nx * hw, a.h, a.z - a.nz * hw], [c.x - c.nx * hw, c.h, c.z - c.nz * hw], [c.x + c.nx * hw, c.h, c.z + c.nz * hw], [a.x + a.nx * hw, a.h, a.z + a.nz * hw]], UP);
      }
    }
    if (st.kind === 'grand' || S.some((p) => p.steep)) {
      const m = new THREE.Mesh(col.geometry());
      m.name = 'collider_' + st.name;
      colliders.push({ kind: 'mesh', object: m });
    }
  }
  const meshes = [new THREE.Mesh(top.geometry(), mats.cobble), new THREE.Mesh(edge.geometry(), mats.stone)];
  for (const m of meshes) { m.receiveShadow = true; m.castShadow = false; }
  meshes[1].castShadow = true;
  return { meshes, colliders };
}

/** Plaza paving disc with a hexagon rosette around the fountain, curb ring and steps where the ground drops. */
export function buildPlaza(mats) {
  const { x: cx, z: cz, y, r } = POI.plaza;
  const pave = new GeoBuf();
  const deco = new GeoBuf();
  const R = r - 0.2, N = 72;
  const rings = [0, 6.2, 7.4, 11, 15, 19, R];
  for (let j = 0; j < rings.length - 1; j++) {
    for (let i = 0; i < N; i++) {
      const a0 = (i / N) * Math.PI * 2, a1 = ((i + 1) / N) * Math.PI * 2;
      const r0 = rings[j], r1 = rings[j + 1];
      const P = [[cx + r0 * Math.cos(a0), y + 0.04, cz + r0 * Math.sin(a0)], [cx + r0 * Math.cos(a1), y + 0.04, cz + r0 * Math.sin(a1)],
        [cx + r1 * Math.cos(a1), y + 0.04, cz + r1 * Math.sin(a1)], [cx + r1 * Math.cos(a0), y + 0.04, cz + r1 * Math.sin(a0)]];
      const shade = j === 1 ? 1.15 : (i % 12 < 1 && j > 2 ? 0.88 : 1);
      if (r0 === 0) pave.toward([P[0], P[3], P[2]], UP, 'xz', shade); else pave.toward(P, UP, 'xz', shade);
    }
  }
  // raised hexagon bands (light stone) around the fountain + radial hex medallions
  const hexBand = (r0, r1, h, rot = Math.PI / 6) => {
    for (let k = 0; k < 6; k++) {
      const a0 = rot + k * Math.PI / 3, a1 = rot + (k + 1) * Math.PI / 3;
      const p = (rr, a, yy) => [cx + rr * Math.cos(a), yy, cz + rr * Math.sin(a)];
      deco.toward([p(r0, a0, y + h), p(r0, a1, y + h), p(r1, a1, y + h), p(r1, a0, y + h)], UP, 'xz', 1.1);
      const am = (a0 + a1) / 2;
      deco.toward([p(r1, a0, y), p(r1, a1, y), p(r1, a1, y + h), p(r1, a0, y + h)], [Math.cos(am), 0, Math.sin(am)], 'wall', 0.9);
    }
  };
  hexBand(6.4, 7.2, 0.07);
  hexBand(10.6, 11.0, 0.05, 0);
  for (let k = 0; k < 6; k++) {
    const a = k * Math.PI / 3 + Math.PI / 6;
    const mx = cx + 15 * Math.cos(a), mz = cz + 15 * Math.sin(a);
    for (let q = 0; q < 6; q++) {
      const b0 = q * Math.PI / 3, b1 = (q + 1) * Math.PI / 3;
      deco.toward([[mx, y + 0.06, mz], [mx + 1.1 * Math.cos(b1), y + 0.06, mz + 1.1 * Math.sin(b1)], [mx + 1.1 * Math.cos(b0), y + 0.06, mz + 1.1 * Math.sin(b0)]], UP, 'xz', 1.12);
    }
  }
  // curb ring + skirt to the terrain outside
  for (let i = 0; i < N; i++) {
    const a0 = (i / N) * Math.PI * 2, a1 = ((i + 1) / N) * Math.PI * 2;
    const p = (rr, a, yy) => [cx + rr * Math.cos(a), yy, cz + rr * Math.sin(a)];
    const am = (a0 + a1) / 2, out = [Math.cos(am), 0, Math.sin(am)];
    deco.toward([p(R, a0, y + 0.22), p(R, a1, y + 0.22), p(R + 0.5, a1, y + 0.22), p(R + 0.5, a0, y + 0.22)], UP, 'xz', 1.0);
    deco.toward([p(R, a0, y), p(R, a1, y), p(R, a1, y + 0.22), p(R, a0, y + 0.22)], [-out[0], 0, -out[2]], 'wall', 0.9);
    const g0 = Math.min(heightAt(...[p(R + 0.5, a0, 0)[0], p(R + 0.5, a0, 0)[2]]), y) - 0.5;
    const g1 = Math.min(heightAt(...[p(R + 0.5, a1, 0)[0], p(R + 0.5, a1, 0)[2]]), y) - 0.5;
    deco.toward([p(R + 0.5, a0, g0), p(R + 0.5, a1, g1), p(R + 0.5, a1, y + 0.22), p(R + 0.5, a0, y + 0.22)], out, 'wall', [0.7, 0.7, 1, 1]);
  }
  const m1 = new THREE.Mesh(pave.geometry(), mats.cobble);
  const m2 = new THREE.Mesh(deco.geometry(), mats.stone);
  m1.receiveShadow = m2.receiveShadow = true;
  return [m1, m2];
}
