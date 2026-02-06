import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    headers: {
      // CSP that allows blob workers for BPM analyzer
      'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' blob:; style-src 'self' 'unsafe-inline'; media-src 'self' blob: data:; worker-src 'self' blob:; connect-src *",
    },
  },
  optimizeDeps: {
    include: ['tone', 'react', 'react-dom'],
  },
});
