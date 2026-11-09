class_name ElementSeal
extends Node3D
## Choir pedestal tuned to a single element. Struck with the matching element it
## locks open; when every seal in its group is open the puzzle flag is set and
## stays set. (Braziers handle Pyra/Aqua pairs; this handles the Sanctum choirs.)

var id := ""
var puzzle_group := ""
var required_element := "pyra"
var lit := false
var _crystal: Node3D
var _glow: Node3D
var _t := 0.0
var _hint_cd := 0.0


func _ready() -> void:
	add_to_group("element_receiver")
	add_to_group("element_seal_" + puzzle_group)
	var color := DB.element_color(required_element)
	var k := MeshKit.new()
	k.glow_color = color
	k.cyl(Vector3(0, 0.25, 0), 1.1, 1.35, 0.5, Color("#76839A"), 6)
	k.cyl(Vector3(0, 0.9, 0), 0.55, 0.8, 0.8, Color("#9AA7B5"), 6)
	for i in 6:
		var a := i * TAU / 6.0
		k.box(Vector3(cos(a) * 1.12, 0.28, sin(a) * 1.12), Vector3(0.12, 0.42, 0.5), Color("#5FE3E0"), -a, true)
	k.instance(self, "Pedestal")
	_crystal = Node3D.new()
	_crystal.position.y = 1.9
	add_child(_crystal)
	var sk := MeshKit.new()
	sk.cyl(Vector3(0, 0.35, 0), 0.0, 0.32, 0.7, Color("#9AA7B5"), 6)
	sk.cyl(Vector3(0, -0.3, 0), 0.32, 0.0, 0.6, Color("#76839A"), 6)
	sk.instance(_crystal, "StoneCrystal")
	_glow = Node3D.new()
	_crystal.add_child(_glow)
	var gk := MeshKit.new()
	gk.glow_color = color
	gk.cyl(Vector3(0, 0.35, 0), 0.0, 0.26, 0.62, color, 6, Basis(), true)
	gk.cyl(Vector3(0, -0.28, 0), 0.26, 0.0, 0.55, color, 6, Basis(), true)
	gk.instance(_glow, "Glow")
	var body := StaticBody3D.new()
	var cs := CollisionShape3D.new()
	var sh := CylinderShape3D.new()
	sh.radius = 1.0
	sh.height = 1.2
	cs.shape = sh
	cs.position.y = 0.6
	body.add_child(cs)
	add_child(body)
	lit = Game.opened.has(id) or Game.has_flag(puzzle_group + "_solved")
	_glow.visible = lit


func on_element(element: String) -> void:
	if lit or element == "":
		return
	if element != required_element:
		if _hint_cd <= 0.0:
			_hint_cd = 4.0
			Game.notify("This seal answers only to %s." % DB.elements.get(required_element, {}).get("name", required_element))
		return
	lit = true
	Game.opened[id] = true
	_glow.visible = true
	Sfx.play("reaction")
	Effects.ring(get_parent(), global_position + Vector3(0, 0.4, 0), DB.element_color(required_element), 3.2)
	_check_solved()


func _check_solved() -> void:
	for s in get_tree().get_nodes_in_group("element_seal_" + puzzle_group):
		if not s.lit:
			return
	if not Game.has_flag(puzzle_group + "_solved"):
		Game.set_flag(puzzle_group + "_solved")
		Game.banner.emit("CHOIR AWAKENED", "A second note joins the first. Somewhere, a seal loosens.")
		Sfx.play("discover")
		Game.add_xp(50)


func _process(delta: float) -> void:
	_t += delta
	_hint_cd = max(0.0, _hint_cd - delta)
	_crystal.rotation.y += delta * (1.6 if lit else 0.35)
	_crystal.position.y = 1.9 + sin(_t * 1.4) * 0.08
