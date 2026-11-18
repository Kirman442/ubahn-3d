import { useEffect, useMemo, useRef, useState } from 'react';
import Scene from './components/Scene';
import Panel from './components/Panel';
import TimeControl from './components/TimeControl';
import { END_YEAR, DEFAULT_EXAG, LINE_COLOR } from './lib/config';
import { BASEMAPS, basemapStyle } from './lib/basemap';
import { toXZ } from './lib/geo';
import { isoForYear, stateAt, sectionOpenAt, interruptionAt, nameAt } from './lib/time';

const load = (name) => fetch(`/data/${name}`, { cache: 'no-cache' }).then((r) => {
  if (!r.ok) throw new Error(`${name}: HTTP ${r.status}`);
  return r.json();
});

// network3d.json (z относительно поверхности DGM1) + stations.geojson (даты, имена, перерывы)
function prepare(net, geo) {
  const props = Object.fromEntries(geo.features.map((f) => [f.properties.id, f.properties]));
  const stations = net.stations.map((s) => {
    const [x, zz] = toXZ(s.lon, s.lat);
    return { ...props[s.id], ...s, color: LINE_COLOR[s.line], x, zz };
  });
  const sections = net.sections.map((s) => {
    const pts = s.xyz.map(([lon, lat, z]) => { const [x, zz] = toXZ(lon, lat); return [x, z, zz]; });
    let len = 0;
    for (let i = 1; i < pts.length; i++) len += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][2] - pts[i - 1][2]);
    const zs = pts.map((p) => p[1]);
    return { ...s, pts, color: LINE_COLOR[s.line], length_m: len, zmin: Math.min(...zs), zmax: Math.max(...zs) };
  });
  return { stations, sections };
}

export default function App() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [year, setYear] = useState(END_YEAR);
  const [playing, setPlaying] = useState(false);
  const [hiddenLines, setHiddenLines] = useState(() => new Set());
  const [basemap, setBasemap] = useState(BASEMAPS[0]);
  const [exag, setExag] = useState(DEFAULT_EXAG);
  const [opacity, setOpacity] = useState(0.55);
  const [labels, setLabels] = useState(true);
  const [selected, setSelected] = useState(null);
  const scene = useRef();

  useEffect(() => {
    Promise.all([load('network3d.json'), load('stations.geojson')])
      .then(([net, geo]) => setData(prepare(net, geo)))
      .catch((e) => setError(e.message));
  }, []);

  const iso = isoForYear(year);
  const groundStyle = useMemo(() => basemapStyle(basemap), [basemap]);

  const view = useMemo(() => {
    if (!data) return null;
    const sectionVisible = data.sections.map((s) => !hiddenLines.has(s.line) && sectionOpenAt(s, iso));
    const stations = [];
    for (const s of data.stations) {
      if (hiddenLines.has(s.line)) continue;
      const state = stateAt(s, iso);
      if (state !== 'hidden') stations.push({ ...s, state });
    }
    // подпись одна на пересадочный узел
    const seen = new Set();
    const labelItems = [];
    for (const s of stations) {
      const name = nameAt(s, iso);
      const key = `${s.wikidata || ''}|${name}`;
      if (seen.has(key)) continue;
      seen.add(key);
      labelItems.push({ x: s.x, z: s.z, zz: s.zz, text: name, color: s.color, ghost: s.state === 'interrupted' });
    }
    return { sectionVisible, stations, labelItems, stationById: Object.fromEntries(stations.map((s) => [s.id, s])) };
  }, [data, iso, hiddenLines]);

  const stats = useMemo(() => {
    const s = { stations: 0, km: 0, byLine: {}, ghost: 0, closedNoStop: 0 };
    if (!data) return s;
    const seen = new Set(); const ghost = new Set(); const noStop = new Set();
    for (const p of data.stations) {
      const st = stateAt(p, iso);
      if (st === 'interrupted') {
        const it = interruptionAt(p, iso);
        (it && it.type === 'geisterbahnhof' ? ghost : noStop).add(p.wikidata || p.name);
      }
      if (st !== 'open') continue;
      s.byLine[p.line] = (s.byLine[p.line] || 0) + 1;
      seen.add(p.wikidata || p.name);
    }
    s.stations = seen.size; s.ghost = ghost.size; s.closedNoStop = noStop.size;
    for (const p of data.sections) if (sectionOpenAt(p, iso)) s.km += p.length_m / 1000;
    return s;
  }, [data, iso]);

  const toggleLine = (id) => setHiddenLines((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  useEffect(() => { window.__app = { year, exag, stations: view?.stations.length, sections: view?.sectionVisible.filter(Boolean).length, stats }; }, [year, exag, view, stats]);

  return (
    <div className={`app${basemap.dark ? ' dark' : ''}`}>
      <header>
        <h1>Berliner U-Bahn 3D {year}</h1>
        <p>Tunnel, Bahnhöfe und ihre Tiefe unter der Stadt – Prototyp</p>
      </header>
      <main>
        {error && <div className="error">Daten konnten nicht geladen werden: {error}</div>}
        {data && view && (
          <Scene ref={scene} sections={data.sections} sectionVisible={view.sectionVisible} stations={view.stations}
            labelItems={view.labelItems} stationById={view.stationById} exag={exag} opacity={opacity} labels={labels}
            groundStyle={groundStyle} bg={basemap.bg} iso={iso} selected={selected} setSelected={setSelected} />
        )}
        {data && (
          <Panel stats={stats} hiddenLines={hiddenLines} toggleLine={toggleLine} basemap={basemap} setBasemap={setBasemap}
            exag={exag} setExag={setExag} opacity={opacity} setOpacity={setOpacity} labels={labels} setLabels={setLabels}
            resetView={() => scene.current?.reset()} />
        )}
        <TimeControl year={year} setYear={setYear} playing={playing} setPlaying={setPlaying} />
        <div className="attrib">
          Karte: <a href="https://protomaps.com" target="_blank" rel="noreferrer">Protomaps</a> © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>
          {' · '}Gelände: DGM1 © Geoportal Berlin{' · '}Daten: Wikipedia (CC BY-SA 4.0)
        </div>
      </main>
    </div>
  );
}
