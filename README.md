# NoiseCanvas

A web-based sample playback engine for learning music theory through code.

## Overview

NoiseCanvas is built with a bottom-up approach where musical concepts emerge naturally from implementation. The goal is to learn music theory by building a music engine, not to build an educational product.

## Architecture

**Web-based audio engine** built on Web Audio API:
- **Express API server** - Pattern playback service with REST endpoints
- **Web Audio sampler** - Low-latency browser-based audio (5-15ms vs 3000ms in Node.js)
- **Pattern service** - Core business logic (transport-independent)
- **Web MIDI support** - Play samples via MIDI keyboard
- **MCP integration** - Control via Model Context Protocol

## Features

- **Sample-based playback** - Play notes with pitch shifting
- **Tempo control** - Precise BPM-based timing (rows per minute)
- **Web Audio API** - Hardware-accelerated audio in the browser
- **MIDI input** - Route MIDI keyboard to samples
- **Pattern system** - Compose and play note sequences
- **Volume and panning** - Per-note control
- **Sample looping** - Sustain sounds with loop points

## Quick Start

### Development

```bash
# Install dependencies
npm install

# Start API server (port 3001)
npm run dev

# Start Vite dev server (port 3000)
npm run dev:vite

# Run all tests
npm test
```

### API Usage

**Play notes via REST API:**
```bash
curl -X POST http://localhost:3001/api/play-notes \
  -H "Content-Type: application/json" \
  -d '{"notes": ["C", "D", "E"], "bpm": 120}'
```

**Web client polls for patterns:**
```javascript
// Client polls /api/pending-plays
const response = await fetch('http://localhost:3001/api/pending-plays');
const plays = await response.json();

// Play each pattern with Web Audio
plays.forEach(play => {
  sampler.playPattern(play.pattern, {
    tempo: play.tempo,  // rows per minute
    speed: play.speed,
    repeat: play.repeat
  });
});
```

### Web Audio Sampler

```javascript
import { WebAudioSampler } from './web/sampler-web.js';

// Create sampler
const sampler = new WebAudioSampler();

// Load sample
await sampler.loadSample('piano', '/data/samples/st-01/Steinway.wav', {
  baseNote: 'C-4'
});

// Play note
sampler.triggerNote('piano', 'D-4', { volume: 64 });

// Play pattern
const pattern = [
  { sample: 'piano', note: 'C-4', volume: 64 },
  { sample: 'piano', note: 'D-4', volume: 64 },
  { sample: 'piano', note: 'E-4', volume: 64 }
];
sampler.playPattern(pattern, { tempo: 480 }); // 120 BPM × 4
```

## Testing

```bash
# Run all tests (unit + web)
npm test

# Run unit tests only (Jest)
npm run test:unit

# Run web tests only (Playwright)
npm run test:web

# Run integration tests (standalone)
node test-api-integration.js
```

**Test coverage:**
- 17 Jest unit tests (PatternService logic)
- 19 Playwright tests (Web Audio functionality)
- 6 integration tests (API endpoints)
- **Total: 42 tests**

## Samples

NoiseCanvas includes sample collections:

- **ST-01** - 100+ Ultimate Soundtracker samples (piano, strings, drums)
- **808** - 9 classic drum machine sounds
- **OpenPath** - Professional multi-sampled instruments

See `SAMPLES.md` for details on base notes and available instruments.

## Project Structure

```
/noisecanvas
  /server
    server-simple.js        # Express API server
    /services
      PatternService.js     # Core pattern logic
      PatternService.test.js
    /routes
      api.js                # REST API endpoints
  /web
    sampler-web.js          # Web Audio sampler
    sampler-web.spec.js     # Playwright tests
    noisecanvas-client.js   # Polling client
    midi-web.js             # Web MIDI integration
    index.html              # Demo page
  /bin
    play-pattern.js         # Pattern player CLI (to be updated)
    presets.js              # Sample presets
  /data/samples
    /st-01                  # Ultimate Soundtracker
    /808                    # Drum machine
    /openpath               # Studio samples
  backlog.md                # Progress tracking
  SAMPLES.md                # Sample reference
  AI_RULES.md               # Development guidelines
```

## API Endpoints

**POST /api/play-notes**
```json
{
  "notes": ["C", "D", "E"],
  "bpm": 120,
  "instrument": "ST-01",
  "octave": 4
}
```

**GET /api/pending-plays**
Returns array of pending patterns for clients to play.

**GET /api/samples**
List available samples.

**GET /health**
Server health check.

## Development Philosophy

- **Bottom-up learning** - Build primitives first, discover patterns, then name concepts
- **TDD approach** - Test the sound/musical result, not just code
- **YAGNI principle** - Build only what's needed now
- **Listen first** - Experience the sound before learning the theory

See `AI_RULES.md` for detailed development guidelines.

## Tempo System

**Musical BPM vs Internal Tempo:**
- **Musical BPM** = quarter notes per minute (user-facing)
- **Internal tempo** = rows per minute (tracker timing)
- **Conversion**: `tempo = musical BPM × 4` (16th note resolution)

Example: 120 BPM = 480 rows/min

## License

ISC
