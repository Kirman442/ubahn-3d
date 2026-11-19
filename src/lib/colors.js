import * as THREE from 'three';
import { DEPTH_MAX } from './model';

// шкала «по глубине», как у 3d-metro: охра → ржавый → бордо → индиго
const RAMP = ['#E8C27C', '#C9793A', '#8A3B55', '#3A3170'].map((c) => new THREE.Color(c));
const ABOVE = new THREE.Color('#9AA79A');
export function depthColor(rel) {
  if (rel >= -0.5) return ABOVE.clone();
  const t = Math.min(1, -rel / DEPTH_MAX) * (RAMP.length - 1);
  const i = Math.min(RAMP.length - 2, Math.floor(t));
  return RAMP[i].clone().lerp(RAMP[i + 1], t - i);
}
export const RAMP_CSS = 'linear-gradient(90deg,#E8C27C,#C9793A,#8A3B55,#3A3170)';
// Tiefenwert mit Vorzeichen: höchstens 2 Nachkommastellen, ohne Endnullen (−17, −11,25, −14,75, +7,35, −3,7).
// Genauigkeit/Herkunft (≈, Spanne, Modell) wird nicht hier, sondern in lib/depth.js ausgedrückt.
export const fmtM = (v, d = 2) => {
  const t = Number(Math.abs(v).toFixed(d)).toString().replace('.', ',');
  const sg = t === '0' ? '' : v < 0 ? '−' : '+';
  return `${sg}${t}`;
};
