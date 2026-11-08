class_name Interactable
extends Node3D
## Base for anything the player can press [F] on.

var id := ""
var prompt := "Interact"
var interact_radius := 2.6


func _ready() -> void:
	add_to_group("interactable")


func can_interact() -> bool:
	return true


func get_prompt() -> String:
	return prompt


func interact(_player: Node) -> void:
	pass
