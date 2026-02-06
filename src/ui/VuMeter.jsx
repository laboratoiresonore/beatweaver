import { useEffect, useRef, useState } from 'react';
import * as Tone from 'tone';

// Pioneer DJM-style LED segment zones
// 7 green, 2 amber, 3 red (matches DJM-V10 channel meters)
const SEGMENT_COUNT = 12;
const SEGMENT_COLORS = [
  'green', 'green', 'green', 'green', 'green', 'green', 'green',
  'amber', 'amber',
  'red', 'red', 'red',
];

/**
 * VuMeter - Pioneer DJM-style segmented LED meter
 * Each bar is a vertical stack of discrete LED segments
 * Green (bottom) -> Amber (mid) -> Red (top)
 */
export function VuMeter({ bars = 8, width = 80, height = 40, className = '' }) {
  const [levels, setLevels] = useState(() => new Array(bars).fill(0));
  const analyserRef = useRef(null);
  const animFrameRef = useRef(null);
  const lastUpdateRef = useRef(0);

  useEffect(() => {
    analyserRef.current = new Tone.Analyser('fft', 256);
    Tone.getDestination().connect(analyserRef.current);

    const updateMeter = (timestamp) => {
      if (timestamp - lastUpdateRef.current < 33) {
        animFrameRef.current = requestAnimationFrame(updateMeter);
        return;
      }
      lastUpdateRef.current = timestamp;

      if (!analyserRef.current) {
        animFrameRef.current = requestAnimationFrame(updateMeter);
        return;
      }

      const fftData = analyserRef.current.getValue();
      const newLevels = new Array(bars);
      const binSize = Math.floor(fftData.length / bars);

      for (let i = 0; i < bars; i++) {
        let sum = 0;
        const start = i * binSize;
        const end = Math.min(start + binSize, fftData.length);

        for (let j = start; j < end; j++) {
          const db = fftData[j];
          const linear = Math.max(0, (db + 60) / 60);
          sum += linear;
        }

        const avg = sum / (end - start);
        newLevels[i] = Math.min(1, avg * 1.5);
      }

      setLevels(newLevels);
      animFrameRef.current = requestAnimationFrame(updateMeter);
    };

    animFrameRef.current = requestAnimationFrame(updateMeter);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (analyserRef.current) {
        Tone.getDestination().disconnect(analyserRef.current);
        analyserRef.current.dispose();
        analyserRef.current = null;
      }
    };
  }, [bars]);

  const barWidth = (width - (bars - 1) * 2) / bars;
  const segmentHeight = (height - (SEGMENT_COUNT - 1)) / SEGMENT_COUNT;

  return (
    <div
      className={`flex items-end gap-0.5 ${className}`}
      style={{ width, height }}
      title="Audio Level"
    >
      {levels.map((level, barIndex) => {
        const litCount = Math.round(level * SEGMENT_COUNT);

        return (
          <div
            key={barIndex}
            className="flex flex-col-reverse gap-px"
            style={{ width: barWidth, height }}
          >
            {SEGMENT_COLORS.map((color, segIndex) => {
              const isLit = segIndex < litCount;
              return (
                <div
                  key={segIndex}
                  className={`vu-segment ${isLit ? `vu-segment--${color}` : 'vu-segment--off'}`}
                  style={{
                    height: segmentHeight,
                    width: '100%',
                  }}
                />
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

/**
 * VuMeterInline - Pioneer-style horizontal bar meter with peak hold
 * Uses 4-zone stepped color: green -> amber -> orange -> red
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
      if (timestamp - lastUpdateRef.current < 33) {
        animFrameRef.current = requestAnimationFrame(updateMeter);
        return;
      }
      lastUpdateRef.current = timestamp;

      if (!analyserRef.current) {
        animFrameRef.current = requestAnimationFrame(updateMeter);
        return;
      }

      const waveform = analyserRef.current.getValue();
      let sum = 0;
      for (let i = 0; i < waveform.length; i++) {
        sum += waveform[i] * waveform[i];
      }
      const rms = Math.sqrt(sum / waveform.length);
      const newLevel = Math.min(1, rms * 4);

      setLevel(newLevel);

      if (newLevel > peakDecayRef.current) {
        peakDecayRef.current = newLevel;
        setPeak(newLevel);
      } else {
        peakDecayRef.current *= 0.95;
        setPeak(peakDecayRef.current);
      }

      animFrameRef.current = requestAnimationFrame(updateMeter);
    };

    animFrameRef.current = requestAnimationFrame(updateMeter);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (analyserRef.current) {
        Tone.getDestination().disconnect(analyserRef.current);
        analyserRef.current.dispose();
        analyserRef.current = null;
      }
    };
  }, []);

  return (
    <div
      className={`relative rounded overflow-hidden ${className}`}
      style={{ width, height, background: '#0d0d14' }}
      title={`Level: ${Math.round(level * 100)}%`}
    >
      {/* Level bar with Pioneer stepped gradient */}
      <div
        className="absolute inset-y-0 left-0 transition-all duration-75"
        style={{
          width: `${level * 100}%`,
          background: 'linear-gradient(to right, #00C853 0%, #00C853 55%, #FFB300 55%, #FFB300 75%, #FF6D00 75%, #FF6D00 88%, #FF1744 88%, #FF1744 100%)',
        }}
      />
      {/* Peak indicator */}
      <div
        className="absolute inset-y-0 w-0.5 transition-all duration-150"
        style={{
          left: `${peak * 100}%`,
          backgroundColor: peak > 0.88 ? '#FF1744' : peak > 0.75 ? '#FF6D00' : peak > 0.55 ? '#FFB300' : '#00C853',
          opacity: peak > 0.05 ? 1 : 0,
        }}
      />
      {/* Grid lines for dB reference */}
      <div className="absolute inset-0 flex">
        <div className="flex-1 border-r border-white/5" />
        <div className="flex-1 border-r border-white/5" />
        <div className="flex-1 border-r border-white/8" />
        <div className="flex-1" />
      </div>
    </div>
  );
}

/**
 * WaveformDisplay - rekordbox 3Band-style waveform visualization
 * Low frequencies = blue, Mid = amber, High = light blue
 * Renders behind the logo as a frequency-banded display
 */
export function WaveformDisplay({ bars = 24, width = 320, height = 70, className = '' }) {
  const [bandLevels, setBandLevels] = useState(() =>
    Array.from({ length: bars }, () => ({ low: 0, mid: 0, high: 0 }))
  );
  const analyserRef = useRef(null);
  const animFrameRef = useRef(null);
  const lastUpdateRef = useRef(0);
  const historyRef = useRef([]);

  useEffect(() => {
    analyserRef.current = new Tone.Analyser('fft', 512);
    Tone.getDestination().connect(analyserRef.current);

    const updateWaveform = (timestamp) => {
      if (timestamp - lastUpdateRef.current < 50) {
        animFrameRef.current = requestAnimationFrame(updateWaveform);
        return;
      }
      lastUpdateRef.current = timestamp;

      if (!analyserRef.current) {
        animFrameRef.current = requestAnimationFrame(updateWaveform);
        return;
      }

      const fftData = analyserRef.current.getValue();
      const totalBins = fftData.length; // 256 bins

      // Split into 3 frequency bands
      const lowEnd = Math.floor(totalBins * 0.15);   // 0-15% = bass
      const midEnd = Math.floor(totalBins * 0.55);   // 15-55% = mids
      // 55-100% = highs

      const getBandLevel = (start, end) => {
        let sum = 0;
        for (let i = start; i < end; i++) {
          sum += Math.max(0, (fftData[i] + 60) / 60);
        }
        return Math.min(1, (sum / (end - start)) * 1.8);
      };

      const currentBands = {
        low: getBandLevel(0, lowEnd),
        mid: getBandLevel(lowEnd, midEnd),
        high: getBandLevel(midEnd, totalBins),
      };

      // Scrolling history (push new, shift old)
      historyRef.current.push(currentBands);
      if (historyRef.current.length > bars) {
        historyRef.current.shift();
      }

      // Pad with zeros if not enough history yet
      const padded = [
        ...Array.from({ length: Math.max(0, bars - historyRef.current.length) }, () => ({ low: 0, mid: 0, high: 0 })),
        ...historyRef.current,
      ];

      setBandLevels(padded);
      animFrameRef.current = requestAnimationFrame(updateWaveform);
    };

    animFrameRef.current = requestAnimationFrame(updateWaveform);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (analyserRef.current) {
        Tone.getDestination().disconnect(analyserRef.current);
        analyserRef.current.dispose();
        analyserRef.current = null;
      }
    };
  }, [bars]);

  const barWidth = (width - (bars - 1) * 1) / bars;

  return (
    <div
      className={`flex items-end gap-px ${className}`}
      style={{ width, height }}
    >
      {bandLevels.map((bands, i) => {
        // Stack: low (blue) on bottom, mid (amber) middle, high (light blue) top
        const totalLevel = Math.min(1, bands.low + bands.mid + bands.high);
        const barHeight = Math.max(1, totalLevel * height * 0.9);

        // Proportional heights within the bar
        const total = (bands.low + bands.mid + bands.high) || 1;
        const lowH = (bands.low / total) * barHeight;
        const midH = (bands.mid / total) * barHeight;
        const highH = (bands.high / total) * barHeight;

        return (
          <div
            key={i}
            className="flex flex-col-reverse"
            style={{ width: barWidth, height }}
          >
            {/* Low (bass) - bottom */}
            <div
              className="waveform-bar"
              style={{
                height: lowH,
                backgroundColor: bands.low > 0.05 ? '#0055E1' : 'transparent',
                opacity: 0.6 + bands.low * 0.4,
                boxShadow: bands.low > 0.3 ? '0 0 3px rgba(0, 85, 225, 0.4)' : 'none',
              }}
            />
            {/* Mid - middle */}
            <div
              className="waveform-bar"
              style={{
                height: midH,
                backgroundColor: bands.mid > 0.05 ? '#FFA600' : 'transparent',
                opacity: 0.6 + bands.mid * 0.4,
                boxShadow: bands.mid > 0.3 ? '0 0 3px rgba(255, 166, 0, 0.4)' : 'none',
              }}
            />
            {/* High - top */}
            <div
              className="waveform-bar"
              style={{
                height: highH,
                backgroundColor: bands.high > 0.05 ? '#50B4FF' : 'transparent',
                opacity: 0.5 + bands.high * 0.5,
                boxShadow: bands.high > 0.3 ? '0 0 3px rgba(80, 180, 255, 0.3)' : 'none',
              }}
            />
          </div>
        );
      })}
    </div>
  );
}

/**
 * MasterVuStrip - Full-width horizontal Pioneer LED strip
 * 48 segments: green -> amber -> orange -> red
 * 4px tall, placed at bottom of screen
 */
export function MasterVuStrip({ className = '' }) {
  const STRIP_SEGMENTS = 48;
  const [level, setLevel] = useState(0);
  const analyserRef = useRef(null);
  const animFrameRef = useRef(null);
  const lastUpdateRef = useRef(0);

  useEffect(() => {
    analyserRef.current = new Tone.Analyser('waveform', 256);
    Tone.getDestination().connect(analyserRef.current);

    const update = (timestamp) => {
      if (timestamp - lastUpdateRef.current < 50) {
        animFrameRef.current = requestAnimationFrame(update);
        return;
      }
      lastUpdateRef.current = timestamp;

      if (!analyserRef.current) {
        animFrameRef.current = requestAnimationFrame(update);
        return;
      }

      const waveform = analyserRef.current.getValue();
      let sum = 0;
      for (let i = 0; i < waveform.length; i++) {
        sum += waveform[i] * waveform[i];
      }
      const rms = Math.sqrt(sum / waveform.length);
      setLevel(Math.min(1, rms * 4));
      animFrameRef.current = requestAnimationFrame(update);
    };

    animFrameRef.current = requestAnimationFrame(update);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (analyserRef.current) {
        Tone.getDestination().disconnect(analyserRef.current);
        analyserRef.current.dispose();
        analyserRef.current = null;
      }
    };
  }, []);

  const litCount = Math.round(level * STRIP_SEGMENTS);

  return (
    <div className={`master-vu-strip ${className}`}>
      {Array.from({ length: STRIP_SEGMENTS }, (_, i) => {
        const pos = i / STRIP_SEGMENTS;
        const isLit = i < litCount;
        let color;
        if (pos < 0.55) color = '#00C853';
        else if (pos < 0.75) color = '#FFB300';
        else if (pos < 0.88) color = '#FF6D00';
        else color = '#FF1744';

        return (
          <div
            key={i}
            className="master-vu-segment"
            style={{
              backgroundColor: isLit ? color : 'rgba(42, 42, 50, 0.3)',
              boxShadow: isLit ? `0 0 3px ${color}60` : 'none',
            }}
          />
        );
      })}
    </div>
  );
}

/**
 * WaveformTimeline - Full-width scrolling 3Band waveform (30s history)
 * Wider, slower version of WaveformDisplay for bottom of screen
 */
export function WaveformTimeline({ height = 32, className = '' }) {
  const TIMELINE_BARS = 120; // ~30s at 4 updates/sec
  const [bandLevels, setBandLevels] = useState(() =>
    Array.from({ length: TIMELINE_BARS }, () => ({ low: 0, mid: 0, high: 0 }))
  );
  const analyserRef = useRef(null);
  const animFrameRef = useRef(null);
  const lastUpdateRef = useRef(0);
  const historyRef = useRef([]);

  useEffect(() => {
    analyserRef.current = new Tone.Analyser('fft', 512);
    Tone.getDestination().connect(analyserRef.current);

    const update = (timestamp) => {
      if (timestamp - lastUpdateRef.current < 250) {
        animFrameRef.current = requestAnimationFrame(update);
        return;
      }
      lastUpdateRef.current = timestamp;

      if (!analyserRef.current) {
        animFrameRef.current = requestAnimationFrame(update);
        return;
      }

      const fftData = analyserRef.current.getValue();
      const totalBins = fftData.length;
      const lowEnd = Math.floor(totalBins * 0.15);
      const midEnd = Math.floor(totalBins * 0.55);

      const getBandLevel = (start, end) => {
        let sum = 0;
        for (let i = start; i < end; i++) {
          sum += Math.max(0, (fftData[i] + 60) / 60);
        }
        return Math.min(1, (sum / (end - start)) * 1.8);
      };

      const current = {
        low: getBandLevel(0, lowEnd),
        mid: getBandLevel(lowEnd, midEnd),
        high: getBandLevel(midEnd, totalBins),
      };

      historyRef.current.push(current);
      if (historyRef.current.length > TIMELINE_BARS) {
        historyRef.current.shift();
      }

      const padded = [
        ...Array.from({ length: Math.max(0, TIMELINE_BARS - historyRef.current.length) }, () => ({ low: 0, mid: 0, high: 0 })),
        ...historyRef.current,
      ];

      setBandLevels(padded);
      animFrameRef.current = requestAnimationFrame(update);
    };

    animFrameRef.current = requestAnimationFrame(update);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (analyserRef.current) {
        Tone.getDestination().disconnect(analyserRef.current);
        analyserRef.current.dispose();
        analyserRef.current = null;
      }
    };
  }, []);

  return (
    <div
      className={`flex items-end gap-0 w-full ${className}`}
      style={{ height }}
    >
      {bandLevels.map((bands, i) => {
        const totalLevel = Math.min(1, bands.low + bands.mid + bands.high);
        const barHeight = Math.max(0.5, totalLevel * height * 0.85);
        const total = (bands.low + bands.mid + bands.high) || 1;
        const lowH = (bands.low / total) * barHeight;
        const midH = (bands.mid / total) * barHeight;
        const highH = (bands.high / total) * barHeight;

        return (
          <div
            key={i}
            className="flex flex-col-reverse"
            style={{ flex: 1, height }}
          >
            <div style={{ height: lowH, backgroundColor: bands.low > 0.05 ? '#0055E1' : 'transparent', opacity: 0.5 + bands.low * 0.5, borderRadius: '0.5px' }} />
            <div style={{ height: midH, backgroundColor: bands.mid > 0.05 ? '#FFA600' : 'transparent', opacity: 0.5 + bands.mid * 0.5, borderRadius: '0.5px' }} />
            <div style={{ height: highH, backgroundColor: bands.high > 0.05 ? '#50B4FF' : 'transparent', opacity: 0.4 + bands.high * 0.6, borderRadius: '0.5px' }} />
          </div>
        );
      })}
    </div>
  );
}

export default VuMeter;
