/**
 * Beatweaver Score Server — HEADLESS audio scoring over HTTP (Synergy #4)
 *
 * A tiny localhost HTTP server that turns a vibe request into a rendered
 * audio clip, with NO Electron window and NO browser. Mirrors the style of
 * the voice-companion server (voice-companion/src/server.js): same JSON-body
 * reader, same structured `[score-server]` stdout prefix, same 127.0.0.1
 * bind, same WAV content type.
 *
 *   GET  /health   → { ok, ready, presets }
 *   POST /score    → audio/wav  (body: { mood, energy, bpm, key,
 *                                        category, bank, duration_ms, preset })
 *
 * IMPORTANT: this server is NOT auto-started anywhere. It is launched only
 * by an explicit `node src/server/score-server.js` (or by a future opt-in
 * Electron-main spawn, exactly like the voice companion). Nothing in the
 * existing app imports it.
 *
 * Rendering is delegated to src/core/OfflineRenderer.js, which uses an
 * OfflineAudioContext from `node-web-audio-api` (Tone.js cannot load under
 * bare Node — see OfflineRenderer.js header for the full rationale).
 */

import http from 'node:http';

import { renderScore } from '../core/OfflineRenderer.js';
import { getAllPresets } from '../presets/index.js';

const log = (...args) => console.log('[score-server]', ...args);
const warn = (...args) => console.warn('[score-server]', ...args);

const DEFAULT_PORT = 5277; // arbitrary high port, distinct from voice companion

// Hard request-shape bounds. The renderer (OfflineRenderer.renderScore) ALSO
// clamps these — these mirror the renderer's accepted ranges so we can reject
// obviously-bad input at the edge with a 400 instead of silently coercing it.
// The duration ceiling in particular guards against an OOM/CPU runaway: a
// headless OfflineAudioContext render allocates ~sampleRate*channels*duration
// frames up front, so an absurd duration must never reach the renderer.
const LIMITS = {
  BPM_MIN: 40,
  BPM_MAX: 240,
  DURATION_MS_MIN: 250,
  DURATION_MS_MAX: 30000, // ~30s ceiling — matches OfflineRenderer
  ENERGY_MIN: 0,
  ENERGY_MAX: 1,
};

const VALID_CATEGORIES = ['BASS', 'ENERGY', 'TEXTURE', 'FX'];

/**
 * Validate + normalize a /score request body. Returns { ok, value } on success
 * or { ok:false, error } describing the first offending field. Unknown/extra
 * keys are ignored. Missing fields are allowed (the renderer supplies sane
 * defaults) — we only reject values that are PRESENT but malformed/out-of-range,
 * so a bad caller fails loudly instead of getting a silently-coerced render.
 *
 * @param {*} body parsed JSON body (must be a plain object)
 * @returns {{ok: true, value: object} | {ok: false, error: string}}
 */
export function validateScoreRequest(body) {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, error: 'body must be a JSON object' };
  }

  const out = {};

  // Numeric, range-checked fields. Present-but-not-finite ⇒ 400.
  const numField = (key, min, max) => {
    if (body[key] === undefined || body[key] === null) return null;
    const n = Number(body[key]);
    if (!Number.isFinite(n)) {
      return `${key} must be a finite number`;
    }
    if (n < min || n > max) {
      return `${key} must be between ${min} and ${max}`;
    }
    out[key] = n;
    return null;
  };

  let err =
    numField('bpm', LIMITS.BPM_MIN, LIMITS.BPM_MAX) ||
    numField('duration_ms', LIMITS.DURATION_MS_MIN, LIMITS.DURATION_MS_MAX) ||
    numField('energy', LIMITS.ENERGY_MIN, LIMITS.ENERGY_MAX);
  if (err) return { ok: false, error: err };

  // String / enum fields.
  if (body.category !== undefined && body.category !== null) {
    if (typeof body.category !== 'string'
      || !VALID_CATEGORIES.includes(body.category.toUpperCase())) {
      return { ok: false, error: `category must be one of ${VALID_CATEGORIES.join(', ')}` };
    }
    out.category = body.category;
  }
  if (body.bank !== undefined && body.bank !== null) {
    if (typeof body.bank !== 'string' || !/^[AB]$/i.test(body.bank)) {
      return { ok: false, error: 'bank must be "A" or "B"' };
    }
    out.bank = body.bank;
  }
  if (body.key !== undefined && body.key !== null) {
    if (typeof body.key !== 'string' || body.key.length > 8) {
      return { ok: false, error: 'key must be a short string like "A" or "F#m"' };
    }
    out.key = body.key;
  }
  if (body.mood !== undefined && body.mood !== null) {
    if (typeof body.mood !== 'string' || body.mood.length > 32) {
      return { ok: false, error: 'mood must be a short string' };
    }
    out.mood = body.mood;
  }
  if (body.preset !== undefined && body.preset !== null) {
    if (typeof body.preset !== 'string' || body.preset.length > 64) {
      return { ok: false, error: 'preset must be a string preset id' };
    }
    out.preset = body.preset;
  }

  return { ok: true, value: out };
}

/**
 * Read + JSON-parse a request body with a size cap. Mirrors the companion
 * server's readJsonBody. An empty body resolves to {} (so /score with no
 * body still scores a sensible default).
 */
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
      const raw = Buffer.concat(chunks).toString('utf-8').trim();
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch (err) {
        reject(new Error(`invalid JSON body: ${err.message}`));
      }
    });
    req.on('error', reject);
  });
}

/**
 * Build (but do not listen on) the HTTP server. Exported so tests can drive
 * it without binding a port.
 */
export function createScoreServer() {
  return http.createServer(async (req, res) => {
    try {
      if (req.method === 'GET' && req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          ok: true,
          ready: true,
          service: 'beatweaver-score-server',
          presets: getAllPresets().length,
        }));
        return;
      }

      if (req.method === 'POST' && req.url === '/score') {
        let body;
        try {
          body = await readJsonBody(req);
        } catch (err) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err.message }));
          return;
        }

        const validated = validateScoreRequest(body);
        if (!validated.ok) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: validated.error }));
          return;
        }

        let result;
        try {
          result = await renderScore(validated.value);
        } catch (err) {
          // A missing OfflineAudioContext / polyfill surfaces here with an
          // actionable message — log it server-side, but return a generic
          // message to the client so internal detail (paths, stack hints)
          // never leaks over the wire.
          warn('render failed:', err.message);
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'render failed' }));
          return;
        }

        log(`scored ${result.meta.presetId} (${result.meta.selection}) → ${result.wav.length} bytes`);
        res.writeHead(200, {
          'Content-Type': 'audio/wav',
          'Content-Length': result.wav.length,
          // Expose the resolved preset so a caller can log/inspect without
          // a separate round-trip.
          'X-Beatweaver-Preset': result.meta.presetId,
          'X-Beatweaver-Bpm': String(result.meta.bpm),
          'X-Beatweaver-Key': String(result.meta.key),
        });
        res.end(result.wav);
        return;
      }

      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'not found', routes: ['GET /health', 'POST /score'] }));
    } catch (err) {
      warn('request error:', err.message);
      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'internal error' }));
      } else {
        res.end();
      }
    }
  });
}

/**
 * Start listening. Port precedence: arg → BEATWEAVER_SCORE_PORT env →
 * DEFAULT_PORT. Always binds 127.0.0.1 (localhost-only).
 */
export async function startServer({ port } = {}) {
  const finalPort = port
    ?? (process.env.BEATWEAVER_SCORE_PORT
      ? Number(process.env.BEATWEAVER_SCORE_PORT)
      : DEFAULT_PORT);

  const server = createScoreServer();
  const boundPort = await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(finalPort, '127.0.0.1', () => {
      // When finalPort is 0 the OS assigns an ephemeral port — read the ACTUAL
      // bound port back from the server rather than returning the requested 0.
      const addr = server.address();
      const actual = (addr && typeof addr === 'object') ? addr.port : finalPort;
      log(`listening on http://127.0.0.1:${actual}`);
      log(`POST /score  {mood,energy,bpm,key,category,bank,duration_ms} → audio/wav`);
      resolve(actual);
    });
  });
  return { server, port: boundPort };
}

/**
 * Gracefully close a running server: stop accepting connections, let in-flight
 * requests finish, then resolve. We intentionally do NOT call process.exit()
 * here — letting the event loop drain naturally avoids the libuv teardown
 * assertion (`async.c` line 76) that the native node-web-audio-api addon can
 * trigger when the process is torn down hard while audio resources are still
 * referenced. Once the server stops and no AudioContext is pending, the loop
 * empties and Node exits 0 on its own.
 *
 * Resolves even if `server` is already closed/never-listened (idempotent).
 *
 * @param {import('node:http').Server} server
 * @returns {Promise<void>}
 */
export function closeServer(server) {
  return new Promise((resolve) => {
    if (!server || !server.listening) {
      resolve();
      return;
    }
    server.close(() => resolve());
    // Stop keep-alive sockets from holding the loop open so the process can
    // exit promptly after the last request drains (Node ≥18.2).
    if (typeof server.closeIdleConnections === 'function') {
      server.closeIdleConnections();
    }
  });
}

/**
 * Install SIGINT/SIGTERM handlers that close the server gracefully (no hard
 * process.exit). After close, removing the signal listeners + the drained
 * server lets the event loop empty and Node exits naturally with code 0.
 *
 * @param {import('node:http').Server} server
 */
export function installSignalHandlers(server) {
  let shuttingDown = false;
  const onSignal = async (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    log(`received ${signal}, shutting down gracefully…`);
    try {
      await closeServer(server);
      log('closed; event loop draining.');
    } catch (err) {
      warn('error during shutdown:', err.message);
    }
    // Do NOT call process.exit — with the server closed and no work pending
    // the loop empties on its own (clean libuv teardown). Removing our own
    // listeners ensures nothing keeps the process alive artificially.
    process.removeListener('SIGINT', onSignal);
    process.removeListener('SIGTERM', onSignal);
  };
  process.on('SIGINT', () => onSignal('SIGINT'));
  process.on('SIGTERM', () => onSignal('SIGTERM'));
}

// Allow `node src/server/score-server.js` for standalone use.
const isMain = import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}`;
if (isMain) {
  startServer()
    .then(({ server }) => {
      installSignalHandlers(server);
    })
    .catch((err) => {
      // Startup (bind) failure: nothing has been rendered and no AudioContext
      // exists, so there is no native resource to drain — a non-zero exit here
      // is safe and won't trip the teardown assertion. Set the code and let
      // the (now-empty) loop exit rather than tearing down mid-stack.
      warn('failed to start:', err.message);
      process.exitCode = 1;
    });
}
