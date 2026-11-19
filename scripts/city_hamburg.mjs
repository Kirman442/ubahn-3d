// Hamburg → App-Format (public/data/hamburg/network3d.json + stations.geojson).
// Aufruf im App-Ordner:  node scripts/city_hamburg.mjs  [Pfad zum Ordner ubahn-data/Hamburg]
// Grundlage: docs/handoff_builder_hh.md. depth/network3d.json ist schon im Berliner Format.
// Gemeinsame Gleise U2/U4 (Jungfernstieg–Berliner Tor): Abschnitt für U4 dupliziert, beide um OFFSET m seitlich
// auseinandergezogen (reine Darstellung). ZR = Zweigbahn Rothenburgsort (1915–1943), heute ohne Liniennummer.
import fs from 'node:fs';
import path from 'node:path';

const SRC = process.argv[2] || path.resolve('../../Hamburg');
const OUT = path.resolve('public/data/hamburg');
const OFFSET = 45;
const rd = (p) => JSON.parse(fs.readFileSync(path.join(SRC, p), 'utf8'));
const net = rd('depth/network3d.json');
const sj = rd('stations/stations.json');
const recs = Object.fromEntries((sj.stations || sj).map((s) => [s.id, s]));
const MY = 111132; const MX = 111320 * Math.cos((53.55 * Math.PI) / 180);
const later = (...d) => d.filter(Boolean).sort().pop();

function shift(xyz, side) {
  const n = xyz.length;
  return xyz.map((p, k) => {
    const a = xyz[Math.max(0, k - 3)]; const b = xyz[Math.min(n - 1, k + 3)];
    const dx = (b[0] - a[0]) * MX; const dy = (b[1] - a[1]) * MY; const L = Math.hypot(dx, dy) || 1;
    return [+(p[0] + ((dy / L) * side) / MX).toFixed(7), +(p[1] + ((-dx / L) * side) / MY).toFixed(7), p[2]];
  });
}
const endShift = {};
const sections = [];
for (const s of net.sections) {
  const base = { from: s.from, to: s.to, closed: s.closed, g: s.g, g_dgm: s.ground_raw_m };
  const lines = s.lines && s.lines.length ? s.lines : [s.line];
  if (lines.length > 1) {
    lines.forEach((L, i) => {
      const side = (i - (lines.length - 1) / 2) * 2 * OFFSET;
      const xyz = shift(s.xyz, side);
      endShift[`${L}|${s.from}`] = [xyz[0][0] - s.xyz[0][0], xyz[0][1] - s.xyz[0][1]];
      const m = xyz.length - 1;
      endShift[`${L}|${s.to}`] = [xyz[m][0] - s.xyz[m][0], xyz[m][1] - s.xyz[m][1]];
      // Linie fährt hier erst, seit sie an beiden Enden hält (U4 seit 2012)
      const a = net.stations.find((x) => x.line === L && x.name === s.from); const b = net.stations.find((x) => x.line === L && x.name === s.to);
      const since = (r) => r && ((recs[r.id] || {}).service_since || r.opened);
      sections.push({ ...base, line: L, opened: later(s.opened, since(a), since(b)), xyz });
    });
  } else sections.push({ ...base, line: lines[0], opened: s.opened, xyz: s.xyz });
}

const stations = []; const props = [];
for (const s of net.stations) {
  const r = recs[s.id] || {};
  const sh = endShift[`${s.line}|${s.name}`] || [0, 0];
  const lon = +(s.lon + sh[0]).toFixed(7); const lat = +(s.lat + sh[1]).toFixed(7);
  const dk = /^gemessen/.test(s.src) ? { kind: 'quelle', prec: 'punkt', quelle: s.src } : { kind: 'modell', methode: s.src };
  stations.push({ id: s.id, line: s.line, name: s.name, lon, lat, z: s.z, ground: s.ground, src: s.src, ...dk });
  props.push({ type: 'Feature', geometry: { type: 'Point', coordinates: [lon, lat] }, properties: {
    id: s.id, name: s.name, line: s.line, opened: s.opened, closed: s.closed,
    names: (r.names || []).filter((n) => n.valid_from !== '?'),
    interruptions: (r.interruptions || []).map((i) => ({ ...i, type: i.kind })),
    situation: r.situation, district: r.district, wiki_de: r.wiki_de, wikidata: r.wikidata, depth_m: -s.z } });
}

fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'network3d.json'), JSON.stringify({ stations, sections }));
fs.writeFileSync(path.join(OUT, 'stations.geojson'), JSON.stringify({ type: 'FeatureCollection', features: props }));
console.log(`Bahnhöfe ${stations.length}, Abschnitte ${sections.length} (davon U4-Kopien ${sections.length - net.sections.length})`);
