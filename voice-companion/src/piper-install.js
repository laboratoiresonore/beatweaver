/**
 * Auto-install the Piper TTS binary on first launch.
 *
 * The v1 design deferred this — users had to drop a piper executable
 * into <root>/bin/ manually. That made Companion mode effectively
 * gated on the user reading the design doc, which most won't.
 *
 * v2: detect platform, download the right release archive, extract via
 * the system `tar` (built into Win10+/macOS/Linux since the late 2010s),
 * and verify the binary lands where the server expects it.
 *
 * No new npm dependencies. Just `fetch` (Node 18+) and `child_process`.
 */

import path from 'node:path';
import fs from 'node:fs';
import { spawn } from 'node:child_process';

import { piperReleaseAsset, piperExecutableName } from './piper-binary.js';
import { downloadFile } from './model-download.js';

const log = (...args) => console.log('[voice-companion]', ...args);
const warn = (...args) => console.warn('[voice-companion]', ...args);

/**
 * Where the piper binary should live after install.
 */
export function piperBinaryPath(root, platform = process.platform) {
  return path.join(root, 'bin', piperExecutableName(platform));
}

/**
 * True iff the binary exists and is non-trivial in size. Sub-1 MB
 * means a stale partial / wrong file.
 */
export function isPiperInstalled(root, platform = process.platform) {
  const binPath = piperBinaryPath(root, platform);
  try {
    const stat = fs.statSync(binPath);
    return stat.size > 1_000_000;
  } catch {
    return false;
  }
}

/**
 * Extract a tar.gz or zip via the system tar.
 * Win10 17063+, macOS, and Linux all ship `tar` capable of both formats.
 */
export function extractArchive(archivePath, destDir) {
  return new Promise((resolve, reject) => {
    const child = spawn('tar', ['-xf', archivePath, '-C', destDir], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stderr = '';
    child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`tar exited ${code}: ${stderr.trim()}`));
    });
  });
}

/**
 * Find the piper binary in `dir`, recursing one level. Piper's tarballs
 * extract to a `piper/` subfolder containing the binary; zip variants
 * sometimes flatten. Search both shapes.
 *
 * @returns {string|null} absolute path to the binary, or null if not found
 */
export function findPiperBinary(dir, platform = process.platform) {
  const exeName = piperExecutableName(platform);
  // Direct hit
  const direct = path.join(dir, exeName);
  if (fs.existsSync(direct)) return direct;
  // Subdir hit (typical piper/piper or piper/piper.exe shape)
  for (const sub of ['piper', 'piper-amd64', 'piper-aarch64']) {
    const candidate = path.join(dir, sub, exeName);
    if (fs.existsSync(candidate)) return candidate;
  }
  // Last-resort scan of immediate children
  try {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        const candidate = path.join(dir, entry.name, exeName);
        if (fs.existsSync(candidate)) return candidate;
      }
    }
  } catch {
    // dir doesn't exist or unreadable — fall through
  }
  return null;
}

/**
 * Idempotent installer. Returns the binary path; throws on unrecoverable
 * failure (no Piper release for this platform, network failure, etc.).
 */
export async function ensurePiperBinary(root, {
  platform = process.platform,
  arch = process.arch,
  onProgress,
  signal,
} = {}) {
  const targetPath = piperBinaryPath(root, platform);
  if (isPiperInstalled(root, platform)) {
    return targetPath;
  }

  log(`installing piper binary for ${platform}-${arch}…`);

  const asset = piperReleaseAsset({ platform, arch });
  const stagingDir = path.join(root, '.piper-install');
  fs.mkdirSync(stagingDir, { recursive: true });

  const archivePath = path.join(stagingDir, asset.filename);
  log(`downloading ${asset.url}`);
  await downloadFile(asset.url, archivePath, {
    onProgress: onProgress
      ? (p) => onProgress({ ...p, file: 'piper-binary' })
      : undefined,
    signal,
    expectBinary: true,
  });

  log(`extracting ${asset.filename}`);
  const extractDir = path.join(stagingDir, 'extract');
  fs.mkdirSync(extractDir, { recursive: true });
  await extractArchive(archivePath, extractDir);

  const found = findPiperBinary(extractDir, platform);
  if (!found) {
    throw new Error(
      `piper binary not found inside ${asset.filename} after extraction. ` +
        `Looked in ${extractDir} and immediate subdirs.`
    );
  }

  // Move the entire piper/ folder into <root>/bin (the binary needs its
  // sibling .so / .dll / espeak-ng-data files — those live alongside the
  // exe in piper's release layout).
  const binDir = path.join(root, 'bin');
  fs.mkdirSync(binDir, { recursive: true });

  const sourceFolder = path.dirname(found);
  for (const entry of fs.readdirSync(sourceFolder)) {
    const src = path.join(sourceFolder, entry);
    const dst = path.join(binDir, entry);
    fs.renameSync(src, dst);
  }

  // chmod +x on the binary on POSIX (Windows ignores).
  if (platform !== 'win32') {
    try { fs.chmodSync(targetPath, 0o755); } catch { /* fine */ }
  }

  // Tidy up the staging dir.
  try {
    fs.rmSync(stagingDir, { recursive: true, force: true });
  } catch (err) {
    warn(`stage cleanup failed (harmless): ${err.message}`);
  }

  if (!isPiperInstalled(root, platform)) {
    throw new Error(`piper install completed but binary missing at ${targetPath}`);
  }
  log(`piper installed → ${targetPath}`);
  return targetPath;
}
