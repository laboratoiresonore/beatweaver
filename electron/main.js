const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { execFile } = require('child_process');
const Store = require('electron-store');

let store;
const isDev = process.env.NODE_ENV !== 'production' || !app.isPackaged;

let mainWindow;

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

// App lifecycle
app.whenReady().then(() => {
  store = new Store();
  setupIpcHandlers();
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
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
