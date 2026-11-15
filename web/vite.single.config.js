import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// Single-file HTML build: JS and CSS are inlined into dist-single/index.html (renamed to aetheria.html
// by the build:single script). Large runtime assets (GLB, textures, VRM) stay in dist-single/assets
// and are fetched relatively, so the page must be served over http (file:// cannot fetch them).
export default defineConfig({
  base: './',
  plugins: [viteSingleFile()],
  build: {
    outDir: 'dist-single',
    emptyOutDir: true,
    target: 'es2022',
    chunkSizeWarningLimit: 6000,
    assetsInlineLimit: 0,
    rollupOptions: { output: { inlineDynamicImports: true } },
  },
});
