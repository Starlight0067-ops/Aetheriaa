// Vael Harrow townsfolk (orchestrator-owned). Free CC0 VRoid characters placed around the plaza,
// each with an ambient animation; Toma strolls around the fountain; Veyra watches from the bridge.
import * as THREE from 'three';
import { POI, heightAt } from '../core/layout.js';
import { createCharacter } from '../characters/index.js';

const CAST = [
  { id: 'lyra',  x: 5,   z: 8,   face: [0, 15], anim: 'wave' },
  { id: 'maren', x: 9,   z: -12, face: [4, -2], anim: 'talk' },
  { id: 'hesk',  x: 13,  z: -7,  face: [9, -11], anim: 'talk' },
  { id: 'wenna', x: -13, z: 5,   face: [0, 4],  anim: 'idle' },
  { id: 'ostin', x: -9,  z: -11, face: [-2, -3], anim: 'idle' },
  { id: 'toma',  walk: { r: 9.5, speed: 0.15 } },
  { id: 'veyra', x: -97, z: 3, y: POI.bridge.deckY, face: [-60, 3], anim: 'idle' },
];

const yawTo = (fx, fz, x, z) => Math.atan2(-(fx - x), -(fz - z));   // characters face -Z at yaw 0

export async function create(ctx) {
  const low = ctx.quality.name === 'low';
  const list = low ? CAST.filter((c) => ['lyra', 'maren', 'toma'].includes(c.id)) : CAST;
  const npcs = [];
  const load = Promise.all(list.map(async (c) => {
    try {
      const ch = await createCharacter(ctx, c.id, { npc: true, shadows: !low });
      if (!c.walk) {
        ch.object.position.set(c.x, c.y ?? heightAt(c.x, c.z), c.z);
        ch.object.rotation.y = yawTo(c.face[0], c.face[1], c.x, c.z);
        ch.play(c.anim, { loop: true, fade: 0 });
      }
      ctx.scene.add(ch.object);
      npcs.push({ c, ch, phase: Math.random() * 6 });
    } catch (e) { console.warn('[npcs] failed to load', c.id, e); }
  }));
  ctx.pending.push(load);
  await load;

  let t = 0;
  ctx.updaters.push((dt) => {
    t += dt;
    for (const n of npcs) {
      const o = n.ch.object;
      if (n.c.walk) {
        const { r, speed } = n.c.walk;
        const a = n.phase + t * speed;
        const x = Math.cos(a) * r, z = Math.sin(a) * r;
        o.position.set(x, heightAt(x, z), z);
        o.rotation.y = Math.atan2(Math.sin(a), -Math.cos(a));   // tangent direction (counter-clockwise)
        n.ch.setLocomotion(r * speed, true, 0);
      }
      // hide far NPCs (draw calls), and let eyes/head follow the camera when it comes close
      const d2 = o.position.distanceToSquared(ctx.camera.position);
      o.visible = d2 < (low ? 45 * 45 : 90 * 90);
      n.ch.lookAt(d2 < 64 ? ctx.camera : null);
    }
  });
  return { npcs };
}
