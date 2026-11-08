class_name Player
extends CharacterBody3D
## Kael: third-person controller with sprint, jump (coyote + buffer), dodge
## (i-frames), 3-hit combo, data-driven elemental skills, lock-on and interaction.

const WALK_SPEED := 4.2
const RUN_SPEED := 6.4
const SPRINT_SPEED := 9.0
const ACCEL := 14.0
const AIR_ACCEL := 4.0
const JUMP_VELOCITY := 7.2
const GRAVITY := 20.0
const DODGE_SPEED := 13.0
const DODGE_TIME := 0.28
const DODGE_COST := 22.0
const SPRINT_COST := 14.0
const STAMINA_REGEN := 26.0
const COMBO := [1.0, 1.1, 1.6]

var rig: CameraRig
var model   # CharacterModel (Blender anime model) or Humanoid fallback
var interact_target: Interactable
var lock_target: Node3D
var cooldowns: Dictionary = {}

var _coyote := 0.0
var _jump_buffer := 0.0
var _dodge_t := 0.0
var _dodge_dir := Vector3.ZERO
var _invuln := 0.0
var _attack_t := 0.0
var _combo_i := 0
var _combo_window := 0.0
var _attack_hit_pending := false
var _was_airborne := false
var _stamina_lock := false
var _dead := false
var _footstep := 0.0


func _ready() -> void:
	add_to_group("player")
	collision_layer = 2
	collision_mask = 1
	floor_snap_length = 0.4
	floor_max_angle = deg_to_rad(50)
	var cs := CollisionShape3D.new()
	var cap := CapsuleShape3D.new()
	cap.radius = 0.35
	cap.height = 1.7
	cs.shape = cap
	cs.position.y = 0.85
	add_child(cs)
	model = CharacterModel.load_character("kael")
	if model == null:
		model = _fallback_model()
	add_child(model)
	if model is Humanoid:
		var pk := MeshKit.new()
		pk.glow_color = Color("#7FF5FF")
		pk.sphere(Vector3(0, 0.36, -0.2), Vector3(0.07, 0.09, 0.04), Color("#7FF5FF"), 6, true)
		pk.instance(model.torso, "Pendant")
	rig = CameraRig.new()
	rig.name = "CameraRig"
	add_child(rig)
	rig.setup(self)


func _fallback_model() -> Humanoid:
	var h := Humanoid.create({
		"skin": "#F6D9C4", "hair": "#DCE3EA", "hair_style": "spiky", "eye": "#E2A13A",
		"outfit": "#2F7F8A", "outfit2": "#C98A3E", "pants": "#2A2F45", "boots": "#5A3B2A",
		"garment": "coat", "weapon": true,
	})
	h.name = "Model"
	return h


func _unhandled_input(event: InputEvent) -> void:
	if Game.is_ui_open() or _dead:
		return
	if event.is_action_pressed("jump"):
		_jump_buffer = 0.15
	elif event.is_action_pressed("attack"):
		_try_attack()
	elif event.is_action_pressed("dodge"):
		_try_dodge()
	elif event.is_action_pressed("skill"):
		_try_skill()
	elif event.is_action_pressed("interact") and interact_target != null:
		interact_target.interact(self)
	elif event.is_action_pressed("lock_on"):
		_toggle_lock()
	elif event.is_action_pressed("heal"):
		for id in ["healing_tonic", "honey_bread"]:
			if Inventory.count(id) > 0:
				Inventory.use(id)
				break
	else:
		for i in 6:
			if event.is_action_pressed("element_%d" % (i + 1)):
				var el: String = DB.ELEMENT_ORDER[i]
				if el in Game.unlocked_elements:
					Game.set_element(el)
					Sfx.play("ui_click", 1.2)
				else:
					Game.notify("You cannot hear that Resonance yet.")


func _physics_process(delta: float) -> void:
	if _dead:
		return
	for k in cooldowns.keys():
		cooldowns[k] = max(0.0, cooldowns[k] - delta)
	_invuln = max(0.0, _invuln - delta)
	_combo_window = max(0.0, _combo_window - delta)
	_jump_buffer = max(0.0, _jump_buffer - delta)

	var input_dir := Vector2.ZERO
	if not Game.is_ui_open():
		input_dir = Input.get_vector("move_left", "move_right", "move_forward", "move_back")
		var joy := Vector2(Input.get_joy_axis(0, JOY_AXIS_LEFT_X), Input.get_joy_axis(0, JOY_AXIS_LEFT_Y))
		if joy.length() > 0.2:
			input_dir = joy
	var move := (rig.right_flat() * input_dir.x - rig.forward_flat() * input_dir.y)
	if move.length() > 1.0:
		move = move.normalized()

	var sprinting := Input.is_action_pressed("sprint") and move.length() > 0.1 and not _stamina_lock and not Game.is_ui_open()
	var target_speed := RUN_SPEED * move.length()
	if sprinting:
		target_speed = SPRINT_SPEED
		Game.stamina = max(0.0, Game.stamina - SPRINT_COST * delta)
		if Game.stamina <= 0.0:
			_stamina_lock = true
	else:
		Game.stamina = min(Game.max_stamina, Game.stamina + STAMINA_REGEN * delta)
		if _stamina_lock and Game.stamina > 30.0:
			_stamina_lock = false

	# gravity / ground
	if is_on_floor():
		_coyote = 0.12
	else:
		_coyote -= delta
		velocity.y -= GRAVITY * delta
	if _jump_buffer > 0.0 and _coyote > 0.0 and _dodge_t <= 0.0:
		velocity.y = JUMP_VELOCITY
		_jump_buffer = 0.0
		_coyote = 0.0
		Sfx.play("jump")

	var horizontal := Vector3(velocity.x, 0, velocity.z)
	if _dodge_t > 0.0:
		_dodge_t -= delta
		horizontal = _dodge_dir * DODGE_SPEED * (0.4 + 0.6 * (_dodge_t / DODGE_TIME))
	elif _attack_t > 0.0:
		_attack_t -= delta
		horizontal = horizontal.lerp(Vector3.ZERO, 1.0 - exp(-delta * 12.0))
		if _attack_hit_pending and _attack_t < 0.22:
			_attack_hit_pending = false
			_resolve_melee()
	else:
		var accel := ACCEL if is_on_floor() else AIR_ACCEL
		horizontal = horizontal.lerp(move * target_speed, 1.0 - exp(-delta * accel))
	velocity.x = horizontal.x
	velocity.z = horizontal.z

	# facing
	var face_dir := Vector3.ZERO
	if lock_target and is_instance_valid(lock_target) and (_attack_t > 0.0 or move.length() < 0.1):
		face_dir = (lock_target.global_position - global_position)
	elif horizontal.length() > 0.5:
		face_dir = horizontal
	if face_dir.length() > 0.01:
		var want := atan2(-face_dir.x, -face_dir.z)
		rotation.y = lerp_angle(rotation.y, want, 1.0 - exp(-delta * 14.0))

	move_and_slide()

	var airborne := not is_on_floor()
	if _was_airborne and not airborne and velocity.y <= 0.0:
		Effects.burst(get_parent(), global_position, Color("#D9C99A"), 6, 2.0)
	_was_airborne = airborne
	var spd := Vector2(velocity.x, velocity.z).length()
	model.animate(delta, clamp(spd / SPRINT_SPEED, 0.0, 1.0), airborne and abs(velocity.y) > 2.0)
	if _dodge_t > 0.0:
		model.rotation.x = -TAU * (1.0 - _dodge_t / DODGE_TIME)
	else:
		model.rotation.x = 0.0
	if is_on_floor() and spd > 1.0:
		_footstep -= delta * spd
		if _footstep <= 0.0:
			_footstep = 2.6
			Sfx.play("ui_click", 0.35)

	if global_position.y < -25.0:
		respawn()
	_update_interact_target()
	_validate_lock()


# ---------------------------------------------------------------- combat
func _try_attack() -> void:
	if _attack_t > 0.0 or _dodge_t > 0.0:
		return
	_combo_i = (_combo_i + 1) % COMBO.size() if _combo_window > 0.0 else 0
	_attack_t = 0.38
	_combo_window = 0.75
	_attack_hit_pending = true
	model.play_attack(_combo_i)
	Sfx.play("swing", 1.0 + _combo_i * 0.08)
	# small lunge
	var fwd := -global_transform.basis.z
	velocity.x = fwd.x * 3.0
	velocity.z = fwd.z * 3.0


func _resolve_melee() -> void:
	var fwd := -global_transform.basis.z
	var hit_any := false
	for e in get_tree().get_nodes_in_group("enemy"):
		if not is_instance_valid(e) or e.is_dead():
			continue
		var to: Vector3 = e.global_position - global_position
		var reach: float = 2.4 + e.hit_radius
		if to.length() < reach and fwd.dot(to.normalized()) > 0.25:
			e.take_hit(Game.atk() * COMBO[_combo_i], "", self)
			hit_any = true
	if hit_any:
		rig.shake(0.25 if _combo_i < 2 else 0.5)
		Sfx.play("hit")


func _try_dodge() -> void:
	if _dodge_t > 0.0 or Game.stamina < DODGE_COST:
		return
	Game.stamina -= DODGE_COST
	var input_dir := Input.get_vector("move_left", "move_right", "move_forward", "move_back")
	var dir := (rig.right_flat() * input_dir.x - rig.forward_flat() * input_dir.y)
	if dir.length() < 0.1:
		dir = global_transform.basis.z   # backstep
	_dodge_dir = dir.normalized()
	_dodge_t = DODGE_TIME
	_invuln = DODGE_TIME + 0.08
	_attack_t = 0.0
	Sfx.play("dodge")


func _try_skill() -> void:
	var el := Game.current_element
	var def: Dictionary = DB.elements.get(el, {}).get("skill", {})
	if def.is_empty() or cooldowns.get(el, 0.0) > 0.0 or _dodge_t > 0.0:
		return
	cooldowns[el] = float(def.cooldown)
	model.play_cast()
	var color := DB.element_color(el)
	var dmg := Game.atk() * float(def.damage)
	Sfx.play("skill_" + el)
	var world := get_parent()
	var fwd := -global_transform.basis.z
	if lock_target and is_instance_valid(lock_target):
		fwd = (lock_target.global_position - global_position)
		fwd.y = 0
		fwd = fwd.normalized()
		rotation.y = atan2(-fwd.x, -fwd.z)
	match def.type:
		"aoe":
			var r := float(def.radius)
			Effects.ring(world, global_position + Vector3(0, 0.2, 0), color, r)
			Effects.burst(world, global_position + Vector3(0, 1, 0), color, 24, 6.0)
			_damage_area(global_position, r, dmg, el)
			ElementSystem.touch_world(get_tree(), global_position, r, el)
			rig.shake(0.3)
		"projectile":
			var p := Projectile.new()
			p.setup(self, el, dmg, float(def.speed), float(def.radius), color)
			world.add_child(p)
			p.global_position = global_position + Vector3(0, 1.2, 0) + fwd * 0.8
			p.direction = fwd
		"dash":
			_dodge_dir = fwd
			_dodge_t = DODGE_TIME * 1.3
			_invuln = 0.45
			var start := global_position
			Effects.burst(world, start + Vector3(0, 1, 0), color, 20, 5.0)
			get_tree().create_timer(0.3).timeout.connect(func():
				if not is_inside_tree(): return
				Effects.ring(world, global_position + Vector3(0, 0.2, 0), color, float(def.radius) * 1.5)
				_damage_line(start, global_position, float(def.radius), dmg, el)
				ElementSystem.touch_world(get_tree(), global_position, float(def.radius), el))


func _damage_area(center: Vector3, radius: float, dmg: float, el: String) -> void:
	for e in get_tree().get_nodes_in_group("enemy"):
		if is_instance_valid(e) and not e.is_dead() and e.global_position.distance_to(center) <= radius + e.hit_radius:
			e.take_hit(dmg, el, self)


func _damage_line(a: Vector3, b: Vector3, radius: float, dmg: float, el: String) -> void:
	for e in get_tree().get_nodes_in_group("enemy"):
		if not is_instance_valid(e) or e.is_dead():
			continue
		var p := Vector2(e.global_position.x, e.global_position.z)
		var d := ElyndraLayout.dist_to_segment(p, Vector2(a.x, a.z), Vector2(b.x, b.z))
		if d <= radius + e.hit_radius:
			e.take_hit(dmg, el, self)


func take_hit(amount: float, _element: String, _source: Node) -> void:
	if _invuln > 0.0 or _dead:
		return
	var dmg: float = max(1.0, amount - Game.def() * 0.5)
	Game.damage(dmg)
	_invuln = 0.5
	model.play_hurt()
	rig.shake(0.5)
	Sfx.play("hurt")
	Effects.damage_number(get_parent(), global_position + Vector3(0, 2.0, 0), dmg, Color("#FF5A5A"))
	if Game.hp <= 0.0:
		_die()


func _die() -> void:
	_dead = true
	Game.banner.emit("YOU HAVE FALLEN", "The Resonance pulls you back...")
	get_tree().create_timer(2.5).timeout.connect(respawn)


func respawn() -> void:
	_dead = false
	velocity = Vector3.ZERO
	global_position = Game.respawn_point + Vector3(0, 0.5, 0)
	Game.hp = Game.max_hp()
	Game.stamina = Game.max_stamina
	Game.stats_changed.emit()
	rig.global_position = global_position + Vector3(0, rig.height, 0)


func is_invulnerable() -> bool:
	return _invuln > 0.0


# ---------------------------------------------------------------- targeting & interaction
func _toggle_lock() -> void:
	if lock_target:
		lock_target = null
		rig.lock_target = null
		return
	var best: Node3D = null
	var best_score := INF
	var fwd := rig.forward_flat()
	for e in get_tree().get_nodes_in_group("enemy"):
		if not is_instance_valid(e) or e.is_dead():
			continue
		var to: Vector3 = e.global_position - global_position
		var d := to.length()
		if d > 22.0:
			continue
		var score := d * (2.0 - fwd.dot(to.normalized()))
		if score < best_score:
			best_score = score
			best = e
	lock_target = best
	rig.lock_target = best


func _validate_lock() -> void:
	if lock_target and (not is_instance_valid(lock_target) or lock_target.is_dead() or lock_target.global_position.distance_to(global_position) > 28.0):
		lock_target = null
		rig.lock_target = null


func _update_interact_target() -> void:
	var best: Interactable = null
	var best_d := INF
	for n in get_tree().get_nodes_in_group("interactable"):
		var it := n as Interactable
		if it == null or not it.can_interact():
			continue
		var d := it.global_position.distance_to(global_position)
		if d < it.interact_radius and d < best_d:
			best_d = d
			best = it
	interact_target = best
