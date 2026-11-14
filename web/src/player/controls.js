// Gameplay intents from keyboard + mouse (ctx.input) and the first connected gamepad (standard mapping).
//
// Keyboard/mouse: WASD / arrows move · Shift sprint · Space jump · Right mouse or Ctrl dodge ·
//   Left Alt (hold) or V (toggle) walk · mouse look (pointer lock) · wheel zoom · middle mouse recentre camera.
// Gamepad: left stick move (analog walk/run) · right stick camera · A jump · B / RB dodge (hold after the dash to
//   sprint) · L3 toggle sprint · R3 recentre · D-pad up/down zoom.
import { clamp } from './math.js';

const DEAD_L = 0.18, DEAD_R = 0.12;
function radial(x, y, dead) {
  const m = Math.hypot(x, y);
  if (m < dead) return [0, 0, 0];
  const s = Math.min(1, (m - dead) / (1 - dead));
  return [(x / m) * s, (y / m) * s, s];
}

export function createControls(ctx) {
  const input = ctx.input;
  const s = {
    moveX: 0, moveY: 0, moveMag: 0,        // camera space: x right, y forward; magnitude 0..1
    lookX: 0, lookY: 0,                     // mouse pixels this frame
    padLookX: 0, padLookY: 0,               // right stick, response-curved, -1..1
    zoom: 0,                                // wheel notches (+ = out)
    jumpPressed: false, jumpHeld: false,
    dodgePressed: false, dodgeHeld: false,
    sprintHeld: false, walk: false,
    recenterPressed: false,
    gamepad: false,                         // last device used was a gamepad
    cameraIdle: 99,                         // seconds since the last manual camera input
  };
  let walkToggle = false, padSprintToggle = false;
  let prev = [];
  const api = { state: s, enabled: true, update };

  function btn(gp, i) { const b = gp && gp.buttons[i]; return !!b && (b.pressed || b.value > 0.5); }

  function update(dt) {
    const k = (c) => input.down(c);
    const jp = (c) => input.justPressed(c);
    if (!api.enabled || ctx.shot) {
      ctx.touch?.consume?.();
      Object.assign(s, { moveX: 0, moveY: 0, moveMag: 0, lookX: 0, lookY: 0, padLookX: 0, padLookY: 0, zoom: 0,
        jumpPressed: false, jumpHeld: false, dodgePressed: false, dodgeHeld: false, sprintHeld: false, recenterPressed: false });
      s.cameraIdle += dt;
      return;
    }
    // keyboard
    let mx = (k('KeyD') || k('ArrowRight') ? 1 : 0) - (k('KeyA') || k('ArrowLeft') ? 1 : 0);
    let my = (k('KeyW') || k('ArrowUp') ? 1 : 0) - (k('KeyS') || k('ArrowDown') ? 1 : 0);
    let mag = Math.hypot(mx, my);
    if (mag > 1) { mx /= mag; my /= mag; mag = 1; }
    if (jp('KeyV')) walkToggle = !walkToggle;
    const kbAny = mag > 0 || input.keys.size > 0 || input.mouse.dx || input.mouse.dy;
    let jumpPressed = jp('Space'), jumpHeld = k('Space');
    let dodgePressed = jp('ControlLeft') || jp('ControlRight') || input.clicked(2);
    let dodgeHeld = k('ControlLeft') || k('ControlRight') || input.mouse.buttons.has(2);
    let sprintHeld = k('ShiftLeft') || k('ShiftRight');
    let walk = walkToggle !== (k('AltLeft') || k('AltRight'));
    let recenter = input.clicked(1);
    let zoom = input.mouse.wheel;
    let plx = 0, ply = 0;

    // gamepad
    const gp = input.gamepad?.();
    if (gp) {
      const [lx, ly, lm] = radial(gp.axes[0] || 0, gp.axes[1] || 0, DEAD_L);
      const [rx, ry, rm] = radial(gp.axes[2] || 0, gp.axes[3] || 0, DEAD_R);
      const pressedNow = gp.buttons.map((b, i) => btn(gp, i));
      const edge = (i) => pressedNow[i] && !prev[i];
      const padAny = lm > 0 || rm > 0 || pressedNow.some(Boolean);
      if (padAny) s.gamepad = true;
      if (lm > mag) { mx = lx; my = -ly; mag = lm; }
      if (rm > 0) { const c = Math.pow(rm, 1.7) / rm; plx = rx * c; ply = ry * c; }
      if (edge(0)) jumpPressed = true;
      if (pressedNow[0]) jumpHeld = true;
      if (edge(1) || edge(5)) dodgePressed = true;
      if (pressedNow[1] || pressedNow[5]) dodgeHeld = true;
      if (edge(10)) padSprintToggle = !padSprintToggle;
      if (lm < 0.2) padSprintToggle = false;
      if (padSprintToggle || pressedNow[1] || pressedNow[5]) sprintHeld = true;
      if (edge(11)) recenter = true;
      if (edge(12)) zoom -= 1;
      if (edge(13)) zoom += 1;
      prev = pressedNow;
    }
    if (kbAny) s.gamepad = false;

    // touch overlay (src/input/touch.js): analog stick, drag-look, pinch zoom
    const tc = ctx.touch;
    let tlx = 0, tly = 0;
    if (tc?.enabled) {
      const o = tc.consume();
      tlx = o.lookX; tly = o.lookY; zoom += o.zoom;
      if (tc.mag > 0) { mx = tc.moveX; my = tc.moveY; mag = tc.mag; s.gamepad = true; if (tc.sprint) sprintHeld = true; }
      else if (tc.active) s.gamepad = true;
    }

    s.moveX = mx; s.moveY = my; s.moveMag = clamp(mag, 0, 1);
    s.lookX = input.mouse.dx + tlx; s.lookY = input.mouse.dy + tly;
    s.padLookX = plx; s.padLookY = ply;
    s.zoom = zoom;
    s.jumpPressed = jumpPressed; s.jumpHeld = jumpHeld;
    s.dodgePressed = dodgePressed; s.dodgeHeld = dodgeHeld;
    s.sprintHeld = sprintHeld; s.walk = walk;
    s.recenterPressed = recenter;
    s.cameraIdle = (s.lookX || s.lookY || plx || ply) ? 0 : s.cameraIdle + dt;
  }

  // Ctrl is the dodge key: Ctrl+W (held W auto-repeats) would close the tab. Block what the browser lets us block
  // and ask for confirmation on unload while Ctrl is held during play.
  if (!ctx.shot) {
    addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && /^(Key[WASDF]|Space)$/.test(e.code) && document.pointerLockElement) e.preventDefault();
      if (e.code === 'AltLeft' || e.code === 'AltRight') e.preventDefault();
    }, { capture: true });
    addEventListener('beforeunload', (e) => {
      if (document.pointerLockElement && (input.down('ControlLeft') || input.down('ControlRight'))) { e.preventDefault(); e.returnValue = ''; }
    });
  }
  return api;
}
