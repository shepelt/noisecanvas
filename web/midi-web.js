// Web MIDI API integration for NoiseCanvas
// Handles MIDI device connection and note mapping

// Convert MIDI note number to musical notation (e.g., 60 -> C-4)
export function midiNoteToName(noteNumber) {
  const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const octave = Math.floor(noteNumber / 12) - 1;
  const noteIndex = noteNumber % 12;
  return `${noteNames[noteIndex]}-${octave}`;
}

// General MIDI drum map (note number -> sample name)
export const GM_DRUM_MAP = {
  36: 'kick',      // Bass Drum
  38: 'snare',     // Acoustic Snare
  42: 'hihat',     // Closed Hi-Hat
  46: 'hihat',     // Open Hi-Hat (using closed hi-hat sample for now)
  49: 'hihat'      // Crash Cymbal (using hi-hat sample for now)
};

// MIDI channel configuration
export const MIDI_CHANNELS = {
  DRUMS: 16,       // Channel 16 for drum pads
  MELODIC: 1       // Channel 1 for keyboard/melodic instruments
};

// Connect to Web MIDI and set up handlers
// Returns a promise that resolves to MIDIAccess object
export async function connectMIDI() {
  if (!navigator.requestMIDIAccess) {
    throw new Error('Web MIDI API not supported in this browser');
  }

  const midiAccess = await navigator.requestMIDIAccess();
  const inputs = Array.from(midiAccess.inputs.values());

  if (inputs.length === 0) {
    throw new Error('No MIDI devices found');
  }

  return midiAccess;
}

// Set up MIDI message handler for a sampler
// sampler: WebAudioSampler instance
// options: { drumMap, drumChannel, melodicChannel, melodicSample }
export function setupMIDIHandler(sampler, options = {}) {
  const {
    drumMap = GM_DRUM_MAP,
    drumChannel = MIDI_CHANNELS.DRUMS,
    melodicChannel = MIDI_CHANNELS.MELODIC,
    melodicSample = 'piano'
  } = options;

  return (event) => {
    const [status, note, velocity] = event.data;
    const messageType = status & 0xF0;
    const channel = (status & 0x0F) + 1;

    // Note On (0x90) with velocity > 0
    if (messageType === 0x90 && velocity > 0) {
      const noteName = midiNoteToName(note);
      console.log(`MIDI NOTE ON: ${noteName} (${note}) velocity=${velocity} channel=${channel}`);

      // Drum channel: map to drum samples
      if (channel === drumChannel) {
        if (drumMap[note]) {
          sampler.triggerNote(drumMap[note], 'C-2');
        } else {
          console.log(`Drum pad note ${note} not mapped`);
        }
      }
      // Melodic channel: play melodic instrument
      else if (channel === melodicChannel) {
        sampler.triggerNote(melodicSample, noteName);
      }
    }
    // Note Off (0x80) or Note On with velocity 0
    else if (messageType === 0x80 || (messageType === 0x90 && velocity === 0)) {
      const noteName = midiNoteToName(note);
      console.log(`MIDI NOTE OFF: ${noteName} (${note})`);
      // Note: Web Audio samples play to completion, no need to stop
    }
  };
}
