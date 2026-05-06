# Handoff: Beatweaver — Live AI DJ Console

## Overview

Beatweaver is a hi-fi prototype for a real-time DJ/live-performance console where a producer runs an analyzed audio stream through a 4×4×2 grid of preset effect cells, with arming, firing, voice announcements, and a small mixer. The screen is **single-page, fixed-layout, fits 1440×900+**, and is divided into three regions: the **top transport bar** (wordmark + mixer + signal-chain gauges + BPM/Key + transport controls), the **preset grid** (BASS / ENERGY / TEXTURE / FX columns, each with 4 rows of 2-bank cells split diagonally), and a **footer master VU + shortcut hint strip**.

The defining product moves are:
- **Two-bank diagonal cells** — each cell shows two presets ("A" left, "B" right) on opposite sides of a diagonal seam. Click either side to fire that preset; right-click to **arm**. Armed presets glow + show a circular FIRE button on their half.
- **Voice announcer** with a per-preset **cue** line ("To add more bite, we cue Growl.") spoken on arm and a **fire** line ("Growl — unleashed.") spoken on fire.
- **Analog signal chain visualization** — INPUT VU gauge → ADD/FILTER flip-switch → OUTPUT VU gauge, all driven by the same fake live-signal hook so they pulse together.
- **Wordmark is alive** — each letter of "BEATWEAVER" pulses with a travelling shimmer head, color-shifts to accent when active, and has a meter underline beneath it.

## About the Design Files

The HTML/JSX files in this bundle are **design references, not production code**. They run as a static page using React-from-CDN and inline Babel JSX, with project-specific helpers like `useTweaks` (an in-design tweakability layer) and a `tweaks-panel.jsx` web-component-ish helper that don't belong in the real app.

**Your job is to recreate the UI in the target app's existing environment**, using its component library, design tokens, theme, and state-management pattern. The values, layouts, and behaviors here are correct and should be matched closely; the way they're wired up is not.

## Fidelity

**High-fidelity.** Final colors, typography, spacing, gauge geometry, animation timings, and copy are all decided. Recreate pixel-close using the codebase's existing libraries.

## Files

All under `design_handoff_beatweaver/`:

| File | Purpose |
|---|---|
| `Beatweaver.html` | Entry point. Defines the CSS variables, global styles, fonts, and animation keyframes. Loads React + Babel + the JSX modules. |
| `app.jsx` | Top-level `<BeatweaverApp>`. State, keyboard shortcuts, layout of the top bar and grid, footer VU + shortcut hints, Tweaks panel. |
| `components.jsx` | All reusable components: `useLiveSignal`, `Wordmark`, `AnalogVU`, `AnalogSlider`, `AnnouncerMouth`, `BeatPulse`, `Switch`, `BpmDisplay`, `KeyDisplay`, `ListenButton`, `Waveform3Band`, `MasterVU`, `ColumnVU`, `ConfidenceRing`, `ConfidenceBar`, `PresetHalf`, `DoubleCell`, `Column`, `Announcement`. |
| `data.jsx` | All preset data — 32 presets across 4 columns × 4 rows × 2 banks, plus pattern templates, key list, and key→color map. **Includes `cue` and `fire` voice lines per preset.** |
| `glyphs.jsx` | Per-preset SVG glyph icons. |
| `tweaks-panel.jsx` | Tweakability shell — **discard for production**, this is a prototype-only authoring affordance. |

## Design Tokens

Defined as CSS custom properties on `:root` in `Beatweaver.html`. Use these exact values when porting.

### Color — Surfaces & Text
| Token | Value | Use |
|---|---|---|
| `--bg` | `#06070A` | Page background |
| `--bg-2` | `#0A0B10` | Secondary background |
| `--surface` | `#0E1015` | Card/panel base |
| `--surface-2` | `#14161D` | Raised surface |
| `--hair` | `#1B1E27` | Default 1px border |
| `--hair-strong` | `#262A36` | Stronger 1px border |
| `--text` | `#E6E8EE` | Primary text |
| `--text-2` | `#9097A6` | Secondary text |
| `--muted` | `#535A6B` | Tertiary / labels |

### Color — Semantic
All semantic colors use `oklch()` so the accent is hue-tweakable at runtime.

| Token | Value | Use |
|---|---|---|
| `--accent` | `oklch(0.74 0.16 240)` | Primary accent (sky-blue by default; hue is tweakable) |
| `--accent-soft` | `oklch(0.74 0.16 240 / 0.18)` | Accent fill at 18% alpha |
| `--accent-line` | `oklch(0.74 0.16 240 / 0.45)` | Accent border/glow at 45% alpha |
| `--warn` | `oklch(0.78 0.15 75)` | Yellow — warning, FILTER-mode label |
| `--ok` | `oklch(0.78 0.16 155)` | Green — connected, OK |
| `--danger` | `oklch(0.66 0.20 24)` | Red — STOP ALL, peak meter |

### Color — Category (preset columns)
| Token | Value | Column |
|---|---|---|
| `--bass` | `oklch(0.72 0.14 160)` | BASS (mint/teal) |
| `--energy` | `oklch(0.74 0.15 60)` | ENERGY (amber) |
| `--texture` | `oklch(0.68 0.18 305)` | TEXTURE (violet) |
| `--fx` | `oklch(0.72 0.20 355)` | FX (magenta-pink) |

### Typography
| Family | Weights | Use |
|---|---|---|
| `Space Grotesk` | 400/500/700 | Body — preset names, BPM digits, generic UI |
| `JetBrains Mono` | 400/500/700 | All `.mono` text — labels (`INPUT`, `OUTPUT`, `KEYS 1–8 · FIRE`), numeric readouts, wordmark |

Sizes used:
- 17px / 700 / 0.16em letter-spacing — `BEATWEAVER` wordmark letters
- 32px / 600 — BPM digits ("124.0")
- 11–12px / 600 / 0.18em — section labels ("BASS", "1 ON", "STOP ALL", "ACTIVE")
- 9.5px / 500 / 0.16em — switch/toggle labels, tooltip-style chrome
- 8.5px / 700 / 0.16–0.20em — switch micro-labels (ADD/FILTER), slider labels (IN/OUT/ANN/FX)
- 9px / 500 / 0.16em — footer shortcut hint strip

### Spacing & Geometry
- Panel border-radius: **10px**
- Inner cell border-radius: **6px**
- Pill / lock chip border-radius: **999px** (fully rounded)
- Default border: **1px solid var(--hair)** or **var(--hair-strong)**
- Panel inner padding: **10–12px** vertical, **14–16px** horizontal
- Gap between top-bar zones: **16px**

### Shadows & Glows
- Panel base: `0 1px 0 rgba(255,255,255,0.025) inset`
- Active panel halo: `inset 0 0 24px color-mix(in oklab, var(--accent) 10%, transparent), 0 0 18px color-mix(in oklab, var(--accent) 8%, transparent)`
- Armed preset: `box-shadow: 0 0 0 1px var(--ready) inset, 0 0 8–18px var(--ready)` keyframed at **1.4s ease-in-out infinite** between 8px and 18px blur
- FIRE button halo: 70×70 circle behind a 38×38 button, **1.6s ease-in-out infinite** scale 0.85↔1.05 + opacity 0.55↔1
- Wordmark idle glow: `0 0 8px color-mix(...accent ~25%...)` breathing at ~10s cycle

## Screens / Views

There is one screen. Top→bottom regions:

### 1. Top transport bar (single horizontal panel)

Grid: `auto auto auto 1fr auto auto auto auto`, vertical padding 12px / horizontal 16px. Two visual zones inside a single bordered chassis on the left, then independent transport modules on the right.

**Chassis (left, single bordered box):**
- **Zone 1 — wordmark column.** Vertical stack:
  - `<Wordmark>` — "BEATWEAVER" letter-by-letter, each letter is a span with a travelling shimmer head, color/glow tied to active state. Below the letters is a 3px-tall meter underline that fills with the live signal level and runs a 4px tracer dot left→right when active.
  - 2×2 grid of `<AnalogSlider>` faders, 88px wide each, 14px column-gap, 3px row-gap:
    - Row 1: **IN** (var(--accent), unipolar 0–100), **ANN** (var(--energy), bipolar L/C/R, snaps to center within ±0.06)
    - Row 2: **OUT** (var(--accent), unipolar), **FX** (var(--fx), bipolar)
  - Each fader: 8.5px label / 0.16em letter-spacing left of an 18px-tall slot with engraved 4px groove + 5 tick marks + brushed-metal cap (14×18, gradient #E8EBF2→#B8BFCC→#6E7585→#2A2D38, 3px radius, with a center grip line). Right of the slot a 26px right-aligned readout: `78` / `82` / `L15` / `C` / `R30` etc.
- **1px vertical hairline divider** (`var(--hair)`).
- **Zone 2 — signal chain.** Inline row:
  - `<AnalogVU>` 78×42, label `INPUT`. Curved swept-needle gauge with green→red zone arc, tick marks, and a needle that interpolates toward the current level with `0.18` lerp inertia. `dim` prop dims it when routing is FILTER.
  - **Flip-switch** — vertical "ADD over FILTER" toggle. Reads as a real bat-handled flip-switch on a brass-screwed plate, with a knob that slides up (=ADD, accent glow) or down (=FILTER, warn glow). Click toggles. Has a tooltip describing the routing mode.
  - `<AnalogVU>` 78×42, label `OUTPUT`. Always pulses when any preset is active or when analyzing in ADD mode.

The chassis as a whole gets an inner+outer accent halo when anything is active or the input is being analyzed.

**Right of chassis (independent modules with hairline dividers):**
- `<BpmDisplay>` — 32px BPM digits with `±` adjust buttons, "BPM · LOCKED" sub-label, lock pill. Click pill to unlock; analyzing → confidence ring fills around it.
- `<KeyDisplay>` — large key letter (e.g. "A") in the key's Camelot color (see `KEY_COLORS` in `data.jsx`), "KEY · LOCKED" sub-label, lock pill.
- `<BeatPulse>` — small pulsing dot synced to the BPM (visible only when analyzing).
- `<ListenButton>` — large round LISTEN button. Idle = outlined; analyzing = filled accent + spinning ring; locked = solid green check.
- Two stacked `<Switch>` toggles labeled `BPM` and `KEY` — controls whether each is auto-detected from the input.
- **Announcement strip** — a left-aligned text block holding the current voice line. Shows an `<AnnouncerMouth>` (animated SVG mouth lip-syncing while TTS speaks) when TTS is on.
- **MIDI status pill** — green dot + "LAUNCH XL" mono label, tooltip "Novation Launch Control XL connected".
- **TTS toggle** — `TTS ON` / `TTS OFF` chip (accent when on).
- **Active count** — `N ACTIVE` in accent, or `READY` in muted.
- **STOP ALL button** — danger-red bordered chip; red glow when anything is active.

### 2. Preset grid (4 columns × 4 rows of double-cells)

`grid-template-columns: repeat(4, 1fr)`, **8px** gap. Each column = a `<Column>`.

**Column header:** `BASS / Low-end`, `ENERGY / Builds & drops`, `TEXTURE / Atmosphere`, `FX / Transitions`. Left of the title is a 2px-wide vertical color bar in the column's category color (`--bass`, etc). Right side: an "N ON" badge (accent when >0) and a 12×12 mini `<ColumnVU>` — 4 vertical bars that flicker when any preset in that column is active.

**Cells:** each cell is a 6px-radius card containing two `<PresetHalf>` triangles split by a diagonal seam from top-right to bottom-left. The cell wrap shows `border: 1px solid var(--hair)`, hover→`var(--hair-strong)`. Each half:
- A bank letter ("A" or "B") in the corner.
- The preset name, set in body face, sized to fit.
- A SVG glyph icon behind the name (from `glyphs.jsx`), positioned per half. Glyph has 4 visual states with corresponding animations — `glyph-idle` (faint), `glyph-hot` (slightly brighter when its column is active), `glyph-ready` (accent-colored + drift+shimmer animation), `glyph-active` (dark for contrast on filled bg).
- Click → fire that preset (calls `firePreset(id)`).
- Right-click → arm/disarm (calls `armPreset(id)`); only acts if the `armOnRightClick` tweak is enabled.

**Active state:** the half fills with the category color (var(--bass)/etc). Glyph goes near-black. Diagonal seam stays visible.

**Armed state:** the cell-half wrap gets `--ready: <category color>` and the `.ready` keyframed glow (1.4s pulse). A 38×38 circular **FIRE button** appears positioned at (22%, 48%) for the A half, (78%, 52%) for the B half — tucked safely inside the triangle, away from the diagonal seam. The button has its own halo animation behind it. Clicking the button fires that preset; pressing **F** fires all currently-armed presets at once.

### 3. Footer

- Master output VU strip — 64-segment horizontal LED meter with green→amber→red gradient (`<MasterVU>`).
- Right side: `-1.0 dB` numeric readout.
- Below: shortcut hint strip in 9px mono, joined by `·` separators:
  `KEYS 1–8 · FIRE  · F · FIRE ARMED  · SPACE · STOP ALL  · RIGHT-CLICK · ARM`
  and on the right: `ANALYSIS · ON · OUT · CH 4 · LATENCY · 12ms`

## Interactions & Behavior

### Mouse
- **Click a preset half** → toggle that preset on/off. Speak its `fire` line.
- **Right-click a preset half** → toggle armed. Speak its `cue` line. (Disabled if `armOnRightClick` tweak is off.)
- **Click a fader cap (or anywhere on its slot)** → set value; drag to adjust. Bipolar faders snap to 0 within ±0.06.
- **Click ADD/FILTER switch** → toggle routing.
- **Click LISTEN** → simulate audio analysis (see state-transition flow below).
- **Click STOP ALL** → clear active + armed sets, speak "All stopped".
- **Click TTS chip** → toggle TTS.
- **Click BPM ± / KEY letter** → manually adjust if unlocked.
- **Click lock pill** → unlock that detection (zeroes confidence, allows manual entry).

### Keyboard
- **1–8** → fire preset by linear bank-A index across the visible columns (col = floor((n-1)/2), row = (n-1) % 4).
- **F** → fire all currently armed presets simultaneously, clear armed set.
- **Space** → STOP ALL.
- Inputs and selects ignore shortcuts.

### Voice announcer
- When firing a preset and TTS is on → speak `preset.fire` (e.g. *"Growl — unleashed."*).
- When arming a preset and TTS is on → speak `preset.cue` (e.g. *"To add more bite, we cue Growl."*).
- When stopping → speak "All stopped".
- BPM lock → "BPM locked"; Key lock → "Key locked".
- The announcement strip shows the current line as text; the `<AnnouncerMouth>` SVG lip-syncs (driven by `useLiveSignal({ active: speaking })`).

### LISTEN flow
- Idle → click → `analyzing = true`. Schedule timeouts:
  - 400ms: `bpmConfidence = 0.45`
  - 800ms: `keyConfidence = 0.4`
  - 1200ms: `bpmConfidence = 0.85`
  - 1600ms: `keyConfidence = 0.78`
  - 2000ms: `bpmLocked = true`, `bpmConfidence = 0.95`, announce "BPM locked"
  - 2400ms: `keyLocked = true`, announce "Key locked"
- Click again while analyzing → cancel everything: `bpmLocked = false`, `keyLocked = false`, both confidences = 0.

### Animations & timing
- Wordmark shimmer head moves at `tick * 0.06` letter-units; spike width 1.6 letters
- Wordmark idle breathing: ~10s cycle, alpha 0.55→0.73
- Wordmark meter tracer dot: `(tick * 0.6) % 100` left%
- Armed preset glow: 1.4s ease-in-out infinite, blur 8px↔18px
- Glyph "ready" drift: ~3s ease-in-out infinite, ±2% translateX + ±2deg rotate, 0.55↔0.85 opacity
- Glyph "active" pulse: ~0.9s ease-in-out infinite, gentle scale
- FIRE button: 1.1s scale pulse 1↔1.06; halo 1.6s scale 0.85↔1.05 / opacity 0.55↔1
- Beat pulse: synced to BPM (`60000 / bpm` ms period)
- VU needle: lerp toward target with factor 0.18 per frame
- Routing switch: knob position transitions 200ms

## State Management

State lives at the app root. In a real codebase, lift to whatever pattern you use (Redux/Zustand/MobX/SwiftUI ObservableObject/etc.) — the shape is what matters.

```ts
type AppState = {
  // Audio analysis
  analyzing: boolean;
  bpm: number;                  // 30..300
  bpmConfidence: number;        // 0..1
  bpmLocked: boolean;
  keyName: string;              // "C" | "C#" | ... | "B"
  keyConfidence: number;        // 0..1
  keyLocked: boolean;
  bpmEnabled: boolean;          // auto-detect on/off
  keyEnabled: boolean;

  // Voice
  ttsEnabled: boolean;
  announcement: string;         // current line
  // (announcement clears after 4s via setTimeout)

  // Presets
  active: Set<PresetId>;        // currently-firing
  ready: Set<PresetId>;         // armed

  // Mixer
  inputVol: number;             // 0..1
  outputVol: number;            // 0..1
  annPan: number;               // -1..1
  fxPan: number;                // -1..1

  // Routing
  routingMode: "add" | "filter";
};
```

### Key actions
- `firePreset(id)`: toggle id in `active`; if newly added and `tts`, announce `preset.fire`. Always remove from `ready`.
- `armPreset(id)`: toggle id in `ready`; if newly added and `tts`, announce `preset.cue`. (No-op if `armOnRightClick` is disabled.)
- `fireAllReady()`: for each id in `ready`, call `firePreset(id)`; clear `ready`.
- `stopAll()`: clear both sets, announce "All stopped".
- `toggleListen()`: kicks off the simulated detection sequence above.
- `adjustBpm(delta)`: clamp BPM to `[30, 300]`, round to 1 decimal.

## Live signal hook

`useLiveSignal({ active, bpm = 124 })` returns `{ tick, level }` where:
- `tick` increments every animation frame (used as a phase clock; many components do `Math.sin(tick * x)` for shimmer/breathing).
- `level` is a 0..1 envelope synthesized from a few interfering sine waves so VUs/wordmark/announcer mouth all share a coherent fake signal.

When porting to a real audio pipeline, replace this with an `AnalyserNode`-backed `level` (e.g. RMS of the time-domain buffer) and a `tick` from `requestAnimationFrame`. All consumers (`AnalogVU`, `Wordmark`, `MasterVU`, `BeatPulse`, `AnnouncerMouth`) just read `{tick, level}` so they swap automatically.

## Preset data shape

See `data.jsx`. 32 entries shaped as:

```ts
type Preset = {
  col: 0 | 1 | 2 | 3;              // BASS | ENERGY | TEXTURE | FX
  row: 0 | 1 | 2 | 3;              // grid row inside the column
  bank: "A" | "B";                 // which half of the diagonal
  id: string;                      // e.g. "bass_growl"
  name: string;                    // visible label, e.g. "Growl"
  pat: keyof typeof PATTERNS;      // pattern shape used for the glyph/preview
  ann: string;                     // legacy short label
  cue: string;                     // spoken on arm
  fire: string;                    // spoken on fire
};
```

`PATTERNS` is a `Record<string, number[8]>` of step-sequence amplitudes (0–3) used to render the small in-glyph patterns.

## Assets

No raster images. All visuals are SVG (glyphs, gauges, switches, mouth) or pure CSS gradients/borders. Two Google Fonts: **Space Grotesk** and **JetBrains Mono**.

## Things to deliberately drop when porting

- `tweaks-panel.jsx` and the `useTweaks` hook — prototype-only.
- The `_om-edit-overrides` style block (if present) — prototype-only direct-edit overrides.
- The simulated detection timeouts in `toggleListen` — replace with real audio analysis.
- The fake `useLiveSignal` — replace with `AnalyserNode` data.
- Inline `<script type="text/babel">` — port each component to whatever framework the target codebase uses.

## Open questions for the implementer

- Which voice does the announcer use? (Browser `SpeechSynthesisUtterance` is the easy default; a higher-fidelity prototype would use a hosted TTS.)
- Should the mixer faders affect actual audio routing (e.g. announcer pan via a `StereoPannerNode`)? The prototype only stores values.
- MIDI status is currently faked. If targeting Launch Control XL, wire `navigator.requestMIDIAccess()` and map fader CCs to the 4 sliders.
