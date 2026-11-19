// Nürnberg/Fürth → App-Format (wie Berlin: public/data/<stadt>/network3d.json + stations.geojson).
// Aufruf im App-Ordner:  node scripts/city_nuernberg.mjs  [Pfad zum Ordner ubahn-data/Nürnberg]
// Regeln (Datenpaket README, «Для сборщика»): je Strecke Richtung A; nur am Plärrer (Richtungsbahnhof, Ebenen −2/−3)
// beide Richtungen. U2/U3 teilen Rothenburger Str.–Rathenauplatz dasselbe Gleis: zur Lesbarkeit werden beide
// Röhren dort um OFFSET m seitlich auseinandergezogen (U2 links, U3 rechts der Achse) – reine Darstellung.
import fs from 'node:fs';
import path from 'node:path';

const SRC = process.argv[2] || path.resolve('../../Nürnberg');
const OUT = path.resolve('public/data/nuernberg');
const OFFSET = 45;
const rd = (p) => JSON.parse(fs.readFileSync(path.join(SRC, p), 'utf8'));
const net = rd('network/network3d.json');
const st = rd('stations/stations.json').stations;
const cons = rd('network/construction.geojson');
const byId = Object.fromEntries(st.map((s) => [s.id, s]));

const LAT0 = 49.45; const MY = 111132; const MX = 111320 * Math.cos((LAT0 * Math.PI) / 180);
const PL = 'Plärrer';
const pairKey = (a, b) => [a, b].sort().join('|');

// Herkunft der Tiefe → Vertrag aus lib/depth.js (kind/quelle/methode)
function depthKind(src) {
  if (/Bauwerkstiefe .*\(dewiki\)/.test(src)) return { kind: 'abgeleitet', quelle: `${src} (Schiene ≈ Bauwerkstiefe − 1 m)` };
  return { kind: 'modell', methode: src };
}

// Strecken: Richtung A; am Plärrer zusätzlich B
const secs = net.sections.filter((s) => s.direction === 'A' || s.from === PL || s.to === PL);
const pairsBy = {};
secs.forEach((s) => { (pairsBy[pairKey(s.from, s.to)] ||= new Set()).add(s.line); });
const shared = (s) => (s.line === 'U2' || s.line === 'U3') && pairsBy[pairKey(s.from, s.to)].has('U2') && pairsBy[pairKey(s.from, s.to)].has('U3');

const endShift = {}; // `${line}|${dir}|${name}` → [dlon, dlat]
const sections = secs.map((s) => {
  let xyz = s.xyz.map((p) => [...p]);
  if (shared(s)) {
    // Seite auf feste Achsrichtung (alphabetisch from→to) beziehen, damit A und B dieselbe Seite nehmen
    const flip = [s.from, s.to].sort()[0] !== s.from ? -1 : 1;
    const sign = (s.line === 'U2' ? 1 : -1) * flip;
    const n = xyz.length;
    xyz = xyz.map((p, k) => {
      const a = s.xyz[Math.max(0, k - 3)]; const b = s.xyz[Math.min(n - 1, k + 3)];
      const dx = (b[0] - a[0]) * MX; const dy = (b[1] - a[1]) * MY; const L = Math.hypot(dx, dy) || 1;
      const ox = (-dy / L) * OFFSET * sign; const oy = (dx / L) * OFFSET * sign; // links der Richtung
      return [+(p[0] + ox / MX).toFixed(7), +(p[1] + oy / MY).toFixed(7), p[2]];
    });
    const sh = (k) => [xyz[k][0] - s.xyz[k][0], xyz[k][1] - s.xyz[k][1]];
    endShift[`${s.line}|${s.direction}|${s.from}`] = sh(0);
    endShift[`${s.line}|${s.direction}|${s.to}`] = sh(n - 1);
  }
  return { line: s.line, from: s.from, to: s.to, dir: s.direction, opened: s.opened, closed: s.closed, xyz, g: s.g, g_dgm: s.g_raw };
});

// Bahnhöfe; Plärrer je Richtung ein Eintrag (Ebene −3 / −2)
const stations = []; const props = [];
for (const s of net.stations) {
  const r = byId[s.id] || {};
  const dirs = s.name === PL ? ['A', 'B'] : [null];
  for (const d of dirs) {
    const pf = d ? s.platforms[d] : null;
    const z = pf ? pf.z : s.z; const src = pf ? pf.src : s.src;
    const id = d === 'B' ? `${s.id}-B` : s.id;
    let lon = pf ? pf.lon : s.lon; let lat = pf ? pf.lat : s.lat;
    const shf = endShift[`${s.line}|${d || 'A'}|${s.name}`];
    if (shf) { lon += shf[0]; lat += shf[1]; }
    stations.push({ id, line: s.line, name: s.name, lon: +lon.toFixed(7), lat: +lat.toFixed(7), z, ground: s.ground, src, ...depthKind(src), ...(d ? { ebene: d === 'A' ? 'Richtung A' : 'Richtung B', alt: d === 'B' } : {}) });
    props.push({ type: 'Feature', geometry: { type: 'Point', coordinates: [lon, lat] }, properties: {
      id, name: s.name, line: s.line, opened: r.opened, closed: r.closed, names: r.names || [], interruptions: (r.interruptions || []).map((i) => ({ ...i, type: /Umbau/.test(i.type) ? 'Umbau' : 'Sanierung', text: i.type })),
      predecessor: r.predecessor || null, opened_ubahn: r.opened_ubahn, situation: r.situation, district: r.district, wiki_de: r.wiki_de, wikidata: r.wikidata, depth_m: -z } });
  }
}

// Baustelle Großreuth – Gebersdorf (U3, ohne Höhen): Lage auf Ebene von Großreuth, nur Darstellung
const gr = net.stations.find((s) => s.id === 'U3-GR' || (s.line === 'U3' && /Großreuth/.test(s.name)));
const construction = cons.features.filter((f) => f.geometry.type === 'LineString').map((f) => ({
  line: 'U3', xyz: f.geometry.coordinates.map(([lon, lat]) => [lon, lat, gr.z]), g: f.geometry.coordinates.map(() => gr.ground) }));
const constructionStations = cons.features.filter((f) => f.geometry.type === 'Point').map((f) => ({ name: f.properties.name, lon: f.geometry.coordinates[0], lat: f.geometry.coordinates[1], z: gr.z, ground: gr.ground }));

fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'network3d.json'), JSON.stringify({ stations, sections, construction, constructionStations }));
fs.writeFileSync(path.join(OUT, 'stations.geojson'), JSON.stringify({ type: 'FeatureCollection', features: props }));
console.log(`Bahnhöfe ${stations.length}, Strecken ${sections.length} (geteilt U2/U3: ${sections.filter(shared).length}), Baustelle ${construction.length} Linien, ${constructionStations.length} Bahnhöfe`);
