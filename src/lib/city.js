// Städte: alles Stadtspezifische an einem Ort (Ursprung, Bezugshöhe, Linien, Daten, Karte, Quellen).
// CITY ist eine Live-Bindung: App setzt die Stadt vor dem Rendern (setCity), alle Module lesen den aktuellen Wert.
import { setOrigin } from './geo';
import { LINES as BERLIN_LINES } from './config';

export const CITIES = [
  {
    id: 'berlin', name: 'Berlin', ready: true, data: '', tiles: 'berlin.pmtiles',
    origin: { lon: 13.4014, lat: 52.5109 }, h0: 35, startYear: 1900, lines: BERLIN_LINES,
    dgm: 'DGM1 Berlin', search: 'z. B. Hermannplatz',
    attribution: 'Gelände: DGM1 © Geoportal Berlin (dl-de/zero-2-0) · Tiefen: Wikipedia (CC BY-SA 4.0) · Karte: OpenStreetMap-Mitwirkende',
  },
  { id: 'hamburg', name: 'Hamburg', ready: false },
  { id: 'muenchen', name: 'München', ready: false },
  {
    id: 'nuernberg', name: 'Nürnberg', ready: true, data: 'nuernberg/', tiles: null,
    origin: { lon: 11.0767, lat: 49.4521 }, h0: 310, startYear: 1970,
    lines: [{ id: 'U1', color: '#0067A6' }, { id: 'U2', color: '#E2001A' }, { id: 'U3', color: '#00A3A0' }],
    dgm: 'DGM1 Bayern', search: 'z. B. Plärrer',
    note: 'Nürnberg und Fürth. Tiefen zwischen den Bahnhöfen sind aus Gelände und Bauregeln geschätzt, nicht gemessen. U2 und U3 teilen zwischen Rothenburger Straße und Rathenauplatz dasselbe Gleis; die Röhren sind dort nur zur Lesbarkeit nebeneinander gezeichnet. Plärrer ist ein Richtungsbahnhof: je Linie liegt eine Fahrtrichtung auf Ebene −3, die andere auf −2. Gestrichelt: U3 Großreuth – Gebersdorf im Bau (Höhenlage geschätzt).',
    attribution: 'Gelände: DGM1 © Bayerische Vermessungsverwaltung, geodaten.bayern.de (CC BY 4.0) · Geschichte und Tiefen: Wikipedia (CC BY-SA 4.0) · Lage: © OpenStreetMap-Mitwirkende (ODbL)',
  },
];

export let CITY = CITIES[0];
export let LINE_COLOR = {};
export function setCity(id) {
  const c = CITIES.find((x) => x.id === id && x.ready) || CITIES[0];
  if (c === CITY && Object.keys(LINE_COLOR).length) return c;
  CITY = c;
  LINE_COLOR = Object.fromEntries(c.lines.map((l) => [l.id, l.color]));
  setOrigin(c.origin);
  return c;
}
export const cityFromHash = () => {
  const h = (typeof window !== 'undefined' ? window.location.hash : '').replace('#', '');
  return CITIES.find((c) => c.id === h && c.ready)?.id || 'berlin';
};
setCity('berlin');
