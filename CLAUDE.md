# BEATWEAVER - CLAUDE DEVELOPMENT GUIDELINES

## Project Overview

**BeatWeaver** is a DJ tool for users with NO musical theory knowledge.
- **Input:** Audio from DJ mixer (for BPM detection ONLY)
- **Output:** Generated sequences ONLY (not input audio)
- **Control:** Novation Launch Control XL + on-screen UI
- **Stack:** Electron + Tone.js + React + Tailwind

---

## SYSTEM ARCHITECTURE

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                           BEATWEAVER SYSTEM                                   │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│   ┌─────────────────────────────────────────────────────────────────────┐    │
│   │                        App.jsx (React)                               │    │
│   │  • Auto-start countdown • Settings persistence • VU Meter            │    │
│   └───────────────────────────────┬─────────────────────────────────────┘    │
│                                   │                                           │
│   ┌───────────────────────────────▼─────────────────────────────────────┐    │
│   │                     Beatweaver.js (Orchestrator)                     │    │
│   │  • Column management • MIDI callbacks • Preset launching             │    │
│   │  • Modulator system • Bank switching • Hold-to-repeat                │    │
│   └──┬──────────────┬──────────────┬──────────────┬─────────────────────┘    │
│      │              │              │              │                           │
│      ▼              ▼              ▼              ▼                           │
│  ┌────────┐   ┌──────────┐   ┌───────────┐   ┌──────────┐                    │
│  │ Synth  │   │  MIDI    │   │  Audio    │   │Announcer │                    │
│  │ Engine │   │Controller│   │ Analysis  │   │  (TTS)   │                    │
│  └────────┘   └──────────┘   └───────────┘   └──────────┘                    │
│      │              │              │              │                           │
│      ▼              ▼              ▼              ▼                           │
│  ┌────────┐   ┌──────────┐   ┌───────────┐   ┌──────────┐                    │
│  │ Synth  │   │ Novation │   │ realtime- │   │ Browser  │                    │
│  │Factory │   │   LCXL   │   │bpm-analyzer│  │Speech API│                    │
│  └────────┘   └──────────┘   └───────────┘   └──────────┘                    │
│                                                                               │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## CRITICAL LESSONS (Inherited from WhimWeaver)

1. **ALWAYS UNDERESTIMATE SCOPE**
   - Whatever I think this project needs, it needs MORE
   - My first instinct is ALWAYS too simple
   - Double-check complexity estimates

2. **NEVER ACTUALLY UNDERSTAND**
   - Ask questions instead of assuming
   - Show interpretation BEFORE building
   - If I think "I've got this" - I'm already wrong

3. **"PASSED" MEANS NOTHING**
   - Code runs != quality
   - ONLY user approval = success
   - Iterate until EXPLICITLY approved

4. **ITERATE UNTIL APPROVED**
   - Show output to user
   - Get specific feedback
   - Make adjustments
   - Repeat until approved

5. **I BLAST THROUGH CODE WITHOUT VERIFYING ANYTHING (2026-02-04 CATASTROPHIC FAILURE)**
   - **WHAT I DID:** Wrote 7 files and refactored App.jsx in one burst
   - **THE LIE:** `vite build` passing means NOTHING - it checks syntax, NOT runtime behavior
   - **RULES:**
     - NEVER write more than ONE module without running the app to verify
     - NEVER skip TDD - write tests FIRST, then implementation
     - NEVER claim "build passes" as validation - RUN the actual application
     - After writing code, RUN IT and SHOW THE USER before moving to the next thing

---

## TECHNOLOGY STACK

| Component | Technology | Reason |
|-----------|------------|--------|
| App Type | Electron | Desktop app with native audio access |
| Audio Engine | Tone.js | Mature, documented, DJ-friendly |
| Synth Creation | SynthFactory | Professional instruments with effect chains |
| BPM Detection | realtime-bpm-analyzer | Browser-native, no dependencies |
| Key Detection | pitchfinder + Krumhansl-Schmuckler | Real-time key analysis |
| MIDI | WebMIDI API | Direct controller access |
| TTS | Browser SpeechSynthesis + Kobold API | Dual fallback system |
| UI Framework | React + Tailwind | Fast iteration |
| Build Tool | Vite | Fast HMR, modern bundling |

---

## CORE SYSTEMS

### 1. Beatweaver.js (Orchestrator) - ~1,602 lines

**Location:** `src/core/Beatweaver.js`

The main orchestrator that wires together all subsystems.

**Key Responsibilities:**
- Initialize and wire AudioAnalysis, SynthEngine, MidiController, Announcer
- Manage presets (launch, stop, solo, mute)
- Handle bank switching (A/B with 16 presets each)
- Column-based modulator management
- Hold-to-turn-off behavior for instrument buttons (1 second threshold)
- BPM +/- with hold-to-repeat
- LED state synchronization

**Key Methods:**
```javascript
// Preset control
launchPreset(column)      // Fire preset in column, announce name
stopPreset(column)        // Stop preset in column
stopAll()                 // Stop all active presets
soloSelected()            // Solo the last-selected column

// Bank switching
switchBank('A' | 'B')     // Switch preset bank

// BPM control
_adjustBpm(delta)         // Adjust locked BPM by delta
setBpmAnalysisEnabled(enabled)  // Toggle BPM analysis
setKeyAnalysisEnabled(enabled)  // Toggle key analysis

// Modulator control per column
_setColumnModulatorType(col, type)  // 0=Chorus, 1=Phaser, 2=Tremolo
_setColumnModulatorWet(col, value)  // 0.0-1.0 wet mix

// LED state
_syncBottomLEDs()         // Sync function button LEDs
_syncKnobLEDs()           // Sync knob ring LEDs (SysEx)
```

**Column Modulator Map:**
```javascript
this._columnModulators = new Map();  // Map<number, Modulator>
// Each column (0-3) gets its own modulator instance
// Instruments connect to modulator.input, modulator connects to masterGain
```

---

### 2. SynthEngine.js - ~1,107 lines

**Location:** `src/core/SynthEngine.js`

Manages Tone.js audio context, master bus, and instrument lifecycle.

**Master Bus Chain:**
```
Instruments → masterGain → masterCompressor → masterLimiter → Destination
                 │
                 ├─► reverbBus (shared)
                 └─► delayBus (shared)
```

**Master Processing:**
```javascript
this.masterGain = new Tone.Gain(0.8);
this.masterCompressor = new Tone.Compressor({
  threshold: -20,
  ratio: 4,
  attack: 0.003,
  release: 0.25
});
this.masterLimiter = new Tone.Limiter(-1);  // Prevents clipping
```

**Built-in Instruments (6):**
| Name | Type | Purpose |
|------|------|---------|
| acidBass | MonoSynth | 303-style acid bass |
| stab | PolySynth | Chord stabs |
| arp | PolySynth | Arpeggios |
| pad | PolySynth | Atmospheric pads |
| lead | MonoSynth | Lead lines |
| perc | NoiseSynth | Percussion/noise |

**Key Methods:**
```javascript
async init()              // Initialize Tone.js context
createPresetInstrument(preset, column)  // Create from preset definition
startPattern(column, preset)  // Start sequenced pattern
stopPattern(column)       // Stop pattern on column
setColumnFader(col, val)  // Set column volume (0-1)
setBpm(bpm)              // Sync all patterns to BPM
setKey(key)              // Transpose all patterns to key
dispose()                // Clean up all audio resources
```

**SynthFactory Integration:**
```javascript
if (preset && preset.instrumentType) {
  const factoryInstrument = SynthFactory.createInstrument(
    preset.instrumentType,
    destination,
    preset.synthOptions || {}
  );
  return factoryInstrument;
}
```

---

### 3. SynthFactory.js - ~715 lines

**Location:** `src/core/SynthFactory.js`

Professional instrument creation with effect chains. Based on Switch Angel's Strudel research.

**Instrument Types:**
| Type | Description | Key Features |
|------|-------------|--------------|
| `acid_bass` | 303-style acid | Filter envelope, high resonance, distortion |
| `supersaw` | Thick leads/pads | 5-7 detuned voices, stereo spread |
| `fm_bass` | Complex bass | FM synthesis, metallic harmonics |
| `pluck` | Karplus-Strong | Plucked string simulation |
| `warm_pad` | Atmospheric | Slow attack, chorus, reverb |
| `kick` | Electronic kick | Pitch envelope, punchy attack |
| `perc` | Percussion | Noise-based, filtered |
| `basic` | Simple synth | Fallback instrument |

**Factory Pattern:**
```javascript
export function createInstrument(type, destination, options = {}) {
  switch (type) {
    case 'acid_bass': return _createAcidBass(destination, options);
    case 'supersaw': return _createSupersaw(destination, options);
    case 'fm_bass': return _createFMBass(destination, options);
    // ... etc
  }
}
```

**Modulator System (CRITICAL):**
```javascript
export const MODULATOR_TYPES = {
  CHORUS: 0,
  PHASER: 1,
  TREMOLO: 2
};

export function createModulator(type, destination) {
  const input = new Tone.Gain(1);  // STABLE input node
  let effect = _createEffectOfType(type);
  let wet = 0.5;

  input.connect(effect);
  if (destination) effect.connect(destination);

  return {
    input,  // Instruments connect HERE (stable reference)
    setType: (newType) => {
      // Seamlessly swap effect without disconnecting instruments
      effect.disconnect();
      effect.dispose();
      effect = _createEffectOfType(newType);
      effect.wet.value = wet;
      input.connect(effect);
      if (destination) effect.connect(destination);
    },
    setWet: (value) => {
      wet = value;
      effect.wet.value = value;
    },
    dispose: () => {
      input.disconnect();
      effect.disconnect();
      effect.dispose();
    }
  };
}
```

**Why Persistent Input Nodes:**
- Instruments connect to `modulator.input` once
- Effect type can change WITHOUT reconnecting instruments
- Seamless transitions between Chorus/Phaser/Tremolo

---

### 4. MidiController.js - ~599 lines

**Location:** `src/core/MidiController.js`

Novation Launch Control XL driver with hot-plug detection.

**LCXL Constants:**
```javascript
static LCXL = {
  // Knob CCs
  KNOBS_A: [13, 14, 15, 16, 17, 18, 19, 20],  // Top row
  KNOBS_B: [29, 30, 31, 32, 33, 34, 35, 36],  // Middle row
  KNOBS_C: [49, 50, 51, 52, 53, 54, 55, 56],  // Bottom row

  // Fader CCs
  FADERS: [77, 78, 79, 80, 81, 82, 83, 84],

  // Button Notes
  BUTTONS_TOP: [41, 42, 43, 44, 57, 58, 59, 60],
  BUTTONS_BOTTOM: [73, 74, 75, 76, 89, 90, 91, 92],

  // Side buttons
  SIDE_UP: 104,
  SIDE_DOWN: 105,
  SIDE_LEFT: 106,
  SIDE_RIGHT: 107,

  // LED Colors (velocity values)
  LED_OFF: 0,
  LED_RED_LOW: 13,
  LED_RED: 15,
  LED_AMBER_LOW: 29,
  LED_AMBER: 63,
  LED_YELLOW: 62,
  LED_GREEN_LOW: 28,
  LED_GREEN: 60,
};
```

**Key Methods:**
```javascript
async init()              // Initialize WebMIDI, detect controller
setTopLED(index, color)   // Set top row button LED
setBottomLED(index, color)  // Set bottom row button LED
setKnobLED(index, color)  // Set knob ring LED (SysEx)
flashEpicConnection()     // Epic LED animation on connect
dispose()                 // Clean up MIDI connections
```

**SysEx for Knob LEDs:**
```javascript
// SysEx message format for LCXL knob LEDs
// F0 00 20 29 02 11 78 [Template] [Index] [Color] F7
setKnobLED(index, color) {
  if (!this.output) return;
  const message = [
    0xF0, 0x00, 0x20, 0x29, 0x02, 0x11, 0x78,  // Header
    0x08,        // Template (Factory 1)
    index,       // Knob index (0-23)
    color,       // Color value
    0xF7         // SysEx end
  ];
  this.output.send(message);
}
```

**Callback System:**
```javascript
// Set in Beatweaver._wireMidiCallbacks()
onKnobChange(row, index, value)  // row: 'A'|'B'|'C', index: 0-7, value: 0-127
onFaderChange(index, value)      // index: 0-7, value: 0-127
onButtonPress(isTop, index)      // isTop: bool, index: 0-7
onSideButton(button, pressed)    // button: 'up'|'down'|'left'|'right'
```

---

### 5. AudioAnalysis.js - ~320 lines

**Location:** `src/core/AudioAnalysis.js`

Real-time BPM and key detection from audio input.

**BPM Detection:**
- Uses `realtime-bpm-analyzer` library
- Confidence threshold: 80% for lock
- Lock behavior: Once BPM is locked, it stays until manually unlocked or analysis disabled

**Key Detection:**
- Uses `pitchfinder` for pitch detection
- Krumhansl-Schmuckler algorithm for key correlation
- Major and minor key profiles

**State:**
```javascript
this.bpmLocked = false;
this.lockedBpm = null;
this.detectedKey = null;
this.bpmAnalysisEnabled = true;
this.keyAnalysisEnabled = true;
```

**Key Methods:**
```javascript
async init()              // Request microphone access, setup analyzer
start()                   // Start analysis
stop()                    // Stop analysis
lockBpm()                 // Lock current BPM
unlockBpm()               // Unlock BPM
```

---

### 6. Announcer.js - ~180 lines

**Location:** `src/core/Announcer.js`

Text-to-speech for preset announcements and status messages.

**Dual Backend System:**
1. **Browser SpeechSynthesis** (primary) - No network required
2. **Kobold API** (optional) - Higher quality TTS

**Key Methods:**
```javascript
async init()              // Initialize TTS backend
speak(text)               // Announce text
setEnabled(enabled)       // Enable/disable TTS
setRate(rate)             // Speech rate (0.5-2.0)
setPitch(pitch)           // Speech pitch (0.5-2.0)
setVolume(volume)         // Volume (0.0-1.0)
```

**Settings Persistence:**
```javascript
{
  enabled: true,
  rate: 1.0,
  pitch: 1.0,
  volume: 0.8,
  koboldEndpoint: null  // Optional Kobold API URL
}
```

---

## PRESET SYSTEM

### Location: `src/presets/index.js` (~844 lines)

**Structure:**
- 32 presets total (4 categories × 2 banks × 4 presets each)
- Bank A and Bank B with same categories
- Patterns defined in key of C (transposed at runtime)

**Categories:**
| Column | Category | Description |
|--------|----------|-------------|
| 0 | BASS | Sub bass, wobble, reese, 808 |
| 1 | ENERGY | Leads, arps, stabs, risers |
| 2 | TEXTURE | Pads, atmospheres, noise |
| 3 | FX | Impacts, sweeps, special effects |

**Preset Definition:**
```javascript
{
  id: 'bass_acid_a',
  name: 'Acid',
  category: 'BASS',
  bank: 'A',
  column: 0,

  // SynthFactory integration
  instrumentType: 'acid_bass',
  synthOptions: {
    filterDecay: 0.2,
    resonance: 8,
    drive: 0.3
  },

  // Pattern (in C, transposed at runtime)
  pattern: ['C2', 'C2', 'C3', 'C2', 'Eb2', 'Eb2', 'G2', 'F2'],
  patternDuration: '8n',

  // Announcement
  announcement: 'Acid bass'  // Optional, defaults to name
}
```

**Pattern Transposition:**
All patterns are defined in C major/minor. When key detection locks a new key, patterns are transposed:
```javascript
// Example: Pattern in C, key detected as G
// C2 → G2, Eb2 → Bb2, G2 → D3, etc.
```

---

## UI COMPONENTS

### Location: `src/ui/`

| Component | File | Purpose |
|-----------|------|---------|
| PresetGrid | `PresetGrid.jsx` | 4×2 grid of preset buttons |
| FaderBank | `FaderBank.jsx` | 8 vertical faders for volume |
| KnobBank | `KnobBank.jsx` | 3 rows × 8 knobs |
| TransportBar | `TransportBar.jsx` | BPM display, key, transport controls |
| ListenControls | `ListenControls.jsx` | Analysis toggles, BPM +/- |
| SettingsPanel | `SettingsPanel.jsx` | TTS, audio device settings |
| VuMeter | `VuMeter.jsx` | Audio level visualization |

### VuMeter Implementation

**Location:** `src/ui/VuMeter.jsx` (~227 lines)

Two variants:
1. **VuMeter** - Multi-bar FFT visualization
2. **VuMeterInline** - Compact horizontal bar with peak hold

**Implementation:**
```javascript
// Uses Tone.js Analyser connected to destination
analyserRef.current = new Tone.Analyser('fft', 256);
Tone.getDestination().connect(analyserRef.current);

// Throttled to 30fps to minimize CPU
if (timestamp - lastUpdateRef.current < 33) {
  animFrameRef.current = requestAnimationFrame(updateMeter);
  return;
}
```

**Color Gradient:**
- Green (low level) → Yellow (mid) → Red (high)
- HSL-based: `hsl(${120 - level * 120}, ${80 + level * 20}%, ${45 + level * 10}%)`

---

## MIDI BUTTON MAPPING

### Top Row Buttons (Preset Launch)
| Index | Bank A | Bank B |
|-------|--------|--------|
| 0 | Bass 1 | Bass 5 |
| 1 | Energy 1 | Energy 5 |
| 2 | Texture 1 | Texture 5 |
| 3 | FX 1 | FX 5 |
| 4-7 | Reserved | Reserved |

### Bottom Row Buttons (Functions)
| Index | Function | LED Color |
|-------|----------|-----------|
| 0 | MUTE ALL | Red |
| 1 | SOLO | Yellow |
| 2 | BPM -5 | Amber (when locked) |
| 3 | BPM +5 | Amber (when locked) |
| 4 | Reserved | Off |
| 5 | Analysis Toggle | Yellow (when active) |
| 6 | BPM Toggle | Yellow (when enabled) |
| 7 | Key Toggle | Yellow (when enabled) |

### Side Buttons
| Button | Function |
|--------|----------|
| UP | Bank switch (A↔B) |
| DOWN | Bank switch (A↔B) |
| LEFT | TTS Enable/Disable |
| RIGHT | Reserved |

### Knob Rows
| Row | Function |
|-----|----------|
| A (Top) | Column parameters (0-3) + Global (4-7) |
| B (Middle) | TTS controls (0-3) + Reserved (4-7) |
| C (Bottom) | Effect parameters / Modulator control |

### Faders
| Index | Function |
|-------|----------|
| 0-3 | Column volume |
| 4-7 | Reserved / Master |

---

## SETTINGS PERSISTENCE

**Location:** `src/core/settings.js`

Settings are persisted to:
- **Electron:** IPC to main process (file-based)
- **Browser:** localStorage fallback

**Settings Schema:**
```javascript
{
  audio: {
    inputDevice: null,  // Device ID
    outputDevice: null,
    masterVolume: 0.8
  },
  midi: {
    device: null  // MIDI device name
  },
  tts: {
    enabled: true,
    rate: 1.0,
    pitch: 1.0,
    volume: 0.8,
    koboldEndpoint: null
  },
  analysis: {
    bpmEnabled: true,
    keyEnabled: true,
    confidenceThreshold: 0.8
  },
  ui: {
    theme: 'dark',
    showVuMeter: true
  }
}
```

---

## AUDIO ROUTING

```
DJ Mixer Output ──┬──► Main PA System (unchanged)
                  │
                  └──► BeatWeaver Input (analysis only, NOT audible)

BeatWeaver Output ──► Separate channel on DJ Mixer
```

**Why This Architecture:**
1. No latency added to DJ's music
2. DJ controls their own mix levels
3. BeatWeaver only adds sequences on top
4. If BeatWeaver crashes, DJ's music continues

---

## FILE STRUCTURE

```
beatweaver/
├── package.json
├── vite.config.js
├── CLAUDE.md                 # This file
├── electron/
│   ├── main.js               # Electron main process
│   └── preload.js            # Bridge to renderer
├── src/
│   ├── index.html
│   ├── index.css             # Tailwind entry
│   ├── App.jsx               # Main React component
│   ├── core/
│   │   ├── Beatweaver.js     # Main orchestrator
│   │   ├── SynthEngine.js    # Tone.js management
│   │   ├── SynthFactory.js   # Professional instruments
│   │   ├── MidiController.js # LCXL driver
│   │   ├── AudioAnalysis.js  # BPM/Key detection
│   │   └── Announcer.js      # TTS system
│   ├── presets/
│   │   └── index.js          # All 32 presets
│   ├── ui/
│   │   ├── PresetGrid.jsx
│   │   ├── FaderBank.jsx
│   │   ├── KnobBank.jsx
│   │   ├── TransportBar.jsx
│   │   ├── ListenControls.jsx
│   │   ├── SettingsPanel.jsx
│   │   └── VuMeter.jsx
│   └── utils/
│       └── settings.js       # Settings persistence
├── public/
│   └── icon.png
└── _dev_tools/
    ├── SESSION_HANDOFF.md
    ├── PROBLEMS_LEARNED.md
    ├── IDEAS_CAPTURED.md
    └── preparation_work/
        └── BEATWEAVER_ARCHITECTURE.md
```

---

## DEVELOPMENT COMMANDS

```bash
# Development (Vite HMR)
npm run dev

# Build for production
npm run build

# Run Electron app
npm run electron

# Build Electron distributable
npm run electron:build

# Run tests
npm test
```

---

## USER-FRIENDLY DESIGN PRINCIPLES

**Core Philosophy:** DJ should FEEL, not THINK

| Technical Term | User-Friendly Label |
|---------------|---------------------|
| Filter Cutoff | DARKNESS / BRIGHTNESS |
| Resonance | SQUELCH / EDGE |
| Attack | SNAP |
| Release | TAIL |
| Reverb Mix | SPACE |
| Delay Mix | ECHO |
| Distortion | GRIT / DIRT |
| LFO Rate | WOBBLE SPEED |
| Octave | HEIGHT |
| Velocity | POWER |
| Gate Time | CHOP |

---

## KEY DESIGN DECISIONS

| Decision | Reason |
|----------|--------|
| Electron over web | Native audio device access, no browser restrictions |
| Tone.js over raw Web Audio | Abstracts complexity, better timing |
| SynthFactory pattern | Professional instruments with effect chains |
| Modulator persistent input | Seamless effect type switching without reconnection |
| Preset-based over code-based | DJ-friendly, no typing required |
| Master limiter | Prevents clipping when layering multiple presets |
| Confidence lock for BPM | Prevents false triggers |
| Separate audio routing | No latency, crash isolation |

---

## WHEN IN DOUBT

- Ask the user
- Show interpretation before building
- Test with real audio
- Iterate until approved

---

*BeatWeaver Development Guidelines - Updated February 2026*
