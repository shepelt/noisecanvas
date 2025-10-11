/**
 * SamplerService: Sample metadata and configuration management
 *
 * Server-side service for managing sample information.
 * Actual audio playback happens on the client (web browser) side.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class SamplerService {
  constructor(options = {}) {
    // Available samples registry
    this.samples = new Map();

    // Initialize with default samples
    this.registerDefaultSamples();
  }

  /**
   * Register default samples available in the project
   * Loads from manifest.json to avoid hardcoding paths
   */
  registerDefaultSamples() {
    try {
      const manifestPath = path.join(__dirname, '../../data/samples/manifest.json');
      const manifestData = fs.readFileSync(manifestPath, 'utf-8');
      const manifest = JSON.parse(manifestData);

      // Load all samples from all collections
      for (const [collectionName, samples] of Object.entries(manifest)) {
        for (const [sampleId, sampleInfo] of Object.entries(samples)) {
          this.registerSample(sampleId, {
            name: sampleId,
            displayName: sampleInfo.displayName,
            path: sampleInfo.path,
            baseNote: sampleInfo.baseNote,
            type: sampleInfo.type,
            loopStart: 0,
            loopLength: 0
          });
        }
      }

      console.log(`[SamplerService] Loaded ${this.samples.size} samples from manifest`);
    } catch (error) {
      console.error('[SamplerService] Failed to load manifest:', error.message);
      // Fallback to hardcoded samples if manifest fails
      this.registerFallbackSamples();
    }
  }

  /**
   * Fallback: Register minimal samples if manifest loading fails
   */
  registerFallbackSamples() {
    console.log('[SamplerService] Using fallback: registering minimal samples');

    // ST-01 Steinway Piano
    this.registerSample('ST-01', {
      name: 'ST-01',
      displayName: 'ST-01 Steinway Piano',
      path: '/data/samples/st-01/Steinway.wav',
      baseNote: 'C-2',
      type: 'piano',
      loopStart: 0,
      loopLength: 0
    });

    // 808 Basic Drums
    this.registerSample('808-KICK', {
      name: '808-KICK',
      displayName: '808 Kick Drum',
      path: '/data/samples/808/kick.wav',
      baseNote: 'C-2',
      type: 'drum',
      loopStart: 0,
      loopLength: 0
    });

    this.registerSample('808-SNARE', {
      name: '808-SNARE',
      displayName: '808 Snare',
      path: '/data/samples/808/snare.wav',
      baseNote: 'C-2',
      type: 'drum',
      loopStart: 0,
      loopLength: 0
    });

    this.registerSample('808-HIHAT-CLOSED', {
      name: '808-HIHAT-CLOSED',
      displayName: '808 Closed Hi-Hat',
      path: '/data/samples/808/hihat-closed.wav',
      baseNote: 'C-2',
      type: 'drum',
      loopStart: 0,
      loopLength: 0
    });

    this.registerSample('808-HIHAT-OPEN', {
      name: '808-HIHAT-OPEN',
      displayName: '808 Open Hi-Hat',
      path: '/data/samples/808/hihat-open.wav',
      baseNote: 'C-2',
      type: 'drum',
      loopStart: 0,
      loopLength: 0
    });
  }

  /**
   * Register a sample with metadata
   *
   * @param {string} id - Sample identifier
   * @param {object} metadata - Sample metadata
   */
  registerSample(id, metadata) {
    this.samples.set(id, metadata);
  }

  /**
   * Get sample metadata
   *
   * @param {string} id - Sample identifier
   * @returns {object|null} Sample metadata or null if not found
   */
  getSample(id) {
    return this.samples.get(id) || null;
  }

  /**
   * Get all available samples
   *
   * @returns {Array} Array of sample metadata
   */
  getAllSamples() {
    return Array.from(this.samples.values());
  }

  /**
   * Check if sample exists
   *
   * @param {string} id - Sample identifier
   * @returns {boolean} True if sample exists
   */
  hasSample(id) {
    return this.samples.has(id);
  }

  /**
   * Validate that all samples in a pattern exist
   *
   * @param {Array} pattern - Pattern array with sample references
   * @returns {object} Validation result { valid: boolean, missingSamples: [] }
   */
  validatePattern(pattern) {
    const missingSamples = new Set();

    pattern.forEach(step => {
      if (step && step.sample && !this.hasSample(step.sample)) {
        missingSamples.add(step.sample);
      }
    });

    return {
      valid: missingSamples.size === 0,
      missingSamples: Array.from(missingSamples)
    };
  }
}
