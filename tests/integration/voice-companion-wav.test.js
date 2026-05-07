import { describe, it, expect } from 'vitest';
import { wrapPcmAsWav } from '../../voice-companion/src/wav-wrap.js';

/**
 * Pin the WAV-header bytes. RIFF / WAVE / fmt / data offsets and field
 * widths are spec-mandated — getting any of them wrong silently breaks
 * playback in the renderer (decodeAudioData throws an opaque
 * EncodingError; <audio> just refuses to play). Tests are bytewise so
 * any drift is caught immediately.
 */

describe('wrapPcmAsWav', () => {
  const opts = { sampleRate: 22050, channels: 1, bitsPerSample: 16 };

  it('produces a 44-byte header followed by the PCM payload', () => {
    const pcm = Buffer.alloc(100, 0xab);
    const wav = wrapPcmAsWav(pcm, opts);
    expect(wav.length).toBe(44 + 100);
    // PCM payload starts at byte 44 — verify untouched
    expect(wav.subarray(44, 44 + 4).equals(Buffer.from([0xab, 0xab, 0xab, 0xab])))
      .toBe(true);
  });

  it('writes the RIFF/WAVE/fmt/data magic bytes at canonical offsets', () => {
    const wav = wrapPcmAsWav(Buffer.alloc(0), opts);
    expect(wav.toString('ascii', 0, 4)).toBe('RIFF');
    expect(wav.toString('ascii', 8, 12)).toBe('WAVE');
    expect(wav.toString('ascii', 12, 16)).toBe('fmt ');
    expect(wav.toString('ascii', 36, 40)).toBe('data');
  });

  it('encodes RIFF chunk size as (36 + dataSize) little-endian', () => {
    const wav = wrapPcmAsWav(Buffer.alloc(1000), opts);
    expect(wav.readUInt32LE(4)).toBe(36 + 1000);
  });

  it('encodes fmt subchunk as PCM (audio format = 1)', () => {
    const wav = wrapPcmAsWav(Buffer.alloc(0), opts);
    expect(wav.readUInt32LE(16)).toBe(16);   // fmt subchunk size
    expect(wav.readUInt16LE(20)).toBe(1);    // 1 = PCM
  });

  it('round-trips channel count + sample rate + bit depth', () => {
    const wav = wrapPcmAsWav(Buffer.alloc(0), opts);
    expect(wav.readUInt16LE(22)).toBe(1);          // channels
    expect(wav.readUInt32LE(24)).toBe(22050);      // sample rate
    expect(wav.readUInt16LE(34)).toBe(16);         // bits per sample
  });

  it('derives byte rate as sampleRate * channels * bitsPerSample / 8', () => {
    const wav = wrapPcmAsWav(Buffer.alloc(0), opts);
    expect(wav.readUInt32LE(28)).toBe(22050 * 1 * 16 / 8);   // = 44100
  });

  it('derives block align as channels * bitsPerSample / 8', () => {
    const wav = wrapPcmAsWav(Buffer.alloc(0), opts);
    expect(wav.readUInt16LE(32)).toBe(1 * 16 / 8);   // = 2
  });

  it('writes the data subchunk size as PCM payload length', () => {
    const wav = wrapPcmAsWav(Buffer.alloc(2048), opts);
    expect(wav.readUInt32LE(40)).toBe(2048);
  });

  it('handles stereo + 24-bit configurations correctly', () => {
    const stereo24 = { sampleRate: 48000, channels: 2, bitsPerSample: 24 };
    const wav = wrapPcmAsWav(Buffer.alloc(120), stereo24);
    expect(wav.readUInt16LE(22)).toBe(2);
    expect(wav.readUInt32LE(24)).toBe(48000);
    expect(wav.readUInt16LE(34)).toBe(24);
    expect(wav.readUInt32LE(28)).toBe(48000 * 2 * 24 / 8);   // 288000
    expect(wav.readUInt16LE(32)).toBe(2 * 24 / 8);            // 6
  });

  it('produces a buffer parseable by Web Audio decodeAudioData (size >= 44)', () => {
    // Minimum-viable WAV: 44-byte header + 0 bytes of PCM. Empty audio
    // is technically valid (zero-length play) — Announcer.js's blob
    // size check is `< 44`, so 44 must pass.
    const wav = wrapPcmAsWav(Buffer.alloc(0), opts);
    expect(wav.length).toBe(44);
    expect(wav.length).toBeGreaterThanOrEqual(44);
  });
});
