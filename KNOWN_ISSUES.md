# Known Issues

* **Performance:** ~45 fps in town and ~30 fps in the densest forest views on the Low preset (Celeron N5095). Shader compilation causes hitches the first time a new area is seen.
* **Sky:** custom sky shaders crash the Intel UHD Vulkan driver (device lost), so the project avoids them.
* **No swimming:** the player can walk along the riverbed and lakebed.
* **The Blender MCP connector times out.** The pipeline runs Blender headless instead.
* **Characters:** hands are mitten-shaped, there are no facial animations (blink or lip movement), and coats and skirts have no cloth simulation.
* **Enemies and the boss** still use the earlier primitive art style.
* **The dungeon interior** of the Hollow Sanctum is not built. The arena is reached directly once the gate opens.
* Character art is original but stylistically simpler than commercial anime RPGs. Improving it is ongoing work (see TODO).
