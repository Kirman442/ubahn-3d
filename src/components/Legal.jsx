import { useEffect, useRef } from 'react';
import { CITIES } from '../lib/city';

// Impressum und Datenschutz als modales Fenster mit Umschalter. Inhalt passt zur App, wie sie gebaut ist:
// statische Seite, keine Cookies, kein Tracking, keine Drittanbieter-Schriften/-Skripte; localStorage nur für Einstellungen.
// Anschrift (§ 5 DDG) auf Wunsch vorerst weggelassen; bei Bedarf in ANSCHRIFT eintragen.
const NAME = 'Kirill Lisochenko';
const ANSCHRIFT = null; // z. B. ['Musterstraße 1', '12345 Musterstadt']
const MAIL = 'k.lisochenko@web.de';
const STAND = 'November 2026';

const Addr = () => (
  <p>{NAME}<br />
    {ANSCHRIFT && ANSCHRIFT.map((l) => <span key={l}>{l}<br /></span>)}
    Deutschland</p>
);
const Mail = () => <a href={`mailto:${MAIL}`}>{MAIL}</a>;

function Impressum() {
  const quellen = [...new Set(CITIES.filter((c) => c.ready).flatMap((c) => c.attribution.split(' · ')))];
  return (
    <>
      <h3>Angaben gemäß § 5 DDG</h3>
      <Addr />
      <h3>Kontakt</h3>
      <p>E-Mail: <Mail /></p>
      <h3>Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV</h3>
      <p>{NAME}, Anschrift wie oben.</p>
      <h3>Hinweis zum Projekt</h3>
      <p>Privates, nicht kommerzielles Projekt. Die Darstellung ist ein vereinfachtes Modell: Lage, Tiefen und Geländehöhen
        stammen aus offenen Quellen oder sind geschätzt (siehe «i» in der App) und ersetzen keine amtlichen Planunterlagen.</p>
      <h3>Haftung für Inhalte</h3>
      <p>Die Inhalte wurden mit Sorgfalt erstellt. Für Richtigkeit, Vollständigkeit und Aktualität wird keine Gewähr übernommen.
        Als Diensteanbieter bin ich nach den allgemeinen Gesetzen für eigene Inhalte verantwortlich. Bei Bekanntwerden von
        Rechtsverletzungen werden die betreffenden Inhalte umgehend entfernt.</p>
      <h3>Haftung für Links</h3>
      <p>Die App verlinkt auf Seiten Dritter (z. B. Wikipedia), auf deren Inhalte ich keinen Einfluss habe. Für diese Inhalte
        ist der jeweilige Anbieter verantwortlich. Zum Zeitpunkt der Verlinkung waren keine Rechtsverstöße erkennbar; bei
        Bekanntwerden werden solche Links entfernt.</p>
      <h3>Quellen und Lizenzen</h3>
      <ul>{quellen.map((q) => <li key={q}>{q}</li>)}</ul>
      <p>Oberfläche (Wasser, Grün, Straßen, Bahnstrecken) nach Daten der OpenStreetMap-Mitwirkenden (ODbL). Eigene Aufbereitung
        und Darstellung © {NAME}; die Rechte an den Quelldaten bleiben bei den jeweiligen Rechteinhabern.</p>
    </>
  );
}

function Datenschutz() {
  return (
    <>
      <h3>1. Verantwortlicher</h3>
      <Addr />
      <p>E-Mail: <Mail /></p>
      <h3>2. Kurz gesagt</h3>
      <p>Die App ist eine statische Webseite. Es gibt kein Benutzerkonto, kein Kontaktformular, keine Cookies, keine
        Analyse- oder Trackingdienste und keine Werbung. Alle Netz- und Kartendaten werden vom selben Server geladen wie die
        App selbst; es werden keine Schriftarten, Skripte oder Karten von Drittanbietern eingebunden.</p>
      <h3>3. Hosting und Server-Logdateien</h3>
      <p>Die App wird über GitHub Pages bereitgestellt (GitHub B.V., Prins Bernhardplein 200, 1097 JB Amsterdam, Niederlande;
        Muttergesellschaft GitHub, Inc., USA). Beim Aufruf verarbeitet der Hoster technisch notwendige Daten, die Ihr Browser
        übermittelt: IP-Adresse, Datum und Uhrzeit, aufgerufene Datei, übertragene Datenmenge, Referrer und Browserkennung.
        Das dient der Auslieferung und Sicherheit der Seite (Art. 6 Abs. 1 lit. f DSGVO, berechtigtes Interesse an einem
        sicheren und stabilen Betrieb). Ich habe selbst keinen Zugriff auf diese Logdateien.</p>
      <p>Eine Verarbeitung in den USA ist möglich. GitHub ist nach dem EU-US Data Privacy Framework zertifiziert, für das ein
        Angemessenheitsbeschluss der EU-Kommission besteht (Art. 45 DSGVO). Näheres in der{' '}
        <a href="https://docs.github.com/de/site-policy/privacy-policies/github-general-privacy-statement" target="_blank" rel="noopener noreferrer">Datenschutzerklärung von GitHub</a>.</p>
      <h3>4. Speicherung im Browser</h3>
      <p>Die App merkt sich Ihre Einstellungen im lokalen Speicher Ihres Browsers (localStorage): Farbschema
        (<code>ubahn3d.theme</code>), Stil der Szene (<code>ubahn3d.style</code>) und ob «Darstellung» geöffnet ist
        (<code>ubahn3d.darst</code>). Diese Werte bleiben auf Ihrem Gerät und werden nicht übertragen. Die Speicherung ist für
        die von Ihnen gewünschte Funktion erforderlich (§ 25 Abs. 2 Nr. 2 TDDDG). Sie können sie jederzeit in den
        Browsereinstellungen löschen.</p>
      <h3>5. Links zu anderen Seiten</h3>
      <p>Links, etwa zu Wikipedia, öffnen sich erst auf Ihren Klick. Danach gilt die Datenschutzerklärung des jeweiligen
        Anbieters (bei Wikipedia: Wikimedia Foundation).</p>
      <h3>6. Kontakt per E-Mail</h3>
      <p>Wenn Sie mir schreiben, verarbeite ich Ihre Angaben nur, um Ihre Anfrage zu beantworten (Art. 6 Abs. 1 lit. f DSGVO),
        und lösche sie, sobald sie dafür nicht mehr nötig sind.</p>
      <h3>7. Ihre Rechte</h3>
      <p>Sie haben das Recht auf Auskunft (Art. 15 DSGVO), Berichtigung (Art. 16), Löschung (Art. 17), Einschränkung der
        Verarbeitung (Art. 18), Datenübertragbarkeit (Art. 20) und Widerspruch gegen Verarbeitungen nach Art. 6 Abs. 1 lit. f
        (Art. 21). Außerdem können Sie sich bei einer Datenschutz-Aufsichtsbehörde beschweren (Art. 77 DSGVO), insbesondere
        in dem Bundesland, in dem Sie wohnen.</p>
      <p className="muted">Stand: {STAND}</p>
    </>
  );
}

const PAGES = [['impressum', 'Impressum', Impressum], ['datenschutz', 'Datenschutz', Datenschutz]];

export default function Legal({ page, setPage, onClose }) {
  const box = useRef(null); const head = useRef(null);
  useEffect(() => { head.current?.focus(); box.current?.scrollTo?.(0, 0); }, [page]);
  // Fokus im Fenster halten (Tab/Shift+Tab)
  const trap = (e) => {
    if (e.key !== 'Tab' || !box.current) return;
    const f = [...box.current.querySelectorAll('button, a[href], [tabindex="0"]')];
    if (!f.length) return;
    const first = f[0]; const last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); } else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  };
  const [, title, Body] = PAGES.find(([id]) => id === page) || PAGES[0];
  return (
    <div className="legal-back" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <section className="legal" role="dialog" aria-modal="true" aria-labelledby="legal-ttl" ref={box} onKeyDown={trap}>
        <div className="legal-top">
          <div className="seg legal-tabs" role="tablist" aria-label="Rechtliches">
            {PAGES.map(([id, t]) => (
              <button key={id} type="button" role="tab" aria-selected={page === id} className={page === id ? 'on' : ''} onClick={() => setPage(id)}>{t}</button>
            ))}
          </div>
          <button type="button" className="close" onClick={onClose} aria-label="Schließen">×</button>
        </div>
        <h2 id="legal-ttl" tabIndex={-1} ref={head}>{title}</h2>
        <div className="legal-body"><Body /></div>
      </section>
    </div>
  );
}

export function LegalLinks({ open, className = '' }) {
  return (
    <nav className={`legal-links ${className}`} aria-label="Rechtliches">
      <button type="button" className="linkbtn" onClick={(e) => open('impressum', e.currentTarget)}>Impressum</button>
      <span aria-hidden="true">·</span>
      <button type="button" className="linkbtn" onClick={(e) => open('datenschutz', e.currentTarget)}>Datenschutz</button>
    </nav>
  );
}
