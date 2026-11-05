import * as THREE from 'three';

export const CAT_STYLE = {
  bone: { color: '#e4d8bf', roughness: 0.72, metalness: 0.0 },
  context: { color: '#cdc3ae', roughness: 0.8, metalness: 0.0 },
  muscle: { color: '#a8453c', roughness: 0.55, metalness: 0.0, sheen: true },
  tendon: { color: '#f0e9d6', roughness: 0.35, metalness: 0.05 },
  cartilage: { color: '#cfe4ec', roughness: 0.22, metalness: 0.0 },
  ligament: { color: '#7fb3e0', roughness: 0.4, metalness: 0.05 },
  joint: { color: '#b48cff', roughness: 0.3, metalness: 0.0 },
  nerve: { color: '#f5c542', roughness: 0.45, metalness: 0.0 },
  artery: { color: '#e0353f', roughness: 0.4, metalness: 0.0 },
  vein: { color: '#3f6fd8', roughness: 0.4, metalness: 0.0 },
};

// Slight per-muscle hue variation so neighbouring muscles can be told apart
const MUSCLE_TINTS = ['#a8453c', '#b04e40', '#9c3f3a', '#b3533f', '#a24a44', '#ad4036', '#99463c'];

export function makeMaterial(styleKey, idx = 0) {
  const s = CAT_STYLE[styleKey] || CAT_STYLE.bone;
  const color = styleKey === 'muscle' ? MUSCLE_TINTS[idx % MUSCLE_TINTS.length] : s.color;
  const m = new THREE.MeshStandardMaterial({
    color, roughness: s.roughness, metalness: s.metalness,
    transparent: false, opacity: 1, side: THREE.DoubleSide,
  });
  m.userData.baseColor = new THREE.Color(color);
  return m;
}

export const HL = {
  select: new THREE.Color('#38c8ff'),
  prime: new THREE.Color('#ff5a36'),
  synergist: new THREE.Color('#ffc23d'),
  tendon: new THREE.Color('#39f0d0'),
  joint: new THREE.Color('#c08cff'),
  affected: new THREE.Color('#ff3b5c'),
  region: new THREE.Color('#ffb547'),
};
