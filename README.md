# BeatWeaver

[![License](https://img.shields.io/github/license/laboratoiresonore/beatweaver)](LICENSE)
[![Build](https://github.com/laboratoiresonore/beatweaver/actions/workflows/build.yml/badge.svg)](https://github.com/laboratoiresonore/beatweaver/actions/workflows/build.yml)

A DJ tool for users with **NO musical theory knowledge**. BeatWeaver listens to your DJ mix, detects BPM and key, and lets you layer synthesized sequences on top using the Novation Launch Control XL or on-screen controls.

It runs **fully local** — no cloud, no telemetry, no account. Pop your mixer's monitor send into your machine, fire BeatWeaver, hit a launch pad, and the synth instantly auto-transposes to the detected key + locks to the detected BPM.

## Features

- **BPM Detection** — Realtime tempo extraction from your DJ mixer input (AudioWorklet + onset-detection fallback, normalised to a 60–180 BPM target range with stability filtering)
- **Key Detection** — Chroma-based recognition with Krumhansl–Schmuckler tonal-hierarchy correlation, locked once stable
- **32 Presets** — 4 categories (Bass / Energy / Texture / FX) × 2 banks (A / B), 4 presets per quadrant
- **6-instrument SynthFactory** — acid bass, supersaw stab, arp, pad, lead, perc — with FM synthesis, sub-osc, formant filtering, and AI-tuned envelope shaping
- **Auto-transposition** — every pattern is authored in C and transposed to the live-detected key at trigger time, so your overlay never clashes
- **MIDI Control** — first-class Novation Launch Control XL integration: hot-plug, LED feedback for active states, pad colour-coding by category, knob mapping per active preset
- **Per-Column Effects** — Chorus / Phaser / Tremolo modulator slot per instrument column with knob-driven wet/dry
- **TTS Announcements** — 3-tier voice feedback (Kobold local API → Electron SAPI → browser SpeechSynthesis) for preset names + key changes + status
- **DJ-pro UI** — Pioneer-CDJ-inspired layout: live VU meter as the BEATWEAVER backdrop, BPM + key readouts, modulator-state LEDs that mirror the controller

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
|-----|--------|
| `1`–`8` | Toggle preset by current-bank position |
| `Space` | Stop all active presets |
| `Esc` | Stop audio analysis |

## Technology Stack

- **Electron** — Desktop app framework (cross-platform: Windows / macOS / Linux)
- **Tone.js** — Audio synthesis (modulators, polysynths, envelopes, transport scheduling)
- **React 18** + **Tailwind CSS** — UI framework + styling
- **Vite** — Dev server + production build
- **realtime-bpm-analyzer** — AudioWorklet-based BPM extraction
- **pitchfinder** — Pitch detection (chroma profile feed)
- **vitest** — Test runner

## Privacy

BeatWeaver runs entirely on your local machine. There is **no cloud component**, no analytics, no telemetry, no account, no remote model. The audio you feed in for analysis never leaves your computer.

The TTS announcer's first tier (Kobold local API) is also entirely local; the Electron SAPI tier uses your OS's offline voice; the browser-SpeechSynthesis fallback is the only tier that *might* round-trip to the OS's text-to-speech engine, depending on your platform.

## Project status

Production-ready desktop app. Core dev finished — BPM + key detection, the 32-preset library across 4 categories × 2 banks, MIDI controller integration, modulator effects, TTS, and the DJ-pro UI overhaul are all merged. Open follow-up items live in [`_dev_tools/SESSION_HANDOFF.md`](_dev_tools/SESSION_HANDOFF.md).

## License

MIT — see [LICENSE](LICENSE).

## Part of the Laboratoire Sonore ecosystem

BeatWeaver is one of the public projects under [laboratoiresonore](https://github.com/laboratoiresonore). The org's [profile page](https://github.com/laboratoiresonore) lists the other public tools: [Spellcaster](https://github.com/laboratoiresonore/spellcaster) (AI image-generation toolkit for GIMP / DaVinci Resolve / Darktable), [ComfyUI-Spellcaster](https://github.com/laboratoiresonore/ComfyUI-Spellcaster) (architecture-aware ComfyUI custom nodes).
