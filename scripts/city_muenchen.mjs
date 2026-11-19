// München → App-Format (public/data/muenchen/network3d.json + stations.geojson).
// Aufruf im App-Ordner:  node scripts/city_muenchen.mjs  [Pfad zum Ordner ubahn-data/München]
// Grundlage: package/HANDOFF.md. Liniennummern historisch nach network/line_service.json: jede Betriebsperiode
// (Linie, frm–to, Pfad) ergibt Röhren zwischen benachbarten Bahnhöfen; lückenlos aufeinanderfolgende Perioden
// derselben Linie werden zusammengefasst. Höhe = rail_top_est_m_nhn relativ zu ground_smooth_m.
// Linien, die jemals denselben Tunnelabschnitt befahren, liegen zur Lesbarkeit um SP m nebeneinander (Darstellung).
import fs from 'node:fs';
import path from 'node:path';

const SRC = process.argv[2] || path.resolve('../../München');
const OUT = path.resolve('public/data/muenchen');
const SP = 80;
const rd = (p) => JSON.parse(fs.readFileSync(path.join(SRC, p), 'utf8'));
const recs = rd('package/stations_3d.json').stations.filter((s) => s.status !== 'planned' && s.status !== 'construction' && s.opened);
const feats = rd('package/segments_3d.geojson').features;
const svc = rd('network/line_service.json');
const ORDER = ['U1', 'U2', 'U3', 'U4', 'U5', 'U6', 'U7', 'U8'];
const MY = 111132; const MX = 111320 * Math.cos((48.14 * Math.PI) / 180);
const later = (...d) => d.filter(Boolean).sort().pop();
const pk = (a, b) => [a, b].sort().join('|');

// Abschnitt für ein Bahnhofspaar: bevorzugt der, den die Linie heute befährt, sonst eine heutige Linie mit beiden Bahnhöfen
const byPair = {};
feats.forEach((f) => { (byPair[pk(f.properties.a, f.properties.b)] ||= []).push(f); });
const routes = svc.routes_current;
function segFor(L, a, b) {
  const c = byPair[pk(a, b)];
  if (!c) return null;
  return c.find((f) => f.properties.lines.includes(L))
    || c.find((f) => f.properties.lines.some((x) => routes[x]?.includes(a) && routes[x]?.includes(b))) || c[0];
}

// 1) Dienste je (Linie, Abschnitt) als Zeitintervalle, lückenlose zusammenfassen
const uses = {}; // `${L}|${segId}` → {L, f, frmName, toName, iv:[[from,to]]}
for (const p of svc.service) {
  for (let k = 1; k < p.path.length; k++) {
    const a = p.path[k - 1]; const b = p.path[k]; const f = segFor(p.line, a, b);
    if (!f) { console.warn('kein Abschnitt:', p.line, a, b); continue; }
    const key = `${p.line}|${f.properties.id}`;
    const u = (uses[key] ||= { L: p.line, f, from: a, to: b, iv: [] });
    u.iv.push([p.frm, p.to]);
  }
}
const merge = (iv) => iv.sort((x, y) => x[0].localeCompare(y[0])).reduce((m, [s, e]) => {
  const last = m[m.length - 1];
  if (last && last[1] && last[1] >= s) { last[1] = !e || !last[1] ? null : later(last[1], e); } else m.push([s, e]);
  return m;
}, []);

// Seitenlage je Abschnitt: alle Linien, die ihn je befahren
const segLines = {};
Object.values(uses).forEach((u) => { (segLines[u.f.properties.id] ||= new Set()).add(u.L); });
const refDir = {};
Object.values(uses).sort((x, y) => ORDER.indexOf(x.L) - ORDER.indexOf(y.L)).forEach((u) => { if (!(u.f.properties.id in refDir)) refDir[u.f.properties.id] = u.from; });

const endShift = {};
const sections = [];
for (const u of Object.values(uses)) {
  const p = u.f.properties; const va = p.vertex_attrs;
  let pts = u.f.geometry.coordinates.map((c, k) => ({ lon: c[0], lat: c[1], raw: c[2], g: va[k].ground_smooth_m, z: +(va[k].rail_top_est_m_nhn - va[k].ground_smooth_m).toFixed(2) }));
  if (p.a !== u.from) pts = pts.reverse();
  const lines = ORDER.filter((x) => segLines[p.id].has(x)); const n = lines.length;
  if (n > 1) {
    const side = (lines.indexOf(u.L) - (n - 1) / 2) * SP * (refDir[p.id] === u.from ? 1 : -1);
    const base = pts.map((q) => [q.lon, q.lat]); const m = base.length;
    pts = pts.map((q, k) => {
      const a = base[Math.max(0, k - 3)]; const b = base[Math.min(m - 1, k + 3)];
      const dx = (b[0] - a[0]) * MX; const dy = (b[1] - a[1]) * MY; const len = Math.hypot(dx, dy) || 1;
      return { ...q, lon: +(q.lon + ((dy / len) * side) / MX).toFixed(7), lat: +(q.lat + ((-dx / len) * side) / MY).toFixed(7) };
    });
    endShift[`${u.L}|${u.from}`] = [pts[0].lon - base[0][0], pts[0].lat - base[0][1]];
    endShift[`${u.L}|${u.to}`] = [pts[m - 1].lon - base[m - 1][0], pts[m - 1].lat - base[m - 1][1]];
  }
  const xyz = pts.map((q) => [q.lon, q.lat, q.z]); const g = pts.map((q) => q.g); const gd = pts.map((q) => q.raw);
  merge(u.iv).forEach(([s, e]) => sections.push({ line: u.L, from: u.from, to: u.to, opened: later(s, p.opened), closed: e, xyz, g, g_dgm: gd }));
}

// 2) Bahnhöfe je (Linie, Name) und Betriebsintervall; Lage/Tiefe vom Bahnsteig, den die Linie benutzt
const recBy = {}; recs.forEach((r) => { (recBy[r.name] ||= []).push(r); });
const stIv = {};
for (const p of svc.service) p.path.forEach((nm) => { (stIv[`${p.line}|${nm}`] ||= { L: p.line, nm, iv: [] }).iv.push([p.frm, p.to]); });
const stations = []; const props = [];
for (const { L, nm, iv } of Object.values(stIv)) {
  const cand = recBy[nm] || [];
  // Bahnsteig: heutiger Eintrag derselben Linie, sonst der einer Linie, deren heutige Strecke die Nachbarn dieser Periode teilt
  const r = cand.find((x) => x.line === L && (routes[L] || []).includes(nm))
    || cand.find((x) => svc.service.some((p) => p.line === L && p.path.includes(nm) && (routes[x.line] || []).includes(p.path[Math.max(0, p.path.indexOf(nm) - 1)]) && (routes[x.line] || []).includes(p.path[Math.min(p.path.length - 1, p.path.indexOf(nm) + 1)])))
    || cand[0];
  if (!r) { console.warn('kein Bahnhof:', L, nm); continue; }
  const src = r.depth_source || '';
  const dk = /^measured/.test(src) ? { kind: 'quelle', prec: /\bca\.|rund|etwa/.test(src) ? 'ca' : 'punkt', quelle: src.replace(/^measured:\s*/, '') } : { kind: 'modell', methode: src || 'Schätzung' };
  const sh = endShift[`${L}|${nm}`] || [0, 0];
  const lon = +(r.lon + sh[0]).toFixed(7); const lat = +(r.lat + sh[1]).toFixed(7);
  const z = r.depth_m == null ? 0 : -r.depth_m;
  const code = r.id.split('-').slice(1).join('-');
  merge(iv).forEach(([s, e], k) => {
    const id = `${L}-${code}${k ? `~${k}` : ''}`;
    stations.push({ id, line: L, name: nm, lon, lat, z, ground: r.ground_dgm1_m, src, ...dk });
    props.push({ type: 'Feature', geometry: { type: 'Point', coordinates: [lon, lat] }, properties: {
      id, name: nm, line: L, opened: later(s, r.station_opened || r.opened), closed: e, names: r.names || [], interruptions: r.interruptions || [],
      situation: r.position === 'surface' ? (z > 1 ? 'Hochbahn' : 'oberirdisch') : 'Tunnel', wiki_de: r.dewiki, wikidata: r.wikidata, depth_m: -z } });
  });
}

fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'network3d.json'), JSON.stringify({ stations, sections }));
fs.writeFileSync(path.join(OUT, 'stations.geojson'), JSON.stringify({ type: 'FeatureCollection', features: props }));
console.log(`Bahnhofseinträge ${stations.length}, Röhren ${sections.length}`);
