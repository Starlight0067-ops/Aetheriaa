class_name FlagGate
extends Node3D
## Choir door that sinks into the ground once its flag is set.

var flag := ""
var size := Vector3(4, 4, 0.6)
var _body: StaticBody3D
var _visual: Node3D
var _opened := false


func _ready() -> void:
	_visual = Node3D.new()
	add_child(_visual)
	var k := MeshKit.new()
	k.glow_color = Color("#5FE3E0")
	k.box(Vector3(0, size.y * 0.5, 0), size, Color("#76839A"))
	k.box(Vector3(0, size.y * 0.55, -size.z * 0.5 - 0.02), Vector3(size.x * 0.12, size.y * 0.7, 0.04), Color("#5FE3E0"), 0.0, true)
	k.box(Vector3(0, size.y * 0.55, size.z * 0.5 + 0.02), Vector3(size.x * 0.12, size.y * 0.7, 0.04), Color("#5FE3E0"), 0.0, true)
	k.instance(_visual, "Door")
	_body = StaticBody3D.new()
	var cs := CollisionShape3D.new()
	var sh := BoxShape3D.new()
	sh.size = size
	cs.shape = sh
	cs.position.y = size.y * 0.5
	_body.add_child(cs)
	add_child(_body)
	if Game.has_flag(flag):
		_set_open_instant()


func _set_open_instant() -> void:
	_opened = true
	_visual.position.y = -size.y - 0.2
	_body.process_mode = Node.PROCESS_MODE_DISABLED
	_body.collision_layer = 0


func _process(delta: float) -> void:
	if not _opened and Game.has_flag(flag):
		_opened = true
		_body.collision_layer = 0
		Sfx.play("boss_slam")
	if _opened and _visual.position.y > -size.y - 0.2:
		_visual.position.y = move_toward(_visual.position.y, -size.y - 0.2, delta * 1.5)
