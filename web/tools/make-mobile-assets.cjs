// Generates reduced-resolution texture variants for the mobile-safe profile (src/core/profile.js).
//   public/assets/mobile/512/<dir>/<name>.webp  (safe=1)   public/assets/mobile/256/...  (safe=2)
//   public/assets/mobile/manifest.json          (list of mapped sources, "dir/name" without extension)
// Usage: npm i --no-save sharp && node tools/make-mobile-assets.cjs
// The generated files are committed (Render only runs `npm ci && npm run build`).
const fs = require('fs'), path = require('path');
let sharp; try { sharp = require('sharp'); } catch { console.error('sharp missing: npm i --no-save sharp'); process.exit(1); }
const ROOT = path.join(__dirname, '..', 'public', 'assets');
const DIRS = ['free/medieval', 'free/nature', 'textures', 'cc0/ground', 'town'];
const SIZES = [512, 256];
const files = [];
for (const d of DIRS) {
  const dir = path.join(ROOT, d);
  if (!fs.existsSync(dir)) continue;
  for (const f of fs.readdirSync(dir)) if (/\.(png|jpe?g)$/i.test(f)) files.push(d + '/' + f.replace(/\.[^.]+$/, '') + path.extname(f));
}
(async () => {
  const manifest = [];
  let bytes = 0;
  for (const rel of files) {
    const src = path.join(ROOT, rel);
    const key = rel.replace(/\.[^.]+$/, '');
    // normal maps: keep quality a bit higher (lossy blocks show as faceting under light)
    const isNormal = /normal|nor_gl/i.test(rel);
    for (const s of SIZES) {
      const out = path.join(ROOT, 'mobile', String(s), key + '.webp');
      fs.mkdirSync(path.dirname(out), { recursive: true });
      await sharp(src).resize(s, s, { fit: 'inside', withoutEnlargement: true }).webp({ quality: isNormal ? 88 : 80, alphaQuality: 90, effort: 5 }).toFile(out);
      bytes += fs.statSync(out).size;
    }
    manifest.push(key);
  }
  fs.writeFileSync(path.join(ROOT, 'mobile', 'manifest.json'), JSON.stringify({ generated: new Date().toISOString().slice(0, 10), sizes: SIZES, files: manifest }));
  console.log(manifest.length, 'textures ->', (bytes / 1048576).toFixed(1), 'MB total');
})();
