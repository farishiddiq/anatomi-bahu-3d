import fs from 'node:fs';
globalThis.self = globalThis; globalThis.window = globalThis;
globalThis.document = { createElementNS: () => ({ style: {}, addEventListener() {}, removeEventListener() {} }) };
const { FBXLoader } = await import('three/examples/jsm/loaders/FBXLoader.js');
const buf = fs.readFileSync(process.argv[2]);
const root = new FBXLoader().parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), '');
const re = new RegExp(process.argv[3], 'i');
root.traverse((o) => {
  if (!o.isMesh || !re.test(o.name)) return;
  const mats = Array.isArray(o.material) ? o.material : [o.material];
  const cnt = {};
  const g = o.geometry;
  const groups = g.groups.length ? g.groups : [{ start: 0, count: g.attributes.position.count, materialIndex: 0 }];
  for (const gr of groups) { const n = mats[gr.materialIndex]?.name || '?'; cnt[n] = (cnt[n] || 0) + gr.count / 3; }
  console.log(o.name, JSON.stringify(cnt));
});
