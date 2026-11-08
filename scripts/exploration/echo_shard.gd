class_name EchoShard
extends Node3D
## Floating collectible crystal, picked up automatically on touch.

var id := ""
var _t := 0.0
var _base_y := 0.0
var _player: Node3D


static func create(shard_id: String) -> EchoShard:
	var e := EchoShard.new()
	e.id = shard_id
	return e


func _ready() -> void:
	if Game.opened.has(id):
		queue_free()
		return
	add_to_group("echo_shard")
	var k := MeshKit.new()
	k.glow_color = Color("#BDF7FF")
	k.cyl(Vector3(0, 0.25, 0), 0.0, 0.18, 0.5, Color("#BDF7FF"), 6, Basis(), true)
	k.cyl(Vector3(0, -0.15, 0), 0.18, 0.0, 0.3, Color("#BDF7FF"), 6, Basis(), true)
	k.instance(self, "Crystal")
	_t = randf() * TAU
	_base_y = position.y
	Game.world_positions[id] = global_position


func _process(delta: float) -> void:
	_t += delta
	rotation.y += delta * 1.5
	position.y = _base_y + sin(_t * 2.0) * 0.15
	if _player == null:
		_player = get_tree().get_first_node_in_group("player") as Node3D
		return
	if _player.global_position.distance_to(global_position) < 1.6:
		Game.opened[id] = true
		Inventory.add("echo_shard", 1, true)
		Game.notify("Echo Shard  (%d collected)" % Inventory.count("echo_shard"), "item")
		Sfx.play("pickup", 1.3)
		Effects.burst(get_parent(), global_position, Color("#BDF7FF"), 14)
		Game.add_xp(5)
		queue_free()
