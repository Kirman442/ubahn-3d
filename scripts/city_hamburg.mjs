// Hamburg → App-Format (public/data/hamburg/network3d.json + stations.geojson).
// Aufruf im App-Ordner:  node scripts/city_hamburg.mjs  [Pfad zum Ordner ubahn-data/Hamburg]
// Grundlage: docs/handoff_builder_hh.md. depth/network3d.json ist schon im Berliner Format.
// Gemeinsame Gleise U2/U4 (Jungfernstieg–Berliner Tor): Abschnitt für U4 dupliziert, beide um OFFSET m seitlich
// auseinandergezogen (reine Darstellung). ZR = Zweigbahn Rothenburgsort (1915–1943), heute ohne Liniennummer.
import fs from 'node:fs';
import path from 'node:path';
import { joinEnds } from './join_ends.mjs';

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

// Baustellen (U4 Horner Geest, U5 Bramfeld – City Nord) aus network/construction.geojson, nur Darstellung:
// Tiefe linear über die Länge von depth_from_m nach depth_to_m, Gelände linear zwischen den Endbahnhöfen
let construction = []; let constructionStations = [];
if (fs.existsSync(path.join(SRC, 'network/construction.geojson'))) {
  const cons = rd('network/construction.geojson');
  const pts = cons.features.filter((f) => f.geometry.type === 'Point');
  const gnd = (line, name) => (pts.find((f) => f.properties.line === line && f.properties.name === name) || {}).properties?.ground_dgm1_m;
  construction = cons.features.filter((f) => f.geometry.type === 'LineString').map((f) => {
    const p = f.properties; const c = f.geometry.coordinates;
    const d = [0]; for (let k = 1; k < c.length; k++) d.push(d[k - 1] + Math.hypot((c[k][0] - c[k - 1][0]) * MX, (c[k][1] - c[k - 1][1]) * MY));
    const L = d[d.length - 1] || 1;
    // Endet die Baustelle an einem bestehenden Bahnhof, gelten dessen Tiefe und Gelände aus dem Netz (sonst Sprung am Anschluss)
    const ex = (name) => stations.find((x) => x.line === p.line && x.name === name) || stations.find((x) => x.name === name);
    const A = ex(p.from); const B = ex(p.to);
    const z0 = A ? A.z : p.depth_from_m; const z1 = B ? B.z : p.depth_to_m;
    const g0 = A ? A.ground : gnd(p.line, p.from); const g1 = B ? B.ground : gnd(p.line, p.to);
    if (A && Math.abs(A.z - p.depth_from_m) > 0.5) console.log(`Anschluss ${p.line} ${p.from}: Netz ${A.z} m statt ${p.depth_from_m} m`);
    if (B && Math.abs(B.z - p.depth_to_m) > 0.5) console.log(`Anschluss ${p.line} ${p.to}: Netz ${B.z} m statt ${p.depth_to_m} m`);
    const lerp = (a, b, t) => +(a + (b - a) * t).toFixed(2);
    return { line: p.line, from: p.from, to: p.to, opening: p.expected_opening,
      xyz: c.map(([lon, lat], k) => [lon, lat, lerp(z0, z1, d[k] / L)]),
      g: c.map((_, k) => lerp(g0 ?? g1, g1 ?? g0, d[k] / L)) };
  });
  // Bestehende Bahnhöfe (Horner Rennbahn, Sengelmannstraße) sind schon im Netz
  constructionStations = pts.filter((f) => !/^bestehend/.test(f.properties.status)).map((f) => ({ name: f.properties.name, line: f.properties.line,
    lon: f.geometry.coordinates[0], lat: f.geometry.coordinates[1], z: f.properties.depth_m, ground: f.properties.ground_dgm1_m, opening: f.properties.expected_opening }));
}

fs.mkdirSync(OUT, { recursive: true });
// Röhrenenden je Linie und Bahnhof zusammenführen (seitlicher Versatz gemeinsamer Tunnel ohne Sprung)
console.log(`Röhrenenden angeglichen: ${joinEnds({ sections, stations, props }, { lat0: stations[0].lat })}`);
fs.writeFileSync(path.join(OUT, 'network3d.json'), JSON.stringify({ stations, sections, construction, constructionStations }));
fs.writeFileSync(path.join(OUT, 'stations.geojson'), JSON.stringify({ type: 'FeatureCollection', features: props }));
console.log(`Bahnhöfe ${stations.length}, Abschnitte ${sections.length} (davon U4-Kopien ${sections.length - net.sections.length}), Baustelle ${construction.length} Abschnitte, ${constructionStations.length} Bahnhöfe`);
