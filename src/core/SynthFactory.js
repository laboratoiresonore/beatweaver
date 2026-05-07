import * as Tone from 'tone';

/**
 * SynthFactory - Professional instrument creation with effect chains
 *
 * Inspired by Switch Angel's Strudel techniques:
 * - Filter envelopes for movement (acidenv, lpenv, lpd, lps, lpr)
 * - Supersaw with unison/detune/spread for thick leads
 * - FM synthesis for complex timbres
 * - Per-instrument effect chains
 */

// Effect chain presets
export const EFFECT_CHAINS = {
  acid: {
    distortion: { distortion: 0.25, wet: 0.4 },
    filter: { frequency: 2000, Q: 2, type: 'lowpass' },
    compressor: { threshold: -18, ratio: 4, attack: 0.003, release: 0.1 }
  },
  lead: {
    chorus: { frequency: 4, delayTime: 2.5, depth: 0.5, wet: 0.4 },
    delay: { delayTime: '8n.', feedback: 0.25, wet: 0.2 },
    reverb: { decay: 1.2, wet: 0.2 }
  },
  pad: {
    chorus: { frequency: 1.2, delayTime: 4, depth: 0.8, wet: 0.6 },
    phaser: { frequency: 0.3, octaves: 3, baseFrequency: 800, wet: 0.3 },
    reverb: { decay: 4, wet: 0.5 }
  },
  percussion: {
    bitcrusher: { bits: 6, wet: 0.15 },
    compressor: { threshold: -15, ratio: 8, attack: 0.001, release: 0.04 }
  }
};

/**
 * Create a Supersaw - multiple detuned oscillators for thick sound
 * Based on Switch Angel's: osc("supersaw").unison(5).detune(0.2).spread(0.8)
 */
export function createSupersaw(masterGain, options = {}) {
  const {
    voices = 5,
    detune = 25,        // cents per voice
    spread = 0.7,       // stereo spread 0-1
    attack = 0.01,
    decay = 0.3,
    sustain = 0.7,
    release = 0.5,
    filterFreq = 4000,
    filterQ = 1.5,
    filterEnvOctaves = 2,
    volume = -12
  } = options;

  // Channel for volume control
  const channel = new Tone.Channel({ volume, pan: 0 }).connect(masterGain);

  // Reverb send for space
  const reverbSend = new Tone.Gain(0.25);

  // Low-pass filter with envelope
  const filter = new Tone.Filter({
    frequency: filterFreq,
    type: 'lowpass',
    Q: filterQ,
    rolloff: -12
  }).connect(channel);

  // Create multiple detuned voices spread across stereo field
  const synths = [];
  const panners = [];

  for (let i = 0; i < voices; i++) {
    const detuneAmount = (i - (voices - 1) / 2) * detune;
    const panPosition = voices > 1 ? ((i / (voices - 1)) - 0.5) * 2 * spread : 0;

    const panner = new Tone.Panner(panPosition).connect(filter);
    panners.push(panner);

    const synth = new Tone.Synth({
      oscillator: { type: 'sawtooth' },
      envelope: { attack, decay, sustain, release }
    }).connect(panner);

    synth.detune.value = detuneAmount;
    synths.push(synth);
  }

  // Filter envelope simulation via automation
  const originalTriggerAttackRelease = (note, duration, time) => {
    // Sweep filter on each note
    filter.frequency.setValueAtTime(filterFreq * 0.3, time);
    filter.frequency.exponentialRampToValueAtTime(filterFreq, time + attack + 0.05);
    filter.frequency.exponentialRampToValueAtTime(filterFreq * 0.5, time + attack + decay);

    synths.forEach(s => s.triggerAttackRelease(note, duration, time));
  };

  return {
    triggerAttackRelease: originalTriggerAttackRelease,
    releaseAll: (time) => synths.forEach(s => s.triggerRelease(time)),
    connect: (dest) => channel.connect(dest),
    dispose: () => {
      synths.forEach(s => s.dispose());
      panners.forEach(p => p.dispose());
      filter.dispose();
      channel.dispose();
      reverbSend.dispose();
    },
    _channel: channel,
    _filter: filter,
    _synths: synths,
    _reverbSend: reverbSend,
    type: 'supersaw'
  };
}

/**
 * Create Acid Bass - TB-303 style with aggressive filter envelope
 * Based on Switch Angel's acidenv function
 */
export function createAcidBass(masterGain, options = {}) {
  const {
    oscillatorType = 'sawtooth',
    filterDecay = 0.2,      // lpd - filter decay time
    resonance = 8,          // Q - higher = more squelchy
    octaves = 3.5,          // Filter envelope sweep range
    baseFrequency = 150,    // Base filter frequency
    drive = 0.2,            // Saturation amount
    volume = -12
  } = options;

  // Channel strip
  const channel = new Tone.Channel({ volume, pan: 0 }).connect(masterGain);

  // Fade gain for smooth starts/stops
  const fadeGain = new Tone.Gain(1).connect(channel);

  // Saturation for analog warmth (key to 303 sound)
  const saturator = new Tone.Distortion({
    distortion: drive,
    wet: 0.4
  }).connect(fadeGain);

  // Extra filter stage for more control
  const postFilter = new Tone.Filter({
    frequency: 1200,
    type: 'lowpass',
    rolloff: -12
  }).connect(saturator);

  // MonoSynth with aggressive filter envelope
  const synth = new Tone.MonoSynth({
    oscillator: { type: oscillatorType },
    filter: {
      Q: resonance,
      type: 'lowpass',
      rolloff: -24  // Steeper = more acid
    },
    envelope: {
      attack: 0.001,
      decay: 0.15,
      sustain: 0,       // Zero sustain = punchy
      release: 0.1
    },
    filterEnvelope: {
      attack: 0.001,
      decay: filterDecay,
      sustain: 0,
      release: 0.1,
      baseFrequency,
      octaves
    }
  }).connect(postFilter);

  // Attach nodes for cleanup
  synth._channel = channel;
  synth._fadeGain = fadeGain;
  synth._saturator = saturator;
  synth._postFilter = postFilter;
  synth.type = 'acid_bass';

  return synth;
}

/**
 * Create FM Bass - Complex metallic/growl timbres
 * Based on Switch Angel's fm(ratio).fmi(index)
 */
export function createFMBass(masterGain, options = {}) {
  const {
    harmonicity = 2,          // Carrier:Modulator ratio
    modulationIndex = 10,     // FM depth (higher = more harmonics)
    attack = 0.001,
    decay = 0.3,
    sustain = 0.2,
    release = 0.3,
    volume = -12
  } = options;

  // Channel strip
  const channel = new Tone.Channel({ volume, pan: 0 }).connect(masterGain);
  const fadeGain = new Tone.Gain(1).connect(channel);

  // Light distortion for edge
  const saturator = new Tone.Distortion({
    distortion: 0.1,
    wet: 0.2
  }).connect(fadeGain);

  const synth = new Tone.FMSynth({
    harmonicity,
    modulationIndex,
    oscillator: { type: 'sine' },
    modulation: { type: 'square' },
    envelope: { attack, decay, sustain, release },
    modulationEnvelope: {
      attack: 0.001,
      decay: decay * 0.8,
      sustain: 0,
      release: release * 0.5
    }
  }).connect(saturator);

  synth._channel = channel;
  synth._fadeGain = fadeGain;
  synth._saturator = saturator;
  synth.type = 'fm_bass';

  return synth;
}

/**
 * Create Pluck Synth - Sharp attack, fast decay
 */
export function createPluck(masterGain, options = {}) {
  const {
    resonance = 0.9,
    dampening = 4000,
    release = 0.5,
    volume = -14
  } = options;

  const channel = new Tone.Channel({ volume, pan: 0 }).connect(masterGain);
  const fadeGain = new Tone.Gain(1).connect(channel);

  // Delay send for sparkle
  const delaySend = new Tone.Gain(0.2);

  const synth = new Tone.PluckSynth({
    attackNoise: 2,
    dampening,
    resonance,
    release
  }).connect(fadeGain);

  synth._channel = channel;
  synth._fadeGain = fadeGain;
  synth._delaySend = delaySend;
  synth.type = 'pluck';

  return synth;
}

/**
 * Create Warm Pad - Lush sustained atmosphere with chorus
 */
export function createWarmPad(masterGain, options = {}) {
  const {
    voices = 7,
    detune = 15,
    attack = 0.8,
    decay = 0.5,
    sustain = 0.8,
    release = 2.5,
    chorusDepth = 0.7,
    reverbDecay = 4,
    volume = -18
  } = options;

  const channel = new Tone.Channel({ volume, pan: 0 }).connect(masterGain);
  const fadeGain = new Tone.Gain(1).connect(channel);

  // Heavy reverb for atmosphere
  const reverb = new Tone.Reverb({
    decay: reverbDecay,
    wet: 0.5
  }).connect(fadeGain);

  // Chorus for movement and width
  const chorus = new Tone.Chorus({
    frequency: 1.2,
    delayTime: 4,
    depth: chorusDepth,
    wet: 0.5
  }).connect(reverb);
  chorus.start();

  // Low-pass to keep it soft
  const filter = new Tone.Filter({
    frequency: 3500,
    type: 'lowpass',
    rolloff: -12
  }).connect(chorus);

  // Supersaw-style pad with multiple detuned voices
  const synths = [];
  const panners = [];

  for (let i = 0; i < voices; i++) {
    const detuneAmount = (i - (voices - 1) / 2) * detune;
    const panPosition = voices > 1 ? ((i / (voices - 1)) - 0.5) * 1.4 : 0;

    const panner = new Tone.Panner(Math.max(-1, Math.min(1, panPosition))).connect(filter);
    panners.push(panner);

    const synth = new Tone.Synth({
      oscillator: { type: i % 2 === 0 ? 'sine' : 'triangle' },
      envelope: { attack, decay, sustain, release }
    }).connect(panner);

    synth.detune.value = detuneAmount;
    synths.push(synth);
  }

  const padInstrument = {
    triggerAttackRelease: (notes, duration, time) => {
      const noteArray = Array.isArray(notes) ? notes : [notes];
      // Each voice plays a different note from the chord
      synths.forEach((s, i) => {
        const note = noteArray[i % noteArray.length];
        s.triggerAttackRelease(note, duration, time);
      });
    },
    releaseAll: (time) => synths.forEach(s => s.triggerRelease(time)),
    dispose: () => {
      synths.forEach(s => s.dispose());
      panners.forEach(p => p.dispose());
      filter.dispose();
      chorus.dispose();
      reverb.dispose();
      fadeGain.dispose();
      channel.dispose();
    },
    _channel: channel,
    _fadeGain: fadeGain,
    _chorus: chorus,
    _reverb: reverb,
    _filter: filter,
    type: 'warm_pad'
  };

  return padInstrument;
}

/**
 * Create Kick Synth - Punchy electronic kick drum
 */
export function createKickSynth(masterGain, options = {}) {
  const {
    pitchDecay = 0.05,
    octaves = 6,
    frequency = 55,
    volume = -10
  } = options;

  const channel = new Tone.Channel({ volume, pan: 0 }).connect(masterGain);
  const fadeGain = new Tone.Gain(1).connect(channel);

  const synth = new Tone.MembraneSynth({
    pitchDecay,
    octaves,
    oscillator: { type: 'sine' },
    envelope: {
      attack: 0.001,
      decay: 0.4,
      sustain: 0,
      release: 0.1
    }
  }).connect(fadeGain);

  synth._channel = channel;
  synth._fadeGain = fadeGain;
  synth.type = 'kick';

  return synth;
}

/**
 * Create Perc Synth - Punchy rhythmic percussion
 * Louder and punchier than basic synth, great for driving rhythms
 */
export function createPercSynth(masterGain, options = {}) {
  const {
    volume = 0,           // 0dB base - LOUD
    attack = 0.001,
    decay = 0.08,
    sustain = 0,
    release = 0.1,
    frequency = 800,      // Higher frequency for click/snap
    filterFreq = 4000
  } = options;

  const channel = new Tone.Channel({ volume, pan: 0 }).connect(masterGain);
  const fadeGain = new Tone.Gain(1).connect(channel);

  // Compressor for punch
  const compressor = new Tone.Compressor({
    threshold: -20,
    ratio: 4,
    attack: 0.003,
    release: 0.1
  }).connect(fadeGain);

  // Subtle saturation for grit
  const distortion = new Tone.Distortion({
    distortion: 0.15,
    wet: 0.3
  }).connect(compressor);

  // Filter for tone shaping
  const filter = new Tone.Filter({
    frequency: filterFreq,
    type: 'lowpass',
    Q: 2
  }).connect(distortion);

  // Noise synth for percussive attack
  const noiseSynth = new Tone.NoiseSynth({
    noise: { type: 'white' },
    envelope: {
      attack: attack,
      decay: decay * 0.5,
      sustain: 0,
      release: release * 0.5
    }
  }).connect(filter);

  // Tonal click
  const tonalSynth = new Tone.Synth({
    oscillator: { type: 'triangle' },
    envelope: {
      attack: attack,
      decay: decay,
      sustain: sustain,
      release: release
    }
  }).connect(filter);

  // Combined trigger
  const combinedSynth = {
    triggerAttackRelease: (note, duration, time) => {
      noiseSynth.triggerAttackRelease(duration, time);
      tonalSynth.triggerAttackRelease(note, duration, time);
    },
    triggerAttack: (note, time) => {
      noiseSynth.triggerAttack(time);
      tonalSynth.triggerAttack(note, time);
    },
    triggerRelease: (time) => {
      noiseSynth.triggerRelease(time);
      tonalSynth.triggerRelease(time);
    },
    dispose: () => {
      noiseSynth.dispose();
      tonalSynth.dispose();
      filter.dispose();
      distortion.dispose();
      compressor.dispose();
      fadeGain.dispose();
      channel.dispose();
    },
    _channel: channel,
    _fadeGain: fadeGain,
    type: 'perc'
  };

  return combinedSynth;
}

/**
 * Main factory function - create instrument by type
 */
export class SynthFactory {
  static createInstrument(type, masterGain, options = {}) {
    switch (type) {
      case 'acid_bass':
        return createAcidBass(masterGain, options);

      case 'supersaw':
      case 'supersaw_lead':
        return createSupersaw(masterGain, options);

      case 'fm_bass':
        return createFMBass(masterGain, options);

      case 'pluck':
        return createPluck(masterGain, options);

      case 'warm_pad':
      case 'pad':
        return createWarmPad(masterGain, options);

      case 'kick':
        return createKickSynth(masterGain, options);

      case 'perc':
        return createPercSynth(masterGain, options);

      default:
        // Fallback to basic synth
        return this._createBasicSynth(masterGain, options);
    }
  }

  static _createBasicSynth(masterGain, options = {}) {
    const {
      oscillator = 'sawtooth',
      attack = 0.01,
      decay = 0.2,
      sustain = 0.5,
      release = 0.3,
      volume = -12
    } = options;

    const channel = new Tone.Channel({ volume, pan: 0 }).connect(masterGain);
    const fadeGain = new Tone.Gain(1).connect(channel);

    const synth = new Tone.Synth({
      oscillator: { type: oscillator },
      envelope: { attack, decay, sustain, release }
    }).connect(fadeGain);

    synth._channel = channel;
    synth._fadeGain = fadeGain;
    synth.type = 'basic';

    return synth;
  }

  /**
   * Get available instrument types
   */
  static getAvailableTypes() {
    return [
      'acid_bass',
      'supersaw',
      'supersaw_lead',
      'fm_bass',
      'pluck',
      'warm_pad',
      'pad',
      'kick',
      'perc',
      'basic'
    ];
  }
}

// ============ MODULATOR SYSTEM ============
// Three modulator types selectable per column via Row A knobs 5-8

export const MODULATOR_TYPES = {
  CHORUS: 0,    // Left position
  PHASER: 1,    // Middle position
  TREMOLO: 2    // Right position
};

/**
 * Create effect of a specific type (internal helper)
 */
function _createEffectOfType(type) {
  let effect;

  switch (type) {
    case MODULATOR_TYPES.CHORUS:
      effect = new Tone.Chorus({
        frequency: 2,
        delayTime: 3.5,
        depth: 0.7,
        wet: 0
      });
      effect.start();
      break;

    case MODULATOR_TYPES.PHASER:
      effect = new Tone.Phaser({
        frequency: 0.5,
        octaves: 3,
        baseFrequency: 1000,
        wet: 0
      });
      break;

    case MODULATOR_TYPES.TREMOLO:
      effect = new Tone.Tremolo({
        frequency: 4,
        depth: 0.8,
        wet: 0
      });
      effect.start();
      break;

    default:
      // No effect - just a gain pass-through
      effect = new Tone.Gain(1);
      break;
  }

  return effect;
}

/**
 * Create a modulator with a persistent input node + a *pre-allocated*
 * effect pool. Instruments connect to the INPUT, which stays stable
 * across type changes. When ``setType`` is called, we swap which
 * pooled effect is wet; the others stay in the graph at wet=0
 * (silent), so type-flips no longer trigger
 * dispose-create-reconnect-rewet — they're just two ``.wet.value``
 * ramps. Pre-fix the dispose/recreate dance produced visible GC
 * pressure (small audio-thread stalls) when a user rocked a
 * modulator-type knob across positions, and at worst could drop a
 * sample frame mid-beat.
 *
 * @param {number} type - MODULATOR_TYPES value (0-2)
 * @param {Tone.Destination|Tone.Node} destination - Where to connect output
 * @returns {Object} - { input, effect, setType, setWet, dispose }
 */
export function createModulator(type, destination) {
  // Input gain that instruments connect to - stays constant.
  const input = new Tone.Gain(1);

  // Pre-allocate every modulator type up front so subsequent type
  // swaps are zero-allocation. Each starts at wet=0 so they're
  // silent when not selected. ``Gain(1)`` is the "no modulator"
  // pass-through fallback used for unrecognised types.
  const pool = {
    [MODULATOR_TYPES.CHORUS]:  _createEffectOfType(MODULATOR_TYPES.CHORUS),
    [MODULATOR_TYPES.PHASER]:  _createEffectOfType(MODULATOR_TYPES.PHASER),
    [MODULATOR_TYPES.TREMOLO]: _createEffectOfType(MODULATOR_TYPES.TREMOLO),
  };

  // Wire all three pool members in parallel: input → eachEffect → destination.
  // Only the currently-selected effect has wet > 0; the rest stay silent.
  for (const e of Object.values(pool)) {
    input.connect(e);
    if (destination) {
      e.connect(destination);
    }
  }

  let currentType = type;
  let currentWet = 0;
  let effect = pool[currentType] ?? pool[MODULATOR_TYPES.CHORUS];

  return {
    // Instruments connect to INPUT (stable across effect changes)
    input,
    // Current effect (may change when type changes)
    get effect() { return effect; },
    type: currentType,
    destination,

    /**
     * Change the effect type without breaking input connections.
     * Zero allocations: just swaps the pointer + walks ``wet``
     * values (old → 0, new → currentWet) so the change is glitch-free.
     * @param {number} newType - MODULATOR_TYPES value
     */
    setType: (newType) => {
      if (newType === currentType) return;
      const next = pool[newType];
      if (!next) return;
      // Mute the outgoing effect (no allocations).
      if (effect.wet !== undefined) {
        effect.wet.value = 0;
      }
      effect = next;
      currentType = newType;
      // Restore the user's wet level on the new effect.
      if (effect.wet !== undefined) {
        effect.wet.value = currentWet;
      }
    },

    setWet: (value) => {
      // Clamp 0-1
      currentWet = Math.max(0, Math.min(1, value));
      if (effect.wet !== undefined) {
        effect.wet.value = currentWet;
      }
    },

    dispose: () => {
      input.disconnect();
      input.dispose();
      // Tear down every pooled effect, not just the active one.
      for (const e of Object.values(pool)) {
        if (e.stop) e.stop();
        e.dispose();
      }
    }
  };
}

/**
 * Convert knob position (0-1) to modulator type
 * Left third = Chorus, Middle third = Phaser, Right third = Tremolo
 */
export function knobToModulatorType(value) {
  if (value < 0.33) return MODULATOR_TYPES.CHORUS;
  if (value < 0.67) return MODULATOR_TYPES.PHASER;
  return MODULATOR_TYPES.TREMOLO;
}

/**
 * Get modulator name for announcements
 */
export function getModulatorName(type) {
  switch (type) {
    case MODULATOR_TYPES.CHORUS: return 'Chorus';
    case MODULATOR_TYPES.PHASER: return 'Phaser';
    case MODULATOR_TYPES.TREMOLO: return 'Tremolo';
    default: return 'None';
  }
}

export default SynthFactory;
