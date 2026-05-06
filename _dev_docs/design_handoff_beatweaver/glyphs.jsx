// Monochromatic SVG glyphs — one per preset.
// Stroke-based, single-color (currentColor), elegant pictorial illustrations.
// Drawn at 100x100 viewBox. Always render at currentColor with stroke-linecap round.

const G = ({ children, vb = "0 0 100 100" }) => (
  <svg viewBox={vb} fill="none" stroke="currentColor" strokeWidth="1.6"
       strokeLinecap="round" strokeLinejoin="round"
       style={{ width: "100%", height: "100%", display: "block" }}>
    {children}
  </svg>
);

// === BASS ===
const PumpIt = () => (
  <G>{/* boxing glove / piston pumping */}
    <path d="M28 60 Q28 42 46 42 L60 42 Q72 42 72 54 L72 64 Q72 76 60 76 L40 76 Q28 76 28 64 Z"/>
    <path d="M40 42 L40 30 Q40 24 46 24 L54 24 Q60 24 60 30 L60 42"/>
    <path d="M44 56 L56 56" />
  </G>
);
const DeepSub = () => (
  <G>{/* whale tail / deep wave */}
    <path d="M14 70 Q30 50 50 50 T86 70" />
    <path d="M14 78 Q30 64 50 64 T86 78" opacity="0.5" />
    <path d="M50 50 L46 30 L54 30 L50 50" />
  </G>
);
const Acid = () => (
  <G>{/* dripping flask */}
    <path d="M40 22 L60 22" />
    <path d="M44 22 L44 38 L30 70 Q26 80 38 80 L62 80 Q74 80 70 70 L56 38 L56 22" />
    <circle cx="44" cy="60" r="2" />
    <circle cx="54" cy="68" r="2" />
    <circle cx="48" cy="72" r="1.5" />
  </G>
);
const Growl = () => (
  <G>{/* lion silhouette */}
    <path d="M50 30 Q34 30 30 44 Q22 46 22 56 Q22 68 30 70 Q32 80 50 80 Q68 80 70 70 Q78 68 78 56 Q78 46 70 44 Q66 30 50 30 Z" />
    <circle cx="42" cy="54" r="1.5" fill="currentColor" />
    <circle cx="58" cy="54" r="1.5" fill="currentColor" />
    <path d="M44 64 Q50 70 56 64" />
    <path d="M30 44 L20 36 M30 50 L18 50 M30 56 L20 60" />
    <path d="M70 44 L80 36 M70 50 L82 50 M70 56 L80 60" />
  </G>
);
const SubPulse = () => (
  <G>{/* concentric pulse */}
    <circle cx="50" cy="50" r="6" />
    <circle cx="50" cy="50" r="16" opacity="0.7" />
    <circle cx="50" cy="50" r="26" opacity="0.45" />
    <circle cx="50" cy="50" r="36" opacity="0.22" />
  </G>
);
const Reese = () => (
  <G>{/* two interleaved sine waves (detune) */}
    <path d="M14 44 Q26 28 38 44 T62 44 T86 44" />
    <path d="M14 56 Q26 72 38 56 T62 56 T86 56" />
  </G>
);
const Stab = () => (
  <G>{/* dagger */}
    <path d="M50 14 L56 60 L50 66 L44 60 Z" />
    <path d="M40 60 L60 60" />
    <path d="M46 66 L46 86 L54 86 L54 66" />
  </G>
);
const Pluck = () => (
  <G>{/* plucked string */}
    <path d="M14 50 Q38 30 50 50 Q62 70 86 50" />
    <line x1="14" y1="20" x2="14" y2="80" />
    <line x1="86" y1="20" x2="86" y2="80" />
  </G>
);

// === ENERGY ===
const TranceGate = () => (
  <G>{/* gate / portcullis */}
    <line x1="20" y1="22" x2="20" y2="78" />
    <line x1="35" y1="22" x2="35" y2="78" />
    <line x1="50" y1="22" x2="50" y2="78" />
    <line x1="65" y1="22" x2="65" y2="78" />
    <line x1="80" y1="22" x2="80" y2="78" />
    <line x1="14" y1="22" x2="86" y2="22" />
    <line x1="14" y1="78" x2="86" y2="78" />
  </G>
);
const Siren = () => (
  <G>{/* siren beacon with rays */}
    <ellipse cx="50" cy="58" rx="18" ry="8" />
    <path d="M40 58 Q40 38 50 38 Q60 38 60 58" />
    <line x1="50" y1="32" x2="50" y2="20" />
    <line x1="68" y1="42" x2="78" y2="34" />
    <line x1="32" y1="42" x2="22" y2="34" />
    <line x1="34" y1="58" x2="20" y2="58" />
    <line x1="66" y1="58" x2="80" y2="58" />
    <line x1="32" y1="68" x2="80" y2="68" />
  </G>
);
const Rising = () => (
  <G>{/* upward staircase */}
    <path d="M14 80 L30 80 L30 64 L46 64 L46 48 L62 48 L62 32 L78 32 L78 18" />
    <path d="M76 22 L78 18 L82 22" />
  </G>
);
const Riser = () => (
  <G>{/* arrow with spreading rays */}
    <line x1="50" y1="84" x2="50" y2="22" />
    <path d="M40 32 L50 22 L60 32" />
    <line x1="30" y1="76" x2="22" y2="84" />
    <line x1="70" y1="76" x2="78" y2="84" />
    <line x1="38" y1="80" x2="34" y2="86" />
    <line x1="62" y1="80" x2="66" y2="86" />
  </G>
);
const BuildUp = () => (
  <G>{/* ascending bar chart */}
    <rect x="18" y="68" width="10" height="14" />
    <rect x="34" y="56" width="10" height="26" />
    <rect x="50" y="42" width="10" height="40" />
    <rect x="66" y="26" width="10" height="56" />
  </G>
);
const SnareRoll = () => (
  <G>{/* snare drum */}
    <ellipse cx="50" cy="34" rx="28" ry="8" />
    <path d="M22 34 L22 64" />
    <path d="M78 34 L78 64" />
    <ellipse cx="50" cy="64" rx="28" ry="8" />
    <line x1="28" y1="40" x2="28" y2="58" />
    <line x1="40" y1="40" x2="40" y2="58" />
    <line x1="50" y1="40" x2="50" y2="58" />
    <line x1="60" y1="40" x2="60" y2="58" />
    <line x1="72" y1="40" x2="72" y2="58" />
  </G>
);
const Drop = () => (
  <G>{/* teardrop */}
    <path d="M50 14 Q26 44 26 60 Q26 78 50 82 Q74 78 74 60 Q74 44 50 14 Z" />
    <path d="M40 60 Q44 70 50 70" opacity="0.6" />
  </G>
);
const WhiteNoise = () => (
  <G>{/* speckle / static cloud */}
    <circle cx="28" cy="34" r="1.5" fill="currentColor"/>
    <circle cx="44" cy="28" r="1.5" fill="currentColor"/>
    <circle cx="60" cy="36" r="1.5" fill="currentColor"/>
    <circle cx="72" cy="32" r="1.5" fill="currentColor"/>
    <circle cx="34" cy="48" r="1.5" fill="currentColor"/>
    <circle cx="50" cy="44" r="1.5" fill="currentColor"/>
    <circle cx="68" cy="52" r="1.5" fill="currentColor"/>
    <circle cx="22" cy="60" r="1.5" fill="currentColor"/>
    <circle cx="40" cy="64" r="1.5" fill="currentColor"/>
    <circle cx="56" cy="60" r="1.5" fill="currentColor"/>
    <circle cx="74" cy="68" r="1.5" fill="currentColor"/>
    <circle cx="30" cy="74" r="1.5" fill="currentColor"/>
    <circle cx="50" cy="76" r="1.5" fill="currentColor"/>
    <circle cx="64" cy="74" r="1.5" fill="currentColor"/>
  </G>
);

// === TEXTURE ===
const DreamCloud = () => (
  <G>{/* cloud */}
    <path d="M22 64 Q22 52 34 52 Q34 38 48 38 Q60 38 62 50 Q78 50 78 62 Q78 72 68 72 L30 72 Q22 72 22 64 Z" />
  </G>
);
const Choir = () => (
  <G>{/* three figures with halo */}
    <circle cx="30" cy="32" r="6" />
    <circle cx="50" cy="28" r="6" />
    <circle cx="70" cy="32" r="6" />
    <path d="M22 68 Q22 50 30 50 Q38 50 38 68" />
    <path d="M40 70 Q40 48 50 48 Q60 48 60 70" />
    <path d="M62 68 Q62 50 70 50 Q78 50 78 68" />
    <ellipse cx="50" cy="20" rx="8" ry="2" opacity="0.5" />
  </G>
);
const Shimmer = () => (
  <G>{/* sparkle constellation */}
    <path d="M50 20 L52 36 L68 38 L52 40 L50 56 L48 40 L32 38 L48 36 Z" />
    <path d="M28 64 L30 70 L36 72 L30 74 L28 80 L26 74 L20 72 L26 70 Z" />
    <path d="M72 56 L74 62 L80 64 L74 66 L72 72 L70 66 L64 64 L70 62 Z" />
  </G>
);
const Strings = () => (
  <G>{/* violin-ish curves */}
    <path d="M50 14 Q34 30 34 50 Q34 62 42 70 L42 80 L58 80 L58 70 Q66 62 66 50 Q66 30 50 14 Z" />
    <line x1="50" y1="22" x2="50" y2="78" />
    <line x1="46" y1="22" x2="46" y2="78" />
    <line x1="54" y1="22" x2="54" y2="78" />
  </G>
);
const DarkFog = () => (
  <G>{/* layered fog */}
    <path d="M14 38 Q30 30 50 38 Q70 46 86 38" />
    <path d="M14 52 Q30 44 50 52 Q70 60 86 52" opacity="0.7" />
    <path d="M14 66 Q30 58 50 66 Q70 74 86 66" opacity="0.45" />
  </G>
);
const BellPad = () => (
  <G>{/* bell */}
    <path d="M30 64 Q30 38 50 32 Q70 38 70 64 Z" />
    <path d="M26 64 L74 64" />
    <line x1="50" y1="22" x2="50" y2="32" />
    <circle cx="50" cy="74" r="3" />
  </G>
);
const RhythmPulse = () => (
  <G>{/* heartbeat line */}
    <path d="M14 50 L30 50 L36 30 L44 70 L52 40 L58 60 L66 50 L86 50" />
  </G>
);
const Wind = () => (
  <G>{/* wind streaks */}
    <path d="M14 32 Q40 32 60 32 Q72 32 72 26 Q72 20 66 20 Q60 20 60 26" />
    <path d="M14 50 Q50 50 76 50 Q86 50 86 44 Q86 38 80 38 Q74 38 74 44" />
    <path d="M14 68 Q40 68 60 68 Q72 68 72 62 Q72 56 66 56 Q60 56 60 62" />
  </G>
);

// === FX ===
const StabHit = () => (
  <G>{/* lightning bolt */}
    <path d="M54 14 L34 50 L46 50 L40 86 L66 44 L52 44 L60 14 Z" />
  </G>
);
const Laser = () => (
  <G>{/* laser beam burst */}
    <line x1="14" y1="50" x2="86" y2="50" />
    <line x1="20" y1="40" x2="80" y2="40" opacity="0.4" />
    <line x1="20" y1="60" x2="80" y2="60" opacity="0.4" />
    <circle cx="86" cy="50" r="4" />
    <line x1="86" y1="38" x2="86" y2="32" />
    <line x1="86" y1="62" x2="86" y2="68" />
    <line x1="74" y1="50" x2="68" y2="50" opacity="0.6" />
  </G>
);
const FilterSweep = () => (
  <G>{/* swept curve */}
    <path d="M14 78 Q30 78 38 60 Q46 38 60 30 Q72 24 86 24" />
    <line x1="14" y1="78" x2="86" y2="78" opacity="0.35" />
    <line x1="14" y1="22" x2="14" y2="82" opacity="0.35" />
  </G>
);
const Whoosh = () => (
  <G>{/* speed lines */}
    <path d="M14 30 Q40 30 60 30" />
    <path d="M20 44 Q46 44 70 44" />
    <path d="M14 58 Q40 58 60 58" />
    <path d="M24 72 Q50 72 76 72" />
    <path d="M62 22 L78 30 L62 38" opacity="0.7" />
  </G>
);
const Tension = () => (
  <G>{/* taut string with hand */}
    <line x1="14" y1="20" x2="14" y2="80" />
    <line x1="86" y1="20" x2="86" y2="80" />
    <path d="M14 50 L40 50 L50 40 L60 50 L86 50" />
    <circle cx="50" cy="40" r="4" />
  </G>
);
const Reverse = () => (
  <G>{/* circular arrow (reverse) */}
    <path d="M50 22 A28 28 0 1 0 78 50" />
    <path d="M70 18 L78 22 L74 30" />
  </G>
);
const Release = () => (
  <G>{/* dove / bird taking flight */}
    <path d="M22 60 Q40 40 60 50 Q72 56 80 44" />
    <path d="M60 50 L62 38 L72 44" />
    <path d="M22 60 L20 70 L30 66" />
    <circle cx="78" cy="42" r="1.5" fill="currentColor" />
  </G>
);
const Glitch = () => (
  <G>{/* shifted blocks */}
    <rect x="20" y="26" width="40" height="10" />
    <rect x="30" y="42" width="44" height="10" opacity="0.7" />
    <rect x="16" y="58" width="36" height="10" opacity="0.85" />
    <rect x="44" y="74" width="32" height="6" opacity="0.5" />
  </G>
);

const GLYPHS = {
  // Bass
  bass_pump: PumpIt, bass_subdeep: DeepSub, bass_acid: Acid, bass_growl: Growl,
  bass_pulse: SubPulse, bass_reese: Reese, bass_stab: Stab, bass_pluck: Pluck,
  // Energy
  e_trance: TranceGate, e_siren: Siren, e_rising: Rising, e_riser: Riser,
  e_build: BuildUp, e_snare: SnareRoll, e_drop: Drop, e_noise: WhiteNoise,
  // Texture
  t_dream: DreamCloud, t_choir: Choir, t_shimmer: Shimmer, t_strings: Strings,
  t_dark: DarkFog, t_bell: BellPad, t_pulse: RhythmPulse, t_wind: Wind,
  // FX
  fx_stab: StabHit, fx_laser: Laser, fx_sweep: FilterSweep, fx_whoosh: Whoosh,
  fx_tension: Tension, fx_reverse: Reverse, fx_release: Release, fx_glitch: Glitch,
};

window.GLYPHS = GLYPHS;
