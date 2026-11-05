import fs from 'node:fs';
globalThis.self = globalThis; globalThis.window = globalThis;
globalThis.document = { createElementNS: () => ({ style: {}, addEventListener() {}, removeEventListener() {} }) };
const { FBXLoader } = await import('three/examples/jsm/loaders/FBXLoader.js');
const THREE = await import('three');
const buf = fs.readFileSync(process.argv[2]);
const root = new FBXLoader().parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), '');
root.updateMatrixWorld(true);
const re = new RegExp(process.argv[3]);
root.traverse((o) => {
  if (!o.isMesh || !re.test(o.name)) return;
  const b = new THREE.Box3().setFromObject(o); const s = b.getSize(new THREE.Vector3()).multiplyScalar(10);
  const c = b.getCenter(new THREE.Vector3()).multiplyScalar(10);
  console.log(o.name.padEnd(60), String(o.geometry.attributes.position.count / 3).padStart(6), 'size', s.toArray().map((v) => v.toFixed(0)).join('x'), 'c', c.toArray().map((v) => v.toFixed(0)).join(','));
});
