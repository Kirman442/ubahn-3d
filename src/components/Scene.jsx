import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { Tubes, Stations, Shafts, Transfers, SurfaceTraces } from './Metro';
import Guides from './Guides';
import Surface from './Surface';
import Labels from './Labels';
import { isUnderground } from '../lib/model';

const TAN = Math.tan(THREE.MathUtils.degToRad(42 / 2));
const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

// Kamera: Flug, Bahnhofsansicht je Lage, Rahmung von Bahnhofsgruppen, Bezug zum gewählten Bahnhof halten
function CameraRig({ api, Y, SY, exag, selected }) {
  const { camera, controls } = useThree();
  const anim = useRef(null);
  const anchor = useRef(null);

  const fly = (pos, target, ms = 900) => {
    if (!controls) return;
    const p1 = new THREE.Vector3(...pos); const q1 = new THREE.Vector3(...target);
    if (reducedMotion() || ms <= 0) { anim.current = null; camera.position.copy(p1); controls.target.copy(q1); controls.update(); return; }
    anim.current = { t0: performance.now(), ms, p0: camera.position.clone(), p1, q0: controls.target.clone(), q1 };
  };

  // Blickrichtung (horizontal) des Nutzers beibehalten
  const azimuth = () => {
    if (!controls) return [-0.5, 0.8];
    const dx = camera.position.x - controls.target.x; const dz = camera.position.z - controls.target.z;
    const l = Math.hypot(dx, dz);
    return l > 1 ? [dx / l, dz / l] : [-0.5, 0.8];
  };

  // Bahnhof zeigen: unterirdisch aus dem Untergrund (unter der Oberfläche), Hochbahn von schräg oben, ebenerdig schräg
  const focus = (s) => {
    const y = Y(s.z, s.ground); const sy = SY(s.ground);
    const [ax, az] = azimuth();
    let d; let cy;
    if (isUnderground(s)) {
      const below = Math.max(1, sy - y);                      // Szenen-Abstand Bahnhof ↔ Gelände
      d = 2200;
      cy = Math.min(y + Math.max(40, below * 0.45), sy - Math.max(4, below * 0.12));
    } else if (s.z > 2) { d = 2600; cy = y + 1400; } else { d = 2600; cy = Math.max(y, sy) + 1700; }
    fly([s.x + ax * d, cy, s.zz + az * d], [s.x, y, s.zz]);
  };

  // Rahmung einer Gruppe von Bahnhöfen (Linie oder ganzes Netz)
  const frame = (stations, kind) => {
    if (!stations?.length) return false;
    const xs = stations.map((s) => s.x); const zs = stations.map((s) => s.zz);
    const ys = stations.map((s) => Y(s.z, s.ground)).concat(stations.map((s) => SY(s.ground)));
    const x0 = Math.min(...xs); const x1 = Math.max(...xs); const z0 = Math.min(...zs); const z1 = Math.max(...zs);
    const y0 = Math.min(...ys); const y1 = Math.max(...ys);
    const cx = (x0 + x1) / 2; const cz = (z0 + z1) / 2; const cy = (y0 + y1) / 2;
    const sx = Math.max(800, x1 - x0); const sz = Math.max(800, z1 - z0); const syy = Math.max(200, y1 - y0);
    const asp = camera.aspect || 1.6;
    if (kind === 'side') {
      const alongX = sx >= sz;                                 // entlang der längeren Achse ansehen
      const w = alongX ? sx : sz;
      const dist = (Math.max(w / asp, syy * 1.4) / (2 * TAN)) * 1.12;
      fly(alongX ? [cx, cy, cz + (z1 - z0) / 2 + dist] : [cx + (x1 - x0) / 2 + dist, cy, cz], [cx, cy, cz]);
    } else if (kind === 'top') {
      const h = (Math.max(sx / asp, sz) / (2 * TAN)) * 1.15;
      fly([cx, Math.max(y1, 0) + h, cz + 0.1], [cx, cy, cz]);
    } else {
      const dist = (Math.max(sx / asp, sz, syy) / (2 * TAN)) * 1.25;
      fly([cx - dist * 0.35, cy + dist * 0.7, cz + dist * 0.62], [cx, cy, cz]);
    }
    return true;
  };

  api.current = { fly, focus, frame };
  // Prüfhaken für Szenario-Skripte: Kamera, Ziel, Bildlage des gewählten Bahnhofs
  window.__cam = () => {
    const o = { p: camera.position.toArray(), t: controls?.target.toArray() };
    if (selected) {
      const y = Y(selected.z, selected.ground); const v = new THREE.Vector3(selected.x, y, selected.zz).project(camera);
      Object.assign(o, { y, sy: SY(selected.ground), ndc: [v.x, v.y, v.z] });
    }
    return o;
  };

  // Überhöhung/Höhensystem gewechselt → gewählten Bahnhof im Bild halten
  useEffect(() => {
    if (!selected) { anchor.current = null; return; }
    const y = Y(selected.z, selected.ground); const sy = SY(selected.ground);
    const a = anchor.current;
    anchor.current = { id: selected.id, y, sy, exag };
    if (!a || a.id !== selected.id || !controls || (a.y === y && a.sy === sy)) return;
    const r = exag / (a.exag || exag);
    const below = camera.position.y < a.sy;                   // Kamera war im Untergrund
    const k = below ? r : 1;
    anim.current = null;
    let cy = y + (camera.position.y - a.y) * k;
    if (below) cy = Math.min(cy, sy - 4); else cy = Math.max(cy, sy + 60);
    camera.position.y = cy;
    controls.target.y = y + (controls.target.y - a.y) * k;
    controls.update();
  }, [Y, SY, exag, selected, controls, camera]);

  useFrame(() => {
    const a = anim.current;
    if (!a || !controls) return;
    const t = Math.min(1, (performance.now() - a.t0) / a.ms);
    const k = t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
    camera.position.lerpVectors(a.p0, a.p1, k);
    controls.target.lerpVectors(a.q0, a.q1, k);
    controls.update();
    if (t >= 1) anim.current = null;
  });
  return null;
}

const Scene = forwardRef(function Scene(props, ref) {
  const { data, view, Y, SY, opts, focusLine, selected, hoverId, labelItems, onHover, onPick, onUserCamera, extent, bg } = props;
  const overlay = useRef();
  const rig = useRef(null);

  const views = useMemo(() => {
    const { x0, x1, z0, z1 } = extent;
    const cx = (x0 + x1) / 2; const cz = (z0 + z1) / 2; const k = Math.max(x1 - x0, z1 - z0) / 470;
    const ty = -8 * opts.exag;
    return {
      iso: [[cx - 120 * k, 120 * k, cz + 200 * k], [cx, ty, cz + 10 * k]],
      top: [[cx, 560 * k, cz + 0.1], [cx, 0, cz]],
      below: [[cx - 160 * k, -300 * k, cz + 230 * k], [cx, ty, cz]],
    };
  }, [extent, opts.exag]);

  useImperativeHandle(ref, () => ({
    // Seite: Rahmung der fokussierten Linie bzw. aller sichtbaren Bahnhöfe
    view(v, stations) {
      if (v === 'side') { rig.current?.frame(stations?.length ? stations : view.stations, 'side'); return; }
      const [p, t] = views[v]; rig.current?.fly(p, t);
    },
    focus(s) { rig.current?.focus(s); },
    frame(stations, kind) { return rig.current?.frame(stations, kind); },
  }), [views, view]);

  // Startansicht nur einmal setzen: ein neues target-Array bei jeder Überhöhung würde das Kameraziel zurücksetzen
  const [p0, t0] = useRef(views.iso).current;

  return (
    <div className="scene">
      <Canvas
        camera={{ position: p0, fov: 42, near: 20, far: 400000 }}
        dpr={[1, 2]}
        gl={{ antialias: true, logarithmicDepthBuffer: true }}
        onPointerMissed={(e) => { if (e.type === 'click') onPick(null); }}
      >
        <color attach="background" args={[bg]} />
        <hemisphereLight args={['#ffffff', '#445060', 1.6]} />
        <directionalLight position={[-20000, 40000, 15000]} intensity={1.4} />
        <directionalLight position={[15000, -30000, -10000]} intensity={0.5} />
        <Surface extent={extent} kind={opts.surface} opacity={opts.surfOp} depthBottom={(opts.mode === 'abs' ? 15 - 35 : -25) * opts.exag} />
        <Guides extent={extent} mode={opts.mode} exag={opts.exag} showGrid={opts.grid} showLevels={opts.levels} />
        {opts.mode === 'abs' && opts.grid && <SurfaceTraces sections={data.sections} visible={view.sectionVisible} SY={SY} />}
        {opts.shafts && <Shafts stations={view.stations} Y={Y} SY={SY} />}
        <Tubes sections={data.sections} visible={view.sectionVisible} Y={Y} colorMode={opts.color} focusLine={focusLine} onHover={onHover} onPick={onPick} />
        <Stations stations={view.stations} Y={Y} colorMode={opts.color} focusLine={focusLine} selectedId={selected?.id} hoverId={hoverId} onHover={onHover} onPick={onPick} />
        {opts.transfers && <Transfers pairs={view.transfers} byId={view.byId} Y={Y} />}
        <Labels items={labelItems} overlay={overlay} />
        <CameraRig api={rig} Y={Y} SY={SY} exag={opts.exag} selected={selected} />
        <OrbitControls makeDefault target={t0} enableDamping dampingFactor={0.08} minDistance={300} maxDistance={150000} onStart={onUserCamera} />
      </Canvas>
      <div className="labels" ref={overlay} />
    </div>
  );
});

export default Scene;
