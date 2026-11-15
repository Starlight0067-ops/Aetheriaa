// Game data ported (compactly) from the Godot version: data/elements, enemies, items, quests, dialogue.
export const ELEMENT_ORDER = ['pyra', 'aqua', 'terra', 'volt', 'zephyr', 'crya'];
export const ELEMENTS = {
  pyra:   { name: 'Pyra',   domain: 'Fire',      color: '#FF6A3D', status: 'Burning', skill: { name: 'Ember Lance', type: 'projectile', damage: 1.6, speed: 22, radius: 2.5, cooldown: 4.0, cost: 20 } },
  aqua:   { name: 'Aqua',   domain: 'Water',     color: '#3DA9FF', status: 'Soaked',  skill: { name: 'Tidal Ring',  type: 'aoe',        damage: 1.2, radius: 4.5, cooldown: 6.0, cost: 22 } },
  terra:  { name: 'Terra',  domain: 'Earth',     color: '#C79A4B', status: 'Rooted',  skill: { name: 'Stonebreak',  type: 'aoe',        damage: 2.2, radius: 3.5, cooldown: 8.0, cost: 28 } },
  volt:   { name: 'Volt',   domain: 'Lightning', color: '#B46BFF', status: 'Charged', skill: { name: 'Arc Spear',   type: 'projectile', damage: 1.4, speed: 36, radius: 1.5, cooldown: 3.5, cost: 18 } },
  zephyr: { name: 'Zephyr', domain: 'Wind',      color: '#5FE8B0', status: 'Lifted',  skill: { name: 'Gale Step',   type: 'dash',       damage: 1.0, radius: 2.0, distance: 9, cooldown: 5.0, cost: 15 } },
  crya:   { name: 'Crya',   domain: 'Ice',       color: '#A8E6FF', status: 'Chilled', skill: { name: 'Frost Bloom', type: 'aoe',        damage: 1.1, radius: 5.0, cooldown: 7.0, cost: 24 } },
};
export const REACTIONS = [
  { a: 'aqua', b: 'crya', name: 'Frozen', multiplier: 1.2, stun: 2.5, color: '#CFF6FF' },
  { a: 'pyra', b: 'aqua', name: 'Steam Burst', multiplier: 1.5, slow: 2.0, color: '#E8EEF2' },
  { a: 'volt', b: 'aqua', name: 'Conduction', multiplier: 1.3, aoe_radius: 5, aoe_damage: 0.6, color: '#9FD3FF' },
  { a: 'zephyr', b: 'pyra', name: 'Wildfire', multiplier: 1.2, aoe_radius: 4.5, aoe_damage: 0.8, color: '#FFB347' },
  { a: 'terra', b: 'crya', name: 'Crystallize', multiplier: 1.4, slow: 3.0, color: '#D6F0FF' },
  { a: 'pyra', b: 'crya', name: 'Melt', multiplier: 1.8, color: '#FF9E7A' },
  { a: 'pyra', b: 'volt', name: 'Overload', multiplier: 1.4, knockback: 9, color: '#FF7AD9' },
  { a: 'terra', b: 'volt', name: 'Fracture', multiplier: 1.6, stun: 1.0, color: '#E0B870' },
  { a: 'zephyr', b: 'aqua', name: 'Squall', multiplier: 1.1, aoe_radius: 4, aoe_damage: 0.5, color: '#7FE0E0' },
  { a: 'zephyr', b: 'crya', name: 'Blizzard', multiplier: 1.1, aoe_radius: 4, aoe_damage: 0.5, color: '#C8F0FF' },
  { a: 'terra', b: 'pyra', name: 'Magma', multiplier: 1.5, slow: 1.5, color: '#FF8040' },
  { a: 'terra', b: 'aqua', name: 'Mire', multiplier: 1.1, slow: 4.0, color: '#8A9A5B' },
];
export const reactionFor = (x, y) => REACTIONS.find((r) => (r.a === x && r.b === y) || (r.a === y && r.b === x));

export const ENEMIES = {
  bramble_wisp: { name: 'Bramble Wisp', hp: 45, atk: 9, def: 1, speed: 3.6, detect: 13, range: 1.9, windup: 0.55, cooldown: 1.6, xp: 14, color: '#7BC86C', accent: '#E9F59A', scale: 1.0, radius: 0.55, drops: { glowcap: 0.35, copper_coin: 0.8 } },
  rootling_brute: { name: 'Rootling Brute', hp: 110, atk: 16, def: 4, speed: 2.6, detect: 11, range: 2.6, windup: 0.9, cooldown: 2.4, xp: 35, color: '#6B4E36', accent: '#A8D46F', scale: 1.5, radius: 0.9, drops: { healing_tonic: 0.5, copper_coin: 1.0 } },
};
// spawn points (outside the town wall): east road meadows and the west meadows beyond the bridge
export const SPAWNS = [
  ['bramble_wisp', 175, -8], ['bramble_wisp', 190, 18], ['bramble_wisp', 205, -30], ['bramble_wisp', 182, 40], ['rootling_brute', 222, -12],
  ['bramble_wisp', -190, -40], ['bramble_wisp', -175, 70], ['bramble_wisp', -226, 20], ['rootling_brute', -208, 2],
];

export const ITEMS = {
  healing_tonic: { name: 'Healing Tonic', cat: 'consumable', color: '#FF7A8A', heal: 45, desc: 'A bitter red draught. Restores 45 HP.' },
  honey_bread: { name: 'Honey Bread', cat: 'consumable', color: '#E8B65A', heal: 20, desc: 'Still warm from the Gilded Kettle. Restores 20 HP.' },
  sunpetal: { name: 'Sunpetal', cat: 'material', color: '#FFD34D', desc: 'A golden flower that turns to follow the light.' },
  glowcap: { name: 'Glowcap', cat: 'material', color: '#7FF5FF', desc: 'A mushroom that glows near old Aether currents.' },
  copper_coin: { name: 'Copper Marks', cat: 'currency', color: '#D08A4A', desc: 'Harrow Concord currency.' },
  travelers_blade: { name: "Traveler's Blade", cat: 'equipment', slot: 'weapon', color: '#C0D0E0', stats: { atk: 0 }, desc: 'The short blade you woke up holding.' },
  lantern_charm: { name: 'Lantern Charm', cat: 'equipment', slot: 'charm', color: '#FFE08A', stats: { def: 3, max_hp: 20 }, desc: 'A Lanternwright brass charm. Lyra swears it brings luck.' },
};

export const PLACES = {
  vael_harrow: { name: 'Vael Harrow', x: 0, z: 0, r: 16 },
  choir_steps: { name: 'Choir Steps', x: 205, z: -30, r: 9 },
};

export const QUESTS = {
  mq_awakening: { title: 'Echoes in the Whisperwood', type: 'main',
    desc: 'You woke beneath the old trees with no memory, only a cracked pendant that hums toward a distant light.',
    steps: [
      { type: 'talk', target: 'lyra', text: 'Find whoever is calling out: speak with Lyra' },
      { type: 'reach', target: 'vael_harrow', text: 'Go to the fountain plaza of Vael Harrow' },
      { type: 'talk', target: 'maren', text: 'Speak with Elder Maren in the plaza' }],
    rewards: { xp: 60, items: { healing_tonic: 2, copper_coin: 30 } }, next: 'mq_choir' },
  mq_choir: { title: 'The First Verse', type: 'main',
    desc: 'Elder Maren will let you look for answers on the Choir Steps, but only once the east road is safe.',
    steps: [
      { type: 'kill', target: 'bramble_wisp', count: 3, text: 'Clear Bramble Wisps from the east road' },
      { type: 'reach', target: 'choir_steps', text: 'Climb to the Choir Steps on the eastern ridge' },
      { type: 'talk', target: 'maren', text: 'Report back to Elder Maren' }],
    rewards: { xp: 250, items: { lantern_charm: 1, healing_tonic: 3 }, flag: 'act1_complete' } },
  sq_toma: { title: 'Petals for a Price', type: 'side',
    desc: 'Toma swears there is a buyer for Sunpetals. There is always a buyer, according to Toma.',
    steps: [
      { type: 'collect', target: 'sunpetal', count: 3, text: 'Gather Sunpetals in the meadows' },
      { type: 'talk', target: 'toma', text: 'Bring the Sunpetals to Toma' }],
    rewards: { xp: 40, items: { honey_bread: 3, copper_coin: 25 }, take: { sunpetal: 3 } } },
};

export const NPCS = {
  lyra: { name: 'Lyra Vensel', title: 'Lanternwright Apprentice', color: '#5FE8B0', dialogues: [
    ['lyra_meet', { step: 'mq_awakening:0' }], ['lyra_after', { flag: 'act1_complete' }], ['lyra_idle', {}]] },
  maren: { name: 'Elder Maren Holt', title: 'Speaker of the Concord', color: '#C9A15B', dialogues: [
    ['maren_meet', { step: 'mq_awakening:2' }], ['maren_report', { step: 'mq_choir:2' }], ['maren_wisps', { step: 'mq_choir:0' }],
    ['maren_busy', { active: 'mq_choir' }], ['maren_after', { flag: 'act1_complete' }], ['maren_stranger', {}]] },
  hesk: { name: 'Hesk', title: 'Blacksmith', color: '#FF8A3D', dialogues: [['hesk_talk', {}]] },
  wenna: { name: 'Wenna', title: 'Keeper of the Gilded Kettle', color: '#E8B65A', dialogues: [['wenna_talk', {}]] },
  ostin: { name: 'Brother Ostin', title: 'Priest of the Quiet Bell', color: '#A8C4FF', dialogues: [['ostin_talk', {}]] },
  toma: { name: 'Toma', title: 'Street Messenger', color: '#FFD36B', dialogues: [
    ['toma_turnin', { step: 'sq_toma:1' }], ['toma_waiting', { active: 'sq_toma' }], ['toma_done', { done: 'sq_toma' }], ['toma_offer', {}]] },
};

const L = (speaker, text, extra) => ({ speaker, text, ...extra });
export const DIALOGUES = {
  lyra_meet: { start: L('lyra', "Hello? Oh, thank the stars, a person! Did you see the light from the Core last night? Everyone in town says it's impossible.", { next: 'n2' }),
    n2: L('lyra', "Wait. You're shaking. And that pendant is glowing. Are you all right?", { choices: [['I don\'t remember anything. Not even how I got here.', 'n3a'], ["I'm fine. What is the Core?", 'n3b']] }),
    n3a: L('lyra', "Nothing at all? That's terrifying. And, I'm sorry, also incredibly interesting. I'm Lyra. Lanternwright apprentice.", { next: 'n4' }),
    n3b: L('lyra', "The Elyndra Core. That giant spire on the ridge. Dead for six hundred years, and last night it flickered. I'm Lyra, by the way.", { next: 'n4' }),
    n4: L('lyra', 'Hold still. Your pendant is singing. Can you hear it? It sounds like wind through a bell.', { next: 'n5' }),
    n5: L('narrator', 'A cool current rushes through you. The air around your hands begins to move. You can hear Zephyr.', { next: 'n6' }),
    n6: L('lyra', "You're a Resonant! Two tones at once, though? That shouldn't be possible. Come on, Elder Maren needs to see this. She is in the plaza.", { end: true }) },
  lyra_after: { start: L('lyra', 'The Core is humming again. Whatever you did on the Steps, Kael, the whole town feels it.', { end: true }) },
  lyra_idle: { start: L('lyra', 'Did you know the Old Span is older than the town? Someone built a bridge to nowhere, and the town grew around it. Sorry. I do this.', { end: true }) },
  maren_meet: { start: L('maren', "So you're the one Lyra won't stop talking about. You don't look like a portent.", { next: 'n2' }),
    n2: L('maren', "Two Resonances, no memory, waking the same night the Core stirs. I don't believe in coincidence.", { choices: [['I want answers as much as you do.', 'n3'], ["I'm not a threat to your town.", 'n3b']] }),
    n3: L('maren', 'Good. Then we want the same thing.', { next: 'n4' }),
    n3b: L('maren', "We'll see. I've buried enough people who meant no harm.", { next: 'n4' }),
    n4: L('maren', "The Choir Steps on the eastern ridge are closest to the Core. Bramble Wisps have been swarming the east road since last night. Clear three of them, then climb to the Steps, and I'll hear what you find.", { end: true }) },
  maren_wisps: { start: L('maren', 'The wisps still haunt the east road. Cut down three, and mind the Brutes: they hit like falling oaks.', { end: true }) },
  maren_busy: { start: L('maren', 'The Steps are open to you now. Go and listen to what the Core is trying to say.', { end: true }) },
  maren_report: { start: L('maren', 'The east road is quiet and you have stood on the Steps. Then the old songs were true.', { next: 'n2' }),
    n2: L('maren', 'Take this charm. Lyra made it, and she will pretend she did not. Walk well, Resonant.', { end: true }) },
  maren_after: { start: L('maren', 'The Concord owes you more than it can say. The road ahead is yours.', { end: true }) },
  maren_stranger: { start: L('maren', 'Vael Harrow keeps its peace. See that you do the same.', { end: true }) },
  toma_offer: { start: L('toma', 'Psst. You look like someone who can pick flowers. Three Sunpetals from the meadows and I will make it worth your while.', { choices: [['Sure, I will bring some.', 'yes'], ['Not now.', 'no']] }),
    yes: L('toma', 'Wonderful! Golden ones, out on the east road. Do not let the wisps eat my profit.', { actions: [['start_quest', 'sq_toma']], end: true }),
    no: L('toma', 'Offer stands. It always does.', { end: true }) },
  toma_waiting: { start: L('toma', 'Three Sunpetals. Golden, not yellow. There is a difference, and a price.', { end: true }) },
  toma_turnin: { start: L('toma', 'Perfect! Look at that shine. Honey bread for you, and a few marks. Pleasure doing business!', { end: true }) },
  toma_done: { start: L('toma', 'Business is booming. Thanks to you.', { end: true }) },
};
DIALOGUES.hesk_talk = { start: L('hesk', 'Steel remembers every hand that held it. Keep that blade clean, traveller, and it will keep you.', { end: true }) };
DIALOGUES.wenna_talk = { start: L('wenna', 'Honey bread is fresh this morning. Come back when your pockets are heavier.', { end: true }) };
DIALOGUES.ostin_talk = { start: L('ostin', 'The Quiet Bell rings only when the Core stirs. Last night, it rang. Twice.', { end: true }) };
