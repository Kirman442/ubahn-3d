// Stoßfreie Röhren (Darstellung): an jedem Bahnhof enden alle Röhren derselben Linie im selben Punkt.
// Nötig, wo Linien eines gemeinsamen Tunnels seitlich versetzt gezeichnet werden (der Versatz beginnt sonst
// sprunghaft). Lage = Mittel der Röhrenenden; die Röhre wird auf den letzten BL m weich (smoothstep) dorthin
// gezogen, der Bahnhof sitzt im selben Punkt. Höhen bleiben unverändert. Röhren mit dir 'B' (Gegenrichtung
// mit eigener Ebene, z. B. Plärrer) und ihre Bahnhofseinträge (alt) bleiben unberührt.
// Als Modul aus den Konvertern, oder einzeln auf eine fertige Ausgabe: node scripts/join_ends.mjs hamburg
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export function joinEnds({ sections, stations, props }, { BL = 250, lat0 = 50 } = {}) {
  const MY = 111132; const MX = 111320 * Math.cos((lat0 * Math.PI) / 180);
  const use = sections.filter((s) => s.dir !== 'B');
  const junc = {};
  for (const sc of use) {
    for (const [nm, k] of [[sc.from, 0], [sc.to, sc.xyz.length - 1]]) {
      const j = (junc[`${sc.line}|${nm}`] ||= { lon: 0, lat: 0, n: 0, seen: new Set() });
      if (j.seen.has(sc.xyz)) continue; j.seen.add(sc.xyz);
      j.lon += sc.xyz[k][0]; j.lat += sc.xyz[k][1]; j.n++;
    }
  }
  Object.values(junc).forEach((j) => { j.lon /= j.n; j.lat /= j.n; });
  const done = new Map(); let moved = 0;
  for (const sc of use) {
    if (done.has(sc.xyz)) { sc.xyz = done.get(sc.xyz); continue; }
    const P = sc.xyz.map((q) => [...q]); const m = P.length;
    const cum = [0]; for (let k = 1; k < m; k++) cum.push(cum[k - 1] + Math.hypot((P[k][0] - P[k - 1][0]) * MX, (P[k][1] - P[k - 1][1]) * MY));
    const L = cum[m - 1]; const bl = Math.min(BL, L / 2.5);
    for (const [nm, endIdx] of [[sc.from, 0], [sc.to, m - 1]]) {
      const j = junc[`${sc.line}|${nm}`]; const e = P[endIdx]; const d0 = [j.lon - e[0], j.lat - e[1]];
      if (Math.abs(d0[0] * MX) + Math.abs(d0[1] * MY) < 0.5) continue;
      moved++;
      for (let k = 0; k < m; k++) {
        const d = endIdx === 0 ? cum[k] : L - cum[k]; if (d >= bl) continue;
        const t = 1 - d / bl; const w = t * t * (3 - 2 * t);
        P[k][0] = +(P[k][0] + d0[0] * w).toFixed(7); P[k][1] = +(P[k][1] + d0[1] * w).toFixed(7);
      }
    }
    done.set(sc.xyz, P); sc.xyz = P;
  }
  for (const st of stations) { if (st.alt) continue; const j = junc[`${st.line}|${st.name}`]; if (j) { st.lon = +j.lon.toFixed(7); st.lat = +j.lat.toFixed(7); } }
  const ids = new Set(stations.filter((s) => !s.alt).map((s) => s.id));
  for (const f of props || []) { if (!ids.has(f.properties.id)) continue; const j = junc[`${f.properties.line}|${f.properties.name}`]; if (j) f.geometry.coordinates = [+j.lon.toFixed(7), +j.lat.toFixed(7)]; }
  return moved;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const dir = path.resolve('public/data', process.argv[2] || '');
  const nw = JSON.parse(fs.readFileSync(path.join(dir, 'network3d.json'), 'utf8'));
  const gj = JSON.parse(fs.readFileSync(path.join(dir, 'stations.geojson'), 'utf8'));
  const lat0 = nw.stations.reduce((a, s) => a + s.lat, 0) / nw.stations.length;
  const moved = joinEnds({ sections: nw.sections, stations: nw.stations, props: gj.features }, { lat0 });
  fs.writeFileSync(path.join(dir, 'network3d.json'), JSON.stringify(nw));
  fs.writeFileSync(path.join(dir, 'stations.geojson'), JSON.stringify(gj));
  console.log(`${dir}: Röhrenenden angeglichen ${moved}`);
}
