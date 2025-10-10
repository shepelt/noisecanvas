// S3M Loader Integration Tests - Playback tests
const path = require('path');
const S3mLoader = require('./s3m-loader');

console.log('🎵 S3M Loader Integration Tests\n');

// Test 1: Play ZAK.S3M
console.log('=== Test 1: ZAK.S3M ===');
const zakLoader = new S3mLoader();
const zakPath = path.join(__dirname, 'songs', 'ZAK.S3M');
zakLoader.load(zakPath);

console.log(`Playing ${zakLoader.title}`);
console.log(`Speed: ${zakLoader.initialSpeed}, Tempo: ${zakLoader.initialTempo}`);
console.log(`BPM: ${zakLoader.calculateBPM().toFixed(1)}`);
console.log('Playing first 3 orders...\n');

zakLoader.play({
  startOrder: 0,
  numOrders: 3,
  callback: () => {
    console.log('\n✓ ZAK.S3M playback complete!\n');
    
    // Test 2: Play distance.s3m
    console.log('=== Test 2: distance.s3m ===');
    const distanceLoader = new S3mLoader();
    const distancePath = path.join(__dirname, 'songs', 'distance.s3m');
    
    console.log('Loading distance.s3m...');
    distanceLoader.load(distancePath);
    console.log('Loading complete');
    
    console.log(`Playing ${distanceLoader.title}`);
    console.log(`Speed: ${distanceLoader.initialSpeed}, Tempo: ${distanceLoader.initialTempo}`);
    console.log(`BPM: ${distanceLoader.calculateBPM().toFixed(1)}`);
    console.log(`Total orders: ${distanceLoader.orders.length}`);
    console.log('Playing first 4 orders...\n');
    
    distanceLoader.play({
      startOrder: 0,
      numOrders: 4,
      callback: () => {
        console.log('\n✓ distance.s3m playback complete!');
        console.log('\n✓ All S3M integration tests passed!');
        process.exit(0);
      }
    });
  }
});
