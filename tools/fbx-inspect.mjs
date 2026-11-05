import fs from 'node:fs';
globalThis.self = globalThis; globalThis.window = globalThis;
globalThis.document = { createElementNS: () => ({ style: {}, addEventListener() {}, removeEventListener() {} }) };
const { FBXLoader } = await import('three/examples/jsm/loaders/FBXLoader.js');
const buf = fs.readFileSync(process.argv[2]);
const root = new FBXLoader().parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), '');
const re = new RegExp(process.argv[3], 'i');
root.updateMatrixWorld(true);
root.traverse((o) => {
  if (!o.isMesh || !re.test(o.name)) return;
  const g = o.geometry; g.computeBoundingBox();
  const bb = g.boundingBox.clone().applyMatrix4(o.matrixWorld);
  const mats = Array.isArray(o.material) ? o.material.map((m) => m.name + ':' + m.color?.getHexString() + (m.map ? '+map' : '')) : [o.material.name + ':' + o.material.color?.getHexString() + (o.material.map ? '+map' : '')];
  console.log(o.name, Object.keys(g.attributes).join(','), 'groups', g.groups.length, mats.join('|'), 'bb', bb.min.toArray().map((v) => v.toFixed(3)).join(' '), '/', bb.max.toArray().map((v) => v.toFixed(3)).join(' '));
});
