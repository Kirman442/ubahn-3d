import { useEffect, useMemo, useState } from 'react';
import * as THREE from 'three';
import maplibregl from 'maplibre-gl';
import { GROUND_BBOX, toXZ, fromXZ, merc } from '../lib/geo';

// Подложка berlin.pmtiles рисуется один раз невидимой картой MapLibre в холст 4096 px,
// холст становится текстурой полупрозрачной «земли» на высоте 0.
function renderGroundTexture(style, bbox, maxPx = 4096) {
  const m0 = merc(bbox.west, bbox.north);
  const m1 = merc(bbox.east, bbox.south);
  const mw = m1.x - m0.x;
  const mh = m1.y - m0.y;
  const W = maxPx;
  const zoom = Math.log2(W / (mw * 512));
  const H = Math.round(mh * 512 * 2 ** zoom);
  const center = new maplibregl.MercatorCoordinate((m0.x + m1.x) / 2, (m0.y + m1.y) / 2).toLngLat();

  const div = document.createElement('div');
  Object.assign(div.style, { position: 'fixed', left: '-20000px', top: '0', width: `${W}px`, height: `${H}px`, pointerEvents: 'none' });
  document.body.appendChild(div);

  return new Promise((resolve) => {
    const t0 = performance.now();
    const map = new maplibregl.Map({
      container: div, style, center, zoom, pixelRatio: 1, interactive: false,
      attributionControl: false, fadeDuration: 0, maxCanvasSize: [W, W],
      canvasContextAttributes: { preserveDrawingBuffer: true, antialias: true },
    });
    let done = false;
    const finish = (reason) => {
      if (done) return;
      done = true;
      const c = document.createElement('canvas');
      c.width = W; c.height = H;
      c.getContext('2d').drawImage(map.getCanvas(), 0, 0, W, H);
      map.remove();
      div.remove();
      window.__ground = { W, H, zoom: +zoom.toFixed(2), ms: Math.round(performance.now() - t0), reason };
      resolve({ canvas: c, m0, m1 });
    };
    map.on('error', (e) => console.warn('basemap:', e.error?.message || e));
    map.once('idle', () => finish('idle'));
    setTimeout(() => finish('timeout'), 45000);
  });
}

function groundGeometry(bbox, m0, m1, n = 48) {
  const [x0, z0] = toXZ(bbox.west, bbox.north);
  const [x1, z1] = toXZ(bbox.east, bbox.south);
  const pos = [];
  const uv = [];
  const idx = [];
  for (let j = 0; j <= n; j++) {
    for (let i = 0; i <= n; i++) {
      const x = x0 + ((x1 - x0) * i) / n;
      const z = z0 + ((z1 - z0) * j) / n;
      const [lon, lat] = fromXZ(x, z);
      const m = merc(lon, lat);
      pos.push(x, 0, z);
      uv.push((m.x - m0.x) / (m1.x - m0.x), (m1.y - m.y) / (m1.y - m0.y));
    }
  }
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const a = j * (n + 1) + i;
      idx.push(a, a + n + 1, a + 1, a + 1, a + n + 1, a + n + 2);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

export default function Ground({ style, opacity }) {
  const [tex, setTex] = useState(null);

  useEffect(() => {
    let alive = true;
    renderGroundTexture(style, GROUND_BBOX).then(({ canvas, m0, m1 }) => {
      if (!alive) return;
      const t = new THREE.CanvasTexture(canvas);
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = 8;
      t.generateMipmaps = true;
      t.minFilter = THREE.LinearMipmapLinearFilter;
      setTex((old) => { old?.texture.dispose(); return { texture: t, geometry: groundGeometry(GROUND_BBOX, m0, m1) }; });
    });
    return () => { alive = false; };
  }, [style]);

  const fallback = useMemo(() => {
    const [x0, z0] = toXZ(GROUND_BBOX.west, GROUND_BBOX.north);
    const [x1, z1] = toXZ(GROUND_BBOX.east, GROUND_BBOX.south);
    const g = new THREE.PlaneGeometry(x1 - x0, z1 - z0);
    g.rotateX(-Math.PI / 2);
    g.translate((x0 + x1) / 2, 0, (z0 + z1) / 2);
    return g;
  }, []);

  return (
    <mesh geometry={tex ? tex.geometry : fallback} renderOrder={10}>
      <meshBasicMaterial
        map={tex ? tex.texture : null}
        color={tex ? '#ffffff' : '#cfd2cc'}
        transparent
        opacity={opacity}
        depthWrite={false}
        side={THREE.DoubleSide}
        toneMapped={false}
      />
    </mesh>
  );
}
