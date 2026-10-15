import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';

export default defineConfig({
  plugins: [preact()],
  base: './',
  build: {
    target: 'es2022',
    sourcemap: true,
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/three')) return 'three';
          if (id.includes('node_modules/preact')) return 'preact';
          return undefined;
        },
      },
    },
  },
  // AFH_NO_HMR=1 keeps pages from reloading while tools capture screenshots during parallel edits.
  server: { port: 5199, strictPort: true, hmr: process.env.AFH_NO_HMR ? false : undefined },
  preview: { port: 5198, strictPort: true },
});
