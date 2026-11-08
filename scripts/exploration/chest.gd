class_name Chest
extends Interactable
## Persistent treasure chest. Loot: {item_id: count}, plus XP.

var loot: Dictionary = {}
var xp := 15
var lid: Node3D
var locked_flag := ""   # only openable once this flag is set
var _open := false


static func create(chest_id: String, items: Dictionary, xp_reward: int = 15, flag: String = "") -> Chest:
	var c := Chest.new()
	c.id = chest_id
	c.loot = items
	c.xp = xp_reward
	c.locked_flag = flag
	c.prompt = "Open Chest"
	return c


func _ready() -> void:
	super()
	var k := MeshKit.new()
	k.glow_color = Color("#FFD98A")
	k.box(Vector3(0, 0.3, 0), Vector3(1.1, 0.6, 0.7), Color("#8A5A3A"))
	k.box(Vector3(0, 0.3, 0), Vector3(1.14, 0.12, 0.74), Color("#C9A15B"))
	k.box(Vector3(0, 0.45, -0.37), Vector3(0.2, 0.22, 0.06), Color("#FFD98A"), 0.0, true)
	k.instance(self, "Base")
	lid = Node3D.new()
	lid.position = Vector3(0, 0.6, 0.35)
	add_child(lid)
	var lk := MeshKit.new()
	lk.box(Vector3(0, 0.12, -0.35), Vector3(1.12, 0.26, 0.72), Color("#9C6B43"))
	lk.box(Vector3(0, 0.12, -0.35), Vector3(0.16, 0.28, 0.76), Color("#C9A15B"))
	lk.instance(lid, "Lid")
	var body := StaticBody3D.new()
	var cs := CollisionShape3D.new()
	var sh := BoxShape3D.new()
	sh.size = Vector3(1.1, 0.8, 0.7)
	cs.shape = sh
	cs.position.y = 0.4
	body.add_child(cs)
	add_child(body)
	if Game.opened.has(id):
		_open = true
		lid.rotation.x = -1.9
	Game.world_positions[id] = global_position


func can_interact() -> bool:
	return not _open and (locked_flag == "" or Game.has_flag(locked_flag))


func interact(_player: Node) -> void:
	if _open:
		return
	_open = true
	Game.opened[id] = true
	Sfx.play("chest")
	for item in loot:
		Inventory.add(item, int(loot[item]))
	Game.add_xp(xp)
	Effects.burst(get_parent(), global_position + Vector3(0, 0.8, 0), Color("#FFD98A"), 18)


func _process(delta: float) -> void:
	if _open and lid.rotation.x > -1.9:
		lid.rotation.x = move_toward(lid.rotation.x, -1.9, delta * 5.0)
