class_name Enemy
extends CharacterBody3D
## Reusable data-driven enemy: patrol -> detect -> chase -> telegraphed attack,
## element auras/reactions, stun/slow, defeat rewards. Stats come from data/enemies.

enum State { PATROL, CHASE, WINDUP, RECOVER, STUNNED, DEAD }

var type_id := "bramble_wisp"
var def: Dictionary
var hp := 10.0
var max_hp := 10.0
var state := State.PATROL
var home := Vector3.ZERO
var hit_radius := 0.6
var aura := ""
var aura_time := 0.0
var model: Node3D
var _patrol_target := Vector3.ZERO
var _timer := 0.0
var _stun := 0.0
var _slow := 0.0
var _flash := 0.0
var _player: Node3D
var _hp_bar: Label3D
var _aura_mark: MeshInstance3D
var _bob := 0.0
const GRAVITY := 20.0


static func create(t: String) -> Enemy:
	var e := Enemy.new()
	e.type_id = t
	return e


func _ready() -> void:
	def = DB.enemies.get(type_id, {})
	max_hp = float(def.get("hp", 40))
	hp = max_hp
	add_to_group("enemy")
	collision_layer = 4
	collision_mask = 1
	home = global_position
	_patrol_target = home
	var s: float = def.get("scale", 1.0)
	hit_radius = 0.5 * s
	var cs := CollisionShape3D.new()
	var cap := CapsuleShape3D.new()
	cap.radius = 0.45 * s
	cap.height = 1.4 * s
	cs.shape = cap
	cs.position.y = 0.7 * s
	add_child(cs)
	model = _build_model(s)
	add_child(model)
	_hp_bar = Label3D.new()
	_hp_bar.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	_hp_bar.no_depth_test = true
	_hp_bar.pixel_size = 0.004
	_hp_bar.font_size = 40
	_hp_bar.outline_size = 8
	_hp_bar.position.y = 2.0 * s + 0.3
	_hp_bar.visible = false
	add_child(_hp_bar)
	_aura_mark = MeshInstance3D.new()
	var sm := SphereMesh.new()
	sm.radius = 0.12
	sm.height = 0.24
	sm.radial_segments = 6
	sm.rings = 3
	_aura_mark.mesh = sm
	_aura_mark.position.y = 2.0 * s + 0.65
	_aura_mark.visible = false
	add_child(_aura_mark)


func _build_model(s: float) -> Node3D:
	var root := Node3D.new()
	var c := Color(def.get("color", "#7BC86C"))
	var a := Color(def.get("accent", "#E9F59A"))
	var k := MeshKit.new()
	k.glow_color = a
	match def.get("shape", "wisp"):
		"wisp":
			k.sphere(Vector3(0, 1.0, 0), Vector3(0.9, 0.9, 0.9), c, 8)
			for i in 6:
				var ang := i * TAU / 6.0
				var dir := Vector3(cos(ang), 0.3, sin(ang)).normalized()
				k.cyl(Vector3(0, 1.0, 0) + dir * 0.5, 0.0, 0.12, 0.5, c.darkened(0.25), 4,
					Basis(Vector3.UP.cross(dir).normalized(), Vector3.UP.angle_to(dir)))
			k.sphere(Vector3(-0.17, 1.1, -0.38), Vector3(0.16, 0.2, 0.08), a, 6, true)
			k.sphere(Vector3(0.17, 1.1, -0.38), Vector3(0.16, 0.2, 0.08), a, 6, true)
			k.cyl(Vector3(0, 0.4, 0), 0.15, 0.0, 0.5, c.darkened(0.3), 5)
		"brute":
			k.cyl(Vector3(0, 0.95, 0), 0.5, 0.65, 1.2, c, 7)
			k.sphere(Vector3(0, 1.75, -0.05), Vector3(0.75, 0.6, 0.7), c.lightened(0.1), 7)
			k.sphere(Vector3(0, 2.0, 0), Vector3(0.9, 0.35, 0.8), a, 6)   # mossy crown
			for side in [-1.0, 1.0]:
				k.cyl(Vector3(side * 0.75, 1.0, -0.1), 0.18, 0.28, 1.2, c.darkened(0.15), 6)
				k.sphere(Vector3(side * 0.78, 0.35, -0.15), Vector3(0.45, 0.4, 0.45), c.darkened(0.25), 6)
				k.cyl(Vector3(side * 0.28, 0.25, 0), 0.2, 0.25, 0.5, c.darkened(0.3), 6)
			k.sphere(Vector3(-0.2, 1.8, -0.38), Vector3(0.12, 0.08, 0.06), a, 5, true)
			k.sphere(Vector3(0.2, 1.8, -0.38), Vector3(0.12, 0.08, 0.06), a, 5, true)
	k.instance(root, "Body")
	root.scale = Vector3.ONE * (s if def.get("shape") != "brute" else s * 0.8)
	return root


func is_dead() -> bool:
	return state == State.DEAD


func _physics_process(delta: float) -> void:
	if state == State.DEAD:
		return
	if _player == null:
		_player = get_tree().get_first_node_in_group("player") as Node3D
		return
	aura_time = max(0.0, aura_time - delta)
	if aura_time <= 0.0:
		aura = ""
	_aura_mark.visible = aura != ""
	if aura != "":
		_aura_mark.material_override = MeshKit.glow_mat(DB.element_color(aura))
	_slow = max(0.0, _slow - delta)
	var speed: float = def.get("speed", 3.0) * (0.45 if _slow > 0.0 else 1.0)
	var to_player := _player.global_position - global_position
	var dist := Vector2(to_player.x, to_player.z).length()
	var move := Vector3.ZERO
	_timer -= delta

	match state:
		State.PATROL:
			if dist < float(def.get("detect", 12.0)) and abs(to_player.y) < 6.0:
				state = State.CHASE
			else:
				var to_t := _patrol_target - global_position
				to_t.y = 0
				if to_t.length() < 0.8 or _timer <= 0.0:
					_patrol_target = home + Vector3(randf_range(-6, 6), 0, randf_range(-6, 6))
					_timer = randf_range(3.0, 6.0)
				move = to_t.normalized() * speed * 0.4
		State.CHASE:
			if dist > float(def.get("detect", 12.0)) * 1.8 or home.distance_to(global_position) > 40.0:
				state = State.PATROL
				_patrol_target = home
			elif dist <= float(def.get("attack_range", 2.0)):
				state = State.WINDUP
				_timer = float(def.get("windup", 0.6))
				Sfx.play("telegraph")
			else:
				move = Vector3(to_player.x, 0, to_player.z).normalized() * speed
		State.WINDUP:
			_flash = 1.0
			model.scale = model.scale.lerp(Vector3.ONE * float(def.get("scale", 1.0)) * 1.18, delta * 6.0)
			if _timer <= 0.0:
				_strike(dist)
				state = State.RECOVER
				_timer = float(def.get("cooldown", 1.5))
		State.RECOVER:
			model.scale = model.scale.lerp(Vector3.ONE * _base_scale(), delta * 8.0)
			if _timer <= 0.0:
				state = State.CHASE
		State.STUNNED:
			_stun -= delta
			if _stun <= 0.0:
				state = State.CHASE

	if move.length() > 0.1:
		var want := atan2(-move.x, -move.z)
		rotation.y = lerp_angle(rotation.y, want, 1.0 - exp(-delta * 8.0))
	elif state in [State.WINDUP, State.CHASE]:
		rotation.y = lerp_angle(rotation.y, atan2(-to_player.x, -to_player.z), 1.0 - exp(-delta * 10.0))
	velocity.x = lerp(velocity.x, move.x, 1.0 - exp(-delta * 8.0))
	velocity.z = lerp(velocity.z, move.z, 1.0 - exp(-delta * 8.0))
	if not is_on_floor():
		velocity.y -= GRAVITY * delta
	move_and_slide()
	_bob += delta * 3.0
	if def.get("shape") == "wisp":
		model.position.y = sin(_bob) * 0.12
	_flash = max(0.0, _flash - delta * 4.0)
	_hp_bar.visible = hp < max_hp
	if _hp_bar.visible:
		var n := int(round(10.0 * hp / max_hp))
		_hp_bar.text = "█".repeat(n) + "░".repeat(10 - n)
		_hp_bar.modulate = Color("#FF6A5A") if state != State.STUNNED else Color("#A8E6FF")


func _base_scale() -> float:
	var s: float = def.get("scale", 1.0)
	return s if def.get("shape") != "brute" else s * 0.8


func _strike(dist: float) -> void:
	Effects.ring(get_parent(), global_position + Vector3(0, 0.2, 0), Color(def.get("accent", "#ffffff")), float(def.attack_range))
	if dist <= float(def.get("attack_range", 2.0)) + 0.6:
		_player.take_hit(float(def.get("atk", 8)), "", self)


func take_hit(amount: float, element: String, source: Node) -> void:
	if state == State.DEAD:
		return
	var res := ElementSystem.resolve(self, element, amount)
	var dmg: float = max(1.0, res.damage - float(def.get("def", 0)))
	hp -= dmg
	var col := DB.element_color(element) if element != "" else Color.WHITE
	Effects.damage_number(get_parent(), global_position + Vector3(0, 1.8 * _base_scale(), 0), dmg, col)
	Effects.burst(get_parent(), global_position + Vector3(0, 1.0, 0), col, 8, 3.0)
	if state in [State.PATROL]:
		state = State.CHASE
	# knockback
	if source is Node3D:
		var push: Vector3 = (global_position - source.global_position)
		push.y = 0
		var kb := float(res.reaction.get("knockback", 3.0)) if not res.reaction.is_empty() else 3.0
		velocity += push.normalized() * kb
	if hp <= 0.0:
		_die()


func apply_status(r: Dictionary) -> void:
	if r.has("stun"):
		_stun = float(r.stun)
		state = State.STUNNED
	if r.has("slow"):
		_slow = float(r.slow)


func _die() -> void:
	state = State.DEAD
	remove_from_group("enemy")
	collision_layer = 0
	Sfx.play("enemy_die")
	Effects.burst(get_parent(), global_position + Vector3(0, 1, 0), Color(def.get("color", "#ffffff")), 24, 5.0)
	Game.add_xp(int(def.get("xp", 10)))
	Effects.damage_number(get_parent(), global_position + Vector3(0, 2.2, 0), float(def.get("xp", 10)), Color("#E2B95B"), "XP +")
	var drops: Dictionary = def.get("drops", {})
	for item in drops:
		if randf() < float(drops[item]):
			Inventory.add(item, randi_range(1, 3) if item == "copper_coin" else 1)
	Quests.notify_event("kill", type_id)
	var tw := create_tween()
	tw.tween_property(model, "scale", Vector3.ONE * 0.01, 0.35)
	tw.tween_callback(queue_free)
