/**
 * MidiController - Novation Launch Control XL driver
 *
 * Handles MIDI input/output for the Launch Control XL:
 * - 8 faders (CC 77-84)
 * - 3 rows of 8 knobs (CC 13-20, 29-36, 49-56)
 * - 2 rows of 8 buttons (Note 41-44/57-60 top, 73-76/89-92 bottom)
 * - LED feedback on buttons
 * - Hot-plug detection
 */

export class MidiController {
  // Novation Launch Control XL MIDI mapping (Template 1 / Factory)
  static LCXL = {
    name: 'Launch Control XL',

    // CC numbers for faders (left to right)
    FADERS: [77, 78, 79, 80, 81, 82, 83, 84],

    // CC numbers for knobs - 3 rows of 8
    KNOBS_A: [13, 14, 15, 16, 17, 18, 19, 20], // Top row
    KNOBS_B: [29, 30, 31, 32, 33, 34, 35, 36], // Middle row
    KNOBS_C: [49, 50, 51, 52, 53, 54, 55, 56], // Bottom row

    // Note numbers for buttons - 2 rows of 8
    BUTTONS_TOP: [41, 42, 43, 44, 57, 58, 59, 60],
    BUTTONS_BOTTOM: [73, 74, 75, 76, 89, 90, 91, 92],

    // Side buttons (Track Control)
    SIDE_UP: 104,
    SIDE_DOWN: 105,
    SIDE_LEFT: 106,
    SIDE_RIGHT: 107,

    // LED color velocities (send Note On with these values)
    // Formula: Velocity = (16 × Green) + Red + Flags
    // Green/Red: 0-3, Flags: 12 = normal, 8 = flash
    LED_OFF: 0,
    LED_RED_LOW: 13,      // (16×0) + 1 + 12
    LED_RED: 15,          // (16×0) + 3 + 12
    LED_AMBER_LOW: 29,    // (16×1) + 1 + 12
    LED_AMBER: 63,        // (16×3) + 3 + 12
    LED_YELLOW: 62,       // (16×3) + 2 + 12
    LED_GREEN_LOW: 28,    // (16×1) + 0 + 12
    LED_GREEN: 60,        // (16×3) + 0 + 12

    // Flash variants (Flags = 8 instead of 12)
    LED_RED_FLASH: 11,    // (16×0) + 3 + 8
    LED_GREEN_FLASH: 56,  // (16×3) + 0 + 8
    LED_AMBER_FLASH: 59,  // (16×3) + 3 + 8
    LED_YELLOW_FLASH: 58, // (16×3) + 2 + 8

    // Knob LED indices (for SysEx control)
    KNOBS_LED_A: [0, 1, 2, 3, 4, 5, 6, 7],       // Top row (indices 0-7)
    KNOBS_LED_B: [8, 9, 10, 11, 12, 13, 14, 15], // Middle row (indices 8-15)
    KNOBS_LED_C: [16, 17, 18, 19, 20, 21, 22, 23], // Bottom row (indices 16-23)

    // SysEx protocol for LED control
    // Format: F0 00 20 29 02 11 78 [Template] [Index] [Value] F7
    // Template: 00-07 = user templates, 08-0F = factory templates
    SYSEX_HEADER: [0xF0, 0x00, 0x20, 0x29, 0x02, 0x11, 0x78],
    SYSEX_TEMPLATE: 0x08, // Factory template 1 (default on most LCXL setups)
    SYSEX_END: 0xF7,
  };

  constructor() {
    this.midiAccess = null;
    this.input = null;
    this.output = null;
    this.connected = false;
    this.deviceName = '';

    // Callbacks
    this.onButton = null;       // (index, isTop, velocity) => void
    this.onFader = null;        // (index, value) => void  -- value 0-1
    this.onKnob = null;         // (row, index, value) => void  -- row: 'A'|'B'|'C', value 0-1
    this.onSideButton = null;   // (button, isPress) => void  -- button: 'up'|'down'|'left'|'right', isPress: true=down, false=up
    this.onConnectionChange = null; // (connected, deviceName) => void

    // Internal state
    this._ledState = new Map(); // note -> color
    this._reconnectTimer = null;
  }

  /**
   * Initialize WebMIDI and find Launch Control XL
   */
  async init() {
    try {
      // Request SysEx access for knob LED control
      this.midiAccess = await navigator.requestMIDIAccess({ sysex: true });
      this._findDevice();

      // Watch for device hot-plug
      this.midiAccess.onstatechange = (event) => {
        console.log(`MIDI device ${event.port.state}: ${event.port.name}`);
        this._findDevice();
      };

      return true;
    } catch (err) {
      console.warn('WebMIDI not available:', err.message);
      return false;
    }
  }

  /**
   * Scan for Launch Control XL in connected MIDI devices
   */
  _findDevice() {
    const lcxl = MidiController.LCXL;
    let foundInput = null;
    let foundOutput = null;

    for (const input of this.midiAccess.inputs.values()) {
      if (input.state === 'connected' && input.name.includes(lcxl.name)) {
        foundInput = input;
        break;
      }
    }

    for (const output of this.midiAccess.outputs.values()) {
      if (output.state === 'connected' && output.name.includes(lcxl.name)) {
        foundOutput = output;
        break;
      }
    }

    const wasConnected = this.connected;

    if (foundInput && foundOutput) {
      // Disconnect previous if different device
      if (this.input && this.input !== foundInput) {
        this.input.onmidimessage = null;
      }

      this.input = foundInput;
      this.output = foundOutput;
      this.connected = true;
      this.deviceName = foundInput.name;

      // Attach message handler
      this.input.onmidimessage = this._handleMessage.bind(this);

      if (!wasConnected) {
        console.log(`MIDI connected: ${this.deviceName}`);
        // Flash all LEDs green briefly to confirm connection
        this._connectionFlash();
        this.onConnectionChange?.(true, this.deviceName);
      }
    } else {
      if (wasConnected) {
        console.log('MIDI disconnected');
        this.input = null;
        this.output = null;
        this.connected = false;
        this.deviceName = '';
        this.onConnectionChange?.(false, '');
      }
    }
  }

  /**
   * Parse incoming MIDI messages and dispatch to callbacks
   */
  _handleMessage(event) {
    const [status, data1, data2] = event.data;
    const type = status & 0xF0;
    const lcxl = MidiController.LCXL;

    // Note On (0x90) or Note Off (0x80) - Buttons
    // LCXL sends Note On with velocity 127 for press, Note Off (or Note On with velocity 0) for release
    if (type === 0x90 || type === 0x80) {
      // Note Off (0x80) always means velocity 0 (release)
      const velocity = (type === 0x80) ? 0 : data2;

      // Top row buttons
      const topIndex = lcxl.BUTTONS_TOP.indexOf(data1);
      if (topIndex !== -1) {
        this.onButton?.(topIndex, true, velocity / 127);
        return;
      }

      // Bottom row buttons
      const bottomIndex = lcxl.BUTTONS_BOTTOM.indexOf(data1);
      if (bottomIndex !== -1) {
        this.onButton?.(bottomIndex, false, velocity / 127);
        return;
      }
    }

    // Control Change (0xB0) - Faders, Knobs, Side buttons
    if (type === 0xB0) {
      // Faders
      const faderIndex = lcxl.FADERS.indexOf(data1);
      if (faderIndex !== -1) {
        this.onFader?.(faderIndex, data2 / 127);
        return;
      }

      // Knob Row A (top)
      const knobAIndex = lcxl.KNOBS_A.indexOf(data1);
      if (knobAIndex !== -1) {
        this.onKnob?.('A', knobAIndex, data2 / 127);
        return;
      }

      // Knob Row B (middle)
      const knobBIndex = lcxl.KNOBS_B.indexOf(data1);
      if (knobBIndex !== -1) {
        this.onKnob?.('B', knobBIndex, data2 / 127);
        return;
      }

      // Knob Row C (bottom)
      const knobCIndex = lcxl.KNOBS_C.indexOf(data1);
      if (knobCIndex !== -1) {
        this.onKnob?.('C', knobCIndex, data2 / 127);
        return;
      }

      // Side buttons (sent as CC on some templates)
      // Now sends both press (data2 > 0) and release (data2 === 0) for hold-to-repeat support
      const isPress = data2 > 0;
      if (data1 === lcxl.SIDE_UP) { this.onSideButton?.('up', isPress); return; }
      if (data1 === lcxl.SIDE_DOWN) { this.onSideButton?.('down', isPress); return; }
      if (data1 === lcxl.SIDE_LEFT) { this.onSideButton?.('left', isPress); return; }
      if (data1 === lcxl.SIDE_RIGHT) { this.onSideButton?.('right', isPress); return; }

    }
  }

  // ============ LED CONTROL ============

  /**
   * Set a single button LED color
   * @param {number} note - MIDI note number of the button
   * @param {number} color - LED color velocity (use LCXL.LED_* constants)
   */
  setLED(note, color) {
    if (!this.output) return;
    this.output.send([0x90, note, color]);
    this._ledState.set(note, color);
  }

  /**
   * Set LED color for a top row button by index (0-7)
   */
  setTopLED(index, color) {
    const note = MidiController.LCXL.BUTTONS_TOP[index];
    if (note !== undefined) this.setLED(note, color);
  }

  /**
   * Set LED color for a bottom row button by index (0-7)
   */
  setBottomLED(index, color) {
    const note = MidiController.LCXL.BUTTONS_BOTTOM[index];
    if (note !== undefined) {
      this.setLED(note, color);
    }
  }

  /**
   * Update top row LEDs based on active preset indices
   * @param {Set<number>} activeIndices - Set of active button indices (0-7)
   */
  setPresetLEDs(activeIndices) {
    const lcxl = MidiController.LCXL;
    for (let i = 0; i < 8; i++) {
      const color = activeIndices.has(i) ? lcxl.LED_GREEN : lcxl.LED_OFF;
      this.setTopLED(i, color);
    }
  }

  /**
   * Set a button LED to "launching" state (amber pulse)
   */
  setLaunchingLED(index) {
    this.setTopLED(index, MidiController.LCXL.LED_AMBER);
  }

  /**
   * Turn all button LEDs off
   */
  allButtonLEDsOff() {
    const lcxl = MidiController.LCXL;
    [...lcxl.BUTTONS_TOP, ...lcxl.BUTTONS_BOTTOM].forEach(note => {
      this.setLED(note, lcxl.LED_OFF);
    });
  }

  /**
   * Turn all LEDs off (buttons + knobs)
   */
  allLEDsOff() {
    this.allButtonLEDsOff();
    this.allKnobLEDsOff();
    this._ledState.clear();
  }

  /**
   * Test ALL possible methods to light up knob LEDs
   * Called after connection to diagnose knob LED support
   */
  testKnobLEDs() {
    if (!this.output) return;

    console.log('[KNOB LED TEST] Testing all known methods to light knob LEDs...');

    const lcxl = MidiController.LCXL;

    // Method 1: SysEx with template 0x00 (user template)
    console.log('[KNOB LED TEST] Method 1: SysEx template 0x00');
    for (let i = 0; i < 24; i++) {
      this.output.send([0xF0, 0x00, 0x20, 0x29, 0x02, 0x11, 0x78, 0x00, i, lcxl.LED_GREEN, 0xF7]);
    }

    // Method 2: SysEx with template 0x08 (factory template 1)
    setTimeout(() => {
      console.log('[KNOB LED TEST] Method 2: SysEx template 0x08');
      for (let i = 0; i < 24; i++) {
        this.output.send([0xF0, 0x00, 0x20, 0x29, 0x02, 0x11, 0x78, 0x08, i, lcxl.LED_AMBER, 0xF7]);
      }
    }, 500);

    // Method 3: Note messages to knob indices (some firmware)
    setTimeout(() => {
      console.log('[KNOB LED TEST] Method 3: Note messages');
      for (let i = 0; i < 24; i++) {
        this.output.send([0x90, i, lcxl.LED_RED]);
      }
    }, 1000);

    // Method 4: CC messages to knob CCs
    setTimeout(() => {
      console.log('[KNOB LED TEST] Method 4: CC messages');
      // Row A
      lcxl.KNOBS_A.forEach(cc => this.output.send([0xB0, cc, 127]));
      // Row B
      lcxl.KNOBS_B.forEach(cc => this.output.send([0xB0, cc, 127]));
      // Row C
      lcxl.KNOBS_C.forEach(cc => this.output.send([0xB0, cc, 127]));
    }, 1500);

    console.log('[KNOB LED TEST] If no knob LEDs lit up after 2 seconds, your LCXL does NOT support knob ring LEDs.');
    console.log('[KNOB LED TEST] This is a HARDWARE limitation - the standard LCXL only has button LEDs.');
  }

  /**
   * Epic startup light show animation
   * Cascading colors across all button LEDs
   */
  _connectionFlash() {
    const lcxl = MidiController.LCXL;
    const topButtons = lcxl.BUTTONS_TOP;
    const bottomButtons = lcxl.BUTTONS_BOTTOM;

    // All LEDs off first
    [...topButtons, ...bottomButtons].forEach(note => this.setLED(note, lcxl.LED_OFF));

    // Phase 1: Cascade across top row (left to right) - GREEN
    topButtons.forEach((note, i) => {
      setTimeout(() => this.setLED(note, lcxl.LED_GREEN), i * 50);
    });

    // Phase 2: Cascade across bottom row (left to right) - AMBER
    bottomButtons.forEach((note, i) => {
      setTimeout(() => this.setLED(note, lcxl.LED_AMBER), 400 + i * 50);
    });

    // Phase 3: All flash RED briefly
    setTimeout(() => {
      [...topButtons, ...bottomButtons].forEach(note => this.setLED(note, lcxl.LED_RED));
    }, 800);

    // Phase 4: All flash YELLOW
    setTimeout(() => {
      [...topButtons, ...bottomButtons].forEach(note => this.setLED(note, lcxl.LED_YELLOW));
    }, 900);

    // Phase 5: Wave pattern - alternating colors
    setTimeout(() => {
      topButtons.forEach((note, i) => {
        this.setLED(note, i % 2 === 0 ? lcxl.LED_GREEN : lcxl.LED_AMBER);
      });
      bottomButtons.forEach((note, i) => {
        this.setLED(note, i % 2 === 0 ? lcxl.LED_AMBER : lcxl.LED_GREEN);
      });
    }, 1000);

    // Phase 6: Reverse wave
    setTimeout(() => {
      topButtons.forEach((note, i) => {
        this.setLED(note, i % 2 === 0 ? lcxl.LED_AMBER : lcxl.LED_GREEN);
      });
      bottomButtons.forEach((note, i) => {
        this.setLED(note, i % 2 === 0 ? lcxl.LED_GREEN : lcxl.LED_AMBER);
      });
    }, 1100);

    // Phase 7: All GREEN flash
    setTimeout(() => {
      [...topButtons, ...bottomButtons].forEach(note => this.setLED(note, lcxl.LED_GREEN));
    }, 1200);

    // Phase 8: Turn off - ready for normal operation
    setTimeout(() => {
      [...topButtons, ...bottomButtons].forEach(note => this.setLED(note, lcxl.LED_OFF));
    }, 1400);
  }

  // ============ KNOB LED CONTROL (SysEx) ============

  /**
   * Set a single knob LED color via SysEx
   * NOTE: Knob ring LEDs may not be supported on all LCXL firmware versions
   * Tries multiple template values to maximize compatibility
   * @param {number} index - Knob index (0-23)
   * @param {number} color - LED color (use LCXL.LED_* constants)
   */
  setKnobLED(index, color) {
    if (!this.output) return;
    const lcxl = MidiController.LCXL;

    // Try BOTH user template (0x00) and factory template (0x08)
    // Different LCXL firmware versions respond to different templates
    const templates = [0x00, 0x08];

    for (const template of templates) {
      const message = [
        ...lcxl.SYSEX_HEADER,
        template,
        index,
        color,
        lcxl.SYSEX_END
      ];
      try {
        this.output.send(message);
      } catch (err) {
        // Knob LEDs not supported
      }
    }
    this._ledState.set(`knob_${index}`, color);
  }

  /**
   * Alternative: Try CC-based knob LED control
   * Some LCXL firmware uses CC messages instead of SysEx
   * CC 13-20 = Row A LEDs, CC 29-36 = Row B LEDs, CC 49-56 = Row C LEDs
   */
  setKnobLEDviaCC(row, index, color) {
    if (!this.output) return;
    const lcxl = MidiController.LCXL;
    let cc;

    // Map row to CC range
    if (row === 'A') cc = lcxl.KNOBS_A[index];
    else if (row === 'B') cc = lcxl.KNOBS_B[index];
    else if (row === 'C') cc = lcxl.KNOBS_C[index];
    else return;

    // Send CC with color as value (channel 1)
    // This is an alternative method that works on some firmware
    try {
      this.output.send([0xB0, cc, color]);
    } catch (err) {
      // Not supported
    }
  }

  /**
   * Set LED color for knob in row A (top) by index (0-7)
   */
  setKnobRowALED(index, color) {
    if (index >= 0 && index < 8) {
      this.setKnobLED(index, color);
    }
  }

  /**
   * Set LED color for knob in row B (middle) by index (0-7)
   */
  setKnobRowBLED(index, color) {
    if (index >= 0 && index < 8) {
      this.setKnobLED(8 + index, color);
    }
  }

  /**
   * Set LED color for knob in row C (bottom) by index (0-7)
   */
  setKnobRowCLED(index, color) {
    if (index >= 0 && index < 8) {
      this.setKnobLED(16 + index, color);
    }
  }

  /**
   * Set all 24 knob LEDs at once (efficient batch via single SysEx message)
   * @param {number[]} colors - Array of 24 color values
   */
  setAllKnobLEDs(colors) {
    if (!this.output) return;
    const lcxl = MidiController.LCXL;
    // Build single SysEx with multiple index-value pairs
    const message = [...lcxl.SYSEX_HEADER, lcxl.SYSEX_TEMPLATE];
    for (let i = 0; i < 24 && i < colors.length; i++) {
      message.push(i, colors[i]);
      this._ledState.set(`knob_${i}`, colors[i]);
    }
    message.push(lcxl.SYSEX_END);
    this.output.send(message);
  }

  /**
   * Turn all knob LEDs off
   */
  allKnobLEDsOff() {
    const colors = new Array(24).fill(MidiController.LCXL.LED_OFF);
    this.setAllKnobLEDs(colors);
  }

  // ============ DEVICE INFO ============

  /**
   * Get list of all connected MIDI devices
   */
  getDevices() {
    if (!this.midiAccess) return { inputs: [], outputs: [] };

    const inputs = [];
    const outputs = [];

    for (const input of this.midiAccess.inputs.values()) {
      if (input.state === 'connected') {
        inputs.push({ id: input.id, name: input.name });
      }
    }

    for (const output of this.midiAccess.outputs.values()) {
      if (output.state === 'connected') {
        outputs.push({ id: output.id, name: output.name });
      }
    }

    return { inputs, outputs };
  }

  /**
   * Check if Launch Control XL is connected
   */
  isConnected() {
    return this.connected;
  }

  /**
   * Get current state
   */
  getState() {
    return {
      connected: this.connected,
      deviceName: this.deviceName,
      ledState: Object.fromEntries(this._ledState),
    };
  }

  /**
   * Clean up
   */
  dispose() {
    this.allLEDsOff();
    if (this.input) {
      this.input.onmidimessage = null;
    }
    if (this.midiAccess) {
      this.midiAccess.onstatechange = null;
    }
    if (this._reconnectTimer) {
      clearTimeout(this._reconnectTimer);
    }
    this.input = null;
    this.output = null;
    this.connected = false;
  }
}

// Singleton
let instance = null;

export function getMidiController() {
  if (!instance) {
    instance = new MidiController();
  }
  return instance;
}

export default MidiController;
