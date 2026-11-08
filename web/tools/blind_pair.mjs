// Prepares a blind A/B pair for a judge: copies two images to <outdir>/A.<ext> and B.<ext> in random
// order and writes the answer key to <outdir>/../keys/<name>.json (never give the key to a judge).
// Usage: node tools/blind_pair.mjs <ours> <reference> <outdir>
import fs from 'node:fs';
import path from 'node:path';

const [ours, ref, outdir] = process.argv.slice(2);
fs.mkdirSync(outdir, { recursive: true });
const swap = Math.random() < 0.5;
const [a, b] = swap ? [ref, ours] : [ours, ref];
const A = path.join(outdir, 'A' + path.extname(a));
const B = path.join(outdir, 'B' + path.extname(b));
fs.copyFileSync(a, A);
fs.copyFileSync(b, B);
const keys = path.join(path.dirname(outdir), 'keys');
fs.mkdirSync(keys, { recursive: true });
fs.writeFileSync(path.join(keys, path.basename(outdir) + '.json'), JSON.stringify({ A: swap ? 'reference' : 'ours', B: swap ? 'ours' : 'reference', ours, ref }, null, 2));
console.log(JSON.stringify({ A, B }));
