# Beatweaver - Optimal Software Architecture

## Executive Summary

**Target User:** DJ with NO musical theory knowledge
**Input:** Audio signal from DJ mixer → PC
**Output:** Generated sequences ONLY (not the input audio)
**Control:** Novation Launch Control XL + on-screen UI

---

## System Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                             BEATWEAVER                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   AUDIO IN                          PROCESSING                    AUDIO OUT  │
│   ┌──────────┐                     ┌──────────┐                 ┌──────────┐│
│   │DJ Mixer  │──────┐              │  BPM     │                 │Sequences ││
│   │(line in) │      │              │ Detector │                 │  ONLY    ││
│   └──────────┘      │              └────┬─────┘                 └────┬─────┘│
│                     │                   │                            │      │
│                     ▼                   ▼                            │      │
│              ┌────────────┐      ┌────────────┐      ┌──────────────┐│      │
│              │ Audio      │      │   TEMPO    │      │   SYNTH      ││      │
│              │ Analysis   │─────▶│   LOCK     │─────▶│   ENGINE     │┘      │
│              │ (FFT)      │      │ (Verified) │      │  (Tone.js)   │       │
│              └────────────┘      └────────────┘      └──────┬───────┘       │
│                                        │                    │               │
│                                        ▼                    │               │
│   MIDI IN                       ┌────────────┐              │               │
│   ┌──────────────┐              │  PRESET    │              │               │
│   │Launch Control│─────────────▶│  MANAGER   │──────────────┘               │
│   │     XL       │              │            │                              │
│   └──────────────┘              └─────┬──────┘                              │
│                                       │                                     │
│                                       ▼                                     │
│                                ┌────────────┐                               │
│                                │   KOBOLD   │                               │
│                                │    TTS     │                               │
│                                │(announce)  │                               │
│                                └────────────┘                               │
│                                                                              │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │                         VISUAL UI                                    │   │
│   │   [BPM: 128] [LOCKED ✓]   [████████████] Confidence: 98%            │   │
│   │                                                                      │   │
│   │   PRESETS:  [ACID BASS]  [TRANCE GATE]  [ARPEGGIO]  [STAB]         │   │
│   │                                                                      │   │
│   │   CONTROLS: ═══════○═══  ═══○═══════  ═══════○═══  ═══○═══════     │   │
│   │             Intensity     Speed       Filter      Reverb            │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Technology Stack

### Core Framework
| Component | Technology | Reason |
|-----------|------------|--------|
| **App Type** | Electron + Web | Desktop app with web tech for rich UI |
| **Audio Engine** | Tone.js | Most mature, best documented, DJ-friendly |
| **BPM Detection** | realtime-bpm-analyzer | Browser-native, no dependencies |
| **MIDI** | WebMIDI API (native) | Direct controller access |
| **TTS** | Kobold API (HTTP) | User's existing infrastructure |
| **UI Framework** | React + Tailwind | Fast iteration, good component ecosystem |

### Why NOT Other Options
| Rejected | Reason |
|----------|--------|
| Strudel/TidalCycles | Requires code typing - not DJ friendly |
| SuperCollider | Complex setup, not beginner friendly |
| Ableton Link | Overkill for single-app sync |
| Pure Web Audio | Too low-level, would take forever |

---

## Component Details

### 1. Audio Input & BPM Detection

**Library:** `realtime-bpm-analyzer`

```javascript
// audio-analyzer.js
import { RealTimeBPMAnalyzer } from 'realtime-bpm-analyzer';

class AudioAnalyzer {
  constructor() {
    this.analyzer = new RealTimeBPMAnalyzer({
      continuousAnalysis: true,
      stabilizationTime: 5000,  // Wait 5 sec for stable BPM
    });
    this.isLocked = false;
    this.currentBPM = null;
    this.confidence = 0;
  }

  async start(audioInputDevice) {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { deviceId: audioInputDevice }
    });

    const audioContext = new AudioContext();
    const source = audioContext.createMediaStreamSource(stream);

    // BPM detection (NOT sent to output - analysis only)
    this.analyzer.analyze(source, (result) => {
      this.currentBPM = result.tempo;
      this.confidence = result.confidence;

      // Lock when confidence > 90% for 3+ seconds
      if (this.confidence > 0.9) {
        this.isLocked = true;
        this.onLock?.(this.currentBPM);
      }
    });
  }

  getBPM() {
    return this.isLocked ? this.currentBPM : null;
  }
}
```

**Key Point:** The input audio is ONLY used for analysis. It is NOT routed to output.

---

### 2. Synth Engine (Tone.js)

**Philosophy:** Pre-built "instruments" that sound good without theory knowledge.

```javascript
// synth-engine.js
import * as Tone from 'tone';

class SynthEngine {
  constructor() {
    this.bpm = 120;
    this.instruments = {};
    this.activePattern = null;

    // Master output (sequences only)
    this.master = new Tone.Gain(0.8).toDestination();
  }

  setBPM(bpm) {
    this.bpm = bpm;
    Tone.Transport.bpm.value = bpm;
  }

  // Pre-configured instruments (user doesn't need to understand)
  setupInstruments() {
    // Acid Bass - classic 303 sound
    this.instruments.acidBass = new Tone.MonoSynth({
      oscillator: { type: 'sawtooth' },
      filter: { Q: 6, type: 'lowpass', rolloff: -24 },
      envelope: { attack: 0.01, decay: 0.1, sustain: 0.4, release: 0.2 },
      filterEnvelope: { attack: 0.01, decay: 0.2, sustain: 0.2, release: 0.2,
                        baseFrequency: 200, octaves: 3 }
    }).connect(this.master);

    // Trance Stab - bright chord hit
    this.instruments.tranceStab = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'square' },
      envelope: { attack: 0.005, decay: 0.3, sustain: 0, release: 0.3 }
    }).connect(this.master);

    // Arpeggiator Synth
    this.instruments.arpSynth = new Tone.Synth({
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.01, decay: 0.1, sustain: 0.3, release: 0.1 }
    }).connect(this.master);

    // Pad
    this.instruments.pad = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'sine' },
      envelope: { attack: 0.5, decay: 0.5, sustain: 0.8, release: 1.0 }
    }).connect(this.master);
  }
}
```

---

### 3. Preset System (NO THEORY REQUIRED)

**Philosophy:** Presets are named by VIBE, not by musical terms.

```javascript
// presets.js

const PRESETS = {
  // ============================================
  // BASS PRESETS (Low energy boosters)
  // ============================================
  "PUMP_IT_UP": {
    displayName: "Pump It Up",
    description: "Heavy bass pulse that follows the kick",
    instrument: "acidBass",
    pattern: "KICK_FOLLOW",  // Plays on every beat
    controls: {
      intensity: { default: 0.7, label: "POWER" },
      filter: { default: 0.5, label: "DARKNESS" },
      speed: { default: 1.0, label: "SPEED" }
    },
    announcement: "Dropping the bass pump"
  },

  "ACID_WOBBLE": {
    displayName: "Acid Wobble",
    description: "Classic acid house bassline",
    instrument: "acidBass",
    pattern: "SIXTEENTH_WOBBLE",
    controls: {
      intensity: { default: 0.6, label: "POWER" },
      filter: { default: 0.7, label: "SQUELCH" },  // "Squelch" instead of "resonance"
      speed: { default: 1.0, label: "SPEED" }
    },
    announcement: "Here comes the acid"
  },

  // ============================================
  // ENERGY PRESETS (Build-ups and drops)
  // ============================================
  "TRANCE_GATE": {
    displayName: "Trance Gate",
    description: "Pumping gated synth",
    instrument: "tranceStab",
    pattern: "OFFBEAT_GATE",
    controls: {
      intensity: { default: 0.8, label: "POWER" },
      gate: { default: 0.5, label: "CHOP" },      // "Chop" instead of "gate time"
      brightness: { default: 0.6, label: "BRIGHTNESS" }
    },
    announcement: "Trance gate incoming"
  },

  "RISING_ARPEGGIO": {
    displayName: "Rising Energy",
    description: "Building arpeggio that climbs up",
    instrument: "arpSynth",
    pattern: "CLIMB_UP",
    controls: {
      intensity: { default: 0.5, label: "POWER" },
      speed: { default: 1.0, label: "SPEED" },
      range: { default: 0.5, label: "HEIGHT" }    // "Height" instead of "octaves"
    },
    announcement: "Building energy"
  },

  // ============================================
  // ATMOSPHERE PRESETS (Pads and textures)
  // ============================================
  "DREAMY_PAD": {
    displayName: "Dream Cloud",
    description: "Soft floating pad",
    instrument: "pad",
    pattern: "SUSTAINED",
    controls: {
      intensity: { default: 0.4, label: "POWER" },
      warmth: { default: 0.5, label: "WARMTH" },  // "Warmth" instead of "filter"
      space: { default: 0.7, label: "SPACE" }     // "Space" instead of "reverb"
    },
    announcement: "Adding atmosphere"
  },

  "STAB_ATTACK": {
    displayName: "Stab Attack",
    description: "Sharp rhythmic stabs",
    instrument: "tranceStab",
    pattern: "QUARTER_STABS",
    controls: {
      intensity: { default: 0.7, label: "POWER" },
      sharpness: { default: 0.6, label: "SHARPNESS" },
      echo: { default: 0.3, label: "ECHO" }
    },
    announcement: "Stabs coming in"
  }
};

// Pattern definitions (hidden from user)
const PATTERNS = {
  "KICK_FOLLOW": (bpm) => ["C2", null, null, null],  // Quarter notes
  "SIXTEENTH_WOBBLE": (bpm) => ["C2", "C2", "D2", "C2", "E2", "C2", "D2", "C2"],
  "OFFBEAT_GATE": (bpm) => [null, "C4", null, "C4"],
  "CLIMB_UP": (bpm) => ["C3", "E3", "G3", "C4", "E4", "G4", "C5", "G4"],
  "SUSTAINED": (bpm) => [["C3", "E3", "G3"]],  // Chord, held
  "QUARTER_STABS": (bpm) => [["C4", "E4", "G4"], null, null, null]
};
```

---

### 4. Control Mapping (User-Friendly Labels)

**Philosophy:** Controls use FEELING words, not technical terms.

| Technical Term | User-Friendly Label | What It Actually Controls |
|---------------|---------------------|--------------------------|
| Filter Cutoff | DARKNESS / BRIGHTNESS | `filter.frequency` |
| Resonance | SQUELCH / EDGE | `filter.Q` |
| Attack | SNAP | `envelope.attack` |
| Release | TAIL | `envelope.release` |
| Reverb Mix | SPACE | `reverb.wet` |
| Delay Mix | ECHO | `delay.wet` |
| Distortion | GRIT / DIRT | `distortion.amount` |
| LFO Rate | WOBBLE SPEED | `lfo.frequency` |
| Octave | HEIGHT | Transpose amount |
| Velocity | POWER | Note velocity / gain |
| Gate Time | CHOP | Note duration % |

---

### 5. Novation Launch Control XL Mapping

**Default Mapping (fully customizable):**

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    NOVATION LAUNCH CONTROL XL                           │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│   KNOBS (Top Row) - GLOBAL CONTROLS                                     │
│   [1]        [2]        [3]        [4]        [5]        [6]    [7] [8]│
│   Master    Reverb     Delay      Filter    Unused    Unused   BPM±    │
│   Volume    Space      Echo       Bright                      (tap)    │
│                                                                         │
│   KNOBS (Middle Row) - PRESET-SPECIFIC CONTROL 1                       │
│   [1]        [2]        [3]        [4]        [5]        [6]    [7] [8]│
│   Preset1   Preset2   Preset3   Preset4   Preset5   Preset6   Ctrl1    │
│   Param1    Param1    Param1    Param1    Param1    Param1             │
│                                                                         │
│   KNOBS (Bottom Row) - PRESET-SPECIFIC CONTROL 2                       │
│   [1]        [2]        [3]        [4]        [5]        [6]    [7] [8]│
│   Preset1   Preset2   Preset3   Preset4   Preset5   Preset6   Ctrl2    │
│   Param2    Param2    Param2    Param2    Param2    Param2             │
│                                                                         │
│   FADERS - INTENSITY/VOLUME PER PRESET                                  │
│   |▓|       |▓|       |▓|       |▓|       |▓|       |▓|       |▓|  |▓| │
│   [1]       [2]       [3]       [4]       [5]       [6]       [7]  [8] │
│   Preset1   Preset2   Preset3   Preset4   Preset5   Preset6   Master   │
│   Power     Power     Power     Power     Power     Power     Mix      │
│                                                                         │
│   BUTTONS (2 rows of 8)                                                 │
│   ┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌───┐                     │
│   │ 1 │ │ 2 │ │ 3 │ │ 4 │ │ 5 │ │ 6 │ │ 7 │ │ 8 │  ← LAUNCH PRESET    │
│   └───┘ └───┘ └───┘ └───┘ └───┘ └───┘ └───┘ └───┘    (press to start) │
│   ┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌───┐                     │
│   │ 1 │ │ 2 │ │ 3 │ │ 4 │ │ 5 │ │ 6 │ │ 7 │ │ 8 │  ← STOP PRESET      │
│   └───┘ └───┘ └───┘ └───┘ └───┘ └───┘ └───┘ └───┘    (press to stop)  │
│                                                                         │
│   SIDE BUTTONS                                                          │
│   [▲] = Bank Up (next 8 presets)                                       │
│   [▼] = Bank Down (previous 8 presets)                                 │
│   [◄] = Announce ON/OFF                                                │
│   [►] = BPM Lock Override                                              │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

**MIDI Implementation:**

```javascript
// midi-controller.js
class LaunchControlXL {
  constructor() {
    this.midiAccess = null;
    this.input = null;
    this.output = null;

    // Launch Control XL specific
    this.DEVICE_NAME = "Launch Control XL";

    // CC mappings
    this.CC_MAP = {
      // Faders (Channel 1)
      FADER_1: 77, FADER_2: 78, FADER_3: 79, FADER_4: 80,
      FADER_5: 81, FADER_6: 82, FADER_7: 83, FADER_8: 84,

      // Knobs Row 1 (Send A)
      KNOB_1A: 13, KNOB_2A: 14, KNOB_3A: 15, KNOB_4A: 16,
      KNOB_5A: 17, KNOB_6A: 18, KNOB_7A: 19, KNOB_8A: 20,

      // Knobs Row 2 (Send B)
      KNOB_1B: 29, KNOB_2B: 30, KNOB_3B: 31, KNOB_4B: 32,
      KNOB_5B: 33, KNOB_6B: 34, KNOB_7B: 35, KNOB_8B: 36,

      // Knobs Row 3 (Pan)
      KNOB_1C: 49, KNOB_2C: 50, KNOB_3C: 51, KNOB_4C: 52,
      KNOB_5C: 53, KNOB_6C: 54, KNOB_7C: 55, KNOB_8C: 56
    };

    // Note mappings for buttons
    this.NOTE_MAP = {
      // Top row buttons (launch)
      LAUNCH_1: 41, LAUNCH_2: 42, LAUNCH_3: 43, LAUNCH_4: 44,
      LAUNCH_5: 57, LAUNCH_6: 58, LAUNCH_7: 59, LAUNCH_8: 60,

      // Bottom row buttons (stop)
      STOP_1: 73, STOP_2: 74, STOP_3: 75, STOP_4: 76,
      STOP_5: 89, STOP_6: 90, STOP_7: 91, STOP_8: 92
    };
  }

  async init() {
    this.midiAccess = await navigator.requestMIDIAccess();

    for (let input of this.midiAccess.inputs.values()) {
      if (input.name.includes(this.DEVICE_NAME)) {
        this.input = input;
        this.input.onmidimessage = this.handleMessage.bind(this);
        console.log("Launch Control XL connected!");
      }
    }

    for (let output of this.midiAccess.outputs.values()) {
      if (output.name.includes(this.DEVICE_NAME)) {
        this.output = output;
      }
    }
  }

  handleMessage(msg) {
    const [status, data1, data2] = msg.data;
    const channel = status & 0x0F;
    const type = status & 0xF0;

    if (type === 0xB0) {
      // Control Change
      this.onControlChange?.(data1, data2);
    } else if (type === 0x90) {
      // Note On
      this.onNoteOn?.(data1, data2);
    } else if (type === 0x80) {
      // Note Off
      this.onNoteOff?.(data1);
    }
  }

  // Set button LED color
  setButtonColor(note, color) {
    // Colors: 0=off, 13=red, 29=amber, 60=yellow, 28=green
    if (this.output) {
      this.output.send([0x90, note, color]);
    }
  }

  // Light up active preset
  showActivePreset(presetIndex) {
    // Clear all
    for (let i = 0; i < 8; i++) {
      this.setButtonColor(this.NOTE_MAP[`LAUNCH_${i+1}`], 0);
    }
    // Light active
    this.setButtonColor(this.NOTE_MAP[`LAUNCH_${presetIndex+1}`], 28); // Green
  }
}
```

---

### 6. Kobold TTS Integration

```javascript
// announcer.js
class Announcer {
  constructor(koboldUrl = "") {  // user supplies via settings (e.g. http://<host>:<port>)
    this.koboldUrl = koboldUrl;
    this.enabled = true;
    this.audioContext = new AudioContext();
  }

  async announce(text) {
    if (!this.enabled) return;

    try {
      // Call Kobold TTS API
      const response = await fetch(`${this.koboldUrl}/api/v1/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: `[SPEAK]${text}[/SPEAK]`,
          max_length: 100,
          // ... other Kobold params
        })
      });

      // If Kobold supports audio output, play it
      // Otherwise, use browser TTS as fallback
      if (!response.ok) {
        this.fallbackSpeak(text);
      }
    } catch (error) {
      this.fallbackSpeak(text);
    }
  }

  fallbackSpeak(text) {
    // Browser TTS fallback
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.2;
    utterance.pitch = 1.0;
    speechSynthesis.speak(utterance);
  }

  toggle() {
    this.enabled = !this.enabled;
    return this.enabled;
  }
}
```

---

### 7. Main Application Flow

```javascript
// app.js
class Beatweaver {
  constructor() {
    this.analyzer = new AudioAnalyzer();
    this.synth = new SynthEngine();
    this.midi = new LaunchControlXL();
    this.announcer = new Announcer();

    this.currentBank = 0;  // 8 presets per bank
    this.activePresets = new Set();
    this.bpmLocked = false;
  }

  async init() {
    // Setup synth instruments
    this.synth.setupInstruments();

    // Connect MIDI controller
    await this.midi.init();
    this.midi.onNoteOn = this.handleButton.bind(this);
    this.midi.onControlChange = this.handleKnob.bind(this);

    // Start audio analysis (user selects input device)
    const devices = await navigator.mediaDevices.enumerateDevices();
    const audioInputs = devices.filter(d => d.kind === 'audioinput');
    // Show device picker UI...
  }

  async startAnalysis(deviceId) {
    await this.analyzer.start(deviceId);

    this.analyzer.onLock = (bpm) => {
      this.bpmLocked = true;
      this.synth.setBPM(bpm);
      this.updateUI({ bpm, locked: true });
      this.announcer.announce(`BPM locked at ${Math.round(bpm)}`);
    };
  }

  handleButton(note, velocity) {
    // Find which button
    for (let i = 1; i <= 8; i++) {
      if (note === this.midi.NOTE_MAP[`LAUNCH_${i}`]) {
        this.launchPreset(this.currentBank * 8 + i - 1);
      }
      if (note === this.midi.NOTE_MAP[`STOP_${i}`]) {
        this.stopPreset(this.currentBank * 8 + i - 1);
      }
    }
  }

  handleKnob(cc, value) {
    const normalized = value / 127;  // 0-1 range

    // Global controls (top row)
    if (cc === this.midi.CC_MAP.KNOB_1A) {
      this.synth.master.gain.value = normalized;
    }
    // ... etc for each knob
  }

  async launchPreset(index) {
    if (!this.bpmLocked) {
      this.announcer.announce("Waiting for BPM lock");
      return;
    }

    const preset = Object.values(PRESETS)[index];
    if (!preset) return;

    // 1. Announce
    await this.announcer.announce(preset.announcement);

    // 2. Wait a beat
    await this.delay(60000 / this.synth.bpm);

    // 3. Start pattern
    this.synth.playPreset(preset);
    this.activePresets.add(index);

    // 4. Update controller LEDs
    this.midi.showActivePreset(index % 8);

    // 5. Update UI
    this.updateUI({ activePresets: Array.from(this.activePresets) });
  }

  stopPreset(index) {
    this.synth.stopPreset(Object.values(PRESETS)[index]);
    this.activePresets.delete(index);
    this.midi.setButtonColor(this.midi.NOTE_MAP[`LAUNCH_${(index % 8) + 1}`], 0);
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

---

## User Interface Design

### Main Screen Layout

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  BEATWEAVER                                                 [Settings] [Help] │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │  BPM DETECTOR                                                        │   │
│   │                                                                      │   │
│   │      ╔═══════════════════════════════════════════╗                  │   │
│   │      ║              128.4 BPM                    ║                  │   │
│   │      ╚═══════════════════════════════════════════╝                  │   │
│   │                                                                      │   │
│   │      [████████████████████░░░░░░] 87% Confidence                    │   │
│   │                                                                      │   │
│   │      Status: ● ANALYZING... (waiting for lock)                      │   │
│   │              ● LOCKED ✓ (ready to play!)                            │   │
│   │                                                                      │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │  PRESETS                                           Bank: [1] 2  3    │   │
│   │                                                                      │   │
│   │   ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐                   │   │
│   │   │ PUMP IT │ │  ACID   │ │ TRANCE  │ │ RISING  │                   │   │
│   │   │   UP    │ │ WOBBLE  │ │  GATE   │ │ ENERGY  │                   │   │
│   │   │   🔊    │ │         │ │    ▶    │ │         │   ← click to     │   │
│   │   │ [STOP]  │ │ [START] │ │ [STOP]  │ │ [START] │     start/stop   │   │
│   │   └─────────┘ └─────────┘ └─────────┘ └─────────┘                   │   │
│   │                                                                      │   │
│   │   ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐                   │   │
│   │   │  DREAM  │ │  STAB   │ │ BUILDUP │ │  DROP   │                   │   │
│   │   │  CLOUD  │ │ ATTACK  │ │         │ │         │                   │   │
│   │   │         │ │         │ │         │ │         │                   │   │
│   │   │ [START] │ │ [START] │ │ [START] │ │ [START] │                   │   │
│   │   └─────────┘ └─────────┘ └─────────┘ └─────────┘                   │   │
│   │                                                                      │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │  ACTIVE CONTROLS (for selected preset)                              │   │
│   │                                                                      │   │
│   │   POWER        DARKNESS      SPEED         SPACE                    │   │
│   │   ═══════○═══  ═══○═══════  ═══════○═══  ═══════○═══               │   │
│   │      70%          30%          100%          50%                    │   │
│   │                                                                      │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │  GLOBAL                                                              │   │
│   │                                                                      │   │
│   │   MASTER VOLUME    REVERB (SPACE)    DELAY (ECHO)    [🔊 Announce]  │   │
│   │   ═══════════○═    ═══════○═══════   ═══○═══════════   ON / OFF     │   │
│   │        80%             50%               20%                         │   │
│   │                                                                      │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│   [Audio Input: Line In (Focusrite) ▼]     [MIDI: Launch Control XL ✓]      │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Audio Routing

**CRITICAL:** The DJ's music is NOT routed through Beatweaver.

```
DJ Mixer Output ──┬──► Main PA System (unchanged)
                  │
                  └──► Beatweaver Input (analysis only, NOT audible)

Beatweaver Output ──► Separate channel on DJ Mixer
                       OR direct to PA (mixed externally)
```

**Why this matters:**
1. No latency added to DJ's music
2. DJ controls their own mix levels
3. Beatweaver only adds sequences on top
4. If Beatweaver crashes, DJ's music continues

---

## File Structure

```
beatweaver/
├── package.json
├── electron/
│   ├── main.js              # Electron main process
│   └── preload.js           # Bridge to renderer
├── src/
│   ├── index.html
│   ├── app.js               # Main application
│   ├── audio/
│   │   ├── analyzer.js      # BPM detection
│   │   └── synth-engine.js  # Tone.js instruments
│   ├── presets/
│   │   ├── index.js         # Preset definitions
│   │   ├── bass.js          # Bass presets
│   │   ├── energy.js        # Build-up presets
│   │   └── atmosphere.js    # Pad presets
│   ├── midi/
│   │   └── launch-control.js # Controller mapping
│   ├── tts/
│   │   └── announcer.js     # Kobold integration
│   ├── ui/
│   │   ├── components/      # React components
│   │   └── styles/          # Tailwind CSS
│   └── config/
│       └── settings.json    # User preferences
└── _dev_tools/
    └── preparation_work/    # Research docs
```

---

## Implementation Phases

### Phase 1: Core Audio (Week 1)
- [ ] Electron app scaffold
- [ ] Audio input device selection
- [ ] BPM detection with confidence meter
- [ ] Lock detection logic

### Phase 2: Synth Engine (Week 2)
- [ ] Tone.js setup
- [ ] 6 basic instruments
- [ ] Pattern sequencer
- [ ] Tempo sync

### Phase 3: Preset System (Week 3)
- [ ] 16 initial presets
- [ ] Control mapping
- [ ] User-friendly labels
- [ ] Preset bank system

### Phase 4: MIDI Controller (Week 4)
- [ ] Launch Control XL detection
- [ ] Full mapping implementation
- [ ] LED feedback
- [ ] Bank switching

### Phase 5: UI & Polish (Week 5)
- [ ] React UI components
- [ ] Visual feedback
- [ ] Settings panel
- [ ] Kobold TTS integration

### Phase 6: Testing & Presets (Week 6)
- [ ] Real DJ testing
- [ ] More presets based on feedback
- [ ] Performance optimization
- [ ] Documentation

---

## Key Design Decisions

### Why Electron?
- Native audio device access
- No browser security restrictions
- Can run alongside DJ software
- Installable desktop app

### Why Tone.js?
- Abstracts Web Audio complexity
- Built-in instruments and effects
- Excellent transport/timing
- Large community, good docs

### Why NOT use Strudel directly?
- Requires typing code
- Not intuitive for non-coders
- Overkill for preset-based system
- We borrow concepts, not implementation

### Why user-friendly labels?
- "DARKNESS" is intuitive, "filter cutoff" is not
- "SQUELCH" evokes a sound, "resonance" is technical
- DJ should FEEL, not THINK

---

## Future Enhancements

1. **Preset Editor** - Visual drag-and-drop preset creation
2. **AI Preset Generation** - "Make something that sounds like X"
3. **Phrase Detection** - Auto-trigger on 8/16 bar phrases
4. **Visual Feedback** - Waveform visualization
5. **Recording** - Record output for later use
6. **Network Sync** - Multiple Beatweaver instances in sync
7. **DJ Software Integration** - Direct Rekordbox/Traktor BPM feed

---

## Summary

| Requirement | Solution |
|-------------|----------|
| No theory knowledge | User-friendly labels, preset-based |
| BPM from mixer | realtime-bpm-analyzer + confidence lock |
| TTS announcements | Kobold API + browser fallback |
| Sequences only output | Separate audio routing, analysis-only input |
| Easy controls | Sliders with intuitive names |
| Launch Control XL | Full WebMIDI mapping with LED feedback |

**The DJ just needs to:**
1. Plug in audio from mixer
2. Wait for "BPM LOCKED" indicator
3. Press buttons on Launch Control XL (or screen)
4. Twist knobs to adjust sound
5. That's it!

---

*Architecture document for Beatweaver - January 2026*
