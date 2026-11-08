class_name ResonanceLock
extends Interactable
## Choir mechanism that only Kael can "sing" open, and only once the quest is ready.

var _crystal: Node3D
var _t := 0.0


func _init() -> void:
	id = "resonance_lock"
	prompt = "Sing to the Resonance Lock"
	interact_radius = 3.2


func _ready() -> void:
	super()
	var k := MeshKit.new()
	k.glow_color = Color("#5FE3E0")
	k.cyl(Vector3(0, 0.6, 0), 1.0, 1.3, 1.2, Color("#76839A"), 6)
	for i in 6:
		var a := i * TAU / 6.0
		k.box(Vector3(cos(a) * 1.05, 0.6, sin(a) * 1.05), Vector3(0.1, 0.9, 0.5), Color("#5FE3E0"), -a, true)
	k.instance(self, "Pedestal")
	_crystal = Node3D.new()
	_crystal.position.y = 2.2
	add_child(_crystal)
	var ck := MeshKit.new()
	ck.glow_color = Color("#7FF5FF")
	ck.cyl(Vector3(0, 0.4, 0), 0.0, 0.4, 0.8, Color("#7FF5FF"), 6, Basis(), true)
	ck.cyl(Vector3(0, -0.3, 0), 0.4, 0.0, 0.6, Color("#7FF5FF"), 6, Basis(), true)
	ck.instance(_crystal, "Crystal")
	var body := StaticBody3D.new()
	var cs := CollisionShape3D.new()
	var sh := CylinderShape3D.new()
	sh.radius = 1.2
	sh.height = 1.2
	cs.shape = sh
	cs.position.y = 0.6
	body.add_child(cs)
	add_child(body)
	Game.world_positions[id] = global_position


func can_interact() -> bool:
	return not Game.has_flag("sanctum_open")


func interact(_player: Node) -> void:
	if Quests.current_step_id("mq_choir") == "s3":
		Sfx.play("discover")
		Effects.ring(get_parent(), global_position + Vector3(0, 1.0, 0), Color("#7FF5FF"), 12.0)
		Quests.notify_event("interact", id)
		Game.banner.emit("THE LOCK ANSWERS", "Somewhere to the south, stone grinds against stone.")
	else:
		var ui := get_tree().get_first_node_in_group("dialogue_ui")
		if ui:
			ui.show_text("Resonance Lock", "The crystal hums a note you almost recognize. It isn't ready to answer you yet.")


func _process(delta: float) -> void:
	_t += delta
	_crystal.rotation.y += delta * (3.0 if Game.has_flag("sanctum_open") else 0.8)
	_crystal.position.y = 2.2 + sin(_t * 1.5) * 0.15
