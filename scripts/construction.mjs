// Baustellen aus <Stadt>/network/construction.geojson ins App-Format (nur Darstellung, gestrichelt).
// Tiefe linear über die Länge von depth_from_m nach depth_to_m, Gelände linear zwischen den Endbahnhöfen.
// Endet eine Baustelle an einem bestehenden Bahnhof, gelten dessen Tiefe und Gelände aus dem Netz (sonst Sprung am Anschluss).
// Fehlt eine Tiefe (z. B. München Am Knie, Pasing), wird die nächste bekannte entlang der Linie gehalten: geschätzt, Hinweis im «i».
// sign: +1, wenn depth_* schon relativ mit Vorzeichen ist (Hamburg: −10 = unter Gelände), −1, wenn positiv nach unten (München).
export function buildConstruction(cons, stations, { MX, MY, sign = 1 }) {
  const pts = cons.features.filter((f) => f.geometry.type === 'Point');
  const lines = cons.features.filter((f) => f.geometry.type === 'LineString');
  const pt = (line, name) => pts.find((f) => f.properties.line === line && f.properties.name === name)?.properties;
  const ex = (line, name) => stations.find((x) => x.line === line && x.name === name) || stations.find((x) => x.name === name);
  const dz = (v) => (v == null ? null : sign * v);
  // Tiefe je Bahnhof: Netz > Punkt > Abschnittsangabe
  const depth = {}; const ground = {};
  const put = (line, name, d) => {
    const k = `${line}|${name}`; const e = ex(line, name); const p = pt(line, name);
    if (e) { depth[k] = e.z; ground[k] = e.ground; return; }
    if (depth[k] == null) depth[k] = p?.depth_m != null ? dz(p.depth_m) : d;
    if (ground[k] == null) ground[k] = p?.ground_dgm1_m;
  };
  lines.forEach((f) => { const p = f.properties; put(p.line, p.from, dz(p.depth_from_m)); put(p.line, p.to, dz(p.depth_to_m)); });
  // Lücken entlang jeder Linie mit dem nächsten bekannten Wert füllen (vorwärts, dann rückwärts)
  const guessed = new Set();
  for (const L of new Set(lines.map((f) => f.properties.line))) {
    const seq = lines.filter((f) => f.properties.line === L).flatMap((f) => [f.properties.from, f.properties.to]).filter((n, i, a) => a.indexOf(n) === i);
    let last = null;
    for (const n of seq) { const k = `${L}|${n}`; if (depth[k] == null && last != null) { depth[k] = last; guessed.add(k); } last = depth[k] ?? last; }
    last = null;
    for (const n of [...seq].reverse()) { const k = `${L}|${n}`; if (depth[k] == null && last != null) { depth[k] = last; guessed.add(k); } last = depth[k] ?? last; }
  }
  const lerp = (a, b, t) => +(a + (b - a) * t).toFixed(2);
  const construction = lines.map((f) => {
    const p = f.properties; const c = f.geometry.coordinates;
    const d = [0]; for (let k = 1; k < c.length; k++) d.push(d[k - 1] + Math.hypot((c[k][0] - c[k - 1][0]) * MX, (c[k][1] - c[k - 1][1]) * MY));
    const L = d[d.length - 1] || 1; const a = `${p.line}|${p.from}`; const b = `${p.line}|${p.to}`;
    const A = ex(p.line, p.from); const B = ex(p.line, p.to);
    if (A && p.depth_from_m != null && Math.abs(A.z - dz(p.depth_from_m)) > 0.5) console.log(`Anschluss ${p.line} ${p.from}: Netz ${A.z} m statt ${dz(p.depth_from_m)} m`);
    if (B && p.depth_to_m != null && Math.abs(B.z - dz(p.depth_to_m)) > 0.5) console.log(`Anschluss ${p.line} ${p.to}: Netz ${B.z} m statt ${dz(p.depth_to_m)} m`);
    const g0 = ground[a] ?? ground[b]; const g1 = ground[b] ?? ground[a];
    return { line: p.line, from: p.from, to: p.to, opening: p.expected_opening, guessed: guessed.has(a) || guessed.has(b),
      xyz: c.map(([lon, lat], k) => [lon, lat, lerp(depth[a], depth[b], d[k] / L)]), g: c.map((_, k) => lerp(g0, g1, d[k] / L)) };
  });
  // Bestehende Bahnhöfe sind schon im Netz
  const constructionStations = pts.filter((f) => !/^bestehend/.test(f.properties.status || '') && !ex(f.properties.line, f.properties.name)).map((f) => {
    const k = `${f.properties.line}|${f.properties.name}`;
    return { name: f.properties.name, line: f.properties.line, lon: f.geometry.coordinates[0], lat: f.geometry.coordinates[1],
      z: depth[k], ground: f.properties.ground_dgm1_m, opening: f.properties.expected_opening, guessed: guessed.has(k) };
  });
  if (guessed.size) console.log(`Tiefe fehlt, gehalten: ${[...guessed].join(', ')}`);
  return { construction, constructionStations };
}
