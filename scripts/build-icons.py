#!/usr/bin/env python3
"""Rasterize build/icon.svg → build/icon.png + build/icon.ico for electron-builder.

Run after editing scripts/generate-icon.js (which writes the SVG source of truth):
    node scripts/generate-icon.js
    python scripts/build-icons.py

Pure stdlib + Pillow (likely already installed for image work). No `canvas` /
`sharp` native dep required.
"""
from pathlib import Path
import sys
import xml.etree.ElementTree as ET

try:
    from PIL import Image
except ImportError:
    sys.exit("Pillow required: pip install Pillow")

try:
    import cairosvg  # type: ignore
    HAVE_CAIRO = True
except ImportError:
    HAVE_CAIRO = False

ROOT = Path(__file__).resolve().parent.parent
BUILD = ROOT / "build"
SVG = BUILD / "icon.svg"
PNG = BUILD / "icon.png"
ICO = BUILD / "icon.ico"

if not SVG.exists():
    sys.exit(f"Missing {SVG} — run `node scripts/generate-icon.js` first.")

# --- SVG → PNG (1024×1024) ---
if HAVE_CAIRO:
    cairosvg.svg2png(url=str(SVG), write_to=str(PNG), output_width=1024, output_height=1024)
    print(f"Wrote {PNG} via cairosvg")
else:
    if not PNG.exists():
        sys.exit("No cairosvg available and no existing PNG to fall back on. "
                 "Install cairosvg (`pip install cairosvg`) or commit a base PNG.")
    # Validate the PNG is at least sized right; otherwise warn.
    with Image.open(PNG) as img:
        if img.size != (1024, 1024):
            print(f"WARN: existing {PNG} is {img.size}, expected (1024,1024) — keeping as-is.")
    print(f"Reusing existing {PNG} (cairosvg not installed; SVG is still authoritative)")

# --- PNG → ICO (multi-size, Windows) ---
with Image.open(PNG) as img:
    img.save(ICO, format="ICO", sizes=[(256, 256), (128, 128), (64, 64), (48, 48), (32, 32), (16, 16)])
print(f"Wrote {ICO} (6 sizes)")
