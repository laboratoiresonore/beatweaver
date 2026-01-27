# Existing Software for Controlling & Simplifying Strudel Workflows

This document catalogs software that can **control the same backends Strudel uses**, **detect BPM from playing music**, and **simplify live coding workflows** by providing external sync, automation, and control surfaces.

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Auto BPM Detection Software](#auto-bpm-detection-software)
3. [Tempo Sync Protocols](#tempo-sync-protocols)
4. [DJ Software with MIDI/OSC Clock Output](#dj-software-with-midiosc-clock-output)
5. [Control Surfaces & OSC Controllers](#control-surfaces--osc-controllers)
6. [SuperCollider Control Software](#supercollider-control-software)
7. [Max MSP & Pure Data Integration](#max-msp--pure-data-integration)
8. [Virtual Audio Routing](#virtual-audio-routing)
9. [Visual/VJ Software with Beat Sync](#visualvj-software-with-beat-sync)
10. [MIDI Controller Bridges](#midi-controller-bridges)
11. [Audio Analysis & Visualization](#audio-analysis--visualization)
12. [Strudel Native Integrations](#strudel-native-integrations)
13. [Complete Integration Architecture](#complete-integration-architecture)
14. [Use Case Workflows](#use-case-workflows)

---

## Executive Summary

### The Goal
Enable a workflow where:
1. **An ongoing song plays** (DJ set, Spotify, vinyl, etc.)
2. **Software automatically detects the BPM**
3. **Strudel/TidalCycles patterns launch in perfect sync**
4. **External hardware/software can control pattern parameters**

### Key Software Categories

| Category | Best Option | Purpose |
|----------|-------------|---------|
| **BPM Detection** | Pulse by Hybrid Constructs | Analyzes audio and outputs via Ableton Link |
| **Tempo Sync** | Ableton Link | Network protocol for syncing tempo |
| **DJ Control** | Mixxx (free) or Traktor | DJ software with MIDI clock output |
| **SuperCollider Control** | TouchOSC + OpenObject | Control synths via tablet/phone |
| **Visual Integration** | Max MSP / Pure Data | Visual programming to bridge systems |
| **Audio Routing** | BlackHole (Mac) / VB-Cable (Win) | Route audio between apps |

---

## Auto BPM Detection Software

### Pulse by Hybrid Constructs (RECOMMENDED)
**Website:** https://hybridconstructs.com/pulse/
**Platform:** Windows, macOS
**Price:** ~$29

**What it does:**
- Listens to ANY audio source (microphone, system audio, DJ mixer)
- Detects BPM in real-time with advanced rhythm analysis
- Outputs tempo via **Ableton Link** protocol
- Stays in sync even when tempo changes
- Shows beat position/phase, not just tempo

**How to use with Strudel:**
```
Audio Source → Pulse → Ableton Link → Strudel
```

**Key Features:**
- Tap to initialize tempo (only once per session)
- Visual confidence indicator (green = locked on)
- Works best within ±20 BPM of initial tap
- Perfect for VJ, lighting, and live coding sync

**Limitations:**
- Struggles with abrupt genre changes (EDM → hip-hop)
- Requires initial manual tap

---

### realtime-bpm-analyzer (JavaScript)
**Repository:** https://github.com/dlepaux/realtime-bpm-analyzer
**Website:** https://www.realtime-bpm-analyzer.com/
**License:** MIT

**What it does:**
- JavaScript library for browser-based BPM detection
- Works with microphone, audio files, streaming
- Uses Web Audio API
- No dependencies

**Example:**
```javascript
import { RealTimeBPMAnalyzer } from 'realtime-bpm-analyzer';

const analyzer = new RealTimeBPMAnalyzer();

navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
  const audioContext = new AudioContext();
  const source = audioContext.createMediaStreamSource(stream);

  analyzer.analyze(source, (tempo) => {
    console.log(`BPM: ${tempo.bpm}`);
    // Send to Strudel via OSC/WebSocket
  });
});
```

**Use case:** Build a custom BPM detector directly into Beatweaver.

---

### web-audio-beat-detector
**Repository:** https://github.com/chrisguttandin/web-audio-beat-detector
**License:** MIT

**What it does:**
- Analyzes AudioBuffer and returns BPM
- Based on Joe Sullivan's beat detection algorithm
- Optimized for electronic music (90-180 BPM range)
- Returns Promise with tempo

**Example:**
```javascript
import { analyze } from 'web-audio-beat-detector';

// From audio file
const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
const bpm = await analyze(audioBuffer);
console.log(`Detected BPM: ${bpm}`);
```

**Use case:** Analyze tracks before playback to pre-calculate tempo.

---

### BpmAnalyzer (Desktop)
**Repository:** https://github.com/MatthiasSchmid93/BpmAnalyzer
**Platform:** Windows, macOS
**License:** Open Source

**What it does:**
- Desktop BPM analyzer
- Outputs via Ableton Link
- Designed for live musicians/VJs

---

### Ableton Live (Tempo Follower)
**Website:** https://www.ableton.com/
**Price:** ~$99-749

**What it does:**
- Beat detection from audio input
- Outputs MIDI clock, Ableton Link
- "The algorithm works outstandingly well, reliable and fast"
- Can differentiate music vs spoken word

**Setup:**
1. Route external audio into Ableton
2. Enable Tempo Follower
3. Ableton auto-detects BPM
4. Send MIDI clock or use Link

---

## Tempo Sync Protocols

### Ableton Link (RECOMMENDED)
**Documentation:** https://ableton.github.io/link/
**License:** GPL (open source)

**What it is:**
- Network protocol for tempo/beat sync
- Works over local WiFi
- Anyone can change tempo, others follow
- Beat phase alignment

**Link-Enabled Software:**
| Software | Platform | Type |
|----------|----------|------|
| Ableton Live | Win/Mac | DAW |
| Traktor | Win/Mac | DJ |
| Serato DJ | Win/Mac | DJ |
| Reason | Win/Mac | DAW |
| Bitwig Studio | Win/Mac/Linux | DAW |
| VCV Rack | Win/Mac/Linux | Modular |
| Resolume | Win/Mac | VJ |
| TouchDesigner | Win/Mac | Visual |
| Mixxx | Win/Mac/Linux | DJ (free) |
| TidalCycles | All | Live coding |
| Strudel | Browser | Live coding (WIP) |

**Full list:** https://www.ableton.com/en/link/products/

### Node.js Link Library
**NPM:** https://www.npmjs.com/package/@ktamas77/abletonlink

```javascript
const AbletonLink = require('@ktamas77/abletonlink');

const link = new AbletonLink();
link.startUpdate(60, (beat, phase, bpm) => {
  console.log(`Beat: ${beat}, Phase: ${phase}, BPM: ${bpm}`);
  // Trigger Strudel pattern at beat
});
```

**Features:**
- Get/set BPM
- Get beat/phase
- Start/stop sync
- Peer discovery

---

### MIDI Clock
**What it is:**
- Industry standard for tempo sync
- 24 pulses per quarter note
- Supported by virtually all music hardware

**Limitations:**
- No beat position (just pulses)
- Drift over time
- One master, many slaves

**Best for:** Hardware synths, drum machines, external gear

---

### OSC (Open Sound Control)
**What it is:**
- Flexible message protocol
- Send any parameter over network
- Used by SuperCollider, Max, TouchOSC

**Example message:**
```
/strudel/bpm 128.5
/strudel/pattern/trigger 1
/strudel/pattern/stop 0
```

---

## DJ Software with MIDI/OSC Clock Output

### Mixxx (FREE - HIGHLY RECOMMENDED)
**Website:** https://mixxx.org/
**Repository:** https://github.com/mixxxdj/mixxx
**License:** GPL (open source)
**Platform:** Windows, macOS, Linux

**What it does:**
- Professional DJ software (free!)
- Auto BPM detection
- Ableton Link support
- MIDI clock output
- OSC output

**MIDI Clock Setup:**
1. Options → Preferences → Controllers
2. Select MIDI output port
3. Load "MIDI for light" script
4. BPM is sent every beat

**OSC Output:**
- Messages sent every 0.5 seconds
- Deck BPM, position, play state
- Can drive external visualizations

**Use case:** Free DJ software that can sync Strudel patterns to your DJ set.

---

### Traktor Pro
**Website:** https://www.native-instruments.com/en/products/traktor/
**Price:** ~$99

**Features:**
- MIDI clock output
- Ableton Link
- Control API

**Setup:**
1. Preferences → Controller Manager
2. Add generic MIDI mapping
3. Preferences → MIDI Clock → Send MIDI Clock

---

### Rekordbox / Serato
**Note:** Limited MIDI clock support

**Alternative:** Use **ProDJLink** (see below)

---

### ProDJLink
**Website:** https://www.prodjlink.com/
**Platform:** Windows, macOS

**What it does:**
- Communicates with Pioneer DJ setups
- Outputs: Ableton Link, MIDI Clock, Timecode
- Gets tempo directly from CDJs/mixers

**Use case:** Sync live coding to Pioneer DJ gear.

---

## Control Surfaces & OSC Controllers

### TouchOSC
**Website:** https://hexler.net/touchosc
**Platform:** iOS, Android, Mac, Windows
**Price:** ~$25

**What it does:**
- Turn phone/tablet into OSC/MIDI controller
- Custom layouts
- Send/receive OSC messages

**Example layout for Strudel control:**
- BPM display
- Pattern trigger buttons
- Effect parameter sliders
- Filter cutoff knob
- Transport controls

**SuperCollider integration:**
```supercollider
// Receive OSC from TouchOSC
OSCdef(\filter, { |msg|
  ~cutoff = msg[1];  // Use in synth
}, '/filter/cutoff');
```

---

### Open Stage Control
**Website:** https://openstagecontrol.ammd.net/
**Repository:** https://github.com/jean-emmanuel/open-stage-control
**License:** GPL (open source)
**Platform:** All

**What it does:**
- Web-based OSC/MIDI controller
- Create custom interfaces
- Free and open source

---

### Lemur
**Website:** https://liine.net/en/products/lemur/
**Platform:** iOS
**Price:** ~$25

**What it does:**
- Pro-level touch controller
- Physics-based widgets
- Complex scripting

---

## SuperCollider Control Software

### OpenObject (Quark)
**Repository:** https://github.com/supercollider-quarks/OpenObject

**What it does:**
- Control SuperCollider synths from external apps
- OSC interface
- Works with Max, Pure Data, Processing, openFrameworks

**Setup:**
```supercollider
// In SuperCollider
Quarks.install("OpenObject");
OpenObject.enable;
```

Then control from any OSC-capable software.

---

### CVCenter (Quark)
**Repository:** https://github.com/supercollider-quarks/CVCenter

**What it does:**
- GUI for connecting synths to MIDI/OSC
- Automatic mapping
- Save/recall presets

---

### supercollider.js (Node.js)
**Repository:** https://github.com/crucialfelix/supercolliderjs

**What it does:**
- Full SuperCollider control from JavaScript
- Start/stop server
- Send OSC messages
- Compile SynthDefs

**Example:**
```javascript
const sc = require('supercolliderjs');

sc.server.boot().then(async (server) => {
  // Load a SynthDef
  await server.synthDef('sine', `{ |freq=440, amp=0.1|
    Out.ar(0, SinOsc.ar(freq) * amp)
  }`);

  // Triggered by BPM detector!
  await server.synth('sine', { freq: 660 });
});
```

**Use case:** Build a Node.js app that detects BPM and triggers SuperCollider synths.

---

### SuperColliderMCP (2025)
**Repository:** https://github.com/Tok/SuperColliderMCP

**What it does:**
- Model Context Protocol server for SuperCollider
- AI-assisted control
- Python interface via OSC

---

## Max MSP & Pure Data Integration

### tidal-maxmsp
**Repository:** https://github.com/madskjeldgaard/tidal-maxmsp
**Blog:** https://blog.tidalcycles.org/how-to-connect-tidal-to-maxmsp/

**What it does:**
- Bridge TidalCycles patterns to Max MSP
- Receive pattern data via OSC
- Route to Max synths/effects

**Setup:**
1. Install Haskell module: `cabal install`
2. Open `tidal-maxmsp.maxproj`
3. In Tidal: `max1 <- maxmspStream "127.0.0.1" 8020 1`
4. Pattern data appears in Max

**Use case:** Use Max MSP's visual programming to process/augment Tidal patterns.

---

### Tidal4Live (Ableton Max4Live)
**Repository:** https://github.com/madskjeldgaard/tidal4live

**What it does:**
- Max4Live devices for TidalCycles
- Control Ableton instruments from Tidal
- MIDI effect + audio effect devices
- No SuperDirt needed!

**Use case:** Use Ableton's instruments directly from TidalCycles.

---

### Pure Data (Free alternative to Max)
**Website:** https://puredata.info/
**License:** Free

**What it does:**
- Visual programming for audio
- OSC support
- Cross-platform

---

## Virtual Audio Routing

### BlackHole (Mac - FREE)
**Website:** https://existential.audio/blackhole/
**Repository:** https://github.com/ExistentialAudio/BlackHole
**License:** GPL

**What it does:**
- Virtual audio cable for macOS
- Zero latency
- Route audio between apps
- Works on Apple Silicon

**Use case:** Route DJ software output to BPM analyzer input.

---

### VB-Cable (Windows - FREE)
**Website:** https://vb-audio.com/Cable/

**What it does:**
- Virtual audio cable for Windows
- Route audio between applications
- Supports 44.1-192 kHz

---

### Loopback (Mac - Premium)
**Website:** https://rogueamoeba.com/loopback/
**Price:** ~$99

**What it does:**
- Advanced audio routing for Mac
- Combine multiple sources
- Per-app routing

---

### JACK Audio Connection Kit (Cross-platform - FREE)
**Website:** https://jackaudio.org/
**License:** GPL

**What it does:**
- Professional audio routing
- Low latency
- Cross-platform
- Complex routing possible

---

## Visual/VJ Software with Beat Sync

### Resolume Arena/Avenue
**Website:** https://www.resolume.com/
**Platform:** Windows, macOS
**Price:** ~$299-399

**What it does:**
- VJ software
- Ableton Link support
- MIDI clock input
- OSC control

**BPM Sync Options:**
1. Tap tempo
2. MIDI clock from DJ software
3. Ableton Link
4. External BPM detector (Pulse → Link → Resolume)

---

### BPM-to-OSC
**Repository:** https://github.com/d00mfish/BPM-to-OSC

**What it does:**
- Detects BPM from audio input
- Sends OSC to Resolume/any VJ software
- Simple bridge tool

---

### Hydra (Integrated with Strudel)
**Website:** https://hydra.ojack.xyz/
**Repository:** https://github.com/hydra-synth/hydra

**What it does:**
- Live coding visuals
- Already integrated with Strudel!
- Audio reactive

**Example in Strudel:**
```javascript
// Audio drives visuals
s("bd sd").analyze().then(fft => {
  osc(10, 0.1, fft.bass).out()
})
```

---

### TouchDesigner
**Website:** https://derivative.ca/
**Platform:** Windows, macOS

**What it does:**
- Visual programming for visuals
- Ableton Link support
- OSC input/output
- Audio analysis

---

## MIDI Controller Bridges

### midi_strudel_dash
**Repository:** https://github.com/knectardev/midi_strudel_dash

**What it does:**
- Web-based MIDI controller UI
- Converts MIDI to Strudel code
- Real-time audio synthesis
- Beat detection
- Direct Strudel REPL integration

**Features:**
- MIDI device support
- Intelligent beat detection
- Visual feedback
- Live coding workflow

**Use case:** Physical MIDI controller → Strudel patterns

---

### Strudel Native MIDI
**Documentation:** https://strudel.cc/learn/input-output/

**Features:**
- WebMIDI support (no external software needed)
- MIDI CC input for parameter control
- MIDI clock output for external sync
- Program change messages

**Example:**
```javascript
// Receive CC from controller
$: n("0 2 4 7").s("sawtooth")
  .lpf(cc(74).range(200, 8000))  // CC74 controls filter
  .midi()  // Output to MIDI device
```

**MIDI Clock Output (Desktop app):**
- Sync DAWs/hardware to Strudel tempo
- Pattern params controlled by CC

---

## Audio Analysis & Visualization

### audioMotion-analyzer
**Website:** https://audiomotion.dev/
**Repository:** https://github.com/hvianna/audioMotion-analyzer
**License:** MIT

**What it does:**
- Real-time spectrum analyzer
- No dependencies
- Supports 240 frequency bands
- Linear, logarithmic, Bark, Mel scales

**Use case:** Visualize what Strudel is playing, or analyze input audio.

---

### Web Audio API (Native)
**Documentation:** https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API

**Built-in features:**
- FFT analysis via `AnalyserNode`
- Frequency data
- Time domain data
- Perfect for custom visualizations

**Example:**
```javascript
const analyser = audioContext.createAnalyser();
analyser.fftSize = 2048;
const dataArray = new Uint8Array(analyser.frequencyBinCount);

function visualize() {
  analyser.getByteFrequencyData(dataArray);
  // Draw spectrum...
  requestAnimationFrame(visualize);
}
```

---

### Spectrogram Libraries
- **lvillasen/Spectrogram** - https://github.com/lvillasen/Spectrogram
- **WebAudioSpectrum** - https://github.com/deftio/WebAudioSpectrum

---

## Strudel Native Integrations

### OSC Output
**Documentation:** https://github.com/tidalcycles/strudel/tree/main/packages/osc

**What it does:**
- Sends each event as OSC message
- Works with SuperCollider/SuperDirt
- Works with any OSC-enabled software

**Setup (local REPL):**
```
Ports:
- 57120 (client)
- 57121 (server)
- 8080 (websocket)
```

---

### Ableton Link (Work in Progress)
**Pull Request:** https://codeberg.org/uzu/strudel/pulls/719

**Status:**
- Integration in development
- Works with Ableton in tests
- Some phase sync issues being resolved

**When complete:** Strudel will sync directly with any Link-enabled app.

---

### MIDI Output
**Documentation:** https://strudel.cc/learn/input-output/

**Built-in support for:**
- Note output
- CC output
- Program changes
- Clock output (desktop app)
- Channel routing
- MIDI maps for hardware

---

## Complete Integration Architecture

### Scenario 1: Sync Strudel to DJ Set

```
┌─────────────────────────────────────────────────────────────┐
│                      DJ SETUP                               │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   ┌─────────────┐     ┌─────────────┐     ┌─────────────┐  │
│   │   DJ Mixer  │────▶│   Mixxx     │────▶│Ableton Link │  │
│   │ (audio out) │     │ (BPM detect)│     │ (tempo sync)│  │
│   └─────────────┘     └─────────────┘     └──────┬──────┘  │
│                                                   │         │
│   OR: Pulse (BPM detector) ──────────────────────┘         │
│                                                             │
│                           │                                 │
│                           ▼                                 │
│   ┌─────────────────────────────────────────────────────┐  │
│   │                    STRUDEL                           │  │
│   │                                                      │  │
│   │   • Receives tempo via Link                         │  │
│   │   • Patterns automatically sync to DJ set           │  │
│   │   • Add live coded elements over DJ tracks          │  │
│   └─────────────────────────────────────────────────────┘  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Scenario 2: Control Strudel with MIDI Controller

```
┌─────────────────────────────────────────────────────────────┐
│                   MIDI CONTROL SETUP                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   ┌─────────────┐                                          │
│   │MIDI Controller│                                        │
│   │ (APC, Launchpad)│                                      │
│   └───────┬─────┘                                          │
│           │ USB MIDI                                        │
│           ▼                                                 │
│   ┌─────────────────────────────────────────────────────┐  │
│   │                    STRUDEL                           │  │
│   │                                                      │  │
│   │   // Knob controls filter                           │  │
│   │   $: s("bd sd").lpf(cc(74).range(200, 4000))       │  │
│   │                                                      │  │
│   │   // Button triggers pattern                        │  │
│   │   $: s("hh*8").gain(ccOn(1) ? 1 : 0)               │  │
│   │                                                      │  │
│   └─────────────────────────────────────────────────────┘  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Scenario 3: Full Integration (BPM + Control + Visuals)

```
┌─────────────────────────────────────────────────────────────────────┐
│                     FULL LIVE PERFORMANCE SETUP                      │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│   AUDIO INPUT                    TEMPO SYNC                          │
│   ┌─────────────┐               ┌─────────────┐                     │
│   │ DJ Mixer /  │──audio in───▶│   Pulse     │                     │
│   │ Turntable   │               │(BPM detect) │                     │
│   └─────────────┘               └──────┬──────┘                     │
│                                        │ Ableton Link                │
│                                        ▼                             │
│   ┌─────────────┐               ┌─────────────┐     ┌─────────────┐ │
│   │    Max MSP  │◀───OSC────────│   STRUDEL   │────▶│  Resolume   │ │
│   │ (processing)│               │  (patterns) │Link │  (visuals)  │ │
│   └─────────────┘               └──────┬──────┘     └─────────────┘ │
│                                        │                             │
│                                        │ OSC                         │
│                                        ▼                             │
│   ┌─────────────┐               ┌─────────────┐                     │
│   │  TouchOSC   │───OSC────────▶│ SuperCollider│                    │
│   │ (iPad ctrl) │               │  (synths)    │                    │
│   └─────────────┘               └─────────────┘                     │
│                                                                      │
│   MIDI CONTROLLER                                                    │
│   ┌─────────────┐                                                   │
│   │ Launchpad   │───USB MIDI───▶ Strudel pattern control           │
│   └─────────────┘                                                   │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Use Case Workflows

### Workflow 1: "Detect BPM from Spotify and Launch Patterns"

**Components:**
1. **BlackHole/VB-Cable** - Route system audio
2. **realtime-bpm-analyzer** - JavaScript BPM detection
3. **Strudel** - Pattern engine

**Implementation:**
```javascript
// In Beatweaver
import { RealTimeBPMAnalyzer } from 'realtime-bpm-analyzer';

const analyzer = new RealTimeBPMAnalyzer();

// Listen to system audio (via virtual cable)
navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
  const source = audioContext.createMediaStreamSource(stream);

  analyzer.analyze(source, (result) => {
    const bpm = result.tempo;

    // Set Strudel tempo
    strudelInstance.setCps(bpm / 60 / 4);  // Convert BPM to CPS

    // Trigger pattern
    strudelInstance.evaluate(`
      setcps(${bpm / 60 / 4})
      d1 $ s "bd sd hh hh"
    `);
  });
});
```

---

### Workflow 2: "MIDI Controller for Live Coding"

**Components:**
1. **MIDI Controller** (APC40, Launchpad, etc.)
2. **Strudel** with WebMIDI

**Strudel Code:**
```javascript
// Map knobs to effects
$: s("supersaw").note("c3 eb3 g3 bb3")
  .lpf(cc(21).range(200, 8000))      // Knob 1 = filter
  .room(cc(22).range(0, 1))          // Knob 2 = reverb
  .gain(cc(23).range(0, 1))          // Knob 3 = volume
  .delay(cc(24).range(0, 0.5))       // Knob 4 = delay

// Pad triggers patterns
$: ccTrigger(36) ? s("bd*4") : silence
$: ccTrigger(37) ? s("sd sd") : silence
$: ccTrigger(38) ? s("hh*8") : silence
```

---

### Workflow 3: "Visual Sync with Resolume"

**Components:**
1. **Strudel** - Audio patterns
2. **Ableton Link** - Tempo sync
3. **Resolume** - Visuals

**Setup:**
1. Enable Link in Strudel (when available) or use MIDI clock
2. Enable Link in Resolume
3. Both apps share tempo and beat position
4. Visual clips trigger on beat

---

## Summary: Software by Purpose

### BPM Detection
| Software | Type | Output | Price |
|----------|------|--------|-------|
| **Pulse** | Desktop app | Ableton Link | $29 |
| **realtime-bpm-analyzer** | JS library | Custom | Free |
| **web-audio-beat-detector** | JS library | Custom | Free |
| **Ableton Live** | DAW | Link/MIDI | $99+ |
| **Mixxx** | DJ software | Link/MIDI/OSC | Free |

### Tempo Sync
| Protocol | Latency | Beat Position | Ecosystem |
|----------|---------|---------------|-----------|
| **Ableton Link** | Low | Yes | Wide |
| **MIDI Clock** | Low | No | Universal |
| **OSC custom** | Variable | Yes | DIY |

### Control Surfaces
| Software | Platform | Price |
|----------|----------|-------|
| **TouchOSC** | iOS/Android/Desktop | $25 |
| **Open Stage Control** | All | Free |
| **Lemur** | iOS | $25 |

### Audio Routing
| Software | Platform | Price |
|----------|----------|-------|
| **BlackHole** | macOS | Free |
| **VB-Cable** | Windows | Free |
| **Loopback** | macOS | $99 |
| **JACK** | All | Free |

### SuperCollider Control
| Software | Type | Price |
|----------|------|-------|
| **OpenObject** | SC Quark | Free |
| **CVCenter** | SC Quark | Free |
| **supercollider.js** | Node.js | Free |
| **TouchOSC** | Mobile app | $25 |

---

## References

- Pulse by Hybrid Constructs: https://hybridconstructs.com/pulse/
- Ableton Link: https://ableton.github.io/link/
- Mixxx: https://mixxx.org/
- Strudel MIDI/OSC: https://strudel.cc/learn/input-output/
- TouchOSC: https://hexler.net/touchosc
- BlackHole: https://existential.audio/blackhole/
- supercollider.js: https://github.com/crucialfelix/supercolliderjs
- realtime-bpm-analyzer: https://github.com/dlepaux/realtime-bpm-analyzer
- tidal-maxmsp: https://github.com/madskjeldgaard/tidal-maxmsp

---

*Document generated for Beatweaver project - January 2026*
