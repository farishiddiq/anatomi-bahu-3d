# Anatomi Bahu 3D – Shoulder Anatomy Explorer

Aplikasi web interaktif untuk mempelajari anatomi bahu **kanan** – diteruskan sampai siku, lengan bawah, pergelangan, dan ujung jari – dalam 3D (edukasi, bukan alat diagnosis).

## Menjalankan

```bash
npm install
npm run dev        # buka http://localhost:5173
npm run build      # hasil statis di dist/ (bisa dibuka lewat server statis apa pun)
```

## Fitur

- **Jelajah**: putar/zoom/geser, klik struktur untuk identifikasi, highlight, isolasi, X-ray, kontrol lapisan + opasitas per kategori, pencarian.
- **Panel informasi**: nama Inggris & Indonesia, fungsi, letak, origin, insertion, persarafan, gerakan, struktur terkait, cedera & gejala umum.
- **Area perlekatan**: saat sebuah otot dipilih, area origin (merah) dan insertion (biru) aslinya tampil di tulang.
- **Gerakan**: 8 gerakan bahu + fleksi/ekstensi siku dengan animasi 3D, otot utama/pembantu, tendon & sendi yang terlibat.
- **Cedera**: 10 kondisi bahu + 4 kondisi siku/tangan (tennis elbow, carpal tunnel, cubital tunnel, ruptur biseps distal) – struktur terdampak, gejala, gerakan terganggu, pemeriksaan dokter.
- **Lokasi nyeri**: 9 area termasuk siku dan tangan/kesemutan (peta saraf), diagram tubuh depan/belakang → struktur di sekitar area (bukan diagnosis) + tanda bahaya.
- Tautan langsung via URL, mis. `?mode=movement&mv=abduction`, `?mode=injury&cond=rc_tear`, `?sel=infraspinatus&xray`, `?view=arm` (seluruh lengan).

## Model 3D

Semua mesh berasal dari **Z-Anatomy** (turunan BodyParts3D) dalam satu kerangka koordinat – tidak ada lagi bentuk skematik atau penyelarasan antar-versi:

| Jenis | Struktur |
|---|---|
| Tulang | klavikula, skapula, humerus, radius, ulna, 8 tulang karpal, 5 metakarpal, 14 falang (semuanya + tulang rawan sendi), iga, sternum, vertebra |
| Otot | semua otot di PRD + coracobrachialis, serratus anterior, subclavius – termasuk **latissimus dorsi**; brachialis; 24 otot lengan bawah; otot tenar, hipotenar, adductor pollicis, lumbrikal, interoseus |
| Tendon (mesh asli) | bagian tendon setiap otot sesuai pemodelan Z-Anatomy, termasuk **tendon infraspinatus** dan **tendon kepala panjang bisep** |
| Ligamen | AC, conoid, trapezoid, coracoacromial, SGHL/MGHL/IGHL, coracohumeral, transverse humeral, transverse scapular (sup./inf.), ligamen sendi SC; UCL, LCL & anular siku, membran interoseus, ligamen pergelangan, retinakulum fleksor & ekstensor, aponeurosis palmaris, pulley, ligamen kolateral & palmar plate jari |
| Sendi | kapsul GH, labrum glenoid, kapsul + diskus AC & SC, bursa subakromial & subdeltoid; kapsul siku, pergelangan, MCP, PIP, DIP; diskus DRUJ (TFCC); selubung sinovial tendon fleksor |
| Saraf | pleksus brakialis (roots, trunks, divisions, posterior cord), axillary, suprascapular, long thoracic, dorsal scapular, thoracodorsal, subscapular, pectoral, musculocutaneous, radial, median, ulnar – lengkap dengan cabangnya sampai saraf jari; saraf kulit lengan |
| Pembuluh | a. subklavia, aksilaris (+ cabang), brakialis (+ kolateral), sirkumfleks humeral, suprascapular, radialis, ulnaris, interoseus, lengkung palmar, arteri jari; v. aksilaris, subklavia, sefalika, basilika, mediana kubiti, vena tangan, vena dalam lengan |
| Area perlekatan | area origin/insertion otot pada tulang |

Yang masih **diturunkan** (ditandai di aplikasi):

- Z-Anatomy tidak memisahkan tendon **supraspinatus, subscapularis, dan teres minor** dari ototnya. Area tendonnya adalah bagian mesh otot asli di sekitar area insersio aslinya pada humerus (radius 16–22 mm) – batasnya perkiraan.
- **Acromion & coracoid** dipilih otomatis dari mesh skapula asli.
- **Artikulasi skapulotorakal** bukan sendi sejati, jadi ditunjukkan sebagai kelompok struktur pembentuknya.
- Tangan mengikuti lengan bawah saat animasi; pronasi/supinasi serta gerak pergelangan dan jari tidak dianimasikan.
- Mesh "palmar aponeurosis" Z-Anatomy membungkus seluruh tangan, jadi ditampilkan tembus pandang. Pulley jari hanya tersedia sebagai bagian cruciform; ligamen skafolunatum tidak dimodelkan terpisah.
- Iga & tulang belakang (konteks) disederhanakan; normal permukaan dihitung di browser (file 6,4 MB).

Model dibangun ulang dengan `tools/build-model.mjs` (butuh file FBX dari `LluisV/Z-Anatomy-Sample`, lihat komentar di file).

## Lisensi data

- Z-Anatomy – The open source atlas of anatomy – **CC BY-SA 4.0**
- BodyParts3D – © The Database Center for Life Science – **CC BY-SA 2.1 Japan**

File turunan di `public/models/` dibagikan dengan lisensi CC BY-SA 4.0. Sumber anatomi & klinis: tombol **Sumber** di aplikasi (`src/data/references.js`).
