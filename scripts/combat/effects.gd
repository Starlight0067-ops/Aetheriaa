class_name Effects
extends RefCounted
## Lightweight, pooled-by-lifetime visual effects (CPU particles + simple meshes).
## Particle counts are kept small for the integrated GPU.


static func burst(parent: Node, pos: Vector3, color: Color, amount: int = 16, speed: float = 4.0) -> void:
	if parent == null or not parent.is_inside_tree():
		return
	var p := CPUParticles3D.new()
	p.one_shot = true
	p.emitting = true
	p.amount = amount
	p.lifetime = 0.6
	p.explosiveness = 0.95
	p.direction = Vector3.UP
	p.spread = 180.0
	p.initial_velocity_min = speed * 0.5
	p.initial_velocity_max = speed
	p.gravity = Vector3(0, -6, 0)
	p.scale_amount_min = 0.6
	p.scale_amount_max = 1.2
	var m := BoxMesh.new()
	m.size = Vector3.ONE * 0.12
	m.material = MeshKit.glow_mat(color)
	p.mesh = m
	parent.add_child(p)
	p.global_position = pos
	p.get_tree().create_timer(1.2).timeout.connect(p.queue_free)


## Expanding glowing ring on the ground (AoE skills, reactions, boss slams).
static func ring(parent: Node, pos: Vector3, color: Color, radius: float, duration: float = 0.45) -> void:
	if parent == null or not parent.is_inside_tree():
		return
	var mi := MeshInstance3D.new()
	var t := TorusMesh.new()
	t.inner_radius = 0.85
	t.outer_radius = 1.0
	t.rings = 24
	t.ring_segments = 4
	mi.mesh = t
	var mat := MeshKit.flat(color, true, true)
	mi.material_override = mat
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	parent.add_child(mi)
	mi.global_position = pos
	mi.scale = Vector3(0.3, 0.3, 0.3)
	var tw := mi.create_tween().set_parallel(true)
	tw.tween_property(mi, "scale", Vector3(radius, 1.0, radius), duration).set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_OUT)
	tw.tween_property(mat, "albedo_color:a", 0.0, duration)
	tw.chain().tween_callback(mi.queue_free)


## Flat warning disc used for enemy telegraphs; returns the node so the caller can free it.
static func telegraph(parent: Node, pos: Vector3, radius: float, duration: float, color: Color = Color(1, 0.25, 0.2, 0.45)) -> MeshInstance3D:
	var mi := MeshInstance3D.new()
	var c := CylinderMesh.new()
	c.top_radius = 1.0
	c.bottom_radius = 1.0
	c.height = 0.05
	c.radial_segments = 24
	mi.mesh = c
	var mat := MeshKit.flat(color, true, true)
	mi.material_override = mat
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	parent.add_child(mi)
	mi.global_position = pos + Vector3(0, 0.08, 0)
	mi.scale = Vector3(0.1, 1, 0.1)
	var tw := mi.create_tween()
	tw.tween_property(mi, "scale", Vector3(radius, 1, radius), duration * 0.8)
	tw.tween_property(mat, "albedo_color:a", 0.8, duration * 0.2)
	tw.tween_callback(mi.queue_free)
	return mi


static func damage_number(parent: Node, pos: Vector3, amount: float, color: Color = Color.WHITE, label: String = "") -> void:
	if parent == null or not parent.is_inside_tree():
		return
	var l := Label3D.new()
	l.text = label if amount <= 0.0 else ((label + " " if label != "" else "") + str(int(round(amount))))
	l.modulate = color
	l.outline_modulate = Color(0, 0, 0, 0.8)
	l.font_size = 48 if label == "" else 56
	l.outline_size = 10
	l.pixel_size = 0.006
	l.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	l.no_depth_test = true
	parent.add_child(l)
	l.global_position = pos + Vector3(randf_range(-0.3, 0.3), 0, randf_range(-0.3, 0.3))
	var tw := l.create_tween().set_parallel(true)
	tw.tween_property(l, "global_position", l.global_position + Vector3(0, 1.2, 0), 0.8)
	tw.tween_property(l, "modulate:a", 0.0, 0.8).set_delay(0.3)
	tw.chain().tween_callback(l.queue_free)
