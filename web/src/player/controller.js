// Player movement: Rapier KinematicCharacterController capsule + locomotion state machine.
// States: ground (idle/walk/run/sprint) · air (jump/fall) · dodge · swim. Root = feet, faces -Z at yaw 0.
import * as THREE from 'three';
import { WORLD, heightAt } from '../core/layout.js';
import { QUERY, GROUP, groups } from '../physics/world.js';
import { clamp, damp, dampAngle, angleDiff, moveTowards, yawOf, lerp } from './math.js';

export const TUNING = {
  height: 1.7, radius: 0.3, skin: 0.02,
  stepHeight: 0.42, stepMinWidth: 0.16, maxSlopeDeg: 48, slideSlopeDeg: 52, snap: 0.45,
  walkSpeed: 1.9, runSpeed: 5.6, sprintSpeed: 8.6,
  accel: 9, decel: 9, airAccel: 2.4, velTurnRate: 11, sprintVelTurnRate: 6.5, pivotDecel: 38,
  turnRate: 16, sprintTurnRate: 9.5, airTurnRate: 4, groundStick: 0.6,
  jumpHeight: 1.3, jumpApexTime: 0.36, fallGravityMult: 1.45, terminalSpeed: 45,
  coyote: 0.12, jumpBuffer: 0.15,
  dodgeDuration: 0.34, dodgeDistance: 4.4, backstepDistance: 2.8, dodgeCooldown: 0.55, dodgeStamina: 18,
  dodgeBuffer: 0.12, dodgeIFrames: [0.02, 0.24], dodgeJumpCancel: 0.5,
  staminaMax: 100, sprintDrain: 16, staminaRegen: 32, regenDelay: 0.9, exhaustRecover: 30,
  swimDepth: 1.25, swimFloat: 1.18, swimSpeed: 2.6, swimFastSpeed: 4.2, swimDrain: 10,
  hardLandSpeed: 14, hardLandRecover: 0.25, respawnBelow: 1.0,
};

const _q = new THREE.Vector3();

export class PlayerController {
  constructor(ctx, physics, root, visual, controls, getCameraYaw) {
    const T = (this.tuning = { ...TUNING });
    this.ctx = ctx; this.physics = physics; this.root = root; this.visual = visual; this.controls = controls;
    this.getCameraYaw = getCameraYaw || (() => 0);
    const { RAPIER, world } = physics;
    this.halfSeg = (T.height - 2 * T.radius) / 2;
    this.centerOffset = T.height / 2;
    this.collider = world.createCollider(RAPIER.ColliderDesc.capsule(this.halfSeg, T.radius)
      .setCollisionGroups(groups(GROUP.PLAYER, GROUP.STATIC | GROUP.PLAYER_ONLY)).setTranslation(0, 50, 0));
    const kcc = (this.kcc = world.createCharacterController(T.skin));
    kcc.setUp({ x: 0, y: 1, z: 0 });
    kcc.setSlideEnabled(true);
    kcc.enableAutostep(T.stepHeight, T.stepMinWidth, false);
    kcc.setMaxSlopeClimbAngle((T.maxSlopeDeg * Math.PI) / 180);
    kcc.setMinSlopeSlideAngle((T.slideSlopeDeg * Math.PI) / 180);
    kcc.enableSnapToGround(T.snap);
    kcc.setApplyImpulsesToDynamicBodies(false);
    this.snapOn = true;
    this.probeShape = new RAPIER.Ball(T.radius * 0.9);
    this.capsuleShape = new RAPIER.Capsule(this.halfSeg, T.radius);
    this.gravity = (2 * T.jumpHeight) / (T.jumpApexTime * T.jumpApexTime);
    this.jumpSpeed = (2 * T.jumpHeight) / T.jumpApexTime;
    this.cosMaxSlope = Math.cos((T.maxSlopeDeg * Math.PI) / 180);

    this.position = new THREE.Vector3();        // feet (physics)
    this.velocity = new THREE.Vector3();        // m/s, horizontal part is the controlled velocity
    this.actualVelocity = new THREE.Vector3();  // measured from the applied movement
    this.wish = new THREE.Vector3();
    this.mode = 'ground';
    this.grounded = true; this.onSteep = false; this.groundNormal = new THREE.Vector3(0, 1, 0);
    this.facing = 0; this.turnVel = 0; this.lean = 0; this.pitchLean = 0;
    this.airTime = 0; this.jumped = false; this.fallPlayed = false; this.jumpGrace = 0;
    this.coyoteT = 0; this.jumpBufT = 0; this.dodgeBufT = 0; this.dodgeCd = 0; this.recoverT = 0;
    this.dodge = { t: 0, dir: new THREE.Vector3(), back: false, vStart: 0, vEnd: 0, dur: T.dodgeDuration };
    this.sprinting = false; this.walking = false; this.invulnerable = false;
    this.stamina = { value: T.staminaMax, max: T.staminaMax, exhausted: false, get ratio() { return this.value / this.max; } };
    this.regenT = 0;
    this.animSpeed = 0; this.stepOffset = 0; this.lastSafe = new THREE.Vector3();
    this.safeT = 0; this.respawns = 0; this.enabled = true;
    this.listeners = {};
    this.debug = { kccMs: 0 };
  }

  on(name, fn) { (this.listeners[name] ||= []).push(fn); }
  emit(name, ...a) { for (const f of this.listeners[name] || []) { try { f(...a); } catch (e) { console.warn(e); } } }

  get state() {
    if (this.mode !== 'ground') return this.mode;
    const s = this.animSpeed;
    return s < 0.2 ? 'idle' : this.sprinting ? 'sprint' : s < 3 ? 'walk' : 'run';
  }
  get speed() { return Math.hypot(this.actualVelocity.x, this.actualVelocity.z); }
  get facingDir() { return _q.set(-Math.sin(this.facing), 0, -Math.cos(this.facing)); }

  waterAt(x, z) {
    const w = this.ctx.systems.world?.water;
    const f = w && (w.surfaceAt || w.heightAt);
    if (typeof f === 'function') { const y = f.call(w, x, z); if (y != null) return y; }
    return WORLD.waterLevel;
  }

  setColliderFeet(x, y, z) {
    this.collider.setTranslation({ x, y: y + this.centerOffset + this.tuning.skin, z });
    this.position.set(x, y, z);
  }

  /** Place the character at (x, z) on the ground (or at y if given), facing yaw. */
  teleport(x, y, z, yaw = this.facing) {
    if (y == null) {
      const g = this.physics.groundAt(x, z, heightAt(x, z) + 60);
      y = Math.max(g ? g.y : -Infinity, heightAt(x, z));
    }
    this.setColliderFeet(x, y + 0.02, z);
    this.unstick();
    this.velocity.set(0, 0, 0); this.actualVelocity.set(0, 0, 0);
    this.facing = yaw; this.mode = 'ground'; this.airTime = 0; this.stepOffset = 0;
    this.lastSafe.copy(this.position);
    this.syncRoot(0);
    this.emit('teleport');
  }

  overlapsAt(x, y, z) {
    return this.physics.overlap(this.capsuleShape, { x, y: y + this.centerOffset + this.tuning.skin, z }, { groups: QUERY.PLAYER, exclude: this.collider });
  }

  /** If the capsule is inside geometry (e.g. a building collider streamed in on top of us), move to the nearest free spot. */
  unstick() {
    const p = this.position;
    if (!this.overlapsAt(p.x, p.y, p.z)) return false;
    for (let r = 0.6; r <= 10; r += 0.6) {
      for (let a = 0; a < 12; a++) {
        const x = p.x + Math.cos((a / 12) * Math.PI * 2) * r, z = p.z + Math.sin((a / 12) * Math.PI * 2) * r;
        const ground = this.physics.groundAt(x, z, p.y + 3);
        const y = Math.max(ground ? ground.y : -Infinity, heightAt(x, z)) + 0.02;
        if (Math.abs(y - p.y) < 3 && !this.overlapsAt(x, y, z)) { this.setColliderFeet(x, y, z); return true; }
      }
    }
    const g = this.physics.groundAt(p.x, p.z, p.y + 200);
    if (g) this.setColliderFeet(p.x, g.y + 0.02, p.z);
    return true;
  }

  respawn(reason) {
    const p = this.position;
    const y = heightAt(p.x, p.z) + 0.05;
    this.setColliderFeet(p.x, y, p.z);
    this.unstick();
    this.velocity.set(0, 0, 0);
    this.mode = 'ground'; this.airTime = 0;
    this.respawns++;
    this.emit('respawn', reason);
  }

  update(dt) {
    const c = this.controls.state;
    if (c.jumpPressed) this.jumpBufT = this.tuning.jumpBuffer;
    if (c.dodgePressed) this.dodgeBufT = this.tuning.dodgeBuffer;
    const n = Math.max(1, Math.ceil(dt / (1 / 45) - 1e-6));
    const h = dt / n;
    const t0 = performance.now();
    for (let i = 0; i < n; i++) this.step(h, c);
    this.debug.kccMs = this.debug.kccMs * 0.9 + (performance.now() - t0) * 0.1;
    this.postFrame(dt, c);
  }

  step(h, c) {
    const T = this.tuning, p = this.position, v = this.velocity;
    this.jumpBufT -= h; this.dodgeBufT -= h; this.dodgeCd -= h; this.coyoteT -= h; this.recoverT -= h; this.jumpGrace -= h;

    // ---- wish direction (camera relative)
    const cy = this.getCameraYaw();
    const fx = -Math.sin(cy), fz = -Math.cos(cy), rx = Math.cos(cy), rz = -Math.sin(cy);
    const active = this.enabled;
    const mx = active ? c.moveX : 0, my = active ? c.moveY : 0;
    this.wish.set(rx * mx + fx * my, 0, rz * mx + fz * my);
    let mag = Math.min(1, this.wish.length());
    if (mag > 1e-3) this.wish.multiplyScalar(1 / this.wish.length()); else mag = 0;

    // ---- water
    const waterY = this.waterAt(p.x, p.z);
    const depth = waterY - p.y;
    if (this.mode !== 'swim' && depth > T.swimDepth && this.mode !== 'dodge') { this.mode = 'swim'; this.emit('swim', true); }
    else if (this.mode === 'swim' && depth < T.swimDepth - 0.2) { this.mode = 'ground'; this.emit('swim', false); }

    // ---- gait
    const st = this.stamina;
    this.walking = c.walk || (c.gamepad && mag > 0 && mag < 0.6);
    const canSprint = c.sprintHeld && mag > 0.5 && !st.exhausted && st.value > 0 && !c.walk;
    if (this.mode === 'ground' || this.mode === 'swim') this.sprinting = canSprint;
    else if (this.mode === 'air' && !c.sprintHeld) this.sprinting = false;
    let gait;
    if (this.mode === 'swim') gait = this.sprinting ? T.swimFastSpeed : T.swimSpeed;
    else if (this.walking) gait = c.gamepad ? T.walkSpeed * Math.min(1, mag / 0.6) / Math.max(mag, 1e-3) : T.walkSpeed;
    else gait = this.sprinting ? T.sprintSpeed : T.runSpeed;
    let targetSpeed = mag * gait;
    if (this.recoverT > 0) targetSpeed *= 0.35;

    // ---- dodge start
    const groundedish = (this.mode === 'ground' && !this.onSteep) || this.coyoteT > 0;
    if (active && this.dodgeBufT > 0 && groundedish && this.dodgeCd <= 0 && this.recoverT <= 0 && st.value >= T.dodgeStamina * 0.5) {
      this.startDodge(mag);
    }

    // ---- jump
    const dodgeCancel = this.mode === 'dodge' && this.dodge.t > this.dodge.dur * T.dodgeJumpCancel && this.grounded;
    const canJump = ((this.mode === 'ground' && !this.onSteep && this.grounded) || this.coyoteT > 0 || dodgeCancel) && this.recoverT <= 0;
    if (active && this.jumpBufT > 0 && canJump) this.doJump();
    else if (active && this.jumpBufT > 0 && this.mode === 'swim' && this.grounded && depth < T.swimDepth + 0.3) this.doJump(0.8);

    // ---- horizontal velocity
    const speed = Math.hypot(v.x, v.z);
    let dirX = speed > 1e-4 ? v.x / speed : this.wish.x, dirZ = speed > 1e-4 ? v.z / speed : this.wish.z;
    let newSpeed = speed;
    if (this.mode === 'dodge') {
      const d = this.dodge;
      d.t += h;
      const u = Math.min(1, d.t / d.dur);
      newSpeed = d.vEnd + (d.vStart - d.vEnd) * Math.pow(1 - u, 1.6);
      if (!d.back && mag > 0.1) {   // slight steering toward input during forward dashes
        const a = clamp(angleDiff(yawOf(d.dir.x, d.dir.z), yawOf(this.wish.x, this.wish.z)), -2.2 * h, 2.2 * h);
        const yaw = yawOf(d.dir.x, d.dir.z) + a;
        d.dir.set(-Math.sin(yaw), 0, -Math.cos(yaw));
      }
      dirX = d.dir.x; dirZ = d.dir.z;
      this.invulnerable = d.t >= T.dodgeIFrames[0] && d.t <= T.dodgeIFrames[1];
      if (d.t >= d.dur) {
        this.mode = this.grounded ? 'ground' : 'air';
        this.invulnerable = false;
        if (c.dodgeHeld || c.sprintHeld) this.sprinting = canSprint || (c.dodgeHeld && mag > 0.5 && !st.exhausted);
        this.emit('dodgeEnd');
      }
    } else if (this.mode === 'air') {
      // momentum-preserving air steering
      const tx = this.wish.x * Math.max(targetSpeed, mag > 0 ? speed : 0), tz = this.wish.z * Math.max(targetSpeed, mag > 0 ? speed : 0);
      const k = 1 - Math.exp(-T.airAccel * h);
      if (mag > 0) { v.x += (tx - v.x) * k; v.z += (tz - v.z) * k; }
      else { v.x *= 1 - k * 0.25; v.z *= 1 - k * 0.25; }
      newSpeed = Math.hypot(v.x, v.z);
      if (newSpeed > 1e-4) { dirX = v.x / newSpeed; dirZ = v.z / newSpeed; }
    } else {
      // ground / swim: rotate velocity toward the wish direction, approach the target speed
      const accel = this.mode === 'swim' ? 4 : T.accel, decel = this.mode === 'swim' ? 3 : T.decel;
      if (targetSpeed > 0.01) {
        if (speed < 0.4) { dirX = this.wish.x; dirZ = this.wish.z; }
        else {
          const ang = angleDiff(yawOf(dirX, dirZ), yawOf(this.wish.x, this.wish.z));
          if (Math.abs(ang) > 2.5 && speed > 2.5) {
            newSpeed = moveTowards(speed, 0, T.pivotDecel * h);   // hard reversal: brake, then go
            if (newSpeed < 1.2) { dirX = this.wish.x; dirZ = this.wish.z; }
            targetSpeed = newSpeed;
          } else {
            const rate = this.sprinting ? T.sprintVelTurnRate : T.velTurnRate;
            const yaw = yawOf(dirX, dirZ) + clamp(ang, -rate * h, rate * h);
            dirX = -Math.sin(yaw); dirZ = -Math.cos(yaw);
            targetSpeed *= 1 - 0.25 * Math.min(1, Math.abs(ang) / 1.6);   // cornering slowdown
          }
        }
        const rate = targetSpeed > newSpeed ? accel : decel;
        newSpeed += (targetSpeed - newSpeed) * (1 - Math.exp(-rate * h));
        if (Math.abs(targetSpeed - newSpeed) < 2 * h) newSpeed = targetSpeed;
      } else {
        newSpeed += (0 - newSpeed) * (1 - Math.exp(-decel * h));
        newSpeed = moveTowards(newSpeed, 0, 1.5 * h);
      }
    }
    if (this.mode !== 'air') { v.x = dirX * newSpeed; v.z = dirZ * newSpeed; }

    // ---- vertical velocity
    if (this.mode === 'swim') {
      const target = waterY - T.swimFloat;
      v.y = damp(v.y, clamp((target - p.y) * 3.5, -3, 2.5), 6, h);
    } else if ((this.mode === 'ground' || this.mode === 'dodge') && this.grounded && !this.onSteep && this.jumpGrace <= 0) {
      v.y = -T.groundStick;
    } else {
      const g = this.gravity * (v.y > 0 ? 1 : T.fallGravityMult);
      v.y = Math.max(-T.terminalSpeed, v.y - g * h);
    }

    // ---- move with the KCC
    const wantSnap = v.y <= 0 && this.mode !== 'swim';
    if (wantSnap !== this.snapOn) { if (wantSnap) this.kcc.enableSnapToGround(T.snap); else this.kcc.disableSnapToGround(); this.snapOn = wantSnap; }
    const desired = { x: v.x * h, y: v.y * h, z: v.z * h };
    this.kcc.computeColliderMovement(this.collider, desired, this.physics.RAPIER.QueryFilterFlags.EXCLUDE_SENSORS, QUERY.PLAYER);
    const m = this.kcc.computedMovement();
    const kGrounded = this.kcc.computedGrounded();
    const ct = this.collider.translation();
    this.collider.setTranslation({ x: ct.x + m.x, y: ct.y + m.y, z: ct.z + m.z });
    const prevY = p.y;
    p.set(ct.x + m.x, ct.y + m.y - this.centerOffset - T.skin, ct.z + m.z);
    this.actualVelocity.set(m.x / h, m.y / h, m.z / h);

    // visual smoothing of discrete stair steps (autostep teleports the capsule up)
    const dy = p.y - prevY;
    if (kGrounded && dy > 0.06 && dy > Math.hypot(m.x, m.z) * 1.2 + 0.02) this.stepOffset -= dy;

    // ceiling bump
    if (v.y > 0 && m.y < desired.y * 0.3) v.y = 0;
    // in the air, lose the velocity absorbed by walls
    if (this.mode === 'air') {
      const ah = Math.hypot(m.x, m.z) / h, vh = Math.hypot(v.x, v.z);
      if (ah < vh * 0.95) { v.x = m.x / h; v.z = m.z / h; }
    }

    // ---- grounded transitions
    const wasGrounded = this.grounded;
    this.grounded = kGrounded && this.jumpGrace <= 0;
    if (this.mode === 'air') {
      this.airTime += h;
      if (this.grounded && v.y <= 0) this.land();
    } else if (this.mode === 'ground' && !this.grounded) {
      this.mode = 'air'; this.airTime = 0; this.jumped = false; this.fallPlayed = false;
      this.coyoteT = wasGrounded ? T.coyote : 0;
      if (v.y < 0) v.y = 0;
    }
  }

  startDodge(mag) {
    const T = this.tuning, d = this.dodge, st = this.stamina;
    d.back = mag < 0.1;
    if (d.back) d.dir.copy(this.facingDir).multiplyScalar(-1);
    else d.dir.copy(this.wish);
    d.t = 0; d.dur = T.dodgeDuration;
    const D = d.back ? T.backstepDistance : T.dodgeDistance;
    d.vEnd = d.back ? 0.5 : Math.min(T.runSpeed * 0.8, Math.max(3, Math.hypot(this.velocity.x, this.velocity.z)));
    d.vStart = d.vEnd + ((D - d.vEnd * d.dur) * 2.6) / d.dur;
    if (this.mode === 'air') { this.mode = 'dodge'; this.velocity.y = 0; }
    this.mode = 'dodge';
    this.coyoteT = 0; this.dodgeBufT = 0; this.dodgeCd = T.dodgeCooldown;
    st.value = Math.max(0, st.value - T.dodgeStamina); this.regenT = T.regenDelay;
    if (st.value <= 0) st.exhausted = true;
    this.dodgeYaw = d.back ? this.facing : yawOf(d.dir.x, d.dir.z);
    this.visual.play('dodge', { loop: false, fade: 0.05, speed: 1 });
    this.emit('dodge', d.back);
  }

  doJump(scale = 1) {
    const v = this.velocity;
    if (this.mode === 'dodge') {   // dash-jump keeps (capped) dash momentum
      const s = Math.min(Math.hypot(v.x, v.z), this.tuning.sprintSpeed + 0.5), l = Math.hypot(v.x, v.z) || 1;
      v.x = (v.x / l) * s; v.z = (v.z / l) * s;
      this.invulnerable = false;
    }
    v.y = this.jumpSpeed * scale;
    this.mode = 'air'; this.jumped = true; this.fallPlayed = false; this.airTime = 0;
    this.coyoteT = 0; this.jumpBufT = 0; this.jumpGrace = 0.08; this.grounded = false;
    this.visual.play('jump', { loop: false, fade: 0.06 });
    this.emit('jump');
  }

  land() {
    const T = this.tuning, impact = Math.max(-this.velocity.y, 0);
    this.mode = 'ground';
    if (impact > T.hardLandSpeed) this.recoverT = T.hardLandRecover;
    if (this.airTime > 0.35 || impact > 7) this.visual.play('land', { loop: false, fade: 0.05 });
    this.emit('land', impact, this.airTime);
    this.velocity.y = -T.groundStick;
    this.airTime = 0; this.fallPlayed = false;
    // a buffered jump fires on the next step (jumpBufT still > 0)
  }

  postFrame(dt, c) {
    const T = this.tuning, p = this.position, st = this.stamina;

    // ground probe for slope classification
    const center = { x: p.x, y: p.y + this.centerOffset, z: p.z };
    const hit = this.physics.shapeCast(this.probeShape, center, { x: 0, y: -1, z: 0 }, this.centerOffset, { groups: QUERY.PLAYER, exclude: this.collider });
    if (hit && hit.normal) this.groundNormal.copy(hit.normal); else this.groundNormal.set(0, 1, 0);
    this.onSteep = this.mode === 'ground' && this.grounded && !!hit && this.groundNormal.y < this.cosMaxSlope;

    // fall animation
    if (this.mode === 'air' && !this.fallPlayed && ((this.jumped && this.velocity.y < -1.5) || (!this.jumped && this.airTime > 0.22))) {
      this.fallPlayed = true;
      this.visual.play('fall', { loop: true, fade: 0.22 });
    }

    // stamina
    const moving = Math.hypot(this.actualVelocity.x, this.actualVelocity.z) > 1;
    const draining = this.sprinting && moving && (this.mode === 'ground' || this.mode === 'swim');
    if (draining) { st.value -= (this.mode === 'swim' ? T.swimDrain : T.sprintDrain) * dt; this.regenT = T.regenDelay; }
    else if (this.mode !== 'dodge') { if (this.regenT > 0) this.regenT -= dt; else st.value += T.staminaRegen * dt; }
    if (st.value <= 0) { st.value = 0; st.exhausted = true; this.sprinting = false; }
    if (st.value > st.max) st.value = st.max;
    if (st.exhausted && st.value >= T.exhaustRecover) st.exhausted = false;

    // never fall through the world
    const ground = heightAt(p.x, p.z);
    if (p.y < ground - T.respawnBelow || p.y < -60 || !Number.isFinite(p.y)) this.respawn('below-terrain');
    const lim = WORLD.half - 4;
    if (Math.abs(p.x) > lim || Math.abs(p.z) > lim) {
      this.setColliderFeet(clamp(p.x, -lim, lim), p.y, clamp(p.z, -lim, lim));
    }
    if (this.mode === 'ground' && this.grounded && !this.onSteep) {
      this.safeT -= dt;
      if (this.safeT <= 0) { this.lastSafe.copy(p); this.safeT = 0.5; }
    }

    // facing
    let desiredYaw = this.facing, rate = T.turnRate;
    const mag = this.wish.lengthSq() > 0.01;
    if (this.mode === 'dodge') { desiredYaw = this.dodgeYaw; rate = 30; }
    else if (mag) {
      desiredYaw = yawOf(this.wish.x, this.wish.z);
      rate = this.mode === 'air' ? T.airTurnRate : this.mode === 'swim' ? 6 : this.sprinting ? T.sprintTurnRate : T.turnRate;
    }
    const before = this.facing;
    this.facing = dampAngle(this.facing, desiredYaw, rate, dt);
    this.turnVel = damp(this.turnVel, angleDiff(before, this.facing) / Math.max(dt, 1e-4), 10, dt);

    // animation speed (smoothed actual horizontal speed)
    const hs = Math.hypot(this.actualVelocity.x, this.actualVelocity.z);
    this.animSpeed = damp(this.animSpeed, this.mode === 'dodge' ? Math.hypot(this.velocity.x, this.velocity.z) : hs, 14, dt);

    // lean into turns (roll) and acceleration (pitch), applied to the visual pivot only
    const leanTarget = clamp(this.turnVel * this.animSpeed * 0.011, -0.2, 0.2) * (this.mode === 'ground' ? 1 : 0.4);
    this.lean = damp(this.lean, leanTarget, 8, dt);
    this.stepOffset = damp(this.stepOffset, 0, 16, dt);

    const groundedAnim = this.mode !== 'air' || (!this.jumped && this.airTime < 0.12);
    this.visual.setLocomotion(this.animSpeed, groundedAnim, this.mode === 'swim' ? 0 : this.actualVelocity.y);
    this.syncRoot(dt);
  }

  syncRoot() {
    this.root.position.copy(this.position);
    this.root.rotation.y = this.facing;
    const pivot = this.visual.pivot;
    if (pivot) {
      pivot.rotation.z = this.lean;
      pivot.position.y = this.stepOffset;
    }
  }
}
