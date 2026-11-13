import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath, URL } from 'node:url';
import packageJson from './package.json' with { type: 'json' };

export default defineConfig({
  base: './',
  define: {
    __SLEEVE_BUILD__: JSON.stringify({
      version: packageJson.version,
      commit: 'demo',
      dirty: false,
      buildDate: new Date().toISOString(),
    }),
  },
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5174,
    open: '/demo.html',
  },
  build: {
    outDir: 'docs/public/demo',
    emptyOutDir: true,
    rollupOptions: {
      input: fileURLToPath(new URL('./demo.html', import.meta.url)),
    },
  },
});
