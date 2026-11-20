// Schematische Oberfläche: basemap3d.geojson (WGS84, Datenpaket der Stadt) → public/data/<stadt>/basemap.json
// in lokalen Metern der App (x = Ost, z = −Nord, Ursprung aus lib/city.js), ganzzahlig gerundet.
// Aufruf im App-Ordner: node scripts/basemap3d.mjs muenchen [Pfad\zu\basemap3d.geojson]
import fs from 'node:fs';
import path from 'node:path';
import { setOrigin, toXZ } from '../src/lib/geo.js';

const SRC = { berlin: '../../basemap3d/berlin', hamburg: '../../Hamburg/basemap3d', muenchen: '../../München/basemap3d', nuernberg: '../../Nürnberg/basemap3d' };
const id = process.argv[2];
if (!SRC[id]) { console.error('Stadt: berlin | hamburg | muenchen | nuernberg'); process.exit(1); }
// Ursprung und Datenordner direkt aus lib/city.js lesen (eine Quelle für App und Skript)
const cityJs = fs.readFileSync(new URL('../src/lib/city.js', import.meta.url), 'utf8');
const m = cityJs.match(new RegExp(`id: '${id}'[^]*?data: '([^']*)'[^]*?origin: \\{ lon: ([\\d.]+), lat: ([\\d.]+) \\}`));
if (!m) { console.error(`Stadt ${id} nicht in city.js gefunden`); process.exit(1); }
const CITY = { data: m[1] }; setOrigin({ lon: Number(m[2]), lat: Number(m[3]) });
console.log(`Ursprung ${m[2]}, ${m[3]}`);
const src = process.argv[3] || path.join(SRC[id], 'basemap3d.geojson');
const gj = JSON.parse(fs.readFileSync(src, 'utf8'));

const ring = (r) => {
  const out = [];
  for (const [lon, lat] of r) {
    const [x, z] = toXZ(lon, lat); const xi = Math.round(x); const zi = Math.round(z);
    if (out.length >= 2 && out[out.length - 2] === xi && out[out.length - 1] === zi) continue; // doppelte Punkte nach Rundung
    out.push(xi, zi);
  }
  return out;
};
const polys = {}; const lines = {}; const widths = {}; let nPoly = 0; let nLine = 0; const skipped = [];
for (const f of gj.features) {
  const { layer, kind, width_m: w } = f.properties; const g = f.geometry; const key = `${layer}:${kind}`;
  if (g.type === 'Polygon' || g.type === 'MultiPolygon') {
    const list = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
    for (const p of list) {
      const rings = p.map(ring).filter((r) => r.length >= 8); // mind. 4 Punkte (geschlossen)
      if (!rings.length) { skipped.push(key); continue; }
      (polys[key] ||= []).push(rings); nPoly++;
    }
  } else if (g.type === 'LineString' || g.type === 'MultiLineString') {
    const list = g.type === 'LineString' ? [g.coordinates] : g.coordinates;
    for (const l of list) {
      const r = ring(l); if (r.length < 4) { skipped.push(key); continue; }
      (lines[key] ||= []).push(r); nLine++;
      if (layer === 'waterway') (widths[key] ||= []).push(Math.round(w || 0));
    }
  } else skipped.push(`${key}:${g.type}`);
}
const out = { city: id, source: path.basename(src), bbox: gj.bbox, polys, lines, widths };
const dir = path.join('public/data', CITY.data); fs.mkdirSync(dir, { recursive: true });
const file = path.join(dir, 'basemap.json'); fs.writeFileSync(file, JSON.stringify(out));
console.log(`${file}: ${nPoly} Flächen, ${nLine} Linien, ${(fs.statSync(file).size / 1e6).toFixed(2)} MB; übersprungen ${skipped.length}`);
console.log(Object.entries({ ...polys, ...lines }).map(([k, v]) => `${k} ${v.length}`).join(' · '));
