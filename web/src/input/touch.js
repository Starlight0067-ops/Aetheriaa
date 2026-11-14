// Touch controls overlay (phones/tablets). Enabled on coarse pointers or with ?touch=1 (?touch=0 disables).
// Everything is Pointer Events with one pointerId per finger. Buttons reuse the desktop actions by synthesising the
// same key / mouse state the keyboard+mouse path reads (Space, E, F, Tab, H, 1-6, I/J/M/C/Esc, LMB attack, RMB dodge),
// so any system listening to keys keeps working. Movement/camera/zoom go through ctx.touch -> player/controls.js.
const SETTINGS_KEY = 'aetheria.touch.v1';
const DEAD = 0.14, RADIUS = 56, SPRINT_AT = 0.94;
const ICONS = {
  attack: '<path d="M5 19 17 7M14 5l5-1-1 5M5 19l-1 1M7 15l2 2"/><path d="M13 6l5 5"/>',
  skill: '<path d="M12 3c1 4 5 5 5 10a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 1-3 0-6 1-9z"/>',
  jump: '<path d="M12 19V6M6 11l6-6 6 6"/>',
  dodge: '<path d="M4 8h9M4 12h13M4 16h9"/><path d="M15 7l5 5-5 5"/>',
  interact: '<path d="M9 11V6a1.5 1.5 0 0 1 3 0v4l5 1.5V16a4 4 0 0 1-4 4h-2a4 4 0 0 1-3-1.3L5 14.5a1.5 1.5 0 0 1 2.2-2z"/>',
  heal: '<path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.500-7 10-7 10z"/><path d="M12 9v5M9.500 11.500h5"/>',
  lock: '<circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="1.500"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/>',
  elem: '<path d="M12 3 5 13h5l-1 8 8-11h-5z"/>',
  inventory: '<path d="M6 8h12l1 12H5zM9 8V6a3 3 0 0 1 6 0v2"/>',
  journal: '<path d="M6 4h11a1 1 0 0 1 1 1v15H7a1 1 0 0 1-1-1zM6 17h12M9 8h6"/>',
  map: '<path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2zM9 4v14M15 6v14"/>',
  char: '<circle cx="12" cy="8" r="3.500"/><path d="M5 20c0-4 3-6 7-6s7 2 7 6"/>',
  pause: '<path d="M8 5v14M16 5v14"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  full: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
};
const svg = (n, w = 2.2) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[n]}</svg>`;

const CSS = `
#touch{position:fixed;inset:0;z-index:5;touch-action:none;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none;
 -webkit-tap-highlight-color:transparent;overscroll-behavior:none;font-family:"Segoe UI",system-ui,sans-serif;color:#eafcff;
 --s:1;--sl:max(14px,env(safe-area-inset-left));--sr:max(14px,env(safe-area-inset-right));--sb:max(14px,env(safe-area-inset-bottom));--st:max(10px,env(safe-area-inset-top))}
#touch *{touch-action:none;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none;box-sizing:border-box}
#touch .zone{position:absolute;inset:0}
#touch .tb{position:absolute;display:grid;place-items:center;border-radius:50%;border:2px solid rgba(160,240,255,.55);
 background:radial-gradient(circle at 35% 30%,rgba(60,90,130,.62),rgba(12,20,40,.62));color:#eafcff;padding:0;
 box-shadow:0 2px 10px rgba(0,0,0,.4),inset 0 0 12px rgba(127,245,255,.12);transition:transform .06s,background .1s;
 width:calc(var(--w)*var(--s)*1px);height:calc(var(--w)*var(--s)*1px);right:calc(var(--sr) + var(--r)*var(--s)*1px);bottom:calc(var(--sb) + var(--b)*var(--s)*1px)}
#touch .tb svg{width:48%;height:48%;pointer-events:none}
#touch .tb .lb{position:absolute;bottom:-1px;font-size:calc(10px*var(--s));opacity:.75;pointer-events:none;line-height:1}
#touch .tb.on{transform:scale(.92);background:radial-gradient(circle at 50% 40%,rgba(127,245,255,.55),rgba(30,70,110,.7))}
#touch .tb.top{bottom:auto;top:calc(var(--st) + var(--t)*var(--s)*1px)}
#touch .tb.sm{border-radius:14px}
#touch .tb b{font:700 calc(18px*var(--s))/1 Georgia,serif;pointer-events:none}
#touch .tb.sel{border-color:#e2b95b;box-shadow:0 0 12px rgba(226,185,91,.6)}
#touch .row{position:absolute;display:none}
#touch .row.open{display:block}
#touch .panel{position:absolute;right:var(--sr);top:calc(var(--st) + 62px*var(--s));display:none;gap:8px;padding:10px;border-radius:14px;
 background:rgba(10,16,32,.82);border:1px solid rgba(160,240,255,.35);max-width:calc(100vw - 28px)}
#touch .panel.open{display:grid;grid-template-columns:repeat(5,auto);}
#touch .panel .tb{position:static;--w:52}
#touch .panel label{grid-column:1/-1;font-size:12px;display:grid;grid-template-columns:90px 1fr;align-items:center;gap:8px;touch-action:auto}
#touch .panel input{touch-action:auto;width:100%}
#touch .panel .tb.wide{grid-column:1/-1;width:auto;border-radius:12px;height:44px;display:flex;gap:8px;justify-content:center}
#touch .panel .tb.wide svg{width:22px;height:22px}
#touch .joy{position:absolute;width:${RADIUS * 2.2}px;height:${RADIUS * 2.2}px;margin:${-RADIUS * 1.1}px 0 0 ${-RADIUS * 1.1}px;border-radius:50%;
 border:2px solid rgba(160,240,255,.5);background:rgba(10,20,40,.28);pointer-events:none;opacity:0;transition:opacity .15s;left:0;top:0;will-change:transform}
#touch .joy.on{opacity:1}
#touch .joy i{position:absolute;left:50%;top:50%;width:54px;height:54px;margin:-27px;border-radius:50%;background:radial-gradient(circle at 35% 30%,#bff,#4ab);opacity:.8;will-change:transform}
#touch .hint{position:absolute;left:calc(var(--sl) + 28px);bottom:calc(var(--sb) + 28px);width:96px;height:96px;border-radius:50%;
 border:2px dashed rgba(160,240,255,.28);pointer-events:none;transition:opacity .3s}
#touch .toast{position:absolute;left:50%;top:calc(var(--st) + 8px);transform:translateX(-50%);padding:8px 14px;border-radius:12px;background:rgba(10,16,32,.85);
 border:1px solid rgba(160,240,255,.4);font-size:13px;display:none;gap:10px;align-items:center;pointer-events:auto;white-space:nowrap}
#touch .toast.open{display:flex}
`;

export function createTouch(ctx) {
  const params = ctx.params || new URLSearchParams(location.search);
  const force = params.get('touch');
  const coarse = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  const enabled = !ctx.shot && force !== '0' && (force === '1' || coarse);
  const t = { enabled, active: false, moveX: 0, moveY: 0, mag: 0, sprint: false, lookX: 0, lookY: 0, zoom: 0,
    settings: { scale: 1, sens: 1.6, haptics: true }, consume, releaseAll: () => {} };
  if (!enabled) return t;

  try { Object.assign(t.settings, JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}')); } catch { /* ignore */ }
  const save = () => { try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(t.settings)); } catch { /* ignore */ } };

  const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
  const root = document.createElement('div'); root.id = 'touch';
  root.innerHTML = `<div class="zone"></div><div class="hint"></div><div class="joy"><i></i></div>`;
  document.body.appendChild(root);
  const zone = root.querySelector('.zone'), joy = root.querySelector('.joy'), knob = joy.querySelector('i'), hint = root.querySelector('.hint');
  const applyScale = () => root.style.setProperty('--s', String(t.settings.scale));
  applyScale();

  // ---- action plumbing: same inputs as keyboard/mouse ----
  const input = ctx.input;
  const held = new Map();   // action -> Set(pointerId) so two fingers on one button don't release early
  const downAt = new Map();
  const KEYS = { jump: 'Space', skill: 'KeyE', interact: 'KeyF', lock: 'Tab', heal: 'KeyH', inventory: 'KeyI', journal: 'KeyJ', map: 'KeyM', char: 'KeyC', pause: 'Escape' };
  for (let i = 1; i <= 6; i++) KEYS['el' + i] = 'Digit' + i;
  function setAction(a, on) {
    if (a === 'attack') { if (on) { input.mouse.buttons.add(0); input.mouse.clicked.add(0); } else input.mouse.buttons.delete(0); }
    else if (a === 'dodge') { if (on) { input.mouse.buttons.add(2); input.mouse.clicked.add(2); } else input.mouse.buttons.delete(2); }
    else if (KEYS[a]) dispatchEvent(new KeyboardEvent(on ? 'keydown' : 'keyup', { code: KEYS[a], key: KEYS[a], bubbles: true }));
    dispatchEvent(new CustomEvent('aetheria:action', { detail: { action: a, down: on } }));
  }
  function press(a, id) {
    let s = held.get(a); if (!s) held.set(a, s = new Set());
    if (s.size === 0) { setAction(a, true); downAt.set(a, performance.now()); }
    s.add(id);
  }
  function release(a, id) {
    const s = held.get(a); if (!s || !s.delete(id) || s.size) return;
    const wait = Math.max(0, 70 - (performance.now() - downAt.get(a)));  // keep at least ~1 frame so justPressed is seen
    if (wait) setTimeout(() => { if (!held.get(a)?.size) setAction(a, false); }, wait); else setAction(a, false);
  }
  const buzz = (ms = 8) => { if (t.settings.haptics) try { navigator.vibrate?.(ms); } catch { /* ignore */ } };

  function bindButton(el, action, { toggle } = {}) {
    const ids = new Set();
    el.addEventListener('pointerdown', (e) => {
      e.preventDefault(); e.stopPropagation();
      try { el.setPointerCapture(e.pointerId); } catch { /* ignore */ }
      ids.add(e.pointerId); el.classList.add('on'); buzz();
      if (toggle) toggle(); else press(action, e.pointerId);
    });
    const up = (e) => {
      if (!ids.delete(e.pointerId)) return;
      if (!ids.size) el.classList.remove('on');
      if (!toggle) release(action, e.pointerId);
    };
    for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) el.addEventListener(ev, up);
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    el._ids = ids; el._up = up;
  }
  function mk(parent, cls, label, action, pos, icon, opts) {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'tb ' + cls; b.setAttribute('aria-label', label);
    for (const k in pos) b.style.setProperty('--' + k, pos[k]);
    b.innerHTML = (icon ? svg(icon) : `<b>${opts?.text || ''}</b>`) + (opts?.lb ? `<span class="lb">${opts.lb}</span>` : '');
    bindButton(b, action, opts); parent.appendChild(b); return b;
  }
  const buttons = [];
  const B = (cls, label, action, pos, icon, opts) => buttons.push(mk(root, cls, label, action, pos, icon, opts));
  B('', 'Atacar', 'attack', { w: 84, r: 6, b: 6 }, 'attack');
  B('', 'Saltar', 'jump', { w: 64, r: 104, b: 14 }, 'jump');
  B('', 'Esquivar', 'dodge', { w: 62, r: 14, b: 102 }, 'dodge');
  B('', 'Habilidad elemental', 'skill', { w: 60, r: 92, b: 92 }, 'skill');
  B('', 'Interactuar', 'interact', { w: 54, r: 166, b: 78 }, 'interact');
  B('', 'Curar', 'heal', { w: 54, r: 14, b: 176 }, 'heal');
  B('', 'Fijar objetivo', 'lock', { w: 54, r: 178, b: 14 }, 'lock');

  // element selector: toggle button + row of 1-6
  const row = document.createElement('div'); row.className = 'row'; root.appendChild(row);
  let elem = 1;
  const elems = [];
  const elemBtn = mk(root, '', 'Elemento', 'elem', { w: 54, r: 100, b: 166 }, null, {
    text: '1', lb: '', toggle: () => row.classList.toggle('open') });
  buttons.push(elemBtn);
  for (let i = 1; i <= 6; i++) {
    const b = mk(root, 'sm', 'Elemento ' + i, 'el' + i, { w: 52, r: 100 + 60 * i, b: 166 }, null, { text: String(i) });
    b.addEventListener('pointerdown', () => { elem = i; elemBtn.querySelector('b').textContent = String(i); elems.forEach((x, j) => x.classList.toggle('sel', j + 1 === i)); });
    elems.push(b); buttons.push(b);
    b.style.display = 'none';
  }
  const syncRow = () => elems.forEach((b) => { b.style.display = row.classList.contains('open') ? '' : 'none'; });
  new MutationObserver(syncRow).observe(row, { attributes: true });
  elems[0].classList.add('sel');

  // top-right: pause + menu panel
  B('top', 'Pausa', 'pause', { w: 48, r: 14, t: 0 }, 'pause');
  const panel = document.createElement('div'); panel.className = 'panel'; root.appendChild(panel);
  const menuBtn = mk(root, 'top', 'Menu', 'menu', { w: 48, r: 14 + 58, t: 0 }, 'menu', { toggle: () => panel.classList.toggle('open') });
  buttons.push(menuBtn);
  for (const [a, n, l] of [['inventory', 'inventory', 'Inventario'], ['journal', 'journal', 'Diario'], ['map', 'map', 'Mapa'], ['char', 'char', 'Personaje']]) {
    mk(panel, '', l, a, {}, n);
  }
  panel.insertAdjacentHTML('beforeend', `
    <label>Escala UI<input type="range" min="0.9" max="1.5" step="0.05" data-k="scale"></label>
    <label>Camara<input type="range" min="0.6" max="3.5" step="0.1" data-k="sens"></label>`);
  panel.querySelectorAll('input').forEach((inp) => {
    inp.value = t.settings[inp.dataset.k];
    inp.addEventListener('input', () => { t.settings[inp.dataset.k] = +inp.value; applyScale(); save(); });
  });
  const fs = document.createElement('button'); fs.type = 'button'; fs.className = 'tb wide'; fs.innerHTML = svg('full') + '<span>Pantalla completa</span>';
  panel.appendChild(fs);
  fs.addEventListener('click', async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else { await document.documentElement.requestFullscreen?.({ navigationUI: 'hide' }); await screen.orientation?.lock?.('landscape').catch(() => {}); }
    } catch { /* unsupported (iOS Safari) */ }
  });
  panel.addEventListener('pointerdown', (e) => e.stopPropagation());

  // portrait hint
  const toast = document.createElement('div'); toast.className = 'toast'; toast.innerHTML = '<span>Gira el telefono: mejor en horizontal</span>';
  root.appendChild(toast);
  let toastShown = false;
  const checkOrient = () => {
    const portrait = innerHeight > innerWidth;
    if (portrait && !toastShown) { toastShown = true; toast.classList.add('open'); setTimeout(() => toast.classList.remove('open'), 5000); }
    if (!portrait) toast.classList.remove('open');
  };

  // ---- joystick (left half, floating) + camera drag / pinch (right half) ----
  let joyId = null, jox = 0, joy0 = 0;
  const looks = new Map();    // pointerId -> {x,y}
  let pinch0 = 0;
  const pts = () => [...looks.values()];

  function setJoy(dx, dy) {
    const m = Math.hypot(dx, dy);
    const c = m > RADIUS ? RADIUS / m : 1;
    dx *= c; dy *= c;
    knob.style.transform = `translate(${dx}px,${dy}px)`;
    const n = Math.min(1, m / RADIUS);
    if (n < DEAD) { t.moveX = t.moveY = t.mag = 0; t.sprint = false; return; }
    const s = Math.pow((n - DEAD) / (1 - DEAD), 1.3);
    t.moveX = (dx / Math.min(m, RADIUS)) * s * (m > RADIUS ? 1 : 1);
    t.moveY = -(dy / Math.min(m, RADIUS)) * s;
    const mm = Math.hypot(t.moveX, t.moveY);
    t.mag = Math.min(1, mm);
    if (mm > 1) { t.moveX /= mm; t.moveY /= mm; }
    if (n >= SPRINT_AT) { if (!t.sprint) buzz(12); t.sprint = true; } else if (n < SPRINT_AT - 0.1) t.sprint = false;
  }
  function endJoy() { joyId = null; joy.classList.remove('on'); hint.style.opacity = '1'; t.moveX = t.moveY = t.mag = 0; t.sprint = false; t.active = false; }

  zone.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    try { zone.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    panel.classList.remove('open');
    if (e.clientX < innerWidth / 2 && joyId === null) {
      joyId = e.pointerId; jox = e.clientX; joy0 = e.clientY;
      joy.style.transform = `translate(${jox}px,${joy0}px)`; knob.style.transform = '';
      joy.classList.add('on'); hint.style.opacity = '0'; t.active = true;
    } else if (e.clientX >= innerWidth / 2 || joyId !== null) {
      looks.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (looks.size === 2) { const [a, b] = pts(); pinch0 = Math.hypot(a.x - b.x, a.y - b.y); }
    }
  });
  zone.addEventListener('pointermove', (e) => {
    if (e.pointerId === joyId) { setJoy(e.clientX - jox, e.clientY - joy0); return; }
    const p = looks.get(e.pointerId); if (!p) return;
    const dx = e.clientX - p.x, dy = e.clientY - p.y;
    p.x = e.clientX; p.y = e.clientY;
    if (looks.size >= 2) {
      const [a, b] = pts(); const d = Math.hypot(a.x - b.x, a.y - b.y);
      t.zoom += -(d - pinch0) / 45; pinch0 = d;            // spread = zoom in (negative notches)
    } else { t.lookX += dx * t.settings.sens; t.lookY += dy * t.settings.sens; }
  });
  const zoneUp = (e) => {
    if (e.pointerId === joyId) endJoy();
    if (looks.delete(e.pointerId) && looks.size === 1) { pinch0 = 0; }
  };
  for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) zone.addEventListener(ev, zoneUp);

  function releaseAll() {
    endJoy(); looks.clear();
    for (const b of buttons) { b._ids.forEach((id) => b._up({ pointerId: id })); b._ids.clear(); b.classList.remove('on'); }
    for (const [a, s] of held) { if (s.size) { s.clear(); setAction(a, false); } }
    input.mouse.buttons.delete(0); input.mouse.buttons.delete(2);
  }
  t.releaseAll = releaseAll;
  addEventListener('blur', releaseAll);
  addEventListener('pagehide', releaseAll);
  document.addEventListener('visibilitychange', () => { if (document.hidden) releaseAll(); });
  addEventListener('orientationchange', () => { releaseAll(); setTimeout(checkOrient, 300); });
  addEventListener('resize', () => { if (joyId !== null) endJoy(); checkOrient(); });
  checkOrient();

  // kill browser gestures: pinch-zoom, double-tap zoom, long-press menu, pull-to-refresh, scroll
  for (const ev of ['gesturestart', 'gesturechange', 'gestureend', 'contextmenu', 'dblclick', 'selectstart', 'dragstart']) document.addEventListener(ev, (e) => e.preventDefault(), { passive: false });
  document.addEventListener('touchmove', (e) => { if (e.target.closest?.('input[type=range]')) return; e.preventDefault(); }, { passive: false });
  document.addEventListener('touchstart', (e) => { if (e.touches.length > 1 && !e.target.closest?.('input')) e.preventDefault(); }, { passive: false });
  document.documentElement.style.cssText += ';overscroll-behavior:none;touch-action:none';
  document.body.classList.add('touch-ui');

  function consume() { const o = { lookX: t.lookX, lookY: t.lookY, zoom: t.zoom }; t.lookX = t.lookY = t.zoom = 0; return o; }
  return t;
}
