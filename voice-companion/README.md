# Beatweaver Voice Companion

Offline neural TTS companion that auto-sizes itself to the host hardware.

For users who don't run a Kobold/LLM server, this provides a higher-quality
preset-cue voice than the OS SpeechSynthesis fallback — without any setup or
external account. Spawned as a child process by the main Beatweaver
Electron app when the user picks **TTS Mode → Companion (offline neural)**.

See [`docs/VOICE_COMPANION.md`](../docs/VOICE_COMPANION.md) for the design.

## Architecture

```
Beatweaver renderer  ──HTTP──►  Voice Companion (this dir)
                                    │
                                    ├─ hardware-detect.js  → pick model tier
                                    ├─ piper-binary.js     → release-asset URLs
                                    ├─ model-download.js   → fetch ONNX + sidecar
                                    ├─ port-bind.js        → 17321..17325 fallback
                                    └─ server.js           → /health /tts endpoints
```

## Endpoints

| Method | Path             | Behaviour                                      |
|--------|------------------|------------------------------------------------|
| `GET`  | `/health`        | `{ ok, phase, ready }` — used by Announcer.js  |
| `GET`  | `/setup-status`  | `{ phase, message, progress }` for setup UI    |
| `POST` | `/tts`           | Body `{ text }` → audio/wav (16-bit 22050 Hz)  |

## Standalone run

```bash
cd voice-companion
node src/server.js
```

Drops `~/.beatweaver/voice/` containing `config.json` (chosen voice + hardware
snapshot) and `voices/<voice-id>/{stem}.onnx{,.json}`. Piper binary must be
in `~/.beatweaver/voice/bin/piper{,.exe}` until auto-install lands.

## Dev notes

- Pure ESM (`"type": "module"`), no bundler required.
- No deps — uses Node 18+ built-in `fetch` and `http`.
- All log lines prefixed with `[voice-companion]` so Electron main can grep.
- Logic is intentionally split into tiny modules so the unit tests can pin
  each independently (`tests/integration/voice-companion-*.test.js`).
