import { useEffect, useRef, useState } from 'react';
import * as Tone from 'tone';

/**
 * Simple live VU meter component
 * Uses Tone.js destination analyser for low-overhead level detection
 * Throttled to ~30fps to minimize CPU usage
 */
export function VuMeter({ bars = 8, width = 80, height = 40, className = '' }) {
  const [levels, setLevels] = useState(() => new Array(bars).fill(0));
  const analyserRef = useRef(null);
  const dataArrayRef = useRef(null);
  const animFrameRef = useRef(null);
  const lastUpdateRef = useRef(0);

  useEffect(() => {
    // Create analyser connected to Tone destination
    // FFT size 256 = 128 frequency bins, good balance of resolution vs performance
    analyserRef.current = new Tone.Analyser('fft', 256);
    Tone.getDestination().connect(analyserRef.current);

    const updateMeter = (timestamp) => {
      // Throttle to ~30fps (33ms) to minimize CPU
      if (timestamp - lastUpdateRef.current < 33) {
        animFrameRef.current = requestAnimationFrame(updateMeter);
        return;
      }
      lastUpdateRef.current = timestamp;

      if (!analyserRef.current) {
        animFrameRef.current = requestAnimationFrame(updateMeter);
        return;
      }

      // Get frequency data
      const fftData = analyserRef.current.getValue();

      // Map frequency bins to our bar count
      // fftData is in dB (-Infinity to 0), normalize to 0-1
      const newLevels = new Array(bars);
      const binSize = Math.floor(fftData.length / bars);

      for (let i = 0; i < bars; i++) {
        let sum = 0;
        const start = i * binSize;
        const end = Math.min(start + binSize, fftData.length);

        for (let j = start; j < end; j++) {
          // Convert dB to linear (0-1), clamp negative infinity
          const db = fftData[j];
          // dB range: -100 (silent) to 0 (max)
          // Map to 0-1 with some headroom
          const linear = Math.max(0, (db + 60) / 60);
          sum += linear;
        }

        // Average and apply some smoothing/boost for visual appeal
        const avg = sum / (end - start);
        // Add slight decay for smoother animation
        newLevels[i] = Math.min(1, avg * 1.5);
      }

      setLevels(newLevels);
      animFrameRef.current = requestAnimationFrame(updateMeter);
    };

    animFrameRef.current = requestAnimationFrame(updateMeter);

    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
      if (analyserRef.current) {
        Tone.getDestination().disconnect(analyserRef.current);
        analyserRef.current.dispose();
        analyserRef.current = null;
      }
    };
  }, [bars]);

  const barWidth = (width - (bars - 1) * 2) / bars;

  return (
    <div
      className={`flex items-end gap-0.5 ${className}`}
      style={{ width, height }}
      title="Audio Level"
    >
      {levels.map((level, i) => {
        // Color gradient: green (low) -> yellow (mid) -> red (high)
        const hue = 120 - (level * 120); // 120 = green, 60 = yellow, 0 = red
        const saturation = 80 + (level * 20);
        const lightness = 45 + (level * 10);

        return (
          <div
            key={i}
            className="vu-bar rounded-sm transition-all duration-75"
            style={{
              width: barWidth,
              height: `${Math.max(2, level * 100)}%`,
              backgroundColor: level > 0.05
                ? `hsl(${hue}, ${saturation}%, ${lightness}%)`
                : 'var(--dj-border)',
              boxShadow: level > 0.3
                ? `0 0 ${Math.floor(level * 8)}px hsl(${hue}, ${saturation}%, ${lightness}%)`
                : 'none',
            }}
          />
        );
      })}
    </div>
  );
}

/**
 * Compact inline VU meter for header
 * Single horizontal bar with gradient
 */
export function VuMeterInline({ width = 60, height = 16, className = '' }) {
  const [level, setLevel] = useState(0);
  const [peak, setPeak] = useState(0);
  const analyserRef = useRef(null);
  const animFrameRef = useRef(null);
  const lastUpdateRef = useRef(0);
  const peakDecayRef = useRef(0);

  useEffect(() => {
    analyserRef.current = new Tone.Analyser('waveform', 256);
    Tone.getDestination().connect(analyserRef.current);

    const updateMeter = (timestamp) => {
      // Throttle to ~30fps
      if (timestamp - lastUpdateRef.current < 33) {
        animFrameRef.current = requestAnimationFrame(updateMeter);
        return;
      }
      lastUpdateRef.current = timestamp;

      if (!analyserRef.current) {
        animFrameRef.current = requestAnimationFrame(updateMeter);
        return;
      }

      // Get waveform data for RMS level
      const waveform = analyserRef.current.getValue();

      // Calculate RMS
      let sum = 0;
      for (let i = 0; i < waveform.length; i++) {
        sum += waveform[i] * waveform[i];
      }
      const rms = Math.sqrt(sum / waveform.length);

      // Boost for visual appeal (RMS is typically small)
      const newLevel = Math.min(1, rms * 4);

      setLevel(newLevel);

      // Peak hold with decay
      if (newLevel > peakDecayRef.current) {
        peakDecayRef.current = newLevel;
        setPeak(newLevel);
      } else {
        peakDecayRef.current *= 0.95; // Decay
        setPeak(peakDecayRef.current);
      }

      animFrameRef.current = requestAnimationFrame(updateMeter);
    };

    animFrameRef.current = requestAnimationFrame(updateMeter);

    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
      if (analyserRef.current) {
        Tone.getDestination().disconnect(analyserRef.current);
        analyserRef.current.dispose();
        analyserRef.current = null;
      }
    };
  }, []);

  // Color based on level
  const getColor = (lvl) => {
    if (lvl < 0.5) return 'var(--dj-success)';
    if (lvl < 0.8) return 'var(--dj-warning)';
    return 'var(--dj-error)';
  };

  return (
    <div
      className={`relative bg-dj-bg rounded overflow-hidden ${className}`}
      style={{ width, height }}
      title={`Level: ${Math.round(level * 100)}%`}
    >
      {/* Level bar */}
      <div
        className="absolute inset-y-0 left-0 transition-all duration-75"
        style={{
          width: `${level * 100}%`,
          background: `linear-gradient(to right, var(--dj-success), ${getColor(level)})`,
        }}
      />
      {/* Peak indicator */}
      <div
        className="absolute inset-y-0 w-0.5 transition-all duration-150"
        style={{
          left: `${peak * 100}%`,
          backgroundColor: getColor(peak),
          opacity: peak > 0.05 ? 1 : 0,
        }}
      />
      {/* Grid lines for reference */}
      <div className="absolute inset-0 flex">
        <div className="flex-1 border-r border-white/10" />
        <div className="flex-1 border-r border-white/10" />
        <div className="flex-1 border-r border-white/10" />
        <div className="flex-1" />
      </div>
    </div>
  );
}

export default VuMeter;
