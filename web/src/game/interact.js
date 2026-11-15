// World interaction: NPC dialogue (conditions from data/dialogue), chests, gatherables, quest objective marker.
import * as THREE from 'three';
import { heightAt } from '../core/layout.js';
import { yawOf } from '../player/math.js';
import { NPCS, DIALOGUES, PLACES, ITEMS } from './data.js';
import { S, addItem, startQuest, questEvent, condMet, tracked, setPlayerPos, checkReach, save, emit } from './state.js';

const CHESTS = [{ id: 'chest_plaza', x: -9, z: 17, items: { copper_coin: 25, healing_tonic: 1 } }, { id: 'chest_east', x: 168, z: 14, items: { copper_coin: 40, honey_bread: 2 } }];
const GATHER = [[152, -4], [159, 9], [166, -15], [173, 24], [-184, -12], [-170, 60]].map(([x, z], i) => ({ id: 'sunpetal_' + i, x, z, item: 'sunpetal' }));

export function createInteract(G) {
  const { ctx, ui } = G, scene = ctx.scene;
  const spots = [];   // {kind, id, x, z, y, r, label, obj}
  const mat = (c, e = 0) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.7, emissive: c, emissiveIntensity: e });
  for (const c of CHESTS) {
    const g = new THREE.Group(), y = heightAt(c.x, c.z);
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.6, 0.65), mat(0x6b4a2a)); body.position.y = 0.3;
    const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.33, 0.33, 1.0, 12, 1, false, 0, Math.PI), mat(0x7a5530)); lid.rotation.z = Math.PI / 2; lid.position.y = 0.6; lid.rotation.y = Math.PI / 2;
    const trim = new THREE.Mesh(new THREE.BoxGeometry(1.04, 0.12, 0.69), mat(0xe2b95b, 0.5)); trim.position.y = 0.45;
    g.add(body, lid, trim); g.position.set(c.x, y, c.z); g.traverse((o) => { o.castShadow = true; }); scene.add(g);
    spots.push({ kind: 'chest', id: c.id, x: c.x, z: c.z, r: 2.3, label: 'Open chest', obj: g, data: c, done: !!S.opened[c.id] });
  }
  for (const gth of GATHER) {
    const g = new THREE.Group(), y = heightAt(gth.x, gth.z);
    const petal = mat(0xffd34d, 0.8); for (let i = 0; i < 6; i++) { const p = new THREE.Mesh(new THREE.SphereGeometry(0.09, 6, 4), petal); const a = (i / 6) * 6.28; p.position.set(Math.cos(a) * 0.17, 0.62, Math.sin(a) * 0.17); p.scale.set(1, 0.5, 1.6); p.rotation.y = -a; g.add(p); }
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 6), mat(0xb86b1a)); core.position.y = 0.62; const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.6, 5), mat(0x3d8a3a)); stem.position.y = 0.3;
    g.add(core, stem); g.position.set(gth.x, y, gth.z); scene.add(g);
    spots.push({ kind: 'gather', id: gth.id, x: gth.x, z: gth.z, r: 2.0, label: 'Gather Sunpetal', obj: g, data: gth, done: !!S.opened[gth.id] });
  }
  for (const s of spots) if (s.done) s.obj.visible = false;

  // quest marker: bobbing diamond (+ a light beam for "reach" objectives)
  const marker = new THREE.Group();
  const dia = new THREE.Mesh(new THREE.OctahedronGeometry(0.3, 0), new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffd36b').multiplyScalar(1.6), toneMapped: false })); dia.scale.y = 1.5;
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 40, 12, 1, true), new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffd36b').multiplyScalar(1.3), transparent: true, opacity: 0.25, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, side: THREE.DoubleSide }));
  beam.position.y = 20; marker.add(dia, beam); marker.visible = false; scene.add(marker);

  const npcList = () => ctx.systems.world?.npcs?.npcs || [];
  const npcPositions = () => npcList().filter((n) => NPCS[n.c.id]).map((n) => ({ id: n.c.id, x: n.ch.object.position.x, z: n.ch.object.position.z, y: n.ch.object.position.y }));
  const live = () => spots.filter((s) => !s.done);

  function objective() {
    const t = tracked(); const st = t?.step; if (!st) return null;
    if (st.type === 'talk') return npcPositions().find((n) => n.id === st.target) || null;
    if (st.type === 'reach') { const p = PLACES[st.target]; return p ? { x: p.x, z: p.z, y: heightAt(p.x, p.z), beam: true } : null; }
    const p = G.player.position;
    if (st.type === 'kill') {
      let b = null, bd = 1e9; for (const e of G.enemies.list) if (e.type === st.target && !e.dead) { const d = Math.hypot(e.pos.x - p.x, e.pos.z - p.z); if (d < bd) { bd = d; b = e; } }
      return b ? { x: b.pos.x, z: b.pos.z, y: b.pos.y } : { x: 190, z: 5, y: 15 };
    }
    if (st.type === 'collect') { let b = null, bd = 1e9; for (const s of live()) if (s.kind === 'gather') { const d = Math.hypot(s.x - p.x, s.z - p.z); if (d < bd) { bd = d; b = s; } } return b ? { x: b.x, z: b.z, y: heightAt(b.x, b.z) } : null; }
    return null;
  }

  function talk(id) {
    const info = NPCS[id]; if (!info) return;
    const entry = info.dialogues.find(([, c]) => condMet(c)); if (!entry) return;
    const nodes = DIALOGUES[entry[0]]; if (!nodes) return;
    const n = npcList().find((x) => x.c.id === id), p = G.player.position;
    if (n) n.ch.object.rotation.y = yawOf(p.x - n.ch.object.position.x, p.z - n.ch.object.position.z);
    G.lock.clear(); G.sfx('ui');
    ui.dialog.start(nodes, { [id]: { name: info.name, color: info.color } }, (a) => {
      if (a[0] === 'start_quest') startQuest(a[1]);
    }, () => questEvent('talk', id));
  }
  function open(s) {
    s.done = true; S.opened[s.id] = true; save();
    if (s.kind === 'chest') {
      for (const [k, n] of Object.entries(s.data.items)) addItem(k, n);
      s.obj.children[1].rotation.x = -0.9; G.fx.burst(new THREE.Vector3(s.x, s.obj.position.y + 0.8, s.z), '#ffe08a', 16, 3, 0.15, 0.8);
      G.sfx('pickup'); emit('interact', s.id);
    } else { addItem(s.data.item, 1); s.obj.visible = false; G.fx.burst(new THREE.Vector3(s.x, s.obj.position.y + 0.6, s.z), '#ffd34d', 10, 2.5, 0.12, 0.6); G.sfx('pickup'); emit('interact', s.id); }
  }
  function nearest() {
    const p = G.player.position; let best = null, bd = 1e9;
    for (const n of npcPositions()) { const d = Math.hypot(n.x - p.x, n.z - p.z); if (d < 3.4 && d < bd) { bd = d; best = { kind: 'npc', id: n.id, label: 'Talk - ' + NPCS[n.id].name }; } }
    for (const s of live()) { const d = Math.hypot(s.x - p.x, s.z - p.z); if (d < s.r && d < bd) { bd = d; best = { kind: s.kind, spot: s, label: s.label }; } }
    return best;
  }
  let reachT = 0, cur = null;
  function update(dt) {
    const p = G.player.position; setPlayerPos(p);
    reachT += dt; if (reachT > 0.25) { reachT = 0; checkReach(); }
    cur = G.combat.dead ? null : nearest();
    ui.prompt(ctx.touch?.enabled ? 'Act' : 'F', cur?.label);
    if (cur && G.input.justPressed('KeyF') && !G.combat.dead) {
      if (cur.kind === 'npc') talk(cur.id); else open(cur.spot);
    }
    for (const s of spots) if (s.kind === 'gather' && !s.done) s.obj.rotation.y += dt;
    const o = objective(), t = ctx.time;
    marker.visible = !!o;
    if (o) { marker.position.set(o.x, o.y + (o.beam ? 3 : 2.8), o.z); dia.position.y = Math.sin(t * 3) * 0.2; dia.rotation.y = t * 2; beam.visible = !!o.beam; beam.position.y = 20 - 3; }
  }
  return { update, talk, open, spots, objective, npcPositions, nearest: () => cur, marker };
}
