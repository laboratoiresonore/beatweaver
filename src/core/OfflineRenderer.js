/**
 * OfflineRenderer — HEADLESS audio "scoring" for Beatweaver (Synergy #4)
 *
 * Renders a short audio clip from a Beatweaver preset to a WAV buffer with
 * NO browser, NO Electron window, and NO user gesture. This is the engine
 * behind the localhost `/score` endpoint (see src/server/score-server.js):
 * give it a mood/energy/category/bank (or an explicit preset id) plus
 * bpm/key/duration, get back a 16-bit PCM WAV Buffer.
 *
 * ── Why this does NOT use Tone.js ───────────────────────────────────────
 * The interactive app (SynthEngine.js / SynthFactory.js) builds its sound
 * with Tone.js on top of a *browser* AudioContext. Two hard blockers stop
 * that exact path from running head-less under bare Node:
 *
 *   1. Pure Node has no Web Audio API at all — `OfflineAudioContext` is
 *      `undefined`. (Verified: typeof globalThis.OfflineAudioContext ===
 *      'undefined' on Node v24.)
 *   2. Tone.js's published ESM build (`tone/build/esm/index.js`) uses
 *      EXTENSIONLESS relative imports (`./core/Global` not
 *      `./core/Global.js`). Vite/Vitest resolve those via a bundler plugin,
 *      but Node's native ESM resolver throws ERR_MODULE_NOT_FOUND. So
 *      `await import('tone')` fails under bare Node *even after* the audio
 *      globals are polyfilled. (Verified.)
 *
 * The minimal viable headless path is therefore: a real OfflineAudioContext
 * from the `node-web-audio-api` package (native Rust Web Audio impl,
 * dependency added for this feature) driving plain Web Audio nodes that
 * re-create the Beatweaver voices at scoring fidelity. The same code also
 * runs unchanged in a browser (it only touches the standard Web Audio API),
 * so a future in-app "export" button can reuse it via `Tone.getContext()`.
 *
 * The AudioContext class is INJECTED (see `resolveOfflineCtor`) so this
 * module has no hard import of node-web-audio-api — keeping it loadable in
 * environments where the global already exists (browser / jsdom).
 *
 * WAV encoding reuses voice-companion/src/wav-wrap.js — the same audited
 * RIFF header used by the TTS companion (Synergy parity).
 */

import { wrapPcmAsWav } from '../../voice-companion/src/wav-wrap.js';
import {
  getPresetById,
  getAllPresets,
  getPattern,
  PRESETS,
} from '../presets/index.js';

// ── Note → frequency ────────────────────────────────────────────────────
// Self-contained (NOT Transposer.js, which imports Tone). Equal-tempered,
// A4 = 440 Hz. Accepts scientific-pitch note names like "C2", "F#3", "Bb1".
const SEMITONE_FROM_C = {
  C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5,
  'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11,
};

/** Parse "C#3" → { pc: 1, octave: 3 }, or null for unparseable input. */
function parseNote(note) {
  const m = /^([A-G])(#|b)?(-?\d+)$/.exec(note);
  if (!m) return null;
  const letter = m[1];
  const accidental = m[2] || '';
  const octave = parseInt(m[3], 10);
  const pc = SEMITONE_FROM_C[letter + accidental];
  if (pc === undefined) return null;
  return { pc, octave };
}

/**
 * Note name → frequency in Hz, transposed by `semitoneShift`.
 * MIDI: C4 = 60 = 261.63 Hz. midi = (octave+1)*12 + pitchClass.
 */
function noteToFreq(note, semitoneShift = 0) {
  const parsed = parseNote(note);
  if (!parsed) return null;
  const midi = (parsed.octave + 1) * 12 + parsed.pc + semitoneShift;
  return 440 * Math.pow(2, (midi - 69) / 12);
}

/** Semitone offset of a key root from C (e.g. "A" → 9, "F#m" → 6). */
function keyToSemitoneShift(key) {
  if (!key) return 0;
  const root = String(key).replace(/m$/, '').trim();
  return SEMITONE_FROM_C[root] ?? 0;
}

// ── Mood/energy → category/bank heuristics ──────────────────────────────
// The /score caller speaks in vibe terms (mood, energy). Map those onto the
// preset taxonomy. Explicit category/bank/preset always win over the vibe
// mapping. Energy (0..1) biases toward higher-intensity presets.
const MOOD_TO_CATEGORY = {
  dark: 'TEXTURE',
  bright: 'ENERGY',
  dreamy: 'TEXTURE',
  aggressive: 'BASS',
  hype: 'ENERGY',
  chill: 'TEXTURE',
  heavy: 'BASS',
  fx: 'FX',
  weird: 'FX',
};

const VALID_CATEGORIES = ['BASS', 'ENERGY', 'TEXTURE', 'FX'];

/**
 * Resolve the request shape → a concrete preset object.
 * Precedence: explicit `preset` id → (category[+bank][+energy]) → mood → default.
 * Always returns a valid preset (never null) so the server can't 500 on a
 * bad vibe string.
 *
 * @param {object} req
 * @param {string} [req.preset]   explicit preset id (e.g. 'PUMP_IT_UP')
 * @param {string} [req.category] BASS | ENERGY | TEXTURE | FX
 * @param {string} [req.bank]     A | B
 * @param {string} [req.mood]     free-form vibe word (see MOOD_TO_CATEGORY)
 * @param {number} [req.energy]   0..1, biases preset choice within a category
 * @returns {{preset: object, reason: string}}
 */
export function selectPreset(req = {}) {
  const all = getAllPresets();

  // 1. Explicit preset id.
  if (req.preset) {
    const direct = getPresetById(req.preset);
    if (direct) return { preset: direct, reason: `explicit preset ${req.preset}` };
  }

  // 2. Category (explicit, or derived from mood).
  let category = null;
  if (req.category && VALID_CATEGORIES.includes(String(req.category).toUpperCase())) {
    category = String(req.category).toUpperCase();
  } else if (req.mood && MOOD_TO_CATEGORY[String(req.mood).toLowerCase()]) {
    category = MOOD_TO_CATEGORY[String(req.mood).toLowerCase()];
  }

  const bank = req.bank && /^[AB]$/i.test(req.bank) ? req.bank.toUpperCase() : null;

  let pool = all;
  if (category) pool = pool.filter((p) => p.category === category);
  if (bank) {
    const banked = pool.filter((p) => p.bank === bank);
    if (banked.length) pool = banked;
  }
  if (!pool.length) pool = all;

  // 3. Energy biases the row pick within the pool. Presets are authored
  //    roughly low→high intensity down the rows; map energy 0..1 onto the
  //    pool index so "more energy" reaches for later/heavier presets.
  const energy = clamp01(num(req.energy, 0.5));
  const idx = Math.min(pool.length - 1, Math.round(energy * (pool.length - 1)));
  const preset = pool[idx];

  const reason =
    `category=${category || 'any'} bank=${bank || 'any'} energy=${energy.toFixed(2)} → ${preset.id}`;
  return { preset, reason };
}

// ── Voice synthesis ─────────────────────────────────────────────────────
// Per preset.instrument, schedule Web Audio nodes onto an OfflineAudioContext.
// This is a scoring-fidelity reduction of SynthEngine's instruments — enough
// to be recognizably the right preset, not a sample-accurate reproduction.

const INTERVAL_TO_BEATS = {
  '1m': 4, '2m': 8, '2n': 2, '4n': 1, '8n': 0.5, '16n': 0.25, '32n': 0.125,
};

function intervalToSeconds(interval, secondsPerBeat) {
  return (INTERVAL_TO_BEATS[interval] ?? 0.5) * secondsPerBeat;
}

/**
 * Schedule one preset's pattern across the whole render window, looping the
 * pattern until `durationSec` is filled.
 */
function schedulePreset(ctx, master, preset, pattern, opts) {
  const { secondsPerBeat, durationSec, semitoneShift } = opts;
  const stepSec = intervalToSeconds(pattern.interval, secondsPerBeat);
  const noteDurSec = Math.max(
    0.03,
    intervalToSeconds(pattern.duration, secondsPerBeat)
  );
  const notes = pattern.notes;
  if (!notes || !notes.length || stepSec <= 0) return;

  const instrument = preset.instrument || 'lead';
  let t = 0;
  let step = 0;
  // Cap total scheduled events so a tiny interval + long duration can't
  // schedule a runaway number of nodes (defensive — bounds CPU/time).
  const MAX_EVENTS = 4096;
  let events = 0;

  while (t < durationSec && events < MAX_EVENTS) {
    const note = notes[step % notes.length];
    if (note !== null && note !== undefined) {
      const startAt = t;
      if (note === 'x') {
        // Percussion / noise hit (non-pitched).
        scheduleNoiseHit(ctx, master, startAt, noteDurSec, instrument);
        events++;
      } else {
        const noteList = Array.isArray(note) ? note : [note];
        for (const n of noteList) {
          const freq = noteToFreq(n, semitoneShift);
          if (freq) {
            scheduleTone(ctx, master, freq, startAt, noteDurSec, instrument);
            events++;
          }
        }
      }
    }
    step++;
    t += stepSec;
  }
}

/** A pitched voice. Oscillator type + filter loosely follow the instrument. */
function scheduleTone(ctx, master, freq, startAt, dur, instrument) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const filter = ctx.createBiquadFilter();

  // Instrument → timbre. Mirrors the spirit of SynthEngine voices.
  let oscType = 'sawtooth';
  let cutoff = 1800;
  let q = 1;
  let peak = 0.35;
  let attack = 0.005;
  let release = 0.08;

  switch (instrument) {
    case 'acidBass':
      oscType = 'sawtooth'; cutoff = 700; q = 8; peak = 0.5;
      attack = 0.003; release = 0.12;
      break;
    case 'stab':
      oscType = 'square'; cutoff = 4000; q = 1; peak = 0.3;
      attack = 0.002; release = 0.18;
      break;
    case 'arp':
      oscType = 'triangle'; cutoff = 3000; q = 2; peak = 0.28;
      attack = 0.002; release = 0.12;
      break;
    case 'pad':
      oscType = 'sine'; cutoff = 2200; q = 1; peak = 0.22;
      attack = 0.12; release = 0.5;
      break;
    case 'lead':
      oscType = 'sawtooth'; cutoff = 2600; q = 2.5; peak = 0.32;
      attack = 0.008; release = 0.2;
      break;
    default:
      break;
  }

  osc.type = oscType;
  osc.frequency.value = freq;
  filter.type = 'lowpass';
  filter.frequency.value = cutoff;
  filter.Q.value = q;

  // ADSR-ish envelope (linear attack, exponential-ish release via ramps).
  const a = Math.min(attack, dur * 0.5);
  gain.gain.setValueAtTime(0.0001, startAt);
  gain.gain.linearRampToValueAtTime(peak, startAt + a);
  gain.gain.setValueAtTime(peak, startAt + Math.max(a, dur - release));
  gain.gain.linearRampToValueAtTime(0.0001, startAt + dur + release);

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(master);

  osc.start(startAt);
  osc.stop(startAt + dur + release + 0.02);
}

/** A non-pitched percussive hit via a short white-noise burst. */
function scheduleNoiseHit(ctx, master, startAt, dur, instrument) {
  const len = Math.max(1, Math.floor(ctx.sampleRate * Math.min(dur, 0.25)));
  const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;

  const src = ctx.createBufferSource();
  src.buffer = buffer;

  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = instrument === 'perc' ? 2500 : 1800;
  filter.Q.value = 1.2;

  const gain = ctx.createGain();
  const peak = 0.4;
  const a = 0.001;
  gain.gain.setValueAtTime(0.0001, startAt);
  gain.gain.linearRampToValueAtTime(peak, startAt + a);
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + Math.max(0.02, dur));

  src.connect(filter);
  filter.connect(gain);
  gain.connect(master);
  src.start(startAt);
  src.stop(startAt + Math.min(dur, 0.25) + 0.01);
}

// ── Float → 16-bit PCM ──────────────────────────────────────────────────
/** Mix down an AudioBuffer's channels to interleaved 16-bit LE PCM Buffer. */
function audioBufferToPcm16(audioBuffer) {
  const channels = audioBuffer.numberOfChannels;
  const frames = audioBuffer.length;
  const chData = [];
  for (let c = 0; c < channels; c++) chData.push(audioBuffer.getChannelData(c));

  const out = Buffer.alloc(frames * channels * 2);
  let offset = 0;
  for (let i = 0; i < frames; i++) {
    for (let c = 0; c < channels; c++) {
      let s = chData[c][i];
      // Clamp then scale to int16.
      s = Math.max(-1, Math.min(1, s));
      out.writeInt16LE((s < 0 ? s * 0x8000 : s * 0x7fff) | 0, offset);
      offset += 2;
    }
  }
  return out;
}

// ── AudioContext resolution ─────────────────────────────────────────────
/**
 * Resolve an OfflineAudioContext constructor. Priority:
 *   1. caller-supplied `OfflineAudioCtor` (tests / browser inject)
 *   2. globalThis.OfflineAudioContext (browser / jsdom)
 *   3. dynamic import of node-web-audio-api (headless Node)
 * Throws a clear, actionable error if none is available.
 */
export async function resolveOfflineCtor(OfflineAudioCtor) {
  if (OfflineAudioCtor) return OfflineAudioCtor;
  if (typeof globalThis.OfflineAudioContext === 'function') {
    return globalThis.OfflineAudioContext;
  }
  try {
    const mod = await import('node-web-audio-api');
    if (mod && typeof mod.OfflineAudioContext === 'function') {
      return mod.OfflineAudioContext;
    }
    throw new Error('node-web-audio-api loaded but has no OfflineAudioContext');
  } catch (err) {
    throw new Error(
      'No OfflineAudioContext available for headless rendering. Pure Node has ' +
      'no Web Audio API. Install the polyfill: `npm install node-web-audio-api`. ' +
      `Underlying error: ${err.message}`
    );
  }
}

// ── small helpers ───────────────────────────────────────────────────────
function num(v, fallback) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}
function clamp01(v) {
  return Math.max(0, Math.min(1, v));
}

/**
 * Render a Beatweaver preset to a WAV Buffer, head-less.
 *
 * @param {object} req
 * @param {string} [req.preset]      explicit preset id
 * @param {string} [req.category]    BASS | ENERGY | TEXTURE | FX
 * @param {string} [req.bank]        A | B
 * @param {string} [req.mood]        vibe word (mapped to a category)
 * @param {number} [req.energy]      0..1
 * @param {number} [req.bpm]         tempo (default 120, clamped 40..240)
 * @param {string} [req.key]         musical key root, e.g. 'A', 'F#m' (default C)
 * @param {number} [req.duration_ms] clip length in ms (default 2000, 250..30000)
 * @param {number} [req.sampleRate]  output sample rate (default 44100)
 * @param {number} [req.channels]    output channels (default 1)
 * @param {Function} [req.OfflineAudioCtor] inject an OfflineAudioContext ctor
 * @returns {Promise<{wav: Buffer, meta: object}>}
 */
export async function renderScore(req = {}) {
  const OfflineCtor = await resolveOfflineCtor(req.OfflineAudioCtor);

  const { preset, reason } = selectPreset(req);
  const pattern = getPattern(preset.pattern);
  if (!pattern) {
    throw new Error(`Preset ${preset.id} references unknown pattern ${preset.pattern}`);
  }

  const bpm = Math.max(40, Math.min(240, Math.round(num(req.bpm, 120))));
  const durationMs = Math.max(250, Math.min(30000, Math.round(num(req.duration_ms, 2000))));
  const durationSec = durationMs / 1000;
  const sampleRate = Math.max(8000, Math.min(48000, Math.round(num(req.sampleRate, 44100))));
  const channels = num(req.channels, 1) >= 2 ? 2 : 1;
  const semitoneShift = keyToSemitoneShift(req.key);
  const secondsPerBeat = 60 / bpm;

  // Tail headroom so the final note's release isn't truncated.
  const tailSec = 0.3;
  const totalFrames = Math.ceil((durationSec + tailSec) * sampleRate);

  const ctx = new OfflineCtor(channels, totalFrames, sampleRate);

  // Master chain: gain → soft limiter (compressor) → destination.
  const master = ctx.createGain();
  master.gain.value = 0.9;
  let tail = master;
  if (typeof ctx.createDynamicsCompressor === 'function') {
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -6;
    comp.ratio.value = 4;
    master.connect(comp);
    comp.connect(ctx.destination);
  } else {
    master.connect(ctx.destination);
  }

  schedulePreset(ctx, master, preset, pattern, {
    secondsPerBeat,
    durationSec,
    semitoneShift,
  });

  const audioBuffer = await ctx.startRendering();
  const pcm = audioBufferToPcm16(audioBuffer);
  const wav = wrapPcmAsWav(pcm, {
    sampleRate,
    channels,
    bitsPerSample: 16,
  });

  return {
    wav,
    meta: {
      presetId: preset.id,
      presetName: preset.name,
      category: preset.category,
      bank: preset.bank,
      instrument: preset.instrument,
      pattern: preset.pattern,
      bpm,
      key: req.key || 'C',
      duration_ms: durationMs,
      sampleRate,
      channels,
      bytes: wav.length,
      selection: reason,
    },
  };
}

export default { renderScore, selectPreset, resolveOfflineCtor };
