import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock AudioAnalysis to isolate MusicalAnalysis logic.
vi.mock('../../src/core/AudioAnalysis.js', () => ({
  getAudioAnalysis: () => {
    const mock = {
      init: vi.fn(),
      startAnalysis: vi.fn(() => true),
      stopAnalysis: vi.fn(),
      analyzerNode: {
        frequencyBinCount: 512,
        getByteFrequencyData: vi.fn(),
      },
      onBpmUpdate: null,
      onBpmLock: null,
      onKeyUpdate: null,
      onKeyLock: null,
      onBeat: null,
    };
    return mock;
  },
}));

import { getMusicalAnalysis } from '../../src/core/MusicalAnalysis.js';

describe('MusicalAnalysis core functionality', () => {
  let analysis;
  beforeEach(async () => {
    analysis = getMusicalAnalysis();
    await analysis.init();
    await analysis.startAnalysis();
    // Reset any state that may persist across calls due to singleton.
    analysis.bpm = null;
    analysis.bpmLocked = false;
    analysis.bpmCandidates = [];
    analysis.downbeats = [];
    analysis.barGrid = [];
    analysis.firstDownbeat = null;
    analysis.key = null;
    analysis.keyLocked = false;
    analysis.keyReadings = [];
    analysis.sections = [];
    analysis.sectionBoundaries = [];
  });

  it('locks tempo after stable BPM candidates and builds a bar grid', async () => {
    let lockedBpm = null;
    analysis.onTempoLock = (bpm) => {
      lockedBpm = bpm;
    };
    // Feed six BPM candidates within a tight range (120 ± 2).
    const candidates = [119, 121, 120, 120, 119, 121];
    for (const bpm of candidates) {
      analysis._handleBpmUpdate({ bpm, confidence: 0.9, locked: false });
    }
    expect(lockedBpm).toBe(120);
    expect(analysis.bpmLocked).toBe(true);
    // Simulate first downbeat callback (timestamp from performance.now()).
    const ts = performance.now();
    analysis._recordDownbeat(ts);
    expect(analysis.downbeats).toHaveLength(1);
    expect(analysis.barGrid).toHaveLength(1);
    // Simulate a second downbeat roughly one bar later.
    const barLength = Math.round(60000 / analysis.bpm);
    analysis._recordDownbeat(ts + barLength + 5); // small jitter
    expect(analysis.downbeats).toHaveLength(2);
    expect(analysis.barGrid).toHaveLength(2);
    // Verify that barGrid timestamps are deterministic (aligned to expected start).
    const expectedSecond = analysis.firstDownbeat + barLength;
    expect(Math.abs(analysis.barGrid[1] - expectedSecond)).toBeLessThanOrEqual(barLength * 0.15);
  });

  it('does not lock key when confidence is below threshold', async () => {
    let lockedKey = null;
    analysis.onKeyLock = (key) => {
      lockedKey = key;
    };
    // Provide four identical low‑confidence key readings.
    const lowConf = 0.4; // below 0.55 threshold
    for (let i = 0; i < 4; i++) {
      analysis._handleKeyUpdate({ key: 'Am', confidence: lowConf, locked: false });
    }
    expect(lockedKey).toBeNull();
    expect(analysis.keyLocked).toBe(false);
    // Provide a high‑confidence reading to trigger lock.
    analysis._handleKeyUpdate({ key: 'Am', confidence: 0.9, locked: false });
    expect(lockedKey).toBe('AM'); // normalized to uppercase
    expect(analysis.keyLocked).toBe(true);
    expect(analysis.key).toBe('AM');
    expect(analysis.keyConfidence).toBe(0.9);
  });

  it('generates fallback sections when no spectral changes are detected', async () => {
    // Force a locked tempo and build a simple bar grid of 32 bars.
    analysis.bpm = 120;
    analysis.bpmLocked = true;
    // Simulate first downbeat at t=0.
    const start = performance.now();
    analysis.firstDownbeat = start;
    analysis.barGrid = [];
    const barMs = Math.round(60000 / analysis.bpm);
    for (let i = 0; i < 32; i++) {
      analysis.barGrid.push(start + i * barMs);
    }
    // No section boundaries have been recorded.
    analysis.sectionBoundaries = [];
    // Directly invoke fallback finalisation.
    analysis._finalizeSections();
    // Expect at least 4 sections (intro, verse, chorus, outro).
    expect(analysis.sections.length).toBeGreaterThanOrEqual(4);
    const types = analysis.sections.map((s) => s.type);
    expect(types[0]).toBe('intro');
    expect(types[types.length - 1]).toBe('outro');
    // Bars should be partitioned roughly evenly.
    const totalBars = Math.floor((analysis.barGrid[analysis.barGrid.length - 1] - analysis.firstDownbeat) / barMs) + 1;
    const expectedBarsPerSection = Math.ceil(totalBars / analysis.sections.length);
    analysis.sections.forEach((sec, idx) => {
      const length = sec.endBar - sec.startBar + 1;
      // Allow off‑by‑one due to rounding.
      expect(length).toBeLessThanOrEqual(expectedBarsPerSection + 1);
    });
  });
});
