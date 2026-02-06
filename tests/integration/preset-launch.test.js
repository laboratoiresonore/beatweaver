/**
 * Preset Launch Integration Tests
 *
 * Tests the full preset launch pipeline:
 * Beatweaver.launchPreset → SynthEngine.playPreset → LED update → announcer.
 * Also tests stop, stopAll, bank switching, and the preset control system.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getAllPresets, getPresetById } from '../../src/presets/index.js';

// Mock Tone.js before importing Beatweaver
vi.mock('tone', () => ({
  start: vi.fn(),
  Frequency: vi.fn((note) => ({
    transpose: vi.fn(() => ({
      toNote: vi.fn(() => note),
      toFrequency: vi.fn(() => 440),
    })),
    toNote: vi.fn(() => note),
    toFrequency: vi.fn(() => 440),
  })),
  Transport: {
    bpm: { value: 120 },
    start: vi.fn(),
    stop: vi.fn(),
    cancel: vi.fn(),
    scheduleRepeat: vi.fn(() => 0),
    clear: vi.fn(),
    position: '0:0:0',
  },
  Gain: vi.fn(() => ({
    gain: { value: 0.8, linearRampToValueAtTime: vi.fn(), setValueAtTime: vi.fn() },
    toDestination: vi.fn().mockReturnThis(),
    connect: vi.fn().mockReturnThis(),
    disconnect: vi.fn(),
    dispose: vi.fn(),
  })),
  MonoSynth: vi.fn(() => ({
    connect: vi.fn().mockReturnThis(),
    triggerAttackRelease: vi.fn(),
    set: vi.fn(),
    dispose: vi.fn(),
    volume: { value: -12 },
    filter: { frequency: { value: 800 } },
  })),
  PolySynth: vi.fn(() => ({
    connect: vi.fn().mockReturnThis(),
    triggerAttackRelease: vi.fn(),
    set: vi.fn(),
    dispose: vi.fn(),
    volume: { value: -12 },
  })),
  NoiseSynth: vi.fn(() => ({
    connect: vi.fn().mockReturnThis(),
    triggerAttackRelease: vi.fn(),
    set: vi.fn(),
    dispose: vi.fn(),
    volume: { value: -12 },
  })),
  Filter: vi.fn(() => ({
    connect: vi.fn().mockReturnThis(),
    disconnect: vi.fn(),
    dispose: vi.fn(),
    frequency: { value: 800, linearRampToValueAtTime: vi.fn() },
    Q: { value: 6 },
  })),
  Sequence: vi.fn(() => ({
    start: vi.fn(),
    stop: vi.fn(),
    dispose: vi.fn(),
  })),
  getContext: vi.fn(() => ({ currentTime: 0 })),
  now: vi.fn(() => 0),
  context: { currentTime: 0 },
}));

// Mock createRealTimeBpmProcessor
vi.mock('realtime-bpm-analyzer', () => ({
  createRealTimeBpmProcessor: vi.fn(),
}));

const { Beatweaver } = await import('../../src/core/Beatweaver.js');

describe('Preset Launch', () => {
  let bw;
  let mockSynthEngine;
  let mockAnnouncer;
  let mockMidi;

  beforeEach(async () => {
    bw = new Beatweaver();

    // Mock subsystems
    mockSynthEngine = {
      init: vi.fn(),
      playPreset: vi.fn(() => true),
      stopPreset: vi.fn(),
      stopAllPresets: vi.fn(),
      stopAll: vi.fn(),
      setBPM: vi.fn(),
      setKey: vi.fn(),
      setMasterVolume: vi.fn(),
      setFadeIn: vi.fn(),
      setFadeOut: vi.fn(),
      setInstrumentVolume: vi.fn(),
      setFilterCutoff: vi.fn(),
      setFilterResonance: vi.fn(),
      dispose: vi.fn(),
    };

    mockAnnouncer = {
      init: vi.fn(),
      announce: vi.fn(),
      toggle: vi.fn(() => true),
      setVolume: vi.fn(),
      setPitch: vi.fn(),
      setRate: vi.fn(),
      setReverb: vi.fn(),
      setEcho: vi.fn(),
      setVoice: vi.fn(),
      setKoboldUrl: vi.fn(),
      getVoices: vi.fn(() => []),
      getState: vi.fn(() => ({ enabled: true })),
      enabled: true,
      dispose: vi.fn(),
    };

    mockMidi = {
      init: vi.fn(),
      isConnected: vi.fn(() => false),
      setPresetLEDs: vi.fn(),
      setLaunchingLED: vi.fn(),
      allLEDsOff: vi.fn(),
      dispose: vi.fn(),
      constructor: { LCXL: { LED_GREEN: 60, LED_OFF: 0, LED_AMBER: 63 } },
      deviceName: '',
    };

    bw.synthEngine = mockSynthEngine;
    bw.announcer = mockAnnouncer;
    bw.midiController = mockMidi;
    bw.audioAnalysis = {
      init: vi.fn(),
      onBpmUpdate: null, onBpmLock: null, onKeyUpdate: null, onKeyLock: null,
      onBeat: null, onError: null,
      getState: vi.fn(() => ({})),
      dispose: vi.fn(),
    };

    await bw.init();
  });

  describe('preset library', () => {
    it('has 16 presets', () => {
      const presets = getAllPresets();
      expect(presets.length).toBe(16);
    });

    it('all presets have required fields', () => {
      const presets = getAllPresets();
      presets.forEach(preset => {
        expect(preset.id).toBeDefined();
        expect(preset.name).toBeDefined();
        expect(preset.category).toBeDefined();
        expect(preset.instrument).toBeDefined();
        expect(preset.pattern).toBeDefined();
        expect(preset.controls).toBeDefined();
      });
    });

    it('presets have unique IDs', () => {
      const presets = getAllPresets();
      const ids = presets.map(p => p.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it('every preset has an announcement string', () => {
      const presets = getAllPresets();
      presets.forEach(preset => {
        expect(typeof preset.announcement).toBe('string');
        expect(preset.announcement.length).toBeGreaterThan(0);
      });
    });

    it('getPresetById finds preset by ID', () => {
      const presets = getAllPresets();
      const first = presets[0];
      expect(getPresetById(first.id)).toBeDefined();
      expect(getPresetById(first.id).name).toBe(first.name);
    });

    it('getPresetById returns null for unknown ID', () => {
      expect(getPresetById('NONEXISTENT')).toBeNull();
    });
  });

  describe('launching presets', () => {
    it('launches a preset by ID', () => {
      const presets = getAllPresets();
      const preset = presets[0];

      bw.launchPreset(preset.id);

      expect(mockSynthEngine.playPreset).toHaveBeenCalledWith(preset.id);
      expect(bw.activePresets.has(preset.id)).toBe(true);
    });

    it('announces preset on launch', () => {
      const presets = getAllPresets();
      const preset = presets[0];

      bw.launchPreset(preset.id);

      expect(mockAnnouncer.announce).toHaveBeenCalledWith(preset.announcement);
    });

    it('toggles off if preset already active', () => {
      const presets = getAllPresets();
      const preset = presets[0];

      bw.launchPreset(preset.id); // Launch
      expect(bw.activePresets.has(preset.id)).toBe(true);

      bw.launchPreset(preset.id); // Toggle off
      expect(bw.activePresets.has(preset.id)).toBe(false);
      expect(mockSynthEngine.stopPreset).toHaveBeenCalledWith(preset.id);
    });

    it('ignores unknown preset ID', () => {
      bw.launchPreset('NONEXISTENT_PRESET');
      expect(mockSynthEngine.playPreset).not.toHaveBeenCalled();
    });

    it('fires onActivePresetsChange callback', () => {
      const callback = vi.fn();
      bw.onActivePresetsChange = callback;

      const preset = getAllPresets()[0];
      bw.launchPreset(preset.id);

      expect(callback).toHaveBeenCalled();
      const arg = callback.mock.calls[0][0];
      expect(arg).toBeInstanceOf(Set);
      expect(arg.has(preset.id)).toBe(true);
    });

    it('does not add preset if synthEngine returns false', () => {
      mockSynthEngine.playPreset.mockReturnValue(false);
      const preset = getAllPresets()[0];

      bw.launchPreset(preset.id);

      expect(bw.activePresets.has(preset.id)).toBe(false);
    });
  });

  describe('stopping presets', () => {
    it('stopPreset removes from active set', () => {
      const preset = getAllPresets()[0];
      bw.activePresets.add(preset.id);

      bw.stopPreset(preset.id);

      expect(bw.activePresets.has(preset.id)).toBe(false);
      expect(mockSynthEngine.stopPreset).toHaveBeenCalledWith(preset.id);
    });

    it('stopAll clears all active presets', () => {
      const presets = getAllPresets();
      bw.activePresets.add(presets[0].id);
      bw.activePresets.add(presets[1].id);
      bw.activePresets.add(presets[2].id);

      bw.stopAll();

      expect(bw.activePresets.size).toBe(0);
      expect(mockSynthEngine.stopAllPresets).toHaveBeenCalled();
      expect(mockSynthEngine.stopAll).toHaveBeenCalled();
    });
  });

  describe('bank switching', () => {
    it('starts at bank 0', () => {
      expect(bw.presetBank).toBe(0);
    });

    it('setBankUp increments bank', () => {
      bw.setBankUp();
      expect(bw.presetBank).toBe(1);
      expect(mockAnnouncer.announce).toHaveBeenCalledWith('Bank 2');
    });

    it('setBankUp does not exceed max bank', () => {
      const maxBank = Math.ceil(getAllPresets().length / 8) - 1;
      for (let i = 0; i < maxBank + 5; i++) {
        bw.setBankUp();
      }
      expect(bw.presetBank).toBe(maxBank);
    });

    it('setBankDown decrements bank', () => {
      bw.presetBank = 1;
      bw.setBankDown();
      expect(bw.presetBank).toBe(0);
      expect(mockAnnouncer.announce).toHaveBeenCalledWith('Bank 1');
    });

    it('setBankDown does not go below 0', () => {
      bw.presetBank = 0;
      bw.setBankDown();
      expect(bw.presetBank).toBe(0);
    });
  });

  describe('preset controls (_setPresetControl)', () => {
    it('delegates volume control to synthEngine', () => {
      const preset = getAllPresets().find(p => p.controls.POWER);
      if (!preset) return;

      bw._setPresetControl(preset.id, 'POWER', 0.5);

      expect(mockSynthEngine.setInstrumentVolume).toHaveBeenCalledWith(preset.instrument, 0.5);
    });

    it('ignores unknown preset', () => {
      bw._setPresetControl('UNKNOWN', 'POWER', 0.5);
      expect(mockSynthEngine.setInstrumentVolume).not.toHaveBeenCalled();
    });

    it('ignores unknown control name', () => {
      const preset = getAllPresets()[0];
      bw._setPresetControl(preset.id, 'NONEXISTENT', 0.5);
      // Should not throw
    });
  });

  describe('multiple presets', () => {
    it('supports multiple simultaneous presets', () => {
      const presets = getAllPresets();

      bw.launchPreset(presets[0].id);
      bw.launchPreset(presets[1].id);
      bw.launchPreset(presets[2].id);

      expect(bw.activePresets.size).toBe(3);
    });
  });
});
