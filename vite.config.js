import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    // Production builds drop every console.log + debugger statement.
    // The codebase has ~33 console.log call sites across the audio
    // analysis hot loops (BPM detection runs at 60 Hz, key detection
    // at 20 Hz — combined that's ~80 logs/sec on the main thread when
    // verbose). At dev time those are useful; in a packaged app they
    // burn devtools-console buffer + briefly stall the renderer.
    // Terser strips them at build time so dev gets the spam, prod
    // gets the silence. console.warn / console.error are kept since
    // they signal real problems users + the maintainer want to see.
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: ['log', 'debug', 'info'],
        drop_debugger: true,
      },
    },
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
