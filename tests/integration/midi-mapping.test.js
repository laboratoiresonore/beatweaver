/**
 * MIDI Mapping Integration Tests
 *
 * Tests: Launch Control XL CC/Note → action mapping,
 * LED feedback, hot-plug detection, side buttons.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MidiController } from '../../src/core/MidiController.js';

describe('MIDI Mapping', () => {
  let midi;

  beforeEach(() => {
    midi = new MidiController();
    midi.onButton = vi.fn();
    midi.onFader = vi.fn();
    midi.onKnob = vi.fn();
    midi.onSideButton = vi.fn();
  });

  describe('LCXL constants', () => {
    const lcxl = MidiController.LCXL;

    it('has 8 faders', () => {
      expect(lcxl.FADERS).toHaveLength(8);
    });

    it('has 3 rows of 8 knobs', () => {
      expect(lcxl.KNOBS_A).toHaveLength(8);
      expect(lcxl.KNOBS_B).toHaveLength(8);
      expect(lcxl.KNOBS_C).toHaveLength(8);
    });

    it('has 2 rows of 8 buttons', () => {
      expect(lcxl.BUTTONS_TOP).toHaveLength(8);
      expect(lcxl.BUTTONS_BOTTOM).toHaveLength(8);
    });

    it('has 4 side button CCs', () => {
      expect(lcxl.SIDE_UP).toBeDefined();
      expect(lcxl.SIDE_DOWN).toBeDefined();
      expect(lcxl.SIDE_LEFT).toBeDefined();
      expect(lcxl.SIDE_RIGHT).toBeDefined();
    });

    it('all MIDI note/CC values are unique across categories', () => {
      const allValues = [
        ...lcxl.FADERS,
        ...lcxl.KNOBS_A,
        ...lcxl.KNOBS_B,
        ...lcxl.KNOBS_C,
      ];
      expect(new Set(allValues).size).toBe(allValues.length);
    });

    it('button notes are unique', () => {
      const allButtons = [...lcxl.BUTTONS_TOP, ...lcxl.BUTTONS_BOTTOM];
      expect(new Set(allButtons).size).toBe(allButtons.length);
    });
  });

  describe('top row button dispatch', () => {
    const lcxl = MidiController.LCXL;

    it('dispatches top button 0 on Note On', () => {
      midi._handleMessage({ data: [0x90, lcxl.BUTTONS_TOP[0], 127] });
      expect(midi.onButton).toHaveBeenCalledWith(0, true, 1); // index, isTop, normalized velocity
    });

    it('dispatches top button 7', () => {
      midi._handleMessage({ data: [0x90, lcxl.BUTTONS_TOP[7], 64] });
      expect(midi.onButton).toHaveBeenCalledWith(7, true, expect.closeTo(0.504, 2));
    });

    it('dispatches all 8 top buttons correctly', () => {
      lcxl.BUTTONS_TOP.forEach((note, index) => {
        midi.onButton.mockClear();
        midi._handleMessage({ data: [0x90, note, 127] });
        expect(midi.onButton).toHaveBeenCalledWith(index, true, 1);
      });
    });
  });

  describe('bottom row button dispatch', () => {
    const lcxl = MidiController.LCXL;

    it('dispatches bottom button 0', () => {
      midi._handleMessage({ data: [0x90, lcxl.BUTTONS_BOTTOM[0], 127] });
      expect(midi.onButton).toHaveBeenCalledWith(0, false, 1);
    });

    it('dispatches all 8 bottom buttons correctly', () => {
      lcxl.BUTTONS_BOTTOM.forEach((note, index) => {
        midi.onButton.mockClear();
        midi._handleMessage({ data: [0x90, note, 127] });
        expect(midi.onButton).toHaveBeenCalledWith(index, false, 1);
      });
    });
  });

  describe('fader dispatch', () => {
    const lcxl = MidiController.LCXL;

    it('dispatches fader 0 with normalized value', () => {
      midi._handleMessage({ data: [0xB0, lcxl.FADERS[0], 64] });
      expect(midi.onFader).toHaveBeenCalledWith(0, expect.closeTo(0.504, 2));
    });

    it('dispatches fader at min (0)', () => {
      midi._handleMessage({ data: [0xB0, lcxl.FADERS[0], 0] });
      expect(midi.onFader).toHaveBeenCalledWith(0, 0);
    });

    it('dispatches fader at max (127)', () => {
      midi._handleMessage({ data: [0xB0, lcxl.FADERS[0], 127] });
      expect(midi.onFader).toHaveBeenCalledWith(0, 1);
    });

    it('dispatches all 8 faders', () => {
      lcxl.FADERS.forEach((cc, index) => {
        midi.onFader.mockClear();
        midi._handleMessage({ data: [0xB0, cc, 100] });
        expect(midi.onFader).toHaveBeenCalledWith(index, expect.any(Number));
      });
    });
  });

  describe('knob dispatch', () => {
    const lcxl = MidiController.LCXL;

    it('dispatches Row A knob 0', () => {
      midi._handleMessage({ data: [0xB0, lcxl.KNOBS_A[0], 64] });
      expect(midi.onKnob).toHaveBeenCalledWith('A', 0, expect.any(Number));
    });

    it('dispatches Row B knob 3', () => {
      midi._handleMessage({ data: [0xB0, lcxl.KNOBS_B[3], 100] });
      expect(midi.onKnob).toHaveBeenCalledWith('B', 3, expect.any(Number));
    });

    it('dispatches Row C knob 7', () => {
      midi._handleMessage({ data: [0xB0, lcxl.KNOBS_C[7], 50] });
      expect(midi.onKnob).toHaveBeenCalledWith('C', 7, expect.any(Number));
    });

    it('dispatches all 24 knobs correctly', () => {
      const rows = [
        { ccs: lcxl.KNOBS_A, row: 'A' },
        { ccs: lcxl.KNOBS_B, row: 'B' },
        { ccs: lcxl.KNOBS_C, row: 'C' },
      ];

      rows.forEach(({ ccs, row }) => {
        ccs.forEach((cc, index) => {
          midi.onKnob.mockClear();
          midi._handleMessage({ data: [0xB0, cc, 64] });
          expect(midi.onKnob).toHaveBeenCalledWith(row, index, expect.any(Number));
        });
      });
    });
  });

  describe('side button dispatch', () => {
    const lcxl = MidiController.LCXL;

    it('dispatches UP press', () => {
      midi._handleMessage({ data: [0xB0, lcxl.SIDE_UP, 127] });
      expect(midi.onSideButton).toHaveBeenCalledWith('up', true);
    });

    it('dispatches DOWN press', () => {
      midi._handleMessage({ data: [0xB0, lcxl.SIDE_DOWN, 127] });
      expect(midi.onSideButton).toHaveBeenCalledWith('down', true);
    });

    it('dispatches LEFT press', () => {
      midi._handleMessage({ data: [0xB0, lcxl.SIDE_LEFT, 127] });
      expect(midi.onSideButton).toHaveBeenCalledWith('left', true);
    });

    it('dispatches RIGHT press', () => {
      midi._handleMessage({ data: [0xB0, lcxl.SIDE_RIGHT, 127] });
      expect(midi.onSideButton).toHaveBeenCalledWith('right', true);
    });

    it('dispatches release with isPress=false', () => {
      midi._handleMessage({ data: [0xB0, lcxl.SIDE_UP, 0] });
      expect(midi.onSideButton).toHaveBeenCalledWith('up', false);
    });
  });

  describe('unrecognized messages', () => {
    it('ignores unrecognized CC', () => {
      midi._handleMessage({ data: [0xB0, 99, 64] });
      expect(midi.onFader).not.toHaveBeenCalled();
      expect(midi.onKnob).not.toHaveBeenCalled();
      expect(midi.onSideButton).not.toHaveBeenCalled();
    });

    it('ignores unrecognized Note On', () => {
      midi._handleMessage({ data: [0x90, 1, 127] }); // Note 1 is not mapped
      expect(midi.onButton).not.toHaveBeenCalled();
    });

    it('handles missing callbacks gracefully', () => {
      midi.onButton = null;
      midi.onFader = null;
      midi.onKnob = null;
      midi.onSideButton = null;

      const lcxl = MidiController.LCXL;
      // Should not throw
      midi._handleMessage({ data: [0x90, lcxl.BUTTONS_TOP[0], 127] });
      midi._handleMessage({ data: [0xB0, lcxl.FADERS[0], 64] });
      midi._handleMessage({ data: [0xB0, lcxl.KNOBS_A[0], 64] });
      midi._handleMessage({ data: [0xB0, lcxl.SIDE_UP, 127] });
    });
  });

  describe('LED control', () => {
    let mockOutput;

    beforeEach(() => {
      mockOutput = { send: vi.fn() };
      midi.output = mockOutput;
    });

    it('setLED sends Note On with color', () => {
      midi.setLED(41, 60);
      expect(mockOutput.send).toHaveBeenCalledWith([0x90, 41, 60]);
    });

    it('setLED tracks state', () => {
      midi.setLED(41, 60);
      expect(midi._ledState.get(41)).toBe(60);
    });

    it('setTopLED sets correct note', () => {
      const lcxl = MidiController.LCXL;
      midi.setTopLED(0, lcxl.LED_GREEN);
      expect(mockOutput.send).toHaveBeenCalledWith([0x90, lcxl.BUTTONS_TOP[0], lcxl.LED_GREEN]);
    });

    it('setBottomLED sets correct note', () => {
      const lcxl = MidiController.LCXL;
      midi.setBottomLED(3, lcxl.LED_RED);
      expect(mockOutput.send).toHaveBeenCalledWith([0x90, lcxl.BUTTONS_BOTTOM[3], lcxl.LED_RED]);
    });

    it('setPresetLEDs lights active buttons green', () => {
      const lcxl = MidiController.LCXL;
      midi.setPresetLEDs(new Set([0, 3, 7]));

      expect(mockOutput.send).toHaveBeenCalledWith([0x90, lcxl.BUTTONS_TOP[0], lcxl.LED_GREEN]);
      expect(mockOutput.send).toHaveBeenCalledWith([0x90, lcxl.BUTTONS_TOP[3], lcxl.LED_GREEN]);
      expect(mockOutput.send).toHaveBeenCalledWith([0x90, lcxl.BUTTONS_TOP[7], lcxl.LED_GREEN]);
      // Others should be off
      expect(mockOutput.send).toHaveBeenCalledWith([0x90, lcxl.BUTTONS_TOP[1], lcxl.LED_OFF]);
    });

    it('setLaunchingLED sets amber', () => {
      const lcxl = MidiController.LCXL;
      midi.setLaunchingLED(2);
      expect(mockOutput.send).toHaveBeenCalledWith([0x90, lcxl.BUTTONS_TOP[2], lcxl.LED_AMBER]);
    });

    it('allLEDsOff turns off all 16 buttons + sends 1 SysEx for 24 knob LEDs', () => {
      const lcxl = MidiController.LCXL;
      midi.allLEDsOff();

      const allButtons = [...lcxl.BUTTONS_TOP, ...lcxl.BUTTONS_BOTTOM];
      // 16 button Note Off + 1 batched SysEx for all 24 knob LEDs = 17 sends
      expect(mockOutput.send).toHaveBeenCalledTimes(allButtons.length + 1);
      allButtons.forEach(note => {
        expect(mockOutput.send).toHaveBeenCalledWith([0x90, note, lcxl.LED_OFF]);
      });
    });

    it('allButtonLEDsOff turns off all 16 buttons (no knob SysEx)', () => {
      const lcxl = MidiController.LCXL;
      midi.allButtonLEDsOff();

      const allButtons = [...lcxl.BUTTONS_TOP, ...lcxl.BUTTONS_BOTTOM];
      expect(mockOutput.send).toHaveBeenCalledTimes(allButtons.length);
      allButtons.forEach(note => {
        expect(mockOutput.send).toHaveBeenCalledWith([0x90, note, lcxl.LED_OFF]);
      });
    });

    it('setLED does nothing when no output', () => {
      midi.output = null;
      midi.setLED(41, 60); // Should not throw
    });
  });

  describe('state', () => {
    it('reports disconnected by default', () => {
      expect(midi.isConnected()).toBe(false);
      expect(midi.getState().connected).toBe(false);
    });

    it('getState includes LED state', () => {
      midi.output = { send: vi.fn() };
      midi.setLED(41, 60);

      const state = midi.getState();
      expect(state.ledState[41]).toBe(60);
    });
  });

  describe('dispose', () => {
    it('clears all state on dispose', () => {
      midi.output = { send: vi.fn() };
      midi.connected = true;
      midi.input = { onmidimessage: vi.fn() };
      midi.midiAccess = { onstatechange: vi.fn() };

      midi.dispose();

      expect(midi.connected).toBe(false);
      expect(midi.input).toBeNull();
      expect(midi.output).toBeNull();
    });
  });
});
