import { useEffect, useMemo, useState } from 'react';
import { DEEP_LABEL, END_YEAR } from '../lib/config';
import { CITY, LINE_COLOR, lineBg } from '../lib/city';
import { RAMP_CSS } from '../lib/colors';
import { nameAt } from '../lib/time';
import { LegalLinks } from './Legal';
import { depthText, statusShort, isApprox } from '../lib/depth';

const Seg = ({ value, set, options, labelledby }) => (
  <div className="seg" role="group" aria-labelledby={labelledby}>
    {options.map(([v, label]) => (
      <button key={v} type="button" aria-pressed={value === v} onClick={() => set(v)}>{label}</button>
    ))}
  </div>
);

const norm = (t) => t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ß/g, 'ss');

// Bahnhofssuche: alle im gewählten Jahr sichtbaren Bahnhöfe, Auswahl öffnet dieselbe Karte
function StationSearch({ stations, iso, year, onStation }) {
  const [q, setQ] = useState('');
  const t = q.trim();
  const res = useMemo(() => {
    if (t.length < 2) return [];
    const n = norm(t); const seen = new Set();
    return stations.filter((s) => !s.alt && (norm(nameAt(s, iso)).includes(n) || norm(s.name).includes(n)))
      .sort((a, b) => nameAt(a, iso).localeCompare(nameAt(b, iso), 'de') || a.line.localeCompare(b.line))
      .filter((s) => { const k = `${s.node}|${s.line}`; if (seen.has(k)) return false; seen.add(k); return true; })
      .slice(0, 12);
  }, [t, stations, iso]);
  return (
    <div className="search" role="search">
      <h2 id="h-search"><label htmlFor="st-q">Bahnhof suchen</label></h2>
      <input id="st-q" type="search" autoComplete="off" placeholder={`Name, ${CITY.search}`} value={q} onChange={(e) => setQ(e.target.value)}
        aria-describedby="st-q-n" />
      <p id="st-q-n" className="sr" aria-live="polite">{t.length >= 2 ? `${res.length}${res.length === 12 ? ' oder mehr' : ''} Treffer` : ''}</p>
      {res.length > 0 && (
        <ul className="results" aria-label="Suchergebnisse">
          {res.map((s) => (
            <li key={s.id}><button type="button" onClick={() => onStation(s.id)} aria-label={`${nameAt(s, iso)}, ${s.line}, ${depthText(s)}`}>
              <span className="badge sm" style={{ background: lineBg(s.line, s.color) }}>{s.line}</span><span>{nameAt(s, iso)}</span><span className="d">{depthText(s)}</span>
            </button></li>
          ))}
        </ul>
      )}
      {t.length >= 2 && !res.length && <p className="hint small">Kein Bahnhof «{t}» im Jahr {year} (oder Linie ausgeblendet).</p>}
    </div>
  );
}

export default function Panel(p) {
  // «Darstellung» standardmäßig offen; Zustand je Betrachter merken
  const [darstOpen, setDarstOpen] = useState(() => { try { return localStorage.getItem('ubahn3d.darst') !== '0'; } catch { return true; } });
  useEffect(() => { try { localStorage.setItem('ubahn3d.darst', darstOpen ? '1' : '0'); } catch { /* ohne Speicher */ } }, [darstOpen]);
  const { build, surfaceKind, stats, hiddenLines, toggleLine, showAll, focusLine, onLine, opts, setOpt, deepest, iso, year, onStation, stations, open, setOpen, openLegal } = p;
  const md = stats.maxDepthSt;
  return (
    <aside className={`panel${open ? ' open' : ''}`} id="panel" aria-label="Menu">
      <button type="button" className="close panel-close" onClick={() => setOpen(false)} aria-label="Menu schließen">×</button>
      <div className="stats">
        <div className="stat" title="Stationsknoten in Betrieb; mehrere Bahnsteig-/Ebenen-Einträge eines Bahnhofs zählen einmal">
          <span className="v">{stats.stations}</span><span className="k">Bahnhöfe</span></div>
        <div className="stat" title="Summe der Linienabschnitte. Gemeinsam befahrene Abschnitte (z. B. U1/U3) sind je Linie gezählt – keine Länge der Infrastruktur.">
          <span className="v">{stats.km.toFixed(0)}</span><span className="k">km Linienlänge</span></div>
        <div className="stat" title={md ? `Tiefster Tunnelbahnhof im Datensatz: ${nameAt(md, iso)} ${md.line}, ${statusShort(md)}` : undefined}>
          <span className="v">{md ? `${isApprox(md) ? '≈' : ''}${stats.maxDepth.toFixed(0)}` : '–'}</span><span className="k">m max. Stationstiefe</span></div>
      </div>
      <p className="hint small scope">Gesamtnetz zum Jahresende {year} · unabhängig von ausgeblendeten Linien · km = Summe je Linie (gemeinsame Abschnitte doppelt)</p>

      <StationSearch stations={stations} iso={iso} year={year} onStation={onStation} />

      <h2 id="h-lines">Linien {hiddenLines.size > 0 && <button type="button" className="linkbtn" onClick={showAll}>Alle anzeigen</button>}</h2>
      <ul className="lines" aria-labelledby="h-lines">
        {CITY.lines.map((l) => {
          const off = hiddenLines.has(l.id);
          const n = stats.byLine[l.id] || 0;
          const rec = stats.recByLine[l.id] || 0;
          return (
            <li key={l.id} className={focusLine === l.id ? 'focus' : ''}>
              <button type="button" className={`tog${off ? ' off' : ''}`} onClick={() => toggleLine(l.id)} aria-pressed={!off}
                aria-label={`Linie ${l.id} anzeigen`} title={off ? 'ausgeblendet – einblenden' : 'eingeblendet – ausblenden'}>
                <span className="box" aria-hidden="true">{off ? '' : '✓'}</span><span className="badge ln" style={{ background: lineBg(l.id, l.color) }}>{l.id}</span>
              </button>
              <span className="muted" title={rec !== n ? `${n} Bahnhöfe, ${rec} Bahnsteig-/Ebenen-Einträge` : `${n} Bahnhöfe`}>{n ? `${n} Bhf.` : '–'}</span>
              <button type="button" className="linkbtn" disabled={!n || off} onClick={() => onLine(l.id)} aria-label={`Profil ${l.id}`}>Profil</button>
            </li>
          );
        })}
        {build && (
          <li className="build">
            <button type="button" className={`tog${opts.build ? '' : ' off'}`} onClick={() => setOpt('build', !opts.build)} aria-pressed={opts.build}
              aria-label="Strecken im Bau anzeigen" title={build.now ? '' : `nur im Netzstand ${END_YEAR} sichtbar`}>
              <span className="box" aria-hidden="true">{opts.build ? '✓' : ''}</span>
              <span className="swatch dash" style={{ '--c1': LINE_COLOR[build.lines[0]] || '#A0A0A0', '--c2': LINE_COLOR[build.lines[1] || build.lines[0]] || '#A0A0A0' }} /><b>im Bau</b>
            </button>
            <span className="muted">{build.lines.join(', ')}{build.n ? ` · ${build.n} Bhf.` : ''}</span>
          </li>
        )}
      </ul>
      {build && !build.now && opts.build && <p className="hint small show">Strecken im Bau erscheinen beim Netzstand {END_YEAR}.</p>}
      {stats.ghost > 0 && CITY.id === 'berlin' && (
        <div className="ghost-note"><span className="ring" aria-hidden="true" />
          <p><b>{stats.ghost} Geisterbahnhöfe</b> – Züge aus West-Berlin fuhren unter Ost-Berlin ohne Halt durch (1961–1990).</p></div>
      )}
      {stats.closedNoStop > 0 && (
        <div className="ghost-note"><span className="ring" aria-hidden="true" />
          <p><b>{stats.closedNoStop}</b> {stats.closedNoStop === 1 ? 'Bahnhof' : 'Bahnhöfe'} vorübergehend ohne Halt (stillgelegt).</p></div>
      )}

      <h2 id="h-names">Namen</h2>
      <Seg value={opts.labels} labelledby="h-names" set={(v) => setOpt('labels', v)} options={[['none', 'keine'], ['key', 'wichtige'], ['deep', `ab ${DEEP_LABEL} m`], ['all', 'alle']]} />
      {opts.labels === 'deep' && <p className="hint small">Bahnhöfe mit mindestens einer Ebene ab {DEEP_LABEL} m Tiefe.</p>}
      <p className="hint small">Gewählter Bahnhof und Bahnhöfe der untersuchten Linie werden immer benannt, auch bei «keine». Namen dürfen sich überlagern; der gewählte liegt oben.</p>

      <h2 id="h-surf">Oberfläche {opts.surface !== 'off' && <output>{Math.round(opts.surfOp * 100)} %</output>}</h2>
      <Seg value={surfaceKind} set={(v) => setOpt('surface', v)} labelledby="h-surf"
        options={[CITY.basemap && ['schema', 'Schema'], ['plain', 'Fläche'], ['off', 'aus']].filter(Boolean)} />
      {opts.surface !== 'off' && (
        <input className="range" type="range" min={0.1} max={1} step={0.05} value={opts.surfOp} onChange={(e) => setOpt('surfOp', Number(e.target.value))} aria-label="Deckkraft der Oberfläche" />
      )}
      <p className="hint small">Von oben: Stadtschema · von unten: Erdreich (braun)</p>

      <h2 id="h-color">Farbe</h2>
      <Seg value={opts.color} set={(v) => setOpt('color', v)} labelledby="h-color" options={[['line', 'nach Linie'], ['depth', 'nach Tiefe']]} />
      {opts.color === 'depth' && (
        <div className="ramp-box">
          <p className="small"><b>Tiefe unter Geländeniveau</b> (feste Skala, auch bei NHN)</p>
          <div className="ramp"><span style={{ background: RAMP_CSS }} /></div>
          <div className="ramp-ticks"><small>0</small><small>−5,5</small><small>−11</small><small>−16,5</small><small>≤ −22 m</small></div>
          <p className="small"><i className="sw-above" /> oberirdisch / Geländeniveau</p>
        </div>
      )}

      {deepest.length > 0 && (
        <>
          <h2 id="h-deep">Tiefste Bahnhöfe (Tunnel)</h2>
          <ol className="deep" aria-labelledby="h-deep">
            {deepest.map((s) => (
              <li key={s.id}><button type="button" onClick={() => onStation(s.id)} style={{ '--c': s.color }}
                aria-label={`${nameAt(s, iso)}, ${s.line}, ${depthText(s)}`}>
                <span className="badge sm" style={{ background: lineBg(s.line, s.color) }}>{s.line}</span><span>{nameAt(s, iso)}</span><span className="d">{depthText(s)}</span>
              </button></li>
            ))}
          </ol>
          <p className="hint small">Nur Tunnelbahnhöfe · Tiefe unter lokalem Geländeniveau wie auf der Karte · ohne ≈: Zahl aus Quelle · ≈: «ca.»/«rund» in der Quelle, abgeleitet oder Modellschätzung</p>
        </>
      )}
      <h2 id="h-mode">Höhe</h2>
      <Seg value={opts.mode} set={(v) => setOpt('mode', v)} labelledby="h-mode" options={[['rel', 'Tiefe unter Gelände'], ['abs', 'ü. NHN']]} />
      <p className="hint small">{opts.mode === 'rel'
        ? 'Tiefe relativ zum lokalen Geländeniveau am Bahnhof (Modell, DGM1 geglättet) – nicht der Abstand zur Straße direkt über jedem Tunnelpunkt.'
        : 'Absolute Höhen über Normalhöhennull. Die Kartenfläche bleibt eben (schematisch); ein positiver NHN-Wert heißt nicht «über der Straße».'}</p>

      <h2 id="h-exag">Überhöhung <output>×{opts.exag}</output></h2>
      <input className="range" type="range" min={1} max={200} step={1} value={opts.exag} onChange={(e) => setOpt('exag', Number(e.target.value))} aria-label="Vertikale Überhöhung" aria-describedby="exag-hint" />
      <p className="hint small" id="exag-hint">Höhen {opts.exag}-fach vergrößert, Meterangaben echt.</p>

      <details className="darst" open={darstOpen} onToggle={(e) => setDarstOpen(e.currentTarget.open)}>
        <summary>Darstellung</summary>
      <h2 id="h-style">Stil der Szene</h2>
      <Seg value={opts.style} labelledby="h-style" set={(v) => setOpt('style', v)} options={[['neu', 'Erdreich'], ['klassisch', 'Klassisch']]} />
      <h2 id="h-layers">Ebenen</h2>
      <div className="checks" role="group" aria-labelledby="h-layers">
        <label><input type="checkbox" checked={opts.shafts} onChange={(e) => setOpt('shafts', e.target.checked)} /> Verbindung zum Gelände</label>
        <label><input type="checkbox" checked={opts.grid} onChange={(e) => setOpt('grid', e.target.checked)} /> Raster</label>
        <label><input type="checkbox" checked={opts.levels} onChange={(e) => setOpt('levels', e.target.checked)} /> Tiefenebenen</label>
        <label><input type="checkbox" checked={opts.transfers} onChange={(e) => setOpt('transfers', e.target.checked)} /> Umstiege (Nähe)</label>
      </div>
      <p className="hint small">Schematisch: senkrechte Linien zeigen keine echten Zugänge; Umstiege verbinden Bahnhöfe verschiedener Linien unter 300 m Abstand, nicht vermessene Gänge.</p>
      </details>

      <p className="hint">{CITY.attribution}</p>
      <LegalLinks open={openLegal} className="in" />
    </aside>
  );
}
