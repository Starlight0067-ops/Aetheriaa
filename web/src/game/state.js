// Player progress state, inventory, quest manager, XP/levels and localStorage save (port of game.gd / inventory.gd /
// quest_manager.gd / save_manager.gd). Everything emits through `bus` so the UI can react without coupling.
import { ITEMS, QUESTS, PLACES, ELEMENT_ORDER } from './data.js';

const KEY = 'aetheria.web.save.v1';
export const bus = new EventTarget();
export const emit = (type, detail) => bus.dispatchEvent(new CustomEvent(type, { detail }));
export const on = (type, fn) => bus.addEventListener(type, (e) => fn(e.detail));

const fresh = () => ({
  name: 'Kael', level: 1, xp: 0, hp: 100, energy: 100, heals: 3, element: 'pyra', unlocked: [...ELEMENT_ORDER],
  inv: { healing_tonic: 2, copper_coin: 10 }, equip: { weapon: 'travelers_blade', charm: '' },
  flags: {}, quests: {}, opened: {}, playTime: 0, kills: 0,
  settings: { sens: 1, volume: 0.7 },
});
export const S = fresh();
export const maxHp = () => 100 + 12 * (S.level - 1) + equipStat('max_hp');
export const atk = () => 12 + 2 * (S.level - 1) + equipStat('atk');
export const def = () => 4 + equipStat('def');
export const xpToNext = () => Math.floor(50 * Math.pow(S.level, 1.5));
export const maxHeals = () => 3;
function equipStat(k) { let t = 0; for (const id of Object.values(S.equip)) if (id) t += ITEMS[id]?.stats?.[k] || 0; return t; }

// ---------------------------------------------------------------- save
export function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch { /* storage unavailable */ } }
export function load() {
  try {
    const d = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (d && typeof d === 'object') { Object.assign(S, fresh(), d); S.settings = { ...fresh().settings, ...(d.settings || {}) }; return true; }
  } catch { /* corrupt save */ }
  return false;
}
export function reset() { try { localStorage.removeItem(KEY); } catch { /* ignore */ } Object.assign(S, fresh()); }

// ---------------------------------------------------------------- inventory
export const count = (id) => S.inv[id] || 0;
export function addItem(id, n = 1, silent) {
  if (!ITEMS[id]) return;
  S.inv[id] = count(id) + n;
  if (!silent) emit('toast', `+${n} ${ITEMS[id].name}`);
  emit('inventory');
  if (n > 0) questEvent('collect', id);
}
export function takeItem(id, n = 1) { S.inv[id] = Math.max(0, count(id) - n); if (!S.inv[id]) delete S.inv[id]; emit('inventory'); }
export function useItem(id) {
  const it = ITEMS[id];
  if (!it || count(id) < 1) return false;
  if (it.heal) { if (S.hp >= maxHp()) return false; takeItem(id); heal(it.heal); return true; }
  return false;
}
export function equip(id) {
  const it = ITEMS[id]; if (!it || it.cat !== 'equipment' || count(id) < 1) return;
  S.equip[it.slot] = S.equip[it.slot] === id && it.slot === 'charm' ? '' : id;
  S.hp = Math.min(S.hp, maxHp()); emit('inventory'); save();
}

// ---------------------------------------------------------------- vitals / xp
export function heal(n) { S.hp = Math.min(maxHp(), S.hp + n); emit('heal', n); }
export function addXp(n) {
  S.xp += n;
  while (S.xp >= xpToNext()) {
    S.xp -= xpToNext(); S.level++; S.hp = maxHp(); S.energy = 100;
    emit('levelup', S.level);
  }
  save();
}

// ---------------------------------------------------------------- quests
export const quest = (id) => S.quests[id];
export function startQuest(id) {
  if (!QUESTS[id] || S.quests[id]) return;
  S.quests[id] = { status: 'active', step: 0, n: 0 };
  emit('quest', { id, started: true }); emit('toast', `Quest: ${QUESTS[id].title}`);
  const st0 = currentStep(id); if (st0?.type === 'collect') questEvent('collect', st0.target);
  checkReach(); save();
}
export const activeQuests = () => Object.keys(S.quests).filter((id) => S.quests[id].status === 'active');
export const currentStep = (id) => { const q = S.quests[id]; return q && q.status === 'active' ? QUESTS[id].steps[q.step] : null; };
/** The first active quest's step: the HUD tracker and minimap marker. */
export function tracked() {
  const act = activeQuests().sort((a, b) => (QUESTS[a].type === 'main' ? -1 : 1) - (QUESTS[b].type === 'main' ? -1 : 1));
  const id = act[0]; return id ? { id, quest: QUESTS[id], step: currentStep(id), state: S.quests[id] } : null;
}
function completeStep(id) {
  const q = S.quests[id], def_ = QUESTS[id];
  q.step++; q.n = 0;
  if (q.step >= def_.steps.length) return completeQuest(id);
  emit('quest', { id, step: q.step }); emit('toast', def_.steps[q.step].text); checkReach(); save();
}
function completeQuest(id) {
  const q = S.quests[id], d = QUESTS[id], r = d.rewards || {};
  q.status = 'done';
  for (const [it, n] of Object.entries(r.take || {})) takeItem(it, n);
  for (const [it, n] of Object.entries(r.items || {})) addItem(it, n);
  if (r.flag) S.flags[r.flag] = true;
  if (r.xp) addXp(r.xp);
  emit('quest', { id, done: true }); emit('banner', { title: 'QUEST COMPLETE', sub: d.title });
  if (d.next) startQuest(d.next);
  save();
}
/** type: talk | kill | collect | reach | interact */
export function questEvent(type, target) {
  for (const id of activeQuests()) {
    const q = S.quests[id], st = QUESTS[id].steps[q.step];
    if (!st || st.type !== type || st.target !== target) continue;
    if (st.count) {
      q.n = type === 'collect' ? count(target) : q.n + 1;
      emit('quest', { id, progress: true });
      if (q.n >= st.count) completeStep(id);
    } else completeStep(id);
  }
}
let playerPos = null;
export const setPlayerPos = (p) => { playerPos = p; };
export function checkReach() {
  if (!playerPos) return;
  for (const id of activeQuests()) {
    const st = currentStep(id);
    if (st?.type !== 'reach') continue;
    const pl = PLACES[st.target];
    if (pl && Math.hypot(playerPos.x - pl.x, playerPos.z - pl.z) < pl.r) questEvent('reach', st.target);
  }
}
export function condMet(c) {
  if (c.step) { const [id, i] = c.step.split(':'); const q = S.quests[id]; if (!q || q.status !== 'active' || q.step !== +i) return false; }
  if (c.flag && !S.flags[c.flag]) return false;
  if (c.active && S.quests[c.active]?.status !== 'active') return false;
  if (c.done && S.quests[c.done]?.status !== 'done') return false;
  return true;
}
