const Sampler = require('./sampler');
const path = require('path');
const Speaker = require('speaker');

describe('Sampler', () => {
  let sampler;

  beforeEach(() => {
    sampler = new Sampler();
  });

  test('load', () => {
    const samplePath = path.join(__dirname, '..', 'data', 'samples', 'st-01', 'Steinway');
    sampler.loadSample('steinway', samplePath, { baseNote: 'C-2' });

    expect(sampler.hasSample('steinway')).toBe(true);
  });

  test('load_default_basenote', () => {
    const samplePath = path.join(__dirname, '..', 'data', 'samples', 'st-01', 'Steinway');
    sampler.loadSample('steinway', samplePath);

    const sample = sampler.getSample('steinway');
    expect(sample.baseNote).toBe('C-4');
  });

  test('load_custom_basenote', () => {
    const samplePath = path.join(__dirname, '..', 'data', 'samples', 'st-01', 'Steinway');
    sampler.loadSample('steinway', samplePath, { baseNote: 'C-2' });

    const sample = sampler.getSample('steinway');
    expect(sample.baseNote).toBe('C-2');
  });

  test('play', (done) => {
    const samplePath = path.join(__dirname, '..', 'data', 'samples', 'st-01', 'Steinway');
    sampler.loadSample('steinway', samplePath, { baseNote: 'C-2' });

    sampler.play('steinway', () => {
      done();
    });
  }, 5000);

  test('notes_semitones', (done) => {
    const samplePath = path.join(__dirname, '..', 'data', 'samples', 'st-01', 'Steinway');
    sampler.loadSample('steinway', samplePath, { baseNote: 'C-2' });

    // Do-Re-Mi-Do-Re-Mi
    const notes = [0, 2, 4, 0, 2, 4];

    sampler.playNotes('steinway', notes, () => {
      done();
    });
  }, 5000);

  test('notes_names', (done) => {
    const samplePath = path.join(__dirname, '..', 'data', 'samples', 'st-01', 'Steinway');
    sampler.loadSample('steinway', samplePath, { baseNote: 'C-2' });

    // Do-Re-Mi-Do-Re-Mi (C-2 to C-2 is same octave)
    const notes = ['C-2', 'D-2', 'E-2', 'C-2', 'D-2', 'E-2'];

    sampler.playNotes('steinway', notes, () => {
      done();
    });
  }, 5000);

  test('notes_octaves', (done) => {
    const samplePath = path.join(__dirname, '..', 'data', 'samples', 'st-01', 'Steinway');
    sampler.loadSample('steinway', samplePath, { baseNote: 'C-2' });

    // C-2, C-3 (one octave up), C-4 (two octaves up)
    const notes = ['C-2', 'C-3', 'C-4'];

    sampler.playNotes('steinway', notes, { gap: 0.5 }, () => {
      done();
    });
  }, 5000);

  test('pattern_4channel', (done) => {
    // Load drum samples
    const kickPath = path.join(__dirname, '..', 'data', 'samples', 'st-01', 'BassDrum1');
    const snarePath = path.join(__dirname, '..', 'data', 'samples', 'st-01', 'Snare1');
    const hihatPath = path.join(__dirname, '..', 'data', 'samples', 'st-01', 'HiHat1');

    sampler.loadSample('kick', kickPath, { baseNote: 'C-2' });
    sampler.loadSample('snare', snarePath, { baseNote: 'C-2' });
    sampler.loadSample('hihat', hihatPath, { baseNote: 'C-2' });

    // 4-channel Pattern (like Amiga)
    // Each row can have 0-4 steps (one per channel)
    // Unspecified channels are automatically silent
    const pattern = [
      // Row 0: Kick on Ch0, HiHat on Ch1
      [
        { sample: 'kick', note: 'C-2' },
        { sample: 'hihat', note: 'C-2' }
      ],
      // Row 1: HiHat on Ch1 only
      [
        null,
        { sample: 'hihat', note: 'C-2' }
      ],
      // Row 2: Snare on Ch0, HiHat on Ch1
      [
        { sample: 'snare', note: 'C-2' },
        { sample: 'hihat', note: 'C-2' }
      ],
      // Row 3: HiHat on Ch1 only
      [
        null,
        { sample: 'hihat', note: 'C-2' }
      ]
    ];

    // gap: 0.25 = BPM 240 (60/0.25 = 240)
    sampler.playPattern(pattern, { bpm: 240 }, () => {
      done();
    });
  }, 10000);

  test('pattern_simplified_interface', (done) => {
    const kickPath = path.join(__dirname, '..', 'data', 'samples', 'st-01', 'BassDrum1');
    const snarePath = path.join(__dirname, '..', 'data', 'samples', 'st-01', 'Snare1');
    const hihatPath = path.join(__dirname, '..', 'data', 'samples', 'st-01', 'HiHat1');

    sampler.loadSample('kick', kickPath, { baseNote: 'C-2' });
    sampler.loadSample('snare', snarePath, { baseNote: 'C-2' });
    sampler.loadSample('hihat', hihatPath, { baseNote: 'C-2' });

    // Simplified pattern - no need to specify null for unused channels
    const pattern = [
      // Row 0: Kick on Ch0, HiHat on Ch1 (Ch2, Ch3 auto-empty)
      [
        { sample: 'kick', note: 'C-2' },
        { sample: 'hihat', note: 'C-2' }
      ],
      // Row 1: Only HiHat on Ch0
      [
        { sample: 'hihat', note: 'C-2' }
      ],
      // Row 2: Snare on Ch0, HiHat on Ch1
      [
        { sample: 'snare', note: 'C-2' },
        { sample: 'hihat', note: 'C-2' }
      ],
      // Row 3: Only HiHat
      [
        { sample: 'hihat', note: 'C-2' }
      ]
    ];

    sampler.playPattern(pattern, { bpm: 240 }, () => {
      done();
    });
  }, 10000);

  test('pattern_repeat', (done) => {
    const kickPath = path.join(__dirname, '..', 'data', 'samples', 'st-01', 'BassDrum1');
    sampler.loadSample('kick', kickPath, { baseNote: 'C-2' });

    const pattern = [
      [{ sample: 'kick', note: 'C-2' }]
    ];

    // Repeat 3 times, BPM 240
    sampler.playPattern(pattern, { bpm: 240, repeat: 3 }, () => {
      done();
    });
  }, 5000);

  test('pattern_infinite_loop', (done) => {
    const kickPath = path.join(__dirname, '..', 'data', 'samples', 'st-01', 'BassDrum1');
    sampler.loadSample('kick', kickPath, { baseNote: 'C-2' });

    const pattern = [
      [{ sample: 'kick', note: 'C-2' }]
    ];

    // Infinite loop, BPM 240
    const playback = sampler.playPattern(pattern, { bpm: 240, repeat: -1 });

    // Stop after 2 seconds
    setTimeout(() => {
      playback.stop();
      done();
    }, 2000);
  }, 5000);

  test('pattern_4channel_timing_test', (done) => {
    // Load drum samples
    const kickPath = path.join(__dirname, '..', 'data', 'samples', 'st-01', 'BassDrum1');
    const snarePath = path.join(__dirname, '..', 'data', 'samples', 'st-01', 'Snare1');
    const hihatPath = path.join(__dirname, '..', 'data', 'samples', 'st-01', 'HiHat1');

    sampler.loadSample('kick', kickPath, { baseNote: 'C-2' });
    sampler.loadSample('snare', snarePath, { baseNote: 'C-2' });
    sampler.loadSample('hihat', hihatPath, { baseNote: 'C-2' });

    // Simple 4/4 beat pattern
    const pattern = [
      // Beat 1: Kick + HiHat
      [
        { sample: 'kick', note: 'C-2' },
        { sample: 'hihat', note: 'C-2' }
      ],
      // Beat 2: HiHat
      [
        { sample: 'hihat', note: 'C-2' }
      ],
      // Beat 3: Snare + HiHat
      [
        { sample: 'snare', note: 'C-2' },
        { sample: 'hihat', note: 'C-2' }
      ],
      // Beat 4: HiHat
      [
        { sample: 'hihat', note: 'C-2' }
      ]
    ];

    // Play 10 times to check timing consistency, BPM 240
    sampler.playPattern(pattern, { bpm: 240, repeat: 10 }, () => {
      done();
    });
  }, 30000); // 30 second timeout for 10 repeats

  test('pattern_bpm_basic', (done) => {
    const kickPath = path.join(__dirname, '..', 'data', 'samples', 'st-01', 'BassDrum1');
    sampler.loadSample('kick', kickPath, { baseNote: 'C-2' });

    const pattern = [
      [{ sample: 'kick', note: 'C-2' }],
      [],
      [{ sample: 'kick', note: 'C-2' }],
      []
    ];

    // BPM 120 = 120 beats per minute = 0.5 seconds per beat
    // Each row = 1 beat = 0.5 seconds
    // 4 rows = 2 seconds total
    sampler.playPattern(pattern, { bpm: 120 }, () => {
      done();
    });
  }, 5000);

  test('pattern_bpm_tempo_comparison', (done) => {
    const kickPath = path.join(__dirname, '..', 'data', 'samples', 'st-01', 'BassDrum1');
    sampler.loadSample('kick', kickPath, { baseNote: 'C-2' });

    const pattern = [
      [{ sample: 'kick', note: 'C-2' }, null, null, null]
    ];

    // Play at BPM 60 (slower), then BPM 240 (faster)
    // BPM 60 = 1 second per row
    // BPM 240 = 0.25 seconds per row
    sampler.playPattern(pattern, { bpm: 60, repeat: 2 }, () => {
      sampler.playPattern(pattern, { bpm: 240, repeat: 4 }, () => {
        done();
      });
    });
  }, 10000);

  test('technical_rhythm_16beat', (done) => {
    // Complex 16-beat drum pattern
    const kickPath = path.join(__dirname, '..', 'data', 'samples', 'st-01', 'BassDrum1');
    const snarePath = path.join(__dirname, '..', 'data', 'samples', 'st-01', 'Snare1');
    const hihatPath = path.join(__dirname, '..', 'data', 'samples', 'st-01', 'HiHat1');
    const closedHihatPath = path.join(__dirname, '..', 'data', 'samples', 'st-01', 'CloseHiHat');

    sampler.loadSample('kick', kickPath, { baseNote: 'C-2' });
    sampler.loadSample('snare', snarePath, { baseNote: 'C-2' });
    sampler.loadSample('hihat', hihatPath, { baseNote: 'C-2' });
    sampler.loadSample('closed_hihat', closedHihatPath, { baseNote: 'C-2' });

    // 16-beat pattern with complex hi-hat and kick variations
    const pattern = [
      // Beat 1
      [
        { sample: 'kick', note: 'C-2' },
        { sample: 'closed_hihat', note: 'C-2' }
      ],
      // Beat 2
      [
        null,
        { sample: 'closed_hihat', note: 'C-2' }
      ],
      // Beat 3
      [
        null,
        { sample: 'hihat', note: 'C-2' }
      ],
      // Beat 4
      [
        { sample: 'kick', note: 'C-2' },
        { sample: 'closed_hihat', note: 'C-2' }
      ],
      // Beat 5
      [
        { sample: 'snare', note: 'C-2' },
        { sample: 'closed_hihat', note: 'C-2' }
      ],
      // Beat 6
      [
        null,
        { sample: 'closed_hihat', note: 'C-2' }
      ],
      // Beat 7
      [
        { sample: 'kick', note: 'C-2' },
        { sample: 'hihat', note: 'C-2' }
      ],
      // Beat 8
      [
        null,
        { sample: 'closed_hihat', note: 'C-2' }
      ],
      // Beat 9
      [
        { sample: 'kick', note: 'C-2' },
        { sample: 'closed_hihat', note: 'C-2' }
      ],
      // Beat 10
      [
        null,
        { sample: 'closed_hihat', note: 'C-2' }
      ],
      // Beat 11
      [
        { sample: 'kick', note: 'C-2' },
        { sample: 'hihat', note: 'C-2' }
      ],
      // Beat 12
      [
        null,
        { sample: 'closed_hihat', note: 'C-2' }
      ],
      // Beat 13
      [
        { sample: 'snare', note: 'C-2' },
        { sample: 'closed_hihat', note: 'C-2' }
      ],
      // Beat 14
      [
        null,
        { sample: 'closed_hihat', note: 'C-2' }
      ],
      // Beat 15
      [
        null,
        { sample: 'hihat', note: 'C-2' }
      ],
      // Beat 16
      [
        { sample: 'kick', note: 'C-2' },
        { sample: 'closed_hihat', note: 'C-2' }
      ]
    ];

    // BPM 180 - fast 16-beat pattern
    sampler.playPattern(pattern, { bpm: 180, repeat: 2 }, () => {
      done();
    });
  }, 15000);

  test('melody_with_rhythm', (done) => {
    // Melody and drums playing together
    const pianoPath = path.join(__dirname, '..', 'data', 'samples', 'st-01', 'Steinway');
    const kickPath = path.join(__dirname, '..', 'data', 'samples', 'st-01', 'BassDrum1');
    const snarePath = path.join(__dirname, '..', 'data', 'samples', 'st-01', 'Snare1');
    const hihatPath = path.join(__dirname, '..', 'data', 'samples', 'st-01', 'CloseHiHat');

    sampler.loadSample('piano', pianoPath, { baseNote: 'C-2' });
    sampler.loadSample('kick', kickPath, { baseNote: 'C-2' });
    sampler.loadSample('snare', snarePath, { baseNote: 'C-2' });
    sampler.loadSample('hihat', hihatPath, { baseNote: 'C-2' });

    // Simple 8-bar pattern with melody on Ch0, drums on Ch1-3
    // Melody: C-D-E-C (4 notes)
    const pattern = [
      // Bar 1: C note + kick + hihat
      [
        { sample: 'piano', note: 'C-3' },
        { sample: 'kick', note: 'C-2' },
        { sample: 'hihat', note: 'C-2' }
      ],
      // Bar 2: hihat
      [
        null,
        null,
        { sample: 'hihat', note: 'C-2' }
      ],
      // Bar 3: D note + snare + hihat
      [
        { sample: 'piano', note: 'D-3' },
        { sample: 'snare', note: 'C-2' },
        { sample: 'hihat', note: 'C-2' }
      ],
      // Bar 4: hihat
      [
        null,
        null,
        { sample: 'hihat', note: 'C-2' }
      ],
      // Bar 5: E note + kick + hihat
      [
        { sample: 'piano', note: 'E-3' },
        { sample: 'kick', note: 'C-2' },
        { sample: 'hihat', note: 'C-2' }
      ],
      // Bar 6: hihat
      [
        null,
        null,
        { sample: 'hihat', note: 'C-2' }
      ],
      // Bar 7: C note + snare + hihat
      [
        { sample: 'piano', note: 'C-3' },
        { sample: 'snare', note: 'C-2' },
        { sample: 'hihat', note: 'C-2' }
      ],
      // Bar 8: kick + hihat (ending)
      [
        null,
        { sample: 'kick', note: 'C-2' },
        { sample: 'hihat', note: 'C-2' }
      ]
    ];

    // BPM 120 - medium tempo for melody
    sampler.playPattern(pattern, { bpm: 120, repeat: 2 }, () => {
      done();
    });
  }, 20000);

  test('play_note_with_volume', (done) => {
    const sampler = new Sampler();
    const samplePath = path.join(__dirname, '..', 'data', 'samples', 'st-01', 'BassDrum1');
    
    sampler.loadSample('kick', samplePath, { baseNote: 'C-2' });
    
    // Play same note with different volumes
    const pattern = [
      [{ sample: 'kick', note: 'C-2', volume: 64 }], // Full volume (MOD max = 64)
      [null],
      [{ sample: 'kick', note: 'C-2', volume: 32 }], // Half volume
      [null],
      [{ sample: 'kick', note: 'C-2', volume: 16 }], // Quarter volume
      [null],
      [{ sample: 'kick', note: 'C-2', volume: 0 }],  // Silent
      [null]
    ];
    
    console.log('Playing kick at different volumes: 64, 32, 16, 0');
    
    sampler.playPattern(pattern, { bpm: 240 }, () => {
      console.log('Done!');
      done();
    });
  }, 10000);

  test('play_pattern_with_panning', (done) => {
    const sampler = new Sampler();
    const samplePath = path.join(__dirname, '..', 'data', 'samples', 'st-01', 'BassDrum1');
    
    sampler.loadSample('kick', samplePath, { baseNote: 'C-2' });
    
    // Play same note on different channels with panning
    const pattern = [
      // Left channel
      [{ sample: 'kick', note: 'C-2', pan: 0 }],   // Full left
      [null],
      // Right channel  
      [{ sample: 'kick', note: 'C-2', pan: 255 }], // Full right
      [null],
      // Center
      [{ sample: 'kick', note: 'C-2', pan: 128 }], // Center
      [null],
      // Default (should be center)
      [{ sample: 'kick', note: 'C-2' }],
      [null]
    ];
    
    console.log('Playing with panning: Left, Right, Center, Default');
    
    sampler.playPattern(pattern, { bpm: 240 }, () => {
      console.log('Done!');
      done();
    });
  }, 10000);
});
