/**
 * S3mLoader - ScreamTracker 3 Module file loader
 * 
 * Features:
 * - Load S3M file format (ScreamTracker 3)
 * - Read song title, speed, tempo
 * - Support for samples/instruments with C4Speed-based pitch calculation
 * - Pattern data parsing
 * - Channel volume state tracking (TASK-13)
 * - Note Delay effect handling (TASK-13, partial)
 * 
 * TASK-12: S3M Pitch Calculation
 * - Problem: Samples with different c4speed values were playing at wrong pitch
 * - Solution: Calculate baseNote from c4speed relative to 44100 Hz sample rate
 *   - baseNote = C-4 + 12 * log2(44100 / c4speed)
 *   - Example: c4speed=22050 → baseNote=C-5 (one octave higher)
 * - Period calculation uses OpenMPT formula: 8363 * FreqS3MTable[note] << 5 / (c4speed << octave)
 * - Frequency conversion: virtualFreq * (8363 / c4speed) = actual musical frequency
 * 
 * TASK-13: Volume Handling Improvements
 * 1. Channel Volume State Tracking:
 *    - S3M maintains volume per channel (like hardware tracker channels)
 *    - When volume is not specified, previous channel volume is maintained
 *    - Implementation: channelVolume array tracks state across pattern rows
 * 
 * 2. Volume Column Parsing:
 *    - 0-64: Set volume (absolute)
 *    - 255 (0xFF): No volume (null)
 *    - Priority: Effect C (Set Volume) > Volume column > Previous channel volume
 * 
 * 3. Note Delay Effect (SDx):
 *    - Effect S (0x13), subcommand D (0x8x) delays note trigger by x ticks
 *    - Current implementation: Skip delayed notes to prevent cutting previous notes
 *    - Limitation: This is a workaround - proper implementation requires tick-based timing
 *    - TODO: Implement tick-based timing system for accurate effect processing
 * 
 * Usage:
 *   const loader = new S3mLoader();
 *   loader.load('song.s3m');
 */

const fs = require('fs');

class S3mLoader {
  // S3M period table (from OpenMPT)
  static FreqS3MTable = [1712, 1616, 1524, 1440, 1356, 1280, 1208, 1140, 1076, 1016, 960, 907];

  constructor() {
    this.title = '';
    this.format = 'S3M';
    this.initialSpeed = 6;  // Default S3M speed
    this.initialTempo = 125; // Default S3M tempo
    this.globalVolume = 64;
    this.orderCount = 0;
    this.instrumentCount = 0;
    this.patternCount = 0;
    this.instruments = [];
    this.orders = [];
    this.patterns = [];
    this.sampler = null;  // Internal sampler instance
  }

  // Read S3M file and parse structure
  load(filepath) {
    const buffer = fs.readFileSync(filepath);
    
    // Verify S3M signature
    const signature = buffer.toString('ascii', 44, 48);
    if (signature !== 'SCRM') {
      throw new Error('Not a valid S3M file');
    }
    
    // Read song title (offset 0, 28 bytes)
    this.title = buffer.toString('ascii', 0, 28).replace(/\0/g, '').trim();
    
    // Read counts
    this.orderCount = buffer.readUInt16LE(32);
    this.instrumentCount = buffer.readUInt16LE(34);
    this.patternCount = buffer.readUInt16LE(36);
    
    // Read playback parameters
    this.globalVolume = buffer.readUInt8(48);
    this.initialSpeed = buffer.readUInt8(49);
    this.initialTempo = buffer.readUInt8(50);
    
    // Read channel settings (offset 64-95, 32 bytes)
    this.channelSettings = [];
    for (let i = 0; i < 32; i++) {
      const setting = buffer.readUInt8(64 + i);
      this.channelSettings.push({
        enabled: setting < 128,
        pan: setting < 16 ? ((setting & 8) ? 255 : 0) : 128, // Left (0-7) or Right (8-15)
        raw: setting
      });
    }
    
    // Read orders (offset 96)
    this._readOrders(buffer);
    
    // Read instrument pointers and data
    this._readInstruments(buffer);
    
    // Read pattern pointers and data
    this._readPatterns(buffer);
    
    // Read sample data
    this._readSampleData(buffer);
  }

  _readOrders(buffer) {
    const orderOffset = 96;
    this.orders = [];
    
    for (let i = 0; i < this.orderCount; i++) {
      const order = buffer.readUInt8(orderOffset + i);
      // Skip separator (255) and end marker (254)
      if (order < 254) {
        this.orders.push(order);
      }
    }
  }

  _readInstruments(buffer) {
    const instrumentPtrOffset = 96 + this.orderCount;
    this.instruments = [];
    
    for (let i = 0; i < this.instrumentCount; i++) {
      const parapointer = buffer.readUInt16LE(instrumentPtrOffset + (i * 2));
      
      if (parapointer === 0) {
        // Empty instrument slot
        this.instruments.push({
          name: '',
          length: 0,
          volume: 0,
          c4speed: 0,
          data: null
        });
        continue;
      }
      
      // Parapointer * 16 = actual offset
      const offset = parapointer * 16;
      
      // Read instrument header
      const type = buffer.readUInt8(offset);
      
      if (type !== 1) {
        // Not a sample (type 1 = PCM sample)
        this.instruments.push({
          name: '',
          length: 0,
          volume: 0,
          c4speed: 0,
          data: null
        });
        continue;
      }
      
      const dosFilename = buffer.toString('ascii', offset + 1, offset + 13).replace(/\0/g, '').trim();
      const memSegHigh = buffer.readUInt8(offset + 13);
      const memSegLow = buffer.readUInt16LE(offset + 14);
      const length = buffer.readUInt32LE(offset + 16);
      const loopStart = buffer.readUInt32LE(offset + 20);
      const loopEnd = buffer.readUInt32LE(offset + 24);
      const volume = buffer.readUInt8(offset + 28);
      const pack = buffer.readUInt8(offset + 30);
      const flags = buffer.readUInt8(offset + 31);
      const c4speed = buffer.readUInt32LE(offset + 32);
      const name = buffer.toString('ascii', offset + 48, offset + 76).replace(/\0/g, '').trim();
      const scrs = buffer.toString('ascii', offset + 76, offset + 80);
      
      // Verify SCRS signature
      if (scrs !== 'SCRS') {
        this.instruments.push({
          name: '',
          length: 0,
          volume: 0,
          c4speed: 0,
          data: null
        });
        continue;
      }
      
      this.instruments.push({
        name,
        dosFilename,
        length,
        loopStart,
        loopEnd,
        volume,
        flags,
        c4speed,
        pack,
        data: null, // Will be filled later
        memSeg: (memSegHigh << 16) | memSegLow
      });
    }
  }

  _readPatterns(buffer) {
    const patternPtrOffset = 96 + this.orderCount + (this.instrumentCount * 2);
    this.patterns = [];
    
    for (let p = 0; p < this.patternCount; p++) {
      const parapointer = buffer.readUInt16LE(patternPtrOffset + (p * 2));
      
      if (parapointer === 0) {
        // Empty pattern - create 64 empty rows
        const emptyPattern = [];
        for (let r = 0; r < 64; r++) {
          emptyPattern.push([null, null, null, null, null, null, null, null]);
        }
        this.patterns.push(emptyPattern);
        continue;
      }
      
      // Parapointer * 16 = actual offset
      const offset = parapointer * 16;
      
      // Skip packed length (2 bytes)
      let pos = offset + 2;
      
      const pattern = [];
      
      // Initialize 64 rows with 32 channels (S3M supports up to 32 channels)
      for (let r = 0; r < 64; r++) {
        const row = [];
        for (let c = 0; c < 32; c++) {
          row.push(null);
        }
        pattern.push(row);
      }
      
      // Parse packed pattern data
      let currentRow = 0;
      
      while (currentRow < 64) {
        const what = buffer.readUInt8(pos++);
        
        if (what === 0) {
          // End of row
          currentRow++;
          continue;
        }
        
        // Extract channel and flags
        const channel = what & 31;
        const hasNote = (what & 32) !== 0;
        const hasVolume = (what & 64) !== 0;
        const hasEffect = (what & 128) !== 0;
        
        let note = null;
        let instrument = null;
        let volume = null;
        let effect = null;
        let effectParam = null;
        
        // Read note and instrument
        if (hasNote) {
          const noteData = buffer.readUInt8(pos++);
          const instData = buffer.readUInt8(pos++);
          
          if (noteData !== 255 && noteData !== 254) {
            note = noteData;
          }
          if (instData > 0) {
            instrument = instData;
          }
        }
        
        // Read volume
        if (hasVolume) {
          const volumeData = buffer.readUInt8(pos++);
          // 255 (0xFF) means no volume, treat as null
          volume = volumeData === 255 ? null : volumeData;
        }
        
        // Read effect
        if (hasEffect) {
          effect = buffer.readUInt8(pos++);
          effectParam = buffer.readUInt8(pos++);
        }
        
        // Store in pattern
        pattern[currentRow][channel] = {
          note,
          instrument,
          volume,
          effect,
          effectParam
        };
      }
      
      this.patterns.push(pattern);
    }
  }

  _readSampleData(buffer) {
    for (let i = 0; i < this.instruments.length; i++) {
      const inst = this.instruments[i];
      
      if (inst.length > 0 && inst.memSeg > 0) {
        // Memory segment * 16 = actual offset
        const offset = inst.memSeg * 16;
        
        // Allocate buffer for sample data
        inst.data = Buffer.alloc(inst.length);
        
        // Read sample data
        // S3M samples are unsigned 8-bit, convert to signed
        for (let j = 0; j < inst.length; j++) {
          const unsignedSample = buffer.readUInt8(offset + j);
          const signedSample = unsignedSample - 128; // Convert unsigned (0-255) to signed (-128 to 127)
          inst.data.writeInt8(signedSample, j);
        }
      }
    }
  }

  // S3M note number to note name conversion
  getNoteTable() {
    const notes = ['C-', 'C#', 'D-', 'D#', 'E-', 'F-', 'F#', 'G-', 'G#', 'A-', 'A#', 'B-'];
    const table = {};
    
    for (let octave = 0; octave <= 9; octave++) {
      for (let note = 0; note < 12; note++) {
        const noteNum = octave * 12 + note;
        table[noteNum] = notes[note] + octave;
      }
    }
    
    return table;
  }

  // Calculate BPM for sampler from S3M speed/tempo
  // Calculate S3M period for a note
  // semitone: 0=C, 1=C#, ..., 11=B
  // octave: relative to C-4 (C-4=0, C-5=1, C-3=-1)
  // c4speed: sample's C4Speed value
  calculatePeriod(semitone, octave, c4speed) {
    if (octave < 0) {
      // For negative octaves, shift right instead
      return Math.floor(8363 * (S3mLoader.FreqS3MTable[semitone] << 5) * (1 << (-octave)) / c4speed);
    }
    return Math.floor(8363 * (S3mLoader.FreqS3MTable[semitone] << 5) / (c4speed << octave));
  }

  // Convert period to frequency (Hz)
  periodToFreq(period) {
    return 8363 * 1712 / period;
  }

  calculateBPM() {
    // S3M timing formula:
    // 1 tick = 2.5 / tempo seconds
    // 1 row = speed ticks
    // Row duration = speed * (2.5 / tempo) seconds
    // 
    // However, there seems to be a factor of 2 difference in practice
    // Empirically: BPM = tempo / (speed * factor)
    const rowDuration = (this.initialSpeed * 2.5) / this.initialTempo;
    return 60 / (rowDuration * 2); // Divide by 2 for correct tempo
  }

  // Load S3M instruments into sampler with correct settings
  loadInstrumentsIntoSampler(sampler, tempDir) {
    const path = require('path');
    const fs = require('fs');

    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir);
    }

    this.instruments.forEach((inst, idx) => {
      if (inst.length > 0 && inst.data) {
        const instPath = path.join(tempDir, `inst_${idx}`);
        fs.writeFileSync(instPath, inst.data);
        
        // Calculate baseNote from c4speed
        // If c4speed = 44100, sample plays at its original rate = C-4
        // If c4speed = 22050, sample is half speed = one octave higher = C-5
        // If c4speed = 8363, sample needs upsampling = lower pitch
        const SAMPLE_RATE = 44100;
        const semitonesFromC4 = 12 * Math.log2(SAMPLE_RATE / inst.c4speed);
        const baseNoteSemitone = 48 + Math.round(semitonesFromC4);  // 48 = C-4 in MIDI
        const baseNoteOctave = Math.floor(baseNoteSemitone / 12);
        const baseNoteIndex = baseNoteSemitone % 12;
        const noteNames = ['C-', 'C#', 'D-', 'D#', 'E-', 'F-', 'F#', 'G-', 'G#', 'A-', 'A#', 'B-'];
        const baseNote = noteNames[baseNoteIndex] + baseNoteOctave;
        
        // Load sample with calculated baseNote
        sampler.loadSample(`s3m_inst_${idx}`, instPath, {
          baseNote: baseNote,
          c4speed: inst.c4speed,
          loopStart: inst.loopStart,
          loopLength: inst.loopEnd > inst.loopStart ? inst.loopEnd - inst.loopStart : 0
        });
      }
    });
  }

  // Convert S3M patterns to Sampler format
  convertPatterns(startOrder, numOrders) {
    const noteTable = this.getNoteTable();
    const samplerPattern = [];

    const endOrder = Math.min(startOrder + numOrders, this.orders.length);
    
    // Track channel volume state (S3M maintains volume per channel)
    const channelVolume = new Array(32).fill(64); // Default volume 64

    for (let pos = startOrder; pos < endOrder; pos++) {
      const patternIndex = this.orders[pos];
      const s3mPattern = this.patterns[patternIndex];

      for (let row = 0; row < s3mPattern.length; row++) {
        const channels = [];

        // S3M supports up to 32 channels
        // Convert all channels (sampler will handle dynamic channel count)
        for (let ch = 0; ch < 32; ch++) {
          const cell = s3mPattern[row][ch];

          // Skip disabled channels
          if (!this.channelSettings[ch].enabled) {
            channels.push(null);
            continue;
          }

          // Check if there's a note to play
          if (cell && cell.instrument && cell.note !== null) {
            // Check for Note Delay effect (SDx where x > 0)
            const hasNoteDelay = cell.effect === 0x13 && 
                                 (cell.effectParam >> 4) === 0x8 && 
                                 (cell.effectParam & 0x0F) > 0;
            
            // TEMPORARY: Skip notes with delay to prevent cutting off previous notes
            // TODO: Implement proper tick-based timing in Sampler
            if (hasNoteDelay) {
              channels.push(null);
              continue;
            }
            
            const inst = this.instruments[cell.instrument - 1];
            
            // Parse S3M note: upper 4 bits = octave, lower 4 bits = semitone
            const s3mOctave = (cell.note >> 4) & 0x0F;
            const s3mSemitone = cell.note & 0x0F;
            
            // Calculate S3M period and frequency
            const octaveRelativeToC4 = s3mOctave - 4;  // S3M octave 4 = C-4
            const period = this.calculatePeriod(s3mSemitone, octaveRelativeToC4, inst.c4speed);
            
            // periodToFreq returns a "virtual frequency" based on 8363 Hz standard
            // To get actual musical frequency, scale by (8363 / c4speed)
            const virtualFreq = this.periodToFreq(period);
            const targetFreq = virtualFreq * (8363 / inst.c4speed);
            
            // Calculate what note would produce this frequency
            const C4_FREQ = 261.6255653005986;  // C-4 in equal temperament
            const semitoneFromC4 = 12 * Math.log2(targetFreq / C4_FREQ);
            
            // Convert back to note name for Sampler
            const totalSemitone = 48 + Math.round(semitoneFromC4);  // 48 = C-4 in MIDI
            const noteOctave = Math.floor(totalSemitone / 12);
            const noteSemitone = totalSemitone % 12;
            const noteNames = ['C-', 'C#', 'D-', 'D#', 'E-', 'F-', 'F#', 'G-', 'G#', 'A-', 'A#', 'B-'];
            const noteName = noteNames[noteSemitone] + noteOctave;
            
            const step = {
              sample: `s3m_inst_${cell.instrument - 1}`,
              note: noteName
            };

            // Determine volume:
            // S3M maintains volume state per channel
            // Priority: Effect C (Set Volume) > Volume column > Previous channel volume
            let finalVolume = channelVolume[ch]; // Use previous channel volume
            
            // Check volume column (0-64 = set volume, 65+ = other effects)
            if (cell.volume !== null && cell.volume <= 64) {
              finalVolume = cell.volume;
              channelVolume[ch] = finalVolume; // Update channel state
            }
            
            // Check effect C (Set Volume) - overrides volume column
            if (cell.effect === 0x0C && cell.effectParam !== null) {
              finalVolume = Math.min(cell.effectParam, 64);
              channelVolume[ch] = finalVolume; // Update channel state
            }
            
            // If this is the first note on this channel, use instrument default
            if (channelVolume[ch] === 64 && cell.volume === null && cell.effect !== 0x0C) {
              finalVolume = inst.volume;
              channelVolume[ch] = finalVolume; // Initialize channel state
            }
            
            // Don't apply global volume scaling for now - just use the volume directly
            step.volume = finalVolume;

            // Use channel settings for panning
            step.pan = this.channelSettings[ch].pan;

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

  // Play S3M file (creates internal sampler if needed)
  play(options = {}) {
    const path = require('path');
    const Sampler = require('./sampler');
    
    // Create sampler if not exists
    if (!this.sampler) {
      this.sampler = new Sampler();
    }
    
    const tempDir = options.tempDir || path.join(__dirname, 'temp_s3m_playback');
    const startOrder = options.startOrder || 0;
    const numOrders = options.numOrders || this.orders.length;
    const callback = options.callback;

    // Load instruments
    this.loadInstrumentsIntoSampler(this.sampler, tempDir);

    // Convert patterns
    const samplerPattern = this.convertPatterns(startOrder, numOrders);

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
}

module.exports = S3mLoader;
