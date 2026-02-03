# BEATWEAVER - CLAUDE DEVELOPMENT GUIDELINES

## Project Overview

**Beatweaver** is a DJ tool for users with NO musical theory knowledge.
- **Input:** Audio from DJ mixer (for BPM detection ONLY)
- **Output:** Generated sequences ONLY (not input audio)
- **Control:** Novation Launch Control XL + on-screen UI
- **Stack:** Electron + Tone.js + React + Tailwind

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

## TECHNOLOGY STACK

| Component | Technology | Reason |
|-----------|------------|--------|
| App Type | Electron | Desktop app with native audio access |
| Audio Engine | Tone.js | Mature, documented, DJ-friendly |
| BPM Detection | realtime-bpm-analyzer | Browser-native, no dependencies |
| MIDI | WebMIDI API | Direct controller access |
| TTS | Kobold API (HTTP) | User's existing infrastructure |
| UI Framework | React + Tailwind | Fast iteration |

---

## AUDIO ROUTING (CRITICAL)

```
DJ Mixer Output ──┬──► Main PA System (unchanged)
                  │
                  └──► Beatweaver Input (analysis only, NOT audible)

Beatweaver Output ──► Separate channel on DJ Mixer
```

**Why:**
1. No latency added to DJ's music
2. DJ controls their own mix levels
3. Beatweaver only adds sequences on top
4. If Beatweaver crashes, DJ's music continues

---

## FILE STRUCTURE

```
beatweaver/
├── package.json
├── CLAUDE.md                 # This file
├── electron/
│   ├── main.js               # Electron main process
│   └── preload.js            # Bridge to renderer
├── src/
│   ├── index.html
│   ├── app.js                # Main application
│   ├── audio/
│   │   ├── analyzer.js       # BPM detection
│   │   └── synth-engine.js   # Tone.js instruments
│   ├── presets/
│   │   ├── index.js          # Preset definitions
│   │   ├── bass.js           # Bass presets
│   │   ├── energy.js         # Build-up presets
│   │   └── atmosphere.js     # Pad presets
│   ├── midi/
│   │   └── launch-control.js # Controller mapping
│   ├── tts/
│   │   └── announcer.js      # Kobold integration
│   ├── ui/
│   │   ├── components/       # React components
│   │   └── styles/           # Tailwind CSS
│   └── config/
│       └── settings.json     # User preferences
└── _dev_tools/
    ├── SESSION_HANDOFF.md    # Session continuity
    ├── PROBLEMS_LEARNED.md   # Error log
    ├── IDEAS_CAPTURED.md     # Future improvements
    └── preparation_work/     # Research docs
```

---

## IMPLEMENTATION PHASES

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

## NOVATION LAUNCH CONTROL XL MAPPING

```
KNOBS (Top Row) - GLOBAL CONTROLS
[1] Master Volume  [2] Reverb/Space  [3] Delay/Echo  [4] Filter  [5-8] Unused/BPM

KNOBS (Middle Row) - PRESET-SPECIFIC CONTROL 1
[1-6] Param1 per preset  [7-8] Global Ctrl

KNOBS (Bottom Row) - PRESET-SPECIFIC CONTROL 2
[1-6] Param2 per preset  [7-8] Global Ctrl

FADERS - INTENSITY/VOLUME PER PRESET
[1-6] Preset Power  [7-8] Master Mix

BUTTONS (Top Row) - LAUNCH PRESET
BUTTONS (Bottom Row) - STOP PRESET

SIDE BUTTONS
[▲] Bank Up  [▼] Bank Down  [◄] Announce ON/OFF  [►] BPM Lock Override
```

---

## DEVELOPMENT PROTOCOLS

### Before Starting Work
1. Read `_dev_tools/SESSION_HANDOFF.md`
2. Check `_dev_tools/PROBLEMS_LEARNED.md`
3. Verify current phase and tasks

### During Development
- Test each component before integration
- User-friendly labels everywhere
- No musical theory terms exposed to user

### After Errors
1. Log to `_dev_tools/PROBLEMS_LEARNED.md`
2. Include: context, error, solution, prevention

### Session End
- Update `_dev_tools/SESSION_HANDOFF.md`
- Note current task status
- List any blockers

---

## KEY DESIGN DECISIONS

| Decision | Reason |
|----------|--------|
| Electron over web | Native audio device access, no browser restrictions |
| Tone.js over raw Web Audio | Abstracts complexity, better timing |
| Preset-based over code-based | DJ-friendly, no typing required |
| Confidence lock for BPM | Prevents false triggers |
| Separate audio routing | No latency, crash isolation |

---

## WHEN IN DOUBT

- Ask the user
- Show interpretation before building
- Test with real audio
- Iterate until approved

---

*Beatweaver Development Guidelines - January 2026*
