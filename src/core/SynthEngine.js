import * as Tone from 'tone';
import { PATTERNS, getPattern, getPresetById } from '../presets/index.js';
import { Transposer } from './Transposer.js';

/**
 * SynthEngine - Manages Tone.js instruments and patterns
 * Day 3 version: Full preset system with 16 presets
 */
export class SynthEngine {
  constructor() {
    this.bpm = 120;
    this.rootNote = 'C';
    this.initialized = false;

    // All instruments
    this.instruments = {};

    // Active presets (preset ID -> pattern instance)
    this.activePresets = new Map();

    // Legacy: Active patterns for backward compat
    this.activePatterns = new Map();

    // Master volume
    this.masterGain = null;

    // Note intervals for transposition (semitones from C)
    this.NOTE_MAP = {
      'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3,
      'E': 4, 'F': 5, 'F#': 6, 'Gb': 6, 'G': 7, 'G#': 8,
      'Ab': 8, 'A': 9, 'A#': 10, 'Bb': 10, 'B': 11
    };

    // Test patterns for each instrument (all in C, transposed at runtime)
    this.testPatterns = {
      acidBass: {
        notes: ['C2', 'C2', 'D2', 'C2', 'E2', 'C2', 'D2', 'C2'],
        duration: '16n',
        interval: '8n'
      },
      stab: {
        notes: [
          null, ['C4', 'E4', 'G4'], null, ['C4', 'E4', 'G4'],
          null, ['D4', 'F4', 'A4'], null, ['C4', 'E4', 'G4']
        ],
        duration: '8n',
        interval: '8n'
      },
      arp: {
        notes: ['C3', 'E3', 'G3', 'C4', 'G3', 'E3', 'C3', 'G2'],
        duration: '16n',
        interval: '16n'
      },
      pad: {
        notes: [['C3', 'E3', 'G3', 'B3']],
        duration: '1m',
        interval: '1m'
      },
      lead: {
        notes: ['C4', 'D4', 'E4', 'G4', 'E4', 'D4', 'C4', null],
        duration: '8n',
        interval: '8n'
      },
      perc: {
        notes: ['x', null, 'x', 'x', null, 'x', 'x', null],
        duration: '32n',
        interval: '16n'
      }
    };
  }

  /**
   * Initialize audio context and all instruments
   * Must be called after user interaction (browser requirement)
   */
  async init() {
    if (this.initialized) return;

    await Tone.start();
    console.log('Audio context started');

    // Master gain for overall volume control
    this.masterGain = new Tone.Gain(0.8).toDestination();

    // Create all 6 instruments
    this._createAcidBass();
    this._createStab();
    this._createArp();
    this._createPad();
    this._createLead();
    this._createPerc();

    // Set initial BPM
    Tone.Transport.bpm.value = this.bpm;

    this.initialized = true;
    console.log('SynthEngine initialized with 6 instruments');
  }

  /**
   * 1. ACID BASS - TB-303 style squelchy bass
   * Character: Aggressive, squelchy, driving
   */
  _createAcidBass() {
    this.instruments.acidBass = new Tone.MonoSynth({
      oscillator: { type: 'sawtooth' },
      filter: {
        Q: 8,
        type: 'lowpass',
        rolloff: -24
      },
      envelope: {
        attack: 0.01,
        decay: 0.1,
        sustain: 0.3,
        release: 0.1
      },
      filterEnvelope: {
        attack: 0.01,
        decay: 0.2,
        sustain: 0.2,
        release: 0.2,
        baseFrequency: 200,
        octaves: 3.5
      }
    }).connect(this.masterGain);

    this.instruments.acidBass.volume.value = -6;
  }

  /**
   * 2. STAB - Bright punchy chord hits
   * Character: Sharp, energetic, punchy
   */
  _createStab() {
    this.instruments.stab = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'square' },
      envelope: {
        attack: 0.005,
        decay: 0.15,
        sustain: 0.1,
        release: 0.3
      }
    }).connect(this.masterGain);

    // Add some brightness with a filter
    const stabFilter = new Tone.Filter(3000, 'lowpass').connect(this.masterGain);
    this.instruments.stab.disconnect();
    this.instruments.stab.connect(stabFilter);
    this.instruments.stab.volume.value = -10;
  }

  /**
   * 3. ARP - Clean plucky arpeggios
   * Character: Sparkly, rhythmic, hypnotic
   */
  _createArp() {
    this.instruments.arp = new Tone.MonoSynth({
      oscillator: { type: 'triangle' },
      filter: {
        Q: 2,
        type: 'lowpass',
        rolloff: -12
      },
      envelope: {
        attack: 0.005,
        decay: 0.2,
        sustain: 0.0,
        release: 0.3
      },
      filterEnvelope: {
        attack: 0.005,
        decay: 0.1,
        sustain: 0.5,
        release: 0.2,
        baseFrequency: 800,
        octaves: 2
      }
    }).connect(this.masterGain);

    this.instruments.arp.volume.value = -8;
  }

  /**
   * 4. PAD - Warm sustained atmosphere
   * Character: Lush, dreamy, enveloping
   */
  _createPad() {
    this.instruments.pad = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'sine' },
      envelope: {
        attack: 0.5,
        decay: 0.3,
        sustain: 0.8,
        release: 2.0
      }
    }).connect(this.masterGain);

    // Add chorus for warmth
    const chorus = new Tone.Chorus(3, 2.5, 0.5).connect(this.masterGain);
    chorus.start();
    this.instruments.pad.disconnect();
    this.instruments.pad.connect(chorus);
    this.instruments.pad.volume.value = -12;
  }

  /**
   * 5. LEAD - Cutting presence for melodies
   * Character: Bright, cutting, expressive
   */
  _createLead() {
    this.instruments.lead = new Tone.MonoSynth({
      oscillator: { type: 'sawtooth' },
      filter: {
        Q: 3,
        type: 'lowpass',
        rolloff: -12
      },
      envelope: {
        attack: 0.02,
        decay: 0.2,
        sustain: 0.5,
        release: 0.4
      },
      filterEnvelope: {
        attack: 0.02,
        decay: 0.3,
        sustain: 0.4,
        release: 0.3,
        baseFrequency: 400,
        octaves: 3
      }
    }).connect(this.masterGain);

    this.instruments.lead.volume.value = -8;
  }

  /**
   * 6. PERC - Rhythmic textural noise
   * Character: Gritty, driving, non-pitched
   */
  _createPerc() {
    this.instruments.perc = new Tone.NoiseSynth({
      noise: { type: 'white' },
      envelope: {
        attack: 0.005,
        decay: 0.1,
        sustain: 0.0,
        release: 0.05
      }
    }).connect(this.masterGain);

    // Bandpass filter for more tonal character
    const percFilter = new Tone.Filter(2000, 'bandpass', -12).connect(this.masterGain);
    this.instruments.perc.disconnect();
    this.instruments.perc.connect(percFilter);
    this.instruments.perc.volume.value = -15;
  }

  // ============ PLAYBACK CONTROLS ============

  /**
   * Set the BPM (tempo)
   */
  setBPM(bpm) {
    this.bpm = bpm;
    Tone.Transport.bpm.value = bpm;
    console.log(`BPM set to ${bpm}`);
  }

  /**
   * Set the root key for transposition
   */
  setKey(root) {
    this.rootNote = root;
    console.log(`Key set to ${root}`);
  }

  /**
   * Transpose a note from C to the current root key
   */
  transpose(note) {
    if (!note || note === 'x') return note;

    const interval = this.NOTE_MAP[this.rootNote] - this.NOTE_MAP['C'];
    if (interval === 0) return note;

    return Tone.Frequency(note).transpose(interval).toNote();
  }

  /**
   * Transpose an array of notes (for chords)
   */
  transposeChord(notes) {
    if (!Array.isArray(notes)) return this.transpose(notes);
    return notes.map(n => this.transpose(n));
  }

  /**
   * Play a specific instrument's test pattern
   */
  playInstrument(instrumentName) {
    if (!this.initialized) {
      console.error('SynthEngine not initialized');
      return false;
    }

    const instrument = this.instruments[instrumentName];
    const patternConfig = this.testPatterns[instrumentName];

    if (!instrument || !patternConfig) {
      console.error(`Unknown instrument: ${instrumentName}`);
      return false;
    }

    // Stop if already playing this instrument
    if (this.activePatterns.has(instrumentName)) {
      this.stopInstrument(instrumentName);
      return false;
    }

    // Create the pattern
    const pattern = new Tone.Sequence(
      (time, note) => {
        if (note === null) return;

        if (note === 'x') {
          // Percussion hit (no pitch)
          instrument.triggerAttackRelease(patternConfig.duration, time);
        } else if (Array.isArray(note)) {
          // Chord
          const transposed = this.transposeChord(note);
          instrument.triggerAttackRelease(transposed, patternConfig.duration, time);
        } else {
          // Single note
          const transposed = this.transpose(note);
          instrument.triggerAttackRelease(transposed, patternConfig.duration, time);
        }
      },
      patternConfig.notes,
      patternConfig.interval
    );

    pattern.start(0);
    this.activePatterns.set(instrumentName, pattern);

    // Start transport if not running
    if (Tone.Transport.state !== 'started') {
      Tone.Transport.start();
    }

    console.log(`Playing ${instrumentName} in ${this.rootNote}`);
    return true;
  }

  /**
   * Stop a specific instrument
   */
  stopInstrument(instrumentName) {
    const pattern = this.activePatterns.get(instrumentName);
    if (pattern) {
      pattern.stop();
      pattern.dispose();
      this.activePatterns.delete(instrumentName);
      console.log(`Stopped ${instrumentName}`);
    }

    // Stop transport if nothing playing
    if (this.activePatterns.size === 0) {
      Tone.Transport.stop();
    }
  }

  /**
   * Stop all instruments
   */
  stopAll() {
    for (const [name, pattern] of this.activePatterns) {
      pattern.stop();
      pattern.dispose();
    }
    this.activePatterns.clear();
    Tone.Transport.stop();
    console.log('Stopped all');
  }

  /**
   * Check if an instrument is playing
   */
  isInstrumentPlaying(instrumentName) {
    return this.activePatterns.has(instrumentName);
  }

  /**
   * Get list of all instrument names
   */
  getInstrumentNames() {
    return Object.keys(this.instruments);
  }

  // ============ BEAT SYNC ============

  /**
   * Sync transport to external beat timestamp
   * Called when AudioAnalysis detects a beat
   * @param {number} beatTimeMs - performance.now() timestamp of detected beat
   */
  syncToBeat(beatTimeMs) {
    if (!this.initialized || Tone.Transport.state !== 'started') return;

    // Calculate where we SHOULD be based on BPM
    const beatDurationMs = 60000 / this.bpm;
    const transportPos = Tone.Transport.seconds;
    const transportBeatPos = (transportPos * 1000) % beatDurationMs;

    // Calculate drift (how far off we are from the detected beat)
    const drift = transportBeatPos;

    // If drift > 50ms, nudge the transport
    if (drift > 50 && drift < beatDurationMs - 50) {
      // Nudge by adjusting position slightly
      const nudgeAmount = drift > beatDurationMs / 2
        ? (beatDurationMs - drift) / 1000  // We're behind, speed up
        : -drift / 1000;                    // We're ahead, slow down

      // Small nudge (max 20ms at a time to avoid jarring)
      const clampedNudge = Math.max(-0.02, Math.min(0.02, nudgeAmount));
      Tone.Transport.seconds += clampedNudge;
    }
  }

  // ============ PRESET API ============

  /**
   * Create a dedicated instrument instance for a preset
   * Each preset gets its own synth so multiple can play simultaneously
   */
  _createPresetInstrument(instrumentName) {
    let instrument;

    switch (instrumentName) {
      case 'acidBass':
        instrument = new Tone.MonoSynth({
          oscillator: { type: 'sawtooth' },
          filter: { Q: 8, type: 'lowpass', rolloff: -24 },
          envelope: { attack: 0.01, decay: 0.1, sustain: 0.3, release: 0.1 },
          filterEnvelope: {
            attack: 0.01, decay: 0.2, sustain: 0.2, release: 0.2,
            baseFrequency: 200, octaves: 3.5
          }
        }).connect(this.masterGain);
        instrument.volume.value = -6;
        break;

      case 'stab':
        instrument = new Tone.PolySynth(Tone.Synth, {
          oscillator: { type: 'square' },
          envelope: { attack: 0.005, decay: 0.15, sustain: 0.1, release: 0.3 }
        });
        const stabFilter = new Tone.Filter(3000, 'lowpass').connect(this.masterGain);
        instrument.connect(stabFilter);
        instrument.volume.value = -10;
        // Store filter for cleanup
        instrument._presetFilter = stabFilter;
        break;

      case 'arp':
        instrument = new Tone.MonoSynth({
          oscillator: { type: 'triangle' },
          filter: { Q: 2, type: 'lowpass', rolloff: -12 },
          envelope: { attack: 0.005, decay: 0.2, sustain: 0.0, release: 0.3 },
          filterEnvelope: {
            attack: 0.005, decay: 0.1, sustain: 0.5, release: 0.2,
            baseFrequency: 800, octaves: 2
          }
        }).connect(this.masterGain);
        instrument.volume.value = -8;
        break;

      case 'pad':
        instrument = new Tone.PolySynth(Tone.Synth, {
          oscillator: { type: 'sine' },
          envelope: { attack: 0.5, decay: 0.3, sustain: 0.8, release: 2.0 }
        });
        const chorus = new Tone.Chorus(3, 2.5, 0.5).connect(this.masterGain);
        chorus.start();
        instrument.connect(chorus);
        instrument.volume.value = -12;
        instrument._presetChorus = chorus;
        break;

      case 'lead':
        instrument = new Tone.MonoSynth({
          oscillator: { type: 'sawtooth' },
          filter: { Q: 3, type: 'lowpass', rolloff: -12 },
          envelope: { attack: 0.02, decay: 0.2, sustain: 0.5, release: 0.4 },
          filterEnvelope: {
            attack: 0.02, decay: 0.3, sustain: 0.4, release: 0.3,
            baseFrequency: 400, octaves: 3
          }
        }).connect(this.masterGain);
        instrument.volume.value = -8;
        break;

      case 'perc':
        instrument = new Tone.NoiseSynth({
          noise: { type: 'white' },
          envelope: { attack: 0.005, decay: 0.1, sustain: 0.0, release: 0.05 }
        });
        const percFilter = new Tone.Filter(2000, 'bandpass', -12).connect(this.masterGain);
        instrument.connect(percFilter);
        instrument.volume.value = -15;
        instrument._presetFilter = percFilter;
        break;

      default:
        console.error(`Unknown instrument: ${instrumentName}`);
        return null;
    }

    return instrument;
  }

  /**
   * Clean up a preset's dedicated instrument
   */
  _disposePresetInstrument(instrument) {
    if (!instrument) return;

    // Clean up any attached effects
    if (instrument._presetFilter) {
      instrument._presetFilter.dispose();
    }
    if (instrument._presetChorus) {
      instrument._presetChorus.dispose();
    }

    instrument.dispose();
  }

  /**
   * Play a preset by ID - quantized to next beat
   * Each preset gets its own instrument instance for layering
   * @param {string} presetId - Preset ID (e.g., 'PUMP_IT_UP')
   * @returns {boolean} - Whether preset is now playing (or scheduled)
   */
  playPreset(presetId) {
    if (!this.initialized) {
      console.error('SynthEngine not initialized');
      return false;
    }

    const preset = getPresetById(presetId);
    if (!preset) {
      console.error(`Unknown preset: ${presetId}`);
      return false;
    }

    // Toggle off if already playing
    if (this.activePresets.has(presetId)) {
      this.stopPreset(presetId);
      return false;
    }

    const patternConfig = getPattern(preset.pattern);
    if (!patternConfig) {
      console.error(`Invalid pattern: ${preset.pattern}`);
      return false;
    }

    // Create a DEDICATED instrument instance for this preset
    const instrument = this._createPresetInstrument(preset.instrument);
    if (!instrument) {
      console.error(`Failed to create instrument: ${preset.instrument}`);
      return false;
    }

    // Create the pattern with transposed notes
    const pattern = new Tone.Sequence(
      (time, note) => {
        try {
          if (note === null) return;

          if (note === 'x') {
            // Percussion hit
            instrument.triggerAttackRelease(patternConfig.duration, time);
          } else if (Array.isArray(note)) {
            // Chord - only PolySynth can play chords, MonoSynth plays root note
            if (instrument instanceof Tone.PolySynth) {
              const transposed = Transposer.transposeChord(note, 'C', this.rootNote);
              instrument.triggerAttackRelease(transposed, patternConfig.duration, time);
            } else {
              // MonoSynth: play root note of chord only
              const transposed = Transposer.transpose(note[0], 'C', this.rootNote);
              instrument.triggerAttackRelease(transposed, patternConfig.duration, time);
            }
          } else {
            // Single note
            const transposed = Transposer.transpose(note, 'C', this.rootNote);
            instrument.triggerAttackRelease(transposed, patternConfig.duration, time);
          }
        } catch (err) {
          console.error(`Preset ${presetId} pattern error:`, err);
        }
      },
      patternConfig.notes,
      patternConfig.interval
    );

    // Start transport if not running
    if (Tone.Transport.state !== 'started') {
      Tone.Transport.start();
    }
    // Start pattern at current transport position (plays immediately, loops)
    pattern.start(Tone.Transport.seconds);

    // Store both pattern AND instrument for cleanup
    this.activePresets.set(presetId, { pattern, preset, instrument });
    console.log(`Playing preset: ${preset.name} in ${this.rootNote}`);
    return true;
  }

  /**
   * Stop a preset by ID
   * @param {string} presetId - Preset ID
   */
  stopPreset(presetId) {
    const active = this.activePresets.get(presetId);
    if (active) {
      active.pattern.stop();
      active.pattern.dispose();
      // Dispose the dedicated instrument
      this._disposePresetInstrument(active.instrument);
      this.activePresets.delete(presetId);
      console.log(`Stopped preset: ${presetId}`);
    }

    // Stop transport if nothing playing
    if (this.activePresets.size === 0 && this.activePatterns.size === 0) {
      Tone.Transport.stop();
    }
  }

  /**
   * Stop all presets
   */
  stopAllPresets() {
    for (const [id, active] of this.activePresets) {
      active.pattern.stop();
      active.pattern.dispose();
      // Dispose each dedicated instrument
      this._disposePresetInstrument(active.instrument);
    }
    this.activePresets.clear();

    if (this.activePatterns.size === 0) {
      Tone.Transport.stop();
    }
    console.log('Stopped all presets');
  }

  /**
   * Check if a preset is playing
   */
  isPresetPlaying(presetId) {
    return this.activePresets.has(presetId);
  }

  /**
   * Get list of active preset IDs
   */
  getActivePresetIds() {
    return Array.from(this.activePresets.keys());
  }

  // ============ LEGACY API (backward compat with Day 1 UI) ============

  get isPlaying() {
    return this.activePatterns.size > 0;
  }

  playTestPattern() {
    this.playInstrument('acidBass');
  }

  stop() {
    this.stopAll();
  }

  toggle() {
    if (this.isPlaying) {
      this.stopAll();
    } else {
      this.playInstrument('acidBass');
    }
    return this.isPlaying;
  }

  // ============ INSTRUMENT CONTROLS ============

  /**
   * Set instrument volume (POWER control)
   * @param {string} instrumentName
   * @param {number} value - 0-1 normalized
   */
  setInstrumentVolume(instrumentName, value) {
    const instrument = this.instruments[instrumentName];
    if (!instrument) return;
    const db = -40 + (value * 40);
    instrument.volume.value = db;
  }

  /**
   * Set master volume
   * @param {number} value - 0-1 normalized
   */
  setMasterVolume(value) {
    if (this.masterGain) {
      this.masterGain.gain.value = value;
    }
  }

  /**
   * Set filter cutoff for acid bass (DARKNESS control)
   * @param {number} value - 0-1 normalized
   */
  setFilterCutoff(value) {
    const acidBass = this.instruments.acidBass;
    if (!acidBass) return;
    const freq = 100 + (value * 3900);
    acidBass.filter.frequency.value = freq;
  }

  /**
   * Set filter resonance for acid bass (SQUELCH control)
   * @param {number} value - 0-1 normalized
   */
  setFilterResonance(value) {
    const acidBass = this.instruments.acidBass;
    if (!acidBass) return;
    const q = 1 + (value * 14);
    acidBass.filter.Q.value = q;
  }

  /**
   * Clean up all resources
   */
  dispose() {
    this.stopAll();
    for (const instrument of Object.values(this.instruments)) {
      instrument.dispose();
    }
    this.instruments = {};
    if (this.masterGain) {
      this.masterGain.dispose();
      this.masterGain = null;
    }
    this.initialized = false;
  }
}

// Export singleton instance
export const synthEngine = new SynthEngine();
