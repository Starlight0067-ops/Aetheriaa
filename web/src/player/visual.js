// Character visual host: shows the procedural placeholder immediately, then swaps in the real character from
// src/characters/index.js (createCharacter(ctx, id)) when it loads. A missing, broken or slow character module
// never breaks boot: import.meta.glob resolves to {} when the file does not exist, and every call is guarded.
import * as THREE from 'three';
import { createPlaceholder } from './placeholder.js';

const CHARACTER_MODULES = import.meta.glob('../characters/index.js');
const AIR_AUTO = new Set(['jump', 'fall', 'land']);
const CALLS = ['play', 'setLocomotion', 'update', 'lookAt', 'setExpression'];

export function createVisualHost(ctx, root, id = 'kael') {
  const pivot = new THREE.Group(); pivot.name = 'player-lean';   // lean / stair smoothing
  const model = new THREE.Group(); model.name = 'player-model';  // optional 180° flip for screenshot views
  root.add(pivot); pivot.add(model);
  let current = null, isPlaceholder = true, warned = new Set();
  const last = { loco: [0, true, 0] };

  function guard(ch) {
    const wrapped = { object: ch.object, height: ch.height || 1.7, raw: ch };
    for (const k of CALLS) {
      wrapped[k] = (...a) => {
        if (typeof ch[k] !== 'function') return;
        try { return ch[k](...a); } catch (e) { if (!warned.has(k)) { warned.add(k); console.warn(`[player] character.${k} threw`, e); } }
      };
    }
    return wrapped;
  }

  function mount(ch, placeholder) {
    if (current) model.remove(current.object);
    current = guard(ch);
    isPlaceholder = placeholder;
    current.object.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    model.add(current.object);
    current.setLocomotion(...last.loco);
  }

  mount(createPlaceholder(ctx), true);

  async function loadReal() {
    const loader = CHARACTER_MODULES['../characters/index.js'];
    if (!loader) { console.info('[player] src/characters/index.js not found — using placeholder hero'); return false; }
    const mod = await loader();
    if (typeof mod.createCharacter !== 'function') throw new Error('characters/index.js has no createCharacter export');
    const ch = await mod.createCharacter(ctx, id);
    if (!ch || !ch.object || !ch.object.isObject3D) throw new Error('createCharacter returned no object');
    mount(ch, false);
    return true;
  }
  const timeout = new Promise((r) => setTimeout(() => r('timeout'), 30000));
  const ready = Promise.race([loadReal(), timeout])
    .then((r) => { if (r === 'timeout') console.warn('[player] character load timed out — keeping placeholder'); })
    .catch((e) => console.warn('[player] character failed to load — keeping placeholder:', e));

  return {
    pivot, model, ready,
    get character() { return current?.raw; },
    get object() { return current?.object; },
    get isPlaceholder() { return isPlaceholder; },
    // The real character's animator derives jump / fall / land from setLocomotion(speed, grounded, vy); playing them
    // again as overlays would double them (and a looping 'fall' overlay never clears), so only the placeholder gets them.
    play: (n, o) => (isPlaceholder || !AIR_AUTO.has(n) || typeof current?.raw?.setLocomotion !== 'function') ? current?.play(n, o) : false,
    setLocomotion: (s, g, v) => { last.loco = [s, g, v]; current?.setLocomotion(s, g, v); },
    update: (dt) => current?.update(dt),
    lookAt: (t) => current?.lookAt(t),
    setExpression: (n, w) => current?.setExpression(n, w),
  };
}
