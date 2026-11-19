import { useEffect, useMemo } from 'react';
import * as THREE from 'three';

// Entwurf: Erdblock als «Diorama» – nur die hinteren Innenwände (BackSide) und der Boden sind sichtbar,
// Farbverlauf mit der Tiefe, Schichtlinien alle 5 m. Vordere Wände bleiben unsichtbar → Blick ins Innere.
export default function Soil({ extent, bottom, exag, mode, top: topC, deep: deepC, line: lineC }) {
  const g = useMemo(() => {
    const { x0, x1, z0, z1 } = extent; const y0 = 0; const y1 = bottom;
    const top = new THREE.Color(topC); const deep = new THREE.Color(deepC);
    const pos = []; const col = [];
    const N = 12;
    const wall = (ax, az, bx, bz) => {
      for (let i = 0; i < N; i++) {
        const ya = y0 + ((y1 - y0) * i) / N; const yb = y0 + ((y1 - y0) * (i + 1)) / N;
        const ca = top.clone().lerp(deep, i / N); const cb = top.clone().lerp(deep, (i + 1) / N);
        pos.push(ax, ya, az, bx, ya, bz, bx, yb, bz, ax, ya, az, bx, yb, bz, ax, yb, az);
        [ca, ca, cb, ca, cb, cb].forEach((c) => col.push(c.r, c.g, c.b));
      }
    };
    wall(x0, z0, x1, z0); wall(x1, z0, x1, z1); wall(x1, z1, x0, z1); wall(x0, z1, x0, z0);
    const walls = new THREE.BufferGeometry();
    walls.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    walls.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    walls.computeVertexNormals();
    const floor = new THREE.PlaneGeometry(x1 - x0, z1 - z0); floor.rotateX(-Math.PI / 2); floor.translate((x0 + x1) / 2, y1, (z0 + z1) / 2);
    // Schichtlinien auf den Wänden
    const L = [];
    for (let m = 5; m * exag <= -y1 + 1; m += 5) {
      const y = -m * exag;
      L.push(x0, y, z0, x1, y, z0, x1, y, z0, x1, y, z1, x1, y, z1, x0, y, z1, x0, y, z1, x0, y, z0);
    }
    const lines = new THREE.BufferGeometry(); lines.setAttribute('position', new THREE.Float32BufferAttribute(L, 3));
    return { walls, floor, lines };
  }, [extent, bottom, exag, topC, deepC]);
  useEffect(() => () => { g.walls.dispose(); g.floor.dispose(); g.lines.dispose(); }, [g]);
  if (mode === 'abs') return null;
  return (
    <group>
      <mesh geometry={g.walls} renderOrder={-2}><meshBasicMaterial vertexColors side={THREE.BackSide} depthWrite={false} fog={false} toneMapped={false} /></mesh>
      <mesh geometry={g.floor} renderOrder={-2}><meshBasicMaterial color={deepC} side={THREE.FrontSide} depthWrite={false} fog={false} toneMapped={false} /></mesh>
      <lineSegments geometry={g.lines} renderOrder={-1}><lineBasicMaterial color={lineC} transparent opacity={0.35} depthWrite={false} fog={false} /></lineSegments>
    </group>
  );
}
