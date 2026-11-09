extends SceneTree
## Rasterises icon.svg to the 1024x1024 PNG that iOS requires for the app icon.
## godot --headless --path . --script res://tools/make_icon.gd

func _init() -> void:
	var svg := FileAccess.get_file_as_bytes("res://icon.svg")
	var img := Image.new()
	var err := img.load_svg_from_buffer(svg, 8.0)   # 128 px design -> 1024 px
	if err == OK:
		img.convert(Image.FORMAT_RGB8)               # App Store icons must not have alpha
		img.save_png("res://icon_1024.png")
	print("icon_1024.png err=", err, " size=", img.get_size())
	quit()
