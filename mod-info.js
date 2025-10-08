#!/usr/bin/env node

/**
 * mod-info - CLI tool for analyzing MOD files
 * 
 * Usage:
 *   node mod-info.js <modfile> [command]
 * 
 * Commands:
 *   info      - Show basic MOD information (default)
 *   samples   - List all samples with details
 *   loops     - Show only looping samples
 *   effects   - Analyze effect usage
 *   patterns  - Show pattern information
 *   all       - Show everything
 * 
 * Examples:
 *   node mod-info.js songs/lotus20.mod
 *   node mod-info.js songs/lotus20.mod samples
 *   node mod-info.js songs/lotus20.mod effects
 */

const ModLoader = require('./mod-loader');
const path = require('path');

const args = process.argv.slice(2);

if (args.length === 0) {
  console.log('Usage: node mod-info.js <modfile> [command]');
  console.log('');
  console.log('Commands:');
  console.log('  info      - Show basic MOD information (default)');
  console.log('  samples   - List all samples with details');
  console.log('  loops     - Show only looping samples');
  console.log('  effects   - Analyze effect usage');
  console.log('  patterns  - Show pattern information');
  console.log('  all       - Show everything');
  process.exit(1);
}

const modFile = args[0];
const command = args[1] || 'info';

try {
  const loader = new ModLoader();
  loader.load(modFile);

  // Basic info
  const showInfo = () => {
    console.log('\n=== MOD File Information ===');
    console.log(`File: ${path.basename(modFile)}`);
    console.log(`Title: ${loader.title}`);
    console.log(`Patterns: ${loader.numPatterns} positions, ${loader.patterns.length} unique patterns`);
    console.log(`Speed: ${loader.initialSpeed} ticks/row`);
    console.log(`Tempo: ${loader.initialTempo} BPM`);
    console.log(`Calculated BPM: ${loader.calculateBPM().toFixed(1)}`);
    
    const nonEmptySamples = loader.samples.filter(s => s.length > 0);
    console.log(`Samples: ${nonEmptySamples.length} non-empty`);
  };

  // Sample list
  const showSamples = () => {
    console.log('\n=== Sample Information ===');
    loader.samples.forEach((sample, idx) => {
      if (sample.length > 0) {
        const loopInfo = sample.loopLength > 2 
          ? `loop ${sample.loopStart}-${sample.loopStart + sample.loopLength}` 
          : 'no loop';
        console.log(`${idx.toString().padStart(2)}: ${sample.name.padEnd(22)} ${sample.length.toString().padStart(6)}b  vol:${sample.volume.toString().padStart(2)}  ${loopInfo}`);
      }
    });
  };

  // Looping samples
  const showLoops = () => {
    const loopingSamples = loader.getLoopingSamples();
    console.log('\n=== Looping Samples ===');
    
    if (loopingSamples.length === 0) {
      console.log('No looping samples found.');
      return;
    }

    loopingSamples.forEach(sample => {
      console.log(`${sample.index.toString().padStart(2)}: ${sample.name.padEnd(22)} loop ${sample.loopStart}-${sample.loopStart + sample.loopLength} (${sample.loopLength}b)`);
    });
  };

  // Effect analysis
  const showEffects = () => {
    const effects = loader.analyzeEffects();
    console.log('\n=== Effect Usage ===');
    
    const sorted = Object.entries(effects).sort((a, b) => b[1] - a[1]);
    
    const effectNames = {
      '0': 'Arpeggio',
      '1': 'Portamento Up',
      '2': 'Portamento Down',
      '3': 'Tone Portamento',
      '4': 'Vibrato',
      '5': 'Tone Portamento + Volume Slide',
      '6': 'Vibrato + Volume Slide',
      '7': 'Tremolo',
      '9': 'Sample Offset',
      'A': 'Volume Slide',
      'B': 'Position Jump',
      'C': 'Set Volume',
      'D': 'Pattern Break',
      'E': 'Extended Effects',
      'F': 'Set Speed/Tempo'
    };

    sorted.forEach(([effect, count]) => {
      const effectType = effect.charAt(0);
      const effectName = effectNames[effectType] || 'Unknown';
      console.log(`${effect}: ${count.toString().padStart(4)}x  (${effectName})`);
    });
  };

  // Pattern information
  const showPatterns = () => {
    console.log('\n=== Pattern Information ===');
    console.log(`Pattern sequence (${loader.patternTable.length} positions):`);
    
    // Show pattern table in rows of 16
    for (let i = 0; i < loader.patternTable.length; i += 16) {
      const row = loader.patternTable.slice(i, i + 16)
        .map(p => p.toString(16).toUpperCase().padStart(2, '0'))
        .join(' ');
      console.log(`${i.toString().padStart(3)}: ${row}`);
    }
    
    console.log(`\nUnique patterns: ${loader.patterns.length}`);
  };

  // Execute command
  switch (command) {
    case 'info':
      showInfo();
      break;
    case 'samples':
      showInfo();
      showSamples();
      break;
    case 'loops':
      showInfo();
      showLoops();
      break;
    case 'effects':
      showInfo();
      showEffects();
      break;
    case 'patterns':
      showInfo();
      showPatterns();
      break;
    case 'all':
      showInfo();
      showSamples();
      showLoops();
      showEffects();
      showPatterns();
      break;
    default:
      console.error(`Unknown command: ${command}`);
      console.log('Available commands: info, samples, loops, effects, patterns, all');
      process.exit(1);
  }

  console.log('');

} catch (error) {
  console.error('Error:', error.message);
  process.exit(1);
}
