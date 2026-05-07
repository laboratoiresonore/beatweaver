<p align="center">
  <img src="public/wordmark.svg" alt="BeatWeaver" width="420" />
</p>

<p align="center">
  <em>A DJ overlay tool for people who never learned music theory.</em><br/>
  Detects BPM + key in real time, then lets you layer 32 hand-tuned synth presets in the right key on top of any track — without touching a piano roll.
</p>

<p align="center">
  <a href="#testing"><img src="https://img.shields.io/badge/tests-306%20passing-green" alt="tests"/></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue" alt="license"/></a>
  <a href="https://www.electronjs.org/"><img src="https://img.shields.io/badge/Electron-28-9feaf9" alt="electron"/></a>
  <a href="https://tonejs.github.io/"><img src="https://img.shields.io/badge/Tone.js-14-f0a100" alt="tone.js"/></a>
  <a href="#midi-controller-novation-launch-control-xl"><img src="https://img.shields.io/badge/MIDI-WebMIDI-7c3aed" alt="MIDI"/></a>
  <a href="https://github.com/laboratoiresonore/beatweaver/releases"><img src="https://img.shields.io/badge/platforms-macOS%20%7C%20Windows%20%7C%20Linux-lightgrey" alt="platforms"/></a>
</p>

---

## What it does

You're DJing. Two decks, one mixer. You want to drop a bass line, a riser, a vocal pad, an FX wash — but you can't read music and your synth would need a key signature to make any of that work.

**BeatWeaver listens to your mix and figures out the key for you.** Then every preset you fire transposes itself to that key, automatically. Press a button → it sounds right.

It's a layer on top of your existing DJ rig, not a replacement. Your decks still own the timeline. BeatWeaver just makes the "I want to add something live" button finally make sense.

## Features

- **BPM Detection** — Automatic tempo detection from DJ mixer input. Adaptive IQR outlier rejection, kick-band pre-emphasis (60–120 Hz weighted to keep the kick lock from drifting onto snare off-beats), rolling-median candidate smoothing → stable readout from cold-start, lock holds across DJ scratches and tempo ramps.
- **Key Detection** — Real-time chroma + Krumhansl-Schmuckler correlation. Detection runs at 20 Hz on a 5-second window which re-anchors the moment the BPM locks (fresh post-lock samples → ~10–20% better key accuracy in live transitions).
- **32 Presets** — 4 categories (Bass, Energy, Texture, FX) × 2 banks (A / B), all transposed to the detected key.
- **MIDI Control** — Novation Launch Control XL integration with full LED feedback (top/bottom rows, side buttons, knob rings). Hot-plug supported. VU meter on Row C uses change-detection to avoid SysEx flooding when the level is steady.
- **Professional Sound** — SynthFactory with acid bass, supersaw, FM, Karplus-Strong pluck, warm pads, and noise percussion. SSL-bus-comp-style master glue (4:1 / -12 dB / 5 ms / 200 ms with +3 dB makeup) — no pumping under heavy parallel load. 50 ms reverb pre-delay reads as concert-hall space, not muddy near-field smear.
- **Per-Column Effects** — Chorus / Phaser / Tremolo modulators with **zero-allocation type-switching** (effect pool stays warm; type swap is just two `wet.value` ramps, no audio dropout, no GC pressure on knob tweaks).
- **TTS Announcements** — Voice feedback for preset names; choose between Browser TTS, Windows SAPI, or a Kobold-hosted neural voice.
- **Arm / Fire** — Right-click to arm with a spoken cue line, then `F` (or LCXL side-LEFT) to fire every armed preset at once.

## Installation

### Download Pre-built Release

1. Go to [Releases](https://github.com/laboratoiresonore/beatweaver/releases)
2. Download the version for your platform:
   - **Mac**: `Beatweaver-x.x.x-mac.zip` (Intel & Apple Silicon)
   - **Windows**: `Beatweaver-x.x.x-win.exe`
   - **Linux**: `Beatweaver-x.x.x.AppImage`

### Mac Installation

1. Download `Beatweaver-x.x.x-mac.zip`
2. Unzip the file
3. Drag `Beatweaver.app` to your Applications folder
4. **First launch**: Right-click the app and select "Open" (required for unsigned apps)
5. Click "Open" in the security dialog

> **Note**: Since the app isn't signed with an Apple Developer certificate, macOS Gatekeeper will warn you the first time. This is normal for open-source apps.

### Windows Installation

1. Download `Beatweaver-x.x.x-win.exe`
2. Run the installer
3. Follow the installation prompts

### Linux Installation

1. Download `Beatweaver-x.x.x.AppImage`
2. Make it executable: `chmod +x Beatweaver-*.AppImage`
3. Run: `./Beatweaver-*.AppImage`

## Build from Source

### Prerequisites

- Node.js 18+ (LTS recommended)
- npm or yarn

### Development

```bash
# Clone the repository
git clone https://github.com/laboratoiresonore/beatweaver.git
cd beatweaver

# Install dependencies
npm install

# Generate app icon
node scripts/generate-icon.js

# Start development server
npm run dev
```

### Build for Production

```bash
# Build for current platform
npm run build

# Build for specific platform
npm run build:win   # Windows
npm run build:mac   # macOS (requires Mac)
npm run build:linux # Linux
```

## Audio Routing

```
DJ Mixer Output ──┬──► Main PA System (unchanged)
                  │
                  └──► BeatWeaver Input (analysis only)

BeatWeaver Output ──► Separate channel on DJ Mixer
```

BeatWeaver **only analyzes** your DJ mix for BPM/key detection. It outputs its synthesized sequences on a separate audio channel that you mix into your DJ set.

## MIDI Controller (Novation Launch Control XL)

### Top Row Buttons - Fire Presets
| 1 | 2 | 3 | 4 | 5-8 |
|---|---|---|---|-----|
| Bass | Energy | Texture | FX | Reserved |

### Bottom Row Buttons - Functions
| 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
|---|---|---|---|---|---|---|---|
| Mute | Solo | BPM- | BPM+ | - | Analysis | BPM | Key |

### Faders
- Faders 1-4: Column volume
- Faders 5-8: Reserved

### Side Buttons
- UP/DOWN: Switch bank (A/B)
- LEFT: Toggle TTS announcements
- RIGHT: Reserved

## Keyboard Shortcuts

| Key | Action |
|---|---|
| `1`–`8` | Fire preset by position in current bank |
| Right-click | Arm a preset half (speaks the cue line) |
| `F` | Fire every armed preset (one mass-trigger gesture) |
| `Space` | Stop all active presets |
| `Esc` | Stop audio analysis |

## Technology Stack

- **Electron 28** — Desktop app framework with native audio device access
- **Tone.js 14** — Audio synthesis, transport, and effects routing
- **React 18 + Tailwind 3** — UI with fast HMR via Vite
- **Vite 5** — Build tool
- **realtime-bpm-analyzer** — In-browser BPM detection
- **pitchfinder** + Krumhansl-Schmuckler — Key detection
- **WebMIDI API** — Direct Launch Control XL access (no driver)
- **Zustand** — State (where component-local hooks aren't enough)

See `CLAUDE.md` for the full system architecture, MIDI mapping, and synth/preset details.

## Testing

310 automated integration tests cover the audio orchestrator, MIDI dispatch, BPM/key analysis pipeline (incl. chroma cache, kick-band pre-emphasis, adaptive IQR, rolling median, unlock-state-machine), announcer queue, key transposition, modulator pool, preset library integrity, and the arm/fire-armed interaction layer.

```bash
npm test          # one-shot vitest run
npm run test:watch # watch mode
```

For audible verification — the kind the unit tests can't pin — every release should also pass [`tests/manual/LISTENING_TESTS.md`](tests/manual/LISTENING_TESTS.md), a 50-item DJ-runs-it checklist covering detection accuracy, synth quality solo + parallel, reverb space, modulator pool, MIDI hot-plug, sustained load, and edge cases.

## Design Assets

The brand source-of-truth lives in [`design/`](design/):

- `design/icon.svg` — Full-color app icon (vector source for `build/icon.png`)
- `design/icon-monochrome.svg` — Single-stroke glyph for tray / favicon
- `design/wordmark.svg` — BEATWEAVER lockup with meter underline
- `design/tokens.css` — Canonical design tokens (mirrors `:root` in `src/styles/index.css`)
- `design/colors.md` — Palette spec with hex, oklch, contrast ratios, and per-color usage
- `design/icons/{bass,energy,texture,fx,fire}.svg` — Category & UI glyphs

The hi-fi static prototype that drove the visual rebuild lives at
[`_dev_docs/design_handoff_beatweaver/`](_dev_docs/design_handoff_beatweaver/).
Issue #3 tracks the remaining production port.

## Project Layout

```
beatweaver/
├── electron/             Electron main + preload
├── src/
│   ├── App.jsx           Root component
│   ├── core/             Audio + MIDI + TTS engine
│   │   ├── Beatweaver.js   Orchestrator (single React-facing API)
│   │   ├── SynthEngine.js  Tone.js master bus + instrument lifecycle
│   │   ├── SynthFactory.js Acid bass, supersaw, FM, pluck, warm pad, kick, perc
│   │   ├── MidiController.js Launch Control XL driver (with LED feedback)
│   │   ├── AudioAnalysis.js  BPM + Key detection
│   │   ├── Announcer.js      TTS (Browser / SAPI / Kobold) with effects chain
│   │   └── Transposer.js     Pattern transposition utilities
│   ├── presets/index.js  32 presets × {bank, col, row, cue, fire, …}
│   ├── ui/               React components (PresetGrid, VuMeter, …)
│   └── styles/index.css  Tailwind + CSS custom properties
├── tests/integration/    Vitest suites (275 tests)
├── design/               Brand source-of-truth (SVG, tokens, palette spec)
├── _dev_docs/            Design handoff reference (do not import from src/)
└── scripts/              Build helpers (icon generator)
```

## License

MIT — see [LICENSE](LICENSE).
