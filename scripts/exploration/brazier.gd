class_name Brazier
extends Node3D
## Element receiver: Pyra lights it, Aqua puts it out. When every brazier in
## its puzzle group is lit, the puzzle flag is set and stays set.

var id := ""
var puzzle_group := ""
var lit := false
var _flame: Node3D


func _ready() -> void:
	add_to_group("element_receiver")
	add_to_group("brazier_" + puzzle_group)
	var k := MeshKit.new()
	k.cyl(Vector3(0, 0.5, 0), 0.15, 0.25, 1.0, Color("#8A6A3A"), 6)
	k.cyl(Vector3(0, 1.1, 0), 0.6, 0.3, 0.35, Color("#B8863E"), 8)
	k.instance(self, "Bowl")
	_flame = Node3D.new()
	_flame.position.y = 1.5
	add_child(_flame)
	var fk := MeshKit.new()
	fk.glow_color = Color("#FF8A3D")
	fk.cyl(Vector3(0, 0, 0), 0.0, 0.35, 0.8, Color("#FF8A3D"), 6, Basis(), true)
	fk.cyl(Vector3(0, -0.1, 0), 0.0, 0.2, 0.5, Color("#FFE08A"), 6, Basis(), true)
	fk.instance(_flame, "Flame")
	lit = Game.opened.has(id) or Game.has_flag(puzzle_group + "_solved")
	_flame.visible = lit
	var body := StaticBody3D.new()
	var cs := CollisionShape3D.new()
	var sh := CylinderShape3D.new()
	sh.radius = 0.5
	sh.height = 1.3
	cs.shape = sh
	cs.position.y = 0.65
	body.add_child(cs)
	add_child(body)


func on_element(element: String) -> void:
	if element == "pyra" and not lit:
		lit = true
		Game.opened[id] = true
		Sfx.play("skill_pyra")
		_check_solved()
	elif element == "aqua" and lit and not Game.has_flag(puzzle_group + "_solved"):
		lit = false
		Game.opened.erase(id)
	_flame.visible = lit


func _check_solved() -> void:
	for b in get_tree().get_nodes_in_group("brazier_" + puzzle_group):
		if not b.lit:
			Game.notify("A brazier flares to life.")
			return
	if not Game.has_flag(puzzle_group + "_solved"):
		Game.set_flag(puzzle_group + "_solved")
		Game.banner.emit("PUZZLE SOLVED", "The sealed door rumbles open.")
		Sfx.play("discover")
		Game.add_xp(40)


func _process(delta: float) -> void:
	if lit:
		_flame.scale = Vector3.ONE * (1.0 + sin(Time.get_ticks_msec() * 0.012) * 0.12)
