#!/usr/bin/env node
/**
 * Beatweaver app-icon source-of-truth: writes `build/icon.svg`, the vector
 * brand mark used everywhere (favicon, app icon, social).
 *
 * The PNG (`build/icon.png`) and ICO (`build/icon.ico`) artifacts that
 * electron-builder consumes are produced from this SVG by `npm run icon:build`
 * — that script is intentionally separate so the SVG stays the editable origin.
 *
 * Design: 12-bar symmetric waveform (mirrors the BPM signal Beatweaver listens
 * to), gradient fills in the four category hues (BASS / ENERGY / TEXTURE / FX),
 * "BW" wordmark beneath. Renders cleanly at 16 px and at 1024 px.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const buildDir = join(__dirname, '..', 'build');
mkdirSync(buildDir, { recursive: true });

const SIZE = 1024;
// Symmetric peak shape — matches the audio analysis signal that drives the app.
const HEIGHTS = [0.15, 0.25, 0.40, 0.60, 0.85, 0.95, 0.95, 0.85, 0.60, 0.40, 0.25, 0.15];
const BAR_W = SIZE * 0.05;
const GAP = SIZE * 0.02;
const TOTAL_W = HEIGHTS.length * BAR_W + (HEIGHTS.length - 1) * GAP;
const START_X = (SIZE - TOTAL_W) / 2;
const CENTER_Y = SIZE / 2;
const BAR_R = BAR_W / 3;

const bars = HEIGHTS.map((h, i) => {
  const x = START_X + i * (BAR_W + GAP);
  const barH = SIZE * 0.5 * h;
  const y = CENTER_Y - barH / 2;
  return `<rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${BAR_W.toFixed(2)}" height="${barH.toFixed(2)}" rx="${BAR_R.toFixed(2)}" fill="url(#bw-bar)" />`;
}).join('\n  ');

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SIZE} ${SIZE}" width="${SIZE}" height="${SIZE}" role="img" aria-label="Beatweaver">
  <defs>
    <linearGradient id="bw-bg" x1="0" y1="0" x2="${SIZE}" y2="${SIZE}" gradientUnits="userSpaceOnUse">
      <stop offset="0%"  stop-color="#1A0A2E" />
      <stop offset="50%" stop-color="#16213E" />
      <stop offset="100%" stop-color="#0F0F23" />
    </linearGradient>
    <linearGradient id="bw-bar" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%"  stop-color="#00F5FF" />
      <stop offset="50%" stop-color="#7B2CBF" />
      <stop offset="100%" stop-color="#FF006E" />
    </linearGradient>
    <filter id="bw-glow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="6" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  </defs>
  <rect width="${SIZE}" height="${SIZE}" rx="${SIZE * 0.2}" fill="url(#bw-bg)" />
  <g filter="url(#bw-glow)">
  ${bars}
  </g>
  <text x="${SIZE / 2}" y="${SIZE * 0.87}" text-anchor="middle"
        font-family="'JetBrains Mono', 'Roboto Mono', 'SF Mono', monospace"
        font-weight="700" font-size="${SIZE * 0.12}" letter-spacing="0.06em" fill="#FFFFFF">BW</text>
</svg>
`;

const outPath = join(buildDir, 'icon.svg');
writeFileSync(outPath, svg);
console.log(`Wrote ${outPath} (${svg.length} bytes)`);
console.log('Next: run `npm run icon:build` to rasterize SVG → PNG/ICO for electron-builder.');
