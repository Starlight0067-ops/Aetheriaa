#!/bin/bash
# Headless smoke test: loads a scene for N frames and prints script errors.
G="/c/Users/gabs0/Downloads/Godot_v4.7.2-stable_win64.exe/Godot_v4.7.2-stable_win64_console.exe"
SCENE=${1:-res://scenes/regions/elyndra.tscn}
FRAMES=${2:-120}
cd "$(dirname "$0")/.."
timeout 400 "$G" --headless --path . "$SCENE" --quit-after "$FRAMES" 2>&1 | grep -E "SCRIPT ERROR|ERROR|WARNING|Parse Error|at: " | grep -v "gdscript_resource_format\|Failed to compile depended" | awk '!seen[$0]++' | head -${3:-60}
