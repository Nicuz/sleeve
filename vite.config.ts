import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath, URL } from 'node:url';
import { getBuildInfo } from './shared/build-info.ts';

const buildInfo = getBuildInfo();

const buildInfoPlugin: Plugin = {
  name: 'sleeve-build-info',
  generateBundle() {
    this.emitFile({
      type: 'asset',
      fileName: 'build-info.json',
      source: `${JSON.stringify(buildInfo, null, 2)}\n`,
    });
  },
};

export default defineConfig({
  define: {
    __SLEEVE_BUILD__: JSON.stringify(buildInfo),
  },
  plugins: [react(), tailwindcss(), buildInfoPlugin],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
  build: {
    outDir: 'dist',
  },
});
