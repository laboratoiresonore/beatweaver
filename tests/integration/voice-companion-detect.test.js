import { describe, it, expect } from 'vitest';
import {
  pickModelTier,
  detectHardware,
  defaultVoiceForTier,
  recommendVoice,
} from '../../voice-companion/src/hardware-detect.js';

/**
 * Pin the hardware-tier heuristic. The thresholds are user-facing — every
 * machine that scores 'medium' will get amy-medium downloaded automatically,
 * and the user has to live with that until they manually edit config.json.
 * Drift here = silently changing what gets downloaded for thousands of
 * users on next release.
 */

describe('pickModelTier', () => {
  it('returns high for workstations: 16+ GB RAM and 8+ cores', () => {
    expect(pickModelTier({ totalRamGB: 32, cpuCount: 16 })).toBe('high');
    expect(pickModelTier({ totalRamGB: 16, cpuCount: 8 })).toBe('high');
  });

  it('returns medium for typical laptops: 8 GB / 4-core', () => {
    expect(pickModelTier({ totalRamGB: 8, cpuCount: 4 })).toBe('medium');
    expect(pickModelTier({ totalRamGB: 16, cpuCount: 4 })).toBe('medium');
    expect(pickModelTier({ totalRamGB: 6, cpuCount: 4 })).toBe('medium');
  });

  it('returns low for constrained hardware: <6 GB OR <4 cores', () => {
    expect(pickModelTier({ totalRamGB: 4, cpuCount: 4 })).toBe('low');
    expect(pickModelTier({ totalRamGB: 8, cpuCount: 2 })).toBe('low');
    expect(pickModelTier({ totalRamGB: 2, cpuCount: 2 })).toBe('low');
  });

  it('does not promote tier when only one threshold is met', () => {
    // 16 GB but only 4 cores → medium, not high
    expect(pickModelTier({ totalRamGB: 16, cpuCount: 4 })).toBe('medium');
    // 8 cores but only 4 GB → low, not medium
    expect(pickModelTier({ totalRamGB: 4, cpuCount: 8 })).toBe('low');
  });

  it('handles boundary values without flapping', () => {
    expect(pickModelTier({ totalRamGB: 5, cpuCount: 4 })).toBe('low');
    expect(pickModelTier({ totalRamGB: 6, cpuCount: 3 })).toBe('low');
    expect(pickModelTier({ totalRamGB: 15, cpuCount: 8 })).toBe('medium');
    expect(pickModelTier({ totalRamGB: 16, cpuCount: 7 })).toBe('medium');
  });
});

describe('detectHardware', () => {
  it('reports plausible numbers for the host', () => {
    const hw = detectHardware();
    expect(hw.totalRamGB).toBeGreaterThan(0);
    expect(hw.cpuCount).toBeGreaterThan(0);
    expect(typeof hw.platform).toBe('string');
    expect(typeof hw.arch).toBe('string');
  });

  it('rounds RAM down so a 7.9 GB machine does not falsely tip into 8 GB', () => {
    // We can't mock os.totalmem from outside without DI; instead we assert
    // that the value is an integer (Math.floor of bytes/1GB).
    const hw = detectHardware();
    expect(Number.isInteger(hw.totalRamGB)).toBe(true);
  });
});

describe('defaultVoiceForTier', () => {
  it('maps each tier to a concrete voice spec', () => {
    expect(defaultVoiceForTier('low')).toEqual({
      lang: 'en', region: 'en_US', name: 'amy', quality: 'low',
    });
    expect(defaultVoiceForTier('medium')).toEqual({
      lang: 'en', region: 'en_US', name: 'amy', quality: 'medium',
    });
    expect(defaultVoiceForTier('high')).toEqual({
      lang: 'en', region: 'en_US', name: 'libritts', quality: 'high',
    });
  });

  it('falls back to medium for unknown tier rather than throwing', () => {
    expect(defaultVoiceForTier('giga')).toEqual({
      lang: 'en', region: 'en_US', name: 'amy', quality: 'medium',
    });
  });
});

describe('recommendVoice', () => {
  it('returns a complete recommendation: hardware + tier + voice', () => {
    const rec = recommendVoice();
    expect(rec.hardware).toBeDefined();
    expect(['low', 'medium', 'high']).toContain(rec.tier);
    expect(rec.voice).toMatchObject({
      lang: expect.any(String),
      region: expect.any(String),
      name: expect.any(String),
      quality: expect.any(String),
    });
  });

  it('voice quality matches the picked tier', () => {
    const rec = recommendVoice();
    expect(rec.voice.quality).toBe(rec.tier);
  });
});
