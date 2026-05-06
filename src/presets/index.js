/**
 * Beatweaver Preset Library
 * All patterns defined in C, transposed at runtime to match detected key
 *
 * 16 Presets across 4 categories:
 * - BASS (4): Heavy low-end patterns
 * - ENERGY (4): Build-ups and drops
 * - TEXTURE (4): Atmospheric and rhythmic
 * - FX (4): Special effects and transitions
 */

// ============ PATTERN DEFINITIONS ============
// All in key of C, will be transposed automatically

export const PATTERNS = {
  // Bass patterns
  KICK_FOLLOW: {
    notes: ['C2', null, null, null, 'C2', null, null, null],
    duration: '8n',
    interval: '8n'
  },
  ACID_WOBBLE: {
    notes: ['C2', 'C2', 'D2', 'C2', 'E2', 'C2', 'D2', 'C2'],
    duration: '16n',
    interval: '8n'
  },
  SUB_PULSE: {
    notes: ['C1', null, null, null, 'C1', null, 'G1', null],
    duration: '4n',
    interval: '8n'
  },
  BASS_STAB: {
    notes: [['C2', 'G2'], null, null, ['C2', 'G2'], null, null, ['D2', 'A2'], null],
    duration: '16n',
    interval: '8n'
  },

  // Energy patterns
  OFFBEAT_STAB: {
    notes: [null, ['C4', 'E4', 'G4'], null, ['C4', 'E4', 'G4'], null, ['C4', 'E4', 'G4'], null, ['C4', 'E4', 'G4']],
    duration: '8n',
    interval: '8n'
  },
  RISING_ARP: {
    notes: ['C3', 'E3', 'G3', 'C4', 'E4', 'G4', 'C5', 'E5'],
    duration: '16n',
    interval: '16n'
  },
  BUILD_UP: {
    notes: ['C4', 'C4', 'C4', 'C4', 'C4', 'C4', 'C4', 'C4', 'C4', 'C4', 'C4', 'C4', 'C4', 'C4', 'C4', 'C4'],
    duration: '32n',
    interval: '16n'
  },
  DROP_IMPACT: {
    notes: [['C2', 'C3', 'G3'], null, null, null, null, null, null, null],
    duration: '2n',
    interval: '8n'
  },

  // Texture patterns
  HELD_PAD: {
    notes: [['C3', 'E3', 'G3', 'B3']],
    duration: '2m',
    interval: '2m'
  },
  SHIMMER: {
    notes: ['G5', 'E5', 'C5', 'G4', 'E5', 'C5', 'G4', 'E4'],
    duration: '32n',
    interval: '16n'
  },
  DARK_PAD: {
    notes: [['C2', 'Eb3', 'G3', 'Bb3']],
    duration: '2m',
    interval: '2m'
  },
  PERC_16TH: {
    notes: ['x', 'x', 'x', 'x', 'x', 'x', 'x', 'x', 'x', 'x', 'x', 'x', 'x', 'x', 'x', 'x'],
    duration: '32n',
    interval: '16n'
  },

  // FX patterns
  QUARTER_STABS: {
    notes: [['C4', 'E4', 'G4'], null, null, null, ['C4', 'E4', 'G4'], null, null, null],
    duration: '8n',
    interval: '8n'
  },
  FILTER_SWEEP: {
    notes: ['C3', 'D3', 'E3', 'F3', 'G3', 'A3', 'B3', 'C4'],
    duration: '8n',
    interval: '8n'
  },
  TENSION: {
    notes: [['C3', 'F#3', 'B3'], null, ['C3', 'F#3', 'B3'], null, ['Db3', 'G3', 'C4'], null, ['Db3', 'G3', 'C4'], null],
    duration: '4n',
    interval: '8n'
  },
  RELEASE: {
    notes: [['C3', 'E3', 'G3', 'C4']],
    duration: '1m',
    interval: '1m'
  },

  // Bank B patterns
  DEEP_SUB: {
    notes: ['C1', null, null, null, null, null, null, null],
    duration: '1m',
    interval: '8n'
  },
  GROWL: {
    notes: ['C2', 'C2', 'Eb2', 'C2', 'C2', 'Eb2', 'F2', 'Eb2'],
    duration: '16n',
    interval: '8n'
  },
  REESE: {
    notes: [['C2', 'C#2'], null, ['C2', 'C#2'], null, ['D2', 'Eb2'], null, ['C2', 'C#2'], null],
    duration: '8n',
    interval: '8n'
  },
  PLUCK: {
    notes: ['C3', null, 'G2', null, 'C3', null, 'Eb3', null],
    duration: '32n',
    interval: '8n'
  },
  SIREN: {
    notes: ['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5', 'B4', 'A4', 'G4', 'F4', 'E4', 'D4', 'C4', 'C4'],
    duration: '16n',
    interval: '16n'
  },
  RISER: {
    notes: ['C3', 'C3', 'D3', 'D3', 'E3', 'E3', 'F3', 'F3', 'G3', 'G3', 'A3', 'A3', 'B3', 'B3', 'C4', 'C4'],
    duration: '16n',
    interval: '16n'
  },
  SNARE_ROLL: {
    notes: ['x', null, 'x', null, 'x', 'x', 'x', 'x', 'x', 'x', 'x', 'x', 'x', 'x', 'x', 'x'],
    duration: '32n',
    interval: '16n'
  },
  NOISE_BURST: {
    notes: ['x', null, null, null, null, null, null, null],
    duration: '4n',
    interval: '8n'
  },
  CHOIR: {
    notes: [['C3', 'E3', 'G3'], null, null, null, ['D3', 'F3', 'A3'], null, null, null],
    duration: '2n',
    interval: '8n'
  },
  STRINGS: {
    notes: [['C3', 'G3', 'C4', 'E4']],
    duration: '2m',
    interval: '2m'
  },
  BELL: {
    notes: ['C5', null, 'G4', null, 'E5', null, 'C5', null],
    duration: '4n',
    interval: '8n'
  },
  WIND: {
    notes: ['x', 'x', 'x', 'x', 'x', 'x', 'x', 'x'],
    duration: '8n',
    interval: '8n'
  },
  LASER: {
    notes: ['C6', 'G5', 'C5', 'G4', 'C4', 'G3', 'C3', 'G2'],
    duration: '32n',
    interval: '16n'
  },
  WHOOSH: {
    notes: ['C2', 'E2', 'G2', 'C3', 'E3', 'G3', 'C4', 'E4'],
    duration: '16n',
    interval: '16n'
  },
  REVERSE_ENV: {
    notes: [null, null, null, null, null, null, ['C3', 'E3', 'G3'], ['C3', 'E3', 'G3']],
    duration: '4n',
    interval: '8n'
  },
  GLITCH: {
    notes: ['C4', null, 'x', 'E4', null, 'x', 'G4', 'x'],
    duration: '32n',
    interval: '16n'
  }
};

// ============ PRESET DEFINITIONS ============

export const PRESETS = {
  // === BASS (4) - Upgraded with SynthFactory ===
  PUMP_IT_UP: {
    id: 'PUMP_IT_UP',
    name: 'Pump It Up',
    category: 'BASS',
    bank: 'A',
    instrument: 'acidBass',
    instrumentType: 'acid_bass',  // SynthFactory type
    synthOptions: {
      oscillatorType: 'sawtooth',
      filterDecay: 0.2,
      resonance: 8,
      octaves: 3.5,
      baseFrequency: 150,
      drive: 0.25,
      volume: -10
    },
    pattern: 'KICK_FOLLOW',
    controls: {
      POWER: { param: 'volume', default: 0.7, min: 0, max: 1 },
      DARKNESS: { param: 'filterFreq', default: 0.5, min: 0, max: 1 },
      SQUELCH: { param: 'filterQ', default: 0.3, min: 0, max: 1 }
    },
    color: '#10B176', // green
    announcement: 'Dropping the bass',
    col: 0, row: 0,
    cue: 'To pump up the floor, we cue Pump It.',
    fire: 'Pump It — go.'
  },

  ACID_WOBBLE: {
    id: 'ACID_WOBBLE',
    name: 'Acid Wobble',
    category: 'BASS',
    bank: 'A',
    instrument: 'acidBass',
    instrumentType: 'acid_bass',  // SynthFactory type
    synthOptions: {
      oscillatorType: 'sawtooth',
      filterDecay: 0.15,   // Faster = more squelch
      resonance: 12,       // Higher Q = more acid
      octaves: 4,          // Wider sweep
      baseFrequency: 120,
      drive: 0.35,         // More saturation
      volume: -10
    },
    pattern: 'ACID_WOBBLE',
    controls: {
      POWER: { param: 'volume', default: 0.7, min: 0, max: 1 },
      DARKNESS: { param: 'filterFreq', default: 0.6, min: 0, max: 1 },
      SQUELCH: { param: 'filterQ', default: 0.7, min: 0, max: 1 }
    },
    color: '#10B176',
    announcement: 'Acid wobble engaged',
    col: 0, row: 1,
    cue: 'To get that wobble going, we cue Acid.',
    fire: 'Acid — wobbling now.'
  },

  SUB_PULSE: {
    id: 'SUB_PULSE',
    name: 'Sub Pulse',
    category: 'BASS',
    bank: 'A',
    instrument: 'acidBass',
    instrumentType: 'acid_bass',  // SynthFactory type
    synthOptions: {
      oscillatorType: 'sine',     // Pure sine for sub
      filterDecay: 0.4,
      resonance: 2,               // Low Q for clean sub
      octaves: 1.5,
      baseFrequency: 80,
      drive: 0.05,                // Very subtle saturation
      volume: -8
    },
    pattern: 'SUB_PULSE',
    controls: {
      POWER: { param: 'volume', default: 0.8, min: 0, max: 1 },
      DARKNESS: { param: 'filterFreq', default: 0.2, min: 0, max: 1 }
    },
    color: '#10B176',
    announcement: 'Sub bass pulse',
    col: 0, row: 2,
    cue: 'For a steady low pulse, we cue Sub Pulse.',
    fire: 'Sub Pulse — locked in.'
  },

  BASS_STAB: {
    id: 'BASS_STAB',
    name: 'Bass Stab',
    category: 'BASS',
    bank: 'A',
    instrument: 'acidBass',
    instrumentType: 'fm_bass',  // FM for punchy stabs
    synthOptions: {
      harmonicity: 2,
      modulationIndex: 8,
      attack: 0.001,
      decay: 0.15,
      sustain: 0.1,
      release: 0.2,
      volume: -10
    },
    pattern: 'BASS_STAB',
    controls: {
      POWER: { param: 'volume', default: 0.6, min: 0, max: 1 },
      DARKNESS: { param: 'filterFreq', default: 0.7, min: 0, max: 1 }
    },
    color: '#10B176',
    announcement: 'Bass stab',
    col: 0, row: 3,
    cue: 'To punch the bottom, we cue Bass Stab.',
    fire: 'Stab — hit.'
  },

  // === ENERGY (4) - Upgraded with SynthFactory ===
  TRANCE_GATE: {
    id: 'TRANCE_GATE',
    name: 'Trance Gate',
    category: 'ENERGY',
    bank: 'A',
    instrument: 'stab',
    instrumentType: 'supersaw',  // Thick supersaw stabs
    synthOptions: {
      voices: 5,
      detune: 20,
      spread: 0.6,
      attack: 0.002,
      decay: 0.15,
      sustain: 0.1,
      release: 0.25,
      filterFreq: 5000,
      filterQ: 1.5,
      filterEnvOctaves: 2,
      volume: -12
    },
    pattern: 'OFFBEAT_STAB',
    controls: {
      POWER: { param: 'volume', default: 0.6, min: 0, max: 1 },
      ATTACK: { param: 'attack', default: 0.1, min: 0, max: 0.5 }
    },
    color: '#E0641B', // yellow
    announcement: 'Trance gate activated',
    col: 1, row: 0,
    cue: 'To lift the energy, we cue Trance Gate.',
    fire: 'Trance Gate — open.'
  },

  RISING_ENERGY: {
    id: 'RISING_ENERGY',
    name: 'Rising Energy',
    category: 'ENERGY',
    bank: 'A',
    instrument: 'arp',
    instrumentType: 'supersaw',  // Thick rising arp
    synthOptions: {
      voices: 3,
      detune: 15,
      spread: 0.5,
      attack: 0.002,
      decay: 0.12,
      sustain: 0.0,
      release: 0.15,
      filterFreq: 6000,
      filterQ: 2,
      filterEnvOctaves: 3,
      volume: -14
    },
    pattern: 'RISING_ARP',
    controls: {
      POWER: { param: 'volume', default: 0.5, min: 0, max: 1 },
      BRIGHTNESS: { param: 'filterFreq', default: 0.7, min: 0, max: 1 }
    },
    color: '#E0641B',
    announcement: 'Building energy',
    col: 1, row: 1,
    cue: 'To start building, we cue Rising.',
    fire: 'Rising — climbing.'
  },

  BUILD_UP: {
    id: 'BUILD_UP',
    name: 'Build Up',
    category: 'ENERGY',
    bank: 'A',
    instrument: 'perc',
    pattern: 'BUILD_UP',
    controls: {
      POWER: { param: 'volume', default: 0.4, min: 0, max: 1 },
      INTENSITY: { param: 'decay', default: 0.5, min: 0, max: 1 }
    },
    color: '#E0641B',
    announcement: 'Building up',
    col: 1, row: 2,
    cue: 'To set up the drop, we cue Build Up.',
    fire: 'Build Up — go.'
  },

  DROP_IMPACT: {
    id: 'DROP_IMPACT',
    name: 'Drop Impact',
    category: 'ENERGY',
    bank: 'A',
    instrument: 'stab',
    instrumentType: 'supersaw',  // Massive drop impact
    synthOptions: {
      voices: 7,
      detune: 30,
      spread: 0.9,
      attack: 0.001,
      decay: 0.8,
      sustain: 0.3,
      release: 1.5,
      filterFreq: 3000,
      filterQ: 1,
      filterEnvOctaves: 1.5,
      volume: -8
    },
    pattern: 'DROP_IMPACT',
    controls: {
      POWER: { param: 'volume', default: 0.8, min: 0, max: 1 }
    },
    color: '#E0641B',
    announcement: 'Drop it',
    col: 1, row: 3,
    cue: 'To break the build, we cue the Drop.',
    fire: 'Drop — now!'
  },

  // === TEXTURE (4) - Upgraded with SynthFactory ===
  DREAM_CLOUD: {
    id: 'DREAM_CLOUD',
    name: 'Dream Cloud',
    category: 'TEXTURE',
    bank: 'A',
    instrument: 'pad',
    instrumentType: 'warm_pad',  // Lush multi-voice pad
    synthOptions: {
      voices: 7,
      detune: 12,
      attack: 1.0,
      decay: 0.6,
      sustain: 0.8,
      release: 3.0,
      chorusDepth: 0.8,
      reverbDecay: 5,
      volume: -16
    },
    pattern: 'HELD_PAD',
    controls: {
      POWER: { param: 'volume', default: 0.4, min: 0, max: 1 },
      WARMTH: { param: 'filterFreq', default: 0.5, min: 0, max: 1 }
    },
    color: '#B432FF', // purple
    announcement: 'Dream cloud floating',
    col: 2, row: 0,
    cue: 'For more atmosphere, we cue Dream Cloud.',
    fire: 'Dream Cloud — drifting.'
  },

  SHIMMER: {
    id: 'SHIMMER',
    name: 'Shimmer',
    category: 'TEXTURE',
    bank: 'A',
    instrument: 'arp',
    instrumentType: 'pluck',  // Sparkly pluck sound
    synthOptions: {
      resonance: 0.95,
      dampening: 6000,
      release: 0.8,
      volume: -14
    },
    pattern: 'SHIMMER',
    controls: {
      POWER: { param: 'volume', default: 0.3, min: 0, max: 1 },
      SPARKLE: { param: 'filterFreq', default: 0.8, min: 0, max: 1 }
    },
    color: '#B432FF',
    announcement: 'Shimmer effect',
    col: 2, row: 1,
    cue: 'For a brighter top, we cue Shimmer.',
    fire: 'Shimmer — glowing.'
  },

  DARK_FOG: {
    id: 'DARK_FOG',
    name: 'Dark Fog',
    category: 'TEXTURE',
    bank: 'A',
    instrument: 'pad',
    instrumentType: 'warm_pad',  // Dark atmospheric pad
    synthOptions: {
      voices: 5,
      detune: 20,
      attack: 1.5,
      decay: 0.8,
      sustain: 0.7,
      release: 4.0,
      chorusDepth: 0.5,
      reverbDecay: 6,
      volume: -18
    },
    pattern: 'DARK_PAD',
    controls: {
      POWER: { param: 'volume', default: 0.5, min: 0, max: 1 },
      DEPTH: { param: 'filterFreq', default: 0.3, min: 0, max: 1 }
    },
    color: '#B432FF',
    announcement: 'Dark fog rolling in',
    col: 2, row: 2,
    cue: 'To darken the room, we cue Dark Fog.',
    fire: 'Dark Fog — settling.'
  },

  RHYTHM_PULSE: {
    id: 'RHYTHM_PULSE',
    name: 'Rhythm Pulse',
    category: 'TEXTURE',
    bank: 'A',
    instrument: 'perc',
    instrumentType: 'perc',
    synthOptions: {
      volume: 0,          // 0dB base - much louder than default -14dB
      attack: 0.001,
      decay: 0.08,
      sustain: 0,
      release: 0.1
    },
    pattern: 'PERC_16TH',
    controls: {
      POWER: { param: 'volume', default: 0.7, min: 0, max: 1 },
      GRIT: { param: 'filterFreq', default: 0.5, min: 0, max: 1 }
    },
    color: '#B432FF',
    announcement: 'Rhythm pulse',
    col: 2, row: 3,
    cue: 'To add motion, we cue Pulse.',
    fire: 'Pulse — beating.'
  },

  // === FX (4) ===
  STAB_ATTACK: {
    id: 'STAB_ATTACK',
    name: 'Stab Attack',
    category: 'FX',
    bank: 'A',
    instrument: 'stab',
    pattern: 'QUARTER_STABS',
    controls: {
      POWER: { param: 'volume', default: 0.6, min: 0, max: 1 },
      PUNCH: { param: 'attack', default: 0.1, min: 0, max: 0.3 }
    },
    color: '#FF127B', // orange
    announcement: 'Stab attack',
    col: 3, row: 0,
    cue: 'For a quick accent, we cue Stab Hit.',
    fire: 'Stab Hit — bang.'
  },

  FILTER_SWEEP: {
    id: 'FILTER_SWEEP',
    name: 'Filter Sweep',
    category: 'FX',
    bank: 'A',
    instrument: 'lead',
    pattern: 'FILTER_SWEEP',
    controls: {
      POWER: { param: 'volume', default: 0.5, min: 0, max: 1 },
      SWEEP: { param: 'filterFreq', default: 0.5, min: 0, max: 1 }
    },
    color: '#FF127B',
    announcement: 'Filter sweep',
    col: 3, row: 1,
    cue: 'To carve a sweep, we cue Filter Sweep.',
    fire: 'Filter Sweep — opening.'
  },

  TENSION: {
    id: 'TENSION',
    name: 'Tension',
    category: 'FX',
    bank: 'A',
    instrument: 'stab',
    pattern: 'TENSION',
    controls: {
      POWER: { param: 'volume', default: 0.5, min: 0, max: 1 }
    },
    color: '#FF127B',
    announcement: 'Building tension',
    col: 3, row: 2,
    cue: 'To pull the room tight, we cue Tension.',
    fire: 'Tension — holding.'
  },

  RELEASE: {
    id: 'RELEASE',
    name: 'Release',
    category: 'FX',
    bank: 'A',
    instrument: 'pad',
    pattern: 'RELEASE',
    controls: {
      POWER: { param: 'volume', default: 0.6, min: 0, max: 1 }
    },
    color: '#FF127B',
    announcement: 'Release',
    col: 3, row: 3,
    cue: 'To let go, we cue Release.',
    fire: 'Release — exhale.'
  },

  // ========== BANK B PRESETS ==========

  // === BASS B (4) ===
  DEEP_SUB: {
    id: 'DEEP_SUB',
    name: 'Deep Sub',
    category: 'BASS',
    bank: 'B',
    instrument: 'acidBass',
    pattern: 'DEEP_SUB',
    controls: {
      POWER: { param: 'volume', default: 0.8, min: 0, max: 1 },
      DEPTH: { param: 'filterFreq', default: 0.1, min: 0, max: 1 }
    },
    color: '#10B176',
    announcement: 'Deep sub engaged',
    col: 0, row: 0,
    cue: 'For more weight, we cue Deep Sub.',
    fire: 'Deep Sub, engaged.'
  },

  GROWL_BASS: {
    id: 'GROWL_BASS',
    name: 'Growl',
    category: 'BASS',
    bank: 'B',
    instrument: 'acidBass',
    pattern: 'GROWL',
    controls: {
      POWER: { param: 'volume', default: 0.7, min: 0, max: 1 },
      AGGRESSION: { param: 'filterQ', default: 0.8, min: 0, max: 1 }
    },
    color: '#10B176',
    announcement: 'Growl bass',
    col: 0, row: 1,
    cue: 'To add more bite, we cue Growl.',
    fire: 'Growl — unleashed.'
  },

  REESE_BASS: {
    id: 'REESE_BASS',
    name: 'Reese',
    category: 'BASS',
    bank: 'B',
    instrument: 'acidBass',
    pattern: 'REESE',
    controls: {
      POWER: { param: 'volume', default: 0.7, min: 0, max: 1 },
      DETUNE: { param: 'filterFreq', default: 0.5, min: 0, max: 1 }
    },
    color: '#10B176',
    announcement: 'Reese bass rolling',
    col: 0, row: 2,
    cue: 'To thicken the low end, we cue Reese.',
    fire: 'Reese — rolling.'
  },

  PLUCK_BASS: {
    id: 'PLUCK_BASS',
    name: 'Pluck Bass',
    category: 'BASS',
    bank: 'B',
    instrument: 'acidBass',
    pattern: 'PLUCK',
    controls: {
      POWER: { param: 'volume', default: 0.6, min: 0, max: 1 },
      SNAP: { param: 'attack', default: 0.05, min: 0, max: 0.2 }
    },
    color: '#10B176',
    announcement: 'Pluck bass',
    col: 0, row: 3,
    cue: 'For a tighter bass, we cue Pluck.',
    fire: 'Pluck — bouncing.'
  },

  // === ENERGY B (4) ===
  SIREN: {
    id: 'SIREN',
    name: 'Siren',
    category: 'ENERGY',
    bank: 'B',
    instrument: 'lead',
    pattern: 'SIREN',
    controls: {
      POWER: { param: 'volume', default: 0.5, min: 0, max: 1 },
      SPEED: { param: 'filterFreq', default: 0.7, min: 0, max: 1 }
    },
    color: '#E0641B',
    announcement: 'Siren activated',
    col: 1, row: 0,
    cue: 'To call the floor, we cue the Siren.',
    fire: 'Siren — wailing.'
  },

  RISER: {
    id: 'RISER',
    name: 'Riser',
    category: 'ENERGY',
    bank: 'B',
    instrument: 'arp',
    pattern: 'RISER',
    controls: {
      POWER: { param: 'volume', default: 0.5, min: 0, max: 1 },
      TENSION: { param: 'filterFreq', default: 0.6, min: 0, max: 1 }
    },
    color: '#E0641B',
    announcement: 'Rising tension',
    col: 1, row: 1,
    cue: 'For more tension, we cue Riser.',
    fire: 'Riser — peaking.'
  },

  SNARE_ROLL: {
    id: 'SNARE_ROLL',
    name: 'Snare Roll',
    category: 'ENERGY',
    bank: 'B',
    instrument: 'perc',
    pattern: 'SNARE_ROLL',
    controls: {
      POWER: { param: 'volume', default: 0.5, min: 0, max: 1 },
      TIGHTNESS: { param: 'decay', default: 0.3, min: 0, max: 1 }
    },
    color: '#E0641B',
    announcement: 'Snare roll',
    col: 1, row: 2,
    cue: 'To prime the impact, we cue Snare Roll.',
    fire: 'Snare Roll — rolling.'
  },

  WHITE_NOISE: {
    id: 'WHITE_NOISE',
    name: 'White Noise',
    category: 'ENERGY',
    bank: 'B',
    instrument: 'perc',
    pattern: 'NOISE_BURST',
    controls: {
      POWER: { param: 'volume', default: 0.4, min: 0, max: 1 }
    },
    color: '#E0641B',
    announcement: 'White noise',
    col: 1, row: 3,
    cue: 'For a clean wash, we cue White Noise.',
    fire: 'White Noise — sweeping.'
  },

  // === TEXTURE B (4) ===
  CHOIR: {
    id: 'CHOIR',
    name: 'Choir',
    category: 'TEXTURE',
    bank: 'B',
    instrument: 'pad',
    pattern: 'CHOIR',
    controls: {
      POWER: { param: 'volume', default: 0.4, min: 0, max: 1 },
      WARMTH: { param: 'filterFreq', default: 0.4, min: 0, max: 1 }
    },
    color: '#B432FF',
    announcement: 'Choir voices',
    col: 2, row: 0,
    cue: 'To add depth, we cue the Choir.',
    fire: 'Choir — voices in.'
  },

  STRINGS: {
    id: 'STRINGS',
    name: 'Strings',
    category: 'TEXTURE',
    bank: 'B',
    instrument: 'pad',
    pattern: 'STRINGS',
    controls: {
      POWER: { param: 'volume', default: 0.5, min: 0, max: 1 },
      ATTACK: { param: 'attack', default: 0.3, min: 0, max: 1 }
    },
    color: '#B432FF',
    announcement: 'Strings rising',
    col: 2, row: 1,
    cue: 'To swell the mid, we cue Strings.',
    fire: 'Strings — rising.'
  },

  BELL_PAD: {
    id: 'BELL_PAD',
    name: 'Bell Pad',
    category: 'TEXTURE',
    bank: 'B',
    instrument: 'arp',
    pattern: 'BELL',
    controls: {
      POWER: { param: 'volume', default: 0.3, min: 0, max: 1 },
      SHIMMER: { param: 'filterFreq', default: 0.8, min: 0, max: 1 }
    },
    color: '#B432FF',
    announcement: 'Bell pad',
    col: 2, row: 2,
    cue: 'For a hopeful glow, we cue Bell Pad.',
    fire: 'Bell Pad — chiming.'
  },

  WIND: {
    id: 'WIND',
    name: 'Wind',
    category: 'TEXTURE',
    bank: 'B',
    instrument: 'perc',
    pattern: 'WIND',
    controls: {
      POWER: { param: 'volume', default: 0.3, min: 0, max: 1 },
      GUST: { param: 'filterFreq', default: 0.5, min: 0, max: 1 }
    },
    color: '#B432FF',
    announcement: 'Wind blowing',
    col: 2, row: 3,
    cue: 'For breath and air, we cue Wind.',
    fire: 'Wind — blowing.'
  },

  // === FX B (4) ===
  LASER: {
    id: 'LASER',
    name: 'Laser',
    category: 'FX',
    bank: 'B',
    instrument: 'lead',
    pattern: 'LASER',
    controls: {
      POWER: { param: 'volume', default: 0.5, min: 0, max: 1 },
      ZAP: { param: 'filterFreq', default: 0.9, min: 0, max: 1 }
    },
    color: '#FF127B',
    announcement: 'Laser zap',
    col: 3, row: 0,
    cue: 'To slice the mix, we cue Laser.',
    fire: 'Laser — pew.'
  },

  WHOOSH: {
    id: 'WHOOSH',
    name: 'Whoosh',
    category: 'FX',
    bank: 'B',
    instrument: 'arp',
    pattern: 'WHOOSH',
    controls: {
      POWER: { param: 'volume', default: 0.5, min: 0, max: 1 },
      SWEEP: { param: 'filterFreq', default: 0.7, min: 0, max: 1 }
    },
    color: '#FF127B',
    announcement: 'Whoosh',
    col: 3, row: 1,
    cue: 'To bridge the bar, we cue Whoosh.',
    fire: 'Whoosh — flying.'
  },

  REVERSE: {
    id: 'REVERSE',
    name: 'Reverse',
    category: 'FX',
    bank: 'B',
    instrument: 'pad',
    pattern: 'REVERSE_ENV',
    controls: {
      POWER: { param: 'volume', default: 0.5, min: 0, max: 1 }
    },
    color: '#FF127B',
    announcement: 'Reverse effect',
    col: 3, row: 2,
    cue: 'For a reverse hit, we cue Reverse.',
    fire: 'Reverse — pulling back.'
  },

  GLITCH: {
    id: 'GLITCH',
    name: 'Glitch',
    category: 'FX',
    bank: 'B',
    instrument: 'perc',
    pattern: 'GLITCH',
    controls: {
      POWER: { param: 'volume', default: 0.4, min: 0, max: 1 },
      CHAOS: { param: 'filterFreq', default: 0.5, min: 0, max: 1 }
    },
    color: '#FF127B',
    announcement: 'Glitch mode',
    col: 3, row: 3,
    cue: 'For some chaos, we cue Glitch.',
    fire: 'Glitch — fractured.'
  }
};

// ============ CATEGORY COLORS ============

export const CATEGORY_COLORS = {
  BASS: '#10B176',    // rekordbox green-teal
  ENERGY: '#E0641B',  // rekordbox orange
  TEXTURE: '#B432FF', // rekordbox purple
  FX: '#FF127B'       // rekordbox hot pink
};

// ============ HELPER FUNCTIONS ============

/**
 * Get all presets as an array
 */
export function getAllPresets() {
  return Object.values(PRESETS);
}

/**
 * Get presets by category
 */
export function getPresetsByCategory(category) {
  return Object.values(PRESETS).filter(p => p.category === category);
}

/**
 * Get presets by category and bank
 */
export function getPresetsByCategoryAndBank(category, bank) {
  return Object.values(PRESETS).filter(p => p.category === category && p.bank === bank);
}

/**
 * Get a preset by ID
 */
export function getPresetById(id) {
  return PRESETS[id] || null;
}

/**
 * Get pattern by name
 */
export function getPattern(patternName) {
  return PATTERNS[patternName] || null;
}
