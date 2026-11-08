# AETHERIA

An original anime-inspired 3D fantasy action RPG made with Godot 4.7 and Blender 5.2. The first playable region is **Elyndra, the Green Frontier**.

## Play
Run `builds/windows/AETHERIA.exe` (Windows, Vulkan). If it doesn't start, run it with `--rendering-driver opengl3`.

## Controls
| Action | Key |
|---|---|
| Move / camera | WASD / mouse |
| Sprint / jump / dodge | Shift / Space / Ctrl or RMB |
| Attack / elemental skill | LMB / E |
| Switch element | 1–6 |
| Interact / lock-on / heal | F / Tab / H |
| Inventory / journal / map / character / pause | I / J / M / C / Esc |

## Develop
* Open the folder in Godot 4.7.2. The main scene is `scenes/main/main_menu.tscn`.
* Tests: `godot --headless --path . res://tests/test_runner.tscn` (exit code 0 means all pass).
* Screenshots: `godot --path . res://tests/screenshots.tscn` and `res://tests/character_showcase.tscn`.
* Rebuild characters: `blender -b --factory-startup -P blender/scripts/build_characters.py` (append `-- kael` to build only one).
* Rebuild props: `blender -b --factory-startup -P blender/scripts/build_elyndra_props.py`.
* Windows build: `godot --headless --path . --export-release "Windows Desktop" builds/windows/AETHERIA.exe`. Verify it with `builds/windows/AETHERIA.console.exe -- --smoke-test`.

See `documentation/` for the design document, narrative bible, art direction and technical report.
