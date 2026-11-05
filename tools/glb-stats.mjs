import { NodeIO } from '@gltf-transform/core';
const doc = await new NodeIO().read(process.argv[2]);
const rows = [];
for (const n of doc.getRoot().listNodes()) { const m = n.getMesh(); if (!m) continue; let t = 0, v = 0; for (const p of m.listPrimitives()) { t += p.getIndices().getCount() / 3; v += p.getAttribute('POSITION').getCount(); } rows.push([n.getName(), t, v]); }
const grp = {}; for (const [n, t, v] of rows) { const k = n.startsWith('fp_') ? 'footprints' : n.endsWith('__cart') ? 'cartilage' : n.endsWith('__tendon') ? 'tendon parts' : 'other'; grp[k] = (grp[k] || [0, 0]); grp[k][0] += t; grp[k][1] += v; }
console.log(grp, 'nodes', rows.length);
if (process.argv[3]) rows.sort((a, b) => b[1] - a[1]).slice(0, +process.argv[3]).forEach((r) => console.log(r.join('\t')));
