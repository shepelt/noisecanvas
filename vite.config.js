import { defineConfig } from 'vite';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: './web',  // Web Audio files are in /web directory
  server: {
    port: 3000,
    strictPort: true,  // Fail if port 3000 is not available
    open: '/index.html',  // Auto-open index page
    fs: {
      // Allow serving files from parent directory
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
  },
  plugins: [
    {
      name: 'serve-data-directory',
      configureServer: (server) => {
        server.middlewares.use((req, res, next) => {
          // Serve files from /data directory
          if (req.url?.startsWith('/data/')) {
            const filePath = path.join(__dirname, req.url);

            if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
              // Set correct MIME type for WAV files
              if (filePath.endsWith('.wav')) {
                res.setHeader('Content-Type', 'audio/wav');
              }

              // Serve the file
              const stream = fs.createReadStream(filePath);
              stream.pipe(res);
              return;
            }
          }
          next();
        });
      }
    }
  ]
});
