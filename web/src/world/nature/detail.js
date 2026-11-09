// Ground-level detail from the CC0 Quaternius nature kit: flowering bushes, ferns, plants, flower clumps,
// clover, mushrooms around forest trunks, pebbles along paths and banks, stepping-stone trails and
// medium rocks. Placement is deterministic and respects paths, water, town and the screenshot framing.
import * as THREE from 'three';
import { POI, RIVER, heightAt } from '../../core/layout.js';
import { mulberry32, hash2i, vnoise } from './common.js';
import { loadKitModel, ModelLayer } from './freemodels.js';
import { forestField, heightFast, slopeAt, splatAt, pathDist, streetDist, inTown, dTown, waterLevelAt, nearBridge, PATHS } from './worlddata.js';
import { TOWN } from '../../core/layout.js';

const V3 = THREE.Vector3;
const UP = new V3(0, 1, 0);

export async function createKitDetail(ctx, trees) {
  const low = ctx.quality.name === 'low';
  const D = low ? 0.55 : 1; // distance multiplier
  const dens = low ? 0.5 : 1;
  const names = ['Bush_Common_Flowers', 'Bush_Common', 'Fern_1', 'Plant_1', 'Plant_7_Big', 'Mushroom_Common', 'Flower_3_Group', 'Flower_4_Group',
    'Clover_1', 'Clover_2', 'Pebble_Round_1', 'Pebble_Round_3', 'Pebble_Square_2', 'Pebble_Square_5', 'RockPath_Round_Small_1', 'RockPath_Round_Small_2',
    'RockPath_Square_Small_1', 'RockPath_Square_Small_3', 'Rock_Medium_1', 'Rock_Medium_2', 'Rock_Medium_3'];
  const models = {};
  await Promise.all(names.map(async (n) => {
    try { models[n] = await loadKitModel(ctx, n, { tint: /Bush|Fern|Plant|Clover/.test(n) ? [1.05, 1.12, 0.9] : [1, 1, 1] }); }
    catch (e) { console.warn('[nature] kit model failed', n, e); }
  }));
  const group = new THREE.Group();
  group.name = 'nature-kit-detail';
  ctx.scene.add(group);
  const layers = {};
  const L = (name, opts) => { if (!models[name]) return null; if (!layers[name]) layers[name] = new ModelLayer(group, models[name], opts); return layers[name]; };
  const rnd = mulberry32(777);
  const ok = (x, z, o = {}) => {
    if (Math.abs(x) > 316 || Math.abs(z) > 316) return false;
    if (!o.town && (inTown(x, z) || (dTown(x, z) < TOWN.radius + 3 && x > -112))) return false;
    if (pathDist(x, z) < (o.path ?? 1.4) || streetDist(x, z) < 2.5) return false;
    if (nearBridge(x, z, o.bridge ?? 1)) return false;
    for (const w of POI.windmills) if (Math.hypot(x - w.x, z - w.z) < 10) return false;
    if (Math.hypot(x - POI.core.x, z - POI.core.z) < 45) return false;
    if (!o.water && heightFast(x, z) < waterLevelAt(x, z) + 0.25) return false;
    if (slopeAt(x, z) > (o.slope ?? 0.42)) return false;
    return true;
  };
  const tint = (a = 0.15) => new THREE.Color(1 - a / 2 + rnd() * a, 1 - a / 2 + rnd() * a, 1 - a / 2 + rnd() * a);
  const tilt = (x, z, amt = 1) => {
    const e = 0.6, hx = heightAt(x + e, z) - heightAt(x - e, z), hz = heightAt(x, z + e) - heightAt(x, z - e);
    return new THREE.Quaternion().setFromUnitVectors(UP, new V3(-hx, 2 * e, -hz).normalize().lerp(UP, 1 - amt).normalize());
  };
  const put = (layer, x, z, s, o = {}) => { if (layer) layer.add(x, heightAt(x, z) - (o.sink ?? 0.05) * s, z, rnd() * 6.283, s * (o.sx ?? 1), s * (o.sy ?? 1), s * (o.sz ?? 1), o.color || tint(), o.tilt ? tilt(x, z, o.tilt) : null); };

  const bushF = L('Bush_Common_Flowers', { maxDist: 170 * D, castShadow: !low });
  const bush = L('Bush_Common', { maxDist: 170 * D, castShadow: !low });
  const fern = L('Fern_1', { maxDist: 95 * D });
  const plantA = L('Plant_1', { maxDist: 80 * D });
  const plantB = L('Plant_7_Big', { maxDist: 70 * D });
  const mush = L('Mushroom_Common', { maxDist: 45 * D });
  const flA = L('Flower_3_Group', { maxDist: 75 * D });
  const flB = L('Flower_4_Group', { maxDist: 75 * D });
  const clo = [L('Clover_1', { maxDist: 50 * D }), L('Clover_2', { maxDist: 50 * D })];
  const peb = ['Pebble_Round_1', 'Pebble_Round_3', 'Pebble_Square_2', 'Pebble_Square_5'].map((n) => L(n, { maxDist: 45 * D }));
  const step = ['RockPath_Round_Small_1', 'RockPath_Round_Small_2', 'RockPath_Square_Small_1', 'RockPath_Square_Small_3'].map((n) => L(n, { maxDist: 95 * D }));
  const rocks = ['Rock_Medium_1', 'Rock_Medium_2', 'Rock_Medium_3'].map((n) => L(n, { maxDist: 220 * D, castShadow: true }));
  const pick = (arr) => arr[(rnd() * arr.length) | 0];

  // --- grid passes over the countryside
  const C = 5;
  for (let gz = -316; gz < 316; gz += C) for (let gx = -316; gx < 316; gx += C) {
    const ci = Math.round(gx / C), cj = Math.round(gz / C);
    const x = gx + (hash2i(ci, cj, 301) - 0.5) * C, z = gz + (hash2i(ci, cj, 302) - 0.5) * C;
    const r = hash2i(ci, cj, 303);
    if (r > 0.42 * dens) continue; // most cells empty: cheap early-out
    const s = splatAt(x, z);
    if (s.town > 0.3 || s.cobble > 0.2) continue;
    const f = Math.max(s.forest, forestField(x, z) * 0.6);
    const meadow = s.meadow;
    const rr = r / (0.42 * dens);
    if (f > 0.35) {
      if (!ok(x, z, { path: 1.8 })) continue;
      if (rr < 0.38) put(fern, x, z, 0.26 + rnd() * 0.14, { sink: 0.1 });
      else if (rr < 0.55) put(rnd() < 0.5 ? plantA : plantB, x, z, 0.8 + rnd() * 0.6);
      else if (rr < 0.62) put(rnd() < 0.6 ? bush : bushF, x, z, 0.9 + rnd() * 0.5);
      else if (rr < 0.66) put(pick(rocks), x, z, 0.5 + rnd() * 0.6, { sink: 0.18, tilt: 0.6 });
    } else if (f > 0.08) { // forest edge
      if (!ok(x, z, { path: 2 })) continue;
      if (rr < 0.22) put(rnd() < 0.55 ? bushF : bush, x, z, 0.9 + rnd() * 0.55);
      else if (rr < 0.36) put(fern, x, z, 0.22 + rnd() * 0.1, { sink: 0.1 });
      else if (rr < 0.46) put(rnd() < 0.5 ? flA : flB, x, z, 0.36 + rnd() * 0.14);
    } else {
      if (!ok(x, z)) continue;
      const patch = vnoise(x * 0.08, z * 0.08, 41);
      if (meadow > 0.35 && patch > 0.5 && rr < 0.5) put(rnd() < 0.5 ? flA : flB, x, z, 0.34 + rnd() * 0.16);
      else if (meadow > 0.2 && rr < 0.62 && patch < 0.4) put(pick(clo), x, z, 0.38 + rnd() * 0.2);
      else if (rr > 0.96) put(pick(rocks), x, z, 0.45 + rnd() * 0.7, { sink: 0.2, tilt: 0.6 });
      else if (rr > 0.93 && s.damp > 0.2) put(rnd() < 0.5 ? plantA : plantB, x, z, 0.7 + rnd() * 0.4);
    }
  }
  // --- mushrooms around forest trunks
  for (const t of trees) {
    if (rnd() > 0.2 * dens) continue;
    if (forestField(t.x, t.z) < 0.25) continue;
    const n = 2 + ((rnd() * 3) | 0);
    for (let k = 0; k < n; k++) {
      const a = rnd() * 6.283, d = 0.7 + rnd() * 1.4, x = t.x + Math.cos(a) * d, z = t.z + Math.sin(a) * d;
      if (!ok(x, z, { slope: 0.5 })) continue;
      put(mush, x, z, 0.6 + rnd() * 0.6, { sink: 0.02 });
    }
  }
  // --- pebbles along path edges, stepping stones on the footpaths
  PATHS.forEach((p, pi) => {
    for (let i = 0; i < p.pts.length - 1; i++) {
      const [x0, z0] = p.pts[i], [x1, z1] = p.pts[i + 1];
      const dx = x1 - x0, dz = z1 - z0, len = Math.hypot(dx, dz) || 1;
      const nx = -dz / len, nz = dx / len;
      for (let d = 0; d < len; d += 1.6) {
        const cx = x0 + dx * d / len, cz = z0 + dz * d / len;
        if (rnd() < 0.55 * dens) {
          const side = rnd() < 0.5 ? -1 : 1, off = p.width * 0.5 + (rnd() - 0.3) * 0.9;
          const x = cx + nx * off * side, z = cz + nz * off * side;
          if (!inTown(x, z) && !nearBridge(x, z, 0)) put(pick(peb), x, z, 0.9 + rnd() * 0.9, { sink: 0.03, tilt: 0.8 });
        }
        if ((pi === 2 || pi === 6) && rnd() < 0.85) { // footpaths become stepping-stone trails
          const off = (rnd() - 0.5) * p.width * 0.45;
          const x = cx + nx * off, z = cz + nz * off;
          if (!inTown(x, z) && !nearBridge(x, z, 0)) put(pick(step), x, z, 0.95 + rnd() * 0.3, { sink: 0.04, tilt: 1 });
        }
      }
    }
  });
  // --- pebbles and plants on the river banks
  for (let si = 0; si < RIVER.length - 1; si++) {
    const [ax, az] = RIVER[si], [bx, bz] = RIVER[si + 1];
    const len = Math.hypot(bx - ax, bz - az), nx = -(bz - az) / len, nz = (bx - ax) / len;
    for (let d = 0; d < len; d += 3) for (const side of [-1, 1]) {
      if (rnd() > 0.5 * dens) continue;
      const off = 11 + rnd() * 10;
      const x = ax + (bx - ax) * d / len + nx * off * side, z = az + (bz - az) * d / len + nz * off * side;
      if (Math.abs(x) > 316 || Math.abs(z) > 316 || nearBridge(x, z, 0)) continue;
      const h = heightFast(x, z), wl = waterLevelAt(x, z);
      if (h < wl - 0.3 || h > wl + 3.5) continue;
      if (h < wl + 1.2) put(pick(peb), x, z, 1.0 + rnd() * 1.2, { sink: 0.03, tilt: 0.8, color: new THREE.Color(0.9, 0.93, 0.97) });
      else if (rnd() < 0.5) put(rnd() < 0.5 ? plantA : plantB, x, z, 0.7 + rnd() * 0.5);
    }
  }

  const list = Object.values(layers);
  for (const l of list) l.finalize();
  console.log('[nature] kit detail:', list.map((l) => `${l.model.name}:${l.items.length}`).join(' '));
  return {
    group, layers: list,
    update(p, frustum, sphere) { for (const l of list) l.update(p, frustum, sphere); },
  };
}
