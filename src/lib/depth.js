import { fmtM } from './colors';

// Herkunft und Genauigkeit eines Höhenwerts (Paket 2, aus network3d.json: kind/prec/rng/ref/quelle/methode).
//   quelle     – Zahl aus einer Quelle (Wikipedia). prec: punkt | ca | rund | spanne
//   abgeleitet – aus Quellenzahlen berechnet (Gleisdreieck)
//   modell     – Schätzung des Modells (OSM-Bahnsteigebene, Bauart/Lage)
// Keine erfundene Fehlerspanne: ≈ heißt nur «nicht als genaue Zahl belegt».
export const isApprox = (s) => !(s.kind === 'quelle' && (s.prec === 'punkt' || s.prec === 'spanne'));
export const isSourced = (s) => s.kind === 'quelle';

// kurzer Wert mit Vorzeichen wie auf der Karte: −17 m, ≈ −12 m, −4 bis −5 m, ≈ +12 m
export function depthText(s) {
  if (s.prec === 'spanne' && s.rng) return `${fmtM(s.rng[0])} bis ${fmtM(s.rng[1])} m`;
  const v = Math.abs(s.z) < 0.5 ? '0' : fmtM(s.z);
  return `${isApprox(s) ? '≈ ' : ''}${v} m`;
}

// Status in einem Wort/Satzteil
export function statusShort(s) {
  if (s.kind === 'quelle') return s.prec === 'ca' ? 'Quellenangabe «ca.»' : s.prec === 'rund' ? 'Quellenangabe «rund»' : s.prec === 'spanne' ? 'Quellenangabe (Spanne)' : 'Quellenangabe';
  if (s.kind === 'abgeleitet') return 'abgeleitet';
  return 'Modellschätzung';
}

// ausführlicher Hinweis für die Karte
export function statusLong(s) {
  if (s.kind === 'quelle') {
    const p = s.prec === 'ca' ? ' Die Quelle nennt den Wert als «ca.».' : s.prec === 'rund' ? ' Die Quelle nennt den Wert als «rund».'
      : s.prec === 'spanne' ? ` Die Quelle nennt eine Spanne (${depthText(s)}); im Modell wird ${fmtM(s.z)} m verwendet.` : '';
    return `Zahl aus der Quelle, kein eigenes Messergebnis.${p}${s.ref ? ` Bezug laut Quelle: ${s.ref}.` : ''}`;
  }
  if (s.kind === 'abgeleitet') return `Berechnet, nicht direkt angegeben: ${s.quelle}.`;
  return `Keine Quellenangabe – Schätzung nach ${s.methode || 'Modell'}.`;
}
