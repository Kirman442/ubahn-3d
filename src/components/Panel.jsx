import { LINES } from '../lib/config';
import { BASEMAPS } from '../lib/basemap';

export default function Panel({ stats, hiddenLines, toggleLine, basemap, setBasemap, exag, setExag, opacity, setOpacity, labels, setLabels, resetView }) {
  return (
    <div className="legend">
      <h2>U-Bahn-Linien</h2>
      <ul className="lines">
        {LINES.map((l) => {
          const off = hiddenLines.has(l.id);
          const n = stats.byLine[l.id] || 0;
          return (
            <li key={l.id}>
              <button type="button" className={off ? 'off' : ''} onClick={() => toggleLine(l.id)} aria-pressed={!off}>
                <span className="swatch" style={{ background: l.color }} />
                <b>{l.id}</b>
                <span className="muted">{n ? `${n} Bhf.` : '–'}</span>
              </button>
            </li>
          );
        })}
      </ul>
      <p className="stats"><b>{stats.stations}</b> Bahnhöfe · <b>{stats.km.toFixed(1).replace('.', ',')}</b> km</p>
      {stats.ghost > 0 && (
        <div className="ghost-note">
          <span className="ring" aria-hidden="true" />
          <p><b>{stats.ghost} Geisterbahnhöfe</b> – Züge aus West-Berlin fuhren unter Ost-Berlin ohne Halt durch (1961–1990).</p>
        </div>
      )}
      {stats.closedNoStop > 0 && (
        <div className="ghost-note">
          <span className="ring" aria-hidden="true" />
          <p><b>{stats.closedNoStop}</b> {stats.closedNoStop === 1 ? 'Bahnhof' : 'Bahnhöfe'} vorübergehend ohne Halt (stillgelegt).</p>
        </div>
      )}
      {!stats.ghost && !stats.closedNoStop && <p className="hint"><span className="ring small" aria-hidden="true" /> durchsichtige Kugel mit Ring = Bahnhof ohne Halt</p>}

      <h2 className="sep">3D</h2>
      <label className="range">
        <span>Überhöhung <b>×{exag}</b></span>
        <input type="range" min={1} max={20} step={1} value={exag} onChange={(e) => setExag(Number(e.target.value))} />
      </label>
      <label className="range">
        <span>Oberfläche <b>{Math.round(opacity * 100)} %</b></span>
        <input type="range" min={0} max={1} step={0.05} value={opacity} onChange={(e) => setOpacity(Number(e.target.value))} />
      </label>
      <label className="check">
        <input type="checkbox" checked={labels} onChange={(e) => setLabels(e.target.checked)} /> Namen
      </label>
      <div className="basemaps">
        {BASEMAPS.map((b) => (
          <button key={b.id} type="button" className={b.id === basemap.id ? 'active' : ''} onClick={() => setBasemap(b)}>{b.label}</button>
        ))}
      </div>
      <button type="button" className="reset" onClick={resetView}>Ansicht zurücksetzen</button>
      <p className="hint">Linke Maustaste: drehen · rechte: verschieben · Rad: zoomen. Tiefe relativ zum Gelände (DGM1), Höhen ×{exag}.</p>
    </div>
  );
}
