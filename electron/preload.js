const { contextBridge, ipcRenderer } = require('electron');

// Expose safe APIs to renderer process
contextBridge.exposeInMainWorld('electronAPI', {
  // Settings persistence
  settings: {
    get: (key) => ipcRenderer.invoke('settings:get', key),
    set: (key, value) => ipcRenderer.invoke('settings:set', key, value),
    delete: (key) => ipcRenderer.invoke('settings:delete', key),
  },

  // App info
  app: {
    getInfo: () => ipcRenderer.invoke('app:info'),
  },

  // TTS synthesis (generates WAV for Web Audio effects)
  tts: {
    synthesize: (text, options) => ipcRenderer.invoke('tts:synthesize', text, options),
  },

  // Bundled voice companion (Piper TTS) — start/stop on TTS-mode switch
  voiceCompanion: {
    start: () => ipcRenderer.invoke('voice-companion:start'),
    stop: () => ipcRenderer.invoke('voice-companion:stop'),
    status: () => ipcRenderer.invoke('voice-companion:status'),
  },

  // Platform info
  platform: process.platform,
});

// Log that preload script ran successfully
console.log('Beatweaver preload script loaded');
