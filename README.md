# VOLTAGE

**A modular synthesizer in the browser that behaves like the real thing.**

VOLTAGE is a Eurorack-style rack: mount modules, patch them with cables, turn knobs, and listen.
Underneath, every sample of every module is computed in **volts**, the way the circuits work (1 V/octave
pitch, ±5 V audio, 0–10 V control voltages, rails that saturate, components that drift as they warm
up). There are no samples and no downloaded assets: every sound, from a ladder filter to a
singing bowl to a vinyl record, is synthesised.

- **137 modules**: oscillators, filters, envelopes, sequencers and drums; pedals, tape machines and
  played instruments; simulations that make music (bouncing balls, orbits, flocks, chaos); musical
  "brains" that jam with you; and **VISION**, living 3D scenes you patch like any other module.
- **18 factory racks** to start from, and a **Learn** menu with a step-by-step course in synthesis.
- **Share a rack with a link.** The whole patch travels inside the link itself.

---

## Contents

- [Quick start](#quick-start)
- [Playing it](#playing-it)
- [What's in the rack](#whats-in-the-rack)
- [Highlights](#highlights)
- [Saving and sharing](#saving-and-sharing)
- [Privacy and permissions](#privacy-and-permissions)
- [How it works](#how-it-works)
- [Adding a module](#adding-a-module)
- [Developer tools](#developer-tools)
- [Project rules](#project-rules)
- [Roadmap](#roadmap)

---

## Quick start

You need [Node.js](https://nodejs.org) 24 or newer (the server uses its built-in SQLite and runs
TypeScript directly) and a modern desktop browser (Chrome, Edge, Firefox or Safari).

```bash
npm install
npm run dev
```

Open <http://localhost:5204>. A first visit (or an empty rack) shows a start screen whose
**▶ Start** is the click browsers need before they allow sound; when your rack is already there,
it just waits for **POWER** (at the right of the top bar, next to REC). The **☰** menu holds the
case's size, view and settings. **‹** at the top of the module library folds it to a thin rail
(click the rail, or press **/**, to bring it back).

| Command | What it does |
|---|---|
| `npm run dev` | Development server with hot reload on port 5204 (it passes `/api` to 5205) |
| `npm run server` | The cloud server on port 5205 (restarts on changes; data in `./data`) |
| `npm run build` | Type-check, then build the site into `dist/` |
| `npm start` | The production server: the built site plus the cloud API |
| `npm run typecheck` | Type-check the app and the server |

**Deploying:** Railway builds (`npm run build`) and runs `npm start` from this repository. The
server (`server/`, no dependencies beyond Node) serves `dist/` and the `/api` for cloud racks,
storing them in one SQLite file. Its settings (Railway → Variables): `DATA_DIR` where a volume is
mounted (otherwise racks vanish on every deploy), `ADMIN_KEY` (a long random string; the admin tab
in Cloud → This device asks for it), and `PORT` (Railway sets it). Without the server the site
still works; only the Cloud menu can't reach anything.

---

## Playing it

**First time?** Open **Learn → 1 · Your first sound**. It builds a synth with you from an empty
case. **Walkthrough** does each step for you; **Guided** lets you do it and moves on by itself.

### The rack
- **Add a module:** click it in the list on the left, or drag it onto the rack. Search with the box
  at the top of the list.
- **Ready-to-play:** right-click any module in the list → **Add ready-to-play …** for that module
  already wired up with everything it needs to make music (a sequencer to play it, a sound for it to
  process, a voice for it to drive, the way out to the speakers). It goes in new rows below your rack,
  with a note on what to try; Ctrl+Z takes it away. Instruments you play yourself (keyboard, theremin,
  pads, mic…) come wired and waiting for you.
- **Move a module:** drag its bare face: the title strip or any empty space. Controls, screens and
  played surfaces never move it, and a click doesn't nudge it (it lifts after a few pixels of drag,
  a little more on touch). Neighbours slide aside when you drop it;
  drop below the last row to start a new row.
- **Rows and rails:** **+ Row / − Row**, and the **rails** selector (84 / 104 / 126 / 168 HP, the
  widths real cases come in).
- **Right-click an empty part of a row → Remove row.** If it has modules in it you're asked first:
  move them into free space in the other rows (if they fit), remove them with it, or cancel.
- **Click a module** (its bare panel, not a control) to open the **Inspector** on the right: what
  it's for, a button for its ready-to-play rig, every knob with its value and what it does, every
  jack with what it carries, plus size, settings and presets. ✕ closes it.
- **The library** shows each module's panel in miniature; rest the pointer on one for a bigger
  picture and **Add ready-to-play rig** / **Add on its own**. **Filter** narrows it by what
  modules are for.
- **Performance mode** (the **`** key, or ☰ → View) hides everything but the rack; a faint strip
  in the corner keeps POWER and the way out. **Esc** (or **`** again) leaves it.
- **Right-click a module:** Duplicate, Reset knobs, Export audio (for modules that record), **Size**
  (for resizable screens), any deeper settings it has (VISION's garden), **Presets** (name and
  save this module's settings, then load them onto any module of the same kind, in any rack; one
  undo step), and Remove.

### Knobs, switches and cables
| Do this | To |
|---|---|
| Scroll over a knob, or drag it up/down (left or middle button) | Turn it (hold **Shift** for fine control) |
| Double-click a knob | Reset it to its default |
| Drag from a jack to another jack | Patch a cable (output → input); dropping on an input replaces its cable. With **Jack hints** on (☰ menu), every jack the cable could go to rings while you drag (free inputs from an output, every output from an input), the ones carrying the same kind of signal ring brightest in that kind's colour (audio blue, pitch yellow, gates/triggers/clocks orange, CV violet), and the jack it will land on glows with its name |
| Hover a jack | What it is: its name, the kind of signal (with the same colour), what it does, and the live voltage. With **Explanations** on (☰ menu), a plain-words explanation of that kind of signal too (what a gate is, what V/OCT means) |
| On a touchscreen: hold a finger still on a jack, knob or switch | Its tooltip (the same as hovering); it stays a moment after you lift. Move the finger instead and the cable comes, or the knob turns |
| Hover a knob or switch | Its name, its value and how to use it. With **Explain** on, what it does in plain words (what CUTOFF or RESONANCE does, what SWING is, what this module's odd ones mean) |
| Drag a cable's end out of an input | Unplug it |
| Right-click a jack | Pull out all its cables |
| Shift + right-click a jack | Jack menu: every cable on it, to pull or recolour one by one |
| Esc while dragging | Cancel |
| Ctrl/⌘ + Z, Ctrl/⌘ + Shift + Z (or Ctrl + Y) | Undo / redo |

Hover any jack to read the voltage on it.

### Playing notes from your computer
Patch **MIDI·CV** (or use a module with a built-in keybed) and play:

- **A W S E D F T G Y H U J K O L P ; '**: one and a half octaves, white and black keys like a piano
- **Z / X**: octave down / up
- **1–8**: drum pads (MIDI channel 10)
- A connected **MIDI keyboard** works too (Web MIDI).

### Syncing with a DAW or other gear
**CLOCK** speaks MIDI clock (Web MIDI; in Chrome or Edge):
- **SYNC → MIDI IN**: the rack follows a DAW or drum machine: its START starts the rack on beat
  one, STOP stops it, and the TEMPO knob shows the tempo it hears.
- **MIDI OUT**: the rack leads: CLOCK sends MIDI clock, START and STOP to your MIDI outputs, timed
  to the audio you hear.

### Recording
**REC** in the top bar records the master output to a 24-bit WAV until you press it again.

---

## What's in the rack

The full list, with what each module does, is in [ROADMAP.md](ROADMAP.md#modules-137). The module
list on the left groups them by what they are (below); search finds them by name, by what you want
("bass", "reverb", "beat"…) or by the gear you know ("mellotron", "dfam", "op-1"); every word must
match, Enter adds the top result and `/` jumps to the box. Tag chips narrow the list (all tags must
match), ☆ stars a module into Favourites, and the last few you added sit under Recent.

| Category | For example |
|---|---|
| **Systems** | the POCKET family, MONO-1 (semi-modular mono), STUDIO-3 (2600-style), GROOVE-1 (drum machine), SKETCHBOOK (portable workstation: 7 four-knob synth engines with an effect and LFO each, a drum kit, pattern / arpeggio / tumbling-drum / drifting sequencers, 4-track loop tape with varispeed, reverse, loop points and lift/drop, mixer, keybed; kept with the patch), KIN-8 (DFAM-style percussion with an 8-step pitch/velocity sequencer), UNDERTONE (Subharmonicon-style: subharmonic oscillators, two 4-step sequencers, four polyrhythm dividers; clocks KIN-8), LOCKSTEP (FM groovebox: four tracks, per-step parameter locks and conditional trigs, per-track length and speed; right-click a step to lock knobs on it; patterns A–D that change on the bar, chains, PAT CV in, copy / paste; ratchets, micro-timing, slides; a tempo-synced LFO and reverb send per track), LATTICE (16×16 light grid: eight layers that SCORE, BOUNCE, play at RANDOM, HOLD chords, are played by hand (SOLO) or loop a path you DRAW, each with its own swing; four pages of the whole grid that change on the bar; notes ripple across the lights) |
| **Instruments** | Theremin, Omnichord, Chord Wheel, music box, handpan/steel pan/kalimba, tanpura, gamelan, singing bowl, harp, stylophone, TAPE KEYS (Mellotron-style), **TALLY** (a calculator that plays: tiny digital sounds, a rhythm box, ONE KEY PLAY, and ♪ to hear any number) |
| **Polyphonic** | POLY·CV, P-VCO, P-LADDER, P-ADSR, P-VCA, POLY MIX; complete voices that play chords straight from your keys: **FM-4** (four-operator FM: electric piano, bass, bells, brass, organ…), **SWARM** (supersaw) and **STAGE** (a modelled electric piano: a hammer on a tine over a magnetic pickup, round when soft and barking when hard, with stereo tremolo; or a reed in an electrostatic pickup, nasal and biting, with a volume tremolo). FM-4 and STAGE take a sustain pedal: a gate on SUS, or a MIDI pedal |
| **Oscillators** | VCO, complex (west-coast) oscillator, wavetable, sub, noise, **KALEIDO** (a macro oscillator: eight models (analog, wavefolder, FM, vowels, additive, chords, plucked string, struck bell) behind three knobs, with a built-in low-pass gate) |
| **Filters** | Ladder, SVF, MS-12, LPG (vactrol low-pass gates: strike them for the west-coast "bongo") |
| **Amps & Mixers** | VCA, VCA×4, mixer, stereo mixer, DJ mixer, PANNER (equal-power, with auto-pan), WIDENER (mid/side width, Haas widening for mono sounds, bass kept mono, a phase-correlation light); the mix bus: CONSOLE (6 channels, sidechain DUCK per channel: feed it the kick for the pump), GLUE (bus compressor with KEY sidechain and GR out), MASTER (EQ, stereo width, look-ahead limiter) |
| **Envelopes & LFOs** | ADSR, FUNC (Maths-style), follower, LFO, QUAD LFO (four from one rate: a quarter-cycle apart, at ratios, or drifting) |
| **Shapers** | Wavefolder, ring modulator |
| **CV Tools** | Quantizer, slew, S&H, T&H (track & hold), CHANCE (coin-toss gates), SWITCH (sequential switch, both ways), attenuverters, mult, logic, chord generator |
| **Drums** | Analog kick, snare, clap, hats, toms, perc |
| **Sequencers** | Clock, dividers, SEQ-8, TR-16, Euclid, Turing machine, arpeggiator, **PIANO ROLL** (draw notes and chords over four bars; poly pitch, gate and velocity out), **ARRANGER** (a song as sections: bars, a pattern letter for LOCKSTEP / LATTICE and four parts brought in and out by gates); three metronomes: METRONOME (accented click, subdivisions, tap tempo, follows CLK), **MAELZEL** (a simulated clockwork pendulum: winds down, ticks unevenly off level, and two on a shared plank fall into step), **COACH** (practice: tempo ramps to a target, gap-click silent bars, polyrhythm click; clocks a drum machine along) |
| **Brains** | GHOST (answers your phrases), PROGRESSION (chord progressions), BANDMATE (a drummer) |
| **Simulations** | BOUNCE, TUMBLER, ORBIT, LIFE, FLOCK, CHAOS, ECOSYSTEM: physics and biology as sequencers |
| **Effects** | BBD, tape echo, spring, plate, phaser, ensemble, pitch-correction, echo chamber, **RESONATOR** (makes anything ring: a struck or bowed object, sympathetic strings tuned to chords, plucked strings; up to four voices, stereo), VOCODER (16 bands: make a synth talk, or a beat sing); for ambient: **GRAINS** (granular clouds from the last 4 s, FREEZE a moment), **SHIMMER** (a reverb whose tail climbs in octaves), **SHIFT** (two-voice harmoniser with a feedback spiral) |
| **Pedals** | Fuzz, wah, octave, chorus, tape echo, looper, valve amp, talk box |
| **Sampling & Tape** | LOOP, SAMPLE, TURNTABLE (scratchable), CHOP (MPC-style), 4-TRACK |
| **Controllers** | MIDI·CV, pads, touch plates, XY pad, audio in (mic/line), camera (motion), gamepad |
| **Performance** | SCENES (rack snapshots), MACRO, ACCIDENT, **MOTION** (records a knob's movement and loops it in time: click a lane, turn any knob) |
| **Visuals** | VISION, VISION CORE, VISION VIEW, vector CRT, spectrogram, light show, scope; meters: **ANALYSER** (spectrum with peak hold, loudness in LUFS (momentary, short-term, integrated, against a target), peaks, correlation; passes the sound through) and **TUNER** (needle and strobe, A4 415–466 Hz, PITCH and GATE out) |
| **Output** | OUT, MONITOR, TAP (everything you hear, as a cable: resample the whole mix into SAMPLE, LOOP or CHOP) |

---

## Highlights

### VISION: living scenes you patch
A glass tank with a creature in it, running on the same clock as the audio. CV steers it (TRIG,
FEED, GLOW, PITCH, MOVE) and its movements come back out as voltages (GATE, MOTION, STATE, LIGHT,
and DEPTH: how near the jelly is to the glass, or each scene's nearest equivalent), so the visuals
can play the music and the music can drive the visuals.

- **Scenes:** a bioluminescent **jellyfish** that swims in 3D (long notes carry it further); a
  **garden** (below); **fireflies** that fall into sync; an **aurora** with substorms; a **Chladni
  plate** whose sand finds the shape of the note; a **murmuration** of starlings over a reed bed at
  dusk. Each bird only follows its neighbours, so the swirling shapes and the dark waves that ripple
  through the flock are its own. A falcon (TRIG, or tap the sky) blows it apart; as the light goes
  the waves come faster, then the whole flock pours down into the reeds to roost. And **rain on a
  pond**: every drop is a GATE with its own DEPTH (how near it fell), so the rain plays a melody;
  the lily pad's bob on the crossing rings is MOTION, and a storm (RATE up) brings lightning. And
  a **coral reef**: a school of fish milling round staghorn and brain corals, sea fans and an
  anemone with its clownfish; the swell's surge is MOTION, the polyps open to feed on FEED, and a
  barracuda (TRIG) scatters the school into a flashing bait ball.
- **The garden** is a meadow through days and nights. Daisies, tulips, sunflowers (they turn to follow
  the sun) and dandelions (their seed clocks blow away and come up where the seeds land) live whole
  lives: they close at night, drop petals as they die, fall into the grass and rot away. The
  garden's own tree comes up among them as a sapling no taller than the flowers and grows over
  minutes to a dozen times their height, the camera pulling back from the flower bed until they are
  flecks of colour at its foot (other trees stand back at the edge of the wood); in its last autumn
  it turns, drops its leaves and comes down, and the shot closes in on the flowers again. Bees and butterflies carry pollen between flowers of a kind, and only
  pollinated flowers seed beside themselves, so where the insects go decides what spreads.
  **Right-click** for its settings: sky (a day/night **CYCLE**, or day, golden hour, dusk, night),
  trees, which flowers, and how many insects. A VISION VIEW's menu sets its linked tank's garden.
- **CLK** (a quarter-note clock) puts every scene on the beat: the jelly twitches and glows (a
  full stroke each bar when TRIG is empty), the flowers rock, the fireflies flash, the aurora
  flares, the plate knocks, a drop falls; the starlings and the fish turn on each bar.
- **X / Y** (−5 V … +5 V) steer the creature: the jelly swims there, the flock and the school fly
  there, the fireflies gather into a ball round the point, the bees and butterflies follow it, the
  curtains drift there, the plate tilts toward it, the rain falls there. A QUAD LFO on X and Y
  sends them round in circles.
- **COUNT:** how many of each thing (up to a smack of six jellies, ten plants, 48 fireflies).
- **The glass is a touch screen:** poke the jelly, plant a seed, flash a torch at the fireflies,
  set off a substorm, knock the plate.
- **Pan and zoom:** scroll or pinch to zoom (toward the pointer), middle-drag or two fingers to pan.
  A touch still lands on what you see. Hover the glass for ⟲ to reset the view.
- **VISION CORE + VISION VIEW:** every scene lives at once in the CORE (a slim screenless module;
  its **OUT** knob picks which scene comes out of its own jacks). Show them on any number of VIEW
  screens: each picks its scene (**= CORE** follows OUT) and has its own pan and zoom and its own
  jacks for that scene (GATE, MOTION, STATE, LIGHT, DEPTH, TOUCH X / Y / TOUCH), so three VIEWs
  are three scenes you can patch.
- **Sizes:** right-click → Size (12 / 20 / 28 / 40 HP). Hover the glass for full screen or a pop-out
  window.

Try the **Jellyfish Dream** rack (the first-run rack), where the jelly plays the melody.

### The POCKET family
Calculator-sized grooveboxes with 16 steps, two knobs and a little LCD. Chain them with **CLK out →
CLK in** and they play as one band.

- **POCKET:** eight drum sounds, with per-step parameter locks (right-click a step).
- **POCKET OFFICE:** the same, but the kit is the office: typewriter keys, the space bar, a stapler,
  glitchy hats, the carriage bell and its return, a phone's trill, paper.
- **POCKET BASS:** 16 note steps with **slide** and **accent** (SUB / SQUARE / ACID voices).
- **POCKET MELODY:** steps are notes of a scale, so nothing is out of key. Each step can be a note,
  a **chord** or an **arpeggio**.
- **POCKET ARCADE:** chiptune. A pulse lead on the steps (each step a note, a chip **ARP** that cycles
  the chord at 60 Hz, or a **SLIDE**), a stepped triangle bass and noise drums that play along by
  themselves; each channel has its own jack too.
- **POCKET ROBOT:** a live lead. With WRITE off the buttons play it (held notes glide into each other);
  SAW / SQUARE / BUZZ, an ECHO or a CRUSH. Flip **REC** while it plays and what you press is written
  into the steps.
- **POCKET SPEAK:** a singing voice. Each step is a note and a syllable (AH, EE, OO, DA, TI, BO, MA,
  LA: right-click to change it), sung by a ROBOT, a CHOIR or a WHISPER through vowel formants.

In WRITE mode, click a step on/off, **drag it up/down** to set its note, and right-click for its
slide/accent or chord/arp. With WRITE off, the 16 buttons are a keyboard. Start from the **Pocket
Band** rack.

Every POCKET also has:
- **PATTERN:** four patterns, A to D. Tap one to edit it; while playing, it switches at the end of
  the bar. **COPY** then a letter copies the pattern you're on; **CLEAR** empties it. **CHAIN**, then
  tap up to eight patterns in order and CHAIN again: that's the **SONG**, played a bar each (SONG
  turns it on and off).
- **FX:** 16 punch-in effects that last as long as you hold the button: beat-repeat loops (¼ down to a
  32nd), ROLL, OCT DOWN / UP, REVERSE, TAPE STOP, SCRATCH, LOW / HIGH SWEEP, CRUSH, CHOP, ECHO and
  WOBBLE. The pattern keeps running underneath, so letting go lands back in time.

### Learn
**Learn → Synth fundamentals** is one continuous course, from an empty case to a whole track
(oscillators → filters → envelopes and VCAs → modulation → sequencing → drums → effects). Each
lesson picks up where the last ended, and **Finish** leaves you with the rack you built. **Beyond the
basics** has lessons on their own (polyphony and chords; a semi-modular and its normals; the GROOVE-1
drum machine, the LOCKSTEP groovebox and its parameter locks; playing the theremin, the omnichord, the
stylus organ and the harp),
and **Tours**
take a factory rack apart module by module (Acid House, Jellyfish Dream, Poly Strings, West Coast,
Pocket Band:
who keeps time, who plays, and the knobs that make the sound).

---

## Saving and sharing

- **Your rack saves itself** in the browser as you work. Its **name** sits in the top bar with
  where it's kept (in this browser, online too, or a sandbox that isn't saved); click it to
  rename it, open **My racks**, save a copy, open or save a `.voltage` file, or start a new rack.
- **My racks** has everything of yours in one window: racks kept in this browser, racks saved
  online (with their links), and **Earlier versions** of this rack.
- **Explore** has things to load and pull apart: **Songs**, **Example racks** and the **Gallery**
  of racks people have shared.
- **Songs** load a whole track in the style of an era, from 1975 Berlin School to 2017 lo-fi
  hip-hop (16 so far): Electro, Synth-Pop, Italo Disco, Acid House, Detroit, Rave, Jungle, Dub
  Techno, Filter House, UK Garage, Trance, Trap, Synthwave and more. Each is the rack that plays
  it, built on that era's signature trick (the 303-style squelch ridden by hand, the octave-jumping
  Italo bass, the rave hoover, the Reese bass, the two-step shuffle, the trance gate, the
  filter-house sweep, the 808 as a bassline, worn tape over everything, loops of different lengths
  drifting apart). The notes are all our own. Loading replaces
  the rack (Ctrl+Z brings yours back); power on, then pull it apart.
- **A `.voltage` file** (the rack's menu) is the whole rack with every recording in it (LOOP,
  SAMPLE, tape, CHOP, XY gestures), for backups or moving to another computer. Older `.json` patch
  files still open.
- **Earlier versions** (in My racks) keep your rack as it was over the last hours and days (a
  snapshot every couple of minutes while it changes, the last 50 kept); load one to go back (Ctrl+Z
  undoes that).
- **Share** (top right) hands the rack on three ways, each with a title and a note:
  - **Short link** (`/p/abc12345`): saved online, recordings and all (up to 20 MB). **Private**,
    **Link only** or **Public** (in the gallery once the admin has looked at it); a rack you
    shared before can be **updated** under the same link. No account: this browser has a private
    code that owns what it saves (☰ → **Your racks on other devices** shows it; paste it on another
    computer to see and edit your racks there).
  - **Quick link**: the whole patch packed into the link itself, nothing uploaded (recordings
    don't fit).
  - **File**: a `.voltage` download.
- Links open in a **sandbox** that never touches the recipient's own rack; they can **Keep this
  rack** (recordings included) into My racks, or **Report** a gallery rack.

**`?scratch`:** add `?scratch` to the address for a throwaway rack that is never saved, for trying
things without touching your own rack.

---

## Privacy and permissions

- Everything runs in your browser. There are no accounts, analytics or uploads.
- **Microphone, camera and gamepad** are only used by the AUDIO IN, CAMERA and GAMEPAD modules, and
  only after you click their **ENABLE** button. Audio and video are processed on your machine and
  never sent anywhere.
- A share link contains your patch. Anyone you send it to (and anywhere you post it) can open it.

---

## How it works

```
 React UI (rack, panels, cables, library)          AudioWorklet (audio thread)
 ────────────────────────────────────────          ───────────────────────────
 patch store ──── patch / params / UI events ───►  graph: one Dsp per module,
   │ undo, autosave, share                          ticked every sample, in volts
   ▼                                                    │
 panels, VISION, scopes ◄── telemetry (~30 Hz) ─────────┘ LEDs, creature state, scopes
```

- **The engine** (`src/engine`) runs in an AudioWorklet. Each module is a `Dsp` subclass with
  `tick()` called once per sample. Cables carry volts, polyphonic cables carry up to eight voices,
  and feedback loops work (with a one-sample delay).
- **A module** is two halves:
  - a **spec** (`src/modules/specs`): its panel, jacks, knobs and their ranges, all plain data;
  - a **DSP class** (`src/engine/dsp`): what it does to voltages.
- **The UI** (`src/ui`) draws panels from specs. Anything that isn't a standard knob, switch or jack
  (a turntable platter, the VISION glass, a POCKET face) is a **surface** in `src/ui/surfaces`.
- **The patch** (`src/patch`) is the single source of truth: modules, cables and knob values.
  Undo/redo, autosave, presets, export and share links all work on it.
- **VISION** (`src/engine/dsp/vision` + `src/ui/vision`): the creatures live in the engine. three.js
  only draws what they publish, through one shared WebGL renderer for every screen, and it only
  loads once a VISION is on the rack.

```
src/
  audio/      engine bridge, MIDI + computer keyboard, recorder, inputs, buffers
  engine/     the worklet: graph, protocol, and every module's DSP (dsp/)
  modules/    specs (panels, jacks, params) and the module registry
  patch/      store, undo, persistence, layout, presets, share links
  tutorial/   the lesson runner and the lessons (data)
  ui/         rack, panels, library, surfaces, VISION scenes, tutorial UI
  dev/        test harness for running modules headless
```

---

## Adding a module

1. **Spec:** add `src/modules/specs/<name>.ts` exporting a `ModuleSpec` (type, title, HP, panel colours,
   inputs, outputs, params, controls laid out in millimetres, and its one `category`: what it is,
   from `CATEGORIES` in `types.ts`). Add it to `SPEC_LIST` in `src/modules/index.ts`, and give it an
   entry in `src/modules/catalog.ts`: its tags (what it's for, from `TAGS`) and `aka` (search words:
   the gear it's in the tradition of, jargon). Startup checks every module has one. Knobs named with
   common words (CUTOFF, DECAY, SWING…) explain themselves; give any others a line in
   `src/modules/paramGlossary.ts` (startup lists the ones missing). Odd jack names go in
   `src/modules/jackInfo.ts`.
2. **DSP:** add `src/engine/dsp/<name>.ts` with a class extending `Dsp`. Read params with
   `this.p[this.pi('id')]`, inputs with `this.in[...]`, write `this.out[...]` once per `tick()`.
   Register it in `src/engine/dsp/registry.ts`.
3. **Ready-to-play rig:** add a starter for it in `src/patch/starters/` (the group file that fits).
   It's a few lines on the shared building blocks in `kit.ts` (`melody`, `voice`, `beat`, `chords`,
   `tune`, `toOut`…); modules lay themselves out. Startup checks that every module has one; to hear
   them all, run `await (await import('/src/dev/starterCheck.ts')).checkStarters()` in the console.
4. **Surface** (only if it needs a custom face): add a component to `src/ui/surfaces` and register it
   in `src/ui/surfaces/index.ts`.
5. Run the dev server: specs, factory racks, ready-to-play rigs and panel layouts are checked on startup (problems
   appear in the browser console). Test it headless with the bench (below), then in a `?scratch` rack.

**Rules for panels** (so every module looks and behaves the same):
- Every size and gap comes from `src/modules/panelMetrics.ts` (knob radii, jack plates, label
  sizes, title, screws). Change a look there once and every module follows.
- Lay out rows with `packRows()` and spacing with `spread()` instead of hand-placing coordinates
  where you can. Both work from the real footprints, so nothing overlaps.
- Line controls up: things in the same column share an exact `x`, and things in the same row share
  an exact `y`. The linter flags anything 0.2–1.5 mm off.
- Deeper options that don't deserve panel space go in the right-click menu: make them stepped params
  with `options` and list their ids in the spec's `settings` (see VISION's garden settings).
- A stepped knob gets one tick per position automatically (`knobTicks()` in `src/ui/panel/knobModel.ts`).
- A knob drawn on a canvas surface uses `useCanvasKnobs()` from `src/ui/surfaces/canvasKnob.ts`,
  so it turns, scrolls, resets and shows tooltips exactly like a panel knob. Canvas text on a
  button goes through `fitFont()` so it never overruns.

**Rules for DSP code** (it runs 48 000 times a second per module):
- No allocations on the audio thread: no closures, spreads, `forEach` or new arrays inside `tick()`.
  Preallocate everything in the constructor.
- Don't reuse the base class's private field names (`k`, `target`) in a subclass.
- Exponential-curve knobs need a minimum above zero.
- Model the circuit or the physical behaviour. Don't fake it with a sample.

---

## Developer tools

- **`?scratch`**: a rack that is never saved, for testing without touching your own.
- **`window.__voltage`** (dev builds only): `{ patchStore, actions, history, engine, telemetry }`
  for poking the rack from the browser console. For example, `__voltage.actions.addModule('vco')`.
- **Headless bench** (`src/dev/harness.ts`): build a small graph and run it without audio output,
  then measure the result:

  ```js
  const H = await import('/src/dev/harness.ts')
  const b = H.bench([['osc', 'vco', { coarse: -1 }]])
  const r = b.run(1, [['osc', 'saw']])     // 1 s, probe the SAW output
  H.freq(r.out[0])                          // ≈ 130 Hz: C3, give or take its analog tuning
  ```

  It also has `peak`, `rms`, `rises` (gate edges) and more.
- **Validators**: `validateSpecs()` and `validatePresets()` run on dev startup and catch bad ranges,
  overlapping panels, unknown params and broken cables.
- **Panel linter** (`src/ui/panel/lint.ts`): `lintPanels()` lays out every module at every size it
  comes in and reports controls or labels that collide, cover a screw or the title, run off the
  panel, sit just out of line, or have labels too long for their plate. It runs on dev startup.

---

## Project rules

- **Realism first:** model the hardware, never fake it with samples or downloaded assets.
- **Trusted packages only:** React, Vite, TypeScript and three.js. Nothing else is installed.
- **Small files:** about 300 lines each at most. Split into components, services and registries.
- **Our own names and designs:** modules may be *inspired by* classic instruments, but use our own
  names, panels and sounds. No third-party trademarks, artwork or samples.

---

## Roadmap

What's done, what's next, and what's pinned for later: **[ROADMAP.md](ROADMAP.md)**.
