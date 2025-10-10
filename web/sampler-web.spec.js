import { test, expect } from '@playwright/test';

/**
 * Web Audio Sampler Tests
 * 
 * These tests verify that Web Audio API functions work without errors.
 * Like sampler.test.js, the actual sound quality must be verified by listening.
 * 
 * Test strategy:
 * - Automated: Check that functions complete without throwing errors
 * - Manual: Run tests and listen to verify pitch, timing, volume, panning
 */

test.describe('WebAudioSampler', () => {
  
  test.beforeEach(async ({ page }) => {
    // Navigate to test page
    await page.goto('/sampler-web.test.html');
    
    // Wait for sampler initialization
    await page.waitForFunction(() => {
      return window.sampler && window.sampler.hasSample('piano');
    });
  });

  test('load_sample', async ({ page }) => {
    const hasSample = await page.evaluate(() => {
      return window.sampler.hasSample('piano');
    });
    
    expect(hasSample).toBe(true);
  });

  test('get_sample_metadata', async ({ page }) => {
    const metadata = await page.evaluate(() => {
      const sample = window.sampler.getSample('piano');
      return {
        hasBuffer: sample.buffer !== null,
        baseNote: sample.baseNote,
        hasLoop: sample.hasLoop
      };
    });
    
    expect(metadata.hasBuffer).toBe(true);
    expect(metadata.baseNote).toBe('C-4');
    expect(metadata.hasLoop).toBe(false);
  });

  test('trigger_note_C4', async ({ page }) => {
    const result = await page.evaluate(async () => {
      await window.sampler.resume();
      const source = window.sampler.triggerNote('piano', 'C-4');
      
      // Wait for sound to play
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      return source !== null;
    });
    
    expect(result).toBe(true);
  });

  test('trigger_note_different_pitches', async ({ page }) => {
    const result = await page.evaluate(async () => {
      await window.sampler.resume();
      
      // Play C-4, D-4, E-4, G-4 in sequence
      const notes = ['C-4', 'D-4', 'E-4', 'G-4'];
      
      for (const note of notes) {
        window.sampler.triggerNote('piano', note);
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      return true;
    });
    
    expect(result).toBe(true);
  });

  test('trigger_note_octaves', async ({ page }) => {
    const result = await page.evaluate(async () => {
      await window.sampler.resume();
      
      // Play C-3, C-4, C-5 (different octaves)
      const notes = ['C-3', 'C-4', 'C-5'];
      
      for (const note of notes) {
        window.sampler.triggerNote('piano', note);
        await new Promise(resolve => setTimeout(resolve, 800));
      }
      
      return true;
    });
    
    expect(result).toBe(true);
  });

  test('trigger_note_with_volume', async ({ page }) => {
    const result = await page.evaluate(async () => {
      await window.sampler.resume();
      
      // Play same note with different volumes
      const volumes = [64, 32, 16, 0];
      
      for (const volume of volumes) {
        window.sampler.triggerNote('piano', 'C-4', { volume });
        await new Promise(resolve => setTimeout(resolve, 600));
      }
      
      return true;
    });
    
    expect(result).toBe(true);
  });

  test('trigger_note_with_panning', async ({ page }) => {
    const result = await page.evaluate(async () => {
      await window.sampler.resume();
      
      // Play with different panning: left, center, right
      const pannings = [0, 128, 255];
      
      for (const pan of pannings) {
        window.sampler.triggerNote('piano', 'C-4', { pan });
        await new Promise(resolve => setTimeout(resolve, 600));
      }
      
      return true;
    });
    
    expect(result).toBe(true);
  });

  test('play_pattern_basic', async ({ page }) => {
    const result = await page.evaluate(async () => {
      await window.sampler.resume();
      
      // Simple 4-beat pattern
      const pattern = [
        [{ sample: 'piano', note: 'C-4', volume: 64 }],
        [{ sample: 'piano', note: 'E-4', volume: 48 }],
        [{ sample: 'piano', note: 'G-4', volume: 56 }],
        [{ sample: 'piano', note: 'C-5', volume: 64 }],
      ];
      
      window.sampler.playPattern(pattern, { bpm: 120, repeat: 1 });
      
      // Wait for pattern to complete (4 beats at 120 BPM = 2 seconds)
      await new Promise(resolve => setTimeout(resolve, 2500));
      
      return true;
    });
    
    expect(result).toBe(true);
  });

  test('play_pattern_with_repeat', async ({ page }) => {
    const result = await page.evaluate(async () => {
      await window.sampler.resume();
      
      const pattern = [
        [{ sample: 'piano', note: 'C-4' }],
        [{ sample: 'piano', note: 'E-4' }],
      ];
      
      window.sampler.playPattern(pattern, { bpm: 240, repeat: 3 });
      
      // Wait for 3 repeats (2 beats × 3 repeats at 240 BPM = 1.5 seconds)
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      return true;
    });
    
    expect(result).toBe(true);
  });

  test('play_pattern_different_bpm', async ({ page }) => {
    const result = await page.evaluate(async () => {
      await window.sampler.resume();
      
      const pattern = [
        [{ sample: 'piano', note: 'C-4' }],
      ];
      
      // Play at BPM 60 (slow)
      window.sampler.playPattern(pattern, { bpm: 60, repeat: 2 });
      await new Promise(resolve => setTimeout(resolve, 2500));
      
      // Play at BPM 240 (fast)
      window.sampler.playPattern(pattern, { bpm: 240, repeat: 4 });
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      return true;
    });
    
    expect(result).toBe(true);
  });

  test('note_conversion_logic', async ({ page }) => {
    // Test noteToSemitones function (pure logic test)
    const results = await page.evaluate(() => {
      const sampler = window.sampler;
      
      return {
        sameNote: sampler.noteToSemitones('C-4', 'C-4'),
        wholeTone: sampler.noteToSemitones('D-4', 'C-4'),
        majorThird: sampler.noteToSemitones('E-4', 'C-4'),
        perfectFifth: sampler.noteToSemitones('G-4', 'C-4'),
        octaveUp: sampler.noteToSemitones('C-5', 'C-4'),
        octaveDown: sampler.noteToSemitones('C-3', 'C-4'),
      };
    });
    
    expect(results.sameNote).toBe(0);
    expect(results.wholeTone).toBe(2);
    expect(results.majorThird).toBe(4);
    expect(results.perfectFifth).toBe(7);
    expect(results.octaveUp).toBe(12);
    expect(results.octaveDown).toBe(-12);
  });

  test('audio_context_latency', async ({ page }) => {
    const latency = await page.evaluate(() => {
      return window.sampler.getLatency() * 1000; // Convert to ms
    });
    
    // Web Audio latency should be < 50ms
    expect(latency).toBeLessThan(50);
  });

  test('multiple_notes_simultaneously', async ({ page }) => {
    const result = await page.evaluate(async () => {
      await window.sampler.resume();

      // Trigger multiple notes at once (chord)
      window.sampler.triggerNote('piano', 'C-4');
      window.sampler.triggerNote('piano', 'E-4');
      window.sampler.triggerNote('piano', 'G-4');

      await new Promise(resolve => setTimeout(resolve, 1500));

      return true;
    });

    expect(result).toBe(true);
  });
});

test.describe('WebAudioSampler - Real ST-01 Samples', () => {

  test.beforeEach(async ({ page }) => {
    // Navigate to test page to load WebAudioSampler
    await page.goto('/sampler-web.test.html');

    // Wait for sampler-web.js to load
    await page.waitForFunction(() => typeof WebAudioSampler !== 'undefined');
  });

  test('load_real_sample_steinway', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const sampler = new WebAudioSampler();
      await sampler.loadSample('steinway', '/data/samples/st-01/Steinway.wav', { baseNote: 'C-2' });

      return sampler.hasSample('steinway');
    });

    expect(result).toBe(true);
  });

  test('play_real_sample_steinway', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const sampler = new WebAudioSampler();
      await sampler.loadSample('steinway', '/data/samples/st-01/Steinway.wav', { baseNote: 'C-2' });
      await sampler.resume();

      sampler.triggerNote('steinway', 'C-2');
      await new Promise(resolve => setTimeout(resolve, 1500));

      return true;
    });

    expect(result).toBe(true);
  });

  test('play_real_drums_pattern', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const sampler = new WebAudioSampler();

      // Load drum samples
      await sampler.loadSample('kick', '/data/samples/st-01/BassDrum1.wav', { baseNote: 'C-2' });
      await sampler.loadSample('snare', '/data/samples/st-01/Snare1.wav', { baseNote: 'C-2' });
      await sampler.loadSample('hihat', '/data/samples/st-01/CloseHiHat.wav', { baseNote: 'C-2' });

      await sampler.resume();

      // Simple 4-beat drum pattern
      const pattern = [
        [{ sample: 'kick', note: 'C-2' }, { sample: 'hihat', note: 'C-2' }],
        [{ sample: 'hihat', note: 'C-2' }],
        [{ sample: 'snare', note: 'C-2' }, { sample: 'hihat', note: 'C-2' }],
        [{ sample: 'hihat', note: 'C-2' }]
      ];

      sampler.playPattern(pattern, { bpm: 120, repeat: 2 });

      // Wait for pattern to complete (4 beats × 2 repeats at 120 BPM = 4 seconds)
      await new Promise(resolve => setTimeout(resolve, 4500));

      return true;
    });

    expect(result).toBe(true);
  });

  test('play_melody_with_real_samples', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const sampler = new WebAudioSampler();

      // Load piano and drums
      await sampler.loadSample('piano', '/data/samples/st-01/Steinway.wav', { baseNote: 'C-2' });
      await sampler.loadSample('kick', '/data/samples/st-01/BassDrum1.wav', { baseNote: 'C-2' });
      await sampler.loadSample('hihat', '/data/samples/st-01/CloseHiHat.wav', { baseNote: 'C-2' });

      await sampler.resume();

      // Melody + rhythm pattern (C-D-E-C melody with drums)
      const pattern = [
        [{ sample: 'piano', note: 'C-3' }, { sample: 'kick', note: 'C-2' }, { sample: 'hihat', note: 'C-2' }],
        [{ sample: 'hihat', note: 'C-2' }],
        [{ sample: 'piano', note: 'D-3' }, { sample: 'hihat', note: 'C-2' }],
        [{ sample: 'hihat', note: 'C-2' }],
        [{ sample: 'piano', note: 'E-3' }, { sample: 'kick', note: 'C-2' }, { sample: 'hihat', note: 'C-2' }],
        [{ sample: 'hihat', note: 'C-2' }],
        [{ sample: 'piano', note: 'C-3' }, { sample: 'hihat', note: 'C-2' }],
        [{ sample: 'kick', note: 'C-2' }, { sample: 'hihat', note: 'C-2' }]
      ];

      sampler.playPattern(pattern, { bpm: 120, repeat: 1 });

      // Wait for pattern to complete (8 beats at 120 BPM = 4 seconds)
      await new Promise(resolve => setTimeout(resolve, 4500));

      return true;
    });

    expect(result).toBe(true);
  });

  test('play_different_octaves_real_sample', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const sampler = new WebAudioSampler();
      await sampler.loadSample('piano', '/data/samples/st-01/Steinway.wav', { baseNote: 'C-2' });
      await sampler.resume();

      // Play C across different octaves
      const notes = ['C-2', 'C-3', 'C-4'];
      for (const note of notes) {
        sampler.triggerNote('piano', note);
        await new Promise(resolve => setTimeout(resolve, 800));
      }

      return true;
    });

    expect(result).toBe(true);
  });

  test('load_multiple_real_samples', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const sampler = new WebAudioSampler();

      // Load various instrument samples
      await sampler.loadSample('steinway', '/data/samples/st-01/Steinway.wav', { baseNote: 'C-2' });
      await sampler.loadSample('bass', '/data/samples/st-01/DeepBass.wav', { baseNote: 'C-2' });
      await sampler.loadSample('strings', '/data/samples/st-01/Strings1.wav', { baseNote: 'C-2' });
      await sampler.loadSample('bells', '/data/samples/st-01/DreamBells.wav', { baseNote: 'C-2' });

      return sampler.hasSample('steinway') &&
             sampler.hasSample('bass') &&
             sampler.hasSample('strings') &&
             sampler.hasSample('bells');
    });

    expect(result).toBe(true);
  });
});
