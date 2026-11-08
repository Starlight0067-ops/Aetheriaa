class_name Humanoid
extends Node3D
## Stylized anime-proportioned character assembled from primitives, with
## procedural animation (idle, walk/run, attack, cast, hurt, talk).
## Faces -Z (Godot forward).

var cfg: Dictionary
var torso: Node3D
var head: Node3D
var arm_l: Node3D
var arm_r: Node3D
var leg_l: Node3D
var leg_r: Node3D
var weapon: Node3D
var _phase := 0.0
var _attack_t := -1.0
var _attack_dir := 1.0
var _cast_t := -1.0
var _hurt_t := -1.0
var talk := false


static func create(c: Dictionary) -> Humanoid:
	var h := Humanoid.new()
	h.cfg = c
	h._build()
	return h


func _col(key: String, fallback: String) -> Color:
	return Color(cfg.get(key, fallback))


func _build() -> void:
	var skin := _col("skin", "#F3D2B8")
	var hair := _col("hair", "#3B2B22")
	var outfit := _col("outfit", "#3E7F8C")
	var outfit2 := _col("outfit2", "#E2B95B")
	var pants := _col("pants", "#2E2A3A")
	var boots := _col("boots", "#4A3426")
	var eye := _col("eye", "#7A4A2A")
	var s: float = cfg.get("height", 1.0)
	scale = Vector3.ONE * s

	# --- torso (pivot at hips) ---
	torso = Node3D.new(); torso.name = "Torso"; torso.position.y = 0.86; add_child(torso)
	var tk := MeshKit.character_kit()
	tk.cyl(Vector3(0, 0.28, 0), 0.17, 0.2, 0.5, outfit, 8)            # chest
	tk.box(Vector3(0, 0.04, 0), Vector3(0.36, 0.1, 0.24), outfit2)       # belt
	tk.cyl(Vector3(0, 0.54, 0), 0.06, 0.07, 0.1, skin, 6)               # neck
	match cfg.get("garment", "coat"):
		"coat":
			tk.cyl(Vector3(0, -0.2, 0.02), 0.21, 0.3, 0.42, outfit, 8)   # coat tail
			tk.box(Vector3(0, 0.3, -0.17), Vector3(0.06, 0.4, 0.02), outfit2)  # clasp line
		"dress":
			tk.cyl(Vector3(0, -0.3, 0), 0.2, 0.4, 0.62, outfit, 10)
		"robe":
			tk.cyl(Vector3(0, -0.36, 0), 0.2, 0.36, 0.76, outfit, 8)
			tk.box(Vector3(0, 0.2, -0.17), Vector3(0.12, 0.5, 0.02), outfit2)
		"apron":
			tk.box(Vector3(0, -0.05, -0.16), Vector3(0.3, 0.55, 0.03), outfit2)
	if cfg.get("cape", false):
		tk.box(Vector3(0, 0.05, 0.2), Vector3(0.42, 0.8, 0.04), outfit2)
	tk.instance(torso, "TorsoMesh")

	# --- head ---
	head = Node3D.new(); head.name = "Head"; head.position.y = 0.62; torso.add_child(head)
	var hk := MeshKit.character_kit()
	hk.sphere(Vector3(0, 0.17, 0), Vector3(0.32, 0.36, 0.32), skin, 12)
	for side in [-1.0, 1.0]:
		hk.sphere(Vector3(side * 0.07, 0.16, -0.145), Vector3(0.06, 0.085, 0.03), Color("#1C1C2A"), 8)
		hk.sphere(Vector3(side * 0.07, 0.15, -0.158), Vector3(0.035, 0.05, 0.015), eye, 6)
		hk.sphere(Vector3(side * 0.06, 0.18, -0.162), Vector3(0.015, 0.015, 0.01), Color.WHITE, 4)
	hk.box(Vector3(0, 0.07, -0.155), Vector3(0.05, 0.008, 0.01), Color("#9C5A4A"))
	_add_hair(hk, hair)
	if cfg.has("hat"):
		var hat := Color(cfg.hat)
		hk.cyl(Vector3(0, 0.36, 0), 0.0, 0.24, 0.3, hat, 8)
		hk.cyl(Vector3(0, 0.25, 0), 0.34, 0.34, 0.03, hat, 12)
	hk.instance(head, "HeadMesh")

	# --- arms (pivot at shoulder) ---
	arm_l = _limb(Vector3(-0.24, 0.48, 0), outfit, skin, 0.5, 0.065, true)
	arm_r = _limb(Vector3(0.24, 0.48, 0), outfit, skin, 0.5, 0.065, true)
	torso.add_child(arm_l); torso.add_child(arm_r)
	# --- legs (pivot at hip) ---
	leg_l = _limb(Vector3(-0.1, 0.86, 0), pants, boots, 0.84, 0.08, false)
	leg_r = _limb(Vector3(0.1, 0.86, 0), pants, boots, 0.84, 0.08, false)
	add_child(leg_l); add_child(leg_r)

	if cfg.get("weapon", false):
		weapon = Node3D.new(); weapon.name = "Weapon"
		var wk := MeshKit.character_kit()
		wk.box(Vector3(0, -0.02, 0), Vector3(0.04, 0.16, 0.04), Color("#4A3426"))
		wk.box(Vector3(0, 0.07, 0), Vector3(0.16, 0.03, 0.05), Color("#C08A3E"))
		wk.box(Vector3(0, 0.45, 0), Vector3(0.05, 0.72, 0.015), Color("#DDE8F2"))
		wk.box(Vector3(0, 0.45, 0), Vector3(0.012, 0.66, 0.02), Color("#7FF5FF"), 0.0, true)
		wk.instance(weapon, "BladeMesh")
		weapon.position = Vector3(0, -0.5, -0.04)
		weapon.rotation.x = -PI / 2.0
		arm_r.add_child(weapon)


func _add_hair(k: MeshKit, hair: Color) -> void:
	var style: String = cfg.get("hair_style", "short")
	if style == "bald":
		return
	k.sphere(Vector3(0, 0.22, 0.02), Vector3(0.35, 0.33, 0.35), hair, 10)
	match style:
		"spiky":
			for i in 7:
				var a := -PI * 0.5 + i * PI / 6.0
				var dir := Vector3(sin(a) * 0.8, 0.35, cos(a) * 0.8 + 0.2).normalized()
				var b := Basis(Vector3.UP.cross(dir).normalized(), Vector3.UP.angle_to(dir)) if dir != Vector3.UP else Basis()
				k.cyl(Vector3(0, 0.28, 0.03) + dir * 0.15, 0.0, 0.07, 0.24, hair, 5, b)
			k.box(Vector3(0, 0.27, -0.15), Vector3(0.28, 0.08, 0.05), hair)   # fringe
		"long":
			k.box(Vector3(0, 0.0, 0.1), Vector3(0.34, 0.5, 0.14), hair)
			k.box(Vector3(0, 0.27, -0.15), Vector3(0.28, 0.08, 0.05), hair)
		"ponytail":
			k.sphere(Vector3(0, 0.25, 0.2), Vector3(0.12, 0.12, 0.12), hair, 6)
			k.cyl(Vector3(0, 0.05, 0.25), 0.07, 0.03, 0.4, hair, 6)
			k.box(Vector3(0, 0.27, -0.15), Vector3(0.28, 0.08, 0.05), hair)
		"bun":
			k.sphere(Vector3(0, 0.42, 0.06), Vector3(0.16, 0.14, 0.16), hair, 8)
		"messy":
			for i in 5:
				k.sphere(Vector3((i - 2) * 0.07, 0.34, -0.06 + (i % 2) * 0.05), Vector3(0.12, 0.1, 0.12), hair, 6)


func _limb(pivot: Vector3, upper: Color, lower: Color, length: float, r: float, is_arm: bool) -> Node3D:
	var n := Node3D.new()
	n.position = pivot
	var k := MeshKit.character_kit()
	k.cyl(Vector3(0, -length * 0.3, 0), r, r * 0.9, length * 0.6, upper, 6)
	if is_arm:
		k.sphere(Vector3(0, -length * 0.82, 0), Vector3(r * 1.6, r * 1.8, r * 1.6), lower, 6)
		k.cyl(Vector3(0, -length * 0.68, 0), r * 0.75, r * 0.8, length * 0.3, lower, 6)
	else:
		k.cyl(Vector3(0, -length * 0.78, 0), r * 0.95, r * 1.05, length * 0.36, lower, 6)
		k.box(Vector3(0, -length + 0.04, -0.05), Vector3(r * 2.2, 0.08, r * 3.4), lower)
	k.instance(n, "LimbMesh")
	return n


# ---------------------------------------------------------------- animation
func play_attack(combo_index: int) -> void:
	_attack_t = 0.0
	_attack_dir = 1.0 if combo_index % 2 == 0 else -1.0

func play_cast() -> void:
	_cast_t = 0.0

func play_hurt() -> void:
	_hurt_t = 0.0


## speed_ratio: 0 idle, 0.5 walk, 1 run. airborne bends legs.
func animate(delta: float, speed_ratio: float, airborne: bool = false) -> void:
	var t := Time.get_ticks_msec() / 1000.0
	_phase += delta * lerp(4.0, 11.0, speed_ratio) * (1.0 if speed_ratio > 0.05 else 0.0)
	var swing: float = sin(_phase) * lerp(0.0, 0.9, speed_ratio)
	var bob: float = abs(cos(_phase)) * 0.05 * speed_ratio
	torso.position.y = 0.86 + bob + sin(t * 2.0) * 0.008
	torso.rotation.x = -0.12 * speed_ratio
	leg_l.rotation.x = swing
	leg_r.rotation.x = -swing
	arm_l.rotation.x = -swing * 0.8
	arm_r.rotation.x = swing * 0.8
	arm_l.rotation.z = -0.12
	arm_r.rotation.z = 0.12
	head.rotation.x = 0.0
	if airborne:
		leg_l.rotation.x = -0.6
		leg_r.rotation.x = 0.3
		arm_l.rotation.z = -0.7
		arm_r.rotation.z = 0.7
	if talk:
		head.rotation.x = sin(t * 7.0) * 0.06
		arm_r.rotation.x = -0.4 + sin(t * 3.0) * 0.2
	if _attack_t >= 0.0:
		_attack_t += delta
		var p: float = clamp(_attack_t / 0.32, 0.0, 1.0)
		var e := sin(p * PI)
		arm_r.rotation.x = -1.6 * e - 0.3
		arm_r.rotation.z = (0.2 + 1.2 * (p - 0.5)) * _attack_dir
		torso.rotation.y = 0.5 * (p - 0.5) * _attack_dir
		if _attack_t > 0.36:
			_attack_t = -1.0
			torso.rotation.y = 0.0
	if _cast_t >= 0.0:
		_cast_t += delta
		var c: float = sin(clamp(_cast_t / 0.45, 0.0, 1.0) * PI)
		arm_l.rotation.x = -1.5 * c
		arm_r.rotation.x = -1.5 * c
		if _cast_t > 0.45:
			_cast_t = -1.0
	if _hurt_t >= 0.0:
		_hurt_t += delta
		torso.rotation.x = 0.35 * sin(clamp(_hurt_t / 0.3, 0.0, 1.0) * PI)
		if _hurt_t > 0.3:
			_hurt_t = -1.0
