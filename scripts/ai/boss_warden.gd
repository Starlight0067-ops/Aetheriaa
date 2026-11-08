class_name BossWarden
extends Enemy
## The Hollow Warden: Choir guardian construct. Three telegraphed patterns:
##  - Slam: red disc under the player, then an AoE.
##  - Sweep: glowing arm wind-up, then a wide frontal arc.
##  - Shard Volley (phase 2, below 50%): slow crystal projectiles.

var arena_center := Vector3.ZERO
var active := false
var phase := 1
var _pattern_i := 0
var _pending := ""
var _slam_pos := Vector3.ZERO
var _arm_l: Node3D
var _arm_r: Node3D
var _core: Node3D


static func create_boss(center: Vector3) -> BossWarden:
	var b := BossWarden.new()
	b.type_id = "hollow_warden"
	b.arena_center = center
	return b


func _ready() -> void:
	super()
	hit_radius = 1.6
	if Game.has_flag("warden_defeated"):
		queue_free()
		return
	remove_from_group("enemy")   # untargetable until awakened
	_hp_bar.visible = false


func _build_model(_s: float) -> Node3D:
	var root := Node3D.new()
	var stone := Color("#8E9AA8")
	var dark := Color("#6A7686")
	var glow := Color("#5FE3E0")
	var k := MeshKit.character_kit()
	k.glow_color = glow
	k.cyl(Vector3(0, 0.8, 0), 0.9, 1.2, 1.6, dark, 6)                    # base
	k.cyl(Vector3(0, 2.6, 0), 1.5, 1.0, 2.2, stone, 6)                   # torso
	k.box(Vector3(0, 3.9, 0), Vector3(2.8, 0.6, 1.6), dark)              # shoulders
	k.cyl(Vector3(0, 4.7, 0), 0.0, 0.8, 1.4, stone, 6)                   # crested head
	k.box(Vector3(0, 4.45, -0.55), Vector3(0.9, 0.16, 0.1), glow, 0.0, true)   # visor
	for i in 6:
		var a := i * TAU / 6.0
		k.box(Vector3(cos(a) * 1.25, 2.6, sin(a) * 1.25), Vector3(0.1, 1.6, 0.35), glow, -a, true)
	k.instance(root, "Body")
	_core = Node3D.new()
	_core.position = Vector3(0, 2.7, -1.05)
	root.add_child(_core)
	var ck := MeshKit.character_kit()
	ck.glow_color = Color("#7FF5FF")
	ck.sphere(Vector3.ZERO, Vector3(0.6, 0.75, 0.4), Color("#7FF5FF"), 8, true)
	ck.instance(_core, "Heart")
	_arm_l = _arm(root, -1.0, stone, dark, glow)
	_arm_r = _arm(root, 1.0, stone, dark, glow)
	return root


func _arm(root: Node3D, side: float, stone: Color, dark: Color, glow: Color) -> Node3D:
	var pivot := Node3D.new()
	pivot.position = Vector3(side * 1.7, 3.9, 0)
	root.add_child(pivot)
	var k := MeshKit.character_kit()
	k.glow_color = glow
	k.cyl(Vector3(0, -1.0, 0), 0.35, 0.45, 2.0, stone, 6)
	k.box(Vector3(0, -2.4, 0), Vector3(1.1, 1.1, 1.1), dark)
	k.box(Vector3(0, -2.4, -0.56), Vector3(0.5, 0.5, 0.05), glow, 0.0, true)
	k.instance(pivot, "Arm")
	return pivot


func awaken() -> void:
	if active or state == State.DEAD:
		return
	active = true
	add_to_group("enemy")
	Game.banner.emit("THE HOLLOW WARDEN", "Keeper of the Sealed Choir")
	Sfx.play("boss_slam")
	Sfx.play("telegraph")
	_timer = 2.0
	state = State.RECOVER
	Game.boss_bar.emit(def.name, 1.0, true)


func _physics_process(delta: float) -> void:
	if state == State.DEAD:
		return
	if _player == null:
		_player = get_tree().get_first_node_in_group("player") as Node3D
		return
	_core.rotation.y += delta * 2.0
	if not active:
		model.position.y = sin(Time.get_ticks_msec() * 0.001) * 0.05
		return
	aura_time = max(0.0, aura_time - delta)
	if aura_time <= 0.0:
		aura = ""
	_aura_mark.visible = aura != ""
	if aura != "":
		_aura_mark.material_override = MeshKit.glow_mat(DB.element_color(aura))
	_slow = max(0.0, _slow - delta)
	var to_player := _player.global_position - global_position
	var dist := Vector2(to_player.x, to_player.z).length()
	_timer -= delta
	var move := Vector3.ZERO

	match state:
		State.STUNNED:
			_stun -= delta
			_arm_l.rotation.x = lerp(_arm_l.rotation.x, 0.6, delta * 4.0)
			_arm_r.rotation.x = lerp(_arm_r.rotation.x, 0.6, delta * 4.0)
			if _stun <= 0.0:
				state = State.RECOVER
				_timer = 0.6
		State.RECOVER, State.CHASE, State.PATROL:
			_arm_l.rotation.x = lerp(_arm_l.rotation.x, 0.0, delta * 4.0)
			_arm_r.rotation.x = lerp(_arm_r.rotation.x, 0.0, delta * 4.0)
			_arm_r.rotation.y = lerp(_arm_r.rotation.y, 0.0, delta * 4.0)
			if dist > 4.0:
				move = Vector3(to_player.x, 0, to_player.z).normalized() * float(def.speed) * (0.5 if _slow > 0.0 else 1.0)
			if _timer <= 0.0:
				_start_pattern(dist)
		State.WINDUP:
			match _pending:
				"slam":
					_arm_l.rotation.x = lerp(_arm_l.rotation.x, -2.6, delta * 3.0)
					_arm_r.rotation.x = lerp(_arm_r.rotation.x, -2.6, delta * 3.0)
				"sweep":
					_arm_r.rotation.y = lerp(_arm_r.rotation.y, 1.4, delta * 3.0)
					_arm_r.rotation.x = lerp(_arm_r.rotation.x, -1.5, delta * 3.0)
				"volley":
					_core.scale = _core.scale.lerp(Vector3.ONE * 1.6, delta * 3.0)
			if _timer <= 0.0:
				_execute_pattern()
				state = State.RECOVER
				_timer = float(def.cooldown) * (0.7 if phase == 2 else 1.0)

	if state != State.WINDUP or _pending != "slam":
		var want := atan2(-to_player.x, -to_player.z)
		rotation.y = lerp_angle(rotation.y, want, 1.0 - exp(-delta * (2.5 if state == State.WINDUP else 4.0)))
	velocity.x = move.x
	velocity.z = move.z
	if not is_on_floor():
		velocity.y -= GRAVITY * delta
	move_and_slide()
	# keep inside arena
	var off := global_position - arena_center
	off.y = 0
	if off.length() > 11.0:
		global_position -= off.normalized() * (off.length() - 11.0)
	# leash: reset if the player leaves the arena
	if _player.global_position.distance_to(arena_center) > 28.0:
		_reset_fight()


func _start_pattern(dist: float) -> void:
	var options := ["slam", "sweep"] if dist < 7.0 else ["slam", "slam"]
	if phase == 2:
		options.append("volley")
	_pending = options[_pattern_i % options.size()]
	_pattern_i += 1
	state = State.WINDUP
	Sfx.play("telegraph")
	match _pending:
		"slam":
			_slam_pos = _player.global_position
			_timer = 1.3
			Effects.telegraph(get_parent(), _slam_pos, 4.2, 1.3)
		"sweep":
			_timer = 1.0
			Effects.telegraph(get_parent(), global_position + (-global_transform.basis.z) * 3.0, 5.0, 1.0, Color(1, 0.6, 0.2, 0.4))
		"volley":
			_timer = 1.1


func _execute_pattern() -> void:
	var world := get_parent()
	match _pending:
		"slam":
			Sfx.play("boss_slam")
			Effects.ring(world, _slam_pos + Vector3(0, 0.2, 0), Color("#FF6A5A"), 4.2)
			Effects.burst(world, _slam_pos, Color("#9AA7B5"), 20, 6.0)
			_player.get("rig").shake(0.8)
			if _player.global_position.distance_to(_slam_pos) < 4.4:
				_player.take_hit(float(def.atk) * 1.2, "", self)
		"sweep":
			Sfx.play("swing", 0.6)
			Effects.ring(world, global_position + Vector3(0, 0.3, 0), Color("#FFB347"), 6.5)
			var to := _player.global_position - global_position
			to.y = 0
			if to.length() < 6.8 and (-global_transform.basis.z).dot(to.normalized()) > -0.1:
				_player.take_hit(float(def.atk), "", self)
		"volley":
			_core.scale = Vector3.ONE
			for i in 5:
				var p := Projectile.new()
				var ang := (i - 2) * 0.32
				var dir := (-global_transform.basis.z).rotated(Vector3.UP, ang)
				p.setup(self, "crya", float(def.atk) * 0.7, 9.0, 1.0, Color("#A8E6FF"), true)
				world.add_child(p)
				p.global_position = global_position + Vector3(0, 1.4, 0) + dir * 1.5
				p.direction = dir
	_pending = ""


func take_hit(amount: float, element: String, source: Node) -> void:
	if not active:
		return
	super(amount, element, source)
	if state != State.DEAD:
		state = State.RECOVER if state == State.PATROL else state
		Game.boss_bar.emit(def.name, hp / max_hp, true)
		if phase == 1 and hp < max_hp * 0.5:
			phase = 2
			Game.banner.emit("THE WARDEN'S HEART BLAZES", "")
			Sfx.play("boss_slam")


func _strike(_dist: float) -> void:
	pass


func _reset_fight() -> void:
	active = false
	remove_from_group("enemy")
	hp = max_hp
	phase = 1
	state = State.RECOVER
	global_position = arena_center
	Game.boss_bar.emit("", 0.0, false)


func _die() -> void:
	Game.boss_bar.emit("", 0.0, false)
	Game.set_flag("warden_defeated")
	Inventory.add("warden_core", 1)
	super()
	Game.banner.emit("GUARDIAN STILLED", "The Hollow Warden kneels, its long watch ended.")
	Sfx.play("quest")
