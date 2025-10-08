const fs = require('fs');
const path = require('path');
const Speaker = require('speaker');

describe('Sample Loading', () => {
  test('should load BassDrum1 sample', () => {
    const samplePath = path.join(__dirname, 'samples', 'st-01', 'BassDrum1');
    
    // Check if file exists
    expect(fs.existsSync(samplePath)).toBe(true);
    
    // Check if file can be read
    const data = fs.readFileSync(samplePath);
    
    // Verify data is present
    expect(data.length).toBeGreaterThan(0);
    expect(data.length).toBe(1100); // Actual size of BassDrum1
  });

  test('should read sample as 8-bit signed PCM', () => {
    const samplePath = path.join(__dirname, 'samples', 'st-01', 'BassDrum1');
    const data = fs.readFileSync(samplePath);
    
    // 8-bit signed PCM range: -128 to 127
    // Check first few bytes
    const firstByte = data.readInt8(0);
    expect(firstByte).toBeGreaterThanOrEqual(-128);
    expect(firstByte).toBeLessThanOrEqual(127);
  });

  test('should play Steinway sample', (done) => {
    const samplePath = path.join(__dirname, 'samples', 'st-01', 'Steinway');
    const sampleData = fs.readFileSync(samplePath);
    
    // Speaker setup: 44.1kHz, 16-bit, stereo
    const speaker = new Speaker({
      channels: 2,
      bitDepth: 16,
      sampleRate: 44100
    });
    
    // Convert 8-bit signed PCM to 16-bit stereo
    const outputBuffer = Buffer.alloc(sampleData.length * 4); // 2 channels * 2 bytes
    
    for (let i = 0; i < sampleData.length; i++) {
      // 8-bit signed (-128 to 127) to 16-bit signed (-32768 to 32767)
      const sample8bit = sampleData.readInt8(i);
      const sample16bit = sample8bit * 256; // Expand 8-bit to 16-bit
      
      // Write to both channels (stereo)
      outputBuffer.writeInt16LE(sample16bit, i * 4);
      outputBuffer.writeInt16LE(sample16bit, i * 4 + 2);
    }
    
    speaker.write(outputBuffer);
    speaker.end();
    
    speaker.once('close', () => {
      done();
    });
  }, 10000); // 10 second timeout

  test('doremi', (done) => {
    const samplePath = path.join(__dirname, 'samples', 'st-01', 'Steinway');
    const sampleData = fs.readFileSync(samplePath);
    
    const speaker = new Speaker({
      channels: 2,
      bitDepth: 16,
      sampleRate: 44100
    });
    
    // Do-Re-Mi-Do-Re-Mi = C-D-E-C-D-E (semitones: 0, 2, 4, 0, 2, 4)
    const notes = [0, 2, 4, 0, 2, 4]; // semitones
    const noteDuration = 0.3; // seconds
    const silence = 0.05; // gap between notes
    
    const buffers = [];
    
    for (const semitones of notes) {
      // Pitch shift: 2^(semitones/12)
      const pitchRatio = Math.pow(2, semitones / 12);
      
      // Resampling (simple nearest neighbor)
      const newLength = Math.floor(sampleData.length / pitchRatio);
      const noteBuffer = Buffer.alloc(newLength * 4);
      
      for (let i = 0; i < newLength; i++) {
        const sourceIndex = Math.floor(i * pitchRatio);
        if (sourceIndex < sampleData.length) {
          const sample8bit = sampleData.readInt8(sourceIndex);
          const sample16bit = sample8bit * 256;
          
          noteBuffer.writeInt16LE(sample16bit, i * 4);
          noteBuffer.writeInt16LE(sample16bit, i * 4 + 2);
        }
      }
      
      buffers.push(noteBuffer);
      
      // Add short silence
      const silenceSamples = Math.floor(44100 * silence);
      const silenceBuffer = Buffer.alloc(silenceSamples * 4);
      buffers.push(silenceBuffer);
    }
    
    // Concatenate all buffers
    const finalBuffer = Buffer.concat(buffers);
    
    speaker.write(finalBuffer);
    speaker.end();
    
    speaker.once('close', () => {
      done();
    });
  }, 10000);
});
