import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { Rig } from './rig.js';
import { makeMaterial, HL } from './materials.js';
import { regionMarkers } from './markers.js';
import { STRUCTURES, BY_ID, CATEGORIES } from './data/structures.js';

const TRANSLUCENT = new Set(['gh_capsule', 'ac_capsule', 'sc_capsule', 'bursa_subacromial', 'bursa_subdeltoid',
  'elbow_capsule', 'wrist_capsule', 'mcp_capsule', 'pip_capsule', 'dip_capsule', 'common_flexor_sheath', 'digital_sheaths', 'palmar_aponeurosis']);
const SHEATH = new Set(['common_flexor_sheath', 'digital_sheaths']);
const LEVEL_OF ={ clavicle: 1, scapula: 2, humerus: 3 };
export function partLabel(d, part) {
  if (!part) return null;
  if (d.parts?.[part]) return d.parts[part];
  if (part.endsWith('__tendon')) {
    const b = part.slice(0, -8);
    return d.parts?.[b] ? `${d.parts[b].split(' – ')[0]} – tendon` : 'Tendon (jaringan tendon otot ini)';
  }
  return null;
}

// glTF attributes may be interleaved; the rig needs plain arrays it can rewrite in place.
function deinterleave(geo) {
  for (const [name, attr] of Object.entries(geo.attributes)) {
    if (!attr.isInterleavedBufferAttribute) continue;
    const n = attr.count, k = attr.itemSize;
    const arr = new Float32Array(n * k);
    for (let i = 0; i < n; i++) for (let j = 0; j < k; j++) arr[i * k + j] = attr.getComponent(i, j);
    geo.setAttribute(name, new THREE.BufferAttribute(arr, k));
  }
  // rig chain weights are stored as normalized uint8 → floats 0..1 for the rig
  const ch = geo.attributes._chain;
  if (ch && !(ch.array instanceof Float32Array)) {
    const arr = new Float32Array(ch.count * 4);
    for (let i = 0; i < ch.count; i++) for (let j = 0; j < 4; j++) arr[i * 4 + j] = ch.getComponent(i, j) / (ch.normalized ? 255 : 1);
    geo.setAttribute('_chain', new THREE.BufferAttribute(arr, 4));
  }
  // normals are not stored in the GLB (smaller download); same area-weighted normals as the build
  if (!geo.attributes.normal) geo.computeVertexNormals();
  return geo;
}

const CHAIN_OF_LEVEL =[[0, 0, 0, 0], [1, 0, 0, 0], [1, 1, 0, 0], [1, 1, 1, 0], [1, 1, 1, 1]];

export class Viewer extends EventTarget {
  constructor(canvas, stage) {
    super();
    this.canvas = canvas; this.stage = stage;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.85;
    this.renderer.setClearColor('#10141b', 1);
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(35, 1, 2, 6000);
    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.screenSpacePanning = true;
    this.controls.minDistance = 60;
    this.controls.maxDistance = 2600;
    this.controls.zoomSpeed = 1.1;

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.45;
    this.scene.add(new THREE.HemisphereLight('#dfe8ff', '#2a1f1a', 0.55));
    const key = new THREE.DirectionalLight('#ffffff', 1.5); key.position.set(-300, 500, 600);
    const rim = new THREE.DirectionalLight('#9cc8ff', 0.7); rim.position.set(400, 200, -500);
    this.camLight = new THREE.DirectionalLight('#ffffff', 0.55);
    this.scene.add(key, rim, this.camLight, this.camLight.target);

    this.root = new THREE.Group();
    this.scene.add(this.root);

    this.structs = new Map(); // id -> { def, meshes: [] }
    this.meshes = [];
    this.layer = Object.fromEntries(CATEGORIES.map((c) => [c.id, { visible: true, opacity: 1 }]));
    this.layer.context.opacity = 0.55;
    this.layer.joint.opacity = 0.6;
    this.highlights = new Map(); // id -> THREE.Color
    this.selected = null;
    this.isolated = null; // Set of ids
    this.dimOthers = false;
    this.showAttachments = true;
    this.autoRotate = false;
    this.tags = [];
    this.clock = new THREE.Clock();
    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this._down = null;
    this._hoverT = 0;

    this.resize();
    new ResizeObserver(() => this.resize()).observe(stage);
    this._bindPointer();
  }

  async load(glbUrl, lmUrl, onProgress) {
    const [gltf, lm] = await Promise.all([
      new GLTFLoader().loadAsync(glbUrl, (e) => e.total && onProgress?.(e.loaded / e.total)),
      fetch(lmUrl).then((r) => r.json()),
    ]);
    this.lm = lm;
    this.rig = new Rig(lm);
    const byNode = {};
    gltf.scene.traverse((o) => { if (o.isMesh) byNode[o.name.replace(/_\d+$/, '')] = o; });
    // mesh keys from structures
    let muscleIdx = 0;
    for (const def of STRUCTURES) {
      const entry = { def, meshes: [] };
      this.structs.set(def.id, entry);
      const base = def.kind === 'mesh' ? def.meshes : def.kind === 'region' ? ['region_' + def.id] : [];
      // every muscle part may have a modelled tendon part "<key>__tendon"
      const keys = base.flatMap((k) => (byNode[k + '__tendon'] ? [k, k + '__tendon'] : [k]));
      for (const k of keys) {
        const src = byNode[k];
        if (!src) { console.warn('missing mesh', k); continue; }
        const geo = deinterleave(src.geometry);
        const isTendonPart = k.endsWith('__tendon');
        const isCart = !!src.userData?.cartilage || k.endsWith('__cart') || k === 'region_glenoid';
        let style = def.cat === 'vessel' ? (def.venous ? 'vein' : 'artery') : def.cat;
        if (isTendonPart) style = 'tendon';
        if (isCart) style = 'cartilage';
        const mat = makeMaterial(style, def.cat === 'muscle' ? muscleIdx : 0);
        if (def.kind === 'region' && def.cat === 'bone') { mat.polygonOffset = true; mat.polygonOffsetFactor = -1; }
        if (def.kind === 'region' && def.cat === 'tendon') { mat.polygonOffset = true; mat.polygonOffsetFactor = -2; mat.polygonOffsetUnits = -2; }
        if (TRANSLUCENT.has(k)) mat.userData.translucent = true;
        if (k.startsWith('bursa_')) { mat.color.set('#6fd6ff'); mat.userData.baseColor = mat.color.clone(); }
        if (k === 'labrum' || k.endsWith('_disc')) { mat.color.set('#d9c8ff'); mat.userData.baseColor = mat.color.clone(); }
        if (SHEATH.has(k)) { mat.color.set('#7fe0c8'); mat.userData.baseColor = mat.color.clone(); }
        const mesh = new THREE.Mesh(geo, mat);
        mesh.name = k;
        mesh.userData = { sid: def.id, part: k, cat: def.cat };
        this._register(mesh, geo, LEVEL_OF[k] ?? src.userData?.level ?? (def.parent === 'scapula' ? 2 : null));
        entry.meshes.push(mesh);
      }
      if (def.cat === 'muscle') muscleIdx++;
    }
    // muscle attachment areas (origin = red, insertion = blue) – shown for the selected muscle
    this.footprints = {}; // muscle part key -> meshes
    for (const [name, src] of Object.entries(byNode)) {
      if (!name.startsWith('fp_')) continue;
      const { muscle, type, level } = src.userData;
      const mat = new THREE.MeshStandardMaterial({ color: type === 'o' ? '#ff5a4a' : '#3d8bff', emissive: type === 'o' ? '#5a0d06' : '#06204d', roughness: 0.5, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3, side: THREE.DoubleSide });
      const mesh = new THREE.Mesh(deinterleave(src.geometry), mat);
      mesh.name = name; mesh.visible = false; mesh.renderOrder = 5;
      mesh.userData = { footprint: true, muscle, type };
      this.root.add(mesh);
      this.rig.addRigid(mesh, level ?? 0);
      // a footprint can be shared by several muscles (e.g. the common flexor / extensor origin)
      for (const mk of String(muscle).split(',')) (this.footprints[mk] ||= []).push(mesh);
    }
    // pain-region markers
    this.markers = {};
    const mk = regionMarkers(lm);
    for (const [id, { p, c }] of Object.entries(mk)) {
      const m = new THREE.Mesh(new THREE.SphereGeometry(13, 32, 16), new THREE.MeshBasicMaterial({ color: '#ff4d6d', transparent: true, opacity: 0.35, depthTest: false }));
      m.renderOrder = 20; m.visible = false; m.userData = { rest: p.toArray(), chain: c };
      const ring = new THREE.Mesh(new THREE.RingGeometry(14, 16.5, 48), new THREE.MeshBasicMaterial({ color: '#ff8fa3', transparent: true, opacity: 0.9, depthTest: false, side: THREE.DoubleSide }));
      ring.renderOrder = 21; m.add(ring);
      this.scene.add(m);
      this.markers[id] = m;
    }
    this.rig.setPose(null);
    this.rig.apply();
    this.applyMaterials();
    this.view('front3q', true);
    this._loop();
  }

  _register(mesh, geo, level) {
    this.root.add(mesh);
    this.meshes.push(mesh);
    const chain = geo.attributes._chain;
    if (level != null) this.rig.addRigid(mesh, level);
    else if (chain) this.rig.addSkinned(mesh, chain.array);
    else this.rig.addRigid(mesh, 0);
    mesh.userData.level = level;
  }

  // ───────── camera ─────────
  resize() {
    const w = this.stage.clientWidth, h = this.stage.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  center() {
    const lm = this.lm;
    return new THREE.Vector3(0, -45, 0).addScaledVector(new THREE.Vector3().fromArray(lm.axes.lateral), -25);
  }

  home() { this.view('front3q'); }

  view(name, instant = false) {
    const A = new THREE.Vector3().fromArray(this.lm.axes.anterior);
    const L = new THREE.Vector3().fromArray(this.lm.axes.lateral);
    const U = new THREE.Vector3(0, 1, 0);
    const dirs = {
      front: A.clone(), back: A.clone().negate(), side: L.clone().addScaledVector(A, 0.08),
      top: U.clone().addScaledVector(A, 0.35).addScaledVector(L, 0.2), front3q: A.clone().addScaledVector(L, 0.75).addScaledVector(U, 0.18),
      back3q: A.clone().negate().addScaledVector(L, 0.7).addScaledVector(U, 0.15),
    };
    if (name === 'arm') {
      // whole upper limb, shoulder to fingertips, seen from the front-lateral side
      const tipY = this.lm.fingertipY ?? -680;
      const target = new THREE.Vector3(0, tipY * 0.47, 0).addScaledVector(L, 30).addScaledVector(A, 15);
      const d = A.clone().addScaledVector(L, 0.55).normalize();
      const h = Math.abs(tipY) + 300; // height to fit (mm), with margin
      const fov = THREE.MathUtils.degToRad(this.camera.fov);
      const dist = Math.max(h / 2 / Math.tan(fov / 2), (h * 0.45) / 2 / Math.tan(fov / 2) / this.camera.aspect);
      this._fly(target, target.clone().addScaledVector(d, dist), instant);
      return;
    }
    const dir = (dirs[name] || dirs.front).normalize();
    const portrait = this.camera.aspect < 0.9;
    const dist = portrait ? 1050 : 740;
    const target = this.center();
    this._fly(target, target.clone().addScaledVector(dir, dist), instant);
  }

  frameStructures(ids) {
    const box = new THREE.Box3();
    for (const id of ids) for (const m of this.meshesOf(id)) { if (!m.geometry.boundingBox) m.geometry.computeBoundingBox(); box.union(m.geometry.boundingBox.clone().applyMatrix4(m.matrixWorld)); }
    if (box.isEmpty()) return;
    const c = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3()).length();
    const dir = this.camera.position.clone().sub(this.controls.target).normalize();
    const portrait = this.camera.aspect < 0.9;
    const dist = THREE.MathUtils.clamp(size * 1.9, portrait ? 420 : 260, 900) / Math.min(1, this.camera.aspect + 0.35);
    this._fly(c, c.clone().addScaledVector(dir, dist));
  }

  _fly(target, pos, instant) {
    if (instant) { this.controls.target.copy(target); this.camera.position.copy(pos); return; }
    this._anim = { t: 0, from: { t: this.controls.target.clone(), p: this.camera.position.clone() }, to: { t: target, p: pos } };
  }

  zoom(f) {
    const d = this.camera.position.clone().sub(this.controls.target);
    const len = THREE.MathUtils.clamp(d.length() * f, this.controls.minDistance, this.controls.maxDistance);
    this._fly(this.controls.target.clone(), this.controls.target.clone().add(d.setLength(len)));
  }

  // ───────── structures / materials ─────────
  meshesOf(id) {
    const e = this.structs.get(id);
    if (!e) return [];
    if (e.def.kind === 'group') return e.def.members.flatMap((m) => this.meshesOf(m));
    return e.meshes;
  }

  expand(ids) {
    const out = new Set();
    for (const id of ids) {
      const d = BY_ID[id]; if (!d) continue;
      if (d.kind === 'group') d.members.forEach((m) => out.add(m)); else out.add(id);
    }
    return out;
  }

  setLayer(cat, patch) { Object.assign(this.layer[cat], patch); this.applyMaterials(); }

  setHighlights(map) { this.highlights = map; this.applyMaterials(); }

  select(id) {
    this.selected = id;
    this.applyMaterials();
    this.dispatchEvent(new CustomEvent('select', { detail: id }));
  }

  isolate(ids) { this.isolated = ids ? this.expand(ids) : null; this.applyMaterials(); }

  applyMaterials() {
    const sel = this.selected ? this.expand([this.selected]) : new Set();
    const focus = this.dimOthers && (sel.size || this.highlights.size);
    const hlSet = new Set([...this.highlights.keys()].flatMap((k) => [...this.expand([k])]));
    for (const m of this.meshes) {
      const { sid, cat } = m.userData;
      const L = this.layer[cat];
      const mat = m.material;
      let visible = L.visible;
      let op = L.opacity;
      const isSel = sel.has(sid);
      const hlKey = [...this.highlights.keys()].find((k) => this.expand([k]).has(sid));
      if (this.isolated) {
        if (this.isolated.has(sid)) { visible = true; op = Math.max(op, 0.95); }
        else if (cat === 'bone' || cat === 'context') { visible = true; op = Math.min(op, 0.16); }
        else visible = false;
      }
      if (isSel && !visible && !this.isolated) { visible = true; op = Math.max(op, 0.9); }
      if (hlKey && !this.isolated) { visible = true; op = Math.max(op, 0.85); }
      if (focus && !isSel && !hlSet.has(sid)) op *= cat === 'bone' ? 0.55 : cat === 'context' ? 0.5 : 0.11;
      if (mat.userData.translucent) op = Math.min(op, isSel || hlKey ? 0.7 : 0.32);
      m.visible = visible && op > 0.02;
      const transparent = op < 0.999;
      if (mat.transparent !== transparent) { mat.transparent = transparent; mat.needsUpdate = true; }
      mat.opacity = op;
      mat.depthWrite = !transparent || op > 0.6;
      m.renderOrder = transparent ? 2 + (1 - op) : 0;
      // colour / emissive
      mat.color.copy(mat.userData.baseColor);
      mat.emissive.setRGB(0, 0, 0);
      mat.emissiveIntensity = 1;
      m.userData.pulse = null;
      if (hlKey) { const c = this.highlights.get(hlKey); mat.color.lerp(c, 0.55); mat.emissive.copy(c).multiplyScalar(0.35); m.userData.pulse = 0.25; }
      if (isSel) { mat.color.lerp(HL.select, 0.45); mat.emissive.copy(HL.select).multiplyScalar(0.45); m.userData.pulse = 0.4; }
    }
    // attachment areas of the selected muscle (or of the muscle a selected tendon belongs to)
    const fpKeys = new Set();
    if (this.showAttachments) {
      for (const id of sel) {
        const d = BY_ID[id];
        const src = d?.cat === 'muscle' ? d : d?.cat === 'tendon' && d.source ? BY_ID[d.source] : null;
        if (!src) continue;
        const keys = id === 'lhb_t' ? ['biceps_long'] : src.meshes;
        keys.forEach((k) => fpKeys.add(k));
      }
    }
    const show = new Set();
    for (const [k, list] of Object.entries(this.footprints || {})) if (fpKeys.has(k)) list.forEach((m) => show.add(m));
    for (const list of Object.values(this.footprints || {})) for (const m of list) m.visible = show.has(m);
  }

  // ───────── pose / markers ─────────
  setPose(pose) { this.rig.setPose(pose); this.rig.apply(); this._updateMarkers(); }

  showMarker(id) {
    for (const [k, m] of Object.entries(this.markers)) m.visible = k === id;
    this._updateMarkers();
  }

  _updateMarkers() {
    for (const m of Object.values(this.markers || {})) {
      if (!m.visible) continue;
      m.position.copy(this.rig.transformPoint(m.userData.rest, m.userData.chain));
    }
  }

  // anchor (world) for label
  anchorOf(id) {
    const ms = this.meshesOf(id).filter((m) => m.visible);
    if (!ms.length) return null;
    const c = new THREE.Vector3(); let n = 0;
    for (const m of ms.slice(0, 3)) {
      if (!m.geometry.boundingSphere) m.geometry.computeBoundingSphere();
      c.add(m.geometry.boundingSphere.center.clone().applyMatrix4(m.matrixWorld)); n++;
    }
    return c.multiplyScalar(1 / n);
  }

  setTags(tags) { this.tags = tags; }

  // ───────── picking ─────────
  _bindPointer() {
    const el = this.canvas;
    el.addEventListener('pointerdown', (e) => { this._down = { x: e.clientX, y: e.clientY, t: performance.now() }; this.stopAutoRotate(); });
    el.addEventListener('pointerup', (e) => {
      if (!this._down) return;
      const moved = Math.hypot(e.clientX - this._down.x, e.clientY - this._down.y);
      this._down = null;
      if (moved > 6) return;
      const hit = this.pick(e.clientX, e.clientY);
      this.dispatchEvent(new CustomEvent('pick', { detail: hit }));
    });
    el.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse' || e.buttons) { this._hover(null); return; }
      const now = performance.now();
      if (now - this._hoverT < 60) return;
      this._hoverT = now;
      const hit = this.pick(e.clientX, e.clientY);
      this._hover(hit, e);
    });
    el.addEventListener('pointerleave', () => this._hover(null));
  }

  _hover(hit, e) {
    const tip = document.getElementById('hover-tip');
    if (!hit) { tip.style.display = 'none'; this.canvas.style.cursor = ''; return; }
    const d = BY_ID[hit.sid];
    const r = this.stage.getBoundingClientRect();
    tip.textContent = d.en + (hit.partLabel ? ` · ${hit.partLabel}` : '');
    tip.style.display = 'block';
    tip.style.left = e.clientX - r.left + 14 + 'px';
    tip.style.top = e.clientY - r.top + 12 + 'px';
    this.canvas.style.cursor = 'pointer';
  }

  pick(cx, cy) {
    const r = this.canvas.getBoundingClientRect();
    this.pointer.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const cands = this.meshes.filter((m) => m.visible && m.material.opacity > 0.06);
    for (const m of cands) if (!m.geometry.boundingSphere) m.geometry.computeBoundingSphere();
    const hits = this.raycaster.intersectObjects(cands, false);
    if (!hits.length) return null;
    const solid = hits.find((h) => h.object.material.opacity >= 0.4) || hits[0];
    const o = solid.object;
    const d = BY_ID[o.userData.sid];
    return { sid: o.userData.sid, part: o.userData.part, partLabel: partLabel(d, o.userData.part), point: solid.point };
  }

  stopAutoRotate() { if (this.autoRotate) { this.autoRotate = false; this.dispatchEvent(new Event('autorotate')); } }

  // ───────── loop ─────────
  _loop() {
    const tick = () => {
      requestAnimationFrame(tick);
      const dt = Math.min(0.05, this.clock.getDelta());
      const t = this.clock.elapsedTime;
      this.dispatchEvent(new CustomEvent('frame', { detail: dt }));
      if (this._anim) {
        this._anim.t = Math.min(1, this._anim.t + dt / 0.7);
        const k = 1 - Math.pow(1 - this._anim.t, 3);
        this.controls.target.lerpVectors(this._anim.from.t, this._anim.to.t, k);
        this.camera.position.lerpVectors(this._anim.from.p, this._anim.to.p, k);
        if (this._anim.t >= 1) this._anim = null;
      }
      if (this.autoRotate) {
        const off = this.camera.position.clone().sub(this.controls.target);
        off.applyAxisAngle(new THREE.Vector3(0, 1, 0), dt * 0.35);
        this.camera.position.copy(this.controls.target).add(off);
      }
      this.controls.update();
      this.camLight.position.copy(this.camera.position);
      this.camLight.target.position.copy(this.controls.target);
      for (const m of this.meshes) {
        if (m.userData.pulse) m.material.emissiveIntensity = 1 + Math.sin(t * 4) * m.userData.pulse;
      }
      for (const mk of Object.values(this.markers || {})) if (mk.visible) {
        const s = 1 + Math.sin(t * 3) * 0.12; mk.scale.setScalar(s);
        mk.children[0].lookAt(this.camera.position);
      }
      this.renderer.render(this.scene, this.camera);
      this._renderTags();
    };
    tick();
  }

  _renderTags() {
    const host = document.getElementById('labels');
    const w = this.stage.clientWidth, h = this.stage.clientHeight;
    const html = [];
    const placed = [];
    // the last tag is the primary one (selection) – place it first so it stays on its anchor,
    // then push the others away vertically until they no longer overlap
    const maxTags = w < 520 ? 3 : 8;
    for (const tg of [...this.tags].reverse().slice(0, maxTags)) {
      const p = this.anchorOf(tg.id);
      if (!p) continue;
      p.project(this.camera);
      if (p.z > 1) continue;
      const x = (p.x * 0.5 + 0.5) * w;
      let y = (-p.y * 0.5 + 0.5) * h - 6;
      const tw = tg.text.replace(/<[^>]+>/g, '').length * (tg.cls ? 6.2 : 6.8) + 20, th = 25;
      const hit = (yy) => placed.some((r) => Math.abs(r.x - x) < (r.w + tw) / 2 && Math.abs(r.y - yy) < th);
      let k = 0;
      const y0 = y;
      // stack upward only, so the anchored structure below the tag stays visible
      while (hit(y) && k < 10) { k++; y = y0 - k * th; }
      placed.push({ x, y, w: tw });
      html.push(`<div class="tag ${tg.cls || ''}" style="left:${x.toFixed(0)}px;top:${y.toFixed(0)}px">${tg.text}</div>`);
    }
    const s = html.join('');
    if (s !== this._lastTags) { host.innerHTML = s; this._lastTags = s; }
  }
}

export { CHAIN_OF_LEVEL };
