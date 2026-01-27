# Switch Angel & Strudel Live Coding Research

## Artist Profile: Switch Angel

**Name:** Jade (Rose) Rowland (GitHub: @daslyfe)
**Location:** East Coast, USA
**Genre:** Experimental electronic pop, algorave, breakcore, trance, hyperpop
**Platform:** Strudel live coding environment

### Background
- 18 years of learning, collaborating, and performing electronic and computer music
- Active contributor to Strudel development (core team member)
- Creates music with livecode tools and custom algorithms
- Notable for "exploring sounds and sequences that could previously only be heard in dreams"
- 110K+ monthly Spotify listeners

### Key Contributions to Strudel Development
- Created Pulse Oscillator with variable PWM (PR #1304)
- Added max polyphony feature for superdough (PR #1317)
- Fixed docs for the beat function (PR #1248)
- Udels (MultiFrame Strudel) Revisited (PR #1132)
- Created audio target selector for OSC/Superdirt (PR #1160)
- Theme improvements (PR #1295)
- Maintains StrudelDirt fork for SuperCollider integration

### Discography
- **Switch Angel** (2024) - Debut album, 8 tracks
- **morrow and undivide** (May 2025) - 2 tracks
- **Cycles (Edits)** with DJ_Dave (June 2025)
- **Coding Trance** (October 2025) - 3 tracks
- **In the Beginning, there was Trance** (November 2025)
- **Night Friends.iso** (January 2026)

### Online Presence
- Bandcamp: jaderose.bandcamp.com
- GitHub: github.com/daslyfe (main), github.com/switchangel (scripts)
- TikTok: @switch.angel
- Patreon: Vault Drops with Strudel patterns
- YouTube: Live coding tutorials/performances

---

## Strudel Overview

### What is Strudel?
- JavaScript port of TidalCycles (originally Haskell)
- Browser-based live coding environment for algorithmic music
- Created by Alex McLean and Felix Roos (2022)
- Uses "mini-notation" for compact pattern expression
- Built-in "superdough" synth with granular synthesis capabilities
- Supports OSC output to SuperCollider/SuperDirt
- Repository moved from GitHub to Codeberg: codeberg.org/uzu/strudel

### Core Concept: Cycles
- Patterns repeat over fixed time units called "cycles"
- Default: 1 cycle = 1 second (adjustable with setcpm/setCpm)
- Events fill the cycle - more events = shorter individual durations
- This is counter-intuitive vs traditional sequencers where adding notes extends length

### Superdough Audio Engine
- Fully featured web audio synth/sampler/fx engine
- Performant sampler capable of granular synthesis
- Wavetable synthesis with 1000+ AKWF waveforms
- FM synthesis with envelope control
- Integration of ZZFX synth engine
- Named after SuperDirt (TidalCycles audio engine)

---

## Switch Angel's Custom Scripts

### Repository: github.com/switchangel/strudel-scripts
- Custom functions not yet in main Strudel
- Load via prebake section in Strudel settings
- 324+ stars, 47 forks, actively maintained

### How to Load Custom Scripts
1. Go to Strudel settings (gear icon)
2. Find the "prebake" section
3. Upload the `.strudel` file or paste code
4. Scripts load automatically on pattern execution

---

## Complete Custom Function Reference (from prebake.strudel)

### 1. track - Tracker-Style Arrangement
```javascript
window.track = function(...input) {
  const patterns = input.shift()
  let mods = Array.isArray(input.at(-1)) ? input.pop() : undefined
  // Arranges patterns with tracker-style notation
}
```
**Purpose:** Arranges multiple patterns across cycles using tracker-style string notation. Allows optional modifiers to transform patterns based on marker characters.

### 2. ar - Quick Arrange
```javascript
window.ar = function(...input) {
  // Alternates cycles and patterns
}
```
**Purpose:** Simpler arrangement function that sequences patterns over specified cycle lengths without tracker notation.

### 3. p - Stack Shorthand
```javascript
window.p = stack
```
**Purpose:** Convenient alias for `stack` function.

### 4. blockArrange - Mask-Based Control
```javascript
window.blockArrange = function (patArr, modifiers = []) {
  // Stacks patterns with mask-based control
}
```
**Purpose:** Applies mask patterns to control when source patterns play. Supports modifiers like restart (R) and reverse (B).

### 5. irando - Random Integer Pattern
```javascript
window.irando = (ipat) => reify(ipat).fmap(_irand).outerJoin()
```
**Purpose:** Converts a pattern to individual random integer values.

### 6. randm - Random Division
```javascript
window.randm = (division) => irand(division).div(16)
```
**Purpose:** Generates random values divided by 16 for randomized timing.

### 7. pk - Pick Wrapper
```javascript
window.pk = function (...args) {
  const control = args.length > 2 ? args.pop() : 0
  return pick(args, control)
}
```
**Purpose:** Convenience wrapper around `pick()` that selects from arguments based on control value.

### 8. acidenv - TB-303 Filter Envelope (Signature Sound)
```javascript
register('acidenv', (x, pat) => pat.lpf(100)
    .lpenv(x * 9).lps(.2).lpd(.12)
)
```
**Purpose:** Creates acid-style filter envelope:
- Base lowpass at 100Hz
- Filter envelope depth multiplied by 9
- Sustain at 0.2
- Decay at 0.12

**Usage:**
```javascript
setcpm(136/4)
$: n("<0 4 0 9 7>*16").scale("g:minor").trans(-12)
  .octave(3).s("sawtooth").acidenv(slider(0.655))
```

### 9. fill - Event Extension
**Purpose:** Expands events to fill gaps until the next event onset, extending note duration to bridge silence.

### 10. trancegate - Rhythmic Gating
**Purpose:** Applies rhythmic gating using random density structures, creating pulsing trance-like effects with clipping.

### 11. colorparty - Visual Color Assignment
**Purpose:** Assigns colors from a palette based on normalized parameter value.

### 12. grab - Scale Quantization
**Purpose:** Quantizes notes to specified scale by finding nearest scale degree.

### 13. mpan - Multi-Orbit Pan
**Purpose:** Routes audio to different orbits based on amount value for multi-channel setups.

### 14. rlpf/rhpf - Normalized Filters
**Purpose:** Low-pass and high-pass filters with 0-1 normalized control ranges.

### 15. vstruct - Velocity Structure
**Purpose:** Repeats patterns based on velocity values for velocity-triggered rhythmic variations.

### 16. voc - Vocoder Control
**Purpose:** Maps note names to CC values for controlling external Ableton vocoder parameters.

### 17. fmtime - Time-Based FM
**Purpose:** Modulates frequency using time-based values that reset periodically.

### 18. acid - Acid Preset
**Purpose:** Preset configuration with supersaw synth, unison, detune, and TB-303-style filter envelope.

### 19. stxt - Synthesis from Text
**Purpose:** Encodes text as UTF-8 bytes and uses them to set synthesis parameters across multiple range-based and selection controls.

### 20. sf - Oldschool Timestretching
**Purpose:** Scrubs through pattern at different speeds using sawtooth waves for vintage time-stretching effects.

### 21. swap - Value Replacement
**Purpose:** Replaces occurrences of one value with another throughout a pattern.

### 22. up - Parameter Merging
**Purpose:** Merges parameter objects without overwriting undefined values. Enables Elektron-style parameter locking.

### 23. oneshot - Single Play
**Purpose:** Plays a sound only once, quantized to specified grid interval.

### 24. filtval - Conditional Function
**Purpose:** Applies function only to events where specific parameter matches target value.

### 25. glide - Polyphonic Pitch Glide
**Purpose:** Implements polyphonic pitch gliding that persists across note transitions.

### 26. glitch - Random Corruption
**Purpose:** Randomly corrupts parameter values for glitchy, chaotic effects.

### 27. sq - Square Values
**Purpose:** Squares all numeric values for smoother parameter curves.

### 28. strum - Strumming Effect
**Purpose:** Offsets simultaneous notes in time for strumming effects.

### 29. humanize - Natural Timing
**Purpose:** Adds timing variations and velocity randomization for more natural performances.

---

## Mini-Notation Reference

### Basic Syntax
| Symbol | Function | Example |
|--------|----------|---------|
| Space | Sequential events | `"bd sd hh cp"` |
| `[]` | Groups in same time slot | `"[bd sd] hh"` |
| `*` | Multiplies | `"bd*4"` = 4 kicks per cycle |
| `!` | Replicates | `"bd!4"` = 4 separate bd events |
| `~` | Rest/silence | `"bd ~ sd ~"` |
| `<>` | Alternates per cycle | `"<bd sd>"` |
| `,` | Stacks (simultaneous) | `"bd,hh"` |

### Advanced Mini-Notation
| Symbol | Function | Example |
|--------|----------|---------|
| `@` | Weight | `"bd@3 sd"` = bd takes 3/4 of cycle |
| `/` | Slow | `"bd/2"` = every other cycle |
| `(x,y)` | Euclidean rhythm | `"bd(3,8)"` = 3 beats over 8 steps |
| `?` | Random removal (50%) | `"bd?"` |
| `:` | Sample selection | `"bd:3"` = 4th bd sample |
| `{}` | Polymeter | `"{bd sd, cp hh oh}"` |

### Euclidean/Bjorklund Rhythms
The `(k,n)` notation distributes k beats over n steps as evenly as possible using the Bjorklund algorithm:
- `"bd(3,8)"` - 3 beats over 8 steps = `"bd ~ ~ bd ~ ~ bd ~"`
- `"bd(5,8)"` - 5 beats over 8 steps
- `"bd(3,8,2)"` - 3 over 8, rotated by 2

---

## Pattern Functions

### Tempo Control
| Function | Description | Example |
|----------|-------------|---------|
| `setcpm(bpm)` | Cycles per minute | `setcpm(140)` |
| `setcps(cps)` | Cycles per second | `setcps(0.5)` |
| `.cpm(n)` | Chain method tempo | `.cpm(130)` |
| `.slow(n)` | Slow by factor n | `.slow(2)` |
| `.fast(n)` | Speed up by factor n | `.fast(2)` |

**BPM to CPS conversion:**
```javascript
const bpm = 140
setcps(bpm/60/4)  // For 4/4 time
```

### Sound Sources
| Function | Description | Example |
|----------|-------------|---------|
| `s("name")` | Sample/synth | `s("bd")` |
| `sound("name")` | Alias for s() | `sound("piano")` |
| `.note("c4")` | Pitch | `note("c4 e4 g4")` |
| `.n(value)` | Sample index/scale degree | `.n(0)` |
| `.freq(hz)` | Direct frequency | `.freq(440)` |
| `.scale("root:mode")` | Scale context | `.scale("g:minor")` |

### Available Synths
**Basic Oscillators:**
- `sawtooth`, `triangle`, `square`, `sine`
- `pulse` (with PWM via `.width()`)

**Supersaw/Unison:**
- `supersaw`, `supersquare`, `supersaw` with `.unison()`, `.detune()`, `.spread()`

**Noise:**
- `white`, `pink`, `brown`
- Add noise to any oscillator with `.noise(0-1)`

**ZZFX Synths:**
- `z_sawtooth`, `z_sine`, `z_square`, `z_tan`, `z_noise`

**General MIDI:**
- `gm_viola`, `gm_cello`, `gm_contrabass`, etc.

---

## Effects Reference

### Filters
| Function | Description | Range |
|----------|-------------|-------|
| `.lpf(freq)` | Lowpass cutoff | 0-20000 Hz |
| `.hpf(freq)` | Highpass cutoff | 0-20000 Hz |
| `.bpf(freq)` | Bandpass center | 0-20000 Hz |
| `.lpq(q)` | Lowpass resonance | 0-50 |
| `.resonance(q)` | Alias for lpq | 0-50 |

### Filter Envelope (Switch Angel's Signature Sound)
| Function | Description | Default |
|----------|-------------|---------|
| `.lpenv(depth)` | Filter envelope amount | 0 |
| `.lpa(time)` | Filter attack | 0.001 |
| `.lpd(time)` | Filter decay | 0.2 |
| `.lps(level)` | Filter sustain | 0.001 |
| `.lpr(time)` | Filter release | 0.1 |

### Amplitude Envelope
| Function | Description |
|----------|-------------|
| `.gain(0-1)` | Volume |
| `.attack(time)` | Amp attack |
| `.decay(time)` | Amp decay |
| `.sustain(0-1)` | Amp sustain level |
| `.release(time)` | Amp release |

### Spatial Effects
| Function | Description |
|----------|-------------|
| `.room(0-1)` | Reverb amount |
| `.roomsize(0-10)` / `.size()` | Reverb size |
| `.delay(0-1)` | Delay amount |
| `.delaytime(seconds)` | Delay time |
| `.delayfeedback(0-1)` | Delay feedback |
| `.pan(0-1)` | Stereo position |

### Modulation Effects
| Function | Description |
|----------|-------------|
| `.vib(freq)` | Vibrato rate |
| `.vibmod(amount)` | Vibrato depth |
| `.tremolo(amount)` | Tremolo depth |
| `.lfo(rate)` | LFO rate |
| `.phaser(speed)` | Phaser rate |
| `.phasercenter(hz)` | Phaser center freq |
| `.phasersweep(range)` | Phaser sweep range |

### Distortion & Saturation
| Function | Description |
|----------|-------------|
| `.distort(amount)` | Waveshaping distortion |
| `.crush(bits)` | Bit crushing (2-16) |
| `.shape(amount)` | Waveshaper |

### FM Synthesis
| Function | Description | Default |
|----------|-------------|---------|
| `.fm(index)` / `.fmi(index)` | Modulation index | 0 |
| `.fmh(ratio)` | Harmonicity ratio | 1 |
| `.fmwave(type)` | Modulator waveform | 'sine' |
| `.fmattack(time)` | FM envelope attack | 0.001 |
| `.fmdecay(time)` | FM envelope decay | 0.2 |
| `.fmsustain(level)` | FM envelope sustain | 0.001 |
| `.fmrelease(time)` | FM envelope release | 0.1 |
| `.fmenv(type)` | Envelope type ('linear'/'exp') | 'linear' |

### Dynamics
| Function | Description |
|----------|-------------|
| `.compressor("thresh:ratio:knee:attack:release")` | Dynamics compressor |
| `.postgain(amount)` | Makeup gain after effects |

---

## Signals (LFO/Continuous Patterns)

### Wave Signals (0 to 1 range)
| Signal | Description |
|--------|-------------|
| `sine` | Sine wave oscillation |
| `cosine` | Cosine wave |
| `saw` | Sawtooth (rising) |
| `tri` | Triangle wave |
| `square` | Square wave |

### Bipolar Signals (-1 to 1 range)
- `sine2`, `cosine2`, `saw2`, `tri2`, `square2`

### Random Signals
| Signal | Description |
|--------|-------------|
| `rand` | Random 0-1 |
| `rand2` | Random -1 to 1 |
| `irand(n)` | Random integer 0 to n-1 |
| `perlin` | Perlin noise 0-1 |

### Signal Methods
```javascript
// Range mapping
sine.range(100, 2000)     // Map to 100-2000
sine.rangex(100, 2000)    // Exponential mapping

// Speed control
sine.slow(4)              // 4 cycles per oscillation
sine.fast(2)              // 2 oscillations per cycle

// Sampling
perlin.segment(16)        // Sample 16 points per cycle
```

### Practical LFO Examples
```javascript
// Filter sweep
.lpf(sine.range(300, 5000).slow(4))

// Random filter decay
.lpd(perlin.range(.02, .2))

// Panning LFO
.pan(sine.range(0, 1).slow(2))

// Random note selection
n(irand(8).struct("x(3,8)")).scale("C:minor")
```

---

## Pattern Transformations

### Time Transformations
| Function | Description |
|----------|-------------|
| `.fast(n)` | Speed up by factor |
| `.slow(n)` | Slow down by factor |
| `.early(time)` | Shift earlier in cycle |
| `.late(time)` | Shift later in cycle |
| `.off(time, fn)` | Offset copy with transform |
| `.swing(amount)` | Add swing feel |
| `.swingBy(amount, n)` | Swing with divisions |

### Pattern Modifiers
| Function | Description |
|----------|-------------|
| `.rev` | Reverse pattern |
| `.palindrome` | Alternate forward/backward |
| `.iter(n)` | Rotate subdivisions each cycle |
| `.shuffle(n)` | Shuffle n subdivisions |
| `.scramble(n)` | Randomize n subdivisions |
| `.rot(n)` | Rotate by n steps |

### Conditional Modifiers
| Function | Description |
|----------|-------------|
| `.every(n, fn)` | Apply fn every n cycles |
| `.sometimes(fn)` | Apply 50% of time |
| `.sometimesBy(p, fn)` | Apply p% of time |
| `.rarely(fn)` | Apply 25% of time |
| `.almostNever(fn)` | Apply 10% of time |
| `.often(fn)` | Apply 75% of time |
| `.almostAlways(fn)` | Apply 90% of time |
| `.firstOf(n, fn)` | Apply first of n cycles |
| `.lastOf(n, fn)` | Apply last of n cycles |

### Stereo Transformations
| Function | Description |
|----------|-------------|
| `.jux(fn)` | Apply fn to right channel only |
| `.juxBy(amount, fn)` | Adjustable stereo width |

### Random Modifiers
| Function | Description |
|----------|-------------|
| `.degradeBy(p)` | Remove p% of events |
| `.degrade` | Remove 50% of events |
| `?` | Mini-notation 50% removal |

---

## Sample Manipulation

### Loading Samples
```javascript
// From GitHub
samples('github:tidalcycles/dirt-samples')

// Custom mapping
samples({
  bassdrum: 'bd/BT0AADA.wav',
  snaredrum: ['sd/rytm-01-classic.wav', 'sd/rytm-00-hard.wav'],
}, 'https://raw.githubusercontent.com/tidalcycles/Dirt-Samples/master/')

// Pitched samples
samples({
  'moog': {
    'g2': 'moog/004_Mighty_Moog_G2.wav',
    'g3': 'moog/005_Mighty_Moog_G3.wav',
  }
}, 'github:tidalcycles/dirt-samples')
```

### Sample Banks
```javascript
// Change drum machine
.bank("RolandTR909")
.bank("RolandTR808")
.bank("RolandTR707")
```

### Sample Playback
| Function | Description |
|----------|-------------|
| `.speed(n)` | Playback rate (pitch) |
| `.begin(0-1)` | Start position |
| `.end(0-1)` | End position |
| `.unit("c")` | Sync to cycle |
| `.cut(n)` | Cut group (monophonic) |
| `.choke(n)` | Choke group |
| `.legato(n)` | Note duration multiplier |
| `.clip(n)` | Clip duration |

### Granular/Slicing
| Function | Description |
|----------|-------------|
| `.chop(n)` | Cut into n parts |
| `.striate(n)` | Interlaced granular |
| `.slice(n, pattern)` | Pattern slice playback |
| `.splice(n, pattern)` | Speed-adjusted slicing |
| `.loopAt(n)` | Fit sample to n cycles |
| `.fit` | Fit to event duration |

### Granular Example
```javascript
// Amen break manipulation
$: s("amen").loopAt(2).chop(16)
  .iter(4).every(3, rev)

// Slice pattern
$: s("amen").splice(8, "7 6 [2 4] 3")
```

---

## Scales and Chords

### Scale Syntax
```javascript
// Basic scale
note("0 2 4 5").scale("C:major")

// With root octave
note("0 2 4 5").scale("C4:minor")

// Available scales: major, minor, dorian, phrygian, lydian,
// mixolydian, locrian, pentatonic, blues, chromatic, etc.
```

### Chord Voicings
```javascript
// Chord symbols to voicings
voicing("<C^7 Dm7 G7 C^7>")

// With specific voicing type
voicing("<C^7>").dictionary("lefthand")

// Using n to arpeggiate
voicing("C^7").n("0 1 2 3")
```

### Transpose and Octave
| Function | Description |
|----------|-------------|
| `.transpose(n)` | Transpose by semitones |
| `.trans(n)` | Alias for transpose |
| `.scaleTranspose(n)` | Transpose within scale |
| `.octave(n)` | Set octave |
| `.add(note(n))` | Add interval |

---

## Arrangement and Structure

### Pattern Constructors
| Function | Description |
|----------|-------------|
| `stack(p1, p2, ...)` | Play simultaneously |
| `cat(p1, p2, ...)` | Play sequentially (one per cycle) |
| `fastcat(p1, p2, ...)` | Sequential in one cycle |
| `sequence(p1, p2, ...)` | Alias for fastcat |
| `timeCat([n1,p1], [n2,p2])` | Weighted sequence |
| `polymeter(p1, p2)` | Same pulse, different lengths |

### Building Arrangements
```javascript
// Drop structure
$: s("<bd:2!4!6 [~ ~ ~ [bd:2 bd:2*4]]>")._scope()

// Bass: silence then drop
$: n("<[0 [0 3] [5 7] [3 5]]!6 ~ [0!16]>").add(-21).scale("g:minor")
  .s("<gm_contrabass!6 ~ supersquare>".slow(8))
  .lpf(sine.range(30, 5000).fast(4))
  .resonance("<1!6 ~ 35>".slow(8))
  .gain("<0.4!6 ~ 1.0>".slow(8))

// White noise riser before drop
$: s("<~!6 wind ~>").gain("<~!6 [0 0.1 0.3 0.6] ~>".slow(8))
```

---

## Orbits and Global Effects

### Orbit Routing
- Default orbit is 1
- Each orbit has its own delay and reverb
- Patterns with same orbit share global effects

```javascript
// Separate delay settings per orbit
stack(
  s("hh*6").delay(.5).delaytime(.25).orbit(1),
  s("~ sd ~ sd").delay(.5).delaytime(.125).orbit(2)
)
```

### Sidechain/Ducking
```javascript
$: s("bd!4")
  .duck("3:4:5:6")  // Target orbits
  .duckdepth(.8)
  .duckattack(.16)
```

### Multi-Channel Output
Enable "Multi Channel Orbits" in settings to route orbits to separate stereo channels for DAW recording.

---

## MIDI and OSC Integration

### MIDI Output
```javascript
// Basic MIDI out
note("c4 e4 g4").midi()

// Specific channel
note("c4 e4 g4").midi().midichan(2)

// CC control
ccv(saw).ccn(74).midi()  // Filter cutoff sweep

// Named output
note("c4").midi("My Synth")
```

### MIDI Clock
Strudel can output MIDI clock to sync external devices.

### OSC to SuperCollider
```javascript
// Send to SuperDirt
note("c4 e4").osc()
```

Requires:
1. SuperCollider + SuperDirt (or StrudelDirt fork)
2. Running `pnpm run osc` for WebSocket server

---

## Visualization Tools

### Inline Visualizers (use _ prefix)
| Function | Description |
|----------|-------------|
| `._pianoroll()` | Piano roll view |
| `._punchcard()` | Punchcard view |
| `._scope()` | Oscilloscope |
| `._spectrum()` | Frequency spectrum |
| `._pitchwheel()` | Pitch wheel display |

### Global Visualizers
| Function | Description |
|----------|-------------|
| `.spiral()` | Spiral timeline view |
| `.wordfall` | Falling word display |

### Code Highlighting
- Strudel automatically highlights active events in code
- Notes/beats light up as they play
- Part of the "algorave" aesthetic

---

## Switch Angel's Production Techniques

### 1. Acid Basslines
```javascript
$: n("<[0 [0 3] [5 7] [3 5]]>").add(-14).scale("g:minor")
  .s("sawtooth")
  .lpf(sine.range(30, 5000).fast(4))
  .resonance(25)
```
**Key elements:**
- Sawtooth oscillator
- Modulated lowpass filter
- High resonance
- Scale-based melodies

### 2. The acidenv Function
```javascript
register('acidenv', (x, pat) => pat.lpf(100)
    .lpenv(x * 9).lps(.2).lpd(.12)
)

// Usage with slider for live control
$: n("<0 4 0 9 7>*16").scale("g:minor").trans(-12)
  .octave(3).s("sawtooth").acidenv(slider(0.655))
```

### 3. Drop Builds
```javascript
// Silence before drop pattern
$: n("<[pattern]!6 ~ [0!16]>").scale("g:minor")
  .s("<gm_contrabass!6 ~ supersquare>".slow(8))
  .gain("<0.4!6 ~ 1.0>".slow(8))
```
**Technique:**
- `!6` = repeat 6 times
- `~` = silence for tension
- Instrument swap on drop
- Volume boost on drop

### 4. White Noise Risers
```javascript
// Build tension before drop
$: s("<~!6 wind ~>").gain("<~!6 [0 0.1 0.3 0.6] ~>".slow(8))
```
**Technique:**
- Use `wind` or `white` for noise
- Gradually increase gain
- Time with other pattern changes

### 5. Hi-Hat Acceleration
```javascript
// Speed up approaching drop
$: s("hh*<8 8 16 16 32 32 ~ 16>").gain(0.6)
```

### 6. Filter Sweeps
```javascript
// Continuous filter sweep
.lpf(sine.range(100, 8000).slow(8))
.resonance(sine.range(5, 25).slow(16))
```

### 7. Sidechain Ducking
```javascript
$: s("bd!4")
  .duck("3:4:5:6")
  .duckdepth(.8)
  .duckattack(.16)
```

### 8. Slider Controls for Live Performance
```javascript
.acidenv(slider(0.655))
.gain(slider(0.8))
.lpf(slider(0.5).range(100, 4000))
```
**Key:** Real-time tweaking during performance

### 9. Layered Supersaw Leads
```javascript
note("d f a a# a d3").fast(2)
  .s("supersaw")
  .spread(".8")
  .detune(.3)
  .unison("2 7")
```

### 10. Trance Gates
```javascript
// Using trancegate custom function
$: note("c4 e4 g4").s("supersaw")
  .trancegate(16)
```

---

## Complete Effect Chain Examples

### Acid Bass Chain
```javascript
$: n("0 4 7 11").scale("a:minor").add(-14)
  .s("sawtooth")
  .lpf(100)
  .lpenv(6)
  .lpd(0.15)
  .lps(0.1)
  .lpq(25)
  .distort(0.5)
  .room(0.2)
  .gain(0.7)
```

### Atmospheric Pad Chain
```javascript
$: note("<c3,e3,g3> <d3,f3,a3>").slow(4)
  .s("supersquare")
  .unison(5)
  .detune(0.1)
  .attack(0.5)
  .release(2)
  .lpf(2000)
  .room(0.8)
  .roomsize(5)
  .delay(0.3)
  .delaytime(0.375)
  .gain(0.4)
```

### Breakbeat Processing
```javascript
$: s("amen").loopAt(2)
  .chop(32)
  .sometimes(rev)
  .degradeBy(0.1)
  .distort(0.3)
  .crush(12)
  .room(0.1)
  .delay(0.2)
  .gain(0.8)
```

---

## Advanced Techniques

### Polyrhythms with Stack
```javascript
// 3 against 4
stack(
  n("0 2 4").scale("c:minor").s("piano"),
  n("0 3 5 7").scale("c:minor").s("piano").gain(0.6)
)
```

### Polymeter with {}
```javascript
// Different lengths, same pulse
s("{bd sd, cp hh oh}")
```

### Probability-Based Patterns
```javascript
$: n("0 2? 4 6?").scale("c:minor")
  .sometimesBy(0.3, x => x.transpose(12))
  .degradeBy(0.1)
```

### Parameter Locking (Elektron-style)
```javascript
// Using the 'up' custom function
$: s("bd sd hh cp")
  .up({lpf: 1000})  // Lock lpf on all
  .up({lpf: 2000}, "~ x ~ ~")  // Override on sd only
```

### Generative Melodies
```javascript
$: n(irand(8).segment(16))
  .scale("c:pentatonic")
  .s("piano")
  .room(0.3)
```

---

## Value Operations

### Math Operations
| Function | Description |
|----------|-------------|
| `.add(n)` | Add value |
| `.sub(n)` | Subtract value |
| `.mul(n)` | Multiply value |
| `.div(n)` | Divide value |
| `.round` | Round to nearest integer |
| `.floor` | Round down |
| `.ceil` | Round up |

### Example
```javascript
// Transpose up octave
note("c3 e3 g3").add(note(12))

// Detune by adding small interval
note("c3").add(note("0, 0.1"))
```

---

## Performance Workflow

### Live Setup
1. **Prebake scripts** - Load custom functions before set
2. **Start simple** - Basic 4-on-floor kick
3. **Layer gradually** - Add elements one `$:` pattern at a time
4. **Use sliders** - Real-time parameter control
5. **Build tension** - Silence → buildup → drop
6. **Visualize** - Use `._scope()` or `._pianoroll()`

### Code Organization
```javascript
// Tempo
setcpm(140/4)

// Drums
$: s("bd!2 [~ bd] bd").gain(0.8)
$: s("~ cp ~ cp").gain(0.6)
$: s("hh*8").gain(0.4)

// Bass
$: n("0 0 7 5").scale("g:minor").add(-14)
  .s("sawtooth").acidenv(0.5)

// Lead
$: n("<0 2 4 7>*4").scale("g:minor")
  .s("supersaw").gain(0.3)
```

---

## Sample Repositories

### Default Libraries
- tidalcycles/Dirt-Samples
- ritchse/tidal-drum-machines
- AKWF wavetables (1000+)

### Additional Sources
- ilesinge/samples4web (MIT)
- thedudesinc/strudel-library
- bubobubobubobubo/dough-waveforms (wavetables)

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| Ctrl+Enter | Evaluate code |
| Ctrl+. | Stop all sound |
| Ctrl+Shift+H | Toggle highlighting |

---

## StrudelDirt (SuperCollider Fork)

Switch Angel maintains **StrudelDirt**, a SuperDirt fork optimized for Strudel:
- `.dry` and `.wet` controls for effect bus levels
- Improved gain normalization of synths to samples
- Temporary fork - features planned to merge back to SuperDirt

GitHub: github.com/daslyfe/StrudelDirt

---

## Desktop App

The Strudel desktop app (Tauri-based) includes:
- Native Rust-based MIDI integration
- Native OSC integration
- No browser API dependencies
- Play superdough + SuperDirt + MIDI hardware together

---

## Resources

### Official
- Strudel REPL: https://strudel.cc/
- Documentation: https://strudel.cc/learn/getting-started/
- Codeberg: https://codeberg.org/uzu/strudel
- Discord: discord.com/invite/HGEdXmRkzT

### Switch Angel
- GitHub Scripts: https://github.com/switchangel/strudel-scripts
- StrudelDirt: https://github.com/daslyfe/StrudelDirt
- Bandcamp: jaderose.bandcamp.com
- Linktree: linktr.ee/switchangel
- Patreon: patreon.com (Switch Angel)

### Learning
- James Fraze Tutorials: https://grimoire.jamesfraze.com/programming/strudel/switch-angel-tutorials/
- TidalCycles (original): https://tidalcycles.org
- Hackaday Article: https://hackaday.com/2025/10/16/live-coding-techno-with-strudel/

---

## Key Takeaways

1. **Pattern-first approach** - Music is patterns that transform over time
2. **Cycles as time unit** - Everything fits into cycles
3. **Chaining is fundamental** - `.function().function().function()`
4. **Register custom effects** - Create reusable sound design (`acidenv`)
5. **Slider integration** - Real-time control for performance
6. **Visual feedback** - Code IS the interface
7. **Filter envelopes for movement** - lpenv/acidenv for evolving sounds
8. **Euclidean rhythms** - `(beats, steps)` for interesting patterns
9. **Alternation with <>** - Easy variation per cycle
10. **Orbits for global FX** - Separate reverb/delay chains
11. **Supersaw for leads** - Detuned unison for thick sounds
12. **Drop builds** - `!n` repetition + `~` silence + instrument swap
13. **Signal modulation** - sine/saw/perlin for continuous parameter control
14. **Custom functions** - `register()` for signature sounds
15. **Granular techniques** - chop/slice/striate for texture

---

## Version History

- **Document Version:** 3.0 (Comprehensive)
- **Last Updated:** January 2026
- **Strudel Version Reference:** v1.1.0+ (Bananensplit and later)

---

## Sources Referenced

- [Strudel Official Documentation](https://strudel.cc/)
- [Switch Angel GitHub Scripts](https://github.com/switchangel/strudel-scripts)
- [daslyfe GitHub Profile](https://github.com/daslyfe)
- [StrudelDirt Repository](https://github.com/daslyfe/StrudelDirt)
- [James Fraze Grimoire Tutorials](https://grimoire.jamesfraze.com/programming/strudel/switch-angel-tutorials/)
- [Hackaday - Live Coding Techno With Strudel](https://hackaday.com/2025/10/16/live-coding-techno-with-strudel/)
- [Strudel Codeberg Repository](https://codeberg.org/uzu/strudel)
- [Strudel Blog](https://strudel.cc/blog/)
- [Strudel Synths Documentation](https://strudel.cc/learn/synths/)
- [Strudel Effects Documentation](https://strudel.cc/learn/effects/)
- [Strudel Samples Documentation](https://strudel.cc/learn/samples/)
- [Strudel Signals Documentation](https://strudel.cc/learn/signals/)
- [Strudel Visual Feedback Documentation](https://strudel.cc/learn/visual-feedback/)
- [Strudel MIDI/OSC Documentation](https://strudel.cc/learn/input-output/)
- [Strudel Tonal Functions](https://strudel.cc/learn/tonal/)
- [Strudel Time Modifiers](https://strudel.cc/learn/time-modifiers/)
- [Strudel Conditional Modifiers](https://strudel.cc/learn/conditional-modifiers/)
- [Strudel Pattern Constructors](https://strudel.cc/learn/factories/)
