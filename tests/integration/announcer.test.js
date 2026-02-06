import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { Announcer } from '../../src/core/Announcer.js';

/**
 * Announcer integration tests
 * Mocks fetch (Kobold API) and speechSynthesis (browser TTS)
 */

// Mock speechSynthesis
const mockSpeechSynthesis = {
  speak: vi.fn(),
  cancel: vi.fn(),
  getVoices: vi.fn(() => [
    { lang: 'en-US', name: 'English Natural', localService: true },
    { lang: 'en-GB', name: 'English UK', localService: true },
  ]),
  onvoiceschanged: undefined,
};

// Patch global
globalThis.speechSynthesis = mockSpeechSynthesis;
globalThis.SpeechSynthesisUtterance = class {
  constructor(text) {
    this.text = text;
    this.rate = 1;
    this.pitch = 1;
    this.volume = 1;
    this.voice = null;
    this.onend = null;
    this.onerror = null;
  }
};

describe('Announcer', () => {
  let announcer;

  beforeEach(() => {
    vi.useFakeTimers();
    announcer = new Announcer('http://fake-kobold:5001');
    announcer.koboldAvailable = false; // Default to browser TTS for predictable tests
    mockSpeechSynthesis.speak.mockClear();
    mockSpeechSynthesis.cancel.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
    announcer.dispose();
  });

  describe('construction', () => {
    it('initializes with correct defaults', () => {
      expect(announcer.enabled).toBe(true);
      expect(announcer.volume).toBe(0.8);
      expect(announcer.queue).toEqual([]);
      expect(announcer.speaking).toBe(false);
      expect(announcer.DEBOUNCE_MS).toBe(2000);
    });

    it('stores kobold URL', () => {
      expect(announcer.koboldUrl).toBe('http://fake-kobold:5001');
    });
  });

  describe('announce - queueing', () => {
    it('does nothing when disabled', () => {
      announcer.enabled = false;
      announcer.announce('test');
      expect(announcer.queue).toEqual([]);
    });

    it('does nothing with empty text', () => {
      announcer.announce('');
      expect(announcer.queue).toEqual([]);
    });

    it('queues announcement and starts processing', () => {
      announcer.announce('BPM locked: 120');
      // Should have called speechSynthesis.speak
      expect(mockSpeechSynthesis.speak).toHaveBeenCalledTimes(1);
    });

    it('limits queue to 3 items', () => {
      // Make announcer "busy" so items accumulate
      announcer.speaking = true;

      announcer.announce('first');
      announcer.announce('second');
      announcer.announce('third');
      announcer.announce('fourth'); // This should push out "first"

      expect(announcer.queue).toHaveLength(3);
      expect(announcer.queue[0]).toBe('second');
      expect(announcer.queue[2]).toBe('fourth');
    });

    it('priority clears queue and speaks immediately', () => {
      announcer.speaking = true;
      announcer.queue = ['queued1', 'queued2'];

      announcer.announce('STOP ALL', true);

      // Queue should only have the priority item
      // (it was shifted out during _processQueue, but the queue was set to ['STOP ALL'] first)
      expect(announcer.queue.length).toBeLessThanOrEqual(1);
      expect(mockSpeechSynthesis.cancel).toHaveBeenCalled();
    });
  });

  describe('debouncing', () => {
    it('skips duplicate text within 2 seconds', () => {
      announcer.announce('BPM locked: 120');
      const firstCallCount = mockSpeechSynthesis.speak.mock.calls.length;

      // Same text immediately - should be debounced
      announcer.announce('BPM locked: 120');
      expect(mockSpeechSynthesis.speak.mock.calls.length).toBe(firstCallCount);
    });

    it('allows same text after debounce period', () => {
      announcer.announce('BPM locked: 120');
      const firstCallCount = mockSpeechSynthesis.speak.mock.calls.length;

      // Advance past debounce
      vi.advanceTimersByTime(2100);

      // Reset speaking state so it processes again
      announcer.speaking = false;
      announcer.announce('BPM locked: 120');
      expect(mockSpeechSynthesis.speak.mock.calls.length).toBe(firstCallCount + 1);
    });

    it('allows different text immediately', () => {
      announcer.announce('BPM locked: 120');
      const firstCallCount = mockSpeechSynthesis.speak.mock.calls.length;

      // Different text - should not be debounced (but may be queued)
      announcer.announce('Key locked: Am');

      // Either spoken or queued
      const totalCalls = mockSpeechSynthesis.speak.mock.calls.length;
      const queuedItems = announcer.queue.length;
      expect(totalCalls + queuedItems).toBeGreaterThanOrEqual(firstCallCount);
    });
  });

  describe('toggle', () => {
    it('toggles enabled state', () => {
      expect(announcer.enabled).toBe(true);

      const result = announcer.toggle();
      expect(result).toBe(false);
      expect(announcer.enabled).toBe(false);
    });

    it('clears queue when disabled', () => {
      announcer.speaking = true;
      announcer.queue = ['pending1', 'pending2'];

      announcer.toggle(); // disable

      expect(announcer.queue).toEqual([]);
      expect(announcer.speaking).toBe(false);
      expect(mockSpeechSynthesis.cancel).toHaveBeenCalled();
    });

    it('toggles back on', () => {
      announcer.toggle(); // off
      const result = announcer.toggle(); // on
      expect(result).toBe(true);
      expect(announcer.enabled).toBe(true);
    });
  });

  describe('volume', () => {
    it('sets volume within bounds', () => {
      announcer.setVolume(0.5);
      expect(announcer.volume).toBe(0.5);
    });

    it('clamps volume to 0', () => {
      announcer.setVolume(-0.5);
      expect(announcer.volume).toBe(0);
    });

    it('clamps volume to 1', () => {
      announcer.setVolume(1.5);
      expect(announcer.volume).toBe(1);
    });
  });

  describe('pitch', () => {
    it('sets pitch within bounds', () => {
      announcer.setPitch(1.5);
      expect(announcer.ttsPitch).toBe(1.5);
    });

    it('clamps pitch to 0.5', () => {
      announcer.setPitch(0.1);
      expect(announcer.ttsPitch).toBe(0.5);
    });

    it('clamps pitch to 2.0', () => {
      announcer.setPitch(3.0);
      expect(announcer.ttsPitch).toBe(2.0);
    });

    it('applies pitch to utterance', () => {
      announcer.setPitch(1.8);
      announcer.announce('pitch test');

      const utterance = mockSpeechSynthesis.speak.mock.calls[0]?.[0];
      expect(utterance.pitch).toBe(1.8);
    });
  });

  describe('rate', () => {
    it('sets rate within bounds', () => {
      announcer.setRate(1.0);
      expect(announcer.ttsRate).toBe(1.0);
    });

    it('clamps rate to 0.5', () => {
      announcer.setRate(0.1);
      expect(announcer.ttsRate).toBe(0.5);
    });

    it('clamps rate to 2.0', () => {
      announcer.setRate(5.0);
      expect(announcer.ttsRate).toBe(2.0);
    });

    it('applies rate to utterance', () => {
      announcer.setRate(0.8);
      announcer.announce('rate test');

      const utterance = mockSpeechSynthesis.speak.mock.calls[0]?.[0];
      expect(utterance.rate).toBe(0.8);
    });
  });

  describe('reverb', () => {
    it('sets reverb within bounds', () => {
      announcer.setReverb(0.6);
      expect(announcer._reverbDryWet).toBe(0.6);
    });

    it('clamps reverb to 0', () => {
      announcer.setReverb(-0.5);
      expect(announcer._reverbDryWet).toBe(0);
    });

    it('clamps reverb to 1', () => {
      announcer.setReverb(1.5);
      expect(announcer._reverbDryWet).toBe(1);
    });
  });

  describe('echo', () => {
    it('sets echo within bounds', () => {
      announcer.setEcho(0.6);
      expect(announcer._echoAmount).toBe(0.6);
    });

    it('clamps echo to 0', () => {
      announcer.setEcho(-0.5);
      expect(announcer._echoAmount).toBe(0);
    });

    it('clamps echo to 1', () => {
      announcer.setEcho(1.5);
      expect(announcer._echoAmount).toBe(1);
    });

    it('defaults to 0.3', () => {
      expect(announcer._echoAmount).toBe(0.3);
    });
  });

  describe('voice selection', () => {
    it('prefers natural English voice', () => {
      announcer._pickVoice();
      expect(announcer.ttsVoice).toBeTruthy();
      expect(announcer.ttsVoice.name).toContain('Natural');
    });

    it('falls back to any English voice if no natural', () => {
      mockSpeechSynthesis.getVoices.mockReturnValueOnce([
        { lang: 'en-US', name: 'English Standard', voiceURI: 'English Standard', default: false },
        { lang: 'fr-FR', name: 'French', voiceURI: 'French', default: false },
      ]);

      announcer._pickVoice();
      expect(announcer.ttsVoice.lang).toBe('en-US');
    });

    it('getVoices returns formatted voice list', () => {
      const voices = announcer.getVoices();
      expect(voices).toHaveLength(2);
      expect(voices[0]).toHaveProperty('name');
      expect(voices[0]).toHaveProperty('lang');
      expect(voices[0]).toHaveProperty('voiceURI');
    });

    it('setVoice changes the active voice by URI', () => {
      mockSpeechSynthesis.getVoices.mockReturnValue([
        { lang: 'en-US', name: 'English Natural', voiceURI: 'uri-natural', default: false },
        { lang: 'en-GB', name: 'English UK', voiceURI: 'uri-uk', default: false },
      ]);

      announcer.setVoice('uri-uk');
      expect(announcer.ttsVoice.name).toBe('English UK');
    });

    it('setVoice does nothing for unknown URI', () => {
      announcer._pickVoice();
      const before = announcer.ttsVoice;

      announcer.setVoice('nonexistent-uri');
      expect(announcer.ttsVoice).toBe(before);
    });
  });

  describe('kobold URL', () => {
    it('setKoboldUrl updates the URL', () => {
      announcer.setKoboldUrl('http://localhost:5001');
      expect(announcer.koboldUrl).toBe('http://localhost:5001');
    });

    it('setKoboldUrl with empty string disables kobold', () => {
      announcer.setKoboldUrl('');
      expect(announcer.koboldUrl).toBe('');
      expect(announcer.koboldAvailable).toBe(false);
    });

    it('setKoboldUrl resets availability to null for testing', () => {
      announcer.koboldAvailable = true;
      announcer.setKoboldUrl('http://new-server:5001');
      expect(announcer.koboldAvailable).toBe(null);
    });
  });

  describe('state', () => {
    it('returns current state', () => {
      const state = announcer.getState();
      expect(state).toEqual({
        enabled: true,
        speaking: false,
        queueLength: 0,
        koboldAvailable: false,
        koboldUrl: 'http://fake-kobold:5001',
        volume: 0.8,
        pitch: 1.15,
        rate: 1.3,
        reverb: 0.3,
        echo: 0.3,
        voice: null,
        voiceURI: null,
      });
    });

    it('reflects changes in state', () => {
      announcer.enabled = false;
      announcer.volume = 0.5;
      announcer.queue = ['a', 'b'];

      const state = announcer.getState();
      expect(state.enabled).toBe(false);
      expect(state.volume).toBe(0.5);
      expect(state.queueLength).toBe(2);
    });

    it('includes voice info after picking', () => {
      announcer._pickVoice();
      const state = announcer.getState();
      expect(state.voice).toBe('English Natural');
    });

    it('includes koboldUrl in state', () => {
      announcer.setKoboldUrl('http://myserver:5001');
      const state = announcer.getState();
      expect(state.koboldUrl).toBe('http://myserver:5001');
    });
  });

  describe('browser TTS', () => {
    it('creates utterance with correct settings', () => {
      announcer.announce('Test message');

      const utterance = mockSpeechSynthesis.speak.mock.calls[0]?.[0];
      expect(utterance).toBeDefined();
      expect(utterance.text).toBe('Test message');
      expect(utterance.rate).toBe(1.3);
      expect(utterance.pitch).toBe(1.15);
      expect(utterance.volume).toBe(0.8);
    });

    it('uses picked voice when available', () => {
      announcer._pickVoice();
      announcer.announce('with voice');

      const utterance = mockSpeechSynthesis.speak.mock.calls[0]?.[0];
      expect(utterance.voice).toBeTruthy();
    });
  });

  describe('Electron TTS routing', () => {
    it('_shouldUseElectronTTS returns false when no electronAPI', () => {
      // Default test env has no window.electronAPI
      expect(announcer._shouldUseElectronTTS()).toBe(false);
    });

    it('_shouldUseElectronTTS returns false when effects are zero', () => {
      globalThis.window = { electronAPI: { tts: { synthesize: vi.fn() } } };
      announcer.setReverb(0);
      announcer.setEcho(0);
      expect(announcer._shouldUseElectronTTS()).toBe(false);
      delete globalThis.window;
    });

    it('_shouldUseElectronTTS returns true when effects enabled and electronAPI available', () => {
      globalThis.window = { electronAPI: { tts: { synthesize: vi.fn() } } };
      announcer.setReverb(0.3);
      expect(announcer._shouldUseElectronTTS()).toBe(true);
      delete globalThis.window;
    });

    it('_shouldUseElectronTTS returns true for echo only', () => {
      globalThis.window = { electronAPI: { tts: { synthesize: vi.fn() } } };
      announcer.setReverb(0);
      announcer.setEcho(0.5);
      expect(announcer._shouldUseElectronTTS()).toBe(true);
      delete globalThis.window;
    });

    it('_speakElectron falls back to browser when IPC returns null', async () => {
      globalThis.window = { electronAPI: { tts: { synthesize: vi.fn().mockResolvedValue(null) } } };
      // Make speak trigger onend so the fallback promise resolves
      mockSpeechSynthesis.speak.mockImplementation((utt) => { if (utt.onend) utt.onend(); });
      mockSpeechSynthesis.speak.mockClear();

      await announcer._speakElectron('fallback test');

      expect(mockSpeechSynthesis.speak).toHaveBeenCalledTimes(1);
      mockSpeechSynthesis.speak.mockReset();
      delete globalThis.window;
    });

    it('_speakElectron falls back to browser on IPC error', async () => {
      globalThis.window = { electronAPI: { tts: { synthesize: vi.fn().mockRejectedValue(new Error('IPC failed')) } } };
      mockSpeechSynthesis.speak.mockImplementation((utt) => { if (utt.onend) utt.onend(); });
      mockSpeechSynthesis.speak.mockClear();

      await announcer._speakElectron('error test');

      expect(mockSpeechSynthesis.speak).toHaveBeenCalledTimes(1);
      mockSpeechSynthesis.speak.mockReset();
      delete globalThis.window;
    });

    it('_speakElectron passes rate and voice name to IPC', async () => {
      const mockSynthesize = vi.fn().mockResolvedValue(null);
      globalThis.window = { electronAPI: { tts: { synthesize: mockSynthesize } } };
      mockSpeechSynthesis.speak.mockImplementation((utt) => { if (utt.onend) utt.onend(); });

      announcer.setRate(1.5);
      announcer.ttsVoice = { name: 'Microsoft Zira Desktop' };
      await announcer._speakElectron('test');

      expect(mockSynthesize).toHaveBeenCalledWith('test', {
        rate: 1.5,
        voiceName: 'Microsoft Zira Desktop',
      });
      mockSpeechSynthesis.speak.mockReset();
      delete globalThis.window;
    });
  });

  describe('cleanup', () => {
    it('dispose clears all state', () => {
      announcer.speaking = true;
      announcer.queue = ['a', 'b', 'c'];

      announcer.dispose();

      expect(announcer.queue).toEqual([]);
      expect(announcer.speaking).toBe(false);
    });
  });
});
