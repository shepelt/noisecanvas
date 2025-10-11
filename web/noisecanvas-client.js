/**
 * NoiseCanvas Web Client
 *
 * Browser-side client for the NoiseCanvas API.
 * Handles audio playback using WebAudioSampler and communicates with the server API.
 *
 * This client is transport-agnostic and can be used by:
 * - MCP servers (Claude controlling music)
 * - Direct LLM integrations on the server
 * - Web UIs, CLIs, or any other controller
 *
 * Architecture:
 *   [Any Controller] → Server API → This Client → WebAudioSampler → Web Audio
 */

import WebAudioSampler from './sampler-web.js';

export class NoiseCanvasClient {
  constructor() {
    this.sampler = null;
    this.audioContext = null;
    this.isInitialized = false;
    this.pollInterval = null;
    this.lastPlayId = null;
  }

  /**
   * Initialize the audio system
   * Must be called from user interaction (browser autoplay policy)
   */
  async init() {
    if (this.isInitialized) {
      return;
    }

    // Create AudioContext and sampler
    this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    this.sampler = new WebAudioSampler(this.audioContext);

    // Load default samples
    await this.loadSamples();

    // Resume AudioContext (browser autoplay policy)
    await this.sampler.resume();

    this.isInitialized = true;

    console.log('[NoiseCanvas Client] Initialized and ready');
  }

  /**
   * Load samples from server
   */
  async loadSamples() {
    try {
      const response = await fetch('http://localhost:3001/api/samples');
      const data = await response.json();

      if (data.success) {
        // Load each sample
        for (const sample of data.samples) {
          console.log(`[NoiseCanvas Client] Loading sample: ${sample.name}`);

          // Use full URL to API server (with CORS enabled)
          const sampleUrl = `http://localhost:3001${sample.path}`;

          await this.sampler.loadSample(sample.name, sampleUrl, {
            baseNote: sample.baseNote,
            loopStart: sample.loopStart,
            loopLength: sample.loopLength,
          });
        }
        console.log(`[NoiseCanvas Client] Loaded ${data.samples.length} samples`);
      }
    } catch (error) {
      console.error('[NoiseCanvas Client] Failed to load samples:', error);
      throw error;
    }
  }

  /**
   * Play notes directly (for testing)
   *
   * @param {string[]} notes - Array of note names
   * @param {object} options - Playback options
   */
  async playNotes(notes, options = {}) {
    if (!this.isInitialized) {
      throw new Error('NoiseCanvas Client not initialized. Call init() first.');
    }

    const { bpm = 120, instrument = 'ST-01', volume = 64 } = options;

    // Convert notes to pattern format
    const pattern = notes.map(note => ({
      sample: instrument,
      note,
      volume,
    }));

    // Play using sampler
    this.sampler.playPattern(pattern, { bpm });

    return {
      success: true,
      notes,
      bpm,
      instrument,
    };
  }

  /**
   * Send a play request to the server
   * (For testing the full server → client flow)
   *
   * @param {string[]} notes - Array of note names
   * @param {object} options - Playback options
   */
  async requestPlayNotes(notes, options = {}) {
    try {
      const response = await fetch('http://localhost:3001/api/play-notes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          notes,
          ...options,
        }),
      });

      const result = await response.json();

      if (result.success) {
        // Play the pattern locally
        this.sampler.playPattern(result.pattern, { bpm: result.bpm });
      }

      return result;
    } catch (error) {
      console.error('[NoiseCanvas Client] Failed to request play:', error);
      throw error;
    }
  }

  /**
   * Start polling server for play commands
   * (Alternative to WebSocket for simpler architecture)
   */
  startPolling(intervalMs = 500) {
    if (this.pollInterval) {
      return; // Already polling
    }

    console.log('[NoiseCanvas Client] Starting polling for pending plays...');

    this.pollInterval = setInterval(async () => {
      try {
        // Poll for new play commands
        const response = await fetch('http://localhost:3001/api/pending-plays');
        const data = await response.json();

        if (data.success && data.plays && data.plays.length > 0) {
          console.log(`[NoiseCanvas Client] Received ${data.plays.length} pending play(s)`);

          // Play each pending pattern
          for (const play of data.plays) {
            // Log different message based on whether it's notes or pattern
            if (play.notes) {
              console.log(`[NoiseCanvas Client] Playing notes: ${play.notes.map(n => typeof n === 'string' ? n : n.note).join(', ')} at ${play.tempo} rows/min`);
            } else {
              console.log(`[NoiseCanvas Client] Playing pattern: ${play.pattern.length} rows at ${play.tempo} rows/min`);
            }

            // Pass through all playback options (tempo, speed, repeat)
            const options = {
              tempo: play.tempo,
              speed: play.speed,
              repeat: play.repeat
            };
            this.sampler.playPattern(play.pattern, options);
          }
        }
      } catch (error) {
        console.error('[NoiseCanvas Client] Poll error:', error);
      }
    }, intervalMs);
  }

  /**
   * Stop polling
   */
  stopPolling() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
      console.log('[NoiseCanvas Client] Stopped polling');
    }
  }

  /**
   * Cleanup
   */
  async destroy() {
    this.stopPolling();
    if (this.sampler) {
      await this.sampler.close();
    }
    this.isInitialized = false;
  }
}

// Export as default
export default NoiseCanvasClient;
