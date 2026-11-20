import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { lineBg, LINE_COLOR } from '../lib/city';

// helle Linienfarben (gelb) mit dunkler Schrift
const light = (hex) => { const n = parseInt((hex || '#000').slice(1), 16); return ((n >> 16) * 299 + ((n >> 8) & 255) * 587 + (n & 255) * 114) / 1000 > 170; };
const signets = (lines) => (lines || []).map((l) => `<i class="lb${light(LINE_COLOR[l]) ? ' dk' : ''}" style="background:${lineBg(l)}">${l}</i>`).join('');

// Подписи — DOM поверх холста. Ничего не скрываем: подписи могут накладываться,
// ближняя к камере лежит сверху (z-index), как в 3d-metro. Набор меняется только
// от настроек (режим подписей, год, выбор), а не от движения камеры.
// kompakte Übersicht: kleine Farbpunkte statt Signetzeile (weniger Fläche, weniger Überlagerung)
const dots = (lines) => `<span class="lbd">${(lines || []).map((l) => `<i style="background:${lineBg(l)}"></i>`).join('')}</span>`;
const TARGET = '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="8" cy="8" r="5"/><circle cx="8" cy="8" r="1.4" fill="currentColor" stroke="none"/><path d="M8 0.5v3M8 12.5v3M0.5 8h3M12.5 8h3"/></svg>';
const FLOOR_PX = 18; // Abstand der Etagen in Bildschirmpixeln (nicht Meter)

export default function Labels({ items, overlay }) {
  const { camera, size } = useThree();
  const els = useRef([]);
  const v = useMemo(() => new THREE.Vector3(), []);

  useEffect(() => {
    const root = overlay.current;
    if (!root) return undefined;
    const old = new Map(els.current.map((e) => [e.key, e]));
    els.current = items.map((it) => {
      let e = old.get(it.key);
      if (e) old.delete(it.key);
      else { e = { key: it.key, el: document.createElement('div'), shown: false }; e.el.style.display = 'none'; root.appendChild(e.el); }
      e.el.className = `lbl${it.ghost ? ' ghost' : ''}${it.strong ? ' strong' : ''}${it.focus ? ' focus' : ''}${it.bg ? ' bg' : ''}${it.tier ? ' lead' : ''}${it.compact ? ' cmp' : ''}`;
      e.lift = it.tier ? it.tier * FLOOR_PX : 0;
      e.el.style.setProperty('--lead', `${e.lift}px`);
      e.el.style.setProperty('--c', it.color);
      if (it.pin) {
        e.el.className = 'tip pin'; e.lift = 0;
        e.el.innerHTML = `<button type="button" class="pin-go" title="Zum Bahnhof" aria-label="Zum Bahnhof">${TARGET}</button><b>${it.text}</b><span class="m">${it.depth || ''}</span><br /><span class="muted">${it.pin}</span>`;
        e.el.querySelector('.pin-go').onclick = (ev) => { ev.stopPropagation(); e.it?.target?.(); };
        e.it = it; return e;
      }
      e.el.innerHTML = `${it.compact ? dots(it.lines) : `<span class="lbs">${signets(it.lines)}</span>`}${it.text}${it.depth ? `<b>${it.depth}</b>` : ''}`;
      e.it = it;
      return e;
    });
    old.forEach((e) => e.el.remove());
    return undefined;
  }, [items, overlay]);

  useEffect(() => () => { els.current.forEach((e) => e.el.remove()); els.current = []; }, []);

  useFrame(() => {
    const W = size.width; const H = size.height;
    for (const e of els.current) {
      const { it } = e;
      v.set(it.x, it.y, it.z);
      const dist = v.distanceTo(camera.position);
      v.project(camera);
      const on = v.z < 1 && v.z > -1 && Math.abs(v.x) < 1.1 && Math.abs(v.y) < 1.1;
      if (on !== e.shown) { e.el.style.display = on ? 'block' : 'none'; e.shown = on; }
      if (!on) continue;
      e.el.style.transform = `translate(${(((v.x + 1) / 2) * W).toFixed(1)}px, ${(((1 - v.y) / 2) * H).toFixed(1)}px) ${it.pin ? 'translate(14px, 14px)' : `translate(-50%, -135%) translateY(${-e.lift}px)`}`;
      // Stapelung nach Priorität: gewählt/überfahren → untersuchte Linie → Hintergrund; innerhalb: näher liegt oben
      e.el.style.zIndex = String(it.strong ? 300000 : (it.focus ? 200000 : 100000) - Math.min(99999, Math.round(dist / 5)));
    }
  });

  return null;
}
