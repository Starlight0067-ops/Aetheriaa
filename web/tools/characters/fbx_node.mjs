// Load FBX animation files in Node with three's FBXLoader (no browser). Used by inspect/bake scripts.
import fs from 'node:fs';
globalThis.self ??= globalThis;
globalThis.window ??= globalThis;
const { FBXLoader } = await import('three/examples/jsm/loaders/FBXLoader.js');
export function loadFBX(file) {
  const buf = fs.readFileSync(file);
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  return new FBXLoader().parse(ab, '');
}
