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

// Note: bank+row are required for column-based dispatch (selectedPresets default to
// row 0 of bank A on every column).
const mockPresets = [
  // Bank A (rows 0-1 of each category)
  { id: 'bass_sub',     name: 'Sub Bass', category: 'BASS',    bank: 'A', row: 0, instrument: 'subBass',  controls: { POWER: { param: 'volume', min: 0, max: 1 }, DARKNESS: { param: 'filterFreq', min: 0, max: 1 } }, announcement: 'Sub bass' },
  { id: 'bass_reese',   name: 'Reese',    category: 'BASS',    bank: 'A', row: 1, instrument: 'reeseBass',controls: { POWER: { param: 'volume', min: 0, max: 1 } } },
  { id: 'energy_pulse', name: 'Pulse',    category: 'ENERGY',  bank: 'A', row: 0, instrument: 'lead',     controls: {} },
  { id: 'energy_drive', name: 'Drive',    category: 'ENERGY',  bank: 'A', row: 1, instrument: 'lead',     controls: {} },
  { id: 'texture_pad',  name: 'Pad',      category: 'TEXTURE', bank: 'A', row: 0, instrument: 'pad',      controls: {} },
  { id: 'texture_drift',name: 'Drift',    category: 'TEXTURE', bank: 'A', row: 1, instrument: 'pad',      controls: {} },
  { id: 'fx_riser',     name: 'Riser',    category: 'FX',      bank: 'A', row: 0, instrument: 'fx',       controls: {} },
  { id: 'fx_sweep',     name: 'Sweep',    category: 'FX',      bank: 'A', row: 1, instrument: 'fx',       controls: {} },
  // Bank B (rows 0-1 of each category)
  { id: 'bass_808',     name: '808',      category: 'BASS',    bank: 'B', row: 0, instrument: 'subBass',  controls: {} },
  { id: 'bass_acid',    name: 'Acid',     category: 'BASS',    bank: 'B', row: 1, instrument: 'lead',     controls: {} },
  { id: 'energy_rave',  name: 'Rave',     category: 'ENERGY',  bank: 'B', row: 0, instrument: 'lead',     controls: {} },
  { id: 'energy_stab',  name: 'Stab',     category: 'ENERGY',  bank: 'B', row: 1, instrument: 'lead',     controls: {} },
  { id: 'texture_choir',name: 'Choir',    category: 'TEXTURE', bank: 'B', row: 0, instrument: 'pad',      controls: {} },
  { id: 'texture_noise',name: 'Noise',    category: 'TEXTURE', bank: 'B', row: 1, instrument: 'pad',      controls: {} },
  { id: 'fx_impact',    name: 'Impact',   category: 'FX',      bank: 'B', row: 0, instrument: 'fx',       controls: {} },
  { id: 'fx_vinyl',     name: 'Vinyl',    category: 'FX',      bank: 'B', row: 1, instrument: 'fx',       controls: {} },
];

// Mock Tone.js. Beatweaver.js does `import * as Tone from 'tone'` directly for its
// internal master VU analyser; without a stub, Vitest's resolver chokes on Tone's
// extensionless internal imports (e.g. `tone/build/esm/core/Global`) on Windows.
// Beatweaver also calls SynthFactory.createModulator() during launchPreset, which
// constructs Chorus/Phaser/Tremolo — those need stub constructors here.
const _stubEffect = () => ({
  connect: vi.fn().mockReturnThis(),
  disconnect: vi.fn(),
  dispose: vi.fn(),
  start: vi.fn().mockReturnThis(),
  wet: { value: 0.5 },
});
vi.mock('tone', () => ({
  start: vi.fn(),
  context: { currentTime: 0, sampleRate: 44100, createAnalyser: vi.fn() },
  getDestination: vi.fn(() => ({ connect: vi.fn(), disconnect: vi.fn() })),
  connect: vi.fn(),
  now: vi.fn(() => 0),
  Chorus: vi.fn(_stubEffect),
  Phaser: vi.fn(_stubEffect),
  Tremolo: vi.fn(_stubEffect),
  Gain: vi.fn(() => ({
    connect: vi.fn().mockReturnThis(),
    disconnect: vi.fn(),
    dispose: vi.fn(),
    gain: { value: 1 },
  })),
}));

// realtime-bpm-analyzer is a worklet import that Vitest's Node env can't load
vi.mock('realtime-bpm-analyzer', () => ({
  createRealTimeBpmProcessor: vi.fn(),
}));

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
      expect(mockAnnouncer.announce).toHaveBeenCalledWith('BPM locked at 128', false);
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
      expect(mockAnnouncer.announce).toHaveBeenCalledWith('The key is A minor', false);
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

      // Beatweaver routes the preset through a per-column modulator's input node.
      // The mock here doesn't expose `masterGain`, so the destination ends up as
      // the modulator stub's `input` Gain — anything truthy passes.
      expect(mockSynthEngine.playPreset).toHaveBeenCalledWith('bass_sub', expect.anything());
      expect(bw.activePresets.has('bass_sub')).toBe(true);
    });

    it('announces preset with announcement text', () => {
      bw.launchPreset('bass_sub');

      // Field precedence: preset.fire (design handoff) → preset.announcement → preset.name.
      // The test mock preset has `announcement: 'Sub bass'` only.
      expect(mockAnnouncer.announce).toHaveBeenCalledWith('Sub bass', false);
    });

    it('toggles off if already active', () => {
      bw.launchPreset('bass_sub');
      // Clear per-preset launch debounce (150ms) so the second synchronous
      // launch is treated as a deliberate toggle, not a double-trigger.
      bw._lastPresetLaunch.clear();
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

  describe('arm / fire-armed (design-handoff right-click flow)', () => {
    beforeEach(async () => {
      await bw.init();
      // Patch a `cue` line on a mock preset so we can assert it was spoken.
      const subPreset = mockPresets.find(p => p.id === 'bass_sub');
      subPreset.cue = 'To add more weight, we cue Sub Bass.';
      subPreset.fire = 'Sub Bass — unleashed.';
      bw._presets = [...mockPresets];
    });

    it('armPreset adds to armedPresets and speaks the cue line', () => {
      bw.armPreset('bass_sub');
      expect(bw.armedPresets.has('bass_sub')).toBe(true);
      expect(mockAnnouncer.announce).toHaveBeenCalledWith('To add more weight, we cue Sub Bass.', false);
    });

    it('armPreset is idempotent on the Set but re-speaks the cue', () => {
      bw.armPreset('bass_sub');
      bw.armPreset('bass_sub');
      expect(bw.armedPresets.size).toBe(1);
      // Spoken twice — re-arm reaffirms what's loaded.
      expect(mockAnnouncer.announce).toHaveBeenCalledTimes(2);
    });

    it('disarmPreset removes from armedPresets without speaking', () => {
      bw.armPreset('bass_sub');
      mockAnnouncer.announce.mockClear();
      bw.disarmPreset('bass_sub');
      expect(bw.armedPresets.has('bass_sub')).toBe(false);
      expect(mockAnnouncer.announce).not.toHaveBeenCalled();
    });

    it('toggleArmPreset arms then disarms on repeat', () => {
      bw.toggleArmPreset('bass_sub');
      expect(bw.armedPresets.has('bass_sub')).toBe(true);
      bw.toggleArmPreset('bass_sub');
      expect(bw.armedPresets.has('bass_sub')).toBe(false);
    });

    it('onArmedPresetsChange fires with the current set', () => {
      const cb = vi.fn();
      bw.onArmedPresetsChange = cb;
      bw.armPreset('bass_sub');
      expect(cb).toHaveBeenCalledWith(expect.any(Set));
      expect(cb.mock.calls[0][0].has('bass_sub')).toBe(true);
    });

    it('fireArmed launches every armed preset and clears the set', () => {
      bw.armPreset('bass_sub');
      bw.armPreset('energy_pulse');
      mockAnnouncer.announce.mockClear();

      const fired = bw.fireArmed();

      expect(fired).toEqual(expect.arrayContaining(['bass_sub', 'energy_pulse']));
      expect(bw.armedPresets.size).toBe(0);
      expect(mockSynthEngine.playPreset).toHaveBeenCalledWith('bass_sub', expect.anything());
      expect(mockSynthEngine.playPreset).toHaveBeenCalledWith('energy_pulse', expect.anything());
    });

    it('fireArmed with nothing armed is a no-op', () => {
      const fired = bw.fireArmed();
      expect(fired).toEqual([]);
      expect(mockSynthEngine.playPreset).not.toHaveBeenCalled();
    });

    it('armPreset on unknown ID is a silent no-op', () => {
      bw.armPreset('nonexistent_preset');
      expect(bw.armedPresets.size).toBe(0);
      expect(mockAnnouncer.announce).not.toHaveBeenCalled();
    });

    it('falls back to "Cue <name>" when preset has no cue field', () => {
      const fxPreset = mockPresets.find(p => p.id === 'fx_riser');
      delete fxPreset.cue;
      bw._presets = [...mockPresets];
      bw.armPreset('fx_riser');
      expect(mockAnnouncer.announce).toHaveBeenCalledWith('Cue Riser', false);
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
      expect(mockAnnouncer.announce).toHaveBeenCalledWith('Bank 2', false);
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
      expect(mockAnnouncer.announce).toHaveBeenCalledWith('Bank 1', false);
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

    // Top instrument buttons (0-3) use hold-to-turn-off:
    //   quick press+release (<1s) = LAUNCH the column's selected preset (turn ON only)
    //   long press+release (>=1s) = STOP it (turn OFF only)
    // Bottom buttons are function keys (mute / solo / BPM-/+/ analysis toggles), NOT preset stops.
    it('quick press+release on top button launches column preset', () => {
      mockMidiController.onButton(0, true, 1); // press
      mockMidiController.onButton(0, true, 0); // release (quick)
      expect(mockSynthEngine.playPreset).toHaveBeenCalledWith('bass_sub', expect.anything());
    });

    it('held top button (>= 1s) stops the column preset on release', () => {
      bw.launchPreset('bass_sub');
      vi.clearAllMocks();

      // Press, then force the recorded press time into the past to simulate a long hold,
      // then release.
      mockMidiController.onButton(0, true, 1);
      const state = bw._instrumentButtonState.get(0);
      if (state) state.pressTime = Date.now() - bw._HOLD_THRESHOLD_MS - 10;
      mockMidiController.onButton(0, true, 0);

      expect(mockSynthEngine.stopPreset).toHaveBeenCalledWith('bass_sub');
    });

    it('bottom button 0 is MUTE ALL (stopAll)', () => {
      bw.launchPreset('bass_sub');
      vi.clearAllMocks();

      mockMidiController.onButton(0, false, 1); // bottom button 0 press

      expect(mockSynthEngine.stopAll).toHaveBeenCalled();
    });

    it('fader 5 (index 5) sets instrument master volume with +25% headroom', () => {
      mockMidiController.onFader(5, 0.8);
      expect(mockSynthEngine.setMasterVolume).toHaveBeenCalledWith(0.8 * 1.25);
    });

    it('fader 4 (index 4) sets announcer volume', () => {
      mockMidiController.onFader(4, 0.6);
      expect(mockAnnouncer.setVolume).toHaveBeenCalledWith(0.6);
    });

    it('side button up press starts BPM hold (does not flip banks)', () => {
      // Side up/down moved from bank-switch to BPM hold-to-repeat. Bank flip is now
      // handled by row-A knobs (per-column). Confirm pressing UP does not change bank.
      const initialBank = bw.presetBank;
      mockMidiController.onSideButton('up', true);
      expect(bw.presetBank).toBe(initialBank);
      mockMidiController.onSideButton('up', false); // release to clear hold timer
    });

    it('side button left fires the row-fader-selected presets', () => {
      // Left used to toggle the announcer; it now fires the selected presets across
      // all 4 columns (the FIRE-ALL gesture, mirroring the on-screen F shortcut).
      mockMidiController.onSideButton('left', true);
      expect(mockSynthEngine.playPreset).toHaveBeenCalled();
    });

    it('MIDI connection fires React callback', () => {
      const callback = vi.fn();
      bw.onMidiConnectionChange = callback;

      mockMidiController.onConnectionChange(true, 'Launch Control XL');

      expect(callback).toHaveBeenCalledWith(true, 'Launch Control XL');
      expect(mockAnnouncer.announce).toHaveBeenCalledWith('Controller connected', false);
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
      expect(mockAnnouncer.announce).toHaveBeenCalledWith('The key is C', false);
    });

    it('setKey announces sharp keys correctly', () => {
      bw.setKey('F#');
      expect(mockAnnouncer.announce).toHaveBeenCalledWith('The key is F sharp', false);
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
