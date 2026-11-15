// Gameplay layer entry (create(ctx) like every other system): wires state, FX, UI, enemies, combat, lock-on,
// interaction, audio and exposes window.__game for debugging / automated tests (?test=1 -> step()).
import * as THREE from 'three';
import { ELEMENTS } from './data.js';
import { S, load, save, maxHp, startQuest, quest, on, emit } from './state.js';
import { sfx, audioState } from './audio.js';
import { createFx } from './fx.js';
import { createUI } from '../ui/ui.js';
import { createEnemies } from './enemies.js';
import { createLock } from './lockon.js';
import { createCombat } from './combat.js';
import { createInteract } from './interact.js';

export async function create(ctx) {
  const player = ctx.systems.player;
  if (!ctx.shot && !ctx.params.has('nosave')) load();
  S.hp = Math.min(Math.max(S.hp, 1), maxHp());
  const G = { ctx, player, input: ctx.input, elements: ELEMENTS, sfx };
  if (ctx.shot || ctx.params.has('nogame')) return G;   // screenshot mode: no gameplay layer
  G.fx = createFx(ctx);
  G.ui = createUI(ctx, G);
  G.enemies = createEnemies(G);
  G.lock = createLock(G);
  G.combat = createCombat(G);
  G.interact = createInteract(G);
  G.alive = () => !G.combat.dead;
  G.busy = () => G.ui.isBlocked();
  G.hurtPlayer = (a, from) => G.combat.hurt(a, from);
  G.telegraph = (e) => G.fx.ring(e.pos, '#ff3a2a', e.d.range + 0.8, e.d.windup, 0.12);
  G.objective = () => G.interact.objective();
  G.npcPositions = () => G.interact.npcPositions();
  let hs = 0;
  G.hitStop = (s) => { hs = Math.max(hs, s); };
  G.setElement = (id) => { if (ELEMENTS[id] && S.unlocked.includes(id) && S.element !== id) { S.element = id; sfx('ui'); G.ui.toast(`${ELEMENTS[id].name}: ${ELEMENTS[id].skill.name}`); save(); } };
  G.applySettings = () => { player.camera.settings.sensitivity = 0.0022 * S.settings.sens; };
  G.applySettings();
  if (!Object.keys(S.quests).length) startQuest('mq_awakening');

  ctx.hooks.preControl = (dt) => { G.lock.update(dt); G.combat.preControl(dt); };
  let saveT = 0;
  ctx.updaters.push((dt) => {
    G.enemies.update(dt); G.interact.update(dt); G.fx.update(dt);
    S.playTime += dt; saveT += dt; if (saveT > 15) { saveT = 0; save(); }
  });
  ctx.uiUpdaters.push((raw) => { ctx.timeScale = hs > 0 ? 0.05 : 1; hs = Math.max(0, hs - raw); G.ui.update(raw); });
  addEventListener('pagehide', save);
  addEventListener('visibilitychange', () => { if (document.hidden) save(); });

  // ---- debugging / test hooks
  const step = (n = 1, dt = 1 / 30) => { for (let i = 0; i < n; i++) { ctx.tick(dt); ctx.input.endFrame(); } return api.snapshot(); };
  const api = {
    S, G, ctx, step, audioState, render: () => { ctx.renderOnce = true; },
    snapshot: () => ({ hp: S.hp, maxHp: maxHp(), energy: S.energy, stamina: player.controller.stamina.value, level: S.level, xp: S.xp, element: S.element, heals: S.heals,
      pos: [player.position.x, player.position.y, player.position.z].map((x) => +x.toFixed(2)), dead: G.combat.dead, lock: G.lock.target?.id ?? null, menu: G.ui.openMenu, dialog: G.ui.dialog.active,
      paused: ctx.paused, combo: G.combat.st.combo, kills: S.kills, inv: { ...S.inv }, quests: JSON.parse(JSON.stringify(S.quests)), enemies: G.enemies.list.filter((e) => !e.dead).length }),
    click: (b = 0) => { ctx.input.mouse.clicked.add(b); ctx.input.mouse.buttons.add(b); setTimeout(() => ctx.input.mouse.buttons.delete(b), 0); },
    key: (code) => { dispatchEvent(new KeyboardEvent('keydown', { code, key: code, bubbles: true })); },
    keyUp: (code) => { dispatchEvent(new KeyboardEvent('keyup', { code, key: code, bubbles: true })); },
    tap: (code, frames = 2) => { api.key(code); step(1); api.keyUp(code); step(Math.max(0, frames - 1)); },
    teleport: (x, z, yaw = 0) => { player.controller.teleport(x, null, z, yaw); player.camera.snap(); step(2); },
    spawnNear: (type = 'bramble_wisp', dist = 3.5) => {
      const p = player.position, f = new THREE.Vector3(-Math.sin(player.controller.facing), 0, -Math.cos(player.controller.facing));
      const e = G.enemies.spawn(type, p.x + f.x * dist, p.z + f.z * dist); e.aggro = false; return e.id;
    },
    enemy: (id) => G.enemies.list[id],
    clearEnemies: () => { for (const e of G.enemies.list) { e.dead = true; e.state = 'dead'; e.g.visible = false; e.bar.hide(); e.respawn = 1e9; } },
    spawnId: (id) => id,
    setHp: (v) => { S.hp = v; }, setEnergy: (v) => { S.energy = v; },
    cast: (el) => { G.setElement(el); G.combat.st.cd[el] = 0; S.energy = 100; return G.combat.castSkill(); },
    talk: (id) => G.interact.talk(id), nearestSpot: () => G.interact.nearest()?.label || null,
    openMenu: (n) => G.ui.openTab(n), closeMenu: () => G.ui.closeMenu(),
    killAll: () => { for (const e of G.enemies.list) if (!e.dead) G.enemies.damage(e, 99999); },
  };
  window.__game = api;
  return api;
}
