/**
 * Sample presets for pattern compositions
 * 
 * Each preset defines a collection of samples mapped to instrument names.
 * Sample paths are relative to the noisecanvas root directory.
 */

const PRESETS = {
  drums: {
    kick: 'data/samples/st-01/BassDrum1',
    snare: 'data/samples/st-01/Snare1',
    hihat: 'data/samples/st-01/CloseHiHat',
    openhat: 'data/samples/st-01/HiHat1',
    smash: 'data/samples/st-01/Smash1'
  },

  lofi: {
    kick: 'data/samples/st-01/BassDrum1',
    snare: 'data/samples/st-01/Snare1',
    hihat: 'data/samples/st-01/CloseHiHat',
    openhat: 'data/samples/st-01/HiHat1',
    smash: 'data/samples/st-01/Smash1',
    melody: 'data/samples/st-01/EPiano',
    bass: 'data/samples/st-01/DeepBass',
    pad: 'data/samples/st-01/Strings1',
    lead: 'data/samples/st-01/DreamBells'
  }
};

module.exports = PRESETS;
