// Cast catalog (owner: character agent). Design sheets: docs/characters/<id>.md
export const CATALOG = {
  kael:  { name: 'Kael Arden',   role: 'Protagonist',               height: 1.74, colors: [0x1f6f78, 0x2a2f45, 0xc9893f], accent: 0x7ff5ff },
  lyra:  { name: 'Lyra Vensel',  role: 'Lanternwright apprentice',  height: 1.62, colors: [0xf2e6cf, 0x3fae8c, 0x7a4e32], accent: 0x5fe8b0 },
  maren: { name: 'Elder Maren Holt', role: 'Speaker of the Concord', height: 1.68, colors: [0x4a2f52, 0xe2b95b, 0xd9d4cc], accent: 0x8fa8d8 },
  ostin: { name: 'Brother Ostin', role: 'Priest of the Quiet Bell', height: 1.78, colors: [0xece4d4, 0x6f7fb8, 0xb8935a], accent: 0xa8c4ff },
  toma:  { name: 'Toma',         role: 'Street messenger',          height: 1.38, colors: [0xe08a3c, 0x5a4636, 0x2f8f8a], accent: 0xffd36b },
  hesk:  { name: 'Hesk',         role: 'Blacksmith',                height: 1.84, colors: [0x5e4330, 0x3a3530, 0xb5654a], accent: 0xff8a3d },
  wenna: { name: 'Wenna',        role: 'Keeper of the Gilded Kettle', height: 1.63, colors: [0x8a3b3b, 0xf2ebdd, 0x4e8a5a], accent: 0xe8b65a },
};
export const CAST = Object.keys(CATALOG);
