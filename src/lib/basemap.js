import { layers, namedFlavor } from '@protomaps/basemaps';

// Та же подложка, что в 2D: berlin.pmtiles + шрифты из ../berlinmetro/public (отдаёт vite.config.js)
const BASE = window.location.origin;
export const TILES_URL = `${BASE}/tiles/berlin.pmtiles`;

const POSITRON = {
  ...namedFlavor('light'),
  background: '#f2f3f0', earth: '#f2f3f0',
  park_a: '#e6e9e5', park_b: '#e6e9e5', wood_a: '#e6e9e5', wood_b: '#e6e9e5', scrub_a: '#eceee9', scrub_b: '#eceee9',
  hospital: '#eceeea', industrial: '#eceeea', school: '#eceeea', zoo: '#e6e9e5', military: '#eceeea',
  aerodrome: '#eceeea', pedestrian: '#f7f7f5', sand: '#efefea', beach: '#efefea', glacier: '#ffffff', pier: '#f2f3f0',
  water: '#c2c8ca', buildings: '#e4e4df', railway: '#d8d8d8', boundaries: '#c8c8c8',
  landcover: {
    barren: '#f2f3f0', farmland: '#eeefeb', forest: '#e6e9e5', glacier: '#ffffff',
    grassland: '#e9ece6', scrub: '#eceee9', urban_area: '#f2f3f0',
  },
  pois: undefined,
};
const DARK = { ...namedFlavor('dark'), pois: undefined };

export const BASEMAPS = [
  { id: 'positron', label: 'Hell', flavor: POSITRON, dark: false, bg: '#dfe1dc' },
  { id: 'dark', label: 'Dunkel', flavor: DARK, dark: true, bg: '#15171a' },
];

export function basemapStyle(b) {
  return {
    version: 8,
    glyphs: `${BASE}/fonts/{fontstack}/{range}.pbf`,
    sources: { protomaps: { type: 'vector', url: `pmtiles://${TILES_URL}` } },
    layers: layers('protomaps', b.flavor, { lang: 'de' }),
  };
}
