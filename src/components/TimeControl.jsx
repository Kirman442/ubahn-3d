import { useEffect, useRef, useState } from 'react';
import { START_YEAR, END_YEAR } from '../lib/config';

const decades = [];
for (let y = Math.ceil(START_YEAR / 20) * 20; y <= END_YEAR; y += 20) decades.push(y);
const STEP_MS = 250; // Abspielen: 4 Jahre pro Sekunde

export default function TimeControl({ year, setYear, playing, setPlaying, firstYear }) {
  const timer = useRef(null);
  const [draft, setDraft] = useState(String(year));
  useEffect(() => { setDraft(String(year)); }, [year]);
  useEffect(() => {
    if (!playing) return undefined;
    timer.current = setInterval(() => {
      setYear((y) => {
        if (y >= END_YEAR) { setPlaying(false); return y; }
        return y + 1;
      });
    }, STEP_MS);
    return () => clearInterval(timer.current);
  }, [playing, setYear, setPlaying]);

  const clamp = (v) => Math.max(START_YEAR, Math.min(END_YEAR, v));
  const go = (v) => { setPlaying(false); setYear(clamp(v)); };
  const togglePlay = () => {
    if (!playing && year >= END_YEAR) setYear(firstYear || START_YEAR);
    setPlaying(!playing);
  };
  const commit = () => { const v = parseInt(draft, 10); if (Number.isFinite(v)) go(v); else setDraft(String(year)); };

  return (
    <div className="time" role="group" aria-label="Zeit">
      <button type="button" className="play" onClick={togglePlay} aria-label={playing ? 'Pause' : 'Abspielen (4 Jahre pro Sekunde)'} title={playing ? 'Pause' : 'Abspielen · 4 Jahre/s'}>
        <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
          {playing ? <path d="M4 2.5h3v11H4zM9 2.5h3v11H9z" fill="currentColor" /> : <path d="M5 2.5v11l9-5.5z" fill="currentColor" />}
        </svg>
      </button>
      <div className="slider">
        <input type="range" min={START_YEAR} max={END_YEAR} step={1} value={year}
          onChange={(e) => go(Number(e.target.value))} aria-label="Jahr" aria-describedby="time-cap" />
        <div className="ticks" aria-hidden="true">
          {decades.map((d) => (
            <span key={d} style={{ left: `${((d - START_YEAR) / (END_YEAR - START_YEAR)) * 100}%` }}>{d}</span>
          ))}
        </div>
        <p className="time-cap" id="time-cap">Netzstand Ende {year}<span className="cap2"> · heutiger Stadtplan</span></p>
      </div>
      <div className="year-box">
        <button type="button" className="step" onClick={() => go(year - 1)} aria-label="Ein Jahr zurück" disabled={year <= START_YEAR}>−</button>
        <input className="year" type="number" inputMode="numeric" min={START_YEAR} max={END_YEAR} value={draft} aria-label="Jahr eingeben"
          onChange={(e) => setDraft(e.target.value)} onBlur={commit} onKeyDown={(e) => { if (e.key === 'Enter') commit(); }} />
        <button type="button" className="step" onClick={() => go(year + 1)} aria-label="Ein Jahr vor" disabled={year >= END_YEAR}>+</button>
      </div>
    </div>
  );
}
