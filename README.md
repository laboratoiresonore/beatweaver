# BeatWeaver

A DJ tool for users with **NO musical theory knowledge**. BeatWeaver listens to your DJ mix, detects BPM and key, and lets you layer synthesized sequences on top using the Novation Launch Control XL or on-screen controls.

## Features

- **BPM Detection** - Automatically detects tempo from your DJ mixer input
- **Key Detection** - Identifies musical key using Krumhansl-Schmuckler algorithm
- **32 Presets** - 4 categories (Bass, Energy, Texture, FX) × 2 banks
- **MIDI Control** - Full Novation Launch Control XL integration with LED feedback
- **Professional Sound** - SynthFactory with acid bass, supersaw, FM synthesis, and more
- **Per-Column Effects** - Chorus, Phaser, or Tremolo per instrument column
- **TTS Announcements** - Voice feedback for preset names and status

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

## Technology Stack

- **Electron** - Desktop app framework
- **Tone.js** - Audio synthesis
- **React** - UI framework
- **Tailwind CSS** - Styling
- **Vite** - Build tool
- **realtime-bpm-analyzer** - BPM detection
- **pitchfinder** - Key detection

## License

MIT
