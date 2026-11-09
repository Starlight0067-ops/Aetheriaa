// Runs a command while holding the machine-wide "heavy work" lock, so only one Blender / browser /
// build process runs at a time (the dev laptop has ~1 GB of free RAM).
// Usage: node tools/lock.mjs <command> [args...]
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const lock = path.join(root, '.locks', 'heavy');
fs.mkdirSync(path.dirname(lock), { recursive: true });
const start = Date.now();
for (;;) {
  try { fs.mkdirSync(lock); break; } catch {
    try { if (Date.now() - fs.statSync(lock).mtimeMs > 20 * 60 * 1000) fs.rmdirSync(lock); } catch {}
    if (Date.now() - start > 45 * 60 * 1000) { console.error('lock: gave up after 45 min'); process.exit(3); }
    await new Promise((r) => setTimeout(r, 3000));
  }
}
const waited = Math.round((Date.now() - start) / 1000);
if (waited > 2) console.error(`lock: acquired after ${waited}s`);
let code = 1;
try {
  // node/python run without a shell so arguments containing & or quotes pass through untouched
  const direct = /^(node|python)(\.exe)?$/i.test(process.argv[2]);
  const r = spawnSync(process.argv[2], process.argv.slice(3), { stdio: 'inherit', shell: !direct });
  code = r.status ?? 1;
} finally {
  try { fs.rmdirSync(lock); } catch {}
}
process.exit(code);
