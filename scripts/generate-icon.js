/**
 * Generate BeatWeaver app icon
 * Creates a 1024x1024 PNG with a simple waveform design
 */
const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');

const SIZE = 1024;
const canvas = createCanvas(SIZE, SIZE);
const ctx = canvas.getContext('2d');

// Background gradient (dark purple to deep blue)
const bgGradient = ctx.createLinearGradient(0, 0, SIZE, SIZE);
bgGradient.addColorStop(0, '#1a0a2e');
bgGradient.addColorStop(0.5, '#16213e');
bgGradient.addColorStop(1, '#0f0f23');

// Rounded rectangle background
ctx.fillStyle = bgGradient;
roundRect(ctx, 0, 0, SIZE, SIZE, SIZE * 0.2);
ctx.fill();

// Draw waveform bars
const barCount = 12;
const barWidth = SIZE * 0.05;
const gap = SIZE * 0.02;
const totalWidth = barCount * barWidth + (barCount - 1) * gap;
const startX = (SIZE - totalWidth) / 2;
const centerY = SIZE / 2;

// Waveform heights (symmetric pattern)
const heights = [0.15, 0.25, 0.4, 0.6, 0.85, 0.95, 0.95, 0.85, 0.6, 0.4, 0.25, 0.15];

for (let i = 0; i < barCount; i++) {
  const x = startX + i * (barWidth + gap);
  const barHeight = SIZE * 0.5 * heights[i];
  const y = centerY - barHeight / 2;

  // Gradient for each bar (cyan to magenta)
  const barGradient = ctx.createLinearGradient(x, y, x, y + barHeight);
  barGradient.addColorStop(0, '#00f5ff');
  barGradient.addColorStop(0.5, '#7b2cbf');
  barGradient.addColorStop(1, '#ff006e');

  ctx.fillStyle = barGradient;
  roundRect(ctx, x, y, barWidth, barHeight, barWidth / 3);
  ctx.fill();

  // Glow effect
  ctx.shadowColor = '#00f5ff';
  ctx.shadowBlur = 20;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
}

// Reset shadow
ctx.shadowBlur = 0;

// Add "BW" text at bottom
ctx.fillStyle = '#ffffff';
ctx.font = `bold ${SIZE * 0.12}px Arial, sans-serif`;
ctx.textAlign = 'center';
ctx.textBaseline = 'middle';
ctx.fillText('BW', SIZE / 2, SIZE * 0.85);

// Helper function for rounded rectangles
function roundRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

// Save as PNG
const buildDir = path.join(__dirname, '..', 'build');
if (!fs.existsSync(buildDir)) {
  fs.mkdirSync(buildDir, { recursive: true });
}

const buffer = canvas.toBuffer('image/png');
fs.writeFileSync(path.join(buildDir, 'icon.png'), buffer);

console.log('Icon generated: build/icon.png (1024x1024)');
