class_name Landmark
extends Node3D
## Discoverable location. Entering its radius discovers it and reports a
## "reach" event to the quest system.

var id := ""
var display_name := ""
var radius := 12.0
var map_icon := "landmark"
var _inside := false
var _timer := 0.0


static func create(lm_id: String, title: String, r: float, icon: String = "landmark") -> Landmark:
	var l := Landmark.new()
	l.id = lm_id
	l.display_name = title
	l.radius = r
	l.map_icon = icon
	return l


func _ready() -> void:
	add_to_group("landmark")
	Game.world_positions[id] = global_position


func _process(delta: float) -> void:
	_timer -= delta
	if _timer > 0.0:
		return
	_timer = 0.25
	var player := get_tree().get_first_node_in_group("player") as Node3D
	if player == null:
		return
	var d := Vector2(player.global_position.x - global_position.x, player.global_position.z - global_position.z).length()
	var now := d < radius
	if now and not _inside:
		Game.discover(id, display_name)
		Quests.notify_event("reach", id)
	_inside = now
