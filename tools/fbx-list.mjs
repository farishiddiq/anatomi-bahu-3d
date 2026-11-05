// List mesh names in a Z-Anatomy FBX file: node tools/fbx-list.mjs file.fbx [filterRegex]
import fs from 'node:fs';
globalThis.self = globalThis;
globalThis.window = globalThis;
globalThis.document = { createElementNS: () => ({ style: {}, addEventListener() {}, removeEventListener() {} }) };
const { FBXLoader } = await import('three/examples/jsm/loaders/FBXLoader.js');
const buf = fs.readFileSync(process.argv[2]);
const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
const root = new FBXLoader().parse(ab, '');
const re = process.argv[3] ? new RegExp(process.argv[3], 'i') : null;
let n = 0;
root.traverse((o) => { if (o.isMesh) { n++; if (!re || re.test(o.name)) console.log(o.name, o.geometry.attributes.position.count); } });
console.error('meshes', n);
