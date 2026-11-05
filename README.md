# Anatomi Bahu 3D – Shoulder Anatomy Explorer

Aplikasi web interaktif untuk mempelajari anatomi bahu **kanan** dalam 3D (edukasi, bukan alat diagnosis).

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
- **Gerakan**: 8 gerakan bahu dengan animasi 3D, otot utama/pembantu, tendon & sendi yang terlibat.
- **Cedera**: 10 kondisi umum – struktur terdampak, gejala, gerakan terganggu, pemeriksaan dokter.
- **Lokasi nyeri**: diagram tubuh depan/belakang → struktur di sekitar area (bukan diagnosis) + tanda bahaya.
- Tautan langsung via URL, mis. `?mode=movement&mv=abduction`, `?mode=injury&cond=rc_tear`, `?sel=infraspinatus&xray`.

## Model 3D

Semua mesh berasal dari **Z-Anatomy** (turunan BodyParts3D) dalam satu kerangka koordinat – tidak ada lagi bentuk skematik atau penyelarasan antar-versi:

| Jenis | Struktur |
|---|---|
| Tulang | klavikula, skapula, humerus (+ tulang rawan sendi), radius, ulna, iga, sternum, vertebra, panggul |
| Otot | semua otot di PRD + coracobrachialis, serratus anterior, subclavius – termasuk **latissimus dorsi** |
| Tendon (mesh asli) | bagian tendon setiap otot sesuai pemodelan Z-Anatomy, termasuk **tendon infraspinatus** dan **tendon kepala panjang bisep** |
| Ligamen | AC, conoid, trapezoid, coracoacromial, SGHL/MGHL/IGHL, coracohumeral, transverse humeral, transverse scapular (sup./inf.), ligamen sendi SC |
| Sendi | kapsul GH, labrum glenoid, kapsul + diskus AC & SC, bursa subakromial & subdeltoid |
| Saraf | pleksus brakialis (roots, trunks, divisions, posterior cord), axillary, suprascapular, long thoracic, dorsal scapular, thoracodorsal, subscapular, pectoral, musculocutaneous, radial, median, ulnar |
| Pembuluh | a. subklavia, aksilaris (+ cabang), brakialis, sirkumfleks humeral, suprascapular; v. aksilaris, subklavia, sefalika |
| Area perlekatan | area origin/insertion otot pada tulang |

Yang masih **diturunkan** (ditandai di aplikasi):

- Z-Anatomy tidak memisahkan tendon **supraspinatus, subscapularis, dan teres minor** dari ototnya. Area tendonnya adalah bagian mesh otot asli di sekitar area insersio aslinya pada humerus (radius 16–22 mm) – batasnya perkiraan.
- **Acromion & coracoid** dipilih otomatis dari mesh skapula asli.
- **Artikulasi skapulotorakal** bukan sendi sejati, jadi ditunjukkan sebagai kelompok struktur pembentuknya.
- Saraf & pembuluh lengan dipotong di siku.

Model dibangun ulang dengan `tools/build-model.mjs` (butuh file FBX dari `LluisV/Z-Anatomy-Sample`, lihat komentar di file).

## Lisensi data

- Z-Anatomy – The open source atlas of anatomy – **CC BY-SA 4.0**
- BodyParts3D – © The Database Center for Life Science – **CC BY-SA 2.1 Japan**

File turunan di `public/models/` dibagikan dengan lisensi CC BY-SA 4.0. Sumber anatomi & klinis: tombol **Sumber** di aplikasi (`src/data/references.js`).
