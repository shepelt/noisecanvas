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

  playPattern(pattern, optionsOrCallback, callback) {
    // Handle both (pattern, callback) and (pattern, options, callback)
    let options = {};
    let finalCallback = callback;
    
    if (typeof optionsOrCallback === 'function') {
      finalCallback = optionsOrCallback;
    } else if (typeof optionsOrCallback === 'object') {
      options = optionsOrCallback;
    }

    // Calculate row duration from BPM
    // BPM = beats per minute
    // Each row = 1 beat
    // Duration per row = 60 / BPM seconds
    if (!options.bpm) {
      throw new Error('bpm option is required');
    }
    
    const rowDuration = 60 / options.bpm;
    const repeat = options.repeat || 1; // Default: play once
    
    // Determine number of channels from pattern
    // Find max channels used across all rows
    let numChannels = 4; // Default to 4 for MOD compatibility
    if (pattern.length > 0) {
      for (const row of pattern) {
        if (Array.isArray(row)) {
          numChannels = Math.max(numChannels, row.length);
        }
      }
    }
    
    // Build pattern buffers with channel state tracking
    const buildPatternBuffers = () => {
      const channelBuffers = Array(numChannels).fill(null).map(() => []);
      
      // Track state for each channel
      const channelStates = Array(numChannels).fill(null).map(() => ({
        sample: null,
        sampleData: null,
        position: 0,  // Current position in the sample
        pitchRatio: 1,
        volume: 64,
        pan: 128,
        hasLoop: false,
        loopStart: 0,
        loopEnd: 0,
        active: false
      }));
      
      // Calculate row duration in samples (bytes for stereo 16-bit)
      const rowDurationSamples = Math.floor(44100 * rowDuration);
      const rowDurationBytes = rowDurationSamples * 4; // stereo 16-bit
      
      for (const row of pattern) {
        const steps = Array.isArray(row) ? row : [row];
        
        for (let channelIndex = 0; channelIndex < numChannels; channelIndex++) {
          const step = steps[channelIndex];
          const state = channelStates[channelIndex];
          
          // Check if this is a new note or just a parameter change
          if (step !== null && step !== undefined) {
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

            // Check if this is the same note (just volume/pan change)
            const isSameNote = state.active && 
                               state.sample === step.sample && 
                               state.pitchRatio === Math.pow(2, semitone / 12);

            if (!isSameNote) {
              // New note - reset channel state
              state.sample = step.sample;
              state.sampleData = sample.data;
              state.position = 0;  // Start from beginning
              state.pitchRatio = Math.pow(2, semitone / 12);
              state.hasLoop = sample.hasLoop;
              state.loopStart = sample.loopStart;
              state.loopEnd = sample.loopStart + sample.loopLength;
              state.active = true;
            }
            
            // Always update volume and pan (even for same note)
            state.volume = step.volume !== undefined ? step.volume : 64;
            state.pan = step.pan !== undefined ? step.pan : 128;
          }
          
          // Create buffer for this row
          const rowBuffer = Buffer.alloc(rowDurationBytes);
          
          // Render current channel state into rowBuffer
          if (state.active && state.sampleData) {
            const volumeScale = state.volume / 64;
            const leftGain = (255 - state.pan) / 255;
            const rightGain = state.pan / 255;
            
            let bytesWritten = 0;
            while (bytesWritten < rowDurationBytes) {
              // Calculate source position with pitch shift
              const sourcePosition = state.position * state.pitchRatio;
              const sourceIndex = Math.floor(sourcePosition);
              
              // Handle looping
              let actualIndex = sourceIndex;
              if (state.hasLoop && sourceIndex >= state.loopEnd) {
                const loopLength = state.loopEnd - state.loopStart;
                if (loopLength > 0) {
                  actualIndex = state.loopStart + ((sourceIndex - state.loopStart) % loopLength);
                } else {
                  state.active = false;
                  break;
                }
              } else if (sourceIndex >= state.sampleData.length) {
                // Sample finished, no loop
                state.active = false;
                break;
              }
              
              // Linear interpolation
              let sample8bit;
              const fraction = sourcePosition - Math.floor(sourcePosition);
              if (fraction > 0 && actualIndex + 1 < state.sampleData.length) {
                const sample1 = state.sampleData.readInt8(actualIndex);
                const sample2 = state.sampleData.readInt8(actualIndex + 1);
                sample8bit = sample1 + (sample2 - sample1) * fraction;
              } else if (actualIndex < state.sampleData.length) {
                sample8bit = state.sampleData.readInt8(actualIndex);
              } else {
                break;
              }
              
              const sample16bit = Math.floor(sample8bit * 256 * volumeScale);
              
              // Apply panning
              const leftSample = Math.floor(sample16bit * leftGain);
              const rightSample = Math.floor(sample16bit * rightGain);
              
              rowBuffer.writeInt16LE(leftSample, bytesWritten);
              rowBuffer.writeInt16LE(rightSample, bytesWritten + 2);
              bytesWritten += 4;
              
              state.position++;
            }
          }
          
          channelBuffers[channelIndex].push(rowBuffer);
        }
      }
      
      return channelBuffers;
    };
    
    // Build complete buffers with repeats
    const patternBuffers = buildPatternBuffers();
    
    // Mix all channels into one buffer
    const mixChannels = (channelBuffers) => {
      // Find the longest buffer
      let maxLength = 0;
      for (const channelBuffer of channelBuffers) {
        const totalLength = channelBuffer.reduce((sum, buf) => sum + buf.length, 0);
        maxLength = Math.max(maxLength, totalLength);
      }
      
      const mixedBuffer = Buffer.alloc(maxLength);
      
      // Calculate scaling factor to prevent clipping
      // For many channels, scale conservatively but not too aggressively
      const channelCount = channelBuffers.length;
      const scaleFactor = 0.6 / Math.sqrt(channelCount);
      
      // Mix all channels
      for (const channelBuffer of channelBuffers) {
        const channelData = Buffer.concat(channelBuffer);
        
        for (let i = 0; i < channelData.length; i += 2) {
          if (i >= mixedBuffer.length) break;
          
          const existing = mixedBuffer.readInt16LE(i);
          const addition = channelData.readInt16LE(i);
          
          // Mix with scaling: add scaled samples and clamp
          let mixed = existing + (addition * scaleFactor);
          mixed = Math.max(-32768, Math.min(32767, mixed));
          
          mixedBuffer.writeInt16LE(mixed, i);
        }
      }
      
      return mixedBuffer;
    };
    
    if (repeat === -1) {
      // Infinite loop: return playback control object
      let stopped = false;
      
      const playLoop = () => {
        if (stopped) {
          if (finalCallback) finalCallback();
          return;
        }
        
        // Create one speaker for each loop iteration
        const speaker = new Speaker({
          channels: 2,
          bitDepth: 16,
          sampleRate: 44100
        });
        
        // Mix all channels into one buffer
        const mixedBuffer = mixChannels(patternBuffers);
        
        speaker.write(mixedBuffer);
        speaker.end();
        speaker.once('close', () => {
          // Play next loop
          playLoop();
        });
      };
      
      // Start playing
      playLoop();
      
      // Return control object
      return {
        stop: () => {
          stopped = true;
        }
      };
    } else {
      // Finite repeat: repeat N times
      const allRepeatBuffers = Array(numChannels).fill(null).map(() => []);
      
      for (let r = 0; r < repeat; r++) {
        for (let ch = 0; ch < numChannels; ch++) {
          allRepeatBuffers[ch].push(...patternBuffers[ch]);
        }
      }
      
      // Mix all channels into one buffer
      const finalMixedBuffer = mixChannels(allRepeatBuffers);
      
      // Create one speaker and play
      const speaker = new Speaker({
        channels: 2,
        bitDepth: 16,
        sampleRate: 44100
      });
      
      speaker.write(finalMixedBuffer);
      speaker.end();
      
      if (finalCallback) {
        speaker.once('close', finalCallback);
      }
    }
  }
}

module.exports = Sampler;
