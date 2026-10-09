# VOLTAGE roadmap

Realism rule for everything here: model the circuit or the hardware behaviour, never fake it with
samples or downloaded assets. Every module is a voltage-in/voltage-out panel that can be patched
anywhere. Only well-established packages (React, Vite, TypeScript, three.js). Modules inspired by
real products get our own names, panels and sounds. See the [README](README.md) for how to use and
extend VOLTAGE.

## Done

### Engine
- Per-sample AudioWorklet graph in volts (1V/oct, ±5 V audio, 0–10 V CV); feedback loops via 1-sample delay.
- Switched-jack normalling on inputs and outputs; per-unit component tolerances; thermal drift and warm-up.
- Rail saturation; optional PSU sag (rails droop, oscillators flatten under load) and −56 dB jack crosstalk.
- Polyphonic cables (up to 8 voices, mono↔poly rules as in VCV Rack).
- AC/DC-coupled output; 24-bit WAV master recorder; jack voltage probe.
- Module audio (LOOP slots, SAMPLE) persisted in IndexedDB and restored on reload and undo.

### Modules (134)
(Grouped here by family; the library's own categories are in `modules/types.ts` CATEGORIES.)
- **POCKET family**: POCKET (drums), POCKET BASS (16 note steps, slide/accent, SUB/SQUARE/ACID), POCKET
  MELODY (scale degrees, per-step NOTE/CHORD/ARP, BELL/PLUCK/LEAD, poly NOTES), POCKET ARCADE
  (chiptune: naive pulse lead THIN/HOLLOW/SQUARE with 4-bit stepped volume and delayed vibrato, per
  step NOTE / ARP (the triad cycled at 60 Hz) / SLIDE; a 4-bit stepped triangle bass, BEAT or FOLLOW;
  15-bit LFSR noise drums (kick, snare, short-mode metallic hat), BEAT or BUSY; PULSE / TRI / NOISE
  outs; an invader on the LCD). Drag a step to set its note, right-click for its flag; off WRITE the
  buttons are a keyboard. They follow each other's CLK.
- **Systems**: MONO-1 (semi-modular mono), STUDIO-3 (2600-style), GROOVE-1 (drum machine), SKETCHBOOK
  (portable workstation), KIN-8 (DFAM-style percussion: two VCOs, noise, ladder, three decays, 8-step
  pitch/velocity sequencer), UNDERTONE (Subharmonicon-style: two VCOs with phase-locked subharmonics,
  two 4-step sequencers clocked by four polyrhythm dividers, OR/XOR, 12/8-tone equal or just quantizing),
  LOCKSTEP (FM groovebox: parameter locks, conditional trigs, polymeter), LATTICE (16×16 light grid).
- **Polyphonic**: POLY·CV, P-VCO, P-LADDER, P-ADSR, P-VCA, POLY MIX.
  - **FM-4** (four-operator FM voice, 8 notes): nine factory voices (E.PIANO, BASS, BELL, BRASS, ORGAN,
    MARIMBA, CLAV, PAD, LEAD) as operator recipes, reshaped by macro knobs (BRIGHT scales the
    modulators, DECAY stretches the envelopes, FEEDBK, DETUNE, ATTACK, RELEASE, VEL SENS) and an ALGO
    override (eight 4-op algorithms). Key sync, keyboard-scaled decays. A screen draws the algorithm
    with each operator lit by its envelope.
  - **SWARM** (supersaw, 8 notes × 7 saws): the original's detune law and centre/side mix curves,
    equal-power stereo fan (SPREAD), sub, a 12 dB filter per note and side, AR envelope; V/OCT alone
    makes it a drone. A screen shows the saws fanned in pitch and stereo.
  - Both play from the keys when GATE is empty (their own voice allocator), from POLY·CV when patched
    (a mono gate over a poly V/OCT gates the whole chord), and have a POLY out per note.
- **Sources**: VCO, COMPLEX (Buchla-style), WAVE (band-limited wavetable), SUB, NOISE.
- **Filters**: LADDER, SVF, MS-12, LPG (dual vactrol low-pass gate: fast to light, slow and slower to go
  dark; STRIKE for the west-coast "bongo"; VCA / COMBO / LP).
- **Amplifiers**: VCA, VCA×4.
- **Modulation**: ADSR, FUNC (Maths-style), FOLLOW, LFO, S&H, XY (touch pad: X/Y/pressure/speed/
  distance/angle/scale-pitch out; free, spring and fling modes; clock-synced gesture looper; four-corner
  knob morphing).
- **Shapers**: FOLD, RING, SLEW, QUANT.
- **Drums**: KICK, SNARE, CLAP, HATS, TOM, PERC, PADS, TOUCH (plates).
- **Sequencing**: CLOCK, DIV, SEQ-8, TR-16 (A–D + song chains), EUCLID, TURING, ARP, CHORD.
- **Metronomes** (shared click voice: TICK / WOOD / CLAVE / BEEP, the escapement CLACK, a bell):
  - METRONOME: beat 1 accented (higher, louder: ACCENT), 1–12 beats, 8ths / triplets / 16ths between,
    tap the screen for tempo (average of the last four taps), or follows CLK in 16ths (the gaps filled
    in, so triplets land right; the screen shows the tempo it hears). BEAT / BAR / SUB gates, RST in/out.
  - MAELZEL: a simulated clockwork pendulum (40–208, the sliding weight dragged into the scale's
    notches). Gravity with the large-swing correction, friction, and an escapement that ticks and pushes
    as the rod passes; WIND-UP runs down over ~420 ticks (the swing shrinks, runs a touch fast, stops;
    click the key) or ELECTRIC. TILT moves the escapement off centre: uneven tick-tock, up to a triplet
    shuffle. Tick and tock sound slightly different; BELL every 2/3/4/6. SWING out = the rod's angle (a
    half-tempo sine). PLANK in: another's SWING draws this one's phase toward it (frequency-neutral, so
    a locked pair keeps its tempo and only settles in step); each powers up at its own point in the
    swing, so two on a plank start out of step and fall in within half a minute.
  - COACH: speed trainer (START → TARGET by STEP bpm every EVERY bars), gap click (PLAY bars on, GAP bars
    silent; gates and 1/16 keep going), POLY (2/3/5/7 even clicks per bar); 1/16 out carries the ramping
    tempo (its rig drives a TR-16 beat).
- **Musical brains**: GHOST (learns your intervals, rhythm and key as you play, answers when you pause),
  PROGRESSION (functional-harmony chord generator, borrowed chords, voice-led poly out), BANDMATE (a
  drummer: style groove maps, energy, humanised timing, fills at phrase ends, lays back when you're loud).
- **Simulations**: BOUNCE (balls under gravity, accelerating bounces, throw them), TUMBLER (balls in a
  spinning 3–8-sided drum; each wall plays its scale degree; drag to spin, click to kick), ORBIT (Kepler orbits →
  polyrhythms, eccentric swing, conjunction gate), LIFE (Conway scanned as a sequencer), FLOCK (24 boids →
  centre/spread/speed/heading CV), CHAOS (double pendulum or Lorenz; flip/wing gates), ECOSYSTEM
  (Rosenzweig–MacArthur limit cycle, boom/crash/extinct gates).
- **Effects**: BBD, TAPE, SPRING, PLATE, PHASER, ENSEMBLE, TUNE (YIN pitch detection + delay-line
  shifter, key/scale or V/OCT target, hard-tune at SPEED 0), ECHO CHAMBER (drag speaker + mics;
  image-source reflections, Sabine-sized FDN tail, Doppler when moving), VOCODER (16 bands of
  4th-order band-pass, followers with ATTACK/RELEASE, formant SHIFT, Q, SIBILANCE pass-through, NOISE,
  FREEZE; a built-in carrier on V/OCT when CARRIER is empty; ENV out; band meter in dB).
  - **Ambient toolkit**: GRAINS (4 s memory, up to 32 Hann-windowed grains: POSITION, SIZE, DENSITY,
    PITCH, SPRAY, stereo SPREAD, REVERSE chance, FEEDBACK wash, FREEZE; grains never cross the write
    head; TRIG / V/OCT / DENSITY / POSITION CV; a screen with the memory's waveform and every grain),
    SHIMMER (the PLATE's Dattorro tank, now a shared PlateCore, with a high-passed pitch-shifted copy
    of the tail fed back: +12 / +7 / +19 / +24 / −12, soft-limited; FREEZE holds the tail), SHIFT (two
    delay-line pitch-shift voices, ±24 st + 1 V/oct CV each, FINE doubling, SIZE window, a delayed
    feedback spiral). One PitchShifter core (two sin²/cos² crossfaded taps) serves SHIMMER and SHIFT.
- **Studio tape**: TAPE KEYS (Mellotron-style: a strip per key, runs out at 8 s, spring rewind; synthesised
  strings/flute/choir), 4-TRACK (30 s × 4, punch in/out, bounce, varispeed, reverse, loop, reels).
- **Pedals** (stompboxes, click-free footswitch): FUZZ (germanium, bias sputter), WAH (draggable treadle,
  auto mode), OCTAVE (rectifier up + flip-flop down), CHORUS (BBD, stereo B out), TAPE ECHO (3 heads,
  speed bends pitch, trails on bypass), LOOPER (one-switch rec/play/dub, kept with the patch),
  VALVE AMP (triode preamp, tone stack, sagging power amp, miked 1×12/4×12 cab), TALK BOX (drag the
  mouth: vowel × jaw, formant tract + tube).
- **Played instruments**: THEREMIN (hover to play, heterodyne tone, snap, CV outs), OMNICHORD (chord
  buttons, strum plate, auto-bass, chord on a poly cable), CHORD WHEEL (circle of fifths: majors,
  relative minors and diminished rings, the key's wedge lit with roman numerals, slide between chords,
  7TH hub, soft pad + poly NOTES/ROOT/BASS/GATE/TRIG), MUSIC BOX (crank or motor, punch your own
  paper strip, steel-comb tines), STRIKE (handpan D Kurd, tenor steel pan in fifths, kalimba; tap the
  face), TANPURA (waveguide strings over a jawari bridge, self-plucking cycle), GAMELAN (saron, bonang,
  gong; slendro/pelog; paired-tuning ombak; gong pitch sag), SINGING BOWL (bow the rim with stick-slip
  friction, chatter, split modes, water), HARP (36 waveguide strings, glissando, key pedals), STYLUS
  (stylus organ: relaxation oscillator, tiny speaker, vibrato), TALLY (calculator synth: five naive
  digital sounds plus an ADSR voice programmed by an 8-digit code typed on its calculator; ten
  rhythms on PO / PI / SHA blips; REC up to 100 notes, ONE KEY PLAY by button or the ONE KEY
  input; a real chained 8-digit calculator; ♪ plays the display as a tune; 6-bit output).
- **Performance boxes**: CHOP (MPC-style: 16 pads chopped at transients, note repeat + swing, 12-bit
  vintage), DJ MIXER (kill EQ isolator, one-knob filter, faders, crossfader with scratch curve). The
  drum POCKET (8 sounds, 16 steps, per-step parameter locks) is listed with its family above.
- **Sampling**: LOOP (4 slots, overdub undo, ½× record), SAMPLE (record/load, slices), TURNTABLE
  (scratch the platter; flywheel motor + brake, 33/45, pitch, transformer CUT, strobe dots, cartridge
  output follows stylus velocity, crackle/rumble WEAR; cut your own record or load a file; factory
  battle record is synthesised).
- **Utilities / I/O**: MIX, STEREO, MULT, ATTN, LOGIC, SCOPE, MIDI·CV (aftertouch, bend range), OUT, MONITOR,
  TAP (the speakers' mix as a cable, for resampling into SAMPLE / LOOP / CHOP).
- **Mix bus**: CONSOLE (6 channels: tilt-EQ TONE, PAN, post-fader SEND, LEVEL, MUTE, and a per-channel
  DUCK from the DUCK IN sidechain with DUCK REL; stereo return, master), GLUE (SSL-style stereo bus
  compressor: soft knee, 2/4/10:1, stepped attack, release with AUTO, makeup, parallel MIX, KEY
  sidechain with HPF, GR out as CV, 5-LED meter), MASTER (low/high shelves + sweepable mid, mid/side
  WIDTH, DRIVE into a 2 ms look-ahead limiter held under CEILING).
- **Performance**: SCENES (8 whole-rack snapshots, glide recall, CV select/next), MACRO (four knobs that
  learn many moves each), ACCIDENT (roll random nudges, EVOLVE drift, undoable), MOTION (knob-motion
  recorder: four lanes; arm a lane, the first knob you turn is learned and one loop of 1–8 bars is
  recorded in time from CLK or TEMPO, then played back on that knob, MACRO-style, and out as CV; 64
  points per loop saved with the patch, SMOOTH glide; playback writes skip undo history).
- **Real-world inputs** (only on when you click ENABLE; nothing leaves the machine): AUDIO IN (mic/line
  into the rack: audio, envelope, gate, YIN pitch), CAMERA (webcam motion amount/position/brightness),
  GAMEPAD (sticks, triggers, buttons).
- **Visuals**:
  - **VISION**: a three.js tank whose creatures live on the engine clock. Five scenes: a
    bioluminescent jellyfish (swims in 3D, depth + pitch; a held TRIG jets it further), a garden (a
    meadow of swaying grass with sun shadows and haze; daisies, tulips, sunflowers that track the sun and
    dandelions whose seed clocks blow away and take root where they land; flowers close at night, drop
    petals, topple into the grass and rot away; trees grow for minutes, turn in their last autumn, drop
    their leaves and come down, and the wide shot pulls back to fit them; bees and butterflies carry
    pollen and only pollinated flowers seed beside themselves; right-click settings: SKY
    CYCLE/DAY/GOLDEN/DUSK/NIGHT, TREES, FLOWERS, INSECTS), fireflies that synchronise
    (Kuramoto), aurora with substorms, a Chladni plate whose sand finds the mode the pitch picks.
  - Generic jacks every scene uses its own way: TRIG / FEED / GLOW / PITCH / MOVE in, GATE / MOTION /
    STATE / LIGHT out (the table is in `specs/vision.ts`). COUNT sets how many things a scene has
    (up to 6 jellies, 10 plants, 48 fireflies, 6 curtains, 5000 grains).
  - VISION CORE (the engine, no screen) + any number of VISION VIEWs patched from LINK, each with its
    own scene and its own pan and zoom. All scenes live at once.
  - The glass is a touch screen (poke the jelly, plant seeds, flash a torch at the fireflies, set off a
    substorm, knock/bend the plate), with pan and zoom: scroll or pinch to zoom toward the pointer,
    middle-drag or two fingers to pan, never past the scene's own framing; touches follow the view. Sizes 12 / 20 / 28 / 40 HP with the controls packed so the glass
    gets the space; full screen and pop-out on hover.
  - One shared WebGL renderer for every screen; three.js loads only when a tank is on the rack.
  - **VECTOR** (XY-mode CRT, phosphor persistence, beam dims with speed), **WATERFALL** (log-frequency
    spectrogram), **LIGHTS** (the music lights the whole rack: bass red, mids green, treble blue).

### Rack & workflow
- Touch: a finger held still (450 ms) on a jack, knob (panel or canvas) or switch shows its tooltip,
  which lingers 2.5 s after lifting; moving past a 12 px slop starts the cable or turns the knob
  from there instead (`ui/rack/touchHold.ts`). Hover handlers ignore touch.
- Reset everywhere it matters: every module with a position in a cycle has a RST input (back before
  step 1, the next clock plays it): sequencers, the systems, POCKETs, BANDMATE (phrase count), TALLY,
  LOOP, LIFE; VISION / VISION CORE (every scene starts over, so the visuals begin with the song;
  creatures reset in place, no allocation) and VECTOR / WATERFALL (the screen wipes); 4-TRACK (tape
  to its start), LOOPER pedal, TANPURA (cycle from its first string), XY (gesture loop), and the
  simulations BOUNCE / TUMBLER / CHAOS / ECOSYSTEM (back to their exact starting state, so the
  same "random" phrase replays). Deliberately without: TURING (no beat one by design), FLOCK
  (SCATTER), and modules whose TRIG / START / RETRIG / SYNC already are their reset. Every clock
  source has a RST out (a 3 ms pulse on start or reset): CLOCK, GROOVE-1, SKETCHBOOK, UNDERTONE,
  LOCKSTEP and the POCKETs, wired into the rigs and presets that follow them.
- Jack hints (top-bar setting, on by default): while a cable is dragged, every jack it could go to rings
  (free inputs from an output, any output from an input), the occupied / wrong-way ones dim, jacks of the
  same signal family (audio / pitch / timing / CV) ring strongly in that family's colour, and the jack
  it would land on glows with its name.
- Jack tooltips: every jack's kind of signal and what it does (`modules/jackInfo.ts`: a glossary by
  name, per-module overrides, and "turns <knob> for you" for inputs named after a knob), with the live
  voltage. "Explain" (top-bar setting, on by default) adds a plain-words explanation of the signal kind.
- Knob and switch tooltips (panel knobs, switches and the knobs painted on surfaces alike): name, value,
  how to use it, and with "Explain" what it does (`modules/paramInfo.ts`: common words like CUTOFF,
  DECAY, SWING matched whole and then without leading words, so KICK DECAY reads as DECAY;
  `modules/paramGlossary.ts`: a module's own meanings and single controls). A dev-startup check lists
  any panel control without an explanation, and glossary entries for params that don't exist.
- Move a panel by its bare face (title strip, empty space; never from a control or screen), after a
  6 px drag (12 px on touch) so clicks never nudge it; slide-aside on drop, library drag-in, new-row drop.
- Library: every module in one of 20 categories by what it is (Systems, Instruments, Oscillators, CV
  Tools, Brains, Controllers, Output…), plus tags for what it's for (24: beat, bass, space, dirt,
  generative, plays itself…) and hidden "aka" search words for the gear it follows (mellotron, dfam,
  op-1, maths…), all in `modules/catalog.ts` and checked at startup. Search matches every word,
  ranked (title, aka, tags, category, tagline); Enter adds the top result, `/` focuses it; tag chips
  filter (all must match, empty ones dim); ☆ Favourites and Recent sections.
- Knobs: scroll wheel, left-drag and middle-drag.
- Cables: sag; right-click a jack pulls its cables, Shift+right-click recolours; Esc cancels a drag.
- Eurorack mounting grid: panel screws land on the rail holes.
- Played surfaces (platters, strings, pads, rooms…) via a surface registry.
- **Tutorials** (Learn menu): one continuous course from an empty case to a whole track: oscillators,
  filters, envelopes + VCA, modulation, then sequencing (CLOCK + SEQ-8 play the voice), drums (kick
  and hats on the same clock, a mixer) and effects (tape echo on the synth, plate on the mix). A dev
  startup check (tutorial/validate.ts) replays every lesson on a model rack: every module, jack and
  knob it names must exist, and each lesson must end where the next begins. Lesson 1 starts from an empty case; each lesson picks up where the last
  ended ("Next lesson" keeps your rack). WALKTHROUGH performs each step as you press Next; GUIDED
  moves on by itself when you do the step and asks you to play notes ("Show me" if stuck). Lessons run in a
  scratch rack; Finish keeps what you built. Lessons are data (steps with text, target, action).
- Undo/redo; named patch library; export/import; `?scratch` sandbox.
- **Share links**: Share → a link with the whole patch packed after `#` (compressed, defaults left out,
  ~0.4–1.4k characters for the presets); nothing is uploaded. It opens in a scratch rack with the
  title/note banner, "Keep this rack" (into the friend's Patches) and "Back to my rack". Recordings
  don't travel (the banner says so).
- Resizable screens: right-click VISION / VISION VIEW → Size 12 / 20 / 28 / 40 HP.
- Rail width: 84 / 104 / 126 / 168 HP cases (top bar); can't shrink past a module; saved and shared
  with the patch.
- **Songs** (top-bar menu, `patch/songs/`): 16 whole tracks in the style of an era, oldest first:
  Berlin School '75, Tape-Loop Ambient '78, Electro '82, Synth-Pop '83, Italo Disco '84, Acid House
  '87, Detroit '88, Rave '92 (SWARM hoover through SLEW, organ stabs), Jungle '94 (chopped breaks
  at 165, Reese bass on a droning SWARM), Dub Techno '94, Filter House '97, UK Garage '98 (two-step
  kick, swung hats, FM organ bass), Trance '99, Trap '12, Synthwave '15, Lo-fi Hip-Hop '17 (the
  music bus through a wet-only TAPE for wow and hiss). Original notes; the era's
  production tricks recreated. Built from song parts (`parts.ts`): `x...` drum-pattern strings with
  A→B / A→D arrangements on TR-16, PROGRESSION harmony with bass and riffs following its root
  (pitch sums through MIX), CHORD → POLY MIX for poly stabs, a CONSOLE desk (pan, send/return
  effect, kick ducking), and MOTION lanes recorded in advance (filter builds and sweeps). Checked at
  startup like the presets; levels matched headless.
- 18 factory presets (incl. five POCKET racks: boom bap, electro, lo-fi, + bassline, the Pocket Band);
  Jellyfish Dream (the jelly plays the melody) is the first-run rack.
- README with a user guide, architecture and a how-to for adding modules.
- **Ready-to-play rigs**: right-click any module in the library → that module wired up with everything
  it needs to make music, added below the rack with a how-to toast (one undo step). Every module, each
  rig built around what that module is for: effects get material that shows them off (dub stabs into
  the BBD, a string machine into ENSEMBLE, a breakbeat in the ECHO CHAMBER), pedals a plucked-string
  "guitar" riff, drums a groove that features that drum (a trap 808 walking a bassline, disco hats,
  a son clave on the rim), filters their signature sound (acid into the LADDER, a screaming MS-12, LPG
  bongos). Phrases and grooves live in `starters/material.ts` (natural minor and dorian, no pentatonic
  hooks). Startup checks every module has one; a headless check plays each and confirms sound reaches
  the speakers at a sane level (played instruments excepted).
- Row menu (right-click an empty rail → Remove row, with a move/remove/cancel prompt if it has modules).
- **UI pass, standardised panels**: one metrics file for every control's geometry; stepped knobs show
  one tick per position; `packRows`/`spread` layout helpers; a dev-startup panel linter (overlaps,
  screws, title, near-miss alignment, label fit) reporting 0 across all 111 modules and sizes;
  canvas knobs (POCKETs) share the panel knob model (left/middle drag, wheel, double-click,
  tooltips); tooltips on every control.

## Waiting on a decision
- ~~System direct output~~ (decided: switched direct out). MONO-1, STUDIO-3 and GROOVE-1 feed the
  speakers until their main output (VCA / OUT / MIX) is patched, then play only through the rack (no
  more doubling in their rigs). The newer systems have no direct path: patch them to OUT.

## Up next
- **Tutorial suite**: ~~sequencing, drums, effects~~ (lessons 5–7 of the course), ~~polyphony,
  semi-modular normals, a tour of Acid House~~ (done: the Learn menu is now three courses: Synth
  fundamentals (continuous), Beyond the basics, Tours of the factory racks; a `disconnect` step pulls a
  cable). Tours: Acid House, Jellyfish Dream, Poly Strings, West Coast (`type#n` names the n-th of a
  type). Played instruments: the theremin and the omnichord (a `touch` step notices a surface being
  played, via engine.uiListeners, and walkthrough / Show me replays a demo gesture on it; the surface
  gets a ring). Systems: GROOVE-1 (program a beat on the grid, swing, A→B fill) and LOCKSTEP
  (tracks, a step, a page and knob, mutes, patterns, chain); a `step` action lights one key of a step
  grid (a bitmask bit), ringed on the grid; targets drawn on a module's own face ring the face.
  Parameter locks (a `lock` step: picks the step, opens the page, locks the knob; starts from the
  groovebox lesson's rack) and a tour of Pocket Band. Instruments: theremin, omnichord, stylus organ,
  harp. Later, if wanted: music box, tanpura, gamelan, singing bowl, TALLY, LATTICE.
- **XY pad extras**: multi-touch → poly cables on tablets; save the recorded gesture with the patch.
- **POCKET family** (calculator-sized grooveboxes that clock each other over CLK; our own names, look and
  sounds; no third-party trademarks, artwork, LCD characters or samples):
  - ~~POCKET BASS~~ and ~~POCKET MELODY~~: done (see Modules).
  - POCKET SAMPLER: record from IN into 8 slots, chop across the buttons, sequence them (reuses the
    SAMPLE/LOOP buffers).
  - ~~POCKET ARCADE~~: done (see Modules).
  - POCKET ROBOT: live lead played on the buttons, glide and effects, records into steps.
  - POCKET SPEAK: syllables per step with pitch locks (formant voice from the talk box).
  - POCKET OFFICE: a noise-and-click drum kit (typewriter, glitch hats).
  - Shared upgrades: 16 hold-to-play punch-in effects (stutter, loop, filter sweep, crush, retrigger,
    reverse), several patterns per pocket chained into a song, a family LCD with its own animated mascot.
- **VISION extras**: TOUCH X / Y / GATE outputs (the glass as a performance pad), a DEPTH output for the
  jelly, and the new scenes (coral reef, rain on a pond, starling murmuration) built in 3D so there's
  something to see wherever you zoom.

## Pinned for later: cloud saving, short links and a public gallery
Goal: short links anyone can open; public patches browsable on the site; private patches only their
owner can load. Today everything is in the browser (autosave, Patches, Export/Import, in-the-link
sharing), which stays as the no-account option.

- **Plan**:
  - A small Node server on Railway replaces the static hosting. It serves the app plus an API (save,
    load, list mine, browse public, delete).
  - Visibility per patch: **private** (owner only), **unlisted** (anyone with the short link `/p/k3x9`),
    **public** (in a **Browse** gallery with search and newest / most-loaded).
  - In the app: Sign in, Save to cloud (title, note, visibility), My patches, Browse, short links from
    Share.
  - Size and rate limits, a Report button on public patches, an admin page to remove things, and
    sessions in httpOnly cookies.
  - Railway setup (walkthrough when we pick this up): add Postgres, add a session secret, switch the
    service to the server.
- **Open decisions**:
  1. Sign-in: username + password (simplest, no email reset), email magic link (needs an email
     provider), or "Sign in with GitHub".
  2. Whether cloud saves carry LOOP/SAMPLE recordings (bigger storage; cap ~20 MB per patch).
  3. Moderation: Report + admin delete enough?
  4. Database: Railway Postgres (managed, backups) or SQLite on a volume (cheaper, no backups).
- Before it: version history of the autosaved rack and a full-copy `.voltage` file with recordings
  bundled in (local, no server).

## Pinned for later: what big synth artists use (gap review)
Our own versions throughout: inspired by the classics, our own names, panels and sounds.
- **Suggested order**:
  1. ~~Mix bus~~ (done: CONSOLE with per-channel sidechain DUCK, GLUE bus compressor, MASTER EQ /
     width / limiter). Later: multiband ("OTT"-style), a channel compressor per strip.
  2. ~~Vocoder and low-pass gate~~ (done: VOCODER, LPG).
  3. ~~FM voice and supersaw~~ (done: FM-4, SWARM). Still open: unison stacking for the analog poly voice.
  4. ~~Knob-motion recording and resampling~~ (done: MOTION, TAP). Later: per-step motion like
     Elektron's (one value per trig), recording switches.
  5. ~~Ambient toolkit~~ (done: GRAINS, SHIMMER, SHIFT).
  6. ~~MIDI clock in/out~~ (done, on CLOCK: SYNC MIDI IN follows 24 PPQN clock with START /
     CONTINUE / STOP, its bar ramp anchored to the tick count and the tempo smoothed from tick
     intervals (shown on the knob); MIDI OUT sends clock / START / STOP, each byte stamped with its
     audio frame and scheduled through Web MIDI timestamps via the context's output timestamp).
     Later: song position pointer, MIDI notes out.
- **Gaps by sound**:
  - Analog poly: unison/detune stacking, poly-mod, built-in chorus (Prophet / Juno / CS-80 / OB style).
  - Mono: full acid sequencer, 3-osc Model-D-style system.
  - Modular: quad LFO, probability / ratchet gates (Bernoulli-style), sequential switch, track & hold.
  - Digital: FM, sample-based drum kit (LinnDrum-style), macro oscillator (Plaits-style), resonator
    (Rings-style).
  - EDM: sidechain, multiband ("OTT"-style), supersaw.
  - Stereo: panner, mid/side widener, auto-pan, ping-pong delay (most of the rack is mono today).
- **Beyond modules**: per-module presets (save a module's settings), song mode / arranger (chain
  patterns and scenes), velocity + aftertouch routing and MPE input, Scala / just-intonation tunings.

## Systems (whole instruments, our own names and looks)
Have: MONO-1, STUDIO-3, GROOVE-1, SKETCHBOOK, KIN-8, UNDERTONE, LOCKSTEP, LATTICE, the POCKET family; played: OMNICHORD, STYLOPHONE, TAPE KEYS, THEREMIN.
- **Shortlist, in order**:
  1. **OP-1-style workstation: SKETCHBOOK** (64 HP). Four encoders that follow the mode, on-panel
     keybed, screen; semi-modular (CLK / V/OCT / GATE / AUDIO in; CLK / PITCH / GATE / L / R out).
     - ~~Phase 1~~ (done): modes SYNTH / SEQ / TAPE / MIX; engines TWIN (2 osc + filter), DUO (2-op FM),
       PLUCK (Karplus-Strong), SWARM (supersaw + sub); shared ADSR; 6 voices; 16-step pattern,
       step-recorded from the keys (REST, cursor); 4-track loop tape in tempo (1–8 bars, REC punches
       the selected track, CLEAR, DRIVE saturation); track levels; AUDIO IN onto tape.
     - ~~Phase 2~~ (done): engines PHASE (CZ-style), DUST (noise resonator + crusher), WAVE (morphing
       wavetable) → 7 engines; per-sound FX (DELAY ping-pong, CHORUS, PHONE, CRUSH) and LFO (to pitch,
       knob 1, knob 3, volume); sequencer types PATTERN / ARP / TUMBLE (TUMBLER's drum, shared
       TumbleCore) / DRIFT (mutating pattern, KEEP); DRUM mode: 8-sound analog kit, 16 steps per
       sound, edited by touching the screen grid.
     - Later in phase 2's spirit: a sampler engine, a sketch (draw-a-melody) sequencer.
     - ~~Phase 3~~ (done): TAPE TRICKS page: varispeed SPEED (−2…2×, negative = reverse, motor
       inertia), LOOP IN / OUT, WOW, LIFT / DROP (touch buttons on the screen); touch a lane to pick
       the track; T1–T4 track outputs; K1–K4 CV onto the sound's knobs; the tape is kept with the patch
       (and Export audio (WAV) per track).
  2. ~~**DFAM + Subharmonicon-style pair**~~ (done): **KIN-8** (48 HP) and **UNDERTONE** (60 HP),
     both semi-modular with patch bays whose inputs break their normals. KIN-8: two VCOs (TRI/SQR,
     VCO EG pitch sweep ±5 oct, 1→2 FM, hard sync), noise / EXT IN, ladder LP/HP with NOISE MOD, VCO /
     VCF / VCA decay envelopes (VCA FAST/SLOW attack), 8 steps of PITCH (to VCO 2 / both / off;
     semitone snapping in its right-click menu) and VELOCITY (scales the VCA and VCF EG; 0 = a rest);
     TRIG / ADV buttons. UNDERTONE: two VCOs (SAW/SQR) each with two subharmonics ÷1–16 (counted off
     the VCO, phase-locked), six levels, ladder + AD envelopes, VCA ENV/DRONE; two 4-step sequencers
     that move a VCO and/or its sub divisions (ASSIGN grid); four rhythm dividers of the tempo routed to
     either sequencer (grid), OR / XOR; QUANTIZE OFF / 12-ET / 8-ET / 12-JI / 8-JI, SEQ RANGE ±1/±2/±5,
     GLIDE. UNDERTONE's ready-to-play rig clocks KIN-8 from its CLK, the way the pair is played.
  3. **Elektron-style groovebox: LOCKSTEP** (56 HP).
     - ~~Phase 1~~ (done): four tracks, each an FM voice (operators C / A / B, six algorithms, eight
       ratio sets, B feedback, mod envelope, pitch SWEEP for drums, AD amp, filter, pan, delay send);
       16 steps per track with its own LENGTH and SPEED (1/4…2×), so tracks drift (polymeter); per
       step a NOTE, a condition (ALWAYS, A:B, 75/50/25/10%, FILL / !FILL, FIRST / !FIRST) and
       parameter locks on all twelve sound knobs (packed four to a param); swing, ping-pong delay,
       momentary FILL; CLK / RUN / FILL / RESET in; CLK, T1–T4, L / R out. Click a step key to toggle
       it; right-click (or hold) to pick it and lock knobs on it.
     - Phase 2, first part (done): track MUTES (hold or right-click T1–T4), RETRIG ratchets (×1–×4
       evenly through the step, same note and locks) and MICRO timing (±12/24 of a step, early
       steps fire before their boundary) per step, on the TRIG page's encoders 3 and 4; keys show
       ×N and ◂ / ▸. The factory pattern uses them (a lazier bass, a hat roll).
     - Phase 2, second part (done): PATTERNS A–D. The sound (knobs, algo, root, length, speed,
       mutes) is shared; a pattern holds the trigs and every step's note, condition, ratchet, nudge
       and locks (pattern A keeps the old ids, so older patches load as A; B–D are prefixed `B.`).
       Picked while playing, a pattern blinks and waits for the end of the bar (16 master steps),
       then starts from step 1; stopped, it changes at once. The keys and screen show and edit the
       picked pattern. COPY (the pattern; with a step picked, the step; hold: the selected track)
       and PASTE (one undo); with a step picked the pattern row becomes UNLOCK / CLEAR / DONE.
       Factory: A the groove, B a busier variation, C a breakdown (the kick only with FILL held),
       D blank.
     - Phase 2, third part (done): CHAIN (up to eight patterns, a bar each, each starting from step 1;
       tap CHAIN to play / stop it, hold it to write a new one by tapping patterns, tap to finish; the
       header shows the chain with the slot playing; factory A A B C) and PAT in (0–10 V picks A–D in
       2.5 V bands, cued for the bar). Both move the PATTERN param, so the face follows.
     - Phase 2, fourth part (done): an LFO page (lockable like the others): SPEED (4 bars … 1/16,
       locked to the master clock), AMOUNT (bipolar), DEST (pitch ±6 st, FM depth, cutoff, level,
       pan, delay send) and REVERB, a per-track send to a shared plate. Per-step SLIDE (on the
       picked-step row; keys show ~): glides from the last note's pitch over half a step, legato if
       it still sounds, else a fresh attack that swoops in. Factory: bass breathes and slides up to
       its octave, hats auto-pan, the bell swells over four bars in plenty of reverb.
     - Phase 2 is done; next for LOCKSTEP: the sampler voice (with the sampler core).
  4. **Tenori-on-style light grid: LATTICE** (40 HP).
     - ~~Phase 1~~ (done): 16×16 lights, four layers drawn on the same grid (selected layer bright,
       the others dim, each its own colour); per layer MODE (SCORE: columns are time, rows pitch, a
       column plays as a chord; BOUNCE: one ball per column dropped from its lit cell, sounding on
       landing; RANDOM: the lit dots one at a time in no order), SOUND (BELL, PLUCK, GLASS, PAD, BASS
       from SKETCHBOOK's engines; DRUMS: rows are its kit), OCTAVE, LOOP, RATE (1/4…1/32), VOLUME;
       rows follow SCALE in KEY; every note ripples out across the lights; drag to draw; CLK / RUN /
       RESET in, L1–L4 and L / R out.
     - Phase 2, first part (done): eight layers (L1–L4 keep their own outs; 5–8 only in L / R; the
       layer buttons in two rows), per-layer SWING, and three modes: HOLD (our take on "push": every
       lit dot is a held note, struck again each LOOP, dots lit meanwhile join in), SOLO (play the
       lights by hand: row the note, across the velocity, held till the finger lifts or moves) and
       DRAW (hold and trace: one cell per step of the layer from the moment you press, rests off the
       lights, up to 32; plays as you draw, then loops; the trace's cells light up). Factory layer 5
       is a drawn hill on GLASS, swung.
     - Phase 2, second part (done): PAGES A–D, each the whole grid (every layer's lights and trace;
       the layers' settings are shared; page A keeps the old ids, B–D prefixed). Picked while
       playing, a page blinks and switches at the end of the bar (HOLD strikes afresh, traces start
       over); hold (or right-click) a page button to copy this page into it; PAGE in picks by
       voltage (2.5 V bands). Factory: A the tune, B a variation, C a breakdown, D blank.
       LATTICE phase 2 is done.
  5. ~~**VL-Tone-style calculator synth**~~ (done: **TALLY**, 32 HP). Later: auto-play of the
     remembered tune with its note lengths, the calculator's memory keys.
- **Also pinned**: OP-XY / OP-Z-style sequencer brain (could drive VISION), EP-133-style sampler-composer,
  Kaossilator / KAOSS-style XY performance system, Game Boy + LSDJ-style chiptune tracker, Roland MC-707 /
  Novation Circuit-style clip groovebox, Korg Volca-style stack, Juno-60/106-style poly, Model D-style
  mono, Buchla Easel-style west coast, Make Noise 0-Coast-style, DX7 / Casio CZ voices, Prophet-5-style
  poly; samplers per the sampler review (SP-404 / MPC, Octatrack, M8 / Polyend tracker).

## Pinned for later: Songs
- More eras: Miami bass '86, house piano '90, minimal '05, dubstep '08, footwork '10.
- Intros and breakdowns: MOTION lanes muting and bringing in parts, so a song has sections.
- A "how this song works" tour per song (tutorial runner: ring each part, say what the era's
  trick is and which knob shows it off).

## Pinned for later: samplers (industry review)
A sampler's sound is its hardware, so model the hardware: bits, rate, anti-alias filter (or none),
variable-rate playback (aliasing that follows pitch), companding, per-voice analog filter, time-stretch
artifacts, swing. Material: record from IN (any rack sound), load your own, or synthesised factory
material (no downloaded samples). Our own names; no Fairlight / Akai / MPC / SP / Octatrack marks.
1. **Sampler core**: shared playback with a converter model; CHOP moves onto it.
2. **ERA**: run any cable through a period converter (8-bit variable-rate, 12-bit punchy, Amiga, 90s rack).
3. **TRACKER**: Amiga-style tracker (Paula 8-bit ~28 kHz + LED filter; vertical rows, effect columns).
4. **Lo-fi FX sampler** (SP-404 / EP-133 style): pads, punch-in effects, fader moves recorded,
   resampling (vinyl sim, crushing compressor, bitcrush, filter).
5. **Early-80s workstation** (Fairlight / Emulator style): pitched per-key sample with variable-rate
   aliasing, grid sequencer, our own synthesised orchestra stab.
6. **JUNGLE** (S950 style): cyclic time-stretch artifacts on breaks built from our drum models.
7. **Performance sampler** (Octatrack style): 4–8 tracks, live slicing, scene crossfader, pickup looper.
8. **Multisample instrument**: zones, velocity layers, round robin, filled from rack recordings.

## Pinned for later: Teenage Engineering-inspired (our own names, look and sounds)
- ~~Spinning-shape physics sequencer~~ (done: TUMBLER).
- Retrospective recorder: the rack is always being recorded; scrub back and loop what just happened.
- CHOIR: a row of little formant singers that sing notes, vowels or words and harmonise.
- Step components on TR-16 / SEQ-8 (per-step probability, ratchets, pulse count, random) (OP-Z style).
- 4-TRACK tape tricks: lift/drop sections, reverse a region, loop, speed scrub (OP-1 style).
- Draw-a-melody sequencer and pattern keys (OP-1 "sketch" / "finger" ideas).
- OP-1-style effects: "phone" lo-fi band-pass, punch compressor, resonant comb grid.
- POCKET ARCADE / OFFICE / ROBOT / SPEAK / SAMPLER (already in Up next).

## Pinned for later: creative modules
- **Character output**: cassette deck and vinyl-lathe export.

## Pinned for later: industry-standard tools
- **Mixing & master**: mixer console (channel strips, EQ, pan, mute/solo, 2 send/return buses), sidechain
  compressor, 4-band parametric EQ with curve display, glue compressor, limiter, mid/side widener,
  transient shaper, noise gate.
- **Meters**: tuner, spectrum analyser, LUFS loudness meter, stereo correlation meter.
- **Modules inspired by famous Eurorack designs** (our own names, panels and sounds): Plaits-style macro oscillator, Rings-style resonator, Clouds-style granular,
  Grids-style drum map, Marbles-style random, Metropolix-style sequencer, Disting-style multi-tool.
- **Classic instruments**: 6-op FM (DX7-style), supersaw (JP-8000-style), tonewheel organ + rotary speaker,
  electric piano model, 303-style acid voice, vocoder / talk box.
- **Effects**: tempo-synced ping-pong delay, algorithmic hall/room, flanger, auto-filter,
  tremolo/auto-pan, pitch shifter/harmoniser, bitcrusher, multiband distortion.
- **DAW-style sequencing**: piano roll / clip launcher, MIDI file player, song arranger, swing templates,
  scale lock, chord memory, strum, tap tempo, MIDI clock in/out.
- Suggested order: mixer + sidechain → Plaits/Rings-style → FM + supersaw → piano roll.

## Next

### Systems
- West-coast system: complex oscillator + low-pass gates + pulser + 5-step sequencer (Easel-style).
- 3-oscillator mono system in the Model D tradition (ladder, mixer feedback trick).
- Six-voice poly system: DCO-style voices, built-in chorus (Juno-style), arpeggiator.

### New modules
- **Low-pass gate**: vactrol LPG with the real vactrol attack/decay response.
- **Physical models**: Karplus-Strong string, modal resonator (struck/bowed), formant filter, 16-band vocoder.
- **Granular**: granular processor on SAMPLE/LOOP buffers (position, size, density, spray, pitch).
- **Spectral**: Bode frequency shifter, pitch shifter, comb filter, resonator bank.
- **Dynamics & dirt**: bus compressor with sidechain, limiter, diode/transistor fuzz, bitcrusher/decimator.
- **Sequencing**:
  - Full-size acid sequencer with per-step slide and accent (POCKET BASS covers the basics).
  - Cartesian (René-style) sequencer.
  - TR-16 step probability, ratchets and micro-timing.

### MIDI & sync
- MIDI clock in and out; MIDI out (CV → MIDI) to drive external gear; MPE input to POLY·CV.

### Realism
- Neighbouring modules warm each other (a case temperature model); power-on thump.
- "Unit personality" re-roll per module; slow component ageing across sessions.

### Workflow
- Multitrack stem export (record any jack); per-module CPU meter.
- Patch files that bundle their LOOP/SAMPLE audio (zip export/import).
- Favourites and tags in the library; minimap; zoom-to-module; cable bundling.
- Hover a cable to highlight the whole signal path through the rack.
- Touch support for tablets.

### Performance
- Port the heaviest DSP (ladders, reverbs, poly voices) to WebAssembly SIMD if large racks run hot.
