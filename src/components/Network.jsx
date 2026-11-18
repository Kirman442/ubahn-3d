import { useMemo, useState, useEffect } from 'react';
import * as THREE from 'three';
import { TUBE_RADIUS, STATION_RADIUS } from '../lib/config';

const sphere = new THREE.SphereGeometry(STATION_RADIUS, 20, 14);
const ring = new THREE.TorusGeometry(STATION_RADIUS * 1.25, STATION_RADIUS * 0.22, 8, 32);
ring.rotateX(Math.PI / 2);
const matOpen = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.45, metalness: 0.05 });
const matHover = new THREE.MeshStandardMaterial({ color: '#fff4b8', emissive: '#665500', roughness: 0.4 });
const matGhost = new THREE.MeshStandardMaterial({ color: '#ffffff', transparent: true, opacity: 0.25, depthWrite: false });
const ringMats = {};
const ringMat = (c) => (ringMats[c] ||= new THREE.MeshStandardMaterial({ color: c, roughness: 0.5 }));
const tubeMats = {};
const tubeMat = (c) => (tubeMats[c] ||= new THREE.MeshStandardMaterial({ color: c, roughness: 0.55, metalness: 0.05 }));

function tubeFor(points) {
  if (points.length < 2) return null;
  // убираем почти совпадающие точки (иначе CatmullRom даёт петли)
  const pts = [points[0]];
  for (const p of points.slice(1)) if (p.distanceTo(pts[pts.length - 1]) > 2) pts.push(p);
  if (pts.length < 2) return null;
  const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
  let len = 0;
  for (let i = 1; i < pts.length; i++) len += pts[i].distanceTo(pts[i - 1]);
  const segs = Math.min(1200, Math.max(8, Math.round(len / 15)));
  return new THREE.TubeGeometry(curve, segs, TUBE_RADIUS, 8, false);
}

export function Tubes({ sections, exag, visible, onPick }) {
  const geoms = useMemo(
    () => sections.map((s) => tubeFor(s.pts.map(([x, z, zz]) => new THREE.Vector3(x, z * exag, zz)))),
    [sections, exag],
  );
  useEffect(() => () => geoms.forEach((g) => g?.dispose()), [geoms]);

  return (
    <group>
      {sections.map((s, i) => geoms[i] && (
        <mesh
          key={i}
          geometry={geoms[i]}
          material={tubeMat(s.color)}
          visible={visible[i]}
          onClick={(e) => { if (!visible[i]) return; e.stopPropagation(); onPick({ type: 'section', index: i, point: e.point.toArray() }); }}
          onPointerOver={(e) => { if (visible[i]) { e.stopPropagation(); document.body.style.cursor = 'pointer'; } }}
          onPointerOut={() => { document.body.style.cursor = ''; }}
        />
      ))}
    </group>
  );
}

export function Stations({ stations, exag, onPick, selectedId }) {
  const [hover, setHover] = useState(null);

  // вертикальные «шахты» от станции к поверхности
  const shafts = useMemo(() => {
    const a = [];
    for (const s of stations) a.push(s.x, s.z * exag, s.zz, s.x, 0, s.zz);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(a, 3));
    return g;
  }, [stations, exag]);
  useEffect(() => () => shafts.dispose(), [shafts]);

  return (
    <group>
      <lineSegments geometry={shafts}>
        <lineBasicMaterial color="#555" transparent opacity={0.35} depthWrite={false} />
      </lineSegments>
      {stations.map((s) => {
        const ghost = s.state === 'interrupted';
        const hot = hover === s.id || selectedId === s.id;
        return (
          <group key={s.id} position={[s.x, s.z * exag, s.zz]} scale={hot ? 1.45 : 1}>
            <mesh
              geometry={sphere}
              material={hot ? matHover : ghost ? matGhost : matOpen}
              onClick={(e) => { e.stopPropagation(); onPick({ type: 'station', id: s.id }); }}
              onPointerOver={(e) => { e.stopPropagation(); setHover(s.id); document.body.style.cursor = 'pointer'; }}
              onPointerOut={() => { setHover(null); document.body.style.cursor = ''; }}
            />
            {ghost && <mesh geometry={ring} material={ringMat(s.color)} raycast={() => null} />}
          </group>
        );
      })}
    </group>
  );
}
