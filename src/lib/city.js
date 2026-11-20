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
  {
    id: 'hamburg', name: 'Hamburg', ready: true, data: 'hamburg/', tiles: 'hamburg.pmtiles', basemap: true,
    origin: { lon: 9.9937, lat: 53.5503 }, h0: 10, startYear: 1910,
    // Farben aus den OSM-Routenrelationen (colour); ZR = Zweigbahn Rothenburgsort 1915–1943, heute ohne Nummer
    lines: [{ id: 'U1', color: '#006AB3' }, { id: 'U2', color: '#E2001A' }, { id: 'U3', color: '#FFDD00' }, { id: 'U4', color: '#256D7B' }, { id: 'ZR', color: '#8C8C8C' }],
    dgm: 'DGM1 Hamburg, außerhalb EU-DEM', search: 'z. B. Jungfernstieg',
    note: 'Gemessen sind 9 Bahnhofstiefen (Wikipedia); die übrigen sind aus Lage, Ebene oder OSM geschätzt, die Trasse dazwischen aus Gelände und Bauregeln. Außerhalb Hamburgs (Norderstedt, Ahrensburg, Großhansdorf) Gelände nach EU-DEM 25 m. U2 und U4 teilen zwischen Jungfernstieg und Berliner Tor dasselbe Gleis; die Röhren sind dort nur zur Lesbarkeit nebeneinander gezeichnet. Liniennummern sind die heutigen; ZR = Zweigbahn Rothenburgsort (1915–1943).',
    attribution: 'Gelände: DGM1 © Freie und Hansestadt Hamburg, LGV (dl-de/by-2.0), außerhalb EU-DEM (Copernicus) · Geschichte und Tiefen: Wikipedia (CC BY-SA 4.0), Wikidata (CC0) · Lage: © OpenStreetMap-Mitwirkende (ODbL)',
  },
  {
    id: 'muenchen', name: 'München', ready: true, data: 'muenchen/', tiles: 'muenchen.pmtiles', basemap: true,
    origin: { lon: 11.5755, lat: 48.1374 }, h0: 520, startYear: 1971,
    // MVG-Farben; U7 und U8 sind zweifarbig (Liniensignet diagonal geteilt): color + color2
    lines: [{ id: 'U1', color: '#52822F' }, { id: 'U2', color: '#C20831' }, { id: 'U3', color: '#EC6725' }, { id: 'U4', color: '#00A984' },
      { id: 'U5', color: '#BC7A00' }, { id: 'U6', color: '#0065AE' }, { id: 'U7', color: '#52822F', color2: '#C20831' }, { id: 'U8', color: '#C20831', color2: '#EC6725' }],
    dgm: 'DGM1 Bayern', search: 'z. B. Marienplatz',
    note: 'Gemessen sind nur 18 Bahnhofstiefen; die übrigen sind aus Bahnsteigebene (OSM/Wikipedia) geschätzt, die Trasse dazwischen aus Gelände und Bauregeln. Linien, die sich einen Tunnel teilen (Stammstrecken), sind nebeneinander gezeichnet – nur zur Lesbarkeit. Liniennummern nach Betriebsperioden (z. B. U8 1980–1988, heute U2); Farben nach heutiger Nummer.',
    attribution: 'Gelände: DGM1 © Bayerische Vermessungsverwaltung, geodaten.bayern.de (CC BY 4.0) · Geschichte und Tiefen: Wikipedia (CC BY-SA 4.0), Wikidata (CC0) · Lage: © OpenStreetMap-Mitwirkende (ODbL)',
  },
  {
    id: 'nuernberg', name: 'Nürnberg', ready: true, data: 'nuernberg/', tiles: 'nuernberg.pmtiles', basemap: true,
    origin: { lon: 11.0767, lat: 49.4521 }, h0: 310, startYear: 1970,
    lines: [{ id: 'U1', color: '#0067A6' }, { id: 'U2', color: '#E2001A' }, { id: 'U3', color: '#00A3A0' }],
    dgm: 'DGM1 Bayern', search: 'z. B. Plärrer',
    note: 'Nürnberg und Fürth. Tiefen zwischen den Bahnhöfen sind aus Gelände und Bauregeln geschätzt, nicht gemessen. U2 und U3 teilen zwischen Rothenburger Straße und Rathenauplatz dasselbe Gleis; die Röhren sind dort nur zur Lesbarkeit nebeneinander gezeichnet. Plärrer ist ein Richtungsbahnhof: je Linie liegt eine Fahrtrichtung auf Ebene −3, die andere auf −2. Gestrichelt: U3 Großreuth – Gebersdorf im Bau (Höhenlage geschätzt).',
    attribution: 'Gelände: DGM1 © Bayerische Vermessungsverwaltung, geodaten.bayern.de (CC BY 4.0) · Geschichte und Tiefen: Wikipedia (CC BY-SA 4.0) · Lage: © OpenStreetMap-Mitwirkende (ODbL)',
  },
];

export let CITY = CITIES[0];
export let LINE_COLOR = {};
export let LINE_COLOR2 = {};
// CSS-Hintergrund für Liniensignet/Farbfeld: zweifarbige Linien diagonal geteilt wie bei der MVG
export const lineBg = (id, color) => (LINE_COLOR2[id] ? `linear-gradient(135deg, ${LINE_COLOR[id]} 50%, ${LINE_COLOR2[id]} 50%)` : color || LINE_COLOR[id]);
export function setCity(id) {
  const c = CITIES.find((x) => x.id === id && x.ready) || CITIES[0];
  if (c === CITY && Object.keys(LINE_COLOR).length) return c;
  CITY = c;
  LINE_COLOR = Object.fromEntries(c.lines.map((l) => [l.id, l.color]));
  LINE_COLOR2 = Object.fromEntries(c.lines.filter((l) => l.color2).map((l) => [l.id, l.color2]));
  setOrigin(c.origin);
  return c;
}
export const cityFromHash = () => {
  const h = (typeof window !== 'undefined' ? window.location.hash : '').replace('#', '');
  return CITIES.find((c) => c.id === h && c.ready)?.id || 'berlin';
};
setCity('berlin');
