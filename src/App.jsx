import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { synthEngine } from './core/SynthEngine';
import { getAudioAnalysis } from './core/AudioAnalysis';
import { getAllPresets, CATEGORY_COLORS } from './presets/index.js';

/**
 * Beatweaver - DJ preset interface with BPM + Key detection
 * Detection locks once confident, stops changing after lock
 */
export default function App() {
  const [initialized, setInitialized] = useState(false);
  const [activePresets, setActivePresets] = useState(new Set());
  const [currentKey, setCurrentKey] = useState('C');
  const [bpm, setBpm] = useState(120);

  // Audio analysis state - BPM
  const [analyzing, setAnalyzing] = useState(false);
  const [detectedBpm, setDetectedBpm] = useState(null);
  const [bpmConfidence, setBpmConfidence] = useState(0);
  const [bpmLocked, setBpmLocked] = useState(false);

  // Audio analysis state - Key
  const [detectedKey, setDetectedKey] = useState(null);
  const [keyConfidence, setKeyConfidence] = useState(0);
  const [keyLocked, setKeyLocked] = useState(false);

  // UI state
  const [audioDevices, setAudioDevices] = useState([]);
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [showDeviceMenu, setShowDeviceMenu] = useState(false);
  const [beatFlash, setBeatFlash] = useState(false);

  const audioAnalysis = useRef(null);

  const KEYS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

  const presetsByCategory = useMemo(() => {
    const presets = getAllPresets();
    return {
      BASS: presets.filter(p => p.category === 'BASS'),
      ENERGY: presets.filter(p => p.category === 'ENERGY'),
      TEXTURE: presets.filter(p => p.category === 'TEXTURE'),
      FX: presets.filter(p => p.category === 'FX')
    };
  }, []);

  // Close device menu on outside click
  useEffect(() => {
    const handleClickOutside = () => setShowDeviceMenu(false);
    if (showDeviceMenu) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [showDeviceMenu]);

  // Setup audio analysis callbacks
  useEffect(() => {
    audioAnalysis.current = getAudioAnalysis();

    // BPM callbacks
    audioAnalysis.current.onBpmUpdate = ({ bpm: detected, confidence, locked }) => {
      setDetectedBpm(detected);
      setBpmConfidence(confidence);
      setBpmLocked(locked);
    };

    audioAnalysis.current.onBpmLock = (lockedBpm) => {
      setBpm(lockedBpm);
      synthEngine.setBPM(lockedBpm);
      console.log(`BPM LOCKED and synced: ${lockedBpm}`);
    };

    // Key callbacks
    audioAnalysis.current.onKeyUpdate = ({ key, confidence, locked }) => {
      setDetectedKey(key);
      setKeyConfidence(confidence);
      setKeyLocked(locked);
    };

    audioAnalysis.current.onKeyLock = (lockedKey) => {
      // Extract root note (e.g., "Am" -> "A", "C#m" -> "C#")
      const root = lockedKey.replace('m', '');
      setCurrentKey(root);
      synthEngine.setKey(root);
      console.log(`KEY LOCKED and synced: ${lockedKey} (root: ${root})`);
    };

    // Beat callback - sync transport and flash indicator
    audioAnalysis.current.onBeat = (beatTimeMs) => {
      setBeatFlash(true);
      setTimeout(() => setBeatFlash(false), 100);

      // Sync synth engine to detected beat (nudge if drifting)
      // Check audioAnalysis state directly to avoid closure issues
      if (audioAnalysis.current?.bpmLocked) {
        synthEngine.syncToBeat(beatTimeMs);
      }
    };

    // Error callback - surface audio setup failures
    audioAnalysis.current.onError = (error) => {
      console.error('Audio analysis error:', error);
      if (error === 'microphone_permission_denied') {
        alert('Microphone access denied. Please allow microphone access and try again.');
      }
    };

    return () => {
      audioAnalysis.current?.dispose();
    };
  }, []);

  const handleInit = useCallback(async () => {
    try {
      await synthEngine.init();
      await audioAnalysis.current?.init();
      setInitialized(true);
    } catch (err) {
      console.error('Failed to initialize audio:', err);
      alert('Failed to start audio.');
    }
  }, []);

  const loadAudioDevices = useCallback(async () => {
    if (!audioAnalysis.current) return;
    const devices = await audioAnalysis.current.getAudioDevices();
    setAudioDevices(devices);
    if (devices.length > 0 && !selectedDevice) {
      setSelectedDevice(devices[0].id);
    }
  }, [selectedDevice]);

  const toggleAnalysis = useCallback(async () => {
    if (!audioAnalysis.current) return;

    if (analyzing) {
      audioAnalysis.current.stopAnalysis();
      setAnalyzing(false);
      // Reset detected values when stopping
      setDetectedBpm(null);
      setDetectedKey(null);
      setBpmLocked(false);
      setKeyLocked(false);
    } else {
      if (audioDevices.length === 0) {
        await loadAudioDevices();
      }
      const started = await audioAnalysis.current.startAnalysis(selectedDevice);
      setAnalyzing(started);
    }
  }, [analyzing, selectedDevice, audioDevices.length, loadAudioDevices]);

  const selectDevice = useCallback(async (deviceId) => {
    setSelectedDevice(deviceId);
    setShowDeviceMenu(false);
    if (analyzing && audioAnalysis.current) {
      audioAnalysis.current.stopAnalysis();
      const started = await audioAnalysis.current.startAnalysis(deviceId);
      setAnalyzing(started);
    }
  }, [analyzing]);

  const unlockBpm = useCallback(() => {
    audioAnalysis.current?.unlockBpm();
  }, []);

  const unlockKey = useCallback(() => {
    audioAnalysis.current?.unlockKey();
  }, []);

  const unlockAll = useCallback(() => {
    audioAnalysis.current?.unlockAll();
  }, []);

  const togglePreset = useCallback((presetId) => {
    const isPlaying = synthEngine.playPreset(presetId);
    setActivePresets(prev => {
      const next = new Set(prev);
      if (isPlaying) next.add(presetId);
      else next.delete(presetId);
      return next;
    });
  }, []);

  const stopAll = useCallback(() => {
    synthEngine.stopAllPresets();
    synthEngine.stopAll();
    setActivePresets(new Set());
  }, []);

  const handleKeyChange = useCallback((e) => {
    const newKey = e.target.value;
    setCurrentKey(newKey);
    synthEngine.setKey(newKey);
    // Unlock key detection if manually changed
    if (keyLocked) {
      audioAnalysis.current?.unlockKey();
    }
  }, [keyLocked]);

  const handleBpmChange = useCallback((e) => {
    const newBpm = parseInt(e.target.value, 10);
    if (newBpm >= 60 && newBpm <= 200) {
      setBpm(newBpm);
      synthEngine.setBPM(newBpm);
      if (bpmLocked) {
        audioAnalysis.current?.unlockBpm();
      }
    }
  }, [bpmLocked]);

  // Pre-init screen
  if (!initialized) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-dj-bg">
        <h1 className="text-5xl font-bold mb-4">BEATWEAVER</h1>
        <p className="text-dj-muted mb-6">Auto-detect BPM and Key from audio</p>
        <button onClick={handleInit} className="start-button">
          START AUDIO
        </button>
      </div>
    );
  }

  // Main landscape interface
  return (
    <div className="h-screen flex flex-col bg-dj-bg p-4 overflow-hidden">
      {/* Top Bar - Controls */}
      <div className="flex items-center gap-4 mb-4 px-2">
        {/* Logo */}
        <h1 className="text-xl font-bold">BEATWEAVER</h1>

        {/* Divider */}
        <div className="w-px h-8 bg-dj-border" />

        {/* BPM Display */}
        <div className="flex items-center gap-2">
          <div className="flex flex-col items-center min-w-[60px]">
            <span className={`text-3xl font-bold tabular-nums ${bpmLocked ? 'text-green-400' : ''}`}>
              {bpm}
            </span>
            <span className={`text-[10px] uppercase ${bpmLocked ? 'text-green-400' : 'text-dj-muted'}`}>
              {bpmLocked ? 'BPM LOCKED' : 'BPM'}
            </span>
          </div>

          {/* BPM Slider (disabled when locked) */}
          <input
            type="range"
            min="60"
            max="180"
            value={bpm}
            onChange={handleBpmChange}
            disabled={bpmLocked}
            className={`w-20 h-2 ${bpmLocked ? 'opacity-50' : 'accent-dj-accent'}`}
          />

          {/* Unlock BPM button */}
          {bpmLocked && (
            <button
              onClick={unlockBpm}
              className="px-2 py-1 rounded text-[10px] font-bold bg-dj-surface border border-dj-border hover:border-dj-muted"
            >
              UNLOCK
            </button>
          )}
        </div>

        {/* Divider */}
        <div className="w-px h-8 bg-dj-border" />

        {/* Key Display */}
        <div className="flex items-center gap-2">
          <div className="flex flex-col items-center min-w-[50px]">
            <span className={`text-3xl font-bold ${keyLocked ? 'text-green-400' : ''}`}>
              {detectedKey || currentKey}
            </span>
            <span className={`text-[10px] uppercase ${keyLocked ? 'text-green-400' : 'text-dj-muted'}`}>
              {keyLocked ? 'KEY LOCKED' : 'KEY'}
            </span>
          </div>

          {/* Key Selector (disabled when locked) */}
          {!keyLocked && (
            <select
              value={currentKey}
              onChange={handleKeyChange}
              className="bg-dj-surface border border-dj-border rounded px-2 py-1 text-sm"
            >
              {KEYS.map(key => <option key={key} value={key}>{key}</option>)}
            </select>
          )}

          {/* Unlock Key button */}
          {keyLocked && (
            <button
              onClick={unlockKey}
              className="px-2 py-1 rounded text-[10px] font-bold bg-dj-surface border border-dj-border hover:border-dj-muted"
            >
              UNLOCK
            </button>
          )}
        </div>

        {/* Divider */}
        <div className="w-px h-8 bg-dj-border" />

        {/* Listen Controls */}
        <div className="flex items-center gap-2">
          {/* Beat Indicator */}
          {analyzing && (
            <div
              className={`w-3 h-3 rounded-full transition-all duration-75 ${
                beatFlash ? 'bg-green-400 scale-125' : 'bg-dj-border'
              }`}
            />
          )}

          {/* Listen Button + Device Selector */}
          <div className="relative flex items-center">
            <button
              onClick={toggleAnalysis}
              className={`px-3 py-1.5 rounded-l text-xs font-bold transition-all ${
                analyzing
                  ? 'bg-green-600 hover:bg-green-700'
                  : 'bg-dj-surface border border-dj-border hover:border-dj-muted'
              }`}
            >
              {analyzing ? (bpmLocked && keyLocked ? 'LOCKED' : 'ANALYZING...') : 'LISTEN'}
            </button>
            <button
              onClick={async (e) => {
                e.stopPropagation();
                await loadAudioDevices();
                setShowDeviceMenu(!showDeviceMenu);
              }}
              className="px-2 py-1.5 rounded-r text-xs bg-dj-surface border border-l-0 border-dj-border hover:border-dj-muted"
            >
              ▼
            </button>

            {showDeviceMenu && audioDevices.length > 0 && (
              <div
                className="absolute top-full left-0 mt-1 bg-dj-surface border border-dj-border rounded shadow-lg z-50 min-w-[200px]"
                onClick={e => e.stopPropagation()}
              >
                <div className="px-3 py-1.5 text-[10px] text-dj-muted uppercase border-b border-dj-border">
                  Audio Input
                </div>
                {audioDevices.map(device => (
                  <button
                    key={device.id}
                    onClick={() => selectDevice(device.id)}
                    className={`w-full px-3 py-2 text-left text-xs hover:bg-dj-border transition-colors ${
                      selectedDevice === device.id ? 'text-dj-accent' : ''
                    }`}
                  >
                    {device.label}
                    {selectedDevice === device.id && ' ✓'}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Unlock All button (when both locked) */}
          {bpmLocked && keyLocked && (
            <button
              onClick={unlockAll}
              className="px-2 py-1 rounded text-[10px] font-bold bg-dj-surface border border-dj-border hover:border-dj-muted"
            >
              UNLOCK ALL
            </button>
          )}
        </div>

        {/* Analysis Status */}
        {analyzing && !bpmLocked && !keyLocked && (
          <div className="text-xs text-dj-muted">
            {detectedBpm ? `BPM: ~${detectedBpm}` : 'Detecting BPM...'}
            {' | '}
            {detectedKey ? `Key: ~${detectedKey}` : 'Detecting Key...'}
          </div>
        )}

        {/* Spacer */}
        <div className="flex-grow" />

        {/* Status */}
        <div className={`text-lg font-bold ${activePresets.size > 0 ? 'text-dj-accent' : 'text-dj-muted'}`}>
          {activePresets.size > 0 ? `${activePresets.size} ACTIVE` : 'READY'}
        </div>

        {/* Stop All */}
        <button
          onClick={stopAll}
          disabled={activePresets.size === 0}
          className={`px-6 py-2 rounded font-bold text-sm transition-all ${
            activePresets.size > 0
              ? 'bg-dj-error hover:bg-opacity-80'
              : 'bg-dj-border text-dj-muted cursor-not-allowed'
          }`}
        >
          STOP ALL
        </button>
      </div>

      {/* Main Grid - 4 columns */}
      <div className="flex-1 grid grid-cols-4 gap-3 min-h-0">
        {Object.entries(presetsByCategory).map(([category, presets]) => (
          <div
            key={category}
            className="flex flex-col bg-dj-surface rounded-lg border border-dj-border overflow-hidden"
          >
            <div
              className="flex items-center gap-2 px-3 py-2 border-b border-dj-border"
              style={{ borderLeftColor: CATEGORY_COLORS[category], borderLeftWidth: 3 }}
            >
              <span className="font-bold text-sm">{category}</span>
              {presets.filter(p => activePresets.has(p.id)).length > 0 && (
                <span className="text-xs text-dj-accent">
                  {presets.filter(p => activePresets.has(p.id)).length}
                </span>
              )}
            </div>

            <div className="flex-1 flex flex-col gap-2 p-2">
              {presets.map(preset => {
                const isActive = activePresets.has(preset.id);
                return (
                  <button
                    key={preset.id}
                    onClick={() => togglePreset(preset.id)}
                    className={`
                      relative flex-1 min-h-[50px] rounded border-2 transition-all duration-75
                      flex items-center justify-center
                      ${isActive
                        ? 'border-white shadow-lg'
                        : 'border-dj-border hover:border-dj-muted'
                      }
                    `}
                    style={{
                      backgroundColor: isActive ? preset.color : 'transparent'
                    }}
                  >
                    <span className="font-bold text-sm">{preset.name}</span>
                    {isActive && (
                      <div className="absolute top-1 right-1 w-2 h-2 bg-white rounded-full animate-pulse" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
