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

### Modules (79)
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
  buttons, strum plate, auto-bass, chord on a poly cable), MUSIC BOX (crank or motor, punch your own
  paper strip, steel-comb tines).
- **Sampling**: LOOP (4 slots, overdub undo, ½× record), SAMPLE (record/load, slices), TURNTABLE
  (scratch the platter; flywheel motor + brake, 33/45, pitch, transformer CUT, strobe dots, cartridge
  output follows stylus velocity, crackle/rumble WEAR; cut your own record or load a file; factory
  battle record is synthesised).
- **Utilities / I/O**: MIX, STEREO, MULT, ATTN, LOGIC, SCOPE, MIDI·CV (aftertouch, bend range), OUT, MONITOR.
- **Visuals**: VISION (three.js tank: bioluminescent jellyfish, growing flower). The creature lives on the
  engine clock: TRIG/FEED/GLOW/HUE/MOVE steer it, GATE/SWAY/GROW/LIGHT come back out. One shared
  WebGL renderer for every tank; three.js loads only when a tank is on the rack.

### Rack & workflow
- Drag anywhere, slide-aside on drop, library drag-in, new-row drop.
- Collapsible, searchable library.
- Knobs: scroll wheel and middle-drag.
- Cables: sag, recolour and remove via jack menu; Esc cancels a drag.
- Undo/redo; named patch library; export/import; `?scratch` sandbox.
- 13 factory presets; Jellyfish Dream (the jelly plays the melody) is the first-run rack.
- Git history.

## Waiting on a decision
- **System direct output**: keep MONO-1 / GROOVE-1 / STUDIO-3 feeding the speakers directly until their
  main output is patched (switched direct out), or require patching to OUT like everything else.

## Up next
- **XY pad extras**: multi-touch → poly cables on tablets; save the recorded gesture with the patch.
- **More VISION scenes**: coral reef, fireflies, aurora, cymatics plate.

## Pinned for later: creative modules
- **Simulations as sequencers**: BOUNCE (balls in a box → gates), ORBIT (planets → polyrhythms),
  LIFE (Game of Life sequencer), FLOCK (boids → CV), CHAOS (double pendulum / Lorenz LFO),
  ECOSYSTEM (predator–prey CV).
- **Musical brains**: GHOST (learns your playing, answers back), PROGRESSION (harmony-rule chord
  generator), BANDMATE (invents fills on GROOVE-1).
- **Real-world inputs**: webcam motion → CV, gamepad, mic pitch tracker, big XY pad.
- **Visual outputs**: VECTOR (XY oscilloscope music), WATERFALL spectrogram, rack-wide light show.
- **Performance**: scene snapshots with morphing, macro knobs, "happy accident" randomiser.
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

## Pinned for later: off-rack gear brought into the rack
Real instruments and studio gear rebuilt as patchable panels, modelled physically (no recordings).
- **Played with the mouse**: turntable (scratch LOOP/SAMPLE, motor spin-up/down, pitch, crossfader),
  theremin (pitch + volume antennas → CV), Stylophone, Omnichord (chord buttons + strum strip),
  Kaossilator-style pad, music box (crank = tempo, editable punched strip).
- **Guitar world**: pedalboard row (fuzz, wah, Space Echo-style tape echo, chorus, octave, looper pedal),
  valve amp + speaker cabinet, talk box (vowel CV).
- **Studio hardware**: Mellotron-style tape replay (mechanism modelled around synthesised tones),
  reel-to-reel / 4-track (bounce, reverse, vari-speed), Auto-Tune-style pitch corrector, echo chamber
  (place the speaker and mic).
- **World & acoustic**: tanpura drone, handpan / steel pan / kalimba, gamelan gongs, bowed singing bowl.
- **Performance boxes**: MPC-style chopper (16 pads, note repeat, swing), Pocket Operator-style unit with
  parameter locks, DJ mixer (kill EQs, filter, crossfader), harp strum.
- Suggested order: turntable → theremin + Omnichord → pedalboard → music box.

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
- **Audio in**: mic/line input module (your own interface), so external sounds can be processed.

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
