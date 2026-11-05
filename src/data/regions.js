// Area nyeri -> struktur yang BERADA DI SEKITAR area tersebut (untuk dipelajari, bukan diagnosis).
// view: sisi diagram tubuh (front/back). marker: landmark di model 3D untuk penanda area.

export const REGIONS = [
  {
    id: 'anterior', en: 'Anterior shoulder', idn: 'Bahu depan', view: 'front', marker: 'anterior',
    structures: ['lhb_t', 'transverse_humeral_lig', 'subscapularis_t', 'coracoid', 'deltoid', 'pec_major', 'pec_minor', 'gh_lig', 'ch_lig', 'labrum', 'ac_joint'],
    note: 'Bahu depan banyak dilewati struktur: tendon kepala panjang bisep di bicipital groove, tendon subskapularis, korakoid, deltoid depan, dan bagian depan kapsul sendi.',
  },
  {
    id: 'lateral', en: 'Lateral shoulder', idn: 'Bahu samping', view: 'front', marker: 'lateral',
    structures: ['supraspinatus_t', 'subacromial_bursa', 'deltoid', 'acromion', 'humerus', 'infraspinatus_t'],
    note: 'Nyeri dari rotator cuff (terutama supraspinatus) dan bursa subakromial sering terasa di samping bahu, bahkan turun ke area insersio deltoid di lengan atas.',
  },
  {
    id: 'posterior', en: 'Posterior shoulder', idn: 'Bahu belakang', view: 'back', marker: 'posterior',
    structures: ['infraspinatus', 'infraspinatus_t', 'teres_minor', 'deltoid', 'teres_major', 'triceps', 'labrum', 'suprascapular_n', 'axillary_n'],
    note: 'Termasuk otot rotator cuff belakang, deltoid belakang, kapsul/labrum belakang, serta jalur saraf suprascapular dan aksilaris (quadrangular space).',
  },
  {
    id: 'superior', en: 'Top of the shoulder', idn: 'Bagian atas bahu', view: 'front', marker: 'superior',
    structures: ['ac_joint', 'ac_lig', 'cc_lig', 'clavicle', 'acromion', 'trapezius', 'supraspinatus', 'levator_scapulae'],
    note: 'Puncak bahu didominasi sendi AC dan ligamennya, ujung klavikula, akromion, serta trapezius atas. Masalah tulang leher (mis. saraf C5) juga dapat dirasakan di area ini.',
  },
  {
    id: 'scapular', en: 'Around the shoulder blade', idn: 'Area dekat tulang belikat', view: 'back', marker: 'scapular',
    structures: ['rhomboid_major', 'rhomboid_minor', 'levator_scapulae', 'trapezius', 'infraspinatus', 'serratus_anterior', 'st_joint', 'scapula', 'suprascapular_n', 'dorsal_scapular_n', 'long_thoracic_n'],
    note: 'Otot-otot penstabil belikat dan bidang geser skapulotorakal. Nyeri di area ini juga bisa berasal dari leher.',
  },
  {
    id: 'axilla', en: 'Armpit (axilla)', idn: 'Area ketiak', view: 'front', marker: 'axilla',
    structures: ['latissimus', 'teres_major', 'pec_major', 'subscapularis', 'coracobrachialis', 'triceps', 'axillary_a', 'axillary_v', 'brachial_plexus', 'thoracodorsal_n', 'long_thoracic_n'],
    note: 'Ketiak dibatasi lipatan pectoralis major (depan) dan latissimus/teres major (belakang). Di dalamnya lewat pembuluh darah dan pleksus brakialis. Kelenjar getah bening juga ada di sini (tidak dimodelkan).',
  },
  {
    id: 'arm_junction', en: 'Shoulder–upper arm junction', idn: 'Pertemuan bahu & lengan atas', view: 'front', marker: 'arm_junction',
    structures: ['deltoid', 'lhb_t', 'biceps', 'pec_major', 'latissimus', 'teres_major', 'humerus', 'axillary_n', 'post_circ_a'],
    note: 'Area insersio deltoid dan otot-otot yang menempel di sekitar bicipital groove. Nyeri rotator cuff sering "dirujuk" ke area ini meski sumbernya di atas.',
  },
];

export const RED_FLAGS = [
  'Nyeri bahu disertai nyeri dada, sesak napas, keringat dingin, atau mual (terutama bahu kiri) – bisa berasal dari jantung. Segera ke IGD.',
  'Demam, bahu merah-panas-bengkak (kemungkinan infeksi sendi).',
  'Trauma dengan perubahan bentuk bahu atau tidak bisa menggerakkan lengan sama sekali.',
  'Mati rasa/kelemahan lengan yang memburuk, atau lengan bengkak kebiruan.',
  'Nyeri belikat kanan setelah makan berlemak juga dapat berasal dari kandung empedu.',
];
