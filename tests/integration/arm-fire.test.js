/**
 * Arm / Fire-Armed Integration Tests (2026-04-30 design handoff)
 *
 * Covers the arm/cue interaction layer:
 *   - armPreset() adds the preset to armedPresets and speaks `preset.cue`
 *   - disarmPreset() removes it, no announcement
 *   - toggleArmPreset() flips arm state
 *   - fireArmed() launches every armed preset and clears the armed set
 *   - onArmedPresetsChange callback fires on every state mutation
 *
 * The audio path (launchPreset) is unchanged; this is purely an interaction layer.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getAllPresets } from '../../src/presets/index.js';

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
  Frequency: vi.fn((note) => ({
    transpose: vi.fn(() => ({ toNote: vi.fn(() => note) })),
    toNote: vi.fn(() => note),
  })),
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
vi.mock('realtime-bpm-analyzer', () => ({ createRealTimeBpmProcessor: vi.fn() }));

const { Beatweaver } = await import('../../src/core/Beatweaver.js');

describe('Arm / Fire-Armed', () => {
  let bw;
  let mockSynth;
  let mockAnnouncer;
  let mockMidi;

  beforeEach(async () => {
    bw = new Beatweaver();

    mockSynth = {
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
      dispose: vi.fn(),
    };
    mockAnnouncer = {
      init: vi.fn(),
      announce: vi.fn(),
      toggle: vi.fn(() => true),
      setVolume: vi.fn(), setPitch: vi.fn(), setRate: vi.fn(),
      setReverb: vi.fn(), setEcho: vi.fn(), setVoice: vi.fn(),
      setKoboldUrl: vi.fn(),
      getVoices: vi.fn(() => []),
      getState: vi.fn(() => ({ enabled: true })),
      enabled: true,
      dispose: vi.fn(),
    };
    mockMidi = {
      init: vi.fn(),
      isConnected: vi.fn(() => false),
      setPresetLEDs: vi.fn(), setLaunchingLED: vi.fn(),
      allLEDsOff: vi.fn(),
      dispose: vi.fn(),
      constructor: { LCXL: { LED_GREEN: 60, LED_OFF: 0, LED_AMBER: 63 } },
      deviceName: '',
    };

    bw.synthEngine = mockSynth;
    bw.announcer = mockAnnouncer;
    bw.midiController = mockMidi;
    bw.audioAnalysis = {
      init: vi.fn(),
      onBpmUpdate: null, onBpmLock: null, onKeyUpdate: null, onKeyLock: null,
      onBeat: null, onError: null,
      getState: vi.fn(() => ({})),
      dispose: vi.fn(),
    };

    bw._presetDebounceMs = 0;
    await bw.init();
  });

  describe('armPreset()', () => {
    it('adds the preset id to armedPresets', () => {
      const preset = getAllPresets()[0];
      bw.armPreset(preset.id);
      expect(bw.armedPresets.has(preset.id)).toBe(true);
    });

    it('speaks the preset.cue line on arm', () => {
      const preset = getAllPresets()[0];
      bw.armPreset(preset.id);
      expect(mockAnnouncer.announce).toHaveBeenCalledWith(preset.cue, false);
    });

    it('falls back to "Cue <name>" if preset.cue is missing', () => {
      const preset = getAllPresets()[0];
      const original = preset.cue;
      delete preset.cue;
      try {
        bw.armPreset(preset.id);
        expect(mockAnnouncer.announce).toHaveBeenCalledWith(`Cue ${preset.name}`, false);
      } finally {
        preset.cue = original;
      }
    });

    it('silently ignores unknown preset IDs', () => {
      bw.armPreset('NONEXISTENT');
      expect(bw.armedPresets.size).toBe(0);
      expect(mockAnnouncer.announce).not.toHaveBeenCalled();
    });

    it('fires onArmedPresetsChange with a new Set', () => {
      const onChange = vi.fn();
      bw.onArmedPresetsChange = onChange;
      const preset = getAllPresets()[0];

      bw.armPreset(preset.id);

      expect(onChange).toHaveBeenCalledTimes(1);
      const arg = onChange.mock.calls[0][0];
      expect(arg).toBeInstanceOf(Set);
      expect(arg.has(preset.id)).toBe(true);
      // Caller gets a defensive copy so they can't mutate Beatweaver's state.
      expect(arg).not.toBe(bw.armedPresets);
    });

    it('arming the same preset twice still re-speaks the cue (idempotent state, repeated voice)', () => {
      const preset = getAllPresets()[0];
      bw.armPreset(preset.id);
      bw.armPreset(preset.id);
      expect(bw.armedPresets.size).toBe(1);
      expect(mockAnnouncer.announce).toHaveBeenCalledTimes(2);
    });
  });

  describe('disarmPreset()', () => {
    it('removes the preset and fires the change callback', () => {
      const onChange = vi.fn();
      const preset = getAllPresets()[0];
      bw.armPreset(preset.id);
      bw.onArmedPresetsChange = onChange;

      bw.disarmPreset(preset.id);

      expect(bw.armedPresets.has(preset.id)).toBe(false);
      expect(onChange).toHaveBeenCalledTimes(1);
    });

    it('is a no-op when the preset is not armed (no spurious callback)', () => {
      const onChange = vi.fn();
      bw.onArmedPresetsChange = onChange;
      bw.disarmPreset('NONEXISTENT');
      expect(onChange).not.toHaveBeenCalled();
    });

    it('does not announce on disarm', () => {
      const preset = getAllPresets()[0];
      bw.armPreset(preset.id);
      mockAnnouncer.announce.mockClear();
      bw.disarmPreset(preset.id);
      expect(mockAnnouncer.announce).not.toHaveBeenCalled();
    });
  });

  describe('toggleArmPreset()', () => {
    it('arms then disarms on alternating calls', () => {
      const preset = getAllPresets()[0];

      bw.toggleArmPreset(preset.id);
      expect(bw.armedPresets.has(preset.id)).toBe(true);

      bw.toggleArmPreset(preset.id);
      expect(bw.armedPresets.has(preset.id)).toBe(false);
    });
  });

  describe('fireArmed()', () => {
    it('returns [] and is a no-op when nothing is armed', () => {
      const fired = bw.fireArmed();
      expect(fired).toEqual([]);
      expect(mockSynth.playPreset).not.toHaveBeenCalled();
    });

    it('fires every armed preset through launchPreset', () => {
      const presets = getAllPresets().slice(0, 3);
      presets.forEach(p => bw.armPreset(p.id));
      mockSynth.playPreset.mockClear();

      const fired = bw.fireArmed();

      expect(fired.sort()).toEqual(presets.map(p => p.id).sort());
      // Each preset should have hit synthEngine.playPreset
      expect(mockSynth.playPreset).toHaveBeenCalledTimes(3);
    });

    it('clears the armed set even when a preset fails to start', () => {
      const presets = getAllPresets().slice(0, 2);
      presets.forEach(p => bw.armPreset(p.id));
      mockSynth.playPreset.mockReturnValueOnce(false); // first one fails

      bw.fireArmed();

      expect(bw.armedPresets.size).toBe(0);
    });

    it('emits onArmedPresetsChange(empty Set) when firing clears armed', () => {
      const onChange = vi.fn();
      const preset = getAllPresets()[0];
      bw.armPreset(preset.id);
      bw.onArmedPresetsChange = onChange; // attach AFTER arm so we only see the fire callback

      bw.fireArmed();

      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange.mock.calls[0][0].size).toBe(0);
    });

    it('speaks each preset.fire line during the launch (not the cue line)', () => {
      const preset = getAllPresets()[0];
      bw.armPreset(preset.id);
      mockAnnouncer.announce.mockClear();

      bw.fireArmed();

      // launchPreset uses preset.fire || preset.announcement || preset.name
      expect(mockAnnouncer.announce).toHaveBeenCalledWith(preset.fire, false);
    });
  });
});
