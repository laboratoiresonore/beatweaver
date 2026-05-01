/**
 * Beatweaver - Main orchestrator
 *
 * Wires together:
 * - AudioAnalysis (BPM + Key detection)
 * - SynthEngine (Tone.js instruments + patterns)
 * - MidiController (Launch Control XL)
 * - Announcer (TTS feedback)
 *
 * Provides a single clean API for React to consume.
 */

import * as Tone from 'tone';
import { synthEngine } from './SynthEngine.js';
import { getAudioAnalysis } from './AudioAnalysis.js';
import { getMidiController } from './MidiController.js';
import { getAnnouncer } from './Announcer.js';
import { getAllPresets } from '../presets/index.js';
import { createModulator, knobToModulatorType, getModulatorName, MODULATOR_TYPES } from './SynthFactory.js';

export class Beatweaver {
  constructor() {
    this.audioAnalysis = getAudioAnalysis();
    this.synthEngine = synthEngine;
    this.midiController = getMidiController();
    this.announcer = getAnnouncer();

    this.initialized = false;
    this.activePresets = new Set();
    this.presetBank = 0; // 0 or 1 (16 presets in 2 banks of 8)

    // All 16 presets as flat array for bank indexing
    this._presets = getAllPresets();

    // Debounce tracking for preset launches (prevents double triggers from MIDI)
    this._lastPresetLaunch = new Map(); // presetId -> timestamp
    this._presetDebounceMs = 150; // Ignore duplicate launches within 150ms

    // Selection state for new MIDI mapping (Phase 4)
    // Maps column (0-3) -> { bank: 'A'|'B', row: 0-3 }
    this.selectedPresets = new Map([
      [0, { bank: 'A', row: 0 }],  // BASS column
      [1, { bank: 'A', row: 0 }],  // ENERGY column
      [2, { bank: 'A', row: 0 }],  // TEXTURE column
      [3, { bank: 'A', row: 0 }],  // FX column
    ]);
    this.readyPresets = new Set();  // Preset IDs currently "ready to fire" (for UI wobble)
    this._ledPulseTimers = new Map(); // column -> intervalId for pulsating LEDs

    // Category names for mapping columns to presets
    this._categories = ['BASS', 'ENERGY', 'TEXTURE', 'FX'];

    // State change callbacks (for React)
    this.onActivePresetsChange = null;
    this.onReadyPresetsChange = null; // For UI wobble state
    this.onBpmUpdate = null;
    this.onBpmLock = null;
    this.onBpmChange = null;  // For manual BPM adjustments (doesn't affect lock state)
    this.onKeyUpdate = null;
    this.onKeyLock = null;
    this.onBeat = null;
    this.onMidiConnectionChange = null;
    this.onAnnouncerToggle = null;
    this.onAnnouncement = null; // For visual announcement display in GUI
    this.onError = null;
    this.onBankChange = null;
    this.onBpmAnalysisToggle = null;  // For syncing GUI toggle when MIDI changes it
    this.onKeyAnalysisToggle = null;  // For syncing GUI toggle when MIDI changes it
    this.onAnalyzingChange = null;    // For syncing analysis button when MIDI toggles it

    // VU meter animation
    this._vuMeterInterval = null;
    this._vuMeterEnabled = false;
    this._vuAnalyser = null;
    this._vuDataArray = null;

    // BPM hold-to-repeat timers (for MIDI buttons)
    this._bpmHoldTimers = {
      minus: { timeout: null, interval: null, accelTimeout: null },
      plus: { timeout: null, interval: null, accelTimeout: null }
    };

    // Instrument button press tracking (for hold-to-turn-off feature)
    // Maps column index -> { pressTime: timestamp, presetId: string }
    this._instrumentButtonState = new Map();
    this._HOLD_THRESHOLD_MS = 1000; // 1 second hold = turn off on release

    // ============ MODULATOR SYSTEM ============
    // Row A knobs 5-8 (indices 4-7): Select modulator type per column
    // Row C knobs 1-4 (indices 0-3): Dry/wet mix per column
    // Maps column (0-3) -> { type: MODULATOR_TYPES, wet: 0-1, modulator: Modulator }
    this._columnModulators = new Map([
      [0, { type: MODULATOR_TYPES.CHORUS, wet: 0, modulator: null }],
      [1, { type: MODULATOR_TYPES.CHORUS, wet: 0, modulator: null }],
      [2, { type: MODULATOR_TYPES.CHORUS, wet: 0, modulator: null }],
      [3, { type: MODULATOR_TYPES.CHORUS, wet: 0, modulator: null }],
    ]);
  }

  /**
   * Initialize all subsystems
   */
  async init() {
    if (this.initialized) return;

    // Init audio engine first (requires user gesture)
    await this.synthEngine.init();

    // Init audio analysis
    await this.audioAnalysis.init();

    // Init MIDI (non-blocking, may not have controller)
    await this.midiController.init();

    // Init TTS
    await this.announcer.init();

    // Wire everything together
    this._wireAudioCallbacks();
    this._wireMidiCallbacks();

    this.initialized = true;
    console.log('Beatweaver orchestrator initialized');
  }

  // ============ AUDIO ANALYSIS WIRING ============

  _wireAudioCallbacks() {
    // BPM detection updates
    this.audioAnalysis.onBpmUpdate = (state) => {
      this.onBpmUpdate?.(state);
    };

    // BPM locked - sync engine + announce + update LEDs
    this.audioAnalysis.onBpmLock = (lockedBpm) => {
      this.synthEngine.setBPM(lockedBpm);
      this._announce(`BPM locked at ${Math.round(lockedBpm)}`);
      this._syncBottomLEDs(); // Light up BPM +/- buttons
      this.onBpmLock?.(lockedBpm);
    };

    // Key detection updates
    this.audioAnalysis.onKeyUpdate = (state) => {
      this.onKeyUpdate?.(state);
    };

    // Key locked - set transposition + announce
    this.audioAnalysis.onKeyLock = (lockedKey) => {
      const root = lockedKey.replace('m', '');
      this.synthEngine.setKey(root);
      this._announce(`The key is ${this._formatKeyForSpeech(lockedKey)}`);
      this.onKeyLock?.(lockedKey);
    };

    // Beat callback - sync transport + visual feedback
    this.audioAnalysis.onBeat = (beatTimeMs) => {
      if (this.audioAnalysis.bpmLocked) {
        this.synthEngine.syncToBeat(beatTimeMs);
      }
      this.onBeat?.(beatTimeMs);
    };

    // Error callback
    this.audioAnalysis.onError = (error) => {
      console.error('Audio analysis error:', error);
      this.onError?.(error);
    };
  }

  // ============ MIDI WIRING (Phase 4 Mapping) ============

  _wireMidiCallbacks() {
    const lcxl = getMidiController().constructor.LCXL;

    // ---- BUTTONS ----
    // Top buttons 0-3: Instrument presets with HOLD-TO-TURN-OFF
    //   - Quick press (<1s): Turn ON preset
    //   - Hold 1+ second then release: Turn OFF preset
    // Top buttons 4-7: Reserved
    // Bottom buttons: Function buttons (BPM +/- have hold-to-repeat)
    this.midiController.onButton = (index, isTop, velocity) => {
      console.log('[MIDI] Button:', isTop ? 'TOP' : 'BOTTOM', index, 'velocity:', velocity);
      const isPress = velocity > 0;
      const isRelease = velocity === 0;

      // Handle instrument buttons (top row 0-3) with hold-to-turn-off
      // Quick press (<1s): LAUNCH preset (turn ON only, not toggle)
      // Long press (1+s): STOP preset (turn OFF only)
      if (isTop && index < 4) {
        if (isPress) {
          // Record press time and get the preset for this column
          const presetId = this._getColumnPresetId(index);
          this._instrumentButtonState.set(index, {
            pressTime: Date.now(),
            presetId: presetId
          });
        } else if (isRelease) {
          // Check hold duration
          const state = this._instrumentButtonState.get(index);
          if (state) {
            const holdDuration = Date.now() - state.pressTime;
            if (holdDuration >= this._HOLD_THRESHOLD_MS) {
              // HELD 1+ second: Turn OFF this preset
              this._stopColumnPreset(index, state.presetId);
            } else {
              // Quick press: Turn ON (LAUNCH only, not toggle!)
              this._launchColumnPreset(index);
            }
            this._instrumentButtonState.delete(index);
          }
        }
        return;
      }

      // Handle BPM +/- buttons with hold-to-repeat (like GUI)
      if (!isTop && (index === 2 || index === 3)) {
        const direction = index === 2 ? 'minus' : 'plus';
        const delta = index === 2 ? -0.1 : 0.1;

        if (isPress) {
          this._startBpmHold(direction, delta);
        } else if (isRelease) {
          this._stopBpmHold(direction);
        }
        return;
      }

      // All other buttons only respond to press, not release
      if (isRelease) return;

      if (!isTop) {
        // Bottom row function buttons
        switch (index) {
          case 0: // Button 1: MUTE ALL
            this.stopAll();
            this._announce('All stopped');
            break;
          case 1: // Button 2: SOLO (keep only selected)
            this._soloSelected();
            break;
          // case 2 and 3 handled above with hold-to-repeat
          case 5: // Button 6: Launch/stop audio analysis
            this._toggleAnalysis();
            break;
          case 6: // Button 7: Toggle BPM analysis
            this._toggleBpmAnalysis();
            break;
          case 7: // Button 8: Toggle Key analysis
            this._toggleKeyAnalysis();
            break;
        }
      }
    };

    // ---- FADERS ----
    // Faders 0-3: Row selection per column (100-75%=row1, 75-50%=row2, etc.)
    // Fader 4 (index 4): Announcer volume
    // Fader 5 (index 5): Instrument master volume
    // Fader 6 (index 6): Global Reverb dry/wet
    // Fader 7 (index 7): Global Delay dry/wet
    this.midiController.onFader = (index, value) => {
      if (index < 4) {
        // Row selection for column (inverted: top = row 0)
        const row = Math.min(3, Math.floor((1 - value) * 4));
        this._updateSelectedRow(index, row);
      } else if (index === 4) {
        // Fader 5: Announcer volume
        this.announcer.setVolume(value);
      } else if (index === 5) {
        // Fader 6: Instrument master volume (0-1.25 range for +25% headroom)
        this.synthEngine.setMasterVolume(value * 1.25);
      } else if (index === 6) {
        // Fader 7: Global Reverb dry/wet
        this._setGlobalReverbWet(value);
      } else if (index === 7) {
        // Fader 8: Global Delay dry/wet
        this._setGlobalDelayWet(value);
      }
    };

    // ---- KNOBS ----
    // Row A (0-3): Bank selection per column (left=A, right=B)
    // Row A (4-7): Modulator selection per column (left=Chorus, mid=Phaser, right=Tremolo)
    // Row B (0-3): TTS settings (pitch, rate, volume, reverb)
    // Row B (4-7): Reserved
    // Row C (0-3): Modulator dry/wet per column
    // Row C (4-7): Reserved
    this.midiController.onKnob = (row, index, value) => {
      console.log('[MIDI] Knob:', row, index, 'value:', value.toFixed(2));

      if (row === 'A' && index < 4) {
        // Bank selection: value < 0.5 = Bank A, >= 0.5 = Bank B
        const bank = value < 0.5 ? 'A' : 'B';
        this._updateSelectedBank(index, bank);
      } else if (row === 'A' && index >= 4) {
        // Modulator selection for columns 0-3 (knobs 5-8 = indices 4-7)
        const column = index - 4;
        const newType = knobToModulatorType(value);
        this._setColumnModulatorType(column, newType);
      } else if (row === 'B' && index < 4) {
        // TTS controls (knobs 0-3)
        switch (index) {
          case 0: // TTS Pitch (0.5 to 2.0)
            const pitch = 0.5 + value * 1.5;
            this.announcer.setPitch(pitch);
            break;
          case 1: // TTS Rate/Speed (0.5 to 2.0)
            const rate = 0.5 + value * 1.5;
            this.announcer.setRate(rate);
            break;
          case 2: // TTS Volume (0 to 1)
            this.announcer.setVolume(value);
            break;
          case 3: // TTS Reverb (0 to 1)
            this.announcer.setReverb(value);
            break;
        }
      } else if (row === 'C' && index < 4) {
        // Modulator dry/wet for columns 0-3 (knobs 1-4 = indices 0-3)
        this._setColumnModulatorWet(index, value);
      }
    };

    // ---- SIDE BUTTONS ----
    // LEFT: FIRE selected presets
    // RIGHT: Reserved
    // UP: BPM + (hold-to-repeat like GUI)
    // DOWN: BPM - (hold-to-repeat like GUI)
    this.midiController.onSideButton = (button, isPress) => {
      console.log('[MIDI] Side button:', button, isPress ? 'PRESS' : 'RELEASE');

      // BPM up/down with hold-to-repeat (same as bottom row buttons)
      if (button === 'up' || button === 'down') {
        const direction = button === 'down' ? 'minus' : 'plus';
        const delta = button === 'down' ? -0.1 : 0.1;

        if (isPress) {
          this._startBpmHold(direction, delta);
        } else {
          this._stopBpmHold(direction);
        }
        return;
      }

      // Other side buttons only respond to press
      if (!isPress) return;

      switch (button) {
        case 'left':
          this._fireSelectedPresets();
          break;
        case 'right':
          // Reserved
          break;
      }
    };

    // Connection changes
    this.midiController.onConnectionChange = (connected, deviceName) => {
      if (connected) {
        this._announce('Controller connected');
        // Sync all LEDs after the epic light show completes (1500ms)
        setTimeout(() => {
          this._syncAllLEDs();
          // Also sync analysis state to GUI
          this.onAnalyzingChange?.(this.audioAnalysis.isRunning);
          this.onBpmAnalysisToggle?.(this.audioAnalysis.bpmAnalysisEnabled);
          this.onKeyAnalysisToggle?.(this.audioAnalysis.keyAnalysisEnabled);
        }, 1500);
      } else {
        this._announce('Controller disconnected');
        this._stopAllLEDPulses();
        this._stopVuMeter();
      }
      this.onMidiConnectionChange?.(connected, deviceName);
    };
  }

  // ============ PHASE 4: SELECTION HELPERS ============

  /**
   * Update selected bank for a column and refresh LED/UI
   */
  _updateSelectedBank(column, bank) {
    const current = this.selectedPresets.get(column);
    if (current.bank === bank) return; // No change

    current.bank = bank;
    this._refreshColumnSelection(column);
  }

  /**
   * Update selected row for a column and refresh LED/UI
   */
  _updateSelectedRow(column, row) {
    const current = this.selectedPresets.get(column);
    if (current.row === row) return; // No change

    current.row = row;
    this._refreshColumnSelection(column);
  }

  /**
   * Refresh LED pulse and readyPresets for a column
   */
  _refreshColumnSelection(column) {
    const { bank, row } = this.selectedPresets.get(column);
    const presetId = this._getPresetId(column, bank, row);

    // Clear old ready preset for this column
    for (const id of this.readyPresets) {
      if (this._getPresetColumn(id) === column) {
        this.readyPresets.delete(id);
      }
    }

    // Add new ready preset
    if (presetId) {
      this.readyPresets.add(presetId);
    }

    // Update LED pulse
    this._startLEDPulse(column, bank);

    // Notify React
    this.onReadyPresetsChange?.(new Set(this.readyPresets));
  }

  /**
   * Get preset ID from column, bank, and row
   */
  _getPresetId(column, bank, row) {
    const category = this._categories[column];
    // Find preset matching category, bank, and row index
    const categoryPresets = this._presets.filter(p => p.category === category && p.bank === bank);
    return categoryPresets[row]?.id || null;
  }

  /**
   * Get column index for a preset ID
   */
  _getPresetColumn(presetId) {
    const preset = this._presets.find(p => p.id === presetId);
    if (!preset) return -1;
    return this._categories.indexOf(preset.category);
  }

  /**
   * Fire (launch or stop) all selected presets
   */
  _fireSelectedPresets() {
    for (const [column, { bank, row }] of this.selectedPresets) {
      const presetId = this._getPresetId(column, bank, row);
      if (presetId) {
        if (this.activePresets.has(presetId)) {
          this.stopPreset(presetId);
        } else {
          this.launchPreset(presetId);
        }
      }
    }
  }

  /**
   * Fire (launch or stop) a single column's selected preset
   * @param {number} column - Column index (0=BASS, 1=ENERGY, 2=TEXTURE, 3=FX)
   */
  _fireColumnPreset(column) {
    const selection = this.selectedPresets.get(column);
    if (!selection) return;

    const { bank, row } = selection;
    const presetId = this._getPresetId(column, bank, row);
    if (presetId) {
      if (this.activePresets.has(presetId)) {
        this.stopPreset(presetId);
      } else {
        this.launchPreset(presetId);
      }
    }
  }

  // ============ MODULATOR CONTROLS ============

  /**
   * Set modulator type for a column
   * @param {number} column - Column index (0-3)
   * @param {number} type - MODULATOR_TYPES value (0=Chorus, 1=Phaser, 2=Tremolo)
   */
  _setColumnModulatorType(column, type) {
    const state = this._columnModulators.get(column);
    if (!state) return;

    // Skip if type hasn't changed
    if (state.type === type) return;

    const oldType = state.type;
    state.type = type;

    // Announce the change
    const modName = getModulatorName(type);
    const colName = this._categories[column] || `Column ${column + 1}`;
    this._announce(`${colName} ${modName}`);

    // Flash the Row A knob LED (indices 4-7 for columns 0-3)
    this._flashModulatorKnobLED(column, type);

    // Update modulator type in-place (preserves input connections!)
    // This is the key fix: we don't recreate, we just swap the internal effect
    if (state.modulator) {
      state.modulator.setType(type);
    }
  }

  /**
   * Flash the modulator selection knob LED to indicate type change
   * Row A knobs 5-8 (indices 4-7) control modulators for columns 0-3
   * @param {number} column - Column index (0-3)
   * @param {number} type - MODULATOR_TYPES value
   */
  _flashModulatorKnobLED(column, type) {
    if (!this.midiController.isConnected()) return;

    const lcxl = this.midiController.constructor.LCXL;
    const knobIndex = 4 + column; // Row A indices 4-7

    // Color based on modulator type: Chorus=GREEN, Phaser=AMBER, Tremolo=RED
    let color;
    switch (type) {
      case MODULATOR_TYPES.CHORUS:
        color = lcxl.LED_GREEN;
        break;
      case MODULATOR_TYPES.PHASER:
        color = lcxl.LED_AMBER;
        break;
      case MODULATOR_TYPES.TREMOLO:
        color = lcxl.LED_RED;
        break;
      default:
        color = lcxl.LED_OFF;
    }

    // Flash sequence: ON -> OFF -> ON -> steady
    this.midiController.setKnobRowALED(knobIndex, color);
    setTimeout(() => this.midiController.setKnobRowALED(knobIndex, lcxl.LED_OFF), 100);
    setTimeout(() => this.midiController.setKnobRowALED(knobIndex, color), 200);
    setTimeout(() => this.midiController.setKnobRowALED(knobIndex, color), 300);
  }

  /**
   * Set modulator dry/wet for a column
   * @param {number} column - Column index (0-3)
   * @param {number} wet - Wet amount 0-1 (0=dry, 1=full effect)
   */
  _setColumnModulatorWet(column, wet) {
    const state = this._columnModulators.get(column);
    if (!state) return;

    state.wet = wet;

    // Apply to modulator if it exists
    if (state.modulator) {
      state.modulator.setWet(wet);
    }

    // Update Row C knob LED to show wet level
    this._updateModulatorWetLED(column, wet);
  }

  /**
   * Update Row C knob LED to show modulator wet level
   * Row C knobs 1-4 (indices 0-3) control wet for columns 0-3
   * @param {number} column - Column index (0-3)
   * @param {number} wet - Wet level 0-1
   */
  _updateModulatorWetLED(column, wet) {
    if (!this.midiController.isConnected()) return;

    const lcxl = this.midiController.constructor.LCXL;

    // Color based on wet level: OFF (dry) -> GREEN_LOW (low) -> AMBER (mid) -> RED (high)
    let color;
    if (wet < 0.1) {
      color = lcxl.LED_OFF;
    } else if (wet < 0.33) {
      color = lcxl.LED_GREEN_LOW;
    } else if (wet < 0.66) {
      color = lcxl.LED_AMBER;
    } else {
      color = lcxl.LED_RED;
    }

    this.midiController.setKnobRowCLED(column, color);
  }

  /**
   * Get or create modulator for a column
   * Returns existing modulator if one already exists (preserves connections)
   * Only creates a new modulator if one doesn't exist yet
   */
  _ensureColumnModulator(column, destination) {
    const state = this._columnModulators.get(column);
    if (!state) return null;

    // Return existing modulator if one exists (preserves audio connections!)
    if (state.modulator) {
      return state.modulator;
    }

    // Create new modulator only if one doesn't exist
    state.modulator = createModulator(state.type, destination);
    state.modulator.setWet(state.wet);

    return state.modulator;
  }

  /**
   * Clean up modulator for a column (called when preset stops)
   */
  _disposeColumnModulator(column) {
    const state = this._columnModulators.get(column);
    if (!state || !state.modulator) return;

    state.modulator.dispose();
    state.modulator = null;
  }

  // ============ GLOBAL EFFECTS CONTROLS ============

  /**
   * Set global reverb wet amount
   * @param {number} wet - 0 = dry, 1 = full wet
   */
  _setGlobalReverbWet(wet) {
    if (this.synthEngine.reverbBus) {
      // The reverb bus has wet fixed at 1 (full wet)
      // Control mix by adjusting the send gains on each instrument
      // For now, we'll adjust the reverb's own wet parameter
      this.synthEngine.reverbBus.wet.value = wet;
    }
  }

  /**
   * Set global delay wet amount
   * @param {number} wet - 0 = dry, 1 = full wet
   */
  _setGlobalDelayWet(wet) {
    if (this.synthEngine.delayBus) {
      this.synthEngine.delayBus.wet.value = wet;
    }
  }

  /**
   * Get the preset ID for the currently selected preset in a column
   * @param {number} column - Column index (0=BASS, 1=ENERGY, 2=TEXTURE, 3=FX)
   * @returns {string|null} Preset ID or null
   */
  _getColumnPresetId(column) {
    const selection = this.selectedPresets.get(column);
    if (!selection) return null;

    const { bank, row } = selection;
    return this._getPresetId(column, bank, row);
  }

  /**
   * Toggle a preset in a column (short press behavior)
   * Short press when OFF = turn ON
   * Short press when ON = turn OFF
   * @param {number} column - Column index
   */
  _launchColumnPreset(column) {
    const selection = this.selectedPresets.get(column);
    if (!selection) return;

    const { bank, row } = selection;
    const presetId = this._getPresetId(column, bank, row);
    if (presetId) {
      // Short press = TOGGLE (on->off or off->on)
      if (this.activePresets.has(presetId)) {
        this.stopPreset(presetId);
      } else {
        this.launchPreset(presetId);
      }
    }
  }

  /**
   * Stop a specific preset in a column (for hold-to-turn-off)
   * @param {number} column - Column index
   * @param {string} presetId - Preset ID to stop
   */
  _stopColumnPreset(column, presetId) {
    if (presetId && this.activePresets.has(presetId)) {
      this.stopPreset(presetId);
      this._announce('Off');
    }
  }

  // ============ ANNOUNCEMENT SYSTEM ============

  /**
   * Announce text via TTS AND visual display
   * @param {string} text - Text to announce
   * @param {boolean} priority - If true, clears queue and speaks immediately
   */
  _announce(text, priority = false) {
    // TTS announcement
    this.announcer.announce(text, priority);
    // Visual announcement callback for GUI
    this.onAnnouncement?.(text);
  }

  /**
   * Solo: Stop all presets except currently selected ones
   */
  _soloSelected() {
    const selectedIds = new Set();
    for (const [column, { bank, row }] of this.selectedPresets) {
      const presetId = this._getPresetId(column, bank, row);
      if (presetId) selectedIds.add(presetId);
    }

    // Stop all presets that are not selected
    for (const presetId of this.activePresets) {
      if (!selectedIds.has(presetId)) {
        this.stopPreset(presetId);
      }
    }
    this._announce('Solo');
  }

  /**
   * Toggle audio analysis on/off
   */
  async _toggleAnalysis() {
    if (this.audioAnalysis.isRunning) {
      this.audioAnalysis.stopAnalysis();
      this._announce('Analysis stopped');
      this._stopVuMeter();
      this._syncBottomLEDs();
      this.onAnalyzingChange?.(false);
    } else {
      const started = await this.audioAnalysis.startAnalysis();
      if (started) {
        this._announce('Analysis started');
        this._startVuMeter();
        this._syncBottomLEDs();
        this.onAnalyzingChange?.(true);
      } else {
        this._announce('Could not start analysis');
      }
    }
  }

  /**
   * Toggle BPM analysis on/off (Button 7)
   */
  _toggleBpmAnalysis() {
    this.audioAnalysis.bpmAnalysisEnabled = !this.audioAnalysis.bpmAnalysisEnabled;
    const enabled = this.audioAnalysis.bpmAnalysisEnabled;
    const mode = enabled ? 'on' : 'off';
    this._announce(`BPM analysis ${mode}`);
    this._syncBottomLEDs();
    // Notify React to update GUI toggle
    this.onBpmAnalysisToggle?.(enabled);
  }

  /**
   * Toggle Key analysis on/off (Button 8)
   */
  _toggleKeyAnalysis() {
    this.audioAnalysis.keyAnalysisEnabled = !this.audioAnalysis.keyAnalysisEnabled;
    const enabled = this.audioAnalysis.keyAnalysisEnabled;
    const mode = enabled ? 'on' : 'off';
    this._announce(`Key analysis ${mode}`);
    this._syncBottomLEDs();
    // Notify React to update GUI toggle
    this.onKeyAnalysisToggle?.(enabled);
  }

  /**
   * Adjust BPM by delta - works whether locked or not
   * @param {number} delta - Amount to change (can be fractional like 0.1)
   * @param {boolean} silent - If true, don't announce (used for hold-repeat)
   */
  _adjustBpm(delta, silent = false) {
    // Get current BPM from synth engine (works whether locked or not)
    const currentBpm = this.synthEngine.bpm || 120;
    const newBpm = Math.max(30, Math.min(300, currentBpm + delta));

    // Update synth engine
    this.synthEngine.setBPM(newBpm);

    // If BPM was locked, update the locked value too
    if (this.audioAnalysis.bpmLocked) {
      this.audioAnalysis.lockedBpm = newBpm;
    }

    // Only announce on significant changes (every 1 BPM) to avoid spam
    if (!silent && Math.floor(newBpm) !== Math.floor(currentBpm)) {
      this._announce(`BPM ${Math.round(newBpm)}`);
    }

    // Notify GUI of BPM change (without affecting lock state!)
    this.onBpmChange?.(newBpm);
  }

  /**
   * Start BPM hold-to-repeat (called on button press)
   * Same behavior as GUI: 0.1 increments, 120ms initial rate, accelerates after 1s
   */
  _startBpmHold(direction, delta) {
    const timers = this._bpmHoldTimers[direction];
    const INITIAL_DELAY = 120; // ms between repeats

    // Clear any existing timers SILENTLY (don't announce when starting a new hold)
    this._stopBpmHold(direction, true);

    // Immediate first action
    this._adjustBpm(delta, true);

    // Start repeating after initial delay (400ms before repeat starts)
    timers.timeout = setTimeout(() => {
      // Start at normal speed
      timers.interval = setInterval(() => this._adjustBpm(delta, true), INITIAL_DELAY);

      // After 1 second of holding, double the speed
      timers.accelTimeout = setTimeout(() => {
        if (timers.interval) {
          clearInterval(timers.interval);
          timers.interval = setInterval(() => this._adjustBpm(delta, true), INITIAL_DELAY / 2);
        }
      }, 1000);
    }, 400);
  }

  /**
   * Stop BPM hold-to-repeat (called on button release)
   * @param {boolean} silent - If true, don't announce (used when clearing timers at start of new hold)
   */
  _stopBpmHold(direction, silent = false) {
    const timers = this._bpmHoldTimers[direction];

    // Check if there were actually active timers (meaning user was holding)
    const wasHolding = timers.timeout !== null || timers.interval !== null;

    if (timers.timeout) clearTimeout(timers.timeout);
    if (timers.interval) clearInterval(timers.interval);
    if (timers.accelTimeout) clearTimeout(timers.accelTimeout);
    timers.timeout = null;
    timers.interval = null;
    timers.accelTimeout = null;

    // Only announce final BPM when user RELEASES button (not when clearing at start of hold)
    if (!silent && wasHolding) {
      const currentBpm = this.synthEngine.bpm || 120;
      this._announce(`BPM ${currentBpm.toFixed(1)}`);
    }
  }

  // ============ PHASE 4: LED PULSE ANIMATION ============

  /**
   * Start pulsing LED for a column
   */
  _startLEDPulse(column, bank) {
    this._stopLEDPulse(column);

    const lcxl = this.midiController.constructor.LCXL;
    const colorHigh = bank === 'A' ? lcxl.LED_GREEN : lcxl.LED_AMBER;
    const colorLow = bank === 'A' ? lcxl.LED_GREEN_LOW : lcxl.LED_AMBER_LOW;

    let phase = 0;
    const timer = setInterval(() => {
      const color = (phase++ % 2 === 0) ? colorHigh : colorLow;
      this.midiController.setTopLED(column, color);
    }, 300);

    this._ledPulseTimers.set(column, timer);
  }

  /**
   * Stop pulsing LED for a column
   */
  _stopLEDPulse(column) {
    if (this._ledPulseTimers.has(column)) {
      clearInterval(this._ledPulseTimers.get(column));
      this._ledPulseTimers.delete(column);
      this.midiController.setTopLED(column, this.midiController.constructor.LCXL.LED_OFF);
    }
  }

  /**
   * Stop all LED pulses
   */
  _stopAllLEDPulses() {
    for (const [column, timer] of this._ledPulseTimers) {
      clearInterval(timer);
    }
    this._ledPulseTimers.clear();
  }

  // ============ PRESET CONTROL ============

  /**
   * Launch a preset by ID
   * Routes audio through the column's modulator for per-column effects
   * @param {string} presetId
   */
  launchPreset(presetId) {
    // Debounce: ignore rapid duplicate launches (MIDI can double-trigger)
    const now = Date.now();
    const lastLaunch = this._lastPresetLaunch.get(presetId) || 0;
    if (now - lastLaunch < this._presetDebounceMs) {
      return; // Too soon, ignore
    }
    this._lastPresetLaunch.set(presetId, now);

    // If already playing, toggle off
    if (this.activePresets.has(presetId)) {
      this.stopPreset(presetId);
      return;
    }

    const preset = this._presets.find(p => p.id === presetId);
    if (!preset) return;

    // Set launching LED (amber)
    const bankIndex = this._presets.indexOf(preset) - this.presetBank * 8;
    if (bankIndex >= 0 && bankIndex < 8) {
      this.midiController.setLaunchingLED(bankIndex);
    }

    // Announce preset name. Field precedence:
    //   preset.fire        — long-form DJ-talk fire line ("Trance Gate — open.") from the
    //                        2026-04-30 design handoff. Speaks on click/MIDI fire today;
    //                        the future arm-then-fire UI also uses this on FIRE.
    //   preset.announcement — legacy short label ("Trance gate activated"). Kept as fallback
    //                        for any preset (or future custom preset) that hasn't been
    //                        upgraded to the new fire/cue copy.
    //   preset.name         — last-resort fallback.
    const announceText = preset.fire || preset.announcement || preset.name;
    if (announceText) {
      this._announce(announceText);
    }

    // Get column for this preset (BASS=0, ENERGY=1, TEXTURE=2, FX=3)
    const column = this._getPresetColumn(presetId);

    // Get or create modulator for this column (routes to masterGain)
    // Instruments connect to modulator.input (stable across effect type changes)
    let destination = null;
    if (column >= 0 && column < 4) {
      const modulator = this._ensureColumnModulator(column, this.synthEngine.masterGain);
      if (modulator) {
        destination = modulator.input;  // Connect to INPUT, not effect!
      }
    }

    // Launch through synth engine, routing through column modulator if available
    const started = this.synthEngine.playPreset(presetId, destination);
    if (started) {
      this.activePresets.add(presetId);
      this._syncLEDs();
      this.onActivePresetsChange?.(new Set(this.activePresets));
    }
  }

  /**
   * Stop a preset by ID
   * @param {string} presetId
   */
  stopPreset(presetId) {
    // No debounce here - stopPreset is called from launchPreset for toggle behavior
    // and must work immediately. MIDI double-triggers are handled in launchPreset.
    this.synthEngine.stopPreset(presetId);
    this.activePresets.delete(presetId);
    this._syncLEDs();
    this.onActivePresetsChange?.(new Set(this.activePresets));
  }

  /**
   * Stop all active presets
   */
  stopAll() {
    this.synthEngine.stopAllPresets();
    this.synthEngine.stopAll();
    this.activePresets.clear();
    this._syncLEDs();
    this.onActivePresetsChange?.(new Set());
  }

  /**
   * Apply a control value to a preset's instrument
   */
  _setPresetControl(presetId, controlName, value) {
    const preset = this._presets.find(p => p.id === presetId);
    if (!preset || !preset.controls[controlName]) return;

    const control = preset.controls[controlName];
    const scaledValue = control.min + value * (control.max - control.min);

    // Apply to synth engine based on param type
    switch (control.param) {
      case 'volume':
        this.synthEngine.setInstrumentVolume(preset.instrument, value);
        break;
      case 'filterFreq':
        this.synthEngine.setFilterCutoff(value);
        break;
      case 'filterQ':
        this.synthEngine.setFilterResonance(value);
        break;
      default:
        console.log(`Control ${controlName}=${scaledValue} (unhandled param: ${control.param})`);
    }
  }

  // ============ BANK SWITCHING ============

  /**
   * Switch to next preset bank
   */
  setBankUp() {
    const maxBank = Math.ceil(this._presets.length / 8) - 1;
    if (this.presetBank < maxBank) {
      this.presetBank++;
      this._syncLEDs();
      this._announce(`Bank ${this.presetBank + 1}`);
      this.onBankChange?.(this.presetBank);
    }
  }

  /**
   * Switch to previous preset bank
   */
  setBankDown() {
    if (this.presetBank > 0) {
      this.presetBank--;
      this._syncLEDs();
      this._announce(`Bank ${this.presetBank + 1}`);
      this.onBankChange?.(this.presetBank);
    }
  }

  // ============ AUDIO ANALYSIS CONTROLS ============

  /**
   * Start listening to audio input
   */
  async startAnalysis(deviceId = null) {
    const result = await this.audioAnalysis.startAnalysis(deviceId);
    if (result) {
      this._startVuMeter();
      this._syncBottomLEDs();
    }
    return result;
  }

  /**
   * Stop audio analysis
   */
  stopAnalysis() {
    this.audioAnalysis.stopAnalysis();
    this._stopVuMeter();
    this._syncBottomLEDs();
  }

  /**
   * Get available audio input devices
   */
  async getAudioDevices() {
    return this.audioAnalysis.getAudioDevices();
  }

  /**
   * Manually set BPM (unlocks detection)
   */
  setBPM(bpm) {
    this.audioAnalysis.unlockBpm();
    this.synthEngine.setBPM(bpm);
  }

  /**
   * Manually set key (unlocks detection)
   */
  setKey(key) {
    this.audioAnalysis.unlockKey();
    this.synthEngine.setKey(key);
    this._announce(`The key is ${this._formatKeyForSpeech(key)}`);
  }

  /**
   * Unlock BPM detection
   */
  unlockBpm() {
    this.audioAnalysis.unlockBpm();
  }

  /**
   * Unlock key detection
   */
  unlockKey() {
    this.audioAnalysis.unlockKey();
  }

  /**
   * Unlock both
   */
  unlockAll() {
    this.audioAnalysis.unlockAll();
  }

  /**
   * Toggle BPM lock override (for side button)
   */
  toggleBpmLockOverride() {
    if (this.audioAnalysis.bpmLocked) {
      this.audioAnalysis.unlockBpm();
      this._announce('BPM unlocked');
    }
  }

  /**
   * Enable or disable BPM analysis
   * @param {boolean} enabled
   * @param {boolean} silent - If true, skip announcement (used during settings restore)
   */
  setBpmAnalysisEnabled(enabled, silent = false) {
    this.audioAnalysis.bpmAnalysisEnabled = enabled;
    if (!silent) {
      this._announce(`BPM analysis ${enabled ? 'on' : 'off'}`);
    }
    this._syncBottomLEDs();
  }

  /**
   * Enable or disable Key analysis
   * @param {boolean} enabled
   * @param {boolean} silent - If true, skip announcement (used during settings restore)
   */
  setKeyAnalysisEnabled(enabled, silent = false) {
    this.audioAnalysis.keyAnalysisEnabled = enabled;
    if (!silent) {
      this._announce(`Key analysis ${enabled ? 'on' : 'off'}`);
    }
    this._syncBottomLEDs();
  }

  /**
   * Adjust BPM by delta (public API for GUI)
   * @param {number} delta - Amount to adjust (+/-)
   */
  adjustBpm(delta) {
    this._adjustBpm(delta);
  }

  // ============ ANNOUNCER CONTROLS ============

  /**
   * Toggle announcer on/off
   */
  toggleAnnouncer() {
    const enabled = this.announcer.toggle();
    this.onAnnouncerToggle?.(enabled);

    // Use priority to ensure this one is heard even if toggling on
    if (enabled) {
      this._announce('Announcer on', true);
    }
  }

  /**
   * Set announcer voice pitch
   * @param {number} value - 0.5 to 2.0
   */
  setAnnouncerPitch(value) {
    this.announcer.setPitch(value);
  }

  /**
   * Set announcer voice rate (speed)
   * @param {number} value - 0.5 to 2.0
   */
  setAnnouncerRate(value) {
    this.announcer.setRate(value);
  }

  /**
   * Set announcer reverb amount
   * @param {number} value - 0-1 normalized
   */
  setAnnouncerReverb(value) {
    this.announcer.setReverb(value);
  }

  /**
   * Set announcer echo amount
   * @param {number} value - 0-1 normalized
   */
  setAnnouncerEcho(value) {
    this.announcer.setEcho(value);
  }

  /**
   * Set announcer volume
   * @param {number} value - 0-1 normalized
   */
  setAnnouncerVolume(value) {
    this.announcer.setVolume(value);
  }

  /**
   * Set announcer voice by URI
   * @param {string} voiceURI
   * @returns {boolean} Whether voice was successfully set
   */
  setAnnouncerVoice(voiceURI) {
    return this.announcer.setVoice(voiceURI);
  }

  /**
   * Get available TTS voices
   * @returns {Array}
   */
  getAnnouncerVoices() {
    return this.announcer.getVoices();
  }

  /**
   * Test the announcer with current settings
   */
  testAnnouncer() {
    try {
      this._announce('Testing voice settings', true);
    } catch (err) {
      console.error('testAnnouncer failed:', err);
    }
  }

  /**
   * Set TTS mode - user chooses Kobold or Browser
   * @param {'browser' | 'kobold'} mode
   */
  setTTSMode(mode) {
    this.announcer.setTTSMode(mode);
  }

  /**
   * Get current TTS mode
   * @returns {'browser' | 'kobold'}
   */
  getTTSMode() {
    return this.announcer.getTTSMode();
  }

  /**
   * Set Kobold TTS server URL
   * @param {string} url - Full URL (e.g. 'http://192.168.0.100:5001')
   * @returns {Promise<boolean>} Whether Kobold is available at the new URL
   */
  async setKoboldUrl(url) {
    return this.announcer.setKoboldUrl(url);
  }

  // ============ INSTRUMENT MASTER CONTROLS ============

  /**
   * Set master instrument volume
   * @param {number} value - 0-1 normalized
   */
  setInstrumentMasterVolume(value) {
    this.synthEngine.setMasterVolume(value);
  }

  /**
   * Set fade-in time for all instruments
   * @param {number} seconds - 0 to 5
   */
  setFadeIn(seconds) {
    this.synthEngine.setFadeIn(seconds);
  }

  /**
   * Set fade-out time for all instruments
   * @param {number} seconds - 0 to 5
   */
  setFadeOut(seconds) {
    this.synthEngine.setFadeOut(seconds);
  }

  // ============ HELPERS ============

  /**
   * Format a key string for TTS (e.g. "C#" -> "C sharp", "Am" -> "A minor")
   */
  _formatKeyForSpeech(key) {
    const isMinor = key.endsWith('m');
    const root = isMinor ? key.slice(0, -1) : key;
    const spoken = root.replace('#', ' sharp').replace('b', ' flat');
    return isMinor ? `${spoken} minor` : spoken;
  }

  // ============ LED SYNC ============

  /**
   * Sync LED state to match active presets in current bank
   */
  _syncLEDs() {
    if (!this.midiController.isConnected()) return;

    const lcxl = this.midiController.constructor.LCXL;
    const bankStart = this.presetBank * 8;
    const bankPresets = this._presets.slice(bankStart, bankStart + 8);

    const activeInBank = new Set();
    bankPresets.forEach((preset, i) => {
      if (this.activePresets.has(preset.id)) {
        activeInBank.add(i);
      }
    });

    this.midiController.setPresetLEDs(activeInBank);
  }

  /**
   * Sync bottom row button LEDs based on current state
   * Color scheme: MUTE=red, SOLO=yellow, Analysis functions=yellow when enabled
   */
  _syncBottomLEDs() {
    if (!this.midiController.isConnected()) return;

    const lcxl = this.midiController.constructor.LCXL;

    // Bottom 1 (index 0): MUTE - always dim red (danger)
    this.midiController.setBottomLED(0, lcxl.LED_RED_LOW);

    // Bottom 2 (index 1): SOLO - dim yellow
    this.midiController.setBottomLED(1, lcxl.LED_YELLOW);

    // Bottom 3 (index 2): BPM -5 - AMBER when BPM locked
    this.midiController.setBottomLED(2,
      this.audioAnalysis.bpmLocked ? lcxl.LED_AMBER : lcxl.LED_OFF);

    // Bottom 4 (index 3): BPM +5 - AMBER when BPM locked
    this.midiController.setBottomLED(3,
      this.audioAnalysis.bpmLocked ? lcxl.LED_AMBER : lcxl.LED_OFF);

    // Bottom 5 (index 4): Reserved - OFF
    this.midiController.setBottomLED(4, lcxl.LED_OFF);

    // Bottom 6 (index 5): Analysis - yellow if running
    this.midiController.setBottomLED(5,
      this.audioAnalysis.isRunning ? lcxl.LED_YELLOW : lcxl.LED_OFF);

    // Bottom 7 (index 6): BPM analysis - yellow if enabled
    this.midiController.setBottomLED(6,
      this.audioAnalysis.bpmAnalysisEnabled ? lcxl.LED_YELLOW : lcxl.LED_OFF);

    // Bottom 8 (index 7): Key analysis - yellow if enabled
    this.midiController.setBottomLED(7,
      this.audioAnalysis.keyAnalysisEnabled ? lcxl.LED_YELLOW : lcxl.LED_OFF);
  }

  /**
   * Sync knob ring LEDs based on function assignments
   * Color scheme:
   *   Row A 0-3: Bank selection (GREEN)
   *   Row A 4-7: Modulator type (color based on type)
   *   Row B 0-3: TTS controls (YELLOW)
   *   Row B 4-7: Reserved (OFF)
   *   Row C 0-3: Modulator wet level (color based on level)
   *   Row C 4-7: Reserved (OFF) or VU meter when active
   *
   * NOTE: Knob ring LEDs are NOT supported on all Launch Control XL units!
   * Many LCXL models only have button LEDs, not knob ring LEDs.
   * This is a hardware limitation, not a software bug.
   */
  _syncKnobLEDs() {
    if (!this.midiController.isConnected()) return;

    const lcxl = this.midiController.constructor.LCXL;

    console.log('[KNOB LED] Syncing knob LEDs via SysEx...');

    // Build color array for all 24 knobs based on their functions
    // SysEx indices: Row A = 0-7, Row B = 8-15, Row C = 16-23
    const colors = new Array(24).fill(lcxl.LED_OFF);

    // Row A (indices 0-3): Bank selection (GREEN)
    colors[0] = lcxl.LED_GREEN;
    colors[1] = lcxl.LED_GREEN;
    colors[2] = lcxl.LED_GREEN;
    colors[3] = lcxl.LED_GREEN;

    // Row A (indices 4-7): Modulator type per column
    for (let col = 0; col < 4; col++) {
      const state = this._columnModulators.get(col);
      if (state) {
        let color;
        switch (state.type) {
          case MODULATOR_TYPES.CHORUS:
            color = lcxl.LED_GREEN;
            break;
          case MODULATOR_TYPES.PHASER:
            color = lcxl.LED_AMBER;
            break;
          case MODULATOR_TYPES.TREMOLO:
            color = lcxl.LED_RED;
            break;
          default:
            color = lcxl.LED_OFF;
        }
        colors[4 + col] = color;
      }
    }

    // Row B (indices 8-11): TTS controls (YELLOW)
    colors[8] = lcxl.LED_YELLOW;
    colors[9] = lcxl.LED_YELLOW;
    colors[10] = lcxl.LED_YELLOW;
    colors[11] = lcxl.LED_YELLOW;
    // 12-15 already OFF

    // Row C (indices 16-19): Modulator wet level per column
    for (let col = 0; col < 4; col++) {
      const state = this._columnModulators.get(col);
      if (state) {
        let color;
        if (state.wet < 0.1) {
          color = lcxl.LED_OFF;
        } else if (state.wet < 0.33) {
          color = lcxl.LED_GREEN_LOW;
        } else if (state.wet < 0.66) {
          color = lcxl.LED_AMBER;
        } else {
          color = lcxl.LED_RED;
        }
        colors[16 + col] = color;
      }
    }
    // 20-23 already OFF (reserved or VU meter)

    // Send all 24 knob colors in one batch
    this.midiController.setAllKnobLEDs(colors);

    console.log('[KNOB LED] Knob LEDs synced: A[0-3]=GREEN (bank), A[4-7]=modulator type, B[0-3]=YELLOW (TTS), C[0-3]=wet level');
  }

  /**
   * Sync all LEDs (called on connection)
   */
  _syncAllLEDs() {
    this._syncLEDs();       // Top row preset LEDs
    this._syncBottomLEDs(); // Bottom row function LEDs
    this._syncKnobLEDs();   // Knob ring LEDs
  }

  // ============ VU METER (Row C Knob LEDs 4-7) ============
  // Note: Row C knobs 0-3 are reserved for modulator wet display

  /**
   * Start VU meter animation on Row C knobs 4-7 (indices 4-7)
   * Uses Tone.js master output level
   * Knobs 0-3 are reserved for modulator wet display
   */
  _startVuMeter() {
    if (this._vuMeterInterval) return; // Already running
    if (!this.midiController.isConnected()) return;

    const lcxl = this.midiController.constructor.LCXL;

    // Create analyser from Tone.js destination
    try {
      if (Tone.getDestination && Tone.context) {
        this._vuAnalyser = Tone.context.createAnalyser();
        this._vuAnalyser.fftSize = 256;
        this._vuDataArray = new Uint8Array(this._vuAnalyser.frequencyBinCount);
        // Connect Tone.js destination to our analyser
        Tone.connect(Tone.getDestination(), this._vuAnalyser);
      }
    } catch (err) {
      console.warn('[VU] Could not create analyser:', err);
    }

    this._vuMeterEnabled = true;

    // Update VU meter every 50ms
    this._vuMeterInterval = setInterval(() => {
      if (!this._vuMeterEnabled || !this.midiController.isConnected()) {
        this._stopVuMeter();
        return;
      }

      let level = 0;

      // Get level from analyser
      if (this._vuAnalyser && this._vuDataArray) {
        this._vuAnalyser.getByteFrequencyData(this._vuDataArray);
        // Calculate RMS level from frequency data
        let sum = 0;
        for (let i = 0; i < this._vuDataArray.length; i++) {
          sum += this._vuDataArray[i];
        }
        level = sum / this._vuDataArray.length / 255; // 0-1 normalized
      } else {
        // Fallback: use synth engine's approximate level if no analyser
        level = this.synthEngine.getApproximateLevel?.() || 0;
      }

      // Map level (0-1) to 4 LEDs (Row C knobs 4-7)
      // level 0 = 0 LEDs lit, level 1 = all 4 lit
      const numLit = Math.ceil(level * 4);

      for (let i = 0; i < 4; i++) {
        const knobIndex = 4 + i; // Row C indices 4-7
        if (i < numLit) {
          // Color based on level position: green -> yellow -> red
          let color;
          if (i < 2) {
            color = lcxl.LED_GREEN;
          } else if (i < 3) {
            color = lcxl.LED_YELLOW;
          } else {
            color = lcxl.LED_RED;
          }
          this.midiController.setKnobRowCLED(knobIndex, color);
        } else {
          this.midiController.setKnobRowCLED(knobIndex, lcxl.LED_OFF);
        }
      }
    }, 50);
  }

  /**
   * Stop VU meter animation
   */
  _stopVuMeter() {
    if (this._vuMeterInterval) {
      clearInterval(this._vuMeterInterval);
      this._vuMeterInterval = null;
    }
    this._vuMeterEnabled = false;

    // Turn off VU meter LEDs only (Row C knobs 4-7)
    // Don't touch knobs 0-3 as they show modulator wet levels
    if (this.midiController.isConnected()) {
      const lcxl = this.midiController.constructor.LCXL;
      for (let i = 4; i < 8; i++) {
        this.midiController.setKnobRowCLED(i, lcxl.LED_OFF);
      }
    }
  }

  // ============ STATE ============

  /**
   * Get full state for React
   */
  getState() {
    return {
      initialized: this.initialized,
      activePresets: new Set(this.activePresets),
      presetBank: this.presetBank,
      analysis: this.audioAnalysis.getState(),
      midi: this.midiController.getState(),
      announcer: this.announcer.getState(),
    };
  }

  /**
   * Get presets for current bank (8 presets)
   */
  getCurrentBankPresets() {
    const start = this.presetBank * 8;
    return this._presets.slice(start, start + 8);
  }

  /**
   * Clean up all resources
   */
  dispose() {
    this._stopVuMeter();
    this._stopAllLEDPulses();
    this.stopAll();
    this.audioAnalysis.dispose();
    this.synthEngine.dispose();
    this.midiController.dispose();
    this.announcer.dispose();
    this._lastPresetLaunch.clear();
    this.initialized = false;
    this._disposed = true;
  }
}

// Singleton - recreates if previous instance was disposed
let instance = null;

export function getBeatweaver() {
  if (!instance || instance._disposed) {
    instance = new Beatweaver();
  }
  return instance;
}

export default Beatweaver;
