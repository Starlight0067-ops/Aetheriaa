class_name SettingsPanel
extends RefCounted
## Builds the settings controls (audio buses, controls, graphics). Shared by
## the main menu and the in-game menu. Every control writes through Settings.


static func build() -> Control:
	var vb := VBoxContainer.new()
	vb.add_theme_constant_override("separation", 10)
	vb.add_child(UITheme.title("Audio", 22))
	for pair in [["master", "Master"], ["music", "Music"], ["ambient", "Environment"], ["sfx", "Effects"]]:
		vb.add_child(_slider(pair[1], pair[0], 0.0, 1.0, 0.05))
	vb.add_child(UITheme.title("Controls", 22))
	vb.add_child(_slider("Mouse sensitivity", "sensitivity", 0.05, 0.8, 0.01))
	vb.add_child(_check("Invert camera Y", "invert_y"))
	vb.add_child(UITheme.title("Graphics", 22))
	var row := HBoxContainer.new()
	var l := UITheme.label("Quality preset", 18)
	l.custom_minimum_size = Vector2(220, 0)
	row.add_child(l)
	var opt := OptionButton.new()
	for p in ["low", "medium", "high"]:
		opt.add_item(p.capitalize())
	opt.selected = ["low", "medium", "high"].find(Settings.data.graphics)
	opt.item_selected.connect(func(i):
		Settings.set_value("graphics", ["low", "medium", "high"][i])
		Sfx.play("ui_confirm"))
	row.add_child(opt)
	vb.add_child(row)
	vb.add_child(UITheme.label("Low is recommended for integrated graphics. Some changes apply on next area load.", 14, UITheme.MUTED))
	vb.add_child(_check("Fullscreen", "fullscreen"))
	vb.add_child(_check("Show FPS", "show_fps"))
	return vb


static func _slider(text: String, key: String, lo: float, hi: float, step: float) -> Control:
	var row := HBoxContainer.new()
	var l := UITheme.label(text, 18)
	l.custom_minimum_size = Vector2(220, 0)
	row.add_child(l)
	var s := HSlider.new()
	s.min_value = lo
	s.max_value = hi
	s.step = step
	s.value = float(Settings.data[key])
	s.custom_minimum_size = Vector2(260, 24)
	var val := UITheme.label("%d%%" % int(s.value / hi * 100.0), 16, UITheme.MUTED)
	val.custom_minimum_size = Vector2(60, 0)
	s.value_changed.connect(func(v):
		val.text = "%d%%" % int(v / hi * 100.0)
		Settings.set_value(key, v))
	s.drag_ended.connect(func(_c): Sfx.play("ui_click"))
	row.add_child(s)
	row.add_child(val)
	return row


static func _check(text: String, key: String) -> Control:
	var c := CheckButton.new()
	c.text = text
	c.button_pressed = bool(Settings.data[key])
	c.add_theme_font_size_override("font_size", 18)
	c.toggled.connect(func(on):
		Settings.set_value(key, on)
		Sfx.play("ui_click"))
	return c
