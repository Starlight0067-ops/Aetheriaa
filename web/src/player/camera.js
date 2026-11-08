// Third-person orbit camera: damped follow, shoulder offset, wheel zoom, physics shape-cast collision,
// gentle auto-recentring while moving, sprint FOV kick, landing dip, optional head bob, trauma shake.
// Never touches the camera while ctx.cameraLocked (screenshot views).
import * as THREE from 'three';
import { heightAt } from '../core/layout.js';
import { QUERY } from '../physics/world.js';
import { clamp, damp, dampAngle, angleDiff, smoothDamp, yawOf } from './math.js';

export class CameraRig {
  constructor(ctx, physics, player, controls) {
    this.ctx = ctx; this.physics = physics; this.player = player; this.controls = controls;
    this.camera = ctx.camera;
    this.settings = {
      sensitivity: 0.0022, invertY: false, padYawSpeed: 3.4, padPitchSpeed: 2.2,
      distance: 5.2, minDistance: 1.8, maxDistance: 10, zoomStep: 0.85,
      pivotHeight: 1.45, shoulder: 0.32, collisionRadius: 0.22,
      minElev: -0.62, maxElev: 1.2, defaultElev: 0.24,
      fovBase: 55, fovSprint: 7, fovDodge: 4,
      autoRecenter: true, recenterDelay: 0.6, headBob: false,
    };
    this.yaw = 0;                // 0 = camera at +Z of the pivot looking -Z (north)
    this.elev = this.settings.defaultElev;
    this.zoom = this.settings.distance; this.zoomTarget = this.zoom; this.zoomVel = { v: 0 };
    this.dist = this.zoom; this.distVel = { v: 0 };
    this.shoulderNow = this.settings.shoulder;
    this.pivot = new THREE.Vector3();
    this.pv = { x: { v: 0 }, y: { v: 0 }, z: { v: 0 } };
    this.dip = 0; this.dipVel = 0;
    this.fov = this.settings.fovBase; this.fovKick = 0;
    this.trauma = 0; this.bobPhase = 0; this.recenterT = 0;
    this.position = new THREE.Vector3(); this.target = new THREE.Vector3();
    this.lastHit = null;
    player.on('land', (impact) => { if (impact > 6) this.dipVel -= Math.min(impact, 25) * 0.06; });
    player.on('dodge', () => { this.fovKick = this.settings.fovDodge; });
    player.on('teleport', () => this.snap());
    player.on('respawn', () => this.snap());
  }

  /** Forward (look) direction on the ground plane, used for camera-relative movement. */
  get moveYaw() { return this.yaw; }

  shake(amount = 0.3) { this.trauma = clamp(this.trauma + amount, 0, 1); }
  recenter() { this.recenterT = 0.35; }

  pivotTarget(out) {
    const p = this.player.position;
    out.set(p.x, p.y + this.settings.pivotHeight, p.z);
    if (this.player.mode === 'swim') out.y = Math.max(out.y, p.y + 1.2);
    return out;
  }

  snap() {
    this.pivotTarget(this.pivot);
    this.pv.x.v = this.pv.y.v = this.pv.z.v = 0;
    this.dist = this.zoom;
    this.apply(0, true);
  }

  update(dt) {
    const s = this.settings, c = this.controls.state, pl = this.player;
    // ---- orbit input
    const inv = s.invertY ? -1 : 1;
    this.yaw -= c.lookX * s.sensitivity + c.padLookX * s.padYawSpeed * dt;
    this.elev += (c.lookY * s.sensitivity + c.padLookY * s.padPitchSpeed * dt) * inv;
    if (c.zoom) this.zoomTarget = clamp(this.zoomTarget + c.zoom * s.zoomStep, s.minDistance, s.maxDistance);
    if (c.recenterPressed) this.recenter();

    // ---- recentring
    const hv = pl.actualVelocity, hs = Math.hypot(hv.x, hv.z);
    if (this.recenterT > 0) {
      this.recenterT -= dt;
      this.yaw = dampAngle(this.yaw, pl.facing, 12, dt);
      this.elev = damp(this.elev, s.defaultElev, 10, dt);
    } else if (s.autoRecenter && hs > 1.0 && c.cameraIdle > s.recenterDelay && pl.mode !== 'dodge') {
      const behind = yawOf(hv.x, hv.z);
      const d = angleDiff(this.yaw, behind);
      if (Math.abs(d) < 2.2) {   // don't swing round when running toward the camera
        const k = 0.6 * clamp(hs / 6, 0, 1.4) * Math.min(1, (c.cameraIdle - s.recenterDelay) / 0.8);
        this.yaw += d * (1 - Math.exp(-k * (Math.abs(Math.sin(d)) + 0.15) * dt));
      }
      if (c.cameraIdle > 1.5) this.elev = damp(this.elev, s.defaultElev, 0.6, dt);
    }
    this.elev = clamp(this.elev, s.minElev, s.maxElev);
    this.yaw = Math.atan2(Math.sin(this.yaw), Math.cos(this.yaw));

    // ---- zoom
    this.zoom = smoothDamp(this.zoom, this.zoomTarget, this.zoomVel, 0.16, dt);

    // ---- damped pivot
    const tgt = this.pivotTarget(new THREE.Vector3());
    if (s.headBob && pl.mode === 'ground' && hs > 0.5) {
      this.bobPhase += dt * hs * 1.25;
      tgt.y += Math.sin(this.bobPhase * Math.PI * 2) * 0.025 * clamp(hs / 6, 0, 1);
    }
    const sprintLag = clamp(hs / 9, 0, 1);
    const ht = 0.05 + 0.06 * sprintLag;
    const vt = pl.mode === 'air' ? 0.24 : pl.mode === 'swim' ? 0.3 : 0.11;
    if (this.pivot.distanceToSquared(tgt) > 36) { this.pivot.copy(tgt); this.pv.x.v = this.pv.y.v = this.pv.z.v = 0; }
    this.pivot.x = smoothDamp(this.pivot.x, tgt.x, this.pv.x, ht, dt);
    this.pivot.z = smoothDamp(this.pivot.z, tgt.z, this.pv.z, ht, dt);
    this.pivot.y = smoothDamp(this.pivot.y, tgt.y, this.pv.y, vt, dt);
    this.pivot.y = clamp(this.pivot.y, tgt.y - 1.0, tgt.y + 1.0);

    // landing dip: damped spring
    this.dipVel += (-this.dip * 90 - this.dipVel * 13) * dt;
    this.dip = clamp(this.dip + this.dipVel * dt, -0.35, 0.2);

    // ---- FOV
    const fovT = s.fovBase + (pl.sprinting && hs > 6 ? s.fovSprint : 0) + this.fovKick;
    this.fovKick = damp(this.fovKick, 0, 5, dt);
    this.fov = damp(this.fov, fovT, 4, dt);
    this.trauma = Math.max(0, this.trauma - dt * 1.4);

    this.apply(dt, false);
  }

  /** Resolve collisions and write the camera (unless locked). */
  apply(dt, instant) {
    const s = this.settings, ph = this.physics;
    const ce = Math.cos(this.elev), se = Math.sin(this.elev);
    const back = new THREE.Vector3(Math.sin(this.yaw) * ce, se, Math.cos(this.yaw) * ce);
    const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    const head = this.pivot.clone(); head.y += this.dip;
    const r = s.collisionRadius;
    const opts = { groups: QUERY.CAMERA };

    // shoulder pivot (pull the offset in when a wall is on that side)
    let shoulder = s.shoulder * clamp((this.zoom - 1.2) / 3, 0.35, 1);
    const sh = shoulder > 0.01 ? ph.sphereCast(head, right, shoulder, r, opts) : null;
    if (sh) shoulder = Math.max(0, sh.distance - 0.02);
    this.shoulderNow = instant ? shoulder : damp(this.shoulderNow, shoulder, shoulder < this.shoulderNow ? 30 : 4, dt);
    const sp = head.clone().addScaledVector(right, this.shoulderNow);

    // boom collision
    const hit = ph.sphereCast(sp, back, this.zoom, r, opts);
    this.lastHit = hit;
    const allowed = hit ? Math.max(0.25, hit.distance - 0.03) : this.zoom;
    if (instant || allowed < this.dist) { this.dist = allowed; this.distVel.v = 0; }
    else this.dist = smoothDamp(this.dist, allowed, this.distVel, 0.35, dt);

    const pos = sp.clone().addScaledVector(back, this.dist);
    // analytic safety nets: never below the terrain surface or the water surface
    const gy = heightAt(pos.x, pos.z) + 0.2;
    if (pos.y < gy) pos.y = gy;
    const wy = this.player.waterAt(pos.x, pos.z) + 0.15;
    if (pos.y < wy && this.player.mode !== 'swim') pos.y = wy;
    this.position.copy(pos);
    this.target.copy(sp);

    // hide the character when the camera is jammed into it
    const vis = this.player.visual;
    if (vis && vis.pivot) vis.pivot.visible = pos.distanceTo(head) > 0.55;

    if (this.ctx.cameraLocked) return;
    const cam = this.camera;
    cam.position.copy(pos);
    cam.lookAt(sp);
    if (this.trauma > 0) {
      const t = this.ctx.time * 37, a = this.trauma * this.trauma * 0.04;
      cam.rotateX(Math.sin(t) * a); cam.rotateY(Math.sin(t * 1.3 + 1) * a); cam.rotateZ(Math.sin(t * 0.7 + 2) * a);
    }
    if (Math.abs(cam.fov - this.fov) > 0.01) { cam.fov = this.fov; cam.updateProjectionMatrix(); }
  }
}
