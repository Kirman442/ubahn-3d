import { useEffect, useMemo, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { CITY } from '../lib/city';

// Schematische Oberfläche als three.js-Geometrie (statt Kartentextur): Wasser, Grün, Hauptstraßen,
// Eisenbahn, Stadtgrenze aus public/data/<stadt>/basemap.json (scripts/basemap3d.mjs).
// Farben kommen aus dem Design (hell/dunkel); Linien haben feste Breite in Bildschirmpixeln.

// Helles Design: Flächen multiplizieren statt überdecken – Röhren unter der Oberfläche bleiben satt,
// statt von einer hellen, halbdurchsichtigen Schicht ausgewaschen zu werden. Deckkraft = Mischung mit Weiß.
export const mulColor = (c, a) => new THREE.Color('#ffffff').lerp(new THREE.Color(c), Math.min(1, a));
export const surfMat = (dark, color, opacity) => (dark
  ? { color, transparent: true, opacity }
  : { color: mulColor(color, opacity), transparent: true, opacity: 1, blending: THREE.MultiplyBlending, premultipliedAlpha: true });

export const PALETTE = {
  dunkel: { base: '#1F252C', green: '#22362A', forest: '#1C3024', water: '#1E4466', river: '#2B5A85',
    motorway: '#554B3D', trunk: '#4B453D', primary: '#5E6672', secondary: '#48505B', main: '#4D535C', sbahn: '#45574D', boundary: '#9A8A6A' },
  hell: { base: '#F6F7F4', green: '#CFE1C3', forest: '#BBD4AE', water: '#9EC6E8', river: '#7FB1DE',
    motorway: '#D3BE98', trunk: '#D5C6AC', primary: '#B9B4AA', secondary: '#CBC7BF', main: '#ADB2B9', sbahn: '#A2B6AA', boundary: '#8A7A60' },
};
// Füllungen: Schlüssel aus basemap.json → Farbe, Reihenfolge = Zeichenreihenfolge
const FILLS = [['green', ['green:park', 'green:grass', 'green:cemetery']], ['forest', ['green:forest']],
  ['water', ['water:river', 'water:lake', 'water:canal', 'water:harbour']]];
// Linien: Farbe, Breite in px
const STROKES = [
  ['boundary', ['boundary:city'], 1.4, 0.7], ['secondary', ['road:secondary'], 1.0, 1], ['primary', ['road:primary'], 1.5, 1],
  ['trunk', ['road:trunk'], 1.7, 1], ['motorway', ['road:motorway'], 2.0, 1],
  ['main', ['rail:main'], 1.1, 1], ['sbahn', ['rail:sbahn'], 1.1, 1],
  ['river', ['waterway:river'], 2.6, 1], ['river', ['waterway:canal'], 1.8, 1],
];

const CACHE = new Map();
const loadBasemap = (dir) => {
  if (!CACHE.has(dir)) {
    // Fehlschlag nicht merken: beim nächsten Laden (z. B. «Erneut versuchen», Stadtwechsel) neu anfragen
    CACHE.set(dir, fetch(`/data/${dir}basemap.json`).then((r) => (r.ok ? r.json() : null)).catch(() => null)
      .then((d) => { if (!d) CACHE.delete(dir); return d; }));
  }
  return CACHE.get(dir);
};

const toV2 = (flat) => { const v = []; for (let i = 0; i < flat.length; i += 2) v.push(new THREE.Vector2(flat[i], flat[i + 1])); return v; };
const open = (v) => (v.length > 1 && v[0].equals(v[v.length - 1]) ? v.slice(0, -1) : v);

function fillGeometry(polys) {
  const pos = []; const idx = []; let base = 0;
  for (const rings of polys) {
    const outer = open(toV2(rings[0])); const holes = rings.slice(1).map((r) => open(toV2(r)));
    if (outer.length < 3) continue;
    const faces = THREE.ShapeUtils.triangulateShape(outer, holes);
    const pts = outer.concat(...holes);
    for (const p of pts) pos.push(p.x, 0, p.y);
    for (const [a, b, c] of faces) {
      const A = pts[a]; const B = pts[b]; const C = pts[c];
      // Dreieck nach oben ausrichten (Normale +y), damit FrontSide von oben sichtbar ist
      const ny = (B.y - A.y) * (C.x - A.x) - (B.x - A.x) * (C.y - A.y);
      if (ny >= 0) idx.push(base + a, base + b, base + c); else idx.push(base + a, base + c, base + b);
    }
    base += pts.length;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  return g;
}

function strokeGeometry(lines) {
  const seg = [];
  for (const l of lines) for (let i = 0; i + 3 < l.length; i += 2) seg.push(l[i], 0, l[i + 1], l[i + 2], 0, l[i + 3]);
  const g = new LineSegmentsGeometry(); g.setPositions(seg);
  return g;
}

const noRay = () => null; // Oberfläche nimmt nicht an Hover/Klick teil (spart Raycasting)

export default function Schema({ dark, opacity, extent }) {
  // Daten reichen 3 km über die Bahnhöfe hinaus, die Fläche nur 1,5 km: auf die Fläche zuschneiden
  const gl = useThree((st) => st.gl);
  useEffect(() => { gl.localClippingEnabled = true; }, [gl]);
  const clip = useMemo(() => [new THREE.Plane(new THREE.Vector3(1, 0, 0), -extent.x0), new THREE.Plane(new THREE.Vector3(-1, 0, 0), extent.x1),
    new THREE.Plane(new THREE.Vector3(0, 0, 1), -extent.z0), new THREE.Plane(new THREE.Vector3(0, 0, -1), extent.z1)], [extent]);
  const [data, setData] = useState(null);
  useEffect(() => {
    let alive = true;
    loadBasemap(CITY.data).then((d) => { if (alive) setData(d); });
    return () => { alive = false; };
  }, []);

  const geo = useMemo(() => {
    if (!data) return null;
    const fills = FILLS.map(([c, keys]) => [c, fillGeometry(keys.flatMap((k) => data.polys[k] || []))]).filter(([, g]) => g.index.count);
    // Stadtgrenze ist im Paket eine Fläche: als Umriss zeichnen
    const src = (k) => (k === 'boundary:city' ? (data.polys[k] || []).flat() : data.lines[k] || []);
    const out = STROKES.map(([c, keys, w, a]) => [c, keys.flatMap(src), w, a]).filter(([, l]) => l.length)
      .map(([c, l, w, a]) => [c, strokeGeometry(l), w, a]);
    return { fills, strokes: out };
  }, [data]);
  useEffect(() => () => { geo?.fills.forEach(([, g]) => g.dispose()); geo?.strokes.forEach(([, g]) => g.dispose()); }, [geo]);

  const P = PALETTE[dark ? 'dunkel' : 'hell'];
  const lines = useMemo(() => {
    if (!geo) return [];
    return geo.strokes.map(([c, g, w, a]) => {
      const m = new LineMaterial({ color: P[c], linewidth: w, transparent: true, opacity: 1, depthWrite: false, clippingPlanes: clip });
      const o = new LineSegments2(g, m); o.raycast = noRay; o.renderOrder = 4; o.userData.alpha = a; o.userData.kind = c;
      return o;
    });
  }, [geo, P, clip]);
  // Nebenstraßen (secondary) erst beim Heranzoomen: in der Gesamtansicht wirken sie wie ein Raster
  const ZOOM_NEAR = 9000; const ZOOM_FAR = 15000; // Kameraabstand zum Ziel in m: voll sichtbar … unsichtbar
  useFrame((st) => {
    const t = st.controls?.target; const d = t ? st.camera.position.distanceTo(t) : 0;
    const near = Math.min(1, Math.max(0, (ZOOM_FAR - d) / (ZOOM_FAR - ZOOM_NEAR)));
    for (const o of lines) {
      const f = o.userData.kind === 'secondary' ? near : 1;
      o.material.opacity = Math.min(1, opacity * 1.1) * o.userData.alpha * f;
      o.visible = f > 0.01;
    }
  });
  useEffect(() => () => lines.forEach((o) => o.material.dispose()), [lines]);

  if (!geo) return null;
  return (
    <group position={[0, 0.5, 0]}>
      {geo.fills.map(([c, g], i) => (
        <mesh key={c} geometry={g} raycast={noRay} renderOrder={2 + i * 0.1}>
          <meshBasicMaterial key={dark ? 'd' : 'h'} {...surfMat(dark, P[c], Math.min(1, opacity * 1.2))} side={c === 'water' ? THREE.DoubleSide : THREE.FrontSide} depthWrite={false} toneMapped={false} clippingPlanes={clip} />
        </mesh>
      ))}
      {lines.map((o, i) => <primitive key={i} object={o} />)}
    </group>
  );
}
