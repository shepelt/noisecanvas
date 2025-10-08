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
    
    // TASK-14: Tick-based timing system
    // - 1 row = speed ticks (default: 6 ticks)
    // - tick duration = (2.5 / tempo) seconds (S3M standard)
    const speed = options.speed || 6;  // Default S3M speed
    const tempo = options.tempo || 125; // Default S3M tempo
    const tickDuration = 2.5 / tempo;
    const rowDuration = speed * tickDuration;
    
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
      console.log(`Rendering pattern: ${pattern.length} rows × ${numChannels} channels × ${speed} ticks = ${pattern.length * numChannels * speed} tick-buffers`);
      const startTime = Date.now();
      
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
        active: false,
        // TASK-14: Note delay support
        delayedNote: null,  // Note to trigger after delay
        delayTicks: 0       // Remaining ticks until trigger
      }));
      
      // Calculate tick duration in samples (bytes for stereo 16-bit)
      const tickDurationSamples = Math.floor(44100 * tickDuration);
      const tickDurationBytes = tickDurationSamples * 4; // stereo 16-bit
      
      let processedRows = 0;
      const logInterval = Math.max(1, Math.floor(pattern.length / 10)); // Log every 10%
      
      for (const row of pattern) {
        const steps = Array.isArray(row) ? row : [row];
        
        // Process each tick in this row
        for (let tick = 0; tick < speed; tick++) {
          for (let channelIndex = 0; channelIndex < numChannels; channelIndex++) {
            const step = steps[channelIndex];
            const state = channelStates[channelIndex];
            
            // At tick 0, process new notes or effects
            if (tick === 0 && step !== null && step !== undefined) {
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
            
            // Create buffer for this tick
            const tickBuffer = Buffer.alloc(tickDurationBytes);
            
            // Render current channel state into tickBuffer
            if (state.active && state.sampleData) {
              const volumeScale = state.volume / 64;
              const leftGain = (255 - state.pan) / 255;
              const rightGain = state.pan / 255;
              
              let bytesWritten = 0;
              while (bytesWritten < tickDurationBytes) {
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
                
                tickBuffer.writeInt16LE(leftSample, bytesWritten);
                tickBuffer.writeInt16LE(rightSample, bytesWritten + 2);
                bytesWritten += 4;
                
                state.position++;
              }
            }
            
            channelBuffers[channelIndex].push(tickBuffer);
          }
        }
        
        processedRows++;
        if (processedRows % logInterval === 0 || processedRows === pattern.length) {
          const progress = ((processedRows / pattern.length) * 100).toFixed(0);
          const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
          console.log(`  Progress: ${progress}% (${processedRows}/${pattern.length} rows, ${elapsed}s)`);
        }
      }
      
      const renderTime = ((Date.now() - startTime) / 1000).toFixed(2);
      console.log(`Rendering complete: ${renderTime}s`);
      console.log(`Starting playback...`);
      
      return channelBuffers;
    };
    
    // Build complete buffers with repeats
    const patternBuffers = buildPatternBuffers();
    
    // Mix all channels into one buffer
    const mixChannels = (channelBuffers) => {
      console.log(`Mixing ${channelBuffers.length} channels...`);
      const mixStartTime = Date.now();
      
      // Find the longest buffer
      let maxLength = 0;
      for (const channelBuffer of channelBuffers) {
        const totalLength = channelBuffer.reduce((sum, buf) => sum + buf.length, 0);
        maxLength = Math.max(maxLength, totalLength);
      }
      
      const mixedBuffer = Buffer.alloc(maxLength);
      const mixedView = new Int16Array(mixedBuffer.buffer, mixedBuffer.byteOffset, mixedBuffer.length / 2);
      
      // Calculate scaling factor to prevent clipping
      const channelCount = channelBuffers.length;
      const scaleFactor = 0.6 / Math.sqrt(channelCount);
      
      // Optimized mixing: use TypedArray for faster access
      for (let channelIdx = 0; channelIdx < channelBuffers.length; channelIdx++) {
        const channelTickBuffers = channelBuffers[channelIdx];
        let mixSampleOffset = 0;
        
        for (let tickIdx = 0; tickIdx < channelTickBuffers.length; tickIdx++) {
          const tickBuffer = channelTickBuffers[tickIdx];
          const tickView = new Int16Array(tickBuffer.buffer, tickBuffer.byteOffset, tickBuffer.length / 2);
          
          for (let i = 0; i < tickView.length; i++) {
            if (mixSampleOffset + i >= mixedView.length) break;
            
            const existing = mixedView[mixSampleOffset + i];
            const addition = tickView[i];
            
            let mixed = existing + (addition * scaleFactor);
            mixed = Math.max(-32768, Math.min(32767, mixed));
            
            mixedView[mixSampleOffset + i] = mixed;
          }
          
          mixSampleOffset += tickView.length;
        }
      }
      
      const mixTime = ((Date.now() - mixStartTime) / 1000).toFixed(2);
      const bufferSizeMB = (mixedBuffer.length / 1024 / 1024).toFixed(2);
      console.log(`Mixing complete: ${mixTime}s (buffer size: ${bufferSizeMB} MB)`);
      
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
      
      console.log(`Creating speaker and sending buffer to audio device...`);
      
      // Create one speaker and play
      const speaker = new Speaker({
        channels: 2,
        bitDepth: 16,
        sampleRate: 44100
      });
      
      speaker.write(finalMixedBuffer);
      speaker.end();
      
      console.log(`Buffer sent to speaker. Playback should start now!`);
      
      if (finalCallback) {
        speaker.once('close', finalCallback);
      }
    }
  }
}

module.exports = Sampler;
