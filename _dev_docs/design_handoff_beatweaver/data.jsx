// Beatweaver preset data (extracted from src/presets/index.js, simplified for prototype)
const CATEGORY_META = {
  BASS:    { color: "var(--bass)",    label: "BASS",    sub: "Low-end" },
  ENERGY:  { color: "var(--energy)",  label: "ENERGY",  sub: "Builds & drops" },
  TEXTURE: { color: "var(--texture)", label: "TEXTURE", sub: "Atmosphere" },
  FX:      { color: "var(--fx)",      label: "FX",      sub: "Transitions" },
};

const PATTERNS = {
  KICK:        [1,0,0,0,1,0,0,0],
  ACID:        [1,1,1,1,2,1,1,1],
  SUB:         [1,0,0,0,1,0,1,0],
  STAB:        [2,0,0,2,0,0,2,0],
  OFFBEAT:     [0,2,0,2,0,2,0,2],
  RISING:      [1,1,2,2,2,2,3,3],
  BUILD:       [1,1,1,1,1,1,1,1],
  IMPACT:      [3,0,0,0,0,0,0,0],
  PAD:         [2,2,2,2,2,2,2,2],
  SHIMMER:     [1,2,1,2,3,2,1,2],
  DARK:        [2,2,2,2,2,2,2,2],
  PERC:        [1,1,1,1,1,1,1,1],
  QSTAB:       [2,0,0,0,2,0,0,0],
  SWEEP:       [1,1,2,2,3,3,2,1],
  TENSION:     [2,0,2,0,3,0,3,0],
  RELEASE:     [3,3,3,3,2,2,1,1],
};

// 4 categories × 2 banks × 4 cells = 32 presets
// `cue`  = spoken on right-click ARM ("we're cueing X up so we can…")
// `fire` = spoken on FIRE ("…and there it is")
// `ann`  = legacy short label (kept for the announcement strip)
const PRESETS = [
  // Column 0 — BASS
  { col:0, row:0, bank:"A", id:"bass_pump",   name:"Pump It",     pat:"KICK",   ann:"Pump It dropped",
    cue:"To pump up the floor, we cue Pump It.",            fire:"Pump It — go." },
  { col:0, row:0, bank:"B", id:"bass_subdeep",name:"Deep Sub",    pat:"SUB",    ann:"Deep Sub engaged",
    cue:"For more weight, we cue Deep Sub.",                fire:"Deep Sub, engaged." },
  { col:0, row:1, bank:"A", id:"bass_acid",   name:"Acid",        pat:"ACID",   ann:"Acid wobble in",
    cue:"To get that wobble going, we cue Acid.",           fire:"Acid — wobbling now." },
  { col:0, row:1, bank:"B", id:"bass_growl",  name:"Growl",       pat:"ACID",   ann:"Growl bass in",
    cue:"To add more bite, we cue Growl.",                  fire:"Growl — unleashed." },
  { col:0, row:2, bank:"A", id:"bass_pulse",  name:"Sub Pulse",   pat:"SUB",    ann:"Sub Pulse in",
    cue:"For a steady low pulse, we cue Sub Pulse.",        fire:"Sub Pulse — locked in." },
  { col:0, row:2, bank:"B", id:"bass_reese",  name:"Reese",       pat:"STAB",   ann:"Reese rolling",
    cue:"To thicken the low end, we cue Reese.",            fire:"Reese — rolling." },
  { col:0, row:3, bank:"A", id:"bass_stab",   name:"Stab",        pat:"STAB",   ann:"Bass Stab in",
    cue:"To punch the bottom, we cue Bass Stab.",           fire:"Stab — hit." },
  { col:0, row:3, bank:"B", id:"bass_pluck",  name:"Pluck",       pat:"KICK",   ann:"Pluck bass in",
    cue:"For a tighter bass, we cue Pluck.",                fire:"Pluck — bouncing." },

  // Column 1 — ENERGY
  { col:1, row:0, bank:"A", id:"e_trance",    name:"Trance Gate", pat:"OFFBEAT",ann:"Trance Gate",
    cue:"To lift the energy, we cue Trance Gate.",          fire:"Trance Gate — open." },
  { col:1, row:0, bank:"B", id:"e_siren",     name:"Siren",       pat:"RISING", ann:"Siren up",
    cue:"To call the floor, we cue the Siren.",             fire:"Siren — wailing." },
  { col:1, row:1, bank:"A", id:"e_rising",    name:"Rising",      pat:"RISING", ann:"Energy rising",
    cue:"To start building, we cue Rising.",                fire:"Rising — climbing." },
  { col:1, row:1, bank:"B", id:"e_riser",     name:"Riser",       pat:"BUILD",  ann:"Riser climbing",
    cue:"For more tension, we cue Riser.",                  fire:"Riser — peaking." },
  { col:1, row:2, bank:"A", id:"e_build",     name:"Build Up",    pat:"BUILD",  ann:"Build Up active",
    cue:"To set up the drop, we cue Build Up.",             fire:"Build Up — go." },
  { col:1, row:2, bank:"B", id:"e_snare",     name:"Snare Roll",  pat:"BUILD",  ann:"Snare Roll in",
    cue:"To prime the impact, we cue Snare Roll.",          fire:"Snare Roll — rolling." },
  { col:1, row:3, bank:"A", id:"e_drop",      name:"Drop",        pat:"IMPACT", ann:"Drop hit",
    cue:"To break the build, we cue the Drop.",             fire:"Drop — now!" },
  { col:1, row:3, bank:"B", id:"e_noise",     name:"White Noise", pat:"IMPACT", ann:"White Noise in",
    cue:"For a clean wash, we cue White Noise.",            fire:"White Noise — sweeping." },

  // Column 2 — TEXTURE
  { col:2, row:0, bank:"A", id:"t_dream",     name:"Dream Cloud", pat:"PAD",    ann:"Dream Cloud in",
    cue:"For more atmosphere, we cue Dream Cloud.",         fire:"Dream Cloud — drifting." },
  { col:2, row:0, bank:"B", id:"t_choir",     name:"Choir",       pat:"PAD",    ann:"Choir in",
    cue:"To add depth, we cue the Choir.",                  fire:"Choir — voices in." },
  { col:2, row:1, bank:"A", id:"t_shimmer",   name:"Shimmer",     pat:"SHIMMER",ann:"Shimmer in",
    cue:"For a brighter top, we cue Shimmer.",              fire:"Shimmer — glowing." },
  { col:2, row:1, bank:"B", id:"t_strings",   name:"Strings",     pat:"PAD",    ann:"Strings rising",
    cue:"To swell the mid, we cue Strings.",                fire:"Strings — rising." },
  { col:2, row:2, bank:"A", id:"t_dark",      name:"Dark Fog",    pat:"DARK",   ann:"Dark Fog in",
    cue:"To darken the room, we cue Dark Fog.",             fire:"Dark Fog — settling." },
  { col:2, row:2, bank:"B", id:"t_bell",      name:"Bell Pad",    pat:"SHIMMER",ann:"Bell Pad in",
    cue:"For a hopeful glow, we cue Bell Pad.",             fire:"Bell Pad — chiming." },
  { col:2, row:3, bank:"A", id:"t_pulse",     name:"Pulse",       pat:"PERC",   ann:"Pulse in",
    cue:"To add motion, we cue Pulse.",                     fire:"Pulse — beating." },
  { col:2, row:3, bank:"B", id:"t_wind",      name:"Wind",        pat:"PERC",   ann:"Wind in",
    cue:"For breath and air, we cue Wind.",                 fire:"Wind — blowing." },

  // Column 3 — FX
  { col:3, row:0, bank:"A", id:"fx_stab",     name:"Stab Hit",    pat:"QSTAB",  ann:"Stab Hit",
    cue:"For a quick accent, we cue Stab Hit.",             fire:"Stab Hit — bang." },
  { col:3, row:0, bank:"B", id:"fx_laser",    name:"Laser",       pat:"SWEEP",  ann:"Laser zap",
    cue:"To slice the mix, we cue Laser.",                  fire:"Laser — pew." },
  { col:3, row:1, bank:"A", id:"fx_sweep",    name:"Filter Sweep",pat:"SWEEP",  ann:"Filter Sweep",
    cue:"To carve a sweep, we cue Filter Sweep.",           fire:"Filter Sweep — opening." },
  { col:3, row:1, bank:"B", id:"fx_whoosh",   name:"Whoosh",      pat:"SWEEP",  ann:"Whoosh",
    cue:"To bridge the bar, we cue Whoosh.",                fire:"Whoosh — flying." },
  { col:3, row:2, bank:"A", id:"fx_tension",  name:"Tension",     pat:"TENSION",ann:"Tension",
    cue:"To pull the room tight, we cue Tension.",          fire:"Tension — holding." },
  { col:3, row:2, bank:"B", id:"fx_reverse",  name:"Reverse",     pat:"RELEASE",ann:"Reverse in",
    cue:"For a reverse hit, we cue Reverse.",               fire:"Reverse — pulling back." },
  { col:3, row:3, bank:"A", id:"fx_release",  name:"Release",     pat:"RELEASE",ann:"Release",
    cue:"To let go, we cue Release.",                       fire:"Release — exhale." },
  { col:3, row:3, bank:"B", id:"fx_glitch",   name:"Glitch",      pat:"PERC",   ann:"Glitch on",
    cue:"For some chaos, we cue Glitch.",                   fire:"Glitch — fractured." },
];

const KEYS = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];
// Camelot-ish color wheel (matches BpmKeyDisplay)
const KEY_COLORS = {
  "C":"#00D4AA","C#":"#00B4D8","D":"#0077B6","D#":"#5E60CE",
  "E":"#7B2CBF","F":"#C77DFF","F#":"#FF6B9D","G":"#FF477E",
  "G#":"#FF5C5C","A":"#FF8C42","A#":"#FFD166","B":"#BFFF00",
};

Object.assign(window, { CATEGORY_META, PATTERNS, PRESETS, KEYS, KEY_COLORS });
