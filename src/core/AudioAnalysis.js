/**
 * AudioAnalysis - BPM and Key detection using realtime-bpm-analyzer
 *
 * Uses proven library for BPM detection + custom key detection
 * Lock-once-confident behavior for both
 */
import { createRealTimeBpmProcessor } from 'realtime-bpm-analyzer';

export class AudioAnalysis {
  constructor() {
    this.audioContext = null;
    this.analyzerNode = null;
    this.sourceNode = null;
    this.stream = null;
    this.animationFrame = null;

    // BPM processor node (realtime-bpm-analyzer v3)
    this.bpmAnalyserNode = null;

    // BPM state
    this.bpm = null;
    this.bpmConfidence = 0;
    this.bpmLocked = false;
    this.bpmCandidates = []; // Store tempo candidates for stability check

    // Key state
    this.key = null;
    this.keyConfidence = 0;
    this.keyLocked = false;
    this.chromaAccumulator = new Array(12).fill(0);
    this.chromaSamples = 0;

    // Beat detection for visual feedback (only when locked)
    this.lastBeatTime = 0;
    this.beatInterval = null;

    // Callbacks
    this.onBpmUpdate = null;
    this.onKeyUpdate = null;
    this.onBpmLock = null;
    this.onKeyLock = null;
    this.onBeat = null;
    this.onError = null;

    // Config
    this.MIN_BPM_CANDIDATES = 5;         // Need consistent readings before lock
    this.BPM_STABILITY_THRESHOLD = 3;    // Lock if top candidates within 3 BPM
    this.MIN_CHROMA_SAMPLES = 300;       // ~5 seconds at 60fps per key analysis window
    this.KEY_STABILITY_COUNT = 3;        // Need same key detected 3 times in a row before lock
    this.KEY_CONFIDENCE_THRESHOLD = 0.70; // 70% confidence required
    // Total key detection time: 3 windows × 5 seconds = ~15 seconds (comparable to BPM)

    // Key stability tracking
    this.keyReadings = [];
  }

  async init() {
    if (this.audioContext) return;
    this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
      sampleRate: 44100
    });
  }

  async getAudioDevices() {
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
      const devices = await navigator.mediaDevices.enumerateDevices();
      return devices
        .filter(d => d.kind === 'audioinput')
        .map(d => ({
          id: d.deviceId,
          label: d.label || `Microphone ${d.deviceId.slice(0, 8)}`
        }));
    } catch (err) {
      console.error('Failed to get audio devices:', err);
      this.onError?.('microphone_permission_denied');
      return [];
    }
  }

  async startAnalysis(deviceId = null) {
    if (!this.audioContext) await this.init();
    if (this.audioContext.state === 'suspended') await this.audioContext.resume();

    try {
      const constraints = {
        audio: {
          deviceId: deviceId ? { exact: deviceId } : undefined,
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false
        }
      };

      this.stream = await navigator.mediaDevices.getUserMedia(constraints);
      this.sourceNode = this.audioContext.createMediaStreamSource(this.stream);

      // Setup analyzer for key detection and beat visualization
      this.analyzerNode = this.audioContext.createAnalyser();
      this.analyzerNode.fftSize = 4096;
      this.analyzerNode.smoothingTimeConstant = 0.3;
      this.sourceNode.connect(this.analyzerNode);

      // Reset state
      this._resetState();

      // Try AudioWorklet first (uses reliable realtime-bpm-analyzer library)
      // Falls back to onset detection if AudioWorklet fails (e.g. in some Electron versions)
      try {
        await this._setupBpmAnalyzer();
      } catch (err) {
        console.warn('AudioWorklet BPM analyzer failed, using fallback:', err);
        this._startFallbackBpmDetection();
      }

      // Start key detection loop
      this._startKeyDetectionLoop();

      console.log('Audio analysis started');
      return true;
    } catch (err) {
      console.error('Failed to start audio analysis:', err);
      this.onError?.('audio_start_failed');
      return false;
    }
  }

  async _setupBpmAnalyzer() {
    try {
      // Create the BPM AudioWorklet processor
      // v3 API: createRealTimeBpmProcessor(audioContext) returns AudioWorkletNode
      const realtimeAnalyzerNode = await createRealTimeBpmProcessor(this.audioContext);

      this.bpmAnalyserNode = realtimeAnalyzerNode;

      // Send configuration via postMessage (v3 API)
      realtimeAnalyzerNode.port.postMessage({
        message: 'ASYNC_CONFIGURATION',
        parameters: {
          continuousAnalysis: true,
          stabilizationTime: 10000, // 10 seconds for stable reading
        }
      });

      // Connect source directly to the worklet node
      this.sourceNode.connect(realtimeAnalyzerNode);

      // v3 API: use .port.onmessage
      // Message format: event.data.message ('BPM' or 'BPM_STABLE'), event.data.result
      realtimeAnalyzerNode.port.onmessage = (event) => {
        const { message, result } = event.data;

        // Debug logging
        if (message === 'BPM' || message === 'BPM_STABLE') {
          console.log('BPM event:', message, result?.bpm?.[0] || result);
        }

        if (message === 'BPM') {
          this._handleBpmResult(result);
        } else if (message === 'BPM_STABLE') {
          this._handleStableBpm(result);
        }
      };

      // Safety timeout: if no BPM detected after 8 seconds, fall back
      this._workletTimeout = setTimeout(() => {
        if (!this.bpmLocked && this.bpmCandidates.length === 0) {
          console.warn('No BPM data from worklet after 8s, switching to fallback');
          this._startFallbackBpmDetection();
        }
      }, 8000);

      console.log('BPM analyzer worklet initialized');
    } catch (err) {
      console.warn('AudioWorklet BPM analyzer failed, using fallback:', err);
      // Fallback to simple beat detection
      this._startFallbackBpmDetection();
    }
  }

  _handleBpmResult(result) {
    if (this.bpmLocked) return;

    // Clear the fallback timeout since we're getting data
    if (this._workletTimeout) {
      clearTimeout(this._workletTimeout);
      this._workletTimeout = null;
    }

    // v3 API: result.bpm is array of { tempo, count, confidence }
    const candidates = result?.bpm || [];
    if (candidates.length === 0) return;

    // Get top candidate (highest confidence)
    const topCandidate = candidates[0];
    if (!topCandidate || topCandidate.tempo === undefined) return;

    let detectedBpm = Math.round(topCandidate.tempo);
    const confidence = topCandidate.confidence || 0;

    // Normalize to 60-180 range
    while (detectedBpm < 60) detectedBpm *= 2;
    while (detectedBpm > 180) detectedBpm /= 2;

    this.bpm = detectedBpm;
    this.bpmConfidence = confidence;

    // Store for stability check
    this.bpmCandidates.push(detectedBpm);
    if (this.bpmCandidates.length > 20) this.bpmCandidates.shift();

    // Check stability
    if (this.bpmCandidates.length >= this.MIN_BPM_CANDIDATES) {
      this._checkBpmStability();
    }

    this.onBpmUpdate?.({ bpm: this.bpm, confidence: this.bpmConfidence, locked: false });

    // Don't trigger beat callbacks until BPM is locked - too unreliable otherwise
  }

  _handleStableBpm(result) {
    if (this.bpmLocked) return;

    // v3 API: result.bpm is array of { tempo, count, confidence }
    // BPM_STABLE is sent when the analyzer is confident about the BPM
    const candidates = result?.bpm || [];
    if (candidates.length === 0) return;

    const topCandidate = candidates[0];
    if (!topCandidate || topCandidate.tempo === undefined) return;

    let stableBpm = Math.round(topCandidate.tempo);

    // Normalize
    while (stableBpm < 60) stableBpm *= 2;
    while (stableBpm > 180) stableBpm /= 2;

    this.bpm = stableBpm;
    this.bpmConfidence = 1;
    this.bpmLocked = true;

    console.log(`BPM LOCKED at ${this.bpm} (stable from analyzer)`);
    this.onBpmLock?.(this.bpm);
    this.onBpmUpdate?.({ bpm: this.bpm, confidence: 1, locked: true });

    // Start beat interval for visual feedback
    this._startBeatInterval();
  }

  _checkBpmStability() {
    if (this.bpmLocked) return;

    // Check if recent readings are stable
    const recent = this.bpmCandidates.slice(-10);
    const min = Math.min(...recent);
    const max = Math.max(...recent);
    const range = max - min;

    if (range <= this.BPM_STABILITY_THRESHOLD) {
      // Calculate average of recent readings
      const avg = recent.reduce((a, b) => a + b, 0) / recent.length;
      this.bpm = Math.round(avg);
      this.bpmConfidence = 1;
      this.bpmLocked = true;

      console.log(`BPM LOCKED at ${this.bpm} (stability check, range: ${range})`);
      this.onBpmLock?.(this.bpm);
      this.onBpmUpdate?.({ bpm: this.bpm, confidence: 1, locked: true });

      // Start beat interval for visual feedback
      this._startBeatInterval();
    }
  }

  _startBeatInterval() {
    this._stopBeatInterval();

    if (!this.bpm || !this.bpmLocked) return;

    const beatMs = 60000 / this.bpm;
    console.log(`Starting beat interval at ${this.bpm} BPM (${Math.round(beatMs)}ms per beat)`);

    this.beatInterval = setInterval(() => {
      const now = performance.now();
      this.lastBeatTime = now;
      if (this.onBeat) {
        this.onBeat(now);
      }
    }, beatMs);

    // Trigger first beat immediately
    const now = performance.now();
    this.lastBeatTime = now;
    if (this.onBeat) {
      console.log('Triggering first beat callback');
      this.onBeat(now);
    } else {
      console.warn('onBeat callback not registered!');
    }
  }

  _stopBeatInterval() {
    if (this.beatInterval) {
      clearInterval(this.beatInterval);
      this.beatInterval = null;
    }
  }

  _startFallbackBpmDetection() {
    // Fallback using simple onset detection
    console.log('Using fallback BPM detection');
    this.fallbackMode = true;
    this.energyHistory = [];
    this.beatTimes = [];
    this.threshold = 0;

    const frequencyData = new Uint8Array(this.analyzerNode.frequencyBinCount);

    const detectBeats = () => {
      if (!this.analyzerNode || this.bpmLocked) {
        if (!this.bpmLocked) {
          this.fallbackFrame = requestAnimationFrame(detectBeats);
        }
        return;
      }

      this.analyzerNode.getByteFrequencyData(frequencyData);
      const now = performance.now();

      // Calculate bass energy (0-200 Hz)
      let bassEnergy = 0;
      for (let i = 0; i < 10; i++) {
        bassEnergy += frequencyData[i];
      }
      bassEnergy /= 10;

      // Total energy
      let totalEnergy = 0;
      for (let i = 0; i < frequencyData.length; i++) {
        totalEnergy += frequencyData[i];
      }
      totalEnergy /= frequencyData.length;

      const energy = bassEnergy * 0.7 + totalEnergy * 0.3;

      this.energyHistory.push(energy);
      if (this.energyHistory.length > 43) this.energyHistory.shift();

      if (this.energyHistory.length >= 10) {
        const avg = this.energyHistory.reduce((a, b) => a + b, 0) / this.energyHistory.length;
        const variance = this.energyHistory.reduce((sum, e) => sum + Math.pow(e - avg, 2), 0) / this.energyHistory.length;
        const stdDev = Math.sqrt(variance);
        const adaptiveThreshold = avg + (stdDev * 1.3);

        this.threshold = Math.max(this.threshold * 0.98, adaptiveThreshold);

        const timeSinceLastBeat = now - this.lastBeatTime;

        if (energy > this.threshold && timeSinceLastBeat > 250) {
          this.lastBeatTime = now;
          this.threshold = energy * 1.2;
          // Flash beat indicator during detection (visual feedback before lock)
          this.onBeat?.(now);

          if (timeSinceLastBeat >= 250 && timeSinceLastBeat <= 1500) {
            this.beatTimes.push(timeSinceLastBeat);
            if (this.beatTimes.length > 16) this.beatTimes.shift();

            if (this.beatTimes.length >= 4) {
              this._calculateFallbackBpm();
            }
          }
        }
      }

      this.fallbackFrame = requestAnimationFrame(detectBeats);
    };

    detectBeats();
  }

  _calculateFallbackBpm() {
    const sorted = [...this.beatTimes].sort((a, b) => a - b);
    const q1 = sorted[Math.floor(sorted.length * 0.25)];
    const q3 = sorted[Math.floor(sorted.length * 0.75)];
    const iqr = q3 - q1;
    const filtered = this.beatTimes.filter(i => i >= q1 - iqr * 1.5 && i <= q3 + iqr * 1.5);

    if (filtered.length < 3) return;

    const avgInterval = filtered.reduce((a, b) => a + b, 0) / filtered.length;
    let rawBpm = 60000 / avgInterval;

    // Debug log raw values
    console.log(`Beat intervals: ${filtered.map(i => Math.round(i)).join(', ')}ms, avg: ${Math.round(avgInterval)}ms, raw BPM: ${Math.round(rawBpm)}`);

    // Normalize to 85-170 range (better for dance music which is typically 100-140)
    // This biases toward doubling slow detected tempos
    while (rawBpm < 85) rawBpm *= 2;
    while (rawBpm > 170) rawBpm /= 2;

    const detectedBpm = Math.round(rawBpm);

    this.bpmCandidates.push(detectedBpm);
    if (this.bpmCandidates.length > 20) this.bpmCandidates.shift();

    // Always show intermediate BPM estimate during detection
    this.bpm = detectedBpm;
    const progressConfidence = Math.min(0.8, this.bpmCandidates.length / this.MIN_BPM_CANDIDATES * 0.8);
    this.bpmConfidence = progressConfidence;
    this.onBpmUpdate?.({ bpm: this.bpm, confidence: progressConfidence, locked: false });

    if (this.bpmCandidates.length >= this.MIN_BPM_CANDIDATES) {
      const recent = this.bpmCandidates.slice(-this.MIN_BPM_CANDIDATES);
      const min = Math.min(...recent);
      const max = Math.max(...recent);
      const range = max - min;

      this.bpm = Math.round(recent.reduce((a, b) => a + b, 0) / recent.length);
      this.bpmConfidence = Math.max(0, 1 - (range / 20));

      if (range <= this.BPM_STABILITY_THRESHOLD) {
        this.bpmLocked = true;
        console.log(`BPM LOCKED at ${this.bpm} (fallback, range: ${range})`);
        this.onBpmLock?.(this.bpm);
        this.onBpmUpdate?.({ bpm: this.bpm, confidence: 1, locked: true });
        this._startBeatInterval();
      } else {
        this.onBpmUpdate?.({ bpm: this.bpm, confidence: this.bpmConfidence, locked: false });
      }
    }
  }

  _startKeyDetectionLoop() {
    const frequencyData = new Uint8Array(this.analyzerNode.frequencyBinCount);

    const detectKey = () => {
      if (!this.analyzerNode) return;

      if (!this.keyLocked) {
        this.analyzerNode.getByteFrequencyData(frequencyData);
        this._detectKey(frequencyData);
      }

      this.animationFrame = requestAnimationFrame(detectKey);
    };

    detectKey();
  }

  _resetState() {
    this.bpmCandidates = [];
    this.bpm = null;
    this.bpmConfidence = 0;
    this.bpmLocked = false;
    this.lastBeatTime = 0;
    this.chromaAccumulator = new Array(12).fill(0);
    this.chromaSamples = 0;
    this.key = null;
    this.keyConfidence = 0;
    this.keyLocked = false;
    this.keyReadings = []; // Reset key stability tracking
    this.fallbackMode = false;

    // Clear any pending timeouts
    if (this._workletTimeout) {
      clearTimeout(this._workletTimeout);
      this._workletTimeout = null;
    }

    // Fallback mode state
    this.energyHistory = [];
    this.beatTimes = [];
    this.threshold = 0;
  }

  stopAnalysis() {
    this._stopBeatInterval();
    if (this._workletTimeout) {
      clearTimeout(this._workletTimeout);
      this._workletTimeout = null;
    }
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }
    if (this.fallbackFrame) {
      cancelAnimationFrame(this.fallbackFrame);
      this.fallbackFrame = null;
    }
    if (this.bpmAnalyserNode) {
      this.bpmAnalyserNode.disconnect();
      this.bpmAnalyserNode = null;
    }
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
    if (this.sourceNode) {
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }
    this.analyzerNode = null;
  }

  unlockBpm() {
    this._stopBeatInterval();
    this.bpmLocked = false;
    this.bpmCandidates = [];
    this.bpm = null;
    this.bpmConfidence = 0;
    this.beatTimes = [];

    // Reset the processor if it exists (v3 API: use .port.postMessage)
    if (this.bpmAnalyserNode) {
      this.bpmAnalyserNode.port.postMessage({ message: 'RESET' });
    }

    this.onBpmUpdate?.({ bpm: null, confidence: 0, locked: false });
  }

  unlockKey() {
    this.keyLocked = false;
    this.chromaAccumulator = new Array(12).fill(0);
    this.chromaSamples = 0;
    this.key = null;
    this.keyConfidence = 0;
    this.keyReadings = []; // Reset key stability tracking
    this.onKeyUpdate?.({ key: null, confidence: 0, locked: false });
  }

  unlockAll() {
    this.unlockBpm();
    this.unlockKey();
  }

  getState() {
    return {
      bpm: this.bpm,
      bpmConfidence: this.bpmConfidence,
      bpmLocked: this.bpmLocked,
      key: this.key,
      keyConfidence: this.keyConfidence,
      keyLocked: this.keyLocked,
      analyzing: !!this.stream
    };
  }

  // ============ KEY DETECTION ============

  static NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  static MAJOR_PROFILE = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
  static MINOR_PROFILE = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];

  _detectKey(frequencyData) {
    const chroma = this._calculateChroma(frequencyData);

    for (let i = 0; i < 12; i++) {
      this.chromaAccumulator[i] += chroma[i];
    }
    this.chromaSamples++;

    // Report progress periodically
    if (this.chromaSamples % 50 === 0 && this.chromaSamples < this.MIN_CHROMA_SAMPLES) {
      this._analyzeKeyProgress();
    }

    if (this.chromaSamples >= this.MIN_CHROMA_SAMPLES) {
      this._analyzeKey();
    }
  }

  _calculateChroma(frequencyData) {
    const chroma = new Array(12).fill(0);
    const sampleRate = this.audioContext.sampleRate;
    const binCount = frequencyData.length;
    const binWidth = sampleRate / (binCount * 2);

    for (let i = 1; i < binCount; i++) {
      const freq = i * binWidth;
      if (freq < 60 || freq > 2000) continue;

      const amplitude = frequencyData[i] / 255;
      if (amplitude < 0.1) continue;

      const midiNote = 12 * Math.log2(freq / 440) + 69;
      const pitchClass = Math.round(midiNote) % 12;
      if (pitchClass >= 0 && pitchClass < 12) {
        chroma[pitchClass] += amplitude * amplitude;
      }
    }

    return chroma;
  }

  _analyzeKeyProgress() {
    const total = this.chromaAccumulator.reduce((a, b) => a + b, 0);
    if (total === 0) return;

    const normalizedChroma = this.chromaAccumulator.map(v => v / total);
    let bestKey = 'C';
    let bestCorrelation = -Infinity;
    let isMinor = false;

    for (let root = 0; root < 12; root++) {
      const rotatedChroma = [];
      for (let i = 0; i < 12; i++) {
        rotatedChroma.push(normalizedChroma[(i + root) % 12]);
      }

      const majorCorr = this._correlate(rotatedChroma, AudioAnalysis.MAJOR_PROFILE);
      if (majorCorr > bestCorrelation) {
        bestCorrelation = majorCorr;
        bestKey = AudioAnalysis.NOTE_NAMES[root];
        isMinor = false;
      }

      const minorCorr = this._correlate(rotatedChroma, AudioAnalysis.MINOR_PROFILE);
      if (minorCorr > bestCorrelation) {
        bestCorrelation = minorCorr;
        bestKey = AudioAnalysis.NOTE_NAMES[root];
        isMinor = true;
      }
    }

    this.key = isMinor ? `${bestKey}m` : bestKey;
    this.keyConfidence = Math.max(0, Math.min(1, (bestCorrelation + 1) / 2));
    this.onKeyUpdate?.({ key: this.key, confidence: this.keyConfidence, locked: false });
  }

  _analyzeKey() {
    const total = this.chromaAccumulator.reduce((a, b) => a + b, 0);
    if (total === 0) return;

    const normalizedChroma = this.chromaAccumulator.map(v => v / total);
    let bestKey = 'C';
    let bestCorrelation = -Infinity;
    let isMinor = false;

    for (let root = 0; root < 12; root++) {
      const rotatedChroma = [];
      for (let i = 0; i < 12; i++) {
        rotatedChroma.push(normalizedChroma[(i + root) % 12]);
      }

      const majorCorr = this._correlate(rotatedChroma, AudioAnalysis.MAJOR_PROFILE);
      if (majorCorr > bestCorrelation) {
        bestCorrelation = majorCorr;
        bestKey = AudioAnalysis.NOTE_NAMES[root];
        isMinor = false;
      }

      const minorCorr = this._correlate(rotatedChroma, AudioAnalysis.MINOR_PROFILE);
      if (minorCorr > bestCorrelation) {
        bestCorrelation = minorCorr;
        bestKey = AudioAnalysis.NOTE_NAMES[root];
        isMinor = true;
      }
    }

    const detectedKey = isMinor ? `${bestKey}m` : bestKey;
    const confidence = Math.max(0, Math.min(1, (bestCorrelation + 1) / 2));

    // Track key readings for stability check (like BPM does)
    this.keyReadings.push({ key: detectedKey, confidence });
    if (this.keyReadings.length > 20) this.keyReadings.shift(); // Keep last 20 readings

    this.key = detectedKey;
    this.keyConfidence = confidence;

    // Check stability: same key detected consecutively with good confidence
    if (this.keyReadings.length >= this.KEY_STABILITY_COUNT) {
      const recentReadings = this.keyReadings.slice(-this.KEY_STABILITY_COUNT);
      const allSameKey = recentReadings.every(r => r.key === detectedKey);
      const avgConfidence = recentReadings.reduce((sum, r) => sum + r.confidence, 0) / recentReadings.length;

      if (allSameKey && avgConfidence >= this.KEY_CONFIDENCE_THRESHOLD) {
        this.keyLocked = true;
        console.log(`KEY LOCKED at ${this.key} (stable: ${this.KEY_STABILITY_COUNT} consecutive, avg confidence: ${(avgConfidence * 100).toFixed(0)}%)`);
        this.onKeyLock?.(this.key);
        this.onKeyUpdate?.({ key: this.key, confidence: 1, locked: true });
        return;
      }
    }

    // Not stable yet, report progress
    this.onKeyUpdate?.({ key: this.key, confidence: this.keyConfidence, locked: false });

    // Reset chroma accumulator for next analysis window (sliding window approach)
    // Keep analyzing with fresh samples to get new readings
    this.chromaAccumulator = new Array(12).fill(0);
    this.chromaSamples = 0;
  }

  _correlate(a, b) {
    const n = a.length;
    const meanA = a.reduce((s, v) => s + v, 0) / n;
    const meanB = b.reduce((s, v) => s + v, 0) / n;

    let num = 0, denA = 0, denB = 0;
    for (let i = 0; i < n; i++) {
      const diffA = a[i] - meanA;
      const diffB = b[i] - meanB;
      num += diffA * diffB;
      denA += diffA * diffA;
      denB += diffB * diffB;
    }

    const den = Math.sqrt(denA * denB);
    return den === 0 ? 0 : num / den;
  }

  dispose() {
    this.stopAnalysis();
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
  }
}

let instance = null;

export function getAudioAnalysis() {
  if (!instance) {
    instance = new AudioAnalysis();
  }
  return instance;
}

export default AudioAnalysis;
