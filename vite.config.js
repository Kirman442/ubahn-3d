import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import path from 'node:path';

// Подложку и шрифты не копируем: берём из соседнего 2D-приложения (../berlinmetro/public).
// pmtiles читает файл кусками (HTTP Range), поэтому отдаём с поддержкой Range.
const SHARED = path.resolve(__dirname, '../berlinmetro/public');

function sharedAssets() {
  const serve = (req, res, next) => {
    const url = decodeURIComponent((req.url || '').split('?')[0]);
    if (!url.startsWith('/tiles/') && !url.startsWith('/fonts/')) return next();
    const file = path.join(SHARED, url);
    if (!file.startsWith(SHARED) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
      res.statusCode = 404; return res.end();
    }
    const size = fs.statSync(file).size;
    const type = file.endsWith('.pbf') ? 'application/x-protobuf' : 'application/octet-stream';
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Content-Type', type);
    const m = /bytes=(\d*)-(\d*)/.exec(req.headers.range || '');
    if (m) {
      const start = m[1] ? Number(m[1]) : Math.max(0, size - Number(m[2]));
      const end = m[1] && m[2] ? Math.min(Number(m[2]), size - 1) : size - 1;
      res.statusCode = 206;
      res.setHeader('Content-Range', `bytes ${start}-${end}/${size}`);
      res.setHeader('Content-Length', end - start + 1);
      if (req.method === 'HEAD') return res.end();
      return fs.createReadStream(file, { start, end }).pipe(res);
    }
    res.setHeader('Content-Length', size);
    if (req.method === 'HEAD') return res.end();
    return fs.createReadStream(file).pipe(res);
  };
  return {
    name: 'shared-basemap',
    configureServer: (s) => { s.middlewares.use(serve); },
    configurePreviewServer: (s) => { s.middlewares.use(serve); },
  };
}

export default defineConfig({
  plugins: [react(), sharedAssets()],
  base: '/',
  server: { port: 5174, strictPort: false },
});
