import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 3333,
    host: true
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets'
  }
});