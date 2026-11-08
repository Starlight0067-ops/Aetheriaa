class_name CharacterModel
extends Node3D
## Anime character built in Blender (blender/scripts/build_characters.py).
## Same interface as Humanoid: animate(), play_attack(), play_cast(), play_hurt(), talk.
## Imported materials are replaced with AETHERIA's cel-shaded anime materials.

var anim: AnimationPlayer
var talk := false
var _lock_t := 0.0
var _names: Dictionary = {}

static var _mats: Dictionary = {}


static func load_character(id: String) -> CharacterModel:
	var path := "res://assets/models/characters/%s.glb" % id
	if not ResourceLoader.exists(path):
		return null
	var cm := CharacterModel.new()
	cm.name = "Model"
	var inst: Node3D = (load(path) as PackedScene).instantiate()
	inst.rotation.y = PI          # glTF faces +Z, the game faces -Z
	cm.add_child(inst)
	cm._setup(inst)
	return cm


func _setup(inst: Node3D) -> void:
	anim = inst.find_child("AnimationPlayer", true, false) as AnimationPlayer
	for mi in inst.find_children("*", "MeshInstance3D", true, false):
		restyle(mi as MeshInstance3D)
	if anim:
		for n in anim.get_animation_list():
			var key := String(n).to_lower().get_slice("-", 0).get_slice("_", 0)
			_names[key] = n
			if key in ["idle", "walk", "run", "talk"]:
				anim.get_animation(n).loop_mode = Animation.LOOP_LINEAR
		_play("idle", 0.0)


func _play(key: String, blend: float = 0.18, speed: float = 1.0) -> void:
	if anim == null or not _names.has(key):
		return
	var n: String = _names[key]
	anim.speed_scale = speed
	if anim.current_animation != n:
		anim.play(n, blend)


func _one_shot(key: String, duration: float, speed: float = 1.0) -> void:
	if anim == null or not _names.has(key):
		return
	anim.stop()
	_play(key, 0.05, speed)
	_lock_t = duration


func animate(delta: float, speed_ratio: float, airborne: bool = false) -> void:
	if _lock_t > 0.0:
		_lock_t -= delta
		return
	if airborne:
		_play("jump", 0.12)
	elif speed_ratio > 0.62:
		_play("run", 0.18, clamp(speed_ratio * 1.25, 0.9, 1.4))
	elif speed_ratio > 0.05:
		_play("walk", 0.2, clamp(speed_ratio * 2.2, 0.7, 1.4))
	elif talk:
		_play("talk", 0.25)
	else:
		_play("idle", 0.25)


func play_attack(combo_index: int) -> void:
	_one_shot("attack", 0.34, 1.5 + combo_index * 0.15)

func play_cast() -> void:
	_one_shot("cast", 0.45, 1.3)

func play_hurt() -> void:
	_one_shot("hurt", 0.25, 1.4)


# ---------------------------------------------------------------- anime materials
static func restyle(mi: MeshInstance3D) -> void:
	if mi.mesh == null:
		return
	for i in mi.mesh.get_surface_count():
		var src := mi.mesh.surface_get_material(i)
		mi.set_surface_override_material(i, anime_material(src))


static func anime_material(src: Material) -> Material:
	var nm := src.resource_name if src else ""
	var col := Color.WHITE
	var tex: Texture2D = null
	if src is BaseMaterial3D:
		col = (src as BaseMaterial3D).albedo_color
		tex = (src as BaseMaterial3D).albedo_texture
	var key := nm + col.to_html()
	if _mats.has(key):
		return _mats[key]
	var up := nm.to_upper()
	var m := ShaderMaterial.new()
	if "EYE" in up:
		m.shader = _shader("eye")
		m.set_shader_parameter("tex", tex)
	elif "GLOW" in up:
		m.shader = _shader("glow")
		m.set_shader_parameter("albedo", col)
	else:
		m.shader = _shader("toon")
		m.set_shader_parameter("albedo", col)
		var kind := 0
		if "SKIN" in up or "NOSE" in up or "BLUSH" in up:
			kind = 1
		elif "HAIR" in up:
			kind = 2
		elif "ORN" in up or "METAL" in up:
			kind = 3
		m.set_shader_parameter("kind", kind)
		if not ("MOUTH" in up or "NOSE" in up or "BLUSH" in up):
			var o := ShaderMaterial.new()
			o.shader = _shader("outline")
			o.set_shader_parameter("albedo", col)
			m.next_pass = o
	_mats[key] = m
	return m


static func _shader(kind: String) -> Shader:
	var key := "sh_" + kind
	if _mats.has(key):
		return _mats[key]
	var s := Shader.new()
	match kind:
		"toon":
			s.code = """
shader_type spatial;
render_mode diffuse_toon, specular_toon, shadows_disabled;
uniform vec4 albedo : source_color = vec4(1.0);
uniform int kind = 0;   // 0 cloth, 1 skin, 2 hair, 3 metal/ornament
void fragment() {
	vec3 c = albedo.rgb;
	ALBEDO = c;
	ROUGHNESS = kind == 3 ? 0.3 : (kind == 2 ? 0.5 : 0.75);
	SPECULAR = kind == 3 ? 0.9 : (kind == 2 ? 0.45 : 0.2);
	METALLIC = kind == 3 ? 0.6 : 0.0;
	RIM = kind == 1 ? 0.35 : (kind == 2 ? 0.3 : 0.55);
	RIM_TINT = kind == 1 ? 0.85 : 0.45;
	if (kind == 1) {
		EMISSION = c * 0.02;   // soft anime skin: shadows stay warm and light
	}
	if (kind == 2) {
		// angel-ring sheen on the upper curve of the hair
		float band = smoothstep(0.28, 0.38, NORMAL.y) * (1.0 - smoothstep(0.46, 0.58, NORMAL.y));
		EMISSION = mix(c, vec3(1.0), 0.3) * band * 0.3;
	}
}
"""
		"outline":
			s.code = """
shader_type spatial;
render_mode unshaded, cull_front, shadows_disabled;
uniform vec4 albedo : source_color = vec4(1.0);
uniform float thickness = 0.0042;
void vertex() {
	VERTEX += NORMAL * thickness;
}
void fragment() {
	ALBEDO = albedo.rgb * 0.15 + vec3(0.01, 0.006, 0.016);
}
"""
		"eye":
			s.code = """
shader_type spatial;
render_mode unshaded, shadows_disabled;
uniform sampler2D tex : source_color, filter_linear_mipmap;
void fragment() {
	vec4 t = texture(tex, UV);
	ALBEDO = t.rgb;
	ALPHA = t.a;
	ALPHA_SCISSOR_THRESHOLD = 0.5;
}
"""
		"glow":
			s.code = """
shader_type spatial;
render_mode unshaded;
uniform vec4 albedo : source_color = vec4(1.0);
void fragment() {
	ALBEDO = albedo.rgb * 1.6;
}
"""
	_mats[key] = s
	return s
