import { LINES, DEEP_LABEL } from '../lib/config';
import { RAMP_CSS } from '../lib/colors';
import { nameAt } from '../lib/time';

const Seg = ({ value, set, options }) => (
  <div className="seg" role="group">
    {options.map(([v, label]) => (
      <button key={v} type="button" aria-pressed={value === v} onClick={() => set(v)}>{label}</button>
    ))}
  </div>
);

export default function Panel(p) {
  const { stats, hiddenLines, toggleLine, focusLine, onLine, opts, setOpt, deepest, iso, onStation } = p;
  return (
    <aside className="panel">
      <div className="stats">
        <div className="stat"><span className="v">{stats.stations}</span><span className="k">Bahnhöfe</span></div>
        <div className="stat"><span className="v">{stats.km.toFixed(0)}</span><span className="k">km Strecke</span></div>
        <div className="stat"><span className="v">{stats.maxDepth ? stats.maxDepth.toFixed(0) : '–'}</span><span className="k">m max. Tiefe</span></div>
      </div>

      <h2>Linien</h2>
      <ul className="lines">
        {LINES.map((l) => {
          const off = hiddenLines.has(l.id);
          const n = stats.byLine[l.id] || 0;
          return (
            <li key={l.id} className={focusLine === l.id ? 'focus' : ''}>
              <button type="button" className={off ? 'off' : ''} onClick={() => toggleLine(l.id)} aria-pressed={!off} title="ein/aus">
                <span className="swatch" style={{ background: l.color }} /><b>{l.id}</b>
              </button>
              <span className="muted">{n ? `${n} Bhf.` : '–'}</span>
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

      <h2>Oberfläche {opts.surface !== 'off' && <output>{Math.round(opts.surfOp * 100)} %</output>}</h2>
      <Seg value={opts.surface} set={(v) => setOpt('surface', v)} options={[['map', 'Stadtplan'], ['plain', 'Fläche'], ['off', 'aus']]} />
      {opts.surface !== 'off' && (
        <input className="range" type="range" min={0.1} max={1} step={0.05} value={opts.surfOp} onChange={(e) => setOpt('surfOp', Number(e.target.value))} aria-label="Deckkraft der Oberfläche" />
      )}
      <p className="hint small">Von oben: Stadtplan · von unten: Erdreich (braun)</p>

      <h2>Höhe</h2>
      <Seg value={opts.mode} set={(v) => setOpt('mode', v)} options={[['rel', 'unter Straße'], ['abs', 'ü. NHN (Relief)']]} />

      <h2>Farbe</h2>
      <Seg value={opts.color} set={(v) => setOpt('color', v)} options={[['line', 'nach Linie'], ['depth', 'nach Tiefe']]} />
      {opts.color === 'depth' && <div className="ramp"><span style={{ background: RAMP_CSS }} /><small>0 m</small><small>−22 m</small></div>}

      <h2>Namen</h2>
      <Seg value={opts.labels} set={(v) => setOpt('labels', v)} options={[['none', 'keine'], ['deep', `ab ${DEEP_LABEL} m`], ['all', 'alle']]} />

      <h2>Ebenen</h2>
      <div className="checks">
        <label><input type="checkbox" checked={opts.shafts} onChange={(e) => setOpt('shafts', e.target.checked)} /> Schächte</label>
        <label><input type="checkbox" checked={opts.grid} onChange={(e) => setOpt('grid', e.target.checked)} /> Raster</label>
        <label><input type="checkbox" checked={opts.levels} onChange={(e) => setOpt('levels', e.target.checked)} /> Tiefenebenen</label>
        <label><input type="checkbox" checked={opts.transfers} onChange={(e) => setOpt('transfers', e.target.checked)} /> Umstiege</label>
      </div>

      {deepest.length > 0 && (
        <>
          <h2>Tiefste Bahnhöfe</h2>
          <ol className="deep">
            {deepest.map((s) => (
              <li key={s.id}><button type="button" onClick={() => onStation(s.id)} style={{ '--c': s.color }}>
                <i /><span>{nameAt(s, iso)}</span><span className="d">{(-s.z).toFixed(1).replace('.', ',')} m</span>
              </button></li>
            ))}
          </ol>
        </>
      )}
      <p className="hint">Gelände: DGM1 © Geoportal Berlin (dl-de/zero-2-0). Tiefen: Wikipedia (CC BY-SA 4.0), sonst Schätzung nach OSM. Linke Maus: drehen · rechte: verschieben · Rad: zoomen.</p>
    </aside>
  );
}
