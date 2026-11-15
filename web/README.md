# AETHERIA — web prototype

Browser version of AETHERIA built with **Three.js r187 + Vite 8**, plain ES modules,
Rapier for physics and three-vrm for characters. It renders the same shared layout as
the Godot game: the town of **Vael Harrow**, its streets, walls, keep, bridge and the
surrounding nature.

This is a visual/tech prototype, not the shipping game; Godot remains the main build.

## Run

```powershell
cd web
npm install          # first time only
npm run dev          # http://127.0.0.1:5173
```

Build a production bundle with `npm run build` (`web/dist/`) and serve it with `npm run preview`.

## Play in the browser

The game is a static site: build once, then serve the folder over http.

```sh
cd web
npm install                 # first time only
npm run build               # -> web/dist/ (multi-file, relative paths, works from any folder)
npm run serve:dist          # vite preview --host on dist/ (default port 4173)
```

Then open `http://127.0.0.1:4173/?quality=medium`, or run `./play.sh` / `play.bat` to serve `dist/` on
`http://127.0.0.1:8080` with `python3 -m http.server` (fallback `npx serve`).

Single-file build (JS and CSS inlined in one HTML):

```sh
npm run build:single        # -> web/dist-single/aetheria.html + assets/ (GLB, textures) next to it
./play.sh dist-single       # or play.bat dist-single; then open http://127.0.0.1:8080/aetheria.html
```

The big runtime assets (`assets/`, GLB, textures, VRM) are not inlined. Serve the folder over http: opening the
HTML with `file://` fails because the assets are fetched.

URL parameters:

- `?quality=low|medium|high|ultra` sets the quality preset (`low` for weak GPUs and phones, default `medium`).
- `?touch=1` forces the touch overlay on; `?touch=0` turns it off. Coarse-pointer devices get it by default.
- `?view=<name>` opens a fixed camera view for captures (see "Screenshot views" below).

Static hosting: the contents of `dist/` can be published to GitHub Pages or Netlify. Runtime asset paths in `src/`
are absolute (`/assets/...`), so the site must be served at the domain root (for example a Netlify site or a custom
domain). A project page under `https://<user>.github.io/<repo>/` will 404 those assets until they are switched to
`import.meta.env.BASE_URL`. The manual workflow `.github/workflows/pages.yml` builds `web/` and deploys `dist/`
through `actions/deploy-pages`; it only runs when started by hand and needs Pages set to "GitHub Actions".

## Screenshot views

The app accepts `?view=<name>&quality=<preset>` for reproducible captures:

```
http://127.0.0.1:5173/?view=plaza&quality=medium
```

| View | Shows |
|---|---|
| `plaza` | Market plaza, Choir fountain, stalls and Concord Hall |
| `street` | Main street backbone and house fronts |
| `bridge` | West Gate, viaduct and river |
| `overview` | Whole town and the windmill hills |
| `hall` | Concord Hall and the upper terrace |
| `meadow` | Windmill hills and the western meadows |
| `portrait` / `fullbody` | Player character close-ups |

Visual sets can be switched back with URL parameters: `buildings=medieval` (default, CC0 Quaternius kit houses) `| blocks | kit`,
`ground=old` (painted ground textures) and `chars=vrm` (previous characters). See `public/assets/cc0/LICENSES.md`.

Quality presets live in `src/core/quality.js`: `low`, `medium` (default), `high`, `ultra`.
`low` targets Intel UHD laptops: lower pixel ratio, tighter shadows, no bloom/SMAA/AO.

Automated captures (Chrome/Edge headless, dev server must be running):

```powershell
node tools/shoot.mjs --views plaza,street,overview --quality medium --out shots/mine
```

Always run Blender exports, screenshots and `vite build` through the heavy-work lock:

```powershell
node tools/lock.mjs node tools/shoot.mjs --views plaza --quality medium --out shots/x
```

## Rebuilding assets

Assets are generated, not hand-edited; sources are Python/JS scripts under `tools/`.

```powershell
# Town kits -> public/assets/town/houses.glb, landmarks.glb (+ houses.json)
blender -b --factory-startup -P tools/blender/town/houses.py
blender -b --factory-startup -P tools/blender/town/landmarks.py

# AI-painted source textures (assets_src/ai) -> public/assets/textures
python tools/process_textures.py
```

`assets_src/mixamo/*.fbx` is watched by the dev runtime (`import.meta.glob`) and retargeted
onto the procedural characters; drop VRM models in `assets_src/vroid/` to override a character.

## Layout

```
src/
  main.js            boot, render loop, ?view/?quality handling
  core/              layout (shared world truth), quality presets, assets, input
  render/            toon shader, outlines, bloom/SMAA/AO pipeline
  world/
    terrain.js       heightfield mesh on layout.heightAt
    water.js         river and lake
    nature/          trees, grass, rocks, props
    town.js          town assembly
    town/            plan, streets, landmarks, props, dynamics, batching, materials
  characters/        procedural cast, VRM loading, animation retargeting
  player/            controller, camera, combat
  physics/           Rapier world
tools/               screenshot, lock, Blender kit builders, texture processing
public/assets/       runtime GLBs, textures and animation data
assets_src/          authored sources (AI textures, Mixamo FBX, Vroid VRM)
docs/                architecture contracts, art bible, judging notes
```

Static town geometry is merged into one `BatchedMesh` per material (see
`src/world/town/batch.js`); props and landmarks are placed procedurally from
`src/world/town/plan.js` so everything follows `src/core/layout.js`.

## Status (Nov 2026)

- Town, streets, walls, keep, bridge, fountain, windmills and landmarks render.
- Procedural props (stalls, lamps, barrels, carts, benches, planters) and dynamics
  (banners, flags, lantern glows, spinning mill sails) restored.
- `npm run build` passes (91 modules).
- Known gaps: `street` view composition is rough; ~25 fps at 1280×720 `medium` on Intel UHD;
  one harmless 404 in console (likely `/favicon.ico`).


## Mobile controls

Touch overlay (`src/input/touch.js`) appears on coarse-pointer devices; force it with `?touch=1`, disable with `?touch=0`.
Desktop keyboard + mouse and gamepad are unchanged.

- Left half: floating analog joystick (dead zone, smooth curve; walk below ~60%, run above, sprint at the rim).
- Right half: drag to orbit the camera, two-finger pinch to zoom. Sensitivity and UI scale are in the menu panel (saved in localStorage).
- Right-hand buttons: Attack, Jump, Dodge, Elemental skill, Interact, Heal, Lock-on, element selector (1-6, tap the number to expand).
- Top-right: Pause and a menu panel (inventory, journal, map, character, UI scale, camera sensitivity, fullscreen + landscape lock).
- Buttons feed the same inputs as desktop (Space, E, F, Tab, H, 1-6, I/J/M/C/Esc, LMB attack, RMB dodge) and also emit
  `aetheria:action` window events. Inputs are tracked per `pointerId` and released on cancel, blur, hidden tab and rotation.
- Portrait works; a hint suggests landscape. iOS Safari has no Fullscreen API for pages (use Add to Home Screen).

## Gameplay systems (src/game, src/ui)

Ported compactly from the Godot version (`data/*.json`, `scripts/{player,combat,elements,ai,quests,inventory,ui}`);
data lives in `src/game/data.js`. The layer boots from `src/game/index.js` (called by `main.js` after the player) and
talks to the player only through `ctx.hooks.preControl` (called in `player.js` between controls and the controller).
`ctx.paused` freezes the simulation (menus, dialogue); `ctx.uiUpdaters` always run; `ctx.timeScale` drives hit-stop.

| Input | Action |
| --- | --- |
| WASD / Shift / Space | move / sprint / jump |
| LMB | attack, 3-hit combo (arc hitbox, hit-stop, damage numbers) |
| RMB or Ctrl | dodge (i-frames, stamina cost) |
| E | elemental skill of the selected element (cooldown + energy) |
| 1-6 | Pyra, Aqua, Terra, Volt, Zephyr, Crya (click the bottom bar too) |
| H | heal (3 charges, regenerate; falls back to Healing Tonics) |
| Tab / Q | lock-on nearest on-screen enemy / switch target |
| F | interact: talk, open chests, gather Sunpetals |
| I / J / M / C / Esc | inventory, journal, map, character, pause (settings: quality, sensitivity, volume, save, reset) |
| Gamepad | X/RT attack, Y interact, LT skill, LB lock, Back heal, D-pad left/right element, Start pause |

- **Elements and reactions**: every hit leaves an element aura; a second element within 8 s triggers the reaction table of
  `elements.json` (Frozen, Steam Burst, Conduction, Wildfire, Crystallize, Melt, Overload, Fracture, Squall, Blizzard,
  Magma, Mire). Skills apply statuses (burn, stun, slow). All six elements are unlocked from the start (the Godot game unlocks them through quests).
- **Enemies**: Bramble Wisp and Rootling Brute (geometry + `AnimationMixer` keyframe clips), AI states idle / patrol / chase /
  telegraphed windup / strike / stunned / return / dead, spawns on the east road and the west meadows, drops, XP and levels.
- **Quests**: *Echoes in the Whisperwood* (Lyra, plaza, Maren) chains into *The First Verse* (3 wisps, Choir Steps, report to Maren);
  *Petals for a Price* (Toma, Sunpetals). Objective marker in the world and on the minimap.
- **Save**: `localStorage` key `aetheria.web.save.v1` (progress, inventory, quests, settings; every 15 s and on quit).
- **Audio**: SFX synthesised with WebAudio, started on the first gesture.
- **Touch**: HUD moves out of the way of the touch overlay; the overlay is hidden during dialogue and menus.

### Tests

`?test=1` stops the automatic loop: advance with `__game.step(n, dt)`; `window.__game` exposes `snapshot()`, `spawnNear()`,
`cast(el)`, `teleport()`, `tap(code)`, `talk(id)`, `killAll()` etc. (`?nosave=1` ignores the save). Playwright suite
(dev server on :5173): `node tools/gameplay-test.cjs [desktop|mobile|all]`; screenshots go to
`documentation/screenshots_gameplay/`.
