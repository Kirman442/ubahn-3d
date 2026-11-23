# U-Bahn in der Tiefe – 3D

Die U-Bahn-Netze von **Berlin, Hamburg, München und Nürnberg/Fürth** als 3D-Modell unter dem Stadtgrundriss:
Tiefe der Bahnhöfe, Trassen mit Geländeverlauf, Geschichte per Jahresregler, Strecken im Bau.

**Live:** https://gis.krmn.app/ubahn-3d/

- Röhren nach Linie oder Tiefe gefärbt, Überhöhung 1–200×, Tiefe unter Gelände oder Höhe ü. NHN
- Bahnhofs- und Linienkarten mit Längsprofil (Gelände und Modelltrasse)
- Jahresregler: Eröffnungen, Umbenennungen, Geisterbahnhöfe, Unterbrechungen
- Schematische Stadtfläche (Wasser, Grün, Hauptstraßen, Bahn) als three.js-Geometrie, helles und dunkles Design

Das Höhenmodell ist vereinfacht: gemessene Tiefen gibt es nur für einen Teil der Bahnhöfe, der Rest ist geschätzt
(Details im «i» der App).

## Entwicklung

```
npm install
npm run dev        # http://localhost:5174/
npm run build      # dist/ für https://gis.krmn.app/ubahn-3d/
```

React 18, @react-three/fiber 8, three.js 0.169, Vite 6. Stadtwahl über den Hash (`#hamburg`, `#muenchen`, `#nuernberg`).

### Daten

`public/data/<stadt>/` (Berlin direkt in `public/data/`): `network3d.json` (Trassen, Bahnhöfe, Baustellen),
`stations.geojson` (Geschichte, Namen), `basemap.json` (Stadtfläche). Erzeugt aus den Datenpaketen je Stadt mit:

```
node scripts/city_hamburg.mjs   <Pfad zu ubahn-data/Hamburg>
node scripts/city_muenchen.mjs  <Pfad zu ubahn-data/München>
node scripts/city_nuernberg.mjs <Pfad zu ubahn-data/Nürnberg>
node scripts/basemap3d.mjs <stadt> <Pfad zu basemap3d.geojson>
```

### Veröffentlichung

Jeder Push auf `main` baut die App mit GitHub Actions und veröffentlicht sie auf GitHub Pages
(`.github/workflows/deploy.yml`; in den Repository-Einstellungen: *Pages → Source: GitHub Actions*).

## Lizenzen

**Code:** MIT, siehe [LICENSE](LICENSE).

**Daten** in `public/data/` stehen nicht unter MIT, sondern unter den Lizenzen ihrer Quellen:

| Inhalt | Quelle | Lizenz |
|---|---|---|
| Lage von Strecken und Bahnhöfen, Stadtfläche | © OpenStreetMap-Mitwirkende | [ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/) |
| Geschichte, Tiefenangaben | Wikipedia | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) |
| Geschichte (teilweise) | Wikidata | CC0 |
| Gelände Berlin | DGM1 © Geoportal Berlin | dl-de/zero-2-0 |
| Gelände Hamburg | DGM1 © Freie und Hansestadt Hamburg, LGV | dl-de/by-2-0 |
| Gelände München, Nürnberg | DGM1 © Bayerische Vermessungsverwaltung, geodaten.bayern.de | CC BY 4.0 |
| Gelände außerhalb Hamburgs | EU-DEM, Copernicus | Copernicus-Datenlizenz |

Die aufbereiteten Daten (Tiefenmodell, Trassen) sind abgeleitete Datenbanken der genannten Quellen; bei Weitergabe
gelten deren Bedingungen (Namensnennung, bei ODbL und CC BY-SA Weitergabe unter gleichen Bedingungen).
