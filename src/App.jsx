import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import Scene from './components/Scene';
import Panel from './components/Panel';
import TimeControl from './components/TimeControl';
import { StationCard, LineCard, depthText } from './components/Card';
import { END_YEAR, DEFAULT_EXAG, DEEP_LABEL, LINE_COLOR } from './lib/config';
import { prepare, makeY, surfaceY, lineChain, lineProfile } from './lib/model';
import { isoForYear, stateAt, sectionOpenAt, interruptionAt, nameAt } from './lib/time';

const load = (name) => fetch(`/data/${name}`, { cache: 'no-cache' }).then((r) => {
  if (!r.ok) throw new Error(`${name}: HTTP ${r.status}`);
  return r.json();
});

const DEFAULT_OPTS = { exag: DEFAULT_EXAG, surface: 'map', surfOp: 0.55, mode: 'rel', color: 'line', labels: 'deep', shafts: true, grid: true, levels: true, transfers: true };
const cssVar = (n, fb) => getComputedStyle(document.documentElement).getPropertyValue(n).trim() || fb;

export default function App() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [year, setYear] = useState(END_YEAR);
  const [playing, setPlaying] = useState(false);
  const [hiddenLines, setHiddenLines] = useState(() => new Set());
  const [opts, setOpts] = useState(DEFAULT_OPTS);
  const [sel, setSel] = useState(null);        // {kind:'station', id} | {kind:'line', line}
  const [hover, setHover] = useState(null);
  const scene = useRef();
  const main = useRef();
  const setOpt = (k, v) => setOpts((o) => ({ ...o, [k]: v }));

  useEffect(() => {
    Promise.all([load('network3d.json'), load('stations.geojson')])
      .then(([net, geo]) => setData(prepare(net, geo)))
      .catch((e) => setError(e.message));
  }, []);

  const iso = isoForYear(year);
  const exag = useDeferredValue(opts.exag);
  const Y = useMemo(() => makeY(opts.mode, exag), [opts.mode, exag]);
  const SY = useMemo(() => surfaceY(opts.mode, exag), [opts.mode, exag]);
  const bg = useMemo(() => cssVar('--scene', '#E3E7EB'), []);

  const extent = useMemo(() => {
    if (!data) return null;
    const xs = data.stations.map((s) => s.x); const zs = data.stations.map((s) => s.zz);
    const m = 1500;
    return { x0: Math.min(...xs) - m, x1: Math.max(...xs) + m, z0: Math.min(...zs) - m, z1: Math.max(...zs) + m };
  }, [data]);

  const view = useMemo(() => {
    if (!data) return null;
    const sectionVisible = data.sections.map((s) => !hiddenLines.has(s.line) && sectionOpenAt(s, iso));
    const stations = [];
    for (const s of data.stations) {
      if (hiddenLines.has(s.line)) continue;
      const state = stateAt(s, iso);
      if (state !== 'hidden') stations.push({ ...s, state });
    }
    const byId = Object.fromEntries(stations.map((s) => [s.id, s]));
    const transfers = data.transfers.filter(([a, b]) => byId[a] && byId[b]);
    return { sectionVisible, stations, byId, transfers };
  }, [data, iso, hiddenLines]);

  const focusLine = sel?.kind === 'line' ? sel.line : null;
  const selStation = sel?.kind === 'station' ? view?.byId[sel.id] : null;
  const hoverStation = hover?.kind === 'station' ? view?.byId[hover.id] : null;

  // подписи: набор зависит только от настроек и выбора, не от камеры
  const labelItems = useMemo(() => {
    if (!view) return [];
    const want = new Map();
    const add = (s, strong) => { if (s && (!want.has(s.id) || strong)) want.set(s.id, { s, strong }); };
    view.stations.forEach((s) => {
      if (opts.labels === 'all' || (opts.labels === 'deep' && s.z <= -DEEP_LABEL)) add(s, false);
      if (focusLine && s.line === focusLine) add(s, false);
    });
    add(selStation, true);
    add(hoverStation, true);
    return [...want.values()].map(({ s, strong }) => ({
      key: s.id, x: s.x, y: Y(s.z, s.ground), z: s.zz, text: nameAt(s, iso), depth: depthText(s),
      color: s.color, ghost: s.state === 'interrupted', strong,
    }));
  }, [view, opts.labels, focusLine, selStation, hoverStation, Y, iso]);

  const stats = useMemo(() => {
    const s = { stations: 0, km: 0, byLine: {}, ghost: 0, closedNoStop: 0, maxDepth: 0 };
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
      s.maxDepth = Math.max(s.maxDepth, -p.z);
    }
    s.stations = seen.size; s.ghost = ghost.size; s.closedNoStop = noStop.size;
    for (const p of data.sections) if (sectionOpenAt(p, iso)) s.km += p.length_m / 1000;
    return s;
  }, [data, iso]);

  const deepest = useMemo(() => {
    if (!view) return [];
    const seen = new Set();
    return [...view.stations].sort((a, b) => a.z - b.z).filter((s) => {
      const k = `${s.wikidata}|${s.z}`; if (seen.has(k)) return false; seen.add(k); return true;
    }).slice(0, 10);
  }, [view]);

  const lineInfo = useMemo(() => {
    if (!focusLine || !data) return null;
    const chain = lineChain(data.sections, focusLine, iso, hiddenLines);
    const stations = view.stations.filter((s) => s.line === focusLine);
    return { stations, prof: chain && chain.length ? lineProfile(chain, stations) : null };
  }, [focusLine, data, iso, hiddenLines, view]);

  const toggleLine = (id) => setHiddenLines((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const pickStation = (id, fly = true) => {
    setSel({ kind: 'station', id });
    const s = view?.byId[id];
    if (s && fly) scene.current?.focus(s.x, Y(s.z, s.ground), s.zz);
  };
  const pickLine = (line) => { setSel({ kind: 'line', line }); };

  useEffect(() => {
    const k = (e) => { if (e.key === 'Escape') setSel(null); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, []);

  useEffect(() => { window.__app = { year, opts, stations: view?.stations.length, sections: view?.sectionVisible.filter(Boolean).length, labels: labelItems.length, stats, sel }; });

  // подсказка при наведении
  let tip = null;
  if (hover && main.current) {
    const r = main.current.getBoundingClientRect();
    const pos = { left: hover.x - r.left, top: hover.y - r.top };
    if (hoverStation) {
      tip = (
        <div className="tip" style={pos}>
          <b>{nameAt(hoverStation, iso)}</b><span className="m">{depthText(hoverStation)}</span><br />
          <span className="muted">{hoverStation.line} · {Math.round(hoverStation.abs)} m ü. NHN{hoverStation.state === 'interrupted' ? ' · ohne Halt' : ''}</span>
        </div>
      );
    } else if (hover.kind === 'line') {
      tip = (
        <div className="tip" style={pos}>
          <b>{hover.line}</b> {hover.section.from} – {hover.section.to}<br />
          <span className="muted">Klick: Längsprofil der Linie</span>
        </div>
      );
    }
  }

  return (
    <div className="app">
      <header>
        <h1>Berliner U-Bahn in der Tiefe <span className="yr">{year}</span></h1>
        <p>Tunnel, Hochbahn und Bahnhöfe in echter Lage – Höhen ×{opts.exag} überhöht</p>
      </header>
      <main ref={main}>
        {error && <div className="error">Daten konnten nicht geladen werden: {error}</div>}
        {data && view && extent && (
          <Scene ref={scene} data={data} view={view} Y={Y} SY={SY} opts={{ ...opts, exag }} extent={extent} bg={bg}
            focusLine={focusLine} selectedId={selStation?.id} labelItems={labelItems}
            onHover={setHover}
            onPick={(p) => { if (!p) setSel(null); else if (p.kind === 'station') pickStation(p.id, false); else pickLine(p.line); }} />
        )}
        {tip}
        {data && (
          <Panel stats={stats} hiddenLines={hiddenLines} toggleLine={toggleLine} focusLine={focusLine} onLine={pickLine}
            opts={opts} setOpt={setOpt} deepest={deepest} iso={iso} onStation={(id) => pickStation(id)} />
        )}
        {selStation && (
          <StationCard s={selStation} iso={iso}
            transfers={view.transfers.filter((p) => p.includes(selStation.id)).map((p) => view.byId[p[0] === selStation.id ? p[1] : p[0]])}
            onClose={() => setSel(null)} onLine={pickLine} onStation={(id) => pickStation(id)} />
        )}
        {focusLine && lineInfo && (
          <LineCard line={focusLine} color={LINE_COLOR[focusLine]} stations={lineInfo.stations} prof={lineInfo.prof} iso={iso}
            onClose={() => setSel(null)} onStation={(id) => pickStation(id)} />
        )}
        <div className="views">
          <div className="seg">
            {[['iso', '3D'], ['top', 'Oben'], ['side', 'Seite'], ['below', 'Unten']].map(([v, l]) => (
              <button key={v} type="button" onClick={() => scene.current?.view(v)}>{l}</button>
            ))}
          </div>
        </div>
        <TimeControl year={year} setYear={setYear} playing={playing} setPlaying={setPlaying} />
      </main>
    </div>
  );
}
