import './style.css';
import { Viewer, partLabel } from './viewer.js';
import { interpPose } from './rig.js';
import { HL } from './materials.js';
import { STRUCTURES, BY_ID, CATEGORIES } from './data/structures.js';
import { MOVEMENTS } from './data/movements.js';
import { CONDITIONS } from './data/conditions.js';
import { REGIONS, RED_FLAGS } from './data/regions.js';
import { REFERENCES } from './data/references.js';

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const CAT = Object.fromEntries(CATEGORIES.map((c) => [c.id, c]));
const catColor = (id) => { const d = BY_ID[id]; if (!d) return '#888'; if (d.cat === 'vessel') return d.venous ? '#3f6fd8' : '#e0353f'; return CAT[d.cat].color; };
const hex = (c) => '#' + c.getHexString();
const groupHead = (arr, i, key, labels) => (i === 0 || (arr[i - 1][key] || 'shoulder') !== (arr[i][key] || 'shoulder')) ? `<div class="zone-head" style="padding-left:2px">${labels[arr[i][key] || 'shoulder']}</div>` : '';
const ZONES = { shoulder: 'Bahu & lengan atas', elbow: 'Siku & lengan bawah', hand: 'Pergelangan & tangan' };

const state = {
  mode: 'explore', sel: null, part: null, movement: null, condition: null, region: null,
  playing: false, phase: 0, speed: 1, openCats: new Set(['muscle']), search: '', xray: false,
};

const viewer = new Viewer($('#c'), $('#stage'));
const left = $('#left'), right = $('#right'), bottom = $('#bottom');

// ───────────────────────── boot ─────────────────────────
viewer.load('./models/shoulder.glb', './models/landmarks.json', (p) => { $('#loader-text').textContent = `Memuat model anatomi… ${Math.round(p * 100)}%`; })
  .then(() => { $('#loader').classList.add('hide'); render(); applyUrlParams(); })
  .catch((e) => { console.error(e); $('#loader-text').textContent = 'Gagal memuat model: ' + e.message; });

viewer.addEventListener('pick', (e) => {
  const hit = e.detail;
  if (!hit) { if (state.mode === 'explore') selectStructure(null); return; }
  selectStructure(hit.sid, hit.part);
});
viewer.addEventListener('autorotate', () => $('[data-act=rotate]').classList.toggle('on', viewer.autoRotate));
viewer.addEventListener('frame', (e) => tickMovement(e.detail));

// ───────────────────────── modes ─────────────────────────
$('#modes').addEventListener('click', (e) => {
  const b = e.target.closest('button[data-mode]');
  if (b) setMode(b.dataset.mode);
});

function setMode(mode) {
  state.mode = mode;
  document.querySelectorAll('#modes button').forEach((b) => b.classList.toggle('active', b.dataset.mode === mode));
  state.playing = false;
  state.sel = null; state.part = null;
  viewer.selected = null;
  viewer.dimOthers = false;
  viewer.isolate(null);
  $('[data-act=isolate]').classList.remove('on');
  viewer.showMarker(null);
  viewer.setHighlights(new Map());
  viewer.setTags([]);
  if (mode !== 'movement') { state.movement = null; viewer.setPose(null); }
  if (mode === 'movement' && !state.movement) { pickMovement(MOVEMENTS[0].id, false); }
  if (mode !== 'injury') state.condition = null;
  if (mode !== 'pain') state.region = null;
  render();
  if (isMobile() && mode !== 'explore') openDrawer('left');
}

// ───────────────────────── selection ─────────────────────────
function selectStructure(id, part = null, { frame = false } = {}) {
  state.sel = id; state.part = part;
  viewer.select(id);
  updateTags();
  if (frame && id) viewer.frameStructures([id]);
  if (viewer.isolated && id) viewer.isolate([id]);
  renderLeft();
  renderRight();
  if (id && isMobile()) openDrawer('right');
}

function updateTags() {
  const tags = [];
  if (state.mode === 'movement' && state.movement) {
    const mv = MOVEMENTS.find((m) => m.id === state.movement);
    mv.prime.forEach(([id]) => tags.push({ id, text: BY_ID[id].en, cls: 'sec' }));
  }
  if (state.mode === 'injury' && state.condition) {
    const c = CONDITIONS.find((x) => x.id === state.condition);
    c.affected.slice(0, 5).forEach((id) => tags.push({ id, text: BY_ID[id].en, cls: 'sec' }));
  }
  if (state.mode === 'pain' && state.region) {
    const r = REGIONS.find((x) => x.id === state.region);
    r.structures.slice(0, 4).forEach((id) => tags.push({ id, text: BY_ID[id].en, cls: 'sec' }));
  }
  if (state.sel) {
    const d = BY_ID[state.sel];
    const filtered = tags.filter((t) => t.id !== state.sel);
    const pl = partLabel(d, state.part);
    filtered.push({ id: state.sel, text: esc(d.en) + (pl ? ` <span style="opacity:.7">· ${esc(pl.split(' – ')[0])}${state.part.endsWith('__tendon') ? ' (tendon)' : ''}</span>` : '') });
    viewer.setTags(filtered);
  } else viewer.setTags(tags);
}

// ───────────────────────── toolbar ─────────────────────────
$('#toolbar').addEventListener('click', (e) => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.dataset.view) { viewer.view(b.dataset.view); return; }
  const act = b.dataset.act;
  if (act === 'reset') { viewer.home(); }
  if (act === 'zoomin') viewer.zoom(0.75);
  if (act === 'zoomout') viewer.zoom(1.33);
  if (act === 'rotate') { viewer.autoRotate = !viewer.autoRotate; b.classList.toggle('on', viewer.autoRotate); }
  if (act === 'isolate') toggleIsolate();
  if (act === 'xray') {
    state.xray = !state.xray; b.classList.toggle('on', state.xray);
    viewer.setLayer('muscle', { opacity: state.xray ? 0.22 : 1 });
    viewer.setLayer('context', { opacity: state.xray ? 0.25 : 0.55 });
    renderLeft();
  }
  if (act === 'showall') {
    for (const c of CATEGORIES) viewer.layer[c.id] = { visible: true, opacity: c.id === 'context' ? 0.55 : c.id === 'joint' ? 0.6 : 1 };
    state.xray = false; $('[data-act=xray]').classList.remove('on');
    viewer.isolate(null); $('[data-act=isolate]').classList.remove('on');
    viewer.applyMaterials(); renderLeft();
  }
});

function toggleIsolate(force) {
  const on = force ?? !viewer.isolated;
  const ids = currentFocusIds();
  if (on && !ids.length) { toast('Pilih struktur dulu untuk diisolasi.'); return; }
  viewer.isolate(on ? ids : null);
  $('[data-act=isolate]').classList.toggle('on', on);
  if (on) viewer.frameStructures(ids);
  renderRight();
}

function currentFocusIds() {
  if (state.sel) return [state.sel];
  if (state.mode === 'movement' && state.movement) { const m = MOVEMENTS.find((x) => x.id === state.movement); return [...m.prime, ...m.synergist].map(([id]) => id).concat(m.tendons); }
  if (state.mode === 'injury' && state.condition) return CONDITIONS.find((x) => x.id === state.condition).affected;
  if (state.mode === 'pain' && state.region) return REGIONS.find((x) => x.id === state.region).structures;
  return [];
}

// ───────────────────────── left panel ─────────────────────────
function render() { renderLeft(); renderRight(); renderBottom(); renderLegend(); }

function renderLeft() {
  if (state.mode === 'explore') return renderLayers();
  if (state.mode === 'movement') return renderMovementList();
  if (state.mode === 'injury') return renderConditionList();
  if (state.mode === 'pain') return renderPainMap();
}

function kindBadge(d) {
  if (d.kind === 'region') return `<span class="badge region" title="${d.derived ? 'Bagian dari mesh otot asli, batas otot–tendon diturunkan dari area insersio asli' : 'Bagian dari mesh tulang asli, dipilih otomatis'}">${d.derived ? 'tendon turunan' : 'bagian mesh'}</span>`;
  if (d.kind === 'group') return '<span class="badge">grup</span>';
  return '';
}

function renderLayers() {
  const q = state.search.trim().toLowerCase();
  let html = `<div class="side-head"><h2>Lapisan anatomi</h2><input class="search" id="search" placeholder="Cari: deltoid, tendon, saraf…" value="${esc(state.search)}" /></div><div class="side-body">`;
  for (const c of CATEGORIES) {
    const items = STRUCTURES.filter((s) => s.cat === c.id && (!q || (s.en + ' ' + s.idn).toLowerCase().includes(q)));
    if (q && !items.length) continue;
    const L = viewer.layer[c.id];
    const open = state.openCats.has(c.id) || !!q;
    html += `<div class="layer ${open ? 'open' : ''}" data-cat="${c.id}">
      <div class="layer-head" data-toggle="${c.id}">
        <button class="eye ${L.visible ? '' : 'off'}" data-eye="${c.id}" title="Tampilkan/sembunyikan">${L.visible ? '👁' : '◌'}</button>
        <span class="sw" style="background:${c.color}"></span>
        <span class="name">${c.label} <small style="color:var(--dim);font-weight:400">${c.en}</small></span>
        <span class="count">${items.length}</span><span class="chev">▶</span>
      </div>
      <div class="layer-op"><span>Opasitas</span><input type="range" min="0" max="1" step="0.05" value="${L.opacity}" data-op="${c.id}" aria-label="Opasitas ${c.label}"/></div>
      <div class="layer-items">${items.map((s, i) => {
        const z = s.zone || 'shoulder';
        const multi = new Set(items.map((x) => x.zone || 'shoulder')).size > 1;
        const head = multi && (i === 0 || (items[i - 1].zone || 'shoulder') !== z) ? `<div class="zone-head">${ZONES[z]}</div>` : '';
        return `${head}
        <div class="item ${state.sel === s.id ? 'sel' : ''}" data-sid="${s.id}">
          <span class="label">${esc(s.en)}<small>${esc(s.idn)}</small></span>${kindBadge(s)}
        </div>`;
      }).join('')}</div>
    </div>`;
  }
  html += `<p class="hint">Klik struktur pada model atau daftar ini. Seret untuk memutar, scroll/pinch untuk zoom, klik-kanan/dua jari untuk menggeser.</p></div>`;
  left.innerHTML = html;
  const s = $('#search');
  s.addEventListener('input', () => { state.search = s.value; const pos = s.selectionStart; renderLayers(); const n = $('#search'); n.focus(); n.setSelectionRange(pos, pos); });
}

left.addEventListener('click', (e) => {
  const eye = e.target.closest('[data-eye]');
  if (eye) { e.stopPropagation(); const c = eye.dataset.eye; viewer.setLayer(c, { visible: !viewer.layer[c].visible }); renderLayers(); return; }
  const tg = e.target.closest('[data-toggle]');
  if (tg) { const c = tg.dataset.toggle; state.openCats.has(c) ? state.openCats.delete(c) : state.openCats.add(c); renderLayers(); return; }
  const it = e.target.closest('[data-sid]');
  if (it) { selectStructure(it.dataset.sid, null, { frame: true }); return; }
  const mv = e.target.closest('[data-mv]');
  if (mv) { pickMovement(mv.dataset.mv); return; }
  const cd = e.target.closest('[data-cond]');
  if (cd) { pickCondition(cd.dataset.cond); return; }
  const rg = e.target.closest('[data-region]');
  if (rg) { pickRegion(rg.dataset.region); return; }
});
left.addEventListener('input', (e) => {
  const op = e.target.closest('[data-op]');
  if (op) viewer.setLayer(op.dataset.op, { opacity: +op.value, visible: true });
});

function renderMovementList() {
  left.innerHTML = `<div class="side-head"><h2>Gerakan</h2></div><div class="side-body">
    <p class="hint">Pilih gerakan untuk melihat peragaan 3D, otot penggerak utama, tendon, dan sendi yang terlibat.</p>
    ${MOVEMENTS.map((m, i) => `${groupHead(MOVEMENTS, i, 'zone', { shoulder: 'Bahu', elbow: 'Siku' })}<div class="list-card ${state.movement === m.id ? 'active' : ''}" data-mv="${m.id}"><div class="t">${m.idn}</div><div class="s">${m.en} · ${m.range}</div></div>`).join('')}
    <p class="hint" style="margin-top:12px">Animasi fleksi/abduksi diperagakan sampai ±120° (bukan 180°) agar bentuk otot tetap wajar. Animasi menyederhanakan gerak tulang belikat (scapulohumeral rhythm) dan memakai pembengkokan otot otomatis – bentuk otot saat bergerak adalah perkiraan visual.</p>
  </div>`;
}

function renderConditionList() {
  left.innerHTML = `<div class="side-head"><h2>Katalog cedera</h2></div><div class="side-body">
    <div class="disclaimer"><b>Katalog edukasi, bukan alat diagnosis.</b> Banyak kondisi memiliki gejala yang mirip. Diagnosis hanya bisa ditegakkan dokter melalui pemeriksaan langsung.</div>
    ${CONDITIONS.map((c, i) => `${groupHead(CONDITIONS, i, 'zone', { shoulder: 'Bahu', arm: 'Siku, pergelangan & tangan' })}<div class="list-card ${state.condition === c.id ? 'active' : ''}" data-cond="${c.id}"><div class="t">${c.en}</div><div class="s">${c.idn}</div></div>`).join('')}
  </div>`;
}

function bodySvg(side) {
  // Simple upper-body silhouette; the person's RIGHT shoulder is on the viewer's left in front view.
  const body = `<path class="body" d="M100 18c13 0 22 10 22 24s-9 26-22 26-22-12-22-26 9-24 22-24z"/>
    <path class="body" d="M86 66h28l4 14c14 2 34 6 44 14 10 8 12 22 14 36l8 70c1 8-10 10-12 2l-12-62-6 4v98H50V84l-6-4-12 62c-2 8-13 6-12-2l8-70c2-14 4-28 14-36 10-8 30-12 44-14z"/>`;
  const zones = side === 'front'
    ? [
      ['superior', 'M44 82c8-6 22-10 34-10l2 10c-12 1-24 5-32 10z'],
      ['anterior', 'M52 96c6-4 16-7 24-8l2 22c-8 1-16 4-22 8z'],
      ['lateral', 'M30 96c2-6 6-10 12-13l8 12c-3 3-6 8-7 13z'],
      ['axilla', 'M58 122c6-3 12-5 18-5l-2 18c-6 0-11 2-15 4z'],
      ['arm_junction', 'M26 116l13 3-4 28-13-3z'],
      ['elbow', 'M21 152l14 2-2 15-14-2z'],
      ['hand', 'M17 185l14 2-1 13c-1 7-13 7-13 0z'],
    ]
    : [
      ['superior', 'M156 82c-8-6-22-10-34-10l-2 10c12 1 24 5 32 10z'],
      ['posterior', 'M148 96c-6-4-16-7-24-8l-2 22c8 1 16 4 22 8z'],
      ['lateral', 'M170 96c-2-6-6-10-12-13l-8 12c3 3 6 8 7 13z'],
      ['scapular', 'M104 100h18c4 0 6 3 6 6v34c0 4-3 6-6 6h-14c-3 0-4-2-4-5z'],
      ['arm_junction', 'M174 116l-13 3 4 28 13-3z'],
      ['elbow', 'M179 152l-14 2 2 15 14-2z'],
      ['hand', 'M183 185l-14 2 1 13c1 7 13 7 13 0z'],
    ];
  return `<svg viewBox="0 0 200 260" role="img" aria-label="Diagram tubuh ${side === 'front' ? 'depan' : 'belakang'}">${body}
    ${zones.map(([id, d]) => `<path class="zone ${state.region === id ? 'active' : ''}" data-region="${id}" d="${d}"><title>${REGIONS.find((r) => r.id === id).idn}</title></path>`).join('')}
    <text x="${side === 'front' ? 30 : 170}" y="250" fill="#8d97a7" font-size="10" text-anchor="middle">kanan</text></svg>`;
}

function renderPainMap() {
  left.innerHTML = `<div class="side-head"><h2>Eksplorasi lokasi nyeri</h2></div><div class="side-body">
    <div class="disclaimer">Fitur ini menunjukkan <b>struktur yang berada di sekitar</b> area yang dipilih untuk dipelajari – <b>bukan diagnosis</b>. Nyeri bisa dirasakan jauh dari sumbernya (nyeri rujukan).</div>
    <div class="bodymap"><figure><figcaption>Depan</figcaption>${bodySvg('front')}</figure><figure><figcaption>Belakang</figcaption>${bodySvg('back')}</figure></div>
    ${REGIONS.map((r) => `<div class="list-card ${state.region === r.id ? 'active' : ''}" data-region="${r.id}"><div class="t">${r.idn}</div><div class="s">${r.en}</div></div>`).join('')}
  </div>`;
}

// ───────────────────────── right panel ─────────────────────────
function linkChip(id) { const d = BY_ID[id]; if (!d) return ''; return `<span class="link-chip" data-link="${id}"><i style="background:${catColor(id)}"></i>${esc(d.en)}</span>`; }
const list = (arr) => `<ul>${arr.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>`;

function structureDetail(id) {
  const d = BY_ID[id];
  const cat = CAT[d.cat];
  const iso = viewer.isolated?.has(id) || (d.kind === 'group' && d.members.every((m) => viewer.isolated?.has(m)));
  const back = state.mode !== 'explore' && (state.movement || state.condition || state.region) ? `<button class="chip-btn" data-act="back">← Kembali</button>` : '';
  let kindNote = '';
  if (d.kind === 'region' && d.cat === 'tendon') kindNote = `<div class="note">Model sumber (Z-Anatomy) tidak memisahkan tendon otot ini dari perut ototnya. Area tendon di model adalah bagian mesh otot asli dalam radius ±${viewer.lm.derivedTendons?.[id] ?? 20} mm dari <b>area insersio asli</b> pada humerus (ditampilkan biru) – sesuai panjang khas tendon rotator cuff, tetapi batas tepatnya tetap perkiraan.</div>`;
  else if (d.cat === 'tendon') kindNote = `<div class="note">Tendon ini dimodelkan langsung oleh Z-Anatomy sebagai jaringan tendon otot (mesh asli).</div>`;
  if (d.kind === 'region' && d.cat === 'bone') kindNote = `<div class="note">Bagian dari mesh skapula asli, dipilih otomatis berdasarkan posisinya (sumber tidak memisahkannya).</div>`;
  if (id === 'glenoid') kindNote = `<div class="note">Yang disorot adalah tulang rawan sendi (articular cartilage) glenoid, dimodelkan langsung oleh Z-Anatomy.</div>`;
  const hasFp = (d.cat === 'muscle' || (d.cat === 'tendon' && d.source)) && Object.keys(viewer.footprints || {}).some((k) => (d.meshes || BY_ID[d.source]?.meshes || []).includes(k));
  const fpNote = hasFp ? `<div class="sec"><h3>Tempat melekat pada model</h3><p><span style="color:#ff8a7d">■ Merah</span> = area origin, <span style="color:#7fb0ff">■ biru</span> = area insertion pada tulang (area perlekatan asli dari Z-Anatomy). Sembunyikan lapisan otot (atau pakai X-ray) untuk melihatnya.</p></div>` : '';
  return `<div class="detail">
    <div class="cat-pill"><i style="background:${catColor(id)}"></i>${cat.label} · ${cat.en} ${kindBadge(d)}</div>
    <h1>${esc(d.en)}</h1>
    <div class="idn">${esc(d.idn)}</div>
    ${partLabel(d, state.part) ? `<div class="part">Bagian yang diklik: ${esc(partLabel(d, state.part))}</div>` : ''}
    <div class="actions">
      ${back}
      <button class="chip-btn ${iso ? 'on' : ''}" data-act="iso">◎ ${iso ? 'Keluar isolasi' : 'Isolasi'}</button>
      <button class="chip-btn" data-act="focus">⌖ Fokus kamera</button>
      <button class="chip-btn" data-act="deselect">✕ Tutup</button>
    </div>
    <div class="sec"><h3>Fungsi utama</h3><p>${esc(d.func)}</p></div>
    <div class="sec"><h3>Letak & posisi</h3><p>${esc(d.location)}</p></div>
    ${d.origin && d.origin !== '—' ? `<div class="oi"><div class="o"><b>Origin · asal</b>${esc(d.origin)}</div><div class="i"><b>Insertion · tempat melekat</b>${esc(d.insertion)}</div></div>` : ''}
    ${fpNote}
    ${d.attachments ? `<div class="sec"><h3>Tempat melekat otot/ligamen</h3><p>${esc(d.attachments)}</p></div>` : ''}
    ${d.innervation ? `<div class="sec"><h3>Persarafan · innervation</h3><p>${esc(d.innervation)}</p></div>` : ''}
    ${d.movements && d.movements !== '—' ? `<div class="sec"><h3>Gerakan yang dibantu</h3><p>${esc(d.movements)}</p></div>` : ''}
    ${movementChips(id)}
    ${d.related?.length ? `<div class="sec"><h3>Struktur terkait</h3><div class="links">${d.related.map(linkChip).join('')}</div></div>` : ''}
    ${d.injuries?.length && d.injuries[0] !== '—' ? `<div class="sec"><h3>Cedera umum</h3>${list(d.injuries)}</div>` : ''}
    ${d.symptoms?.length && d.symptoms[0] !== '—' ? `<div class="sec"><h3>Gejala umum bila terganggu</h3>${list(d.symptoms)}</div>` : ''}
    ${conditionChips(id)}
    ${kindNote}
    <div class="note">Informasi bersifat edukatif. Struktur di model adalah bahu <b>kanan</b>.</div>
  </div>`;
}

function movementChips(id) {
  const ids = new Set([id, ...(BY_ID[id].kind === 'group' ? BY_ID[id].members : [])]);
  const mvs = MOVEMENTS.filter((m) => [...m.prime, ...m.synergist].some(([s]) => ids.has(s)) || m.tendons.some((t) => ids.has(t)) || m.joints.includes(id));
  if (!mvs.length) return '';
  return `<div class="sec"><h3>Lihat dalam simulasi gerakan</h3><div class="links">${mvs.map((m) => {
    const isPrime = m.prime.some(([s]) => ids.has(s));
    return `<span class="link-chip" data-gomv="${m.id}"><i style="background:${isPrime ? hex(HL.prime) : hex(HL.synergist)}"></i>${m.idn}</span>`;
  }).join('')}</div></div>`;
}

function conditionChips(id) {
  const cs = CONDITIONS.filter((c) => c.affected.includes(id));
  if (!cs.length) return '';
  return `<div class="sec"><h3>Ada di katalog cedera</h3><div class="links">${cs.map((c) => `<span class="link-chip" data-gocond="${c.id}"><i style="background:${hex(HL.affected)}"></i>${esc(c.en)}</span>`).join('')}</div></div>`;
}

function movementDetail() {
  const m = MOVEMENTS.find((x) => x.id === state.movement);
  const role = (arr, color) => arr.map(([id, desc]) => `<div class="role" data-link="${id}"><span class="dot" style="background:${hex(color)}"></span><div><div class="rn">${esc(BY_ID[id].en)} <span style="color:var(--muted);font-weight:400">· ${esc(BY_ID[id].idn)}</span></div><div class="rd">${esc(desc)}</div></div></div>`).join('');
  return `<div class="detail">
    <div class="cat-pill"><i style="background:var(--accent)"></i>Simulasi gerakan</div>
    <h1>${esc(m.en)}</h1><div class="idn">${esc(m.idn)} · ${esc(m.range)}</div>
    <p>${esc(m.desc)}</p>
    <div class="sec"><h3>Otot penggerak utama (prime movers)</h3><div class="role-list">${role(m.prime, HL.prime)}</div></div>
    <div class="sec"><h3>Otot pembantu & penstabil</h3><div class="role-list">${role(m.synergist, HL.synergist)}</div></div>
    ${m.tendons.length ? `<div class="sec"><h3>Tendon yang terlibat</h3><div class="links">${m.tendons.map(linkChip).join('')}</div></div>` : ''}
    <div class="sec"><h3>Struktur sendi yang terlibat</h3><div class="links">${m.joints.map(linkChip).join('')}</div></div>
    ${m.note ? `<div class="note">${esc(m.note)}</div>` : ''}
    <div class="note">Klik nama otot untuk detail lengkap. Warna: <span style="color:${hex(HL.prime)}">■ utama</span> · <span style="color:${hex(HL.synergist)}">■ pembantu</span> · <span style="color:${hex(HL.tendon)}">■ tendon</span> · <span style="color:${hex(HL.joint)}">■ sendi</span></div>
  </div>`;
}

function conditionDetail() {
  const c = CONDITIONS.find((x) => x.id === state.condition);
  return `<div class="detail">
    <div class="cat-pill"><i style="background:${hex(HL.affected)}"></i>Katalog cedera · edukasi</div>
    <h1>${esc(c.en)}</h1><div class="idn">${esc(c.idn)}</div>
    <div class="disclaimer" style="margin-top:8px">Bukan diagnosis. Gunakan untuk memahami istilah & lokasi anatomi, lalu diskusikan dengan dokter.</div>
    <div class="sec"><h3>Apa yang terjadi</h3><p>${esc(c.what)}</p></div>
    <div class="sec"><h3>Struktur yang terdampak (disorot merah)</h3><div class="links">${c.affected.map(linkChip).join('')}</div></div>
    <div class="sec"><h3>Gejala yang umum</h3>${list(c.symptoms)}</div>
    <div class="sec" ${c.movements.length ? '' : 'hidden'}><h3>Gerakan yang mungkin terasa terganggu</h3><div class="links">${c.movements.map((id) => { const m = MOVEMENTS.find((x) => x.id === id); return `<span class="link-chip" data-gomv="${id}"><i style="background:var(--accent)"></i>${m.idn}</span>`; }).join('')}</div></div>
    <div class="sec"><h3>Pemeriksaan yang biasa digunakan dokter</h3>${list(c.exams)}</div>
  </div>`;
}

function regionDetail() {
  const r = REGIONS.find((x) => x.id === state.region);
  return `<div class="detail">
    <div class="cat-pill"><i style="background:#ff4d6d"></i>Lokasi nyeri · eksplorasi</div>
    <h1>${esc(r.idn)}</h1><div class="idn">${esc(r.en)}</div>
    <p>${esc(r.note)}</p>
    <div class="sec"><h3>Struktur di sekitar area ini (untuk dipelajari)</h3><div class="role-list">${r.structures.map((id) => `<div class="role" data-link="${id}"><span class="dot" style="background:${catColor(id)}"></span><div><div class="rn">${esc(BY_ID[id].en)}</div><div class="rd">${esc(BY_ID[id].idn)} · ${CAT[BY_ID[id].cat].label}</div></div></div>`).join('')}</div></div>
    <div class="sec"><h3>Kondisi di katalog yang melibatkan struktur ini</h3><div class="links">${CONDITIONS.filter((c) => c.affected.some((a) => r.structures.includes(a))).map((c) => `<span class="link-chip" data-gocond="${c.id}"><i style="background:${hex(HL.affected)}"></i>${esc(c.en)}</span>`).join('')}</div></div>
    <div class="disclaimer" style="margin-top:14px"><b>Segera cari pertolongan medis bila:</b>${list(RED_FLAGS)}</div>
  </div>`;
}

function welcome() {
  return `<div class="empty"><h2>Mulai menjelajah</h2>
    <ol>
      <li><b>Putar</b> model dengan menyeret, <b>zoom</b> dengan scroll/pinch, <b>geser</b> dengan klik-kanan atau dua jari.</li>
      <li><b>Klik</b> otot, tendon, tulang, atau ligamen untuk melihat nama, origin, insertion, dan fungsinya.</li>
      <li>Atur <b>lapisan & transparansi</b> di panel kiri, atau gunakan <b>X-ray</b> untuk melihat struktur di bawah otot.</li>
      <li>Coba mode <b>Gerakan</b>, <b>Cedera</b>, dan <b>Lokasi nyeri</b> di atas.</li>
    </ol>
    <div class="note">Model: Z-Anatomy (turunan BodyParts3D, data anatomi nyata, bahu kanan) – tulang, otot dengan bagian tendonnya, ligamen, labrum, bursa, kapsul sendi, saraf, dan pembuluh darah semuanya mesh asli. Klik sebuah otot untuk melihat area origin (merah) & insertion (biru) di tulang.</div>
    <div class="disclaimer" style="margin-top:14px">Aplikasi ini untuk edukasi, bukan pengganti konsultasi atau diagnosis dokter.</div>
  </div>`;
}

function renderRight() {
  let html;
  if (state.sel) html = structureDetail(state.sel);
  else if (state.mode === 'movement' && state.movement) html = movementDetail();
  else if (state.mode === 'injury' && state.condition) html = conditionDetail();
  else if (state.mode === 'pain' && state.region) html = regionDetail();
  else if (state.mode === 'injury') html = `<div class="empty"><h2>Pilih kondisi</h2><p>Pilih salah satu kondisi di panel kiri untuk melihat struktur yang terdampak pada model 3D, gejala umum, gerakan yang terganggu, dan pemeriksaan yang biasa dilakukan dokter.</p></div>`;
  else if (state.mode === 'pain') html = `<div class="empty"><h2>Pilih area</h2><p>Klik area pada diagram tubuh untuk melihat struktur anatomi yang berada di sekitarnya.</p></div>`;
  else html = welcome();
  right.innerHTML = html;
  right.scrollTop = 0;
}

right.addEventListener('click', (e) => {
  const lk = e.target.closest('[data-link]');
  if (lk) { selectStructure(lk.dataset.link, null, { frame: state.mode === 'explore' }); return; }
  const gm = e.target.closest('[data-gomv]');
  if (gm) { setMode('movement'); pickMovement(gm.dataset.gomv); return; }
  const gc = e.target.closest('[data-gocond]');
  if (gc) { setMode('injury'); pickCondition(gc.dataset.gocond); return; }
  const b = e.target.closest('[data-act]');
  if (!b) return;
  const a = b.dataset.act;
  if (a === 'iso') toggleIsolate();
  if (a === 'focus') viewer.frameStructures([state.sel]);
  if (a === 'deselect' || a === 'back') { selectStructure(null); if (isMobile() && a === 'deselect') closeDrawers(); }
});

// ───────────────────────── movement ─────────────────────────
function pickMovement(id, play = true) {
  state.movement = id; state.sel = null; viewer.selected = null;
  const m = MOVEMENTS.find((x) => x.id === id);
  const hl = new Map();
  m.joints.forEach((j) => hl.set(j, HL.joint));
  m.tendons.forEach((t) => hl.set(t, HL.tendon));
  m.synergist.forEach(([s]) => hl.set(s, HL.synergist));
  m.prime.forEach(([s]) => hl.set(s, HL.prime));
  viewer.setHighlights(hl);
  viewer.dimOthers = false;
  state.phase = 0;
  state.playing = play;
  state.transition = { t: 0, from: viewer._lastPose || null };
  updateTags();
  renderLeft(); renderRight(); renderBottom(); renderLegend();
}

function movementPose(m, t) {
  const from = m.reverse ? m.pose : (m.pose.from || { elbow: m.pose.elbow });
  const to = m.reverse ? { elbow: 0 } : m.pose;
  return interpPose(from, to, t);
}

function tickMovement(dt) {
  if (state.mode !== 'movement' || !state.movement) return;
  const m = MOVEMENTS.find((x) => x.id === state.movement);
  if (state.playing) state.phase = (state.phase + dt * 0.22 * state.speed) % 1;
  const t = (1 - Math.cos(state.phase * Math.PI * 2)) / 2;
  let pose = movementPose(m, t);
  if (state.transition && state.transition.t < 1) {
    state.transition.t = Math.min(1, state.transition.t + dt / 0.6);
    if (state.transition.from) pose = interpPose(state.transition.from, pose, state.transition.t);
  }
  const key = JSON.stringify(pose);
  if (key !== viewer._lastPoseKey) { viewer.setPose(pose); viewer._lastPoseKey = key; viewer._lastPose = pose; }
  const sl = $('#mv-slider');
  if (sl && state.playing) sl.value = t;
  const ang = $('#mv-angle');
  if (ang) ang.textContent = angleText(m, pose);
}

function angleText(m, pose) {
  const g = pose.girdle || {};
  const sum = (axis) => pose.gh.filter(([a]) => a === axis).reduce((s, [, v]) => s + v, 0);
  if (m.id === 'flexion') return `≈${Math.round(sum('ml') + g.upRot * 0.6 + g.elev * 0.4)}°`;
  if (m.id === 'extension') return `≈${Math.round(-sum('ml'))}°`;
  if (m.id === 'abduction' || m.id === 'adduction') return `≈${Math.round(sum('ap') + g.upRot + g.elev)}°`;
  if (m.id.includes('rotation')) return `≈${Math.round(Math.abs(sum('long')))}°`;
  return `≈${Math.round(-sum('vert'))}°`;
}

function renderBottom() {
  if (state.mode !== 'movement' || !state.movement) { bottom.innerHTML = ''; return; }
  const m = MOVEMENTS.find((x) => x.id === state.movement);
  bottom.innerHTML = `<div class="anim">
    <button class="play" id="mv-play" aria-label="${state.playing ? 'Jeda' : 'Putar'}">${state.playing ? '❚❚' : '▶'}</button>
    <div class="mv-name">${esc(m.idn)}<small>${esc(m.en)}</small></div>
    <input type="range" id="mv-slider" min="0" max="1" step="0.005" value="0" aria-label="Posisi gerakan" />
    <span class="angle" id="mv-angle">0°</span>
    <select id="mv-speed" aria-label="Kecepatan"><option value="0.5">0.5×</option><option value="1" selected>1×</option><option value="1.6">1.6×</option></select>
  </div>
  <div class="mv-chips">${MOVEMENTS.map((x) => `<button data-chip="${x.id}" class="${x.id === m.id ? 'active' : ''}">${x.idn}</button>`).join('')}</div>`;
  $('#mv-speed').value = String(state.speed);
}

bottom.addEventListener('click', (e) => {
  if (e.target.closest('#mv-play')) { state.playing = !state.playing; renderBottom(); return; }
  const c = e.target.closest('[data-chip]');
  if (c) pickMovement(c.dataset.chip);
});
bottom.addEventListener('input', (e) => {
  if (e.target.id === 'mv-slider') {
    state.playing = false;
    const t = +e.target.value;
    state.phase = Math.acos(1 - 2 * t) / (Math.PI * 2);
    const b = $('#mv-play'); b.textContent = '▶';
  }
  if (e.target.id === 'mv-speed') state.speed = +e.target.value;
});

// ───────────────────────── injury / pain ─────────────────────────
function pickCondition(id) {
  state.condition = id; state.sel = null; viewer.selected = null;
  const c = CONDITIONS.find((x) => x.id === id);
  viewer.setHighlights(new Map(c.affected.map((a) => [a, HL.affected])));
  viewer.dimOthers = true;
  viewer.applyMaterials();
  viewer.frameStructures(c.affected.slice(0, 3));
  updateTags();
  renderLeft(); renderRight(); renderLegend();
  if (isMobile()) openDrawer('right');
}

function pickRegion(id) {
  state.region = id; state.sel = null; viewer.selected = null;
  const r = REGIONS.find((x) => x.id === id);
  viewer.setHighlights(new Map(r.structures.map((a) => [a, HL.region])));
  viewer.dimOthers = true;
  viewer.applyMaterials();
  viewer.showMarker(r.marker);
  const views = { anterior: 'front3q', lateral: 'side', posterior: 'back3q', superior: 'top', scapular: 'back', axilla: 'front', arm_junction: 'front3q' };
  viewer.view(views[id]);
  updateTags();
  renderLeft(); renderRight(); renderLegend();
  if (isMobile()) openDrawer('right');
}

// ───────────────────────── legend ─────────────────────────
function renderLegend() {
  const el = $('#legend');
  const sw = (c, t) => `<span><i style="background:${c}"></i>${t}</span>`;
  if (state.mode === 'movement') el.innerHTML = sw(hex(HL.prime), 'Otot utama') + sw(hex(HL.synergist), 'Otot pembantu') + sw(hex(HL.tendon), 'Tendon') + sw(hex(HL.joint), 'Sendi');
  else if (state.mode === 'injury') el.innerHTML = sw(hex(HL.affected), 'Struktur terdampak') + sw(hex(HL.select), 'Dipilih');
  else if (state.mode === 'pain') el.innerHTML = sw('#ff4d6d', 'Area nyeri') + sw(hex(HL.region), 'Struktur di sekitar');
  else el.innerHTML = CATEGORIES.filter((c) => c.id !== 'context').map((c) => sw(c.color, c.label)).join('') + sw('#3f6fd8', 'Vena');
}

// ───────────────────────── references modal ─────────────────────────
$('#btn-refs').addEventListener('click', () => {
  $('#modal-body').innerHTML = `<h2>Sumber & tentang model</h2>
    <p>Origin, insertion, persarafan, dan fungsi otot mengikuti buku acuan anatomi standar. Informasi kondisi/cedera bersifat edukatif dan dirangkum dari sumber klinis di bawah.</p>
    <ol>${REFERENCES.map((r) => `<li>${esc(r.t)}${r.url ? ` – <a href="${r.url}" target="_blank" rel="noopener">${esc(r.url.replace(/^https?:\/\//, ''))}</a>` : ''}</li>`).join('')}</ol>
    <h3>Tentang model 3D</h3>
    <ul>
      <li><b>Mesh asli (Z-Anatomy, sisi kanan, satu kerangka koordinat)</b>: tulang + tulang rawan sendi, semua otot termasuk latissimus dorsi, bagian tendon otot, ligamen (AC, conoid, trapezoid, coracoacromial, SGHL/MGHL/IGHL, coracohumeral, transverse humeral, transverse scapular, ligamen SC), labrum, kapsul sendi GH/AC/SC, bursa subakromial & subdeltoid, pleksus brakialis & saraf bahu, arteri & vena, serta area origin/insertion otot pada tulang.</li>
      <li><b>Tendon turunan</b>: Z-Anatomy tidak memisahkan tendon <b>supraspinatus, subscapularis, dan teres minor</b> dari ototnya. Area tendonnya diambil dari mesh otot asli di sekitar area insersio asli pada humerus – batasnya perkiraan.</li>
      <li><b>Bagian mesh</b>: acromion & coracoid dipilih otomatis dari mesh skapula asli. Artikulasi skapulotorakal (bukan sendi sejati) ditunjukkan sebagai kelompok struktur pembentuknya.</li>
      <li>Saraf & pembuluh lengan (radial, median, ulnar, musculocutaneous, a. brakialis, v. sefalika) dipotong di siku.</li>
      <li>Animasi gerakan memutar tulang pada pusat sendi (glenohumeral, AC, SC, siku) dan membengkokkan otot secara otomatis; ritme skapula disederhanakan.</li>
    </ul>
    <p style="color:var(--muted);font-size:12px">Z-Anatomy – The open source atlas of anatomy, CC BY-SA 4.0 (github.com/LluisV/Z-Anatomy). BodyParts3D – © The Database Center for Life Science, CC BY-SA 2.1 Japan. File model turunan (public/models) dibagikan dengan lisensi CC BY-SA 4.0.</p>`;
  $('#modal').hidden = false;
});
$('#modal-close').addEventListener('click', () => ($('#modal').hidden = true));
$('#modal').addEventListener('click', (e) => { if (e.target.id === 'modal') $('#modal').hidden = true; });

// ───────────────────────── mobile drawers ─────────────────────────
function isMobile() { return window.matchMedia('(max-width: 860px)').matches; }
function openDrawer(which) {
  if (!isMobile()) return;
  closeDrawers();
  (which === 'left' ? left : right).classList.add('open');
  const s = document.createElement('div'); s.className = 'scrim'; s.addEventListener('click', closeDrawers);
  const b = document.createElement('button'); b.className = 'drawer-close ' + which; b.textContent = '✕ Tutup'; b.setAttribute('aria-label', 'Tutup panel');
  b.addEventListener('click', closeDrawers);
  document.body.append(s, b);
}
function closeDrawers() { left.classList.remove('open'); right.classList.remove('open'); document.querySelectorAll('.scrim, .drawer-close').forEach((s) => s.remove()); }
$('#btn-left').addEventListener('click', () => openDrawer('left'));
$('#btn-right').addEventListener('click', () => openDrawer('right'));
left.addEventListener('click', (e) => { if (isMobile() && e.target.closest('[data-sid],[data-mv]')) setTimeout(closeDrawers, 50); });

function toast(msg) {
  const t = document.createElement('div');
  t.textContent = msg;
  Object.assign(t.style, { position: 'absolute', left: '50%', bottom: '60px', transform: 'translateX(-50%)', background: '#000d', padding: '8px 14px', borderRadius: '8px', zIndex: 10, fontSize: '13px' });
  $('#stage').appendChild(t); setTimeout(() => t.remove(), 1800);
}

window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { if (!$('#modal').hidden) $('#modal').hidden = true; else selectStructure(null); }
});

// URL parameters (deep links, also used for testing): ?mode=movement&mv=abduction&t=0.5&view=back&sel=deltoid
function applyUrlParams() {
  const q = new URLSearchParams(location.search);
  if (q.get('mode')) setMode(q.get('mode'));
  if (q.get('mv')) pickMovement(q.get('mv'), !q.has('t'));
  if (q.has('t')) { state.playing = false; state.phase = Math.acos(1 - 2 * +q.get('t')) / (Math.PI * 2); state.transition = null; }
  if (q.get('cond')) pickCondition(q.get('cond'));
  if (q.get('region')) pickRegion(q.get('region'));
  if (q.get('sel')) selectStructure(q.get('sel'), null, { frame: q.has('frame') });
  if (q.get('hide')) q.get('hide').split(',').forEach((c) => viewer.setLayer(c, { visible: false }));
  if (q.get('view')) viewer.view(q.get('view'), true);
  if (q.has('iso')) toggleIsolate(true);
  if (q.has('xray')) $('[data-act=xray]').click();
}

// expose for debugging
window.__viewer = viewer;
