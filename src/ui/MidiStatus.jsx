/**
 * MidiStatus - Shows MIDI controller connection status + TTS controls
 * Green dot = connected, red dot = disconnected
 * TTS button toggles on/off, click arrow to expand voice settings
 */

import { useState, useRef, useEffect } from 'react';
import { VoiceControls } from './VoiceControls.jsx';

export function MidiStatus({
  connected,
  deviceName,
  announcerEnabled,
  onToggleAnnouncer,
  voiceSettings,
  onVoiceChange,
  onVoiceTest,
  onVoiceSave,
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
  const [showVoicePanel, setShowVoicePanel] = useState(false);
  const panelRef = useRef(null);

  // Close panel on outside click
  useEffect(() => {
    if (!showVoicePanel) return;

    const handleClickOutside = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        setShowVoicePanel(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showVoicePanel]);

  return (
    <div className="flex items-center gap-2">
      {/* MIDI indicator */}
      <div className="flex items-center gap-1.5" title={connected ? deviceName : 'No MIDI controller'}>
        <div
          className={`w-2 h-2 rounded-full ${connected ? 'bg-dj-green' : 'bg-dj-border-strong'}`}
          style={connected ? { boxShadow: '0 0 4px rgba(0, 200, 83, 0.4)' } : {}}
        />
        <span className={`text-[10px] uppercase tracking-wider ${connected ? 'text-dj-text-secondary' : 'text-dj-muted'}`}>
          {connected ? 'MIDI' : 'NO MIDI'}
        </span>
      </div>

      {/* Divider */}
      <div className="w-px h-4 bg-dj-border" />

      {/* Announcer toggle + voice settings */}
      <div className="relative z-[999]" ref={panelRef}>
        <div className="flex items-center gap-0">
          {/* TTS on/off button */}
          <button
            onClick={onToggleAnnouncer}
            className={`px-2 py-0.5 rounded-l text-[10px] font-bold font-display tracking-wider transition-all ${
              announcerEnabled
                ? 'bg-dj-surface border border-dj-accent/40 text-dj-accent border-r-0'
                : 'bg-dj-surface border border-dj-border-strong text-dj-muted border-r-0'
            }`}
            title={announcerEnabled ? 'Voice announcements ON' : 'Voice announcements OFF'}
          >
            {announcerEnabled ? 'TTS ON' : 'TTS OFF'}
          </button>

          {/* Settings expand arrow */}
          <button
            onClick={() => setShowVoicePanel(!showVoicePanel)}
            className={`px-1 py-0.5 rounded-r text-[10px] font-bold transition-all ${
              showVoicePanel
                ? 'bg-dj-surface border border-dj-accent text-dj-accent'
                : announcerEnabled
                  ? 'bg-dj-surface border border-dj-accent/40 text-dj-accent/70'
                  : 'bg-dj-surface border border-dj-border-strong text-dj-muted'
            }`}
            title="Voice settings"
          >
            {showVoicePanel ? '\u25B2' : '\u25BC'}
          </button>
        </div>

        {/* Voice settings panel */}
        {showVoicePanel && voiceSettings && (
          <VoiceControls
            values={voiceSettings}
            onChange={onVoiceChange}
            onTest={onVoiceTest}
            onSave={onVoiceSave}
            voices={voices}
            selectedVoice={selectedVoice}
            onVoiceSelect={onVoiceSelect}
            ttsMode={ttsMode}
            onTtsModeChange={onTtsModeChange}
            koboldUrl={koboldUrl}
            onKoboldUrlChange={onKoboldUrlChange}
            koboldAvailable={koboldAvailable}
            companionAvailable={companionAvailable}
            companionReady={companionReady}
            saveStatus={saveStatus}
          />
        )}
      </div>
    </div>
  );
}

export default MidiStatus;
