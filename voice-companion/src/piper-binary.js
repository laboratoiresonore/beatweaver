/**
 * Piper TTS binary release-URL builder.
 *
 * Piper publishes prebuilt binaries on its GitHub releases page:
 *   https://github.com/rhasspy/piper/releases
 *
 * Asset naming pattern (as of piper 1.2.0):
 *   piper_amd64.tar.gz       - Linux x64
 *   piper_arm64.tar.gz       - Linux arm64
 *   piper_macos_x64.tar.gz   - macOS x64
 *   piper_macos_aarch64.tar.gz - macOS Apple Silicon
 *   piper_windows_amd64.zip  - Windows x64
 *
 * The binary is ~10 MB compressed, ~30 MB extracted. Same binary is reused
 * across all voice models — only the .onnx weights differ per voice.
 */

const PIPER_VERSION = '2023.11.14-2';
const RELEASE_BASE = `https://github.com/rhasspy/piper/releases/download/${PIPER_VERSION}`;

/**
 * @param {{ platform: string, arch: string }} hw
 * @returns {{ url: string, filename: string, archive: 'tar.gz' | 'zip' }}
 */
export function piperReleaseAsset({ platform, arch }) {
  if (platform === 'win32' && arch === 'x64') {
    return {
      url: `${RELEASE_BASE}/piper_windows_amd64.zip`,
      filename: 'piper_windows_amd64.zip',
      archive: 'zip',
    };
  }
  if (platform === 'darwin' && arch === 'x64') {
    return {
      url: `${RELEASE_BASE}/piper_macos_x64.tar.gz`,
      filename: 'piper_macos_x64.tar.gz',
      archive: 'tar.gz',
    };
  }
  if (platform === 'darwin' && (arch === 'arm64' || arch === 'aarch64')) {
    return {
      url: `${RELEASE_BASE}/piper_macos_aarch64.tar.gz`,
      filename: 'piper_macos_aarch64.tar.gz',
      archive: 'tar.gz',
    };
  }
  if (platform === 'linux' && arch === 'x64') {
    return {
      url: `${RELEASE_BASE}/piper_amd64.tar.gz`,
      filename: 'piper_amd64.tar.gz',
      archive: 'tar.gz',
    };
  }
  if (platform === 'linux' && (arch === 'arm64' || arch === 'aarch64')) {
    return {
      url: `${RELEASE_BASE}/piper_arm64.tar.gz`,
      filename: 'piper_arm64.tar.gz',
      archive: 'tar.gz',
    };
  }
  throw new Error(
    `No Piper binary published for platform=${platform} arch=${arch}. ` +
      'Companion mode unavailable on this system; renderer will fall back to Browser TTS.'
  );
}

/**
 * Filename of the executable inside the extracted archive.
 */
export function piperExecutableName(platform) {
  return platform === 'win32' ? 'piper.exe' : 'piper';
}
