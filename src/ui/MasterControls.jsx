/**
 * MasterControls - Master volume and fade settings
 * Instrument volume, voice volume, fade in/out times
 * Expandable panel from top bar
 */

import { useState, useRef, useEffect } from 'react';

const formatPercent = (v) => `${Math.round(v * 100)}%`;
const formatSeconds = (v) => v === 0 ? 'OFF' : `${v.toFixed(1)}s`;

export function MasterControls({ values, onChange }) {
  const [expanded, setExpanded] = useState(false);
  const panelRef = useRef(null);

  useEffect(() => {
    if (!expanded) return;

    const handleClickOutside = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        setExpanded(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [expanded]);

  return (
    <div className="relative" ref={panelRef}>
      {/* Toggle button */}
      <button
        onClick={() => setExpanded(!expanded)}
        className={`px-2 py-1 rounded text-[10px] font-bold font-display tracking-wider transition-all ${
          expanded
            ? 'bg-dj-surface border border-dj-accent text-dj-accent'
            : 'bg-dj-surface border border-dj-border-strong text-dj-muted hover:text-dj-accent hover:border-dj-accent transition-colors'
        }`}
        title="Master controls"
      >
        MASTER
      </button>

      {/* Panel */}
      {expanded && (
        <div className="absolute right-0 top-full mt-1 z-50 bg-dj-surface border border-dj-border rounded-lg p-3 shadow-xl min-w-[220px]" style={{ boxShadow: '0 4px 24px rgba(0, 0, 0, 0.5), 0 0 1px rgba(80, 180, 255, 0.1)' }}>
          {/* Volumes section */}
          <div className="mb-3">
            <span className="text-[9px] text-dj-muted uppercase tracking-wider">Volumes</span>
            <div className="flex flex-col gap-2 mt-1.5">
              <SliderRow
                label="INST"
                value={values.instrumentVolume}
                min={0} max={1} step={0.05}
                format={formatPercent}
                onChange={(v) => onChange('instrumentVolume', v)}
              />
              <SliderRow
                label="VOICE"
                value={values.voiceVolume}
                min={0} max={1} step={0.05}
                format={formatPercent}
                onChange={(v) => onChange('voiceVolume', v)}
              />
            </div>
          </div>

          {/* Fade section */}
          <div>
            <span className="text-[9px] text-dj-muted uppercase tracking-wider">Fades</span>
            <div className="flex flex-col gap-2 mt-1.5">
              <SliderRow
                label="IN"
                value={values.fadeIn}
                min={0} max={5} step={0.1}
                format={formatSeconds}
                onChange={(v) => onChange('fadeIn', v)}
              />
              <SliderRow
                label="OUT"
                value={values.fadeOut}
                min={0} max={5} step={0.1}
                format={formatSeconds}
                onChange={(v) => onChange('fadeOut', v)}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SliderRow({ label, value, min, max, step, format, onChange }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[9px] text-dj-muted w-10 text-right uppercase tracking-wider">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="flex-1 h-1 accent-dj-accent cursor-pointer"
      />
      <span className="text-[9px] text-white tabular-nums w-8">{format(value)}</span>
    </div>
  );
}

export default MasterControls;
