// MOD Loader Integration Tests - Playback tests
const path = require('path');
const ModLoader = require('./mod-loader');

console.log('🎵 MOD Loader Integration Tests\n');

const loader = new ModLoader();
loader.load(path.join(__dirname, 'songs', 'lotus20.mod'));

console.log(`=== Playing ${loader.title} ===`);
console.log(`Speed: ${loader.initialSpeed}, Tempo: ${loader.initialTempo}`);
console.log(`BPM: ${loader.calculateBPM().toFixed(1)}`);
console.log('Playing first 3 patterns...\n');

loader.play({
  startPattern: 0,
  numPatterns: 3,
  callback: () => {
    console.log('\n✓ Playback complete!');
    process.exit(0);
  }
});
