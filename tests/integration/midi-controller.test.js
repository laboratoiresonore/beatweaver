import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MidiController } from '../../src/core/MidiController.js';

/**
 * MidiController integration tests
 * Uses mock WebMIDI API since no hardware available in test environment
 */

// Mock MIDI input/output
function createMockMidiPort(name, type) {
  return {
    id: `${type}-${name}`,
    name,
    type,
    state: 'connected',
    onmidimessage: null,
    send: vi.fn(),
    open: vi.fn(),
    close: vi.fn(),
  };
}

function createMockMidiAccess(inputName = 'Launch Control XL', outputName = 'Launch Control XL') {
  const input = inputName ? createMockMidiPort(inputName, 'input') : null;
  const output = outputName ? createMockMidiPort(outputName, 'output') : null;

  const inputs = new Map();
  const outputs = new Map();
  if (input) inputs.set(input.id, input);
  if (output) outputs.set(output.id, output);

  return {
    inputs,
    outputs,
    onstatechange: null,
    _input: input,
    _output: output,
  };
}

describe('MidiController', () => {
  let controller;
  let mockAccess;

  beforeEach(() => {
    controller = new MidiController();
    mockAccess = createMockMidiAccess();
  });

  describe('initialization', () => {
    it('detects Launch Control XL by name', () => {
      // Manually assign midi access (bypassing navigator.requestMIDIAccess)
      controller.midiAccess = mockAccess;
      controller._findDevice();

      expect(controller.connected).toBe(true);
      expect(controller.deviceName).toContain('Launch Control XL');
    });

    it('reports not connected when no LCXL present', () => {
      const noLcxl = createMockMidiAccess('Some Other Device', 'Some Other Device');
      controller.midiAccess = noLcxl;
      controller._findDevice();

      expect(controller.connected).toBe(false);
      expect(controller.deviceName).toBe('');
    });

    it('calls onConnectionChange when device connects', () => {
      const callback = vi.fn();
      controller.onConnectionChange = callback;
      controller.midiAccess = mockAccess;
      controller._findDevice();

      expect(callback).toHaveBeenCalledWith(true, expect.stringContaining('Launch Control'));
    });

    it('calls onConnectionChange when device disconnects', () => {
      // First connect
      controller.midiAccess = mockAccess;
      controller._findDevice();
      expect(controller.connected).toBe(true);

      // Then disconnect
      const callback = vi.fn();
      controller.onConnectionChange = callback;
      const emptyAccess = createMockMidiAccess(null, null);
      controller.midiAccess = emptyAccess;
      controller._findDevice();

      expect(controller.connected).toBe(false);
      expect(callback).toHaveBeenCalledWith(false, '');
    });
  });

  describe('message parsing - buttons', () => {
    beforeEach(() => {
      controller.midiAccess = mockAccess;
      controller._findDevice();
    });

    it('dispatches top button press (Note On)', () => {
      const callback = vi.fn();
      controller.onButton = callback;

      // Note On, note 41 (top button 0), velocity 127
      controller._handleMessage({ data: [0x90, 41, 127] });

      expect(callback).toHaveBeenCalledWith(0, true, 1); // index 0, isTop=true, velocity=1.0
    });

    it('dispatches bottom button press', () => {
      const callback = vi.fn();
      controller.onButton = callback;

      // Note On, note 73 (bottom button 0), velocity 100
      controller._handleMessage({ data: [0x90, 73, 100] });

      expect(callback).toHaveBeenCalledWith(0, false, expect.closeTo(0.787, 2));
    });

    it('dispatches correct index for button 4 (second half)', () => {
      const callback = vi.fn();
      controller.onButton = callback;

      // Note 57 is top button index 4
      controller._handleMessage({ data: [0x90, 57, 127] });

      expect(callback).toHaveBeenCalledWith(4, true, 1);
    });

    it('dispatches all 8 top buttons with correct indices', () => {
      const callback = vi.fn();
      controller.onButton = callback;

      const topNotes = [41, 42, 43, 44, 57, 58, 59, 60];
      topNotes.forEach((note, expectedIndex) => {
        callback.mockClear();
        controller._handleMessage({ data: [0x90, note, 127] });
        expect(callback).toHaveBeenCalledWith(expectedIndex, true, 1);
      });
    });

    it('dispatches all 8 bottom buttons with correct indices', () => {
      const callback = vi.fn();
      controller.onButton = callback;

      const bottomNotes = [73, 74, 75, 76, 89, 90, 91, 92];
      bottomNotes.forEach((note, expectedIndex) => {
        callback.mockClear();
        controller._handleMessage({ data: [0x90, note, 127] });
        expect(callback).toHaveBeenCalledWith(expectedIndex, false, 1);
      });
    });
  });

  describe('message parsing - faders', () => {
    beforeEach(() => {
      controller.midiAccess = mockAccess;
      controller._findDevice();
    });

    it('dispatches fader with normalized value', () => {
      const callback = vi.fn();
      controller.onFader = callback;

      // CC, fader 0 (CC 77), value 64 (half)
      controller._handleMessage({ data: [0xB0, 77, 64] });

      expect(callback).toHaveBeenCalledWith(0, expect.closeTo(0.504, 2));
    });

    it('dispatches fader 7 (master volume)', () => {
      const callback = vi.fn();
      controller.onFader = callback;

      // CC 84 = fader index 7
      controller._handleMessage({ data: [0xB0, 84, 127] });

      expect(callback).toHaveBeenCalledWith(7, 1);
    });

    it('dispatches all 8 faders', () => {
      const callback = vi.fn();
      controller.onFader = callback;

      const faderCCs = [77, 78, 79, 80, 81, 82, 83, 84];
      faderCCs.forEach((cc, expectedIndex) => {
        callback.mockClear();
        controller._handleMessage({ data: [0xB0, cc, 127] });
        expect(callback).toHaveBeenCalledWith(expectedIndex, 1);
      });
    });
  });

  describe('message parsing - knobs', () => {
    beforeEach(() => {
      controller.midiAccess = mockAccess;
      controller._findDevice();
    });

    it('dispatches knob row A (top)', () => {
      const callback = vi.fn();
      controller.onKnob = callback;

      // CC 13 = knob A index 0
      controller._handleMessage({ data: [0xB0, 13, 64] });

      expect(callback).toHaveBeenCalledWith('A', 0, expect.closeTo(0.504, 2));
    });

    it('dispatches knob row B (middle)', () => {
      const callback = vi.fn();
      controller.onKnob = callback;

      // CC 29 = knob B index 0
      controller._handleMessage({ data: [0xB0, 29, 127] });

      expect(callback).toHaveBeenCalledWith('B', 0, 1);
    });

    it('dispatches knob row C (bottom)', () => {
      const callback = vi.fn();
      controller.onKnob = callback;

      // CC 49 = knob C index 0
      controller._handleMessage({ data: [0xB0, 49, 0] });

      expect(callback).toHaveBeenCalledWith('C', 0, 0);
    });
  });

  describe('LED control', () => {
    beforeEach(() => {
      controller.midiAccess = mockAccess;
      controller._findDevice();
    });

    it('sends Note On to set LED color', () => {
      controller.setLED(41, MidiController.LCXL.LED_GREEN);

      expect(mockAccess._output.send).toHaveBeenCalledWith([0x90, 41, 60]);
    });

    it('setTopLED sends to correct button note', () => {
      controller.setTopLED(0, MidiController.LCXL.LED_RED);

      // Button 0 = note 41
      expect(mockAccess._output.send).toHaveBeenCalledWith([0x90, 41, 15]);
    });

    it('setPresetLEDs lights active indices green, others off', () => {
      // Clear connection flash calls from _findDevice
      mockAccess._output.send.mockClear();

      controller.setPresetLEDs(new Set([0, 3, 7]));

      const calls = mockAccess._output.send.mock.calls;
      // Should have 8 calls (one per button)
      expect(calls.length).toBe(8);

      // Index 0 should be green (note 41)
      expect(calls.find(c => c[0][1] === 41)[0][2]).toBe(MidiController.LCXL.LED_GREEN);
      // Index 1 should be off (note 42)
      expect(calls.find(c => c[0][1] === 42)[0][2]).toBe(MidiController.LCXL.LED_OFF);
      // Index 3 should be green (note 44)
      expect(calls.find(c => c[0][1] === 44)[0][2]).toBe(MidiController.LCXL.LED_GREEN);
    });

    it('allLEDsOff turns off all 16 buttons', () => {
      // Clear connection flash calls from _findDevice
      mockAccess._output.send.mockClear();

      controller.allLEDsOff();

      // 8 top + 8 bottom = 16 calls
      expect(mockAccess._output.send).toHaveBeenCalledTimes(16);
      mockAccess._output.send.mock.calls.forEach(call => {
        expect(call[0][2]).toBe(0); // All velocities = 0 (off)
      });
    });
  });

  describe('state', () => {
    it('getState returns connection info', () => {
      controller.midiAccess = mockAccess;
      controller._findDevice();

      const state = controller.getState();
      expect(state.connected).toBe(true);
      expect(state.deviceName).toContain('Launch Control');
    });

    it('isConnected reflects actual state', () => {
      expect(controller.isConnected()).toBe(false);

      controller.midiAccess = mockAccess;
      controller._findDevice();

      expect(controller.isConnected()).toBe(true);
    });
  });

  describe('cleanup', () => {
    it('dispose clears state and detaches handlers', () => {
      controller.midiAccess = mockAccess;
      controller._findDevice();

      controller.dispose();

      expect(controller.connected).toBe(false);
      expect(controller.input).toBeNull();
      expect(controller.output).toBeNull();
    });
  });
});
