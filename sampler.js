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
}

module.exports = Sampler;
