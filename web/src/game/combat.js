// Player combat: 3-hit combo (arc hitbox, damage window, hit-stop), dodge feedback, elemental skills + reactions,
// healing charges, vitals regeneration, hurt / death / respawn. Ports player.gd + element_system.gd.
import * as THREE from 'three';
import { POI } from '../core/layout.js';
import { yawOf, clamp } from '../player/math.js';
import { ELEMENTS, ELEMENT_ORDER, reactionFor } from './data.js';
import { S, maxHp, atk, def, heal, emit, count, useItem } from './state.js';

const COMBO = [1.0, 1.1, 1.6], DUR = [0.5, 0.5, 0.8], HIT_AT = [0.2, 0.2, 0.36], ARC = [2.1, 2.1, 3.4], REACH = [2.5, 2.5, 3.0];
const v = new THREE.Vector3(), w = new THREE.Vector3();

export function createCombat(G) {
  const { ctx, fx, ui, player, input } = G;
  const c = player.controller, cs = player.controls.state;
  const st = { atkT: 99, combo: 0, hit: true, window: 0, queued: false, cd: Object.fromEntries(ELEMENT_ORDER.map((k) => [k, 0])), iframes: 0,
    dead: false, deadT: 0, castT: 0, healT: 0, gale: false, last: null, hitStop: 0 };
  const el = () => ELEMENTS[S.element];
  const fwd = () => v.set(-Math.sin(c.facing), 0, -Math.cos(c.facing));
  const chest = (p) => w.set(p.x, p.y + 1.1, p.z);

  function faceTarget() {
    const t = G.lock.target || G.enemies.nearest(c.position, 5.5);
    if (t) c.facing = yawOf(t.pos.x - c.position.x, t.pos.z - c.position.z);
    return t;
  }
  const spend = (n) => { c.stamina.value = Math.max(0, c.stamina.value - n); c.regenT = Math.max(c.regenT, 0.6); };

  // ------------------------------------------------------------ elemental damage / reactions
  function applyElement(e, elId, dmg, status) {
    let name = null;
    const r = e.auraEl && e.auraEl !== elId && e.auraT > 0 ? reactionFor(e.auraEl, elId) : null;
    if (r) {
      dmg *= r.multiplier; name = r.name; e.auraEl = null; e.auraT = 0;
      if (r.stun) G.enemies.applyStun(e, r.stun);
      if (r.slow) e.slow = Math.max(e.slow, r.slow);
      if (r.knockback) { const dx = e.pos.x - c.position.x, dz = e.pos.z - c.position.z, l = Math.hypot(dx, dz) || 1; e.pos.x += dx / l * r.knockback * 0.4; e.pos.z += dz / l * r.knockback * 0.4; }
      if (r.aoe_radius) for (const o of G.enemies.list) if (o !== e && !o.dead && Math.hypot(o.pos.x - e.pos.x, o.pos.z - e.pos.z) < r.aoe_radius) G.enemies.damage(o, atk() * r.aoe_damage, { dot: true });
      ui.float(v.set(e.pos.x, e.pos.y + e.top + 0.45, e.pos.z), r.name.toUpperCase() + '!', 'react', r.color);
      fx.ring(e.pos, r.color, (r.aoe_radius || 2.5), 0.5); fx.burst(w.set(e.pos.x, e.pos.y + 1, e.pos.z), r.color, 16, 5, 0.18, 0.6);
      G.sfx('reaction'); st.last = r.name; emit('reaction', r.name);
    } else { e.auraEl = elId; e.auraT = 8; }
    if (status) {
      if (elId === 'pyra') { e.burn = 4; e.burnTick = 0.6; } else if (elId === 'terra') G.enemies.applyStun(e, 0.9);
      else if (elId === 'crya') e.slow = Math.max(e.slow, 3); else if (elId === 'zephyr') G.enemies.applyStun(e, 0.5);
    }
    return Math.round(dmg);
  }
  function strike(e, base, elId, o = {}) {
    const dmg = applyElement(e, elId, base, o.status);
    const dx = e.pos.x - c.position.x, dz = e.pos.z - c.position.z, l = Math.hypot(dx, dz) || 1, k = o.knock || 0;
    G.enemies.damage(e, dmg, { knock: k ? { x: dx / l * k, z: dz / l * k } : null, crit: o.crit });
    fx.burst(w.set(e.pos.x, e.pos.y + e.top * 0.5, e.pos.z), ELEMENTS[elId].color, o.big ? 14 : 7, 4, 0.14, 0.4);
  }

  // ------------------------------------------------------------ melee
  function startAttack() {
    const i = st.window > 0 ? (st.combo + 1) % 3 : 0;
    st.combo = i; st.atkT = 0; st.hit = false; st.queued = false;
    faceTarget();
    player.visual.play('attack' + (i + 1), { loop: false, fade: 0.06, speed: i === 2 ? 0.95 : 1.15 });
    spend(4); G.sfx('swing'); st.window = 0;
  }
  function doHit() {
    st.hit = true;
    const i = st.combo, f = fwd().clone(), p = c.position; let n = 0;
    for (const e of G.enemies.list) {
      if (e.dead) continue;
      const dx = e.pos.x - p.x, dz = e.pos.z - p.z, d = Math.hypot(dx, dz);
      if (d > REACH[i] + e.d.radius) continue;
      if (d > 0.6 && (dx * f.x + dz * f.z) / d < Math.cos(ARC[i] / 2)) continue;
      const crit = Math.random() < 0.1;
      strike(e, atk() * COMBO[i] * (0.9 + Math.random() * 0.2) * (crit ? 1.5 : 1), S.element, { knock: i === 2 ? 1.2 : 0.35, crit, big: i === 2 });
      n++;
    }
    if (n) { G.hitStop(i === 2 ? 0.12 : 0.07); player.camera.shake(i === 2 ? 0.25 : 0.1); G.sfx('hit'); S.energy = Math.min(100, S.energy + 5 * n); }
    // slash arc visual
    fx.burst(v.set(p.x + f.x * 1.3, p.y + 1.1, p.z + f.z * 1.3), ELEMENTS[S.element].color, 6, 3, 0.1, 0.25, 0.3);
    return n;
  }

  // ------------------------------------------------------------ skills
  function castSkill() {
    const id = S.element, d = ELEMENTS[id], k = d.skill;
    if (st.dead || st.cd[id] > 0 || S.energy < k.cost || c.mode === 'dodge' || G.busy()) return false;
    S.energy -= k.cost; st.cd[id] = k.cooldown; st.castT = 0.45;
    const t = faceTarget(), p = c.position, f = fwd().clone();
    player.visual.play('cast', { loop: false, fade: 0.06 });
    G.sfx(id); const base = atk() * k.damage * (1 + 0.05 * (S.level - 1));
    if (k.type === 'projectile') {
      const origin = new THREE.Vector3(p.x + f.x * 0.8, p.y + 1.15, p.z + f.z * 0.8);
      const dir = f.clone(); if (t) dir.set(t.pos.x - origin.x, 0, t.pos.z - origin.z).normalize();
      fx.burst(origin, d.color, 10, 3, 0.15, 0.4);
      fx.bolt(origin, dir, d.color, k.speed, 24, id === 'volt' ? 0.14 : 0.24, (pos) => {
        for (const e of G.enemies.list) {
          if (e.dead) continue;
          if (Math.hypot(e.pos.x - pos.x, e.pos.z - pos.z) < 0.7 + e.d.radius * 0.7 && pos.y < e.pos.y + e.top + 0.5) {
            for (const o of G.enemies.list) if (!o.dead && Math.hypot(o.pos.x - pos.x, o.pos.z - pos.z) < k.radius * 0.6 + o.d.radius * 0.5) strike(o, base * (o === e ? 1 : 0.6), id, { status: true, knock: 0.5, big: true });
            fx.ring(pos, d.color, k.radius * 0.7, 0.4, -0.7); G.hitStop(0.08); G.sfx('hit'); return true;
          }
        }
        return false;
      });
    } else if (k.type === 'aoe') {
      const cx = id === 'terra' ? p.x + f.x * 1.8 : p.x, cz = id === 'terra' ? p.z + f.z * 1.8 : p.z;
      fx.ring(v.set(cx, p.y, cz), d.color, k.radius, 0.55); fx.ring(v.set(cx, p.y, cz), d.color, k.radius * 0.6, 0.4);
      fx.burst(w.set(cx, p.y + 0.3, cz), d.color, 26, k.radius * 1.4, 0.2, 0.7);
      let n = 0;
      for (const e of G.enemies.list) if (!e.dead && Math.hypot(e.pos.x - cx, e.pos.z - cz) < k.radius + e.d.radius * 0.6) { strike(e, base, id, { status: true, knock: id === 'aqua' ? 1.2 : 0.4, big: true }); n++; }
      if (id === 'terra') player.camera.shake(0.35);
      if (n) G.hitStop(0.09);
    } else if (k.type === 'dash') {
      const T = c.tuning, saved = T.dodgeDistance;
      if (c.wish.lengthSq() < 0.01) c.wish.copy(f);
      T.dodgeDistance = k.distance; c.dodgeCd = 0; c.startDodge(1); T.dodgeDistance = saved;
      c.stamina.value = Math.min(c.stamina.max, c.stamina.value + T.dodgeStamina);
      const dir = c.dodge.dir.clone().normalize();
      fx.burst(v.set(p.x, p.y + 1, p.z), d.color, 18, 4, 0.16, 0.6); fx.ring(p, d.color, 2.2, 0.4);
      for (const e of G.enemies.list) {
        if (e.dead) continue;
        const dx = e.pos.x - p.x, dz = e.pos.z - p.z, a = dx * dir.x + dz * dir.z, lat = Math.abs(dx * dir.z - dz * dir.x);
        if (a > -0.5 && a < k.distance + 1 && lat < k.radius + e.d.radius * 0.6) strike(e, base, id, { status: true, knock: 0.3 });
      }
    }
    emit('skill', id); return true;
  }

  // ------------------------------------------------------------ healing / hurt / death
  function doHeal() {
    if (st.dead || G.busy()) return false;
    if (S.hp >= maxHp()) { ui.toast('Already at full health'); return false; }
    if (S.heals > 0) { S.heals--; st.healT = 0; heal(Math.round(maxHp() * 0.4)); }
    else if (count('healing_tonic') > 0) useItem('healing_tonic'); else { ui.toast('No healing charges'); return false; }
    player.visual.play('interact', { loop: false, fade: 0.1 });
    G.sfx('heal'); fx.burst(v.set(c.position.x, c.position.y + 1, c.position.z), '#7dffa0', 14, 2.5, 0.14, 0.8);
    ui.float(v.set(c.position.x, c.position.y + 2, c.position.z), '+HP', 'heal');
    return true;
  }
  function hurt(amount, from) {
    if (st.dead || st.iframes > 0) return false;
    if (c.invulnerable) { ui.float(v.set(c.position.x, c.position.y + 2, c.position.z), 'DODGE', 'react', '#7ff5ff'); G.sfx('dodge'); S.energy = Math.min(100, S.energy + 10); emit('perfectDodge'); return false; }
    const dmg = Math.max(1, Math.round(amount - def() * 0.5));
    S.hp = Math.max(0, S.hp - dmg); st.iframes = 0.55; st.atkT = 99; st.window = 0;
    ui.float(v.set(c.position.x, c.position.y + 2, c.position.z), String(dmg), 'hurt'); ui.flash();
    G.sfx('hurt'); player.camera.shake(0.3); G.hitStop(0.06);
    if (S.hp <= 0) return die();
    player.visual.play('hit', { loop: false, fade: 0.05 });
    return true;
  }
  function die() {
    st.dead = true; st.deadT = 0; G.lock.clear(); player.setEnabled(false);
    player.visual.play('death', { loop: false, fade: 0.1 }); G.sfx('die'); ui.death(true); emit('death');
    return true;
  }
  function respawn() {
    st.dead = false; S.hp = maxHp(); S.energy = 60; st.iframes = 2;
    c.teleport(POI.spawn.x, null, POI.spawn.z, 0); player.camera.snap();
    player.visual.play('idle', { loop: true, fade: 0.2 }); player.setEnabled(true); ui.death(false);
    for (const e of G.enemies.list) if (!e.dead) { e.aggro = false; if (e.state !== 'idle') { e.state = 'return'; e.t = 8; } }
  }

  // ------------------------------------------------------------ per-frame
  const pad = { prev: [] };
  function padEdge(i) { const g = input.gamepad?.(); const on = !!g && !!g.buttons[i] && g.buttons[i].pressed; const e = on && !pad.prev[i]; pad.prev[i] = on; return e; }
  function preControl(dt) {
    const jp = (k) => input.justPressed(k);
    const gAtk = padEdge(2) | padEdge(7), gSkill = padEdge(3) | padEdge(6), gLock = padEdge(4), gHeal = padEdge(8), gL = padEdge(14), gR = padEdge(15);
    if (st.dead) { st.deadT += dt; if (st.deadT > 2.8) respawn(); return; }
    st.iframes = Math.max(0, st.iframes - dt); st.castT = Math.max(0, st.castT - dt);
    for (const k in st.cd) st.cd[k] = Math.max(0, st.cd[k] - dt);
    // regeneration: energy always, heal charges slowly
    S.energy = Math.min(100, S.energy + 3 * dt);
    if (S.heals < 3) { st.healT += dt; if (st.healT > 30) { S.heals++; st.healT = 0; } }
    S.hp = Math.min(maxHp(), S.hp + 0.4 * dt);
    // element selection
    for (let i = 0; i < 6; i++) if (jp('Digit' + (i + 1))) G.setElement(ELEMENT_ORDER[i]);
    if (gL) G.setElement(ELEMENT_ORDER[(ELEMENT_ORDER.indexOf(S.element) + 5) % 6]);
    if (gR) G.setElement(ELEMENT_ORDER[(ELEMENT_ORDER.indexOf(S.element) + 1) % 6]);
    if (jp('Tab') || gLock) G.lock.toggle();
    if (jp('KeyQ')) G.lock.next();
    if (jp('KeyH') || gHeal) doHeal();
    if (jp('KeyE') || gSkill) castSkill();
    const press = input.clicked(0) || gAtk;
    // melee state machine
    const attacking = st.atkT < DUR[st.combo];
    if (press && !G.busy() && c.mode !== 'dodge' && c.stamina.value >= 4) {
      if (!attacking && st.castT <= 0) startAttack(); else if (attacking) st.queued = true;
    }
    if (attacking) {
      st.atkT += dt;
      if (!st.hit && st.atkT >= HIT_AT[st.combo]) doHit();
      if (st.queued && st.atkT >= DUR[st.combo] * 0.75) startAttack();
      else if (st.atkT >= DUR[st.combo]) { st.window = 0.55; }
      if (cs.dodgePressed || c.mode === 'dodge') { st.atkT = 99; st.window = 0; }
      cs.moveX *= 0.2; cs.moveY *= 0.2; cs.moveMag *= 0.2; cs.jumpPressed = false; cs.sprintHeld = false;
    } else st.window = Math.max(0, st.window - dt);
    if (st.castT > 0) { cs.moveX *= 0.3; cs.moveY *= 0.3; cs.moveMag *= 0.3; cs.sprintHeld = false; }
    if (c.stamina.exhausted === false && S.hp > 0) { /* stamina regen handled by controller */ }
  }
  c.on('dodge', () => { G.sfx('dodge'); st.atkT = 99; st.window = 0; });
  return { st, preControl, castSkill, doHeal, hurt, die, respawn, startAttack, applyElement, get dead() { return st.dead; }, get attacking() { return st.atkT < DUR[st.combo]; } };
}
