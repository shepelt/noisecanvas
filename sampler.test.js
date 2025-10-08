const Sampler = require('./sampler');
const path = require('path');

describe('Sampler', () => {
  let sampler;

  beforeEach(() => {
    sampler = new Sampler();
  });

  test('should load a sample', () => {
    const samplePath = path.join(__dirname, 'samples', 'st-01', 'Steinway');
    sampler.loadSample('steinway', samplePath, { baseNote: 'C-2' });
    
    expect(sampler.hasSample('steinway')).toBe(true);
  });

  test('should load sample with default base note C-4', () => {
    const samplePath = path.join(__dirname, 'samples', 'st-01', 'Steinway');
    sampler.loadSample('steinway', samplePath);
    
    const sample = sampler.getSample('steinway');
    expect(sample.baseNote).toBe('C-4');
  });

  test('should load sample with custom base note', () => {
    const samplePath = path.join(__dirname, 'samples', 'st-01', 'Steinway');
    sampler.loadSample('steinway', samplePath, { baseNote: 'C-2' });
    
    const sample = sampler.getSample('steinway');
    expect(sample.baseNote).toBe('C-2');
  });

  test('should play a loaded sample', (done) => {
    const samplePath = path.join(__dirname, 'samples', 'st-01', 'Steinway');
    sampler.loadSample('steinway', samplePath, { baseNote: 'C-2' });
    
    sampler.play('steinway', () => {
      done();
    });
  }, 5000);

  test('should play notes sequence with semitones', (done) => {
    const samplePath = path.join(__dirname, 'samples', 'st-01', 'Steinway');
    sampler.loadSample('steinway', samplePath, { baseNote: 'C-2' });
    
    // Do-Re-Mi-Do-Re-Mi
    const notes = [0, 2, 4, 0, 2, 4];
    
    sampler.playNotes('steinway', notes, () => {
      done();
    });
  }, 5000);

  test('should play notes sequence with note names', (done) => {
    const samplePath = path.join(__dirname, 'samples', 'st-01', 'Steinway');
    sampler.loadSample('steinway', samplePath, { baseNote: 'C-2' });
    
    // Do-Re-Mi-Do-Re-Mi (C-2 to C-2 is same octave)
    const notes = ['C-2', 'D-2', 'E-2', 'C-2', 'D-2', 'E-2'];
    
    sampler.playNotes('steinway', notes, () => {
      done();
    });
  }, 5000);

  test('should play notes across different octaves', (done) => {
    const samplePath = path.join(__dirname, 'samples', 'st-01', 'Steinway');
    sampler.loadSample('steinway', samplePath, { baseNote: 'C-2' });
    
    // C-2, C-3 (one octave up), C-4 (two octaves up)
    const notes = ['C-2', 'C-3', 'C-4'];
    
    sampler.playNotes('steinway', notes, { gap: 0.5 }, () => {
      done();
    });
  }, 5000);
});
