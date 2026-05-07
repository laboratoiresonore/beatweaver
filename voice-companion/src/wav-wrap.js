/**
 * Wrap raw PCM samples in a minimal RIFF/WAV header so the renderer's
 * <audio> element + the Web Audio decodeAudioData both accept the buffer.
 *
 * Piper emits 22050 Hz 16-bit mono raw PCM by default. Browsers won't
 * play raw PCM — they need at least the 44-byte canonical WAV header
 * (RIFF + WAVE + fmt subchunk + data subchunk).
 *
 * Header bytes are easy to get wrong. This lives in its own module so
 * the unit tests can pin every offset.
 */

/**
 * @param {Buffer} pcm - raw little-endian PCM samples
 * @param {{ sampleRate: number, channels: number, bitsPerSample: number }} opts
 * @returns {Buffer} pcm prefixed with a 44-byte RIFF/WAV header
 */
export function wrapPcmAsWav(pcm, { sampleRate, channels, bitsPerSample }) {
  const byteRate = (sampleRate * channels * bitsPerSample) / 8;
  const blockAlign = (channels * bitsPerSample) / 8;
  const dataSize = pcm.length;
  const buffer = Buffer.alloc(44 + dataSize);

  // RIFF chunk descriptor
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);   // chunk size = 36 + data
  buffer.write('WAVE', 8);

  // fmt subchunk
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);             // subchunk-1 size = 16 for PCM
  buffer.writeUInt16LE(1, 20);              // audio format = 1 (PCM)
  buffer.writeUInt16LE(channels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(bitsPerSample, 34);

  // data subchunk
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);
  pcm.copy(buffer, 44);

  return buffer;
}
