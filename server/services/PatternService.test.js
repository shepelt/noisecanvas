/**
 * Unit tests for PatternService
 */

import { PatternService } from './PatternService.js';

describe('PatternService', () => {
  let service;

  beforeEach(() => {
    service = new PatternService({ enableLogging: false });
  });

  describe('playNotes', () => {
    test('should convert notes to pattern with default tempo', async () => {
      const result = await service.playNotes(['C', 'D', 'E']);

      expect(result.success).toBe(true);
      expect(result.pattern).toHaveLength(3);
      expect(result.pattern[0]).toEqual({
        sample: 'ST-01',
        note: 'C-4',
        volume: 64
      });
      expect(result.tempo).toBe(480); // Default: 120 BPM × 4
    });

    test('should accept custom tempo', async () => {
      const result = await service.playNotes(['C', 'D', 'E'], {
        bpm: 960 // 240 BPM × 4
      });

      expect(result.tempo).toBe(960);
      expect(result.message).toContain('960 rows/min');
    });

    test('should handle per-note instrument override', async () => {
      const notes = [
        { note: 'C', instrument: 'ST-01' },
        { note: 'D', instrument: '808-KICK' }
      ];

      const result = await service.playNotes(notes);

      expect(result.pattern[0].sample).toBe('ST-01');
      expect(result.pattern[1].sample).toBe('808-KICK');
    });

    test('should handle per-note volume override', async () => {
      const notes = [
        { note: 'C', volume: 32 },
        { note: 'D', volume: 48 }
      ];

      const result = await service.playNotes(notes);

      expect(result.pattern[0].volume).toBe(32);
      expect(result.pattern[1].volume).toBe(48);
    });

    test('should format notes with default octave', async () => {
      const result = await service.playNotes(['C', 'D#', 'E'], {
        octave: 5
      });

      expect(result.pattern[0].note).toBe('C-5');
      expect(result.pattern[1].note).toBe('D#-5');
      expect(result.pattern[2].note).toBe('E-5');
    });

    test('should preserve explicit octaves in notes', async () => {
      const result = await service.playNotes(['C-3', 'D-4', 'E-5']);

      expect(result.pattern[0].note).toBe('C-3');
      expect(result.pattern[1].note).toBe('D-4');
      expect(result.pattern[2].note).toBe('E-5');
    });

    test('should add play to pending queue', async () => {
      await service.playNotes(['C', 'D', 'E']);

      expect(service.pendingPlays).toHaveLength(1);
      expect(service.pendingPlays[0].tempo).toBe(480);
    });

    test('should throw error for empty notes array', async () => {
      await expect(service.playNotes([])).rejects.toThrow('notes must be a non-empty array');
    });

    test('should throw error for non-array notes', async () => {
      await expect(service.playNotes('C')).rejects.toThrow('notes must be a non-empty array');
    });
  });

  describe('formatNote', () => {
    test('should format note without octave', () => {
      expect(service.formatNote('C', 4)).toBe('C-4');
      expect(service.formatNote('D#', 3)).toBe('D#-3');
    });

    test('should normalize note with octave (no dash)', () => {
      expect(service.formatNote('C4', 5)).toBe('C-4');
      expect(service.formatNote('D#5', 3)).toBe('D#-5');
    });

    test('should preserve note with octave (with dash)', () => {
      expect(service.formatNote('C-4', 5)).toBe('C-4');
      expect(service.formatNote('D#-3', 2)).toBe('D#-3');
    });
  });

  describe('getPendingPlays', () => {
    test('should return and clear pending plays', async () => {
      await service.playNotes(['C']);
      await service.playNotes(['D']);
      await service.playNotes(['E']);

      expect(service.pendingPlays).toHaveLength(3);

      const pending = service.getPendingPlays();

      expect(pending).toHaveLength(3);
      expect(service.pendingPlays).toHaveLength(0); // Should be cleared
    });

    test('should return empty array if no pending plays', () => {
      const pending = service.getPendingPlays();
      expect(pending).toEqual([]);
    });
  });

  describe('activePlays tracking', () => {
    test('should track active plays', async () => {
      const result = await service.playNotes(['C', 'D', 'E']);

      const play = service.getPlay(result.playId);
      expect(play).toBeDefined();
      expect(play.tempo).toBe(480);
    });

    test('should stop play by ID', async () => {
      const result = await service.playNotes(['C', 'D', 'E']);

      const stopped = service.stopPlay(result.playId);
      expect(stopped).toBe(true);

      const play = service.getPlay(result.playId);
      expect(play).toBeNull();
    });

    test('should clear all plays', async () => {
      await service.playNotes(['C']);
      await service.playNotes(['D']);

      service.clearAll();

      expect(service.activePlays.size).toBe(0);
    });
  });
});
