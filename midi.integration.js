// Standalone MIDI test (no Jest)
const JZZ = require('jzz');

// Convert MIDI note number to musical notation (e.g., 60 -> C4)
function midiNoteToName(noteNumber) {
  const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const octave = Math.floor(noteNumber / 12) - 1;
  const noteIndex = noteNumber % 12;
  return `${noteNames[noteIndex]}-${octave}`;
}

console.log('🎹 Starting MIDI input test...\n');

JZZ().and(async function() {
  const info = await this.info();
  
  if (info.inputs.length === 0) {
    console.log('❌ No MIDI input devices found');
    process.exit(1);
  }
  
  console.log('Available MIDI inputs:');
  info.inputs.forEach((input, idx) => {
    console.log(`  [${idx}] ${input.name}`);
  });
  
  const firstInput = info.inputs[0];
  console.log(`\nUsing: ${firstInput.name}\n`);
  
  this.openMidiIn(firstInput.name)
    .or(function() {
      console.log(`❌ Could not open ${firstInput.name}`);
      process.exit(1);
    })
    .and(function() {
      console.log('✓ MIDI input opened:', this.name());
      console.log('\n🎹 Press some keys...');
      console.log('   (Will run for 10 seconds)\n');
    })
    .connect(function(msg) {
      const status = msg[0];
      const note = msg[1];
      const velocity = msg[2];
      const messageType = status & 0xF0;
      
      if (messageType === 0x90 && velocity > 0) {
        const noteName = midiNoteToName(note);
        console.log(`  NOTE ON:  ${noteName} (${note}) velocity=${velocity}`);
      } else if (messageType === 0x80 || (messageType === 0x90 && velocity === 0)) {
        const noteName = midiNoteToName(note);
        console.log(`  NOTE OFF: ${noteName} (${note})`);
      }
    })
    .wait(10000)
    .close()
    .and(function() {
      console.log('\n✓ Test complete!');
      process.exit(0);
    });
});
