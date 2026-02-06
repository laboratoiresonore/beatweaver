/**
 * BpmKeyDisplay - Combined BPM + Key status bar
 * Shows detection state, locked values, confidence, and controls
 */

import { useRef, useCallback, useEffect } from 'react';

const KEYS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

// Pioneer/Camelot Wheel key colors (same as rekordbox)
// Major keys (outer wheel) - minor key color = same position on inner wheel
const KEY_COLORS = {
  'C':  '#00D4AA', // 8B - Teal
  'C#': '#00B4D8', // 3B - Cyan
  'Db': '#00B4D8', // 3B
  'D':  '#0077B6', // 10B - Blue
  'D#': '#5E60CE', // 5B - Indigo
  'Eb': '#5E60CE', // 5B
  'E':  '#7B2CBF', // 12B - Purple
  'F':  '#C77DFF', // 7B - Violet
  'F#': '#FF6B9D', // 2B - Pink
  'Gb': '#FF6B9D', // 2B
  'G':  '#FF477E', // 9B - Hot Pink
  'G#': '#FF5C5C', // 4B - Red
  'Ab': '#FF5C5C', // 4B
  'A':  '#FF8C42', // 11B - Orange
  'A#': '#FFD166', // 6B - Yellow
  'Bb': '#FFD166', // 6B
  'B':  '#BFFF00', // 1B - Lime
  // Minor keys (inner wheel) - use 'm' suffix
  'Cm':  '#00D4AA',
  'C#m': '#00B4D8',
  'Dbm': '#00B4D8',
  'Dm':  '#0077B6',
  'D#m': '#5E60CE',
  'Ebm': '#5E60CE',
  'Em':  '#7B2CBF',
  'Fm':  '#C77DFF',
  'F#m': '#FF6B9D',
  'Gbm': '#FF6B9D',
  'Gm':  '#FF477E',
  'G#m': '#FF5C5C',
  'Abm': '#FF5C5C',
  'Am':  '#FF8C42',
  'A#m': '#FFD166',
  'Bbm': '#FFD166',
  'Bm':  '#BFFF00',
};

function getKeyColor(key) {
  return KEY_COLORS[key] || '#ffffff';
}

// Hook for hold-to-repeat button behavior with acceleration
function useHoldRepeat(callback, initialDelay = 250) {
  const intervalRef = useRef(null);
  const timeoutRef = useRef(null);
  const accelTimeoutRef = useRef(null);
  const callbackRef = useRef(callback);
  const currentDelayRef = useRef(initialDelay);

  // Keep callback ref up to date to avoid stale closures
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  const start = useCallback(() => {
    currentDelayRef.current = initialDelay;

    // Immediate first action
    callbackRef.current();

    // Start repeating after initial delay
    timeoutRef.current = setTimeout(() => {
      // Start at normal speed
      intervalRef.current = setInterval(() => callbackRef.current(), initialDelay);

      // After 1 second of holding, double the speed
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
    currentDelayRef.current = initialDelay;
  }, [initialDelay]);

  // Cleanup on unmount
  useEffect(() => stop, [stop]);

  return { start, stop };
}

export function BpmKeyDisplay({
  bpm,
  detectedBpm,
  bpmConfidence,
  bpmLocked,
  currentKey,
  detectedKey,
  keyConfidence,
  keyLocked,
  onBpmChange,
  onKeyChange,
  onUnlockBpm,
  onUnlockKey,
  onUnlockAll,
}) {
  const decrementBpm = useCallback(() => {
    onBpmChange({ target: { value: Math.max(30, bpm - 0.1).toFixed(1) } });
  }, [bpm, onBpmChange]);

  const incrementBpm = useCallback(() => {
    onBpmChange({ target: { value: Math.min(300, bpm + 0.1).toFixed(1) } });
  }, [bpm, onBpmChange]);

  const minusHold = useHoldRepeat(decrementBpm, 120);
  const plusHold = useHoldRepeat(incrementBpm, 120);

  return (
    <>
      {/* BPM Display */}
      <div className="flex items-center gap-2">
        {/* Minus button - hold to repeat */}
        <button
          onMouseDown={bpmLocked ? undefined : minusHold.start}
          onMouseUp={minusHold.stop}
          onMouseLeave={minusHold.stop}
          onTouchStart={bpmLocked ? undefined : minusHold.start}
          onTouchEnd={minusHold.stop}
          disabled={bpmLocked}
          className={`w-8 h-8 rounded text-lg font-bold transition-colors select-none ${
            bpmLocked
              ? 'bg-dj-surface text-dj-muted cursor-not-allowed'
              : 'bg-dj-surface border border-dj-border text-white hover:border-dj-accent hover:text-dj-accent active:bg-dj-accent active:text-black'
          }`}
        >
          −
        </button>

        <div className="flex flex-col items-center min-w-[70px]">
          <span className={`text-3xl font-bold tabular-nums ${bpmLocked ? 'text-green-400' : ''}`}>
            {Number(bpm).toFixed(1)}
          </span>
          <span className={`text-[10px] uppercase ${bpmLocked ? 'text-green-400' : 'text-dj-muted'}`}>
            {bpmLocked ? 'BPM LOCKED' : 'BPM'}
          </span>
        </div>

        {/* Plus button - hold to repeat */}
        <button
          onMouseDown={bpmLocked ? undefined : plusHold.start}
          onMouseUp={plusHold.stop}
          onMouseLeave={plusHold.stop}
          onTouchStart={bpmLocked ? undefined : plusHold.start}
          onTouchEnd={plusHold.stop}
          disabled={bpmLocked}
          className={`w-8 h-8 rounded text-lg font-bold transition-colors select-none ${
            bpmLocked
              ? 'bg-dj-surface text-dj-muted cursor-not-allowed'
              : 'bg-dj-surface border border-dj-border text-white hover:border-dj-accent hover:text-dj-accent active:bg-dj-accent active:text-black'
          }`}
        >
          +
        </button>

        {bpmLocked && (
          <button
            onClick={onUnlockBpm}
            className="px-2 py-1 rounded text-[10px] font-bold bg-dj-surface border border-dj-border hover:border-dj-muted"
          >
            UNLOCK
          </button>
        )}
      </div>

      {/* Divider */}
      <div className="w-px h-8 bg-dj-border" />

      {/* Key Display */}
      <div className="flex items-center gap-2">
        <div className="flex flex-col items-center min-w-[50px]">
          <span
            className="text-3xl font-bold"
            style={{ color: keyLocked ? getKeyColor(detectedKey || currentKey) : getKeyColor(detectedKey || currentKey) }}
          >
            {detectedKey || currentKey}
          </span>
          <span className={`text-[10px] uppercase ${keyLocked ? 'text-green-400' : 'text-dj-muted'}`}>
            {keyLocked ? 'KEY LOCKED' : 'KEY'}
          </span>
        </div>

        {!keyLocked && (
          <select
            value={currentKey}
            onChange={onKeyChange}
            className="bg-dj-surface border border-dj-border rounded px-2 py-1 text-sm"
          >
            {KEYS.map(key => <option key={key} value={key}>{key}</option>)}
          </select>
        )}

        {keyLocked && (
          <button
            onClick={onUnlockKey}
            className="px-2 py-1 rounded text-[10px] font-bold bg-dj-surface border border-dj-border hover:border-dj-muted"
          >
            UNLOCK
          </button>
        )}
      </div>

      {/* Divider */}
      <div className="w-px h-8 bg-dj-border" />

      {/* Unlock All (when both locked) */}
      {bpmLocked && keyLocked && (
        <button
          onClick={onUnlockAll}
          className="px-2 py-1 rounded text-[10px] font-bold bg-dj-surface border border-dj-border hover:border-dj-muted"
        >
          UNLOCK ALL
        </button>
      )}
    </>
  );
}

export default BpmKeyDisplay;
