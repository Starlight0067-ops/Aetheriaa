// World assembly (orchestrator-owned). Each sub-module owns its own file(s).
import * as terrain from './terrain.js';
import * as water from './water.js';
import * as nature from './nature/index.js';
import * as town from './town.js';
import * as npcs from './npcs.js';

export async function create(ctx) {
  const api = {};
  api.terrain = await terrain.create(ctx); window.__memLog?.('world.terrain');
  api.water = await water.create(ctx); window.__memLog?.('world.water');
  api.nature = await nature.create(ctx); window.__memLog?.('world.nature');
  api.town = await town.create(ctx); window.__memLog?.('world.town');
  try { api.npcs = await npcs.create(ctx); window.__memLog?.('world.npcs'); } catch (e) { console.error('[world] npcs failed', e); }
  return api;
}
