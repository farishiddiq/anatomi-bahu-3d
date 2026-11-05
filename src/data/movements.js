// Gerakan bahu. Sudut dalam derajat. Sumbu anatomis:
//   'ml' = medio-lateral (fleksi/ekstensi), 'ap' = antero-posterior (abduksi/adduksi),
//   'long' = sumbu panjang humerus (rotasi), 'vert' = vertikal (gerak horizontal).
// gh: rotasi di sendi glenohumeral; girdle: gerak klavikula+skapula (scapulohumeral rhythm, disederhanakan);
// elbow: fleksi siku untuk memperjelas rotasi.
// Peran otot berdasarkan Moore's Clinically Oriented Anatomy (Tabel 6.5–6.7) & Kendall – Muscles: Testing and Function.

export const MOVEMENTS = [
  {
    id: 'flexion', en: 'Shoulder flexion', idn: 'Fleksi bahu', range: '0–180°',
    desc: 'Mengangkat lengan lurus ke depan lalu ke atas kepala.',
    pose: { gh: [['ml', 95]], girdle: { elev: 8, upRot: 28 } },
    prime: [
      ['deltoid', 'Bagian depan (clavicular part) mengangkat lengan ke depan.'],
      ['pec_major', 'Kepala klavikula membantu fleksi sampai ±60–90°.'],
    ],
    synergist: [
      ['coracobrachialis', 'Membantu fleksi dan menjaga humerus tetap dekat badan.'],
      ['biceps', 'Membantu fleksi (lemah), terutama kepala pendek.'],
      ['serratus_anterior', 'Memutar belikat ke atas dan menahannya ke dinding dada.'],
      ['trapezius', 'Bagian atas & bawah memutar belikat ke atas (di atas 90°).'],
      ['rotator_cuff', 'Menjaga kepala humerus tetap di tengah glenoid.'],
    ],
    tendons: ['supraspinatus_t', 'lhb_t', 'subscapularis_t', 'infraspinatus_t'],
    joints: ['gh_joint', 'st_joint', 'ac_joint', 'sc_joint'],
  },
  {
    id: 'extension', en: 'Shoulder extension', idn: 'Ekstensi bahu', range: '0–±60°',
    desc: 'Mengayunkan lengan lurus ke belakang badan.',
    pose: { gh: [['ml', -50]], girdle: { elev: 0, upRot: -6, retract: 6 } },
    prime: [
      ['latissimus', 'Menarik humerus ke belakang dan ke bawah.'],
      ['deltoid', 'Bagian belakang (spinal part) mengayunkan lengan ke belakang.'],
      ['teres_major', 'Membantu latissimus dorsi.'],
    ],
    synergist: [
      ['triceps', 'Kepala panjang membantu ekstensi.'],
      ['pec_major', 'Kepala sternokostal menurunkan lengan dari posisi fleksi.'],
      ['rhomboid_major', 'Menarik belikat ke belakang (retraksi).'],
    ],
    tendons: ['lhb_t', 'subscapularis_t'],
    joints: ['gh_joint', 'st_joint'],
  },
  {
    id: 'abduction', en: 'Shoulder abduction', idn: 'Abduksi bahu', range: '0–180°',
    desc: 'Mengangkat lengan lurus ke samping. Di atas ±90° humerus perlu berotasi keluar agar greater tubercle tidak terjepit di bawah akromion.',
    pose: { gh: [['long', 20], ['ap', 85]], girdle: { elev: 8, upRot: 27 } },
    prime: [
      ['deltoid', 'Bagian tengah (acromial part) – pengangkat utama.'],
      ['supraspinatus', 'Memulai abduksi (±0–15°) dan menekan kepala humerus ke glenoid sepanjang gerakan.'],
    ],
    synergist: [
      ['trapezius', 'Bagian atas & bawah memutar belikat ke atas.'],
      ['serratus_anterior', 'Memutar belikat ke atas (penting di atas 90°).'],
      ['infraspinatus', 'Rotasi eksternal agar greater tubercle lolos di bawah akromion.'],
      ['teres_minor', 'Membantu rotasi eksternal & stabilisasi.'],
      ['subscapularis', 'Menahan kepala humerus turun (force couple dengan deltoid).'],
    ],
    tendons: ['supraspinatus_t', 'infraspinatus_t', 'teres_minor_t', 'subscapularis_t'],
    joints: ['gh_joint', 'st_joint', 'ac_joint', 'sc_joint', 'subacromial_bursa'],
    note: 'Area ±60–120° adalah tempat tendon supraspinatus & bursa paling dekat dengan akromion – inilah "painful arc" pada impingement/tendinopathy.',
  },
  {
    id: 'adduction', en: 'Shoulder adduction', idn: 'Adduksi bahu', range: 'kembali ke 0° (±30–45° menyilang di depan badan)',
    desc: 'Menurunkan lengan dari samping kembali ke badan (animasi: dari posisi abduksi ke samping badan).',
    pose: { gh: [['ap', 80]], girdle: { elev: 6, upRot: 22 } }, reverse: true,
    prime: [
      ['pec_major', 'Menarik humerus ke arah dada.'],
      ['latissimus', 'Menarik humerus ke bawah-belakang.'],
      ['teres_major', 'Membantu latissimus dorsi.'],
    ],
    synergist: [
      ['triceps', 'Kepala panjang membantu adduksi.'],
      ['coracobrachialis', 'Membantu adduksi.'],
      ['subscapularis', 'Membantu adduksi.'],
      ['rhomboid_major', 'Memutar belikat ke bawah (downward rotation).'],
    ],
    tendons: ['subscapularis_t'],
    joints: ['gh_joint', 'st_joint'],
  },
  {
    id: 'internal_rotation', en: 'Internal (medial) rotation', idn: 'Rotasi internal (ke dalam)', range: '0–±70–90°',
    desc: 'Memutar lengan ke dalam pada sumbu panjangnya. Ditunjukkan dengan siku ditekuk 90°: lengan bawah bergerak ke arah perut.',
    pose: { gh: [['long', -70]], elbow: 90, girdle: { protract: 4 } },
    prime: [
      ['subscapularis', 'Pemutar ke dalam utama (rotator cuff).'],
      ['pec_major', 'Pemutar ke dalam yang kuat.'],
      ['latissimus', 'Membantu rotasi ke dalam.'],
      ['teres_major', 'Membantu rotasi ke dalam.'],
    ],
    synergist: [['deltoid', 'Bagian depan membantu rotasi ke dalam.']],
    tendons: ['subscapularis_t'],
    joints: ['gh_joint'],
  },
  {
    id: 'external_rotation', en: 'External (lateral) rotation', idn: 'Rotasi eksternal (ke luar)', range: '0–±90°',
    desc: 'Memutar lengan ke luar pada sumbu panjangnya. Ditunjukkan dengan siku ditekuk 90°: lengan bawah bergerak menjauhi perut.',
    pose: { gh: [['long', 70]], elbow: 90, girdle: { retract: 5 } },
    prime: [
      ['infraspinatus', 'Pemutar ke luar utama (rotator cuff).'],
      ['teres_minor', 'Membantu rotasi ke luar (rotator cuff).'],
    ],
    synergist: [
      ['deltoid', 'Bagian belakang membantu rotasi ke luar.'],
      ['supraspinatus', 'Membantu (terutama saat lengan di samping).'],
      ['rhomboid_major', 'Menstabilkan belikat (retraksi).'],
    ],
    tendons: ['infraspinatus_t', 'teres_minor_t'],
    joints: ['gh_joint'],
    note: 'Keterbatasan rotasi eksternal pasif adalah tanda khas frozen shoulder.',
  },
  {
    id: 'horizontal_abduction', en: 'Horizontal abduction', idn: 'Abduksi horizontal', range: 'dari 90° fleksi ke ±0–30° di belakang bidang badan',
    desc: 'Lengan setinggi bahu digerakkan dari depan ke samping/belakang (mis. gerakan "reverse fly").',
    pose: { gh: [['ml', 90], ['vert', -90]], girdle: { elev: 6, upRot: 20, retract: 14 }, from: { gh: [['ml', 90]], girdle: { elev: 6, upRot: 20, protract: 6 } } },
    prime: [
      ['deltoid', 'Bagian belakang menarik lengan ke belakang.'],
      ['infraspinatus', 'Membantu & menstabilkan.'],
      ['teres_minor', 'Membantu & menstabilkan.'],
    ],
    synergist: [
      ['rhomboid_major', 'Menarik belikat ke belakang (retraksi).'],
      ['rhomboid_minor', 'Menarik belikat ke belakang.'],
      ['trapezius', 'Bagian tengah menarik belikat ke belakang.'],
      ['latissimus', 'Membantu sedikit.'],
    ],
    tendons: ['infraspinatus_t', 'teres_minor_t'],
    joints: ['gh_joint', 'st_joint', 'ac_joint', 'sc_joint'],
  },
  {
    id: 'horizontal_adduction', en: 'Horizontal adduction', idn: 'Adduksi horizontal', range: 'dari samping (90° abduksi) ke depan dada ±130°',
    desc: 'Lengan setinggi bahu digerakkan dari samping ke depan dan menyilang dada (mis. gerakan "chest fly"/push-up).',
    pose: { gh: [['ml', 90], ['vert', 30]], girdle: { elev: 6, upRot: 20, protract: 12 }, from: { gh: [['ml', 90], ['vert', -80]], girdle: { elev: 6, upRot: 20, retract: 10 } } },
    prime: [
      ['pec_major', 'Kedua kepala menarik lengan ke depan dada.'],
      ['deltoid', 'Bagian depan membantu.'],
    ],
    synergist: [
      ['coracobrachialis', 'Membantu adduksi horizontal.'],
      ['serratus_anterior', 'Menarik belikat ke depan (protraksi).'],
      ['pec_minor', 'Menarik belikat ke depan.'],
      ['biceps', 'Kepala pendek membantu.'],
    ],
    tendons: ['subscapularis_t', 'lhb_t'],
    joints: ['gh_joint', 'st_joint', 'ac_joint', 'sc_joint'],
    note: 'Menyilangkan lengan ke depan dada (cross-body adduction) menekan sendi AC – nyeri di puncak bahu pada gerakan ini sering dikaitkan dengan sendi AC.',
  },
];
