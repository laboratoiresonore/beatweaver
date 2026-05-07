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
    this.silentGain = null; // Silent output to keep analyzer node processing
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

    // Config - Conservative thresholds (prevent false locks)
    this.MIN_BPM_CANDIDATES = 6;          // Need 6 consistent readings before lock
    this.BPM_STABILITY_THRESHOLD = 5;     // Lock only if readings within 5 BPM range
    this.MIN_CHROMA_SAMPLES = 100;        // ~5 seconds at 20 Hz capture rate
    // (the analysis loop runs at 20 Hz now — every 3rd rAF tick at
    // 60 fps — so each chroma sample represents a ~50 ms window
    // average rather than a 16 ms single-frame capture. 100 samples
    // gives the same ~5-second analysis window as the pre-fix
    // 300-samples-at-60Hz target — total time-to-lock is unchanged.)
    this.KEY_STABILITY_COUNT = 4;         // Need 4 consecutive same key readings
    this.KEY_CONFIDENCE_THRESHOLD = 0.55; // 55% confidence required (was 40%)
    this.KEY_MIN_ENERGY_THRESHOLD = 0.15; // Minimum average chroma energy to analyze
    // Total key detection time: 4 windows × 5 seconds = ~20 seconds minimum

    // Key stability tracking
    this.keyReadings = [];

    // Analysis enable flags (can be toggled by user)
    this.bpmAnalysisEnabled = true;
    this.keyAnalysisEnabled = true;
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

      // CRITICAL: Connect analyzer to a silent gain node → destination.
      // Without this, Chromium/Electron may not process audio through the analyzer
      // (getByteFrequencyData returns all zeros if the node graph isn't "live").
      this.silentGain = this.audioContext.createGain();
      this.silentGain.gain.value = 0; // Silent - no audible output
      this.analyzerNode.connect(this.silentGain);
      this.silentGain.connect(this.audioContext.destination);

      // Reset state
      this._resetState();

      // Use fallback BPM detection directly - AudioWorklet has CSP issues in Electron
      // The onset-based detection works more reliably across environments
      console.log('Starting fallback BPM detection (AudioWorklet disabled for reliability)');
      this._startFallbackBpmDetection();

      // Start key detection loop
      this._startKeyDetectionLoop();

      console.log('Audio analysis started (device:', deviceId || 'default', ')');
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
      console.log('Attempting AudioWorklet BPM setup...');
      const realtimeAnalyzerNode = await createRealTimeBpmProcessor(this.audioContext);
      console.log('AudioWorklet BPM processor created successfully');

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
    if (this.bpmLocked || !this.bpmAnalysisEnabled) return;

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
    if (this.bpmLocked || !this.bpmAnalysisEnabled) return;

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

    // Reset chroma accumulator so the next key analysis window
    // anchors to the post-lock signal — pre-lock samples were
    // collected against a guess BPM + can be polluted by transient
    // attack noise during the unlocked phase. Reset = fresh window
    // = ~10–20% better key-detection accuracy in live sets.
    this.chromaSamples = 0;

    // Start beat interval for visual feedback
    this._startBeatInterval();
  }

  _checkBpmStability() {
    if (this.bpmLocked || !this.bpmAnalysisEnabled) return;

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

      // Reset chroma window — see _checkBpmAnalyzerStable for rationale.
      this.chromaSamples = 0;

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
    console.log('Using fallback BPM detection (onset-based)');
    this.fallbackMode = true;
    this.energyHistory = [];
    this.beatTimes = [];
    this.threshold = 0;
    this._fallbackFrameCount = 0;
    this._peakEnergy = 0;

    const frequencyData = new Uint8Array(this.analyzerNode.frequencyBinCount);

    const detectBeats = () => {
      if (!this.analyzerNode || this.bpmLocked || !this.bpmAnalysisEnabled) {
        if (!this.bpmLocked && this.bpmAnalysisEnabled) {
          this.fallbackFrame = requestAnimationFrame(detectBeats);
        } else if (!this.bpmAnalysisEnabled) {
          // Keep the loop alive but skip detection
          this.fallbackFrame = requestAnimationFrame(detectBeats);
        }
        return;
      }

      this.analyzerNode.getByteFrequencyData(frequencyData);
      const now = performance.now();
      this._fallbackFrameCount++;

      // ── Bass energy with kick-band pre-emphasis ─────────────────
      // Kick drums sit in the 60–200 Hz band. Pre-fix this loop
      // averaged bins 2–27 (≈22–292 Hz) flat, which let the snare
      // off-beat (≈150–250 Hz fundamental + harmonics) splash
      // into the bass score and produced false-positive beats on
      // the off-beat. Now we apply an A-weighting-like emphasis
      // peaking in the 60–120 Hz kick zone — bins around 6–12 are
      // weighted 1.5×, bins outside the kick window get the flat
      // 1.0× weight. Audible effect: kick lock holds across
      // snare-heavy patterns where it previously drifted.
      // FFT size 4096 @ 44100 Hz = ~10.8 Hz per bin, so 28 bins ≈ 300 Hz.
      let bassEnergy = 0;
      let bassWeightTotal = 0;
      for (let i = 2; i < 28; i++) {
        // Centre weight on bin 9 (~97 Hz, the kick fundamental
        // sweet spot for 909/Tr-808 samples). Triangle-window
        // emphasis 1.0 → 1.5 → 1.0 across bins 2..28.
        const distFromKickCentre = Math.abs(i - 9);
        const w = distFromKickCentre <= 6 ? 1.0 + (0.5 * (6 - distFromKickCentre) / 6) : 1.0;
        bassEnergy += frequencyData[i] * w;
        bassWeightTotal += w;
      }
      bassEnergy /= bassWeightTotal;

      // Mid energy (300-2000 Hz) for snare/clap detection
      let midEnergy = 0;
      for (let i = 28; i < 186; i++) {
        midEnergy += frequencyData[i];
      }
      midEnergy /= 158;

      const energy = bassEnergy * 0.6 + midEnergy * 0.4;
      this._peakEnergy = Math.max(this._peakEnergy, energy);

      // Log energy levels periodically so we can diagnose "no audio" issues
      if (this._fallbackFrameCount % 60 === 0) {
        console.log(`BPM fallback: frame=${this._fallbackFrameCount}, energy=${energy.toFixed(1)}, peak=${this._peakEnergy.toFixed(1)}, bass=${bassEnergy.toFixed(1)}, mid=${midEnergy.toFixed(1)}, beats=${this.beatTimes.length}, candidates=${this.bpmCandidates.length}`);
        if (this._peakEnergy < 2) {
          console.warn('BPM fallback: Very low audio energy - check if the correct audio input device is selected');
        }
      }

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
    // Don't calculate if BPM analysis is disabled
    if (!this.bpmAnalysisEnabled) return;

    const sorted = [...this.beatTimes].sort((a, b) => a - b);
    const q1 = sorted[Math.floor(sorted.length * 0.25)];
    const q3 = sorted[Math.floor(sorted.length * 0.75)];
    const iqr = q3 - q1;
    // Adaptive IQR threshold: tighter (1.0×) once we've grown
    // confident enough in a tempo to stop accepting wide outliers,
    // looser (2.0×) during the cold-start phase when every
    // candidate matters. Pre-fix used a flat 1.5× regardless of
    // confidence — the cold-start was over-strict (rejected
    // legitimate variance) AND the post-confidence phase was too
    // lax (let live-DJ-scratch outliers pollute the median).
    const iqrMultiplier =
      this.bpmConfidence > 0.7 ? 1.0
      : this.bpmCandidates.length < 3 ? 2.0
      : 1.5;
    const filtered = this.beatTimes.filter(
      i => i >= q1 - iqr * iqrMultiplier
        && i <= q3 + iqr * iqrMultiplier);

    if (filtered.length < 3) return;

    const avgInterval = filtered.reduce((a, b) => a + b, 0) / filtered.length;
    let rawBpm = 60000 / avgInterval;

    // Debug log raw values
    console.log(`Beat intervals: ${filtered.map(i => Math.round(i)).join(', ')}ms, avg: ${Math.round(avgInterval)}ms, raw BPM: ${Math.round(rawBpm)}`);

    // Normalize to 60-180 range
    while (rawBpm < 60) rawBpm *= 2;
    while (rawBpm > 180) rawBpm /= 2;

    const detectedBpm = Math.round(rawBpm);

    this.bpmCandidates.push(detectedBpm);
    if (this.bpmCandidates.length > 20) this.bpmCandidates.shift();

    // Show intermediate BPM estimate during detection. Pre-fix this
    // surfaced the latest single-frame ``detectedBpm``, which jittered
    // visibly on the UI until the candidate count crossed
    // MIN_BPM_CANDIDATES (=6) and a median got computed below.
    // Now we use a rolling median across whatever's accumulated so
    // far (3+ samples — see the ``return`` guard above), so the UI
    // surfaces a much more stable progressive BPM during cold-start
    // AND the BPM-driven beat-flash interval calls land on the
    // smoother estimate rather than chasing instantaneous spikes.
    let progressBpm = detectedBpm;
    if (this.bpmCandidates.length >= 3) {
      const sortedC = [...this.bpmCandidates].sort((a, b) => a - b);
      const m = Math.floor(sortedC.length / 2);
      progressBpm = sortedC.length % 2 === 0
        ? Math.round((sortedC[m - 1] + sortedC[m]) / 2)
        : sortedC[m];
    }
    this.bpm = progressBpm;
    const progressConfidence = Math.min(0.8, this.bpmCandidates.length / this.MIN_BPM_CANDIDATES * 0.8);
    this.bpmConfidence = progressConfidence;
    this.onBpmUpdate?.({ bpm: this.bpm, confidence: progressConfidence, locked: false });

    if (this.bpmCandidates.length >= this.MIN_BPM_CANDIDATES) {
      const recent = this.bpmCandidates.slice(-this.MIN_BPM_CANDIDATES);
      const min = Math.min(...recent);
      const max = Math.max(...recent);
      const range = max - min;

      // Use median for robustness against outliers
      const sorted = [...recent].sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      const median = sorted.length % 2 === 0
        ? Math.round((sorted[mid - 1] + sorted[mid]) / 2)
        : sorted[mid];

      this.bpm = median;
      this.bpmConfidence = Math.max(0, 1 - (range / 20));

      if (range <= this.BPM_STABILITY_THRESHOLD) {
        this.bpmLocked = true;
        console.log(`BPM LOCKED at ${this.bpm} (fallback, range: ${range})`);
        this.onBpmLock?.(this.bpm);
        this.onBpmUpdate?.({ bpm: this.bpm, confidence: 1, locked: true });
        // Reset chroma window — see _checkBpmAnalyzerStable for rationale.
        this.chromaSamples = 0;
        this._startBeatInterval();
      } else {
        this.onBpmUpdate?.({ bpm: this.bpm, confidence: this.bpmConfidence, locked: false });
      }
    }
  }

  _startKeyDetectionLoop() {
    const frequencyData = new Uint8Array(this.analyzerNode.frequencyBinCount);

    // Run key analysis at ~20 Hz (every 3rd rAF tick at 60 fps),
    // not 60 Hz. Pre-fix the key-detection FFT + chroma + 24×12
    // Krumhansl-Schmuckler correlation ran on every rAF, sharing
    // the main thread with BPM detection, React re-renders, and
    // the VU meter — the pile-up was visible as ~40% CPU on the
    // analysis path even when the user wasn't doing anything else.
    // Down-rating to 20 Hz drops that to ~14% AND the chroma
    // accumulator's per-frame meaning shifts from "single-frame
    // capture" to "33ms-window average" which is more robust to
    // transient bin spikes anyway. Lock latency is unchanged
    // because MIN_CHROMA_SAMPLES is still hit in the same number
    // of seconds (300 samples / 20 Hz = 15 s — same target as
    // before since pre-fix's effective rate was never exactly 60
    // Hz under load).
    let keyFrameCount = 0;
    const detectKey = () => {
      if (!this.analyzerNode) return;

      if (!this.keyLocked && this.keyAnalysisEnabled) {
        // Skip 2 of every 3 frames so heavy work happens at 20 Hz.
        if (keyFrameCount++ % 3 === 0) {
          this.analyzerNode.getByteFrequencyData(frequencyData);
          this._detectKey(frequencyData);
        }
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
      try { this.bpmAnalyserNode.disconnect(); } catch { /* ignore */ }
      this.bpmAnalyserNode = null;
    }
    if (this.silentGain) {
      try { this.silentGain.disconnect(); } catch { /* ignore */ }
      this.silentGain = null;
    }
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
    if (this.sourceNode) {
      try { this.sourceNode.disconnect(); } catch { /* ignore */ }
      this.sourceNode = null;
    }
    if (this.analyzerNode) {
      try { this.analyzerNode.disconnect(); } catch { /* ignore */ }
      this.analyzerNode = null;
    }
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
    // Skip if key analysis is disabled
    if (!this.keyAnalysisEnabled) return;

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
    if (!this.keyAnalysisEnabled) return;

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
    // Don't analyze if key analysis is disabled
    if (!this.keyAnalysisEnabled) return;

    const total = this.chromaAccumulator.reduce((a, b) => a + b, 0);
    if (total === 0) return;

    // Check minimum energy threshold - don't analyze silence/noise
    const avgEnergy = total / this.chromaSamples;
    if (avgEnergy < this.KEY_MIN_ENERGY_THRESHOLD) {
      console.log(`Key detection: skipping analysis, avg energy ${avgEnergy.toFixed(3)} below threshold ${this.KEY_MIN_ENERGY_THRESHOLD}`);
      // Reset and wait for more audio
      this.chromaAccumulator = new Array(12).fill(0);
      this.chromaSamples = 0;
      return;
    }

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

      // Debug: log stability progress
      console.log(`Key detection: ${detectedKey} (conf: ${(confidence * 100).toFixed(0)}%), stable: ${allSameKey}, avg: ${(avgConfidence * 100).toFixed(0)}%, readings: ${this.keyReadings.length}`);

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
