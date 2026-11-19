import { useEffect, useRef } from 'react';

// Alle Hinweise zum Modell an einem Ort statt verstreuter Vorbehalte
export default function ModelInfo({ exag, onClose }) {
  const ref = useRef(null);
  useEffect(() => { ref.current?.focus(); }, []);
  return (
    <section className="info-pop" aria-labelledby="info-ttl">
      <button type="button" className="close" onClick={onClose} aria-label="Hinweise schließen">×</button>
      <h2 id="info-ttl" tabIndex={-1} ref={ref}>Über das Modell</h2>
      <ul>
        <li><b>Vereinfachtes Höhenmodell.</b> Lage aus OpenStreetMap, Höhen {exag}-fach vergrößert; alle Meterangaben sind unverändert.</li>
        <li><b>Tiefe</b> = Höhenlage des Bahnhofs gegenüber dem lokalen Geländeniveau (DGM1 Berlin, geglättet). Ob Bahnsteig, Schiene oder Bauwerk gemeint ist, ist in den Quellen nicht einheitlich.</li>
        <li><b>Zahlen ohne ≈</b> stammen aus einer Quelle (Wikipedia). <b>≈</b> heißt «ca.»/«rund» in der Quelle, abgeleitet oder Modellschätzung (OSM-Ebene bzw. Bauart). Details unter «Quelle» in der Bahnhofskarte.</li>
        <li><b>Schematisch:</b> Röhren und Bahnsteige sind Symbole, nicht maßstäblich. Senkrechte Linien zeigen keine echten Zugänge; Umstiege verbinden Bahnhöfe unter 300 m Abstand, keine vermessenen Gänge.</li>
        <li><b>Längsprofil:</b> längste durchgehende Strecke einer Linie, Trasse interpoliert und geglättet. Kreis = Quellenangabe, Quadrat = abgeleitet, hohler Kreis = Modellschätzung.</li>
        <li><b>Kennzahlen</b> gelten für das ganze Netz zum Jahresende; km = Summe je Linie (gemeinsame Abschnitte doppelt).</li>
        <li><b>Bedienung:</b> ziehen = drehen · Rechtsklick/zwei Finger = verschieben · Rad/Spreizen = zoomen · Esc = zurück.</li>
      </ul>
      <p className="src-line">Gelände: DGM1 © Geoportal Berlin (dl-de/zero-2-0) · Tiefen: Wikipedia (CC BY-SA 4.0) · Karte: OpenStreetMap-Mitwirkende</p>
    </section>
  );
}
