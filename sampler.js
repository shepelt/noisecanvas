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
    
    this.samples.set(name, {
      data: data,
      baseNote: baseNote
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

    const gap = options.gap || 0.25;
    const repeat = options.repeat || 1; // Default: play once
    const numChannels = 4; // Amiga-style 4 channels
    
    // Build single pattern buffers first
    const buildPatternBuffers = () => {
      const channelBuffers = Array(numChannels).fill(null).map(() => []);
      
      for (const row of pattern) {
        // Each row should have up to 4 steps (one per channel)
        const steps = Array.isArray(row) ? row : [row];
        
        // First pass: generate all step buffers for this row
        const rowStepBuffers = [];
        let maxStepLength = 0;
        
        for (let channelIndex = 0; channelIndex < numChannels; channelIndex++) {
          const step = steps[channelIndex];
          
          if (step === null || step === undefined) {
            rowStepBuffers[channelIndex] = null;
            continue;
          }
          
          const sample = this.samples.get(step.sample);
          if (!sample) {
            throw new Error(`Sample '${step.sample}' not found`);
          }

          const sampleData = sample.data;
          const baseNote = sample.baseNote;

          // Convert note to semitones
          let semitone;
          if (typeof step.note === 'string') {
            semitone = this.noteToSemitones(step.note, baseNote);
          } else {
            semitone = step.note || 0;
          }

          // Pitch shift
          const pitchRatio = Math.pow(2, semitone / 12);
          const newLength = Math.floor(sampleData.length / pitchRatio);
          const stepBuffer = Buffer.alloc(newLength * 4);
          
          for (let i = 0; i < newLength; i++) {
            const sourceIndex = Math.floor(i * pitchRatio);
            if (sourceIndex < sampleData.length) {
              const sample8bit = sampleData.readInt8(sourceIndex);
              const sample16bit = sample8bit * 256;
              
              stepBuffer.writeInt16LE(sample16bit, i * 4);
              stepBuffer.writeInt16LE(sample16bit, i * 4 + 2);
            }
          }
          
          rowStepBuffers[channelIndex] = stepBuffer;
          maxStepLength = Math.max(maxStepLength, newLength * 4);
        }
        
        // Second pass: pad all buffers to same length and add gap
        for (let channelIndex = 0; channelIndex < numChannels; channelIndex++) {
          const stepBuffer = rowStepBuffers[channelIndex];
          
          if (stepBuffer === null) {
            // Empty channel: silence for (maxStepLength + gap)
            const gapSamples = Math.floor(44100 * gap);
            const totalLength = maxStepLength + (gapSamples * 4);
            const silenceBuffer = Buffer.alloc(totalLength);
            channelBuffers[channelIndex].push(silenceBuffer);
          } else {
            // Pad to maxStepLength
            const padding = maxStepLength - stepBuffer.length;
            const paddingBuffer = Buffer.alloc(padding);
            
            // Add gap
            const gapSamples = Math.floor(44100 * gap);
            const gapBuffer = Buffer.alloc(gapSamples * 4);
            
            channelBuffers[channelIndex].push(stepBuffer);
            channelBuffers[channelIndex].push(paddingBuffer);
            channelBuffers[channelIndex].push(gapBuffer);
          }
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
      
      // Mix all channels
      for (const channelBuffer of channelBuffers) {
        const channelData = Buffer.concat(channelBuffer);
        
        for (let i = 0; i < channelData.length; i += 2) {
          if (i >= mixedBuffer.length) break;
          
          const existing = mixedBuffer.readInt16LE(i);
          const addition = channelData.readInt16LE(i);
          
          // Simple mixing: add and clamp to prevent overflow
          let mixed = existing + addition;
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
