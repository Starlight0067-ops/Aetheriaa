class_name Checkpoint
extends Interactable
## Resonance Stone: sets respawn, restores health and saves the game.

var display_name := ""


static func create(cp_id: String, title: String) -> Checkpoint:
	var c := Checkpoint.new()
	c.id = cp_id
	c.display_name = title
	c.prompt = "Attune to Resonance Stone"
	return c


func _ready() -> void:
	super()
	add_to_group("checkpoint")
	var k := MeshKit.new()
	k.glow_color = Color("#7FF5FF")
	k.cyl(Vector3(0, 0.2, 0), 1.0, 1.2, 0.4, Color("#76839A"), 6)
	k.cyl(Vector3(0, 1.3, 0), 0.25, 0.45, 2.0, Color("#9AA7B5"), 6)
	k.box(Vector3(0, 1.4, -0.33), Vector3(0.14, 1.2, 0.05), Color("#7FF5FF"), 0.0, true)
	k.sphere(Vector3(0, 2.6, 0), Vector3(0.45, 0.6, 0.45), Color("#7FF5FF"), 6, true)
	k.instance(self, "Stone")
	var body := StaticBody3D.new()
	var cs := CollisionShape3D.new()
	var sh := CylinderShape3D.new()
	sh.radius = 0.5
	sh.height = 2.4
	cs.shape = sh
	cs.position.y = 1.2
	body.add_child(cs)
	add_child(body)
	Game.world_positions[id] = global_position


func interact(_player: Node) -> void:
	Game.respawn_point = global_position + Vector3(0, 0.5, 1.6)
	Game.heal(Game.max_hp())
	Game.discovered[id] = true
	Sfx.play("heal")
	Effects.burst(get_parent(), global_position + Vector3(0, 2.6, 0), Color("#7FF5FF"), 20)
	Game.notify("Resonance attuned: " + display_name, "save")
	SaveManager.save_game()
