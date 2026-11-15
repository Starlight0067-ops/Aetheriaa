// Lightweight visual effects: pooled emissive particles, expanding rings, glowing projectiles.
import * as THREE from 'three';

export function createFx(ctx) {
  const { scene } = ctx;
  const geo = new THREE.IcosahedronGeometry(0.5, 0);
  const ringGeo = new THREE.RingGeometry(0.86, 1, 40);
  ringGeo.rotateX(-Math.PI / 2);
  const parts = [], rings = [], bolts = [];
  const free = [];
  const mat = (c, op = 1) => new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(1.6), transparent: true, opacity: op, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });

  function particle() {
    const m = free.pop() || new THREE.Mesh(geo, mat('#fff'));
    if (!m.parent) scene.add(m);
    m.visible = true; return m;
  }
  /** Burst of n sparks at p with colour; speed in m/s, size in m. */
  function burst(p, color, n = 10, speed = 4, size = 0.14, life = 0.5, up = 1) {
    for (let i = 0; i < n; i++) {
      const m = particle(); m.material = m.material.userData.c === color ? m.material : Object.assign(mat(color), { userData: { c: color } });
      m.position.copy(p);
      const a = Math.random() * Math.PI * 2, e = Math.random() * 0.9, s = speed * (0.4 + Math.random() * 0.8);
      parts.push({ m, vx: Math.cos(a) * s, vy: Math.sin(e) * s * up + 0.5, vz: Math.sin(a) * s, life, max: life, size: size * (0.6 + Math.random() * 0.8) });
    }
  }
  function ring(p, color, radius, dur = 0.45, y = 0.15) {
    const m = new THREE.Mesh(ringGeo, mat(color, 0.9));
    m.position.set(p.x, p.y + y, p.z); m.scale.setScalar(0.2); scene.add(m);
    rings.push({ m, radius, t: 0, dur });
  }
  /** Glowing orb travelling along dir; onHit(pos) is called when update() reports contact via the callback. */
  function bolt(p, dir, color, speed, range, size, step) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(size, 10, 8), mat(color, 1));
    m.position.copy(p); scene.add(m);
    const b = { m, dir: dir.clone(), speed, left: range, color, step };
    bolts.push(b); return b;
  }
  function update(dt) {
    for (let i = parts.length - 1; i >= 0; i--) {
      const q = parts[i]; q.life -= dt;
      if (q.life <= 0) { q.m.visible = false; free.push(q.m); parts.splice(i, 1); continue; }
      q.vy -= 6 * dt;
      q.m.position.x += q.vx * dt; q.m.position.y += q.vy * dt; q.m.position.z += q.vz * dt;
      q.m.scale.setScalar(q.size * (q.life / q.max) * 2);
    }
    for (let i = rings.length - 1; i >= 0; i--) {
      const r = rings[i]; r.t += dt; const k = r.t / r.dur;
      if (k >= 1) { scene.remove(r.m); r.m.material.dispose(); rings.splice(i, 1); continue; }
      r.m.scale.setScalar(Math.max(0.2, r.radius * (1 - Math.pow(1 - k, 3))));
      r.m.material.opacity = 0.9 * (1 - k);
    }
    for (let i = bolts.length - 1; i >= 0; i--) {
      const b = bolts[i], d = b.speed * dt;
      b.m.position.addScaledVector(b.dir, d); b.left -= d;
      burst(b.m.position, b.color, 1, 0.8, 0.1, 0.3, 0.2);
      const hit = b.step?.(b.m.position);
      if (hit || b.left <= 0) { scene.remove(b.m); b.m.geometry.dispose(); b.m.material.dispose(); bolts.splice(i, 1); }
    }
  }
  return { burst, ring, bolt, update, get count() { return parts.length + rings.length + bolts.length; } };
}
