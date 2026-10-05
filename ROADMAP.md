# VOLTAGE roadmap

Realism rule for everything here: model the circuit or the hardware behaviour, never fake it with
samples or downloaded assets. Every module is a voltage-in/voltage-out panel that can be patched
anywhere. Only well-established packages (React, Vite, TypeScript, three.js).

## Done

### Engine
- Per-sample AudioWorklet graph in volts (1V/oct, ±5 V audio, 0–10 V CV); feedback loops via 1-sample delay.
- Switched-jack normalling on inputs and outputs; per-unit component tolerances; thermal drift and warm-up.
- Rail saturation; optional PSU sag (rails droop, oscillators flatten under load) and −56 dB jack crosstalk.
- Polyphonic cables (up to 8 voices, mono↔poly rules as in VCV Rack).
- AC/DC-coupled output; 24-bit WAV master recorder; jack voltage probe.
- Module audio (LOOP slots, SAMPLE) persisted in IndexedDB and restored on reload and undo.

### Modules (107)
- **Systems**: MONO-1 (semi-modular mono), STUDIO-3 (2600-style), GROOVE-1 (drum machine).
- **Polyphonic**: POLY·CV, P-VCO, P-LADDER, P-ADSR, P-VCA, POLY MIX.
- **Sources**: VCO, COMPLEX (Buchla-style), WAVE (band-limited wavetable), SUB, NOISE.
- **Filters**: LADDER, SVF, MS-12.
- **Amplifiers**: VCA, VCA×4.
- **Modulation**: ADSR, FUNC (Maths-style), FOLLOW, LFO, S&H, XY (touch pad: X/Y/pressure/speed/
  distance/angle/scale-pitch out; free, spring and fling modes; clock-synced gesture looper; four-corner
  knob morphing).
- **Shapers**: FOLD, RING, SLEW, QUANT.
- **Drums**: KICK, SNARE, CLAP, HATS, TOM, PERC, PADS, TOUCH (plates).
- **Sequencing**: CLOCK, DIV, SEQ-8, TR-16 (A–D + song chains), EUCLID, TURING, ARP, CHORD.
- **Musical brains**: GHOST (learns your intervals, rhythm and key as you play, answers when you pause),
  PROGRESSION (functional-harmony chord generator, borrowed chords, voice-led poly out), BANDMATE (a
  drummer: style groove maps, energy, humanised timing, fills at phrase ends, lays back when you're loud).
- **Simulations**: BOUNCE (balls under gravity, accelerating bounces, throw them), ORBIT (Kepler orbits →
  polyrhythms, eccentric swing, conjunction gate), LIFE (Conway scanned as a sequencer), FLOCK (24 boids →
  centre/spread/speed/heading CV), CHAOS (double pendulum or Lorenz; flip/wing gates), ECOSYSTEM
  (Rosenzweig–MacArthur limit cycle, boom/crash/extinct gates).
- **Effects**: BBD, TAPE, SPRING, PLATE, PHASER, ENSEMBLE, TUNE (YIN pitch detection + delay-line
  shifter, key/scale or V/OCT target, hard-tune at SPEED 0), ECHO CHAMBER (drag speaker + mics;
  image-source reflections, Sabine-sized FDN tail, Doppler when moving).
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
  (stylus organ: relaxation oscillator, tiny speaker, vibrato).
- **Performance boxes**: CHOP (MPC-style: 16 pads chopped at transients, note repeat + swing, 12-bit
  vintage), POCKET (Pocket Operator-style: 8 sounds, 16 steps, per-step parameter locks), DJ MIXER (kill
  EQ isolator, one-knob filter, faders, crossfader with scratch curve).
- **Sampling**: LOOP (4 slots, overdub undo, ½× record), SAMPLE (record/load, slices), TURNTABLE
  (scratch the platter; flywheel motor + brake, 33/45, pitch, transformer CUT, strobe dots, cartridge
  output follows stylus velocity, crackle/rumble WEAR; cut your own record or load a file; factory
  battle record is synthesised).
- **Utilities / I/O**: MIX, STEREO, MULT, ATTN, LOGIC, SCOPE, MIDI·CV (aftertouch, bend range), OUT, MONITOR.
- **Performance**: SCENES (8 whole-rack snapshots, glide recall, CV select/next), MACRO (four knobs that
  learn many moves each), ACCIDENT (roll random nudges, EVOLVE drift, undoable).
- **Real-world inputs** (only on when you click ENABLE; nothing leaves the machine): AUDIO IN (mic/line
  into the rack: audio, envelope, gate, YIN pitch), CAMERA (webcam motion amount/position/brightness),
  GAMEPAD (sticks, triggers, buttons).
- **Visuals**: VISION (three.js tank: bioluminescent jellyfish; a flower garden where plants sprout, bloom,
  wilt, die and reseed; fireflies that synchronise (Kuramoto); aurora with substorms; a Chladni plate
  whose sand finds the mode the pitch picks). The creature lives on the
  engine clock: TRIG/FEED/GLOW/HUE/MOVE steer it, GATE/SWAY/GROW/LIGHT come back out. One shared
  WebGL renderer for every tank; three.js loads only when a tank is on the rack. VECTOR (XY-mode CRT,
  phosphor persistence, beam dims with speed), WATERFALL (log-frequency spectrogram), LIGHTS (the music
  lights the whole rack: bass red, mids green, treble blue).

### Rack & workflow
- Drag anywhere, slide-aside on drop, library drag-in, new-row drop.
- Collapsible, searchable library.
- Knobs: scroll wheel, left-drag and middle-drag.
- Cables: sag; right-click a jack pulls its cables, Shift+right-click recolours; Esc cancels a drag.
- Eurorack mounting grid: panel screws land on the rail holes.
- Played surfaces (platters, strings, pads, rooms…) via a surface registry.
- **Tutorials** (Learn menu): synth fundamentals as one continuous course (oscillators, filters,
  envelopes + VCA, modulation). Lesson 1 starts from an empty case; each lesson picks up where the last
  ended ("Next lesson" keeps your rack). WALKTHROUGH performs each step as you press Next; GUIDED
  moves on by itself when you do the step and asks you to play notes ("Show me" if stuck). Lessons run in a
  scratch rack; Finish keeps what you built. Lessons are data (steps with text, target, action).
- Undo/redo; named patch library; export/import; `?scratch` sandbox.
- 13 factory presets; Jellyfish Dream (the jelly plays the melody) is the first-run rack.
- Git history.

## Waiting on a decision
- **System direct output**: keep MONO-1 / GROOVE-1 / STUDIO-3 feeding the speakers directly until their
  main output is patched (switched direct out), or require patching to OUT like everything else.

## Up next
- **Tutorial suite**: lessons for every module family (sequencing, drums, effects, systems, poly, the
  played instruments), plus "how this preset works" tours of the factory presets.
- **XY pad extras**: multi-touch → poly cables on tablets; save the recorded gesture with the patch.
- **More VISION scenes**: coral reef, rain on a pond, starling murmuration.

## Pinned for later: creative modules
- **Character output**: cassette deck and vinyl-lathe export.

## Pinned for later: industry-standard tools
- **Mixing & master**: mixer console (channel strips, EQ, pan, mute/solo, 2 send/return buses), sidechain
  compressor, 4-band parametric EQ with curve display, glue compressor, limiter, mid/side widener,
  transient shaper, noise gate.
- **Meters**: tuner, spectrum analyser, LUFS loudness meter, stereo correlation meter.
- **Famous Eurorack modules**: Plaits-style macro oscillator, Rings-style resonator, Clouds-style granular,
  Grids-style drum map, Marbles-style random, Metropolix-style sequencer, Disting-style multi-tool.
- **Classic instruments**: 6-op FM (DX7-style), supersaw (JP-8000-style), tonewheel organ + rotary speaker,
  electric piano model, 303-style acid voice, vocoder / talk box.
- **Effects**: tempo-synced ping-pong delay, algorithmic hall/room, shimmer reverb, flanger, auto-filter,
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
  - Acid sequencer with per-step slide and accent (303-style).
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
