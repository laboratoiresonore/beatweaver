/**
 * Modulator Pool Integration Tests
 *
 * Pins down the post-2026-05-06 zero-allocation modulator pool. Pre-fix
 * `createModulator.setType` did `disconnect → dispose → new Tone.Chorus
 * (or Phaser/Tremolo) → reconnect → re-wet` on every type change,
 * producing audio-thread GC pressure when a user rocked the modulator
 * type knob. New shape pre-allocates all three modulators in parallel
 * and just walks `wet.value` (old → 0, new → currentWet) on type change.
 *
 * These tests verify:
 *   * Pool is created with all three modulator types up front.
 *   * setType(otherType) does NOT call dispose() on the old effect.
 *   * setType(otherType) does NOT instantiate a new Tone.* constructor.
 *   * setType swaps wet.value on outgoing → 0 + incoming → currentWet.
 *   * dispose() tears down EVERY pooled modulator, not just the active one.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock Tone.js — capture every constructor + dispose call so we can
// assert allocation behaviour. Each effect mock keeps a stable
// instance reference + a per-instance dispose spy.
const ChorusInstances = [];
const PhaserInstances = [];
const TremoloInstances = [];
const GainInstances = [];

function _makeEffectStub(label, list) {
  return vi.fn(() => {
    const inst = {
      _label: label,
      _id: list.length,
      connect: vi.fn().mockReturnThis(),
      disconnect: vi.fn(),
      dispose: vi.fn(),
      start: vi.fn().mockReturnThis(),
      stop: vi.fn(),
      wet: { value: 0 },
    };
    list.push(inst);
    return inst;
  });
}

vi.mock('tone', () => ({
  Chorus: _makeEffectStub('Chorus', ChorusInstances),
  Phaser: _makeEffectStub('Phaser', PhaserInstances),
  Tremolo: _makeEffectStub('Tremolo', TremoloInstances),
  Gain: vi.fn(() => {
    const inst = {
      _label: 'Gain',
      connect: vi.fn().mockReturnThis(),
      disconnect: vi.fn(),
      dispose: vi.fn(),
    };
    GainInstances.push(inst);
    return inst;
  }),
}));

const { createModulator, MODULATOR_TYPES } = await import('../../src/core/SynthFactory.js');


describe('Modulator pool', () => {
  beforeEach(() => {
    ChorusInstances.length = 0;
    PhaserInstances.length = 0;
    TremoloInstances.length = 0;
    GainInstances.length = 0;
  });

  it('pre-allocates all three modulator types at construction', () => {
    const m = createModulator(MODULATOR_TYPES.CHORUS, null);
    expect(ChorusInstances.length).toBe(1);
    expect(PhaserInstances.length).toBe(1);
    expect(TremoloInstances.length).toBe(1);
    m.dispose();
  });

  it('setType to another pool member does NOT dispose the old effect', () => {
    const m = createModulator(MODULATOR_TYPES.CHORUS, null);
    const chorus = ChorusInstances[0];
    const phaser = PhaserInstances[0];

    m.setType(MODULATOR_TYPES.PHASER);

    // Pre-fix dispose() would have been called once on the chorus.
    // Post-fix: pool member stays alive, just goes silent.
    expect(chorus.dispose).not.toHaveBeenCalled();
    expect(phaser.dispose).not.toHaveBeenCalled();
  });

  it('setType does NOT allocate a new Tone.Chorus / Phaser / Tremolo instance', () => {
    const m = createModulator(MODULATOR_TYPES.CHORUS, null);
    const initialChorusCount = ChorusInstances.length;
    const initialPhaserCount = PhaserInstances.length;
    const initialTremoloCount = TremoloInstances.length;

    // Cycle through every type AND back to the start — each step
    // would have allocated a new effect under the pre-fix code.
    m.setType(MODULATOR_TYPES.PHASER);
    m.setType(MODULATOR_TYPES.TREMOLO);
    m.setType(MODULATOR_TYPES.CHORUS);
    m.setType(MODULATOR_TYPES.PHASER);

    expect(ChorusInstances.length).toBe(initialChorusCount);
    expect(PhaserInstances.length).toBe(initialPhaserCount);
    expect(TremoloInstances.length).toBe(initialTremoloCount);
  });

  it('setType walks wet.value: outgoing → 0, incoming → currentWet', () => {
    const m = createModulator(MODULATOR_TYPES.CHORUS, null);
    m.setWet(0.65);   // sets currentWet, wet.value on chorus
    const chorus = ChorusInstances[0];
    const phaser = PhaserInstances[0];

    expect(chorus.wet.value).toBe(0.65);
    expect(phaser.wet.value).toBe(0);

    m.setType(MODULATOR_TYPES.PHASER);

    expect(chorus.wet.value).toBe(0);     // muted
    expect(phaser.wet.value).toBe(0.65);  // restored
  });

  it('setType to the SAME type is a no-op', () => {
    const m = createModulator(MODULATOR_TYPES.CHORUS, null);
    m.setWet(0.4);
    const chorus = ChorusInstances[0];
    const wetBefore = chorus.wet.value;

    m.setType(MODULATOR_TYPES.CHORUS);

    expect(chorus.wet.value).toBe(wetBefore);
  });

  it('setType to an unrecognised type is a no-op', () => {
    const m = createModulator(MODULATOR_TYPES.CHORUS, null);
    m.setWet(0.4);
    const chorus = ChorusInstances[0];

    m.setType(99);   // not a valid MODULATOR_TYPES value

    // Wet preserved on the previously-selected effect.
    expect(chorus.wet.value).toBe(0.4);
  });

  it('setWet clamps to 0..1', () => {
    const m = createModulator(MODULATOR_TYPES.CHORUS, null);
    const chorus = ChorusInstances[0];

    m.setWet(2.0);     // over
    expect(chorus.wet.value).toBe(1);

    m.setWet(-0.5);    // under
    expect(chorus.wet.value).toBe(0);
  });

  it('dispose tears down ALL pooled effects, not just the active one', () => {
    const m = createModulator(MODULATOR_TYPES.CHORUS, null);
    const chorus = ChorusInstances[0];
    const phaser = PhaserInstances[0];
    const tremolo = TremoloInstances[0];

    m.dispose();

    expect(chorus.dispose).toHaveBeenCalledTimes(1);
    expect(phaser.dispose).toHaveBeenCalledTimes(1);
    expect(tremolo.dispose).toHaveBeenCalledTimes(1);
  });

  it('input gain is connected to every pool member', () => {
    const m = createModulator(MODULATOR_TYPES.CHORUS, null);
    // m.input is the input Gain. The internals connected it to all
    // three pool effects. Hard to assert directly without exposing
    // internal state, so we just verify input.connect was called >= 3
    // times on construction (once per pool member).
    const inputGain = GainInstances[0];
    expect(inputGain.connect.mock.calls.length).toBeGreaterThanOrEqual(3);
  });
});
