# BeatWeaver — Color System

The palette is a thin extension of the 2026-04-30 design handoff: a near-black
chassis, a warm-cool semantic spectrum (accent / warn / ok / danger), and four
category hues that drive the preset grid. Every color in the live app comes
from this spec.

## Surfaces

| Token | Hex | Usage |
|---|---|---|
| `--bg` | `#06070A` | Page background, outermost chassis |
| `--bg-2` | `#0A0B10` | Top transport bar, secondary chassis |
| `--surface` | `#0E1015` | Panels, preset cells (idle) |
| `--surface-2` | `#14161D` | Raised surface, hover state |

## Borders

| Token | Hex | Usage |
|---|---|---|
| `--hair` | `#1B1E27` | Default 1px border — most outlines |
| `--hair-strong` | `#262A36` | Emphasized borders, divider rules |

## Text

| Token | Hex | Usage |
|---|---|---|
| `--text` | `#E6E8EE` | Primary copy, BPM digits, wordmark |
| `--text-2` | `#9097A6` | Secondary copy, labels |
| `--muted` | `#535A6B` | Tertiary copy, tick marks, disabled text |

## Semantic (oklch — keep tunable)

| Token | oklch | Approx hex | Usage |
|---|---|---|---|
| `--accent` | `oklch(0.74 0.16 240)` | `#50B4FF` | Primary CTA, armed glow, lock confirmation |
| `--warn` | `oklch(0.78 0.15 75)` | `#FFA600` | Row-selected ready state, BPM hold accent |
| `--ok` | `oklch(0.78 0.16 155)` | `#34D399` | Lock confirmed, analysis active |
| `--danger` | `oklch(0.66 0.20 24)` | `#E62828` | STOP ALL, errors |

oklch values are the source of truth — keep them when tweaking hue so the
perceptual lightness stays consistent across browsers.

## Category Colors

The four columns of the preset grid each carry a category color. Used for:
button fills when active, column header underlines, mini-VU bars, history
strip blocks.

| Column | Token | Hex | Notes |
|---|---|---|---|
| **BASS** | `--bass` | `#10B176` | rekordbox green-teal — sub, wobble, reese |
| **ENERGY** | `--energy` | `#E0641B` | rekordbox orange — leads, arps, stabs, risers |
| **TEXTURE** | `--texture` | `#B432FF` | rekordbox purple — pads, atmospheres, noise |
| **FX** | `--fx` | `#FF127B` | rekordbox hot-pink — impacts, sweeps, one-shots |

These four are also the reference palette for the app icon's 4-bar glyph.

## VU Meter Zones (Pioneer-derived)

Used by the master VU strip and per-column mini meters. Standard CDJ-3000 ramp.

| Zone | Hex | Range (dBFS) |
|---|---|---|
| Green | `#00C853` | -∞ to -12 |
| Amber | `#FFB300` | -12 to -6 |
| Orange | `#FF6D00` | -6 to -3 |
| Red | `#FF1744` | -3 to 0 |
| Clip | `#FF0000` | > 0 (peak hold) |

## Waveform 3-Band (rekordbox)

| Band | Hex | Frequency |
|---|---|---|
| Low | `#0055E1` | < 200 Hz |
| Mid | `#FFA600` | 200 Hz – 4 kHz |
| High | `#50B4FF` | > 4 kHz |

## Contrast & Accessibility

- Body text (`--text` on `--bg`) contrast ratio: **15.4:1** (AAA)
- Secondary text (`--text-2` on `--surface`) contrast ratio: **6.7:1** (AA / AAA for large text)
- Muted text (`--muted` on `--surface`) contrast ratio: **3.5:1** — only used for non-essential glyphs (tick marks, dim disabled labels), per WCAG 1.4.11 (UI components / meaningful icons).
- Category colors are **never** the only signal for state — every active preset cell also has a fill, an LED pip, and an "N ON" badge in the column header. Color-blind operators can still read the grid.
