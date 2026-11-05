// Build public/models/shoulder.glb + public/models/landmarks.json from the Z-Anatomy model files.
//
// Usage:
//   ZA_DIR=<folder with SkeletalSystem100.fbx, MuscularSystem100.fbx, Joints100.fbx,
//           NervousSystem100.fbx, CardioVascular41.fbx>  node tools/build-model.mjs
//
// Source files: https://github.com/LluisV/Z-Anatomy-Sample (Assets/Models/1.0 Models)
// Licences: "Z-Anatomy – The open source atlas of anatomy – CC BY-SA 4.0" and
//           "BodyParts3D – The Database Center for Life Science – CC BY-SA 2.1 Japan".
// The generated GLB is a derivative work and is distributed under CC BY-SA 4.0.

import fs from 'node:fs';
import path from 'node:path';
import { MeshoptSimplifier } from 'meshoptimizer';
import { Document, NodeIO } from '@gltf-transform/core';

globalThis.self = globalThis; globalThis.window = globalThis;
globalThis.document = { createElementNS: () => ({ style: {}, addEventListener() {}, removeEventListener() {} }) };
const { FBXLoader } = await import('three/examples/jsm/loaders/FBXLoader.js');

const ZA = process.env.ZA_DIR;
const OUT = path.resolve('public/models');
fs.mkdirSync(OUT, { recursive: true });

// ───────────────────────── part list ─────────────────────────
// file: S skeletal, M muscular, J joints, N nervous, C cardiovascular
// bone: rigid rig group; attach: groups a soft part bends between
// tendon: what to do with the "Tendon" material group of a muscle:
//   'part' (default) → separate tendon-coloured part of the same muscle; '<structure>' → its own structure
const P = (key, file, src, cat, tris, opts = {}) => ({ key, file, src: Array.isArray(src) ? src : [src], cat, tris, ...opts });
const RIBS = ['First', 'Second', 'Third', 'Fourth', 'Fifth', 'Sixth', 'Seventh', 'Eighth', 'Ninth', 'Tenth', 'Eleventh', 'Twelfth'];
const CC = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth'];
const VERT = ['Atlas_(C1)', 'Axis_(C2)', 'Vertebra_C3', 'Vertebra_C4', 'Vertebra_C5', 'Vertebra_C6', 'Vertebra_C7',
  ...Array.from({ length: 12 }, (_, i) => `Vertebra_T${i + 1}`), ...Array.from({ length: 5 }, (_, i) => `Vertebra_L${i + 1}`)];
const PARTS = [
  P('clavicle', 'S', 'Clavicler', 'bone', 6000, { bone: 'clavicle', cartilage: 'clavicle__cart' }),
  P('scapula', 'S', 'Scapular', 'bone', 22000, { bone: 'scapula', cartilage: 'region_glenoid' }),
  P('humerus', 'S', 'Humerusr', 'bone', 14000, { bone: 'humerus', cartilage: 'humerus__cart' }),
  P('ctx_radius', 'S', 'Radiusr', 'context', 2500, { bone: 'forearm' }),
  P('ctx_ulna', 'S', 'Ulnar', 'context', 2500, { bone: 'forearm' }),
  P('ctx_sternum', 'S', ['Manubrium_of_sternum', 'Body_of_sternum'], 'context', 4000, { bone: 'thorax', perFile: true }),
  P('ctx_ribs', 'S', [...RIBS.map((r) => `${r}_ribr`), ...CC.map((c) => `Costal_cartilage_of_${c}_ribr`)], 'context', 30000, { bone: 'thorax', perFile: true }),
  P('ctx_spine', 'S', VERT, 'context', 30000, { bone: 'thorax', perFile: true }),
  P('ctx_hip', 'S', 'Hip_boner', 'context', 3000, { bone: 'thorax' }),

  P('deltoid_clav', 'M', 'Clavicular_part_of_deltoid_muscler', 'muscle', 6000, { attach: ['clavicle', 'humerus'] }),
  P('deltoid_acrom', 'M', 'Acromial_part_of_deltoid_muscler', 'muscle', 6000, { attach: ['scapula', 'humerus'] }),
  P('deltoid_spinal', 'M', 'Scapular_spinal_part_of_deltoid_muscler', 'muscle', 7000, { attach: ['scapula', 'humerus'] }),
  P('supraspinatus', 'M', 'Supraspinatus_muscler', 'muscle', 5000, { attach: ['scapula', 'humerus'] }),
  P('infraspinatus', 'M', 'Infraspinatus_muscler', 'muscle', 7000, { attach: ['scapula', 'humerus'], tendon: 'infraspinatus_t' }),
  P('teres_minor', 'M', 'Teres_minor_muscler', 'muscle', 4000, { attach: ['scapula', 'humerus'] }),
  P('teres_major', 'M', 'Teres_major_muscler', 'muscle', 4000, { attach: ['scapula', 'humerus'] }),
  P('subscapularis', 'M', 'Subscapularis_muscler', 'muscle', 7000, { attach: ['scapula', 'humerus'] }),
  P('trap_desc', 'M', 'Descending_part_of_trapezius_muscler', 'muscle', 7000, { attach: ['thorax', 'clavicle', 'scapula'] }),
  P('trap_trans', 'M', 'Transverse_part_of_trapezius_muscler', 'muscle', 5000, { attach: ['thorax', 'scapula'] }),
  P('trap_asc', 'M', 'Ascending_part_of_trapezius_muscler', 'muscle', 6000, { attach: ['thorax', 'scapula'] }),
  P('latissimus', 'M', 'Latissimus_dorsi_muscler', 'muscle', 12000, { attach: ['thorax', 'humerus'] }),
  P('pec_major_clav', 'M', 'Clavicular_head_of_pectoralis_major_muscler', 'muscle', 3000, { attach: ['clavicle', 'humerus'] }),
  P('pec_major_sternal', 'M', 'Sternocostal_head_of_pectoralis_major_muscler', 'muscle', 7000, { attach: ['thorax', 'humerus'] }),
  P('pec_major_abd', 'M', '(Abdominal_part_of_pectoralis_major_muscle)r', 'muscle', 3000, { attach: ['thorax', 'humerus'] }),
  P('pec_minor', 'M', 'Pectoralis_minor_muscler', 'muscle', 5000, { attach: ['thorax', 'scapula'] }),
  P('rhomboid_major', 'M', 'Rhomboid_major_muscler', 'muscle', 5000, { attach: ['thorax', 'scapula'] }),
  P('rhomboid_minor', 'M', 'Rhomboid_minor_muscler', 'muscle', 2500, { attach: ['thorax', 'scapula'] }),
  P('levator_scapulae', 'M', 'Levator_scapulaer', 'muscle', 4000, { attach: ['thorax', 'scapula'] }),
  P('biceps_long', 'M', 'Long_head_of_biceps_brachiir', 'muscle', 6000, { attach: ['scapula', 'humerus', 'forearm'], tendon: 'split_lhb' }),
  P('biceps_short', 'M', 'Short_head_of_biceps_brachiir', 'muscle', 5000, { attach: ['scapula', 'humerus', 'forearm'] }),
  P('triceps_long', 'M', 'Long_head_of_triceps_brachiir', 'muscle', 6000, { attach: ['scapula', 'humerus', 'forearm'] }),
  P('triceps_lat', 'M', 'Lateral_head_of_triceps_brachiir', 'muscle', 5000, { attach: ['humerus', 'forearm'] }),
  P('triceps_med', 'M', 'Medial_head_of_triceps_brachiir', 'muscle', 4000, { attach: ['humerus', 'forearm'] }),
  P('coracobrachialis', 'M', 'Coracobrachialis_muscler', 'muscle', 2500, { attach: ['scapula', 'humerus'] }),
  P('serratus_anterior', 'M', 'Serratus_anterior_muscler', 'muscle', 10000, { attach: ['thorax', 'scapula'] }),
  P('subclavius', 'M', 'Subclavius_muscler', 'muscle', 1500, { attach: ['thorax', 'clavicle'] }),

  // bursae & joint tissues (Z-Anatomy)
  P('bursa_subacromial', 'M', 'Subacromial_bursar', 'joint', 1200, { attach: ['scapula', 'humerus'] }),
  P('bursa_subdeltoid', 'M', 'Subdeltoid_bursar', 'joint', 1200, { attach: ['scapula', 'humerus'] }),
  P('labrum', 'J', 'Glenoid_labrumr', 'joint', 3000, { bone: 'scapula' }),
  P('gh_capsule', 'J', 'Articular_capsule_of_glenohumeral_jointr', 'joint', 5000, { attach: ['scapula', 'humerus'] }),
  P('ac_capsule', 'J', 'Articular_capsule_of_acromioclavicular_jointr', 'joint', 1500, { attach: ['clavicle', 'scapula'] }),
  P('ac_disc', 'J', 'Articular_disc_of_acromioclavicular_jointr', 'joint', 400, { attach: ['clavicle', 'scapula'] }),
  P('sc_capsule', 'J', 'Articular_capsule_of_sternoclavicular_jointr', 'joint', 1500, { attach: ['thorax', 'clavicle'] }),
  P('sc_disc', 'J', 'Articular_disc_of_sternoclavicular_jointr', 'joint', 400, { attach: ['thorax', 'clavicle'] }),

  // ligaments (Z-Anatomy)
  P('lig_ac', 'J', 'Acromioclavicular_ligamentr', 'ligament', 800, { attach: ['clavicle', 'scapula'] }),
  P('lig_conoid', 'J', 'Conoid_ligamentr', 'ligament', 400, { attach: ['clavicle', 'scapula'] }),
  P('lig_trapezoid', 'J', 'Trapezoid_ligamentr', 'ligament', 400, { attach: ['clavicle', 'scapula'] }),
  P('lig_ca', 'J', 'Coraco-acromial_ligamentr', 'ligament', 400, { bone: 'scapula' }),
  P('lig_sghl', 'J', 'Superior_glenohumeral_ligamentr', 'ligament', 600, { attach: ['scapula', 'humerus'] }),
  P('lig_mghl', 'J', 'Middle_glenohumeral_ligamentr', 'ligament', 600, { attach: ['scapula', 'humerus'] }),
  P('lig_ighl', 'J', 'Inferior_glenohumeral_ligamentr', 'ligament', 800, { attach: ['scapula', 'humerus'] }),
  P('lig_ch', 'J', 'Coracohumeral_ligamentr', 'ligament', 600, { attach: ['scapula', 'humerus'] }),
  P('lig_transverse_humeral', 'J', 'Transverse_humeral_ligamentr', 'ligament', 800, { bone: 'humerus' }),
  P('lig_sup_transverse_scap', 'J', 'Superior_transverse_scapular_ligamentr', 'ligament', 200, { bone: 'scapula' }),
  P('lig_inf_transverse_scap', 'J', 'Inferior_transverse_scapular_ligamentr', 'ligament', 200, { bone: 'scapula' }),
  P('lig_sc_ant', 'J', 'Anterior_sternoclavicular_ligamentr', 'ligament', 600, { attach: ['thorax', 'clavicle'] }),
  P('lig_sc_post', 'J', 'Posterior_sternoclavicular_ligamentr', 'ligament', 400, { attach: ['thorax', 'clavicle'] }),
  P('lig_costoclav', 'J', 'Costoclavicular_ligamentr', 'ligament', 200, { attach: ['thorax', 'clavicle'] }),
  P('lig_interclav', 'J', 'Interclavicular_ligamentr', 'ligament', 300, { attach: ['thorax', 'clavicle'] }),

  // nerves (Z-Anatomy)
  P('n_plexus_roots', 'N', 'Roots_of_brachial_plexusr', 'nerve', 4000, { attach: ['thorax'] }),
  P('n_plexus_trunks', 'N', ['Superior_trunk_of_brachial_plexusr', 'Middle_trunk_of_brachial_plexusr', 'Inferior_trunk_of_brachial_plexusr'], 'nerve', 1500, { attach: ['thorax', 'clavicle'] }),
  P('n_plexus_divisions', 'N', ['Anterior_division_of_superior_trunk_of_brachial_plexusr', 'Posterior_division_of_superior_trunk_of_brachial_plexusr', 'Anterior_division_of_middle_trunk_of_brachial_plexusr', 'Posterior_division_of_middle_trunk_of_brachial_plexusr', 'Anterior_division_of_inferior_trunk_of_brachial_plexusr', 'Posterior_division_of_inferior_trunk_of_brachial_plexusr'], 'nerve', 2000, { attach: ['thorax', 'clavicle'] }),
  P('n_plexus_cords', 'N', ['Posterior_cord_of_brachial_plexusr', 'Lateral_cord_of_brachial_plexusr', 'Medial_cord_of_brachial_plexusr'], 'nerve', 1200, { attach: ['thorax', 'humerus'], optional: true }),
  P('n_axillary', 'N', ['Axillary_nerver', 'Muscular_branches_of_axillary_nerver', 'Superior_lateral_brachial_cutaneous_nerver'], 'nerve', 3000, { attach: ['thorax', 'scapula', 'humerus'] }),
  P('n_suprascapular', 'N', 'Suprascapular_nerver', 'nerve', 3000, { attach: ['thorax', 'scapula'] }),
  P('n_long_thoracic', 'N', 'Long_thoracic_nerver', 'nerve', 2500, { attach: ['thorax', 'scapula'] }),
  P('n_dorsal_scapular', 'N', 'Dorsal_scapular_nerver', 'nerve', 2000, { attach: ['thorax', 'scapula'] }),
  P('n_thoracodorsal', 'N', 'Thoracodorsal_nerver', 'nerve', 2500, { attach: ['thorax', 'humerus'] }),
  P('n_subscapular', 'N', ['Superior_subscapular_nerver', 'Inferior_subscapular_nerver'], 'nerve', 2000, { attach: ['thorax', 'scapula'] }),
  P('n_pectoral', 'N', ['Lateral_pectoral_nerver', 'Medial_pectoral_nerver'], 'nerve', 3500, { attach: ['thorax', 'clavicle', 'humerus'] }),
  P('n_musculocutaneous', 'N', 'Musculocutaneous_nerver', 'nerve', 1500, { attach: ['thorax', 'humerus', 'forearm'], clipElbow: true }),
  P('n_radial', 'N', 'Radial_nerver', 'nerve', 2000, { attach: ['thorax', 'humerus', 'forearm'], clipElbow: true }),
  P('n_median', 'N', 'Median_nerver', 'nerve', 2000, { attach: ['thorax', 'humerus', 'forearm'], clipElbow: true }),
  P('n_ulnar', 'N', 'Ulnar_nerver', 'nerve', 2000, { attach: ['thorax', 'humerus', 'forearm'], clipElbow: true }),

  // vessels (Z-Anatomy)
  P('subclavian_a', 'C', 'Right_subclavian_artery', 'artery', 1500, { attach: ['thorax'] }),
  P('axillary_a', 'C', 'Axillary_arteryr', 'artery', 1500, { attach: ['thorax', 'humerus'] }),
  P('thoracoacromial_a', 'C', ['Thoraco-acromial_arteryr', 'Pectoral_branches_of_thoraco-acromial_arteryr'], 'artery', 2000, { attach: ['thorax', 'clavicle', 'scapula', 'humerus'] }),
  P('subscapular_a', 'C', ['Subscapular_arteryr', 'Thoracodorsal_arteryr'], 'artery', 1500, { attach: ['thorax', 'scapula', 'humerus'] }),
  P('brachial_a', 'C', 'Brachial_arteryr', 'artery', 1500, { attach: ['humerus', 'forearm'], clipElbow: true }),
  P('deep_brachial_a', 'C', 'Deep_brachial_arteryr', 'artery', 800, { attach: ['humerus'] }),
  P('post_circ_a', 'C', 'Posterior_circumflex_humeral_arteryr', 'artery', 1000, { attach: ['scapula', 'humerus'] }),
  P('ant_circ_a', 'C', 'Anterior_circumflex_humeral_arteryr', 'artery', 1200, { attach: ['humerus'] }),
  P('suprascapular_a', 'C', 'Suprascapular_arteryr', 'artery', 1500, { attach: ['thorax', 'clavicle', 'scapula'] }),
  P('axillary_v', 'C', 'Axillary_veinr', 'vein', 1200, { attach: ['thorax', 'humerus'] }),
  P('subclavian_v', 'C', 'Right_subclavian_vein', 'vein', 800, { attach: ['thorax', 'clavicle'] }),
  P('cephalic_v', 'C', 'Cephalic_veinr', 'vein', 2500, { attach: ['thorax', 'clavicle', 'humerus', 'forearm'], clipElbow: true }),
];
// muscle attachment areas (Z-Anatomy footprints "<muscle>o#r" / "<muscle>e#r" on the skeleton)
// INSERTION lists the rig group(s) on which the muscle INSERTS; footprints on other groups are origins.
const INSERTION = {
  deltoid_clav: ['humerus'], deltoid_acrom: ['humerus'], deltoid_spinal: ['humerus'], supraspinatus: ['humerus'], infraspinatus: ['humerus'],
  teres_minor: ['humerus'], teres_major: ['humerus'], subscapularis: ['humerus'], trap_desc: ['clavicle', 'scapula'], trap_trans: ['scapula'],
  trap_asc: ['scapula'], latissimus: ['humerus'], pec_major_clav: ['humerus'], pec_major_sternal: ['humerus'], pec_major_abd: ['humerus'],
  pec_minor: ['scapula'], rhomboid_major: ['scapula'], rhomboid_minor: ['scapula'], levator_scapulae: ['scapula'], biceps_long: ['forearm'],
  biceps_short: ['forearm'], triceps_long: ['forearm'], triceps_lat: ['forearm'], triceps_med: ['forearm'], coracobrachialis: ['humerus'],
  serratus_anterior: ['scapula'], subclavius: ['clavicle'],
};
const GROUPS = ['thorax', 'clavicle', 'scapula', 'humerus', 'forearm'];
const LEVEL = { thorax: 0, clavicle: 1, scapula: 2, humerus: 3, forearm: 4 };

// ───────────────────────── FBX loading ─────────────────────────
const FILES = { S: 'SkeletalSystem100.fbx', M: 'MuscularSystem100.fbx', J: 'Joints100.fbx', N: 'NervousSystem100.fbx', C: 'CardioVascular41.fbx' };
const loaded = {};
function fbx(file) {
  if (loaded[file]) return loaded[file];
  console.log('Parsing', FILES[file], '…');
  const buf = fs.readFileSync(path.join(ZA, FILES[file]));
  const root = new FBXLoader().parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), '');
  root.updateMatrixWorld(true);
  const map = new Map();
  root.traverse((o) => { if (o.isMesh && !map.has(o.name)) map.set(o.name, o); });
  return (loaded[file] = map);
}

// FBX mesh → { pos (mm), idx, mat (per-triangle material name) } welded
function meshFrom(o) {
  const g = o.geometry; const pa = g.attributes.position; const e = o.matrixWorld.elements;
  const mats = Array.isArray(o.material) ? o.material : [o.material];
  const n = pa.count;
  const triMat = new Array(n / 3).fill(mats[0]?.name || '');
  for (const gr of g.groups) for (let v = gr.start; v < gr.start + gr.count; v += 3) triMat[v / 3] = mats[gr.materialIndex]?.name || '';
  const map = new Map(); const pos = []; const idx = new Uint32Array(n);
  for (let i = 0; i < n; i++) {
    const x = pa.getX(i), y = pa.getY(i), z = pa.getZ(i);
    const X = (e[0] * x + e[4] * y + e[8] * z + e[12]) * 10, Y = (e[1] * x + e[5] * y + e[9] * z + e[13]) * 10, Z = (e[2] * x + e[6] * y + e[10] * z + e[14]) * 10;
    const k = `${X.toFixed(3)},${Y.toFixed(3)},${Z.toFixed(3)}`;
    let id = map.get(k);
    if (id === undefined) { id = pos.length / 3; map.set(k, id); pos.push(X, Y, Z); }
    idx[i] = id;
  }
  // drop degenerate triangles
  const keep = []; const km = [];
  for (let t = 0; t < n / 3; t++) { const a = idx[t * 3], b = idx[t * 3 + 1], c = idx[t * 3 + 2]; if (a !== b && b !== c && a !== c) { keep.push(a, b, c); km.push(triMat[t]); } }
  return { pos: new Float32Array(pos), idx: new Uint32Array(keep), mat: km };
}
function getMesh(file, name, optional) {
  const o = fbx(file).get(name);
  if (!o) { if (optional) return null; throw new Error(`Missing in ${FILES[file]}: ${name}`); }
  return meshFrom(o);
}
function subsetByMat(m, pred) {
  const idx = [];
  for (let t = 0; t < m.idx.length / 3; t++) if (pred(m.mat[t] || '')) idx.push(m.idx[t * 3], m.idx[t * 3 + 1], m.idx[t * 3 + 2]);
  return compact({ pos: m.pos, idx: new Uint32Array(idx) });
}
function merge(list) {
  list = list.filter(Boolean);
  let nv = 0, ni = 0;
  for (const m of list) { nv += m.pos.length; ni += m.idx.length; }
  const pos = new Float32Array(nv), idx = new Uint32Array(ni);
  let ov = 0, oi = 0;
  for (const m of list) {
    pos.set(m.pos, ov);
    for (let i = 0; i < m.idx.length; i++) idx[oi + i] = m.idx[i] + ov / 3;
    ov += m.pos.length; oi += m.idx.length;
  }
  return { pos, idx };
}
function simplify(m, tris, lockBorder = false) {
  if (m.idx.length / 3 <= tris) return compact(m);
  const [idx] = MeshoptSimplifier.simplify(m.idx, m.pos, 3, tris * 3, 0.02, lockBorder ? ['LockBorder'] : []);
  return compact({ pos: m.pos, idx });
}
function compact(m) {
  const remap = new Int32Array(m.pos.length / 3).fill(-1);
  const out = []; const idx = new Uint32Array(m.idx.length);
  let n = 0;
  for (let i = 0; i < m.idx.length; i++) {
    const v = m.idx[i];
    if (remap[v] < 0) { remap[v] = n++; out.push(m.pos[v * 3], m.pos[v * 3 + 1], m.pos[v * 3 + 2]); }
    idx[i] = remap[v];
  }
  return { pos: new Float32Array(out), idx };
}
function clipBelow(m, y) {
  const idx = [];
  for (let t = 0; t < m.idx.length / 3; t++) {
    const a = m.idx[t * 3], b = m.idx[t * 3 + 1], c = m.idx[t * 3 + 2];
    if (m.pos[a * 3 + 1] > y && m.pos[b * 3 + 1] > y && m.pos[c * 3 + 1] > y) idx.push(a, b, c);
  }
  return compact({ pos: m.pos, idx: new Uint32Array(idx) });
}
// connected components (by shared vertices)
function components(m) {
  const n = m.pos.length / 3; const parent = new Int32Array(n).map((_, i) => i);
  const find = (x) => { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; };
  for (let i = 0; i < m.idx.length; i += 3) { const a = find(m.idx[i]), b = find(m.idx[i + 1]), c = find(m.idx[i + 2]); parent[b] = a; parent[find(c)] = a; }
  const groups = new Map();
  for (let t = 0; t < m.idx.length / 3; t++) { const r = find(m.idx[t * 3]); if (!groups.has(r)) groups.set(r, []); groups.get(r).push(m.idx[t * 3], m.idx[t * 3 + 1], m.idx[t * 3 + 2]); }
  return [...groups.values()].map((ix) => compact({ pos: m.pos, idx: new Uint32Array(ix) }));
}

// consistent winding + outward normals
function orient(m) {
  const idx = m.idx; const nt = idx.length / 3;
  const edgeMap = new Map();
  const ek = (a, b) => (a < b ? a * 4194304 + b : b * 4194304 + a);
  for (let t = 0; t < nt; t++) for (let e = 0; e < 3; e++) {
    const a = idx[t * 3 + e], b = idx[t * 3 + ((e + 1) % 3)];
    const k = ek(a, b); let l = edgeMap.get(k); if (!l) edgeMap.set(k, (l = [])); l.push(t);
  }
  const seen = new Uint8Array(nt); const comp = new Int32Array(nt).fill(-1); let nc = 0;
  const has = (t, a, b) => { for (let e = 0; e < 3; e++) if (idx[t * 3 + e] === a && idx[t * 3 + ((e + 1) % 3)] === b) return true; return false; };
  for (let s = 0; s < nt; s++) {
    if (seen[s]) continue;
    const q = [s]; seen[s] = 1; comp[s] = nc;
    while (q.length) {
      const t = q.pop();
      for (let e = 0; e < 3; e++) {
        const a = idx[t * 3 + e], b = idx[t * 3 + ((e + 1) % 3)];
        const l = edgeMap.get(ek(a, b));
        if (l.length !== 2) continue;
        const o = l[0] === t ? l[1] : l[0];
        if (seen[o]) continue;
        if (has(o, a, b)) { const x = idx[o * 3 + 1]; idx[o * 3 + 1] = idx[o * 3 + 2]; idx[o * 3 + 2] = x; }
        seen[o] = 1; comp[o] = nc; q.push(o);
      }
    }
    nc++;
  }
  const vol = new Float64Array(nc); const p = m.pos;
  for (let t = 0; t < nt; t++) {
    const a = idx[t * 3] * 3, b = idx[t * 3 + 1] * 3, c = idx[t * 3 + 2] * 3;
    vol[comp[t]] += p[a] * (p[b + 1] * p[c + 2] - p[b + 2] * p[c + 1]) - p[a + 1] * (p[b] * p[c + 2] - p[b + 2] * p[c]) + p[a + 2] * (p[b] * p[c + 1] - p[b + 1] * p[c]);
  }
  for (let t = 0; t < nt; t++) if (vol[comp[t]] < 0) { const x = idx[t * 3 + 1]; idx[t * 3 + 1] = idx[t * 3 + 2]; idx[t * 3 + 2] = x; }
  return m;
}
function normals(m) {
  const n = new Float32Array(m.pos.length); const p = m.pos;
  for (let i = 0; i < m.idx.length; i += 3) {
    const a = m.idx[i] * 3, b = m.idx[i + 1] * 3, c = m.idx[i + 2] * 3;
    const ux = p[b] - p[a], uy = p[b + 1] - p[a + 1], uz = p[b + 2] - p[a + 2];
    const vx = p[c] - p[a], vy = p[c + 1] - p[a + 1], vz = p[c + 2] - p[a + 2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    for (const k of [a, b, c]) { n[k] += nx; n[k + 1] += ny; n[k + 2] += nz; }
  }
  for (let i = 0; i < n.length; i += 3) { const l = Math.hypot(n[i], n[i + 1], n[i + 2]) || 1; n[i] /= l; n[i + 1] /= l; n[i + 2] /= l; }
  return n;
}

// ───────────────────────── spatial grid ─────────────────────────
class Grid {
  constructor(pos, cell = 6) {
    this.cell = cell; this.pos = pos; this.map = new Map();
    for (let i = 0; i < pos.length / 3; i++) {
      const k = this.key(Math.floor(pos[i * 3] / cell), Math.floor(pos[i * 3 + 1] / cell), Math.floor(pos[i * 3 + 2] / cell));
      if (!this.map.has(k)) this.map.set(k, []);
      this.map.get(k).push(i);
    }
    const step = Math.max(1, Math.floor(pos.length / 3 / 1500));
    this.sub = []; for (let i = 0; i < pos.length / 3; i += step) this.sub.push(i);
  }
  key(ix, iy, iz) { return (ix + 2048) * 16777216 + (iy + 2048) * 4096 + (iz + 2048); }
  nearest(x, y, z, maxR = 400) {
    const c = this.cell; const cx = Math.floor(x / c), cy = Math.floor(y / c), cz = Math.floor(z / c);
    let best = Infinity, bi = -1; const lim = Math.min(maxR, 36);
    for (let r = 0; r * c <= lim; r++) {
      for (let i = -r; i <= r; i++) for (let j = -r; j <= r; j++) for (let k = -r; k <= r; k++) {
        if (Math.max(Math.abs(i), Math.abs(j), Math.abs(k)) !== r) continue;
        const arr = this.map.get(this.key(cx + i, cy + j, cz + k)); if (!arr) continue;
        for (const v of arr) { const dx = this.pos[v * 3] - x, dy = this.pos[v * 3 + 1] - y, dz = this.pos[v * 3 + 2] - z; const d = dx * dx + dy * dy + dz * dz; if (d < best) { best = d; bi = v; } }
      }
      if (bi >= 0 && Math.sqrt(best) < r * c) break;
    }
    if (bi < 0 && maxR > lim) for (const v of this.sub) { const dx = this.pos[v * 3] - x, dy = this.pos[v * 3 + 1] - y, dz = this.pos[v * 3 + 2] - z; const d = dx * dx + dy * dy + dz * dz; if (d < best) { best = d; bi = v; } }
    return { d: Math.sqrt(best), i: bi };
  }
}

// ───────────────────────── math ─────────────────────────
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const vtx = (m, i) => [m.pos[i * 3], m.pos[i * 3 + 1], m.pos[i * 3 + 2]];
const r1 = (a) => a.map((v) => Math.round(v * 10) / 10);
const centroid = (p) => { let x = 0, y = 0, z = 0; const n = p.length / 3; for (let i = 0; i < p.length; i += 3) { x += p[i]; y += p[i + 1]; z += p[i + 2]; } return [x / n, y / n, z / n]; };
function fitSphere(pts) {
  const M = Array.from({ length: 4 }, () => [0, 0, 0, 0]); const B = [0, 0, 0, 0];
  for (const p of pts) { const row = [2 * p[0], 2 * p[1], 2 * p[2], 1]; const rhs = dot(p, p); for (let i = 0; i < 4; i++) { B[i] += row[i] * rhs; for (let j = 0; j < 4; j++) M[i][j] += row[i] * row[j]; } }
  for (let i = 0; i < 4; i++) {
    let piv = i; for (let k = i + 1; k < 4; k++) if (Math.abs(M[k][i]) > Math.abs(M[piv][i])) piv = k;
    [M[i], M[piv]] = [M[piv], M[i]]; [B[i], B[piv]] = [B[piv], B[i]];
    for (let k = i + 1; k < 4; k++) { const f = M[k][i] / M[i][i]; for (let j = i; j < 4; j++) M[k][j] -= f * M[i][j]; B[k] -= f * B[i]; }
  }
  const x = [0, 0, 0, 0];
  for (let i = 3; i >= 0; i--) { let s = B[i]; for (let j = i + 1; j < 4; j++) s -= M[i][j] * x[j]; x[i] = s / M[i][i]; }
  const c = [x[0], x[1], x[2]]; return { c, r: Math.sqrt(x[3] + dot(c, c)) };
}

// ───────────────────────── load parts ─────────────────────────
await MeshoptSimplifier.ready;
const meshes = {}; // key -> mesh
const extra = []; // { key, mesh, ...meta } additional output meshes (tendon parts, cartilage, footprints)
const U = [0, 1, 0], A = [0, 0, 1], L = [-1, 0, 0];
const lp = (p) => dot(p, L);

for (const part of PARTS) {
  const raw = part.src.map((n) => getMesh(part.file, n, part.optional)).filter(Boolean);
  if (!raw.length) { console.log('  (skip, not in source)', part.key); continue; }
  let body, tendon = null, cart = null;
  if (part.cat === 'muscle') {
    const m = merge(raw.map((r) => ({ pos: r.pos, idx: r.idx }))); m.mat = raw.flatMap((r) => r.mat);
    const isT = (s) => /tendon/i.test(s);
    body = subsetByMat(m, (s) => !isT(s));
    const t = subsetByMat(m, isT);
    if (t.idx.length) tendon = t;
  } else if (part.cartilage) {
    const m = raw[0];
    body = subsetByMat(m, (s) => !/cartilage/i.test(s));
    cart = subsetByMat(m, (s) => /cartilage/i.test(s));
  } else if (part.perFile) {
    const total = raw.reduce((s, e) => s + e.idx.length / 3, 0);
    body = merge(raw.map((e) => simplify({ pos: e.pos, idx: e.idx }, Math.max(250, Math.round((part.tris * (e.idx.length / 3)) / total)))));
  } else body = merge(raw.map((r) => ({ pos: r.pos, idx: r.idx })));
  const tBudget = tendon ? Math.max(300, Math.round(part.tris * tendon.idx.length / (tendon.idx.length + body.idx.length))) : 0;
  if (!part.perFile) body = simplify(body, part.tris - tBudget, !!tendon || !!cart);
  meshes[part.key] = orient(body);
  if (tendon) extra.push({ key: part.key + '__tendon', src: part, mesh: orient(simplify(tendon, tBudget, true)), kind: 'tendon' });
  if (cart) extra.push({ key: part.cartilage, src: part, mesh: orient(simplify(cart, 3000, true)), kind: 'cartilage' });
  console.log(`  ${part.key.padEnd(24)} ${String(body.idx.length / 3).padStart(6)} tris${tendon ? ` + tendon ${tBudget}` : ''}${cart ? ' + cartilage' : ''}`);
}

// ───── GH centre (humeral head sphere) → origin ─────
const humAll = merge([meshes.humerus, extra.find((e) => e.key === 'humerus__cart').mesh]);
let hmaxY = -Infinity, hminY = Infinity;
for (let i = 0; i < humAll.pos.length / 3; i++) { hmaxY = Math.max(hmaxY, humAll.pos[i * 3 + 1]); hminY = Math.min(hminY, humAll.pos[i * 3 + 1]); }
const cartH = extra.find((e) => e.key === 'humerus__cart').mesh; // articular surface of the head (real)
const headPts = []; for (let i = 0; i < cartH.pos.length / 3; i++) if (cartH.pos[i * 3 + 1] > hmaxY - 60) headPts.push(vtx(cartH, i));
const sph = fitSphere(headPts.length > 50 ? headPts : (() => { const a = []; for (let i = 0; i < humAll.pos.length / 3; i++) if (humAll.pos[i * 3 + 1] > hmaxY - 40) a.push(vtx(humAll, i)); return a; })());
const GH0 = sph.c; const headR = sph.r;
console.log('GH center', r1(GH0), 'head radius', headR.toFixed(1));
const all = [...Object.values(meshes), ...extra.map((e) => e.mesh)];
for (const m of all) { const p = m.pos; for (let i = 0; i < p.length; i += 3) { p[i] -= GH0[0]; p[i + 1] -= GH0[1]; p[i + 2] -= GH0[2]; } }
hminY -= GH0[1];

// The pectoral nerves enter the DEEP surface of pectoralis major/minor and branch inside the muscle.
// In the source some intramuscular branches poke through the superficial surface; move those vertices
// to just beneath the muscle surface so they are not drawn on top of the muscle.
{
  const pec = merge(['pec_major_clav', 'pec_major_sternal', 'pec_major_abd', 'pec_minor'].map((k) => meshes[k]));
  const pn = normals(pec); const g = new Grid(pec.pos, 4); const n = meshes.n_pectoral; let moved = 0;
  for (let i = 0; i < n.pos.length / 3; i++) {
    const p = vtx(n, i); const r = g.nearest(p[0], p[1], p[2], 12); if (r.i < 0 || r.d > 8) continue;
    const q = vtx(pec, r.i); const nn = [pn[r.i * 3], pn[r.i * 3 + 1], pn[r.i * 3 + 2]];
    const s = dot(sub(p, q), nn);
    if (s > -1.2) { const t = -1.2 - s; n.pos[i * 3] += nn[0] * t; n.pos[i * 3 + 1] += nn[1] * t; n.pos[i * 3 + 2] += nn[2] * t; moved++; }
  }
  console.log('  pectoral nerve: moved', moved, 'surface vertices beneath the muscle');
}

// elbow & clipping of arm structures at the elbow
const H = meshes.humerus;
const distal = []; for (let i = 0; i < H.pos.length / 3; i++) if (H.pos[i * 3 + 1] < hminY + 22) distal.push(vtx(H, i));
const elbow = centroid(new Float32Array(distal.flat())); elbow[1] += 4;
for (const part of PARTS) if (part.clipElbow && meshes[part.key]) meshes[part.key] = clipBelow(meshes[part.key], elbow[1] - 25);

// clavicle ends
const C = meshes.clavicle;
let cmin = Infinity, cmax = -Infinity;
for (let i = 0; i < C.pos.length / 3; i++) { const v = lp(vtx(C, i)); cmin = Math.min(cmin, v); cmax = Math.max(cmax, v); }
const cMed = [], cLat = [];
for (let i = 0; i < C.pos.length / 3; i++) { const p = vtx(C, i); const v = lp(p); if (v < cmin + 9) cMed.push(p); if (v > cmax - 7) cLat.push(p); }
const SC = centroid(new Float32Array(cMed.flat()));
const clavLatEnd = centroid(new Float32Array(cLat.flat()));

// scapula: acromion & coracoid regions (auto) ; glenoid = real articular cartilage
const S = meshes.scapula; const sv = (i) => vtx(S, i);
const acrom = [], corac = [];
for (let i = 0; i < S.pos.length / 3; i++) {
  const p = sv(i);
  if (p[1] > headR * 0.55 && lp(p) > -headR * 0.9 && dot(p, A) > -headR * 1.6) acrom.push(i);
  if (dot(p, A) > headR * 0.85 && p[1] > -headR * 0.6 && lp(p) < headR * 0.4) corac.push(i);
}
const pick = (ids, f) => { let b = null, bv = -Infinity; for (const i of ids) { const v = f(sv(i)); if (v > bv) { bv = v; b = sv(i); } } return b; };
const acromMed = pick(acrom, (p) => -len(sub(p, clavLatEnd)));
const AC = mul(add(clavLatEnd, acromMed), 0.5);
const scapPts = []; for (let i = 0; i < S.pos.length / 3; i += 3) scapPts.push(sv(i));
const scapInf = scapPts.reduce((b, p) => (p[1] < b[1] ? p : b));
const glenMesh = extra.find((e) => e.key === 'region_glenoid').mesh;
const glenC = centroid(glenMesh.pos);
const spinoglenoid = (() => { let b = null; for (const p of scapPts) { if (dot(p, A) > -headR * 0.7) continue; const d = Math.abs(p[1] - 2) + Math.abs(lp(p) - (lp(glenC) - 10)) * 0.8; if (!b || d < b.d) b = { p, d }; } return b.p; })();
const slice = (y, tol = 3) => { const pts = []; for (let i = 0; i < H.pos.length / 3; i++) { const p = vtx(H, i); if (Math.abs(p[1] - y) < tol) pts.push(p); } const c = centroid(new Float32Array(pts.flat())); let r = 0; for (const p of pts) r += Math.hypot(p[0] - c[0], p[2] - c[2]); return { c, r: r / pts.length }; };
const shaft = slice(-headR - 75);

// ───── rig weights ─────
const boneGroups = {};
for (const part of PARTS) if (part.bone && meshes[part.key] && ['bone', 'context'].includes(part.cat)) (boneGroups[part.bone] ||= []).push(meshes[part.key]);
const grids = {}; for (const g of GROUPS) grids[g] = new Grid(merge(boneGroups[g]).pos, 6);
function adjacency(m) {
  // vertices at identical positions (e.g. the muscle–tendon seam) are treated as one, so smoothing crosses seams
  const n = m.pos.length / 3; const key = new Map(); const rep = new Int32Array(n);
  for (let i = 0; i < n; i++) { const k = `${m.pos[i * 3].toFixed(2)},${m.pos[i * 3 + 1].toFixed(2)},${m.pos[i * 3 + 2].toFixed(2)}`; if (!key.has(k)) key.set(k, i); rep[i] = key.get(k); }
  const adj = Array.from({ length: n }, () => new Set());
  const link = (a, b) => { adj[rep[a]].add(rep[b]); adj[rep[b]].add(rep[a]); };
  for (let i = 0; i < m.idx.length; i += 3) { const a = m.idx[i], b = m.idx[i + 1], c = m.idx[i + 2]; link(a, b); link(b, c); link(a, c); }
  return Array.from({ length: n }, (_, i) => [...adj[rep[i]]]);
}
function chainWeights(m, attach) {
  const n = m.pos.length / 3; let W = new Float32Array(n * 5);
  for (let i = 0; i < n; i++) {
    const p = vtx(m, i); let sw = 0;
    for (let g = 0; g < 5; g++) {
      if (!attach.includes(GROUPS[g])) continue;
      const w = 1 / Math.pow(grids[GROUPS[g]].nearest(p[0], p[1], p[2], 300).d + 2, 4);
      W[i * 5 + g] = w; sw += w;
    }
    for (let g = 0; g < 5; g++) W[i * 5 + g] /= sw || 1;
  }
  const adj = adjacency(m);
  for (let it = 0; it < 12; it++) {
    const W2 = new Float32Array(W.length);
    for (let i = 0; i < n; i++) { const nb = adj[i]; for (let g = 0; g < 5; g++) { let s = W[i * 5 + g]; for (const j of nb) s += W[j * 5 + g]; W2[i * 5 + g] = s / (nb.length + 1); } }
    W = W2;
  }
  const chain = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) { const w = W.subarray(i * 5, i * 5 + 5); chain[i * 4] = w[1] + w[2] + w[3] + w[4]; chain[i * 4 + 1] = w[2] + w[3] + w[4]; chain[i * 4 + 2] = w[3] + w[4]; chain[i * 4 + 3] = w[4]; }
  return chain;
}
const levelOf = (p) => { let best = 'thorax', bd = Infinity; for (const g of GROUPS) { const d = grids[g].nearest(p[0], p[1], p[2], 200).d; if (d < bd) { bd = d; best = g; } } return best; };

// ───── tendons ─────
const output = []; // { name, mesh, extras }
const partByKey = Object.fromEntries(PARTS.map((p) => [p.key, p]));
for (const part of PARTS) {
  const m = meshes[part.key]; if (!m) continue;
  const te = extra.find((e) => e.kind === 'tendon' && e.src === part);
  if (part.attach && te) {
    const both = merge([m, te.mesh]); const ch = chainWeights(both, part.attach);
    m.chain = ch.slice(0, (m.pos.length / 3) * 4); te.mesh.chain = ch.slice((m.pos.length / 3) * 4);
  } else if (part.attach) m.chain = chainWeights(m, part.attach);
  output.push({ name: part.key, mesh: m, extras: { cat: part.cat, level: part.bone ? LEVEL[part.bone] : null } });
}
for (const e of extra) {
  if (e.kind === 'cartilage') {
    output.push({ name: e.key, mesh: e.mesh, extras: { cat: 'bone', level: LEVEL[e.src.bone], cartilage: true } });
    continue;
  }
  // tendon part of a muscle (chain weights were computed together with the muscle body)
  const m = e.mesh;
  if (e.src.tendon === 'split_lhb') {
    // the long head of biceps has a proximal (LHB) and a distal tendon: split by component height
    const comps = components(m);
    const prox = comps.filter((c) => centroid(c.pos)[1] > -headR * 3);
    const dist = comps.filter((c) => centroid(c.pos)[1] <= -headR * 3);
    for (const [name, list] of [['region_lhb_t', prox], [e.key, dist]]) {
      if (!list.length) continue;
      const mm = merge(list); const g = new Grid(m.pos, 3); mm.chain = new Float32Array((mm.pos.length / 3) * 4);
      for (let i = 0; i < mm.pos.length / 3; i++) { const r = g.nearest(mm.pos[i * 3], mm.pos[i * 3 + 1], mm.pos[i * 3 + 2], 20); mm.chain.set(m.chain.subarray(r.i * 4, r.i * 4 + 4), i * 4); }
      output.push({ name, mesh: mm, extras: { cat: name.startsWith('region') ? 'tendon' : 'muscle', tendonPart: true } });
    }
    console.log('  LHB tendon components', prox.length, 'distal', dist.length);
  } else if (e.src.tendon) {
    output.push({ name: 'region_' + e.src.tendon, mesh: m, extras: { cat: 'tendon', tendonPart: true } });
  } else {
    output.push({ name: e.key, mesh: m, extras: { cat: 'muscle', tendonPart: true } });
  }
}

// ───── muscle attachment footprints (origin / insertion) ─────
const SK = fbx('S');
const footprints = {};
for (const part of PARTS.filter((p) => p.cat === 'muscle')) {
  const base = part.src[0].replace(/r$/, '');
  const esc = base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`^${esc}[oe]\\d*r$`);
  const names = [...SK.keys()].filter((n) => re.test(n));
  const byType = { o: [], i: [] };
  for (const n of names) {
    let fm = meshFrom(SK.get(n)); fm = { pos: fm.pos, idx: fm.idx };
    for (let i = 0; i < fm.pos.length; i += 3) { fm.pos[i] -= GH0[0]; fm.pos[i + 1] -= GH0[1]; fm.pos[i + 2] -= GH0[2]; }
    const g = levelOf(centroid(fm.pos));
    const type = INSERTION[part.key].includes(g) ? 'i' : 'o';
    fm.group = g;
    byType[type].push(fm);
  }
  for (const t of ['o', 'i']) {
    const list = byType[t]; if (!list.length) continue;
    // split per bone group so each piece follows its bone
    const per = {};
    for (const f of list) (per[f.group] ||= []).push(f);
    for (const [g, fl] of Object.entries(per)) {
      const mm = orient(simplify(merge(fl), 2500));
      const N = normals(mm); for (let i = 0; i < mm.pos.length; i++) mm.pos[i] += N[i] * 0.3;
      const name = `fp_${part.key}_${t}_${g}`;
      output.push({ name, mesh: mm, extras: { cat: 'footprint', level: LEVEL[g], muscle: part.key, type: t } });
      (footprints[part.key] ||= []).push(name);
    }
  }
  if (!names.length) console.log('  (no footprint)', part.key);
}

// ───── derived tendon areas for muscles WITHOUT a modelled tendon (supraspinatus, subscapularis, teres minor) ─────
// Z-Anatomy does not model these three tendons separately. Their tendon area is taken as the part of the real muscle
// mesh within ~20 mm of the muscle's real insertion footprint (Z-Anatomy) on the humerus.
function extractRegion(m, sel, offset, chainSrc) {
  const N = normals(m); const keep = [];
  for (let i = 0; i < m.idx.length; i += 3) if (sel[m.idx[i]] && sel[m.idx[i + 1]] && sel[m.idx[i + 2]]) keep.push(m.idx[i], m.idx[i + 1], m.idx[i + 2]);
  const remap = new Map(); const pos = []; const chain = []; const idx = [];
  for (const v of keep) {
    if (!remap.has(v)) {
      remap.set(v, pos.length / 3);
      pos.push(m.pos[v * 3] + N[v * 3] * offset, m.pos[v * 3 + 1] + N[v * 3 + 1] * offset, m.pos[v * 3 + 2] + N[v * 3 + 2] * offset);
      if (chainSrc) chain.push(chainSrc[v * 4], chainSrc[v * 4 + 1], chainSrc[v * 4 + 2], chainSrc[v * 4 + 3]);
    }
    idx.push(remap.get(v));
  }
  return { pos: new Float32Array(pos), idx: new Uint32Array(idx), chain: chainSrc ? new Float32Array(chain) : null };
}
const derived = {};
for (const [key, tid, R] of [['supraspinatus', 'supraspinatus_t', 22], ['subscapularis', 'subscapularis_t', 20], ['teres_minor', 'teres_minor_t', 16]]) {
  const ins = output.find((o) => o.name === `fp_${key}_i_humerus`);
  if (!ins) { console.log('  !! no insertion footprint for', key); continue; }
  const fg = new Grid(ins.mesh.pos, 4); const m = meshes[key]; const n = m.pos.length / 3; const sel = new Uint8Array(n);
  for (let i = 0; i < n; i++) { const p = vtx(m, i); if (fg.nearest(p[0], p[1], p[2], 60).d < R) sel[i] = 1; }
  const r = extractRegion(m, sel, 0.35, m.chain);
  output.push({ name: 'region_' + tid, mesh: r, extras: { cat: 'tendon', derived: true } });
  derived[tid] = R;
  console.log(`  derived tendon ${tid}: ${r.idx.length / 3} tris`);
}

// acromion / coracoid regions (auto-selected part of the real scapula mesh)
{
  const n = S.pos.length / 3; const adj = adjacency(S);
  const mk = (ids) => { const s = new Uint8Array(n); for (const i of ids) s[i] = 1; const s2 = s.slice(); for (let i = 0; i < n; i++) if (s[i]) for (const j of adj[i]) s2[j] = 1; return s2; };
  output.push({ name: 'region_acromion', mesh: extractRegion(S, mk(acrom), 0.25, null), extras: { cat: 'bone', level: 2 } });
  output.push({ name: 'region_coracoid', mesh: extractRegion(S, mk(corac), 0.25, null), extras: { cat: 'bone', level: 2 } });
}

// ───── write GLB ─────
const doc = new Document(); const buffer = doc.createBuffer(); const scene = doc.createScene('shoulder');
let totalTris = 0;
for (const { name, mesh: m, extras } of output) {
  if (!m.idx.length) { console.log('  (empty)', name); continue; }
  const prim = doc.createPrimitive()
    .setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(m.pos).setBuffer(buffer))
    .setAttribute('NORMAL', doc.createAccessor().setType('VEC3').setArray(normals(m)).setBuffer(buffer))
    .setIndices(doc.createAccessor().setType('SCALAR').setArray(m.pos.length / 3 < 65535 ? new Uint16Array(m.idx) : new Uint32Array(m.idx)).setBuffer(buffer));
  if (m.chain) prim.setAttribute('_CHAIN', doc.createAccessor().setType('VEC4').setArray(m.chain).setBuffer(buffer));
  scene.addChild(doc.createNode(name).setMesh(doc.createMesh(name).addPrimitive(prim)).setExtras(extras));
  totalTris += m.idx.length / 3;
}
await new NodeIO().write(path.join(OUT, 'shoulder.glb'), doc);
const landmarks = {
  units: 'mm', origin: 'glenohumeral center', source: 'Z-Anatomy (CC BY-SA 4.0) / BodyParts3D (CC BY-SA 2.1 JP)',
  axes: { up: U, anterior: A, lateral: L },
  gh: [0, 0, 0], headR: +headR.toFixed(2), elbow: r1(elbow), sc: r1(SC), ac: r1(AC),
  glenC: r1(glenC), scapInf: r1(scapInf), spinoglenoid: r1(spinoglenoid), shaft: { c: r1(shaft.c), r: +shaft.r.toFixed(1) },
  footprints, derivedTendons: derived,
};
fs.writeFileSync(path.join(OUT, 'landmarks.json'), JSON.stringify(landmarks, null, 1));
console.log('Total tris', totalTris, '→', (fs.statSync(path.join(OUT, 'shoulder.glb')).size / 1e6).toFixed(2), 'MB');
