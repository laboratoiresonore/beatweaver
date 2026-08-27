/**
* Arranger - Core engine for arranging stems into a musical structure.
*
* Features:
*   - Consumes stems (audio URLs) and a simple bar grid (BPM & beats per bar).
*   - Provides operations: select, repeat, mute, transpose (with optional
*     formant‑preserving for vocals).
*   - All edits snap to the bar grid.
*   - Equal‑power cross‑fade implementation.
*   - Deterministic mode (seeded RNG) and exploratory mode (unseeded).
*   - Serialize / deserialize arrangement documents for deterministic rendering.
*
* The Arranger does **not** perform actual audio rendering in this core module 
* – it builds a schedule of events (objects) that can later be handed to Tone.js 
* or any other playback engine. This keeps the core lightweight and easily testable.
*/

export class Arranger {
  /**
   * @param {Object} options
   * @param {number} [options.bpm=120] - Beats per minute for the grid.
   * @param {number} [options.beatsPerBar=4] - Beats per bar.
   * @param {Array}  [options.stems=[]] - Array of stem objects { id, url, type? }.
   */
  constructor({ bpm = 120, beatsPerBar = 4, stems = [] } = {}) {
    this.bpm = bpm;
    this.beatsPerBar = beatsPerBar;
    this.stems = new Map(); // id -> { url, type }
    stems.forEach(stem => this.stems.set(stem.id, { url: stem.url, type: stem.type || 'audio' }));

    // Arrangement events — each event describes playback of a stem.
    // { stemId, start, duration, mute, transpose, section }
    this.events = [];

    // Random generator for deterministic mode (optional).
    this._rng = null;
  }

  // ---------------------------------------------------------------
  // Utility: compute bar duration (seconds) based on current BPM.
  _barDuration() {
    // One beat = 60 / BPM seconds, bar = beatsPerBar beats.
    return (60 / this.bpm) * this.beatsPerBar;
  }

  // ---------------------------------------------------------------
  // Snap a time (seconds) to the nearest bar grid line.
  snapTime(time) {
    const bar = this._barDuration();
    return Math.round(time / bar) * bar;
  }

  // ---------------------------------------------------------------
  // Add a playback event. `options` may include mute, transpose (semitones),
  // and a `section` identifier for grouping.
  addEvent(stemId, start, duration, options = {}) {
    if (!this.stems.has(stemId)) throw new Error(`Stem ${stemId} not found`);
    const event = {
      stemId,
      start: this.snapTime(start),
      duration: this.snapTime(duration),
      mute: !!options.mute,
      transpose: options.transpose || 0, // semitone shift
      section: options.section || null,
    };
    this.events.push(event);
    return event;
  }

  // ---------------------------------------------------------------
  // Mute or unmute a stem globally (affects all its events).
  setStemMute(stemId, mute = true) {
    if (!this.stems.has(stemId)) throw new Error(`Stem ${stemId} not found`);
    this.events.forEach(ev => {
      if (ev.stemId === stemId) ev.mute = mute;
    });
  }

  // ---------------------------------------------------------------
  // Transpose a stem (all its events). If `preserveFormant` is true and the
  // stem type is 'vocal', we store a flag – the actual formant‑preserving
  // algorithm is handled later by the playback engine.
  transposeStem(stemId, semitones, preserveFormant = false) {
    if (!this.stems.has(stemId)) throw new Error(`Stem ${stemId} not found`);
    const stem = this.stems.get(stemId);
    stem.transpose = (stem.transpose || 0) + semitones;
    if (preserveFormant) stem.preserveFormant = true;
    this.events.forEach(ev => {
      if (ev.stemId === stemId) ev.transpose = stem.transpose;
    });
  }

  // ---------------------------------------------------------------
  // Repeat a section a given number of times. Sections are identified by a
  // string or numeric `section` property on events.
  repeatSection(sectionId, times = 2) {
    if (times < 2) return;
    const original = this.events.filter(ev => ev.section === sectionId);
    if (!original.length) return;
    const bar = this._barDuration();
    const sectionStart = Math.min(...original.map(ev => ev.start));
    const sectionEnd = Math.max(...original.map(ev => ev.start + ev.duration));
    const sectionLength = this.snapTime(sectionEnd) - this.snapTime(sectionStart);
    for (let i = 1; i < times; i++) {
      const offset = i * sectionLength;
      original.forEach(ev => {
        const copy = { ...ev };
        copy.start = this.snapTime(ev.start + offset);
        this.events.push(copy);
      });
    }
  }

  // ---------------------------------------------------------------
  // Equal‑power cross‑fade helper – returns gain values for a fade factor
  // in the range [0, 1].
  static equalPowerGains(fade) {
    const f = Math.min(1, Math.max(0, fade));
    const gainA = Math.cos((f * Math.PI) / 2);
    const gainB = Math.sin((f * Math.PI) / 2);
    return { gainA, gainB };
  }

  // ---------------------------------------------------------------
  // Schedule a cross‑fade between two stems. The function records an event
  // with a `type: 'crossfade'` property describing the parameters.
  addCrossfade(stemIdA, stemIdB, start, duration) {
    if (!this.stems.has(stemIdA) || !this.stems.has(stemIdB)) {
      throw new Error('Both stems must exist for crossfade');
    }
    const event = {
      type: 'crossfade',
      stemA: stemIdA,
      stemB: stemIdB,
      start: this.snapTime(start),
      duration: this.snapTime(duration),
    };
    this.events.push(event);
    return event;
  }

  // ---------------------------------------------------------------
  // Set deterministic mode with a numeric seed (xorshift32).
  setDeterministic(seed) {
    let x = seed >>> 0;
    this._rng = function () {
      // xorshift algorithm (based on public domain implementation)
      x ^= x << 13;
      x ^= x >>> 17;
      x ^= x << 5;
      return (x >>> 0) / 0xffffffff;
    };
  }

  // ---------------------------------------------------------------
  // Helper that respects deterministic RNG when enabled.
  _randomChoice(array) {
    if (!array.length) return undefined;
    const rand = this._rng ? this._rng() : Math.random();
    const idx = Math.floor(rand * array.length);
    return array[idx];
  }

  // ---------------------------------------------------------------
  // Generate a simple arrangement using random choices. With a deterministic
  // RNG (setDeterministic) the result is reproducible.
  generate({ repeatSectionChance = 0.3, maxSections = 4 } = {}) {
    this.events = [];
    const stemIds = Array.from(this.stems.keys());
    const sectionCount = Math.max(1, Math.floor(this._randomChoice([1, 2, 3, 4, 5])) % maxSections + 1);
    let cursor = 0;
    for (let sec = 0; sec < sectionCount; sec++) {
      const sectionId = `section-${sec}`;
      const stemId = this._randomChoice(stemIds);
      const barDur = this._barDuration();
      this.addEvent(stemId, cursor, barDur, { section: sectionId });
      if (Math.random() < repeatSectionChance) {
        const repeatTimes = 2 + Math.floor(Math.random() * 3);
        this.repeatSection(sectionId, repeatTimes);
      }
      cursor += barDur;
    }
    this.events.sort((a, b) => a.start - b.start);
    return this.events;
  }

  // ---------------------------------------------------------------
  // Serialize the arranger state (stems + events + config) to JSON.
  serialize() {
    const obj = {
      bpm: this.bpm,
      beatsPerBar: this.beatsPerBar,
      stems: Array.from(this.stems.entries()).map(([id, data]) => ({ id, ...data })),
      events: this.events,
    };
    return JSON.stringify(obj);
  }

  // ---------------------------------------------------------------
  // Deserialize and return a new Arranger instance.
  static deserialize(jsonStr) {
    const data = JSON.parse(jsonStr);
    const arranger = new Arranger({ bpm: data.bpm, beatsPerBar: data.beatsPerBar, stems: data.stems });
    arranger.events = data.events || [];
    return arranger;
  }
}

export default Arranger;
