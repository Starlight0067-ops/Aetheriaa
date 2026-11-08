extends Node
## Player settings, input map, audio buses and graphics presets.

signal changed

const PATH := "user://settings.cfg"
const BUSES := ["Music", "Ambient", "SFX"]

var data := {
	"master": 0.8, "music": 0.6, "ambient": 0.7, "sfx": 0.8,
	"sensitivity": 0.25, "invert_y": false,
	"graphics": "low", "fullscreen": false, "show_fps": false,
}

## Presets are tuned for the Celeron N5095 / Intel UHD dev machine (low = default).
const PRESETS := {
	"low":    {"scale": 0.75, "shadows": true,  "shadow_dist": 32.0, "fog": true, "glow": false, "fxaa": false, "view": 260.0, "grass": 0.5, "msaa": 0},
	"medium": {"scale": 1.0,  "shadows": true,  "shadow_dist": 60.0, "fog": true, "glow": true,  "fxaa": true,  "view": 360.0, "grass": 0.8, "msaa": 0},
	"high":   {"scale": 1.0,  "shadows": true,  "shadow_dist": 90.0, "fog": true, "glow": true,  "fxaa": false, "view": 480.0, "grass": 1.0, "msaa": 2},
}


func _ready() -> void:
	_setup_input()
	_setup_buses()
	load_settings()
	apply()


func preset() -> Dictionary:
	return PRESETS.get(data.graphics, PRESETS.low)


func set_value(key: String, value) -> void:
	data[key] = value
	apply()
	save_settings()


func apply() -> void:
	_set_bus("Master", data.master)
	_set_bus("Music", data.music)
	_set_bus("Ambient", data.ambient)
	_set_bus("SFX", data.sfx)
	var vp := get_viewport()
	if vp:
		var p := preset()
		vp.scaling_3d_scale = p.scale
		vp.screen_space_aa = Viewport.SCREEN_SPACE_AA_FXAA if p.fxaa else Viewport.SCREEN_SPACE_AA_DISABLED
		vp.msaa_3d = Viewport.MSAA_2X if p.msaa == 2 else Viewport.MSAA_DISABLED
	if not DisplayServer.get_name() == "headless":
		var want := DisplayServer.WINDOW_MODE_FULLSCREEN if data.fullscreen else DisplayServer.WINDOW_MODE_WINDOWED
		if DisplayServer.window_get_mode() != want:
			DisplayServer.window_set_mode(want)
	changed.emit()


func _set_bus(bus_name: String, linear: float) -> void:
	var idx := AudioServer.get_bus_index(bus_name)
	if idx >= 0:
		AudioServer.set_bus_volume_db(idx, linear_to_db(max(linear, 0.0001)))
		AudioServer.set_bus_mute(idx, linear <= 0.001)


func _setup_buses() -> void:
	for b in BUSES:
		if AudioServer.get_bus_index(b) == -1:
			AudioServer.add_bus()
			var i := AudioServer.bus_count - 1
			AudioServer.set_bus_name(i, b)
			AudioServer.set_bus_send(i, "Master")


func load_settings() -> void:
	var cfg := ConfigFile.new()
	if cfg.load(PATH) != OK:
		return
	for k in data.keys():
		data[k] = cfg.get_value("settings", k, data[k])


func save_settings() -> void:
	var cfg := ConfigFile.new()
	for k in data:
		cfg.set_value("settings", k, data[k])
	cfg.save(PATH)


# ---------- input map (registered in code so it lives with the project) ----------
func _setup_input() -> void:
	_key("move_forward", [KEY_W, KEY_UP])
	_key("move_back", [KEY_S, KEY_DOWN])
	_key("move_left", [KEY_A, KEY_LEFT])
	_key("move_right", [KEY_D, KEY_RIGHT])
	_key("sprint", [KEY_SHIFT])
	_key("jump", [KEY_SPACE])
	_key("dodge", [KEY_CTRL, KEY_ALT], [MOUSE_BUTTON_RIGHT])
	_key("attack", [], [MOUSE_BUTTON_LEFT])
	_key("skill", [KEY_E])
	_key("interact", [KEY_F])
	_key("lock_on", [KEY_TAB], [MOUSE_BUTTON_MIDDLE])
	_key("inventory", [KEY_I])
	_key("journal", [KEY_J])
	_key("map", [KEY_M])
	_key("character", [KEY_C])
	_key("pause", [KEY_ESCAPE])
	_key("heal", [KEY_H])
	for i in 6:
		_key("element_%d" % (i + 1), [KEY_1 + i])
	_key("zoom_in", [], [MOUSE_BUTTON_WHEEL_UP])
	_key("zoom_out", [], [MOUSE_BUTTON_WHEEL_DOWN])
	# gamepad basics (future console/mobile-friendly mapping)
	_joy("jump", JOY_BUTTON_A)
	_joy("attack", JOY_BUTTON_X)
	_joy("dodge", JOY_BUTTON_B)
	_joy("skill", JOY_BUTTON_Y)
	_joy("interact", JOY_BUTTON_RIGHT_SHOULDER)
	_joy("pause", JOY_BUTTON_START)


func _key(action: String, keys: Array, mouse: Array = []) -> void:
	if not InputMap.has_action(action):
		InputMap.add_action(action)
	for k in keys:
		var ev := InputEventKey.new()
		ev.physical_keycode = k
		InputMap.action_add_event(action, ev)
	for m in mouse:
		var mb := InputEventMouseButton.new()
		mb.button_index = m
		InputMap.action_add_event(action, mb)


func _joy(action: String, button: int) -> void:
	var ev := InputEventJoypadButton.new()
	ev.button_index = button
	InputMap.action_add_event(action, ev)
