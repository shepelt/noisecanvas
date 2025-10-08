const path = require('path');
const ModLoader = require('./mod-loader');

describe('MOD Loader', () => {
  const modPath = path.join(__dirname, 'songs', 'song.mod');
  let loader;

  beforeEach(() => {
    loader = new ModLoader();
  });

  test('load_mod_file', () => {
    loader.load(modPath);
    
    // Check basic properties
    expect(loader.title).toBeDefined();
    expect(loader.samples.length).toBe(31);
    expect(loader.numPatterns).toBeGreaterThan(0);
    expect(loader.patterns.length).toBeGreaterThan(0);
    
    // Check pattern structure
    const firstPattern = loader.patterns[0];
    expect(firstPattern.length).toBe(64); // 64 rows
    expect(firstPattern[0].length).toBe(4); // 4 channels
    
    // Check sample data is loaded
    const nonEmptySamples = loader.samples.filter(s => s.length > 0);
    expect(nonEmptySamples.length).toBeGreaterThan(0);
    expect(nonEmptySamples[0].data).toBeDefined();
    
    console.log('Song:', loader.title);
    console.log('Patterns:', loader.patterns.length);
    console.log('Non-empty samples:', nonEmptySamples.length);
  });

  test('play_mod_file', (done) => {
    loader.load(path.join(__dirname, 'songs', 'lotus20.mod'));
    
    console.log(`\n=== Playing ${loader.title} ===`);
    console.log(`Speed: ${loader.initialSpeed}, Tempo: ${loader.initialTempo}`);
    console.log(`BPM: ${loader.calculateBPM().toFixed(1)}`);
    
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
    loader.load(path.join(__dirname, 'songs', 'lotus20.mod'));
    
    const effects = loader.analyzeEffects(0, 3);
    
    console.log('\n=== Effect usage (first 3 patterns) ===');
    Object.entries(effects)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .forEach(([effect, count]) => {
        console.log(`  ${effect}: ${count} times`);
      });
    
    expect(Object.keys(effects).length).toBeGreaterThan(0);
  });

  test('get_looping_samples', () => {
    loader.load(path.join(__dirname, 'songs', 'lotus20.mod'));
    
    const loopingSamples = loader.getLoopingSamples();
    
    console.log('\n=== Looping samples ===');
    loopingSamples.forEach(sample => {
      console.log(`  Sample ${sample.index}: ${sample.name}`);
    });
    
    expect(loopingSamples.length).toBeGreaterThanOrEqual(0);
  });
});
