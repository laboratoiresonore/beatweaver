import { describe, it, expect, beforeEach, vi } from 'vitest';

// Create mock subsystems BEFORE importing Beatweaver
const mockSynthEngine = {
  init: vi.fn(),
  setBPM: vi.fn(),
  setKey: vi.fn(),
  playPreset: vi.fn(() => true),
  stopPreset: vi.fn(),
  stopAllPresets: vi.fn(),
  stopAll: vi.fn(),
  setMasterVolume: vi.fn(),
  setFadeIn: vi.fn(),
  setFadeOut: vi.fn(),
  setInstrumentVolume: vi.fn(),
  setFilterCutoff: vi.fn(),
  setFilterResonance: vi.fn(),
  syncToBeat: vi.fn(),
  dispose: vi.fn(),
};

const mockAudioAnalysis = {
  init: vi.fn(),
  startAnalysis: vi.fn(() => true),
  stopAnalysis: vi.fn(),
  getAudioDevices: vi.fn(() => []),
  unlockBpm: vi.fn(),
  unlockKey: vi.fn(),
  unlockAll: vi.fn(),
  getState: vi.fn(() => ({ analyzing: false })),
  dispose: vi.fn(),
  bpmLocked: false,
  onBpmUpdate: null,
  onBpmLock: null,
  onKeyUpdate: null,
  onKeyLock: null,
  onBeat: null,
  onError: null,
};

const mockMidiController = {
  init: vi.fn(),
  isConnected: vi.fn(() => false),
  getState: vi.fn(() => ({ connected: false, deviceName: '' })),
  setLaunchingLED: vi.fn(),
  setPresetLEDs: vi.fn(),
  allLEDsOff: vi.fn(),
  dispose: vi.fn(),
  constructor: {
    LCXL: {
      LED_GREEN: 60,
      LED_RED: 15,
      LED_AMBER: 63,
      LED_OFF: 0,
    },
  },
  onButton: null,
  onFader: null,
  onKnob: null,
  onSideButton: null,
  onConnectionChange: null,
};

const mockAnnouncer = {
  init: vi.fn(),
  announce: vi.fn(),
  toggle: vi.fn(() => false),
  setPitch: vi.fn(),
  setRate: vi.fn(),
  setReverb: vi.fn(),
  setEcho: vi.fn(),
  setVolume: vi.fn(),
  setVoice: vi.fn(),
  setKoboldUrl: vi.fn(),
  getVoices: vi.fn(() => [
    { name: 'English Natural', lang: 'en-US', voiceURI: 'uri-natural', isDefault: false },
    { name: 'English UK', lang: 'en-GB', voiceURI: 'uri-uk', isDefault: false },
  ]),
  getState: vi.fn(() => ({ enabled: true })),
  dispose: vi.fn(),
  enabled: true,
};

const mockPresets = [
  { id: 'bass_sub', name: 'Sub Bass', category: 'BASS', instrument: 'subBass', controls: { POWER: { param: 'volume', min: 0, max: 1 }, DARKNESS: { param: 'filterFreq', min: 0, max: 1 } }, announcement: 'Sub bass' },
  { id: 'bass_reese', name: 'Reese', category: 'BASS', instrument: 'reeseBass', controls: { POWER: { param: 'volume', min: 0, max: 1 } } },
  { id: 'energy_pulse', name: 'Pulse', category: 'ENERGY', instrument: 'lead', controls: {} },
  { id: 'energy_drive', name: 'Drive', category: 'ENERGY', instrument: 'lead', controls: {} },
  { id: 'texture_pad', name: 'Pad', category: 'TEXTURE', instrument: 'pad', controls: {} },
  { id: 'texture_drift', name: 'Drift', category: 'TEXTURE', instrument: 'pad', controls: {} },
  { id: 'fx_riser', name: 'Riser', category: 'FX', instrument: 'fx', controls: {} },
  { id: 'fx_sweep', name: 'Sweep', category: 'FX', instrument: 'fx', controls: {} },
  // Bank 2
  { id: 'bass_808', name: '808', category: 'BASS', instrument: 'subBass', controls: {} },
  { id: 'bass_acid', name: 'Acid', category: 'BASS', instrument: 'lead', controls: {} },
  { id: 'energy_rave', name: 'Rave', category: 'ENERGY', instrument: 'lead', controls: {} },
  { id: 'energy_stab', name: 'Stab', category: 'ENERGY', instrument: 'lead', controls: {} },
  { id: 'texture_choir', name: 'Choir', category: 'TEXTURE', instrument: 'pad', controls: {} },
  { id: 'texture_noise', name: 'Noise', category: 'TEXTURE', instrument: 'pad', controls: {} },
  { id: 'fx_impact', name: 'Impact', category: 'FX', instrument: 'fx', controls: {} },
  { id: 'fx_vinyl', name: 'Vinyl', category: 'FX', instrument: 'fx', controls: {} },
];

// Mock modules
vi.mock('../../src/core/SynthEngine.js', () => ({
  synthEngine: mockSynthEngine,
}));

vi.mock('../../src/core/AudioAnalysis.js', () => ({
  getAudioAnalysis: () => mockAudioAnalysis,
}));

vi.mock('../../src/core/MidiController.js', () => ({
  getMidiController: () => mockMidiController,
}));

vi.mock('../../src/core/Announcer.js', () => ({
  getAnnouncer: () => mockAnnouncer,
}));

vi.mock('../../src/presets/index.js', () => ({
  getAllPresets: () => [...mockPresets],
}));

// NOW import Beatweaver (after mocks are set up)
const { Beatweaver } = await import('../../src/core/Beatweaver.js');

describe('Beatweaver Orchestrator', () => {
  let bw;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();
    mockAudioAnalysis.bpmLocked = false;

    bw = new Beatweaver();
  });

  describe('construction', () => {
    it('creates with correct initial state', () => {
      expect(bw.initialized).toBe(false);
      expect(bw.activePresets.size).toBe(0);
      expect(bw.presetBank).toBe(0);
      expect(bw._presets.length).toBe(16);
    });

    it('has null callbacks initially', () => {
      expect(bw.onActivePresetsChange).toBeNull();
      expect(bw.onBpmUpdate).toBeNull();
      expect(bw.onBpmLock).toBeNull();
      expect(bw.onError).toBeNull();
    });
  });

  describe('initialization', () => {
    it('inits all subsystems in order', async () => {
      await bw.init();

      expect(mockSynthEngine.init).toHaveBeenCalled();
      expect(mockAudioAnalysis.init).toHaveBeenCalled();
      expect(mockMidiController.init).toHaveBeenCalled();
      expect(mockAnnouncer.init).toHaveBeenCalled();
      expect(bw.initialized).toBe(true);
    });

    it('does not re-init if already initialized', async () => {
      await bw.init();
      await bw.init();

      expect(mockSynthEngine.init).toHaveBeenCalledTimes(1);
    });
  });

  describe('audio callback wiring', () => {
    beforeEach(async () => {
      await bw.init();
    });

    it('wires BPM lock to synth + announcer', () => {
      mockAudioAnalysis.onBpmLock(128);

      expect(mockSynthEngine.setBPM).toHaveBeenCalledWith(128);
      expect(mockAnnouncer.announce).toHaveBeenCalledWith('BPM locked at 128');
    });

    it('fires React callback on BPM lock', () => {
      const callback = vi.fn();
      bw.onBpmLock = callback;

      mockAudioAnalysis.onBpmLock(140);

      expect(callback).toHaveBeenCalledWith(140);
    });

    it('wires key lock to synth + announcer', () => {
      mockAudioAnalysis.onKeyLock('Am');

      expect(mockSynthEngine.setKey).toHaveBeenCalledWith('A');
      expect(mockAnnouncer.announce).toHaveBeenCalledWith('The key is A minor');
    });

    it('fires React callback on key lock', () => {
      const callback = vi.fn();
      bw.onKeyLock = callback;

      mockAudioAnalysis.onKeyLock('Cm');

      expect(callback).toHaveBeenCalledWith('Cm');
    });

    it('passes BPM updates to React', () => {
      const callback = vi.fn();
      bw.onBpmUpdate = callback;

      const state = { bpm: 120, confidence: 0.8, locked: false };
      mockAudioAnalysis.onBpmUpdate(state);

      expect(callback).toHaveBeenCalledWith(state);
    });

    it('syncs beat to transport when BPM locked', () => {
      mockAudioAnalysis.bpmLocked = true;
      mockAudioAnalysis.onBeat(1234);

      expect(mockSynthEngine.syncToBeat).toHaveBeenCalledWith(1234);
    });

    it('does not sync beat when BPM not locked', () => {
      mockAudioAnalysis.bpmLocked = false;
      mockAudioAnalysis.onBeat(1234);

      expect(mockSynthEngine.syncToBeat).not.toHaveBeenCalled();
    });

    it('propagates errors to React callback', () => {
      const callback = vi.fn();
      bw.onError = callback;

      mockAudioAnalysis.onError('microphone_permission_denied');

      expect(callback).toHaveBeenCalledWith('microphone_permission_denied');
    });
  });

  describe('preset launching', () => {
    beforeEach(async () => {
      await bw.init();
    });

    it('launches a preset through synth engine', () => {
      bw.launchPreset('bass_sub');

      expect(mockSynthEngine.playPreset).toHaveBeenCalledWith('bass_sub');
      expect(bw.activePresets.has('bass_sub')).toBe(true);
    });

    it('announces preset with announcement text', () => {
      bw.launchPreset('bass_sub');

      expect(mockAnnouncer.announce).toHaveBeenCalledWith('Sub bass');
    });

    it('toggles off if already active', () => {
      bw.launchPreset('bass_sub');
      bw.launchPreset('bass_sub'); // toggle off

      expect(mockSynthEngine.stopPreset).toHaveBeenCalledWith('bass_sub');
      expect(bw.activePresets.has('bass_sub')).toBe(false);
    });

    it('fires activePresetsChange callback', () => {
      const callback = vi.fn();
      bw.onActivePresetsChange = callback;

      bw.launchPreset('bass_sub');

      expect(callback).toHaveBeenCalledWith(expect.any(Set));
      expect(callback.mock.calls[0][0].has('bass_sub')).toBe(true);
    });

    it('does nothing for unknown preset ID', () => {
      bw.launchPreset('nonexistent');
      expect(mockSynthEngine.playPreset).not.toHaveBeenCalled();
    });

    it('does not add to active if synth returns false', () => {
      mockSynthEngine.playPreset.mockReturnValueOnce(false);

      bw.launchPreset('bass_sub');

      expect(bw.activePresets.has('bass_sub')).toBe(false);
    });
  });

  describe('stop controls', () => {
    beforeEach(async () => {
      await bw.init();
      bw.launchPreset('bass_sub');
      bw.launchPreset('energy_pulse');
    });

    it('stops a specific preset', () => {
      bw.stopPreset('bass_sub');

      expect(mockSynthEngine.stopPreset).toHaveBeenCalledWith('bass_sub');
      expect(bw.activePresets.has('bass_sub')).toBe(false);
      expect(bw.activePresets.has('energy_pulse')).toBe(true);
    });

    it('stops all presets', () => {
      bw.stopAll();

      expect(mockSynthEngine.stopAllPresets).toHaveBeenCalled();
      expect(mockSynthEngine.stopAll).toHaveBeenCalled();
      expect(bw.activePresets.size).toBe(0);
    });
  });

  describe('bank switching', () => {
    beforeEach(async () => {
      await bw.init();
    });

    it('starts at bank 0', () => {
      expect(bw.presetBank).toBe(0);
    });

    it('switches up to bank 1', () => {
      bw.setBankUp();
      expect(bw.presetBank).toBe(1);
      expect(mockAnnouncer.announce).toHaveBeenCalledWith('Bank 2');
    });

    it('does not go above max bank', () => {
      bw.setBankUp(); // bank 1
      bw.setBankUp(); // should stay at 1 (16 presets / 8 = 2 banks max)

      expect(bw.presetBank).toBe(1);
    });

    it('switches down', () => {
      bw.setBankUp(); // bank 1
      bw.setBankDown(); // back to 0

      expect(bw.presetBank).toBe(0);
      expect(mockAnnouncer.announce).toHaveBeenCalledWith('Bank 1');
    });

    it('does not go below bank 0', () => {
      bw.setBankDown();
      expect(bw.presetBank).toBe(0);
    });

    it('fires bank change callback', () => {
      const callback = vi.fn();
      bw.onBankChange = callback;

      bw.setBankUp();
      expect(callback).toHaveBeenCalledWith(1);
    });

    it('getCurrentBankPresets returns 8 presets for bank 0', () => {
      const presets = bw.getCurrentBankPresets();
      expect(presets.length).toBe(8);
      expect(presets[0].id).toBe('bass_sub');
    });

    it('getCurrentBankPresets returns 8 presets for bank 1', () => {
      bw.setBankUp();
      const presets = bw.getCurrentBankPresets();
      expect(presets.length).toBe(8);
      expect(presets[0].id).toBe('bass_808');
    });
  });

  describe('MIDI callback wiring', () => {
    beforeEach(async () => {
      await bw.init();
    });

    it('top button launches preset', () => {
      mockMidiController.onButton(0, true, 1); // button 0, top, velocity 1

      expect(mockSynthEngine.playPreset).toHaveBeenCalledWith('bass_sub');
    });

    it('bottom button stops preset', () => {
      bw.launchPreset('bass_sub');
      vi.clearAllMocks();

      mockMidiController.onButton(0, false, 1); // button 0, bottom, velocity 1

      expect(mockSynthEngine.stopPreset).toHaveBeenCalledWith('bass_sub');
    });

    it('ignores Note Off (velocity 0)', () => {
      mockMidiController.onButton(0, true, 0);
      expect(mockSynthEngine.playPreset).not.toHaveBeenCalled();
    });

    it('fader 7 sets master volume', () => {
      mockMidiController.onFader(7, 0.75);
      expect(mockSynthEngine.setMasterVolume).toHaveBeenCalledWith(0.75);
    });

    it('side button up switches bank up', () => {
      mockMidiController.onSideButton('up');
      expect(bw.presetBank).toBe(1);
    });

    it('side button down switches bank down', () => {
      bw.setBankUp();
      mockMidiController.onSideButton('down');
      expect(bw.presetBank).toBe(0);
    });

    it('side button left toggles announcer', () => {
      mockMidiController.onSideButton('left');
      expect(mockAnnouncer.toggle).toHaveBeenCalled();
    });

    it('MIDI connection fires React callback', () => {
      const callback = vi.fn();
      bw.onMidiConnectionChange = callback;

      mockMidiController.onConnectionChange(true, 'Launch Control XL');

      expect(callback).toHaveBeenCalledWith(true, 'Launch Control XL');
      expect(mockAnnouncer.announce).toHaveBeenCalledWith('Controller connected');
    });
  });

  describe('audio analysis controls', () => {
    beforeEach(async () => {
      await bw.init();
    });

    it('starts analysis', async () => {
      const result = await bw.startAnalysis('device1');
      expect(mockAudioAnalysis.startAnalysis).toHaveBeenCalledWith('device1');
      expect(result).toBe(true);
    });

    it('stops analysis', () => {
      bw.stopAnalysis();
      expect(mockAudioAnalysis.stopAnalysis).toHaveBeenCalled();
    });

    it('setBPM unlocks and sets', () => {
      bw.setBPM(130);
      expect(mockAudioAnalysis.unlockBpm).toHaveBeenCalled();
      expect(mockSynthEngine.setBPM).toHaveBeenCalledWith(130);
    });

    it('setKey unlocks and sets', () => {
      bw.setKey('Dm');
      expect(mockAudioAnalysis.unlockKey).toHaveBeenCalled();
      expect(mockSynthEngine.setKey).toHaveBeenCalledWith('Dm');
    });

    it('setKey announces the key', () => {
      bw.setKey('C');
      expect(mockAnnouncer.announce).toHaveBeenCalledWith('The key is C');
    });

    it('setKey announces sharp keys correctly', () => {
      bw.setKey('F#');
      expect(mockAnnouncer.announce).toHaveBeenCalledWith('The key is F sharp');
    });
  });

  describe('key speech formatting', () => {
    beforeEach(async () => {
      await bw.init();
    });

    it('formats minor keys', () => {
      expect(bw._formatKeyForSpeech('Am')).toBe('A minor');
    });

    it('formats sharp minor keys', () => {
      expect(bw._formatKeyForSpeech('C#m')).toBe('C sharp minor');
    });

    it('formats plain major keys', () => {
      expect(bw._formatKeyForSpeech('G')).toBe('G');
    });

    it('formats flat keys', () => {
      expect(bw._formatKeyForSpeech('Bb')).toBe('B flat');
    });
  });

  describe('announcer controls', () => {
    beforeEach(async () => {
      await bw.init();
    });

    it('toggleAnnouncer calls toggle and fires callback', () => {
      const callback = vi.fn();
      bw.onAnnouncerToggle = callback;

      bw.toggleAnnouncer();

      expect(mockAnnouncer.toggle).toHaveBeenCalled();
      expect(callback).toHaveBeenCalledWith(false); // mock returns false
    });

    it('setAnnouncerPitch delegates to announcer', () => {
      bw.setAnnouncerPitch(1.5);
      expect(mockAnnouncer.setPitch).toHaveBeenCalledWith(1.5);
    });

    it('setAnnouncerRate delegates to announcer', () => {
      bw.setAnnouncerRate(0.8);
      expect(mockAnnouncer.setRate).toHaveBeenCalledWith(0.8);
    });

    it('setAnnouncerReverb delegates to announcer', () => {
      bw.setAnnouncerReverb(0.6);
      expect(mockAnnouncer.setReverb).toHaveBeenCalledWith(0.6);
    });

    it('setAnnouncerEcho delegates to announcer', () => {
      bw.setAnnouncerEcho(0.5);
      expect(mockAnnouncer.setEcho).toHaveBeenCalledWith(0.5);
    });

    it('setAnnouncerVolume delegates to announcer', () => {
      bw.setAnnouncerVolume(0.5);
      expect(mockAnnouncer.setVolume).toHaveBeenCalledWith(0.5);
    });

    it('setAnnouncerVoice delegates to announcer', () => {
      bw.setAnnouncerVoice('uri-uk');
      expect(mockAnnouncer.setVoice).toHaveBeenCalledWith('uri-uk');
    });

    it('getAnnouncerVoices returns voice list', () => {
      const voices = bw.getAnnouncerVoices();
      expect(voices).toHaveLength(2);
      expect(voices[0].name).toBe('English Natural');
    });

    it('testAnnouncer sends test message', () => {
      bw.testAnnouncer();
      expect(mockAnnouncer.announce).toHaveBeenCalledWith('Testing voice settings', true);
    });

    it('setKoboldUrl delegates to announcer', () => {
      bw.setKoboldUrl('http://localhost:5001');
      expect(mockAnnouncer.setKoboldUrl).toHaveBeenCalledWith('http://localhost:5001');
    });
  });

  describe('instrument master controls', () => {
    beforeEach(async () => {
      await bw.init();
    });

    it('setInstrumentMasterVolume delegates to synth engine', () => {
      bw.setInstrumentMasterVolume(0.6);
      expect(mockSynthEngine.setMasterVolume).toHaveBeenCalledWith(0.6);
    });

    it('setFadeIn delegates to synth engine', () => {
      bw.setFadeIn(1.5);
      expect(mockSynthEngine.setFadeIn).toHaveBeenCalledWith(1.5);
    });

    it('setFadeOut delegates to synth engine', () => {
      bw.setFadeOut(2.0);
      expect(mockSynthEngine.setFadeOut).toHaveBeenCalledWith(2.0);
    });
  });

  describe('state', () => {
    it('getState returns full state', async () => {
      await bw.init();
      const state = bw.getState();

      expect(state.initialized).toBe(true);
      expect(state.activePresets).toEqual(new Set());
      expect(state.presetBank).toBe(0);
      expect(state.analysis).toBeDefined();
      expect(state.midi).toBeDefined();
      expect(state.announcer).toBeDefined();
    });
  });

  describe('cleanup', () => {
    it('dispose stops everything and cleans up', async () => {
      await bw.init();
      bw.launchPreset('bass_sub');

      bw.dispose();

      expect(mockSynthEngine.stopAllPresets).toHaveBeenCalled();
      expect(mockAudioAnalysis.dispose).toHaveBeenCalled();
      expect(mockSynthEngine.dispose).toHaveBeenCalled();
      expect(mockMidiController.dispose).toHaveBeenCalled();
      expect(mockAnnouncer.dispose).toHaveBeenCalled();
      expect(bw.initialized).toBe(false);
    });
  });
});
