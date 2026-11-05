import * as THREE from 'three';

// Rantai kinematik sederhana: thorax → (SC) clavicle → (AC) scapula → (GH) humerus → (elbow) forearm.
// Tiap verteks mempunyai "chain weight" c = [c1..c4] = seberapa jauh verteks ikut rotasi di
// sendi SC, AC, GH, siku. Tulang memakai bobot keras (0/1); otot & pembuluh memakai bobot halus
// yang dihitung saat build (berdasarkan jarak ke tulang tempat otot melekat), sehingga otot
// "melentur" di antara origin dan insertion.
// Rotasi parsial = rotasi pada sumbu & pivot yang sama dengan sudut c·θ (tidak "kolaps" seperti LBS biasa).

const STEPS = 64;
const JOINTS = ['sc', 'ac', 'gh', 'el'];

export class Rig {
  constructor(landmarks) {
    this.lm = landmarks;
    const v = (a) => new THREE.Vector3().fromArray(a);
    this.pivot = { sc: v(landmarks.sc), ac: v(landmarks.ac), gh: v(landmarks.gh), el: v(landmarks.elbow) };
    this.axes = {
      U: v(landmarks.axes.up), A: v(landmarks.axes.anterior), L: v(landmarks.axes.lateral),
    };
    const { U, A, L } = this.axes;
    const D = U.clone().negate();
    const hum = this.pivot.gh.clone().sub(this.pivot.el).normalize(); // humerus axis (up)
    const AxL = new THREE.Vector3().crossVectors(A, L);
    if (hum.dot(AxL) < 0) hum.negate();
    this.gAxis = {
      ml: new THREE.Vector3().crossVectors(D, A).normalize(), // +: flexion
      ap: new THREE.Vector3().crossVectors(D, L).normalize(), // +: abduction
      long: hum, // +: external rotation
      vert: new THREE.Vector3().crossVectors(L, A).normalize(), // +: horizontal adduction
      elev: new THREE.Vector3().crossVectors(L, U).normalize(), // +: clavicle elevation / scapular upward rotation
      prot: new THREE.Vector3().crossVectors(L, A).normalize(), // +: protraction
      elbow: new THREE.Vector3().crossVectors(D, A).normalize(), // +: elbow flexion
    };
    this.q = { sc: new THREE.Quaternion(), ac: new THREE.Quaternion(), gh: new THREE.Quaternion(), el: new THREE.Quaternion() };
    // Lookup tables: for each joint, STEPS+1 matrices for c in [0,1]
    this.tables = {};
    for (const j of JOINTS) this.tables[j] = new Float32Array((STEPS + 1) * 12);
    this.full = {}; // full-weight Matrix4 per joint
    this.items = [];
    this.rigid = [];
    this.update();
  }

  // pose: { gh: [[axis, deg], ...], girdle: { elev, upRot, protract, retract }, elbow }
  setPose(pose) {
    const deg = THREE.MathUtils.degToRad;
    const qa = (axis, d) => new THREE.Quaternion().setFromAxisAngle(this.gAxis[axis], deg(d));
    const g = pose?.girdle || {};
    // SC: clavicle elevation + protraction
    const sc = new THREE.Quaternion();
    sc.premultiply(qa('elev', g.elev || 0));
    sc.premultiply(qa('prot', (g.protract || 0) - (g.retract || 0)));
    // AC: scapular upward rotation
    const ac = qa('elev', g.upRot || 0);
    // GH: list applied in order
    const gh = new THREE.Quaternion();
    for (const [axis, d] of pose?.gh || []) gh.premultiply(qa(axis, d));
    const el = qa('elbow', pose?.elbow || 0);
    this.q.sc.copy(sc); this.q.ac.copy(ac); this.q.gh.copy(gh); this.q.el.copy(el);
    this.update();
  }

  update() {
    const tmpQ = new THREE.Quaternion();
    const id = new THREE.Quaternion();
    const m = new THREE.Matrix4();
    const t1 = new THREE.Matrix4();
    for (const j of JOINTS) {
      const p = this.pivot[j];
      const tab = this.tables[j];
      for (let s = 0; s <= STEPS; s++) {
        tmpQ.slerpQuaternions(id, this.q[j], s / STEPS);
        m.makeTranslation(p.x, p.y, p.z).multiply(t1.makeRotationFromQuaternion(tmpQ)).multiply(new THREE.Matrix4().makeTranslation(-p.x, -p.y, -p.z));
        const e = m.elements;
        const o = s * 12;
        // store 3x4 (row-major-ish: r00 r01 r02 tx ...)
        tab[o] = e[0]; tab[o + 1] = e[4]; tab[o + 2] = e[8]; tab[o + 3] = e[12];
        tab[o + 4] = e[1]; tab[o + 5] = e[5]; tab[o + 6] = e[9]; tab[o + 7] = e[13];
        tab[o + 8] = e[2]; tab[o + 9] = e[6]; tab[o + 10] = e[10]; tab[o + 11] = e[14];
        if (s === STEPS) this.full[j] = m.clone();
      }
    }
  }

  // Register a mesh with rigid level (0 none, 1 clavicle, 2 scapula, 3 humerus, 4 forearm)
  addRigid(mesh, level) {
    this.rigid.push({ mesh, level });
    mesh.matrixAutoUpdate = false;
  }

  // Register a mesh with per-vertex chain weights (Float32Array length n*4)
  addSkinned(mesh, chain) {
    const geo = mesh.geometry;
    const pos = geo.attributes.position;
    const nor = geo.attributes.normal;
    this.items.push({ mesh, chain, rest: pos.array.slice(), restN: nor ? nor.array.slice() : null });
  }

  rigidMatrix(level) {
    const m = new THREE.Matrix4();
    const order = ['sc', 'ac', 'gh', 'el'];
    for (let i = 0; i < level; i++) m.multiply(this.full[order[i]]);
    return m;
  }

  apply() {
    for (const r of this.rigid) {
      r.mesh.matrix.copy(this.rigidMatrix(r.level));
      r.mesh.matrixWorldNeedsUpdate = true;
    }
    const T = [this.tables.sc, this.tables.ac, this.tables.gh, this.tables.el];
    for (const it of this.items) {
      const pos = it.mesh.geometry.attributes.position;
      const nor = it.mesh.geometry.attributes.normal;
      const P = pos.array, N = nor ? nor.array : null;
      const R = it.rest, RN = it.restN, C = it.chain;
      const n = pos.count;
      for (let i = 0; i < n; i++) {
        let x = R[i * 3], y = R[i * 3 + 1], z = R[i * 3 + 2];
        let nx = 0, ny = 0, nz = 0;
        if (N) { nx = RN[i * 3]; ny = RN[i * 3 + 1]; nz = RN[i * 3 + 2]; }
        // apply distal first: el, gh, ac, sc
        for (let j = 3; j >= 0; j--) {
          const c = C[i * 4 + j];
          if (c <= 0.004) continue;
          const o = Math.round(c * STEPS) * 12;
          const t = T[j];
          const X = t[o] * x + t[o + 1] * y + t[o + 2] * z + t[o + 3];
          const Y = t[o + 4] * x + t[o + 5] * y + t[o + 6] * z + t[o + 7];
          const Z = t[o + 8] * x + t[o + 9] * y + t[o + 10] * z + t[o + 11];
          x = X; y = Y; z = Z;
          if (N) {
            const NX = t[o] * nx + t[o + 1] * ny + t[o + 2] * nz;
            const NY = t[o + 4] * nx + t[o + 5] * ny + t[o + 6] * nz;
            const NZ = t[o + 8] * nx + t[o + 9] * ny + t[o + 10] * nz;
            nx = NX; ny = NY; nz = NZ;
          }
        }
        P[i * 3] = x; P[i * 3 + 1] = y; P[i * 3 + 2] = z;
        if (N) { N[i * 3] = nx; N[i * 3 + 1] = ny; N[i * 3 + 2] = nz; }
      }
      pos.needsUpdate = true;
      if (nor) nor.needsUpdate = true;
      it.mesh.geometry.boundingSphere = null;
      it.mesh.geometry.boundingBox = null;
    }
  }

  // Transform a rest-pose point by chain weights (for labels / markers)
  transformPoint(p, c) {
    const v = new THREE.Vector3().fromArray(p);
    const order = ['el', 'gh', 'ac', 'sc'];
    const idx = [3, 2, 1, 0];
    for (let k = 0; k < 4; k++) {
      const w = c[idx[k]];
      if (w <= 0.004) continue;
      const q = new THREE.Quaternion().slerpQuaternions(new THREE.Quaternion(), this.q[order[k]], w);
      const pv = this.pivot[order[k]];
      v.sub(pv).applyQuaternion(q).add(pv);
    }
    return v;
  }
}

export function interpPose(a, b, t) {
  // Interpolate between two poses (angles only)
  const lerp = (x, y) => x + (y - x) * t;
  const ghMap = (p) => p?.gh || [];
  const A = ghMap(a), B = ghMap(b);
  const n = Math.max(A.length, B.length);
  const gh = [];
  for (let i = 0; i < n; i++) {
    const axis = (B[i] || A[i])[0];
    gh.push([axis, lerp(A[i]?.[1] || 0, B[i]?.[1] || 0)]);
  }
  const ga = a?.girdle || {}, gb = b?.girdle || {};
  const girdle = {};
  for (const k of ['elev', 'upRot', 'protract', 'retract']) girdle[k] = lerp(ga[k] || 0, gb[k] || 0);
  return { gh, girdle, elbow: lerp(a?.elbow || 0, b?.elbow || 0) };
}
