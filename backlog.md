# NoiseCanvas Backlog

## Completed Tasks

- TASK-1: Basic Sampler implementation with sample loading and playback
- TASK-2: Note playback system with semitone-based pitch shifting
- TASK-3: Configurable silence/gap between notes
- TASK-4: 4-channel pattern system (Amiga-style)
- TASK-5: Pattern repeat functionality (finite and infinite loops)
- TASK-6: Single Speaker + software mixing for 4 channels
- TASK-7: Sample length normalization for precise timing
- TASK-8: BPM-based timing system (replaced gap-based timing)
- TASK-9: Technical rhythm test - complex 16-beat drum pattern
- TASK-10: Simple melody + rhythm test (piano + drums together)
- TASK-11: MOD file loader and playback (see loader.js and README.md for details)
- TASK-12: S3M file loader and playback with correct pitch calculation (see s3m-loader.js)
- TASK-13: S3M volume handling improvements (see s3m-loader.js for details)
- TASK-14: Tick-based timing system for proper effect support
  - Implemented tick subdivision: 1 row = speed ticks (default: 6)
  - Tick duration calculation: tickDuration = 2.5 / tempo seconds
  - Note Delay effect (SDx) fully functional
  - Delayed notes trigger after x ticks without cutting previous notes
  - Foundation for future effects (volume slides, portamento, vibrato)
  - Tested with distance.s3m orders 2-4 (46 note delays)

## In-Progress

(none)

## TODO (Suggestions)

- TASK-15: Optimize mixing performance
  - Current: 33s for 32 channels × 256 rows (O(channels × ticks × samples))
  - Problem: Separate render + mix stages cause redundant buffer operations
  - Solution: Real-time rendering with inline mixing (render-mix-output pipeline)
  - Impact: Expected 10x speedup (3-5s total vs current 43s render+mix)
- TASK-16: Additional S3M effects (volume slides, portamento, vibrato, arpeggio, etc.)
- MOD/S3M effect support (portamento, vibrato, arpeggio, etc.)
- Real-time streaming engine (vs current offline rendering)
