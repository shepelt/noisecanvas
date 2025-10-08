const fs = require('fs');
const Speaker = require('speaker');

class Sampler {
  constructor() {
    this.samples = new Map();
  }

  // Convert note name to semitones relative to base note
  // e.g., noteToSemitones('D-4', 'C-4') → 2 (D is 2 semitones above C)
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

  loadSample(name, filepath, options = {}) {
    const data = fs.readFileSync(filepath);
    const baseNote = options.baseNote || 'C-4';
    const loopStart = options.loopStart || 0;
    const loopLength = options.loopLength || 0;
    const c4speed = options.c4speed || null;  // S3M C4Speed
    
    this.samples.set(name, {
      data: data,
      baseNote: baseNote,
      c4speed: c4speed,  // Store for S3M pitch calculation
      loopStart: loopStart,
      loopLength: loopLength,
      hasLoop: loopLength > 2  // MOD standard: loop length > 2 means looping
    });
  }

  hasSample(name) {
    return this.samples.has(name);
  }

  getSample(name) {
    return this.samples.get(name);
  }

  play(name, callback) {
    const sample = this.samples.get(name);
    if (!sample) {
      throw new Error(`Sample '${name}' not found`);
    }

    const sampleData = sample.data;

    const speaker = new Speaker({
      channels: 2,
      bitDepth: 16,
      sampleRate: 44100
    });

    // Convert 8-bit signed PCM to 16-bit stereo
    const outputBuffer = Buffer.alloc(sampleData.length * 4);
    
    for (let i = 0; i < sampleData.length; i++) {
      const sample8bit = sampleData.readInt8(i);
      const sample16bit = sample8bit * 256;
      
      outputBuffer.writeInt16LE(sample16bit, i * 4);
      outputBuffer.writeInt16LE(sample16bit, i * 4 + 2);
    }

    speaker.write(outputBuffer);
    speaker.end();

    if (callback) {
      speaker.once('close', callback);
    }
  }

  playNotes(name, notes, optionsOrCallback, callback) {
    // Handle both (notes, callback) and (notes, options, callback)
    let options = {};
    let finalCallback = callback;
    
    if (typeof optionsOrCallback === 'function') {
      finalCallback = optionsOrCallback;
    } else if (typeof optionsOrCallback === 'object') {
      options = optionsOrCallback;
    }
    
    const sample = this.samples.get(name);
    if (!sample) {
      throw new Error(`Sample '${name}' not found`);
    }

    const sampleData = sample.data;
    const baseNote = sample.baseNote;

    const speaker = new Speaker({
      channels: 2,
      bitDepth: 16,
      sampleRate: 44100
    });

    const gap = options.gap || 0.05; // Default 0.05 seconds
    const buffers = [];

    for (const note of notes) {
      // Convert note to semitones if it's a string
      let semitone;
      if (typeof note === 'string') {
        semitone = this.noteToSemitones(note, baseNote);
      } else {
        semitone = note;
      }

      // Pitch shift: 2^(semitones/12)
      const pitchRatio = Math.pow(2, semitone / 12);
      
      // Resampling (simple nearest neighbor)
      const newLength = Math.floor(sampleData.length / pitchRatio);
      const noteBuffer = Buffer.alloc(newLength * 4);
      
      for (let i = 0; i < newLength; i++) {
        const sourceIndex = Math.floor(i * pitchRatio);
        if (sourceIndex < sampleData.length) {
          const sample8bit = sampleData.readInt8(sourceIndex);
          const sample16bit = sample8bit * 256;
          
          noteBuffer.writeInt16LE(sample16bit, i * 4);
          noteBuffer.writeInt16LE(sample16bit, i * 4 + 2);
        }
      }
      
      buffers.push(noteBuffer);
      
      // Add gap between notes
      const gapSamples = Math.floor(44100 * gap);
      const gapBuffer = Buffer.alloc(gapSamples * 4);
      buffers.push(gapBuffer);
    }

    // Concatenate all buffers
    const finalBuffer = Buffer.concat(buffers);
    
    speaker.write(finalBuffer);
    speaker.end();

    if (finalCallback) {
      speaker.once('close', finalCallback);
    }
  }

  // TASK-15: Sample-by-sample mixing architecture
  // Optimized approach that mixes on-demand without pre-rendering tick-buffers
  // Performance: 6x faster than old pre-render approach (7.69s vs 45.33s for distance.s3m)

  playPattern(pattern, optionsOrCallback, finalCallback) {
    // Handle both (pattern, callback) and (pattern, options, callback)
    let options = {};
    if (typeof optionsOrCallback === 'function') {
      finalCallback = optionsOrCallback;
    } else if (typeof optionsOrCallback === 'object') {
      options = optionsOrCallback;
    }

    // Validate required options
    if (!options.bpm) {
      throw new Error('bpm option is required');
    }

    // Setup timing
    const bpm = options.bpm;
    const speed = options.speed || 6;
    
    // Calculate tick duration from BPM
    // BPM = beats per minute
    // In tracker music: 1 row = 1 beat at default speed
    // Tick duration formula: (60 / BPM) / (24 / speed)
    const rowDuration = 60 / bpm;
    const tickDuration = rowDuration / speed;
    const samplesPerTick = Math.floor(44100 * tickDuration);

    const repeat = options.repeat || 1;

    // Determine number of channels
    let numChannels = 4;
    if (pattern.length > 0) {
      for (const row of pattern) {
        if (Array.isArray(row)) {
          numChannels = Math.max(numChannels, row.length);
        }
      }
    }

    // Calculate total output size
    const totalTicks = pattern.length * speed;
    const totalSamples = totalTicks * samplesPerTick;
    const outputBuffer = Buffer.alloc(totalSamples * 4); // stereo 16-bit

    // Initialize channel states
    const channelStates = Array(numChannels).fill(null).map(() => ({
      sample: null,
      sampleData: null,
      position: 0,
      pitchRatio: 1,
      volume: 64,
      pan: 128,
      hasLoop: false,
      loopStart: 0,
      loopEnd: 0,
      active: false,
      delayedNote: null,
      delayTicks: 0
    }));

    // Helper: Get one sample from channel at current position
    const getSampleFromChannel = (state) => {
      if (!state.active || !state.sampleData) return 0;

      const sourcePosition = state.position * state.pitchRatio;
      const sourceIndex = Math.floor(sourcePosition);

      // Handle looping
      let actualIndex = sourceIndex;
      if (state.hasLoop && sourceIndex >= state.loopEnd) {
        const loopLength = state.loopEnd - state.loopStart;
        if (loopLength > 0) {
          actualIndex = state.loopStart + ((sourceIndex - state.loopStart) % loopLength);
        } else {
          return 0;
        }
      } else if (sourceIndex >= state.sampleData.length) {
        return 0;
      }

      // Linear interpolation
      const fraction = sourcePosition - Math.floor(sourcePosition);
      let sample8bit;
      if (fraction > 0 && actualIndex + 1 < state.sampleData.length) {
        const sample1 = state.sampleData.readInt8(actualIndex);
        const sample2 = state.sampleData.readInt8(actualIndex + 1);
        sample8bit = sample1 + (sample2 - sample1) * fraction;
      } else if (actualIndex < state.sampleData.length) {
        sample8bit = state.sampleData.readInt8(actualIndex);
      } else {
        return 0;
      }

      return sample8bit;
    };

    // Helper: Advance channel position and check if sample ended
    const advanceChannel = (state) => {
      state.position++;

      const sourcePosition = state.position * state.pitchRatio;
      const sourceIndex = Math.floor(sourcePosition);

      // Check if we need to deactivate (only if not looping)
      if (!state.hasLoop && sourceIndex >= state.sampleData.length) {
        state.active = false;
      }
    };

    // Helper: Process tick events (note triggers, effects)
    const processTickEvents = (row, currentTick) => {
      const steps = Array.isArray(row) ? row : [row];

      for (let channelIndex = 0; channelIndex < numChannels; channelIndex++) {
        const step = steps[channelIndex];
        const state = channelStates[channelIndex];

        // At tick 0, process new notes or effects
        if (currentTick === 0 && step !== null && step !== undefined) {
          const sample = this.samples.get(step.sample);
          if (!sample) {
            throw new Error(`Sample '${step.sample}' not found`);
          }

          const baseNote = sample.baseNote;

          // Convert note to semitones
          let semitone;
          if (typeof step.note === 'string') {
            semitone = this.noteToSemitones(step.note, baseNote);
          } else {
            semitone = step.note || 0;
          }

          // Check for Note Delay effect (SDx)
          const delayTicks = (step.effect === 'SD' && step.effectParam) ? step.effectParam : 0;

          if (delayTicks > 0) {
            // Store note for delayed triggering
            state.delayedNote = {
              sample: step.sample,
              sampleData: sample.data,
              pitchRatio: Math.pow(2, semitone / 12),
              hasLoop: sample.hasLoop,
              loopStart: sample.loopStart,
              loopEnd: sample.loopStart + sample.loopLength,
              volume: step.volume !== undefined ? step.volume : 64,
              pan: step.pan !== undefined ? step.pan : 128
            };
            state.delayTicks = delayTicks;
          } else {
            // Immediate note trigger
            const isSameNote = state.active &&
                               state.sample === step.sample &&
                               state.pitchRatio === Math.pow(2, semitone / 12);

            if (!isSameNote) {
              // New note - reset channel state
              state.sample = step.sample;
              state.sampleData = sample.data;
              state.position = 0;
              state.pitchRatio = Math.pow(2, semitone / 12);
              state.hasLoop = sample.hasLoop;
              state.loopStart = sample.loopStart;
              state.loopEnd = sample.loopStart + sample.loopLength;
              state.active = true;
            }

            // Always update volume and pan
            state.volume = step.volume !== undefined ? step.volume : 64;
            state.pan = step.pan !== undefined ? step.pan : 128;
          }
        }

        // Check if delayed note should trigger on this tick
        if (state.delayedNote && state.delayTicks > 0) {
          state.delayTicks--;

          if (state.delayTicks === 0) {
            // Trigger delayed note
            state.sample = state.delayedNote.sample;
            state.sampleData = state.delayedNote.sampleData;
            state.position = 0;
            state.pitchRatio = state.delayedNote.pitchRatio;
            state.hasLoop = state.delayedNote.hasLoop;
            state.loopStart = state.delayedNote.loopStart;
            state.loopEnd = state.delayedNote.loopEnd;
            state.volume = state.delayedNote.volume;
            state.pan = state.delayedNote.pan;
            state.active = true;
            state.delayedNote = null;
          }
        }
      }
    };

    // Main mixing loop - sample-by-sample
    let currentRow = 0;
    let currentTick = 0;
    let tickSampleCounter = 0;
    let outputOffset = 0;

    while (currentRow < pattern.length) {
      // At start of each tick, process events
      if (tickSampleCounter === 0) {
        processTickEvents(pattern[currentRow], currentTick);
      }

      // Mix ONE sample from all active channels
      let leftMixed = 0;
      let rightMixed = 0;

      for (const state of channelStates) {
        if (!state.active) continue;

        const sample = getSampleFromChannel(state);
        const scaled = sample * 256 * (state.volume / 64);
        const leftGain = (255 - state.pan) / 255;
        const rightGain = state.pan / 255;

        leftMixed += scaled * leftGain;
        rightMixed += scaled * rightGain;

        advanceChannel(state);
      }

      // Scale and clamp to prevent clipping
      const scaleFactor = 0.6 / Math.sqrt(numChannels);
      leftMixed = Math.max(-32768, Math.min(32767, leftMixed * scaleFactor));
      rightMixed = Math.max(-32768, Math.min(32767, rightMixed * scaleFactor));

      // Write to output buffer
      outputBuffer.writeInt16LE(leftMixed, outputOffset);
      outputBuffer.writeInt16LE(rightMixed, outputOffset + 2);
      outputOffset += 4;

      // Advance timing
      tickSampleCounter++;
      if (tickSampleCounter >= samplesPerTick) {
        tickSampleCounter = 0;
        currentTick++;
        if (currentTick >= speed) {
          currentTick = 0;
          currentRow++;
        }
      }
    }

    // Handle repeats
    if (repeat === -1) {
      throw new Error('Infinite repeat not yet implemented for sample-by-sample mixing');
    }

    // For finite repeats, concatenate buffers
    let finalBuffer = outputBuffer;
    if (repeat > 1) {
      const allBuffers = [];
      for (let i = 0; i < repeat; i++) {
        allBuffers.push(outputBuffer);
      }
      finalBuffer = Buffer.concat(allBuffers);
    }

    // Send to speaker
    const speaker = new Speaker({
      channels: 2,
      bitDepth: 16,
      sampleRate: 44100
    });

    speaker.write(finalBuffer);
    speaker.end();

    if (finalCallback) {
      speaker.once('close', finalCallback);
    }
  }
}

module.exports = Sampler;
