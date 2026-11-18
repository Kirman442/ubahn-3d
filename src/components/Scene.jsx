import { forwardRef, useImperativeHandle, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Html } from '@react-three/drei';
import Ground from './Ground';
import { Tubes, Stations } from './Network';
import Labels from './Labels';
import { StationPopup, SectionPopup } from './Popups';

export const HOME = { pos: [2200, 5200, 10500], target: [0, 0, 0] };

const Scene = forwardRef(function Scene(props, ref) {
  const { sections, sectionVisible, stations, labelItems, exag, opacity, labels, groundStyle, bg, iso, selected, setSelected, stationById } = props;
  const controls = useRef();
  const overlay = useRef();

  useImperativeHandle(ref, () => ({
    reset() {
      const c = controls.current;
      if (!c) return;
      c.object.position.set(...HOME.pos);
      c.target.set(...HOME.target);
      c.update();
    },
  }));

  let popup = null;
  if (selected?.type === 'station' && stationById[selected.id]) {
    const s = stationById[selected.id];
    popup = (
      <Html position={[s.x, s.z * exag, s.zz]} zIndexRange={[30, 20]} wrapperClass="popup-anchor">
        <div className="popup-box"><StationPopup station={s} iso={iso} onClose={() => setSelected(null)} /></div>
      </Html>
    );
  } else if (selected?.type === 'section') {
    const sec = sections[selected.index];
    popup = (
      <Html position={selected.point} zIndexRange={[30, 20]} wrapperClass="popup-anchor">
        <div className="popup-box"><SectionPopup section={sec} onClose={() => setSelected(null)} /></div>
      </Html>
    );
  }

  return (
    <div className="scene">
      <Canvas
        camera={{ position: HOME.pos, fov: 45, near: 10, far: 400000 }}
        dpr={[1, 2]}
        gl={{ antialias: true, logarithmicDepthBuffer: true }}
        onPointerMissed={() => setSelected(null)}
      >
        <color attach="background" args={[bg]} />
        <hemisphereLight args={['#ffffff', '#8a8a80', 1.1]} />
        <directionalLight position={[8000, 15000, 6000]} intensity={1.6} />
        <Ground style={groundStyle} opacity={opacity} />
        <Tubes sections={sections} exag={exag} visible={sectionVisible} onPick={setSelected} />
        <Stations stations={stations} exag={exag} onPick={setSelected} selectedId={selected?.type === 'station' ? selected.id : null} />
        <Labels items={labelItems} overlay={overlay} exag={exag} enabled={labels} />
        {popup}
        <OrbitControls ref={controls} makeDefault target={HOME.target} enableDamping dampingFactor={0.12}
          minDistance={150} maxDistance={90000} maxPolarAngle={Math.PI * 0.98} zoomToCursor />
      </Canvas>
      <div className="labels" ref={overlay} />
    </div>
  );
});

export default Scene;
