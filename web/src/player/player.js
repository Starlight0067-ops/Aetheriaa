// AETHERIA player system (owner: player/physics): Rapier world, kinematic character controller, character visual,
// third-person camera. Entry point required by main.js: create(ctx) -> API.
import * as THREE from 'three';
import { POI, VIEWS } from '../core/layout.js';
import { createPhysics } from '../physics/world.js';
import { createControls } from './controls.js';
import { PlayerController } from './controller.js';
import { CameraRig } from './camera.js';
import { createVisualHost } from './visual.js';
import { createStaminaHud } from './hud.js';

export async function create(ctx) {
  const { scene, params } = ctx;
  const physics = await createPhysics(ctx);
  ctx.systems.physics = physics;

  const root = new THREE.Group();
  root.name = 'player';
  scene.add(root);
  const visual = createVisualHost(ctx, root, 'kael');
  ctx.pending.push(visual.ready);

  const controls = createControls(ctx);
  let cameraRig = null;
  const controller = new PlayerController(ctx, physics, root, visual, controls, () => (cameraRig ? cameraRig.moveYaw : 0));
  cameraRig = new CameraRig(ctx, physics, controller, controls);

  // Spawn at POI.spawn facing north (-Z) toward the plaza, camera behind.
  controller.teleport(POI.spawn.x, null, POI.spawn.z, 0);
  cameraRig.yaw = 0;
  cameraRig.snap();

  // Screenshot follow views (portrait / fullbody) place the camera at the root's local offset: turn the model to
  // face that camera so the shot shows the face (robust to either sign of the view offset).
  const view = ctx.shot && VIEWS[params.get('view')];
  const followShot = view && view.follow === 'player';
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
