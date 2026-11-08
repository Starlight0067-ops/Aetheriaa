extends Node3D
## Minimal element target used by the test runner.

var aura := ""
var aura_time := 0.0
var last_status: Dictionary = {}


func apply_status(r: Dictionary) -> void:
	last_status = r


func take_hit(_a: float, _e: String, _s: Node) -> void:
	pass
