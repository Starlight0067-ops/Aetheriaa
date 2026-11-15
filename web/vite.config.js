import { defineConfig } from 'vite';

export default defineConfig({
  // Relative base so dist/ works from any folder or subpath (and from file:// for the single-file build).
  base: './',
  server: { host: '127.0.0.1', port: 5173, strictPort: true },
  build: { target: 'es2022', chunkSizeWarningLimit: 6000, assetsInlineLimit: 0 },
});
