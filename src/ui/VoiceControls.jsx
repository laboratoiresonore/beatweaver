/**
 * VoiceControls - TTS voice settings panel
 * Voice dropdown, Kobold URL, sliders for pitch/speed/reverb/echo/volume,
 * test + save buttons. Slides open/closed below the TTS toggle.
 */

import { useState, useEffect } from 'react';

const SLIDERS = [
  { key: 'volume',  label: 'VOL',    min: 0,   max: 1,   step: 0.05, format: (v) => `${Math.round(v * 100)}%` },
  { key: 'pitch',   label: 'PITCH',  min: 0.5, max: 2.0, step: 0.05, format: (v) => v.toFixed(2) },
  { key: 'rate',    label: 'SPEED',  min: 0.5, max: 2.0, step: 0.05, format: (v) => `${v.toFixed(1)}x` },
  { key: 'reverb',  label: 'REVERB', min: 0,   max: 1,   step: 0.05, format: (v) => `${Math.round(v * 100)}%` },
  { key: 'echo',    label: 'ECHO',   min: 0,   max: 1,   step: 0.05, format: (v) => `${Math.round(v * 100)}%` },
];

export function VoiceControls({
  values,
  onChange,
  onTest,
  onSave,
  voices,
  selectedVoice,
  onVoiceSelect,
  ttsMode,
  onTtsModeChange,
  koboldUrl,
  onKoboldUrlChange,
  koboldAvailable,
  companionAvailable,
  companionReady,
  saveStatus,
}) {
  const [urlDraft, setUrlDraft] = useState(koboldUrl || '');

  // Sync draft when prop changes (e.g., settings loaded from disk)
  useEffect(() => {
    setUrlDraft(koboldUrl || '');
  }, [koboldUrl]);

  const handleUrlBlur = () => {
    if (urlDraft !== koboldUrl) {
      onKoboldUrlChange(urlDraft);
    }
  };

  const handleUrlKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.target.blur();
    }
  };

  return (
    <div className="absolute right-0 top-full mt-1 z-[1000] bg-dj-surface border border-dj-border rounded-lg p-3 min-w-[260px]" style={{ boxShadow: '0 4px 24px rgba(0, 0, 0, 0.5), 0 0 1px rgba(80, 180, 255, 0.1)' }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] text-dj-muted uppercase tracking-wider">Voice Settings</span>
        <div className="flex items-center gap-1">
          <button
            onClick={onTest}
            className="px-2 py-0.5 rounded text-[9px] font-bold font-display tracking-wider bg-dj-bg border border-dj-accent/30 text-dj-accent hover:border-dj-accent transition-colors"
          >
            TEST
          </button>
          <button
            onClick={onSave}
            className={`px-2 py-0.5 rounded text-[9px] font-bold font-display tracking-wider border transition-colors ${
              saveStatus === 'saved'
                ? 'bg-dj-green/10 border-dj-green/50 text-dj-green'
                : 'bg-dj-bg border-dj-border-strong text-dj-text hover:border-dj-accent'
            }`}
          >
            {saveStatus === 'saved' ? 'SAVED' : 'SAVE'}
          </button>
        </div>
      </div>

      {/* TTS Mode Toggle - USER CHOOSES */}
      <div className="mb-3">
        <label className="text-[9px] text-dj-muted uppercase tracking-wider block mb-1">
          TTS Engine
        </label>
        <div className="flex gap-1">
          <button
            onClick={() => onTtsModeChange('browser')}
            className={`flex-1 px-2 py-1 rounded text-[10px] font-bold font-display tracking-wider transition-colors ${
              ttsMode === 'browser'
                ? 'bg-dj-accent text-black'
                : 'bg-dj-bg border border-dj-border-strong text-dj-muted hover:text-dj-accent hover:border-dj-accent/40'
            }`}
          >
            BROWSER
          </button>
          <button
            onClick={() => onTtsModeChange('companion')}
            className={`flex-1 px-2 py-1 rounded text-[10px] font-bold font-display tracking-wider transition-colors ${
              ttsMode === 'companion'
                ? 'bg-dj-accent text-black'
                : 'bg-dj-bg border border-dj-border-strong text-dj-muted hover:text-dj-accent hover:border-dj-accent/40'
            }`}
            title="Bundled offline neural TTS (Piper) — no LLM server required"
          >
            COMPANION
          </button>
          <button
            onClick={() => onTtsModeChange('kobold')}
            className={`flex-1 px-2 py-1 rounded text-[10px] font-bold font-display tracking-wider transition-colors ${
              ttsMode === 'kobold'
                ? 'bg-dj-accent text-black'
                : 'bg-dj-bg border border-dj-border-strong text-dj-muted hover:text-dj-accent hover:border-dj-accent/40'
            }`}
          >
            KOBOLD
          </button>
        </div>
      </div>

      {/* Companion status — only show in companion mode */}
      {ttsMode === 'companion' && (
        <div className="mb-3">
          <label className="text-[9px] text-dj-muted uppercase tracking-wider block mb-1">
            Companion Voice
          </label>
          <div className="flex items-center gap-2">
            <div
              className={`w-2 h-2 rounded-full shrink-0 ${
                companionAvailable === true && companionReady
                  ? 'bg-dj-green'
                  : companionAvailable === true
                    ? 'bg-dj-warning'
                    : companionAvailable === null
                      ? 'bg-dj-warning'
                      : 'bg-dj-error'
              }`}
              title={
                companionAvailable === true && companionReady
                  ? 'Companion ready'
                  : companionAvailable === true
                    ? 'Companion starting (downloading model)…'
                    : companionAvailable === null
                      ? 'Testing companion…'
                      : 'Companion not running'
              }
            />
            <span className="text-[9px] text-dj-text-secondary">
              {companionAvailable === true && companionReady
                ? 'Ready (offline neural)'
                : companionAvailable === true
                  ? 'Setting up first-launch model…'
                  : companionAvailable === null
                    ? 'Connecting…'
                    : 'Not running — fallback to browser'}
            </span>
          </div>
          {companionAvailable === false && (
            <div className="mt-1 text-[8px] text-dj-muted opacity-80">
              Companion auto-starts when the packaged build runs. First launch downloads the Piper binary + voice model (~70 MB total) — subsequent launches skip the setup. In dev: <code>node voice-companion/src/server.js</code>
            </div>
          )}
        </div>
      )}

      {/* Kobold TTS URL - only show when Kobold mode selected */}
      {ttsMode === 'kobold' && (
        <div className="mb-3">
          <label className="text-[9px] text-dj-muted uppercase tracking-wider block mb-1">
            Kobold TTS Server
          </label>
          <div className="flex items-center gap-1">
            <input
              type="text"
              value={urlDraft}
              onChange={(e) => setUrlDraft(e.target.value)}
              onBlur={handleUrlBlur}
              onKeyDown={handleUrlKeyDown}
              placeholder="http://localhost:5001"
              className="flex-1 bg-dj-bg border border-dj-border rounded text-[10px] text-white p-1 focus:border-dj-accent outline-none placeholder-dj-muted"
            />
            <div
              className={`w-2 h-2 rounded-full shrink-0 ${
                koboldAvailable === true
                  ? 'bg-dj-green'
                  : koboldAvailable === null
                    ? 'bg-dj-warning'
                    : 'bg-dj-error'
              }`}
              title={
                koboldAvailable === true
                  ? 'Connected'
                  : koboldAvailable === null
                    ? 'Testing...'
                    : 'Not connected'
              }
            />
          </div>
          {koboldAvailable === false && (
            <div className="mt-1 text-[8px] text-red-400">
              Kobold not connected - check URL
            </div>
          )}
        </div>
      )}

      {/* Voice selection dropdown - only show in browser mode */}
      {ttsMode === 'browser' && voices && voices.length > 0 && (
        <div className="mb-3">
          <label className="text-[9px] text-dj-muted uppercase tracking-wider block mb-1">
            Browser Voice
          </label>
          <select
            value={selectedVoice || ''}
            onChange={(e) => onVoiceSelect(e.target.value)}
            className="w-full bg-dj-bg border border-dj-border rounded text-[10px] text-white p-1 focus:border-dj-accent outline-none"
          >
            {voices.map((voice) => (
              <option key={voice.voiceURI} value={voice.voiceURI}>
                {voice.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Sliders */}
      <div className="flex flex-col gap-2">
        {SLIDERS.map(({ key, label, min, max, step, format }) => (
          <div key={key} className="flex items-center gap-2">
            <span className="text-[9px] text-dj-muted w-12 text-right uppercase">{label}</span>
            <input
              type="range"
              min={min}
              max={max}
              step={step}
              value={values[key]}
              onChange={(e) => onChange(key, parseFloat(e.target.value))}
              className="flex-1 h-1 accent-dj-accent cursor-pointer"
            />
            <span className="text-[9px] text-white tabular-nums w-8">{format(values[key])}</span>
          </div>
        ))}
      </div>

      {/* Effects note */}
      <div className="mt-2 text-[8px] text-dj-muted opacity-60">
        Reverb + Echo use Web Audio processing
      </div>
    </div>
  );
}

export default VoiceControls;
