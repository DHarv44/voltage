# VOLTAGE roadmap

Realism rule for everything here: model the circuit or the hardware behaviour, never fake it with
samples or downloaded assets. Every module is a voltage-in/voltage-out panel that can be patched
anywhere. Only well-established packages (React, Vite, TypeScript).

## Done

### Engine
- Per-sample AudioWorklet graph in volts (1V/oct, ±5 V audio, 0–10 V CV); feedback loops via 1-sample delay.
- Switched-jack normalling on inputs and outputs; per-unit component tolerances; thermal drift and warm-up.
- Rail saturation; optional PSU sag (rails droop, oscillators flatten under load) and −56 dB jack crosstalk.
- Polyphonic cables (up to 8 voices, mono↔poly rules as in VCV Rack).
- AC/DC-coupled output; 24-bit WAV master recorder; jack voltage probe.
- Module audio (LOOP slots, SAMPLE) persisted in IndexedDB and restored on reload and undo.

### Modules (61)
- **Systems**: MONO-1 (semi-modular mono), STUDIO-3 (2600-style), GROOVE-1 (drum machine).
- **Polyphonic**: POLY·CV, P-VCO, P-LADDER, P-ADSR, P-VCA, POLY MIX.
- **Sources**: VCO, COMPLEX (Buchla-style), WAVE (band-limited wavetable), SUB, NOISE.
- **Filters**: LADDER, SVF, MS-12.
- **Amplifiers**: VCA, VCA×4.
- **Modulation**: ADSR, FUNC (Maths-style), FOLLOW, LFO, S&H.
- **Shapers**: FOLD, RING, SLEW, QUANT.
- **Drums**: KICK, SNARE, CLAP, HATS, TOM, PERC, PADS, TOUCH (plates).
- **Sequencing**: CLOCK, DIV, SEQ-8, TR-16 (A–D + song chains), EUCLID, TURING, ARP, CHORD.
- **Effects**: BBD, TAPE, SPRING, PLATE, PHASER, ENSEMBLE.
- **Sampling**: LOOP (4 slots, overdub undo, ½× record), SAMPLE (record/load, slices).
- **Utilities / I/O**: MIX, STEREO, MULT, ATTN, LOGIC, SCOPE, MIDI·CV (aftertouch, bend range), OUT, MONITOR.

### Rack & workflow
- Drag anywhere, slide-aside on drop, library drag-in, new-row drop.
- Collapsible, searchable library.
- Knobs: scroll wheel and middle-drag.
- Cables: sag, recolour and remove via jack menu; Esc cancels a drag.
- Undo/redo; named patch library; export/import; `?scratch` sandbox.
- 13 factory presets.
- Git history.

## Waiting on a decision
- **System direct output**: keep MONO-1 / GROOVE-1 / STUDIO-3 feeding the speakers directly until their
  main output is patched (switched direct out), or require patching to OUT like everything else.

## Up next
- **Visuals module (three.js)**: procedural creatures that are patched like any module. CV in drives them
  (gate → jellyfish pulse, envelope → glow, pitch → colour); CV/gates out (pulse-end gate, tentacle sway,
  flower growth). One shared renderer drawing each panel by scissor viewport (browsers cap WebGL contexts).
  Scenes: bioluminescent jellyfish, growing flower, then reef, fireflies, aurora, cymatics plate.

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
