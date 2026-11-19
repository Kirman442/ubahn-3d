import { Fragment, useEffect, useRef } from 'react';

// Fokus nach ausdrücklichem Öffnen (Tastatur/Liste/Profil) auf die Überschrift der Karte setzen
function useHeadingFocus(focusReq) {
  const ref = useRef(null);
  useEffect(() => { if (focusReq) ref.current?.focus({ preventScroll: true }); }, [focusReq]);
  return ref;
}
import { formatDate, nameAt, stateAt, yearOf, INTERRUPTION_LABEL } from '../lib/time';
import { depthText, depthNumber, statusShort, provenanceRows, provenanceNote, isApprox } from '../lib/depth';
import { isUnderground } from '../lib/model';

import { lineBg } from '../lib/city';
const Badge = ({ line, color }) => <span className="badge" style={{ background: lineBg(line, color) }}>{line}</span>;
const n1 = (v) => (v == null || Number.isNaN(v) ? '–' : v.toFixed(1).replace('.', ','));
const n0 = (v) => Math.round(v).toString();
const LAGE = { Tunnel: 'Tunnel', Viadukt: 'Hochbahn (Viadukt)', Damm: 'Damm', Einschnitt: 'Einschnitt', Plan: 'ebenerdig' };
const where = (z) => (z < -0.5 ? 'unter lokalem Geländeniveau' : z > 0.5 ? 'über lokalem Geländeniveau' : 'auf Geländeniveau');

export function StationCard({ s, iso, ctx, transfers, focusReq, onClose, onBack, onFocus, onLine, onStation }) {
  const head = useHeadingFocus(focusReq);
  const nameNow = nameAt(s, iso);
  const state = stateAt(s, iso);
  const pct = Math.min(100, (Math.max(0, -s.z) / 22) * 100);
  return (
    <section className="card" aria-labelledby="card-ttl">
      <button type="button" className="close" onClick={onClose} aria-label="Karte schließen">×</button>
      <h2 className="ttl" id="card-ttl" tabIndex={-1} ref={head}><Badge line={s.line} color={s.color} /><span>{nameNow}</span><span className="sr"> – Bahnhof, Linie {s.line}</span></h2>
      {nameNow !== s.name && <p className="muted">heute: {s.name}</p>}
      {state === 'interrupted' && <p className="warn">Zu diesem Zeitpunkt ohne Halt</p>}
      {state === 'tram' && <p className="warn">Zu diesem Zeitpunkt Straßenbahnhalt ({formatDate(s.predecessor.opened)}–{formatDate(s.predecessor.closed)}), U-Bahn ab {formatDate(s.opened_ubahn)}</p>}
      {s.ebene && <p className="muted">Richtungsbahnhof: dieser Eintrag = {s.ebene} ({s.z <= -15 ? 'untere' : 'obere'} Ebene)</p>}
      <div className="depth">{depthNumber(s)}<small> m {where(s.z)}</small></div>
      <p className="status"><span className={`tag ${s.kind}`}>{statusShort(s)}</span></p>
      {s.z < 0 && <div className="bar" aria-hidden="true"><span style={{ width: `${pct}%` }} /></div>}
      <dl className="facts">
        <dt>Geländeniveau</dt><dd>{n1(s.ground)} m ü. NHN <span className="muted">(DGM1, Median um den Bf.)</span></dd>
        <dt>Höhenlage</dt><dd>≈ {n1(s.abs)} m ü. NHN <span className="muted">(Modell)</span></dd>
        {s.situation && (<><dt>Lage</dt><dd>{LAGE[s.situation] || s.situation}</dd></>)}
        <dt>Eröffnet</dt><dd>{formatDate(s.opened)}</dd>
        {s.closed && (<><dt>Geschlossen</dt><dd>{formatDate(s.closed)}</dd></>)}
        {s.district && (<><dt>Ortsteil</dt><dd>{s.district}</dd></>)}
      </dl>
      <details className="src">
        <summary>Quelle</summary>
        <dl className="facts">
          {provenanceRows(s).map(([k, v]) => (<Fragment key={k}><dt>{k}</dt><dd>{v}</dd></Fragment>))}
        </dl>
        <p className="hint small">{provenanceNote(s)}</p>
      </details>
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
        {ctx ? <button type="button" className="chip" onClick={onBack} title={`Zurück zum Profil ${ctx}`} aria-label={`Zurück zum Profil ${ctx}`}>← {ctx}</button>
          : <button type="button" className="chip" onClick={() => onLine(s.line)}>Profil {s.line}</button>}
        <button type="button" className="chip" onClick={onFocus} title="Kamera auf diesen Bahnhof richten">Zum Bahnhof</button>
        {ctx && <button type="button" className="chip" onClick={onClose}>Gesamtnetz</button>}
        {s.wiki_de && <a href={`https://de.wikipedia.org/wiki/${encodeURIComponent(s.wiki_de.replace(/ /g, '_'))}`} target="_blank" rel="noreferrer">Wikipedia</a>}
      </div>
    </section>
  );
}

function niceStep(range) { for (const s of [5, 10, 20, 25, 50]) if (range / s <= 6) return s; return 100; }

function Profile({ prof, color, iso, onStation }) {
  const W = 320; const H = 190; const ml = 34; const mr = 8; const mt = 18; const mb = 24;
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
    <svg className="prof" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Längsprofil der Hauptstrecke: Gelände und Modelltrasse, Höhe über NHN in Metern">
      <text className="axis-t" x={4} y={10}>Höhe ü. NHN (m)</text>
      {grid.map((v) => (
        <g key={v}><line className="gridl" x1={ml} x2={W - mr} y1={Yv(v)} y2={Yv(v)} /><text x={ml - 4} y={Yv(v) + 3} textAnchor="end">{v}</text></g>
      ))}
      {ticks.map((k) => <text key={k} x={X(k * 1000)} y={H - 8} textAnchor="middle">{k}</text>)}
      <text x={W - mr} y={H - 8} textAnchor="end">km</text>
      <polygon className="earth" points={`${X(0)},${Yv(vmin)} ${ground} ${X(prof.total)},${Yv(vmin)}`} />
      <polyline className="gline" points={ground} />
      <polyline fill="none" stroke={color} strokeWidth="2.2" strokeLinejoin="round" points={track} />
      {prof.marks.map((m) => {
        const k = m.st.kind;
        const title = <title>{`${nameAt(m.st, iso)}: ${depthText(m.st)} (${statusShort(m.st)}), ≈ ${n1(m.st.abs)} m ü. NHN`}</title>;
        const cx = X(m.d); const cy = Yv(m.st.abs);
        // Herkunft (nicht Genauigkeit): gefüllter Kreis = Quellenangabe · gefülltes Quadrat = abgeleitet · hohler Kreis = Modellschätzung.
        // ca./rund/Spanne stehen im Wert und im Titel. Alle Formen öffnen die Station.
        const common = { className: 'dot', 'data-st': m.st.id, 'data-kind': k, onClick: () => onStation(m.st.id) };
        if (k === 'abgeleitet') {
          return (
            <rect key={m.name + m.d} {...common} x={cx - 3.4} y={cy - 3.4} width="6.8" height="6.8"
              fill={color} stroke="var(--panel-solid)" strokeWidth="1.5">{title}</rect>
          );
        }
        const hollow = k !== 'quelle';
        return (
          <circle key={m.name + m.d} {...common} cx={cx} cy={cy} r="3.6"
            fill={hollow ? 'var(--panel-solid)' : color} stroke={hollow ? color : 'var(--panel-solid)'} strokeWidth="1.5">{title}</circle>
        );
      })}
    </svg>
  );
}

export function LineCard({ line, color, stations, prof, iso, hidden, year, focusReq, onShow, onOnly, names, onNames, onClose, onShowMap, onStation }) {
  const head = useHeadingFocus(focusReq);
  // Kennzahlen beziehen sich auf Bahnhofseinträge der Linie (nicht auf alle Trassenpunkte)
  // Bahnhöfe = Stationsknoten (s.node); Bahnsteig-/Ebenen-Einträge bleiben erhalten und werden getrennt genannt
  const nodes = new Set(stations.map((s) => s.node)).size;
  const under = stations.filter(isUnderground);
  const deepest = under.reduce((m, s) => (!m || s.z < m.z ? s : m), null);
  const avg = under.length ? under.reduce((a, s) => a - s.z, 0) / under.length : 0;
  const avgApprox = under.some(isApprox);
  const lowest = stations.reduce((m, s) => (!m || s.abs < m.abs ? s : m), null);
  const gr = stations.map((s) => s.ground);
  const cnt = { quelle: 0, abgeleitet: 0, modell: 0 };
  // Legende zählt die im Profil gezeichneten Marker (Hauptstrecke), sonst alle Einträge der Linie
  (prof ? prof.marks.map((m) => m.st) : stations).forEach((s) => { cnt[s.kind] = (cnt[s.kind] || 0) + 1; });
  return (
    <section className="card" aria-labelledby="card-ttl">
      <button type="button" className="close" onClick={onClose} aria-label="Karte schließen">×</button>
      <h2 className="ttl" id="card-ttl" tabIndex={-1} ref={head}><Badge line={line} color={color} /><span>Linie {line}</span><span className="sr"> – Längsprofil</span></h2>
      {hidden ? (
        <div className="note-row"><p className="note">Linie {line} ist ausgeblendet.</p><button type="button" className="chip" onClick={onShow}>Linie {line} einblenden</button></div>
      ) : !stations.length ? <p className="muted">Im Jahr {year} noch nicht in Betrieb.</p> : (
        <>
          <dl className="facts">
            <dt>Bahnhöfe</dt><dd>{nodes}{nodes !== stations.length && <span className="muted"> ({stations.length} Bahnsteig-/Ebenen-Einträge)</span>}</dd>
            {prof && (<><dt>Länge</dt><dd>{(prof.total / 1000).toFixed(1).replace('.', ',')} km (Hauptstrecke)</dd></>)}
            {deepest && (<><dt>Tiefster Bf.</dt><dd><button type="button" className="link" onClick={() => onStation(deepest.id)}>{nameAt(deepest, iso)}</button> {depthText(deepest)}</dd></>)}
            {deepest && (<><dt>Ø Tiefe</dt><dd>{avgApprox ? '≈ ' : ''}{n1(avg)} m <span className="muted">({under.length} Tunnelbahnhöfe, unter Gelände)</span></dd></>)}
            <dt>Niedrigste Stationshöhe</dt><dd>{nameAt(lowest, iso)}, ≈ {n0(lowest.abs)} m ü. NHN</dd>
            <dt>Gelände an den Bf.</dt><dd>{n0(Math.min(...gr))}–{n0(Math.max(...gr))} m ü. NHN</dd>
          </dl>
          {prof && <Profile prof={prof} color={color} iso={iso} onStation={onStation} />}
          <details className="stlist">
            <summary>Alle Bahnhöfe der Linie ({stations.length})</summary>
            <ol>
              {(prof ? prof.marks.map((m) => m.st) : []).concat(stations.filter((x) => !prof || !prof.marks.some((m) => m.st.id === x.id)))
                .map((x) => (
                  <li key={x.id}><button type="button" className="link" onClick={() => onStation(x.id)}>{nameAt(x, iso)}</button> <span className="m">{depthText(x)}</span> <span className="muted">{statusShort(x)}</span></li>
                ))}
            </ol>
          </details>
          <div className="legend-mini">
            <span><i className="earth-sw" />Gelände (DGM1, geglättet)</span>
            <span><i style={{ background: color }} />Modelltrasse</span>
          </div>
          <div className="legend-mini" aria-label="Herkunft der Bahnhofswerte">
            <span><i className="dot-fill" style={{ background: color }} />Kreis: Quellenangabe ({cnt.quelle})</span>
            <span><i className="dot-sq" style={{ background: color }} />Quadrat: abgeleitet ({cnt.abgeleitet})</span>
            <span><i className="hollow" style={{ borderColor: color }} />hohler Kreis: Modellschätzung ({cnt.modell})</span>
          </div>
          <div className="actions">
            <button type="button" className="chip" onClick={onShowMap}>Linie auf Karte zeigen</button>
            <button type="button" className="chip" onClick={onOnly}>Nur diese Linie</button>
            <button type="button" className="chip" onClick={onNames} aria-pressed={!names}>{names ? 'Namen aus' : 'Namen ein'}</button>
            <button type="button" className="chip" onClick={onClose}>Gesamtnetz</button>
          </div>
          <p className="hint small">Form = Herkunft des Werts, nicht Messgenauigkeit; «ca.», «rund» und Spannen stehen am Wert. Längsprofil der längsten durchgehenden Strecke · Höhen ü. NHN · Trasse interpoliert und geglättet, keine Vermessung.</p>
        </>
      )}
    </section>
  );
}
