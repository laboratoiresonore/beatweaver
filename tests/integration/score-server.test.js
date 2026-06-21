import { describe, it, expect, afterEach } from 'vitest';
import http from 'node:http';
import net from 'node:net';

import {
  createScoreServer,
  startServer,
  closeServer,
  validateScoreRequest,
} from '../../src/server/score-server.js';

/**
 * Contract tests for the headless score-server (Synergy #4).
 *
 * Two concerns are covered:
 *   1. Input validation — /score must reject malformed/out-of-range input with
 *      a 400 instead of silently coercing it (and must reject absurd durations
 *      that could OOM the offline render).
 *   2. Lifecycle — the server starts on 127.0.0.1, serves /health + /score, and
 *      shuts down GRACEFULLY (closeServer, no hard process.exit) leaving the
 *      port free. Graceful shutdown is what keeps the native node-web-audio-api
 *      addon from tripping its libuv teardown assertion.
 *
 * Everything is time-boxed (short clips, explicit timeouts) so a hang fails
 * fast rather than wedging the suite.
 */

// ── small HTTP client over 127.0.0.1 ────────────────────────────────────────
function request(port, { method = 'GET', path = '/', body } = {}) {
  return new Promise((resolve, reject) => {
    const payload = body === undefined ? null : Buffer.from(JSON.stringify(body));
    const req = http.request(
      {
        host: '127.0.0.1',
        port,
        method,
        path,
        headers: payload ? { 'Content-Type': 'application/json', 'Content-Length': payload.length } : {},
      },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () =>
          resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) }));
      }
    );
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

/** True iff nothing is listening on 127.0.0.1:port (i.e. the port is free). */
function portIsFree(port) {
  return new Promise((resolve) => {
    const sock = net.connect({ host: '127.0.0.1', port });
    sock.once('connect', () => { sock.destroy(); resolve(false); });
    sock.once('error', () => resolve(true));
    sock.setTimeout(1000, () => { sock.destroy(); resolve(true); });
  });
}

// ── validation (pure, no server) ────────────────────────────────────────────
describe('score-server.validateScoreRequest', () => {
  it('accepts an empty object (renderer supplies defaults)', () => {
    expect(validateScoreRequest({})).toEqual({ ok: true, value: {} });
  });

  it('accepts a well-formed request', () => {
    const r = validateScoreRequest({ mood: 'hype', energy: 0.8, bpm: 128, key: 'A', duration_ms: 1000 });
    expect(r.ok).toBe(true);
    expect(r.value.bpm).toBe(128);
  });

  it('rejects a non-object body', () => {
    expect(validateScoreRequest(null).ok).toBe(false);
    expect(validateScoreRequest([]).ok).toBe(false);
    expect(validateScoreRequest('nope').ok).toBe(false);
  });

  it('rejects a non-finite bpm instead of silently defaulting', () => {
    const r = validateScoreRequest({ bpm: 'fast' });
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/bpm/);
  });

  it('rejects an out-of-range bpm', () => {
    expect(validateScoreRequest({ bpm: 5 }).ok).toBe(false);
    expect(validateScoreRequest({ bpm: 9999 }).ok).toBe(false);
  });

  it('rejects an absurd duration_ms (OOM guard)', () => {
    const r = validateScoreRequest({ duration_ms: 60 * 60 * 1000 }); // 1 hour
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/duration_ms/);
  });

  it('rejects energy outside 0..1', () => {
    expect(validateScoreRequest({ energy: 5 }).ok).toBe(false);
    expect(validateScoreRequest({ energy: -1 }).ok).toBe(false);
  });

  it('rejects an unknown category', () => {
    expect(validateScoreRequest({ category: 'NOPE' }).ok).toBe(false);
  });

  it('rejects a bad bank', () => {
    expect(validateScoreRequest({ bank: 'Z' }).ok).toBe(false);
  });

  it('ignores unknown keys', () => {
    const r = validateScoreRequest({ bpm: 120, garbage: { a: 1 } });
    expect(r.ok).toBe(true);
    expect(r.value).not.toHaveProperty('garbage');
  });
});

// ── /score handler returns 400 on bad input (no port bind) ──────────────────
describe('score-server /score input validation (in-memory)', () => {
  let server;
  let port;

  afterEach(async () => {
    if (server) await closeServer(server);
    server = undefined;
  });

  async function boot() {
    server = createScoreServer();
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    port = server.address().port;
  }

  it('returns 400 with a JSON error on out-of-range bpm', async () => {
    await boot();
    const res = await request(port, { method: 'POST', path: '/score', body: { bpm: 99999 } });
    expect(res.status).toBe(400);
    const parsed = JSON.parse(res.body.toString());
    expect(parsed.error).toMatch(/bpm/);
  });

  it('returns 400 on an absurd duration (does not attempt render)', async () => {
    await boot();
    const res = await request(port, { method: 'POST', path: '/score', body: { duration_ms: 3600000 } });
    expect(res.status).toBe(400);
  });

  it('returns 404 for an unknown route', async () => {
    await boot();
    const res = await request(port, { method: 'GET', path: '/nope' });
    expect(res.status).toBe(404);
  });
});

// ── full lifecycle smoke: start → /health → /score → graceful stop → free ───
describe('score-server lifecycle (integration smoke)', () => {
  it('binds 127.0.0.1, serves /health + /score, then closes gracefully leaving the port free', async () => {
    const { server, port } = await startServer({ port: 0 }); // 0 ⇒ ephemeral free port
    try {
      // bound on loopback only
      expect(server.address().address).toBe('127.0.0.1');

      // /health
      const health = await request(port, { path: '/health' });
      expect(health.status).toBe(200);
      const hjson = JSON.parse(health.body.toString());
      expect(hjson.ok).toBe(true);
      expect(hjson.ready).toBe(true);
      expect(hjson.presets).toBeGreaterThan(0);

      // one real /score (short clip, time-boxed)
      const score = await request(port, {
        method: 'POST',
        path: '/score',
        body: { mood: 'hype', energy: 0.7, bpm: 120, duration_ms: 500 },
      });
      expect(score.status).toBe(200);
      expect(score.headers['content-type']).toBe('audio/wav');
      const len = Number(score.headers['content-length']);
      expect(len).toBe(score.body.length);
      expect(score.body.toString('ascii', 0, 4)).toBe('RIFF');
      expect(score.body.toString('ascii', 8, 12)).toBe('WAVE');
    } finally {
      // GRACEFUL shutdown — no process.exit, server.close drains the loop.
      await closeServer(server);
    }

    // port must be released after graceful close
    expect(await portIsFree(port)).toBe(true);

    // closeServer is idempotent (calling again on a closed server is a no-op)
    await expect(closeServer(server)).resolves.toBeUndefined();
  }, 30000);
});
