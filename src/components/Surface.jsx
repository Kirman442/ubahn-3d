import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { CITY } from '../lib/city';
import Schema, { PALETTE } from './Schema';

// Oberfläche: Fläche in Geländehöhe, darauf die schematische Stadt (Schema.jsx, three.js-Geometrie),
// darunter ein erdfarbener «Deckel» und ein Schnitt an den Rändern.

function planeGeometry(extent, n = 40) {
  const pos = []; const idx = [];
  for (let j = 0; j <= n; j++) {
    for (let i = 0; i <= n; i++) pos.push(extent.x0 + ((extent.x1 - extent.x0) * i) / n, 0, extent.z0 + ((extent.z1 - extent.z0) * j) / n);
  }
  // треугольники против часовой стрелки при взгляде сверху → лицевая сторона смотрит вверх
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { const a = j * (n + 1) + i; idx.push(a, a + n + 1, a + 1, a + 1, a + n + 1, a + n + 2); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}

const EARTH = '#8A6A45';

export default function Surface({ extent, kind, opacity, depthBottom, dark }) {
  const geo = useMemo(() => planeGeometry(extent), [extent]);
  useEffect(() => () => geo.dispose(), [geo]);

  // срез грунта по краям: от улицы (0) до самой нижней отметки
  const walls = useMemo(() => {
    const { x0, x1, z0, z1 } = extent; const y1 = depthBottom;
    const q = (ax, az, bx, bz) => [ax, 0, az, bx, 0, bz, bx, y1, bz, ax, 0, az, bx, y1, bz, ax, y1, az];
    const pos = [...q(x0, z0, x1, z0), ...q(x1, z0, x1, z1), ...q(x1, z1, x0, z1), ...q(x0, z1, x0, z0)];
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    const edge = [x0, 0, z0, x1, 0, z0, x1, 0, z0, x1, 0, z1, x1, 0, z1, x0, 0, z1, x0, 0, z1, x0, 0, z0];
    const e = new THREE.BufferGeometry(); e.setAttribute('position', new THREE.Float32BufferAttribute(edge, 3));
    return { g, e };
  }, [extent, depthBottom]);
  useEffect(() => () => { walls.g.dispose(); walls.e.dispose(); }, [walls]);

  if (kind === 'off') return null;
  const schema = kind === 'schema';
  const top = schema ? PALETTE[dark ? 'dunkel' : 'hell'].base : '#D9DDE0';
  return (
    <group>
      {/* сверху: схема города */}
      <mesh geometry={geo} renderOrder={1}>
        <meshBasicMaterial color={top} transparent opacity={opacity} depthWrite={false} side={THREE.FrontSide} toneMapped={false} />
      </mesh>
      {schema && <Schema key={CITY.id} dark={dark} opacity={opacity} extent={extent} />}
      {/* снизу: земляной «потолок» — та же схема, тонированная в цвет грунта */}
      <mesh geometry={geo} renderOrder={1}>
        <meshBasicMaterial color={EARTH} transparent opacity={Math.min(1, opacity * 0.85)} depthWrite={false} side={THREE.BackSide} toneMapped={false} />
      </mesh>
      <mesh geometry={walls.g} renderOrder={0}>
        <meshBasicMaterial color={EARTH} transparent opacity={0.07} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
      <lineSegments geometry={walls.e}><lineBasicMaterial color={EARTH} transparent opacity={0.8} /></lineSegments>
    </group>
  );
}
