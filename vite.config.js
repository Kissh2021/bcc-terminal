import { defineConfig } from 'vite';

export default defineConfig({
  base: '/',
  server: {
    port: 5173,
    strictPort: true,
    host: 'localhost',
  },
  build: {
    outDir: 'dist',
  },
  envPrefix: 'VITE_',
});
