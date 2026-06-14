# BeatWeaver — Manual Listening Tests

A checklist a DJ runs before a gig to verify everything still sounds right after a build / update / new install. Each item is a 30-second check; the full pass takes ~15 minutes.

> Why this exists: BeatWeaver's automated tests pin the *behaviour* of the audio engine (BPM math, key correlation, MIDI dispatch) but they can't pin *whether the sound is good*. The audio chain is full of judgement calls — compressor knee, reverb pre-delay, modulator wet, master gain headroom — that have to be re-verified by ear after a refactor. This is the "did it still sound right?" pass.

Run these in order. Stop at the first failure + report it.

## 0 · Pre-flight

| # | Check | Pass |
|---|-------|------|
| 0.1 | App launches without console errors (DevTools open, no red) | ☐ |
| 0.2 | Audio device dropdown lists at least one input + one output | ☐ |
| 0.3 | "Initialize Audio" button works on first click (no second-click required) | ☐ |
| 0.4 | LCXL connects + the four category-row top buttons light up amber when armed (Bass / Energy / Texture / FX) | ☐ |
| 0.5 | TTS announcer speaks "BeatWeaver" on logo click | ☐ |

## 1 · Detection accuracy (live mix in)

Feed in a known-tempo, known-key DJ mix on the configured input device. Recommended: 30 seconds of a SD/HD electronic track at 124 BPM in F minor (the de-facto DJ-tool reference).

| # | Check | Pass |
|---|-------|------|
| 1.1 | BPM lock happens within ~10 seconds of audio starting | ☐ |
| 1.2 | Locked BPM is within ±1 of the actual track tempo | ☐ |
| 1.3 | Key lock happens within ~15 seconds of audio starting | ☐ |
| 1.4 | Locked key matches the actual track key (or its relative major/minor — same Camelot wheel slot) | ☐ |
| 1.5 | The pre-lock BPM readout is *stable* (small jitter, not bouncing ±5) — this is the rolling-median fix | ☐ |
| 1.6 | TTS speaks the detected key after lock (e.g. "The key is F minor") | ☐ |

## 2 · BPM lock under stress

Feed in tracks that historically tripped the detector pre-fix.

| # | Check | Pass |
|---|-------|------|
| 2.1 | Drum-and-bass at 175 BPM: locks within 15s, doesn't halve to 87 | ☐ |
| 2.2 | Trap with snare-heavy off-beats: locks on kick, not snare (kick-band pre-emphasis fix) | ☐ |
| 2.3 | Ambient pad-led intro (no kick for first 8 bars): no false-positive lock; waits for the drop | ☐ |
| 2.4 | DJ scratch / juggling section: brief unlock during scratch, re-locks after | ☐ |
| 2.5 | Tempo ramp (DJ pitch-rides 120→128 over 30s): tracks the change, doesn't get stuck | ☐ |

## 3 · Synth quality — single instrument

Lock to 120 BPM, F minor. Trigger one preset at a time + listen on headphones.

| # | Check | Pass |
|---|-------|------|
| 3.1 | **BASS A1 — Acid Bass.** Squelchy 303-style sweep, no audible clicks at preset launch / stop | ☐ |
| 3.2 | **BASS A2 — Sub Bass.** Clean sub-low; no aliasing on slow attack | ☐ |
| 3.3 | **ENERGY A1 — Stab.** Sharp punchy chord; no stuck notes after release | ☐ |
| 3.4 | **TEXTURE A1 — Pad.** Long sustain, smooth release; no voice-stealing pop | ☐ |
| 3.5 | **TEXTURE A2 — Arp.** Notes arpeggiate at correct rate; phase-stable across loops | ☐ |
| 3.6 | **FX A1 — Risers / sweeps.** Smooth tail, no clipping | ☐ |

## 4 · Synth quality — parallel instruments (the compressor test)

Trigger multiple presets simultaneously to stress the master glue compressor.

| # | Check | Pass |
|---|-------|------|
| 4.1 | All 4 BASS presets at once: no visible pumping (was visible pre-fix at 6:1 ratio) | ☐ |
| 4.2 | All 4 categories at once (bass + energy + texture + fx): the mix breathes, doesn't squish | ☐ |
| 4.3 | Master output peaks at -1 dB (limiter ceiling) under heavy load — no clipping | ☐ |
| 4.4 | Stop all (Space): no audible "click" or sudden silence drop — graceful release tail | ☐ |

## 5 · Reverb space

Trigger a TEXTURE pad preset solo + listen for the reverb tail.

| # | Check | Pass |
|---|-------|------|
| 5.1 | Reverb has perceived "space" — the sound is clearly placed in a room, not stacked on top of itself (50ms pre-delay fix) | ☐ |
| 5.2 | Decay time feels right (~2.5s for a pad, audibly tails out by 4 seconds) | ☐ |
| 5.3 | No metallic resonance / ringing artefacts | ☐ |

## 6 · Modulators (per-column FX)

Pick a preset that has a modulator slot. Rock the modulator-type knob across positions while the preset is playing.

| # | Check | Pass |
|---|-------|------|
| 6.1 | Switching Chorus → Phaser → Tremolo → Chorus is **glitch-free** — no audible pop, no audio dropout (modulator pool fix) | ☐ |
| 6.2 | Wet knob ramps smoothly from 0 → 100% — no zipper noise | ☐ |
| 6.3 | At wet=0 the modulator is fully transparent (compare to "no modulator" position) | ☐ |
| 6.4 | LFO phase resumes from where it was when you switch back to a previous modulator (pool stays warm) | ☐ |

## 7 · MIDI controller (Novation Launch Control XL)

Plug in / unplug the LCXL during use.

| # | Check | Pass |
|---|-------|------|
| 7.1 | LCXL appears in the MIDI status indicator within 1s of plugging in | ☐ |
| 7.2 | Top-row pads fire presets with the correct LED feedback (active = colour, idle = off) | ☐ |
| 7.3 | Faders 1–4 control column volume in real time (no MIDI lag) | ☐ |
| 7.4 | Side buttons UP/DOWN switch banks (LED state on the pads updates immediately) | ☐ |
| 7.5 | Side button LEFT toggles TTS (you hear "TTS off" / "TTS on" feedback) | ☐ |
| 7.6 | VU meter on Row C knobs 4–7: green for moderate signal, red on peaks. No frantic flicker on a steady level (LED change-detection fix) | ☐ |
| 7.7 | Hot-unplug LCXL mid-session: app keeps running, doesn't crash; on re-plug, controller reconnects | ☐ |

## 8 · Settings persistence

Change every persisted setting then close + relaunch.

| # | Check | Pass |
|---|-------|------|
| 8.1 | Master volume restored | ☐ |
| 8.2 | TTS voice + pitch + rate restored | ☐ |
| 8.3 | Audio input device selection restored | ☐ |
| 8.4 | Modulator type per column restored | ☐ |
| 8.5 | Bank selection restored | ☐ |

## 9 · Performance under sustained load

Lock BPM. Trigger 4 presets simultaneously. Leave running for 5 minutes.

| # | Check | Pass |
|---|-------|------|
| 9.1 | No memory growth (DevTools Memory tab — heap stays within ±5 MB of baseline) | ☐ |
| 9.2 | No CPU growth (Task Manager — stays within ±3% of baseline) | ☐ |
| 9.3 | UI stays at 60 fps when the modulator-type knob is being rocked continuously | ☐ |
| 9.4 | No audio glitches / pops / dropouts over the full 5 minutes | ☐ |

## 10 · Stress / edge cases

| # | Check | Pass |
|---|-------|------|
| 10.1 | Click "Stop all" while every preset is playing — clean release, no truncation pop | ☐ |
| 10.2 | Trigger a preset before audio is initialized — graceful no-op + UI doesn't lock up | ☐ |
| 10.3 | Maximize / restore window during playback — no audio dropout | ☐ |
| 10.4 | Sleep + wake the laptop with BeatWeaver running — audio resumes within 3s of wake | ☐ |
| 10.5 | Rapid-fire ANY preset 20 times in 5 seconds — debounce holds, no voice-stacking explosion | ☐ |

---

## Sign-off

| Field | Value |
|-------|-------|
| Build version | |
| Date tested | |
| Tester | |
| Hardware | |
| Audio interface | |
| OS / version | |
| Pass count | / 50 |
| Fails (numbers + notes) | |

If every item passes — ship it. If anything fails, file it as a GitHub issue with the test number + your hardware + a short description of what you heard.
