/**
 * Bind to the first available port in a candidate list.
 *
 * v1 uses 17321 (well-known-port-free range, can't collide with another locally-running tool
 * 8190/8191 or common dev servers). If something else has it, fall through
 * 17322..17325 before giving up.
 */

import net from 'node:net';

export const DEFAULT_PORT_CANDIDATES = [17321, 17322, 17323, 17324, 17325];

/**
 * Quickly probe whether a port is bindable on 127.0.0.1.
 */
export function probePort(port, host = '127.0.0.1') {
  return new Promise((resolve) => {
    const tester = net.createServer();
    tester.once('error', () => resolve(false));
    tester.once('listening', () => {
      tester.close(() => resolve(true));
    });
    try {
      tester.listen(port, host);
    } catch {
      resolve(false);
    }
  });
}

/**
 * Find the first free port from the candidate list.
 * @returns {Promise<number>} the port, or throws if all are busy.
 */
export async function pickFreePort(candidates = DEFAULT_PORT_CANDIDATES) {
  for (const port of candidates) {
    // Probe sequentially — these are cheap and short-lived.
    // eslint-disable-next-line no-await-in-loop
    const free = await probePort(port);
    if (free) return port;
  }
  throw new Error(
    `All candidate ports busy (${candidates.join(', ')}). ` +
      'Set BEATWEAVER_VOICE_PORT env var to override.'
  );
}
