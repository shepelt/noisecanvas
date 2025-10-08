const path = require('path');
const S3mLoader = require('./s3m-loader');

describe('S3M Loader', () => {
  const s3mPath = path.join(__dirname, 'songs', 'ZAK.S3M');
  let loader;

  beforeEach(() => {
    loader = new S3mLoader();
  });

  test('load_s3m_file', () => {
    loader.load(s3mPath);

    expect(loader.title).toBe('Zak-zaka-zak-zak');
    expect(loader.format).toBe('S3M');
    expect(loader.initialSpeed).toBe(2);
    expect(loader.initialTempo).toBe(125);

    console.log('Song title:', loader.title);
    console.log('Format:', loader.format);
    console.log('Speed:', loader.initialSpeed);
    console.log('Tempo:', loader.initialTempo);
  });

  test('read_instrument_info', () => {
    loader.load(s3mPath);

    expect(loader.instruments).toBeDefined();
    expect(loader.instruments.length).toBe(loader.instrumentCount);

    const nonEmptyInstruments = loader.instruments.filter(i => i.length > 0);

    expect(nonEmptyInstruments.length).toBeGreaterThan(0);

    console.log('\nInstrument Information:');
    console.log('Total instruments:', loader.instrumentCount);
    console.log('Non-empty instruments:', nonEmptyInstruments.length);
  });

  test('read_sample_data', () => {
    loader.load(s3mPath);

    const instrument = loader.instruments.find(i => i.length > 0);

    expect(instrument).toBeDefined();
    expect(instrument.data).toBeDefined();
    expect(instrument.data.length).toBe(instrument.length);

    console.log('\nSample data loaded for:', instrument.name);
    console.log('Length:', instrument.data.length, 'bytes');
  });

  test('read_pattern_data', () => {
    loader.load(s3mPath);

    expect(loader.patterns).toBeDefined();
    expect(loader.patterns.length).toBeGreaterThan(0);

    const firstPattern = loader.patterns[0];
    expect(firstPattern).toBeDefined();
    expect(firstPattern.length).toBe(64);

    console.log('\nFirst pattern loaded');
    console.log('Pattern count:', loader.patterns.length);
  });

  test('debug_s3m_playback', (done) => {
    loader.load(s3mPath);

    console.log(`\n=== Debug S3M Playback ===`);
    console.log(`Song: ${loader.title}`);
    console.log(`Speed: ${loader.initialSpeed}, Tempo: ${loader.initialTempo}`);
    console.log(`Global Volume: ${loader.globalVolume}`);

    // Check instrument info
    const nonEmptyInsts = loader.instruments.filter(i => i.length > 0);
    console.log(`\nInstruments (${nonEmptyInsts.length} total):`);
    nonEmptyInsts.slice(0, 5).forEach((inst, idx) => {
      const semitoneOffset = Math.round(12 * Math.log2(inst.c4speed / 8363));
      const baseOctave = 4 + Math.floor(semitoneOffset / 12);
      const baseNoteIdx = ((semitoneOffset % 12) + 12) % 12;
      const notes = ['C-', 'C#', 'D-', 'D#', 'E-', 'F-', 'F#', 'G-', 'G#', 'A-', 'A#', 'B-'];
      const baseNote = notes[baseNoteIdx] + baseOctave;

      console.log(`  [${idx}] ${inst.name}`);
      console.log(`      C4Speed: ${inst.c4speed} Hz -> Base Note: ${baseNote}`);
      console.log(`      Volume: ${inst.volume}, Length: ${inst.length} bytes`);
    });

    // Check first pattern
    const firstPattern = loader.patterns[loader.orders[0]];
    console.log(`\nFirst pattern (order 0):`);
    let notesFound = 0;
    for (let row = 0; row < Math.min(16, firstPattern.length) && notesFound < 10; row++) {
      const notes = firstPattern[row].filter(ch => ch && ch.note !== null);
      if (notes.length > 0) {
        console.log(`  Row ${row}:`, notes.map(n => ({
          ch: firstPattern[row].indexOf(n),
          inst: n.instrument,
          note: n.note,
          vol: n.volume
        })));
        notesFound += notes.length;
      }
    }

    done();
  });

  test('play_s3m_file', (done) => {
    loader.load(s3mPath);

    console.log(`\n=== Playing ${loader.title} ===`);
    console.log(`Speed: ${loader.initialSpeed}, Tempo: ${loader.initialTempo}`);
    console.log(`BPM: ${loader.calculateBPM().toFixed(1)}`);

    loader.play({
      startOrder: 0,
      numOrders: 3,
      callback: () => {
        console.log('Playback complete!');
        done();
      }
    });
  }, 120000);

  test('check_instrument_mapping', () => {
    loader.load(s3mPath);

    console.log('\n=== Instrument Index Mapping ===');

    // Check which instruments are actually used in patterns
    const usedInstruments = new Set();
    const firstPattern = loader.patterns[loader.orders[0]];

    for (let row = 0; row < firstPattern.length; row++) {
      for (let ch = 0; ch < 32; ch++) {
        const cell = firstPattern[row][ch];
        if (cell && cell.instrument) {
          usedInstruments.add(cell.instrument);
        }
      }
    }

    console.log('Instruments used in first pattern:', Array.from(usedInstruments).sort((a, b) => a - b));
    console.log('\nInstrument details:');

    Array.from(usedInstruments).sort((a, b) => a - b).slice(0, 10).forEach(instNum => {
      const inst = loader.instruments[instNum - 1];
      if (inst) {
        console.log(`  Inst ${instNum} -> Array index ${instNum - 1}:`);
        console.log(`    Name: "${inst.name}"`);
        console.log(`    Length: ${inst.length}, C4Speed: ${inst.c4speed}`);
      } else {
        console.log(`  Inst ${instNum} -> NOT FOUND in array`);
      }
    });
  });

  // Play distance.s3m from the beginning
  test('play_distance_s3m', (done) => {
    const distancePath = path.join(__dirname, 'songs', 'distance.s3m');
    const distanceLoader = new S3mLoader();
    console.log("loading started")
    distanceLoader.load(distancePath);
    console.log("loading complete")

    console.log(`\n=== Playing distance.s3m (orders 0-3) ===`);
    console.log(`Song: ${distanceLoader.title}`);
    console.log(`Speed: ${distanceLoader.initialSpeed}, Tempo: ${distanceLoader.initialTempo}`);
    console.log(`BPM: ${distanceLoader.calculateBPM().toFixed(1)}`);
    console.log(`Total orders: ${distanceLoader.orders.length}`);
    console.log("playing...")
    distanceLoader.play({
      startOrder: 0,
      numOrders: 4,
      callback: () => {
        console.log('Playback complete!');
        done();
      }
    });
  }, 120000);
});
