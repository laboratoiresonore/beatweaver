/**
 * Announcer - Text-to-speech for DJ feedback
 *
 * TTS priority chain:
 *   1. Kobold API (user's LLM server) - effects always work
 *   2. Electron SAPI (Windows) - generates WAV via IPC for Web Audio effects
 *   3. Browser SpeechSynthesis - no effects (direct OS audio output)
 *
 * Queue system prevents overlapping announcements.
 * Female voice preferred. Reverb + echo effects on audio playback.
 */

export class Announcer {
  constructor(koboldUrl = 'http://192.168.0.100:5001') {
    this.koboldUrl = koboldUrl;
    this.koboldSpeaker = 'af_heart'; // Kokoro default speaker (af_heart = female)
    this.enabled = true;
    this.queue = [];
    this.speaking = false;
    this.koboldAvailable = null; // null = untested, true/false after first attempt
    this.ttsMode = 'browser'; // 'browser' or 'kobold' - USER CHOOSES, no auto-detection bullshit
    this.volume = 0.8;

    // Browser TTS settings - female voice, slightly higher pitch
    this.ttsRate = 1.3;   // Slightly fast - DJ context needs snappy
    this.ttsPitch = 1.15;  // Slightly higher for feminine tone
    this.ttsVoice = null;  // Will pick best available female voice

    // Effects settings (applied via Web Audio API to Kobold or Electron SAPI audio)
    this._audioContext = null;
    this._reverbNode = null;
    this._reverbDryWet = 0.3; // 30% wet reverb

    // Echo (feedback delay) settings
    this._echoDelay = null;
    this._echoFeedback = null;
    this._echoWet = null;
    this._echoAmount = 0.3;      // 0-1 echo wet level
    this._echoDelayTime = 0.25;  // 250ms delay

    // Debounce: skip if same text announced within 500ms (fast for testing)
    this._lastAnnouncement = '';
    this._lastAnnouncementTime = 0;
    this.DEBOUNCE_MS = 500;
  }

  /**
   * Initialize - test Kobold availability and pick browser voice
   */
  async init() {
    // Test Kobold connection (fire and forget)
    this._testKobold().catch(() => {});

    // Pick the best browser TTS voice (prefer female)
    try {
      this._pickVoice();
    } catch (err) {
      console.warn('Voice pick failed:', err);
    }

    // Create Web Audio effects chain for Kobold audio playback
    try {
      this._initEffects();
    } catch (err) {
      console.warn('Effects init failed:', err);
    }
  }

  /**
   * Check if Kobold TTS endpoint is reachable
   */
  async _testKobold() {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);

      const response = await fetch(`${this.koboldUrl}/api/v1/model`, {
        signal: controller.signal,
      });
      clearTimeout(timeout);

      this.koboldAvailable = response.ok;
      console.log(`Kobold TTS: ${this.koboldAvailable ? 'available' : 'not available'}`);
    } catch {
      this.koboldAvailable = false;
      console.log('Kobold TTS: not reachable, using browser TTS');
    }
  }

  /**
   * Pick the best available browser TTS voice (called once at init, NOT on voiceschanged)
   * App.jsx handles voiceschanged to avoid handler conflicts
   */
  _pickVoice() {
    if (typeof speechSynthesis === 'undefined') return;

    const voices = speechSynthesis.getVoices();
    if (voices.length === 0) {
      console.log('TTS: No voices available yet, will be set on first getVoices() call');
      return;
    }

    // If there's a pending voice URI from setVoice(), apply it first
    if (this._pendingVoiceURI) {
      const pendingVoice = voices.find(v => v.voiceURI === this._pendingVoiceURI);
      if (pendingVoice) {
        this.ttsVoice = pendingVoice;
        this._pendingVoiceURI = null;
        console.log(`TTS pending voice applied: ${pendingVoice.name}`);
        return;
      }
    }

    // Don't override user's choice if already set
    if (this.ttsVoice) {
      console.log(`TTS voice already set: ${this.ttsVoice.name}`);
      return;
    }

    const englishVoices = voices.filter(v => v.lang.startsWith('en'));

    // Priority: female + natural > female > natural > any English
    const femaleKeywords = ['female', 'woman', 'zira', 'hazel', 'susan', 'samantha', 'karen', 'moira', 'fiona', 'tessa', 'victoria', 'allison'];
    const naturalKeywords = ['natural', 'premium', 'enhanced'];

    const isFemale = (v) => femaleKeywords.some(k => v.name.toLowerCase().includes(k));
    const isNatural = (v) => naturalKeywords.some(k => v.name.toLowerCase().includes(k));

    const femaleNatural = englishVoices.find(v => isFemale(v) && isNatural(v));
    const female = englishVoices.find(v => isFemale(v));
    const natural = englishVoices.find(v => isNatural(v));
    const anyEnglish = englishVoices[0];

    this.ttsVoice = femaleNatural || female || natural || anyEnglish || voices[0];
    console.log(`TTS voice auto-selected: ${this.ttsVoice?.name || 'none'}`);
  }

  /**
   * Initialize Web Audio effects chain (reverb + echo) for Kobold audio playback.
   * Signal graph:
   *   source -> volumeGain -> dryGain -----------> destination  (dry)
   *                        -> reverbNode -> wetGain -> destination  (reverb)
   *                        -> echoDelay -> echoWet -> destination  (echo)
   *                                     -> echoFeedback -> echoDelay  (feedback loop)
   */
  _initEffects() {
    try {
      // Don't recreate if we already have a valid context
      if (this._audioContext && this._audioContext.state !== 'closed') {
        return;
      }

      this._audioContext = new (window.AudioContext || window.webkitAudioContext)();

      // ---- REVERB (convolution) ----
      this._reverbNode = this._audioContext.createConvolver();
      const sampleRate = this._audioContext.sampleRate;
      const length = sampleRate * 1.5; // 1.5 second reverb tail
      const impulse = this._audioContext.createBuffer(2, length, sampleRate);

      for (let channel = 0; channel < 2; channel++) {
        const data = impulse.getChannelData(channel);
        for (let i = 0; i < length; i++) {
          // Normalize impulse to prevent clipping: scale down by 0.3
          data[i] = (Math.random() * 2 - 1) * 0.3 * Math.pow(1 - i / length, 2.5);
        }
      }
      this._reverbNode.buffer = impulse;

      // Dry/wet mix for reverb - enforce minimum dry level so audio is always audible
      this._dryGain = this._audioContext.createGain();
      this._wetGain = this._audioContext.createGain();
      this._dryGain.gain.value = Math.max(0.1, 1 - this._reverbDryWet);
      this._wetGain.gain.value = this._reverbDryWet;

      // Wire reverb: dryGain -> destination, reverbNode -> wetGain -> destination
      this._dryGain.connect(this._audioContext.destination);
      this._reverbNode.connect(this._wetGain);
      this._wetGain.connect(this._audioContext.destination);

      // ---- ECHO (feedback delay) ----
      this._echoDelay = this._audioContext.createDelay(2.0); // max 2 seconds
      this._echoDelay.delayTime.value = this._echoDelayTime;

      this._echoFeedback = this._audioContext.createGain();
      this._echoFeedback.gain.value = 0.35; // conservative feedback to prevent buildup

      this._echoWet = this._audioContext.createGain();
      this._echoWet.gain.value = this._echoAmount;

      // Wire echo: delay -> echoWet -> destination (echo output)
      //            delay -> feedback -> delay (feedback loop)
      this._echoDelay.connect(this._echoWet);
      this._echoWet.connect(this._audioContext.destination);
      this._echoDelay.connect(this._echoFeedback);
      this._echoFeedback.connect(this._echoDelay);

      console.log('Audio effects chain initialized (reverb + echo)');
    } catch (err) {
      console.warn('Effects init failed, audio will play dry:', err.message);
      this._audioContext = null;
    }
  }

  /**
   * Announce text - queued, debounced
   * @param {string} text - Text to speak
   * @param {boolean} priority - If true, clears queue and speaks immediately
   */
  announce(text, priority = false) {
    try {
      if (!this.enabled || !text) return;

      // Priority messages ALWAYS go through (for testing voice changes)
      if (priority) {
        this.queue = [text];
        try { this._cancelCurrent(); } catch { /* safe to ignore */ }
        this._lastAnnouncement = '';  // Reset debounce for priority
      } else {
        // Debounce: skip duplicate within 500ms (non-priority only)
        const now = Date.now();
        if (text === this._lastAnnouncement && now - this._lastAnnouncementTime < this.DEBOUNCE_MS) {
          return;
        }
        this._lastAnnouncement = text;
        this._lastAnnouncementTime = now;

        // Limit queue to 3 items to prevent pile-up
        if (this.queue.length >= 3) {
          this.queue.shift();
        }
        this.queue.push(text);
      }

      if (!this.speaking) {
        this._processQueue().catch(err => {
          console.warn('TTS queue error:', err);
          this.speaking = false;
        });
      }
    } catch (err) {
      console.warn('announce() threw:', err);
    }
  }

  /**
   * Process the announcement queue (iterative, not recursive)
   * USER CHOOSES: kobold OR browser. Period. No auto-switching.
   */
  async _processQueue() {
    if (this.speaking) return; // Prevent concurrent processing
    this.speaking = true;

    try {
      while (this.queue.length > 0) {
        const text = this.queue.shift();
        try {
          // USER CHOOSES TTS mode - RESPECT THEIR CHOICE
          if (this.ttsMode === 'kobold') {
            console.log('TTS: Using Kobold (user selected)');
            await this._speakKobold(text);
          } else {
            // Browser mode = Browser TTS. ALWAYS. No Electron SAPI bullshit.
            console.log('TTS: Using Browser SpeechSynthesis');
            await this._speakBrowser(text);
          }
        } catch (err) {
          console.warn('TTS failed:', err?.message || err);
        }
      }
    } finally {
      this.speaking = false;
    }
  }

  /**
   * Check if Electron SAPI TTS should be used (effects enabled + IPC available)
   */
  _shouldUseElectronTTS() {
    const effectsWanted = this._reverbDryWet > 0.05 || this._echoAmount > 0.05;
    const electronAvailable = typeof window !== 'undefined'
      && typeof window.electronAPI?.tts?.synthesize === 'function';
    return effectsWanted && electronAvailable;
  }

  /**
   * Speak using Electron main process SAPI TTS (Windows)
   * Generates WAV data via IPC, plays through Web Audio effects chain
   */
  async _speakElectron(text) {
    try {
      const arrayBuffer = await window.electronAPI.tts.synthesize(text, {
        rate: this.ttsRate,
        voiceName: this.ttsVoice?.name || null,
      });

      if (!arrayBuffer) {
        // SAPI failed, fall back to browser TTS
        await this._speakBrowser(text);
        return;
      }

      const blob = new Blob([arrayBuffer], { type: 'audio/wav' });
      await this._playAudio(blob);
    } catch (err) {
      console.warn('Electron TTS failed, falling back to browser:', err.message);
      await this._speakBrowser(text);
    }
  }

  /**
   * Speak using Kobold TTS API
   */
  async _speakKobold(text) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000); // 3s timeout - fail fast

      // Try speaker param for Kokoro model (may be ignored by other models)
      const response = await fetch(`${this.koboldUrl}/api/extra/tts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, speaker: this.koboldSpeaker }),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!response.ok) {
        throw new Error(`Kobold TTS returned ${response.status}`);
      }

      const blob = await response.blob();
      if (!blob || blob.size < 44) {
        throw new Error('Kobold returned empty or too-small audio');
      }

      try {
        await this._playAudio(blob);
      } catch (playErr) {
        console.warn('Kobold audio playback failed:', playErr);
        // Don't fall back here - audio was received, just couldn't play
      }
    } catch (err) {
      // Kobold failed - mark unavailable and fall back to browser TTS
      console.warn('Kobold TTS failed, falling back to browser:', err?.message || err);
      this.koboldAvailable = false;
      try {
        await this._speakBrowser(text);
      } catch (browserErr) {
        console.warn('Browser TTS also failed:', browserErr);
      }
    }
  }

  /**
   * Speak using browser SpeechSynthesis API
   */
  _speakBrowser(text) {
    return new Promise((resolve) => {
      if (typeof speechSynthesis === 'undefined') {
        console.warn('Browser TTS: speechSynthesis not available');
        resolve();
        return;
      }

      try {
        // Chrome bug: cancel any pending/paused speech to avoid hangs
        speechSynthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(text);

        // CRITICAL: Set voice FIRST before other properties
        // Voice objects can become stale - look up fresh by URI
        let voiceToUse = null;
        if (this.ttsVoice) {
          const voices = speechSynthesis.getVoices();
          console.log(`Browser TTS: Looking for voice URI "${this.ttsVoice.voiceURI}" in ${voices.length} voices`);

          voiceToUse = voices.find(v => v.voiceURI === this.ttsVoice.voiceURI);
          if (!voiceToUse) {
            // Fallback to name match if URI changed
            voiceToUse = voices.find(v => v.name === this.ttsVoice.name);
          }
          if (voiceToUse) {
            utterance.voice = voiceToUse;
            console.log(`Browser TTS: FOUND voice "${voiceToUse.name}" (lang: ${voiceToUse.lang})`);
          } else {
            console.warn(`Browser TTS: voice "${this.ttsVoice.name}" NOT FOUND in available voices`);
            console.log('Available:', voices.map(v => v.name).slice(0, 10).join(', '));
          }
        } else {
          console.log('Browser TTS: NO VOICE SET - using system default');
        }

        // Set other properties AFTER voice
        utterance.rate = this.ttsRate;
        utterance.pitch = this.ttsPitch;
        utterance.volume = this.volume;

        console.log(`Browser TTS: SPEAKING "${text}" with voice=${utterance.voice?.name || 'DEFAULT'}`);

        utterance.onend = () => {
          console.log('Browser TTS: speech ended');
          resolve();
        };
        utterance.onerror = (err) => {
          console.warn('Browser TTS error:', err);
          resolve();
        };

        speechSynthesis.speak(utterance);
      } catch (err) {
        console.warn('Browser TTS speak() threw:', err);
        resolve();
      }
    });
  }

  /**
   * Play audio blob (from Kobold)
   */
  async _playAudio(blob) {
    // TEMPORARY: Skip effects entirely to debug crash
    // Use Web Audio API for effects if available and context is usable
    // if (this._audioContext && this._reverbNode && this._audioContext.state !== 'closed') {
    //   return this._playAudioWithEffects(blob);
    // }

    // Fallback: plain Audio element (no effects)
    return this._playAudioFallback(blob);
  }

  /**
   * Play audio blob through Web Audio API with reverb + echo effects
   */
  async _playAudioWithEffects(blob) {
    let source = null;
    let gainNode = null;

    try {
      // Validate blob
      if (!blob || blob.size < 44) {
        console.warn('TTS blob too small or empty, skipping effects playback');
        return this._playAudioFallback(blob);
      }

      // No audio context available - fall back to plain playback
      if (!this._audioContext) {
        return this._playAudioFallback(blob);
      }

      if (this._audioContext.state === 'suspended') {
        await this._audioContext.resume();
      }

      // If AudioContext is in a bad state, recreate it
      if (this._audioContext.state === 'closed') {
        console.warn('AudioContext was closed, recreating effects chain');
        this._initEffects();
        if (!this._audioContext) {
          return this._playAudioFallback(blob);
        }
      }

      const arrayBuffer = await blob.arrayBuffer();

      // decodeAudioData - use callback form for better compatibility
      let audioBuffer;
      try {
        audioBuffer = await this._audioContext.decodeAudioData(arrayBuffer);
      } catch (decodeErr) {
        console.warn('decodeAudioData failed:', decodeErr);
        return this._playAudioFallback(blob);
      }

      if (!audioBuffer || audioBuffer.duration === 0) {
        console.warn('Decoded audio is empty, falling back');
        return this._playAudioFallback(blob);
      }

      source = this._audioContext.createBufferSource();
      source.buffer = audioBuffer;

      // Volume control
      gainNode = this._audioContext.createGain();
      gainNode.gain.value = this.volume;

      // Route: source -> gain -> dry path + reverb path + echo path
      source.connect(gainNode);
      gainNode.connect(this._dryGain);
      gainNode.connect(this._reverbNode);
      if (this._echoDelay) {
        gainNode.connect(this._echoDelay);
      }

      await new Promise((resolve) => {
        // Safety timeout: resolve after buffer duration + 3s for effects tail
        const maxWait = (audioBuffer.duration + 3) * 1000;
        const timeout = setTimeout(() => {
          console.warn('TTS playback timed out, resolving');
          resolve();
        }, maxWait);

        source.onended = () => { clearTimeout(timeout); resolve(); };
        try {
          source.start(0);
        } catch (startErr) {
          clearTimeout(timeout);
          console.warn('source.start() failed:', startErr);
          resolve();
        }
      });
    } catch (err) {
      console.warn('Effects playback failed, using fallback:', err?.message || err);
      try {
        await this._playAudioFallback(blob);
      } catch (fallbackErr) {
        console.warn('Even fallback playback failed:', fallbackErr);
      }
    } finally {
      // Always clean up source and gain nodes to prevent AudioContext corruption
      try {
        if (source) { source.disconnect(); }
        if (gainNode) { gainNode.disconnect(); }
      } catch {
        // disconnect can throw if never connected - safe to ignore
      }
    }
  }

  /**
   * Plain Audio element fallback (no effects)
   */
  _playAudioFallback(blob) {
    return new Promise((resolve) => {
      try {
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        audio.volume = this.volume;
        audio.onended = () => { URL.revokeObjectURL(url); resolve(); };
        audio.onerror = () => { URL.revokeObjectURL(url); resolve(); };
        audio.play().catch(() => { URL.revokeObjectURL(url); resolve(); });
      } catch (e) {
        resolve();
      }
    });
  }

  /**
   * Cancel currently speaking utterance
   */
  _cancelCurrent() {
    if (typeof speechSynthesis !== 'undefined') {
      speechSynthesis.cancel();
    }
  }

  /**
   * Toggle announcements on/off
   * @returns {boolean} New enabled state
   */
  toggle() {
    this.enabled = !this.enabled;
    if (!this.enabled) {
      this.queue = [];
      this._cancelCurrent();
      this.speaking = false;
    }
    return this.enabled;
  }

  /**
   * Set announcement volume
   * @param {number} value - 0-1 normalized
   */
  setVolume(value) {
    this.volume = Math.max(0, Math.min(1, value));
  }

  /**
   * Set voice pitch
   * @param {number} value - 0.5 to 2.0
   */
  setPitch(value) {
    this.ttsPitch = Math.max(0.5, Math.min(2.0, value));
  }

  /**
   * Set voice rate (speed)
   * @param {number} value - 0.5 to 2.0
   */
  setRate(value) {
    this.ttsRate = Math.max(0.5, Math.min(2.0, value));
  }

  /**
   * Set reverb wet/dry mix
   * @param {number} value - 0-1 normalized (0 = dry, 1 = full reverb)
   */
  setReverb(value) {
    this._reverbDryWet = Math.max(0, Math.min(1, value));
    if (this._dryGain && this._wetGain) {
      // Enforce minimum dry level of 0.1 so audio is always audible
      this._dryGain.gain.value = Math.max(0.1, 1 - this._reverbDryWet);
      this._wetGain.gain.value = this._reverbDryWet;
    }
  }

  /**
   * Set echo amount
   * @param {number} value - 0-1 normalized (0 = no echo, 1 = full echo)
   */
  setEcho(value) {
    this._echoAmount = Math.max(0, Math.min(1, value));
    if (this._echoWet) {
      this._echoWet.gain.value = this._echoAmount;
    }
  }

  /**
   * Get available TTS voices for voice selection UI
   * @returns {Array<{name: string, lang: string, voiceURI: string, isDefault: boolean}>}
   */
  getVoices() {
    if (typeof speechSynthesis === 'undefined') return [];
    return speechSynthesis.getVoices().map(v => ({
      name: v.name,
      lang: v.lang,
      voiceURI: v.voiceURI,
      isDefault: v.default,
    }));
  }

  /**
   * Set TTS voice by voiceURI
   * @param {string} voiceURI - The voiceURI from getVoices()
   * @returns {boolean} Whether voice was successfully set
   */
  setVoice(voiceURI) {
    if (typeof speechSynthesis === 'undefined') {
      console.warn('setVoice: speechSynthesis not available');
      return false;
    }

    const voices = speechSynthesis.getVoices();
    console.log(`setVoice: looking for "${voiceURI}" in ${voices.length} voices`);

    if (voices.length === 0) {
      console.warn('setVoice: no voices available yet - voices may still be loading');
      // Store the URI to try again later
      this._pendingVoiceURI = voiceURI;
      return false;
    }

    const voice = voices.find(v => v.voiceURI === voiceURI);
    if (voice) {
      const oldVoice = this.ttsVoice?.name || 'none';
      this.ttsVoice = voice;
      this._pendingVoiceURI = null;
      console.log(`TTS voice changed: "${oldVoice}" -> "${voice.name}"`);
      return true;
    } else {
      console.warn(`setVoice: voice not found for URI "${voiceURI}"`);
      console.log('Available voices:', voices.map(v => `${v.name} (${v.voiceURI})`).join(', '));
      return false;
    }
  }

  /**
   * Set TTS mode - user explicitly chooses Kobold or Browser
   * @param {'browser' | 'kobold'} mode
   */
  setTTSMode(mode) {
    if (mode === 'kobold' || mode === 'browser') {
      this.ttsMode = mode;
      console.log(`TTS mode set to: ${mode}`);
    } else {
      console.warn(`Invalid TTS mode: ${mode}, keeping: ${this.ttsMode}`);
    }
  }

  /**
   * Get current TTS mode
   * @returns {'browser' | 'kobold'}
   */
  getTTSMode() {
    return this.ttsMode;
  }

  /**
   * Set Kobold TTS server URL and re-test connection
   * @param {string} url - Full URL (e.g. 'http://192.168.0.100:5001')
   * @returns {Promise<boolean>} Whether Kobold is now available
   */
  async setKoboldUrl(url) {
    this.koboldUrl = url || '';
    if (this.koboldUrl) {
      this.koboldAvailable = null;
      await this._testKobold();
      return this.koboldAvailable;
    } else {
      this.koboldAvailable = false;
      return false;
    }
  }

  /**
   * Get current state
   */
  getState() {
    return {
      enabled: this.enabled,
      speaking: this.speaking,
      queueLength: this.queue.length,
      ttsMode: this.ttsMode,
      koboldAvailable: this.koboldAvailable,
      koboldUrl: this.koboldUrl,
      volume: this.volume,
      pitch: this.ttsPitch,
      rate: this.ttsRate,
      reverb: this._reverbDryWet,
      echo: this._echoAmount,
      voice: this.ttsVoice?.name || null,
      voiceURI: this.ttsVoice?.voiceURI || null,
    };
  }

  /**
   * Clean up
   */
  dispose() {
    this.queue = [];
    this._cancelCurrent();
    this.speaking = false;
    if (this._audioContext) {
      this._audioContext.close().catch(() => {});
      this._audioContext = null;
    }
  }
}

// Singleton
let instance = null;

export function getAnnouncer() {
  if (!instance) {
    instance = new Announcer();
  }
  return instance;
}

export default Announcer;
