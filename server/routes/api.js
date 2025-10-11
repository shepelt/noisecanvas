/**
 * Express API Routes
 *
 * Thin wrapper layer between HTTP requests and business logic services.
 * This layer is replaceable (e.g., with Electron IPC) without changing services.
 */

import express from 'express';

/**
 * Convert musical BPM (quarter notes per minute) to tempo (rows per minute)
 *
 * In musical notation: BPM = quarter notes per minute
 * In tracker format: 4 rows = 1 beat (16th note resolution)
 * Therefore: tempo = musical BPM × 4
 *
 * @param {number} musicalBpm - Musical BPM (quarter notes per minute)
 * @returns {number} Tempo (rows per minute)
 */
function musicalBpmToTempo(musicalBpm) {
  const ROWS_PER_BEAT = 4;  // 16th note resolution
  return musicalBpm * ROWS_PER_BEAT;
}

/**
 * Create API router with service dependencies
 *
 * @param {object} services - Service instances
 * @param {PatternService} services.pattern - Pattern service
 * @param {SamplerService} services.sampler - Sampler service
 * @returns {express.Router} Express router
 */
export function createAPIRouter(services) {
  const router = express.Router();

  /**
   * POST /api/play-notes
   *
   * Play a sequence of notes
   *
   * Body:
   *   - notes: string[] - Array of note names
   *   - bpm: number (optional) - Beats per minute
   *   - instrument: string (optional) - Sample name
   *   - octave: number (optional) - Octave
   *   - volume: number (optional) - Volume 0-64
   */
  router.post('/play-notes', async (req, res) => {
    try {
      const { notes, bpm, instrument, octave, volume } = req.body;

      // Validate notes parameter
      if (!notes || !Array.isArray(notes)) {
        return res.status(400).json({
          success: false,
          error: 'notes parameter must be an array'
        });
      }

      // Convert musical BPM to tempo (API accepts musical BPM)
      const tempo = bpm ? musicalBpmToTempo(bpm) : undefined;

      // Call service layer
      const result = await services.pattern.playNotes(notes, {
        bpm: tempo,
        instrument,
        octave,
        volume
      });

      res.json(result);
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * POST /api/play-pattern
   *
   * Play a tracker-style pattern with multi-channel support
   *
   * Body:
   *   - rows: Array<Array<object>> - Pattern rows (each row can have multiple simultaneous notes)
   *   - bpm: number (optional) - Beats per minute
   *   - speed: number (optional) - Ticks per row
   *   - repeat: number (optional) - Number of repeats
   */
  router.post('/play-pattern', async (req, res) => {
    try {
      const { rows, bpm, speed, repeat } = req.body;

      // Validate rows parameter
      if (!rows || !Array.isArray(rows)) {
        return res.status(400).json({
          success: false,
          error: 'rows parameter must be an array'
        });
      }

      // Convert musical BPM to tempo (API accepts musical BPM)
      const musicalBpm = bpm || 120;
      const tempo = musicalBpmToTempo(musicalBpm);

      // Add to pending plays queue
      const playId = `pattern_${Date.now()}`;
      const playData = {
        playId,
        pattern: rows,  // rows is already in the correct multi-channel format
        bpm: tempo,
        speed: speed || 6,
        repeat: repeat || 1,
        startTime: Date.now(),
      };

      services.pattern.pendingPlays.push(playData);

      res.json({
        success: true,
        playId,
        pattern: rows,
        bpm: musicalBpm,  // Return the musical BPM to user
        speed: playData.speed,
        repeat: playData.repeat,
        message: `Playing pattern with ${rows.length} rows at ${musicalBpm} BPM`
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * GET /api/samples
   *
   * Get all available samples
   */
  router.get('/samples', (req, res) => {
    try {
      const samples = services.sampler.getAllSamples();
      res.json({
        success: true,
        samples
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * GET /api/samples/:id
   *
   * Get specific sample metadata
   */
  router.get('/samples/:id', (req, res) => {
    try {
      const sample = services.sampler.getSample(req.params.id);

      if (!sample) {
        return res.status(404).json({
          success: false,
          error: `Sample not found: ${req.params.id}`
        });
      }

      res.json({
        success: true,
        sample
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * POST /api/validate-pattern
   *
   * Validate that all samples in a pattern exist
   *
   * Body:
   *   - pattern: Array - Pattern data
   */
  router.post('/validate-pattern', (req, res) => {
    try {
      const { pattern } = req.body;

      if (!pattern || !Array.isArray(pattern)) {
        return res.status(400).json({
          success: false,
          error: 'pattern parameter must be an array'
        });
      }

      const validation = services.sampler.validatePattern(pattern);

      res.json({
        success: true,
        ...validation
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * GET /api/pending-plays
   *
   * Get pending plays (for browser polling)
   * Returns and clears the pending plays queue
   */
  router.get('/pending-plays', (req, res) => {
    try {
      const pendingPlays = services.pattern.getPendingPlays();
      res.json({
        success: true,
        plays: pendingPlays,
        count: pendingPlays.length
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * GET /api/health
   *
   * Health check endpoint
   */
  router.get('/health', (req, res) => {
    res.json({
      success: true,
      status: 'ok',
      timestamp: Date.now()
    });
  });

  return router;
}
