extends Node
## Original procedural audio: every sound effect and the music loop are synthesized
## at runtime, so there are no third-party licensing concerns.

const RATE := 22050

var _cache: Dictionary = {}
var _pool: Array[AudioStreamPlayer] = []
var _music: AudioStreamPlayer
var _ambient: AudioStreamPlayer


func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	for i in 10:
		var p := AudioStreamPlayer.new()
		p.bus = "SFX"
		add_child(p)
		_pool.append(p)
	_music = AudioStreamPlayer.new()
	_music.bus = "Music"
	add_child(_music)
	_ambient = AudioStreamPlayer.new()
	_ambient.bus = "Ambient"
	add_child(_ambient)


func play(id: String, pitch: float = 1.0) -> void:
	if DisplayServer.get_name() == "headless":
		return
	var stream := _stream(id)
	if stream == null:
		return
	for p in _pool:
		if not p.playing:
			p.stream = stream
			p.pitch_scale = pitch * randf_range(0.96, 1.04)
			p.play()
			return


func play_music(id: String) -> void:
	if DisplayServer.get_name() == "headless":
		return
	var s := _stream(id)
	if _music.stream != s:
		_music.stream = s
		_music.play()


func play_ambient(id: String) -> void:
	if DisplayServer.get_name() == "headless":
		return
	var s := _stream(id)
	if _ambient.stream != s:
		_ambient.stream = s
		_ambient.play()


func stop_music() -> void:
	_music.stop()
	_ambient.stop()


func _stream(id: String) -> AudioStreamWAV:
	if _cache.has(id):
		return _cache[id]
	var s := _synth(id)
	_cache[id] = s
	return s


# ---------------------------------------------------------------- synthesis
func _synth(id: String) -> AudioStreamWAV:
	match id:
		"ui_click":   return _tone([880.0], 0.06, "sine", 0.4)
		"ui_confirm": return _arp([660.0, 990.0], 0.07, "sine", 0.35)
		"ui_back":    return _arp([660.0, 440.0], 0.07, "sine", 0.35)
		"swing":      return _noise_sweep(0.16, 2400.0, 600.0, 0.35)
		"hit":        return _hit(0.14)
		"hurt":       return _tone([180.0, 140.0], 0.2, "square", 0.3)
		"jump":       return _sweep(300.0, 620.0, 0.12, 0.25)
		"dodge":      return _noise_sweep(0.22, 900.0, 3000.0, 0.3)
		"pickup":     return _arp([784.0, 1047.0, 1319.0], 0.06, "sine", 0.35)
		"chest":      return _arp([523.0, 659.0, 784.0, 1047.0], 0.09, "triangle", 0.4)
		"heal":       return _arp([523.0, 784.0, 1047.0], 0.1, "sine", 0.3)
		"discover":   return _arp([392.0, 587.0, 784.0, 1175.0], 0.16, "triangle", 0.35)
		"quest":      return _arp([523.0, 659.0, 784.0], 0.14, "triangle", 0.4)
		"levelup":    return _arp([523.0, 659.0, 784.0, 1047.0, 1319.0], 0.1, "square", 0.25)
		"enemy_die":  return _sweep(500.0, 90.0, 0.35, 0.35)
		"telegraph":  return _tone([220.0], 0.25, "square", 0.18)
		"boss_slam":  return _hit(0.5, 60.0)
		"skill_pyra":   return _noise_sweep(0.4, 800.0, 200.0, 0.5)
		"skill_aqua":   return _noise_sweep(0.5, 400.0, 1600.0, 0.4)
		"skill_terra":  return _hit(0.45, 70.0)
		"skill_volt":   return _zap(0.3)
		"skill_zephyr": return _noise_sweep(0.35, 600.0, 4000.0, 0.4)
		"skill_crya":   return _arp([1568.0, 2093.0, 2637.0], 0.06, "sine", 0.3)
		"reaction":     return _arp([1047.0, 1568.0], 0.08, "square", 0.25)
		"music_elyndra": return _music_loop()
		"music_menu":    return _stream("music_elyndra")
		"amb_wind":      return _wind_loop()
	return null


func _make(samples: PackedFloat32Array, loop: bool = false) -> AudioStreamWAV:
	var bytes := PackedByteArray()
	bytes.resize(samples.size() * 2)
	for i in samples.size():
		bytes.encode_s16(i * 2, int(clamp(samples[i], -1.0, 1.0) * 32000.0))
	var w := AudioStreamWAV.new()
	w.format = AudioStreamWAV.FORMAT_16_BITS
	w.mix_rate = RATE
	w.stereo = false
	w.data = bytes
	if loop:
		w.loop_mode = AudioStreamWAV.LOOP_FORWARD
		w.loop_end = samples.size()
	return w


func _osc(shape: String, phase: float) -> float:
	match shape:
		"square": return 1.0 if fmod(phase, 1.0) < 0.5 else -1.0
		"triangle": return 4.0 * abs(fmod(phase, 1.0) - 0.5) - 1.0
		"saw": return 2.0 * fmod(phase, 1.0) - 1.0
	return sin(phase * TAU)


func _env(t: float, dur: float, attack: float = 0.005) -> float:
	if t < attack:
		return t / attack
	return pow(max(0.0, 1.0 - (t - attack) / max(0.001, dur - attack)), 2.0)


func _tone(freqs: Array, dur: float, shape: String, vol: float) -> AudioStreamWAV:
	var n := int(dur * RATE)
	var s := PackedFloat32Array(); s.resize(n)
	for i in n:
		var t := float(i) / RATE
		var f: float = lerp(float(freqs[0]), float(freqs[-1]), t / dur)
		s[i] = _osc(shape, f * t) * _env(t, dur) * vol
	return _make(s)


func _arp(freqs: Array, note: float, shape: String, vol: float) -> AudioStreamWAV:
	var n := int(note * freqs.size() * RATE + note * 2.0 * RATE)
	var s := PackedFloat32Array(); s.resize(n)
	for k in freqs.size():
		var start := int(k * note * RATE)
		var ln := int(note * 3.0 * RATE)
		for j in ln:
			if start + j >= n: break
			var t := float(j) / RATE
			s[start + j] += _osc(shape, freqs[k] * t) * _env(t, note * 3.0) * vol * 0.7
	return _make(s)


func _sweep(f0: float, f1: float, dur: float, vol: float) -> AudioStreamWAV:
	var n := int(dur * RATE)
	var s := PackedFloat32Array(); s.resize(n)
	var phase := 0.0
	for i in n:
		var t := float(i) / RATE
		phase += lerp(f0, f1, t / dur) / RATE
		s[i] = _osc("triangle", phase) * _env(t, dur) * vol
	return _make(s)


func _noise_sweep(dur: float, f0: float, f1: float, vol: float) -> AudioStreamWAV:
	var n := int(dur * RATE)
	var s := PackedFloat32Array(); s.resize(n)
	var lp := 0.0
	for i in n:
		var t := float(i) / RATE
		var cutoff: float = lerp(f0, f1, t / dur)
		var a: float = clamp(cutoff / RATE * TAU, 0.0, 1.0)
		lp += (randf_range(-1.0, 1.0) - lp) * a
		s[i] = lp * _env(t, dur, 0.03) * vol * 2.0
	return _make(s)


func _hit(dur: float, base: float = 110.0) -> AudioStreamWAV:
	var n := int(dur * RATE)
	var s := PackedFloat32Array(); s.resize(n)
	var phase := 0.0
	for i in n:
		var t := float(i) / RATE
		phase += (base + 300.0 * exp(-t * 30.0)) / RATE
		var body := sin(phase * TAU) * exp(-t * 12.0)
		var click := randf_range(-1.0, 1.0) * exp(-t * 60.0)
		s[i] = (body * 0.7 + click * 0.4) * 0.6
	return _make(s)


func _zap(dur: float) -> AudioStreamWAV:
	var n := int(dur * RATE)
	var s := PackedFloat32Array(); s.resize(n)
	for i in n:
		var t := float(i) / RATE
		var f := 900.0 + 600.0 * sin(t * 90.0)
		s[i] = _osc("saw", f * t) * _env(t, dur) * 0.25 * (0.6 + randf() * 0.4)
	return _make(s)


func _wind_loop() -> AudioStreamWAV:
	var dur := 6.0
	var n := int(dur * RATE)
	var s := PackedFloat32Array(); s.resize(n)
	var lp := 0.0
	for i in n:
		var t := float(i) / RATE
		var gust := 0.5 + 0.5 * sin(t / dur * TAU * 2.0) * sin(t / dur * TAU)
		lp += (randf_range(-1.0, 1.0) - lp) * (0.02 + 0.03 * gust)
		s[i] = lp * (0.25 + 0.35 * gust)
	# crossfade the loop seam
	var fade := int(0.3 * RATE)
	for i in fade:
		var k := float(i) / fade
		s[i] = s[i] * k + s[n - fade + i] * (1.0 - k)
	return _make(s, true)


## Gentle original pentatonic pad + arpeggio in D major, 4 chords x 3 s.
func _music_loop(tempo_scale: float = 1.0) -> AudioStreamWAV:
	var chord_len := 3.0 / tempo_scale
	var chords := [[146.83, 220.0, 293.66, 369.99], [123.47, 185.0, 246.94, 293.66],
		[98.0, 196.0, 246.94, 293.66], [110.0, 220.0, 277.18, 329.63]]
	var melody := [587.33, 659.25, 739.99, 880.0, 739.99, 659.25, 587.33, 493.88,
		587.33, 739.99, 880.0, 987.77, 880.0, 739.99, 659.25, 739.99]
	var dur := chord_len * chords.size()
	var n := int(dur * RATE)
	var s := PackedFloat32Array(); s.resize(n)
	for ci in chords.size():
		var start := int(ci * chord_len * RATE)
		var ln := int(chord_len * RATE)
		for j in ln:
			var t := float(j) / RATE
			var env: float = min(1.0, t / 0.6) * min(1.0, (chord_len - t) / 0.6)
			var v := 0.0
			for f in chords[ci]:
				v += sin(TAU * f * t) * 0.5 + sin(TAU * f * 2.003 * t) * 0.12
			s[start + j] += v * env * 0.05
	var note_len := dur / melody.size()
	for mi in melody.size():
		var start := int(mi * note_len * RATE)
		var ln := int(note_len * 1.8 * RATE)
		for j in ln:
			var idx := (start + j) % n
			var t := float(j) / RATE
			s[idx] += _osc("triangle", melody[mi] * t) * _env(t, note_len * 1.8, 0.02) * 0.07
	return _make(s, true)
