const Sampler = require('./sampler');
const path = require('path');

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

  test('pattern_beat', (done) => {
    // Load drum samples
    const kickPath = path.join(__dirname, 'samples', 'st-01', 'BassDrum1');
    const snarePath = path.join(__dirname, 'samples', 'st-01', 'Snare1');
    
    sampler.loadSample('kick', kickPath, { baseNote: 'C-2' });
    sampler.loadSample('snare', snarePath, { baseNote: 'C-2' });
    
    // Pattern: Kick - Snare - Kick - Snare
    const pattern = [
      { sample: 'kick', note: 'C-2' },
      { sample: 'snare', note: 'C-2' },
      { sample: 'kick', note: 'C-2' },
      { sample: 'snare', note: 'C-2' }
    ];
    
    sampler.playPattern(pattern, { gap: 0.25 }, () => {
      done();
    });
  }, 10000);
});
