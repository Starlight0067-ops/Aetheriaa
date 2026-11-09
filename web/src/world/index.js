// World assembly (orchestrator-owned). Each sub-module owns its own file(s).
import * as terrain from './terrain.js';
import * as water from './water.js';
import * as nature from './nature/index.js';
import * as town from './town.js';
import * as npcs from './npcs.js';

export async function create(ctx) {
  const api = {};
  api.terrain = await terrain.create(ctx);
  api.water = await water.create(ctx);
  api.nature = await nature.create(ctx);
  api.town = await town.create(ctx);
  try { api.npcs = await npcs.create(ctx); } catch (e) { console.error('[world] npcs failed', e); }
  return api;
}
