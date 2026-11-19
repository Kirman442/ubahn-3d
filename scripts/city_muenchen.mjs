// München → App-Format (public/data/muenchen/network3d.json + stations.geojson).
// Aufruf im App-Ordner:  node scripts/city_muenchen.mjs  [Pfad zum Ordner ubahn-data/München]
// Grundlage: package/HANDOFF.md. Je heutiger Linie (line_segments.json) eine Röhre pro Abschnitt; Höhe = rail_top_est_m_nhn
// relativ zu ground_smooth_m. Mehrere Linien im selben Tunnel (Stammstrecken) werden zur Lesbarkeit um SP m seitlich
// nebeneinander gezeichnet – reine Darstellung. Historische Liniennummern (line_service.json) sind noch nicht abgebildet.
import fs from 'node:fs';
import path from 'node:path';

const SRC = process.argv[2] || path.resolve('../../München');
const OUT = path.resolve('public/data/muenchen');
const SP = 80;
const rd = (p) => JSON.parse(fs.readFileSync(path.join(SRC, p), 'utf8'));
const st = rd('package/stations_3d.json').stations.filter((s) => s.status !== 'planned' && s.status !== 'construction' && s.opened);
const segs = Object.fromEntries(rd('package/segments_3d.geojson').features.map((f) => [f.properties.id, f]));
const lineSegs = rd('package/line_segments.json');
const ORDER = ['U1', 'U2', 'U3', 'U4', 'U5', 'U6', 'U7', 'U8'];
const MY = 111132; const MX = 111320 * Math.cos((48.14 * Math.PI) / 180);

// Fahrtrichtung je Abschnitt: wie in der Liste der niedrigsten Linie, damit Nachbarabschnitte dieselbe Seite nehmen
const refDir = {};
for (const L of ORDER) for (const e of lineSegs[L] || []) if (!(e.segment in refDir)) refDir[e.segment] = e.frm;

const endShift = {};
const sections = [];
for (const L of ORDER) {
  for (const e of lineSegs[L] || []) {
    const f = segs[e.segment];
    if (!f) { console.warn('fehlt:', e.segment); continue; }
    const p = f.properties; const va = p.vertex_attrs;
    let pts = f.geometry.coordinates.map((c, k) => ({ lon: c[0], lat: c[1], raw: c[2], g: va[k].ground_smooth_m, z: +(va[k].rail_top_est_m_nhn - va[k].ground_smooth_m).toFixed(2) }));
    if (p.a !== e.frm) pts = pts.reverse();
    const lines = ORDER.filter((x) => p.lines.includes(x));
    const n = lines.length;
    if (n > 1) {
      const side = (lines.indexOf(L) - (n - 1) / 2) * SP * (refDir[e.segment] === e.frm ? 1 : -1);
      const base = pts.map((q) => [q.lon, q.lat]); const m = base.length;
      pts = pts.map((q, k) => {
        const a = base[Math.max(0, k - 3)]; const b = base[Math.min(m - 1, k + 3)];
        const dx = (b[0] - a[0]) * MX; const dy = (b[1] - a[1]) * MY; const len = Math.hypot(dx, dy) || 1;
        return { ...q, lon: +(q.lon + ((dy / len) * side) / MX).toFixed(7), lat: +(q.lat + ((-dx / len) * side) / MY).toFixed(7) }; // rechts der Richtung
      });
      endShift[`${L}|${e.frm}`] = [pts[0].lon - base[0][0], pts[0].lat - base[0][1]];
      endShift[`${L}|${e.to}`] = [pts[m - 1].lon - base[m - 1][0], pts[m - 1].lat - base[m - 1][1]];
    }
    sections.push({ line: L, from: e.frm, to: e.to, opened: e.opened, closed: null, xyz: pts.map((q) => [q.lon, q.lat, q.z]), g: pts.map((q) => q.g), g_dgm: pts.map((q) => q.raw) });
  }
}

const stations = []; const props = [];
for (const s of st) {
  const src = s.depth_source || '';
  const measured = /^measured/.test(src);
  const dk = measured ? { kind: 'quelle', prec: /\bca\.|rund|etwa/.test(src) ? 'ca' : 'punkt', quelle: src.replace(/^measured:\s*/, '') } : { kind: 'modell', methode: src || 'Schätzung' };
  const sh = endShift[`${s.line}|${s.name}`] || [0, 0];
  const lon = +(s.lon + sh[0]).toFixed(7); const lat = +(s.lat + sh[1]).toFixed(7);
  const z = s.depth_m == null ? 0 : -s.depth_m;
  stations.push({ id: s.id, line: s.line, name: s.name, lon, lat, z, ground: s.ground_dgm1_m, src, ...dk });
  props.push({ type: 'Feature', geometry: { type: 'Point', coordinates: [lon, lat] }, properties: {
    id: s.id, name: s.name, line: s.line, opened: s.opened, closed: s.closed, names: s.names || [], interruptions: s.interruptions || [],
    situation: s.position === 'surface' ? (z > 1 ? 'Hochbahn' : 'oberirdisch') : 'Tunnel', wiki_de: s.dewiki, wikidata: s.wikidata, depth_m: -z } });
}

fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'network3d.json'), JSON.stringify({ stations, sections }));
fs.writeFileSync(path.join(OUT, 'stations.geojson'), JSON.stringify({ type: 'FeatureCollection', features: props }));
const km = {}; sections.forEach((s) => { km[s.line] = (km[s.line] || 0) + 1; });
console.log(`Bahnhöfe ${stations.length}, Abschnitte je Linie ${JSON.stringify(km)}, gemeinsame ${sections.length - Object.keys(segs).length}`);
