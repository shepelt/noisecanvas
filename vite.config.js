import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  root: './web',  // Web Audio files are in /web directory
  server: {
    port: 3000,
    strictPort: true,  // Fail if port 3000 is not available
    open: '/sampler-web.test.html',  // Auto-open test page
    fs: {
      // Allow serving files from data directory
      allow: ['..']
    }
  },
  resolve: {
    alias: {
      '@data': path.resolve(__dirname, './data')
    }
  },
  build: {
    outDir: '../dist',  // Build output
    emptyOutDir: true
  }
});
