# AETHERIA web — Architecture & Team Contracts

Project root: `C:\Users\gabs0\Downloads\atheria\web` (Vite + Three.js r187, plain ES modules).
Dev server: **already running** at http://127.0.0.1:5173 (the orchestrator owns it). Never start, stop or restart servers.

## Module contract
Every system exports `async function create(ctx)` and returns its API object. Per-frame work goes in
`ctx.updaters.push((dt, time) => {...})`. Boot order (src/main.js): lighting → sky → world (terrain, water, nature, town) → player → pipeline.

`ctx` = `{ THREE, renderer, scene, camera, quality, params, shot, assets, input, updaters, colliders, pending, systems, cameraLocked, time }`
* `ctx.quality`: the preset from `src/core/quality.js` (low/medium/high/ultra). Respect `grassDensity`, `treeDensity`, `drawDistance`, `shadowMapSize`, `cascades`, `bloom`, `smaa`, `ao`, `outlines`, `waterQuality`.
* `ctx.assets`: `loadGLTF(url)`, `loadTexture(url, {srgb, repeat})`, `tryTexture(url)` (null if missing).
* `ctx.colliders`: push static collider descriptors for the physics owner:
  `{kind:'heightfield', heightAt, size, resolution}` · `{kind:'box', center:[x,y,z], half:[x,y,z], rotationY}` · `{kind:'mesh', object}` (trimesh from an Object3D's geometry; keep these low-poly).
* `ctx.pending`: push promises that must resolve before screenshots are taken (async asset loads).
* `ctx.cameraLocked`: true in screenshot views — camera controllers must not move the camera.
* `ctx.systems.lighting.sunDirection` (THREE.Vector3, towards the sun) is the single source of truth for sun direction.

## Materials (mandatory)
All world and character materials are created through `src/render/toon.js` (`createToonMaterial(opts)`, `createOutline(...)`).
The render owner may upgrade internals at any time but keeps those signatures stable.
`opts.kind` tells the shader what it is: `ground | foliage | grass | stone | roof | wood | plaster | cloth | skin | hair | metal | water | glow`.
Foliage geometry should carry a `sphereNormal` attribute or use `kind:'foliage'` so shading can use soft spherical normals.

## Shared layout (read-only)
`src/core/layout.js`: world size, `heightAt(x,z)`, `normalAt`, river polyline, POIs (plaza, hall, gates, bridge, windmills, lake, Core),
street backbone and screenshot `VIEWS`. Need a change? Put it in your report — the orchestrator edits this file.

## File ownership (only edit your own files)
| Owner | Files |
|---|---|
| orchestrator | `src/main.js`, `src/core/*`, `src/world/index.js`, `docs/ARCHITECTURE.md`, `docs/ART_BIBLE.md`, `tools/*.mjs`, `public/assets/textures/*` |
| render | `src/render/*`, `src/world/water.js` |
| nature | `src/world/terrain.js`, `src/world/nature/**`, `tools/blender/nature/**`, `public/assets/nature/**` |
| town | `src/world/town.js`, `src/world/town/**`, `tools/blender/town/**`, `public/assets/town/**` |
| character | `src/characters/**`, `tools/blender/characters/**`, `public/assets/characters/**`, `public/assets/anims/**`, `docs/characters/**` |
| player | `src/player/**`, `src/physics/**` |

## Heavy work & RAM (the dev laptop has ~1 GB free RAM, Intel UHD GPU)
Wrap every Blender run, screenshot run and `vite build` in the lock: `node tools/lock.mjs <command...>`.
Blender: `"C:/Program Files/Blender Foundation/Blender 5.2/blender.exe" -b --factory-startup -P <script.py>`.
Screenshots: `node tools/lock.mjs node tools/shoot.mjs --views plaza,street --quality high --out shots/<you>/<round>`.
Read the PNGs back with your image-reading tool and judge them critically yourself before reporting.

## Textures (AI-painted, provided by the orchestrator)
Appearing progressively in `public/assets/textures/` (sRGB JPG, seamless where noted). Load with `ctx.assets.tryTexture` and keep a procedural fallback:
`roof_tiles.jpg`, `plaster.jpg`, `timber.jpg`, `cobblestone.jpg`, `stone_wall.jpg`, `grass.jpg`, `dirt_path.jpg`, `rock_cliff.jpg`,
`leaves_broadleaf.png` (alpha), `leaves_pine.png` (alpha), `ivy.png` (alpha), `flowers.png` (alpha), `bark.jpg`, `wood_planks.jpg`.

## Rules
* No git commits (the orchestrator commits). No new npm packages without saying why in your report.
* Original designs only: never reproduce locations, characters, symbols or logos from existing games or films.
* Report format at the end: what you built (files), screenshots you produced (paths), measured fps per view and preset, known gaps, requests for the orchestrator.
