// "mobile-safe" memory profile. iOS Safari kills the WebContent process of a tab that exceeds ~300-500 MB (JS + GPU),
// far below desktop budgets, so phones run a trimmed build of the game. Levels: 0 = off, 1 = safe, 2 = safer
// (reduced world, texture cap 256). Resolution order: ?safe=0|1|2 -> crash recovery (previous boot never became
// stable, see boot flag) -> auto detection (iPhone/iPad UA, coarse pointer, deviceMemory <= 4).
const params = new URLSearchParams(location.search);
const BOOT_KEY = 'aetheria.boot';

const ls = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* private mode */ } },
  del(k) { try { localStorage.removeItem(k); } catch { /* ignore */ } },
};

export function isIOS() {
  try {
    const ua = navigator.userAgent || '';
    return /iPhone|iPad|iPod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  } catch { return false; }
}

function detect() {
  try {
    if (isIOS()) return 1;
    if (matchMedia('(pointer: coarse)').matches && !matchMedia('(hover: hover)').matches) return 1;
    if (/Android|Mobile/i.test(navigator.userAgent || '')) return 1;
    if (navigator.deviceMemory && navigator.deviceMemory <= 4 && navigator.maxTouchPoints > 0) return 1;
  } catch { /* ignore */ }
  return 0;
}

const explicit = params.get('safe');
const crashed = ls.get(BOOT_KEY) !== null;
let level;
let reason = 'auto';
if (explicit !== null && /^[012]$/.test(explicit)) { level = +explicit; reason = 'param'; }
else if (explicit === '' || explicit === 'true') { level = 1; reason = 'param'; }
else if (crashed) { level = 2; reason = 'crash-recovery'; }
else level = detect();

export const SAFE = level;
export const SAFE_REASON = reason;
export const PREV_CRASH = crashed && reason === 'crash-recovery';

/** Mark "boot in progress" now; the flag is cleared after 10 s of stable play or a normal page hide/unload.
 *  A WebContent crash fires neither, so the next load finds the flag and starts in safe=2. */
export function armBootFlag(ctx) {
  ls.set(BOOT_KEY, String(Date.now()));
  const clear = () => ls.del(BOOT_KEY);
  addEventListener('pagehide', clear);
  let stable = 0, last = performance.now();
  const timer = setInterval(() => {
    const now = performance.now(), dt = now - last; last = now;
    // count only time the page is visible and frames are actually flowing
    if (!document.hidden && window.__AETHERIA_READY && dt < 2500) stable += dt;
    if (stable >= 10000) { clear(); clearInterval(timer); ctx && (ctx.bootStable = true); }
  }, 500);
}
