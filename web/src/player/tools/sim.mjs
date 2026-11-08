// Headless Node simulation of physics + controller + camera (no browser, no rendering).
// Usage: node src/player/tools/sim.mjs
import * as THREE from 'three';
import { createPhysics } from '../../physics/world.js';
import { PlayerController } from '../controller.js';
import { CameraRig } from '../camera.js';
import { POI, heightAt, WORLD } from '../../core/layout.js';

globalThis.performance ??= { now: () => Date.now() };
const keys = new Set(), pressed = new Set();
const input = { keys, mouse: { dx: 0, dy: 0, wheel: 0, buttons: new Set(), clicked: new Set() },
  down: (c) => keys.has(c), justPressed: (c) => pressed.has(c), clicked: () => false, gamepad: () => null };
const ctx = { THREE, scene: new THREE.Scene(), camera: new THREE.PerspectiveCamera(55, 16 / 9, 0.1, 900), params: new URLSearchParams(),
  shot: false, colliders: [{ kind: 'heightfield', heightAt, size: WORLD.half * 2, resolution: 200 }], pending: [], systems: {}, cameraLocked: false, time: 0, input };
const physics = await createPhysics(ctx);
const root = new THREE.Group();
const visual = { pivot: new THREE.Group(), play: (n) => events.push(n), setLocomotion() {}, update() {}, lookAt() {} };
root.add(visual.pivot);
const events = [];
const c = { moveX: 0, moveY: 0, moveMag: 0, lookX: 0, lookY: 0, padLookX: 0, padLookY: 0, zoom: 0, jumpPressed: false, jumpHeld: false,
  dodgePressed: false, dodgeHeld: false, sprintHeld: false, walk: false, recenterPressed: false, gamepad: false, cameraIdle: 99 };
const controls = { state: c };
let rig;
const P = new PlayerController(ctx, physics, root, visual, controls, () => rig.moveYaw);
rig = new CameraRig(ctx, physics, P, controls);
P.teleport(POI.spawn.x, null, POI.spawn.z, 0); rig.snap();
const dt = 1 / 60;
const tick = (n = 1) => { for (let i = 0; i < n; i++) { ctx.time += dt; physics.update(dt); P.update(dt); rig.update(dt); c.jumpPressed = c.dodgePressed = false; } };
const f = (v) => +v.toFixed(3);
const show = (label) => console.log(label.padEnd(18), 'pos', [f(P.position.x), f(P.position.y), f(P.position.z)], 'dev', f(P.position.y - heightAt(P.position.x, P.position.z)),
  'mode', P.mode, 'gr', P.grounded, 'spd', f(Math.hypot(P.actualVelocity.x, P.actualVelocity.z)), 'yaw', f(P.facing), 'stam', f(P.stamina.value), 'cam', ctx.camera.position.toArray().map(f));
tick(30); show('spawn');
c.moveY = 1; c.moveMag = 1; tick(90); show('run 1.5s');
c.sprintHeld = true; tick(90); show('sprint 1.5s');
c.sprintHeld = false; c.moveY = 0; c.moveMag = 0; tick(40); show('stop');
let y0 = P.position.y, maxH = 0; c.jumpPressed = true; for (let i = 0; i < 70; i++) { tick(1); maxH = Math.max(maxH, P.position.y - y0); } show('jump'); console.log('jump height', f(maxH));
const d0 = P.position.clone(); c.moveY = 1; c.moveMag = 1; c.dodgePressed = true; tick(20); c.moveY = 0; c.moveMag = 0; show('dodge'); console.log('dodge dist', f(d0.distanceTo(P.position)));
c.moveX = 1; c.moveMag = 1; tick(30); c.moveX = 0; c.moveMag = 0; tick(10); show('turn right');
P.setColliderFeet(P.position.x, heightAt(P.position.x, P.position.z) - 3, P.position.z); tick(2); show('after sink'); console.log('respawns', P.respawns);
// water: walk into the river valley west of the bridge
P.teleport(-97, null, 40, Math.PI / 2); tick(60); show('river');
let t0 = performance.now(); tick(600); console.log('avg ms/frame (physics+kcc+camera)', f((performance.now() - t0) / 600), 'events', events.slice(0, 12).join(','));
