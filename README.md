<p align="center">
  <img src="public/wordmark.svg" alt="BeatWeaver" width="420" />
</p>

<p align="center">
  <em>A DJ overlay tool for people who never learned music theory.</em><br/>
  Detects BPM + key in real time, then lets you layer 32 hand-tuned synth presets in the right key on top of any track — without touching a piano roll.
</p>

<p align="center">
  <a href="#testing"><img src="https://img.shields.io/badge/tests-362%20passing-green" alt="tests"/></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue" alt="license"/></a>
  <a href="https://www.electronjs.org/"><img src="https://img.shields.io/badge/Electron-42-9feaf9" alt="electron"/></a>
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
- **TTS Announcements** — Voice feedback for preset names. Pick from Browser TTS, Windows SAPI, a Kobold-hosted neural voice, or the **bundled offline neural Companion** (auto-sized to your hardware via [Piper TTS](https://github.com/rhasspy/piper) — no LLM server required). See [`docs/VOICE_COMPANION.md`](docs/VOICE_COMPANION.md).
- **Arm / Fire** — Right-click to arm with a spoken cue line, then `F` (or LCXL side-LEFT) to fire every armed preset at once.

## Installation

<p align="center">
  <a href="https://github.com/laboratoiresonore/beatweaver/releases/latest"><img src="https://img.shields.io/badge/Windows-Download-7c3aed?style=for-the-badge&logo=windows&logoColor=white" alt="Windows installer"/></a>
  &nbsp;
  <a href="https://github.com/laboratoiresonore/beatweaver/releases/latest"><img src="https://img.shields.io/badge/macOS-Download-7c3aed?style=for-the-badge&logo=apple&logoColor=white" alt="macOS zip"/></a>
  &nbsp;
  <a href="https://github.com/laboratoiresonore/beatweaver/releases/latest"><img src="https://img.shields.io/badge/Linux-Download-7c3aed?style=for-the-badge&logo=linux&logoColor=white" alt="Linux AppImage"/></a>
</p>

<p align="center">
  <a href="https://github.com/laboratoiresonore/beatweaver/releases"><img alt="Latest release" src="https://img.shields.io/github/v/release/laboratoiresonore/beatweaver?color=7c3aed&label=latest&style=flat"/></a>
  <a href="https://github.com/laboratoiresonore/beatweaver/releases/latest"><img alt="Total downloads" src="https://img.shields.io/github/downloads/laboratoiresonore/beatweaver/total?color=7c3aed&style=flat"/></a>
</p>

The badges above always point to the latest release. Pick the file for your platform from the assets list:

| Platform | File pattern | Notes |
|---|---|---|
| **Windows** (x64) | `Beatweaver.Setup.<version>.exe` | NSIS installer; double-click to install |
| **macOS Intel** | `Beatweaver-<version>-mac.zip` | Unzip, drag `Beatweaver.app` to Applications |
| **macOS Apple Silicon** | `Beatweaver-<version>-arm64-mac.zip` | Native M1/M2/M3 build |
| **Linux** (x64) | `Beatweaver-<version>.AppImage` | `chmod +x` then run |

### Mac Installation

1. Download the right zip — `mac.zip` for Intel, `arm64-mac.zip` for Apple Silicon (M1/M2/M3)
2. Unzip the file
3. Drag `Beatweaver.app` to your Applications folder
4. **First launch**: Right-click the app and select "Open" (required for unsigned apps)
5. Click "Open" in the security dialog

> **Note**: Since the app isn't signed with an Apple Developer certificate, macOS Gatekeeper will warn you the first time. This is normal for open-source apps. If Gatekeeper still refuses after right-click → Open, run `xattr -cr /Applications/Beatweaver.app` in Terminal.

### Windows Installation

1. Download `Beatweaver.Setup.<version>.exe`
2. Run the installer (Windows SmartScreen may warn — click "More info" → "Run anyway", same reason as macOS Gatekeeper)
3. Follow the installation prompts

### Linux Installation

1. Download `Beatweaver-<version>.AppImage`
2. Make it executable: `chmod +x Beatweaver-*.AppImage`
3. Run: `./Beatweaver-*.AppImage`

> **Optional**: integrate the AppImage with your menu via [AppImageLauncher](https://github.com/TheAssassin/AppImageLauncher) — first launch will offer to register a desktop entry.

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
- UP/DOWN: BPM nudge ±0.1 (hold-to-repeat)
- LEFT: Fire all armed presets (mass-trigger gesture, same as `F` key)
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

- **Electron 42** — Desktop app framework with native audio device access
- **Tone.js 14** — Audio synthesis, transport, and effects routing
- **React 18 + Tailwind 3** — UI with fast HMR via Vite
- **Vite 7** — Build tool
- **realtime-bpm-analyzer** — In-browser BPM detection
- **pitchfinder** + Krumhansl-Schmuckler — Key detection
- **WebMIDI API** — Direct Launch Control XL access (no driver)
- **Zustand** — State (where component-local hooks aren't enough)

See [`DESIGN.md`](DESIGN.md) for the design tokens + visual contract; the rest of the architecture is best read directly from `src/core/Beatweaver.js` (the single React-facing orchestrator).

## Testing

362 automated integration tests cover the audio orchestrator, MIDI dispatch, BPM/key analysis pipeline (incl. chroma cache, kick-band pre-emphasis, adaptive IQR, rolling median, unlock-state-machine), announcer queue, key transposition, modulator pool, preset library integrity, the arm/fire-armed interaction layer, and the voice-companion (hardware-detect heuristic, model-URL construction, port fallback, response-header validation, WAV-header bytes, companion-mode fallback chain).

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

See [`DESIGN.md`](DESIGN.md) for the full visual contract — palette, design tokens, and brand asset usage.

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
│   │   ├── Announcer.js      TTS (Browser / SAPI / Kobold / Companion) with effects chain
│   │   └── Transposer.js     Pattern transposition utilities
│   ├── presets/index.js  32 presets × {bank, col, row, cue, fire, …}
│   ├── ui/               React components (PresetGrid, VuMeter, …)
│   └── styles/index.css  Tailwind + CSS custom properties
├── tests/integration/    Vitest suites (362 tests across 13 files)
├── voice-companion/      Bundled offline neural TTS (Piper) — child process
├── design/               Brand source-of-truth (SVG, tokens, palette spec)
└── scripts/              Build helpers (icon generator)
```

## Roadmap

- [ ] **UI rebuild** ([#3](https://github.com/laboratoiresonore/beatweaver/issues/3)) — port the hi-fi handoff design into production. New layout, denser preset grid, live-meter visuals.
- [ ] **More controllers** — Akai APC mini, Korg nanoKONTROL2 (open an issue if you have hardware to contribute mappings).
- [ ] **Preset packs** — community-contributable preset bundles (currently the 32 ship with the app).
- [ ] **Sidechain duck-out** — auto-duck the synth column when the kick on your DJ deck hits, configurable per-preset.
- [ ] **Phrase memory** — record a 4 / 8 / 16-bar live-fired pattern and replay it on the next downbeat.

## Contributing

Issues and PRs welcome. The codebase is intentionally small — the orchestrator is a single class in `src/core/Beatweaver.js`, so finding-where-to-make-a-change is rarely a hunt.

A few load-bearing constraints to know up front:

- **Audio output is generated only.** Input audio is for analysis only — never re-emit incoming audio. (See `src/core/AudioAnalysis.js`.)
- **The MIDI controller layer is reactive.** Anything that changes UI state must round-trip through the orchestrator so LED feedback stays in sync.
- **Tests must pass before merge.** `npm test` is the gate; the 362 tests run in ~2s.

Bug reports — please include OS, audio interface, MIDI device (if any), and the captured detection state from the on-screen analysis panel when the issue occurred.

## License

MIT — see [LICENSE](LICENSE).

---

<p align="center">
  <sub>
    Part of the <a href="https://github.com/laboratoiresonore">Laboratoire Sonore</a> ecosystem of <strong>fully-local, privacy-first creative tools</strong>.<br/>
    Sister projects: <a href="https://github.com/laboratoiresonore/spellcaster">Spellcaster</a> (image gen) · <a href="https://github.com/laboratoiresonore/ComfyUI-Spellcaster">ComfyUI-Spellcaster</a> (the nodes that drive it)
  </sub>
</p>
