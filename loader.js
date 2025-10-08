/**
 * ModLoader - Amiga MOD file loader and playback engine
 * 
 * Features:
 * - Supports both 15 and 31 sample formats (M.K., 4CHN, etc.)
 * - Reads samples and pattern data from MOD files
 * - Automatic Speed/Tempo detection from pattern effects
 * - Correct pitch calculation (MOD 8363Hz → 44100Hz conversion to F-4 base note)
 * - Volume support (C effect: 0x00-0x40)
 * - Stereo panning (Amiga channel layout: Ch0/Ch3=Left, Ch1/Ch2=Right)
 * - Linear interpolation for smooth resampling
 * - Sample looping support (loop if loopLength > 2)
 * - Internal sampler management
 * 
 * Usage:
 *   const loader = new ModLoader();
 *   loader.load('song.mod');
 *   loader.play({ startPattern: 0, numPatterns: 3, callback: () => {} });
 * 
 * Helper methods:
 *   - analyzeEffects(start, num) - Get effect usage statistics
 *   - getLoopingSamples() - Get samples with loop info
 *   - calculateBPM() - Convert MOD speed/tempo to BPM
 */

const fs = require('fs');

class ModLoader {
  constructor() {
    this.title = '';
    this.samples = [];
    this.numPatterns = 0;
    this.patternTable = [];
    this.patterns = [];
    this.initialSpeed = 6;  // Default MOD speed (ticks/row)
    this.initialTempo = 125; // Default MOD tempo (BPM)
    this.sampler = null;  // Internal sampler instance
  }

  // Read MOD file and parse structure
  load(filepath) {
    const buffer = fs.readFileSync(filepath);
    
    // Check if this is a 15-sample or 31-sample MOD
    const formatTag = buffer.toString('ascii', 1080, 1084);
    const is31Sample = formatTag === 'M.K.' || formatTag === '4CHN' || 
                       formatTag === '6CHN' || formatTag === '8CHN' ||
                       formatTag === 'FLT4' || formatTag === 'FLT8';
    
    const numSamples = is31Sample ? 31 : 15;
    const patternCountOffset = is31Sample ? 950 : 470;
    const patternTableOffset = is31Sample ? 952 : 472;
    const patternDataOffset = is31Sample ? 1084 : 600;
    
    // Read song title (offset 0, 20 bytes)
    this.title = buffer.toString('ascii', 0, 20).replace(/\0/g, '').trim();
    
    // Read sample info
    this.samples = this._parseSamples(buffer, numSamples);
    
    // Read pattern count
    this.numPatterns = buffer.readUInt8(patternCountOffset);
    
    // Read pattern table (128 bytes)
    this.patternTable = [];
    for (let i = 0; i < 128; i++) {
      this.patternTable.push(buffer.readUInt8(patternTableOffset + i));
    }
    
    // Determine number of patterns to read
    const maxPattern = Math.max(...this.patternTable) + 1;
    
    // Read pattern data
    this.patterns = this._parsePatterns(buffer, patternDataOffset, maxPattern);
    
    // Read sample data
    this._readSampleData(buffer, patternDataOffset + (maxPattern * 1024));
  }

  _parseSamples(buffer, numSamples) {
    const samples = [];
    let offset = 20;
    
    for (let i = 0; i < numSamples; i++) {
      const sample = {
        name: buffer.toString('ascii', offset, offset + 22).replace(/\0/g, '').trim(),
        length: buffer.readUInt16BE(offset + 22) * 2, // stored as words
        finetune: buffer.readUInt8(offset + 24) & 0x0F,
        volume: buffer.readUInt8(offset + 25),
        loopStart: buffer.readUInt16BE(offset + 26) * 2,
        loopLength: buffer.readUInt16BE(offset + 28) * 2,
        data: null // Will be filled later
      };
      
      samples.push(sample);
      offset += 30;
    }
    
    // Pad to 31 samples for consistency
    while (samples.length < 31) {
      samples.push({
        name: '',
        length: 0,
        finetune: 0,
        volume: 0,
        loopStart: 0,
        loopLength: 0,
        data: null
      });
    }
    
    return samples;
  }

  _parsePatterns(buffer, offset, numPatterns) {
    const patterns = [];
    
    for (let p = 0; p < numPatterns; p++) {
      const pattern = [];
      
      // Each pattern has 64 rows
      for (let row = 0; row < 64; row++) {
        const channels = [];
        
        // 4 channels per row
        for (let ch = 0; ch < 4; ch++) {
          const noteOffset = offset + (p * 1024) + (row * 16) + (ch * 4);
          
          const byte0 = buffer.readUInt8(noteOffset);
          const byte1 = buffer.readUInt8(noteOffset + 1);
          const byte2 = buffer.readUInt8(noteOffset + 2);
          const byte3 = buffer.readUInt8(noteOffset + 3);
          
          // Extract sample number (upper 4 bits of byte0 + upper 4 bits of byte2)
          const sample = ((byte0 & 0xF0) | ((byte2 & 0xF0) >> 4));
          
          // Extract period (lower 4 bits of byte0 + all of byte1)
          const period = ((byte0 & 0x0F) << 8) | byte1;
          
          // Extract effect (lower 4 bits of byte2)
          const effect = byte2 & 0x0F;
          
          // Extract effect parameter (byte3)
          const effectParam = byte3;
          
          channels.push({
            sample,
            period,
            effect,
            effectParam
          });
        }
        
        pattern.push(channels);
      }
      
      patterns.push(pattern);
    }
    
    return patterns;
  }

  _readSampleData(buffer, offset) {
    for (let i = 0; i < this.samples.length; i++) {
      const sample = this.samples[i];
      
      if (sample.length > 0) {
        sample.data = Buffer.alloc(sample.length);
        
        for (let j = 0; j < sample.length; j++) {
          // Read as signed 8-bit
          sample.data.writeInt8(buffer.readInt8(offset + j), j);
        }
        
        offset += sample.length;
      }
    }
    
    // Scan for initial speed/tempo after loading everything
    this._scanInitialTempo();
  }

  _scanInitialTempo() {
    // Scan first few patterns for speed/tempo effects (0xF)
    const patternsToScan = Math.min(3, this.patterns.length);
    
    for (let p = 0; p < patternsToScan; p++) {
      const patternIndex = this.patternTable[p];
      const pattern = this.patterns[patternIndex];
      
      for (let row = 0; row < pattern.length; row++) {
        for (let ch = 0; ch < 4; ch++) {
          const note = pattern[row][ch];
          
          if (note.effect === 0xF && note.effectParam > 0) {
            if (note.effectParam < 32) {
              // Speed change (ticks per row)
              this.initialSpeed = note.effectParam;
              return; // Found it, stop scanning
            } else {
              // Tempo change (BPM)
              this.initialTempo = note.effectParam;
              return; // Found it, stop scanning
            }
          }
        }
      }
    }
  }

  // MOD period to note name conversion table
  getPeriodTable() {
    return {
      856: 'C-1', 808: 'C#1', 762: 'D-1', 720: 'D#1', 678: 'E-1', 640: 'F-1',
      604: 'F#1', 570: 'G-1', 538: 'G#1', 508: 'A-1', 480: 'A#1', 453: 'B-1',
      428: 'C-2', 404: 'C#2', 381: 'D-2', 360: 'D#2', 339: 'E-2', 320: 'F-2',
      302: 'F#2', 285: 'G-2', 269: 'G#2', 254: 'A-2', 240: 'A#2', 226: 'B-2',
      214: 'C-3', 202: 'C#3', 190: 'D-3', 180: 'D#3', 170: 'E-3', 160: 'F-3',
      151: 'F#3', 143: 'G-3', 135: 'G#3', 127: 'A-3', 120: 'A#3', 113: 'B-3'
    };
  }

  // Calculate BPM for sampler from MOD speed/tempo
  calculateBPM() {
    const rowDuration = 60 / (this.initialTempo * 24 / this.initialSpeed);
    return 60 / rowDuration;
  }

  // Load MOD samples into sampler with correct settings
  loadSamplesIntoSampler(sampler, tempDir) {
    const path = require('path');
    const fs = require('fs');

    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir);
    }

    this.samples.forEach((sample, idx) => {
      if (sample.length > 0) {
        const samplePath = path.join(tempDir, `sample_${idx}`);
        fs.writeFileSync(samplePath, sample.data);
        
        // MOD samples are ~8363 Hz treated as C-2
        // When loaded at 44100 Hz, base note is ~F-4
        sampler.loadSample(`mod_sample_${idx}`, samplePath, {
          baseNote: 'F-4',
          loopStart: sample.loopStart,
          loopLength: sample.loopLength
        });
      }
    });
  }

  // Convert MOD patterns to Sampler format
  convertPatterns(startPattern, numPatterns) {
    const periodTable = this.getPeriodTable();
    const samplerPattern = [];

    const endPattern = Math.min(startPattern + numPatterns, this.patternTable.length);

    for (let pos = startPattern; pos < endPattern; pos++) {
      const patternIndex = this.patternTable[pos];
      const modPattern = this.patterns[patternIndex];

      for (let row = 0; row < modPattern.length; row++) {
        const channels = [];

        for (let ch = 0; ch < 4; ch++) {
          const note = modPattern[row][ch];

          if (note.sample > 0 && note.period > 0) {
            const noteName = periodTable[note.period] || 'C-2';
            const step = {
              sample: `mod_sample_${note.sample - 1}`,
              note: noteName
            };

            // Apply volume effect (C command)
            if (note.effect === 0xC) {
              step.volume = note.effectParam;
            }

            // Apply MOD panning (Ch0=Left, Ch1=Right, Ch2=Right, Ch3=Left)
            step.pan = (ch === 1 || ch === 2) ? 255 : 0;

            channels.push(step);
          } else {
            channels.push(null);
          }
        }

        samplerPattern.push(channels);
      }
    }

    return samplerPattern;
  }

  // Play MOD file (creates internal sampler if needed)
  play(options = {}) {
    const path = require('path');
    const Sampler = require('./sampler');
    
    // Create sampler if not exists
    if (!this.sampler) {
      this.sampler = new Sampler();
    }
    
    const tempDir = options.tempDir || path.join(__dirname, 'temp_mod_playback');
    const startPattern = options.startPattern || 0;
    const numPatterns = options.numPatterns || this.patternTable.length;
    const callback = options.callback;

    // Load samples
    this.loadSamplesIntoSampler(this.sampler, tempDir);

    // Convert patterns
    const samplerPattern = this.convertPatterns(startPattern, numPatterns);

    // Calculate BPM
    const bpm = this.calculateBPM();

    // Play
    this.sampler.playPattern(samplerPattern, { bpm }, () => {
      // Cleanup temp files
      const fs = require('fs');
      fs.rmSync(tempDir, { recursive: true, force: true });
      if (callback) callback();
    });
  }

  // Helper: Analyze effects used in patterns
  analyzeEffects(startPattern = 0, numPatterns = null) {
    const effectCounts = {};
    const end = numPatterns !== null ? startPattern + numPatterns : this.patternTable.length;

    for (let p = startPattern; p < end; p++) {
      const patternIndex = this.patternTable[p];
      const pattern = this.patterns[patternIndex];

      for (let row = 0; row < pattern.length; row++) {
        for (let ch = 0; ch < 4; ch++) {
          const note = pattern[row][ch];

          if (note.effect !== 0 || note.effectParam !== 0) {
            const effectName = `${note.effect.toString(16).toUpperCase()}${note.effectParam.toString(16).padStart(2, '0').toUpperCase()}`;
            effectCounts[effectName] = (effectCounts[effectName] || 0) + 1;
          }
        }
      }
    }

    return effectCounts;
  }

  // Helper: Get samples with loop info
  getLoopingSamples() {
    return this.samples
      .map((sample, idx) => ({ ...sample, index: idx }))
      .filter(s => s.loopLength > 2);
  }

  // Helper: Get pattern by position in song
  getPatternByPosition(position) {
    const patternIndex = this.patternTable[position];
    return this.patterns[patternIndex];
  }
}

module.exports = ModLoader;
