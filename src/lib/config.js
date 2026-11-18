// Цвета линий и диапазон лет — как в 2D-приложении (berlinmetro/src/lib/config.js)
export const LINES = [
  { id: 'U1', color: '#52B447' },
  { id: 'U2', color: '#FF3300' },
  { id: 'U3', color: '#15AC99' },
  { id: 'U4', color: '#FFCD00' },
  { id: 'U5', color: '#7D533D' },
  { id: 'U6', color: '#8070B7' },
  { id: 'U7', color: '#0B9ADA' },
  { id: 'U8', color: '#055A99' },
  { id: 'U9', color: '#FF7300' },
];
export const LINE_COLOR = Object.fromEntries(LINES.map((l) => [l.id, l.color]));

export const START_YEAR = 1900;
export const END_YEAR = new Date().getFullYear();

// 3D
export const TUBE_RADIUS = 22;      // м (в сцене толще реального тоннеля ≈3,5 м, чтобы было видно)
export const STATION_RADIUS = 38;   // м
export const DEFAULT_EXAG = 5;      // вертикальное преувеличение
