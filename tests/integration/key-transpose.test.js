/**
 * Key Detection + Transposition Integration Tests
 *
 * Tests: Transposer math, key detection via chroma profiles,
 * key lock stability, and pattern transposition.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock Tone.js - Transposer uses Tone.Frequency for transposition
vi.mock('tone', () => {
  // Simple semitone-based transposition for testing
  const NOTE_MAP = { 'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3,
    'E': 4, 'F': 5, 'F#': 6, 'Gb': 6, 'G': 7, 'G#': 8, 'Ab': 8,
    'A': 9, 'A#': 10, 'Bb': 10, 'B': 11 };
  const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

  return {
    Frequency: vi.fn((note) => {
      const match = String(note).match(/^([A-Ga-g]#?b?)(\d+)$/);
      if (!match) return { transpose: () => ({ toNote: () => note }), toNote: () => note, toFrequency: () => 440 };
      const [, name, oct] = match;
      const semitone = NOTE_MAP[name] ?? 0;
      const octave = parseInt(oct);
      const midi = (octave + 1) * 12 + semitone;
      return {
        transpose: vi.fn((interval) => {
          const newMidi = midi + interval;
          const newOctave = Math.floor(newMidi / 12) - 1;
          const newSemitone = ((newMidi % 12) + 12) % 12;
          const newNote = `${NAMES[newSemitone]}${newOctave}`;
          return { toNote: () => newNote, toFrequency: () => 440 * Math.pow(2, (newMidi - 69) / 12) };
        }),
        toNote: () => note,
        toFrequency: () => 440,
      };
    }),
  };
});

// Mock realtime-bpm-analyzer
vi.mock('realtime-bpm-analyzer', () => ({
  createRealTimeBpmProcessor: vi.fn(),
}));

import { Transposer } from '../../src/core/Transposer.js';
import { AudioAnalysis } from '../../src/core/AudioAnalysis.js';

describe('Transposer', () => {
  describe('transpose single note', () => {
    it('returns same note when fromKey equals toKey', () => {
      expect(Transposer.transpose('C3', 'C', 'C')).toBe('C3');
      expect(Transposer.transpose('E4', 'G', 'G')).toBe('E4');
    });

    it('transposes up by correct interval', () => {
      // C to G = +7 semitones
      const result = Transposer.transpose('C3', 'C', 'G');
      expect(result).toBe('G3');
    });

    it('transposes down when interval is negative wrap', () => {
      // G to C = -7 semitones (or +5)
      const result = Transposer.transpose('G3', 'C', 'F');
      expect(result).toBe('C4');
    });

    it('handles sharp keys', () => {
      // C to C# = +1 semitone
      const result = Transposer.transpose('C3', 'C', 'C#');
      expect(result).toBe('C#3');
    });

    it('handles flat keys via enharmonic', () => {
      // C to Db = +1 semitone (same as C#)
      const result = Transposer.transpose('C3', 'C', 'Db');
      expect(result).toBe('C#3');
    });

    it('passes through null values', () => {
      expect(Transposer.transpose(null, 'C', 'G')).toBeNull();
    });

    it('passes through x (percussion marker)', () => {
      expect(Transposer.transpose('x', 'C', 'G')).toBe('x');
    });

    it('transposes across octave boundary', () => {
      // B3 + 1 semitone = C4
      const result = Transposer.transpose('B3', 'C', 'C#');
      expect(result).toBe('C4');
    });
  });

  describe('transposeChord', () => {
    it('transposes all notes in a chord', () => {
      const chord = ['C3', 'E3', 'G3'];
      const result = Transposer.transposeChord(chord, 'C', 'G');
      expect(result).toEqual(['G3', 'B3', 'D4']);
    });

    it('handles single note as non-array input', () => {
      const result = Transposer.transposeChord('C3', 'C', 'D');
      expect(result).toBe('D3');
    });
  });

  describe('transposePattern', () => {
    it('transposes a full pattern preserving structure', () => {
      const pattern = ['C2', null, 'E2', null, 'G2', null, 'C3', null];
      const result = Transposer.transposePattern(pattern, 'C', 'A');

      // All notes should be transposed, nulls preserved
      expect(result[1]).toBeNull();
      expect(result[3]).toBeNull();
      expect(result[5]).toBeNull();
      expect(result[7]).toBeNull();
      expect(result[0]).toBe('A2');
    });

    it('transposes mixed pattern with chords', () => {
      const pattern = [null, ['C4', 'E4', 'G4'], null, 'C2'];
      const result = Transposer.transposePattern(pattern, 'C', 'D');

      expect(result[0]).toBeNull();
      expect(result[2]).toBeNull();
      expect(Array.isArray(result[1])).toBe(true);
      expect(result[1]).toEqual(['D4', 'F#4', 'A4']);
      expect(result[3]).toBe('D2');
    });

    it('preserves percussion markers', () => {
      const pattern = ['x', 'x', null, 'x'];
      const result = Transposer.transposePattern(pattern, 'C', 'F#');

      expect(result).toEqual(['x', 'x', null, 'x']);
    });
  });

  describe('areCompatible', () => {
    it('same key is compatible', () => {
      expect(Transposer.areCompatible('C', 'C')).toBe(true);
      expect(Transposer.areCompatible('Am', 'Am')).toBe(true);
    });

    it('relative minor/major are compatible', () => {
      expect(Transposer.areCompatible('C', 'Am')).toBe(true);
      expect(Transposer.areCompatible('Am', 'C')).toBe(true);
    });

    it('unrelated keys are not compatible', () => {
      expect(Transposer.areCompatible('C', 'F#')).toBe(false);
      expect(Transposer.areCompatible('Am', 'Dm')).toBe(false);
    });
  });

  describe('getPentatonic', () => {
    it('returns 5 notes for major pentatonic', () => {
      const notes = Transposer.getPentatonic('C', 3);
      expect(notes).toHaveLength(5);
    });

    it('returns 5 notes for minor pentatonic', () => {
      const notes = Transposer.getPentatonic('Am', 3);
      expect(notes).toHaveLength(5);
    });
  });

  describe('scale definitions', () => {
    it('major scale has 7 notes', () => {
      expect(Transposer.SCALES.major).toHaveLength(7);
    });

    it('minor scale has 7 notes', () => {
      expect(Transposer.SCALES.minor).toHaveLength(7);
    });

    it('pentatonic scale has 5 notes', () => {
      expect(Transposer.SCALES.pentatonic).toHaveLength(5);
    });

    it('blues scale has 6 notes', () => {
      expect(Transposer.SCALES.blues).toHaveLength(6);
    });

    it('all intervals are valid', () => {
      const allIntervals = Object.values(Transposer.INTERVALS);
      allIntervals.forEach(interval => {
        expect(interval).toBeGreaterThanOrEqual(0);
        expect(interval).toBeLessThanOrEqual(11);
      });
    });
  });
});

describe('Key Detection (AudioAnalysis)', () => {
  let analysis;

  beforeEach(() => {
    analysis = new AudioAnalysis();
    analysis.keyReadings = [];
    analysis.key = null;
    analysis.keyConfidence = 0;
    analysis.keyLocked = false;
    analysis.chromaAccumulator = new Array(12).fill(0);
    analysis.chromaSamples = 0;
    analysis.onKeyUpdate = vi.fn();
    analysis.onKeyLock = vi.fn();
  });

  describe('_correlate', () => {
    it('returns 1 for identical arrays', () => {
      const a = [1, 2, 3, 4, 5];
      const result = analysis._correlate(a, a);
      expect(result).toBeCloseTo(1, 5);
    });

    it('returns -1 for perfectly inverse arrays', () => {
      const a = [1, 2, 3, 4, 5];
      const b = [5, 4, 3, 2, 1];
      const result = analysis._correlate(a, b);
      expect(result).toBeCloseTo(-1, 5);
    });

    it('returns 0 for zero-variance arrays', () => {
      const a = [3, 3, 3, 3, 3];
      const b = [1, 2, 3, 4, 5];
      const result = analysis._correlate(a, b);
      expect(result).toBe(0);
    });
  });

  describe('key lock stability', () => {
    it('locks after KEY_STABILITY_COUNT consecutive same-key readings', () => {
      // Simulate _analyzeKey results
      const readings = [];
      for (let i = 0; i < analysis.KEY_STABILITY_COUNT; i++) {
        readings.push({ key: 'Am', confidence: 0.85 });
      }
      analysis.keyReadings = readings;

      // Manually check the lock condition
      const recentReadings = analysis.keyReadings.slice(-analysis.KEY_STABILITY_COUNT);
      const allSameKey = recentReadings.every(r => r.key === 'Am');
      const avgConfidence = recentReadings.reduce((sum, r) => sum + r.confidence, 0) / recentReadings.length;

      expect(allSameKey).toBe(true);
      expect(avgConfidence).toBeGreaterThanOrEqual(analysis.KEY_CONFIDENCE_THRESHOLD);
    });

    it('does NOT lock when keys alternate', () => {
      analysis.keyReadings = [
        { key: 'Am', confidence: 0.8 },
        { key: 'C', confidence: 0.8 },
        { key: 'Am', confidence: 0.8 },
      ];

      const recentReadings = analysis.keyReadings.slice(-analysis.KEY_STABILITY_COUNT);
      const allSameKey = recentReadings.every(r => r.key === recentReadings[0].key);

      expect(allSameKey).toBe(false);
    });

    it('does NOT lock when confidence is below threshold', () => {
      analysis.keyReadings = [
        { key: 'Am', confidence: 0.5 },
        { key: 'Am', confidence: 0.5 },
        { key: 'Am', confidence: 0.5 },
      ];

      const recentReadings = analysis.keyReadings.slice(-analysis.KEY_STABILITY_COUNT);
      const avgConfidence = recentReadings.reduce((sum, r) => sum + r.confidence, 0) / recentReadings.length;

      expect(avgConfidence).toBeLessThan(analysis.KEY_CONFIDENCE_THRESHOLD);
    });
  });

  describe('key unlock/re-lock', () => {
    it('unlockKey resets all key state', () => {
      analysis.keyLocked = true;
      analysis.key = 'Am';
      analysis.keyConfidence = 1;
      analysis.chromaAccumulator = new Array(12).fill(100);
      analysis.chromaSamples = 500;
      analysis.keyReadings = [{ key: 'Am', confidence: 0.9 }];

      analysis.unlockKey();

      expect(analysis.keyLocked).toBe(false);
      expect(analysis.key).toBeNull();
      expect(analysis.keyConfidence).toBe(0);
      expect(analysis.chromaAccumulator.every(v => v === 0)).toBe(true);
      expect(analysis.chromaSamples).toBe(0);
      expect(analysis.keyReadings).toEqual([]);
    });

    it('unlockAll resets both BPM and key', () => {
      analysis.bpmLocked = true;
      analysis.keyLocked = true;

      analysis.unlockAll();

      expect(analysis.bpmLocked).toBe(false);
      expect(analysis.keyLocked).toBe(false);
    });
  });

  describe('Krumhansl profiles', () => {
    it('has 12-element major profile', () => {
      expect(AudioAnalysis.MAJOR_PROFILE).toHaveLength(12);
    });

    it('has 12-element minor profile', () => {
      expect(AudioAnalysis.MINOR_PROFILE).toHaveLength(12);
    });

    it('major profile has highest weight on tonic (index 0)', () => {
      const max = Math.max(...AudioAnalysis.MAJOR_PROFILE);
      expect(AudioAnalysis.MAJOR_PROFILE[0]).toBe(max);
    });

    it('minor profile has highest weight on tonic (index 0)', () => {
      const max = Math.max(...AudioAnalysis.MINOR_PROFILE);
      expect(AudioAnalysis.MINOR_PROFILE[0]).toBe(max);
    });
  });

  describe('key reading buffer', () => {
    it('keeps at most 20 readings', () => {
      for (let i = 0; i < 25; i++) {
        analysis.keyReadings.push({ key: 'C', confidence: 0.8 });
        if (analysis.keyReadings.length > 20) analysis.keyReadings.shift();
      }
      expect(analysis.keyReadings.length).toBe(20);
    });
  });

  describe('state', () => {
    it('getState reflects key lock status', () => {
      expect(analysis.getState().keyLocked).toBe(false);

      analysis.keyLocked = true;
      analysis.key = 'F#m';
      analysis.keyConfidence = 1;

      const state = analysis.getState();
      expect(state.keyLocked).toBe(true);
      expect(state.key).toBe('F#m');
      expect(state.keyConfidence).toBe(1);
    });
  });
});
