// Render-owner look-dev showcase (only loaded for ?view=r_test*). One sample per toon kind + outlines.
import { createToonMaterial, createOutline } from './toon.js';

export function buildShowcase(ctx) {
  const { THREE, scene } = ctx;
  const g = new THREE.Group();
  g.position.set(0, 22, 0);
  const kinds = [
    ['plaster', 0xf1e6d0], ['roof', 0xd0603a], ['wood', 0x5e3d27], ['stone', 0xb9b2a5],
    ['cloth', 0x2b9c9a], ['metal', 0xe2b95b], ['skin', 0xf6d9c4], ['hair', 0x3a2b4a],
    ['foliage', 0x5aa83c], ['glow', 0x7ff5ff],
  ];
  kinds.forEach(([kind, color], i) => {
    const x = (i % 5) * 2.2 - 4.4, z = Math.floor(i / 5) * 2.4 - 1.2;
    const geo = i % 2 ? new THREE.SphereGeometry(0.7, 40, 24) : new THREE.BoxGeometry(1.1, 1.1, 1.1);
    if (kind === 'foliage') {
      const pos = geo.attributes.position, sn = new Float32Array(pos.count * 3);
      for (let k = 0; k < pos.count; k++) {
        const v = new THREE.Vector3(pos.getX(k), pos.getY(k), pos.getZ(k)).normalize();
        sn.set([v.x, v.y, v.z], k * 3);
      }
      geo.setAttribute('sphereNormal', new THREE.BufferAttribute(sn, 3));
    }
    const m = new THREE.Mesh(geo, createToonMaterial({ kind, color }));
    m.position.set(x, 0.75, z);
    m.castShadow = m.receiveShadow = true;
    g.add(m);
    const o = createOutline(m, 0.025, 0x2a1e2e);
    if (o) g.add(o);
  });
  // instanced crates with outlines
  const inst = new THREE.InstancedMesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), createToonMaterial({ kind: 'wood', color: 0x9a6a40 }), 6);
  const mtx = new THREE.Matrix4();
  for (let i = 0; i < 6; i++) { mtx.makeRotationY(i * 0.7).setPosition(-4 + i * 1.6, 0.25, 3.2); inst.setMatrixAt(i, mtx); }
  inst.castShadow = inst.receiveShadow = true;
  g.add(inst);
  const io = createOutline(inst, 0.02, 0x2a1e2e);
  if (io) g.add(io);
  // a tall wall to show cast shadows and the terminator on big planes
  const wall = new THREE.Mesh(new THREE.BoxGeometry(6, 4, 0.6), createToonMaterial({ kind: 'plaster', color: 0xe8d8bc }));
  wall.position.set(4, 2, -4); wall.rotation.y = 0.5; wall.castShadow = wall.receiveShadow = true;
  g.add(wall);
  scene.add(g);
}
