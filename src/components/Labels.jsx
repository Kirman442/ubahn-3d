import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

// Подписи станций — обычные DOM-элементы поверх холста. Каждый кадр проецируем
// точки, ближние ставим первыми, перекрывающиеся прячем (как collision в MapLibre).
export default function Labels({ items, overlay, exag, enabled }) {
  const { camera, size } = useThree();
  const els = useRef([]);
  const v = useMemo(() => new THREE.Vector3(), []);
  const frame = useRef(0);

  useEffect(() => {
    const root = overlay.current;
    if (!root) return undefined;
    root.innerHTML = '';
    els.current = items.map((it) => {
      const el = document.createElement('div');
      el.className = `label${it.ghost ? ' ghost' : ''}`;
      el.textContent = it.text;
      el.style.setProperty('--c', it.color);
      root.appendChild(el);
      return { el, w: 0, h: 0, shown: false };
    });
    // размеры меряем один раз
    els.current.forEach((e) => { e.w = e.el.offsetWidth; e.h = e.el.offsetHeight; e.el.style.display = 'none'; });
    return () => { root.innerHTML = ''; };
  }, [items, overlay]);

  useFrame(() => {
    frame.current++;
    if (frame.current % 2) return;
    const list = els.current;
    if (!enabled) { list.forEach((e) => { if (e.shown) { e.el.style.display = 'none'; e.shown = false; } }); return; }
    const cand = [];
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      v.set(it.x, it.z * exag, it.zz);
      const d = v.distanceTo(camera.position);
      v.project(camera);
      if (v.z > 1 || v.z < -1 || Math.abs(v.x) > 1.05 || Math.abs(v.y) > 1.05) continue;
      cand.push({ i, d, sx: ((v.x + 1) / 2) * size.width, sy: ((1 - v.y) / 2) * size.height });
    }
    cand.sort((a, b) => a.d - b.d);
    const placed = [];
    const show = new Set();
    for (const c of cand) {
      const e = list[c.i];
      const x0 = c.sx + 10; const y0 = c.sy - e.h / 2;
      const r = [x0 - 2, y0 - 1, x0 + e.w + 2, y0 + e.h + 1];
      if (placed.some((p) => r[0] < p[2] && r[2] > p[0] && r[1] < p[3] && r[3] > p[1])) continue;
      placed.push(r);
      show.add(c.i);
      e.el.style.transform = `translate(${x0.toFixed(1)}px, ${y0.toFixed(1)}px)`;
    }
    list.forEach((e, i) => {
      const on = show.has(i);
      if (on !== e.shown) { e.el.style.display = on ? 'block' : 'none'; e.shown = on; }
    });
  });

  return null;
}
