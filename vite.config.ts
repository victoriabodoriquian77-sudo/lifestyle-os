import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // Rutas relativas: funciona en local y en GitHub Pages bajo /lifestyle-os/.
  base: './',
  plugins: [react()],
  resolve: { alias: { '@': decodeURIComponent(new URL('./src', import.meta.url).pathname) } },
  server: { port: 5180, host: '127.0.0.1' },
  preview: { port: 4180, host: '127.0.0.1' },
  build: { outDir: 'dist', sourcemap: false, chunkSizeWarningLimit: 1200 },
});
