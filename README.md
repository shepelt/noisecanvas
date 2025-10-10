# NoiseCanvas

A sample-based music tracker engine for learning music theory through code.

## Overview

NoiseCanvas is built with a bottom-up approach where musical concepts emerge naturally from implementation. The goal is to learn music theory by building a music engine, not to build an educational product.

## Features

- **4-channel pattern system** - Amiga-style tracker with software mixing
- **BPM-based timing** - Precise rhythm control
- **MOD file support** - Load and play Amiga MOD files (15 and 31 sample formats)
- **Volume and panning** - Per-note volume control and stereo positioning
- **Sample looping** - Sustain sounds with loop points
- **Linear interpolation** - Smooth pitch shifting and resampling

## Quick Start

```javascript
const ModLoader = require('./loader');

// Load and play a MOD file
const loader = new ModLoader();
loader.load('songs/lotus20.mod');
loader.play({
  startPattern: 0,
  numPatterns: 3,
  callback: () => console.log('Done!')
});
```

## MOD File Analysis Tool

CLI tool for analyzing Amiga MOD files - designed to help humans and LLMs understand MOD file structure.

### Usage

```bash
node mod-info.js <modfile> [command]
```

### Commands

- `info` - Show basic MOD information (default)
- `samples` - List all samples with details
- `loops` - Show only looping samples
- `effects` - Analyze effect usage
- `patterns` - Show pattern information
- `all` - Show everything

### Examples

**Basic info:**
```bash
node mod-info.js songs/lotus20.mod
```

**Sample list:**
```bash
node mod-info.js songs/lotus20.mod samples
```

**Effect analysis:**
```bash
node mod-info.js songs/lotus20.mod effects
```

**Everything:**
```bash
node mod-info.js songs/lotus20.mod all
```

### Output Example

```
=== MOD File Information ===
File: lotus20.mod
Title: LOTUS 2
Patterns: 22 positions, 15 unique patterns
Speed: 6 ticks/row
Tempo: 125 BPM
Calculated BPM: 500.0
Samples: 13 non-empty

=== Effect Usage ===
C20:  880x  (Set Volume)
400:  164x  (Vibrato)
F06:  107x  (Set Speed/Tempo)
...
```

### For LLMs

This tool helps language models analyze MOD files by providing:

1. **File structure** - Quick overview of patterns, samples, tempo
2. **Effect analysis** - Which MOD effects are used and how often
3. **Sample inspection** - Names, sizes, volumes, and loop points
4. **Playback details** - Speed/tempo settings and pattern sequences

Example for complete analysis:
```bash
node mod-info.js songs/amegas.mod all
```

## Testing

```bash
npm test                    # Run all tests
npm run test:filter <name>  # Run specific test
```

## Pattern Composition System

Create and play pattern-based compositions using JSON format.

### Usage

```bash
node bin/play-pattern.js <pattern-file.json> [--repeat N]
```

### Pattern JSON Format

```json
{
  "preset": "drums",
  "bpm": 120,
  "pattern": [
    { "kick": "C-4", "hihat": "C-4" },
    { "hihat": "C-4" },
    { "snare": "C-4", "hihat": "C-4" },
    { "hihat": "C-4" }
  ]
}
```

### Examples

```bash
# Play once
node bin/play-pattern.js study/lesson1/01-kick-snare.json

# Repeat 4 times
node bin/play-pattern.js study/lesson1/02-basic-8beat.json --repeat 4
```

### Study Folder Structure

Pattern compositions organized by learning progression:

- `study/lesson1/` - Basic drum patterns (kick, snare, hihat)
- `study/lesson2/` - Lo-fi hip-hop rhythms and variations

### Available Presets

See `bin/presets.js` for all available sample presets.

**drums** - Ultimate Soundtracker drum kit
- kick: BassDrum1
- snare: Snare1
- hihat: CloseHiHat
- openhat: HiHat1
- smash: Smash1

## Samples

NoiseCanvas includes three sample collections. See `SAMPLES.md` for details on base notes and available instruments.

- **ST-01** - 100+ synth samples (piano, strings, drums)
- **808** - 9 classic drum machine sounds
- **OpenPath** - Professional multi-sampled instruments (4 volumes)

## Project Structure

```
/noisecanvas
  loader.js          # MOD file loader (documented)
  sampler.js         # Sample playback engine
  mod-info.js        # CLI analysis tool
  loader.test.js     # MOD loader tests
  sampler.test.js    # Sampler tests
  backlog.md         # Progress tracking
  SAMPLES.md         # Sample collection reference
  /bin
    play-pattern.js  # Pattern composition player
    presets.js       # Sample presets
  /study
    /lesson1         # Basic drum patterns
    /lesson2         # Lo-fi hip-hop rhythms
  /songs             # MOD files
  /data/samples      # Sample files
    /st-01           # Ultimate Soundtracker samples
    /808             # Classic drum machine
    /openpath        # Professional studio samples
```

## Development Philosophy

- **Bottom-up learning** - Build primitives first, discover patterns, then name concepts
- **TDD approach** - Test the sound/musical result, not just code
- **YAGNI principle** - Build only what's needed now
- **Listen first** - Experience the sound before learning the theory

See `AI_RULES.md` for detailed development guidelines.

## License

ISC
