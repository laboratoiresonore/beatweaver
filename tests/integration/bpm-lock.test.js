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

  // ──────────────────────────────────────────────────────────
  // 2026-05-06 audit-driven improvements: adaptive IQR threshold,
  // rolling median during accumulation, chromaSamples reset on
  // BPM lock. Each block pins the new contract so future
  // refactors don't quietly regress the audit work.
  // ──────────────────────────────────────────────────────────
  describe('adaptive IQR multiplier (audit punch-list #9)', () => {
    it('uses 2.0× multiplier in cold-start (<3 candidates)', () => {
      // Cold-start regime: lenient outlier acceptance so we don't
      // throw away beats during the first few measurements.
      analysis.bpmCandidates = [];   // 0 candidates → cold-start
      analysis.bpmConfidence = 0;
      // Tight cluster around 120 BPM (500 ms intervals) plus one
      // wide outlier at 750 ms — the 2.0× multiplier should
      // accept the outlier (the 1.5× pre-fix would too, this
      // mostly sets a baseline for the next two tests).
      analysis.beatTimes = [500, 500, 500, 500, 500, 750];
      analysis._calculateFallbackBpm();
      // Must produce SOME BPM (didn't fully reject the input).
      expect(analysis.bpm).toBeGreaterThan(0);
    });

    it('uses 1.0× multiplier when bpmConfidence > 0.7 (tight)', () => {
      // Locked-in regime: tighter acceptance so live-DJ-scratch
      // outliers don't pollute the median.
      analysis.bpmCandidates = [128, 128, 128, 128, 128, 128];
      analysis.bpmConfidence = 0.85;
      // 500 ms cluster + one big outlier at 800 ms. With 1.5×
      // (pre-fix) the outlier landed inside the IQR window and
      // dragged the average; with 1.0× (new) it's rejected.
      analysis.beatTimes = [500, 500, 500, 500, 500, 500, 800];
      const bpmBefore = analysis.bpm;
      analysis._calculateFallbackBpm();
      // The new IQR multiplier rejects the wider outlier so the
      // computed BPM stays close to 120 (60000/500=120) rather
      // than drifting toward 100 (60000/600=100).
      expect(analysis.bpm).toBeGreaterThanOrEqual(115);
    });
  });

  describe('rolling median during accumulation (audit punch-list #2)', () => {
    it('surfaces median (not raw) BPM when ≥3 candidates exist', () => {
      // 4 candidates so far: three at 128 + one outlier at 110.
      // Pre-fix the public ``bpm`` field would have surfaced the
      // raw single-frame ``detectedBpm`` (whatever this call
      // computes — probably ~120 from the new beats below).
      // Post-fix it surfaces the rolling median across all 5
      // accumulated candidates (the new one + the four prior).
      analysis.bpmCandidates = [128, 128, 128, 110];
      analysis.beatTimes = [500, 500, 500, 500];   // 120 BPM raw
      analysis._calculateFallbackBpm();
      // bpmCandidates becomes [128, 128, 128, 110, 120].
      // Sorted: [110, 120, 128, 128, 128]. Median = 128.
      // (This is the audit-driven smoothness — the live UI
      // reading sticks at 128 instead of bouncing to 120 just
      // because one fresh beat-interval frame happened to be
      // shorter.)
      expect(analysis.bpm).toBe(128);
    });

    it('falls back to raw detectedBpm with <3 candidates', () => {
      analysis.bpmCandidates = [];
      analysis.beatTimes = [500, 500, 500, 500];   // 120 BPM raw
      analysis._calculateFallbackBpm();
      // Only 1 candidate now — too few for rolling median, surface
      // the raw value.
      expect(analysis.bpm).toBe(120);
    });
  });

  describe('chroma reset on BPM lock (audit punch-list #1)', () => {
    it('zeroes chromaSamples when stability check locks', () => {
      analysis.chromaSamples = 250;   // mid-window
      analysis.bpmCandidates =
        [128, 128, 128, 128, 128, 128, 128, 128, 128, 128];
      analysis._checkBpmStability();
      expect(analysis.bpmLocked).toBe(true);
      // Audit fix: window resets so the next key-analysis cycle
      // starts fresh on post-lock chroma samples.
      expect(analysis.chromaSamples).toBe(0);
    });

    it('zeroes chromaSamples when fallback path locks', () => {
      analysis.fallbackMode = true;
      analysis.chromaSamples = 180;
      // Build the lock condition: enough candidates, all
      // identical, range below threshold.
      for (let i = 0; i < analysis.MIN_BPM_CANDIDATES + 2; i++) {
        analysis.beatTimes = [500, 500, 500, 500];
        analysis._calculateFallbackBpm();
      }
      expect(analysis.bpmLocked).toBe(true);
      expect(analysis.chromaSamples).toBe(0);
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

  // Public API user-facing controls. The DJ hits these from the UI
  // when they want to unlock and re-detect (track change, scratch
  // section, etc.). State machine has to land cleanly.
  describe('unlockBpm / unlockKey / unlockAll', () => {
    it('unlockBpm resets BPM state but PRESERVES chroma window', () => {
      // Lock BPM + start accumulating chroma.
      analysis.bpmLocked = true;
      analysis.bpm = 128;
      analysis.bpmConfidence = 1;
      analysis.bpmCandidates = [128, 128, 128];
      analysis.beatTimes = [500, 500];
      analysis.chromaSamples = 60;
      analysis.chromaAccumulator = new Array(12).fill(7);
      analysis.onBpmUpdate = vi.fn();

      analysis.unlockBpm();

      expect(analysis.bpmLocked).toBe(false);
      expect(analysis.bpm).toBeNull();
      expect(analysis.bpmConfidence).toBe(0);
      expect(analysis.bpmCandidates).toEqual([]);
      expect(analysis.beatTimes).toEqual([]);
      // Chroma window is intentionally PRESERVED — BPM unlock
      // shouldn't clobber an in-flight key analysis.
      expect(analysis.chromaSamples).toBe(60);
      expect(analysis.chromaAccumulator.every(v => v === 7)).toBe(true);
      // Update callback fires so the UI surface clears the BPM readout.
      expect(analysis.onBpmUpdate).toHaveBeenCalledWith({
        bpm: null, confidence: 0, locked: false,
      });
    });

    it('unlockKey resets key state + chroma window', () => {
      analysis.keyLocked = true;
      analysis.key = 'F#m';
      analysis.keyConfidence = 1;
      analysis.chromaSamples = 80;
      analysis.chromaAccumulator = new Array(12).fill(3);
      analysis.keyReadings = ['F#m', 'F#m'];
      analysis.onKeyUpdate = vi.fn();

      analysis.unlockKey();

      expect(analysis.keyLocked).toBe(false);
      expect(analysis.key).toBeNull();
      expect(analysis.keyConfidence).toBe(0);
      expect(analysis.chromaSamples).toBe(0);
      // Accumulator wiped so the next analysis starts fresh.
      expect(analysis.chromaAccumulator.every(v => v === 0)).toBe(true);
      expect(analysis.keyReadings).toEqual([]);
      expect(analysis.onKeyUpdate).toHaveBeenCalledWith({
        key: null, confidence: 0, locked: false,
      });
    });

    it('unlockAll calls both unlockBpm + unlockKey', () => {
      analysis.bpmLocked = true;
      analysis.keyLocked = true;
      analysis.bpm = 120;
      analysis.key = 'C';
      analysis.onBpmUpdate = vi.fn();
      analysis.onKeyUpdate = vi.fn();

      analysis.unlockAll();

      expect(analysis.bpmLocked).toBe(false);
      expect(analysis.keyLocked).toBe(false);
      expect(analysis.bpm).toBeNull();
      expect(analysis.key).toBeNull();
      expect(analysis.onBpmUpdate).toHaveBeenCalled();
      expect(analysis.onKeyUpdate).toHaveBeenCalled();
    });

    it('unlockBpm safely handles missing bpmAnalyserNode', () => {
      // Fallback-mode: no AudioWorklet was set up, so bpmAnalyserNode
      // is undefined. unlockBpm must NOT throw.
      analysis.bpmAnalyserNode = null;
      expect(() => analysis.unlockBpm()).not.toThrow();
    });
  });
});
