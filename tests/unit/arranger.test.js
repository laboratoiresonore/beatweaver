import { describe, it, expect } from 'vitest';
import Arranger from '../../src/core/Arranger.js';

// Helper to create a simple arranger with dummy stems.
function createSimpleArranger() {
  return new Arranger({
    bpm: 120,
    beatsPerBar: 4,
    stems: [
      { id: 'stem1', url: 'file1.wav', type: 'audio' },
      { id: 'stem2', url: 'file2.wav', type: 'audio' },
    ],
  });
}

describe('Arranger core functionality', () => {
  it('snaps times to the bar grid correctly', () => {
    const arranger = createSimpleArranger();
    // Bar duration = (60 / 120) * 4 = 2 seconds.
    expect(arranger.snapTime(0.1)).toBe(0);          // rounds to 0
    expect(arranger.snapTime(0.9)).toBe(0);          // <1 sec rounds down to 0
    expect(arranger.snapTime(1.1)).toBe(2);          // rounds to nearest bar (2)
    expect(arranger.snapTime(2.9)).toBe(2);          // rounds down to 2
    expect(arranger.snapTime(3.1)).toBe(4);          // rounds up to 4
  });

  it('produces equal-power gain values', () => {
    const { gainA: a0, gainB: b0 } = Arranger.equalPowerGains(0);
    const { gainA: a1, gainB: b1 } = Arranger.equalPowerGains(0.5);
    const { gainA: a2, gainB: b2 } = Arranger.equalPowerGains(1);

    // Fade 0 => full A, no B
    expect(a0).toBeCloseTo(1);
    expect(b0).toBeCloseTo(0);
    // Fade 1 => full B, no A
    expect(a2).toBeCloseTo(0);
    expect(b2).toBeCloseTo(1);
    // Fade 0.5 => both ~0.7071 (sqrt(0.5))
    expect(a1).toBeCloseTo(Math.SQRT1_2);
    expect(b1).toBeCloseTo(Math.SQRT1_2);
    // Power preservation: sum of squares of gains should be 1 (within tolerance)
    const power0 = a0 * a0 + b0 * b0;
    const power1 = a1 * a1 + b1 * b1;
    const power2 = a2 * a2 + b2 * b2;
    expect(power0).toBeCloseTo(1);
    expect(power1).toBeCloseTo(1);
    expect(power2).toBeCloseTo(1);
  });

  it('generates reproducible arrangements in deterministic mode', () => {
    const stems = [
      { id: 's1', url: 'a.wav' },
      { id: 's2', url: 'b.wav' },
      { id: 's3', url: 'c.wav' },
    ];

    const arr1 = new Arranger({ bpm: 120, beatsPerBar: 4, stems });
    arr1.setDeterministic(12345);
    const events1 = arr1.generate({ repeatSectionChance: 0, maxSections: 3 });

    const arr2 = new Arranger({ bpm: 120, beatsPerBar: 4, stems });
    arr2.setDeterministic(12345);
    const events2 = arr2.generate({ repeatSectionChance: 0, maxSections: 3 });

    expect(events2).toEqual(events1);
  });
});
