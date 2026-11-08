extends Control
## Title screen: animated 3D background (the Elyndra Core above a sea of clouds),
## New Game / Continue / Settings / Credits / Exit, and a loading screen.

var _panel: Control
var _sub: PanelContainer
var _pivot: Node3D
var _loading: ColorRect


func _ready() -> void:
	theme = UITheme.get_theme()
	set_anchors_preset(Control.PRESET_FULL_RECT)
	Input.mouse_mode = Input.MOUSE_MODE_VISIBLE
	get_tree().paused = false
	_build_background()
	_build_ui()
	Sfx.play_music("music_menu")


func _build_background() -> void:
	var svc := SubViewportContainer.new()
	svc.set_anchors_preset(Control.PRESET_FULL_RECT)
	svc.stretch = true
	svc.stretch_shrink = 2      # render the backdrop at half resolution
	add_child(svc)
	var vp := SubViewport.new()
	vp.own_world_3d = true
	svc.add_child(vp)
	var env := WorldEnvironment.new()
	var e := Environment.new()
	e.background_mode = Environment.BG_SKY
	var sky := Sky.new()
	var sm := ProceduralSkyMaterial.new()
	sm.sky_top_color = Color("#1B2A5A")
	sm.sky_horizon_color = Color("#F2B48A")
	sm.ground_horizon_color = Color("#F2B48A")
	sm.ground_bottom_color = Color("#2A2F55")
	sky.sky_material = sm
	e.sky = sky
	e.ambient_light_source = Environment.AMBIENT_SOURCE_SKY
	e.tonemap_mode = Environment.TONE_MAPPER_FILMIC
	e.glow_enabled = true
	e.glow_intensity = 0.9
	e.fog_enabled = true
	e.fog_light_color = Color("#F2C9A8")
	e.fog_density = 0.008
	env.environment = e
	vp.add_child(env)
	var sun := DirectionalLight3D.new()
	sun.rotation = Vector3(-0.25, 2.4, 0)
	sun.light_color = Color("#FFD9B0")
	vp.add_child(sun)
	_pivot = Node3D.new()
	vp.add_child(_pivot)
	var core := StructureBuilder.build_core(_pivot)
	core.position = Vector3(0, -20, 0)
	# cloud sea
	var k := MeshKit.new()
	var rng := RandomNumberGenerator.new()
	rng.seed = 7
	for i in 70:
		var a := rng.randf() * TAU
		var r := rng.randf_range(14.0, 90.0)
		var s := rng.randf_range(6.0, 16.0)
		k.sphere(Vector3(cos(a) * r, -14.0 + rng.randf_range(-2, 2), sin(a) * r), Vector3(s, s * 0.35, s), Color("#F7E7E0"), 8)
	k.instance(_pivot, "Clouds")
	var cam := Camera3D.new()
	cam.position = Vector3(0, 8, 42)
	cam.rotation.x = -0.05
	cam.fov = 60
	vp.add_child(cam)


func _build_ui() -> void:
	var grad := TextureRect.new()
	var g := Gradient.new()
	g.colors = PackedColorArray([Color(0.02, 0.03, 0.08, 0.85), Color(0.02, 0.03, 0.08, 0.0)])
	var gt := GradientTexture2D.new()
	gt.gradient = g
	gt.fill_from = Vector2(0, 0.5)
	gt.fill_to = Vector2(0.6, 0.5)
	grad.texture = gt
	grad.set_anchors_preset(Control.PRESET_FULL_RECT)
	grad.stretch_mode = TextureRect.STRETCH_SCALE
	grad.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(grad)

	_panel = VBoxContainer.new()
	_panel.position = Vector2(80, 110)
	_panel.add_theme_constant_override("separation", 12)
	add_child(_panel)
	var logo := UITheme.title("AETHERIA", 84, Color("#E9FDFF"))
	logo.add_theme_color_override("font_outline_color", Color("#1B6A8A"))
	logo.add_theme_constant_override("outline_size", 10)
	_panel.add_child(logo)
	_panel.add_child(UITheme.title("The Great Silence", 26, UITheme.BRASS))
	var gap := Control.new()
	gap.custom_minimum_size = Vector2(0, 30)
	_panel.add_child(gap)
	var cont := UITheme.button("Continue", _continue)
	cont.disabled = not SaveManager.has_save()
	_panel.add_child(cont)
	if SaveManager.has_save():
		_panel.add_child(UITheme.label(SaveManager.save_info(), 14, UITheme.MUTED))
	_panel.add_child(UITheme.button("New Game", _new_game))
	_panel.add_child(UITheme.button("Settings", func(): _show_sub("settings")))
	_panel.add_child(UITheme.button("Credits", func(): _show_sub("credits")))
	_panel.add_child(UITheme.button("Exit", func(): get_tree().quit()))
	var ver := UITheme.label("v%s · Early development build" % ProjectSettings.get_setting("application/config/version"), 13, UITheme.MUTED)
	ver.set_anchors_preset(Control.PRESET_BOTTOM_LEFT)
	ver.position = Vector2(20, -30)
	add_child(ver)

	_sub = PanelContainer.new()
	_sub.set_anchors_preset(Control.PRESET_CENTER_RIGHT)
	_sub.position = Vector2(-640, -300)
	_sub.custom_minimum_size = Vector2(580, 600)
	_sub.visible = false
	add_child(_sub)

	_loading = ColorRect.new()
	_loading.color = Color("#070B16")
	_loading.set_anchors_preset(Control.PRESET_FULL_RECT)
	_loading.visible = false
	add_child(_loading)
	var lv := VBoxContainer.new()
	lv.set_anchors_preset(Control.PRESET_CENTER)
	lv.position = Vector2(-300, -60)
	lv.custom_minimum_size = Vector2(600, 0)
	_loading.add_child(lv)
	var lt := UITheme.title("Elyndra", 48, UITheme.TEXT)
	lt.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	lv.add_child(lt)
	var tip := UITheme.label("Tip: Hit an enemy with two different elements to trigger a reaction.", 16, UITheme.MUTED)
	tip.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	lv.add_child(tip)
	var ld := UITheme.label("Listening to the Resonance...", 18, UITheme.AETHER)
	ld.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	lv.add_child(ld)


func _show_sub(kind: String) -> void:
	for c in _sub.get_children():
		c.queue_free()
	if _sub.visible and _sub.get_meta("kind", "") == kind:
		_sub.visible = false
		return
	_sub.set_meta("kind", kind)
	var scroll := ScrollContainer.new()
	var vb := VBoxContainer.new()
	vb.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	scroll.add_child(vb)
	if kind == "settings":
		vb.add_child(UITheme.title("Settings", 32))
		vb.add_child(SettingsPanel.build())
	else:
		vb.add_child(UITheme.title("Credits", 32))
		for line in ["AETHERIA, an original fantasy action RPG",
				"Design, code, world, models, music & sound: produced procedurally for this project",
				"Engine: Godot 4.7 (MIT License), godotengine.org",
				"3D pipeline: Blender 5.2 (GPL; produced assets are project-owned)",
				"All characters, places, dialogue and audio are original.",
				"Thank you for playing."]:
			vb.add_child(UITheme.label(line, 17))
	vb.add_child(UITheme.button("Close", func(): _sub.visible = false, 160))
	_sub.add_child(scroll)
	_sub.visible = true


func _new_game() -> void:
	SaveManager.new_game()
	_start()


func _continue() -> void:
	if SaveManager.load_game():
		_start()
	else:
		Game.notify("Could not read the save file.", "error")


func _start() -> void:
	_loading.visible = true
	Sfx.stop_music()
	# let the loading screen draw before the (synchronous) world build
	await get_tree().process_frame
	await get_tree().process_frame
	get_tree().change_scene_to_file(SaveManager.WORLD_SCENE)


func _process(delta: float) -> void:
	if _pivot:
		_pivot.rotation.y += delta * 0.05
		var core := _pivot.get_node_or_null("ElyndraCore")
		if core:
			for i in 3:
				var r := core.get_node_or_null("Ring%d" % i)
				if r:
					r.rotation.y += delta * (0.3 + i * 0.15)
