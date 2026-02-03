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
  }
};

// ============ PRESET DEFINITIONS ============

export const PRESETS = {
  // === BASS (4) ===
  PUMP_IT_UP: {
    id: 'PUMP_IT_UP',
    name: 'Pump It Up',
    category: 'BASS',
    instrument: 'acidBass',
    pattern: 'KICK_FOLLOW',
    controls: {
      POWER: { param: 'volume', default: 0.7, min: 0, max: 1 },
      DARKNESS: { param: 'filterFreq', default: 0.5, min: 0, max: 1 },
      SQUELCH: { param: 'filterQ', default: 0.3, min: 0, max: 1 }
    },
    color: '#22c55e', // green
    announcement: 'Dropping the bass'
  },

  ACID_WOBBLE: {
    id: 'ACID_WOBBLE',
    name: 'Acid Wobble',
    category: 'BASS',
    instrument: 'acidBass',
    pattern: 'ACID_WOBBLE',
    controls: {
      POWER: { param: 'volume', default: 0.7, min: 0, max: 1 },
      DARKNESS: { param: 'filterFreq', default: 0.6, min: 0, max: 1 },
      SQUELCH: { param: 'filterQ', default: 0.7, min: 0, max: 1 }
    },
    color: '#22c55e',
    announcement: 'Acid wobble engaged'
  },

  SUB_PULSE: {
    id: 'SUB_PULSE',
    name: 'Sub Pulse',
    category: 'BASS',
    instrument: 'acidBass',
    pattern: 'SUB_PULSE',
    controls: {
      POWER: { param: 'volume', default: 0.8, min: 0, max: 1 },
      DARKNESS: { param: 'filterFreq', default: 0.2, min: 0, max: 1 }
    },
    color: '#22c55e',
    announcement: 'Sub bass pulse'
  },

  BASS_STAB: {
    id: 'BASS_STAB',
    name: 'Bass Stab',
    category: 'BASS',
    instrument: 'acidBass',
    pattern: 'BASS_STAB',
    controls: {
      POWER: { param: 'volume', default: 0.6, min: 0, max: 1 },
      DARKNESS: { param: 'filterFreq', default: 0.7, min: 0, max: 1 }
    },
    color: '#22c55e',
    announcement: 'Bass stab'
  },

  // === ENERGY (4) ===
  TRANCE_GATE: {
    id: 'TRANCE_GATE',
    name: 'Trance Gate',
    category: 'ENERGY',
    instrument: 'stab',
    pattern: 'OFFBEAT_STAB',
    controls: {
      POWER: { param: 'volume', default: 0.6, min: 0, max: 1 },
      ATTACK: { param: 'attack', default: 0.1, min: 0, max: 0.5 }
    },
    color: '#eab308', // yellow
    announcement: 'Trance gate activated'
  },

  RISING_ENERGY: {
    id: 'RISING_ENERGY',
    name: 'Rising Energy',
    category: 'ENERGY',
    instrument: 'arp',
    pattern: 'RISING_ARP',
    controls: {
      POWER: { param: 'volume', default: 0.5, min: 0, max: 1 },
      BRIGHTNESS: { param: 'filterFreq', default: 0.7, min: 0, max: 1 }
    },
    color: '#eab308',
    announcement: 'Building energy'
  },

  BUILD_UP: {
    id: 'BUILD_UP',
    name: 'Build Up',
    category: 'ENERGY',
    instrument: 'perc',
    pattern: 'BUILD_UP',
    controls: {
      POWER: { param: 'volume', default: 0.4, min: 0, max: 1 },
      INTENSITY: { param: 'decay', default: 0.5, min: 0, max: 1 }
    },
    color: '#eab308',
    announcement: 'Building up'
  },

  DROP_IMPACT: {
    id: 'DROP_IMPACT',
    name: 'Drop Impact',
    category: 'ENERGY',
    instrument: 'stab',
    pattern: 'DROP_IMPACT',
    controls: {
      POWER: { param: 'volume', default: 0.8, min: 0, max: 1 }
    },
    color: '#eab308',
    announcement: 'Drop it'
  },

  // === TEXTURE (4) ===
  DREAM_CLOUD: {
    id: 'DREAM_CLOUD',
    name: 'Dream Cloud',
    category: 'TEXTURE',
    instrument: 'pad',
    pattern: 'HELD_PAD',
    controls: {
      POWER: { param: 'volume', default: 0.4, min: 0, max: 1 },
      WARMTH: { param: 'filterFreq', default: 0.5, min: 0, max: 1 }
    },
    color: '#a855f7', // purple
    announcement: 'Dream cloud floating'
  },

  SHIMMER: {
    id: 'SHIMMER',
    name: 'Shimmer',
    category: 'TEXTURE',
    instrument: 'arp',
    pattern: 'SHIMMER',
    controls: {
      POWER: { param: 'volume', default: 0.3, min: 0, max: 1 },
      SPARKLE: { param: 'filterFreq', default: 0.8, min: 0, max: 1 }
    },
    color: '#a855f7',
    announcement: 'Shimmer effect'
  },

  DARK_FOG: {
    id: 'DARK_FOG',
    name: 'Dark Fog',
    category: 'TEXTURE',
    instrument: 'pad',
    pattern: 'DARK_PAD',
    controls: {
      POWER: { param: 'volume', default: 0.5, min: 0, max: 1 },
      DEPTH: { param: 'filterFreq', default: 0.3, min: 0, max: 1 }
    },
    color: '#a855f7',
    announcement: 'Dark fog rolling in'
  },

  RHYTHM_PULSE: {
    id: 'RHYTHM_PULSE',
    name: 'Rhythm Pulse',
    category: 'TEXTURE',
    instrument: 'perc',
    pattern: 'PERC_16TH',
    controls: {
      POWER: { param: 'volume', default: 0.3, min: 0, max: 1 },
      GRIT: { param: 'filterFreq', default: 0.5, min: 0, max: 1 }
    },
    color: '#a855f7',
    announcement: 'Rhythm pulse'
  },

  // === FX (4) ===
  STAB_ATTACK: {
    id: 'STAB_ATTACK',
    name: 'Stab Attack',
    category: 'FX',
    instrument: 'stab',
    pattern: 'QUARTER_STABS',
    controls: {
      POWER: { param: 'volume', default: 0.6, min: 0, max: 1 },
      PUNCH: { param: 'attack', default: 0.1, min: 0, max: 0.3 }
    },
    color: '#f97316', // orange
    announcement: 'Stab attack'
  },

  FILTER_SWEEP: {
    id: 'FILTER_SWEEP',
    name: 'Filter Sweep',
    category: 'FX',
    instrument: 'lead',
    pattern: 'FILTER_SWEEP',
    controls: {
      POWER: { param: 'volume', default: 0.5, min: 0, max: 1 },
      SWEEP: { param: 'filterFreq', default: 0.5, min: 0, max: 1 }
    },
    color: '#f97316',
    announcement: 'Filter sweep'
  },

  TENSION: {
    id: 'TENSION',
    name: 'Tension',
    category: 'FX',
    instrument: 'stab',
    pattern: 'TENSION',
    controls: {
      POWER: { param: 'volume', default: 0.5, min: 0, max: 1 }
    },
    color: '#f97316',
    announcement: 'Building tension'
  },

  RELEASE: {
    id: 'RELEASE',
    name: 'Release',
    category: 'FX',
    instrument: 'pad',
    pattern: 'RELEASE',
    controls: {
      POWER: { param: 'volume', default: 0.6, min: 0, max: 1 }
    },
    color: '#f97316',
    announcement: 'Release'
  }
};

// ============ CATEGORY COLORS ============

export const CATEGORY_COLORS = {
  BASS: '#22c55e',    // green
  ENERGY: '#eab308',  // yellow
  TEXTURE: '#a855f7', // purple
  FX: '#f97316'       // orange
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
