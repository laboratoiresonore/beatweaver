import * as Tone from 'tone';

/**
 * Transposer - Key transposition utilities
 * All patterns are defined in C, transposed at runtime to match detected/selected key
 */
export class Transposer {
  // Semitone intervals from C
  static INTERVALS = {
    'C': 0, 'C#': 1, 'Db': 1,
    'D': 2, 'D#': 3, 'Eb': 3,
    'E': 4,
    'F': 5, 'F#': 6, 'Gb': 6,
    'G': 7, 'G#': 8, 'Ab': 8,
    'A': 9, 'A#': 10, 'Bb': 10,
    'B': 11
  };

  // Common scale patterns (intervals from root)
  static SCALES = {
    major: [0, 2, 4, 5, 7, 9, 11],
    minor: [0, 2, 3, 5, 7, 8, 10],
    pentatonic: [0, 2, 4, 7, 9],
    blues: [0, 3, 5, 6, 7, 10]
  };

  /**
   * Transpose a single note
   * @param {string} note - Note in C (e.g., 'C2', 'E3')
   * @param {string} fromKey - Source key (usually 'C')
   * @param {string} toKey - Target key
   * @returns {string} - Transposed note
   */
  static transpose(note, fromKey = 'C', toKey = 'C') {
    if (!note || note === 'x' || note === null) return note;

    const interval = this.INTERVALS[toKey] - this.INTERVALS[fromKey];
    if (interval === 0) return note;

    return Tone.Frequency(note).transpose(interval).toNote();
  }

  /**
   * Transpose an array of notes (chord)
   * @param {string[]} notes - Array of notes
   * @param {string} fromKey - Source key
   * @param {string} toKey - Target key
   * @returns {string[]} - Transposed notes
   */
  static transposeChord(notes, fromKey = 'C', toKey = 'C') {
    if (!Array.isArray(notes)) return this.transpose(notes, fromKey, toKey);
    return notes.map(n => this.transpose(n, fromKey, toKey));
  }

  /**
   * Transpose an entire pattern
   * @param {Array} pattern - Pattern array (can contain notes, chords, nulls, 'x')
   * @param {string} fromKey - Source key
   * @param {string} toKey - Target key
   * @returns {Array} - Transposed pattern
   */
  static transposePattern(pattern, fromKey = 'C', toKey = 'C') {
    return pattern.map(item => {
      if (item === null || item === 'x') return item;
      if (Array.isArray(item)) return this.transposeChord(item, fromKey, toKey);
      return this.transpose(item, fromKey, toKey);
    });
  }

  /**
   * Get the relative minor of a major key
   * @param {string} majorKey - Major key
   * @returns {string} - Relative minor
   */
  static getRelativeMinor(majorKey) {
    const minorInterval = -3; // 3 semitones down
    const rootNote = majorKey.replace('m', '');
    return this.transpose(rootNote + '4', 'C', rootNote).slice(0, -1) + 'm';
  }

  /**
   * Check if two keys are harmonically compatible (same key or relative)
   * @param {string} key1 - First key
   * @param {string} key2 - Second key
   * @returns {boolean} - Whether keys are compatible
   */
  static areCompatible(key1, key2) {
    if (key1 === key2) return true;

    // Check if one is relative minor/major of the other
    const key1Root = key1.replace('m', '');
    const key2Root = key2.replace('m', '');
    const key1IsMinor = key1.includes('m');
    const key2IsMinor = key2.includes('m');

    // Relative minor is 3 semitones below major
    const interval = Math.abs(this.INTERVALS[key1Root] - this.INTERVALS[key2Root]);
    return (interval === 3 || interval === 9) && (key1IsMinor !== key2IsMinor);
  }

  /**
   * Get a safe pentatonic scale for the given key
   * (Pentatonic always sounds good - no "wrong" notes)
   * @param {string} key - Target key
   * @param {number} octave - Starting octave
   * @returns {string[]} - Array of notes in the pentatonic scale
   */
  static getPentatonic(key, octave = 3) {
    const root = key.replace('m', '');
    const isMinor = key.includes('m');
    const scale = isMinor ? [0, 3, 5, 7, 10] : [0, 2, 4, 7, 9]; // Minor vs Major pentatonic

    return scale.map(interval => {
      const note = this.transpose(`C${octave}`, 'C', root);
      return Tone.Frequency(note).transpose(interval).toNote();
    });
  }
}

export default Transposer;
