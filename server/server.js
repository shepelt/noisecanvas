/**
 * NoiseCanvas Server
 *
 * Hybrid Express + Vite server with MCP integration
 *
 * Development mode:
 *   - Vite middleware with HMR for fast frontend iteration
 *   - Express API routes for REST endpoints
 *
 * Production mode:
 *   - Serve built static files from dist/
 *   - Express API routes
 *
 * Architecture is Electron-ready:
 *   - Service layer is transport-agnostic
 *   - Can swap Express routes for Electron IPC without changing business logic
 */

import express from 'express';
import { createServer as createViteServer } from 'vite';
import { PatternService } from './services/PatternService.js';
import { SamplerService } from './services/SamplerService.js';
import { createAPIRouter } from './routes/api.js';

const isDev = process.env.NODE_ENV !== 'production';
const PORT = process.env.PORT || 3000;

async function startServer() {
  const app = express();

  // Middleware
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Initialize services (transport-agnostic business logic)
  const services = {
    pattern: new PatternService(),
    sampler: new SamplerService(),
  };

  console.log('[NoiseCanvas] Initializing services...');
  console.log(`[NoiseCanvas] Mode: ${isDev ? 'Development' : 'Production'}`);

  // Serve data directory (samples) in both dev and prod - BEFORE Vite
  app.use('/data', express.static('data'));

  // API routes (thin HTTP wrapper around services) - BEFORE Vite
  console.log('[NoiseCanvas] Registering API routes...');
  app.use('/api', createAPIRouter(services));

  // Development: Vite middleware with HMR (after API routes so API takes precedence)
  if (isDev) {
    console.log('[NoiseCanvas] Starting Vite dev server...');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: {
          port: 24679  // Use different port to avoid conflicts
        }
      },
      appType: 'spa',
    });

    // Vite middlewares will handle everything that wasn't handled by API routes
    app.use(vite.middlewares);
    console.log('[NoiseCanvas] Vite middleware enabled (HMR active)');
  }

  // Production: Serve built files
  if (!isDev) {
    console.log('[NoiseCanvas] Serving static files from dist/');
    app.use(express.static('dist'));
  }

  // Health check
  app.get('/health', (req, res) => {
    res.json({
      success: true,
      status: 'ok',
      mode: isDev ? 'development' : 'production',
      timestamp: Date.now(),
    });
  });

  // Start HTTP server
  app.listen(PORT, () => {
    console.log('');
    console.log('='.repeat(50));
    console.log('🎵 NoiseCanvas Server Running');
    console.log('='.repeat(50));
    console.log(`📡 HTTP:  http://localhost:${PORT}`);
    console.log(`🔧 Mode:  ${isDev ? 'Development (HMR enabled)' : 'Production'}`);
    console.log(`🎹 API:   http://localhost:${PORT}/api`);
    console.log('='.repeat(50));
    console.log('');
    console.log('Available API endpoints:');
    console.log('  POST /api/play-notes       - Play a sequence of notes');
    console.log('  GET  /api/samples          - List all samples');
    console.log('  GET  /api/samples/:id      - Get sample info');
    console.log('  POST /api/validate-pattern - Validate pattern samples');
    console.log('  GET  /api/health           - Health check');
    console.log('');
    console.log('💡 MCP Server: Run separately with "npm run mcp"');
    console.log('');
  });
}

// Start server
startServer().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
