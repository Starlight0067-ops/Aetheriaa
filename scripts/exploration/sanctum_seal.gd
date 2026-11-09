class_name SanctumSeal
extends Interactable
## The inner Choir seal before the Hollow Warden's arena. It only answers when
## both elemental choirs in the Sanctum are awake.

const CHOIRS := [
	{"flag": "sanctum_braziers_solved", "name": "the Ember Choir"},
	{"flag": "sanctum_gales_solved", "name": "the Gale Choir"},
]

var _crystal: Node3D
var _t := 0.0


func _init() -> void:
	id = "sanctum_seal"
	prompt = "Sing the Inner Seal"
	interact_radius = 3.4


func _ready() -> void:
	super()
	var k := MeshKit.new()
	k.glow_color = Color("#5FE3E0")
	k.cyl(Vector3(0, 0.3, 0), 1.6, 1.9, 0.6, Color("#76839A"), 6)
	k.cyl(Vector3(0, 0.95, 0), 0.9, 1.25, 0.7, Color("#9AA7B5"), 6)
	for i in 6:
		var a := i * TAU / 6.0
		k.box(Vector3(cos(a) * 1.45, 0.35, sin(a) * 1.45), Vector3(0.14, 0.5, 0.7), Color("#5FE3E0"), -a, true)
	k.instance(self, "Pedestal")
	_crystal = Node3D.new()
	_crystal.position.y = 2.5
	add_child(_crystal)
	var ck := MeshKit.new()
	ck.glow_color = Color("#7FF5FF")
	ck.cyl(Vector3(0, 0.55, 0), 0.0, 0.5, 1.1, Color("#7FF5FF"), 6, Basis(), true)
	ck.cyl(Vector3(0, -0.45, 0), 0.5, 0.0, 0.9, Color("#7FF5FF"), 6, Basis(), true)
	ck.instance(_crystal, "Crystal")
	var body := StaticBody3D.new()
	var cs := CollisionShape3D.new()
	var sh := CylinderShape3D.new()
	sh.radius = 1.5
	sh.height = 1.3
	cs.shape = sh
	cs.position.y = 0.65
	body.add_child(cs)
	add_child(body)
	Game.world_positions[id] = global_position


func can_interact() -> bool:
	return not Game.has_flag("sanctum_inner_open")


func interact(_player: Node) -> void:
	if Game.has_flag("sanctum_inner_open"):
		return
	var missing: Array = []
	for c in CHOIRS:
		if not Game.has_flag(c.flag):
			missing.append(c.name)
	if missing.is_empty():
		Game.set_flag("sanctum_inner_open")
		Sfx.play("discover")
		Effects.ring(get_parent(), global_position + Vector3(0, 1.0, 0), Color("#7FF5FF"), 10.0)
		Game.banner.emit("THE INNER SEAL YIELDS", "Beyond, the Hollow Warden keeps its long watch.")
		Game.add_xp(60)
		return
	var ui := get_tree().get_first_node_in_group("dialogue_ui")
	if ui:
		var names := PackedStringArray(missing)
		ui.show_text("Inner Seal", "The crystal is mute. Two choirs must answer first: %s." % ", ".join(names))


func _process(delta: float) -> void:
	_t += delta
	_crystal.rotation.y += delta * (2.6 if Game.has_flag("sanctum_inner_open") else 0.7)
	_crystal.position.y = 2.5 + sin(_t * 1.3) * 0.12
