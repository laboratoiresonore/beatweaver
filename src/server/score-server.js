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

        let result;
        try {
          result = await renderScore(body);
        } catch (err) {
          // A missing OfflineAudioContext / polyfill surfaces here with an
          // actionable message — bubble it as 500 rather than crashing.
          warn('render failed:', err.message);
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err.message }));
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
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
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
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(finalPort, '127.0.0.1', () => {
      log(`listening on http://127.0.0.1:${finalPort}`);
      log(`POST /score  {mood,energy,bpm,key,category,bank,duration_ms} → audio/wav`);
      resolve();
    });
  });
  return { server, port: finalPort };
}

// Allow `node src/server/score-server.js` for standalone use.
const isMain = import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}`;
if (isMain) {
  startServer().catch((err) => {
    warn('failed to start:', err);
    process.exit(1);
  });
}
