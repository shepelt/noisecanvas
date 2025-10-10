#!/usr/bin/env node

/**
 * Convert ST-01 raw PCM samples to WAV format
 *
 * Handles both raw 8-bit signed PCM and 8SVX IFF format.
 * Strips IFF headers if present to avoid the "scratchy millisecond" bug.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const samplesDir = path.join(__dirname, '..', 'data', 'samples', 'st-01');

function convertSample(filename) {
  // Skip if already a WAV file
  if (filename.endsWith('.wav')) {
    return false;
  }

  const inputPath = path.join(samplesDir, filename);
  const outputPath = path.join(samplesDir, filename + '.wav');

  let data = fs.readFileSync(inputPath);

  // Check for IFF/8SVX header (starts with "FORM")
  if (data.length >= 4 && data.toString('ascii', 0, 4) === 'FORM') {
    console.log(`  ⚠️  ${filename}: IFF/8SVX header detected, stripping...`);

    // Find "BODY" chunk (actual PCM data)
    const bodyIndex = data.indexOf(Buffer.from('BODY'));
    if (bodyIndex !== -1) {
      // BODY chunk: "BODY" + 4-byte length + PCM data
      const dataStart = bodyIndex + 8;
      data = data.slice(dataStart);
      console.log(`  ✓  Stripped header, PCM data starts at byte ${dataStart}`);
    } else {
      console.log(`  ❌ Could not find BODY chunk, skipping conversion`);
      return false;
    }
  }

  // Create proper WAV file manually (16-bit PCM)
  // ST-01 samples are Amiga samples, typically 16574 Hz (PAL) or 16726 Hz (NTSC)
  // Using a common rate that works well for tracker samples
  const sampleRate = 16574;
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
  const blockAlign = numChannels * (bitsPerSample / 8);
  const dataSize = data.length * 2; // 8-bit to 16-bit doubles the size

  // Create WAV header
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + dataSize, 4); // File size - 8
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16); // fmt chunk size
  header.writeUInt16LE(1, 20); // PCM format
  header.writeUInt16LE(numChannels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write('data', 36);
  header.writeUInt32LE(dataSize, 40);

  // Convert 8-bit signed to 16-bit signed PCM data
  const pcmData = Buffer.alloc(dataSize);
  for (let i = 0; i < data.length; i++) {
    const sample8 = data.readInt8(i);
    const sample16 = sample8 * 256; // Scale to 16-bit
    pcmData.writeInt16LE(sample16, i * 2);
  }

  // Combine header and data
  const wavBuffer = Buffer.concat([header, pcmData]);
  fs.writeFileSync(outputPath, wavBuffer);
  console.log(`✓ ${filename} -> ${filename}.wav (${data.length} bytes)`);
  return true;
}

// Convert all samples
console.log('Converting ST-01 samples to WAV (in place)...\n');
const files = fs.readdirSync(samplesDir);

let converted = 0;
let skipped = 0;
files.forEach(file => {
  try {
    const result = convertSample(file);
    if (result === false) {
      skipped++;
    } else {
      converted++;
    }
  } catch (err) {
    console.error(`❌ Error converting ${file}:`, err.message);
  }
});

console.log(`\n✓ Converted ${converted} samples`);
console.log(`⊘ Skipped ${skipped} files (already WAV)`);
console.log(`Output: ${samplesDir}`);
