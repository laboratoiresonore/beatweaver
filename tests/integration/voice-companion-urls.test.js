import { describe, it, expect } from 'vitest';
import {
  modelUrls,
  modelLocalPaths,
  validateModelResponseHeaders,
} from '../../voice-companion/src/model-download.js';
import { piperReleaseAsset, piperExecutableName } from '../../voice-companion/src/piper-binary.js';

/**
 * URL construction is the most boring kind of bug: silently flips a
 * download to a 404 page and the user blames their network. Pin the
 * patterns so a future refactor that "simplifies" them gets caught.
 */

describe('modelUrls', () => {
  it('builds the correct HuggingFace path for amy-medium', () => {
    const urls = modelUrls({
      lang: 'en', region: 'en_US', name: 'amy', quality: 'medium',
    });
    expect(urls.onnx).toBe(
      'https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/amy/medium/en_US-amy-medium.onnx'
    );
    expect(urls.config).toBe(
      'https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/amy/medium/en_US-amy-medium.onnx.json'
    );
    expect(urls.stem).toBe('en_US-amy-medium');
  });

  it('builds different URLs per quality tier', () => {
    const low = modelUrls({ lang: 'en', region: 'en_US', name: 'amy', quality: 'low' });
    const high = modelUrls({ lang: 'en', region: 'en_US', name: 'libritts', quality: 'high' });

    expect(low.onnx).toContain('/amy/low/en_US-amy-low.onnx');
    expect(high.onnx).toContain('/libritts/high/en_US-libritts-high.onnx');
    expect(low.onnx).not.toBe(high.onnx);
  });
});

describe('modelLocalPaths', () => {
  it('places voice files in a stem-named subdirectory', () => {
    const local = modelLocalPaths('/data/voices', {
      lang: 'en', region: 'en_US', name: 'amy', quality: 'medium',
    });
    expect(local.dir).toMatch(/voices[\\/]en_US-amy-medium$/);
    expect(local.onnx).toMatch(/en_US-amy-medium\.onnx$/);
    expect(local.config).toMatch(/en_US-amy-medium\.onnx\.json$/);
  });

  it('isolates voices from each other so stale partials do not collide', () => {
    const a = modelLocalPaths('/data', { lang: 'en', region: 'en_US', name: 'amy', quality: 'low' });
    const b = modelLocalPaths('/data', { lang: 'en', region: 'en_US', name: 'amy', quality: 'medium' });
    expect(a.dir).not.toBe(b.dir);
  });
});

describe('piperReleaseAsset', () => {
  it('returns the Windows zip on win32+x64', () => {
    const asset = piperReleaseAsset({ platform: 'win32', arch: 'x64' });
    expect(asset.url).toMatch(/piper_windows_amd64\.zip$/);
    expect(asset.archive).toBe('zip');
  });

  it('returns the macOS arm64 tarball on Apple Silicon', () => {
    const asset = piperReleaseAsset({ platform: 'darwin', arch: 'arm64' });
    expect(asset.url).toMatch(/piper_macos_aarch64\.tar\.gz$/);
    expect(asset.archive).toBe('tar.gz');
  });

  it('returns the Linux x64 tarball', () => {
    const asset = piperReleaseAsset({ platform: 'linux', arch: 'x64' });
    expect(asset.url).toMatch(/piper_amd64\.tar\.gz$/);
  });

  it('throws cleanly for unsupported platforms — never returns a 404 URL', () => {
    expect(() => piperReleaseAsset({ platform: 'aix', arch: 'mips' })).toThrow(
      /No Piper binary published/
    );
    expect(() => piperReleaseAsset({ platform: 'win32', arch: 'arm64' })).toThrow();
  });
});

describe('validateModelResponseHeaders', () => {
  // The failure mode: HuggingFace returns a 200 with an HTML "we couldn't find
  // that path" page. If we naively save that to voice.onnx, piper crashes at
  // runtime with a misleading "invalid model" error. Reject up front.

  function fakeResponse({ ok = true, status = 200, statusText = 'OK', contentType = 'application/octet-stream' } = {}) {
    return {
      ok,
      status,
      statusText,
      headers: { get: (k) => (k.toLowerCase() === 'content-type' ? contentType : null) },
    };
  }

  it('accepts a normal binary response', () => {
    const err = validateModelResponseHeaders(fakeResponse());
    expect(err).toBeNull();
  });

  it('rejects an HTML response when expecting binary', () => {
    const err = validateModelResponseHeaders(
      fakeResponse({ contentType: 'text/html; charset=utf-8' }),
    );
    expect(err).toMatch(/HTML page/);
  });

  it('accepts JSON when expectBinary=false (sidecar config)', () => {
    const err = validateModelResponseHeaders(
      fakeResponse({ contentType: 'application/json' }),
      { expectBinary: false },
    );
    expect(err).toBeNull();
  });

  it('rejects on non-2xx regardless of content-type', () => {
    const err = validateModelResponseHeaders(
      fakeResponse({ ok: false, status: 404, statusText: 'Not Found' }),
    );
    expect(err).toMatch(/404/);
  });
});

describe('piperExecutableName', () => {
  it('appends .exe on Windows only', () => {
    expect(piperExecutableName('win32')).toBe('piper.exe');
    expect(piperExecutableName('darwin')).toBe('piper');
    expect(piperExecutableName('linux')).toBe('piper');
  });
});
