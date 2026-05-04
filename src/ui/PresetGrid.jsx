/**
 * PresetGrid - 4-column preset grid (BASS, ENERGY, TEXTURE, FX)
 * Each column shows 4 cells, each cell has 2 presets (Bank A top, Bank B bottom)
 * Total: 32 presets (8 per category)
 */

import { useMemo, useRef, useState, useEffect } from 'react';
import { getPresetsByCategoryAndBank, CATEGORY_COLORS, PATTERNS } from '../presets/index.js';
import { SparkEffect } from './SparkEffect.jsx';

// Mini VU meter (simulated) - shows animated bars when column is active
function ColumnVuMini({ active, color }) {
  if (!active) return null;
  return (
    <div className="column-vu-mini">
      {[1, 2, 3, 4].map(i => (
        <div
          key={i}
          className={`column-vu-bar animate-vu-sim-${i}`}
          style={{ backgroundColor: color, opacity: 0.7 }}
        />
      ))}
    </div>
  );
}

// Pattern preview dots shown on hover
function PatternPreview({ patternName, visible }) {
  const pattern = PATTERNS[patternName];
  if (!pattern || !pattern.notes) return null;

  const notes = pattern.notes;
  const maxNote = 8; // Show up to 8 steps
  const displayNotes = notes.slice(0, maxNote);

  return (
    <div className={`pattern-preview ${visible ? 'pattern-preview--visible' : ''}`}>
      {displayNotes.map((note, i) => {
        const isRest = note === null || note === undefined;
        const isChord = Array.isArray(note);
        const height = isRest ? 2 : isChord ? 8 : 5;
        return (
          <div
            key={i}
            className={`pattern-dot ${isRest ? 'pattern-dot--rest' : ''}`}
            style={{ height }}
          />
        );
      })}
    </div>
  );
}

// Diagonal half-button (used in DoublePresetButton)
// NOTE: SparkEffect is rendered in parent DoublePresetButton to avoid clip-path clipping
function DiagonalButton({ preset, isActive, isReady, isArmed, onToggle, onArm, onFireArmed, position }) {
  const [wobbling, setWobbling] = useState(false);
  const [hovered, setHovered] = useState(false);
  const wasActiveRef = useRef(isActive);

  // Trigger wobble when button becomes active (works for both click and MIDI)
  useEffect(() => {
    const shouldWobble = isActive && !wasActiveRef.current;

    // Always update ref BEFORE checking wobble (fix for re-activation)
    wasActiveRef.current = isActive;

    if (shouldWobble) {
      setWobbling(true);
      const timer = setTimeout(() => setWobbling(false), 600);
      return () => clearTimeout(timer);
    }
  }, [isActive]);

  const handleClick = (e) => {
    e.stopPropagation();
    setWobbling(true);
    setTimeout(() => setWobbling(false), 600);
    onToggle();
  };

  const handleContextMenu = (e) => {
    // Right-click: arm/disarm. preventDefault stops the OS context menu.
    e.preventDefault();
    e.stopPropagation();
    onArm?.();
  };

  const handleFireArmedClick = (e) => {
    // Click the FIRE pip (visible only when armed): fire just this armed preset.
    e.stopPropagation();
    onFireArmed?.();
  };

  // Diagonal clip paths: top-left triangle vs bottom-right triangle (backslash direction \)
  const clipPath = position === 'top-right'
    ? 'polygon(100% 0, 100% 100%, 0 100%)'  // Bottom-right triangle
    : 'polygon(0 0, 100% 0, 0 100%)';       // Top-left triangle

  // Text in corners - moved further in to avoid clipping
  const textStyle = position === 'top-right'
    ? { bottom: '20%', right: '20%' }
    : { top: '20%', left: '20%' };

  // Determine bank for glow color (position tells us: bottom-left = Bank A, top-right = Bank B)
  const bankClass = position === 'bottom-left' ? 'bank-a' : 'bank-b';

  return (
    <button
      onClick={handleClick}
      onContextMenu={handleContextMenu}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      title={`${preset.name} — click to fire, right-click to arm`}
      aria-pressed={isActive}
      aria-label={`${preset.name} (${preset.bank}) — ${isActive ? 'active' : isArmed ? 'armed' : 'idle'}`}
      className={`
        absolute inset-0 transition-all duration-75
        ${isActive ? 'z-20' : 'z-10 hover:z-15'}
        ${isReady && !isActive ? `preset-ready ${bankClass}` : ''}
        ${isArmed && !isActive ? `preset-armed ${bankClass}` : ''}
      `}
      style={{
        clipPath,
        backgroundColor: isActive
          ? preset.color
          : isArmed
            ? `${preset.color}33` /* 20% tint when armed */
            : isReady
              ? 'rgba(35, 35, 45, 0.9)'
              : 'rgba(22, 22, 30, 0.85)',
        boxShadow: isActive ? `inset 0 0 20px rgba(0, 0, 0, 0.3)` : 'none',
      }}
    >
      {/* Pattern preview on hover */}
      {!isActive && preset.pattern && (
        <PatternPreview patternName={preset.pattern} visible={hovered} />
      )}
      <span
        className={`
          absolute font-bold text-xs whitespace-nowrap font-display tracking-wide
          ${wobbling ? 'preset-text-wobble' : ''}
          ${isActive ? 'text-white' : (isReady ? 'text-white/90' : 'text-white/50')}
        `}
        style={textStyle}
      >
        {preset.name}
      </span>
      {isActive && (
        <div
          className="absolute w-4 h-1 rounded-full animate-led-breathe"
          style={{
            backgroundColor: 'rgba(255, 255, 255, 0.85)',
            boxShadow: '0 0 6px rgba(255, 255, 255, 0.4)',
            ...(position === 'top-right' ? { top: '55%', left: '50%' } : { top: '22%', left: '12%' }),
          }}
        />
      )}
      {isReady && !isActive && (
        <div
          className="absolute w-1.5 h-1.5 rounded-full animate-led-breathe"
          style={{
            backgroundColor: '#FFA600',
            boxShadow: '0 0 6px rgba(255, 166, 0, 0.5)',
            ...(position === 'top-right' ? { top: '55%', left: '55%' } : { top: '20%', left: '15%' }),
          }}
        />
      )}
      {isArmed && !isActive && (
        // Small FIRE pip on the armed half. Click fires just this preset (and disarms it).
        // Sized small to fit cleanly inside the diagonal triangle without crowding the name.
        <span
          role="button"
          tabIndex={-1}
          onClick={handleFireArmedClick}
          className="preset-fire-pip"
          style={{
            position: 'absolute',
            ...(position === 'top-right'
              ? { bottom: '8%', right: '8%' }
              : { top: '8%', left: '8%' }),
            color: preset.color,
            border: `1px solid ${preset.color}`,
            backgroundColor: 'rgba(0, 0, 0, 0.55)',
            padding: '1px 5px',
            borderRadius: 3,
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: '0.06em',
            textShadow: `0 0 4px ${preset.color}`,
            boxShadow: `0 0 6px ${preset.color}55`,
            zIndex: 25,
          }}
        >
          FIRE
        </span>
      )}
    </button>
  );
}

// Double preset cell - two diagonal buttons overlapping
// SparkEffect is rendered here (outside clip-path) so sparks aren't clipped
function DoublePresetButton({ presetA, presetB, activePresets, readyPresets, armedPresets, onTogglePreset, onArmPreset, onFireArmed }) {
  const cellRef = useRef(null);
  const isActiveA = activePresets.has(presetA.id);
  const isActiveB = activePresets.has(presetB.id);
  const isReadyA = readyPresets?.has(presetA.id) || false;
  const isReadyB = readyPresets?.has(presetB.id) || false;
  const isArmedA = armedPresets?.has(presetA.id) || false;
  const isArmedB = armedPresets?.has(presetB.id) || false;

  return (
    <div className="double-preset-cell" ref={cellRef}>
      {/* Diagonal divider line */}
      <div className="preset-diagonal-line" />
      {/* Bottom-left: Bank A */}
      <DiagonalButton
        preset={presetA}
        isActive={isActiveA}
        isReady={isReadyA}
        isArmed={isArmedA}
        onToggle={() => onTogglePreset(presetA.id)}
        onArm={() => onArmPreset?.(presetA.id)}
        onFireArmed={() => onFireArmed?.(presetA.id)}
        position="bottom-left"
      />
      {/* Top-right: Bank B */}
      <DiagonalButton
        preset={presetB}
        isActive={isActiveB}
        isReady={isReadyB}
        isArmed={isArmedB}
        onToggle={() => onTogglePreset(presetB.id)}
        onArm={() => onArmPreset?.(presetB.id)}
        onFireArmed={() => onFireArmed?.(presetB.id)}
        position="top-right"
      />
      {/* Spark effects - outside clip-path so they're not clipped */}
      <SparkEffect active={isActiveA} color={presetA.color} buttonRef={cellRef} />
      <SparkEffect active={isActiveB} color={presetB.color} buttonRef={cellRef} />
    </div>
  );
}

export function PresetGrid({ activePresets, readyPresets, armedPresets, onTogglePreset, onArmPreset, onFireArmed }) {
  // Get presets paired by category: [A0,B0], [A1,B1], [A2,B2], [A3,B3]
  const pairedPresetsByCategory = useMemo(() => {
    const categories = ['BASS', 'ENERGY', 'TEXTURE', 'FX'];
    const result = {};

    for (const category of categories) {
      const bankA = getPresetsByCategoryAndBank(category, 'A');
      const bankB = getPresetsByCategoryAndBank(category, 'B');
      // Pair presets by index (A[0] with B[0], etc.)
      result[category] = bankA.map((presetA, i) => ({
        a: presetA,
        b: bankB[i] || null
      }));
    }

    return result;
  }, []);

  // Count active presets per category (both banks)
  const getActiveCount = (category) => {
    const pairs = pairedPresetsByCategory[category] || [];
    let count = 0;
    for (const pair of pairs) {
      if (activePresets.has(pair.a?.id)) count++;
      if (activePresets.has(pair.b?.id)) count++;
    }
    return count;
  };

  return (
    <div className="flex-1 min-h-0 grid grid-cols-4 gap-3 overflow-hidden">
      {Object.entries(pairedPresetsByCategory).map(([category, pairs]) => (
        <div
          key={category}
          className="flex flex-col min-h-0 bg-dj-surface rounded-lg border overflow-hidden transition-all duration-200"
          style={{
            boxShadow: getActiveCount(category) > 0
              ? `inset 0 1px 0 rgba(255, 255, 255, 0.02), 0 0 15px ${CATEGORY_COLORS[category]}30, inset 0 0 20px ${CATEGORY_COLORS[category]}08`
              : 'inset 0 1px 0 rgba(255, 255, 255, 0.02)',
            borderColor: getActiveCount(category) > 0
              ? CATEGORY_COLORS[category] + '50'
              : 'var(--color-border)',
          }}
        >
          {/* Category header */}
          <div
            className="preset-category-header texture-aluminum flex items-center gap-2 px-3 py-1.5 border-b border-dj-border"
            style={{
              borderLeftColor: CATEGORY_COLORS[category],
              borderLeftWidth: 4,
              boxShadow: getActiveCount(category) > 0 ? `inset 0 0 12px ${CATEGORY_COLORS[category]}15` : 'none',
            }}
          >
            <span className="font-bold text-sm font-display tracking-wider" style={{ color: CATEGORY_COLORS[category] }}>{category}</span>
            {getActiveCount(category) > 0 && (
              <span className="text-xs font-display" style={{ color: CATEGORY_COLORS[category] }}>
                {getActiveCount(category)}
              </span>
            )}
            {/* Mini VU meter */}
            <div className="flex-grow" />
            <ColumnVuMini active={getActiveCount(category) > 0} color={CATEGORY_COLORS[category]} />
          </div>

          {/* Double preset cells */}
          <div className="flex-1 min-h-0 flex flex-col gap-1.5 p-1.5 overflow-hidden">
            {pairs.map((pair, i) => (
              pair.a && pair.b ? (
                <DoublePresetButton
                  key={`${category}-${i}`}
                  presetA={pair.a}
                  presetB={pair.b}
                  activePresets={activePresets}
                  readyPresets={readyPresets}
                  armedPresets={armedPresets}
                  onTogglePreset={onTogglePreset}
                  onArmPreset={onArmPreset}
                  onFireArmed={onFireArmed}
                />
              ) : null
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export default PresetGrid;
