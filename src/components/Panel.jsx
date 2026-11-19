import { LINES, DEEP_LABEL } from '../lib/config';
import { RAMP_CSS } from '../lib/colors';
import { nameAt } from '../lib/time';
import { depthText, statusShort, isApprox } from '../lib/depth';

const Seg = ({ value, set, options }) => (
  <div className="seg" role="group">
    {options.map(([v, label]) => (
      <button key={v} type="button" aria-pressed={value === v} onClick={() => set(v)}>{label}</button>
    ))}
  </div>
);

export default function Panel(p) {
  const { stats, hiddenLines, toggleLine, focusLine, onLine, opts, setOpt, deepest, iso, year, onStation } = p;
  const md = stats.maxDepthSt;
  return (
    <aside className="panel">
      <div className="stats">
        <div className="stat" title="Stationsknoten in Betrieb; mehrere Bahnsteig-/Ebenen-Einträge eines Bahnhofs zählen einmal">
          <span className="v">{stats.stations}</span><span className="k">Bahnhöfe</span></div>
        <div className="stat" title="Summe der Linienabschnitte. Gemeinsam befahrene Abschnitte (z. B. U1/U3) sind je Linie gezählt – keine Länge der Infrastruktur.">
          <span className="v">{stats.km.toFixed(0)}</span><span className="k">km Linienlänge</span></div>
        <div className="stat" title={md ? `Tiefster Tunnelbahnhof im Datensatz: ${nameAt(md, iso)} ${md.line}, ${statusShort(md)}` : undefined}>
          <span className="v">{md ? `${isApprox(md) ? '≈' : ''}${stats.maxDepth.toFixed(0)}` : '–'}</span><span className="k">m max. Stationstiefe</span></div>
      </div>
      <p className="hint small scope">Gesamtnetz zum Jahresende {year} · unabhängig von ausgeblendeten Linien · km = Summe je Linie (gemeinsame Abschnitte doppelt)</p>

      <h2>Linien</h2>
      <ul className="lines">
        {LINES.map((l) => {
          const off = hiddenLines.has(l.id);
          const n = stats.byLine[l.id] || 0;
          const rec = stats.recByLine[l.id] || 0;
          return (
            <li key={l.id} className={focusLine === l.id ? 'focus' : ''}>
              <button type="button" className={off ? 'off' : ''} onClick={() => toggleLine(l.id)} aria-pressed={!off} title="ein/aus">
                <span className="swatch" style={{ background: l.color }} /><b>{l.id}</b>
              </button>
              <span className="muted" title={rec !== n ? `${n} Bahnhöfe, ${rec} Bahnsteig-/Ebenen-Einträge` : `${n} Bahnhöfe`}>{n ? `${n} Bhf.` : '–'}</span>
              <button type="button" className="linkbtn" disabled={!n || off} onClick={() => onLine(l.id)}>Profil</button>
            </li>
          );
        })}
      </ul>
      {stats.ghost > 0 && (
        <div className="ghost-note"><span className="ring" aria-hidden="true" />
          <p><b>{stats.ghost} Geisterbahnhöfe</b> – Züge aus West-Berlin fuhren unter Ost-Berlin ohne Halt durch (1961–1990).</p></div>
      )}
      {stats.closedNoStop > 0 && (
        <div className="ghost-note"><span className="ring" aria-hidden="true" />
          <p><b>{stats.closedNoStop}</b> {stats.closedNoStop === 1 ? 'Bahnhof' : 'Bahnhöfe'} vorübergehend ohne Halt (stillgelegt).</p></div>
      )}

      <h2>Überhöhung <output>×{opts.exag}</output></h2>
      <input className="range" type="range" min={1} max={200} step={1} value={opts.exag} onChange={(e) => setOpt('exag', Number(e.target.value))} aria-label="Vertikale Überhöhung" />
      <p className="hint small">Höhenunterschiede {opts.exag}-fach vergrößert; Meterangaben bleiben unverändert. Kugeln und Röhren sind schematisch, nicht maßstäblich.</p>

      <h2>Oberfläche {opts.surface !== 'off' && <output>{Math.round(opts.surfOp * 100)} %</output>}</h2>
      <Seg value={opts.surface} set={(v) => setOpt('surface', v)} options={[['map', 'Stadtplan'], ['plain', 'Fläche'], ['off', 'aus']]} />
      {opts.surface !== 'off' && (
        <input className="range" type="range" min={0.1} max={1} step={0.05} value={opts.surfOp} onChange={(e) => setOpt('surfOp', Number(e.target.value))} aria-label="Deckkraft der Oberfläche" />
      )}
      <p className="hint small">Von oben: Stadtplan · von unten: Erdreich (braun)</p>

      <h2>Höhe</h2>
      <Seg value={opts.mode} set={(v) => setOpt('mode', v)} options={[['rel', 'Tiefe unter Gelände'], ['abs', 'ü. NHN']]} />
      <p className="hint small">{opts.mode === 'rel'
        ? 'Tiefe relativ zum lokalen Geländeniveau am Bahnhof (Modell, DGM1 geglättet) – nicht der Abstand zur Straße direkt über jedem Tunnelpunkt.'
        : 'Absolute Höhen über Normalhöhennull. Die Kartenfläche bleibt eben (schematisch); ein positiver NHN-Wert heißt nicht «über der Straße».'}</p>

      <h2>Farbe</h2>
      <Seg value={opts.color} set={(v) => setOpt('color', v)} options={[['line', 'nach Linie'], ['depth', 'nach Tiefe']]} />
      {opts.color === 'depth' && (
        <div className="ramp-box">
          <p className="small"><b>Tiefe unter Geländeniveau</b> (feste Skala, auch bei NHN)</p>
          <div className="ramp"><span style={{ background: RAMP_CSS }} /></div>
          <div className="ramp-ticks"><small>0</small><small>−5,5</small><small>−11</small><small>−16,5</small><small>≤ −22 m</small></div>
          <p className="small"><i className="sw-above" /> oberirdisch / Geländeniveau</p>
        </div>
      )}

      <h2>Namen</h2>
      <Seg value={opts.labels} set={(v) => setOpt('labels', v)} options={[['none', 'keine'], ['deep', `ab ${DEEP_LABEL} m`], ['all', 'alle']]} />

      <h2>Ebenen</h2>
      <div className="checks">
        <label><input type="checkbox" checked={opts.shafts} onChange={(e) => setOpt('shafts', e.target.checked)} /> Verbindung zum Gelände</label>
        <label><input type="checkbox" checked={opts.grid} onChange={(e) => setOpt('grid', e.target.checked)} /> Raster</label>
        <label><input type="checkbox" checked={opts.levels} onChange={(e) => setOpt('levels', e.target.checked)} /> Tiefenebenen</label>
        <label><input type="checkbox" checked={opts.transfers} onChange={(e) => setOpt('transfers', e.target.checked)} /> Umstiege (Nähe)</label>
      </div>
      <p className="hint small">Schematisch: senkrechte Linien zeigen keine echten Zugänge; Umstiege verbinden Bahnhöfe verschiedener Linien unter 300 m Abstand, nicht vermessene Gänge.</p>

      {deepest.length > 0 && (
        <>
          <h2>Tiefste Bahnhöfe (Tunnel)</h2>
          <ol className="deep">
            {deepest.map((s) => (
              <li key={s.id}><button type="button" onClick={() => onStation(s.id)} style={{ '--c': s.color }}
                aria-label={`${nameAt(s, iso)}, ${s.line}, ${depthText(s)}`}>
                <span className="badge sm" style={{ background: s.color }}>{s.line}</span><span>{nameAt(s, iso)}</span><span className="d">{depthText(s)}</span>
              </button></li>
            ))}
          </ol>
          <p className="hint small">Nur Tunnelbahnhöfe · Tiefe unter lokalem Geländeniveau wie auf der Karte · ohne ≈: Zahl aus Quelle · ≈: «ca.»/«rund» in der Quelle, abgeleitet oder Modellschätzung</p>
        </>
      )}
      <p className="hint">Gelände: DGM1 © Geoportal Berlin (dl-de/zero-2-0). Tiefen: Quellenangaben aus Wikipedia (CC BY-SA 4.0) für einzelne Bahnhöfe, sonst Modellschätzung nach OSM-Bahnsteigebene oder Bauart. Linke Maus: drehen · rechte: verschieben · Rad: zoomen.</p>
    </aside>
  );
}
