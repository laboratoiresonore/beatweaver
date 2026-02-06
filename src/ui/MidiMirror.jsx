/**
 * MidiMirror - Visual representation of Novation Launch Control XL
 * Shows which buttons are lit, fader positions, etc.
 * Purely visual, reads state from MidiController LED state
 */

import { useState, useEffect, useRef } from 'react';

// LED color map (LCXL velocity values -> CSS colors)
const LED_COLORS = {
  0: 'transparent',     // OFF
  13: '#5C1010',        // RED_LOW
  15: '#FF1744',        // RED
  29: '#5C4C10',        // AMBER_LOW
  63: '#FFB300',        // AMBER
  62: '#FFD166',        // YELLOW
  28: '#104C10',        // GREEN_LOW
  60: '#00C853',        // GREEN
  11: '#FF1744',        // RED_FLASH
  56: '#00C853',        // GREEN_FLASH
  59: '#FFB300',        // AMBER_FLASH
  58: '#FFD166',        // YELLOW_FLASH
};

function getLedColor(value) {
  return LED_COLORS[value] || 'transparent';
}

export function MidiMirror({ midiController, connected }) {
  const [ledState, setLedState] = useState({});
  const pollRef = useRef(null);

  useEffect(() => {
    if (!connected || !midiController) {
      setLedState({});
      return;
    }

    // Poll LED state every 200ms
    const poll = () => {
      const state = midiController.getState();
      setLedState(state.ledState || {});
    };

    poll();
    pollRef.current = setInterval(poll, 200);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [connected, midiController]);

  if (!connected) return null;

  // LCXL button note numbers
  const topButtons = [41, 42, 43, 44, 57, 58, 59, 60];
  const bottomButtons = [73, 74, 75, 76, 89, 90, 91, 92];

  return (
    <div className="midi-mirror" style={{ gridTemplateColumns: 'repeat(8, 1fr)' }} title="MIDI Controller Mirror">
      {/* Top row buttons */}
      {topButtons.map((note, i) => {
        const color = getLedColor(ledState[note] || 0);
        return (
          <div
            key={`top-${i}`}
            className="midi-mirror-btn"
            style={{
              backgroundColor: color === 'transparent' ? 'rgba(42, 42, 50, 0.4)' : color,
              boxShadow: color !== 'transparent' ? `0 0 4px ${color}60` : 'none',
            }}
          />
        );
      })}
      {/* Bottom row buttons */}
      {bottomButtons.map((note, i) => {
        const color = getLedColor(ledState[note] || 0);
        return (
          <div
            key={`bot-${i}`}
            className="midi-mirror-btn"
            style={{
              backgroundColor: color === 'transparent' ? 'rgba(42, 42, 50, 0.4)' : color,
              boxShadow: color !== 'transparent' ? `0 0 4px ${color}60` : 'none',
            }}
          />
        );
      })}
    </div>
  );
}

export default MidiMirror;
