// Third-party CC0 characters (public/assets/cc0/characters, see LICENSES.md there): rigged low-poly GLBs
// from Quaternius and Kenney with their own idle / walk / run clips, driven by a THREE.AnimationMixer.
// createCC0Character() returns the same API as createCharacter() in index.js, so the player controller and
// the NPC module do not change. index.js falls back to the VRM / generated characters when this fails
// or when the page is opened with ?chars=vrm.
import * as THREE from 'three';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { createToonMaterial } from '../render/toon.js';

const DIR = '/assets/cc0/characters/';

// cast id -> model. hero = adventurer, blacksmith = worker, elder = hooded adventurer, townsfolk = mini characters.
export const CC0_CAST = {
  kael:  { file: 'adventurer',        height: 1.75 },
  hesk:  { file: 'worker',            height: 1.84 },
  maren: { file: 'hooded_adventurer', height: 1.68 },
  veyra: { file: 'rogue',             height: 1.72 },
  lyra:  { file: 'mini_female_a',     height: 1.32 },
  wenna: { file: 'mini_female_a',     height: 1.36 },
  ostin: { file: 'mini_male_a',       height: 1.40 },
  toma:  { file: 'mini_male_a',       height: 1.22 },
};

// logical action -> clip name patterns (first match wins; names are compared without the "Armature|" prefix)
const CLIP = {
  idle:   [/^idle$/i, /^man_idle$/i, /^idle_neutral$/i, /idle/i],
  walk:   [/^walk$/i, /^man_walk$/i, /walk/i],
  run:    [/^run$/i, /^man_run$/i, /^sprint$/i],
  jump:   [/^jump$/i, /^man_jump$/i],
  fall:   [/^fall$/i],
  wave:   [/^wave$/i, /^emote-yes$/i, /clapping/i],
  talk:   [/^interact$/i, /^emote-yes$/i, /^man_standing$/i],
  attack: [/^sword_slash$/i, /^dagger_attack$/i, /^attack-melee-right$/i, /^man_swordslash$/i, /^punch/i],
  dodge:  [/^roll$/i],
  hit:    [/^hitrecieve$/i, /^recievehit$/i],
};
const ALIAS = { sprint: 'run', attack1: 'attack', attack2: 'attack', attack3: 'attack', land: null, interact: 'talk', cheer: 'wave' };

const KIND_RULES = [[/skin/i, 'skin'], [/hair|brow|beard/i, 'hair'], [/metal|gold/i, 'metal'], [/.*/, 'cloth']];
const kindOf = (n) => KIND_RULES.find(([re]) => re.test(n))[1];

export async function createCC0Character(ctx, id, opts = {}) {
  const spec = CC0_CAST[id];
  if (!spec) return null;
  const gltf = await ctx.assets.loadGLTF(DIR + spec.file + '.glb');
  const scene = cloneSkinned(gltf.scene);
  scene.name = `${id}_cc0`;

  const matCache = new Map();
  const toToon = (src) => {
    let m = matCache.get(src);
    if (!m) {
      const kind = kindOf(src.name || '');
      if (src.map) src.map.colorSpace = THREE.SRGBColorSpace;
      m = createToonMaterial({ color: src.color ? src.color.clone() : 0xffffff, map: src.map || null, kind, side: src.side });
      m.name = src.name;
      matCache.set(src, m);
    }
    return m;
  };
  scene.traverse((o) => {
    if (!o.isMesh) return;
    o.frustumCulled = false;
    o.material = Array.isArray(o.material) ? o.material.map(toToon) : toToon(o.material);
    if (opts.shadows !== false) o.castShadow = true;
  });

  // ---- animation
  const mixer = new THREE.AnimationMixer(scene);
  const short = (n) => n.split('|').pop();
  const find = (pats) => { for (const re of pats) { const c = gltf.animations.find((a) => re.test(short(a.name))); if (c) return c; } return null; };
  const actions = {};
  for (const [name, pats] of Object.entries(CLIP)) { const c = find(pats); if (c) actions[name] = mixer.clipAction(c); }
  if (!actions.run && actions.walk) actions.run = actions.walk;

  // ---- size: pose the idle frame, measure, then scale to the cast height with the feet on y = 0
  const object = new THREE.Group();
  object.name = `character_${id}`;
  const pivot = new THREE.Group();          // glTF models face +Z; the game's characters face -Z at yaw 0
  pivot.rotation.y = Math.PI;
  object.add(pivot);
  pivot.add(scene);
  if (actions.idle) { actions.idle.play(); mixer.update(0); }
  object.updateMatrixWorld(true);
  const box = new THREE.Box3();
  scene.traverse((o) => { if (o.isSkinnedMesh) { o.skeleton.update(); o.computeBoundingBox(); box.union(o.boundingBox.clone().applyMatrix4(o.matrixWorld)); } else if (o.isMesh) box.expandByObject(o); });
  const rawH = box.max.y - box.min.y;
  if (!(rawH > 0.01 && rawH < 1e4)) throw new Error(`cc0 character ${id}: bad bounds`);
  const height = opts.height ?? spec.height;
  const k = height / rawH;
  pivot.scale.setScalar(k);
  scene.position.y = -box.min.y;

  let base = 'idle', baseAction = actions.idle || null, ambient = null, overlay = null;
  const loco = { speed: 0, grounded: true };
  function setBase(name, fade = 0.2, timeScale = 1) {
    const a = actions[name];
    if (!a) return;
    a.timeScale = timeScale;
    if (a === baseAction) return;
    a.enabled = true; a.reset().setLoop(THREE.LoopRepeat, Infinity).fadeIn(fade).play();
    baseAction?.fadeOut(fade);
    baseAction = a; base = name;
  }
  function refresh() {
    if (overlay) return;
    const s = loco.speed;
    if (!loco.grounded && (actions.fall || actions.jump)) setBase(actions.fall ? 'fall' : 'jump', 0.15);
    else if (s < 0.25) setBase(ambient && actions[ambient] ? ambient : 'idle', 0.25);
    else if (s < 3.4) setBase('walk', 0.2, THREE.MathUtils.clamp(s / 1.6, 0.6, 1.7));
    else setBase('run', 0.2, THREE.MathUtils.clamp(s / 5.6, 0.75, 1.5));
  }
  mixer.addEventListener('finished', (e) => {
    if (e.action !== overlay) return;
    const done = overlay; overlay = null;
    baseAction = null;            // force the locomotion clip back in
    refresh();
    done.fadeOut(0.15);
  });

  let manual = false;
  const tick = (dt) => mixer.update(dt);
  if (ctx?.updaters) ctx.updaters.push((dt) => { if (!manual) tick(dt); });
  refresh();

  return {
    id, object, kind: 'cc0', height, model: { kind: 'cc0', scene, height }, mixer,
    play(name, o = {}) {
      const key = name in ALIAS ? ALIAS[name] : name;
      if (!key || !actions[key]) return false;
      if (o.loop || key === 'idle' || key === 'walk' || key === 'run') { ambient = key === 'idle' ? null : key; refresh(); return true; }
      if (key === 'jump' || key === 'fall') return true;      // derived from setLocomotion
      const a = actions[key];
      overlay?.fadeOut(0.1);
      overlay = a;
      a.enabled = true; a.timeScale = o.speed ?? 1; a.clampWhenFinished = true;
      a.reset().setLoop(THREE.LoopOnce, 1).fadeIn(o.fade ?? 0.12).play();
      baseAction?.fadeOut(o.fade ?? 0.12);
      return true;
    },
    stop() { ambient = null; refresh(); },
    setLocomotion(speed, grounded = true) { loco.speed = speed; loco.grounded = grounded; refresh(); },
    update(dt) { manual = true; tick(dt); },
    lookAt() {},
    setExpression() {},
    get current() { return overlay ? 'overlay' : base; },
    get actions() { return Object.keys(actions); },
    resetPhysics() {},
    dispose() { mixer.stopAllAction(); object.removeFromParent(); },
  };
}
