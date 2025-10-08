const fs = require('fs');
const path = require('path');
const ModLoader = require('./loader');

describe('MOD Loader', () => {
  const modPath = path.join(__dirname, 'songs', 'song.mod');
  let loader;

  beforeEach(() => {
    loader = new ModLoader();
  });

  test('load_mod_file', () => {
    // Load the MOD file
    loader.load(modPath);
    
    // Check that basic properties are loaded
    expect(loader.title).toBeDefined();
    expect(loader.samples).toBeDefined();
    expect(loader.samples.length).toBe(31);
    expect(loader.numPatterns).toBeGreaterThan(0);
    expect(loader.patternTable).toBeDefined();
    expect(loader.patterns).toBeDefined();
    
    console.log('Song title:', loader.title);
    console.log('Number of patterns:', loader.numPatterns);
    console.log('Pattern table length:', loader.patternTable.length);
    console.log('Patterns loaded:', loader.patterns.length);
  });

  test('read_sample_info', () => {
    loader.load(modPath);
    
    // Find samples with actual data
    const nonEmptySamples = loader.samples.filter(s => s.length > 0);
    
    expect(nonEmptySamples.length).toBeGreaterThan(0);
    
    // Log sample information
    console.log('\nSample Information:');
    nonEmptySamples.forEach((sample, idx) => {
      console.log(`Sample ${idx + 1}:`);
      console.log(`  Name: ${sample.name}`);
      console.log(`  Length: ${sample.length} bytes`);
      console.log(`  Volume: ${sample.volume}`);
      console.log(`  Finetune: ${sample.finetune}`);
      console.log(`  Loop: ${sample.loopStart} - ${sample.loopStart + sample.loopLength}`);
    });
  });

  test('read_pattern_data', () => {
    loader.load(modPath);
    
    expect(loader.patterns.length).toBeGreaterThan(0);
    
    const firstPattern = loader.patterns[0];
    expect(firstPattern.length).toBe(64); // 64 rows per pattern
    
    const firstRow = firstPattern[0];
    expect(firstRow.length).toBe(4); // 4 channels
    
    // Log first pattern's first few rows
    console.log('\nFirst Pattern (first 4 rows):');
    for (let row = 0; row < 4; row++) {
      console.log(`Row ${row}:`, firstPattern[row].map(ch => ({
        sample: ch.sample,
        period: ch.period,
        effect: ch.effect.toString(16),
        param: ch.effectParam.toString(16).padStart(2, '0')
      })));
    }
  });

  test('extract_sample_data', () => {
    loader.load(modPath);
    
    // Find first non-empty sample
    const sample = loader.samples.find(s => s.length > 0);
    
    expect(sample).toBeDefined();
    expect(sample.data).toBeDefined();
    expect(sample.data.length).toBe(sample.length);
    
    // Verify sample data is signed 8-bit
    for (let i = 0; i < Math.min(10, sample.data.length); i++) {
      const value = sample.data.readInt8(i);
      expect(value).toBeGreaterThanOrEqual(-128);
      expect(value).toBeLessThanOrEqual(127);
    }
    
    console.log(`\nFirst sample data (first 10 bytes):`, 
      Array.from(sample.data.slice(0, 10)).map(b => sample.data.readInt8(b)));
  });

  test('play_mod_with_sampler', (done) => {
    const Sampler = require('./sampler');
    const sampler = new Sampler();
    
    // Load MOD file
    loader.load(modPath);
    
    console.log('\n=== Playing MOD file with Sampler ===');
    console.log('Song:', loader.title);
    console.log('Patterns:', loader.patterns.length);
    
    // Load MOD samples into Sampler (using temp files)
    const tempDir = path.join(__dirname, 'temp_mod_samples');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir);
    }
    
    // Save and load each sample
    loader.samples.forEach((sample, idx) => {
      if (sample.length > 0) {
        const samplePath = path.join(tempDir, `sample_${idx}`);
        fs.writeFileSync(samplePath, sample.data);
        // MOD samples are ~8363 Hz treated as C-2
        // When loaded at 44100 Hz, base note is ~F-4
        sampler.loadSample(`mod_sample_${idx}`, samplePath, { baseNote: 'F-4' });
        console.log(`Loaded sample ${idx}: ${sample.name} (${sample.length} bytes)`);
      }
    });
    
    // Convert MOD pattern to Sampler pattern
    // Play first pattern only for testing
    const modPattern = loader.patterns[0];
    const samplerPattern = [];
    
    // MOD period table (C-1 to B-3)
    const periodTable = {
      856: 'C-1', 808: 'C#1', 762: 'D-1', 720: 'D#1', 678: 'E-1', 640: 'F-1',
      604: 'F#1', 570: 'G-1', 538: 'G#1', 508: 'A-1', 480: 'A#1', 453: 'B-1',
      428: 'C-2', 404: 'C#2', 381: 'D-2', 360: 'D#2', 339: 'E-2', 320: 'F-2',
      302: 'F#2', 285: 'G-2', 269: 'G#2', 254: 'A-2', 240: 'A#2', 226: 'B-2',
      214: 'C-3', 202: 'C#3', 190: 'D-3', 180: 'D#3', 170: 'E-3', 160: 'F-3',
      151: 'F#3', 143: 'G-3', 135: 'G#3', 127: 'A-3', 120: 'A#3', 113: 'B-3'
    };
    
    for (let row = 0; row < modPattern.length; row++) {
      const channels = [];
      
      for (let ch = 0; ch < 4; ch++) {
        const note = modPattern[row][ch];
        
        if (note.sample > 0 && note.period > 0) {
          const noteName = periodTable[note.period] || 'C-2';
          channels.push({
            sample: `mod_sample_${note.sample - 1}`,
            note: noteName
          });
        } else {
          channels.push(null);
        }
      }
      
      samplerPattern.push(channels);
    }
    
    console.log('\nPlaying first pattern...');
    console.log('Pattern length:', samplerPattern.length, 'rows');
    
    // Calculate BPM from MOD Speed/Tempo
    const rowDuration = 60 / (loader.initialTempo * 24 / loader.initialSpeed);
    const bpm = 60 / rowDuration;
    
    console.log(`MOD timing: Speed=${loader.initialSpeed}, Tempo=${loader.initialTempo}`);
    console.log(`Row duration: ${rowDuration.toFixed(4)} seconds`);
    console.log(`Playing at ${bpm.toFixed(1)} BPM...`);
    
    sampler.playPattern(samplerPattern, { bpm }, () => {
      // Cleanup temp files
      fs.rmSync(tempDir, { recursive: true, force: true });
      console.log('Playback complete!');
      done();
    });
  }, 60000);

  test('play_mod_with_loader_api', (done) => {
    const loader = new ModLoader();
    
    loader.load(path.join(__dirname, 'songs', 'lotus20.mod'));
    
    console.log(`\n=== Playing ${loader.title} with loader API ===`);
    console.log(`Speed: ${loader.initialSpeed}, Tempo: ${loader.initialTempo}`);
    console.log(`BPM: ${loader.calculateBPM().toFixed(1)}`);
    
    // Play first 3 patterns (sampler is created internally)
    loader.play({
      startPattern: 0,
      numPatterns: 3,
      callback: () => {
        console.log('Playback complete!');
        done();
      }
    });
  }, 60000);

  test('analyze_effects', () => {
    const loader = new ModLoader();
    loader.load(path.join(__dirname, 'songs', 'lotus20.mod'));
    
    const effects = loader.analyzeEffects(0, 3);
    
    console.log('\n=== Effect usage in first 3 patterns ===');
    Object.entries(effects)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .forEach(([effect, count]) => {
        console.log(`  ${effect}: ${count} times`);
      });
    
    expect(Object.keys(effects).length).toBeGreaterThan(0);
  });

  test('get_looping_samples', () => {
    const loader = new ModLoader();
    loader.load(path.join(__dirname, 'songs', 'lotus20.mod'));
    
    const loopingSamples = loader.getLoopingSamples();
    
    console.log('\n=== Looping samples ===');
    loopingSamples.forEach(sample => {
      console.log(`  Sample ${sample.index}: ${sample.name} - loop ${sample.loopStart} to ${sample.loopStart + sample.loopLength}`);
    });
    
    expect(loopingSamples.length).toBeGreaterThanOrEqual(0);
  });
});
