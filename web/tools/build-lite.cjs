// Builds dist-lite/ from dist/: only the runtime-loaded assets (tools/lite-manifest.txt, recorded with Playwright)
// plus index.html, draco/basis decoders, every .js/.wasm/.json/.css in assets/, anim json, and cc0 (hdri, characters).
// Drops fbx/vrm/legacy glb. Usage: node tools/build-lite.cjs
const fs = require('fs'), path = require('path');
const root = path.resolve(__dirname, '..'), src = path.join(root, 'dist'), out = path.join(root, 'dist-lite');
fs.rmSync(out, { recursive: true, force: true });
const keep = new Set(fs.readFileSync(path.join(__dirname, 'lite-manifest.txt'), 'utf8').split('\n').filter(Boolean));
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
let n = 0, bytes = 0;
for (const f of walk(src)) {
  const rel = path.relative(src, f).split(path.sep).join('/');
  const top = rel.split('/').length === 1 || /^assets\/[^/]+$/.test(rel) || rel.startsWith('draco/') || rel.startsWith('basis/');
  const ok = keep.has(rel) || rel === 'index.html' || (top && /\.(js|wasm|json|css)$/.test(rel)) ||
    /^assets\/anims\/.*\.json$/.test(rel) || /^assets\/cc0\/(hdri|characters|buildings|ground)\//.test(rel) || rel === 'assets/cc0/LICENSES.md';
  if (!ok) continue;
  const to = path.join(out, rel); fs.mkdirSync(path.dirname(to), { recursive: true }); fs.copyFileSync(f, to); n++; bytes += fs.statSync(f).size;
}
console.log(`dist-lite: ${n} files, ${(bytes / 1e6).toFixed(1)} MB`);
// Inline the stylesheet (Artifact CSP only allows Google Fonts stylesheets).
const ih = path.join(out, 'index.html'); let html = fs.readFileSync(ih, 'utf8');
html = html.replace(/<link rel="stylesheet"[^>]*href="\.\/(assets\/[^"]+\.css)"[^>]*>/, (_, p) => { const css = fs.readFileSync(path.join(out, p), 'utf8'); fs.rmSync(path.join(out, p)); return `<style>${css}</style>`; });
fs.writeFileSync(ih, html);
