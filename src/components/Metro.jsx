import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { TUBE_RADIUS, STATION_RADIUS } from '../lib/config';
import { depthColor } from '../lib/colors';

const sphere = new THREE.SphereGeometry(STATION_RADIUS, 20, 14);
// Stil «neu»: größere Kugel passend zu den dickeren Röhren
const sphereNeu = new THREE.SphereGeometry(STATION_RADIUS * 1.3, 24, 16);
const ring = new THREE.TorusGeometry(STATION_RADIUS * 1.35, STATION_RADIUS * 0.16, 8, 40);
ring.rotateX(Math.PI / 2);
const selRing = new THREE.TorusGeometry(STATION_RADIUS * 1.9, STATION_RADIUS * 0.14, 8, 48);
selRing.rotateX(Math.PI / 2);
const xraySphere = new THREE.SphereGeometry(STATION_RADIUS * 0.8, 16, 10);

const useDispose = (objs) => useEffect(() => () => [].concat(objs).forEach((o) => o?.dispose?.()), [objs]);

// ---------- трубки участков ----------
// Glättung: Rohpunkte gleichmäßig neu abtasten und sanft mitteln (Endpunkte = Bahnhöfe bleiben fest).
// Sonst knickt die dicke Röhre an dicht liegenden/verrauschten Punkten und bei starker Überhöhung ein.
function smoothPath(pts, rel, step, passes) {
  const cum = [0];
  for (let k = 1; k < pts.length; k++) cum.push(cum[k - 1] + pts[k].distanceTo(pts[k - 1]));
  const L = cum[cum.length - 1];
  const n = Math.max(2, Math.round(L / step) + 1);
  let P = []; const R = [];
  let j = 0;
  for (let i = 0; i < n; i++) {
    const d = (i / (n - 1)) * L;
    while (j < pts.length - 2 && cum[j + 1] < d) j++;
    const t = Math.min(1, Math.max(0, (d - cum[j]) / ((cum[j + 1] - cum[j]) || 1)));
    P.push(pts[j].clone().lerp(pts[j + 1], t)); R.push(rel[j] + (rel[j + 1] - rel[j]) * t);
  }
  for (let it = 0; it < passes; it++) {
    const Q = P.map((v) => v.clone());
    for (let i = 1; i < P.length - 1; i++) Q[i].set(0, 0, 0).addScaledVector(P[i - 1], 0.25).addScaledVector(P[i], 0.5).addScaledVector(P[i + 1], 0.25);
    P = Q;
  }
  return [P, R];
}

function tubeGeometry(sec, Y, colorDepth, radius) {
  const raw = [];
  const rawRel = [];
  for (let k = 0; k < sec.pts.length; k++) {
    const p = sec.pts[k];
    const v = new THREE.Vector3(p.x, Y(p.z, p.g), p.zz);
    if (raw.length && v.distanceTo(raw[raw.length - 1]) < 2) continue;
    raw.push(v); rawRel.push(p.z);
  }
  if (raw.length < 2) return null;
  // Abtastschritt ≈ Röhrendurchmesser; Mittelung über einige Durchmesser
  const [pts, rel] = smoothPath(raw, rawRel, radius * 1.5, 6);
  const dist = [0];
  for (let k = 1; k < pts.length; k++) dist.push(dist[k - 1] + pts[k].distanceTo(pts[k - 1]));
  const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
  const segs = Math.min(1500, Math.max(8, Math.round(sec.length_m / 12)));
  const radial = 12;
  const geo = new THREE.TubeGeometry(curve, segs, radius, radial, false);
  if (colorDepth) {
    // глубина вдоль трубки: интерполяция по пройденному расстоянию
    const cols = [];
    let j = 0;
    const L = dist[dist.length - 1] || 1;
    for (let i = 0; i <= segs; i++) {
      const d = (i / segs) * L;
      while (j < dist.length - 2 && dist[j + 1] < d) j++;
      const t = Math.min(1, Math.max(0, (d - dist[j]) / ((dist[j + 1] - dist[j]) || 1)));
      const c = depthColor(rel[j] + (rel[j + 1] - rel[j]) * t);
      for (let r = 0; r <= radial; r++) cols.push(c.r, c.g, c.b);
    }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  }
  return geo;
}

export function Tubes({ sections, visible, Y, colorMode, focusLine, onHover, onPick, neu, glow }) {
  const geoms = useMemo(() => sections.map((s) => tubeGeometry(s, Y, colorMode === 'depth', neu ? TUBE_RADIUS * 1.7 : TUBE_RADIUS)), [sections, Y, colorMode, neu]);
  useDispose(geoms);
  const mats = useMemo(() => {
    const m = {};
    const make = (key, opts) => { m[key] = new THREE.MeshStandardMaterial({ roughness: 0.55, metalness: 0.05, ...opts }); };
    sections.forEach((s) => {
      const c = new THREE.Color(s.color);
      make(`${s.line}`, colorMode === 'depth' ? { vertexColors: true } : { color: c, emissive: c, emissiveIntensity: glow ? 0.5 : 0.12 });
      make(`${s.line}-f`, { ...(colorMode === 'depth' ? { vertexColors: true } : { color: c }), transparent: true, opacity: 0.12, depthWrite: false });
    });
    return m;
  }, [sections, colorMode, glow]);
  useDispose(Object.values(mats));

  return (
    <group>
      {sections.map((s, i) => geoms[i] && (
        <mesh
          key={i}
          geometry={geoms[i]}
          material={mats[focusLine && focusLine !== s.line ? `${s.line}-f` : s.line]}
          visible={visible[i]}
          onPointerMove={(e) => { if (!visible[i]) return; e.stopPropagation(); onHover({ kind: 'line', line: s.line, section: s, x: e.clientX, y: e.clientY }); }}
          onPointerOut={() => onHover(null)}
          onClick={(e) => { if (!visible[i] || e.delta > 5) return; e.stopPropagation(); onPick({ kind: 'line', line: s.line }); }}
        />
      ))}
    </group>
  );
}

// ---------- станции ----------
export function Stations({ stations, sections, Y, colorMode, focusLine, selectedId, hoverId, onHover, onPick, neu }) {
  const mats = useMemo(() => {
    const cache = new Map();
    const f = (s, faded) => {
      const ghost = s.state === 'interrupted';
      const c = colorMode === 'depth' ? depthColor(s.z) : new THREE.Color(s.color);
      const key = `${c.getHexString()}|${ghost}|${faded}`;
      if (!cache.has(key)) {
        const op = faded ? 0.15 : ghost ? 0.3 : 1;
        cache.set(key, new THREE.MeshStandardMaterial({
          color: ghost ? '#ffffff' : c, emissive: c, emissiveIntensity: 0.18, roughness: 0.4,
          transparent: op < 1, opacity: op, depthWrite: op === 1,
        }));
      }
      return cache.get(key);
    };
    f.cache = cache;
    return f;
  }, [colorMode]);
  // Materialien des alten Farbmodus freigeben (vorher blieben sie bis zum Seitenwechsel im GPU-Speicher)
  useEffect(() => () => mats.cache.forEach((m) => m.dispose()), [mats]);
  const ringMat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#B7762C', depthTest: false, transparent: true }), []);
  // Röntgen-Markierung: gewählter/überfahrener Bahnhof bleibt auch unter einer deckenden Oberfläche sichtbar
  const xray = useMemo(() => new Map(), []);
  const xrayMat = (c) => {
    if (!xray.has(c)) xray.set(c, new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.85, depthTest: false, depthWrite: false }));
    return xray.get(c);
  };
  useEffect(() => () => { ringMat.dispose(); xray.forEach((m) => m.dispose()); }, [ringMat, xray]);

  return (
    <group>
      {stations.map((s) => {
        const faded = !!focusLine && focusLine !== s.line;
        const ghost = s.state === 'interrupted';
        return (
          <group key={s.id} position={[s.x, Y(s.z, s.ground), s.zz]}>
            <mesh
              geometry={neu ? sphereNeu : sphere}
              material={mats(s, faded)}
              userData={{ id: s.id }}
              onPointerMove={(e) => { e.stopPropagation(); onHover({ kind: 'station', id: s.id, x: e.clientX, y: e.clientY }); }}
              onPointerOut={() => onHover(null)}
              onClick={(e) => { if (e.delta > 5) return; e.stopPropagation(); onPick({ kind: 'station', id: s.id }); }}
            />
            {ghost && <mesh geometry={ring} raycast={() => null}><meshBasicMaterial color={s.color} /></mesh>}
            {(selectedId === s.id || hoverId === s.id) && <mesh geometry={xraySphere} material={xrayMat(s.color)} renderOrder={20} raycast={() => null} />}
            {selectedId === s.id && <mesh geometry={selRing} material={ringMat} renderOrder={21} raycast={() => null} />}
          </group>
        );
      })}
    </group>
  );
}

// ---------- шахты (станция ↔ поверхность) и точки на поверхности ----------
export function Shafts({ stations, Y, SY }) {
  const [lines, dots] = useMemo(() => {
    const a = [];
    const d = [];
    stations.forEach((s) => {
      const top = SY(s.ground);
      if (s.z < 0) a.push(s.x, top, s.zz, s.x, Y(s.z, s.ground), s.zz);
      d.push(s.x, top + 1, s.zz);
    });
    const g1 = new THREE.BufferGeometry(); g1.setAttribute('position', new THREE.Float32BufferAttribute(a, 3));
    const g2 = new THREE.BufferGeometry(); g2.setAttribute('position', new THREE.Float32BufferAttribute(d, 3));
    return [g1, g2];
  }, [stations, Y, SY]);
  useDispose([lines, dots]);
  return (
    <group>
      <lineSegments geometry={lines}><lineBasicMaterial color="#5A636E" transparent opacity={0.4} /></lineSegments>
      <points geometry={dots}><pointsMaterial color="#5A636E" size={4} sizeAttenuation={false} transparent opacity={0.6} /></points>
    </group>
  );
}

// ---------- пересадки (пунктир между станциями узла) ----------
export function Transfers({ pairs, byId, Y }) {
  const geo = useMemo(() => {
    const a = [];
    pairs.forEach(([i, j]) => {
      const A = byId[i]; const B = byId[j];
      if (!A || !B) return;
      a.push(A.x, Y(A.z, A.ground), A.zz, B.x, Y(B.z, B.ground), B.zz);
    });
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(a, 3));
    return g;
  }, [pairs, byId, Y]);
  useDispose(geo);
  return (
    <lineSegments geometry={geo} onUpdate={(l) => l.computeLineDistances()}>
      <lineDashedMaterial color="#1A1E23" dashSize={40} gapSize={30} transparent opacity={0.55} />
    </lineSegments>
  );
}

// ---------- поверхность над трассами в режиме «абсолютно» (рельеф DGM1 вдоль линий) ----------
export function SurfaceTraces({ sections, visible, SY }) {
  const geo = useMemo(() => {
    const a = [];
    sections.forEach((s, i) => {
      if (!visible[i]) return;
      for (let k = 1; k < s.pts.length; k++) {
        const p = s.pts[k - 1]; const q = s.pts[k];
        a.push(p.x, SY(p.gd), p.zz, q.x, SY(q.gd), q.zz);
      }
    });
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(a, 3));
    return g;
  }, [sections, visible, SY]);
  useDispose(geo);
  return <lineSegments geometry={geo}><lineBasicMaterial color="#8C7A5E" transparent opacity={0.7} /></lineSegments>;
}
