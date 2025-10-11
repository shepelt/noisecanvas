/**
 * Integration tests for API routes
 *
 * Tests the full API flow including BPM to tempo conversion
 */

import { PatternService } from '../services/PatternService.js';
import { SamplerService } from '../services/SamplerService.js';
import { createAPIRouter } from './api.js';
import express from 'express';

// Helper to make requests to the API
async function makeRequest(app, method, path, body = null) {
  return new Promise((resolve, reject) => {
    const req = {
      method,
      url: path,
      body,
      params: {},
      headers: {}
    };

    const res = {
      statusCode: 200,
      data: null,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(data) {
        this.data = data;
        resolve({ status: this.statusCode, data: this.data });
      }
    };

    // Extract route params
    const routes = app._router.stack.filter(r => r.route);
    const route = routes.find(r => {
      const pathRegex = new RegExp('^' + r.route.path.replace(/:\w+/g, '([^/]+)') + '$');
      return pathRegex.test(path);
    });

    if (route) {
      const pathRegex = new RegExp('^' + route.route.path.replace(/:\w+/g, '([^/]+)') + '$');
      const matches = path.match(pathRegex);
      if (matches) {
        const paramNames = (route.route.path.match(/:\w+/g) || []).map(p => p.slice(1));
        paramNames.forEach((name, i) => {
          req.params[name] = matches[i + 1];
        });
      }
    }

    // Find and execute handler
    const handler = route?.route.stack[0].handle;
    if (handler) {
      handler(req, res).catch(reject);
    } else {
      reject(new Error(`No handler found for ${method} ${path}`));
    }
  });
}

describe('API Routes Integration', () => {
  let services;
  let app;

  beforeEach(() => {
    // Create services
    services = {
      pattern: new PatternService({ enableLogging: false }),
      sampler: new SamplerService()
    };

    // Create Express app with API router
    app = express();
    app.use(express.json());
    app.use('/api', createAPIRouter(services));
  });

  describe('POST /api/play-notes', () => {
    test('should convert musical BPM to tempo (120 → 480)', async () => {
      const { status, data } = await makeRequest(app, 'POST', '/api/play-notes', {
        notes: ['C', 'D', 'E'],
        bpm: 120
      });

      expect(status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.tempo).toBe(480); // 120 × 4
      expect(data.message).toContain('480 rows/min');
    });

    test('should convert musical BPM to tempo (240 → 960)', async () => {
      const { status, data } = await makeRequest(app, 'POST', '/api/play-notes', {
        notes: ['C', 'E', 'G'],
        bpm: 240
      });

      expect(status).toBe(200);
      expect(data.tempo).toBe(960); // 240 × 4
    });

    test('should use default tempo when BPM not provided', async () => {
      const { status, data } = await makeRequest(app, 'POST', '/api/play-notes', {
        notes: ['C']
      });

      expect(status).toBe(200);
      expect(data.tempo).toBe(480); // Default: 120 BPM × 4
    });

    test('should add play to pending queue', async () => {
      await makeRequest(app, 'POST', '/api/play-notes', {
        notes: ['C', 'D', 'E'],
        bpm: 180
      });

      expect(services.pattern.pendingPlays).toHaveLength(1);
      expect(services.pattern.pendingPlays[0].tempo).toBe(720); // 180 × 4
    });

    test('should return error for invalid notes parameter', async () => {
      const { status, data } = await makeRequest(app, 'POST', '/api/play-notes', {
        notes: 'not-an-array'
      });

      expect(status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain('notes parameter must be an array');
    });
  });

  describe('POST /api/play-pattern', () => {
    test('should convert musical BPM to tempo and return musical BPM', async () => {
      const { status, data } = await makeRequest(app, 'POST', '/api/play-pattern', {
        rows: [
          [{ sample: '808-KICK', note: 'C-2' }],
          [{ sample: '808-SNARE', note: 'C-2' }]
        ],
        bpm: 140
      });

      expect(status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.bpm).toBe(140); // Returns musical BPM to user
      expect(data.message).toContain('140 BPM');
    });

    test('should add pattern to pending queue with tempo', async () => {
      await makeRequest(app, 'POST', '/api/play-pattern', {
        rows: [
          [{ sample: '808-KICK', note: 'C-2' }]
        ],
        bpm: 180
      });

      expect(services.pattern.pendingPlays).toHaveLength(1);
      expect(services.pattern.pendingPlays[0].bpm).toBe(720); // Internal tempo: 180 × 4
    });

    test('should use default BPM when not provided', async () => {
      const { status, data } = await makeRequest(app, 'POST', '/api/play-pattern', {
        rows: [
          [{ sample: '808-KICK', note: 'C-2' }]
        ]
      });

      expect(status).toBe(200);
      expect(data.bpm).toBe(120); // Default musical BPM
    });

    test('should return error for invalid rows parameter', async () => {
      const { status, data } = await makeRequest(app, 'POST', '/api/play-pattern', {
        rows: 'not-an-array'
      });

      expect(status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain('rows parameter must be an array');
    });
  });

  describe('GET /api/samples', () => {
    test('should return list of available samples', async () => {
      const { status, data } = await makeRequest(app, 'GET', '/api/samples');

      expect(status).toBe(200);
      expect(data.success).toBe(true);
      expect(Array.isArray(data.samples)).toBe(true);
      expect(data.samples.length).toBeGreaterThan(0);
    });

    test('should include sample metadata', async () => {
      const { status, data } = await makeRequest(app, 'GET', '/api/samples');

      const steinway = data.samples.find(s => s.name === 'ST-01');
      expect(steinway).toBeDefined();
      expect(steinway.displayName).toBe('ST-01 Steinway Piano');
      expect(steinway.baseNote).toBe('C-2');
    });
  });

  describe('GET /api/samples/:id', () => {
    test('should return specific sample metadata', async () => {
      const { status, data } = await makeRequest(app, 'GET', '/api/samples/ST-01');

      expect(status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.sample.name).toBe('ST-01');
      expect(data.sample.displayName).toBe('ST-01 Steinway Piano');
    });

    test('should return 404 for non-existent sample', async () => {
      const { status, data } = await makeRequest(app, 'GET', '/api/samples/DOES-NOT-EXIST');

      expect(status).toBe(404);
      expect(data.success).toBe(false);
      expect(data.error).toContain('Sample not found');
    });
  });

  describe('POST /api/validate-pattern', () => {
    test('should validate pattern with existing samples', async () => {
      const { status, data } = await makeRequest(app, 'POST', '/api/validate-pattern', {
        pattern: [
          { sample: 'ST-01' },
          { sample: '808-KICK' }
        ]
      });

      expect(status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.valid).toBe(true);
      expect(data.missingSamples).toEqual([]);
    });

    test('should detect missing samples', async () => {
      const { status, data } = await makeRequest(app, 'POST', '/api/validate-pattern', {
        pattern: [
          { sample: 'ST-01' },
          { sample: 'DOES-NOT-EXIST' }
        ]
      });

      expect(status).toBe(200);
      expect(data.valid).toBe(false);
      expect(data.missingSamples).toContain('DOES-NOT-EXIST');
    });
  });

  describe('GET /api/pending-plays', () => {
    test('should return and clear pending plays', async () => {
      // Add some plays
      await makeRequest(app, 'POST', '/api/play-notes', {
        notes: ['C'],
        bpm: 120
      });
      await makeRequest(app, 'POST', '/api/play-notes', {
        notes: ['D'],
        bpm: 180
      });

      // Get pending plays
      const { status, data } = await makeRequest(app, 'GET', '/api/pending-plays');

      expect(status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.count).toBe(2);
      expect(data.plays).toHaveLength(2);
      expect(data.plays[0].tempo).toBe(480); // 120 × 4
      expect(data.plays[1].tempo).toBe(720); // 180 × 4

      // Queue should be cleared
      const { data: data2 } = await makeRequest(app, 'GET', '/api/pending-plays');
      expect(data2.count).toBe(0);
    });
  });

  describe('GET /api/health', () => {
    test('should return health status', async () => {
      const { status, data } = await makeRequest(app, 'GET', '/api/health');

      expect(status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.status).toBe('ok');
      expect(typeof data.timestamp).toBe('number');
    });
  });
});

// Run tests if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('Running API integration tests...\n');

  // Simple test runner
  const runTests = async () => {
    const tests = [
      {
        name: 'BPM to Tempo Conversion (120 → 480)',
        run: async () => {
          const services = {
            pattern: new PatternService({ enableLogging: false }),
            sampler: new SamplerService()
          };
          const app = express();
          app.use(express.json());
          app.use('/api', createAPIRouter(services));

          const result = await makeRequest(app, 'POST', '/api/play-notes', {
            notes: ['C', 'D', 'E'],
            bpm: 120
          });

          if (result.data.tempo !== 480) {
            throw new Error(`Expected tempo 480, got ${result.data.tempo}`);
          }
        }
      },
      {
        name: 'BPM to Tempo Conversion (240 → 960)',
        run: async () => {
          const services = {
            pattern: new PatternService({ enableLogging: false }),
            sampler: new SamplerService()
          };
          const app = express();
          app.use(express.json());
          app.use('/api', createAPIRouter(services));

          const result = await makeRequest(app, 'POST', '/api/play-notes', {
            notes: ['C', 'E', 'G'],
            bpm: 240
          });

          if (result.data.tempo !== 960) {
            throw new Error(`Expected tempo 960, got ${result.data.tempo}`);
          }
        }
      },
      {
        name: 'Pending plays have tempo field',
        run: async () => {
          const services = {
            pattern: new PatternService({ enableLogging: false }),
            sampler: new SamplerService()
          };
          const app = express();
          app.use(express.json());
          app.use('/api', createAPIRouter(services));

          await makeRequest(app, 'POST', '/api/play-notes', {
            notes: ['C'],
            bpm: 150
          });

          const result = await makeRequest(app, 'GET', '/api/pending-plays');

          if (!result.data.plays[0].tempo) {
            throw new Error('Pending play missing tempo field');
          }
          if (result.data.plays[0].tempo !== 600) {
            throw new Error(`Expected tempo 600, got ${result.data.plays[0].tempo}`);
          }
        }
      }
    ];

    let passed = 0;
    let failed = 0;

    for (const test of tests) {
      try {
        await test.run();
        console.log(`✓ ${test.name}`);
        passed++;
      } catch (error) {
        console.log(`✗ ${test.name}`);
        console.log(`  ${error.message}`);
        failed++;
      }
    }

    console.log(`\n${passed} passed, ${failed} failed`);
    process.exit(failed > 0 ? 1 : 0);
  };

  runTests().catch(error => {
    console.error('Test runner error:', error);
    process.exit(1);
  });
}
