// Keyboard / mouse / gamepad state. Pointer lock on click (disabled in screenshot mode).
export function createInput(dom, { shot = false } = {}) {
  const keys = new Set();
  const pressed = new Set();
  const mouse = { dx: 0, dy: 0, wheel: 0, buttons: new Set(), clicked: new Set() };
  addEventListener('keydown', (e) => { if (!keys.has(e.code)) pressed.add(e.code); keys.add(e.code); });
  addEventListener('keyup', (e) => keys.delete(e.code));
  addEventListener('blur', () => keys.clear());
  dom.addEventListener('mousedown', (e) => {
    mouse.buttons.add(e.button); mouse.clicked.add(e.button);
    if (!shot && document.pointerLockElement !== dom) dom.requestPointerLock?.();
  });
  addEventListener('mouseup', (e) => mouse.buttons.delete(e.button));
  addEventListener('mousemove', (e) => {
    if (document.pointerLockElement === dom) { mouse.dx += e.movementX; mouse.dy += e.movementY; }
  });
  addEventListener('wheel', (e) => { mouse.wheel += Math.sign(e.deltaY); }, { passive: true });
  dom.addEventListener('contextmenu', (e) => e.preventDefault());

  return {
    keys, mouse,
    down: (code) => keys.has(code),
    justPressed: (code) => pressed.has(code),
    clicked: (b) => mouse.clicked.has(b),
    gamepad: () => (navigator.getGamepads?.() || []).find((g) => g) || null,
    /** Call once per frame after all systems read input. */
    endFrame() { pressed.clear(); mouse.clicked.clear(); mouse.dx = mouse.dy = mouse.wheel = 0; },
  };
}
