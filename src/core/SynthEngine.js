import * as Tone from 'tone';
import { PATTERNS, getPattern, getPresetById } from '../presets/index.js';
import { Transposer } from './Transposer.js';
import { SynthFactory } from './SynthFactory.js';

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

    // Master volume - increased by 25% (0-1.25 range)
    this.masterGain = null;
    this.masterVolume = 1.0; // Track 0-1.25 for UI (25% louder max)

    // Fade settings (seconds)
    this.fadeInTime = 0;
    this.fadeOutTime = 0;

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

    // Ensure audio context is truly running
    if (Tone.context.state !== 'running') {
      await Tone.context.resume();
    }
    console.log(`Audio context started (state: ${Tone.context.state})`);

    // === PROFESSIONAL MASTER BUS CHAIN ===
    // Signal flow: instruments -> masterGain -> compressor -> limiter -> destination

    // Master limiter to prevent clipping (catches peaks above -1dB)
    this.masterLimiter = new Tone.Limiter(-1).toDestination();

    // Master compressor for glue and punch (before limiter)
    // More aggressive settings to prevent clipping with layered instruments
    this.masterCompressor = new Tone.Compressor({
      threshold: -18,    // Lower threshold - catch more peaks
      ratio: 6,          // Higher ratio - more compression
      attack: 0.002,     // Faster attack - catch transients
      release: 0.15,     // Faster release - recover quickly
      knee: 10           // Softer knee - smoother compression
    }).connect(this.masterLimiter);

    // Master gain for overall volume control
    // The limiter handles peak protection, so we can push volume higher
    // Increased by 25% from 0.8 to 1.0 for louder output
    this.masterGain = new Tone.Gain(1.0).connect(this.masterCompressor);

    // Shared effects buses (instruments can send to these)
    this.reverbBus = new Tone.Reverb({
      decay: 2.5,
      wet: 1,
      preDelay: 0.01
    }).connect(this.masterGain);
    this.reverbBus.generate(); // Pre-generate impulse response

    this.delayBus = new Tone.FeedbackDelay({
      delayTime: '8n',
      feedback: 0.3,
      wet: 1
    }).connect(this.masterGain);

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
   * PRO: Added saturation for analog warmth, proper gain staging
   */
  _createAcidBass() {
    // Channel strip for this instrument
    const channel = new Tone.Channel({
      volume: -12,  // Lower volume for headroom
      pan: 0
    }).connect(this.masterGain);

    // Subtle saturation for analog warmth
    const saturator = new Tone.Distortion({
      distortion: 0.15,
      wet: 0.3
    }).connect(channel);

    // Low-pass filter for extra control
    const filter = new Tone.Filter({
      frequency: 800,
      type: 'lowpass',
      rolloff: -24
    }).connect(saturator);

    this.instruments.acidBass = new Tone.MonoSynth({
      oscillator: { type: 'sawtooth' },
      filter: {
        Q: 6,  // Reduced Q to avoid resonance spikes
        type: 'lowpass',
        rolloff: -24
      },
      envelope: {
        attack: 0.005,
        decay: 0.15,
        sustain: 0.25,
        release: 0.15
      },
      filterEnvelope: {
        attack: 0.005,
        decay: 0.25,
        sustain: 0.15,
        release: 0.2,
        baseFrequency: 150,
        octaves: 3
      }
    }).connect(filter);

    this.instruments.acidBass._channel = channel;
    this.instruments.acidBass._filter = filter;
    this.instruments.acidBass._saturator = saturator;
  }

  /**
   * 2. STAB - Bright punchy chord hits
   * Character: Sharp, energetic, punchy
   * PRO: Proper gain staging, send to reverb for space
   */
  _createStab() {
    // Channel strip
    const channel = new Tone.Channel({
      volume: -14,
      pan: 0
    }).connect(this.masterGain);

    // Send to reverb for space
    const reverbSend = new Tone.Gain(0.2).connect(this.reverbBus);

    // Brightness filter
    const stabFilter = new Tone.Filter({
      frequency: 4000,
      type: 'lowpass',
      rolloff: -12
    }).connect(channel);
    stabFilter.connect(reverbSend);

    this.instruments.stab = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'pulse', width: 0.3 },  // Pulse wave for richer harmonics
      envelope: {
        attack: 0.002,
        decay: 0.12,
        sustain: 0.05,
        release: 0.25
      }
    }).connect(stabFilter);

    this.instruments.stab.maxPolyphony = 6;  // Limit polyphony to prevent CPU spikes
    this.instruments.stab._channel = channel;
    this.instruments.stab._filter = stabFilter;
    this.instruments.stab._reverbSend = reverbSend;
  }

  /**
   * 3. ARP - Clean plucky arpeggios
   * Character: Sparkly, rhythmic, hypnotic
   * PRO: Delay send for rhythmic interest, proper staging
   */
  _createArp() {
    // Channel strip
    const channel = new Tone.Channel({
      volume: -14,
      pan: 0.1  // Slight right for stereo width
    }).connect(this.masterGain);

    // Send to delay for rhythmic interest
    const delaySend = new Tone.Gain(0.25).connect(this.delayBus);

    // High-pass to prevent mud
    const hiPass = new Tone.Filter({
      frequency: 200,
      type: 'highpass'
    }).connect(channel);
    hiPass.connect(delaySend);

    this.instruments.arp = new Tone.MonoSynth({
      oscillator: { type: 'triangle' },
      filter: {
        Q: 2,
        type: 'lowpass',
        rolloff: -12
      },
      envelope: {
        attack: 0.002,
        decay: 0.15,
        sustain: 0.0,
        release: 0.2
      },
      filterEnvelope: {
        attack: 0.002,
        decay: 0.08,
        sustain: 0.4,
        release: 0.15,
        baseFrequency: 1000,
        octaves: 2.5
      }
    }).connect(hiPass);

    this.instruments.arp._channel = channel;
    this.instruments.arp._delaySend = delaySend;
    this.instruments.arp._hiPass = hiPass;
  }

  /**
   * 4. PAD - Warm sustained atmosphere
   * Character: Lush, dreamy, enveloping
   * PRO: Chorus + reverb for lush sound, low volume to sit in mix
   */
  _createPad() {
    // Channel strip - pads need to be quiet
    const channel = new Tone.Channel({
      volume: -18,
      pan: 0
    }).connect(this.masterGain);

    // Heavy reverb send for atmosphere
    const reverbSend = new Tone.Gain(0.4).connect(this.reverbBus);

    // Chorus for movement and width
    const chorus = new Tone.Chorus({
      frequency: 1.5,
      delayTime: 3.5,
      depth: 0.7,
      wet: 0.5
    }).connect(channel);
    chorus.connect(reverbSend);
    chorus.start();

    // Low-pass to keep it soft
    const padFilter = new Tone.Filter({
      frequency: 3000,
      type: 'lowpass',
      rolloff: -12
    }).connect(chorus);

    this.instruments.pad = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'sine' },
      envelope: {
        attack: 0.8,
        decay: 0.4,
        sustain: 0.7,
        release: 2.5
      }
    }).connect(padFilter);

    this.instruments.pad.maxPolyphony = 8;
    this.instruments.pad._channel = channel;
    this.instruments.pad._chorus = chorus;
    this.instruments.pad._filter = padFilter;
    this.instruments.pad._reverbSend = reverbSend;
  }

  /**
   * 5. LEAD - Cutting presence for melodies
   * Character: Bright, cutting, expressive
   * PRO: Delay for depth, subtle saturation for presence
   */
  _createLead() {
    // Channel strip
    const channel = new Tone.Channel({
      volume: -12,
      pan: -0.1  // Slight left
    }).connect(this.masterGain);

    // Delay send for depth
    const delaySend = new Tone.Gain(0.15).connect(this.delayBus);

    // Subtle distortion for edge
    const leadDist = new Tone.Distortion({
      distortion: 0.08,
      wet: 0.2
    }).connect(channel);
    leadDist.connect(delaySend);

    this.instruments.lead = new Tone.MonoSynth({
      oscillator: { type: 'sawtooth' },
      filter: {
        Q: 2.5,
        type: 'lowpass',
        rolloff: -12
      },
      envelope: {
        attack: 0.01,
        decay: 0.15,
        sustain: 0.45,
        release: 0.3
      },
      filterEnvelope: {
        attack: 0.01,
        decay: 0.2,
        sustain: 0.35,
        release: 0.25,
        baseFrequency: 500,
        octaves: 2.5
      }
    }).connect(leadDist);

    this.instruments.lead._channel = channel;
    this.instruments.lead._dist = leadDist;
    this.instruments.lead._delaySend = delaySend;
  }

  /**
   * 6. PERC - Rhythmic textural noise
   * Character: Gritty, driving, non-pitched
   * PRO: Transient shaper effect via compression, tight gating
   */
  _createPerc() {
    // Channel strip
    const channel = new Tone.Channel({
      volume: -16,
      pan: 0.15  // Slight right
    }).connect(this.masterGain);

    // Light reverb send for room
    const reverbSend = new Tone.Gain(0.1).connect(this.reverbBus);

    // Compressor for punch
    const percComp = new Tone.Compressor({
      threshold: -20,
      ratio: 6,
      attack: 0.001,
      release: 0.05
    }).connect(channel);
    percComp.connect(reverbSend);

    // Bandpass for tonal character
    const percFilter = new Tone.Filter({
      frequency: 2500,
      type: 'bandpass',
      Q: 1.5
    }).connect(percComp);

    this.instruments.perc = new Tone.NoiseSynth({
      noise: { type: 'pink' },  // Pink noise = less harsh than white
      envelope: {
        attack: 0.001,
        decay: 0.08,
        sustain: 0.0,
        release: 0.03
      }
    }).connect(percFilter);

    this.instruments.perc._channel = channel;
    this.instruments.perc._filter = percFilter;
    this.instruments.perc._comp = percComp;
    this.instruments.perc._reverbSend = reverbSend;
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
   * PRO: Proper gain staging and effects matching the main instruments
   *
   * If preset has instrumentType, uses SynthFactory for professional sounds
   * @param {string} instrumentName - Legacy instrument name
   * @param {Object} preset - Preset configuration
   * @param {Tone.Node} destination - Audio destination (defaults to masterGain, can be modulator)
   */
  _createPresetInstrument(instrumentName, preset = null, destination = null) {
    const dest = destination || this.masterGain;

    // Check if preset specifies a SynthFactory instrument type
    if (preset && preset.instrumentType) {
      const factoryInstrument = SynthFactory.createInstrument(
        preset.instrumentType,
        dest,
        preset.synthOptions || {}
      );

      // Connect reverb/delay sends if present
      if (factoryInstrument._reverbSend && this.reverbBus) {
        factoryInstrument._reverbSend.connect(this.reverbBus);
      }
      if (factoryInstrument._delaySend && this.delayBus) {
        factoryInstrument._delaySend.connect(this.delayBus);
      }

      return factoryInstrument;
    }

    // Legacy instrument creation (fallback)
    let instrument;

    // Per-preset channel for gain/pan control (connects to destination, which may be modulator)
    const channel = new Tone.Channel({
      volume: -14,  // Conservative volume for layering
      pan: 0
    }).connect(dest);

    // Per-preset fade gain (for fade in/out)
    const fadeGain = new Tone.Gain(1).connect(channel);

    switch (instrumentName) {
      case 'acidBass':
        // Subtle saturation for warmth
        const bassSat = new Tone.Distortion({ distortion: 0.12, wet: 0.25 }).connect(fadeGain);
        instrument = new Tone.MonoSynth({
          oscillator: { type: 'sawtooth' },
          filter: { Q: 5, type: 'lowpass', rolloff: -24 },
          envelope: { attack: 0.005, decay: 0.15, sustain: 0.25, release: 0.15 },
          filterEnvelope: {
            attack: 0.005, decay: 0.25, sustain: 0.15, release: 0.2,
            baseFrequency: 150, octaves: 3
          }
        }).connect(bassSat);
        instrument._presetSat = bassSat;
        break;

      case 'stab':
        // Reverb send for space
        const stabReverb = new Tone.Gain(0.15).connect(this.reverbBus);
        const stabFilter = new Tone.Filter({ frequency: 4000, type: 'lowpass', rolloff: -12 }).connect(fadeGain);
        stabFilter.connect(stabReverb);
        instrument = new Tone.PolySynth(Tone.Synth, {
          oscillator: { type: 'pulse', width: 0.3 },
          envelope: { attack: 0.002, decay: 0.12, sustain: 0.05, release: 0.25 }
        }).connect(stabFilter);
        instrument.maxPolyphony = 6;
        instrument._presetFilter = stabFilter;
        instrument._presetReverbSend = stabReverb;
        break;

      case 'arp':
        // Delay send for rhythmic interest
        const arpDelay = new Tone.Gain(0.2).connect(this.delayBus);
        const arpHiPass = new Tone.Filter({ frequency: 200, type: 'highpass' }).connect(fadeGain);
        arpHiPass.connect(arpDelay);
        instrument = new Tone.MonoSynth({
          oscillator: { type: 'triangle' },
          filter: { Q: 2, type: 'lowpass', rolloff: -12 },
          envelope: { attack: 0.002, decay: 0.15, sustain: 0.0, release: 0.2 },
          filterEnvelope: {
            attack: 0.002, decay: 0.08, sustain: 0.4, release: 0.15,
            baseFrequency: 1000, octaves: 2.5
          }
        }).connect(arpHiPass);
        instrument._presetFilter = arpHiPass;
        instrument._presetDelaySend = arpDelay;
        break;

      case 'pad':
        // Chorus + heavy reverb
        const padReverb = new Tone.Gain(0.35).connect(this.reverbBus);
        const padFilter = new Tone.Filter({ frequency: 3000, type: 'lowpass', rolloff: -12 });
        const chorus = new Tone.Chorus({ frequency: 1.5, delayTime: 3.5, depth: 0.7, wet: 0.5 }).connect(fadeGain);
        chorus.connect(padReverb);
        chorus.start();
        padFilter.connect(chorus);
        instrument = new Tone.PolySynth(Tone.Synth, {
          oscillator: { type: 'sine' },
          envelope: { attack: 0.8, decay: 0.4, sustain: 0.7, release: 2.5 }
        }).connect(padFilter);
        instrument.maxPolyphony = 8;
        channel.volume.value = -20;  // Pads need to be quieter
        instrument._presetChorus = chorus;
        instrument._presetFilter = padFilter;
        instrument._presetReverbSend = padReverb;
        break;

      case 'lead':
        // Subtle distortion + delay
        const leadDelay = new Tone.Gain(0.12).connect(this.delayBus);
        const leadDist = new Tone.Distortion({ distortion: 0.06, wet: 0.15 }).connect(fadeGain);
        leadDist.connect(leadDelay);
        instrument = new Tone.MonoSynth({
          oscillator: { type: 'sawtooth' },
          filter: { Q: 2.5, type: 'lowpass', rolloff: -12 },
          envelope: { attack: 0.01, decay: 0.15, sustain: 0.45, release: 0.3 },
          filterEnvelope: {
            attack: 0.01, decay: 0.2, sustain: 0.35, release: 0.25,
            baseFrequency: 500, octaves: 2.5
          }
        }).connect(leadDist);
        instrument._presetDist = leadDist;
        instrument._presetDelaySend = leadDelay;
        break;

      case 'perc':
        // Compressor for punch + light reverb
        const percReverb = new Tone.Gain(0.08).connect(this.reverbBus);
        const percComp = new Tone.Compressor({ threshold: -20, ratio: 6, attack: 0.001, release: 0.05 }).connect(fadeGain);
        percComp.connect(percReverb);
        const percFilter = new Tone.Filter({ frequency: 2500, type: 'bandpass', Q: 1.5 }).connect(percComp);
        instrument = new Tone.NoiseSynth({
          noise: { type: 'pink' },
          envelope: { attack: 0.001, decay: 0.08, sustain: 0.0, release: 0.03 }
        }).connect(percFilter);
        instrument._presetFilter = percFilter;
        instrument._presetComp = percComp;
        instrument._presetReverbSend = percReverb;
        break;

      default:
        console.error(`Unknown instrument: ${instrumentName}`);
        channel.dispose();
        fadeGain.dispose();
        return null;
    }

    // Attach nodes for cleanup and fade control
    instrument._fadeGain = fadeGain;
    instrument._channel = channel;
    return instrument;
  }

  /**
   * Clean up a preset's dedicated instrument and all its effects
   */
  _disposePresetInstrument(instrument) {
    if (!instrument) return;

    // Clean up all attached effects
    if (instrument._presetFilter) instrument._presetFilter.dispose();
    if (instrument._presetChorus) instrument._presetChorus.dispose();
    if (instrument._presetSat) instrument._presetSat.dispose();
    if (instrument._presetDist) instrument._presetDist.dispose();
    if (instrument._presetComp) instrument._presetComp.dispose();
    if (instrument._presetReverbSend) instrument._presetReverbSend.dispose();
    if (instrument._presetDelaySend) instrument._presetDelaySend.dispose();
    if (instrument._fadeGain) instrument._fadeGain.dispose();
    if (instrument._channel) instrument._channel.dispose();

    instrument.dispose();
  }

  /**
   * Play a preset by ID - quantized to next beat
   * Each preset gets its own instrument instance for layering
   * @param {string} presetId - Preset ID (e.g., 'PUMP_IT_UP')
   * @param {Tone.Node} destination - Optional destination override (e.g., modulator effect)
   * @returns {boolean} - Whether preset is now playing (or scheduled)
   */
  playPreset(presetId, destination = null) {
    if (!this.initialized) {
      console.error('SynthEngine not initialized - call init() first');
      return false;
    }

    // Verify audio context is running
    if (Tone.context.state !== 'running') {
      console.warn(`Audio context is ${Tone.context.state}, attempting resume...`);
      Tone.context.resume();
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
    // Pass preset for SynthFactory support, and optional destination for modulator routing
    const instrument = this._createPresetInstrument(preset.instrument, preset, destination);
    if (!instrument) {
      console.error(`Failed to create instrument: ${preset.instrument}`);
      return false;
    }

    // Track loop position to detect loop restarts and prevent voice accumulation
    let noteCounter = 0;
    const numNotes = patternConfig.notes.length;

    // Create the pattern with transposed notes
    const pattern = new Tone.Sequence(
      (time, note) => {
        try {
          // Calculate current index within the loop
          const currentIndex = noteCounter % numNotes;

          // Detect loop restart (back to index 0 after completing a cycle)
          // This prevents voice accumulation on PolySynths at loop boundaries
          if (currentIndex === 0 && noteCounter > 0) {
            // Loop just restarted - release any lingering voices on PolySynths
            if (instrument instanceof Tone.PolySynth && typeof instrument.releaseAll === 'function') {
              instrument.releaseAll(time);
            }
          }
          noteCounter++;

          if (note === null) return;

          if (note === 'x') {
            // Percussion hit
            instrument.triggerAttackRelease(patternConfig.duration, time);
          } else if (Array.isArray(note)) {
            // Chord - only PolySynth can play chords, MonoSynth plays root note
            if (instrument instanceof Tone.PolySynth) {
              // Release previous voices before triggering new chord (prevents accumulation)
              instrument.releaseAll(time);
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
      console.log('Transport started');
    }

    // Apply fade-in if configured
    if (this.fadeInTime > 0 && instrument._fadeGain) {
      instrument._fadeGain.gain.value = 0;
      instrument._fadeGain.gain.rampTo(1, this.fadeInTime);
    }

    // Start pattern now ("+0" = current transport position)
    pattern.start("+0");

    // Store both pattern AND instrument for cleanup
    this.activePresets.set(presetId, { pattern, preset, instrument });
    console.log(`Playing preset: ${preset.name} (${preset.instrument}) in key ${this.rootNote} | Transport: ${Tone.Transport.state} | Context: ${Tone.context.state}`);
    return true;
  }

  /**
   * Stop a preset by ID
   * @param {string} presetId - Preset ID
   */
  stopPreset(presetId) {
    const active = this.activePresets.get(presetId);
    if (!active) return;

    // Remove from active immediately (prevents double-stop)
    this.activePresets.delete(presetId);
    console.log(`Stopped preset: ${presetId}`);

    const cleanup = () => {
      active.pattern.stop();
      active.pattern.dispose();
      this._disposePresetInstrument(active.instrument);

      // Stop transport if nothing playing
      if (this.activePresets.size === 0 && this.activePatterns.size === 0) {
        Tone.Transport.stop();
      }
    };

    // Apply fade-out if configured
    if (this.fadeOutTime > 0 && active.instrument._fadeGain) {
      active.instrument._fadeGain.gain.rampTo(0, this.fadeOutTime);
      setTimeout(cleanup, this.fadeOutTime * 1000 + 50);
    } else {
      cleanup();
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
   * @param {number} value - 0-1.25 normalized (25% louder max)
   */
  setMasterVolume(value) {
    this.masterVolume = Math.max(0, Math.min(1.25, value));
    if (this.masterGain) {
      this.masterGain.gain.value = this.masterVolume;
    }
  }

  /**
   * Get master volume (for UI state)
   */
  getMasterVolume() {
    return this.masterVolume;
  }

  /**
   * Set fade-in time for all instruments
   * @param {number} seconds - 0 to 5
   */
  setFadeIn(seconds) {
    this.fadeInTime = Math.max(0, Math.min(5, seconds));
  }

  /**
   * Set fade-out time for all instruments
   * @param {number} seconds - 0 to 5
   */
  setFadeOut(seconds) {
    this.fadeOutTime = Math.max(0, Math.min(5, seconds));
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

    // Dispose instruments and their effect chains
    for (const instrument of Object.values(this.instruments)) {
      // Clean up any attached effects
      if (instrument._channel) instrument._channel.dispose();
      if (instrument._filter) instrument._filter.dispose();
      if (instrument._saturator) instrument._saturator.dispose();
      if (instrument._dist) instrument._dist.dispose();
      if (instrument._chorus) instrument._chorus.dispose();
      if (instrument._comp) instrument._comp.dispose();
      if (instrument._hiPass) instrument._hiPass.dispose();
      if (instrument._reverbSend) instrument._reverbSend.dispose();
      if (instrument._delaySend) instrument._delaySend.dispose();
      instrument.dispose();
    }
    this.instruments = {};

    // Dispose effect buses
    if (this.reverbBus) {
      this.reverbBus.dispose();
      this.reverbBus = null;
    }
    if (this.delayBus) {
      this.delayBus.dispose();
      this.delayBus = null;
    }

    // Dispose master chain
    if (this.masterGain) {
      this.masterGain.dispose();
      this.masterGain = null;
    }
    if (this.masterCompressor) {
      this.masterCompressor.dispose();
      this.masterCompressor = null;
    }
    if (this.masterLimiter) {
      this.masterLimiter.dispose();
      this.masterLimiter = null;
    }
    this.initialized = false;
  }
}

// Export singleton instance
export const synthEngine = new SynthEngine();
