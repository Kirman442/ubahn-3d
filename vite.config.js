import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Bibliotheken in eigene Dateien: ändern sich selten und bleiben bei neuen App-Versionen im Browser-Cache
const vendor = (id) => {
  if (!id.includes('node_modules')) return undefined;
  if (/[\\/]node_modules[\\/]three[\\/]/.test(id)) return 'three';
  if (/[\\/]node_modules[\\/](@react-three|three-stdlib|camera-controls|maath|troika)/.test(id)) return 'r3f';
  if (/[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/.test(id)) return 'react';
  return 'vendor';
};

// Veröffentlichung auf GitHub Pages unter https://gis.krmn.app/ubahn-3d/ – lokal bleibt die Wurzel '/'
export default defineConfig(({ command, isPreview }) => ({
  plugins: [react()],
  base: command === 'build' || isPreview ? '/ubahn-3d/' : '/',
  server: { port: 5174, strictPort: false },
  build: { rollupOptions: { output: { manualChunks: vendor } }, chunkSizeWarningLimit: 750 },
}));
