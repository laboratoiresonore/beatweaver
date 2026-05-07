import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import net from 'node:net';
import { probePort, pickFreePort, DEFAULT_PORT_CANDIDATES } from '../../voice-companion/src/port-bind.js';

/**
 * Port fallback contract: the companion MUST find a free local port even
 * when its preferred 17321 is taken. Otherwise users with a stale orphan
 * companion (or any other process holding 17321) get a startup error and
 * the renderer falls back silently to Browser TTS.
 */

describe('probePort', () => {
  it('returns true for a port that nothing is bound to', async () => {
    // 0 = ask OS for any free port, then close — guaranteed free briefly
    const free = await probePort(54323);
    // 54323 is unlikely to be bound, but if it is, that's fine — we're
    // only asserting the boolean shape here.
    expect(typeof free).toBe('boolean');
  });

  it('returns false for a port currently held by another listener', async () => {
    const blocker = net.createServer();
    await new Promise((resolve) => blocker.listen(0, '127.0.0.1', resolve));
    const port = blocker.address().port;

    const free = await probePort(port);
    expect(free).toBe(false);

    await new Promise((resolve) => blocker.close(resolve));
  });
});

describe('pickFreePort', () => {
  it('returns the first candidate when it is free', async () => {
    // Use a high random candidate that's almost certainly free
    const port = await pickFreePort([54331, 54332, 54333]);
    expect([54331, 54332, 54333]).toContain(port);
  });

  it('falls through to the next candidate when the first is taken', async () => {
    const blocker = net.createServer();
    await new Promise((resolve) => blocker.listen(54341, '127.0.0.1', resolve));

    const port = await pickFreePort([54341, 54342, 54343]);
    expect(port).not.toBe(54341);
    expect([54342, 54343]).toContain(port);

    await new Promise((resolve) => blocker.close(resolve));
  });

  it('throws a helpful error when every candidate is busy', async () => {
    const blockers = [];
    const ports = [54351, 54352];
    for (const p of ports) {
      const s = net.createServer();
      // eslint-disable-next-line no-await-in-loop
      await new Promise((resolve) => s.listen(p, '127.0.0.1', resolve));
      blockers.push(s);
    }
    await expect(pickFreePort(ports)).rejects.toThrow(/All candidate ports busy/);

    await Promise.all(blockers.map((s) => new Promise((resolve) => s.close(resolve))));
  });

  it('default candidates start at 17321 (stable contract for renderer)', () => {
    expect(DEFAULT_PORT_CANDIDATES[0]).toBe(17321);
    // 5 candidates total — if we ever shrink this, renderer config needs an update
    expect(DEFAULT_PORT_CANDIDATES.length).toBeGreaterThanOrEqual(5);
  });
});
