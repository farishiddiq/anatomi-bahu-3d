import * as THREE from 'three';

const V = (a) => new THREE.Vector3().fromArray(a);

// Pain-region marker positions (rest pose) + chain weights
export function regionMarkers(lm) {
  const U = V(lm.axes.up), A = V(lm.axes.anterior), L = V(lm.axes.lateral);
  const GH = V(lm.gh); const R = lm.headR;
  const SCAP = [1, 1, 0, 0], HUM = [1, 1, 1, 0], CLAV = [1, 0, 0, 0];
  return {
    anterior: { p: GH.clone().addScaledVector(A, R + 26).addScaledVector(L, 4).addScaledVector(U, 2), c: HUM },
    lateral: { p: GH.clone().addScaledVector(L, R + 28).addScaledVector(U, 4), c: HUM },
    posterior: { p: GH.clone().addScaledVector(A, -(R + 30)).addScaledVector(L, 2), c: HUM },
    superior: { p: V(lm.ac).addScaledVector(U, 16), c: CLAV },
    scapular: { p: V(lm.spinoglenoid).lerp(V(lm.scapInf), 0.5).addScaledVector(L, -38).addScaledVector(A, -22), c: SCAP },
    axilla: { p: GH.clone().addScaledVector(U, -48).addScaledVector(L, -22).addScaledVector(A, 4), c: [0.5, 0.5, 0.5, 0] },
    arm_junction: { p: V(lm.shaft.c).addScaledVector(L, lm.shaft.r + 26).addScaledVector(A, 6).addScaledVector(U, 10), c: HUM },
    elbow: { p: V(lm.epiLat || lm.elbow).lerp(V(lm.epiMed || lm.elbow), 0.5).addScaledVector(A, 34), c: [1, 1, 1, 0.5] },
    hand: { p: V(lm.wrist || lm.elbow).lerp(V(lm.hand || lm.elbow), 0.5).addScaledVector(A, 28), c: [1, 1, 1, 1] },
  };
}
