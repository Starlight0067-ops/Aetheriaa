// DOM UI: HUD, floating numbers, enemy bars, lock-on reticle, interaction prompt, dialogue box, minimap and the
// menus (Inventory I, Journal J, Map M, Character C, Pause Esc). Pure DOM inside #ui; styles live in ui.css.
import * as THREE from 'three';
import './ui.css';
import { ELEMENTS, ELEMENT_ORDER, ITEMS, QUESTS, NPCS, PLACES } from '../game/data.js';
import { TOWN, RIVER, POI, WORLD } from '../core/layout.js';
import { S, maxHp, atk, def, xpToNext, count, useItem, equip, tracked, save, reset, on, currentStep, heal } from '../game/state.js';

const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const v = new THREE.Vector3();
const TABS = [['inventory', 'Inventory', 'I'], ['journal', 'Journal', 'J'], ['map', 'Map', 'M'], ['char', 'Character', 'C'], ['pause', 'Pause', 'Esc']];

export function createUI(ctx, G) {
  const root = document.getElementById('ui');
  const touch = !!ctx.touch?.enabled;
  root.classList.toggle('tui', touch);
  root.insertAdjacentHTML('beforeend', `
  <div id="hud">
    <div class="tl"><div class="nm"><b></b> <span></span></div>
      <div class="bar hp"><i></i><span></span></div><div class="bar st"><i></i></div><div class="bar en"><i></i></div><div class="bar xp"><i></i></div>
      <div class="heals" title="Healing charges (H)"></div></div>
    <div class="quest"><b></b><span></span></div>
    <canvas class="mini" width="132" height="132"></canvas>
    <div class="elems"></div>
    <div class="prompt"><kbd></kbd><span></span></div>
    <div class="toasts"></div><div class="banner"><b></b><span></span></div>
    <div class="worldlayer"></div>
    <div class="reticle"><svg viewBox="0 0 40 40"><path d="M6 14V6h8M26 6h8v8M34 26v8h-8M14 34H6v-8" fill="none" stroke="#ffd36b" stroke-width="3"/></svg></div>
    <button class="chip nextlock" type="button">Next target</button>
    <div class="flash"></div>
    <div class="death"><b>You fell</b><span>The pendant hums, and the world returns...</span></div>
  </div>
  <div id="dlg"><div class="box"><div class="who"></div><div class="txt"></div><div class="choices"></div>
    <div class="foot"><button class="skip" type="button">Skip</button><button class="next" type="button">Next &#9656;</button></div></div></div>
  <div id="menu"><div class="sheet"><div class="tabs"></div><div class="page"></div><button class="x" type="button" aria-label="Close">&times;</button></div></div>`);
  const hud = $('#hud'), menuEl = $('#menu'), dlgEl = $('#dlg');
  const layer = $('.worldlayer', hud);
  const els = { name: $('.nm b', hud), lvl: $('.nm span', hud), hp: $('.hp i', hud), hpt: $('.hp span', hud), st: $('.st i', hud), en: $('.en i', hud), xp: $('.xp i', hud),
    heals: $('.heals', hud), qt: $('.quest b', hud), qs: $('.quest span', hud), quest: $('.quest', hud), mini: $('.mini', hud), elems: $('.elems', hud),
    prompt: $('.prompt', hud), pk: $('.prompt kbd', hud), pt: $('.prompt span', hud), toasts: $('.toasts', hud), banner: $('.banner', hud), death: $('.death', hud), flash: $('.flash', hud),
    reticle: $('.reticle', hud), nextlock: $('.nextlock', hud) };
  els.nextlock.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); G.lock.next(); });
  els.elems.innerHTML = ELEMENT_ORDER.map((k, i) => `<button type="button" class="el" data-el="${k}" style="--c:${ELEMENTS[k].color}" aria-label="${ELEMENTS[k].name}"><i class="cd"></i><b>${i + 1}</b><span>${ELEMENTS[k].name}</span></button>`).join('');
  els.elems.addEventListener('pointerdown', (e) => { const b = e.target.closest('.el'); if (b) { e.preventDefault(); e.stopPropagation(); G.setElement(b.dataset.el); } });
  const elBtn = Object.fromEntries([...els.elems.children].map((b) => [b.dataset.el, b]));

  // ---------------------------------------------------------------- small helpers
  const ui = { openMenu: null, dialogOpen: false, els };
  const project = (pos, out) => { out.copy(pos).project(ctx.camera); out.x = (out.x * 0.5 + 0.5) * innerWidth; out.y = (-out.y * 0.5 + 0.5) * innerHeight; return out.z < 1; };
  ui.toast = (msg) => {
    const d = document.createElement('div'); d.textContent = msg; els.toasts.appendChild(d);
    while (els.toasts.children.length > 4) els.toasts.firstChild.remove();
    setTimeout(() => d.remove(), 3200);
  };
  let bannerT = 0;
  ui.banner = (title, sub) => { $('b', els.banner).textContent = title; $('span', els.banner).textContent = sub || ''; els.banner.classList.add('on'); bannerT = 3; };
  ui.flash = () => { els.flash.classList.remove('on'); void els.flash.offsetWidth; els.flash.classList.add('on'); };
  ui.death = (on_) => hud.classList.toggle('dead', on_);
  ui.prompt = (key, text) => { els.prompt.classList.toggle('on', !!text); if (text) { els.pk.textContent = key; els.pt.textContent = text; } };

  const floats = [];
  ui.float = (pos, text, cls = '', color) => {
    const el = document.createElement('div'); el.className = 'fl ' + cls; el.textContent = text; if (color) el.style.color = color;
    layer.appendChild(el);
    floats.push({ el, p: pos.clone(), t: 0, dx: (Math.random() - 0.5) * 30 });
    while (floats.length > 40) floats.shift().el.remove();
  };
  ui.enemyBar = (name) => {
    const el = document.createElement('div'); el.className = 'ebar'; el.innerHTML = `<small>${esc(name)}</small><div><i></i></div>`; layer.appendChild(el);
    const fill = $('i', el); const pv = new THREE.Vector3(); let shown = false;
    return {
      hide() { if (shown) { el.style.display = 'none'; shown = false; } },
      set(r, pos, dy, show, locked) {
        if (!show) return this.hide();
        pv.set(pos.x, pos.y + dy, pos.z);
        if (!project(pv, pv)) return this.hide();
        if (!shown) { el.style.display = 'block'; shown = true; }
        el.style.transform = `translate(${pv.x.toFixed(0)}px,${pv.y.toFixed(0)}px) translate(-50%,-100%)`;
        fill.style.width = (r * 100).toFixed(0) + '%'; el.classList.toggle('lock', !!locked);
      },
    };
  };
  const rv = new THREE.Vector3();
  ui.reticle = {
    show(on_) { els.reticle.classList.toggle('on', on_); els.nextlock.classList.toggle('on', on_ && touch); },
    place(pos) { if (!project(pos, rv)) { els.reticle.style.display = 'none'; return; } els.reticle.style.display = 'block'; els.reticle.style.transform = `translate(${rv.x.toFixed(0)}px,${rv.y.toFixed(0)}px) translate(-50%,-50%)`; },
  };

  // ---------------------------------------------------------------- blocking state (menus / dialogue)
  function setBlocked() {
    const blocked = !!ui.openMenu || ui.dialogOpen;
    ctx.paused = blocked;
    const t = document.getElementById('touch');
    if (t) { t.style.display = blocked ? 'none' : ''; if (blocked) ctx.touch?.releaseAll?.(); }
    if (blocked && document.pointerLockElement) document.exitPointerLock?.();
    hud.classList.toggle('hidden', ui.dialogOpen);
    document.body.classList.toggle('menu-open', blocked);
  }
  ui.isBlocked = () => !!ui.openMenu || ui.dialogOpen;

  // ---------------------------------------------------------------- dialogue
  let dlg = null;
  const dtxt = $('.txt', dlgEl), dwho = $('.who', dlgEl), dch = $('.choices', dlgEl), dnext = $('.next', dlgEl);
  ui.dialog = {
    get active() { return !!dlg; },
    /** nodes: {id: {speaker, text, next|choices|end, actions}}; onAction(action) / onEnd() callbacks. */
    start(nodes, who, onAction, onEnd) {
      dlg = { nodes, who, onAction, onEnd, node: null, chars: 0, full: '' };
      ui.dialogOpen = true; dlgEl.classList.add('on'); setBlocked(); this.go('start');
    },
    go(id) {
      const n = dlg.nodes[id]; if (!n) return this.end();
      dlg.node = n; dlg.chars = 0; dlg.full = n.text;
      const w = n.speaker === 'narrator' ? { name: 'Narrator', color: '#cfd8e6' } : (dlg.who[n.speaker] || { name: n.speaker, color: '#fff' });
      dwho.textContent = w.name; dwho.style.setProperty('--c', w.color); dwho.classList.toggle('nar', n.speaker === 'narrator');
      dch.innerHTML = ''; dnext.style.display = 'none'; dtxt.textContent = '';
      for (const a of n.actions || []) dlg.onAction?.(a);
    },
    showOptions() {
      const n = dlg.node;
      if (n.choices) {
        dch.innerHTML = n.choices.map((c, i) => `<button type="button" data-n="${c[1]}"><kbd>${i + 1}</kbd> ${esc(c[0])}</button>`).join('');
        dnext.style.display = 'none'; const b = dch.firstChild; b && b.focus({ preventScroll: true });
      } else { dnext.style.display = ''; dnext.innerHTML = n.end ? 'Close &#10003;' : 'Next &#9656;'; }
    },
    advance() {
      if (!dlg) return;
      if (dlg.chars < dlg.full.length) { dlg.chars = dlg.full.length; dtxt.textContent = dlg.full; this.showOptions(); return; }
      const n = dlg.node; if (n.choices) return;
      if (n.end || !n.next) this.end(); else this.go(n.next);
    },
    choose(i) { if (!dlg?.node.choices || dlg.chars < dlg.full.length) return; const c = dlg.node.choices[i]; if (c) { G.sfx('ui'); this.go(c[1]); } },
    skip() {
      if (!dlg) return;
      let n = dlg.node, guard = 0;
      while (n && !n.end && guard++ < 40) { const id = n.next || n.choices?.[0]?.[1]; n = dlg.nodes[id]; if (n) for (const a of n.actions || []) dlg.onAction?.(a); }
      this.end();
    },
    end() { const d = dlg; dlg = null; ui.dialogOpen = false; dlgEl.classList.remove('on'); ui.lastClose = performance.now(); setBlocked(); d?.onEnd?.(); },
    tick(dt) {
      if (!dlg || dlg.chars >= dlg.full.length) return;
      const before = Math.floor(dlg.chars); dlg.chars = Math.min(dlg.full.length, dlg.chars + dt * 70);
      dtxt.textContent = dlg.full.slice(0, Math.floor(dlg.chars));
      if (Math.floor(dlg.chars) % 3 === 0 && Math.floor(dlg.chars) !== before) G.sfx('talk');
      if (dlg.chars >= dlg.full.length) this.showOptions();
    },
  };
  dlgEl.addEventListener('pointerdown', (e) => {
    e.stopPropagation();
    const b = e.target.closest('button');
    if (b?.classList.contains('skip')) return ui.dialog.skip();
    if (b?.dataset.n) return ui.dialog.choose([...dch.children].indexOf(b));
    ui.dialog.advance();
  });

  // ---------------------------------------------------------------- menus
  const page = $('.page', menuEl), tabsEl = $('.tabs', menuEl);
  tabsEl.innerHTML = TABS.map(([k, n, key]) => `<button type="button" data-tab="${k}">${n}<kbd>${key}</kbd></button>`).join('');
  let selItem = null;
  const mapSize = () => Math.max(220, Math.min(520, innerHeight - 170, innerWidth - 40));
  ui.openTab = (name) => {
    if (ui.dialogOpen) return;
    const was = ui.openMenu; ui.openMenu = name; menuEl.classList.add('on');
    for (const b of tabsEl.children) b.classList.toggle('on', b.dataset.tab === name);
    render(); setBlocked(); if (!was) G.sfx('ui');
    if (!was) { const f = page.querySelector('button,input,select'); f && f.focus?.({ preventScroll: true }); }
  };
  ui.closeMenu = () => { if (!ui.openMenu) return; ui.openMenu = null; menuEl.classList.remove('on'); setBlocked(); G.sfx('uiBack'); ui.lastClose = performance.now(); };
  ui.toggleTab = (name) => (ui.openMenu === name ? ui.closeMenu() : ui.openTab(name));
  tabsEl.addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) { G.sfx('ui'); ui.openTab(b.dataset.tab); } });
  $('.x', menuEl).addEventListener('click', () => ui.closeMenu());
  menuEl.addEventListener('pointerdown', (e) => e.stopPropagation());
  menuEl.addEventListener('wheel', (e) => e.stopPropagation(), { passive: true });

  const bar = (r, cls) => `<div class="pbar ${cls}"><i style="width:${Math.max(0, Math.min(1, r)) * 100}%"></i></div>`;
  function render() {
    const m = ui.openMenu; if (!m) return;
    const keep = page.scrollTop;
    if (m === 'inventory') {
      const ids = Object.keys(S.inv).filter((id) => ITEMS[id] && S.inv[id] > 0);
      if (!ids.includes(selItem)) selItem = ids[0] || null;
      const it = selItem && ITEMS[selItem];
      page.innerHTML = `<div class="inv"><div class="grid">${ids.map((id) => `<button type="button" class="slot${id === selItem ? ' sel' : ''}" data-it="${id}" style="--c:${ITEMS[id].color}"><i></i><span>${esc(ITEMS[id].name)}</span><b>${S.inv[id] > 1 ? 'x' + S.inv[id] : ''}</b></button>`).join('') || '<p class="mut">Your pack is empty.</p>'}</div>
      <div class="detail">${it ? `<h3 style="color:${it.color}">${esc(it.name)}</h3><small>${it.cat}${it.slot ? ' - ' + it.slot : ''}</small><p>${esc(it.desc)}</p>${it.stats ? `<p class="mut">${Object.entries(it.stats).map(([k, x]) => `${k.toUpperCase()} +${x}`).join('  ')}</p>` : ''}
        ${it.heal ? `<button type="button" class="act" data-use="${selItem}">Use (+${it.heal} HP)</button>` : ''}${it.cat === 'equipment' ? `<button type="button" class="act" data-eq="${selItem}">${S.equip[it.slot] === selItem ? 'Unequip' : 'Equip'}</button>` : ''}` : '<p class="mut">Select an item.</p>'}
        <hr><small>Equipped</small><p>Weapon: ${esc(ITEMS[S.equip.weapon]?.name || '-')}<br>Charm: ${esc(ITEMS[S.equip.charm]?.name || '-')}</p><p class="mut">Copper Marks: ${count('copper_coin')}</p></div></div>`;
    } else if (m === 'journal') {
      const ids = Object.keys(S.quests).sort((a, b) => (S.quests[a].status === 'active' ? 0 : 1) - (S.quests[b].status === 'active' ? 0 : 1));
      page.innerHTML = ids.map((id) => { const q = S.quests[id], d = QUESTS[id];
        return `<section class="q ${q.status}"><h3>${esc(d.title)} <small>${d.type}${q.status === 'done' ? ' - complete' : ''}</small></h3><p class="mut">${esc(d.desc)}</p><ul>${d.steps.map((s, i) => `<li class="${q.status === 'done' || i < q.step ? 'ok' : i === q.step ? 'cur' : ''}">${esc(s.text)}${s.count && i === q.step && q.status === 'active' ? ` (${Math.min(q.n, s.count)}/${s.count})` : ''}</li>`).join('')}</ul></section>`; }).join('') || '<p class="mut">No entries yet.</p>';
    } else if (m === 'map') {
      page.innerHTML = `<div class="mapwrap"><canvas class="bigmap" width="900" height="900" style="width:${mapSize()}px;height:auto;aspect-ratio:1"></canvas><div class="legend"><b>Vael Harrow</b><p class="mut">Gold diamond: current objective.<br>Red zones: hostile meadows.<br>White: townsfolk.</p></div></div>`;
      drawMap();
    } else if (m === 'char') {
      const need = xpToNext();
      page.innerHTML = `<div class="chr"><div><h3>${esc(S.name)} <small>Level ${S.level}</small></h3>${bar(S.xp / need, 'xp')}<small>${S.xp}/${need} XP</small>
        <table><tr><td>HP</td><td>${Math.ceil(S.hp)} / ${maxHp()}</td></tr><tr><td>Attack</td><td>${atk()}</td></tr><tr><td>Defense</td><td>${def()}</td></tr><tr><td>Heal charges</td><td>${S.heals} / 3</td></tr><tr><td>Defeated</td><td>${S.kills}</td></tr></table></div>
        <div class="elist">${ELEMENT_ORDER.map((k, i) => { const e = ELEMENTS[k], s = e.skill; return `<button type="button" class="ebtn${S.element === k ? ' sel' : ''}" data-el="${k}" style="--c:${e.color}"><b>${i + 1}</b><span><strong>${e.name}</strong> ${e.domain} - ${s.name}</span><small>${s.type} - x${s.damage} dmg - ${s.cooldown}s - ${s.cost} EN - applies ${e.status}</small></button>`; }).join('')}</div></div>`;
    } else if (m === 'pause') {
      const q = new URLSearchParams(location.search).get('quality') || 'auto';
      page.innerHTML = `<div class="pause"><h3>Paused</h3><button type="button" class="act" data-p="resume">Resume</button><button type="button" class="act" data-p="save">Save game</button>
        <label>Quality<select data-s="quality">${['auto', 'low', 'medium', 'high', 'ultra'].map((o) => `<option${o === q ? ' selected' : ''}>${o}</option>`).join('')}</select></label>
        <label>Camera sensitivity<input type="range" min="0.4" max="2.5" step="0.1" data-s="sens" value="${S.settings.sens}"></label>
        <label>Volume<input type="range" min="0" max="1" step="0.05" data-s="volume" value="${S.settings.volume}"></label>
        <button type="button" class="act danger" data-p="reset">Reset progress</button><p class="mut">WASD move - Shift sprint - Space jump - LMB attack - RMB/Ctrl dodge - E skill - 1-6 element - H heal - Tab lock-on (Q next) - F interact - I J M C menus</p></div>`;
    }
    page.scrollTop = keep;
  }
  ui.refresh = render;
  page.addEventListener('click', (e) => {
    const t = e.target.closest('[data-it],[data-use],[data-eq],[data-el],[data-p]'); if (!t) return;
    G.sfx('ui');
    if (t.dataset.it) { selItem = t.dataset.it; render(); }
    else if (t.dataset.use) { if (useItem(t.dataset.use)) G.sfx('heal'); render(); }
    else if (t.dataset.eq) { equip(t.dataset.eq); render(); }
    else if (t.dataset.el) { G.setElement(t.dataset.el); render(); }
    else if (t.dataset.p === 'resume') ui.closeMenu();
    else if (t.dataset.p === 'save') { save(); ui.toast('Game saved'); }
    else if (t.dataset.p === 'reset') { if (t.dataset.sure) { reset(); location.reload(); } else { t.dataset.sure = 1; t.textContent = 'Tap again to confirm'; } }
  });
  page.addEventListener('input', (e) => {
    const k = e.target.dataset.s; if (!k) return;
    if (k === 'sens') { S.settings.sens = +e.target.value; G.applySettings(); }
    else if (k === 'volume') { S.settings.volume = +e.target.value; G.sfx('ui'); }
    save();
  });
  page.addEventListener('change', (e) => {
    if (e.target.dataset.s !== 'quality') return;
    const u = new URL(location.href); if (e.target.value === 'auto') u.searchParams.delete('quality'); else u.searchParams.set('quality', e.target.value);
    save(); location.href = u.toString();
  });
  addEventListener('keydown', (e) => {
    if (e.repeat && !ui.dialogOpen) return;
    if (ui.dialogOpen) {
      ctx.input.consume(e.code);
      if (['KeyF', 'Space', 'Enter', 'KeyE'].includes(e.code)) { e.preventDefault(); ui.dialog.advance(); }
      else if (e.code === 'Digit1' || e.code === 'Digit2' || e.code === 'Digit3') ui.dialog.choose(+e.code.slice(5) - 1);
      else if (e.code === 'Escape') ui.dialog.skip();
      return;
    }
    if (G.combat?.dead) return;
    const map = { KeyI: 'inventory', KeyJ: 'journal', KeyM: 'map', KeyC: 'char' };
    if (map[e.code]) { e.preventDefault(); ui.toggleTab(map[e.code]); }
    else if (e.code === 'Escape') { if (ui.openMenu) ui.closeMenu(); else ui.openTab('pause'); }
    else if (ui.openMenu && (e.code === 'ArrowLeft' || e.code === 'ArrowRight') && !(e.target.tagName === 'INPUT')) {
      const i = TABS.findIndex((t) => t[0] === ui.openMenu); ui.openTab(TABS[(i + (e.code === 'ArrowRight' ? 1 : TABS.length - 1)) % TABS.length][0]);
    } else if (ui.openMenu && (e.code === 'ArrowUp' || e.code === 'ArrowDown')) {
      const f = [...page.querySelectorAll('button,input,select')], i = f.indexOf(document.activeElement); e.preventDefault();
      f[(i + (e.code === 'ArrowDown' ? 1 : f.length - 1) + (i < 0 ? 1 : 0)) % f.length]?.focus();
    }
  });
  // losing pointer lock during play (Esc) opens the pause menu
  let wasLocked = false;
  document.addEventListener('pointerlockchange', () => {
    const locked = !!document.pointerLockElement;
    if (wasLocked && !locked && !ui.isBlocked() && !ctx.testMode && !G.combat?.dead) setTimeout(() => { if (!document.pointerLockElement && !ui.isBlocked()) ui.openTab('pause'); }, 60);
    wasLocked = locked;
  });

  // ---------------------------------------------------------------- map drawing
  function drawMap() {
    const cv = $('.bigmap', page); if (!cv) return;
    const g = cv.getContext('2d'), W = cv.width, k = W / (WORLD.half * 2), X = (x) => (x + WORLD.half) * k, Z = (z) => (z + WORLD.half) * k;
    g.fillStyle = '#1f3a2c'; g.fillRect(0, 0, W, W);
    g.strokeStyle = '#2f6fa0'; g.lineWidth = 26 * k; g.lineCap = 'round'; g.lineJoin = 'round'; g.beginPath(); RIVER.forEach(([x, z], i) => (i ? g.lineTo(X(x), Z(z)) : g.moveTo(X(x), Z(z)))); g.stroke();
    g.fillStyle = 'rgba(210,180,120,.55)'; g.beginPath(); g.arc(X(TOWN.cx), Z(TOWN.cz), TOWN.radius * k, 0, 7); g.fill();
    g.fillStyle = 'rgba(220,60,50,.22)';
    for (const [x, z] of [[190, 5], [-200, 15]]) { g.beginPath(); g.arc(X(x), Z(z), 55 * k, 0, 7); g.fill(); }
    g.font = `${Math.round(W / 30)}px system-ui`; g.fillStyle = '#fff'; g.textAlign = 'center';
    const lab = (t, x, z) => { g.fillStyle = '#fff'; g.beginPath(); g.arc(X(x), Z(z), 3.5, 0, 7); g.fill(); g.fillText(t, X(x), Z(z) - 8); };
    lab('Plaza', POI.plaza.x, POI.plaza.z); lab('Concord Hall', POI.hall.x, POI.hall.z); lab('Old Span', -97, 3); lab('Elyndra Core', POI.core.x, POI.core.z); lab('Lake Mirelle', POI.lake.x, POI.lake.z); lab('South Gate', POI.southGate.x, POI.southGate.z);
    lab(PLACES.choir_steps.name, PLACES.choir_steps.x, PLACES.choir_steps.z);
    const mk = G.objective(); if (mk) { g.fillStyle = '#ffd36b'; g.save(); g.translate(X(mk.x), Z(mk.z)); g.rotate(Math.PI / 4); g.fillRect(-7, -7, 14, 14); g.restore(); }
    const p = G.player.position, yaw = G.player.camera.yaw; g.save(); g.translate(X(p.x), Z(p.z)); g.rotate(-yaw); g.fillStyle = '#7ff5ff'; g.strokeStyle = '#012'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(0, -11); g.lineTo(8, 9); g.lineTo(0, 5); g.lineTo(-8, 9); g.closePath(); g.fill(); g.stroke(); g.restore();
  }

  // ---------------------------------------------------------------- minimap
  const mg = els.mini.getContext('2d'), MR = 85;
  function drawMini() {
    const W = 132, h = W / 2, k = h / MR, p = G.player.position, yaw = G.player.camera.yaw, cy = Math.cos(yaw), sy = Math.sin(yaw);
    const sc = (x, z) => { const dx = x - p.x, dz = z - p.z; return [h + (dx * cy - dz * sy) * k, h + (dx * sy + dz * cy) * k]; };
    mg.clearRect(0, 0, W, W); mg.save(); mg.beginPath(); mg.arc(h, h, h - 1, 0, 7); mg.clip();
    mg.fillStyle = '#1f3a2c'; mg.fillRect(0, 0, W, W);
    mg.strokeStyle = '#2f6fa0'; mg.lineWidth = 26 * k; mg.beginPath(); RIVER.forEach(([x, z], i) => { const [a, b] = sc(x, z); i ? mg.lineTo(a, b) : mg.moveTo(a, b); }); mg.stroke();
    const [tx, tz] = sc(TOWN.cx, TOWN.cz); mg.fillStyle = 'rgba(210,180,120,.5)'; mg.beginPath(); mg.arc(tx, tz, TOWN.radius * k, 0, 7); mg.fill();
    const dot = (x, z, c, r = 3) => { const [a, b] = sc(x, z); mg.fillStyle = c; mg.beginPath(); mg.arc(a, b, r, 0, 7); mg.fill(); };
    for (const n of G.npcPositions()) dot(n.x, n.z, '#fff', 2.5);
    for (const e of G.enemies.list) if (!e.dead && Math.hypot(e.pos.x - p.x, e.pos.z - p.z) < MR) dot(e.pos.x, e.pos.z, '#ff5a4a', 3);
    const o = G.objective();
    if (o) { let [a, b] = sc(o.x, o.z); const dx = a - h, dy = b - h, l = Math.hypot(dx, dy), lim = h - 8; if (l > lim) { a = h + dx / l * lim; b = h + dy / l * lim; }
      mg.save(); mg.translate(a, b); mg.rotate(Math.PI / 4); mg.fillStyle = '#ffd36b'; mg.fillRect(-4, -4, 8, 8); mg.restore(); }
    mg.restore(); mg.strokeStyle = 'rgba(160,240,255,.6)'; mg.lineWidth = 2; mg.beginPath(); mg.arc(h, h, h - 1, 0, 7); mg.stroke();
    mg.fillStyle = '#7ff5ff'; mg.beginPath(); mg.moveTo(h, h - 7); mg.lineTo(h + 5, h + 5); mg.lineTo(h, h + 2); mg.lineTo(h - 5, h + 5); mg.closePath(); mg.fill();
  }

  // ---------------------------------------------------------------- per frame
  let miniT = 0, lastKey = '';
  ui.update = (dt) => {
    // HUD values
    const hp = S.hp / maxHp(), st = G.player.controller.stamina;
    const key = [S.name, S.level, Math.ceil(S.hp), maxHp(), S.heals].join('|');
    if (key !== lastKey) { lastKey = key; els.name.textContent = S.name; els.lvl.textContent = 'Lv ' + S.level; els.hpt.textContent = `${Math.ceil(S.hp)} / ${maxHp()}`; els.heals.innerHTML = '<i class="on"></i>'.repeat(S.heals) + '<i></i>'.repeat(3 - S.heals); }
    els.hp.style.width = (hp * 100).toFixed(1) + '%'; els.hp.parentElement.classList.toggle('low', hp < 0.3);
    els.st.style.width = (st.ratio * 100).toFixed(1) + '%'; els.st.parentElement.classList.toggle('ex', st.exhausted);
    els.en.style.width = S.energy.toFixed(1) + '%'; els.xp.style.width = (S.xp / xpToNext() * 100).toFixed(1) + '%';
    for (const k of ELEMENT_ORDER) { const b = elBtn[k], cd = G.combat.st.cd[k], mx = ELEMENTS[k].skill.cooldown; b.classList.toggle('sel', S.element === k); b.firstChild.style.height = (cd / mx * 100).toFixed(0) + '%'; b.classList.toggle('noen', S.energy < ELEMENTS[k].skill.cost); }
    const tr = tracked();
    els.quest.style.display = tr ? '' : 'none';
    if (tr) { els.qt.textContent = tr.quest.title; const s = tr.step; els.qs.textContent = s ? s.text + (s.count ? ` (${Math.min(tr.state.n, s.count)}/${s.count})` : '') : ''; }
    if (bannerT > 0) { bannerT -= dt; if (bannerT <= 0) els.banner.classList.remove('on'); }
    // floating numbers
    for (let i = floats.length - 1; i >= 0; i--) {
      const f = floats[i]; f.t += dt;
      if (f.t > 1.1) { f.el.remove(); floats.splice(i, 1); continue; }
      if (!project(f.p, v)) { f.el.style.display = 'none'; continue; }
      f.el.style.display = ''; f.el.style.opacity = String(Math.min(1, (1.1 - f.t) * 2.5));
      f.el.style.transform = `translate(${(v.x + f.dx * f.t).toFixed(0)}px,${(v.y - 60 * f.t - 10 * Math.sin(f.t * 8) * (f.t < 0.2 ? 1 : 0)).toFixed(0)}px) translate(-50%,-50%) scale(${f.t < 0.12 ? 1.4 : 1})`;
    }
    ui.dialog.tick(dt);
    G.lock.place();
    miniT += dt; if (miniT > 0.06 && !ui.openMenu) { miniT = 0; drawMini(); }
    if (ui.openMenu === 'map' && Math.floor(performance.now() / 250) !== ui._mt) { ui._mt = Math.floor(performance.now() / 250); drawMap(); }
    if (ui.openMenu === 'char' || ui.openMenu === 'journal') { if (Math.floor(performance.now() / 500) !== ui._rt) { ui._rt = Math.floor(performance.now() / 500); if (!page.contains(document.activeElement) || document.activeElement.tagName === 'BODY') render(); } }
  };
  on('inventory', () => { if (ui.openMenu === 'inventory') render(); });
  on('quest', () => { if (ui.openMenu === 'journal') render(); });
  on('toast', (m) => ui.toast(m));
  on('banner', (b) => ui.banner(b.title, b.sub));
  on('levelup', (l) => { ui.banner('LEVEL ' + l, 'Your resonance deepens.'); G.sfx('levelup'); });
  return ui;
}
