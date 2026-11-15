// Lock-on: Tab / button fixes the nearest on-screen enemy, Q (or the on-screen chip) cycles, camera frames the target.
import * as THREE from 'three';
import { dampAngle, yawOf, damp } from '../player/math.js';

export function createLock(G) {
  const L = { target: null };
  const v = new THREE.Vector3();
  const cam = G.ctx.camera;
  function candidates() {
    const p = G.player.position, out = [];
    cam.updateMatrixWorld();
    for (const e of G.enemies.list) {
      if (e.dead || !e.g.visible) continue;
      const d = Math.hypot(e.pos.x - p.x, e.pos.z - p.z); if (d > 28) continue;
      v.set(e.pos.x, e.pos.y + e.top * 0.5, e.pos.z).project(cam);
      if (v.z > 1 || Math.abs(v.x) > 1 || Math.abs(v.y) > 1) continue;
      out.push({ e, d, sx: v.x });
    }
    return out.sort((a, b) => a.d - b.d);
  }
  L.set = (e) => { L.target = e; G.ui.reticle.show(!!e); };
  L.clear = () => L.set(null);
  L.toggle = () => {
    if (L.target) return L.clear();
    const c = candidates(); if (c.length) { L.set(c[0].e); G.sfx('ui'); }
  };
  L.next = () => {
    if (!L.target) return L.toggle();
    const c = candidates().sort((a, b) => a.sx - b.sx); if (c.length < 2) return;
    const i = c.findIndex((x) => x.e === L.target); L.set(c[(i + 1) % c.length].e); G.sfx('ui');
  };
  L.update = (dt) => {
    const t = L.target; if (!t) return;
    const p = G.player.position;
    if (t.dead || Math.hypot(t.pos.x - p.x, t.pos.z - p.z) > 34) { const c = candidates().filter((x) => x.d < 14); if (c.length) L.set(c[0].e); else L.clear(); return; }
    // camera: sit behind the player on the player->target line, tilt to keep both in frame
    const rig = G.player.camera, dx = t.pos.x - p.x, dz = t.pos.z - p.z, d = Math.hypot(dx, dz);
    if (Math.abs(G.player.controls.state.lookX) < 3) rig.yaw = dampAngle(rig.yaw, yawOf(dx, dz), 5, dt);
    rig.elev = damp(rig.elev, 0.3 + Math.max(0, 6 - d) * 0.03, 3, dt);
  };
  L.place = () => { const t = L.target; if (t) G.ui.reticle.place(v.set(t.pos.x, t.pos.y + t.top * 0.55, t.pos.z)); };
  return L;
}
