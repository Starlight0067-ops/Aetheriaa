// AETHERIA player system (owner: player/physics): Rapier world, kinematic character controller, character visual,
// third-person camera. Entry point required by main.js: create(ctx) -> API.
import * as THREE from 'three';
import { POI, VIEWS, heightAt } from '../core/layout.js';
import { createPhysics } from '../physics/world.js';
import { createControls } from './controls.js';
import { PlayerController } from './controller.js';
import { CameraRig } from './camera.js';
import { createVisualHost } from './visual.js';
import { createStaminaHud } from './hud.js';
import { createTouch } from '../input/touch.js';

/** Horizontal clearance (m, capped at maxD) around a point, from 16 rays. */
function clearance(physics, x, y, z, maxD = 6) {
  let m = maxD;
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    const h = physics.raycast({ x, y, z }, { x: Math.cos(a), y: 0, z: Math.sin(a) }, maxD, { groups: physics.QUERY.CAMERA });
    if (h) m = Math.min(m, h.distance);
  }
  return m;
}

/** Most open walkable spot within `radius` of (x0, z0); stays at (x0, z0) when that is already roomy. */
function findOpenSpot(physics, controller, x0, z0, radius) {
  let best = { x: x0, z: z0 }, bestScore = -Infinity;
  const y0 = heightAt(x0, z0);
  if (!controller.overlapsAt(x0, y0 + 0.05, z0) && clearance(physics, x0, y0 + 1.2, z0) >= 4.5) return best;
  for (let dz = -radius; dz <= radius + 1e-6; dz += 0.5) {
    for (let dx = -radius; dx <= radius + 1e-6; dx += 0.5) {
      const d = Math.hypot(dx, dz);
      if (d > radius) continue;
      const x = x0 + dx, z = z0 + dz;
      const g = physics.groundAt(x, z, heightAt(x, z) + 40);
      const y = Math.max(g ? g.y : -Infinity, heightAt(x, z));
      if (g && g.normal && g.normal.y < 0.8) continue;
      if (controller.overlapsAt(x, y + 0.05, z)) continue;
      const c = Math.min(clearance(physics, x, y + 1.2, z), 4.5);
      const score = c - 0.35 * d;
      if (score > bestScore) { bestScore = score; best = { x, z }; }
      if (d === 0 && c >= 4.5) return best;
    }
  }
  return best;
}

/** Yaw (closest to 0 = facing north) for which a follow-view camera offset is clear of geometry. */
function clearShotYaw(physics, spawn, view) {
  const y = heightAt(spawn.x, spawn.z);
  const g = physics.groundAt(spawn.x, spawn.z, y + 40);
  const fy = Math.max(g ? g.y : -Infinity, y);
  let best = 0, bestScore = -Infinity;
  for (let i = 0; i < 24; i++) {
    const yaw = ((i % 2 ? 1 : -1) * Math.ceil(i / 2) * Math.PI) / 12;
    const c = Math.cos(yaw), s = Math.sin(yaw);
    const [ox, oy, oz] = view.offset, [lx, ly, lz] = view.look;
    const cam = { x: spawn.x + ox * c + oz * s, y: fy + oy, z: spawn.z - ox * s + oz * c };
    const look = { x: spawn.x + lx, y: fy + ly, z: spawn.z + lz };
    const dir = { x: cam.x - look.x, y: cam.y - look.y, z: cam.z - look.z };
    const len = Math.hypot(dir.x, dir.y, dir.z);
    const blocked = physics.sphereCast(look, dir, len + 0.3, 0.3, { groups: physics.QUERY.CAMERA });
    const room = Math.min(clearance(physics, cam.x, cam.y, cam.z, 4), 2.5);
    const score = (blocked ? -10 : 0) + room - 0.5 * Math.abs(yaw);
    if (score > bestScore) { bestScore = score; best = yaw; }
  }
  return best;
}

export async function create(ctx) {
  const { scene, params } = ctx;
  const physics = await createPhysics(ctx);
  ctx.systems.physics = physics;

  const root = new THREE.Group();
  root.name = 'player';
  scene.add(root);
  const visual = createVisualHost(ctx, root, 'kael');
  ctx.pending.push(visual.ready);

  ctx.touch = ctx.touch || createTouch(ctx);
  const controls = createControls(ctx);
  let cameraRig = null;
  const controller = new PlayerController(ctx, physics, root, visual, controls, () => (cameraRig ? cameraRig.moveYaw : 0));
  cameraRig = new CameraRig(ctx, physics, controller, controls);

  // Spawn near POI.spawn (the most open walkable spot within a few metres, so houses streamed around the street
  // never box the character or the camera in), facing north (-Z) toward the plaza, camera behind.
  const spawn = findOpenSpot(physics, controller, POI.spawn.x, POI.spawn.z, 4);
  const view = ctx.shot && VIEWS[params.get('view')];
  const followShot = view && view.follow === 'player';
  // Screenshot follow views (portrait / fullbody) place the camera at the root's local offset: turn the model to
  // face that camera so the shot shows the face (robust to either sign of the view offset), and pick the yaw
  // closest to north whose camera spot is clear of walls.
  const spawnYaw = followShot ? clearShotYaw(physics, spawn, view) : 0;
  controller.teleport(spawn.x, null, spawn.z, spawnYaw);
  cameraRig.yaw = spawnYaw;
  cameraRig.snap();
  if (followShot && view.offset[2] > 0) visual.model.rotation.y = Math.PI;

  const hud = ctx.shot || params.has('nohud') ? null : createStaminaHud(ctx, controller);

  let autotest = null;
  if (params.get('autotest')) {
    const mod = await import('./autotest.js');
    autotest = mod.createAutotest(ctx, () => api, params.get('autotest'));
  }

  const lookTarget = new THREE.Vector3();
  const stats = physics.stats;
  let frame = 0, lastColliderCount = stats.colliders;
  ctx.updaters.push((dt) => {
    const t0 = performance.now();
    autotest?.update(dt);                  // injects synthetic input before controls read it
    physics.update(dt);
    if (stats.colliders !== lastColliderCount) { lastColliderCount = stats.colliders; controller.unstick(); }  // streamed-in colliders on top of us
    controls.update(dt);
    controller.update(dt);
    cameraRig.update(dt);
    const phys = performance.now() - t0;
    stats.frameMs = stats.frameMs * 0.95 + phys * 0.05;
    if (frame > 120) stats.frameMsMax = Math.max(stats.frameMsMax, phys);
    // head look: in follow screenshots look at the camera; when idle in play, look where the camera looks
    if (followShot) visual.lookAt(ctx.camera.position);
    else if (controller.state === 'idle') {
      const cam = ctx.camera;
      cam.getWorldDirection(lookTarget);
      const ang = Math.abs(Math.atan2(Math.sin(cameraRig.yaw - controller.facing), Math.cos(cameraRig.yaw - controller.facing)));
      visual.lookAt(ang < 1.6 ? lookTarget.multiplyScalar(12).add(root.position).setY(root.position.y + 1.5) : null);
    } else visual.lookAt(null);
    visual.update(dt);
    hud?.update(dt);
    frame++;
  });

  const api = {
    object: root,
    physics,
    controller,
    camera: cameraRig,
    stamina: controller.stamina,
    controls,
    visual,
    get kcc() { return controller.kcc; },
    get position() { return controller.position; },
    get velocity() { return controller.actualVelocity; },
    get grounded() { return controller.grounded; },
    get state() { return controller.state; },
    get invulnerable() { return controller.invulnerable; },
    teleport: (x, y, z, yaw) => controller.teleport(x, y, z, yaw),
    setEnabled(on) { controller.enabled = on; controls.enabled = on; },
  };
  return api;
}
