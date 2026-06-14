import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import {
  piperBinaryPath,
  isPiperInstalled,
  findPiperBinary,
  extractArchive,
} from '../../voice-companion/src/piper-install.js';

/**
 * Pin the install logic. The actual ensurePiperBinary() function makes
 * real network calls, so we test it via mocked fetch in a separate file.
 * Here we cover the file-system primitives.
 */

describe('piperBinaryPath', () => {
  it('returns <root>/bin/piper.exe on Windows', () => {
    const p = piperBinaryPath('/data', 'win32');
    expect(p).toMatch(/[\\/]bin[\\/]piper\.exe$/);
  });

  it('returns <root>/bin/piper on macOS + Linux (no extension)', () => {
    expect(piperBinaryPath('/data', 'darwin')).toMatch(/[\\/]bin[\\/]piper$/);
    expect(piperBinaryPath('/data', 'linux')).toMatch(/[\\/]bin[\\/]piper$/);
  });
});

describe('isPiperInstalled', () => {
  let tmpRoot;

  beforeEach(() => {
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'piper-test-'));
  });

  afterEach(() => {
    try { fs.rmSync(tmpRoot, { recursive: true, force: true }); } catch {}
  });

  it('returns false when bin/ does not exist', () => {
    expect(isPiperInstalled(tmpRoot, 'linux')).toBe(false);
  });

  it('returns false when binary is suspiciously small (<1 MB)', () => {
    // A torn / partial download; the real piper binary is ~10 MB.
    const binDir = path.join(tmpRoot, 'bin');
    fs.mkdirSync(binDir, { recursive: true });
    fs.writeFileSync(path.join(binDir, 'piper'), Buffer.alloc(1024)); // 1 KB
    expect(isPiperInstalled(tmpRoot, 'linux')).toBe(false);
  });

  it('returns true when binary is plausibly real (>1 MB)', () => {
    const binDir = path.join(tmpRoot, 'bin');
    fs.mkdirSync(binDir, { recursive: true });
    fs.writeFileSync(
      path.join(binDir, 'piper.exe'),
      Buffer.alloc(2 * 1024 * 1024) // 2 MB
    );
    expect(isPiperInstalled(tmpRoot, 'win32')).toBe(true);
  });
});

describe('findPiperBinary', () => {
  let tmpRoot;

  beforeEach(() => {
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'piper-find-'));
  });

  afterEach(() => {
    try { fs.rmSync(tmpRoot, { recursive: true, force: true }); } catch {}
  });

  it('finds binary directly in dir', () => {
    fs.writeFileSync(path.join(tmpRoot, 'piper'), Buffer.alloc(100));
    expect(findPiperBinary(tmpRoot, 'linux')).toMatch(/piper$/);
  });

  it('finds binary in piper/ subdir (typical tarball shape)', () => {
    const sub = path.join(tmpRoot, 'piper');
    fs.mkdirSync(sub);
    fs.writeFileSync(path.join(sub, 'piper.exe'), Buffer.alloc(100));
    const found = findPiperBinary(tmpRoot, 'win32');
    expect(found).toMatch(/[\\/]piper[\\/]piper\.exe$/);
  });

  it('falls through to scanning immediate subdirs', () => {
    const sub = path.join(tmpRoot, 'piper-aarch64-2023.11.14');
    fs.mkdirSync(sub);
    fs.writeFileSync(path.join(sub, 'piper'), Buffer.alloc(100));
    expect(findPiperBinary(tmpRoot, 'linux')).toMatch(/piper$/);
  });

  it('returns null when binary is nowhere', () => {
    expect(findPiperBinary(tmpRoot, 'linux')).toBeNull();
  });

  it('returns null on missing directory without throwing', () => {
    expect(findPiperBinary('/nonexistent/path/here', 'linux')).toBeNull();
  });
});

describe('extractArchive', () => {
  let tmpRoot;

  beforeEach(() => {
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'piper-extract-'));
  });

  afterEach(() => {
    try { fs.rmSync(tmpRoot, { recursive: true, force: true }); } catch {}
  });

  it('rejects with a useful error when tar fails (bad archive)', async () => {
    const fakeArchive = path.join(tmpRoot, 'not-a-tar.tar.gz');
    fs.writeFileSync(fakeArchive, 'definitely not a tarball');
    await expect(extractArchive(fakeArchive, tmpRoot)).rejects.toThrow(/tar exited/);
  });

  it('rejects when archive does not exist', async () => {
    await expect(
      extractArchive(path.join(tmpRoot, 'no-such-file.tar.gz'), tmpRoot)
    ).rejects.toThrow();
  });
});
