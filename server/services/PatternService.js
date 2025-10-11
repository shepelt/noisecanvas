/**
 * PatternService: Core business logic for pattern playback
 *
 * This service is completely independent of Express/HTTP transport
 * and can be used with any interface (REST API, IPC, MCP, direct calls)
 */

export class PatternService {
  constructor(options = {}) {
    this.activePlays = new Map(); // Track active pattern playbacks
    this.pendingPlays = []; // Queue of plays waiting to be consumed by clients
    this.enableLogging = options.enableLogging !== false; // Enable logging by default

    // TEST: Start broadcasting C-D-E every 3 seconds (only if testBroadcast enabled)
    if (options.testBroadcast) {
      this.startTestBroadcast();
    }
  }

  /**
   * TEST: Broadcast C-D-E pattern every 3 seconds
   */
  startTestBroadcast() {
    setInterval(() => {
      if (this.enableLogging) {
        console.log('[PatternService] TEST: Broadcasting C-D-E');
      }
      this.pendingPlays.push({
        playId: `test_${Date.now()}`,
        pattern: [
          { sample: 'ST-01', note: 'C-4', volume: 64 },
          { sample: 'ST-01', note: 'D-4', volume: 64 },
          { sample: 'ST-01', note: 'E-4', volume: 64 }
        ],
        bpm: 120,
        notes: ['C', 'D', 'E'],
        startTime: Date.now()
      });
    }, 3000); // Every 3 seconds
  }

  /**
   * Play a sequence of notes
   *
   * @param {Array<string|object>} notes - Array of note names or note objects
   *   - String format: 'C', 'D-4', etc.
   *   - Object format: { note: 'C', instrument: 'ST-01', volume: 64 }
   * @param {object} options - Playback options (defaults for notes without specific values)
   * @param {number} options.bpm - Tempo in rows per minute (internal timing)
   * @param {string} options.instrument - Default sample name (default: 'ST-01')
   * @param {number} options.octave - Default octave number (default: 4)
   * @param {number} options.volume - Default volume 0-64 (default: 64)
   * @returns {object} Result with status and pattern details
   */
  async playNotes(notes, options = {}) {
    if (this.enableLogging) {
      console.log('[PatternService] ⭐ playNotes called:', { notes, options });
    }

    const tempo = options.bpm || 480; // Default: 120 BPM × 4 = 480 rows/min
    const defaultInstrument = options.instrument || 'ST-01';
    const defaultOctave = options.octave || 4;
    const defaultVolume = options.volume || 64;

    // Validate input
    if (!Array.isArray(notes) || notes.length === 0) {
      throw new Error('notes must be a non-empty array');
    }

    // Convert note names to pattern format
    // Pattern format: [{ sample, note, volume }]
    // Support both string notes and object notes with per-note instrument/volume
    const pattern = notes.map(noteInput => {
      let noteName, instrument, volume;

      if (typeof noteInput === 'string') {
        // Simple string note - use defaults
        noteName = noteInput;
        instrument = defaultInstrument;
        volume = defaultVolume;
      } else if (typeof noteInput === 'object' && noteInput.note) {
        // Object note with optional instrument/volume override
        noteName = noteInput.note;
        instrument = noteInput.instrument || defaultInstrument;
        volume = noteInput.volume !== undefined ? noteInput.volume : defaultVolume;
      } else {
        throw new Error('Each note must be a string or object with "note" property');
      }

      return {
        sample: instrument,
        note: this.formatNote(noteName, defaultOctave),
        volume: volume
      };
    });

    const playId = `play_${Date.now()}`;

    const playData = {
      playId,
      pattern,
      tempo,
      notes,
      startTime: Date.now(),
    };

    // Store pattern info (for tracking/cancellation)
    this.activePlays.set(playId, playData);

    // Add to pending queue for clients to poll
    this.pendingPlays.push(playData);
    if (this.enableLogging) {
      console.log('[PatternService] ✅ Added to pending queue. Queue length:', this.pendingPlays.length);
    }

    // Return pattern that can be sent to client
    return {
      success: true,
      playId,
      pattern,
      tempo,
      notes,
      message: `Playing notes: ${notes.join(', ')} at ${tempo} rows/min`
    };
  }

  /**
   * Format note name with octave
   *
   * @param {string} noteName - Note name (C, D, E, etc.) or full note (C-4)
   * @param {number} defaultOctave - Default octave if not in noteName
   * @returns {string} Formatted note (e.g., 'C-4')
   */
  formatNote(noteName, defaultOctave = 4) {
    // If note already has octave (e.g., 'C-4' or 'C#5'), return as-is
    if (noteName.match(/^[A-G]#?[-]?\d$/)) {
      // Normalize format to use dash (C4 → C-4)
      return noteName.replace(/^([A-G]#?)(\d)$/, '$1-$2');
    }

    // Otherwise append default octave
    return `${noteName}-${defaultOctave}`;
  }

  /**
   * Get information about an active play
   *
   * @param {string} playId - Play ID
   * @returns {object|null} Play information or null if not found
   */
  getPlay(playId) {
    return this.activePlays.get(playId) || null;
  }

  /**
   * Stop and remove a play
   *
   * @param {string} playId - Play ID
   * @returns {boolean} True if play was found and removed
   */
  stopPlay(playId) {
    return this.activePlays.delete(playId);
  }

  /**
   * Clear all plays
   */
  clearAll() {
    this.activePlays.clear();
  }

  /**
   * Get and clear pending plays (for polling)
   * @returns {Array} Array of pending play data
   */
  getPendingPlays() {
    const pending = [...this.pendingPlays];
    this.pendingPlays = [];
    return pending;
  }
}
