import { defineConfig } from 'vite';

export default defineConfig(({ mode }) => ({
  base: './',
  server: { hmr: mode !== 'test' },
  build: {
    rollupOptions: { output: { manualChunks: { phaser: ['phaser'] } } },
    // Phaser intentionally ships as one engine chunk; the total is below the 5 MB budget.
    chunkSizeWarningLimit: 1500,
  },
}));
