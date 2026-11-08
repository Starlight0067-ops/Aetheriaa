// Animation state machine (owner: character agent).
// Locomotion = phase-synchronised blend of idle/walk/run/sprint driven by speed; air states (jump/fall/land)
// from grounded + vertical speed; one-shot / looping overlays (attacks, cast, hit, talk...) cross-faded on top.
import * as THREE from 'three';

const LOOPING = new Set(['idle', 'walk', 'run', 'sprint', 'fall', 'talk', 'sit']);
const LOCO = ['idle', 'walk', 'run', 'sprint'];
// per-action defaults: start offset (s), playback speed, early exit (s before end to start the fade out)
const DEFAULTS = {
  jump: { start: 0.28, speed: 1.15 }, land: { start: 0.08, speed: 1.35 }, dodge: { speed: 1.25 },
  attack1: { speed: 1.25 }, attack2: { speed: 1.1 }, attack3: { speed: 1.1 }, cast: { speed: 1.1 }, hit: { speed: 1.0 },
  death: { clamp: true }, interact: { speed: 1.0 }, wave: { speed: 1.0 },
};

export class Animator {
  /**
   * @param root   mixer root (contains the normalized nodes)
   * @param clips  { action: THREE.AnimationClip } (clip.userData.speed = natural m/s for locomotion)
   */
  constructor(root, clips, { scale = 1 } = {}) {
    this.mixer = new THREE.AnimationMixer(root);
    this.clips = clips;
    this.actions = {};
    for (const [name, clip] of Object.entries(clips)) {
      const a = this.mixer.clipAction(clip);
      a.setLoop(LOOPING.has(name) ? THREE.LoopRepeat : THREE.LoopOnce, Infinity);
      a.clampWhenFinished = true;
      a.enabled = true;
      a.setEffectiveWeight(0);
      a.play();
      this.actions[name] = a;
    }
    // natural locomotion speeds (m/s), measured from root motion or authored
    const def = { idle: 0, walk: 1.3 * scale, run: 4.8 * scale, sprint: 8 * scale };
    this.natural = {};
    for (const n of LOCO) this.natural[n] = clips[n]?.userData?.speed > 0.2 ? clips[n].userData.speed : def[n];
    if (!clips.run && clips.walk) this.natural.run = this.natural.walk * 3;
    this.phaseOffset = {};
    for (const n of LOCO) this.phaseOffset[n] = clips[n]?.userData?.phase ?? 0;
    this.phase = 0;
    this.speed = 0; this.smoothSpeed = 0;
    this.grounded = true; this.vy = 0; this.airTime = 0;
    this.airW = 0; this.airState = null;
    this.overlays = [];        // [{ name, action, w, target, fade, loop, clamp, exitAt }]
    this.forced = null;
    this.locoW = { idle: 1, walk: 0, run: 0, sprint: 0 };
  }

  has(name) { return !!this.actions[name]; }

  setLocomotion(speed = 0, grounded = true, verticalSpeed = 0) {
    this.forced = null;
    this.speed = Math.max(0, speed || 0);
    const wasGrounded = this.grounded;
    this.grounded = grounded !== false;
    this.vy = verticalSpeed || 0;
    if (!this.grounded && wasGrounded && this.vy > 0.5) this._startAir('jump');
    if (this.grounded && !wasGrounded) {
      if (this.airTime > 0.35 && this.actions.land) this.play('land', { fade: 0.08, _auto: true });
      this.airState = null;
    }
  }

  _startAir(kind) {
    this.airState = kind;
    const a = this.actions[kind] || this.actions.fall;
    if (!a) return;
    const d = DEFAULTS[kind] || {};
    a.reset(); a.time = d.start || 0; a.timeScale = d.speed || 1; a.play();
  }

  play(name, { loop, fade = 0.18, speed, _auto = false } = {}) {
    if (name === 'dodge_roll') name = 'dodge';
    if (/^attack_?\d$/.test(name)) name = 'attack' + name.slice(-1);
    if (name === 'sit_idle') name = 'sit';
    if (LOCO.includes(name) && !(loop === false)) {          // force a locomotion state
      this.forced = name;
      for (const o of this.overlays) o.target = 0, o.fade = fade;
      return true;
    }
    const a = this.actions[name];
    if (!a) return false;
    const d = DEFAULTS[name] || {};
    const isLoop = loop ?? LOOPING.has(name);
    a.setLoop(isLoop ? THREE.LoopRepeat : THREE.LoopOnce, Infinity);
    a.clampWhenFinished = true;
    a.reset();
    a.time = d.start || 0;
    a.timeScale = speed ?? d.speed ?? 1;
    a.enabled = true;
    a.play();
    for (const o of this.overlays) if (o.name !== name) { o.target = 0; o.fade = fade; }
    let o = this.overlays.find((x) => x.name === name);
    if (!o) { o = { name, action: a, w: 0 }; this.overlays.push(o); }
    Object.assign(o, { target: 1, fade, loop: isLoop, clamp: !!d.clamp, auto: _auto });
    return true;
  }

  stop(name, fade = 0.2) { for (const o of this.overlays) if (!name || o.name === name) { o.target = 0; o.fade = fade; } }

  get current() {
    const o = this.overlays.filter((x) => x.target > 0).pop();
    if (o) return o.name;
    if (!this.grounded) return this.airState === 'jump' ? 'jump' : 'fall';
    return this.forced || LOCO.reduce((b, n) => (this.locoW[n] > this.locoW[b] ? n : b), 'idle');
  }

  update(dt) {
    if (dt <= 0) return;
    // ---- overlays
    let overW = 0;
    for (const o of this.overlays) {
      const a = o.action, clip = a.getClip();
      if (o.target > 0 && !o.loop && !o.clamp) {
        const remaining = (clip.duration - a.time) / Math.max(0.05, a.timeScale);
        // auto-landing gets cut short when the character is already moving
        if (remaining < o.fade + 0.02 || (o.name === 'land' && this.speed > 1.0 && a.time > 0.25)) { o.target = 0; o.fade = Math.max(0.12, o.fade); }
      }
      const rate = dt / Math.max(0.01, o.fade);
      o.w = o.target > o.w ? Math.min(o.target, o.w + rate) : Math.max(o.target, o.w - rate);
    }
    this.overlays = this.overlays.filter((o) => o.w > 0.001 || o.target > 0);
    for (const o of this.overlays) overW += o.w;
    const overScale = overW > 1 ? 1 / overW : 1;
    overW = Math.min(1, overW);

    // ---- air
    if (!this.grounded) this.airTime += dt; else this.airTime = 0;
    if (!this.grounded && this.airTime > 0.12 && !this.airState) this._startAir('fall');
    if (this.airState === 'jump') {
      const a = this.actions.jump;
      if (!a || this.vy < -1.0 || a.time >= a.getClip().duration - 0.05) this._startAir('fall');
    }
    const airTarget = this.grounded ? 0 : 1;
    this.airW += (airTarget - this.airW) * Math.min(1, dt * (this.grounded ? 14 : 8));

    // ---- locomotion blend
    this.smoothSpeed += (this.speed - this.smoothSpeed) * Math.min(1, dt * 10);
    const s = this.smoothSpeed, N = this.natural;
    const target = { idle: 0, walk: 0, run: 0, sprint: 0 };
    if (this.forced) target[this.forced] = 1;
    else {
      const has = (n) => !!this.actions[n];
      const steps = LOCO.filter(has);
      const sp = steps.map((n) => (n === 'idle' ? 0 : N[n]));
      if (s <= 0.08 || steps.length === 1) target[steps[0]] = 1;
      else if (s >= sp[sp.length - 1]) target[steps[steps.length - 1]] = 1;
      else {
        for (let i = 0; i < steps.length - 1; i++) {
          const lo = i === 0 ? 0.08 : sp[i], hi = sp[i + 1];
          if (s >= lo && s <= hi) { const k = (s - lo) / Math.max(1e-3, hi - lo); target[steps[i]] = 1 - k; target[steps[i + 1]] = k; break; }
        }
      }
    }
    for (const n of LOCO) this.locoW[n] += (target[n] - this.locoW[n]) * Math.min(1, dt * 12);
    let sum = 0; for (const n of LOCO) sum += this.locoW[n];
    // shared phase for walk/run/sprint, rate = blend of cycle rates scaled to the actual speed
    let rate = 0, wsum = 0, nat = 0;
    for (const n of ['walk', 'run', 'sprint']) {
      const a = this.actions[n]; if (!a) continue;
      const w = this.locoW[n]; rate += (w / a.getClip().duration); wsum += w; nat += w * N[n];
    }
    if (wsum > 1e-3) {
      rate /= wsum; nat /= wsum;
      const scale = this.forced ? 1 : THREE.MathUtils.clamp(s / Math.max(0.1, nat), 0.55, 1.6);
      this.phase = (this.phase + dt * rate * scale) % 1;
    }
    const groundW = (1 - overW) * (1 - this.airW);
    for (const n of LOCO) {
      const a = this.actions[n]; if (!a) continue;
      const w = sum > 0 ? this.locoW[n] / sum : 0;
      a.setEffectiveWeight(w * groundW);
      if (n === 'idle') { a.timeScale = 1; continue; }
      a.timeScale = 0;
      a.time = (((this.phase + this.phaseOffset[n]) % 1) + 1) % 1 * a.getClip().duration;
    }
    // air actions
    const airW = (1 - overW) * this.airW;
    for (const n of ['jump', 'fall']) {
      const a = this.actions[n]; if (!a) continue;
      const active = (this.airState || 'fall') === n || (!this.actions.jump && n === 'fall');
      a.setEffectiveWeight(active ? airW : 0);
    }
    for (const [n, a] of Object.entries(this.actions)) {
      if (LOCO.includes(n) || n === 'jump' || n === 'fall') continue;
      const o = this.overlays.find((x) => x.name === n);
      a.setEffectiveWeight(o ? o.w * overScale : 0);
    }
    this.mixer.update(dt);
  }
}

/** Phase of a locomotion clip = normalized time at which the left leg is furthest forward. */
export function locomotionPhase(nc) {
  const v = nc.bones?.leftUpperLeg, hv = nc.bones?.hips;
  if (!v) return 0;
  const q = new THREE.Quaternion(), qh = new THREE.Quaternion(), d = new THREE.Vector3();
  let best = -Infinity, bf = 0;
  for (let f = 0; f < nc.frames; f++) {
    q.fromArray(v, f * 4);
    if (hv) q.premultiply(qh.fromArray(hv, f * 4));
    d.set(0, -1, 0).applyQuaternion(q);
    if (d.z > best) { best = d.z; bf = f; }
  }
  return bf / Math.max(1, nc.frames - 1);
}
