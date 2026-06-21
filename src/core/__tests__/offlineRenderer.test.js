import { describe, it, expect } from 'vitest';
import { renderScore, selectPreset } from '../OfflineRenderer.js';

/**
 * Headless-rendering smoke tests for Synergy #4.
 *
 * These exercise the REAL render path: OfflineRenderer dynamically imports
 * node-web-audio-api's OfflineAudioContext (Vitest runs in a Node env with
 * no global Web Audio API), schedules the preset voices, and encodes WAV.
 *
 * Kept short (1s clip) and bounded so a hang on the audio context fails fast
 * rather than wedging CI. Each test inherits the file-level testTimeout.
 */

describe('OfflineRenderer.selectPreset', () => {
  it('honors an explicit preset id', () => {
    const { preset } = selectPreset({ preset: 'PUMP_IT_UP' });
    expect(preset.id).toBe('PUMP_IT_UP');
  });

  it('maps a mood word onto a category', () => {
    const { preset } = selectPreset({ mood: 'heavy' });
    expect(preset.category).toBe('BASS');
  });

  it('respects an explicit category + bank', () => {
    const { preset } = selectPreset({ category: 'FX', bank: 'B' });
    expect(preset.category).toBe('FX');
    expect(preset.bank).toBe('B');
  });

  it('always returns a valid preset for garbage input', () => {
    const { preset } = selectPreset({ mood: 'asdfqwerty', category: 'NOPE' });
    expect(preset).toBeTruthy();
    expect(typeof preset.id).toBe('string');
  });
});

describe('OfflineRenderer.renderScore (headless)', () => {
  it('renders a 1-second clip to a non-empty WAV with a valid RIFF header', async () => {
    const { wav, meta } = await renderScore({
      mood: 'hype',
      energy: 0.8,
      bpm: 128,
      key: 'A',
      duration_ms: 1000,
    });

    // Buffer must be substantially larger than just a header.
    expect(Buffer.isBuffer(wav)).toBe(true);
    expect(wav.length).toBeGreaterThan(44);

    // Valid RIFF/WAVE/fmt/data magic at canonical offsets.
    expect(wav.toString('ascii', 0, 4)).toBe('RIFF');
    expect(wav.toString('ascii', 8, 12)).toBe('WAVE');
    expect(wav.toString('ascii', 12, 16)).toBe('fmt ');
    expect(wav.toString('ascii', 36, 40)).toBe('data');

    // Header self-consistency: RIFF size = 36 + dataSize, and the byte
    // count after the 44-byte header equals the declared data subchunk size.
    const dataSize = wav.readUInt32LE(40);
    expect(wav.readUInt32LE(4)).toBe(36 + dataSize);
    expect(wav.length - 44).toBe(dataSize);

    // 16-bit PCM mono at the requested rate.
    expect(wav.readUInt16LE(20)).toBe(1);     // PCM
    expect(wav.readUInt16LE(22)).toBe(1);     // mono
    expect(wav.readUInt16LE(34)).toBe(16);    // bits per sample

    // ~1s + 0.3s tail of 16-bit mono @ 44.1k should be > 40 KB of audio.
    expect(dataSize).toBeGreaterThan(40000);

    // Metadata sanity.
    expect(meta.bpm).toBe(128);
    expect(meta.duration_ms).toBe(1000);
    expect(typeof meta.presetId).toBe('string');
  });

  it('produces audible (non-silent) samples', async () => {
    const { wav } = await renderScore({
      preset: 'PUMP_IT_UP',
      bpm: 120,
      duration_ms: 1000,
    });
    // Scan the PCM payload for any non-zero 16-bit sample.
    let peak = 0;
    for (let i = 44; i + 1 < wav.length; i += 2) {
      const s = Math.abs(wav.readInt16LE(i));
      if (s > peak) peak = s;
    }
    expect(peak).toBeGreaterThan(100); // real signal, not silence
  });
});
