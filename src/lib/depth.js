import { fmtM } from './colors';

// Einziger Vertrag für Herkunft und Genauigkeit eines Höhenwerts (Paket 2).
// Die Felder stammen aus den Daten (scripts/build_3d.py → network3d.json), nicht aus einem zweiten Wörterbuch in der App:
//   kind   – quelle (Zahl aus einer Quelle) | abgeleitet (aus Quellenzahlen berechnet) | modell (Schätzung des Modells)
//   prec   – nur bei quelle: punkt | ca | rund | spanne
//   rng    – nur bei spanne: [a, b] in m mit Vorzeichen wie z, in Reihenfolge der Quelle
//   angabe – nur bei spanne: Originalschreibweise der Quelle (z. B. «4–5 m»)
//   ref    – Bezugsangabe laut Quelle (Straßenniveau, Straßendecke, Gelände …)
//   quelle – Quellenangabe bzw. Herleitung;  methode – Schätzverfahren des Modells
// Keine erfundene Fehlerspanne: ≈ heißt nur «nicht als genaue Einzelzahl belegt».
// Karte (Beschriftung), Tooltip, Liste, Stations- und Linienkarte und Profil verwenden nur diese Funktionen.

export const isApprox = (s) => !(s.kind === 'quelle' && (s.prec === 'punkt' || s.prec === 'spanne'));
export const isSourced = (s) => s.kind === 'quelle';

// Spanne aufsteigend (untere → obere Grenze), unabhängig von der Reihenfolge in der Quelle: [−4, −5] → −5…−4
const sortedRange = (s) => [...s.rng].sort((a, b) => a - b);

// Zahl ohne Einheit, wie auf der Karte: −17 · ≈ −17 · −5…−4 · ≈ +12 · 0
export function depthNumber(s) {
  if (s.prec === 'spanne' && Array.isArray(s.rng) && s.rng.length === 2) {
    const [lo, hi] = sortedRange(s);
    return `${fmtM(lo)}…${fmtM(hi)}`;
  }
  const v = Math.abs(s.z) < 0.005 ? '0' : fmtM(s.z);
  return `${isApprox(s) ? '≈ ' : ''}${v}`;
}
export const depthText = (s) => `${depthNumber(s)} m`;

// Status kurz (Tag in der Karte, Tooltip, Profil-Titel)
export function statusShort(s) {
  if (s.kind === 'quelle') {
    return s.prec === 'ca' ? 'Quellenangabe · ca.' : s.prec === 'rund' ? 'Quellenangabe · rund'
      : s.prec === 'spanne' ? 'Quellenangabe · Spanne' : 'Quellenangabe';
  }
  if (s.kind === 'abgeleitet') return 'abgeleitet';
  return 'Modellschätzung';
}

const PREC = { punkt: 'Einzelwert ohne Zusatz', ca: '«ca.»', rund: '«rund»' };

// «Herkunft des Werts»: Zeilen [Begriff, Wert] + ein erläuternder Satz, nur aus den Datenfeldern
export function provenanceRows(s) {
  const rows = [['Art', s.kind === 'quelle' ? 'Quellenangabe' : s.kind === 'abgeleitet' ? 'abgeleitet' : 'Modellschätzung']];
  if (s.kind === 'quelle') {
    if (s.prec === 'spanne') rows.push(['Angabe der Quelle', s.angabe || `${Math.abs(s.rng[0])}–${Math.abs(s.rng[1])} m`]);
    else rows.push(['Genauigkeit', PREC[s.prec] || '–']);
    if (s.ref) rows.push(['Bezug', `${s.ref} (laut Quelle)`]);
    if (s.quelle) rows.push(['Quelle', s.quelle]);
    if (s.prec === 'spanne') rows.push(['Im Modell', `${fmtM(s.z)} m (Mitte der Spanne)`]);
  } else if (s.kind === 'abgeleitet') {
    if (s.quelle) rows.push(['Herleitung', s.quelle]);
  } else {
    rows.push(['Verfahren', s.methode || 'Modell']);
  }
  return rows;
}

export function provenanceNote(s) {
  if (s.kind === 'quelle') return 'Zahl aus der genannten Quelle, kein eigenes Messergebnis.';
  if (s.kind === 'abgeleitet') return 'Aus Zahlen der Quelle berechnet, keine direkte Angabe.';
  return 'Für diesen Bahnhof gibt es keine Zahlenangabe; der Wert ist eine Schätzung des Modells.';
}
