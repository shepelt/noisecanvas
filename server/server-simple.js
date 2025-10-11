/**
 * NoiseCanvas Simple API Server (for development)
 *
 * This runs ONLY the API server on port 3001.
 * Run Vite separately on port 3000 with: npm run dev:vite
 *
 * This simpler architecture avoids middleware conflicts during development.
 */

import express from 'express';
import { PatternService } from './services/PatternService.js';
import { SamplerService } from './services/SamplerService.js';
import { createAPIRouter } from './routes/api.js';

const PORT = 3001;

async function startServer() {
  const app = express();

  // Middleware
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // CORS for development (allow Vite on port 3000 to access API on port 3001)
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
    next();
  });

  // Initialize services
  const services = {
    pattern: new PatternService({ testBroadcast: false }),
    sampler: new SamplerService(),
  };

  console.log('[NoiseCanvas API] Initializing services...');

  // Serve data directory (samples)
  app.use('/data', express.static('data'));

  // API routes
  app.use('/api', createAPIRouter(services));

  // Health check
  app.get('/health', (req, res) => {
    res.json({
      success: true,
      status: 'ok',
      mode: 'development-api-only',
      timestamp: Date.now(),
    });
  });

  // Start HTTP server
  app.listen(PORT, () => {
    console.log('');
    console.log('='.repeat(50));
    console.log('🎵 NoiseCanvas API Server Running');
    console.log('='.repeat(50));
    console.log(`📡 API:  http://localhost:${PORT}/api`);
    console.log('='.repeat(50));
    console.log('');
    console.log('Available API endpoints:');
    console.log('  POST /api/play-notes       - Play a sequence of notes');
    console.log('  GET  /api/samples          - List all samples');
    console.log('  GET  /api/samples/:id      - Get sample info');
    console.log('  POST /api/validate-pattern - Validate pattern samples');
    console.log('  GET  /api/health           - Health check');
    console.log('');
    console.log('💡 Run Vite frontend: npm run dev:vite');
    console.log('💡 Run MCP Server: npm run mcp');
    console.log('');
  });
}

// Start server
startServer().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
