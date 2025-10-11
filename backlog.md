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
- TASK-14: Tick-based timing system with Note Delay effect (SDx) support
- TASK-15: Sample-by-sample mixing (6x speedup, O(output_samples × active_channels))
- TASK-17: Pattern composition system (play-pattern CLI, JSON format, sample presets, study/ folder)
- TASK-18: Integration test separation (*.integration.js files for long-running playback tests)
- TASK-19: MOD/S3M loader API unification (standardized to startOrder/numOrders for public API)
- TASK-20: MIDI input test infrastructure (JZZ library, basic note detection, MIDI-to-note conversion)
- TASK-21: Project restructuring (separated data/, src/, and web/ directories)
- TASK-22: Web Audio-based sampler (WebAudioSampler class, ST-01 WAV conversion, Vite middleware for /data serving)
- TASK-23: Web MIDI integration (midi-web.js module, channel-based routing, General MIDI drum map support)

## In-Progress

- TASK-24: NoiseCanvas Server with MCP integration (Express + Vite hybrid, Electron-ready architecture)

## TODO (Suggestions)
