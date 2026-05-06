const { useState, useEffect, useRef, useMemo, useCallback } = React;

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "accentHue": 240,
  "density": "comfortable",
  "themeMode": "ink",
  "armOnRightClick": true,
  "routingMode": "add"
}/*EDITMODE-END*/;

function BeatweaverApp() {
  const [tweaks, setTweak] = useTweaks(TWEAK_DEFAULTS);

  // Apply accent hue live
  useEffect(() => {
    const h = tweaks.accentHue;
    document.documentElement.style.setProperty("--accent", `oklch(0.74 0.16 ${h})`);
    document.documentElement.style.setProperty("--accent-soft", `oklch(0.74 0.16 ${h} / 0.18)`);
    document.documentElement.style.setProperty("--accent-line", `oklch(0.74 0.16 ${h} / 0.45)`);
  }, [tweaks.accentHue]);

  useEffect(() => {
    const root = document.documentElement.style;
    const set = (k, v) => root.setProperty(k, v);
    if (tweaks.themeMode === "void") {
      // Pure black, brutalist
      set("--bg", "#000000"); set("--bg-2", "#040406"); set("--surface", "#08090C"); set("--surface-2", "#101218");
      set("--hair", "#1A1C24"); set("--hair-strong", "#2A2D38");
      set("--text", "#F2F4FA"); set("--text-2", "#8A91A2"); set("--muted", "#444A58");
    } else if (tweaks.themeMode === "bone") {
      // Light, paper-like
      set("--bg", "#EFEAE0"); set("--bg-2", "#E5DFD2"); set("--surface", "#F5F1E8"); set("--surface-2", "#DCD4C2");
      set("--hair", "#C9C0AC"); set("--hair-strong", "#A89E88");
      set("--text", "#181715"); set("--text-2", "#5C564B"); set("--muted", "#8C8473");
    } else if (tweaks.themeMode === "neon") {
      // Saturated synthwave
      set("--bg", "#0E0420"); set("--bg-2", "#16082E"); set("--surface", "#1F0E3D"); set("--surface-2", "#2C1556");
      set("--hair", "#3B1F6E"); set("--hair-strong", "#5A3296");
      set("--text", "#F8E8FF"); set("--text-2", "#C5A0E8"); set("--muted", "#7A5BAE");
    } else {
      // ink (default) — deep blue-black
      set("--bg", "#06070A"); set("--bg-2", "#0A0B10"); set("--surface", "#0E1015"); set("--surface-2", "#14161D");
      set("--hair", "#1B1E27"); set("--hair-strong", "#262A36");
      set("--text", "#E6E8EE"); set("--text-2", "#9097A6"); set("--muted", "#535A6B");
    }
  }, [tweaks.themeMode]);

  // ============ STATE ============
  const [analyzing, setAnalyzing] = useState(true);
  const [bpm, setBpm] = useState(124.0);
  const [bpmConfidence, setBpmConfidence] = useState(0.92);
  const [bpmLocked, setBpmLocked] = useState(true);
  const [keyName, setKeyName] = useState("A");
  const [keyConfidence, setKeyConfidence] = useState(0.78);
  const [keyLocked, setKeyLocked] = useState(true);
  const [bpmEnabled, setBpmEnabled] = useState(true);
  const [keyEnabled, setKeyEnabled] = useState(true);
  const [ttsEnabled, setTtsEnabled] = useState(true);

  // Mixer state
  const [inputVol, setInputVol]   = useState(0.78);
  const [outputVol, setOutputVol] = useState(0.82);
  const [annPan, setAnnPan]       = useState(-0.15);
  const [fxPan, setFxPan]         = useState(0.0);

  const [active, setActive] = useState(() => new Set(["bass_acid", "t_dream"]));
  const [ready, setReady] = useState(() => new Set(["e_drop"]));

  const [announcement, setAnnouncement] = useState("Acid wobble");
  const annTimer = useRef(null);

  // Group presets by column, then by row
  const columnPairs = useMemo(() => {
    const cols = { 0: [], 1: [], 2: [], 3: [] };
    for (let c = 0; c < 4; c++) {
      for (let r = 0; r < 4; r++) {
        const A = PRESETS.find(p => p.col === c && p.row === r && p.bank === "A");
        const B = PRESETS.find(p => p.col === c && p.row === r && p.bank === "B");
        cols[c].push({ A, B });
      }
    }
    return cols;
  }, []);

  const showAnnouncement = useCallback((text) => {
    setAnnouncement(text);
    if (annTimer.current) clearTimeout(annTimer.current);
    annTimer.current = setTimeout(() => setAnnouncement(null), 2200);
  }, []);

  const firePreset = useCallback((id) => {
    const preset = PRESETS.find(p => p.id === id);
    if (!preset) return;
    setActive(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
        if (ttsEnabled) showAnnouncement(preset.fire || preset.ann);
      }
      return next;
    });
    setReady(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, [ttsEnabled, showAnnouncement]);

  const armPreset = useCallback((id) => {
    if (!tweaks.armOnRightClick) return;
    const preset = PRESETS.find(p => p.id === id);
    setReady(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
        if (ttsEnabled && preset) showAnnouncement(preset.cue);
      }
      return next;
    });
  }, [tweaks.armOnRightClick, ttsEnabled, showAnnouncement]);

  const stopAll = useCallback(() => {
    setActive(new Set());
    setReady(new Set());
    showAnnouncement("All stopped");
  }, [showAnnouncement]);

  const fireAllReady = useCallback(() => {
    setReady(prev => {
      if (prev.size === 0) return prev;
      const ids = [...prev];
      ids.forEach(id => firePreset(id));
      return new Set();
    });
  }, [firePreset]);

  const toggleListen = useCallback(() => {
    setAnalyzing(a => {
      if (a) {
        setBpmLocked(false); setKeyLocked(false);
        setBpmConfidence(0); setKeyConfidence(0);
      } else {
        // Simulate detection
        setTimeout(() => setBpmConfidence(0.45), 400);
        setTimeout(() => setBpmConfidence(0.85), 1200);
        setTimeout(() => { setBpmLocked(true); setBpmConfidence(0.95); showAnnouncement("BPM locked"); }, 2000);
        setTimeout(() => setKeyConfidence(0.4), 800);
        setTimeout(() => setKeyConfidence(0.78), 1600);
        setTimeout(() => { setKeyLocked(true); showAnnouncement("Key locked"); }, 2400);
      }
      return !a;
    });
  }, [showAnnouncement]);

  const adjustBpm = useCallback((delta) => {
    setBpm(b => Math.max(30, Math.min(300, parseFloat((b + delta).toFixed(1)))));
  }, []);

  const totalActive = active.size;

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e) => {
      if (e.target.tagName === "INPUT" || e.target.tagName === "SELECT") return;
      if (e.code === "Space") { e.preventDefault(); stopAll(); return; }
      if (e.key === "f" || e.key === "F") { e.preventDefault(); fireAllReady(); return; }
      const n = parseInt(e.key, 10);
      if (n >= 1 && n <= 8) {
        const col = Math.floor((n - 1) / 2);
        const row = (n - 1) % 4;
        const pair = columnPairs[col]?.[row];
        const preset = pair?.A;
        if (preset) firePreset(preset.id);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [firePreset, stopAll, fireAllReady, columnPairs]);

  return (
    <div className="root">
      {/* ============ TOP BAR ============ */}
      <div className="panel" style={{
        display: "grid",
        gridTemplateColumns: "auto auto auto 1fr auto auto auto auto",
        alignItems: "center", gap: 16,
        padding: "12px 16px",
      }}>
        {/* Logo + dual analog gauges (INPUT → routing → OUTPUT) */}
        <div style={{
          display: "flex", alignItems: "stretch", gap: 14,
          padding: "10px 16px 8px", borderRadius: 10,
          border: "1px solid var(--hair)",
          background: "linear-gradient(180deg, color-mix(in oklab, var(--surface) 100%, transparent), color-mix(in oklab, var(--bg) 70%, var(--surface)))",
          boxShadow: (totalActive>0||analyzing)
            ? "inset 0 0 24px color-mix(in oklab, var(--accent) 10%, transparent), 0 0 18px color-mix(in oklab, var(--accent) 8%, transparent)"
            : "inset 0 1px 0 rgba(255,255,255,0.02)",
          transition: "box-shadow 280ms ease",
          position: "relative",
        }}>
          {/* ZONE 1 — wordmark + 2×2 slider grid */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8, justifyContent: "space-between" }}>
            <Wordmark active={totalActive > 0 || analyzing} accent="var(--accent)" />
            <div style={{
              display: "grid",
              gridTemplateColumns: "auto auto",
              columnGap: 14, rowGap: 3,
            }}>
              <AnalogSlider label="IN"  value={inputVol}  onChange={setInputVol}  width={88} accent="var(--accent)" />
              <AnalogSlider label="ANN" value={annPan}    onChange={setAnnPan}    width={88} accent="var(--energy)" bipolar />
              <AnalogSlider label="OUT" value={outputVol} onChange={setOutputVol} width={88} accent="var(--accent)" />
              <AnalogSlider label="FX"  value={fxPan}     onChange={setFxPan}     width={88} accent="var(--fx)"     bipolar />
            </div>
          </div>

          <div style={{ width: 1, alignSelf: "stretch", background: "var(--hair)" }} />

          {/* ZONE 2 — signal chain: INPUT → ADD/FILTER → OUTPUT */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <AnalogVU active={analyzing} width={78} height={42} label="INPUT"
              dim={tweaks.routingMode === "filter"} />
          {/* Analog routing flip-switch (ADD over FILTER) */}
          <div className="tt"
            data-tip={tweaks.routingMode === "add" ? "Mix presets ON TOP of input" : "Replace input \u2014 presets only"}
            onClick={() => setTweak("routingMode", tweaks.routingMode === "add" ? "filter" : "add")}
            style={{ cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 3, padding: "0 4px", userSelect: "none" }}
          >
            <span className="mono" style={{
              fontSize: 8.5, letterSpacing: "0.20em", fontWeight: 700,
              color: tweaks.routingMode === "add" ? "var(--accent)" : "var(--muted)",
              textShadow: tweaks.routingMode === "add" ? "0 0 8px var(--accent-line)" : "none",
              transition: "color 200ms, text-shadow 200ms",
            }}>ADD</span>
            <div className={`flip-switch ${tweaks.routingMode === "add" ? "up" : "down"}`}>
              <div className="flip-switch-body">
                <div className="flip-switch-screw" style={{ top: 3 }} />
                <div className="flip-switch-screw" style={{ bottom: 3 }} />
                <div className="flip-switch-lever" />
                <div className="flip-switch-knob" style={{
                  background: tweaks.routingMode === "add"
                    ? "radial-gradient(circle at 35% 30%, #F2F4FA 0%, #B8BFCC 50%, #6E7585 100%)"
                    : "radial-gradient(circle at 35% 30%, #B8BFCC 0%, #6E7585 50%, #2A2D38 100%)",
                  boxShadow: tweaks.routingMode === "add"
                    ? "0 0 12px var(--accent-line), inset 0 1px 0 rgba(255,255,255,0.6), inset 0 -2px 4px rgba(0,0,0,0.4)"
                    : "0 1px 3px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.25), inset 0 -2px 4px rgba(0,0,0,0.5)",
                }} />
              </div>
            </div>
            <span className="mono" style={{
              fontSize: 8.5, letterSpacing: "0.16em", fontWeight: 700,
              color: tweaks.routingMode === "filter" ? "var(--warn)" : "var(--muted)",
              textShadow: tweaks.routingMode === "filter" ? "0 0 8px color-mix(in oklab, var(--warn) 50%, transparent)" : "none",
              transition: "color 200ms, text-shadow 200ms",
            }}>FILTER</span>
          </div>
            <AnalogVU active={totalActive > 0 || (analyzing && tweaks.routingMode === "add")}
              width={78} height={42} label="OUTPUT" />
          </div>
        </div>

        {/* BPM + Key */}
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <BpmDisplay bpm={bpm} locked={bpmLocked} confidence={bpmConfidence}
            onAdjust={adjustBpm} onUnlock={() => { setBpmLocked(false); setBpmConfidence(0); }} />
          <div style={{ width: 1, height: 36, background: "var(--hair)" }} />
          <KeyDisplay keyName={keyName} locked={keyLocked} confidence={keyConfidence}
            onChange={setKeyName} onUnlock={() => { setKeyLocked(false); setKeyConfidence(0); }} />
        </div>

        {/* Listen + analysis switches */}
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <BeatPulse active={analyzing} bpm={bpm} />
          <ListenButton analyzing={analyzing} locked={bpmLocked && keyLocked} onClick={toggleListen} />
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <Switch on={bpmEnabled} onChange={setBpmEnabled} label="BPM" />
            <Switch on={keyEnabled} onChange={setKeyEnabled} label="KEY" />
          </div>
        </div>

        {/* announcement */}
        <div style={{ display: "flex", justifyContent: "flex-start", paddingLeft: 6 }}>
          {announcement && <Announcement text={announcement} speaking={ttsEnabled} />}
        </div>

        {/* MIDI status */}
        <div className="tt" data-tip="Novation Launch Control XL connected"
          style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", border: "1px solid var(--hair-strong)", borderRadius: 6 }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--ok)", boxShadow: "0 0 6px var(--ok)" }} />
          <span className="mono" style={{ fontSize: 9.5, letterSpacing: "0.16em", color: "var(--text-2)" }}>LAUNCH XL</span>
        </div>

        {/* TTS */}
        <button onClick={() => setTtsEnabled(t => !t)} className="mono"
          style={{
            padding: "6px 10px", borderRadius: 6,
            background: ttsEnabled ? "var(--accent-soft)" : "transparent",
            border: `1px solid ${ttsEnabled ? "var(--accent-line)" : "var(--hair-strong)"}`,
            color: ttsEnabled ? "var(--accent)" : "var(--text-2)",
            fontSize: 9.5, letterSpacing: "0.16em",
          }}>
          {ttsEnabled ? "TTS ON" : "TTS OFF"}
        </button>

        {/* Active count */}
        <div className="mono" style={{
          fontSize: 11, letterSpacing: "0.18em", fontWeight: 600,
          color: totalActive > 0 ? "var(--accent)" : "var(--muted)",
        }}>
          {totalActive > 0 ? `${totalActive} ACTIVE` : "READY"}
        </div>

        {/* Stop */}
        <button onClick={stopAll} disabled={totalActive === 0} className="mono"
          style={{
            padding: "8px 14px", borderRadius: 8,
            background: totalActive > 0 ? "color-mix(in oklab, var(--danger) 20%, var(--surface))" : "var(--surface)",
            border: `1px solid ${totalActive > 0 ? "color-mix(in oklab, var(--danger) 50%, transparent)" : "var(--hair-strong)"}`,
            color: totalActive > 0 ? "color-mix(in oklab, var(--danger) 80%, white)" : "var(--muted)",
            fontSize: 10.5, letterSpacing: "0.18em", fontWeight: 600,
            cursor: totalActive > 0 ? "pointer" : "not-allowed",
            boxShadow: totalActive > 0 ? "0 0 18px color-mix(in oklab, var(--danger) 18%, transparent)" : "none",
          }}>
          STOP ALL
        </button>
      </div>

      {/* ============ PRESET GRID ============ */}
      <div style={{ flex: 1, minHeight: 0, display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
        {["BASS","ENERGY","TEXTURE","FX"].map((cat, i) => (
          <Column
            key={cat}
            category={cat}
            pairs={columnPairs[i]}
            active={active}
            ready={ready}
            onFire={firePreset}
            onArm={armPreset}
          />
        ))}
      </div>

      {/* ============ FOOTER STRIP ============ */}
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <div className="panel-flat" style={{ padding: "6px 8px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span className="mono" style={{ fontSize: 8.5, color: "var(--muted)", letterSpacing: "0.18em", minWidth: 56 }}>OUTPUT</span>
            <div style={{ flex: 1 }}>
              <MasterVU active={totalActive > 0 || analyzing} />
            </div>
            <span className="mono" style={{ fontSize: 8.5, color: "var(--muted)", letterSpacing: "0.18em" }}>−1.0 dB</span>
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", padding: "0 4px" }}>
          <span className="mono" style={{ fontSize: 9, color: "var(--muted)", letterSpacing: "0.16em" }}>
            KEYS 1–8 · FIRE · &nbsp;·&nbsp; F · FIRE ARMED · &nbsp;·&nbsp; SPACE · STOP ALL · &nbsp;·&nbsp; RIGHT-CLICK · ARM
          </span>
          <span className="mono" style={{ fontSize: 9, color: "var(--muted)", letterSpacing: "0.16em" }}>
            ANALYSIS · {analyzing ? "ON" : "OFF"} &nbsp;·&nbsp; OUT · CH 4 &nbsp;·&nbsp; LATENCY · 12ms
          </span>
        </div>
      </div>

      {/* ============ TWEAKS ============ */}
      <TweaksPanel title="Tweaks">
        <TweakSection title="Look">
          <TweakSlider label="Accent hue" value={tweaks.accentHue} min={0} max={360} step={1}
            onChange={v => setTweak("accentHue", v)} />
          <TweakRadio label="Theme" value={tweaks.themeMode}
            options={[{value:"ink",label:"Ink"},{value:"void",label:"Void"},{value:"bone",label:"Bone"},{value:"neon",label:"Neon"}]}
            onChange={v => setTweak("themeMode", v)} />
        </TweakSection>
        <TweakSection title="Routing">
          <TweakRadio label="Output mode" value={tweaks.routingMode}
            options={[{value:"add",label:"Add"},{value:"filter",label:"Filter"}]}
            onChange={v => setTweak("routingMode", v)} />
        </TweakSection>
        <TweakSection title="Behavior">
          <TweakToggle label="Right-click to arm preset" value={tweaks.armOnRightClick}
            onChange={v => setTweak("armOnRightClick", v)} />
        </TweakSection>
      </TweaksPanel>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<BeatweaverApp />);
