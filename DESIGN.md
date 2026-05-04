# Beatweaver Design System

This document is the visual contract for the Beatweaver app. Two palettes
coexist in the codebase:

| Palette | Where it lives | When it's active |
|---|---|---|
| **Pioneer DJ Pro** | `tailwind.config.js`, `--color-*` in `src/styles/index.css` | Shipping default (always) |
| **2026-04-30 design handoff** | `--hf-*` reference vars in `src/styles/index.css`; full source in `_dev_docs/design_handoff_beatweaver/Beatweaver.html` | Reference for the [issue #3](https://github.com/laboratoiresonore/beatweaver/issues/3) UI rebuild — opt in by adding `class="theme-handoff"` on `<body>` |

The Pioneer palette is the ship-quality theme inspired by the CDJ-3000 /
DJM-V10 / rekordbox 7 hardware and software. The handoff palette is the
hi-fi mockup the live AI DJ console rebuild targets — it is *not* a
replacement for the Pioneer theme until the rebuild lands.

## Brand mark

| Asset | Path | Use |
|---|---|---|
| Vector source | `build/icon.svg` | Edit this; everything else is generated |
| Favicon | `public/favicon.svg` | 64×64 — wired in `index.html` |
| Wordmark | `public/wordmark.svg` | Splash, README header, social cards (animated SVG) |
| App icon (raster) | `build/icon.png` | electron-builder Mac/Linux input |
| Windows icon | `build/icon.ico` | electron-builder Windows input (multi-size) |

Regenerate via:

```bash
npm run icon:svg     # Re-emit build/icon.svg from scripts/generate-icon.js
npm run icon:build   # SVG → PNG → ICO (requires Pillow; cairosvg optional for PNG re-rasterize)
```

## Pioneer DJ Pro palette (live)

```css
--color-bg:             #08080c;   /* rekordbox app background */
--color-surface:        #121218;   /* panel surface */
--color-surface-raised: #1a1a22;   /* tile / button surface */
--color-border:         #1e1e28;   /* thin divider */
--color-border-strong:  #2a2a32;   /* heavy divider */
--color-accent:         #50B4FF;   /* rekordbox 7 sky blue (interaction) */
--color-accent-deep:    #305AFF;   /* Pioneer deep blue (state lock) */
--color-warning:        #FFA600;   /* Pioneer amber (analyzing) */
--color-error:          #E62828;   /* Pioneer red (clip / stop) */
--color-text:           #e0e0e8;
--color-text-secondary: #9e9ea8;

/* VU meter zones */
--meter-green:  #00C853;
--meter-amber:  #FFB300;
--meter-orange: #FF6D00;
--meter-red:    #FF1744;

/* Per-category hues — drive the 4-column grid */
--cat-bass:    #10B176;   /* mint/teal */
--cat-energy:  #E0641B;   /* burnt amber */
--cat-texture: #B432FF;   /* violet */
--cat-fx:      #FF127B;   /* magenta-pink */
```

Fonts: `JetBrains Mono` (display, BPM, key, numerics), `Inter` (body).

## Design-handoff palette (reference)

Defined as `--hf-*` so components ported from
`_dev_docs/design_handoff_beatweaver/` can reference them directly.

```css
--hf-bg:           #06070A;
--hf-bg-2:         #0A0B10;
--hf-surface:      #0E1015;
--hf-surface-2:    #14161D;
--hf-hair:         #1B1E27;
--hf-hair-strong:  #262A36;
--hf-text:         #E6E8EE;
--hf-text-2:       #9097A6;
--hf-muted:        #535A6B;

/* Semantic — OKLCH for perceptual uniformity, wider gamut */
--hf-accent:  oklch(0.74 0.16 240);
--hf-warn:    oklch(0.78 0.15 75);
--hf-ok:      oklch(0.78 0.16 155);
--hf-danger:  oklch(0.66 0.20 24);

--hf-bass:    oklch(0.72 0.14 160);
--hf-energy:  oklch(0.74 0.15 60);
--hf-texture: oklch(0.68 0.18 305);
--hf-fx:      oklch(0.72 0.20 355);
```

Fonts: `Space Grotesk` (body, BPM digits), `JetBrains Mono` (labels,
wordmark, numerics). Both are loaded in `index.html`.

Geometry tokens: `--hf-radius-panel: 10px`, `--hf-radius-cell: 6px`,
`--hf-radius-pill: 999px`.

## Animation timings (handoff)

| Element | Period | Easing |
|---|---|---|
| Wordmark breathing | ~10s | ease-in-out |
| Glyph drift (per-letter shimmer) | ~3s | ease-in-out |
| Armed-cell glow | 1.4s | ease-in-out |
| FIRE halo | 1.6s | ease-in-out |
| AnalogVU needle inertia | lerp 0.18 | — |

## Interaction grammar

| Gesture | Effect |
|---|---|
| Click preset half | Fire (toggle on/off). Speaks `preset.fire`. |
| Right-click preset half | Arm (load and cue). Speaks `preset.cue`. Re-right-click disarms (silent). |
| `F` key | Fire-all-armed — every armed preset launches in one beat. |
| `1`-`8` | Fire preset by position in current bank. |
| `Space` | Stop all. |
| `Esc` | Stop audio analysis (planned). |

Per-preset voice copy (`cue` and `fire` strings) lives in
`src/presets/index.js` — 32 presets × 2 lines = 64 spoken hooks. Edit there.

## Accessibility

- All preset halves expose `aria-pressed` (active state) + `aria-label`
  (`<name> (<bank>) — <state>`).
- Buttons are reachable via tab order. The diagonal split is purely
  visual; the underlying `<button>` is full-cell.
- Color is *redundant*, never sole signal: every color cue (active /
  armed / ready) also has a shape (LED pip, FIRE pill, glow ring) so
  red-green or hi-DPI low-contrast users still parse state.
- Animations respect ~10% timing tolerance — no hard sub-100ms flicker.
