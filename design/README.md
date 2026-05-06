# BeatWeaver — Design Assets

Brand source-of-truth for the BeatWeaver app. The runtime CSS in
`src/styles/index.css` is generated/maintained against the tokens defined
here, and all icons render from these vectors.

| File | Purpose |
|---|---|
| `tokens.css` | Canonical design tokens (colors, type, geometry, timings). Mirror of the 2026-04-30 handoff `:root` block. |
| `colors.md` | Palette specification with hex codes, oklch values, and per-color usage rules. |
| `icon.svg` | Full-color 1024×1024 app icon (vector source for `build/icon.png`). |
| `icon-monochrome.svg` | Single-stroke 64×64 glyph for tray / taskbar / favicons. |
| `wordmark.svg` | BEATWEAVER lockup with meter underline. |
| `icons/bass.svg` | Category icon — BASS column (#10B176). |
| `icons/energy.svg` | Category icon — ENERGY column (#E0641B). |
| `icons/texture.svg` | Category icon — TEXTURE column (#B432FF). |
| `icons/fx.svg` | Category icon — FX column (#FF127B). |
| `icons/fire.svg` | FIRE pip used on armed preset halves. Uses `currentColor` so the parent's category color paints it. |

## Relationship to the design handoff

The hi-fi prototype shipped 2026-04-30 lives under
`_dev_docs/design_handoff_beatweaver/`. It contains:

- `Beatweaver.html` — full pixel-perfect static prototype (React-from-CDN + inline Babel)
- `*.jsx` — component reference implementations
- `data.jsx` — the canonical 32-preset / 16-pattern data layout

That bundle is **reference, not source**. The pieces that were promoted to production live here in `design/` (vector assets) and in `src/` (the React rewrite). Issue #3 tracks the remaining components still to be ported visually.

## Editing rules

- **Tokens first.** If a color is used in two places, it lives in `tokens.css` and both surfaces reference it. Never hard-code hex in components.
- **SVG over PNG.** All design assets are vector. The PNG icon shipped with the build is generated from `icon.svg` via `scripts/generate-icon.js`.
- **Match the handoff.** The four category colors and the three semantic colors (accent / warn / ok / danger) are spec'd in oklch in the design tokens — keep them there so a hue tweak only happens in one place.
