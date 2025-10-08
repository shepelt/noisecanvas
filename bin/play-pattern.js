#!/usr/bin/env node

/**
 * play-pattern - CLI tool for playing pattern compositions
 * 
 * Usage:
 *   node bin/play-pattern.js <pattern-file.json> [--repeat N]
 * 
 * Options:
 *   --repeat N    Repeat pattern N times (default: 1)
 * 
 * Pattern JSON Format:
 *   {
 *     "preset": "drums",
 *     "bpm": 120,
 *     "pattern": [
 *       { "kick": "C-4", "hihat": "C-4" },
 *       { "hihat": "C-4" },
 *       { "snare": "C-4", "hihat": "C-4" },
 *       { "hihat": "C-4" }
 *     ]
 *   }
 * 
 * Examples:
 *   node bin/play-pattern.js study/01-kick-snare.json
 *   node bin/play-pattern.js study/01-kick-snare.json --repeat 4
 */

const fs = require('fs');
const path = require('path');
const Sampler = require('../sampler');
const PRESETS = require('./presets');

// Parse command line arguments
const args = process.argv.slice(2);

if (args.length === 0) {
  console.log('Usage: node bin/play-pattern.js <pattern-file.json> [--repeat N]');
  console.log('');
  console.log('Options:');
  console.log('  --repeat N    Repeat pattern N times (default: 1)');
  console.log('');
  console.log('Examples:');
  console.log('  node bin/play-pattern.js study/01-kick-snare.json');
  console.log('  node bin/play-pattern.js study/01-kick-snare.json --repeat 4');
  process.exit(1);
}

let patternFile = null;
let repeat = 1;

// Parse arguments
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--repeat') {
    if (i + 1 >= args.length) {
      console.error('Error: --repeat requires a number');
      process.exit(1);
    }
    repeat = parseInt(args[i + 1]);
    if (isNaN(repeat) || repeat < 1) {
      console.error('Error: --repeat must be a positive number');
      process.exit(1);
    }
    i++; // Skip next argument
  } else if (!patternFile) {
    patternFile = args[i];
  }
}

if (!patternFile) {
  console.error('Error: Pattern file not specified');
  process.exit(1);
}

// Check if file exists
if (!fs.existsSync(patternFile)) {
  console.error(`Error: Pattern file not found: ${patternFile}`);
  process.exit(1);
}

// Read and parse JSON
let patternData;
try {
  const jsonContent = fs.readFileSync(patternFile, 'utf8');
  patternData = JSON.parse(jsonContent);
} catch (err) {
  console.error(`Error: Failed to parse JSON: ${err.message}`);
  process.exit(1);
}

// Validate pattern data
if (!patternData.preset) {
  console.error('Error: "preset" field is required');
  process.exit(1);
}

if (!PRESETS[patternData.preset]) {
  console.error(`Error: Unknown preset "${patternData.preset}"`);
  console.error(`Available presets: ${Object.keys(PRESETS).join(', ')}`);
  process.exit(1);
}

if (!patternData.pattern || !Array.isArray(patternData.pattern)) {
  console.error('Error: "pattern" field is required and must be an array');
  process.exit(1);
}

const bpm = patternData.bpm || 120;
const preset = PRESETS[patternData.preset];

console.log(`Playing: ${path.basename(patternFile)}`);
console.log(`Preset: ${patternData.preset}`);
console.log(`BPM: ${bpm}`);
console.log(`Pattern length: ${patternData.pattern.length} rows`);
console.log(`Repeat: ${repeat} time(s)`);
console.log('');

// Create sampler and load samples
const sampler = new Sampler();

// Load all samples from preset
for (const [name, filepath] of Object.entries(preset)) {
  const fullPath = path.join(__dirname, '..', filepath);
  if (fs.existsSync(fullPath)) {
    sampler.loadSample(name, fullPath, { baseNote: 'C-4' });
    console.log(`Loaded: ${name} <- ${filepath}`);
  } else {
    console.warn(`Warning: Sample not found: ${filepath}`);
  }
}

console.log('');

// Convert JSON pattern to sampler pattern format
// JSON: [{ "kick": "C-4", "hihat": "C-4" }, ...]
// Sampler: [[{ sample: "kick", note: "C-4" }, { sample: "hihat", note: "C-4" }], ...]

const samplerPattern = patternData.pattern.map(row => {
  const channels = [];
  
  // Get all instrument names from preset
  for (const instrumentName of Object.keys(preset)) {
    if (row[instrumentName]) {
      channels.push({
        sample: instrumentName,
        note: row[instrumentName]
      });
    } else {
      channels.push(null);
    }
  }
  
  return channels;
});

// Play the pattern
console.log('Playing...');
sampler.playPattern(samplerPattern, {
  bpm: bpm,
  repeat: repeat
}, () => {
  console.log('Done!');
});
