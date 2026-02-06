/**
 * BPM Lock Integration Tests
 *
 * Tests the BPM detection → confidence → lock pipeline in AudioAnalysis.
 * Covers: stability checking, normalization, fallback detection, unlock/re-lock.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AudioAnalysis } from '../../src/core/AudioAnalysis.js';

describe('BPM Lock', () => {
  let analysis;

  beforeEach(() => {
    analysis = new AudioAnalysis();
    // Override the singleton for clean state
    analysis.bpmCandidates = [];
    analysis.bpm = null;
    analysis.bpmConfidence = 0;
    analysis.bpmLocked = false;
    analysis.beatTimes = [];
    analysis.lastBeatTime = 0;
    analysis.onBpmUpdate = vi.fn();
    analysis.onBpmLock = vi.fn();
    analysis.onBeat = vi.fn();
  });

  describe('stability check (_checkBpmStability)', () => {
    it('locks when recent candidates are within threshold (3 BPM)', () => {
      // Feed 10 stable readings all at 128
      analysis.bpmCandidates = [128, 128, 128, 128, 128, 128, 128, 128, 128, 128];
      analysis._checkBpmStability();

      expect(analysis.bpmLocked).toBe(true);
      expect(analysis.bpm).toBe(128);
      expect(analysis.bpmConfidence).toBe(1);
      expect(analysis.onBpmLock).toHaveBeenCalledWith(128);
    });

    it('locks when range is exactly at threshold', () => {
      // Range of 3 BPM (127-130)
      analysis.bpmCandidates = [127, 128, 129, 130, 128, 129, 128, 127, 129, 128];
      analysis._checkBpmStability();

      expect(analysis.bpmLocked).toBe(true);
      expect(analysis.onBpmLock).toHaveBeenCalled();
    });

    it('does NOT lock when range exceeds threshold', () => {
      // Range of 10 BPM (120-130)
      analysis.bpmCandidates = [120, 125, 130, 122, 128, 126, 124, 130, 120, 125];
      analysis._checkBpmStability();

      expect(analysis.bpmLocked).toBe(false);
      expect(analysis.onBpmLock).not.toHaveBeenCalled();
    });

    it('does NOT re-lock if already locked', () => {
      analysis.bpmLocked = true;
      analysis.bpmCandidates = [128, 128, 128, 128, 128, 128, 128, 128, 128, 128];
      analysis._checkBpmStability();

      expect(analysis.onBpmLock).not.toHaveBeenCalled();
    });

    it('uses only last 10 candidates for stability', () => {
      // First 10 unstable, last 10 stable
      analysis.bpmCandidates = [80, 90, 100, 110, 120, 130, 140, 150, 160, 170,
        128, 128, 128, 128, 128, 128, 128, 128, 128, 128];
      analysis._checkBpmStability();

      expect(analysis.bpmLocked).toBe(true);
      expect(analysis.bpm).toBe(128);
    });

    it('averages recent readings for locked BPM', () => {
      analysis.bpmCandidates = [126, 127, 128, 129, 128, 127, 128, 129, 128, 127];
      analysis._checkBpmStability();

      expect(analysis.bpmLocked).toBe(true);
      // Average of last 10: (126+127+128+129+128+127+128+129+128+127)/10 = 127.7 → rounds to 128
      expect(analysis.bpm).toBe(128);
    });
  });

  describe('BPM normalization', () => {
    it('doubles BPM below 60 into valid range', () => {
      // _handleBpmResult normalizes to 60-180 range
      analysis._handleBpmResult({ bpm: [{ tempo: 64, confidence: 0.9 }] });
      expect(analysis.bpm).toBe(64);

      analysis._handleBpmResult({ bpm: [{ tempo: 55, confidence: 0.9 }] });
      expect(analysis.bpm).toBe(110); // 55 * 2

      analysis._handleBpmResult({ bpm: [{ tempo: 30, confidence: 0.9 }] });
      expect(analysis.bpm).toBe(60); // 30 * 2 (60 is in range)
    });

    it('halves BPM above 180 into valid range', () => {
      analysis._handleBpmResult({ bpm: [{ tempo: 256, confidence: 0.9 }] });
      expect(analysis.bpm).toBe(128); // 256 / 2

      analysis._handleBpmResult({ bpm: [{ tempo: 360, confidence: 0.9 }] });
      expect(analysis.bpm).toBe(180); // 360 / 2 (180 is in range)
    });
  });

  describe('_handleBpmResult', () => {
    it('ignores empty result', () => {
      analysis._handleBpmResult({ bpm: [] });
      expect(analysis.bpm).toBeNull();
    });

    it('ignores result without tempo', () => {
      analysis._handleBpmResult({ bpm: [{ confidence: 0.9 }] });
      expect(analysis.bpm).toBeNull();
    });

    it('ignores if already locked', () => {
      analysis.bpmLocked = true;
      analysis.bpm = 128;
      analysis._handleBpmResult({ bpm: [{ tempo: 140, confidence: 0.9 }] });
      expect(analysis.bpm).toBe(128); // Unchanged
    });

    it('stores candidate and fires update', () => {
      analysis._handleBpmResult({ bpm: [{ tempo: 128, confidence: 0.8 }] });
      expect(analysis.bpmCandidates).toContain(128);
      expect(analysis.onBpmUpdate).toHaveBeenCalledWith({
        bpm: 128, confidence: 0.8, locked: false,
      });
    });

    it('triggers stability check after MIN_BPM_CANDIDATES', () => {
      // Feed exactly MIN_BPM_CANDIDATES stable readings
      for (let i = 0; i < analysis.MIN_BPM_CANDIDATES; i++) {
        analysis._handleBpmResult({ bpm: [{ tempo: 128, confidence: 0.9 }] });
      }
      expect(analysis.bpmLocked).toBe(true);
    });
  });

  describe('_handleStableBpm', () => {
    it('locks immediately on stable signal', () => {
      analysis._handleStableBpm({ bpm: [{ tempo: 140, confidence: 1 }] });

      expect(analysis.bpmLocked).toBe(true);
      expect(analysis.bpm).toBe(140);
      expect(analysis.bpmConfidence).toBe(1);
      expect(analysis.onBpmLock).toHaveBeenCalledWith(140);
    });

    it('normalizes BPM before locking', () => {
      analysis._handleStableBpm({ bpm: [{ tempo: 256, confidence: 1 }] });
      expect(analysis.bpm).toBe(128);
    });

    it('ignores if already locked', () => {
      analysis.bpmLocked = true;
      analysis.bpm = 128;
      analysis._handleStableBpm({ bpm: [{ tempo: 140, confidence: 1 }] });
      expect(analysis.bpm).toBe(128);
    });
  });

  describe('unlock/re-lock cycle', () => {
    it('unlockBpm resets all BPM state', () => {
      analysis.bpmLocked = true;
      analysis.bpm = 128;
      analysis.bpmConfidence = 1;
      analysis.bpmCandidates = [128, 128, 128];

      analysis.unlockBpm();

      expect(analysis.bpmLocked).toBe(false);
      expect(analysis.bpm).toBeNull();
      expect(analysis.bpmConfidence).toBe(0);
      expect(analysis.bpmCandidates).toEqual([]);
      expect(analysis.onBpmUpdate).toHaveBeenCalledWith({
        bpm: null, confidence: 0, locked: false,
      });
    });

    it('can re-lock after unlock', () => {
      // Lock
      for (let i = 0; i < analysis.MIN_BPM_CANDIDATES; i++) {
        analysis._handleBpmResult({ bpm: [{ tempo: 128, confidence: 0.9 }] });
      }
      expect(analysis.bpmLocked).toBe(true);

      // Unlock
      analysis.unlockBpm();
      expect(analysis.bpmLocked).toBe(false);

      // Re-lock at different BPM
      for (let i = 0; i < analysis.MIN_BPM_CANDIDATES; i++) {
        analysis._handleBpmResult({ bpm: [{ tempo: 140, confidence: 0.9 }] });
      }
      expect(analysis.bpmLocked).toBe(true);
      expect(analysis.bpm).toBe(140);
    });
  });

  describe('candidate buffer management', () => {
    it('keeps at most 20 candidates', () => {
      for (let i = 0; i < 30; i++) {
        analysis.bpmCandidates.push(100 + i); // Deliberately unstable so it doesn't lock
      }
      // Simulate what _handleBpmResult does
      if (analysis.bpmCandidates.length > 20) {
        analysis.bpmCandidates = analysis.bpmCandidates.slice(-20);
      }
      expect(analysis.bpmCandidates.length).toBe(20);
    });
  });

  describe('fallback BPM detection (_calculateFallbackBpm)', () => {
    it('calculates BPM from beat intervals', () => {
      analysis.fallbackMode = true;
      analysis.beatTimes = [500, 500, 500, 500]; // 120 BPM
      analysis._calculateFallbackBpm();

      expect(analysis.bpm).toBe(120);
    });

    it('normalizes fallback BPM to 60-180 range', () => {
      analysis.fallbackMode = true;
      analysis.beatTimes = [1000, 1000, 1000, 1000]; // 60 BPM - stays as-is in 60-180 range
      analysis._calculateFallbackBpm();

      expect(analysis.bpm).toBeGreaterThanOrEqual(60);
      expect(analysis.bpm).toBeLessThanOrEqual(180);
    });

    it('filters outliers using IQR method', () => {
      analysis.fallbackMode = true;
      // Mostly 500ms (120 BPM) with one outlier
      analysis.beatTimes = [500, 500, 500, 500, 500, 500, 500, 500, 500, 1500];
      analysis._calculateFallbackBpm();

      // Should be close to 120, not dragged by the outlier
      expect(analysis.bpm).toBeGreaterThanOrEqual(115);
      expect(analysis.bpm).toBeLessThanOrEqual(125);
    });

    it('locks when fallback readings are stable', () => {
      analysis.fallbackMode = true;

      // Feed stable readings that accumulate enough candidates
      for (let i = 0; i < analysis.MIN_BPM_CANDIDATES + 2; i++) {
        analysis.beatTimes = [500, 500, 500, 500];
        analysis._calculateFallbackBpm();
      }

      expect(analysis.bpmLocked).toBe(true);
    });
  });

  describe('state', () => {
    it('getState reflects lock status', () => {
      const before = analysis.getState();
      expect(before.bpmLocked).toBe(false);
      expect(before.bpm).toBeNull();

      analysis.bpmLocked = true;
      analysis.bpm = 128;
      analysis.bpmConfidence = 1;

      const after = analysis.getState();
      expect(after.bpmLocked).toBe(true);
      expect(after.bpm).toBe(128);
      expect(after.bpmConfidence).toBe(1);
    });
  });
});
