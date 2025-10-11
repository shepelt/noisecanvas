/**
 * WebAudioSampler: Low-latency sample-based playback engine using Web Audio API
 * 
 * Migration from Node.js (node-speaker) to Web Audio for real-time performance:
 * - Node.js latency: ~3000ms (buffered output)
 * - Web Audio latency: 5-15ms (hardware audio output)
 * 
 * Core features:
 * - Sample loading from URLs (AudioBuffer)
 * - Pitch shifting via playbackRate
 * - Volume (0-64) and panning (0-255) support
 * - Pattern playback with precise BPM-based scheduling
 */

class WebAudioSampler {
  constructor(audioContext = null) {
    // Reuse existing AudioContext or create new one
    // (AudioContext is limited resource - better to reuse)
    this.ctx = audioContext || new (window.AudioContext || window.webkitAudioContext)();
    this.samples = new Map();
  }

  /**
   * Load sample from URL and decode to AudioBuffer
   * 
   * @param {string} name - Sample identifier
   * @param {string} url - URL to audio file (relative or absolute)
   * @param {object} options - Sample metadata
   * @param {string} options.baseNote - Reference pitch (e.g., 'C-4')
   * @param {number} options.loopStart - Loop start point in samples
   * @param {number} options.loopLength - Loop length in samples (>2 = looping)
   */
  async loadSample(name, url, options = {}) {
    try {
      // Fetch audio file
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch ${url}: ${response.statusText}`);
      }
      const arrayBuffer = await response.arrayBuffer();
      
      // Decode to AudioBuffer (works with WAV, MP3, OGG, etc.)
      const audioBuffer = await this.ctx.decodeAudioData(arrayBuffer);
      
      // Store with metadata
      this.samples.set(name, {
        buffer: audioBuffer,
        baseNote: options.baseNote || 'C-4',
        loopStart: options.loopStart || 0,
        loopLength: options.loopLength || 0,
        hasLoop: (options.loopLength || 0) > 2  // MOD standard: loop length > 2 means looping
      });
      
      return audioBuffer;
    } catch (error) {
      throw new Error(`Failed to load sample '${name}': ${error.message}`);
    }
  }

  /**
   * Convert note name to semitones relative to base note
   * (Identical logic to Node.js sampler.js)
   * 
   * @param {string} targetNote - Note to play (e.g., 'D-4', 'C#5')
   * @param {string} baseNote - Reference note (e.g., 'C-4')
   * @returns {number} Semitones difference (-12 to +12 = one octave)
   */
  noteToSemitones(targetNote, baseNote) {
    const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    
    // Parse note (e.g., "C-4" or "C#4")
    const parseNote = (note) => {
      const match = note.match(/^([A-G]#?)[-]?(\d)$/);
      if (!match) {
        throw new Error(`Invalid note format: ${note}. Use format like 'C-4' or 'C#4'`);
      }
      const noteName = match[1];
      const octave = parseInt(match[2]);
      const noteIndex = noteNames.indexOf(noteName);
      
      if (noteIndex === -1) {
        throw new Error(`Invalid note name: ${noteName}`);
      }
      
      // Calculate absolute semitone (C-0 = 0)
      return octave * 12 + noteIndex;
    };
    
    const targetSemitone = parseNote(targetNote);
    const baseSemitone = parseNote(baseNote);
    
    return targetSemitone - baseSemitone;
  }

  /**
   * Trigger a note with immediate playback (real-time performance)
   * 
   * Audio graph: BufferSource → GainNode → StereoPannerNode → Destination
   * 
   * @param {string} sampleName - Sample to play
   * @param {string} note - Target note (e.g., 'C-4')
   * @param {object} options - Playback options
   * @param {number} options.volume - Volume (0-64, default 64)
   * @param {number} options.pan - Panning (0-255, 128 = center)
   * @returns {AudioBufferSourceNode} Source node (for stopping if needed)
   */
  triggerNote(sampleName, note, options = {}) {
    const sample = this.samples.get(sampleName);
    if (!sample) {
      throw new Error(`Sample not found: ${sampleName}`);
    }
    
    // Calculate pitch shift ratio
    const semitones = this.noteToSemitones(note, sample.baseNote);
    const pitchRatio = Math.pow(2, semitones / 12);
    
    // Create audio graph nodes
    const source = this.ctx.createBufferSource();
    const gainNode = this.ctx.createGain();
    const panNode = this.ctx.createStereoPanner();
    
    source.buffer = sample.buffer;
    source.playbackRate.value = pitchRatio;
    
    // Volume: 0-64 → 0-1 (MOD/S3M volume scale)
    const volume = (options.volume !== undefined) ? options.volume : 64;
    gainNode.gain.value = volume / 64;
    
    // Pan: 0-255 → -1 to 1 (0 = left, 128 = center, 255 = right)
    const pan = (options.pan !== undefined) ? options.pan : 128;
    panNode.pan.value = (pan / 127.5) - 1;
    
    // Connect: source → gain → pan → destination
    source.connect(gainNode);
    gainNode.connect(panNode);
    panNode.connect(this.ctx.destination);
    
    // Loop handling (MOD/S3M style)
    if (sample.hasLoop) {
      source.loop = true;
      source.loopStart = sample.loopStart / sample.buffer.sampleRate;
      source.loopEnd = (sample.loopStart + sample.loopLength) / sample.buffer.sampleRate;
    }
    
    // Play immediately (real-time!)
    source.start(this.ctx.currentTime);
    
    return source; // Return for potential stopping
  }

  /**
   * Play a pattern with tempo-based timing
   * Uses Web Audio's precise scheduling (sample-accurate timing)
   *
   * @param {Array} pattern - Pattern data (array of rows)
   * @param {object} options - Playback options
   * @param {number} options.tempo - Tempo in rows per minute (default 480 = 120 BPM × 4)
   * @param {number} options.speed - Ticks per row (default 6)
   * @param {number} options.repeat - Number of repeats (default 1)
   */
  playPattern(pattern, options = {}) {
    const tempo = options.tempo || 480; // Default: 120 BPM × 4 = 480 rows/min
    const speed = options.speed || 6;
    const repeat = options.repeat || 1;

    // Calculate timing
    const rowDuration = 60 / tempo;  // Seconds per row
    const tickDuration = rowDuration / speed;  // Seconds per tick (for effects)
    
    let startTime = this.ctx.currentTime + 0.1; // Small offset for scheduling
    
    for (let rep = 0; rep < repeat; rep++) {
      pattern.forEach((row, rowIndex) => {
        const rowTime = startTime + (rowIndex * rowDuration);
        
        // Schedule notes in this row
        const steps = Array.isArray(row) ? row : [row];
        steps.forEach((step, channelIndex) => {
          if (step && step.sample) {
            // Check for Note Delay effect (delay in ticks)
            const delayTicks = (step.delay !== undefined) ? step.delay : 0;
            const delayTime = delayTicks * tickDuration;

            this.scheduleNote(step, rowTime + delayTime);
          }
        });
      });
      
      startTime += pattern.length * rowDuration;
    }
  }

  /**
   * Schedule a single note at a specific time
   * (Internal method for playPattern)
   */
  scheduleNote(note, time) {
    const sample = this.samples.get(note.sample);
    if (!sample) return;
    
    const semitones = this.noteToSemitones(note.note, sample.baseNote);
    const pitchRatio = Math.pow(2, semitones / 12);
    
    const source = this.ctx.createBufferSource();
    const gainNode = this.ctx.createGain();
    const panNode = this.ctx.createStereoPanner();
    
    source.buffer = sample.buffer;
    source.playbackRate.value = pitchRatio;
    
    const volume = (note.volume !== undefined) ? note.volume : 64;
    gainNode.gain.value = volume / 64;
    
    const pan = (note.pan !== undefined) ? note.pan : 128;
    panNode.pan.value = (pan / 127.5) - 1;
    
    source.connect(gainNode);
    gainNode.connect(panNode);
    panNode.connect(this.ctx.destination);
    
    // Loop handling
    if (sample.hasLoop) {
      source.loop = true;
      source.loopStart = sample.loopStart / sample.buffer.sampleRate;
      source.loopEnd = (sample.loopStart + sample.loopLength) / sample.buffer.sampleRate;
    }
    
    source.start(time); // Precise scheduling!
  }

  /**
   * Resume AudioContext if suspended (browser autoplay policy)
   * Must be called from user interaction (click, keypress, etc.)
   */
  async resume() {
    if (this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }
  }

  /**
   * Check if sample exists
   */
  hasSample(name) {
    return this.samples.has(name);
  }

  /**
   * Get sample metadata
   */
  getSample(name) {
    return this.samples.get(name);
  }

  /**
   * Get current latency (output device + processing)
   */
  getLatency() {
    return this.ctx.baseLatency + this.ctx.outputLatency;
  }

  /**
   * Close AudioContext (cleanup)
   */
  async close() {
    await this.ctx.close();
  }
}

// Export for ES modules
export default WebAudioSampler;

// Also export for Node.js environments (testing, etc.)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = WebAudioSampler;
}
