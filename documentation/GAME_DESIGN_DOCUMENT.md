# AETHERIA — Game Design Document (v0.1)

## Pillars
1. **Discovery.** Every glance at the horizon should show something worth walking to.
2. **Resonance.** Elements form a shared language for combat, puzzles and exploration.
3. **A world that remembers.** Chests, discoveries, NPC states and quests persist.
4. **Runs on modest hardware.** Stylized beats expensive.

## Core loop
Explore → discover (landmark, chest, resource) → talk or take a quest → fight or solve → reward (XP, items, story) → unlock a new area or ability → explore.

## Controls (PC)
| Action | Key |
|---|---|
| Move | WASD |
| Camera | Mouse |
| Sprint | Shift |
| Jump | Space |
| Dodge | Ctrl / right mouse |
| Attack | Left mouse |
| Elemental skill | E |
| Switch element | 1 to 6 (unlocked elements only) |
| Interact | F |
| Lock-on | Middle mouse / Tab |
| Inventory | I |
| Quest journal | J |
| Map | M |
| Pause | Esc |

## Systems summary
* **Player.** Third-person controller with acceleration, sprint (uses stamina), jump with coyote time, dodge with i-frames.
* **Combat.** A 3-hit light combo, an elemental skill per element (data-driven, with cooldown), stamina-gated dodge, soft lock-on.
* **Elements.** `data/elements/elements.json` defines colors, the status each element applies, and pairwise **reactions** (for example Aqua + Crya = Frozen). Any attack carrying an element applies an *aura* to the target. A second element triggers a reaction lookup. Nothing is hardcoded per character.
* **Stats.** Level, XP, max HP, ATK and DEF. XP curve: `50 * level^1.5`.
* **Inventory.** Item database in JSON (`data/items/items.json`), stackable, organized by category.
* **Quests.** Data-driven (`data/quests/quests.json`). Objectives: `talk`, `collect`, `kill`, `reach` and `interact`. Quest states: inactive, active, complete.
* **Dialogue.** JSON graph (`data/dialogue/*.json`) with nodes, choices, conditions (flags or quest state) and actions (set flag, give quest, give item).
* **Save.** JSON in `user://saves/slot_1.json`, versioned. Autosaves at checkpoints and after quest completion.

## Elyndra v1 content target
* Vael Harrow (plaza, 8+ distinct buildings, tavern, shop, town hall, bridge).
* Whisperwood (start area), Silverfall and Lake Mirelle, the Choir Steps ruins, and the Hollow Sanctum arena.
* 4 NPCs with dialogue, 1 main quest chain plus 2 side quests.
* 2 enemy types (Bramble Wisp, Rootling Brute) and 1 boss (Hollow Warden).
* 10 chests, 20 collectibles ("Echo Shards"), 3 resource types (Sunpetal, Riverstone, Glowcap).
