# Voice Companion — Design Spec

> A bundled offline TTS service so users without a Kobold/LLM server still get
> spoken preset cues. Auto-sized to the host hardware: small model on a laptop,
> bigger model on a workstation.

## Problem

Beatweaver's announcer has three tiers today:

1. **Kobold API** — local LLM server, neural voice (Kokoro). Best quality, but
   only available to users running their own LLM stack.
2. **Electron SAPI** — Windows-only, robotic voice, latency stable.
3. **Browser SpeechSynthesis** — last-resort, voice quality varies wildly by
   OS and locale.

If you're a casual DJ on macOS/Linux without an LLM server, you're stuck on
SpeechSynthesis — which on some systems sounds genuinely bad. The cue line is
load-bearing UX (it tells you *which* preset you just armed before fire),
so cheap-sounding TTS undermines the feature.

## Goal

A **fully bundled, offline, neural** TTS option that ships with Beatweaver and
works without any external server, model setup, or user expertise. The user
picks "Companion" in the TTS-mode selector and it just works.

## Engine: Piper TTS

[Piper](https://github.com/rhasspy/piper) is the right pick:

- **Offline neural** — ONNX-based, runs on CPU, no internet at runtime
- **Small footprint** — binary ~10 MB, models 20–80 MB depending on quality
- **Multiple voice qualities** — `low`, `medium`, `high` per locale
- **Fast on CPU** — ~3× realtime on a 2020-era laptop with `medium` quality
- **MIT licensed** — bundleable without legal friction
- **Cross-platform** — prebuilt binaries for Win/macOS/Linux

Voice candidates (English, female, expressive):

| Voice                  | Quality | Model size | RAM hint |
|------------------------|---------|------------|----------|
| `en_US-amy-low`        | low     | ~20 MB     | <4 GB    |
| `en_US-amy-medium`     | medium  | ~60 MB     | 4–8 GB   |
| `en_US-libritts-high`  | high    | ~110 MB    | >8 GB    |

`amy-medium` is the default sweet spot — good intelligibility, snappy enough
for live DJ feedback, fits comfortably on any modern machine.

## Architecture

```
┌─────────────────────────────┐    HTTP     ┌──────────────────────────┐
│  Beatweaver renderer        │ ──────────► │  Voice Companion         │
│  (Announcer.js, "companion" │   POST /tts │  (Node child process)    │
│   mode)                     │ ◄────────── │  - Piper binary          │
└─────────────────────────────┘    WAV blob │  - ONNX model            │
                                            │  - HTTP server :17321    │
                                            └──────────────────────────┘
                                                        │
                                                        ▼
                                              ~/.beatweaver/voice/
                                              ├── piper.exe
                                              ├── voices/
                                              │   └── en_US-amy-medium.onnx
                                              └── config.json
```

The companion is a **child process** spawned by Electron `main.js`. It:

1. On first launch — runs hardware detection, downloads matching Piper model,
   writes `config.json` with chosen voice + checksum.
2. On every launch — starts an HTTP server on `127.0.0.1:17321`.
3. Accepts `POST /tts` `{text}` → returns WAV bytes.
4. Provides `GET /health` for the renderer to detect availability.

Port `17321` chosen to avoid collisions: Voodoomancer uses 8190/8191, common
dev servers use 3000/5173/8080, this is well clear of all of them and isn't
in any well-known port registry.

## Hardware detection heuristic

Run once at first launch, written to `~/.beatweaver/voice/config.json`:

```js
function pickModelTier({ totalRamGB, cpuCount }) {
  // High tier: 16+ GB RAM AND 8+ logical cores
  if (totalRamGB >= 16 && cpuCount >= 8) return 'high';
  // Medium: 6+ GB RAM AND 4+ logical cores  (covers most laptops)
  if (totalRamGB >= 6 && cpuCount >= 4) return 'medium';
  // Otherwise low tier — still neural, still way better than SpeechSynthesis
  return 'low';
}
```

GPU detection is **deliberately skipped** — Piper's CPU path is fast enough
that adding GPU complexity (CUDA versioning, ROCm, no Apple Silicon support)
is net-negative for first release.

User can override via `~/.beatweaver/voice/config.json` `voice` field.

## Model download

First launch triggers a one-time download:

1. Construct URL from Piper's HuggingFace mirror:
   `https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/<voice>/<quality>/<file>.onnx`
2. Download with progress callback → main.js relays to renderer for a "Setting
   up voice…" UI.
3. Verify size + (if available) `<file>.onnx.json` config.
4. Atomic move into `voices/` (download to `.partial`, rename on success).
5. On failure (no network, corrupted download) — fall back to next-smaller
   tier; if all tiers fail, mark companion `unavailable` and log clearly so
   the renderer can fall back to Browser SpeechSynthesis cleanly.

## Renderer integration

Announcer gets a 4th TTS mode `'companion'` — already opt-in, slotted next to
`browser` and `kobold`:

```js
// Announcer.js
this.companionUrl = 'http://127.0.0.1:17321';
this.companionAvailable = null; // tested at init

async _speakCompanion(text) {
  const response = await fetch(`${this.companionUrl}/tts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  if (!response.ok) throw new Error(`Companion TTS ${response.status}`);
  const blob = await response.blob();
  await this._playAudio(blob);
}
```

Mode-selection UI gets a third option: **"Companion (offline neural)"**. The
user opts in — no auto-switching, consistent with the existing
"USER CHOOSES, no auto-detection bullshit" rule in Announcer.js.

## Bundling strategy

Two viable paths; we'll pick (A) for v1:

**(A) Bundled child process (chosen).** Companion lives in
`voice-companion/` inside beatweaver's repo. `electron-builder` ships its
files via `extraResources`. `main.js` spawns it as a Node child process at
startup if the user has selected Companion mode. **No separate installer**,
no second exe in the user's start menu, no IPC surprises. Piper binary +
model are downloaded into `app.getPath('userData')/voice/` on first use, so
they're not baked into the installer (keeps the installer small).

**(B) Standalone exe (deferred).** Compile companion with `pkg` or
`@yao-pkg/pkg` into a separate `.exe`/binary. Useful if we later want the
companion to outlive Beatweaver (e.g. always-on tray app). Adds installer
complexity without a clear v1 user benefit.

## Failure modes

| Failure                            | Behaviour                              |
|------------------------------------|----------------------------------------|
| No network on first launch         | Show error, fall back to Browser TTS   |
| Model download corrupted           | Retry once, then drop to lower tier    |
| Piper binary crashes               | Renderer marks `companionAvailable=false`, falls back |
| Port 17321 in use                  | Try 17322, 17323; on full bust, error  |
| User has < 1 GB free disk          | Skip download, fall back to Browser    |

All failures logged with `[voice-companion]` prefix so they're greppable.

## What we are NOT doing in v1

- GPU acceleration (Piper's CPU path is enough)
- Voice cloning / custom voice training
- Multilingual auto-detect (English-only first, additional locales come later)
- Real-time streaming TTS (round-trip per cue is fine — cues are 2–6 words)
- Automatic update of model weights (manual: delete `voices/` to refresh)

## Test plan

- Unit: hardware-detect math, port-fallback logic, model-URL construction
- Integration: spawn companion, hit `/health`, verify WAV bytes returned for
  short input, kill cleanly
- Manual: full first-launch on a fresh user-data dir, end-to-end voice cue
  through speakers (this is in `tests/manual/LISTENING_TESTS.md`)

## Roadmap after v1

- Multilingual: French, Spanish, German voices (Piper supports all three)
- Optional GPU offload for `high` tier on systems with CUDA available
- Streaming TTS for longer announcements (mass-fire patter, etc.)
- Voice picker in Settings — let users pick non-default Piper voice
