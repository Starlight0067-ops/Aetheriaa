class_name CameraRig
extends Node3D
## Third-person orbit camera: mouse look, smoothing, wheel zoom, SpringArm
## collision so it never clips through buildings or terrain, optional lock-on.

var target: Node3D
var yaw := 0.0
var pitch := -0.25
var distance := 5.5
var min_distance := 2.2
var max_distance := 9.0
var height := 1.55
var lock_target: Node3D
var arm: SpringArm3D
var camera: Camera3D
var _shake := 0.0


func _ready() -> void:
	top_level = true
	arm = SpringArm3D.new()
	arm.spring_length = distance
	arm.margin = 0.25
	arm.collision_mask = 1 | 8
	var probe := SphereShape3D.new()
	probe.radius = 0.25
	arm.shape = probe
	add_child(arm)
	camera = Camera3D.new()
	camera.fov = 70.0
	camera.near = 0.1
	camera.far = Settings.preset().view
	camera.current = true
	arm.add_child(camera)
	Settings.changed.connect(func(): camera.far = Settings.preset().view)


func setup(t: Node3D) -> void:
	target = t
	if t is CollisionObject3D:
		arm.add_excluded_object(t.get_rid())
	global_position = t.global_position + Vector3(0, height, 0)
	yaw = t.rotation.y


func _unhandled_input(event: InputEvent) -> void:
	if Game.is_ui_open():
		return
	if event is InputEventMouseMotion and Input.mouse_mode == Input.MOUSE_MODE_CAPTURED:
		var s: float = Settings.data.sensitivity * 0.01
		yaw -= event.relative.x * s
		var inv := -1.0 if Settings.data.invert_y else 1.0
		pitch = clamp(pitch - event.relative.y * s * inv, -1.25, 0.6)
	elif event.is_action_pressed("zoom_in"):
		distance = max(min_distance, distance - 0.6)
	elif event.is_action_pressed("zoom_out"):
		distance = min(max_distance, distance + 0.6)


## Touch camera drag (pixels of finger movement).
func add_look(d: Vector2) -> void:
	var s: float = Settings.data.sensitivity * 0.009
	yaw -= d.x * s
	var inv := -1.0 if Settings.data.invert_y else 1.0
	pitch = clamp(pitch - d.y * s * inv, -1.25, 0.6)


func shake(amount: float) -> void:
	_shake = max(_shake, amount)


func _process(delta: float) -> void:
	if target == null:
		return
	# gamepad right stick
	var look := Vector2(Input.get_joy_axis(0, JOY_AXIS_RIGHT_X), Input.get_joy_axis(0, JOY_AXIS_RIGHT_Y))
	if look.length() > 0.15 and not Game.is_ui_open():
		yaw -= look.x * delta * 2.5
		pitch = clamp(pitch - look.y * delta * 2.0, -1.25, 0.6)
	if lock_target != null and is_instance_valid(lock_target):
		var to := lock_target.global_position - target.global_position
		var want := atan2(-to.x, -to.z)
		yaw = lerp_angle(yaw, want, 1.0 - exp(-delta * 6.0))
		pitch = lerp(pitch, -0.3, 1.0 - exp(-delta * 4.0))
	var goal := target.global_position + Vector3(0, height, 0)
	global_position = global_position.lerp(goal, 1.0 - exp(-delta * 14.0))
	rotation = Vector3(pitch, yaw, 0)
	arm.spring_length = lerp(arm.spring_length, distance, 1.0 - exp(-delta * 8.0))
	if _shake > 0.0:
		_shake = max(0.0, _shake - delta * 2.5)
		camera.h_offset = randf_range(-1, 1) * _shake * 0.3
		camera.v_offset = randf_range(-1, 1) * _shake * 0.3
	else:
		camera.h_offset = 0.0
		camera.v_offset = 0.0


func forward_flat() -> Vector3:
	return Vector3(-sin(yaw), 0, -cos(yaw))


func right_flat() -> Vector3:
	return Vector3(cos(yaw), 0, -sin(yaw))
