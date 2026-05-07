/**
 * Build URLs + local paths for downloading Piper voice models.
 *
 * Piper hosts voices at huggingface.co/rhasspy/piper-voices. Each voice has
 * two files: the ONNX weights (.onnx) and a config sidecar (.onnx.json).
 * Both must be present for piper to load the model.
 *
 * URL shape:
 *   https://huggingface.co/rhasspy/piper-voices/resolve/main/{lang}/{region}/{name}/{quality}/{region}-{name}-{quality}.onnx
 *
 * Lower-quality variants of `amy` aren't published; we fall back gracefully
 * to medium when low isn't a real upstream artifact.
 */

import path from 'node:path';
import fs from 'node:fs';

const HF_BASE = 'https://huggingface.co/rhasspy/piper-voices/resolve/main';

/**
 * @param {{ lang: string, region: string, name: string, quality: string }} voice
 */
export function modelUrls(voice) {
  const stem = `${voice.region}-${voice.name}-${voice.quality}`;
  const dir = `${HF_BASE}/${voice.lang}/${voice.region}/${voice.name}/${voice.quality}`;
  return {
    onnx: `${dir}/${stem}.onnx`,
    config: `${dir}/${stem}.onnx.json`,
    stem,
  };
}

/**
 * Resolve where this voice should live on disk inside `voicesRoot`.
 */
export function modelLocalPaths(voicesRoot, voice) {
  const stem = `${voice.region}-${voice.name}-${voice.quality}`;
  const dir = path.join(voicesRoot, stem);
  return {
    dir,
    onnx: path.join(dir, `${stem}.onnx`),
    config: path.join(dir, `${stem}.onnx.json`),
    stem,
  };
}

/**
 * True when both the .onnx and .onnx.json files exist on disk and are
 * non-trivial in size. Doesn't verify checksum — that lives in
 * verifyModel().
 */
export function isModelInstalled(voicesRoot, voice) {
  const paths = modelLocalPaths(voicesRoot, voice);
  try {
    const onnxStat = fs.statSync(paths.onnx);
    const configStat = fs.statSync(paths.config);
    // Sanity floor: the smallest real Piper model is ~15 MB. A 0-byte file
    // means a torn / interrupted download.
    return onnxStat.size > 1_000_000 && configStat.size > 100;
  } catch {
    return false;
  }
}

/**
 * Validate a server response *before* writing bytes to disk. HuggingFace
 * sometimes returns a 200 with an HTML error page when a path is wrong;
 * naively saving that to `voice.onnx` results in piper crashing at runtime
 * with a confusing "invalid model" error. Catch it here.
 *
 * @returns {string|null} error message if rejected, null if accepted
 */
export function validateModelResponseHeaders(response, { expectBinary = true } = {}) {
  if (!response.ok) {
    return `Download failed: ${response.status} ${response.statusText}`;
  }
  if (expectBinary) {
    const ct = (response.headers.get('content-type') || '').toLowerCase();
    // Accept octet-stream (HF default for .onnx), application/json (sidecar),
    // application/x-protobuf, audio/* (defensive). Reject text/html — that's
    // the 404-error-page failure mode we care about.
    if (ct.startsWith('text/html')) {
      return `Got HTML page (${ct}); expected binary model. URL likely wrong.`;
    }
  }
  return null;
}

/**
 * Download a single file with progress callback. Writes to `.partial` then
 * atomically renames so a torn download never half-installs.
 *
 * Uses `fetch` (Node 18+) — Beatweaver already requires Node 18 for vite.
 */
export async function downloadFile(url, destPath, { onProgress, signal, expectBinary = true } = {}) {
  const partialPath = `${destPath}.partial`;
  const response = await fetch(url, { signal });

  const reject = validateModelResponseHeaders(response, { expectBinary });
  if (reject) {
    throw new Error(`${reject} (${url})`);
  }

  const total = Number(response.headers.get('content-length')) || 0;

  await fs.promises.mkdir(path.dirname(destPath), { recursive: true });
  const handle = await fs.promises.open(partialPath, 'w');
  let received = 0;

  try {
    const reader = response.body.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      await handle.write(value);
      received += value.length;
      if (onProgress) onProgress({ received, total });
    }
  } finally {
    await handle.close();
  }

  await fs.promises.rename(partialPath, destPath);
  return { bytes: received };
}

/**
 * Download both files for a voice. Returns the local paths.
 */
export async function downloadVoice(voicesRoot, voice, { onProgress, signal } = {}) {
  const urls = modelUrls(voice);
  const local = modelLocalPaths(voicesRoot, voice);

  await fs.promises.mkdir(local.dir, { recursive: true });

  // Sidecar config is JSON, not binary — relax the content-type check
  await downloadFile(urls.config, local.config, {
    onProgress: onProgress
      ? (p) => onProgress({ ...p, file: 'config', voice: local.stem })
      : undefined,
    signal,
    expectBinary: false,
  });

  await downloadFile(urls.onnx, local.onnx, {
    onProgress: onProgress
      ? (p) => onProgress({ ...p, file: 'onnx', voice: local.stem })
      : undefined,
    signal,
    expectBinary: true,
  });

  return local;
}
