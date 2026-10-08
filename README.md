# VOLTAGE

**A modular synthesizer in the browser that behaves like the real thing.**

VOLTAGE is a Eurorack-style rack: mount modules, patch them with cables, turn knobs, and listen.
Underneath, every sample of every module is computed in **volts**, the way the circuits work (1 V/octave
pitch, ±5 V audio, 0–10 V control voltages, rails that saturate, components that drift as they warm
up). There are no samples and no downloaded assets: every sound, from a ladder filter to a
singing bowl to a vinyl record, is synthesised.

- **130 modules**: oscillators, filters, envelopes, sequencers and drums; pedals, tape machines and
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

You need a current [Node.js](https://nodejs.org) (22 or newer recommended) and a modern desktop
browser (Chrome, Edge, Firefox or Safari).

```bash
npm install
npm run dev
```

Open <http://localhost:5204> and press **POWER OFF** (top left) to turn the rack on. Browsers only
allow audio to start after a click, so the rack always starts powered down.

| Command | What it does |
|---|---|
| `npm run dev` | Development server with hot reload on port 5204 |
| `npm run build` | Type-check, then build the static site into `dist/` |
| `npm run typecheck` | Type-check only |

**Deploying:** `npm run build` produces a fully static site in `dist/` (HTML, JS, CSS; no server
needed). The live version is hosted on Railway from this repository.

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
- **Right-click a module:** Duplicate, Reset knobs, Export audio (for modules that record), **Size**
  (for resizable screens), any deeper settings it has (VISION's garden), and Remove.

### Knobs, switches and cables
| Do this | To |
|---|---|
| Scroll over a knob, or drag it up/down (left or middle button) | Turn it (hold **Shift** for fine control) |
| Double-click a knob | Reset it to its default |
| Drag from a jack to another jack | Patch a cable (output → input); dropping on an input replaces its cable. With **Jack hints** on (top bar), every jack the cable could go to rings while you drag (free inputs from an output, every output from an input), the ones carrying the same kind of signal ring brightest in that kind's colour (audio blue, pitch yellow, gates/triggers/clocks orange, CV violet), and the jack it will land on glows with its name |
| Hover a jack | What it is: its name, the kind of signal (with the same colour), what it does, and the live voltage. With **Explain** on (top bar), a plain-words explanation of that kind of signal too (what a gate is, what V/OCT means) |
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

The full list, with what each module does, is in [ROADMAP.md](ROADMAP.md#modules-130). The module
list on the left groups them by what they are (below); search finds them by name, by what you want
("bass", "reverb", "beat"…) or by the gear you know ("mellotron", "dfam", "op-1"); every word must
match, Enter adds the top result and `/` jumps to the box. Tag chips narrow the list (all tags must
match), ☆ stars a module into Favourites, and the last few you added sit under Recent.

| Category | For example |
|---|---|
| **Systems** | the POCKET family, MONO-1 (semi-modular mono), STUDIO-3 (2600-style), GROOVE-1 (drum machine), SKETCHBOOK (portable workstation: 7 four-knob synth engines with an effect and LFO each, a drum kit, pattern / arpeggio / tumbling-drum / drifting sequencers, 4-track loop tape with varispeed, reverse, loop points and lift/drop, mixer, keybed; kept with the patch), KIN-8 (DFAM-style percussion with an 8-step pitch/velocity sequencer), UNDERTONE (Subharmonicon-style: subharmonic oscillators, two 4-step sequencers, four polyrhythm dividers; clocks KIN-8), LOCKSTEP (FM groovebox: four tracks, per-step parameter locks and conditional trigs, per-track length and speed; right-click a step to lock knobs on it), LATTICE (16×16 light grid: four layers that SCORE, BOUNCE or play at RANDOM, notes rippling across the lights) |
| **Instruments** | Theremin, Omnichord, Chord Wheel, music box, handpan/steel pan/kalimba, tanpura, gamelan, singing bowl, harp, stylophone, TAPE KEYS (Mellotron-style), **TALLY** (a calculator that plays: tiny digital sounds, a rhythm box, ONE KEY PLAY, and ♪ to hear any number) |
| **Polyphonic** | POLY·CV, P-VCO, P-LADDER, P-ADSR, P-VCA, POLY MIX; complete voices that play chords straight from your keys: **FM-4** (four-operator FM: electric piano, bass, bells, brass, organ…) and **SWARM** (supersaw) |
| **Oscillators** | VCO, complex (west-coast) oscillator, wavetable, sub, noise |
| **Filters** | Ladder, SVF, MS-12, LPG (vactrol low-pass gates: strike them for the west-coast "bongo") |
| **Amps & Mixers** | VCA, VCA×4, mixer, stereo mixer, DJ mixer; the mix bus: CONSOLE (6 channels, sidechain DUCK per channel: feed it the kick for the pump), GLUE (bus compressor with KEY sidechain and GR out), MASTER (EQ, stereo width, look-ahead limiter) |
| **Envelopes & LFOs** | ADSR, FUNC (Maths-style), follower, LFO |
| **Shapers** | Wavefolder, ring modulator |
| **CV Tools** | Quantizer, slew, S&H, attenuverters, mult, logic, chord generator |
| **Drums** | Analog kick, snare, clap, hats, toms, perc |
| **Sequencers** | Clock, dividers, SEQ-8, TR-16, Euclid, Turing machine, arpeggiator |
| **Brains** | GHOST (answers your phrases), PROGRESSION (chord progressions), BANDMATE (a drummer) |
| **Simulations** | BOUNCE, TUMBLER, ORBIT, LIFE, FLOCK, CHAOS, ECOSYSTEM: physics and biology as sequencers |
| **Effects** | BBD, tape echo, spring, plate, phaser, ensemble, pitch-correction, echo chamber, VOCODER (16 bands: make a synth talk, or a beat sing); for ambient: **GRAINS** (granular clouds from the last 4 s, FREEZE a moment), **SHIMMER** (a reverb whose tail climbs in octaves), **SHIFT** (two-voice harmoniser with a feedback spiral) |
| **Pedals** | Fuzz, wah, octave, chorus, tape echo, looper, valve amp, talk box |
| **Sampling & Tape** | LOOP, SAMPLE, TURNTABLE (scratchable), CHOP (MPC-style), 4-TRACK |
| **Controllers** | MIDI·CV, pads, touch plates, XY pad, audio in (mic/line), camera (motion), gamepad |
| **Performance** | SCENES (rack snapshots), MACRO, ACCIDENT, **MOTION** (records a knob's movement and loops it in time: click a lane, turn any knob) |
| **Visuals** | VISION, VISION CORE, VISION VIEW, vector CRT, spectrogram, light show, scope |
| **Output** | OUT, MONITOR, TAP (everything you hear, as a cable: resample the whole mix into SAMPLE, LOOP or CHOP) |

---

## Highlights

### VISION: living scenes you patch
A glass tank with a creature in it, running on the same clock as the audio. CV steers it (TRIG,
FEED, GLOW, PITCH, MOVE) and its movements come back out as voltages (GATE, MOTION, STATE, LIGHT),
so the visuals can play the music and the music can drive the visuals.

- **Five scenes:** a bioluminescent **jellyfish** that swims in 3D (long notes carry it further); a
  **garden** (below); **fireflies** that fall into sync; an **aurora** with substorms; a **Chladni
  plate** whose sand finds the shape of the note.
- **The garden** is a meadow through days and nights. Daisies, tulips, sunflowers (they turn to follow
  the sun) and dandelions (their seed clocks blow away and come up where the seeds land) live whole
  lives: they close at night, drop petals as they die, fall into the grass and rot away. Trees grow
  behind them over minutes, turn and drop their leaves in their last autumn and come down, and the
  camera pulls back to fit them. Bees and butterflies carry pollen between flowers of a kind, and only
  pollinated flowers seed beside themselves, so where the insects go decides what spreads.
  **Right-click** for its settings: sky (a day/night **CYCLE**, or day, golden hour, dusk, night),
  trees, which flowers, and how many insects. A VISION VIEW's menu sets its linked tank's garden.
- **COUNT:** how many of each thing (up to a smack of six jellies, ten plants, 48 fireflies).
- **The glass is a touch screen:** poke the jelly, plant a seed, flash a torch at the fireflies,
  set off a substorm, knock the plate.
- **Pan and zoom:** scroll or pinch to zoom (toward the pointer), middle-drag or two fingers to pan.
  A touch still lands on what you see. Hover the glass for ⟲ to reset the view.
- **VISION CORE + VISION VIEW:** run the creatures in a slim screenless module and show them on any
  number of VIEW screens, each with its own scene and its own pan and zoom.
- **Sizes:** right-click → Size (12 / 20 / 28 / 40 HP). Hover the glass for full screen or a pop-out
  window.

Try the **Jellyfish Dream** rack (the first-run rack), where the jelly plays the melody.

### The POCKET family
Calculator-sized grooveboxes with 16 steps, two knobs and a little LCD. Chain them with **CLK out →
CLK in** and they play as one band.

- **POCKET:** eight drum sounds, with per-step parameter locks (right-click a step).
- **POCKET BASS:** 16 note steps with **slide** and **accent** (SUB / SQUARE / ACID voices).
- **POCKET MELODY:** steps are notes of a scale, so nothing is out of key. Each step can be a note,
  a **chord** or an **arpeggio**.

In WRITE mode, click a step on/off, **drag it up/down** to set its note, and right-click for its
slide/accent or chord/arp. With WRITE off, the 16 buttons are a keyboard. Start from the **Pocket
Band** rack.

### Learn
**Learn → Synth fundamentals** is one continuous course (oscillators → filters → envelopes and VCAs
→ modulation). Each lesson picks up where the last ended, and **Finish** leaves you with the rack
you built.

---

## Saving and sharing

- **Your rack saves itself** in the browser as you work.
- **Patches → Save current rack…** keeps named racks in the browser; the same menu has the
  factory racks.
- **Songs** loads a whole track in the style of an era, from 1975 Berlin School to 2017 lo-fi
  hip-hop (16 so far): Electro, Synth-Pop, Italo Disco, Acid House, Detroit, Rave, Jungle, Dub
  Techno, Filter House, UK Garage, Trance, Trap, Synthwave and more. Each is the rack that plays
  it, built on that era's signature trick (the 303-style squelch ridden by hand, the octave-jumping
  Italo bass, the rave hoover, the Reese bass, the two-step shuffle, the trance gate, the
  filter-house sweep, the 808 as a bassline, worn tape over everything, loops of different lengths
  drifting apart). The notes are all our own. Loading replaces
  the rack (Ctrl+Z brings yours back); power on, then pull it apart.
- **Export / Import** writes and reads a `.json` patch file, for backups or moving to another computer.
- **Share** copies a link to the rack, with an optional title and note for whoever you send it to.
  The whole patch is packed into the link (after the `#`), so nothing is uploaded anywhere. Links
  open in a **scratch rack** that never touches the recipient's own patch; they can **Keep this
  rack** to save it into their Patches.
- Recordings made inside modules (LOOP, SAMPLE, the looper, 4-TRACK…) are kept in the browser with
  your rack, but don't travel in links or patch files yet.

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
