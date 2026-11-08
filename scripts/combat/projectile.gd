class_name Projectile
extends Node3D
## Elemental projectile. Moves straight, explodes on the first enemy, terrain or timeout.

var owner_node: Node
var element := ""
var damage := 10.0
var speed := 20.0
var radius := 2.0
var color := Color.WHITE
var direction := Vector3.FORWARD
var hostile_to_player := false
var _life := 1.6
var _done := false


func setup(from: Node, el: String, dmg: float, spd: float, r: float, c: Color, hostile: bool = false) -> void:
	owner_node = from
	element = el
	damage = dmg
	speed = spd
	radius = r
	color = c
	hostile_to_player = hostile


func _ready() -> void:
	var k := MeshKit.new()
	k.glow_color = color
	k.sphere(Vector3.ZERO, Vector3(0.45, 0.45, 0.45), color, 8, true)
	k.instance(self, "Orb")
	var trail := CPUParticles3D.new()
	trail.amount = 12
	trail.lifetime = 0.35
	trail.local_coords = false
	trail.direction = Vector3.ZERO
	trail.spread = 180.0
	trail.initial_velocity_min = 0.2
	trail.initial_velocity_max = 0.6
	trail.gravity = Vector3.ZERO
	var m := BoxMesh.new()
	m.size = Vector3.ONE * 0.12
	m.material = MeshKit.glow_mat(color)
	trail.mesh = m
	add_child(trail)


func _physics_process(delta: float) -> void:
	if _done:
		return
	_life -= delta
	var step := direction * speed * delta
	global_position += step
	if hostile_to_player:
		var p := get_tree().get_first_node_in_group("player") as Node3D
		if p and p.global_position.distance_to(global_position - Vector3(0, 1.0, 0)) < 1.0:
			p.take_hit(damage, element, owner_node)
			_explode()
			return
	else:
		for e in get_tree().get_nodes_in_group("enemy"):
			if is_instance_valid(e) and not e.is_dead() and e.global_position.distance_to(global_position - Vector3(0, 0.8, 0)) < 0.9 + e.hit_radius:
				_explode()
				return
	if global_position.y < ElyndraLayout.height(global_position.x, global_position.z) + 0.2 or _life <= 0.0:
		_explode()


func _explode() -> void:
	_done = true
	var world := get_parent()
	Effects.burst(world, global_position, color, 18, 5.0)
	if not hostile_to_player:
		Effects.ring(world, global_position - Vector3(0, 0.8, 0), color, radius)
		for e in get_tree().get_nodes_in_group("enemy"):
			if is_instance_valid(e) and not e.is_dead() and e.global_position.distance_to(global_position) <= radius + e.hit_radius + 0.8:
				e.take_hit(damage, element, owner_node)
		ElementSystem.touch_world(get_tree(), global_position, radius, element)
	queue_free()
