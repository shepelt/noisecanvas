// Standalone MIDI test (no Jest)
const JZZ = require('jzz');

console.log('🎹 Starting MIDI input test...\n');

JZZ().openMidiIn('MPK Mini Mk II')
  .or(function() {
    console.log('❌ Could not open MPK Mini Mk II');
    process.exit(1);
  })
  .and(function() {
    console.log('✓ MIDI input opened:', this.name());
    console.log('\n🎹 Press some keys on MPK mini...');
    console.log('   (Will run for 10 seconds)\n');
  })
  .connect(function(msg) {
    const status = msg[0];
    const note = msg[1];
    const velocity = msg[2];
    const messageType = status & 0xF0;
    
    if (messageType === 0x90 && velocity > 0) {
      console.log(`  NOTE ON:  note=${note} velocity=${velocity}`);
    } else if (messageType === 0x80 || (messageType === 0x90 && velocity === 0)) {
      console.log(`  NOTE OFF: note=${note}`);
    }
  })
  .wait(10000)
  .close()
  .and(function() {
    console.log('\n✓ Test complete!');
    process.exit(0);
  });
