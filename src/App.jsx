import { useState, useCallback, useEffect, useRef, Component } from 'react';
import { getBeatweaver } from './core/Beatweaver.js';
import { BpmKeyDisplay } from './ui/BpmKeyDisplay.jsx';
import { PresetGrid } from './ui/PresetGrid.jsx';
import { ListenControls } from './ui/ListenControls.jsx';
import { MidiStatus } from './ui/MidiStatus.jsx';
import { MasterControls } from './ui/MasterControls.jsx';
import { VuMeter, VuMeterInline, WaveformDisplay, MasterVuStrip, WaveformTimeline } from './ui/VuMeter.jsx';
import { MidiMirror } from './ui/MidiMirror.jsx';
import { PRESETS } from './presets/index.js';

/**
 * ErrorBoundary - Catches React render errors to prevent black screen crashes
 */
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('React ErrorBoundary caught:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="h-screen flex flex-col items-center justify-center bg-dj-bg text-white p-4">
          <h1 className="text-2xl font-bold text-red-400 mb-4">Something went wrong</h1>
          <p className="text-dj-muted mb-4">{this.state.error?.message || 'An unexpected error occurred'}</p>
          <button
            onClick={() => { this.setState({ hasError: false, error: null }); window.location.reload(); }}
            className="px-4 py-2 bg-dj-accent text-black font-bold font-display rounded hover:brightness-110"
          >
            Reload App
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

/**
 * Beatweaver - DJ preset interface
 * Uses Beatweaver orchestrator for all audio/MIDI/TTS coordination
 */
function BeatweaverApp() {
  const [initialized, setInitialized] = useState(false);
  const [activePresets, setActivePresets] = useState(new Set());
  const [readyPresets, setReadyPresets] = useState(new Set()); // Phase 4: MIDI-selected presets ready to fire
  const [currentKey, setCurrentKey] = useState('C');
  const [bpm, setBpm] = useState(125);

  // Audio analysis state
  const [analyzing, setAnalyzing] = useState(false);
  const [detectedBpm, setDetectedBpm] = useState(null);
  const [bpmConfidence, setBpmConfidence] = useState(0);
  const [bpmLocked, setBpmLocked] = useState(false);
  const [detectedKey, setDetectedKey] = useState(null);
  const [keyConfidence, setKeyConfidence] = useState(0);
  const [keyLocked, setKeyLocked] = useState(false);
  const [bpmAnalysisEnabled, setBpmAnalysisEnabled] = useState(true);
  const [keyAnalysisEnabled, setKeyAnalysisEnabled] = useState(true);

  // MIDI state
  const [midiConnected, setMidiConnected] = useState(false);
  const [midiDeviceName, setMidiDeviceName] = useState('');
  const [announcerEnabled, setAnnouncerEnabled] = useState(true);

  // Voice settings
  const [voiceSettings, setVoiceSettings] = useState({
    volume: 0.8,
    pitch: 1.15,
    rate: 1.3,
    reverb: 0.3,
    echo: 0.3,
  });

  // Voice selection
  const [availableVoices, setAvailableVoices] = useState([]);
  const [selectedVoice, setSelectedVoice] = useState('');

  // TTS mode and Kobold
  const [ttsMode, setTtsMode] = useState('browser'); // 'browser' or 'kobold'
  const [koboldUrl, setKoboldUrl] = useState('http://192.168.0.100:5001');
  const [koboldAvailable, setKoboldAvailable] = useState(false);
  const [saveStatus, setSaveStatus] = useState('idle');

  // Master controls
  const [masterSettings, setMasterSettings] = useState({
    instrumentVolume: 0.8,
    voiceVolume: 0.8,
    fadeIn: 0,
    fadeOut: 0,
  });

  // UI state
  const [audioDevices, setAudioDevices] = useState([]);
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [beatFlash, setBeatFlash] = useState(false);

  // Visual announcement display
  const [announcement, setAnnouncement] = useState(null);
  const announcementTimer = useRef(null);

  // Theme state
  const [darkerTheme, setDarkerTheme] = useState(false);

  // Preset history tracking (colored blocks showing activations over time)
  const [presetHistory, setPresetHistory] = useState([]);
  const MAX_HISTORY = 60;

  const bw = useRef(null);

  // Wire orchestrator callbacks
  useEffect(() => {
    bw.current = getBeatweaver();
    const beatweaver = bw.current;

    // Audio analysis callbacks
    beatweaver.onBpmUpdate = ({ bpm: detected, confidence, locked }) => {
      setDetectedBpm(detected);
      setBpmConfidence(confidence);
      setBpmLocked(locked);
    };

    beatweaver.onBpmLock = (lockedBpm) => {
      setBpm(lockedBpm);
      setBpmLocked(true);
    };

    // Manual BPM changes (from +/- buttons) - update value WITHOUT changing lock state
    beatweaver.onBpmChange = (newBpm) => {
      setBpm(newBpm);
    };

    beatweaver.onKeyUpdate = ({ key, confidence, locked }) => {
      setDetectedKey(key);
      setKeyConfidence(confidence);
      setKeyLocked(locked);
    };

    beatweaver.onKeyLock = (lockedKey) => {
      const root = lockedKey.replace('m', '');
      setCurrentKey(root);
      setKeyLocked(true);
    };

    beatweaver.onBeat = () => {
      setBeatFlash(true);
      setTimeout(() => setBeatFlash(false), 100);
    };

    // MIDI callbacks
    beatweaver.onMidiConnectionChange = (connected, deviceName) => {
      setMidiConnected(connected);
      setMidiDeviceName(deviceName);
    };

    beatweaver.onAnnouncerToggle = (enabled) => {
      setAnnouncerEnabled(enabled);
    };

    // Preset changes (from MIDI buttons)
    beatweaver.onActivePresetsChange = (presets) => {
      setActivePresets(new Set(presets));
      // Track history: record current active state as a history block
      if (presets.length > 0) {
        setPresetHistory(prev => {
          const colors = presets.map(id => {
            const p = PRESETS[id];
            return p ? p.color : '#50B4FF';
          });
          const entry = { colors, time: Date.now() };
          const next = [...prev, entry];
          return next.length > MAX_HISTORY ? next.slice(-MAX_HISTORY) : next;
        });
      }
    };

    // Phase 4: Ready presets (MIDI-selected, waiting to fire)
    beatweaver.onReadyPresetsChange = (presets) => {
      setReadyPresets(new Set(presets));
    };

    // Visual announcements (shown in GUI alongside TTS)
    beatweaver.onAnnouncement = (text) => {
      setAnnouncement(text);
      // Clear after 2 seconds
      if (announcementTimer.current) {
        clearTimeout(announcementTimer.current);
      }
      announcementTimer.current = setTimeout(() => {
        setAnnouncement(null);
      }, 2000);
    };

    // MIDI→GUI sync: Analysis toggle buttons
    beatweaver.onBpmAnalysisToggle = (enabled) => {
      setBpmAnalysisEnabled(enabled);
    };

    beatweaver.onKeyAnalysisToggle = (enabled) => {
      setKeyAnalysisEnabled(enabled);
    };

    beatweaver.onAnalyzingChange = (isRunning) => {
      setAnalyzing(isRunning);
      if (!isRunning) {
        setDetectedBpm(null);
        setDetectedKey(null);
        setBpmLocked(false);
        setKeyLocked(false);
      }
    };

    beatweaver.onError = (error) => {
      console.error('Beatweaver error:', error);
      if (error === 'microphone_permission_denied') {
        alert('Microphone access denied. Please allow microphone access and try again.');
      }
    };

    return () => {
      beatweaver.dispose();
    };
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!initialized || !bw.current) return;

      // Space = Stop All
      if (e.code === 'Space' && !e.target.closest('input, select')) {
        e.preventDefault();
        stopAll();
        return;
      }

      // 1-8 = Toggle preset by position
      const num = parseInt(e.key, 10);
      if (num >= 1 && num <= 8 && !e.target.closest('input, select')) {
        const presets = bw.current._presets;
        const bankStart = bw.current.presetBank * 8;
        const preset = presets[bankStart + num - 1];
        if (preset) {
          bw.current.launchPreset(preset.id);
        }
        return;
      }

      // Escape = Stop analysis
      if (e.code === 'Escape') {
        if (analyzing) {
          bw.current.stopAnalysis();
          setAnalyzing(false);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [initialized, analyzing]);

  // ============ SETTINGS PERSISTENCE ============

  const SETTINGS_KEY = 'beatweaver-settings';

  const loadSettings = useCallback(async () => {
    try {
      let saved = null;
      if (typeof window !== 'undefined' && window.electronAPI?.settings?.get) {
        saved = await window.electronAPI.settings.get(SETTINGS_KEY);
      } else {
        const raw = localStorage.getItem(SETTINGS_KEY);
        if (raw) saved = JSON.parse(raw);
      }
      return saved || null;
    } catch {
      return null;
    }
  }, []);

  const saveSettings = useCallback(async () => {
    // Save ALL settings - voice, TTS mode, master controls, device, everything
    const settings = {
      // Voice settings (pitch, rate, reverb, echo, volume)
      voice: {
        volume: voiceSettings.volume,
        pitch: voiceSettings.pitch,
        rate: voiceSettings.rate,
        reverb: voiceSettings.reverb,
        echo: voiceSettings.echo,
      },
      // Selected voice URI
      voiceURI: selectedVoice,
      // TTS mode (browser or kobold)
      ttsMode,
      // Kobold URL
      koboldUrl,
      // Master controls (instrument volume, voice volume, fade in/out)
      master: { ...masterSettings },
      // Announcer enabled state
      announcerEnabled,
      // Audio input device
      selectedDevice,
      // BPM and Key (user might want to restore these)
      bpm,
      currentKey,
      // Analysis toggles (enable/disable BPM and Key detection)
      bpmAnalysisEnabled,
      keyAnalysisEnabled,
    };

    console.log('Saving ALL settings:', settings);

    try {
      if (typeof window !== 'undefined' && window.electronAPI?.settings?.set) {
        await window.electronAPI.settings.set(SETTINGS_KEY, settings);
      } else {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
      }
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 1500);
    } catch (err) {
      console.error('Failed to save settings:', err);
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 2000);
    }
  }, [voiceSettings, selectedVoice, ttsMode, koboldUrl, masterSettings, announcerEnabled, selectedDevice, bpm, currentKey, bpmAnalysisEnabled, keyAnalysisEnabled]);

  // ============ HANDLERS ============

  const handleInit = useCallback(async () => {
    try {
      // Load saved settings before init so they apply immediately
      const saved = await loadSettings();

      if (saved) {
        console.log('Restoring saved settings:', saved);
        if (saved.voice) {
          setVoiceSettings(saved.voice);
        }
        if (saved.ttsMode) {
          setTtsMode(saved.ttsMode);
        }
        if (saved.koboldUrl !== undefined) {
          setKoboldUrl(saved.koboldUrl);
        }
        if (saved.master) {
          setMasterSettings(saved.master);
        }
        if (saved.announcerEnabled !== undefined) {
          setAnnouncerEnabled(saved.announcerEnabled);
        }
        if (saved.selectedDevice) {
          setSelectedDevice(saved.selectedDevice);
        }
        if (saved.bpm !== undefined) {
          setBpm(saved.bpm);
        }
        if (saved.currentKey) {
          setCurrentKey(saved.currentKey);
        }
        if (saved.voiceURI) {
          setSelectedVoice(saved.voiceURI);
        }
        if (saved.bpmAnalysisEnabled !== undefined) {
          setBpmAnalysisEnabled(saved.bpmAnalysisEnabled);
        }
        if (saved.keyAnalysisEnabled !== undefined) {
          setKeyAnalysisEnabled(saved.keyAnalysisEnabled);
        }
      }

      await bw.current.init();

      // Apply saved settings to engine
      if (saved) {
        if (saved.voice) {
          bw.current.setAnnouncerVolume(saved.voice.volume);
          bw.current.setAnnouncerPitch(saved.voice.pitch);
          bw.current.setAnnouncerRate(saved.voice.rate);
          bw.current.setAnnouncerReverb(saved.voice.reverb);
          bw.current.setAnnouncerEcho(saved.voice.echo);
        }
        if (saved.ttsMode) {
          bw.current.setTTSMode(saved.ttsMode);
        }
        if (saved.koboldUrl !== undefined) {
          // Fire and forget - don't block init on Kobold URL test
          bw.current.setKoboldUrl(saved.koboldUrl).catch(() => {});
        }
        if (saved.master) {
          bw.current.setInstrumentMasterVolume(saved.master.instrumentVolume);
          bw.current.setAnnouncerVolume(saved.master.voiceVolume);
          bw.current.setFadeIn(saved.master.fadeIn);
          bw.current.setFadeOut(saved.master.fadeOut);
        }
        if (saved.announcerEnabled === false) {
          bw.current.announcer.enabled = false;
        }
        // Apply saved BPM and Key to engine (silently - no announcements on restore)
        if (saved.bpm !== undefined && saved.bpm > 0) {
          bw.current.synthEngine.setBPM(saved.bpm);
        }
        if (saved.currentKey) {
          bw.current.synthEngine.setKey(saved.currentKey);
        }
        // Apply analysis toggle states to engine (silent - no announcements on restore)
        if (saved.bpmAnalysisEnabled !== undefined) {
          bw.current.setBpmAnalysisEnabled(saved.bpmAnalysisEnabled, true);
        }
        if (saved.keyAnalysisEnabled !== undefined) {
          bw.current.setKeyAnalysisEnabled(saved.keyAnalysisEnabled, true);
        }
      }

      setMidiConnected(bw.current.midiController.isConnected());
      setMidiDeviceName(bw.current.midiController.deviceName);

      // Track Kobold status
      const updateKoboldStatus = () => {
        setKoboldAvailable(bw.current?.announcer?.koboldAvailable ?? false);
      };
      updateKoboldStatus();
      // Poll briefly for async kobold test result
      const koboldPoll = setInterval(updateKoboldStatus, 1000);
      setTimeout(() => clearInterval(koboldPoll), 10000);

      // Load available TTS voices
      const voices = bw.current.getAnnouncerVoices();
      if (voices.length > 0) {
        setAvailableVoices(voices);
        // Apply saved voice or use default
        if (saved?.voiceURI) {
          bw.current.setAnnouncerVoice(saved.voiceURI);
          setSelectedVoice(saved.voiceURI);
        } else {
          const current = bw.current.announcer.ttsVoice;
          if (current) setSelectedVoice(current.voiceURI);
        }
      }

      // Voices may load asynchronously in some browsers (especially Chrome)
      if (typeof speechSynthesis !== 'undefined') {
        speechSynthesis.onvoiceschanged = () => {
          const v = bw.current?.getAnnouncerVoices() || [];
          setAvailableVoices(v);

          // If we have a saved voice, try to restore it now that voices are loaded
          if (saved?.voiceURI && v.length > 0) {
            const voiceExists = v.some(voice => voice.voiceURI === saved.voiceURI);
            if (voiceExists) {
              console.log('Restoring saved voice after async load:', saved.voiceURI);
              bw.current?.setAnnouncerVoice(saved.voiceURI);
              setSelectedVoice(saved.voiceURI);
              return;
            }
          }

          // Fallback: sync from announcer when voices change
          const currentVoice = bw.current?.announcer?.ttsVoice;
          if (currentVoice) {
            setSelectedVoice(currentVoice.voiceURI);
          }
        };
      }

      setInitialized(true);
    } catch (err) {
      console.error('Failed to initialize:', err);
      alert('Failed to start audio.');
    }
  }, []);

  const loadAudioDevices = useCallback(async () => {
    if (!bw.current) return;
    const devices = await bw.current.getAudioDevices();
    setAudioDevices(devices);
    if (devices.length > 0 && !selectedDevice) {
      setSelectedDevice(devices[0].id);
    }
  }, [selectedDevice]);

  const toggleAnalysis = useCallback(async () => {
    if (!bw.current) return;

    if (analyzing) {
      bw.current.stopAnalysis();
      setAnalyzing(false);
      setDetectedBpm(null);
      setDetectedKey(null);
      setBpmLocked(false);
      setKeyLocked(false);
    } else {
      if (audioDevices.length === 0) {
        await loadAudioDevices();
      }
      const started = await bw.current.startAnalysis(selectedDevice);
      setAnalyzing(started);
    }
  }, [analyzing, selectedDevice, audioDevices.length, loadAudioDevices]);

  const selectDevice = useCallback(async (deviceId) => {
    setSelectedDevice(deviceId);
    if (analyzing && bw.current) {
      bw.current.stopAnalysis();
      const started = await bw.current.startAnalysis(deviceId);
      setAnalyzing(started);
    }
  }, [analyzing]);

  const togglePreset = useCallback((presetId) => {
    if (!bw.current) return;
    bw.current.launchPreset(presetId);
  }, []);

  const stopAll = useCallback(() => {
    if (!bw.current) return;
    bw.current.stopAll();
    setActivePresets(new Set());
  }, []);

  const handleKeyChange = useCallback((e) => {
    const newKey = e.target.value;
    setCurrentKey(newKey);
    bw.current?.setKey(newKey);
  }, []);

  const handleBpmChange = useCallback((e) => {
    const newBpm = parseFloat(e.target.value);
    if (!isNaN(newBpm) && newBpm >= 30 && newBpm <= 300) {
      setBpm(newBpm);
      bw.current?.setBPM(newBpm);
    }
  }, []);

  const unlockBpm = useCallback(() => { bw.current?.unlockBpm(); }, []);
  const unlockKey = useCallback(() => { bw.current?.unlockKey(); }, []);
  const unlockAll = useCallback(() => { bw.current?.unlockAll(); }, []);
  const toggleAnnouncer = useCallback(() => { bw.current?.toggleAnnouncer(); }, []);

  const toggleBpmAnalysis = useCallback((enabled) => {
    setBpmAnalysisEnabled(enabled);
    bw.current?.setBpmAnalysisEnabled(enabled);
  }, []);

  const toggleKeyAnalysis = useCallback((enabled) => {
    setKeyAnalysisEnabled(enabled);
    bw.current?.setKeyAnalysisEnabled(enabled);
  }, []);

  const adjustBpm = useCallback((delta) => {
    bw.current?.adjustBpm(delta);
  }, []);

  const handleVoiceChange = useCallback((key, value) => {
    if (!bw.current) return;
    setVoiceSettings(prev => ({ ...prev, [key]: value }));
    switch (key) {
      case 'volume':  bw.current.setAnnouncerVolume(value); break;
      case 'pitch':   bw.current.setAnnouncerPitch(value); break;
      case 'rate':    bw.current.setAnnouncerRate(value); break;
      case 'reverb':  bw.current.setAnnouncerReverb(value); break;
      case 'echo':    bw.current.setAnnouncerEcho(value); break;
    }
  }, []);

  const handleVoiceSelect = useCallback((voiceURI) => {
    console.log('handleVoiceSelect called with:', voiceURI);
    if (!bw.current) {
      console.warn('handleVoiceSelect: bw.current is null');
      return;
    }
    setSelectedVoice(voiceURI);
    const success = bw.current.setAnnouncerVoice(voiceURI);
    console.log('setAnnouncerVoice returned:', success);
    // Force immediate test so user hears the change
    setTimeout(() => {
      console.log('Testing announcer with new voice...');
      bw.current?.testAnnouncer();
    }, 200);
  }, []);

  const handleVoiceTest = useCallback(() => {
    bw.current?.testAnnouncer();
  }, []);

  const handleTtsModeChange = useCallback((mode) => {
    setTtsMode(mode);
    if (bw.current) {
      bw.current.setTTSMode(mode);
      // Test immediately so user hears the change
      setTimeout(() => bw.current?.testAnnouncer(), 100);
    }
  }, []);

  const handleKoboldUrlChange = useCallback(async (url) => {
    setKoboldUrl(url);
    if (bw.current) {
      try {
        setKoboldAvailable(null); // Show "testing..." state immediately
        const available = await bw.current.setKoboldUrl(url);
        setKoboldAvailable(available);
      } catch (err) {
        console.warn('Kobold URL change failed:', err);
        setKoboldAvailable(false);
      }
    }
  }, []);

  const handleMasterChange = useCallback((key, value) => {
    if (!bw.current) return;
    setMasterSettings(prev => ({ ...prev, [key]: value }));
    switch (key) {
      case 'instrumentVolume': bw.current.setInstrumentMasterVolume(value); break;
      case 'voiceVolume':      bw.current.setAnnouncerVolume(value); break;
      case 'fadeIn':           bw.current.setFadeIn(value); break;
      case 'fadeOut':          bw.current.setFadeOut(value); break;
    }
  }, []);

  // ============ PRE-INIT SCREEN ============

  // Countdown state for auto-start
  const [countdown, setCountdown] = useState(null);
  const countdownRef = useRef(null);

  // Start countdown on mount (2 seconds, then auto-transition to main page)
  useEffect(() => {
    if (initialized) return;

    // Start countdown from 2
    setCountdown(2);

    countdownRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev === null) return null;
        if (prev <= 1) {
          clearInterval(countdownRef.current);
          // Auto-init when countdown reaches 0
          handleInit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [initialized, handleInit]);

  // Click to start immediately
  const handleCountdownClick = useCallback(() => {
    if (countdownRef.current) clearInterval(countdownRef.current);
    setCountdown(0);
    handleInit();
  }, [handleInit]);

  if (!initialized) {
    return (
      <div className="h-screen flex flex-col items-center justify-center startup-bg">
        <div className="logo-container mb-6 px-10 py-5 relative overflow-hidden rounded-xl">
          {/* Waveform as full background */}
          <div className="absolute inset-0 flex items-end justify-center">
            <WaveformDisplay bars={32} width={380} height={80} className="opacity-15" />
          </div>
          {/* Text overlay */}
          <h1 className="relative z-10 text-5xl font-extrabold logo-text">BEATWEAVER</h1>
        </div>
        <p className="text-dj-text-secondary mb-2 text-sm tracking-wide">Auto-detect BPM and Key from audio</p>
        <p className="text-dj-muted text-xs mb-8 tracking-wider">
          Keys 1-8: presets | Space: stop all | MIDI: Launch Control XL
        </p>
        <button onClick={handleCountdownClick} className="start-button">
          {countdown !== null && countdown > 0 ? (
            <span className="font-display">{countdown}</span>
          ) : 'START AUDIO'}
        </button>
        {countdown !== null && countdown > 0 && (
          <p className="text-dj-muted text-xs mt-3">Click to start now</p>
        )}
      </div>
    );
  }

  // ============ MAIN INTERFACE ============

  return (
    <div className={`h-screen flex flex-col bg-dj-bg p-4 overflow-hidden ${darkerTheme ? 'theme-darker' : ''}`}>
      {/* Top Bar - Controls */}
      <div className="top-bar-panel flex items-center gap-4 mb-4 px-3 py-2 rounded-lg">
        {/* Logo + Waveform Background */}
        <div
          className="logo-container relative px-4 py-2 cursor-pointer overflow-hidden rounded-lg"
          onClick={() => { try { bw.current?.announcer.announce('Beatweaver', true); } catch { /* ignore */ } }}
        >
          {/* Waveform as full background */}
          <div className="absolute inset-0 flex items-end justify-center">
            <WaveformDisplay
              bars={20}
              width={200}
              height={42}
              className={activePresets.size > 0 ? 'opacity-50' : 'opacity-15'}
            />
          </div>
          {/* Text overlay */}
          <h1 className={`relative z-10 text-xl font-extrabold logo-text ${activePresets.size > 0 ? 'logo-text--active' : ''} ${beatFlash && activePresets.size > 0 ? 'logo-beat-flash' : ''}`}>
            BEATWEAVER
          </h1>
        </div>

        {/* Divider */}
        <div className="w-px h-8 bg-dj-border" />

        {/* BPM + Key Display */}
        <BpmKeyDisplay
          bpm={bpm}
          detectedBpm={detectedBpm}
          bpmConfidence={bpmConfidence}
          bpmLocked={bpmLocked}
          currentKey={currentKey}
          detectedKey={detectedKey}
          keyConfidence={keyConfidence}
          keyLocked={keyLocked}
          onBpmChange={handleBpmChange}
          onKeyChange={handleKeyChange}
          onUnlockBpm={unlockBpm}
          onUnlockKey={unlockKey}
          onUnlockAll={unlockAll}
        />

        {/* Listen Controls */}
        <ListenControls
          analyzing={analyzing}
          bpmLocked={bpmLocked}
          keyLocked={keyLocked}
          beatFlash={beatFlash}
          audioDevices={audioDevices}
          selectedDevice={selectedDevice}
          onToggleAnalysis={toggleAnalysis}
          onSelectDevice={selectDevice}
          onLoadDevices={loadAudioDevices}
          bpmAnalysisEnabled={bpmAnalysisEnabled}
          keyAnalysisEnabled={keyAnalysisEnabled}
          onToggleBpmAnalysis={toggleBpmAnalysis}
          onToggleKeyAnalysis={toggleKeyAnalysis}
          onAdjustBpm={adjustBpm}
        />

        {/* Inline Announcement Display */}
        {announcement && (
          <div className="px-4 py-1.5 bg-dj-surface border border-dj-accent/40 rounded-lg text-sm font-bold font-display text-dj-accent animate-announcement whitespace-nowrap shadow-lg shadow-dj-accent/10">
            {announcement}
          </div>
        )}

        {/* Analysis Status */}
        {analyzing && !bpmLocked && !keyLocked && (
          <div className="text-xs text-dj-text-secondary font-display tracking-wide">
            {detectedBpm ? `BPM: ~${detectedBpm}` : 'Detecting BPM...'}
            <span className="text-dj-muted mx-1">|</span>
            {detectedKey ? `Key: ~${detectedKey}` : 'Detecting Key...'}
          </div>
        )}

        {/* Spacer */}
        <div className="flex-grow" />

        {/* Master Controls */}
        <MasterControls
          values={masterSettings}
          onChange={handleMasterChange}
        />

        {/* MIDI + Announcer Status */}
        <MidiStatus
          connected={midiConnected}
          deviceName={midiDeviceName}
          announcerEnabled={announcerEnabled}
          onToggleAnnouncer={toggleAnnouncer}
          voiceSettings={voiceSettings}
          onVoiceChange={handleVoiceChange}
          onVoiceTest={handleVoiceTest}
          onVoiceSave={saveSettings}
          voices={availableVoices}
          selectedVoice={selectedVoice}
          onVoiceSelect={handleVoiceSelect}
          ttsMode={ttsMode}
          onTtsModeChange={handleTtsModeChange}
          koboldUrl={koboldUrl}
          onKoboldUrlChange={handleKoboldUrlChange}
          koboldAvailable={koboldAvailable}
          saveStatus={saveStatus}
        />

        {/* Divider */}
        <div className="w-px h-8 bg-dj-border" />

        {/* Theme toggle */}
        <button
          onClick={() => setDarkerTheme(prev => !prev)}
          className={`px-2 py-1 rounded text-[10px] font-bold font-display tracking-wider transition-all ${
            darkerTheme
              ? 'bg-dj-surface border border-dj-accent/40 text-dj-accent'
              : 'bg-dj-surface border border-dj-border-strong text-dj-muted hover:text-dj-text-secondary'
          }`}
          title={darkerTheme ? 'Switch to normal theme' : 'Switch to darker theme'}
        >
          {darkerTheme ? 'DARKER' : 'DARK'}
        </button>

        {/* MIDI Mirror */}
        <MidiMirror
          midiController={bw.current?.midiController}
          connected={midiConnected}
        />

        {/* Active count */}
        <div className={`text-lg font-bold font-display tracking-wide ${activePresets.size > 0 ? 'text-dj-accent' : 'text-dj-muted'}`}>
          {activePresets.size > 0 ? `${activePresets.size} ACTIVE` : 'READY'}
        </div>

        {/* Stop All */}
        <button
          onClick={stopAll}
          disabled={activePresets.size === 0}
          className={`px-6 py-2 rounded font-bold text-sm font-display tracking-wider transition-all ${
            activePresets.size > 0
              ? 'bg-dj-error hover:brightness-110 text-white'
              : 'bg-dj-border text-dj-muted cursor-not-allowed'
          }`}
          style={activePresets.size > 0 ? { boxShadow: '0 0 12px rgba(230, 40, 40, 0.25)' } : {}}
        >
          STOP ALL
        </button>
      </div>

      {/* Main Grid */}
      <PresetGrid
        activePresets={activePresets}
        readyPresets={readyPresets}
        onTogglePreset={togglePreset}
      />

      {/* Bottom Visualization Strip */}
      <div className="flex flex-col gap-1 mt-2">
        {/* Preset History Timeline */}
        {presetHistory.length > 0 && (
          <div className="preset-history-strip" title="Preset activation history">
            {presetHistory.map((entry, i) => (
              <div
                key={i}
                className="preset-history-block"
                style={{
                  flex: 1,
                  background: entry.colors.length > 1
                    ? `linear-gradient(to right, ${entry.colors.join(', ')})`
                    : entry.colors[0] || '#50B4FF',
                  opacity: 0.4 + (i / presetHistory.length) * 0.6,
                }}
              />
            ))}
          </div>
        )}

        {/* Waveform Timeline (30s scrolling) */}
        <WaveformTimeline height={28} className="rounded opacity-70" />

        {/* Master VU Strip */}
        <MasterVuStrip className="rounded" />
      </div>
    </div>
  );
}

/**
 * App - Wrapped with ErrorBoundary to prevent black screen crashes
 */
export default function App() {
  return (
    <ErrorBoundary>
      <BeatweaverApp />
    </ErrorBoundary>
  );
}
