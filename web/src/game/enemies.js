// Enemies: stylised procedural models animated through THREE.AnimationMixer keyframe clips, plus a state-machine AI
// (idle / patrol / chase / telegraphed windup / strike / recover / stunned / dead). Stats from data/enemies/enemies.json.
import * as THREE from 'three';
import { heightAt, WORLD } from '../core/layout.js';
import { dampAngle, yawOf, clamp } from '../player/math.js';
import { ENEMIES, SPAWNS } from './data.js';
import { S, addXp, addItem, questEvent, emit } from './state.js';

const Q = new THREE.Quaternion(), E = new THREE.Euler();
const qv = (x, y, z) => { Q.setFromEuler(E.set(x, y, z)); return [Q.x, Q.y, Q.z, Q.w]; };
const qt = (name, times, eulers) => new THREE.QuaternionKeyframeTrack(name + '.quaternion', times, eulers.flatMap((e) => qv(...e)));
const vt = (name, times, vals) => new THREE.VectorKeyframeTrack(name + '.position', times, vals.flat());
const st = (name, times, vals) => new THREE.VectorKeyframeTrack(name + '.scale', times, vals.flat());
const clip = (n, d, tr) => new THREE.AnimationClip(n, d, tr);

function stdMat(color, emissive = 0x000000, ei = 0) { return new THREE.MeshStandardMaterial({ color, roughness: 0.8, metalness: 0, emissive, emissiveIntensity: ei }); }
function named(o, n) { o.name = n; return o; }

function buildWisp(d) {
  const g = new THREE.Group(), body = named(new THREE.Group(), 'body'); body.position.y = 1.0; g.add(body);
  const shellM = stdMat(d.color, d.color, 0.35); shellM.transparent = true; shellM.opacity = 0.82;
  const shell = new THREE.Mesh(new THREE.IcosahedronGeometry(0.5, 1), shellM); body.add(shell);
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 10), new THREE.MeshBasicMaterial({ color: new THREE.Color(d.accent).multiplyScalar(1.8), toneMapped: false })); body.add(core);
  const eyeM = new THREE.MeshBasicMaterial({ color: 0x14201a });
  for (const x of [-0.17, 0.17]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), eyeM); e.position.set(x, 0.08, -0.45); body.add(e); }
  const leafM = stdMat(0x4f9a4a);
  for (let i = 0; i < 4; i++) {
    const l = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.34, 0.16), leafM), a = (i / 4) * Math.PI * 2;
    l.position.set(Math.cos(a) * 0.5, 0.15, Math.sin(a) * 0.5); l.rotation.set(0.4, -a, 0.5); body.add(l);
  }
  const clips = [
    clip('idle', 1.6, [vt('body', [0, 0.8, 1.6], [[0, 1.0, 0], [0, 1.18, 0], [0, 1.0, 0]]), st('body', [0, 0.8, 1.6], [[1, 1, 1], [1.04, 0.96, 1.04], [1, 1, 1]])]),
    clip('walk', 0.6, [vt('body', [0, 0.3, 0.6], [[0, 1.0, 0], [0, 1.22, 0], [0, 1.0, 0]]), qt('body', [0, 0.3, 0.6], [[0.25, 0, 0], [0.25, 0, 0.2], [0.25, 0, 0]])]),
    clip('attack', 1, [st('body', [0, 0.5, 0.62, 0.8, 1], [[1, 1, 1], [0.7, 1.3, 0.7], [1.5, 0.7, 1.5], [1.1, 0.95, 1.1], [1, 1, 1]])]),
    clip('hit', 0.3, [qt('body', [0, 0.1, 0.3], [[0, 0, 0], [-0.5, 0, 0.4], [0, 0, 0]])]),
    clip('death', 0.9, [st('body', [0, 0.25, 0.9], [[1, 1, 1], [1.3, 1.3, 1.3], [0.01, 0.01, 0.01]]), vt('body', [0, 0.9], [[0, 1.0, 0], [0, 0.5, 0]])]),
  ];
  return { g, body, mats: [shellM], clips, top: 1.8, aura: 1.7 };
}

function buildBrute(d) {
  const g = new THREE.Group();
  const bark = stdMat(d.color), dark = stdMat(0x3f2d1e), moss = stdMat(0x5d8c3a), glow = new THREE.MeshBasicMaterial({ color: new THREE.Color(d.accent).multiplyScalar(1.8), toneMapped: false });
  const body = named(new THREE.Group(), 'body'); body.position.y = 0.95; g.add(body);
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.95, 0.6), bark); torso.position.y = 0.35; body.add(torso);
  const hump = new THREE.Mesh(new THREE.SphereGeometry(0.42, 10, 8), moss); hump.position.set(0, 0.8, 0.12); hump.scale.set(1.1, 0.6, 0.9); body.add(hump);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.4, 0.44), dark); head.position.set(0, 0.98, -0.12); body.add(head);
  for (const x of [-0.12, 0.12]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), glow); e.position.set(x, 1.0, -0.35); body.add(e); }
  const mk = (n, x) => { const a = named(new THREE.Group(), n); a.position.set(x, 0.72, 0); const m = new THREE.Mesh(new THREE.CapsuleGeometry(0.17, 0.75, 4, 8), bark); m.position.y = -0.42; a.add(m);
    const f = new THREE.Mesh(new THREE.SphereGeometry(0.24, 8, 6), moss); f.position.y = -0.9; a.add(f); body.add(a); return a; };
  mk('armL', -0.62); mk('armR', 0.62);
  const mkLeg = (n, x) => { const l = named(new THREE.Group(), n); l.position.set(x, 0.0, 0); const m = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.9, 0.34), dark); m.position.y = -0.45; l.add(m); body.add(l); return l; };
  mkLeg('legL', -0.25); mkLeg('legR', 0.25);
  const T = [0, 0.5, 1];
  const clips = [
    clip('idle', 2, [vt('body', [0, 1, 2], [[0, 0.95, 0], [0, 1.0, 0], [0, 0.95, 0]]), qt('armL', [0, 1, 2], [[0, 0, 0.05], [0, 0, 0.12], [0, 0, 0.05]]), qt('armR', [0, 1, 2], [[0, 0, -0.05], [0, 0, -0.12], [0, 0, -0.05]])]),
    clip('walk', 0.9, [qt('legL', T.map((t) => t * 0.9), [[0.6, 0, 0], [-0.6, 0, 0], [0.6, 0, 0]]), qt('legR', T.map((t) => t * 0.9), [[-0.6, 0, 0], [0.6, 0, 0], [-0.6, 0, 0]]),
      qt('armL', T.map((t) => t * 0.9), [[-0.4, 0, 0.1], [0.4, 0, 0.1], [-0.4, 0, 0.1]]), vt('body', T.map((t) => t * 0.9), [[0, 0.95, 0], [0, 1.02, 0], [0, 0.95, 0]])]),
    clip('attack', 1.2, [qt('armR', [0, 0.9, 1.0, 1.2], [[0, 0, -0.1], [-2.7, 0, -0.1], [0.6, 0, -0.1], [0, 0, -0.1]]), qt('armL', [0, 0.9, 1.0, 1.2], [[0, 0, 0.1], [-2.4, 0, 0.1], [0.5, 0, 0.1], [0, 0, 0.1]]),
      qt('body', [0, 0.9, 1.0, 1.2], [[0, 0, 0], [-0.25, 0, 0], [0.3, 0, 0], [0, 0, 0]])]),
    clip('hit', 0.35, [qt('body', [0, 0.12, 0.35], [[0, 0, 0], [-0.25, 0, 0.1], [0, 0, 0]])]),
    clip('death', 1.0, [qt('body', [0, 1], [[0, 0, 0], [-1.5, 0, 0]]), vt('body', [0, 1], [[0, 0.95, 0], [0, 0.35, 0]])]),
  ];
  return { g, body, mats: [bark, dark], clips, top: 2.4, aura: 2.3 };
}

export function createEnemies(G) {
  const { ctx, fx, ui } = G;
  const list = [];
  const auraGeo = new THREE.OctahedronGeometry(0.16, 0);
  const warn = new THREE.MeshBasicMaterial({ color: 0xff3a2a, transparent: true, opacity: 0.35, depthWrite: false, side: THREE.DoubleSide });
  const warnGeo = new THREE.RingGeometry(0.0, 1, 40); warnGeo.rotateX(-Math.PI / 2);
  const tmp = new THREE.Vector3();

  function spawn(type, x, z) {
    const d = ENEMIES[type];
    const b = type === 'bramble_wisp' ? buildWisp(d) : buildBrute(d);
    b.g.scale.setScalar(d.scale);
    b.g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    const mixer = new THREE.AnimationMixer(b.g);
    const act = {}; for (const c of b.clips) { act[c.name] = mixer.clipAction(c); }
    act.death.setLoop(THREE.LoopOnce); act.death.clampWhenFinished = true;
    act.attack.setLoop(THREE.LoopOnce); act.attack.clampWhenFinished = true; act.hit.setLoop(THREE.LoopOnce); act.hit.clampWhenFinished = true;
    const aura = new THREE.Mesh(auraGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false })); aura.visible = false; aura.position.y = b.aura; b.g.add(aura);
    const e = { type, d, g: b.g, body: b.body, mats: b.mats, mixer, act, cur: null, aura, auraMesh: aura, top: b.top * d.scale,
      home: new THREE.Vector3(x, 0, z), pos: new THREE.Vector3(x, heightAt(x, z), z), yaw: Math.random() * 6.28,
      hp: d.hp, max: d.hp, state: 'idle', t: 1 + Math.random() * 2, tgt: new THREE.Vector3(x, 0, z), cd: 0,
      stun: 0, slow: 0, burn: 0, burnTick: 0, auraEl: null, auraT: 0, aggro: false, dead: false, respawn: 0, flash: 0, struck: false, lunge: 0,
      bar: ui.enemyBar(d.name), id: list.length };
    e.g.position.copy(e.pos); ctx.scene.add(e.g);
    play(e, 'idle', 0); list.push(e); return e;
  }
  function play(e, name, fade = 0.2) {
    if (e.cur === name) return;
    const n = e.act[name], o = e.cur && e.act[e.cur];
    n.reset().fadeIn(fade).play(); if (o) o.fadeOut(fade); e.cur = name;
  }
  for (const [t, x, z] of SPAWNS) spawn(t, x, z);

  const dist2 = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
  function setState(e, s, t = 0) { e.state = s; e.t = t; }
  function faceTo(e, x, z, dt, rate = 10) { e.yaw = dampAngle(e.yaw, yawOf(x - e.pos.x, z - e.pos.z), rate, dt); }
  function walkable(x, z) { return heightAt(x, z) > WORLD.waterLevel + 1.2; }
  function moveTo(e, x, z, speed, dt) {
    const dx = x - e.pos.x, dz = z - e.pos.z, l = Math.hypot(dx, dz) || 1;
    const sp = speed * (e.slow > 0 ? 0.4 : 1) * dt, nx = e.pos.x + (dx / l) * sp, nz = e.pos.z + (dz / l) * sp;
    if (walkable(nx, nz)) { e.pos.x = nx; e.pos.z = nz; }
    return l;
  }

  function damage(e, amount, o = {}) {
    if (e.dead) return 0;
    const dmg = Math.max(1, Math.round(amount - e.d.def * 0.5));
    e.hp = Math.max(0, e.hp - dmg);
    e.flash = 0.12; e.aggro = true;
    ui.float(tmp.set(e.pos.x, e.pos.y + e.top, e.pos.z), String(dmg), o.crit ? 'crit' : o.dot ? 'dot' : '');
    if (o.knock) { const k = o.knock; e.pos.x += k.x; e.pos.z += k.z; }
    if (e.hp <= 0) { die(e); return dmg; }
    if (!o.dot) {   // stagger; the brute has poise while winding up / striking
      const poise = e.type === 'rootling_brute' && (e.state === 'windup' || e.state === 'strike');
      if (!poise) { e.stun = Math.max(e.stun, 0.3); setState(e, 'stunned', 0.3); play(e, 'idle', 0.05); e.act.hit.reset().play(); }
    }
    return dmg;
  }
  function applyStun(e, sec) { if (e.dead) return; e.stun = Math.max(e.stun, sec); setState(e, 'stunned', sec); play(e, 'idle', 0.1); }
  function die(e) {
    e.dead = true; e.state = 'dead'; e.t = 0; e.respawn = 40; e.bar.hide(); e.aura.visible = false;
    play(e, 'death', 0.08); e.auraEl = null;
    G.fx.burst(tmp.set(e.pos.x, e.pos.y + 1, e.pos.z), e.d.color, 18, 4, 0.2, 0.8);
    S.kills++;
    addXp(e.d.xp); ui.float(tmp.set(e.pos.x, e.pos.y + e.top + 0.5, e.pos.z), `+${e.d.xp} XP`, 'xp');
    for (const [it, p] of Object.entries(e.d.drops)) if (Math.random() < p) addItem(it, 1);
    questEvent('kill', e.type);
    if (G.lock?.target === e) G.lock.clear();
    emit('kill', e.type);
  }
  function revive(e) {
    e.dead = false; e.hp = e.max; e.state = 'idle'; e.t = 1; e.aggro = false; e.pos.copy(e.home); e.pos.y = heightAt(e.home.x, e.home.z);
    e.auraEl = null; e.burn = e.stun = e.slow = 0; e.g.visible = true; e.act.death.stop(); e.cur = null; play(e, 'idle', 0); e.g.scale.setScalar(e.d.scale);
  }

  function update(dt) {
    const p = G.player.position;
    for (const e of list) {
      const dp = dist2(e.pos, p);
      if (e.dead) {
        e.t += dt; e.mixer.update(dt);
        if (e.t > 1.6) { e.g.scale.setScalar(Math.max(0.001, e.d.scale * (1 - (e.t - 1.6) / 0.6))); }
        if (e.t > 2.2) e.g.visible = false;
        e.respawn -= dt; if (e.respawn <= 0 && dp > 25) revive(e);
        continue;
      }
      if (dp > 110) { e.g.visible = false; e.bar.hide(); continue; }
      e.g.visible = true;
      // timers / statuses
      e.stun = Math.max(0, e.stun - dt); e.slow = Math.max(0, e.slow - dt);
      if (e.auraT > 0) { e.auraT -= dt; if (e.auraT <= 0) { e.auraEl = null; } }
      if (e.burn > 0) { e.burn -= dt; e.burnTick -= dt; if (e.burnTick <= 0) { e.burnTick = 1; damage(e, 3 + S.level, { dot: true }); if (e.dead) continue; } }
      e.cd -= dt; e.t -= dt;
      const pAlive = G.alive();
      switch (e.state) {
        case 'idle':
          if (e.aggro && pAlive || (dp < e.d.detect && pAlive)) { e.aggro = true; setState(e, 'chase'); break; }
          if (e.t <= 0) { const a = Math.random() * 6.28, r = 2 + Math.random() * 5; e.tgt.set(e.home.x + Math.cos(a) * r, 0, e.home.z + Math.sin(a) * r); setState(e, 'patrol', 6); }
          play(e, 'idle'); break;
        case 'patrol': {
          if (dp < e.d.detect && pAlive) { e.aggro = true; setState(e, 'chase'); break; }
          const l = moveTo(e, e.tgt.x, e.tgt.z, e.d.speed * 0.4, dt); faceTo(e, e.tgt.x, e.tgt.z, dt, 5); play(e, 'walk');
          if (l < 0.6 || e.t <= 0) setState(e, 'idle', 1.5 + Math.random() * 2.5);
          break;
        }
        case 'chase': {
          const home = dist2(e.pos, e.home);
          if (!pAlive || home > 45 || dp > e.d.detect * 3) { e.aggro = false; setState(e, 'return', 8); break; }
          faceTo(e, p.x, p.z, dt);
          if (dp > e.d.range * 0.9) { moveTo(e, p.x, p.z, e.d.speed, dt); play(e, 'walk'); }
          else { play(e, 'idle'); if (e.cd <= 0) { setState(e, 'windup', e.d.windup); e.struck = false; play(e, 'attack', 0.08); e.act.attack.reset().play(); e.act.attack.timeScale = 1.2 / (e.d.windup + 0.35) * (e.type === 'rootling_brute' ? 0.9 / 0.95 : 0.9); G.telegraph(e); } }
          break;
        }
        case 'windup':
          faceTo(e, p.x, p.z, dt, 4);
          e.flash = Math.max(e.flash, 0.05);
          if (e.t <= 0) { setState(e, 'strike', 0.28); e.struck = false; e.lunge = e.type === 'bramble_wisp' ? 1 : 0; }
          break;
        case 'strike':
          if (e.lunge) { const dx = Math.sin(e.yaw) * -1, dz = -Math.cos(e.yaw); const nx = e.pos.x + dx * 9 * dt, nz = e.pos.z + dz * 9 * dt; if (walkable(nx, nz) && dp > 0.9) { e.pos.x = nx; e.pos.z = nz; } }
          if (!e.struck) {
            e.struck = true;
            const reach = e.d.range + 0.7;
            if (dist2(e.pos, p) < reach) G.hurtPlayer(e.d.atk * (0.9 + Math.random() * 0.2), e.pos, e);
            fx.burst(tmp.set(e.pos.x - Math.sin(e.yaw) * e.d.range * 0.6, e.pos.y + 0.3, e.pos.z - Math.cos(e.yaw) * e.d.range * 0.6), e.d.accent, 8, 3, 0.15, 0.4);
          }
          if (e.t <= 0) { e.cd = e.d.cooldown; setState(e, 'chase'); }
          break;
        case 'stunned':
          if (e.t <= 0 && e.stun <= 0) setState(e, 'chase');
          break;
        case 'return': {
          const l = moveTo(e, e.home.x, e.home.z, e.d.speed, dt); faceTo(e, e.home.x, e.home.z, dt); play(e, 'walk'); e.hp = Math.min(e.max, e.hp + e.max * 0.1 * dt);
          if (l < 1 || e.t <= 0) setState(e, 'idle', 2);
          if (dp < e.d.detect * 0.6 && pAlive) { e.aggro = true; setState(e, 'chase'); }
          break;
        }
      }
      // keep clear of the player and other enemies
      if (dp < 0.8 + e.d.radius * 0.5 && e.state !== 'strike') { const l = dp || 1; e.pos.x += (e.pos.x - p.x) / l * (0.8 + e.d.radius * 0.5 - dp); e.pos.z += (e.pos.z - p.z) / l * (0.8 + e.d.radius * 0.5 - dp); }
      for (const o of list) if (o !== e && !o.dead) { const d = dist2(e.pos, o.pos); if (d < 1.0 && d > 0.001) { e.pos.x += (e.pos.x - o.pos.x) / d * 0.02; e.pos.z += (e.pos.z - o.pos.z) / d * 0.02; } }
      const gy = heightAt(e.pos.x, e.pos.z);
      e.pos.y = e.pos.y + (gy - e.pos.y) * Math.min(1, dt * 12);
      e.g.position.copy(e.pos); e.g.rotation.y = e.yaw;
      e.mixer.update(dt);
      // flash / aura visuals
      e.flash = Math.max(0, e.flash - dt);
      const red = e.state === 'windup' ? 0.6 + 0.4 * Math.sin(ctx.time * 30) : e.flash > 0 ? 1 : 0;
      for (const m of e.mats) { m.emissive.set(red ? 0xff3020 : e.d.color); m.emissiveIntensity = red ? red * 0.9 : (e.type === 'bramble_wisp' ? 0.35 : 0); }
      e.aura.visible = !!e.auraEl; if (e.auraEl) { e.aura.material.color.set(G.elements[e.auraEl].color).multiplyScalar(1.5); e.aura.rotation.y += dt * 3; }
      e.bar.set(e.hp / e.max, e.pos, e.top + 0.3, e.hp < e.max || G.lock?.target === e || (e.aggro && dp < 30), G.lock?.target === e);
    }
  }
  const alive = () => list.filter((e) => !e.dead);
  return { list, spawn, update, damage, applyStun, alive, nearest(pos, r) { let b = null, bd = r; for (const e of list) if (!e.dead) { const d = dist2(e.pos, pos); if (d < bd) { bd = d; b = e; } } return b; } };
}
