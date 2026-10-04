# VOLTAGE roadmap

Realism rule for everything here: model the circuit or the hardware behaviour, never fake it with
samples or downloaded assets. Every module is a voltage-in/voltage-out panel that can be patched
anywhere.

## Done

- **Engine**: per-sample AudioWorklet graph in volts (1V/oct, ±5 V audio, 0–10 V CV), feedback loops
  (1-sample delay), switched-jack normalling, per-unit tolerances, thermal drift and warm-up, rail
  saturation, AC-coupled output.
- **Core voice**: VCO, LADDER, VCA, ADSR, LFO, NOISE, MIX, MULT, SCOPE, MIDI·CV, OUT.
- **Tier 2**: SVF, MS-12, FOLD, S&H, SLEW, QUANT, ATTN.
- **Sequencing**: CLOCK, DIV, SEQ-8.
- **Effects**: BBD delay, SPRING reverb.
- **Systems**: MONO-1 semi-modular voice.
- **Rack**: drag anywhere with slide-aside on drop, library drag-in, new-row drop, scroll-wheel and
  middle-drag knobs, cables with sag, autosave, export/import, `?scratch` mode, 24-bit WAV recorder.
- **Drum voices** (analog-modelled, no samples): KICK (pinged bridged-T resonator + pitch sweep),
  SNARE (two resonators + snappy noise), HATS (808-style six-square metal through bandpasses, closed
  chokes open), CLAP (multi-burst noise envelope).
- **PADS**: 8 velocity pads (mouse, number keys 1–8, MIDI channel 10), per-pad gates, VEL/GATE/CV.
- **TR-16**: 8 tracks × 16 steps + accent row, swing, length, A/B patterns + chain, live recording
  from trigger inputs.
- **LOOP**: tape-style looper with overdub, reverse, varispeed CV, clock-synced record, tape loss,
  wow/flutter, end-of-loop trigger.
- **GROOVE-1**: drum-machine system unit: 5 voices + pads + 16-step sequencer + patch bay; triggers
  normalled to the internal sequencer, plays standalone.
- **RING**: diode-ring modulator with tracking carrier oscillator (bells, metal, steel drums).
- **Presets**: Harry Styles Synth-Pop, Classic Mono Synth, MONO-1 Lead, Acid House, Modular Drum Kit, Loop Jam, Generative
  Ambient, West Coast Plucks (top-bar Presets menu).

## Next

### Housekeeping
- Git repository + commits.
- Undo/redo (moves, cables, knobs, deletes).
- Named patch library inside the app.

### Presets
- More presets as modules land (2600-style patch, Euclidean polyrhythm, tape-loop ambient).
- Save your own rack as a named preset.

### Drums & rhythm
- TOMS / CONGAS (tuned resonator voices), RIM / COWBELL.
- LOOP: overdub-undo, half-speed record, multiple loop slots.
- Euclidean rhythm generator; random / Turing-machine sequencer.
- Touch-plate pads with continuous pressure/position CV.
- Pattern chaining beyond A/B (song mode).

### Sampling
- SAMPLE: record from a jack or load your own WAV files from disk; sliceable, sequencer-driven.
- Export a LOOP buffer to WAV; keep loop contents with the patch.

### Modules
- Stereo mixer with pan, sends and returns; VCA mixer.
- Envelope follower, comparator, logic (AND/OR/XOR, flip-flop).
- Function generator (Maths-style rise/fall: envelope, LFO, slew in one).
- Wavetable / complex (Buchla-style) oscillator, sub-oscillator.
- Arpeggiator / chord module.
- Tape delay (wow, flutter, saturation), phaser, BBD ensemble chorus, plate reverb.

### Systems
- 2600-style semi-modular: 3 VCOs, heavily normalled.

### Playability
- Velocity / aftertouch / mod-wheel routing, pitch-bend range setting.
- Live voltage readout on jack hover, cable recolour, drop-on-empty to cancel.

### Engine
- Polyphonic cables (up to 8 voices) and polyphonic MIDI·CV.
- Power-supply sag under load, optional cable crosstalk.
- DC-coupled output option, headphone / monitor section.
