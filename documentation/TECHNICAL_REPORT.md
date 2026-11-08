# AETHERIA — Technical Environment Report

Audit date: 2026-11-07

## Detected hardware

| Item | Value |
|---|---|
| OS | Windows 11 Home 10.0.26300 |
| CPU | Intel Celeron N5095 @ 2.0 GHz, 4 cores / 4 threads |
| RAM | 7.8 GB total, **~1.1 GB free** during the audit |
| GPU | Intel UHD Graphics (Jasper Lake iGPU), shared memory, driver 31.0.101.2140 |
| Storage | 188 GB free of 476 GB (SSD) |

## Detected tools

| Tool | Status |
|---|---|
| Godot | **4.7.2 stable**, standalone at `Downloads/Godot_v4.7.2-stable_win64.exe/` (not on PATH). The console build is used for headless runs. |
| Godot export templates | **Not installed.** You need them for a Windows `.exe` build (see KNOWN_ISSUES). |
| Blender | **5.2** at `C:\Program Files\Blender Foundation\Blender 5.2\blender.exe` |
| Blender MCP | The connector shows as connected, but every request **times out** (the add-on server inside Blender is not answering). Fallback: run Blender headless (`blender -b -P script.py`). |
| Python | 3.14.3 (system) and 3.13 (bundled with Blender) |
| Git | Installed. The project is under version control. |

## Capability assessment

* The CPU is a low-power, 10 W-class part. Compiling shaders and importing assets is slow, and there is no headroom for heavy baking or offline renders.
* With ~1 GB of RAM free, you can't comfortably run Blender and the Godot editor side by side. The pipeline runs them **one at a time** and headless where possible.
* The iGPU supports Vulkan 1.3 and OpenGL 4.6, but its fill rate is weak. Real-time GI (SDFGI/VoxelGI), SSR, SSAO, volumetric fog and many dynamic shadowed lights are off the table.

## Rendering decisions

* **Renderer: Mobile (Vulkan).** It is much cheaper than Forward+ on an iGPU, still supports glow, tonemapping and fog, and maps directly onto the future Android/iOS targets. If Vulkan fails on a machine, run the game with `--rendering-driver opengl3` (Compatibility).
* One directional light (sun) with a short shadow distance and 2 cascades on Low/Medium.
* No real-time GI. Ambient light comes from the sky plus a stylized flat ambient term.
* Stylized flat-shaded, vertex-colored materials. No large textures, so the VRAM budget stays tiny.
* MSAA off by default; FXAA on Medium and above.
* Default graphics preset: **Low** on this machine, with a 0.85 render scale.

## Asset pipeline decisions

* Blender runs headless from scripts in `blender/scripts/`. The scripts export GLB files to `assets/models/`.
* Asset budget: props under 1.5k triangles, buildings under 4k, characters under 8k.
* The world is built in sectors so each sector can stream in or out later.
