@tool
extends EditorScenePostImport
## Post-import for VRoid characters (VRM 0.x imported as glTF):
## 1. VRoid ships unlit materials: switch them to toon-lit with rim light and an inverted-hull outline,
##    keeping eyes, brows and mouth unlit (anime convention).
## 2. VRoid splits meshes into dozens of surfaces sharing one material (hair: 80+). Surfaces with the same
##    material are merged so each character costs a handful of draw calls on phones.

const OUTLINE_SHADER := """
shader_type spatial;
render_mode unshaded, cull_front, shadows_disabled;
uniform vec4 tint : source_color = vec4(0.16, 0.12, 0.18, 1.0);
uniform float thickness = 0.0038;
void vertex() {
	VERTEX += NORMAL * thickness;
}
void fragment() {
	ALBEDO = tint.rgb;
}
"""

var _outline_shader: Shader
var _mat_cache := {}


func _post_import(scene: Node) -> Object:
	_outline_shader = Shader.new()
	_outline_shader.code = OUTLINE_SHADER
	for mi in scene.find_children("*", "MeshInstance3D", true, false):
		var m := mi as MeshInstance3D
		if m.mesh is ArrayMesh:
			_merge_surfaces(m)
			_restyle(m)
	return scene


func _kind(name: String) -> String:
	var n := name.to_upper()
	if n.contains("EYE") or n.ends_with("_FACE"):
		return "face"
	if n.contains("HAIR"):
		return "hair"
	if n.contains("SKIN"):
		return "skin"
	return "cloth"


func _restyle(mi: MeshInstance3D) -> void:
	var mesh := mi.mesh as ArrayMesh
	for s in mesh.get_surface_count():
		var src := mesh.surface_get_material(s) as StandardMaterial3D
		if src == null:
			continue
		var key := src.resource_name
		if not _mat_cache.has(key):
			_mat_cache[key] = _toon(src)
		mesh.surface_set_material(s, _mat_cache[key])


func _toon(src: StandardMaterial3D) -> Material:
	var m := src.duplicate() as StandardMaterial3D
	var kind := _kind(src.resource_name)
	if kind == "face":
		m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
		return m
	m.shading_mode = BaseMaterial3D.SHADING_MODE_PER_PIXEL
	m.diffuse_mode = BaseMaterial3D.DIFFUSE_TOON
	m.specular_mode = BaseMaterial3D.SPECULAR_TOON if kind == "hair" else BaseMaterial3D.SPECULAR_DISABLED
	m.roughness = 0.55 if kind == "hair" else 1.0
	m.metallic = 0.0
	m.rim_enabled = true
	m.rim = 0.45 if kind == "skin" else 0.6
	m.rim_tint = 0.75 if kind == "skin" else 0.45
	if kind == "skin":
		# soft anime skin: lift the shadow side a little so faces never go muddy
		m.emission_enabled = true
		m.emission = Color(0.12, 0.08, 0.07)
		m.emission_energy_multiplier = 1.0
	var o := ShaderMaterial.new()
	o.shader = _outline_shader
	o.set_shader_parameter("thickness", 0.0045 if kind == "hair" else 0.0035)
	m.next_pass = o
	return m


## Merge surfaces that share a material (meshes with blend shapes are left alone: the face keeps expressions).
func _merge_surfaces(mi: MeshInstance3D) -> void:
	var mesh := mi.mesh as ArrayMesh
	if mesh.get_blend_shape_count() > 0 or mesh.get_surface_count() < 2:
		return
	var groups := {}
	var order := []
	for s in mesh.get_surface_count():
		var mat := mesh.surface_get_material(s)
		var key := "%s|%d|%d" % [mat.resource_name if mat else "", mesh.surface_get_format(s) & ~Mesh.ARRAY_FLAG_COMPRESS_ATTRIBUTES, mesh.surface_get_primitive_type(s)]
		if not groups.has(key):
			groups[key] = []
			order.append(key)
		groups[key].append(s)
	if order.size() == mesh.get_surface_count():
		return
	var out := ArrayMesh.new()
	out.resource_name = mesh.resource_name
	for key in order:
		var idxs: Array = groups[key]
		var arrays := _concat(mesh, idxs)
		var flags := mesh.surface_get_format(idxs[0]) & (Mesh.ARRAY_FLAG_USE_8_BONE_WEIGHTS)
		out.add_surface_from_arrays(mesh.surface_get_primitive_type(idxs[0]), arrays, [], {}, flags)
		out.surface_set_material(out.get_surface_count() - 1, mesh.surface_get_material(idxs[0]))
	mi.mesh = out
	print("[vrm_post_import] ", mi.name, ": ", mesh.get_surface_count(), " -> ", out.get_surface_count(), " surfaces")


func _concat(mesh: ArrayMesh, idxs: Array) -> Array:
	var res := []
	res.resize(Mesh.ARRAY_MAX)
	var vcount := 0
	for s in idxs:
		var a := mesh.surface_get_arrays(s)
		var n: int = (a[Mesh.ARRAY_VERTEX] as PackedVector3Array).size()
		for t in Mesh.ARRAY_MAX:
			var v = a[t]
			if v == null:
				continue
			if t == Mesh.ARRAY_INDEX:
				var shifted := PackedInt32Array(v)
				for i in shifted.size():
					shifted[i] += vcount
				res[t] = shifted if res[t] == null else res[t] + shifted
			else:
				res[t] = v if res[t] == null else res[t] + v
		vcount += n
	return res
