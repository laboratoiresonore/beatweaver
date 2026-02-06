/**
 * ListenControls - Audio analysis controls
 * Listen button, device selector dropdown, beat flash indicator
 * Toggle switches for enabling/disabling BPM and Key analysis
 */

import { useState, useCallback, useEffect, useRef } from 'react';

// Hook for hold-to-repeat button behavior with acceleration (same as BpmKeyDisplay)
function useHoldRepeat(callback, initialDelay = 120) {
  const intervalRef = useRef(null);
  const timeoutRef = useRef(null);
  const accelTimeoutRef = useRef(null);
  const callbackRef = useRef(callback);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  const start = useCallback(() => {
    callbackRef.current();
    timeoutRef.current = setTimeout(() => {
      intervalRef.current = setInterval(() => callbackRef.current(), initialDelay);
      accelTimeoutRef.current = setTimeout(() => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = setInterval(() => callbackRef.current(), initialDelay / 2);
        }
      }, 1000);
    }, 400);
  }, [initialDelay]);

  const stop = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (accelTimeoutRef.current) clearTimeout(accelTimeoutRef.current);
    timeoutRef.current = null;
    intervalRef.current = null;
    accelTimeoutRef.current = null;
  }, []);

  useEffect(() => stop, [stop]);

  return { start, stop };
}

// Analog toggle switch component - looks like a physical switch (up/down)
function AnalogSwitch({ enabled, label, onToggle }) {
  const audioRef = useRef(null);

  // Play woosh sound on toggle
  const handleToggle = useCallback(() => {
    // Create and play woosh sound
    if (!audioRef.current) {
      audioRef.current = new AudioContext();
    }
    const ctx = audioRef.current;
    if (ctx.state === 'suspended') ctx.resume();

    // Synthesize a soft woosh sound
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(enabled ? 800 : 400, ctx.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(enabled ? 200 : 600, ctx.currentTime + 0.08);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(2000, ctx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(400, ctx.currentTime + 0.1);

    gainNode.gain.setValueAtTime(0.15, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);

    oscillator.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.12);

    onToggle(!enabled);
  }, [enabled, onToggle]);

  return (
    <div
      className="flex flex-col items-center cursor-pointer select-none"
      onClick={handleToggle}
      title={`${label} analysis: ${enabled ? 'ON' : 'OFF'}`}
    >
      {/* Switch housing */}
      <div className={`
        relative w-5 h-8 rounded-sm
        bg-gradient-to-b from-zinc-700 via-zinc-800 to-zinc-900
        border border-zinc-600
        shadow-inner
        transition-all duration-75
      `}>
        {/* Switch lever */}
        <div className={`
          absolute left-0.5 right-0.5 h-3.5 rounded-sm
          bg-gradient-to-b from-zinc-400 via-zinc-500 to-zinc-600
          border-t border-zinc-300
          shadow-md
          transition-all duration-75
          ${enabled ? 'top-0.5' : 'bottom-0.5'}
        `}>
          {/* Lever grip lines */}
          <div className="absolute inset-x-1 top-1 space-y-0.5">
            <div className="h-px bg-zinc-700 opacity-50" />
            <div className="h-px bg-zinc-700 opacity-50" />
          </div>
        </div>
      </div>
      {/* Label */}
      <span className={`
        text-[9px] font-bold uppercase mt-0.5 tracking-wide
        ${enabled ? 'text-zinc-400' : 'text-zinc-600'}
        transition-colors duration-75
      `}>
        {label}
      </span>
    </div>
  );
}

export function ListenControls({
  analyzing,
  bpmLocked,
  keyLocked,
  beatFlash,
  audioDevices,
  selectedDevice,
  onToggleAnalysis,
  onSelectDevice,
  onLoadDevices,
  bpmAnalysisEnabled = true,
  keyAnalysisEnabled = true,
  onToggleBpmAnalysis,
  onToggleKeyAnalysis,
  onAdjustBpm,
}) {
  const [showDeviceMenu, setShowDeviceMenu] = useState(false);

  // Close device menu on outside click
  useEffect(() => {
    if (!showDeviceMenu) return;
    const handleClick = () => setShowDeviceMenu(false);
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [showDeviceMenu]);

  const handleDeviceMenuToggle = useCallback(async (e) => {
    e.stopPropagation();
    await onLoadDevices();
    setShowDeviceMenu(prev => !prev);
  }, [onLoadDevices]);

  const handleSelectDevice = useCallback((deviceId) => {
    onSelectDevice(deviceId);
    setShowDeviceMenu(false);
  }, [onSelectDevice]);

  // Hold-to-repeat for BPM +/- buttons (0.1 increments like BpmKeyDisplay)
  const decrementBpm = useCallback(() => {
    onAdjustBpm?.(-0.1);
  }, [onAdjustBpm]);

  const incrementBpm = useCallback(() => {
    onAdjustBpm?.(0.1);
  }, [onAdjustBpm]);

  const minusHold = useHoldRepeat(decrementBpm, 120);
  const plusHold = useHoldRepeat(incrementBpm, 120);

  return (
    <div className="flex items-center gap-2">
      {/* Analysis Toggle Switches */}
      <div className="flex items-center gap-1.5 mr-1">
        <AnalogSwitch
          enabled={bpmAnalysisEnabled}
          label="BPM"
          onToggle={onToggleBpmAnalysis}
        />
        <AnalogSwitch
          enabled={keyAnalysisEnabled}
          label="KEY"
          onToggle={onToggleKeyAnalysis}
        />
      </div>

      {/* BPM +/- Buttons (visible when BPM is locked) - hold to repeat */}
      {bpmLocked && onAdjustBpm && (
        <div className="flex items-center gap-0.5">
          <button
            onMouseDown={minusHold.start}
            onMouseUp={minusHold.stop}
            onMouseLeave={minusHold.stop}
            onTouchStart={minusHold.start}
            onTouchEnd={minusHold.stop}
            className="w-6 h-6 text-xs font-bold bg-dj-surface border border-dj-border rounded hover:border-dj-muted hover:bg-dj-border transition-colors select-none active:bg-dj-accent active:text-black"
            title="BPM - (hold to repeat)"
          >
            −
          </button>
          <button
            onMouseDown={plusHold.start}
            onMouseUp={plusHold.stop}
            onMouseLeave={plusHold.stop}
            onTouchStart={plusHold.start}
            onTouchEnd={plusHold.stop}
            className="w-6 h-6 text-xs font-bold bg-dj-surface border border-dj-border rounded hover:border-dj-muted hover:bg-dj-border transition-colors select-none active:bg-dj-accent active:text-black"
            title="BPM + (hold to repeat)"
          >
            +
          </button>
        </div>
      )}

      {/* Beat Indicator */}
      {analyzing && (
        <div
          className={`w-3 h-3 rounded-full transition-all duration-75 ${
            beatFlash ? 'bg-green-400 scale-125' : 'bg-dj-border'
          }`}
        />
      )}

      {/* Listen Button + Device Selector */}
      <div className="relative flex items-center">
        <button
          onClick={onToggleAnalysis}
          className={`px-3 py-1.5 rounded-l text-xs font-bold transition-all ${
            analyzing
              ? 'bg-green-600 hover:bg-green-700'
              : 'bg-dj-surface border border-dj-border hover:border-dj-muted'
          }`}
        >
          {analyzing ? (bpmLocked && keyLocked ? 'LOCKED' : 'ANALYZING...') : 'LISTEN'}
        </button>
        <button
          onClick={handleDeviceMenuToggle}
          className="px-2 py-1.5 rounded-r text-xs bg-dj-surface border border-l-0 border-dj-border hover:border-dj-muted"
        >
          ▼
        </button>

        {showDeviceMenu && audioDevices.length > 0 && (
          <div
            className="absolute top-full left-0 mt-1 bg-dj-surface border border-dj-border rounded shadow-lg z-50 min-w-[200px]"
            onClick={e => e.stopPropagation()}
          >
            <div className="px-3 py-1.5 text-[10px] text-dj-muted uppercase border-b border-dj-border">
              Audio Input
            </div>
            {audioDevices.map(device => (
              <button
                key={device.id}
                onClick={() => handleSelectDevice(device.id)}
                className={`w-full px-3 py-2 text-left text-xs hover:bg-dj-border transition-colors ${
                  selectedDevice === device.id ? 'text-dj-accent' : ''
                }`}
              >
                {device.label}
                {selectedDevice === device.id && ' ✓'}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default ListenControls;
