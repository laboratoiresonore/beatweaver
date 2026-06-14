const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { execFile, fork } = require('child_process');
const Store = require('electron-store');

let store;
const isDev = process.env.NODE_ENV !== 'production' || !app.isPackaged;

let mainWindow;
let voiceCompanion = null; // child process holding the Piper TTS HTTP server

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 700,
    backgroundColor: '#0a0a0a',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
    autoHideMenuBar: true,
    title: 'Beatweaver',
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function setupIpcHandlers() {
  // Settings IPC handlers
  ipcMain.handle('settings:get', (_, key) => {
  if (key) {
    return store.get(key);
  }
  return store.store;
});

ipcMain.handle('settings:set', (_, key, value) => {
  store.set(key, value);
  return true;
});

ipcMain.handle('settings:delete', (_, key) => {
  store.delete(key);
  return true;
});

// App info
ipcMain.handle('app:info', () => ({
  version: app.getVersion(),
  name: app.getName(),
  isDev,
}));

// TTS synthesis via Windows SAPI - generates WAV data for Web Audio effects
ipcMain.handle('tts:synthesize', async (_, text, options = {}) => {
  if (process.platform !== 'win32') return null;

  const tempFile = path.join(os.tmpdir(), `bw_tts_${Date.now()}.wav`);
  const escapedText = text.replace(/'/g, "''").replace(/[\r\n]/g, ' ');
  const rate = Math.max(-10, Math.min(10, Math.round(((options.rate || 1) - 1) * 5)));

  const voiceCmd = options.voiceName
    ? `try { $synth.SelectVoice('${options.voiceName.replace(/'/g, "''")}') } catch {};`
    : '';

  const script = [
    'Add-Type -AssemblyName System.Speech;',
    '$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer;',
    voiceCmd,
    `$synth.Rate = ${rate};`,
    `$synth.SetOutputToWaveFile('${tempFile}');`,
    `$synth.Speak('${escapedText}');`,
    '$synth.Dispose()',
  ].join(' ');

  // Use full path - Electron child_process may not inherit system PATH
  const psPath = path.join(process.env.SystemRoot || 'C:\\Windows',
    'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');

  try {
    await new Promise((resolve, reject) => {
      execFile(psPath, ['-NoProfile', '-NonInteractive', '-Command', script],
        { timeout: 10000 },
        (err) => err ? reject(err) : resolve()
      );
    });

    const data = fs.readFileSync(tempFile);
    fs.unlinkSync(tempFile);
    // CRITICAL: Buffer.buffer can return a shared ArrayBuffer from Node's pool.
    // We must copy to a dedicated ArrayBuffer to avoid sending garbage data over IPC.
    const copy = new Uint8Array(data.byteLength);
    copy.set(new Uint8Array(data.buffer, data.byteOffset, data.byteLength));
    return copy.buffer;
  } catch (err) {
    try { fs.unlinkSync(tempFile); } catch {}
    console.error('TTS synthesis failed:', err.message);
    return null;
  }
});
}

/**
 * Spawn the bundled voice-companion as a Node child process if the user has
 * opted in (settings.ttsMode === 'companion'). The companion runs an HTTP
 * server on 127.0.0.1:17321 and the renderer talks to it via Announcer.js.
 *
 * Resolves the entry script via two paths:
 *   - Dev: <repo>/voice-companion/src/server.js  (running from source tree)
 *   - Packaged: process.resourcesPath/voice-companion/src/server.js
 *     (electron-builder copies the directory via extraResources)
 */
function startVoiceCompanion() {
  if (voiceCompanion) return; // already running, don't double-start

  const entry = isDev
    ? path.join(__dirname, '..', 'voice-companion', 'src', 'server.js')
    : path.join(process.resourcesPath, 'voice-companion', 'src', 'server.js');

  if (!fs.existsSync(entry)) {
    console.warn(`[voice-companion] entry not found: ${entry} — companion mode unavailable`);
    return;
  }

  const dataRoot = path.join(app.getPath('userData'), 'voice');

  try {
    voiceCompanion = fork(entry, [], {
      env: {
        ...process.env,
        BEATWEAVER_VOICE_DATA: dataRoot,
      },
      stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
    });
    voiceCompanion.stdout?.on('data', (chunk) => {
      process.stdout.write(`[voice-companion] ${chunk}`);
    });
    voiceCompanion.stderr?.on('data', (chunk) => {
      process.stderr.write(`[voice-companion err] ${chunk}`);
    });
    voiceCompanion.on('exit', (code) => {
      console.log(`[voice-companion] exited with code ${code}`);
      voiceCompanion = null;
    });
  } catch (err) {
    console.warn('[voice-companion] failed to spawn:', err.message);
    voiceCompanion = null;
  }
}

function stopVoiceCompanion() {
  if (!voiceCompanion) return;
  try {
    voiceCompanion.kill();
  } catch {
    // already gone, fine
  }
  voiceCompanion = null;
}

// App lifecycle
app.whenReady().then(() => {
  store = new Store();
  setupIpcHandlers();
  createWindow();

  // Auto-start companion if the user has chosen it as their TTS mode.
  // Otherwise stay dormant — no point burning RAM on a Piper subprocess
  // for a user who runs Kobold or browser TTS.
  if (store.get('ttsMode') === 'companion') {
    startVoiceCompanion();
  }
});

// IPC for renderer to ask main to start/stop the companion when the user
// switches TTS mode in Settings.
ipcMain.handle('voice-companion:start', () => {
  startVoiceCompanion();
  return Boolean(voiceCompanion);
});
ipcMain.handle('voice-companion:stop', () => {
  stopVoiceCompanion();
  return true;
});
ipcMain.handle('voice-companion:status', () => ({
  running: Boolean(voiceCompanion),
  pid: voiceCompanion?.pid ?? null,
}));

app.on('window-all-closed', () => {
  stopVoiceCompanion();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  stopVoiceCompanion();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Handle audio permissions (Electron requires explicit permission for mic access)
app.on('web-contents-created', (_, contents) => {
  contents.session.setPermissionRequestHandler((webContents, permission, callback) => {
    const allowedPermissions = ['media', 'midi', 'midiSysex'];
    if (allowedPermissions.includes(permission)) {
      callback(true);
    } else {
      callback(false);
    }
  });
});
