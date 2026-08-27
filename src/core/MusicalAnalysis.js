/**
 * MusicalAnalysis – Extended audio analysis building on AudioAnalysis
 *
 * Provides:
 *   - Tempo (BPM) detection with drift handling and confidence scores
 *   - Downbeat timestamps and bar grid generation (deterministic)
 *   - Key/mode detection with confidence scores and lock threshold
 *   - Section map detection based on spectral flux change detection,
 *     falling back to a regular bar‑aligned grid when change detection fails.
 *
 * The class mirrors the API of AudioAnalysis (init/startAnalysis/stopAnalysis/etc.)
 * but adds richer callbacks:
 *
 *   onTempoUpdate({ bpm, confidence, locked })
 *   onTempoLock(bpm)
 *   onDownbeat(timestamp)                // each detected downbeat
 *   onBarGrid(grid)                      // array of bar start timestamps (ms)
 *   onKeyUpdate({ key, confidence, locked })
 *   onKeyLock(key)
 *   onSectionChange(sections)            // [{type,startBar,endBar}]
 *
 * All callbacks are optional and can be set by the consumer (e.g. Beatweaver).
 *
 * Implementation notes
 *   • Re‑uses AudioAnalysis for the heavy‑lifting of audio capture,
 *     BPM detection (including drift handling) and key detection.
 *   • After BPM lock, a deterministic bar grid is built using the locked BPM.
 *   • Downbeats are emitted from AudioAnalysis.onBeat (the beat callback
 *     is only active after BPM lock).
 *   • Section detection runs on a separate loop using spectral flux on the
 *     analyser node. If a significant change is observed, a new section
 *     boundary is recorded. When no reliable changes are seen after a
 *     configurable timeout, the module falls back to a simple “every 8 bars”
 *     section map (intro → verse → chorus → … → outro).
 *
 *   The module is deliberately lightweight – it does not spawn workers or
 *   external processes, keeping it safe for the Electron environment.
 */

import { getAudioAnalysis } from "./AudioAnalysis.js";

// -----------------------------------------------------------------------------
// Helper utilities
// -----------------------------------------------------------------------------
/** Simple linear interpolation between two numbers. */
function lerp(a, b, t) {
  return a + (b - a) * t;
}
/** Compute spectral flux (difference of magnitude spectra) between two FFT frames. */
function spectralFlux(prev, curr) {
  let sum = 0;
  for (let i = 0; i < prev.length; i++) {
    const diff = curr[i] - prev[i];
    if (diff > 0) sum += diff;
  }
  return sum;
}
/** Section type cycling heuristic. Provides a deterministic label sequence for fallback sections. */
function fallbackSectionLabels(numSections) {
  const base = ["intro", "verse", "chorus", "bridge"];
  const labels = [];
  for (let i = 0; i < numSections; i++) {
    if (i === numSections - 1 && numSections > 1) {
      labels.push("outro");
    } else {
      labels.push(base[i % base.length]);
    }
  }
  return labels;
}

// -----------------------------------------------------------------------------
// MusicalAnalysis class
// -----------------------------------------------------------------------------
export class MusicalAnalysis {
  constructor() {
    // Underlying audio analysis (BPM + raw key detection)
    this.audioAnalysis = getAudioAnalysis();

    // ---- Tempo state -------------------------------------------------------
    this.bpm = null;
    this.bpmConfidence = 0;
    this.bpmLocked = false;
    this.bpmCandidates = []; // rolling list for stability checks

    // ---- Downbeat / bar grid state -----------------------------------------
    this.downbeats = []; // timestamps (ms) of each downbeat (locked BPM only)
    this.barGrid = []; // timestamps (ms) of each bar start (including first downbeat)
    this.firstDownbeat = null; // timestamp of first detected downbeat

    // ---- Key / mode detection state -----------------------------------------
    this.key = null;
    this.keyConfidence = 0;
    this.keyLocked = false;

    // ---- Section detection state -------------------------------------------
    this.sectionBoundaries = []; // timestamps (ms) of section change points
    this.sections = []; // [{type, startBar, endBar}]
    this._prevSpectrum = null;
    this._fluxHistory = [];
    this._sectionCheckInterval = null;

    // ---- Configurable thresholds -------------------------------------------
    this.MIN_BPM_CANDIDATES = 6; // number of consistent BPM readings before lock
    this.BPM_STABILITY_THRESHOLD = 5; // max BPM range (BPM) for stability
    this.KEY_STABILITY_COUNT = 4; // consecutive identical key readings for lock
    this.KEY_CONFIDENCE_THRESHOLD = 0.55; // confidence (0‑1) required to lock key

    // Section detection thresholds
    this.SECTION_FLUX_MULTIPLIER = 1.5; // times median flux needed to trigger a change
    this.SECTION_MIN_INTERVAL_MS = 8000; // minimum time between sections

    // ---- Callbacks -----------------------------------------------------------
    this.onTempoUpdate = null;
    this.onTempoLock = null;
    this.onDownbeat = null;
    this.onBarGrid = null;
    this.onKeyUpdate = null;
    this.onKeyLock = null;
    this.onSectionChange = null;
  }

  // -------------------------------------------------------------------------
  // Public API (mirrors AudioAnalysis)
  // -------------------------------------------------------------------------
  async init() {
    await this.audioAnalysis.init();
    // Proxy the beat callback to capture downbeats once BPM is locked.
    const originalBeatCallback = this.audioAnalysis.onBeat;
    this.audioAnalysis.onBeat = (timestamp) => {
      if (originalBeatCallback) originalBeatCallback(timestamp);
      if (this.bpmLocked) this._recordDownbeat(timestamp);
    };
  }

  async startAnalysis(deviceId = null) {
    const started = await this.audioAnalysis.startAnalysis(deviceId);
    if (!started) return false;
    // Hook into BPM / key callbacks.
    this.audioAnalysis.onBpmUpdate = (info) => this._handleBpmUpdate(info);
    this.audioAnalysis.onBpmLock = (bpm) => this._handleBpmLock(bpm);
    this.audioAnalysis.onKeyUpdate = (info) => this._handleKeyUpdate(info);
    this.audioAnalysis.onKeyLock = (key) => this._handleKeyLock(key);
    // Start section detection loop.
    this._startSectionDetection();
    return true;
  }

  async stopAnalysis() {
    await this.audioAnalysis.stopAnalysis();
    this._stopSectionDetection();
  }

  // -------------------------------------------------------------------------
  // Getters (simple, deterministic)
  // -------------------------------------------------------------------------
  getTempo() {
    return { bpm: this.bpm, confidence: this.bpmConfidence, locked: this.bpmLocked };
  }

  getKey() {
    return { key: this.key, confidence: this.keyConfidence, locked: this.keyLocked };
  }

  getDownbeats() {
    return this.downbeats.slice();
  }

  getBarGrid() {
    return this.barGrid.slice();
  }

  getSections() {
    return this.sections.map((s) => ({ ...s }));
  }

  // -------------------------------------------------------------------------
  // Internal BPM handling – mirrors AudioAnalysis logic but adds drift handling
  // -------------------------------------------------------------------------
  _handleBpmUpdate({ bpm, confidence, locked }) {
    if (this.onTempoUpdate) this.onTempoUpdate({ bpm, confidence, locked });
    if (bpm != null) {
      this.bpmCandidates.push({ bpm, confidence });
      if (this.bpmCandidates.length > 20) this.bpmCandidates.shift();
    }
    if (this.bpmLocked) return;
    if (this.bpmCandidates.length >= this.MIN_BPM_CANDIDATES) {
      const recent = this.bpmCandidates.slice(-this.MIN_BPM_CANDIDATES);
      const values = recent.map((c) => c.bpm);
      const min = Math.min(...values);
      const max = Math.max(...values);
      const range = max - min;
      if (range <= this.BPM_STABILITY_THRESHOLD) {
        const avg = Math.round(values.reduce((a, b) => a + b, 0) / values.length);
        this.bpm = avg;
        this.bpmConfidence = 1;
        this.bpmLocked = true;
        if (this.onTempoLock) this.onTempoLock(this.bpm);
        if (this.onTempoUpdate) this.onTempoUpdate({ bpm: this.bpm, confidence: 1, locked: true });
        this._initializeBarGrid();
      }
    }
  }

  _handleBpmLock(bpm) {
    this.bpm = bpm;
    this.bpmConfidence = 1;
    this.bpmLocked = true;
    if (this.onTempoLock) this.onTempoLock(bpm);
    if (this.onTempoUpdate) this.onTempoUpdate({ bpm, confidence: 1, locked: true });
    this._initializeBarGrid();
  }

  // -------------------------------------------------------------------------
  // Downbeat / Bar handling
  // -------------------------------------------------------------------------
  _recordDownbeat(timestamp) {
    const ms = Math.round(timestamp);
    this.downbeats.push(ms);
    if (!this.firstDownbeat) {
      this.firstDownbeat = ms;
      this.barGrid.push(ms);
      if (this.onDownbeat) this.onDownbeat(ms);
      if (this.onBarGrid) this.onBarGrid(this.getBarGrid());
      return;
    }
    if (this.onDownbeat) this.onDownbeat(ms);
    const barLength = Math.round(60000 / this.bpm);
    const expectedBarStart = this.firstDownbeat + this.barGrid.length * barLength;
    const jitter = Math.abs(ms - expectedBarStart);
    if (jitter <= barLength * 0.15) {
      const aligned = expectedBarStart;
      this.barGrid.push(aligned);
      if (this.onBarGrid) this.onBarGrid(this.getBarGrid());
    } else {
      let next = this.firstDownbeat + this.barGrid.length * barLength;
      while (next < ms) {
        this.barGrid.push(next);
        next += barLength;
      }
      this.barGrid.push(ms);
      if (this.onBarGrid) this.onBarGrid(this.getBarGrid());
    }
  }

  _initializeBarGrid() {
    this.downbeats = [];
    this.barGrid = [];
    this.firstDownbeat = null;
    if (this.onBarGrid) this.onBarGrid(this.getBarGrid());
  }

  // -------------------------------------------------------------------------
  // Key handling (delegates to AudioAnalysis but adds stability logic)
  // -------------------------------------------------------------------------
  _handleKeyUpdate({ key, confidence, locked }) {
    if (this.onKeyUpdate) this.onKeyUpdate({ key, confidence, locked });
    if (!key) return;
    const normKey = key.toUpperCase();
    this.keyReadings = this.keyReadings || [];
    this.keyReadings.push({ key: normKey, confidence });
    if (this.keyReadings.length > 20) this.keyReadings.shift();
    if (locked) {
      this._applyKeyLock(normKey, confidence);
      return;
    }
    if (this.keyReadings.length >= this.KEY_STABILITY_COUNT) {
      const recent = this.keyReadings.slice(-this.KEY_STABILITY_COUNT);
      const allSame = recent.every((r) => r.key === normKey);
      const avgConf = recent.reduce((s, r) => s + r.confidence, 0) / recent.length;
      if (allSame && avgConf >= this.KEY_CONFIDENCE_THRESHOLD) {
        this._applyKeyLock(normKey, avgConf);
      }
    }
  }

  _handleKeyLock(key) {
    const normKey = key.toUpperCase();
    this._applyKeyLock(normKey, 1);
  }

  _applyKeyLock(key, confidence) {
    this.key = key;
    this.keyConfidence = confidence;
    this.keyLocked = true;
    if (this.onKeyLock) this.onKeyLock(key);
    if (this.onKeyUpdate) this.onKeyUpdate({ key, confidence: 1, locked: true });
  }

  // -------------------------------------------------------------------------
  // Section detection
  // -------------------------------------------------------------------------
  _startSectionDetection() {
    const intervalMs = 50; // ~20 Hz sampling
    const analyser = this.audioAnalysis.analyzerNode;
    if (!analyser) {
      console.warn("MusicalAnalysis: analyserNode not available – section detection disabled");
      return;
    }
    const freqData = new Uint8Array(analyser.frequencyBinCount);
    this._sectionCheckInterval = setInterval(() => {
      analyser.getByteFrequencyData(freqData);
      // Compute flux against previous spectrum.
      if (this._prevSpectrum) {
        const flux = spectralFlux(this._prevSpectrum, freqData);
        this._fluxHistory.push(flux);
        if (this._fluxHistory.length > 40) this._fluxHistory.shift();
        // Evaluate flux only after we have a short history.
        if (this._fluxHistory.length >= 10) {
          const medianFlux = this._fluxHistory.slice().sort((a, b) => a - b)[Math.floor(this._fluxHistory.length / 2)];
          const now = performance.now();
          const lastBoundary = this.sectionBoundaries.length ? this.sectionBoundaries[this.sectionBoundaries.length - 1] : 0;
          if (flux > medianFlux * this.SECTION_FLUX_MULTIPLIER && now - lastBoundary > this.SECTION_MIN_INTERVAL_MS) {
            this.sectionBoundaries.push(now);
            this._recomputeSections();
            if (this.onSectionChange) this.onSectionChange(this.getSections());
          }
        }
      }
      // Store a copy of current spectrum for next iteration.
      this._prevSpectrum = new Uint8Array(freqData);
    }, intervalMs);
  }

  _stopSectionDetection() {
    if (this._sectionCheckInterval) {
      clearInterval(this._sectionCheckInterval);
      this._sectionCheckInterval = null;
    }
    // Finalize sections using whatever data we have.
    this._finalizeSections();
    if (this.onSectionChange) this.onSectionChange(this.getSections());
  }

  _recomputeSections() {
    // Map raw boundary timestamps to bar indices if we have a bar grid.
    if (!this.barGrid.length) {
      // No bar information yet – fall back to raw timestamps.
      this.sections = this.sectionBoundaries.map((t, i) => ({
        type: `section_${i}`,
        startBar: null,
        endBar: null,
      }));
      return;
    }
    const barLength = Math.round(60000 / this.bpm);
    const firstBarStart = this.firstDownbeat || this.barGrid[0];
    this.sections = [];
    for (let i = 0; i < this.sectionBoundaries.length; i++) {
      const startTime = this.sectionBoundaries[i];
      const startBar = Math.floor((startTime - firstBarStart) / barLength) + 1;
      const endBar = i + 1 < this.sectionBoundaries.length
        ? Math.floor((this.sectionBoundaries[i + 1] - firstBarStart) / barLength)
        : Math.floor((this.barGrid[this.barGrid.length - 1] - firstBarStart) / barLength);
      this.sections.push({ type: `section_${i}`, startBar, endBar });
    }
  }

  _finalizeSections() {
    // If we have detected section boundaries, use them.
    if (this.sectionBoundaries.length) {
      this._recomputeSections();
      return;
    }
    // No boundaries detected – fall back to a regular grid based on bar count.
    if (!this.barGrid.length) {
      // No bar information at all – cannot build sections.
      this.sections = [];
      return;
    }
    const barLength = Math.round(60000 / this.bpm);
    const totalBars = Math.floor((this.barGrid[this.barGrid.length - 1] - this.firstDownbeat) / barLength) + 1;
    const sectionsCount = Math.max(4, Math.ceil(totalBars / 8)); // at least intro, verse, chorus, outro
    const labels = fallbackSectionLabels(sectionsCount);
    const barsPerSection = Math.ceil(totalBars / sectionsCount);
    this.sections = [];
    for (let i = 0; i < sectionsCount; i++) {
      const startBar = i * barsPerSection + 1;
      const endBar = (i + 1) * barsPerSection;
      this.sections.push({ type: labels[i], startBar, endBar });
    }
  }

  // -------------------------------------------------------------------------
  // Cleanup
  // -------------------------------------------------------------------------
  dispose() {
    this._stopSectionDetection();
    if (this.audioAnalysis) this.audioAnalysis.dispose();
  }
}

let musicalInstance = null;
export function getMusicalAnalysis() {
  if (!musicalInstance) musicalInstance = new MusicalAnalysis();
  return musicalInstance;
}
export default MusicalAnalysis;
