/**
 * Beatweaver Voice Companion — HTTP server
 *
 * Spawned by Electron main as a child process. Serves:
 *   GET  /health        → { ok, voice, ready }
 *   POST /tts           → audio/wav  (body: { text })
 *   GET  /setup-status  → { phase, progress }   (during first-launch download)
 *
 * Stdout is structured: emits `[voice-companion]` prefixed lines so the
 * Electron main can grep for status without parsing JSON.
 */

import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { spawn } from 'node:child_process';

import { recommendVoice } from './hardware-detect.js';
import { pickFreePort } from './port-bind.js';
import {
  isModelInstalled,
  modelLocalPaths,
  downloadVoice,
} from './model-download.js';
import {
  piperReleaseAsset,
  piperExecutableName,
} from './piper-binary.js';

const log = (...args) => console.log('[voice-companion]', ...args);
const warn = (...args) => console.warn('[voice-companion]', ...args);

const SETUP_STATE = {
  phase: 'idle', // idle | detecting | downloading-binary | downloading-voice | ready | error
  message: '',
  progress: { received: 0, total: 0 },
};

/**
 * Resolve the user-data directory the companion stores everything under.
 * Electron passes its `app.getPath('userData')` via the
 * BEATWEAVER_VOICE_DATA env var. Standalone invocation (tests, manual) falls
 * back to ~/.beatweaver/voice.
 */
function dataRoot() {
  if (process.env.BEATWEAVER_VOICE_DATA) {
    return process.env.BEATWEAVER_VOICE_DATA;
  }
  return path.join(os.homedir(), '.beatweaver', 'voice');
}

function readJsonSafe(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch {
    return null;
  }
}

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

/**
 * One-time setup: pick voice for this hardware, download Piper binary +
 * voice model. Idempotent — returns immediately if everything's in place.
 */
async function ensureReady(root) {
  const configPath = path.join(root, 'config.json');
  let config = readJsonSafe(configPath);

  if (!config) {
    SETUP_STATE.phase = 'detecting';
    const recommendation = recommendVoice();
    config = {
      version: 1,
      hardware: recommendation.hardware,
      tier: recommendation.tier,
      voice: recommendation.voice,
      createdAt: new Date().toISOString(),
    };
    writeJson(configPath, config);
    log(`detected hardware → tier=${config.tier} voice=${config.voice.region}-${config.voice.name}-${config.voice.quality}`);
  }

  const voicesRoot = path.join(root, 'voices');
  if (!isModelInstalled(voicesRoot, config.voice)) {
    SETUP_STATE.phase = 'downloading-voice';
    log(`downloading voice ${config.voice.region}-${config.voice.name}-${config.voice.quality}`);
    await downloadVoice(voicesRoot, config.voice, {
      onProgress: ({ received, total, file }) => {
        SETUP_STATE.progress = { received, total };
        SETUP_STATE.message = `downloading ${file}`;
      },
    });
    log('voice download complete');
  }

  // Piper binary check is intentionally informational here — actually
  // installing it requires unzip/tar logic we'll add when the rest of the
  // pipeline is wired. For v1 the user can drop a piper binary into
  // <root>/bin/ manually as a stopgap.
  const piperPath = path.join(root, 'bin', piperExecutableName(process.platform));
  if (!fs.existsSync(piperPath)) {
    const asset = piperReleaseAsset({
      platform: process.platform,
      arch: process.arch,
    });
    warn(`piper binary missing at ${piperPath} — download it from ${asset.url} until auto-install lands`);
  }

  SETUP_STATE.phase = 'ready';
  return { config, voicesRoot, piperPath };
}

/**
 * Synthesize text → WAV via piper subprocess. Resolves to a Buffer.
 */
async function synthesize({ piperPath, voiceConfig, text }) {
  const localPaths = modelLocalPaths(
    path.dirname(path.dirname(piperPath)) + '/voices', // fallback wiring
    voiceConfig
  );
  return new Promise((resolve, reject) => {
    const piper = spawn(piperPath, [
      '--model', localPaths.onnx,
      '--output_raw', // raw 16-bit PCM on stdout
    ]);
    const chunks = [];
    piper.stdout.on('data', (chunk) => chunks.push(chunk));
    piper.stderr.on('data', (chunk) => warn('piper stderr:', chunk.toString()));
    piper.on('error', reject);
    // stdin can EPIPE if piper dies before we finish writing — without an
    // 'error' listener, that bubbles as an unhandledRejection and crashes the
    // companion. Catch it here; the 'error'/'close' handlers on `piper`
    // itself surface the real failure to the caller.
    piper.stdin.on('error', (err) => warn('piper stdin error:', err.message));
    piper.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`piper exited ${code}`));
        return;
      }
      const pcm = Buffer.concat(chunks);
      resolve(wrapPcmAsWav(pcm, { sampleRate: 22050, channels: 1, bitsPerSample: 16 }));
    });
    try {
      piper.stdin.write(text);
      piper.stdin.end();
    } catch (err) {
      // sync throw is rare (only when stdin is already destroyed); the close
      // handler will still fire with a non-zero code and reject for us.
      warn('piper stdin write threw:', err.message);
    }
  });
}

/**
 * Wrap raw PCM in a minimal RIFF/WAV header so the renderer's <audio>
 * element can play it. Piper emits 22050 Hz 16-bit mono raw PCM by default.
 */
function wrapPcmAsWav(pcm, { sampleRate, channels, bitsPerSample }) {
  const byteRate = (sampleRate * channels * bitsPerSample) / 8;
  const blockAlign = (channels * bitsPerSample) / 8;
  const dataSize = pcm.length;
  const buffer = Buffer.alloc(44 + dataSize);

  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20); // PCM
  buffer.writeUInt16LE(channels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(bitsPerSample, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);
  pcm.copy(buffer, 44);

  return buffer;
}

async function readJsonBody(req, max = 1024 * 16) {
  return new Promise((resolve, reject) => {
    let total = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      total += chunk.length;
      if (total > max) {
        reject(new Error('payload too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf-8')));
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

export async function startServer({ port: requestedPort, root = dataRoot() } = {}) {
  fs.mkdirSync(root, { recursive: true });

  // Run setup in the background so /health can report progress while we
  // download. Don't block listen() on it.
  const setupPromise = ensureReady(root).catch((err) => {
    SETUP_STATE.phase = 'error';
    SETUP_STATE.message = err.message;
    warn('setup failed:', err.message);
    return null;
  });

  const port = requestedPort ?? Number(process.env.BEATWEAVER_VOICE_PORT) ?? null;
  const finalPort = port || (await pickFreePort());

  const server = http.createServer(async (req, res) => {
    try {
      if (req.method === 'GET' && req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          ok: true,
          phase: SETUP_STATE.phase,
          ready: SETUP_STATE.phase === 'ready',
        }));
        return;
      }
      if (req.method === 'GET' && req.url === '/setup-status') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(SETUP_STATE));
        return;
      }
      if (req.method === 'POST' && req.url === '/tts') {
        if (SETUP_STATE.phase !== 'ready') {
          res.writeHead(503, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'companion not ready', phase: SETUP_STATE.phase }));
          return;
        }
        const body = await readJsonBody(req);
        if (!body.text || typeof body.text !== 'string') {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'missing text' }));
          return;
        }
        const setup = await setupPromise;
        if (!setup) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'setup failed', message: SETUP_STATE.message }));
          return;
        }
        const wav = await synthesize({
          piperPath: setup.piperPath,
          voiceConfig: setup.config.voice,
          text: body.text.slice(0, 500), // hard cap; cues are 2-6 words
        });
        res.writeHead(200, { 'Content-Type': 'audio/wav' });
        res.end(wav);
        return;
      }
      res.writeHead(404).end();
    } catch (err) {
      warn('request error:', err.message);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
  });

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(finalPort, '127.0.0.1', () => {
      log(`listening on http://127.0.0.1:${finalPort}`);
      resolve();
    });
  });

  return { server, port: finalPort, root, setupPromise };
}

// Allow `node src/server.js` for standalone testing
const isMain = import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}`;
if (isMain) {
  startServer().catch((err) => {
    warn('failed to start:', err);
    process.exit(1);
  });
}
