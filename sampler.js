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
    
    this.samples.set(name, {
      data: data,
      baseNote: baseNote,
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
    const numChannels = 4; // Amiga-style 4 channels
    
    // Build single pattern buffers first
    const buildPatternBuffers = () => {
      const channelBuffers = Array(numChannels).fill(null).map(() => []);
      
      // Calculate row duration in samples (bytes for stereo 16-bit)
      const rowDurationSamples = Math.floor(44100 * rowDuration);
      const rowDurationBytes = rowDurationSamples * 4; // stereo 16-bit
      
      for (const row of pattern) {
        // Each row should have up to 4 steps (one per channel)
        const steps = Array.isArray(row) ? row : [row];
        
        for (let channelIndex = 0; channelIndex < numChannels; channelIndex++) {
          const step = steps[channelIndex];
          
          // Create buffer for this row (fixed length = rowDuration)
          const rowBuffer = Buffer.alloc(rowDurationBytes);
          
          if (step !== null && step !== undefined) {
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
            
            // Volume (MOD: 0-64, default 64 = full volume)
            const volume = step.volume !== undefined ? step.volume : 64;
            const volumeScale = volume / 64;
            
            // Panning (0 = left, 128 = center, 255 = right)
            const pan = step.pan !== undefined ? step.pan : 128;
            const leftGain = (255 - pan) / 255;
            const rightGain = pan / 255;
            
            // Loop info
            const hasLoop = sample.hasLoop;
            const loopStart = sample.loopStart;
            const loopEnd = sample.loopStart + sample.loopLength;
            
            // Write sample data into rowBuffer (up to rowDurationBytes)
            let bytesWritten = 0;
            for (let i = 0; i < newLength && bytesWritten < rowDurationBytes; i++) {
              let sourcePosition = i * pitchRatio;
              
              // Handle looping
              if (hasLoop && sourcePosition >= loopEnd) {
                const loopSize = sample.loopLength;
                const positionInLoop = (sourcePosition - loopStart) % loopSize;
                sourcePosition = loopStart + positionInLoop;
              }
              
              const sourceIndex = Math.floor(sourcePosition);
              const fraction = sourcePosition - sourceIndex;
              
              // Linear interpolation between two samples
              let sample8bit;
              if (sourceIndex < sampleData.length - 1) {
                let nextIndex = sourceIndex + 1;
                
                // If we're at loop end, wrap to loop start for interpolation
                if (hasLoop && nextIndex >= loopEnd) {
                  nextIndex = loopStart;
                }
                
                const sample1 = sampleData.readInt8(sourceIndex);
                const sample2 = sampleData.readInt8(nextIndex);
                sample8bit = sample1 + (sample2 - sample1) * fraction;
              } else if (sourceIndex < sampleData.length) {
                sample8bit = sampleData.readInt8(sourceIndex);
              } else {
                break;
              }
              
              const sample16bit = Math.floor(sample8bit * 256 * volumeScale);
              
              // Apply panning to left and right channels
              const leftSample = Math.floor(sample16bit * leftGain);
              const rightSample = Math.floor(sample16bit * rightGain);
              
              rowBuffer.writeInt16LE(leftSample, bytesWritten);
              rowBuffer.writeInt16LE(rightSample, bytesWritten + 2);
              bytesWritten += 4;
            }
            // Remaining bytes in rowBuffer are already 0 (silence)
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
