# Technical Decisions

1. **Mobile renderer (Vulkan).** The best quality per cost on Intel UHD, and the same renderer the future Android/iOS ports will use. Fallback: `--rendering-driver opengl3`.
2. **No custom sky shaders.** They cause `VK_ERROR_DEVICE_LOST` on the dev machine's Intel driver. Use `ProceduralSkyMaterial` plus the camera-centred cloud dome (`StyleMats.cloud_dome_material`).
3. **Per-pixel noise comes from a texture**, not hash functions. Intel iGPU ALU throughput is low. A 256² seamless noise texture saves about 9 fps.
4. **Procedural, code-authored world.** Layout constants live in `ElyndraLayout` (an analytic height function plus hand-placed features). This keeps the project small, diffable and deterministic. Placement is authored zones with seeded jitter, not random scatter.
5. **Merged vertex-colour meshes (`MeshKit`).** One draw call per building or prop. The vertex-colour alpha selects a surface pattern in the structure shader.
6. **Characters are generated in Blender from code** (`blender/scripts/build_characters.py`): skin-modifier bodies, a sculpted head, a procedurally painted eye texture, ribbon hair clumps, layered outfit pieces, an armature, distance-based weights and keyed actions. They are exported as GLB, and `CharacterModel` swaps in anime materials at runtime.
7. **Character materials skip received shadows** (`shadows_disabled`). This gives clean anime faces with no shadow acne. They still cast shadows.
8. **JSON for data and saves.** Human-readable and versioned (`Game.SAVE_VERSION`), with a `.bak` copy kept on every save.
9. **Synthesized audio** (`Sfx`). No licensing risk, and nothing to download.
10. **The input map is registered in code** (`Settings._setup_input`), so it stays in version control with the project.
11. **Godot ignores `blender/`, `documentation/` and `builds/`** through `.gdignore` files. Otherwise Godot tries to import `.blend` files and stalls the import.
