const Sampler = require('./sampler');
const path = require('path');
const Speaker = require('speaker');

describe('Sampler', () => {
  let sampler;

  beforeEach(() => {
    sampler = new Sampler();
  });

  test('load', () => {
    const samplePath = path.join(__dirname, 'samples', 'st-01', 'Steinway');
    sampler.loadSample('steinway', samplePath, { baseNote: 'C-2' });

    expect(sampler.hasSample('steinway')).toBe(true);
  });

  test('load_default_basenote', () => {
    const samplePath = path.join(__dirname, 'samples', 'st-01', 'Steinway');
    sampler.loadSample('steinway', samplePath);

    const sample = sampler.getSample('steinway');
    expect(sample.baseNote).toBe('C-4');
  });

  test('load_custom_basenote', () => {
    const samplePath = path.join(__dirname, 'samples', 'st-01', 'Steinway');
    sampler.loadSample('steinway', samplePath, { baseNote: 'C-2' });

    const sample = sampler.getSample('steinway');
    expect(sample.baseNote).toBe('C-2');
  });

  test('play', (done) => {
    const samplePath = path.join(__dirname, 'samples', 'st-01', 'Steinway');
    sampler.loadSample('steinway', samplePath, { baseNote: 'C-2' });

    sampler.play('steinway', () => {
      done();
    });
  }, 5000);

  test('notes_semitones', (done) => {
    const samplePath = path.join(__dirname, 'samples', 'st-01', 'Steinway');
    sampler.loadSample('steinway', samplePath, { baseNote: 'C-2' });

    // Do-Re-Mi-Do-Re-Mi
    const notes = [0, 2, 4, 0, 2, 4];

    sampler.playNotes('steinway', notes, () => {
      done();
    });
  }, 5000);

  test('notes_names', (done) => {
    const samplePath = path.join(__dirname, 'samples', 'st-01', 'Steinway');
    sampler.loadSample('steinway', samplePath, { baseNote: 'C-2' });

    // Do-Re-Mi-Do-Re-Mi (C-2 to C-2 is same octave)
    const notes = ['C-2', 'D-2', 'E-2', 'C-2', 'D-2', 'E-2'];

    sampler.playNotes('steinway', notes, () => {
      done();
    });
  }, 5000);

  test('notes_octaves', (done) => {
    const samplePath = path.join(__dirname, 'samples', 'st-01', 'Steinway');
    sampler.loadSample('steinway', samplePath, { baseNote: 'C-2' });

    // C-2, C-3 (one octave up), C-4 (two octaves up)
    const notes = ['C-2', 'C-3', 'C-4'];

    sampler.playNotes('steinway', notes, { gap: 0.5 }, () => {
      done();
    });
  }, 5000);

  test('pattern_4channel', (done) => {
    // Load drum samples
    const kickPath = path.join(__dirname, 'samples', 'st-01', 'BassDrum1');
    const snarePath = path.join(__dirname, 'samples', 'st-01', 'Snare1');
    const hihatPath = path.join(__dirname, 'samples', 'st-01', 'HiHat1');

    sampler.loadSample('kick', kickPath, { baseNote: 'C-2' });
    sampler.loadSample('snare', snarePath, { baseNote: 'C-2' });
    sampler.loadSample('hihat', hihatPath, { baseNote: 'C-2' });

    // 4-channel Pattern (like Amiga)
    // Each row has 4 slots (channels 0-3)
    // null = no sound on that channel
    const pattern = [
      // Row 0: Kick on Ch0, HiHat on Ch1
      [
        { sample: 'kick', note: 'C-2' },   // Channel 0
        { sample: 'hihat', note: 'C-2' },  // Channel 1
        null,                               // Channel 2
        null                                // Channel 3
      ],
      // Row 1: HiHat on Ch1
      [
        null,
        { sample: 'hihat', note: 'C-2' },
        null,
        null
      ],
      // Row 2: Snare on Ch0, HiHat on Ch1
      [
        { sample: 'snare', note: 'C-2' },
        { sample: 'hihat', note: 'C-2' },
        null,
        null
      ],
      // Row 3: HiHat on Ch1
      [
        null,
        { sample: 'hihat', note: 'C-2' },
        null,
        null
      ]
    ];

    sampler.playPattern(pattern, { gap: 0.25 }, () => {
      done();
    });
  }, 10000);

  test('pattern_repeat', (done) => {
    const kickPath = path.join(__dirname, 'samples', 'st-01', 'BassDrum1');
    sampler.loadSample('kick', kickPath, { baseNote: 'C-2' });

    const pattern = [
      [{ sample: 'kick', note: 'C-2' }, null, null, null]
    ];

    // Repeat 3 times
    sampler.playPattern(pattern, { gap: 0.25, repeat: 3 }, () => {
      done();
    });
  }, 5000);

  test('pattern_infinite_loop', (done) => {
    const kickPath = path.join(__dirname, 'samples', 'st-01', 'BassDrum1');
    sampler.loadSample('kick', kickPath, { baseNote: 'C-2' });

    const pattern = [
      [{ sample: 'kick', note: 'C-2' }, null, null, null]
    ];

    // Infinite loop
    const playback = sampler.playPattern(pattern, { gap: 0.25, repeat: -1 });

    // Stop after 2 seconds
    setTimeout(() => {
      playback.stop();
      done();
    }, 2000);
  }, 5000);

  test('pattern_4channel_timing_test', (done) => {
    // Load drum samples
    const kickPath = path.join(__dirname, 'samples', 'st-01', 'BassDrum1');
    const snarePath = path.join(__dirname, 'samples', 'st-01', 'Snare1');
    const hihatPath = path.join(__dirname, 'samples', 'st-01', 'HiHat1');

    sampler.loadSample('kick', kickPath, { baseNote: 'C-2' });
    sampler.loadSample('snare', snarePath, { baseNote: 'C-2' });
    sampler.loadSample('hihat', hihatPath, { baseNote: 'C-2' });

    // Simple 4/4 beat pattern
    const pattern = [
      // Beat 1: Kick + HiHat
      [
        { sample: 'kick', note: 'C-2' },
        { sample: 'hihat', note: 'C-2' },
        null,
        null
      ],
      // Beat 2: HiHat
      [
        null,
        { sample: 'hihat', note: 'C-2' },
        null,
        null
      ],
      // Beat 3: Snare + HiHat
      [
        { sample: 'snare', note: 'C-2' },
        { sample: 'hihat', note: 'C-2' },
        null,
        null
      ],
      // Beat 4: HiHat
      [
        null,
        { sample: 'hihat', note: 'C-2' },
        null,
        null
      ]
    ];

    // Play 10 times to check timing consistency
    sampler.playPattern(pattern, { gap: 0.25, repeat: 10 }, () => {
      done();
    });
  }, 30000); // 30 second timeout for 10 repeats
});
