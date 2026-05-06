const { useState, useEffect, useRef, useMemo, useCallback } = React;

// ============ FAKE LIVE SIGNAL HOOK ============
// Drives all VU/waveform visuals as if real audio were flowing.
function useLiveSignal({ active = false, bpm = 124 }) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let raf;
    const loop = () => { setTick(t => (t + 1) % 1000000); raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  // RMS-ish synthetic level (0..1)
  const t = tick * 0.06;
  const beat = (Math.sin(t * (bpm / 60) * Math.PI / 30) + 1) / 2;
  const noise = Math.abs(Math.sin(t * 0.31) * Math.cos(t * 0.17));
  const base = active ? 0.45 + beat * 0.45 + noise * 0.1 : 0.05 + noise * 0.05;
  return { tick, level: Math.min(1, base) };
}

// ============ CONFIDENCE BAR (flat, horizontal) ============
function ConfidenceBar({ confidence = 0, locked = false, width = 92 }) {
  const color = locked ? "var(--ok)" : confidence > 0.6 ? "var(--accent)" : confidence > 0.3 ? "var(--warn)" : "var(--danger)";
  return (
    <div style={{
      width, height: 2, borderRadius: 1,
      background: "rgba(255,255,255,0.06)",
      overflow: "hidden",
      position: "relative",
    }}>
      <div style={{
        width: `${Math.max(0, Math.min(1, confidence)) * 100}%`,
        height: "100%",
        background: color,
        boxShadow: locked ? `0 0 6px ${color}` : "none",
        transition: "width 280ms ease, background 220ms ease",
      }} />
    </div>
  );
}

// ============ CONFIDENCE RING ============
function ConfidenceRing({ confidence = 0, locked = false, size = 64, stroke = 1.5 }) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const off = circ * (1 - confidence);
  const color = locked ? "var(--ok)" : confidence > 0.6 ? "var(--accent)" : confidence > 0.3 ? "var(--warn)" : "var(--danger)";
  return (
    <svg width={size} height={size} style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
      <circle cx={size/2} cy={size/2} r={r} className="ring-track" strokeWidth={stroke} fill="none" />
      {confidence > 0 && (
        <circle cx={size/2} cy={size/2} r={r}
          className="ring-fill" stroke={color} strokeWidth={stroke}
          strokeDasharray={circ} strokeDashoffset={off}
          transform={`rotate(-90 ${size/2} ${size/2})`}
          fill="none"
          style={{ filter: locked ? `drop-shadow(0 0 4px ${color})` : "none" }} />
      )}
    </svg>
  );
}

// ============ LIVE 3-BAND WAVEFORM ============
function Waveform3Band({ width = 220, height = 44, bars = 26, active = true, opacity = 1 }) {
  const { tick, level } = useLiveSignal({ active });
  const data = useMemo(() => {
    const arr = [];
    for (let i = 0; i < bars; i++) {
      const phase = (tick * 0.13 - i) * 0.4;
      const lo = (Math.sin(phase) + 1) / 2 * 0.9;
      const mi = (Math.sin(phase * 1.7 + 1.2) + 1) / 2 * 0.7;
      const hi = (Math.sin(phase * 2.4 + 2.6) + 1) / 2 * 0.6;
      const k = active ? level : 0.1;
      arr.push({ lo: lo*k, mi: mi*k, hi: hi*k });
    }
    return arr;
  }, [tick, active, bars, level]);
  const bw = (width - bars + 1) / bars;
  return (
    <div style={{ width, height, display: "flex", alignItems: "flex-end", gap: 1, opacity }}>
      {data.map((b, i) => {
        const total = (b.lo + b.mi + b.hi) || 0.001;
        const h = Math.max(1, total * height);
        return (
          <div key={i} style={{ width: bw, height, display: "flex", flexDirection: "column-reverse" }}>
            <div className="wave-bar" style={{ height: (b.lo/total)*h, color: "#1F62FF" }} />
            <div className="wave-bar" style={{ height: (b.mi/total)*h, color: "#FFA600" }} />
            <div className="wave-bar" style={{ height: (b.hi/total)*h, color: "#50B4FF" }} />
          </div>
        );
      })}
    </div>
  );
}

// ============ ANALOG VU GAUGE (curved needle) ============
function AnalogVU({ active, width = 180, height = 64, label = "VU", levelOverride = null, dim = false }) {
  const { tick, level: liveLevel } = useLiveSignal({ active });
  const level = levelOverride != null ? levelOverride : liveLevel;
  // Map level [0..1] to angle [-55deg .. +55deg]
  const targetDeg = -55 + level * 110;
  const inertiaRef = useRef(targetDeg);
  inertiaRef.current = inertiaRef.current + (targetDeg - inertiaRef.current) * 0.18;
  const deg = inertiaRef.current;

  const cx = width / 2;
  const cy = height + 6;          // pivot just below visible area
  const r  = height - 4;
  const arcR = r - 2;

  // Arc path (from -55 to 55 degrees from vertical-up)
  const toXY = (a) => {
    const rad = (a - 90) * Math.PI / 180;
    return [cx + arcR * Math.cos(rad), cy + arcR * Math.sin(rad)];
  };
  const [ax, ay] = toXY(-55);
  const [bx, by] = toXY(55);
  const [redx, redy] = toXY(28);
  const [redx2, redy2] = toXY(55);

  // Tick marks
  const ticks = [];
  for (let i = -55; i <= 55; i += 11) {
    const isMajor = (i + 55) % 22 === 0;
    const inner = arcR - (isMajor ? 8 : 4);
    const outer = arcR;
    const rad = (i - 90) * Math.PI / 180;
    ticks.push({
      x1: cx + inner * Math.cos(rad), y1: cy + inner * Math.sin(rad),
      x2: cx + outer * Math.cos(rad), y2: cy + outer * Math.sin(rad),
      hot: i > 28,
      major: isMajor,
    });
  }

  const needleRad = (deg - 90) * Math.PI / 180;
  const nx = cx + (arcR - 4) * Math.cos(needleRad);
  const ny = cy + (arcR - 4) * Math.sin(needleRad);

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}
         style={{ display: "block", overflow: "visible", opacity: dim ? 0.35 : 1, transition: "opacity 200ms ease" }}>
      {/* arc track */}
      <path d={`M ${ax} ${ay} A ${arcR} ${arcR} 0 0 1 ${bx} ${by}`}
        stroke="rgba(255,255,255,0.10)" strokeWidth="1" fill="none" />
      {/* hot zone */}
      <path d={`M ${redx} ${redy} A ${arcR} ${arcR} 0 0 1 ${redx2} ${redy2}`}
        stroke="var(--danger)" strokeWidth="1.5" fill="none" opacity="0.85" />
      {/* ticks */}
      {ticks.map((t, i) => (
        <line key={i} x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2}
          stroke={t.hot ? "var(--danger)" : "rgba(255,255,255,0.45)"}
          strokeWidth={t.major ? 1.1 : 0.7}
          opacity={t.major ? 0.9 : 0.55} />
      ))}
      {/* needle */}
      <line x1={cx} y1={cy} x2={nx} y2={ny}
        stroke={active ? (level > 0.85 ? "var(--danger)" : "var(--accent)") : "var(--text-2)"}
        strokeWidth="1.6" strokeLinecap="round"
        style={{ filter: active ? "drop-shadow(0 0 4px currentColor)" : "none" }} />
      {/* pivot */}
      <circle cx={cx} cy={cy} r="3" fill="var(--text)" />
      <circle cx={cx} cy={cy} r="1.2" fill="var(--bg)" />
      {/* label */}
      <text x={cx} y={height - 2} textAnchor="middle"
        fontFamily="JetBrains Mono, monospace" fontSize="7" letterSpacing="0.22em"
        fill="var(--muted)">{label}</text>
    </svg>
  );
}

// ============ REACTIVE WORDMARK ============
// BEATWEAVER as a living signal-driven element. Each letter pulses with the live
// signal, shimmer animates left→right, and a thin meter underline ties it visually
// to the INPUT/OUTPUT gauges next to it.
function Wordmark({ active, accent = "#7DD3FC" }) {
  const { tick, level } = useLiveSignal({ active });
  const text = "BEATWEAVER";
  // breathing alpha when idle
  const breathe = 0.55 + 0.18 * (Math.sin(tick * 0.10) + 1) / 2;
  const idleGlow = 0.18 + 0.12 * (Math.sin(tick * 0.10) + 1) / 2;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, paddingRight: 2 }}>
      <div style={{ display: "flex", gap: 0, alignItems: "baseline" }}>
        {text.split("").map((ch, i) => {
          // travelling shimmer head moves across the letters
          const phase = (tick * 0.06) % (text.length + 4);
          const dist  = Math.abs(i - phase);
          const wrapDist = Math.min(dist, text.length + 4 - dist);
          const shimmer = Math.max(0, 1 - wrapDist / 1.6);     // 0..1 spike near head
          // per-letter amplitude reacts to live level too
          const amp = active ? (0.4 + 0.6 * level) : breathe;
          const lift = active ? -shimmer * 1.6 : 0;
          const intensity = active ? shimmer : 0;
          return (
            <span key={i} className="mono" style={{
              fontSize: 17, fontWeight: 700, letterSpacing: "0.16em",
              display: "inline-block",
              transform: `translateY(${lift}px)`,
              transition: "transform 60ms linear",
              color: active
                ? `color-mix(in oklab, ${accent} ${30 + intensity * 60}%, var(--text))`
                : "var(--text)",
              textShadow: active
                ? `0 0 ${6 + intensity * 14}px color-mix(in oklab, ${accent} ${40 + intensity * 50}%, transparent)`
                : `0 0 8px color-mix(in oklab, ${accent} ${idleGlow * 100}%, transparent)`,
              opacity: active ? (0.78 + 0.22 * amp) : 0.96,
            }}>{ch}</span>
          );
        })}
      </div>
      {/* signal-meter underline — fills with live level */}
      <div style={{
        position: "relative",
        height: 3, width: "100%",
        background: "color-mix(in oklab, var(--text) 6%, transparent)",
        borderRadius: 2, overflow: "hidden",
      }}>
        <div style={{
          position: "absolute", left: 0, top: 0, bottom: 0,
          width: `${active ? Math.max(8, level * 100) : 14}%`,
          background: active
            ? `linear-gradient(90deg, transparent, ${accent})`
            : `linear-gradient(90deg, transparent, color-mix(in oklab, ${accent} 35%, transparent))`,
          boxShadow: active ? `0 0 8px ${accent}` : "none",
          transition: "width 80ms linear",
        }} />
        {/* travelling head dot */}
        {active && (
          <div style={{
            position: "absolute", top: "50%",
            left: `${((tick * 0.6) % 100)}%`,
            width: 4, height: 4, borderRadius: "50%",
            background: accent, transform: "translate(-50%, -50%)",
            boxShadow: `0 0 6px ${accent}`,
          }} />
        )}
      </div>
    </div>
  );
}

// ============ ANALOG SLIDER (mini fader) ============
// Compact horizontal fader for the BEATWEAVER chassis. Brushed-metal cap on a
// thin slot with engraved tick marks. Drag the cap or click anywhere on the slot.
function AnalogSlider({ value, onChange, label = "GAIN", accent = "var(--accent)", width = 130, bipolar = false }) {
  const ref = useRef(null);
  const draggingRef = useRef(false);

  const setFromEvent = (e) => {
    const el = ref.current; if (!el) return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX ?? (e.touches && e.touches[0]?.clientX) ?? r.left) - r.left;
    const t = Math.max(0, Math.min(1, x / r.width));
    if (bipolar) {
      const v = (t - 0.5) * 2; // -1..1
      // detent: snap to 0 within ±0.06
      onChange(Math.abs(v) < 0.06 ? 0 : v);
    } else {
      onChange(t);
    }
  };
  useEffect(() => {
    const move = (e) => { if (draggingRef.current) setFromEvent(e); };
    const up   = () => { draggingRef.current = false; };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
    return () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
  }, []);

  // for bipolar (pan): visualize from center
  const trackPct = bipolar ? 50 + value * 50 : value * 100;          // 0..100 for cap position
  const fillStart = bipolar ? Math.min(50, trackPct) : 0;
  const fillEnd   = bipolar ? Math.max(50, trackPct) : trackPct;
  const pct = Math.round(trackPct);
  const displayVal = bipolar
    ? (Math.abs(value) < 0.02 ? "C" : (value > 0 ? `R${Math.round(value * 100)}` : `L${Math.round(-value * 100)}`))
    : Math.round(value * 100);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, width: "100%" }}>
      <span className="mono" style={{
        fontSize: 8.5, letterSpacing: "0.16em", color: "var(--muted)",
        width: 32, textAlign: "right", flexShrink: 0,
      }}>{label}</span>
      <div ref={ref}
        onMouseDown={(e) => { draggingRef.current = true; setFromEvent(e); }}
        style={{
          position: "relative", height: 18, width, cursor: "pointer",
          flexShrink: 0,
        }}>
        {/* engraved slot */}
        <div style={{
          position: "absolute", left: 0, right: 0, top: "50%",
          transform: "translateY(-50%)",
          height: 4, borderRadius: 2,
          background: "linear-gradient(180deg, #0a0c12, #1a1d28)",
          boxShadow: "inset 0 1px 2px rgba(0,0,0,0.8), 0 1px 0 rgba(255,255,255,0.04)",
        }} />
        {/* fill */}
        <div style={{
          position: "absolute", left: `${fillStart}%`, top: "50%",
          transform: "translateY(-50%)",
          width: `${fillEnd - fillStart}%`, height: 4, borderRadius: 2,
          background: bipolar
            ? `linear-gradient(90deg, ${accent}, ${accent})`
            : `linear-gradient(90deg, color-mix(in oklab, ${accent} 30%, transparent), ${accent})`,
          boxShadow: `0 0 8px color-mix(in oklab, ${accent} 60%, transparent)`,
          pointerEvents: "none",
        }} />
        {/* tick marks */}
        {[0, 0.25, 0.5, 0.75, 1].map((t, i) => (
          <div key={i} style={{
            position: "absolute", left: `${t * 100}%`, top: 0, bottom: 0,
            width: 1, transform: "translateX(-0.5px)",
            background: "color-mix(in oklab, var(--text) 14%, transparent)",
            opacity: i === 2 ? 0.6 : 0.3,
            pointerEvents: "none",
          }} />
        ))}
        {/* brushed-metal cap */}
        <div style={{
          position: "absolute", left: `${pct}%`, top: "50%",
          transform: "translate(-50%, -50%)",
          width: 14, height: 18, borderRadius: 3,
          background: "linear-gradient(180deg, #E8EBF2 0%, #B8BFCC 30%, #6E7585 70%, #2A2D38 100%)",
          boxShadow: "0 2px 4px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.7), inset 0 -2px 3px rgba(0,0,0,0.5)",
          pointerEvents: "none",
        }}>
          {/* center grip line */}
          <div style={{
            position: "absolute", left: 0, right: 0, top: "50%",
            height: 1, transform: "translateY(-0.5px)",
            background: "rgba(0,0,0,0.5)",
            boxShadow: "0 1px 0 rgba(255,255,255,0.2)",
          }} />
        </div>
      </div>
      <span className="mono" style={{
        fontSize: 8.5, letterSpacing: "0.04em", color: "var(--text-2)",
        width: 26, textAlign: "right", flexShrink: 0,
      }}>{displayVal}</span>
    </div>
  );
}

// ============ ANNOUNCER MOUTH (lip-sync) ============
function AnnouncerMouth({ speaking, size = 22 }) {
  const { tick } = useLiveSignal({ active: speaking });
  // Drive a "phoneme" amplitude with two interfering sines for organic motion
  const a = (Math.sin(tick * 0.45) + 1) / 2;
  const b = (Math.sin(tick * 0.81 + 1.2) + 1) / 2;
  const open = speaking ? 0.25 + (a * 0.55 + b * 0.35) * 0.75 : 0.08;
  const wide = speaking ? 0.6 + b * 0.4 : 0.7;

  const w = size, h = size;
  const cx = w / 2, cy = h / 2;
  // Lip ellipse params
  const rx = (w * 0.32) * wide;
  const ry = (h * 0.32) * Math.max(0.05, open);

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: "block" }}>
      {/* face circle */}
      <circle cx={cx} cy={cy} r={w * 0.46}
        fill="none" stroke="currentColor" strokeWidth="1.2" opacity="0.55" />
      {/* upper lip */}
      <path d={`M ${cx - rx} ${cy} Q ${cx} ${cy - ry} ${cx + rx} ${cy}`}
        fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      {/* lower lip */}
      <path d={`M ${cx - rx} ${cy} Q ${cx} ${cy + ry} ${cx + rx} ${cy}`}
        fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      {/* tongue / inner shadow */}
      {open > 0.35 && (
        <ellipse cx={cx} cy={cy + ry * 0.25} rx={rx * 0.65} ry={ry * 0.55}
          fill="currentColor" opacity="0.32" />
      )}
    </svg>
  );
}

// ============ MASTER VU STRIP (horizontal LED) ============
function MasterVU({ active }) {
  const SEGS = 64;
  const { level } = useLiveSignal({ active });
  const lit = Math.round(level * SEGS);
  return (
    <div style={{ display: "flex", gap: 1, height: 4, width: "100%" }}>
      {Array.from({ length: SEGS }, (_, i) => {
        const p = i / SEGS;
        const color = p < 0.55 ? "#00C853" : p < 0.78 ? "#FFB300" : p < 0.9 ? "#FF6D00" : "#FF1744";
        const on = i < lit;
        return (
          <div key={i} style={{
            flex: 1,
            background: on ? color : "rgba(38,42,54,0.4)",
            boxShadow: on ? `0 0 4px ${color}66` : "none",
            borderRadius: 0.5,
            transition: "background 60ms linear",
          }} />
        );
      })}
    </div>
  );
}

// ============ COLUMN MINI VU (4 bars) ============
function ColumnVU({ active, color }) {
  const { tick } = useLiveSignal({ active });
  if (!active) return <div style={{ width: 18, height: 12 }} />;
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height: 12 }}>
      {[0,1,2,3].map(i => {
        const h = active ? 30 + ((Math.sin((tick * 0.18) + i * 1.3) + 1) / 2) * 70 : 20;
        return <div key={i} style={{ width: 2, height: `${h}%`, background: color, opacity: 0.85, borderRadius: 0.5 }} />;
      })}
    </div>
  );
}

// ============ BEAT INDICATOR ============
function BeatPulse({ active, bpm }) {
  const [pulse, setPulse] = useState(0);
  useEffect(() => {
    if (!active) return;
    const ms = (60 / bpm) * 1000;
    const id = setInterval(() => setPulse(p => p + 1), ms);
    return () => clearInterval(id);
  }, [active, bpm]);
  return (
    <div style={{ position: "relative", width: 14, height: 14 }}>
      <div style={{
        position: "absolute", inset: 2, borderRadius: "50%",
        background: active ? "var(--accent)" : "var(--hair-strong)",
        boxShadow: active ? "0 0 8px var(--accent-line)" : "none",
        transition: "all 200ms",
      }} />
      {active && (
        <div key={pulse} className="beat-ring" style={{
          position: "absolute", inset: 0, borderRadius: "50%",
          border: "1px solid var(--accent)",
        }} />
      )}
    </div>
  );
}

// ============ ANALOG-FEEL TOGGLE ============
function Switch({ on, onChange, label }) {
  return (
    <div onClick={() => onChange(!on)} style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
      <div className={`toggle ${on ? "on" : ""}`} />
      <div style={{ display: "flex", flexDirection: "column" }}>
        <span className="mono" style={{ fontSize: 9, letterSpacing: "0.14em", color: on ? "var(--text)" : "var(--text-2)" }}>{label}</span>
      </div>
    </div>
  );
}

// ============ TRANSPORT: BPM + KEY ============
function BpmDisplay({ bpm, locked, confidence, onAdjust, onUnlock }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <button
        onClick={() => onAdjust(-0.1)}
        disabled={locked}
        className="mono"
        style={{
          width: 26, height: 26, borderRadius: 6,
          background: "transparent", color: locked ? "var(--muted)" : "var(--text)",
          border: "1px solid var(--hair-strong)",
          fontSize: 14, fontWeight: 600,
        }}
      >−</button>

      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5, minWidth: 96 }}>
        <span className="mono" style={{ fontSize: 30, fontWeight: 600, color: locked ? "var(--accent)" : "var(--text)", lineHeight: 1, letterSpacing: "-0.03em" }}>
          {bpm.toFixed(1)}
        </span>
        <ConfidenceBar confidence={confidence} locked={locked} width={92} />
        <span className="mono" style={{ fontSize: 8.5, letterSpacing: "0.22em", color: locked ? "var(--accent)" : "var(--muted)" }}>
          {locked ? "BPM · LOCKED" : "BPM"}
        </span>
      </div>

      <button
        onClick={() => onAdjust(0.1)}
        disabled={locked}
        className="mono"
        style={{
          width: 26, height: 26, borderRadius: 6,
          background: "transparent", color: locked ? "var(--muted)" : "var(--text)",
          border: "1px solid var(--hair-strong)",
          fontSize: 14, fontWeight: 600,
        }}
      >+</button>

      {locked && (
        <button onClick={onUnlock} className="mono pill"
          style={{ background: "transparent", color: "var(--accent)", border: "1px solid var(--accent-line)" }}>
          UNLOCK
        </button>
      )}
    </div>
  );
}

function KeyDisplay({ keyName, locked, confidence, onChange, onUnlock }) {
  const color = KEY_COLORS[keyName] || "#fff";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5, minWidth: 80 }}>
        <span className="mono" style={{ fontSize: 30, fontWeight: 600, color, lineHeight: 1, letterSpacing: "-0.02em", textShadow: locked ? `0 0 12px ${color}66` : "none" }}>
          {keyName}
        </span>
        <ConfidenceBar confidence={confidence} locked={locked} width={80} />
        <span className="mono" style={{ fontSize: 8.5, letterSpacing: "0.22em", color: locked ? "var(--accent)" : "var(--muted)" }}>
          {locked ? "KEY · LOCKED" : "KEY"}
        </span>
      </div>
      {!locked ? (
        <select value={keyName} onChange={e => onChange(e.target.value)} className="mono"
          style={{
            background: "var(--surface)", color: "var(--text)",
            border: "1px solid var(--hair-strong)",
            padding: "4px 6px", borderRadius: 6, fontSize: 12, outline: "none",
          }}>
          {KEYS.map(k => <option key={k} value={k}>{k}</option>)}
        </select>
      ) : (
        <button onClick={onUnlock} className="mono pill"
          style={{ background: "transparent", color: "var(--accent)", border: "1px solid var(--accent-line)" }}>
          UNLOCK
        </button>
      )}
    </div>
  );
}

// ============ LISTEN BUTTON ============
function ListenButton({ analyzing, locked, onClick }) {
  const label = analyzing ? (locked ? "LOCKED" : "LISTENING") : "LISTEN";
  const tone =
    !analyzing ? { c: "var(--text-2)", b: "var(--hair-strong)", bg: "transparent" } :
    locked     ? { c: "var(--accent)", b: "var(--accent-line)", bg: "var(--accent-soft)" } :
                 { c: "var(--warn)",   b: "color-mix(in oklab, var(--warn) 50%, transparent)", bg: "color-mix(in oklab, var(--warn) 12%, transparent)" };
  return (
    <button onClick={onClick} className="mono"
      style={{
        padding: "8px 14px", borderRadius: 8,
        fontSize: 11, letterSpacing: "0.18em", fontWeight: 600,
        color: tone.c, background: tone.bg, border: `1px solid ${tone.b}`,
        display: "flex", alignItems: "center", gap: 8,
      }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: tone.c, boxShadow: analyzing ? `0 0 6px ${tone.c}` : "none" }} className={analyzing ? "shimmer" : ""} />
      {label}
    </button>
  );
}

// ============ DIAGONAL HALF-CELL ============
function PresetHalf({ preset, isActive, isReady, isHot, position, onFire, onArm, color }) {
  const wrapRef = useRef(null);
  const wasActive = useRef(isActive);
  const [wobble, setWobble] = useState(false);
  const [sparks, setSparks] = useState([]);

  useEffect(() => {
    if (isActive && !wasActive.current) {
      setWobble(true);
      const id = setTimeout(() => setWobble(false), 600);
      // sparks
      const newSparks = Array.from({ length: 8 }, (_, i) => ({
        key: Date.now() + i,
        dx: (Math.random() - 0.5) * 60,
        dy: (Math.random() - 0.5) * 60 - 10,
        color,
      }));
      setSparks(newSparks);
      setTimeout(() => setSparks([]), 600);
      return () => clearTimeout(id);
    }
    wasActive.current = isActive;
  }, [isActive, color]);

  const isA = position === "a";
  const Glyph = (window.GLYPHS && window.GLYPHS[preset.id]) || null;

  const bg = isActive
    ? color
    : isReady
      ? "color-mix(in oklab, " + color + " 14%, var(--surface))"
      : isHot
        ? "var(--surface-2)"
        : "var(--surface)";

  return (
    <div className="cell-half" data-pos={position} data-armed={isReady && !isActive ? "true" : "false"} ref={wrapRef}
      style={{
        backgroundColor: bg,
        boxShadow: isActive
          ? "inset 0 0 24px rgba(0,0,0,0.35), inset 0 0 0 1px rgba(255,255,255,0.06)"
          : (isReady
              ? `inset 0 0 0 2px ${color}, inset 0 0 28px color-mix(in oklab, ${color} 18%, transparent)`
              : "none"),
        ["--ready"]: isReady ? color : "transparent",
      }}
      onClick={(e) => { e.stopPropagation(); onFire(); }}
      onContextMenu={(e) => { e.preventDefault(); onArm(); }}
    >
      {/* monochrome silhouette glyph (always visible centerpiece) */}
      {Glyph && (
        <div className={
          "glyph-wrap " +
          (isActive ? "glyph-active" : isReady ? "glyph-ready" : isHot ? "glyph-hot" : "glyph-idle")
        }>
          <div className="glyph-anim" style={{ width: "100%", height: "100%" }}>
            <Glyph />
          </div>
        </div>
      )}

      {/* corner label */}
      <div style={{
        padding: isA ? "12px 14px 0 14px" : "0 14px 12px 14px",
        position: "relative", zIndex: 4,
      }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: isA ? "flex-start" : "flex-end", gap: 5 }}>
          <div className={"mono"} style={{
            fontSize: 9.5, letterSpacing: "0.22em",
            color: isActive ? "rgba(0,0,0,0.55)" : "var(--muted)",
            fontWeight: 600,
          }}>
            {preset.bank}
          </div>
          <div style={{
            fontSize: 17, fontWeight: 600,
            color: isActive ? "#08080A" : isReady ? "var(--text)" : "var(--text)",
            letterSpacing: "-0.015em",
            textAlign: isA ? "left" : "right",
            lineHeight: 1.0,
          }}>
            <span className={wobble ? "wobble" : ""}>{preset.name}</span>
          </div>
        </div>
      </div>

      {/* active LED */}
      {isActive && (
        <div className="led-breath" style={{
          position: "absolute",
          ...(isA ? { top: 14, right: 22 } : { bottom: 14, left: 22 }),
          width: 16, height: 2.5, borderRadius: 999,
          background: "rgba(0,0,0,0.7)", color: "rgba(0,0,0,0.4)",
        }} />
      )}

      {/* armed: round FIRE button positioned in the safe zone of each triangle */}
      {isReady && !isActive && (
        <div style={{
          position: "absolute",
          ...(isA
            ? { left: "22%", top: "48%", transform: "translate(-50%, -50%)" }
            : { left: "78%", top: "52%", transform: "translate(-50%, -50%)" }),
          zIndex: 6, pointerEvents: "none",
        }}>
          <div className="fire-halo" style={{ background: `radial-gradient(circle, ${color}66 0%, transparent 70%)` }} />
          <div className="fire-btn mono" style={{
            background: `radial-gradient(circle at 35% 30%, color-mix(in oklab, ${color} 78%, white) 0%, ${color} 55%, color-mix(in oklab, ${color} 60%, black) 100%)`,
            border: `2px solid ${color}`,
            color: "#0A0A0C",
            boxShadow: `inset 0 1px 0 rgba(255,255,255,0.4), inset 0 -3px 6px rgba(0,0,0,0.35), 0 0 22px ${color}, 0 0 44px color-mix(in oklab, ${color} 45%, transparent)`,
          }}>
            FIRE!
          </div>
        </div>
      )}

      {/* ready dot */}
      {isReady && !isActive && (
        <div className="led-breath" style={{
          position: "absolute",
          ...(isA ? { top: 13, left: 12 } : { bottom: 13, right: 12 }),
          width: 5, height: 5, borderRadius: "50%",
          background: color, color,
        }} />
      )}

      {/* sparks */}
      {sparks.map(s => (
        <span key={s.key} className="spark" style={{
          left: "50%", top: "50%",
          background: s.color,
          ["--dx"]: `${s.dx}px`,
          ["--dy"]: `${s.dy}px`,
          boxShadow: `0 0 6px ${s.color}`,
        }} />
      ))}
    </div>
  );
}

// ============ DOUBLE PRESET CELL ============
function DoubleCell({ pair, color, active, ready, hot, onFire, onArm }) {
  return (
    <div className="cell-wrap" style={{ height: "100%" }}>
      <PresetHalf
        preset={pair.A} position="a" color={color}
        isActive={active.has(pair.A.id)}
        isReady={ready.has(pair.A.id)}
        isHot={hot}
        onFire={() => onFire(pair.A.id)}
        onArm={() => onArm(pair.A.id)}
      />
      <PresetHalf
        preset={pair.B} position="b" color={color}
        isActive={active.has(pair.B.id)}
        isReady={ready.has(pair.B.id)}
        isHot={hot}
        onFire={() => onFire(pair.B.id)}
        onArm={() => onArm(pair.B.id)}
      />
      <div className="diag-line" />
    </div>
  );
}

// ============ COLUMN ============
function Column({ category, pairs, active, ready, onFire, onArm }) {
  const meta = CATEGORY_META[category];
  const activeCount = pairs.reduce((acc, p) => acc + (active.has(p.A.id) ? 1 : 0) + (active.has(p.B.id) ? 1 : 0), 0);
  const isHot = activeCount > 0;
  return (
    <div style={{
      display: "flex", flexDirection: "column", minHeight: 0, height: "100%",
      background: "var(--bg-2)",
      border: "1px solid " + (isHot ? "color-mix(in oklab, " + meta.color + " 35%, var(--hair))" : "var(--hair)"),
      borderRadius: 12,
      boxShadow: isHot ? `0 0 0 1px color-mix(in oklab, ${meta.color} 20%, transparent), 0 0 28px color-mix(in oklab, ${meta.color} 10%, transparent)` : "none",
      transition: "all 200ms ease",
      overflow: "hidden",
    }}>
      {/* Category header */}
      <div style={{
        display: "flex", alignItems: "center", gap: 10,
        padding: "10px 14px",
        borderBottom: "1px solid var(--hair)",
        background: "linear-gradient(180deg, #11141B 0%, #0C0F15 100%)",
        position: "relative",
      }}>
        <div style={{ width: 3, height: 14, borderRadius: 2, background: meta.color }} />
        <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
          <span className="mono" style={{ fontSize: 11, letterSpacing: "0.22em", fontWeight: 600, color: meta.color }}>{meta.label}</span>
          <span style={{ fontSize: 9.5, color: "var(--muted)", letterSpacing: "0.04em" }}>{meta.sub}</span>
        </div>
        <div style={{ flex: 1 }} />
        {activeCount > 0 && (
          <span className="mono" style={{ fontSize: 10, color: meta.color, letterSpacing: "0.1em" }}>
            {activeCount} ON
          </span>
        )}
        <ColumnVU active={isHot} color={meta.color} />
      </div>

      {/* Cells */}
      <div style={{ flex: 1, minHeight: 0, padding: 8, display: "flex", flexDirection: "column", gap: 6 }}>
        {pairs.map((pair, i) => (
          <div key={i} style={{ flex: 1, minHeight: 0 }}>
            <DoubleCell pair={pair} color={meta.color} active={active} ready={ready} hot={isHot} onFire={onFire} onArm={onArm} />
          </div>
        ))}
      </div>
    </div>
  );
}

// ============ HISTORY STRIP ============
function HistoryStrip({ history }) {
  const max = 80;
  const slots = useMemo(() => {
    const padded = Array.from({ length: max - history.length }, () => null).concat(history);
    return padded.slice(-max);
  }, [history]);
  return (
    <div style={{ display: "flex", gap: 0, height: 6, width: "100%", borderRadius: 3, overflow: "hidden", background: "var(--bg-2)", border: "1px solid var(--hair)" }}>
      {slots.map((s, i) => (
        <div key={i} className="history-block" style={{
          flex: 1,
          background: s ? (s.colors.length > 1 ? `linear-gradient(to right, ${s.colors.join(", ")})` : s.colors[0]) : "transparent",
          opacity: s ? 0.35 + (i / max) * 0.65 : 0,
        }} />
      ))}
    </div>
  );
}

// ============ ANNOUNCEMENT TOAST ============
function Announcement({ text, speaking = true }) {
  if (!text) return null;
  return (
    <div className="appear-up panel-flat" style={{
      padding: "5px 12px 5px 8px",
      border: "1px solid var(--accent-line)",
      background: "color-mix(in oklab, var(--accent) 10%, var(--surface))",
      color: "var(--accent)",
      fontSize: 11, letterSpacing: "0.12em",
      textTransform: "uppercase", fontWeight: 600,
      whiteSpace: "nowrap",
      boxShadow: "0 0 18px color-mix(in oklab, var(--accent) 14%, transparent)",
      display: "flex", alignItems: "center", gap: 8,
    }}>
      <AnnouncerMouth speaking={speaking} size={20} />
      <span className="mono">{text}</span>
    </div>
  );
}

Object.assign(window, {
  useLiveSignal,
  ConfidenceRing, ConfidenceBar, Waveform3Band, MasterVU, ColumnVU, BeatPulse,
  Switch, BpmDisplay, KeyDisplay, ListenButton, AnalogVU, AnalogSlider, AnnouncerMouth, Wordmark,
  PresetHalf, DoubleCell, Column, HistoryStrip, Announcement,
});
