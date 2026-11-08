class_name StyleMats
extends RefCounted
## AETHERIA stylized shader library (anime / painterly look tuned for iGPUs).
## Every shader converts sRGB vertex colours itself and keeps per-pixel work
## to a few value-noise lookups.

static var _cache: Dictionary = {}


static func noise_tex() -> Texture2D:
	if _cache.has("noise_tex"):
		return _cache.noise_tex
	var n := FastNoiseLite.new()
	n.noise_type = FastNoiseLite.TYPE_SIMPLEX_SMOOTH
	n.frequency = 0.03
	n.fractal_octaves = 3
	var img := n.get_seamless_image(256, 256)
	img.generate_mipmaps()
	var t := ImageTexture.create_from_image(img)
	_cache.noise_tex = t
	return t

const COMMON := """
vec3 srgb2lin(vec3 c) {
	return mix(pow((c + vec3(0.055)) * (1.0 / 1.055), vec3(2.4)), c * (1.0 / 12.92), lessThan(c, vec3(0.04045)));
}
float hash21(vec2 p) {
	p = fract(p * vec2(123.34, 456.21));
	p += dot(p, p + 45.32);
	return fract(p.x * p.y);
}
float vnoise(vec2 p) {
	vec2 i = floor(p);
	vec2 f = fract(p);
	vec2 u = f * f * (3.0 - 2.0 * f);
	return mix(mix(hash21(i), hash21(i + vec2(1.0, 0.0)), u.x),
		mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), u.x), u.y);
}
"""


static func _shader(key: String, code: String) -> Shader:
	if _cache.has("sh_" + key):
		return _cache["sh_" + key]
	var s := Shader.new()
	s.code = code
	_cache["sh_" + key] = s
	return s


# ---------------------------------------------------------------- terrain
static func terrain() -> ShaderMaterial:
	if _cache.has("terrain"):
		return _cache.terrain
	var m := ShaderMaterial.new()
	m.shader = _shader("terrain", """
shader_type spatial;
render_mode diffuse_lambert_wrap, specular_disabled;
""" + COMMON + """
varying vec3 wpos;
varying vec3 wnorm;
void vertex() {
	wpos = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
	wnorm = normalize((MODEL_MATRIX * vec4(NORMAL, 0.0)).xyz);
}
uniform sampler2D noise_tex : filter_linear_mipmap, repeat_enable;
void fragment() {
	vec3 base = srgb2lin(COLOR.rgb);
	float dist = length(wpos - CAMERA_POSITION_WORLD);
	float near_fade = 1.0 - smoothstep(25.0, 70.0, dist);
	float n_big = texture(noise_tex, wpos.xz * 0.006).r;
	float n_mid = texture(noise_tex, wpos.xz * 0.045).r;
	float n_fine = texture(noise_tex, wpos.xz * 0.31).r;
	float grass = smoothstep(0.0, 0.04, base.g - base.r);
	vec3 col = base * (0.8 + 0.4 * n_big);
	col = mix(col, col * vec3(1.20, 1.14, 0.72), grass * smoothstep(0.55, 0.75, n_mid) * 0.5);
	col = mix(col, col * vec3(0.80, 0.92, 1.05), grass * smoothstep(0.42, 0.25, n_mid) * 0.3);
	col *= mix(1.0, 0.88 + 0.24 * n_fine, near_fade);
	col = mix(col, col * 0.72, (1.0 - grass) * smoothstep(0.7, 0.78, n_fine) * near_fade);
	float slope = 1.0 - wnorm.y;
	float strata = 0.85 + 0.15 * sin(wpos.y * 3.0 + n_mid * 4.0);
	vec3 rock = srgb2lin(vec3(0.58, 0.56, 0.54)) * strata * (0.85 + 0.3 * n_fine);
	col = mix(col, rock, smoothstep(0.32, 0.5, slope));
	ALBEDO = col;
	ROUGHNESS = 1.0;
}
""")
	m.set_shader_parameter("noise_tex", noise_tex())
	_cache.terrain = m
	return m


# ---------------------------------------------------------------- buildings & props
## Pattern is chosen per vertex via colour alpha (see MeshKit.alpha):
## 1.0 plain, 0.8 roof shingles, 0.6 plaster, 0.4 stone bricks, 0.2 wood planks.
static func structure() -> ShaderMaterial:
	if _cache.has("structure"):
		return _cache.structure
	var m := ShaderMaterial.new()
	m.shader = _shader("structure", """
shader_type spatial;
render_mode diffuse_toon, specular_disabled;
""" + COMMON + """
varying vec3 wpos;
varying vec3 wnorm;
void vertex() {
	wpos = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
	wnorm = normalize((MODEL_MATRIX * vec4(NORMAL, 0.0)).xyz);
}
void fragment() {
	vec3 col = srgb2lin(COLOR.rgb);
	int pat = int(round(COLOR.a * 5.0));
	vec3 n = normalize(wnorm);
	// in-plane horizontal coordinate for vertical faces
	vec2 t2 = normalize(vec2(-n.z, n.x) + vec2(0.0001));
	float u = dot(wpos.xz, t2);
	float dist = length(wpos - CAMERA_POSITION_WORLD);
	float fade = 1.0 - smoothstep(30.0, 80.0, dist);
	if (pat == 4) {            // roof shingles
		float rowf = wpos.y * 3.2;
		float row = floor(rowf);
		float along = abs(n.x) > abs(n.z) ? wpos.z : wpos.x;
		float colf = along * 2.2 + row * 0.5;
		float c = floor(colf);
		float tile = hash21(vec2(row, c));
		col *= 0.88 + 0.22 * tile;
		float edge = smoothstep(0.0, 0.16, fract(rowf));
		col *= mix(0.62, 1.0, mix(1.0, edge, fade));
		col *= mix(1.0, mix(0.8, 1.0, smoothstep(0.0, 0.08, fract(colf))), fade);
	} else if (pat == 3) {     // plaster
		float blot = vnoise(vec2(u, wpos.y) * 1.3) * 0.6 + vnoise(vec2(u, wpos.y) * 5.0) * 0.4;
		col *= 0.92 + 0.12 * blot;
		col = mix(col, col * vec3(0.86, 0.84, 0.8), smoothstep(0.7, 0.95, vnoise(vec2(u * 0.6, wpos.y * 0.25))) * 0.5);
	} else if (pat == 2) {     // stone bricks
		vec2 b = abs(n.y) > 0.7 ? wpos.xz * vec2(1.2, 2.4) : vec2(u * 1.25, wpos.y * 2.6);
		float row = floor(b.y);
		b.x += mod(row, 2.0) * 0.5;
		vec2 cell = floor(b);
		vec2 f = fract(b);
		float mortar = smoothstep(0.0, 0.07, f.x) * smoothstep(1.0, 0.93, f.x) * smoothstep(0.0, 0.1, f.y) * smoothstep(1.0, 0.9, f.y);
		col *= 0.86 + 0.24 * hash21(cell);
		col = mix(col * 0.68, col, mix(1.0, mortar, fade));
	} else if (pat == 1) {     // wood planks
		float across = abs(n.y) > 0.7 ? wpos.x : u;
		float plank = floor(across * 3.0);
		col *= 0.86 + 0.2 * hash21(vec2(plank, 3.1));
		float grain = vnoise(vec2(across * 3.0, wpos.y * 0.6 + wpos.x * 0.2) * vec2(1.0, 6.0));
		col *= 0.9 + 0.16 * grain;
		col *= mix(1.0, smoothstep(0.0, 0.08, fract(across * 3.0)) * 0.3 + 0.7, fade);
	} else {
		col *= 0.95 + 0.08 * vnoise(wpos.xz * 0.8 + wpos.y);
	}
	ALBEDO = col;
	ROUGHNESS = 0.85;
	RIM = 0.25;
	RIM_TINT = 0.5;
}
""")
	_cache.structure = m
	return m


# ---------------------------------------------------------------- characters (toon + rim + outline)
static func character() -> ShaderMaterial:
	if _cache.has("character"):
		return _cache.character
	var outline := ShaderMaterial.new()
	outline.shader = _shader("outline", """
shader_type spatial;
render_mode unshaded, cull_front, shadows_disabled;
""" + COMMON + """
uniform float thickness = 0.014;
void vertex() {
	VERTEX += NORMAL * thickness;
}
void fragment() {
	ALBEDO = srgb2lin(COLOR.rgb) * 0.18 + vec3(0.01, 0.008, 0.02);
}
""")
	var m := ShaderMaterial.new()
	m.shader = _shader("character", """
shader_type spatial;
render_mode diffuse_toon, specular_toon;
""" + COMMON + """
void fragment() {
	ALBEDO = srgb2lin(COLOR.rgb);
	ROUGHNESS = 0.55;
	SPECULAR = 0.35;
	RIM = 0.6;
	RIM_TINT = 0.35;
}
""")
	m.next_pass = outline
	_cache.character = m
	return m


# ---------------------------------------------------------------- foliage (wind sway, gradient)
## kind: "tree", "bush", "grass"
static func foliage(kind: String) -> ShaderMaterial:
	if _cache.has("foliage_" + kind):
		return _cache["foliage_" + kind]
	var m := ShaderMaterial.new()
	var cull := "cull_disabled" if kind == "grass" else "cull_back"
	m.shader = _shader("foliage_" + cull, """
shader_type spatial;
render_mode diffuse_lambert_wrap, specular_disabled, """ + cull + """;
""" + COMMON + """
uniform float sway_start = 1.5;
uniform float sway_strength = 0.06;
uniform float grad_low = 0.0;
uniform float grad_high = 6.0;
uniform float grad_dark = 0.72;
uniform float grad_bright = 1.12;
varying float local_y;
void vertex() {
	local_y = VERTEX.y;
	vec3 wp = (MODEL_MATRIX * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
	float h = max(VERTEX.y - sway_start, 0.0);
	float phase = TIME * 1.4 + wp.x * 0.21 + wp.z * 0.17;
	float gust = 0.6 + 0.4 * sin(TIME * 0.35 + wp.x * 0.02);
	VERTEX.x += sin(phase) * sway_strength * h * gust;
	VERTEX.z += cos(phase * 0.83) * sway_strength * 0.6 * h * gust;
}
void fragment() {
	vec3 c = srgb2lin(COLOR.rgb);
	float g = clamp((local_y - grad_low) / max(grad_high - grad_low, 0.001), 0.0, 1.0);
	c *= mix(grad_dark, grad_bright, g);
	c = mix(c, c * vec3(1.08, 1.12, 0.8), smoothstep(0.75, 1.0, g) * 0.4);
	ALBEDO = c;
	ROUGHNESS = 1.0;
	RIM = 0.35;
	RIM_TINT = 0.75;
}
""")
	match kind:
		"tree":
			m.set_shader_parameter("sway_start", 2.0)
			m.set_shader_parameter("sway_strength", 0.035)
			m.set_shader_parameter("grad_low", 1.8)
			m.set_shader_parameter("grad_high", 6.5)
		"bush":
			m.set_shader_parameter("sway_start", 0.2)
			m.set_shader_parameter("sway_strength", 0.08)
			m.set_shader_parameter("grad_low", 0.0)
			m.set_shader_parameter("grad_high", 1.1)
		"grass":
			m.set_shader_parameter("sway_start", 0.0)
			m.set_shader_parameter("sway_strength", 0.35)
			m.set_shader_parameter("grad_low", 0.0)
			m.set_shader_parameter("grad_high", 0.5)
			m.set_shader_parameter("grad_dark", 0.55)
			m.set_shader_parameter("grad_bright", 1.25)
	_cache["foliage_" + kind] = m
	return m


# ---------------------------------------------------------------- water (depth tint + shore foam)
static func water(height_tex: Texture2D, half_extent: float, water_y: float) -> ShaderMaterial:
	var m := ShaderMaterial.new()
	m.shader = _shader("water", """
shader_type spatial;
render_mode cull_disabled, depth_draw_always, specular_schlick_ggx;
""" + COMMON + """
uniform sampler2D height_map : filter_linear, repeat_disable;
uniform float half_extent = 120.0;
uniform float water_y = 1.0;
uniform vec4 shallow : source_color = vec4(0.38, 0.86, 0.86, 0.6);
uniform vec4 deep : source_color = vec4(0.08, 0.34, 0.66, 0.92);
uniform vec4 foam_color : source_color = vec4(0.96, 1.0, 1.0, 1.0);
varying vec3 wpos;
void vertex() {
	wpos = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
	VERTEX.y += sin(wpos.x * 0.35 + TIME * 1.1) * 0.05 + cos(wpos.z * 0.28 + TIME * 0.9) * 0.05;
}
void fragment() {
	vec2 huv = (wpos.xz + vec2(half_extent)) / (2.0 * half_extent);
	float ground = texture(height_map, huv).r;
	float depth = max(water_y - ground, 0.0);
	float d01 = smoothstep(0.0, 2.2, depth);
	vec3 col = mix(shallow.rgb, deep.rgb, d01);
	// stylized caustic ripples
	vec2 p = wpos.xz * 0.9;
	float rip = vnoise(p + vec2(TIME * 0.35, TIME * 0.2)) * vnoise(p * 1.7 - vec2(TIME * 0.25, -TIME * 0.3));
	col += vec3(0.9, 1.0, 1.0) * smoothstep(0.32, 0.5, rip) * 0.22 * (1.0 - d01 * 0.7);
	// shore foam: a solid rim plus a pulsing dashed line offshore
	float edge_noise = vnoise(wpos.xz * 1.6 + TIME * 0.4);
	float rim = 1.0 - smoothstep(0.08, 0.28 + edge_noise * 0.12, depth);
	float wave = fract(depth * 1.6 - TIME * 0.35);
	float line = smoothstep(0.0, 0.06, wave) * smoothstep(0.16, 0.08, wave) * (1.0 - smoothstep(0.3, 1.2, depth));
	line *= step(0.45, vnoise(wpos.xz * 0.8 + vec2(TIME * 0.1)));
	float foam = max(rim, line * 0.85);
	float fres = pow(1.0 - clamp(dot(NORMAL, VIEW), 0.0, 1.0), 3.0);
	ALBEDO = mix(col, foam_color.rgb, foam);
	ALPHA = clamp(mix(mix(shallow.a, deep.a, d01), 1.0, max(foam, fres * 0.6)), 0.0, 1.0);
	ROUGHNESS = mix(0.04, 0.6, foam);
	SPECULAR = 0.8;
}
""")
	m.set_shader_parameter("height_map", height_tex)
	m.set_shader_parameter("half_extent", half_extent)
	m.set_shader_parameter("water_y", water_y)
	return m


# ---------------------------------------------------------------- cloud dome
## Painterly clouds on a camera-centred dome. Custom *sky* shaders crash the
## Intel UHD Vulkan driver on the dev laptop, so clouds render as normal geometry.
static func cloud_dome_material() -> ShaderMaterial:
	var m := ShaderMaterial.new()
	m.shader = _shader("cloud_dome", """
shader_type spatial;
render_mode unshaded, cull_front, depth_draw_never, shadows_disabled, fog_disabled;
uniform sampler2D noise_tex : filter_linear_mipmap, repeat_enable;
varying vec3 dir;
void vertex() {
	dir = normalize(VERTEX);
}
void fragment() {
	float h = dir.y;
	vec2 uv = dir.xz / (max(h, 0.0) + 0.18);
	uv += vec2(TIME * 0.004, TIME * 0.0015);
	float c = texture(noise_tex, uv * 0.09).r * 0.62 + texture(noise_tex, uv * 0.23 + vec2(0.3, 0.7)).r * 0.38;
	float cover = smoothstep(0.5, 0.7, c) * smoothstep(0.03, 0.16, h);
	float shade = smoothstep(0.45, 0.85, texture(noise_tex, uv * 0.09 + vec2(0.012, 0.008)).r);
	ALBEDO = mix(vec3(1.0, 0.99, 0.96), vec3(0.74, 0.8, 0.92), shade);
	ALPHA = cover * 0.92;
}
""")
	m.set_shader_parameter("noise_tex", noise_tex())
	return m
