import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import Scene from './components/Scene';
import Panel from './components/Panel';
import TimeControl from './components/TimeControl';
import { StationCard, LineCard } from './components/Card';
import { END_YEAR, DEFAULT_EXAG, DEEP_LABEL } from './lib/config';
import { CITIES, CITY, LINE_COLOR, lineBg, setCity as applyCity, cityFromHash } from './lib/city';
import ModelInfo from './components/ModelInfo';
import Legal, { LegalLinks } from './components/Legal';
import { prepare, makeY, surfaceY, lineChain, lineProfile, isUnderground } from './lib/model';
import { depthText, statusShort, isApprox } from './lib/depth';
import { fmtM } from './lib/colors';
import { isoForYear, stateAt, sectionOpenAt, interruptionAt, nameAt, formatDate, normDate, yearOf } from './lib/time';

const load = (name) => fetch(`${import.meta.env.BASE_URL}data/${CITY.data}${name}`, { cache: 'no-cache' }).then((r) => {
  if (!r.ok) throw new Error(`${name}: HTTP ${r.status}`);
  return r.json();
});

const saved = (k, fb) => { try { return localStorage.getItem(k) || fb; } catch { return fb; } };
const START_THEME = saved('ubahn3d.theme', typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dunkel' : 'hell');
const DEFAULT_OPTS = { theme: START_THEME, style: saved('ubahn3d.style', 'neu'), exag: DEFAULT_EXAG, surface: 'schema', surfOp: 0.55, mode: 'rel', color: 'line', labels: 'key', build: true, shafts: true, grid: true, levels: true, transfers: true };
const cssVar = (n, fb) => getComputedStyle(document.documentElement).getPropertyValue(n).trim() || fb;

// Stadtwahl: Stadt steht in der Adresse (#nuernberg). Beim Wechsel wird die Stadtansicht neu aufgebaut
// (Auswahl, Kamera, Jahr zurückgesetzt); Darstellungs-Einstellungen bleiben.
export default function App() {
  const [city, setCityId] = useState(cityFromHash);
  const [opts, setOpts] = useState(DEFAULT_OPTS);
  applyCity(city);
  useEffect(() => {
    const on = () => setCityId(cityFromHash());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  const choose = (id) => { if (id === city) return; window.location.hash = id === 'berlin' ? '' : id; setCityId(id); };
  return <CityApp key={city} city={city} choose={choose} opts={opts} setOpts={setOpts} />;
}

function CityApp({ city, choose, opts, setOpts }) {
  const LINES = CITY.lines;
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [year, setYear] = useState(END_YEAR);
  const [playing, setPlaying] = useState(false);
  const [hiddenLines, setHiddenLines] = useState(() => new Set());
  const [sel, setSel] = useState(null);        // {kind:'station', id} | {kind:'line', line}
  const [focusLine, setFocusLine] = useState(null);
  const [lineNames, setLineNames] = useState(true); // Namen ein/aus in der Linienansicht
  const [preset, setPreset] = useState('iso');      // aktiver Kamera-Preset; null nach freier Bewegung
  const [hover, setHover] = useState(null);
  const [panelOpen, setPanelOpen] = useState(() => typeof window === 'undefined' || window.innerWidth > 980);
  const [focusReq, setFocusReq] = useState(0);  // >0: Karte nach ausdrücklichem Öffnen fokussieren
  const opener = useRef(null);                 // Element, von dem aus die Karte geöffnet wurde
  const toggleRef = useRef(null);
  // Panel ein/aus: Fokus folgt (nicht auf ein verschwundenes Element fallen lassen)
  const showPanel = (v) => {
    setPanelOpen(v);
    setTimeout(() => (v ? document.querySelector('.panel-close') : toggleRef.current)?.focus(), 0);
  };
  const scene = useRef();
  const main = useRef();
  // «Namen» in der Steuerung gilt auch in der Linienansicht: Wahl dort hebt ein «Namen aus» der Linienkarte auf
  const setOpt = (k, v) => { if (k === 'labels') setLineNames(true); setOpts((o) => ({ ...o, [k]: v })); };
  const [info, setInfo] = useState(false);
  // Impressum/Datenschutz: Seite oder null; Fokus kehrt beim Schließen zum auslösenden Link zurück
  const [legal, setLegal] = useState(null);
  const legalFrom = useRef(null);
  const openLegal = (p, el) => { legalFrom.current = el || null; setInfo(false); setLegal(p); };
  const closeLegal = () => { setLegal(null); legalFrom.current?.focus?.(); };
  useEffect(() => {
    document.documentElement.dataset.theme = opts.theme;
    try { localStorage.setItem('ubahn3d.theme', opts.theme); localStorage.setItem('ubahn3d.style', opts.style); } catch { /* ohne Speicher */ }
  }, [opts.theme, opts.style]);

  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    setError(null);
    Promise.all([load('network3d.json'), load('stations.geojson')])
      .then(([net, geo]) => setData(prepare(net, geo)))
      .catch((e) => setError(e.message || String(e)));
  }, [attempt]);
  // erstes Betriebsjahr laut Daten (für leere frühe Jahre)
  const firstYear = useMemo(() => (data ? Math.min(...data.stations.filter((s) => s.opened).map((s) => yearOf(s.opened))) : null), [data]);

  const iso = isoForYear(year);
  const exag = useDeferredValue(opts.exag);
  const Y = useMemo(() => makeY(opts.mode, exag), [opts.mode, exag]);
  // Schema (three.js) nur mit basemap.json, sonst Fläche; alter Wert «map» (Stadtplan) → Schema
  const surf = opts.surface === 'map' ? 'schema' : opts.surface;
  const surfaceKind = surf === 'schema' && !CITY.basemap ? 'plain' : surf;
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

  const selStation = sel?.kind === 'station' ? view?.byId[sel.id] : null;
  const hoverStation = hover?.kind === 'station' ? view?.byId[hover.id] : null;

  // gewählter Bahnhof ist im aktuellen Jahr/Filter nicht sichtbar → Grund + Aktion statt stillem Verschwinden
  const selMissing = useMemo(() => {
    if (sel?.kind !== 'station' || selStation || !data) return null;
    const r = data.stations.find((x) => x.id === sel.id);
    if (!r) return null;
    const name = nameAt(r, iso);
    if (hiddenLines.has(r.line)) return { r, name, text: `Linie ${r.line} ist ausgeblendet.`, action: 'Einblenden', run: () => toggleLine(r.line) };
    if (!r.opened || normDate(r.opened) > iso) return { r, name, text: `Im Jahr ${year} noch nicht eröffnet (Eröffnung ${formatDate(r.opened)}).`, action: `Zu ${yearOf(r.opened)} springen`, run: () => setYear(yearOf(r.opened)) };
    if (r.closed && normDate(r.closed) <= iso) return { r, name, text: `Seit ${formatDate(r.closed)} geschlossen.`, action: `Zu ${yearOf(r.closed) - 1} springen`, run: () => setYear(yearOf(r.closed) - 1) };
    if (r.map_from && normDate(r.map_from) > iso) return { r, name, text: `Im Jahr ${year} auf dieser Linie noch nicht in Betrieb (ab ${formatDate(r.map_from)}).`, action: `Zu ${yearOf(r.map_from)} springen`, run: () => setYear(yearOf(r.map_from)) };
    return { r, name, text: `Im Jahr ${year} nicht sichtbar.` };
  }, [sel, selStation, data, iso, year, hiddenLines]);
  const allHidden = hiddenLines.size >= LINES.length;

  // подписи: набор зависит только от настроек и выбора, не от камеры
  // Nachbarn je Linie und Bahnhof im aktuellen Jahr (sichtbare Abschnitte): Endbahnhof = 1 Nachbar;
  // Umsteigeknoten = Linien mit unterschiedlichen Nachbarn (gemeinsam befahrene Strecke zählt nicht)
  const nbrs = useMemo(() => {
    const nb = {};
    if (!view) return nb;
    const add = (k, n) => { (nb[k] ||= new Set()).add(n); };
    data.sections.forEach((p, i) => { if (!view.sectionVisible[i] || p.dir === 'B') return; add(`${p.line}|${p.from}`, p.to); add(`${p.line}|${p.to}`, p.from); });
    return nb;
  }, [data, view]);

  // подписи: набор зависит только от настроек и выбора, не от камеры.
  // Ein Schild je Bahnhof (Knoten): Liniensignets aller Linien + Tiefe bzw. Tiefenspanne.
  // Gewählter/überfahrener Bahnhof bekommt ein eigenes Schild mit seiner genauen Tiefe.
  const focusSelRef = useRef(null);
  focusSelRef.current = () => { scene.current?.focus(selStation); setPreset(null); };
  const labelItems = useMemo(() => {
    if (!view) return [];
    const nodes = new Map();
    view.stations.forEach((s) => { if (!nodes.has(s.node)) nodes.set(s.node, []); nodes.get(s.node).push(s); });
    const strongIds = new Set([selStation?.id].filter(Boolean)); // Überfahren: nur die Hinweisblase, kein zweites Schild
    const out = [];
    const one = (s, strong) => ({
      key: s.id, x: s.x, y: Y(s.z, s.ground), z: s.zz, text: nameAt(s, iso), depth: depthText(s), lines: [s.line],
      color: s.color, ghost: s.state === 'interrupted', strong,
      // gewählter Bahnhof: dieselbe Blase wie beim Überfahren, am Punkt festgehalten
      target: strong ? () => focusSelRef.current?.() : null,
      pin: strong ? `${s.line} · ${statusShort(s)} · ≈ ${Math.round(s.abs)} m ü. NHN${s.state === 'interrupted' ? ' · ohne Halt' : ''}` : null,
      focus: !!focusLine && s.line === focusLine, bg: !!focusLine && s.line !== focusLine && !strong,
    });
    const showNames = !(focusLine && (!lineNames || opts.labels === 'none')); // «Namen aus» in der Linienkarte oder «keine»
    // Gewählte Linie: nur ihre Bahnhöfe, kompakt wie in der Übersicht (Tiefe im Profil und beim Überfahren), keine Hintergrundschilder.
    // Übersicht: nur Name + Liniensignets, ohne Tiefe (Tiefe beim Überfahren/Wählen); Modus «ab 10 m» behält die Tiefe.
    if (showNames) nodes.forEach((all, node) => {
      if (all.some((s) => strongIds.has(s.id))) return;
      const lines = [...new Set(all.map((s) => s.line))];
      let list = all; let want; let withDepth; let rank = 0; let pri = 0;
      if (focusLine) {
        if (!lines.includes(focusLine)) return;
        list = all.filter((s) => s.line === focusLine); want = true; withDepth = false; // Tiefe im Profil der Karte und beim Überfahren
      } else {
        const nset = all.map((s) => [...(nbrs[`${s.line}|${s.name}`] || [])].sort().join('|'));
        const key = all.some((s) => (nbrs[`${s.line}|${s.name}`]?.size || 0) <= 1) || new Set(nset).size > 1;
        want = opts.labels === 'all' || (opts.labels === 'key' && key) || (opts.labels === 'deep' && all.some((s) => s.z <= -DEEP_LABEL));
        // «wichtige» nach Zoomstufe: Rang 0 immer (wichtigster Knoten im Umkreis, s. u.), Rang 1 (übrige wichtige) beim
        // Heranzoomen; dicht beieinanderliegende wichtige (Rang 2) nur bei «alle» oder beim Überfahren. Feste Stufen nach Kameraabstand – kein Ein-/Ausblenden nach Überlappung.
        if (opts.labels === 'key') {
          const end = all.some((s) => (nbrs[`${s.line}|${s.name}`]?.size || 0) <= 1);
          rank = 1; pri = lines.length * 10 + (end ? 5 : 0);
        }
        withDepth = opts.labels === 'deep';
      }
      if (!want) return;
      const top = list.reduce((a, b) => (b.z > a.z ? b : a));
      let depth = null;
      if (withDepth) {
        const zs = list.map((s) => s.z); const lo = Math.min(...zs); const hi = Math.max(...zs);
        depth = hi - lo < 0.5 ? depthText(top) : `${list.some(isApprox) ? '≈ ' : ''}${fmtM(lo, 1)}…${fmtM(hi, 1)} m`;
      }
      out.push({ key: `n:${node}`, x: top.x, y: Y(top.z, top.ground), z: top.zz, text: nameAt(top, iso), depth,
        lines: CITY.lines.map((l) => l.id).filter((l) => lines.includes(l)), color: top.color,
        ghost: list.every((s) => s.state === 'interrupted'), strong: false, focus: !!focusLine, bg: false, compact: true, rank, pri });
    });
    // «wichtige» geografisch ausdünnen (fest, unabhängig von Kamera und Überlappung): nach Priorität (Linienzahl,
    // Endpunkt) bleibt ein Knoten in Stufe 0, wenn im Umkreis R0 kein wichtigerer liegt; sonst Stufe 1 (Umkreis R1),
    // sonst Stufe 2. Labels.jsx zeigt Stufe 1/2 erst beim Heranzoomen.
    if (opts.labels === 'key' && !focusLine) {
      const R0 = 1800; const R1 = 700; const kept0 = []; const kept1 = [];
      const near = (list, it, R) => list.some((k) => Math.hypot(k.x - it.x, k.z - it.z) < R);
      [...out].filter((it) => it.rank === 1).sort((a, b) => b.pri - a.pri).forEach((it) => {
        if (!near(kept0, it, R0)) { it.rank = 0; kept0.push(it); } else if (!near([...kept0, ...kept1], it, R1)) { kept1.push(it); } else it.rank = 2;
      });
    }
    // «Etagen»: nur bei «alle» und in der Linienkarte steht jedes Schild je nach Linie höher, mit Führungsstrich
    const floors = opts.labels === 'all' || !!focusLine;
    const order = CITY.lines.map((l) => l.id);
    if (floors) out.forEach((it) => { it.tier = order.indexOf(it.lines[0]) + 1; });
    if (selStation) out.push(one(selStation, true));
    return out;
  }, [view, nbrs, opts.labels, focusLine, lineNames, selStation, Y, iso]);

  const stats = useMemo(() => {
    // Bahnhöfe = Stationsknoten (s.node), nicht Bahnsteig-/Ebenen-Einträge; siehe assignNodes()
    const s = { stations: 0, km: 0, byLine: {}, recByLine: {}, ghost: 0, closedNoStop: 0, maxDepth: 0 };
    if (!data) return s;
    const seen = new Set(); const ghost = new Set(); const noStop = new Set(); const lineNodes = {};
    for (const p of data.stations) {
      const st = stateAt(p, iso);
      if (st === 'interrupted') {
        const it = interruptionAt(p, iso);
        (it && it.type === 'geisterbahnhof' ? ghost : noStop).add(p.node);
      }
      if (st !== 'open') continue;
      (lineNodes[p.line] ||= new Set()).add(p.node);
      s.recByLine[p.line] = (s.recByLine[p.line] || 0) + 1;
      seen.add(p.node);
      if (isUnderground(p) && -p.z > s.maxDepth) { s.maxDepth = -p.z; s.maxDepthSt = p; }
    }
    for (const [l, set] of Object.entries(lineNodes)) s.byLine[l] = set.size;
    s.stations = seen.size; s.ghost = ghost.size; s.closedNoStop = noStop.size;
    for (const p of data.sections) if (p.dir !== 'B' && sectionOpenAt(p, iso)) s.km += p.length_m / 1000;
    return s;
  }, [data, iso]);

  const deepest = useMemo(() => {
    if (!view) return [];
    // nur unterirdische Einträge (Tunnel); weniger als 10 → weniger anzeigen. Ebenen eines Knotens bleiben
    // getrennt, wenn sie verschiedene Linien/Tiefen haben (Linie wird in der Liste angezeigt).
    const seen = new Set();
    return view.stations.filter(isUnderground).sort((a, b) => a.z - b.z).filter((s) => {
      const k = `${s.node}|${s.line}|${s.z}`; if (seen.has(k)) return false; seen.add(k); return true;
    }).slice(0, 10);
  }, [view]);

  const lineInfo = useMemo(() => {
    if (!focusLine || !data) return null;
    const chain = lineChain(data.sections, focusLine, iso, hiddenLines);
    const stations = view.stations.filter((s) => s.line === focusLine);
    return { stations, hidden: hiddenLines.has(focusLine), prof: chain && chain.length ? lineProfile(chain, stations) : null };
  }, [focusLine, data, iso, hiddenLines, view]);

  const toggleLine = (id) => setHiddenLines((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  // Bahnhof wählen: Linienfokus bleibt; Bahnhof einer anderen Linie (z. B. Umstieg) wechselt den Fokus auf deren Linie
  // Öffnen aus der Oberfläche (nicht aus der Szene): Fokus in die Karte, beim Schließen zurück zum Auslöser
  const noteOpener = () => {
    const a = document.activeElement;
    if (a && a !== document.body && a.tagName !== 'CANVAS' && !a.closest('.card')) opener.current = a;
    if (a && a !== document.body && a.tagName !== 'CANVAS') setFocusReq((n) => n + 1);
  };
  const returnFocus = () => { const o = opener.current; opener.current = null; if (o?.isConnected) setTimeout(() => o.focus(), 0); };
  const pickStation = (id, fly = true) => {
    noteOpener(); setPlaying(false); // beim Lesen der Karte nicht weiterlaufen
    setSel({ kind: 'station', id });
    // schmaler Bildschirm: Karte und Steuerung würden sich überdecken → Steuerung schließen
    if (typeof window !== 'undefined' && window.innerWidth <= 980) setPanelOpen(false);
    const s = view?.byId[id];
    if (s && focusLine && s.line !== focusLine) setFocusLine(s.line);
    if (s && fly) { scene.current?.focus(s); setPreset(null); }
  };
  const pickLine = (line) => { noteOpener(); setPlaying(false); setLineNames(true); setSel({ kind: 'line', line }); setFocusLine(line); };
  const clearAll = () => { setSel(null); setFocusLine(null); returnFocus(); };
  // ein Schritt zurück: Bahnhof → Profil der untersuchten Linie → Gesamtübersicht
  const stepBack = () => {
    if (sel?.kind === 'station' && focusLine) { setSel({ kind: 'line', line: focusLine }); if (document.activeElement?.closest?.('.card')) setFocusReq((n) => n + 1); } else clearAll();
  };
  const showAllLines = () => setHiddenLines(new Set());
  const onlyLine = (l) => setHiddenLines(new Set(LINES.map((x) => x.id).filter((x) => x !== l)));
  const lineStations = (l) => view?.stations.filter((s) => s.line === l) || [];
  const camView = (v) => { scene.current?.view(v, focusLine ? lineStations(focusLine) : null); setPreset(v); };
  const showLineOnMap = () => { if (scene.current?.frame(lineStations(focusLine), 'iso')) setPreset(null); };

  // Esc schließt zuerst ein offenes Fenster (Rechtliches, Hinweise) und gibt den Fokus an dessen Knopf zurück, sonst ein Schritt zurück
  const infoBtn = useRef(null);
  const closeInfo = () => { setInfo(false); infoBtn.current?.focus(); };
  const back = useRef(stepBack);
  back.current = () => { if (legal) closeLegal(); else if (info) closeInfo(); else stepBack(); };
  useEffect(() => {
    const k = (e) => { if (e.key === 'Escape') back.current(); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, []);

  // Prüfhaken für Szenario-Skripte (ersetzt keinen Klick-Test der Oberfläche)
  useEffect(() => { window.__pick = { station: (id, fly = false) => pickStation(id, fly), line: (l) => pickLine(l) }; window.__app = { year, opts, focusLine, preset, stations: view?.stations.length, sections: view?.sectionVisible.filter(Boolean).length, labels: labelItems.length, stats, sel }; });

  // подсказка при наведении
  let tip = null;
  if (hover && main.current) {
    const r = main.current.getBoundingClientRect();
    const pos = { left: hover.x - r.left, top: hover.y - r.top };
    if (hoverStation && hoverStation.id === selStation?.id) {
      // gewählter Bahnhof hat schon sein Schild und die Karte – keine zweite Blase
    } else if (hoverStation) {
      tip = (
        <div className="tip" style={pos}>
          <b>{nameAt(hoverStation, iso)}</b><span className="m">{depthText(hoverStation)}</span><br />
          <span className="muted">{hoverStation.line} · {statusShort(hoverStation)} · ≈ {Math.round(hoverStation.abs)} m ü. NHN{hoverStation.state === 'interrupted' ? ' · ohne Halt' : ''}</span>
        </div>
      );
    } else if (hover.kind === 'build') {
      const c = hover.item;
      tip = (
        <div className="tip" style={pos}>
          <b>{c.line}</b> {c.from} – {c.to}<br />
          <span className="muted">im Bau · Eröffnung geplant {c.opening || '?'}</span>
        </div>
      );
    } else if (hover.kind === 'buildStation') {
      const s = hover.st;
      tip = (
        <div className="tip" style={pos}>
          <b>{s.name}</b><span className="m">{s.z == null ? '' : `${s.measured ? '' : '≈ '}${fmtM(s.z)} m`}</span><br />
          <span className="muted">{s.line} · im Bau · Eröffnung geplant {s.opening || '?'} · {s.guessed ? 'Tiefe unbekannt' : s.measured ? 'Tiefe laut Planung' : 'Tiefe geschätzt'}</span>
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
        <h1>U-Bahn in der Tiefe <span className="yr">{year}</span></h1>
        <div className="city-seg" role="group" aria-label="Stadt">
          {CITIES.map((c) => (
            <button key={c.id} type="button" aria-pressed={c.id === city} className={c.id === city ? 'on' : ''} disabled={!c.ready}
              title={c.ready ? undefined : 'in Vorbereitung'} onClick={() => choose(c.id)}>{c.name}</button>
          ))}
        </div>
        <label className="city-sel"><span className="sr">Stadt</span>
          <select value={city} onChange={(e) => choose(e.target.value)}>{CITIES.map((c) => <option key={c.id} value={c.id} disabled={!c.ready}>{c.name}{c.ready ? '' : ' (bald)'}</option>)}</select>
        </label>
        <button type="button" ref={infoBtn} className="info-btn" aria-label="Über das Modell" aria-expanded={info} onClick={() => setInfo((v) => !v)}>i</button>
        <button type="button" className="theme-btn" onClick={() => setOpt('theme', opts.theme === 'dunkel' ? 'hell' : 'dunkel')}
          aria-label={opts.theme === 'dunkel' ? 'Helles Design' : 'Dunkles Design'} title={opts.theme === 'dunkel' ? 'Hell' : 'Dunkel'}>{opts.theme === 'dunkel' ? '☀' : '☾'}</button>
        <p className="sr">Vereinfachtes Höhenmodell von Tunneln, Hochbahnen und Bahnhöfen – Höhenunterschiede ×{opts.exag} vergrößert, Meterangaben unverändert</p>
      </header>
      <main ref={main}>
        {!data && !error && <div className="loading" role="status"><span className="spin" aria-hidden="true" />Netzdaten werden geladen …</div>}
        {error && (
          <div className="error" role="alert">
            <p><b>Die Netzdaten konnten nicht geladen werden.</b></p>
            <p>Bitte Verbindung prüfen und erneut versuchen. Ihre Einstellungen bleiben erhalten.</p>
            <button type="button" className="chip" onClick={() => setAttempt((n) => n + 1)}>Erneut versuchen</button>
            <details><summary>Technische Angabe</summary><code>{error}</code></details>
          </div>
        )}
        {data && view && year < firstYear && (
          <div className="empty" role="status">
            <p><b>{year}: noch keine U-Bahn in Betrieb.</b></p>
            <p className="small">Die erste Strecke wurde {firstYear} eröffnet.</p>
            <button type="button" className="chip" onClick={() => { setPlaying(false); setYear(firstYear); }}>Zu {firstYear} springen</button>
          </div>
        )}
        {data && view && extent && (
          <Scene ref={scene} data={data} view={view} Y={Y} SY={SY} opts={{ ...opts, exag, surface: surfaceKind }} extent={extent} bg={bg}
            focusLine={focusLine} selected={selStation} hoverId={hoverStation?.id} labelItems={labelItems}
            onHover={setHover} onUserCamera={() => setPreset(null)} showBuild={opts.build && year >= END_YEAR}
            onPick={(p) => { if (!p) stepBack(); else if (p.kind === 'station') pickStation(p.id, false); else pickLine(p.line); }} />
        )}
        {tip}
        {info && <ModelInfo exag={opts.exag} onClose={closeInfo} />}
        {legal && <Legal page={legal} setPage={setLegal} onClose={closeLegal} />}
        <LegalLinks open={openLegal} className="out" />
        {data && (
          <Panel build={data?.construction?.length ? { n: data.constructionStations?.length || 0, lines: [...new Set(data.construction.map((c) => c.line))], now: year >= END_YEAR } : null} surfaceKind={surfaceKind} stats={stats} hiddenLines={hiddenLines} toggleLine={toggleLine} showAll={showAllLines} focusLine={focusLine} onLine={pickLine}
            stations={view?.stations || []} open={panelOpen} setOpen={showPanel} openLegal={openLegal}
            opts={opts} setOpt={setOpt} deepest={deepest} iso={iso} year={year} onStation={(id) => pickStation(id)} />
        )}
        {selStation && (
          <StationCard s={selStation} iso={iso} ctx={focusLine} focusReq={focusReq}
            transfers={view.transfers.filter((p) => p.includes(selStation.id)).map((p) => view.byId[p[0] === selStation.id ? p[1] : p[0]])}
            onClose={clearAll} onBack={stepBack} onFocus={() => { scene.current?.focus(selStation); setPreset(null); }}
            onLine={pickLine} onStation={(id) => pickStation(id)} />
        )}
        {selMissing && (
          <section className="card" aria-label="Ausgewählter Bahnhof">
            <button type="button" className="close" onClick={stepBack} aria-label="Schließen">×</button>
            <div className="ttl"><span className="badge" style={{ background: lineBg(selMissing.r.line) }}>{selMissing.r.line}</span><strong>{selMissing.name}</strong></div>
            <p className="note">{selMissing.text}</p>
            <div className="actions">
              {selMissing.action && <button type="button" className="chip" onClick={selMissing.run}>{selMissing.action}</button>}
              <button type="button" className="chip" onClick={stepBack}>Auswahl aufheben</button>
            </div>
          </section>
        )}
        {focusLine && lineInfo && sel?.kind === 'line' && (
          <LineCard line={focusLine} color={LINE_COLOR[focusLine]} stations={lineInfo.stations} prof={lineInfo.prof} iso={iso}
            hidden={lineInfo.hidden} year={year} focusReq={focusReq} onShow={() => toggleLine(focusLine)} onOnly={() => onlyLine(focusLine)} names={lineNames && opts.labels !== 'none'} onNames={() => { if (lineNames && opts.labels !== 'none') setLineNames(false); else { setLineNames(true); if (opts.labels === 'none') setOpt('labels', 'key'); } }}
            onClose={clearAll} onShowMap={showLineOnMap} onStation={(id) => pickStation(id)} />
        )}
        {allHidden && (
          <div className="empty" role="status">
            <p><b>Keine Linien eingeblendet.</b></p>
            <button type="button" className="chip" onClick={() => setHiddenLines(new Set())}>Alle anzeigen</button>
          </div>
        )}
        <div className="views">
          <div className="seg" role="group" aria-label="Kameraansicht">
            {[['iso', '3D'], ['top', 'Oben'], ['side', 'Seite'], ['below', 'Unten']].map(([v, l]) => (
              <button key={v} type="button" aria-pressed={preset === v} onClick={() => camView(v)}
                title={v === 'side' && focusLine ? `Seitenansicht Linie ${focusLine}` : undefined}>{l}{v === 'side' && focusLine ? ` ${focusLine}` : ''}</button>
            ))}
          </div>
          <p className="views-hint">Ziehen: drehen · Rechtsklick: schieben · Rad: zoomen</p>
        </div>
        {!panelOpen && (
          <button type="button" className="panel-toggle" ref={toggleRef} aria-expanded={false} aria-controls="panel" onClick={() => showPanel(true)}>Steuerung</button>
        )}
        <TimeControl year={year} setYear={setYear} playing={playing} setPlaying={setPlaying} firstYear={firstYear} />
      </main>
    </div>
  );
}
