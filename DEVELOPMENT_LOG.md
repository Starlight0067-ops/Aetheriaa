# Development Log

## 2026-11-07 — Session 1
* Audited the machine: Celeron N5095, 7.8 GB RAM (~1 GB free), Intel UHD, Godot 4.7.2, Blender 5.2. The Blender MCP connector times out, so Blender runs headless instead.
* Wrote the design docs, narrative bible and art direction.
* Built the Godot project. Everything is data-driven: items, quests, dialogue, elements and enemies live in `data/`.
* Elyndra region: an analytic terrain with authored features (river, lake, ridge, plateau, settlement pads), the town of Vael Harrow (14 buildings, plaza, Old Span bridge), forest zones, Silverfall, the Choir Steps ruins with a brazier puzzle, the Hollow Sanctum arena and the Elyndra Core.
* Systems: third-person controller, spring-arm camera, 3-hit combo, dodge with i-frames, 6 elemental skills, aura/reaction system, enemy AI, Hollow Warden boss (3 patterns, 2 phases), NPC dialogue with conditions and actions, quests (talk/reach/kill/collect/interact), inventory and equipment, XP and levels, versioned JSON save with backup, settings with audio buses and graphics presets, main menu, HUD, minimap and full map, pause menu tabs.
* Audio: every sound effect and the music loop are synthesized at runtime, so all audio is original.
* Blender pipeline: props (statue, well, cart, windmill) plus 7 anime characters with rigs and animations.
* Graphics pass: shaders for terrain (noise texture), buildings (shingle/brick/plaster/wood patterns), foliage (wind and gradients), water (depth tint and shore foam), a cloud dome, anime character materials (cel shading, rim light, outline, hair sheen, unshaded eyes) and drifting particles.
* Fixed an intermittent Vulkan device loss. Root cause: custom *sky* shaders on the Intel driver. Fix: built-in procedural sky plus a cloud dome mesh. The water height map also moved from R32F to R16F as a precaution.
* Optimization: moved terrain noise to a texture (+9 fps), trimmed character polycounts from 29k to 11–16k triangles, made foliage single-sided, turned glow off on Low.
* Exported and smoke-tested the Windows build.
