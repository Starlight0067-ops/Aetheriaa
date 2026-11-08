class_name NPC
extends Interactable
## Talkable townsperson. Idles, turns toward the player, can walk a waypoint
## loop (a simple daily routine), and shows a quest marker when they have
## something for the player.

var npc_id := ""
var look: Dictionary = {}
var waypoints: Array = []      # Vector3 loop
var walk_speed := 1.4
var model: Humanoid
var _wp_i := 0
var _wait := 0.0
var _talking := false
var _marker: Label3D
var _name_tag: Label3D
var _player: Node3D


static func create(id_: String, look_: Dictionary, wps: Array = []) -> NPC:
	var n := NPC.new()
	n.npc_id = id_
	n.id = id_
	n.look = look_
	n.waypoints = wps
	return n


func _ready() -> void:
	super()
	add_to_group("npc")
	var data: Dictionary = DB.npcs.get(npc_id, {})
	prompt = "Talk to " + data.get("name", npc_id)
	interact_radius = 2.8
	model = Humanoid.create(look)
	add_child(model)
	var body := StaticBody3D.new()
	body.collision_layer = 1
	var cs := CollisionShape3D.new()
	var cap := CapsuleShape3D.new()
	cap.radius = 0.35
	cap.height = 1.7
	cs.shape = cap
	cs.position.y = 0.85
	body.add_child(cs)
	add_child(body)
	_name_tag = Label3D.new()
	_name_tag.text = data.get("name", npc_id)
	_name_tag.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	_name_tag.pixel_size = 0.004
	_name_tag.font_size = 36
	_name_tag.outline_size = 8
	_name_tag.modulate = Color("#F4EEDC")
	_name_tag.position.y = 2.25 * float(look.get("height", 1.0))
	_name_tag.visibility_range_end = 14.0
	add_child(_name_tag)
	_marker = Label3D.new()
	_marker.text = "!"
	_marker.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	_marker.font_size = 110
	_marker.outline_size = 14
	_marker.pixel_size = 0.005
	_marker.modulate = Color("#FFD34D")
	_marker.position.y = 2.75 * float(look.get("height", 1.0))
	_marker.no_depth_test = true
	add_child(_marker)
	Game.world_positions[npc_id] = global_position


func interact(_p: Node) -> void:
	var ui := get_tree().get_first_node_in_group("dialogue_ui")
	if ui == null:
		return
	_talking = true
	model.talk = true
	ui.start_npc(npc_id, self)


func end_talk() -> void:
	_talking = false
	model.talk = false


## Shows "!" when the NPC is the target of the current quest step or has a quest to offer.
func _has_business() -> bool:
	for q in Quests.active:
		var step := Quests.current_step(q)
		if step.get("type", "") == "talk" and step.get("target", "") == npc_id:
			return true
	match npc_id:
		"ostin": return not Quests.is_active("sq_ostin") and not Quests.is_done("sq_ostin")
		"toma": return not Quests.is_active("sq_toma") and not Quests.is_done("sq_toma")
	return false


func _process(delta: float) -> void:
	if _player == null:
		_player = get_tree().get_first_node_in_group("player") as Node3D
	_marker.visible = _has_business()
	if _marker.visible:
		_marker.position.y = 2.75 * float(look.get("height", 1.0)) + sin(Time.get_ticks_msec() * 0.004) * 0.08
	var speed := 0.0
	var near_player := _player != null and _player.global_position.distance_to(global_position) < 4.0
	if _talking or near_player:
		if _player:
			var to := _player.global_position - global_position
			rotation.y = lerp_angle(rotation.y, atan2(-to.x, -to.z), 1.0 - exp(-delta * 6.0))
	elif waypoints.size() > 1:
		if _wait > 0.0:
			_wait -= delta
		else:
			var target: Vector3 = waypoints[_wp_i]
			var to := target - global_position
			to.y = 0
			if to.length() < 0.4:
				_wp_i = (_wp_i + 1) % waypoints.size()
				_wait = randf_range(2.0, 5.0)
			else:
				var step := to.normalized() * walk_speed * delta
				global_position += step
				global_position.y = ElyndraLayout.height(global_position.x, global_position.z)
				rotation.y = lerp_angle(rotation.y, atan2(-to.x, -to.z), 1.0 - exp(-delta * 6.0))
				speed = 0.4
	model.animate(delta, speed)
	Game.world_positions[npc_id] = global_position
