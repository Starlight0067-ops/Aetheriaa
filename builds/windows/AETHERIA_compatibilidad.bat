@echo off
rem Starts AETHERIA with the OpenGL "Compatibility" renderer, for laptops where the Vulkan renderer stalls.
start "" "%~dp0AETHERIA.exe" --rendering-driver opengl3 --rendering-method gl_compatibility
