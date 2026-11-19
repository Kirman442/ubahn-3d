import { formatDate, nameAt, stateAt, yearOf, INTERRUPTION_LABEL } from '../lib/time';
import { fmtM } from '../lib/colors';

const Badge = ({ line, color }) => <span className="badge" style={{ background: color }}>{line}</span>;
const n1 = (v) => v.toFixed(1).replace('.', ',');
const n0 = (v) => Math.round(v).toString();
const LAGE = { Tunnel: 'Tunnel', Viadukt: 'Hochbahn (Viadukt)', Damm: 'Damm', Einschnitt: 'Einschnitt', Plan: 'ebenerdig' };

export function depthText(s) {
  if (Math.abs(s.z) < 0.5) return '0 m';
  return `${s.measured ? '' : '≈ '}${fmtM(s.z)} m`;
}

export function StationCard({ s, iso, transfers, onClose, onLine, onStation }) {
  const nameNow = nameAt(s, iso);
  const state = stateAt(s, iso);
  const pct = Math.min(100, (Math.max(0, -s.z) / 22) * 100);
  return (
    <div className="card">
      <button type="button" className="close" onClick={onClose} aria-label="Schließen">×</button>
      <div className="ttl"><Badge line={s.line} color={s.color} /><strong>{nameNow}</strong></div>
      {nameNow !== s.name && <p className="muted">heute: {s.name}</p>}
      {state === 'interrupted' && <p className="warn">Zu diesem Zeitpunkt ohne Halt</p>}
      <div className="depth">{s.measured ? '' : '≈ '}{Math.abs(s.z) < 0.5 ? '0' : fmtM(s.z)}<small>{s.z < -0.5 ? ' m (unter Straßenniveau)' : s.z > 0.5 ? ' m (über Straßenniveau)' : ' m (Straßenniveau)'}</small></div>
      {s.z < 0 && <div className="bar" aria-hidden="true"><span style={{ width: `${pct}%` }} /></div>}
      {!s.measured && <p className="note">Tiefe geschätzt ({s.src}). Gemessene Werte gibt es bisher für 30 Bahnhöfe.</p>}
      <dl className="facts">
        <dt>Gelände</dt><dd>{n1(s.ground)} m ü. NHN (DGM1)</dd>
        <dt>Bahnsteig</dt><dd>≈ {n1(s.abs)} m ü. NHN</dd>
        {s.situation && (<><dt>Lage</dt><dd>{LAGE[s.situation] || s.situation}</dd></>)}
        <dt>Eröffnet</dt><dd>{formatDate(s.opened)}</dd>
        {s.closed && (<><dt>Geschlossen</dt><dd>{formatDate(s.closed)}</dd></>)}
        {s.district && (<><dt>Ortsteil</dt><dd>{s.district}</dd></>)}
        {s.measured && (<><dt>Quelle</dt><dd>{s.src}</dd></>)}
      </dl>
      {transfers.length > 0 && (
        <p className="meta">Umstieg: {transfers.map((o, i) => (
          <span key={o.id}>{i ? '; ' : ''}<button type="button" className="link" onClick={() => onStation(o.id)}>{o.line}</button> {depthText(o)}</span>
        ))}</p>
      )}
      {(s.names || []).length > 1 && (
        <>
          <h4>Namen</h4>
          <ul>{s.names.map((x) => <li key={x.name + x.valid_from}>{x.name} <span className="muted">({yearOf(x.valid_from)}–{x.valid_to ? yearOf(x.valid_to) : 'heute'})</span></li>)}</ul>
        </>
      )}
      {(s.interruptions || []).length > 0 && (
        <>
          <h4>Unterbrechungen</h4>
          <ul>{s.interruptions.map((it) => <li key={it.type + it.start}>{INTERRUPTION_LABEL[it.type] || it.type} <span className="muted">({yearOf(it.start)}–{yearOf(it.end)})</span></li>)}</ul>
        </>
      )}
      <div className="actions">
        <button type="button" className="chip" onClick={() => onLine(s.line)}>Profil {s.line}</button>
        {s.wiki_de && <a href={`https://de.wikipedia.org/wiki/${encodeURIComponent(s.wiki_de.replace(/ /g, '_'))}`} target="_blank" rel="noreferrer">Wikipedia</a>}
      </div>
    </div>
  );
}

function niceStep(range) { for (const s of [5, 10, 20, 25, 50]) if (range / s <= 6) return s; return 100; }

function Profile({ prof, color, iso, onStation }) {
  const W = 320; const H = 180; const ml = 34; const mr = 8; const mt = 10; const mb = 24;
  const iw = W - ml - mr; const ih = H - mt - mb;
  const vals = prof.pts.flatMap((p) => [p[1], p[2]]);
  const lo = Math.min(...vals); const hi = Math.max(...vals);
  const step = niceStep(hi - lo + 10);
  const vmin = Math.floor((lo - 3) / step) * step; const vmax = Math.ceil((hi + 3) / step) * step;
  const X = (d) => ml + (d / prof.total) * iw;
  const Yv = (v) => mt + ((vmax - v) / (vmax - vmin)) * ih;
  const ground = prof.pts.map((p) => `${X(p[0]).toFixed(1)},${Yv(p[1]).toFixed(1)}`).join(' ');
  const track = prof.pts.map((p) => `${X(p[0]).toFixed(1)},${Yv(p[2]).toFixed(1)}`).join(' ');
  const grid = [];
  for (let v = vmin; v <= vmax; v += step) grid.push(v);
  const kmTot = prof.total / 1000; const kmStep = kmTot > 12 ? 5 : kmTot > 5 ? 2 : 1;
  const ticks = [];
  for (let k = 0; k <= kmTot + 1e-6; k += kmStep) ticks.push(k);
  return (
    <svg className="prof" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Längsprofil: Gelände und Gleis, m ü. NHN">
      {grid.map((v) => (
        <g key={v}><line className="gridl" x1={ml} x2={W - mr} y1={Yv(v)} y2={Yv(v)} /><text x={ml - 4} y={Yv(v) + 3} textAnchor="end">{v}</text></g>
      ))}
      {ticks.map((k) => <text key={k} x={X(k * 1000)} y={H - 8} textAnchor="middle">{k}</text>)}
      <text x={W - mr} y={H - 8} textAnchor="end">km</text>
      <polygon className="earth" points={`${X(0)},${Yv(vmin)} ${ground} ${X(prof.total)},${Yv(vmin)}`} />
      <polyline className="gline" points={ground} />
      <polyline fill="none" stroke={color} strokeWidth="2.2" strokeLinejoin="round" points={track} />
      {prof.marks.map((m) => {
        const hollow = !m.st.measured;
        return (
          <circle key={m.name + m.d} className="dot" cx={X(m.d)} cy={Yv(m.st.abs)} r="3.6"
            fill={hollow ? 'var(--panel-solid)' : color} stroke={hollow ? color : 'var(--panel-solid)'} strokeWidth="1.5"
            onClick={() => onStation(m.st.id)}>
            <title>{`${nameAt(m.st, iso)}: ${depthText(m.st)}, ${n1(m.st.abs)} m ü. NHN`}</title>
          </circle>
        );
      })}
    </svg>
  );
}

export function LineCard({ line, color, stations, prof, iso, hidden, year, onShow, onClose, onStation }) {
  const under = stations.filter((s) => s.z < 0);
  const deepest = under.reduce((m, s) => (!m || s.z < m.z ? s : m), null);
  const avg = under.length ? under.reduce((a, s) => a - s.z, 0) / under.length : 0;
  const lowest = stations.reduce((m, s) => (!m || s.abs < m.abs ? s : m), null);
  const gr = stations.map((s) => s.ground);
  const nMeas = stations.filter((s) => s.measured).length;
  return (
    <div className="card">
      <button type="button" className="close" onClick={onClose} aria-label="Schließen">×</button>
      <div className="ttl"><Badge line={line} color={color} /><strong>Linie {line}</strong></div>
      {hidden ? (
        <div className="note-row"><p className="note">Linie {line} ist ausgeblendet.</p><button type="button" className="chip" onClick={onShow}>Linie {line} einblenden</button></div>
      ) : !stations.length ? <p className="muted">Im Jahr {year} noch nicht in Betrieb.</p> : (
        <>
          <dl className="facts">
            <dt>Bahnhöfe</dt><dd>{stations.length}</dd>
            {prof && (<><dt>Länge</dt><dd>{(prof.total / 1000).toFixed(1).replace('.', ',')} km (Hauptstrecke)</dd></>)}
            {deepest && (<><dt>Tiefe</dt><dd>bis {n1(-deepest.z)} m, Ø {n1(avg)} m</dd></>)}
            {deepest && (<><dt>Tiefster Bf.</dt><dd><button type="button" className="link" onClick={() => onStation(deepest.id)}>{nameAt(deepest, iso)}</button></dd></>)}
            <dt>Tiefster Punkt</dt><dd>{nameAt(lowest, iso)}, ≈ {n0(lowest.abs)} m ü. NHN</dd>
            <dt>Gelände</dt><dd>{n0(Math.min(...gr))}–{n0(Math.max(...gr))} m ü. NHN</dd>
          </dl>
          {prof && <Profile prof={prof} color={color} iso={iso} onStation={onStation} />}
          <div className="legend-mini">
            <span><i className="earth-sw" />Gelände (DGM1)</span>
            <span><i style={{ background: color }} />Gleis</span>
            <span><i className="hollow" style={{ borderColor: color }} />geschätzt ({stations.length - nMeas})</span>
          </div>
        </>
      )}
    </div>
  );
}
