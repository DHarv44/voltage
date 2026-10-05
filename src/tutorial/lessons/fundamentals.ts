import { RackBuilder } from '../../patch/presets/builder'
import type { Lesson } from '../types'

const POWER = { ui: 'power' as const }

/** 1 — oscillators: pitch and timbre. */
const firstSound: Lesson = {
  id: 'first-sound',
  title: '1 · Your first sound',
  summary: 'Oscillators: pitch, octaves and wave shapes (timbre).',
  build() {
    // an empty case: you build everything yourself
    return { patch: new RackBuilder().build(1), mods: {} }
  },
  steps: [
    {
      text: 'This is your rack: an empty case. A modular synth is built from separate modules, each doing one job, joined with patch cables. The list on the left is every module you can add. Let’s build the simplest instrument there is, one piece at a time.',
    },
    {
      text: 'Every synth sound starts with an oscillator: a circuit that vibrates back and forth hundreds of times a second. Ours is the VCO (voltage-controlled oscillator), in the SOURCES section of the list.',
      task: 'Click “Oscillator” in the module list (or drag it into the rack).',
      action: { kind: 'add', type: 'vco', as: 'vco' },
    },
    {
      text: 'Vibrations are only sound once they reach your speakers. The OUT module is the rack’s connection to your speakers or headphones — nothing is heard without it. It’s in the I/O section.',
      task: 'Add “Audio Output” from the I/O section.',
      action: { kind: 'add', type: 'output', as: 'out' },
    },
    {
      text: 'Before we make any sound, protect your ears: OUT’s VOLUME starts fairly high. Knobs turn with the scroll wheel over them (up = clockwise), or by dragging up and down.',
      task: 'Turn OUT’s VOLUME down to about 30 %.',
      target: { mod: 'out', param: 'vol' },
      action: { kind: 'set', mod: 'out', param: 'vol', value: 0.3 },
    },
    {
      text: 'A scope lets you see sound: it draws a voltage over time, so you can watch the shape of each wave while you hear it. It’s in UTILITIES.',
      task: 'Add “Oscilloscope” from the UTILITIES section.',
      action: { kind: 'add', type: 'scope', as: 'scope' },
    },
    {
      text: 'We want the oscillator in two places at once: your speakers and the scope. A MULT (multiple) copies one signal to several outputs — whatever goes into its A input comes out of each of the jacks below it.',
      task: 'Add “Buffered Multiple” from UTILITIES.',
      action: { kind: 'add', type: 'mult', as: 'mult' },
    },
    {
      text: 'Tip: you can move any module by dragging its panel (not a knob or jack); the others slide aside when you let go. Arrange them however you like.',
    },
    { text: 'Now switch the rack on (nothing will sound yet: nothing is connected).', task: 'Press POWER ON at the top left.', target: POWER, action: { kind: 'power' } },
    {
      text: 'Patch cables carry signals between modules. Outputs are the jacks on dark plates; inputs are the plain ones. A cable always goes from an output to an input.',
      task: 'Drag a cable from the MULT’s first output to OUT’s L input.',
      listen: 'Still silent: the MULT has nothing in it yet. (OUT plays its L input in both speakers while R is empty.)',
      action: { kind: 'connect', from: ['mult', 'a1'], to: ['out', 'l'] },
    },
    {
      text: 'The second copy goes to the scope.',
      task: 'Drag a cable from the MULT’s second output to the SCOPE’s CH1 input.',
      action: { kind: 'connect', from: ['mult', 'a2'], to: ['scope', 'ch1'] },
    },
    {
      text: 'Now feed the oscillator into the MULT. We’ll start with the gentlest wave there is: the sine.',
      task: 'Patch the VCO’s SIN output into the MULT’s A input.',
      listen: 'A soft, pure hum — and a smooth wave on the scope: the voltage rising and falling.',
      action: { kind: 'connect', from: ['vco', 'sin'], to: ['mult', 'a'] },
    },
    {
      text: 'FREQ sets how fast it vibrates — the pitch. One octave down is exactly half as many vibrations per second.',
      task: 'Turn FREQ down to −1.',
      listen: 'The same tone, an octave lower and rounder. The waves on the scope spread out.',
      target: { mod: 'vco', param: 'coarse' },
      action: { kind: 'set', mod: 'vco', param: 'coarse', value: -1 },
    },
    {
      text: 'And up: twice as many vibrations, an octave higher than where we started.',
      task: 'Turn FREQ up to +1.',
      listen: 'Higher and brighter; the waves squeeze together. (Take it back to 0 or −1 if it’s piercing.)',
      target: { mod: 'vco', param: 'coarse' },
      action: { kind: 'set', mod: 'vco', param: 'coarse', value: 1 },
    },
    {
      text: 'Back to the middle before we change the wave shape.',
      task: 'Turn FREQ back to 0 (double-click a knob to reset it).',
      target: { mod: 'vco', param: 'coarse' },
      action: { kind: 'set', mod: 'vco', param: 'coarse', value: 0 },
    },
    {
      text: 'The shape of the wave is its timbre — why a flute and a violin sound different on the same note. A sine is a single pure frequency. A triangle adds a few quiet harmonics (extra tones at 3×, 5×, 7× the pitch).',
      task: 'Patch TRI into the MULT’s A input (a new cable replaces the old one).',
      listen: 'A little brighter and reedier than the sine; the scope shows straight slopes.',
      action: { kind: 'connect', from: ['vco', 'tri'], to: ['mult', 'a'] },
    },
    {
      text: 'The sawtooth has every harmonic, loud — the brightest, buzziest wave. It’s the raw material of most synth sounds (filters then tame it; that’s the next lesson). It’s loud: you may want your volume down a little.',
      task: 'Patch SAW into the MULT’s A input.',
      listen: 'Bright and buzzy, like a brass section. The scope shows a ramp.',
      action: { kind: 'connect', from: ['vco', 'saw'], to: ['mult', 'a'] },
    },
    {
      text: 'A pulse wave has only the odd harmonics.',
      task: 'Patch PULSE into the MULT’s A input.',
      listen: 'Hollow and woody, like a clarinet. The scope shows a square.',
      action: { kind: 'connect', from: ['vco', 'sqr'], to: ['mult', 'a'] },
    },
    {
      text: 'WIDTH changes how long the pulse stays up versus down.',
      task: 'Turn WIDTH down toward 15 %.',
      listen: 'Thinner and more nasal as the pulse narrows; the scope shows short spikes.',
      target: { mod: 'vco', param: 'pw' },
      action: { kind: 'set', mod: 'vco', param: 'pw', value: 0.15 },
    },
    {
      text: 'One last skill: to unplug, drag a cable out of an input, or right-click a jack to pull all its cables. Ctrl+Z undoes anything.',
    },
    {
      text: 'You built an instrument from nothing: an oscillator (FREQ for pitch, wave shape for timbre), a splitter, a scope and an output. Next lesson: filters, which carve those harmonics away.',
    },
  ],
}

/** 2 — filters: cutoff and resonance (subtractive synthesis). */
const filters: Lesson = {
  id: 'filters',
  title: '2 · Filters shape the tone',
  summary: 'Low-pass filter: cutoff, resonance, the classic sweep.',
  build() {
    const b = new RackBuilder()
    const vco = b.add('vco', 0, 0, { coarse: -1 })
    const vcf = b.add('vcf', 0, 14, { cutoff: 1500, res: 0.15 })
    const scope = b.add('scope', 0, 26, { time: 0.01 })
    const out = b.add('output', 0, 44, { vol: 0.35 })
    b.wire(vco, 'saw', vcf, 'in')
    b.wire(vcf, 'lp4', out, 'l')
    b.wire(vcf, 'lp4', out, 'r')
    b.wire(vcf, 'lp4', scope, 'ch1')
    return { patch: b.build(1), mods: { vco, vcf, scope, out } }
  },
  steps: [
    {
      text: 'A sawtooth is full of bright harmonics. A filter removes some of them. This LADDER is a low-pass filter: it lets the low frequencies through and takes the highs away.',
    },
    { text: 'Switch on.', task: 'Press POWER ON.', target: POWER, action: { kind: 'power' } },
    {
      text: 'CUTOFF is where the filter starts cutting.',
      task: 'Turn CUTOFF down to about 150 Hz.',
      listen: 'The buzz turns dark and muffled — like music through a wall. The scope wave goes smooth and round.',
      target: { mod: 'vcf', param: 'cutoff' },
      action: { kind: 'set', mod: 'vcf', param: 'cutoff', value: 150 },
    },
    {
      text: 'Open it up and the harmonics come back.',
      task: 'Turn CUTOFF up to about 8 kHz.',
      listen: 'Bright and buzzy again.',
      target: { mod: 'vcf', param: 'cutoff' },
      action: { kind: 'set', mod: 'vcf', param: 'cutoff', value: 8000 },
    },
    {
      text: 'RESONANCE feeds the filter back into itself, boosting the frequencies right at the cutoff.',
      task: 'Turn RESONANCE up to about 85 %.',
      listen: 'A whistling, ringing edge appears on top of the tone.',
      target: { mod: 'vcf', param: 'res' },
      action: { kind: 'set', mod: 'vcf', param: 'res', value: 0.85 },
    },
    {
      text: 'Now sweep the cutoff with the resonance up: that resonant peak slides through the harmonics one by one.',
      task: 'Turn CUTOFF down to about 300 Hz.',
      listen: 'The classic squelchy “wow” of acid basslines and synth leads.',
      target: { mod: 'vcf', param: 'cutoff' },
      action: { kind: 'set', mod: 'vcf', param: 'cutoff', value: 300 },
    },
    {
      text: 'Oscillators make harmonics, filters carve them away: that’s subtractive synthesis, how most analog synths work. Next: making notes start and stop.',
    },
  ],
}

/** 3 — VCA + envelope: notes with a shape. */
const envelopes: Lesson = {
  id: 'envelopes',
  title: '3 · Envelopes: notes that start and stop',
  summary: 'Gates, the ADSR envelope and the VCA; play from your keyboard.',
  build() {
    const b = new RackBuilder()
    const midi = b.add('midi', 0, 0)
    const vco = b.add('vco', 0, 9)
    const vca = b.add('vca', 0, 22)
    const adsr = b.add('adsr', 0, 29, { a: 0.005, d: 0.3, s: 0.7, r: 0.3 })
    const out = b.add('output', 0, 38, { vol: 0.35 })
    b.wire(midi, 'pitch', vco, 'voct')
    b.wire(vca, 'out', out, 'l')
    b.wire(vca, 'out', out, 'r')
    return { patch: b.build(1), mods: { midi, vco, vca, adsr, out } }
  },
  steps: [
    {
      text: 'So far the sound never stops. Real notes begin and end. A VCA is a volume control a voltage can turn; an envelope is that voltage, shaped over time. The keyboard module (MIDI·CV) already sets the VCO’s pitch.',
    },
    { text: 'Switch on.', task: 'Press POWER ON.', target: POWER, action: { kind: 'power' } },
    {
      text: 'The VCA sits between the oscillator and the output.',
      task: 'Patch the VCO’s SAW into the VCA’s IN.',
      listen: 'Silence: the VCA is closed until something opens it.',
      target: { mod: 'vca', jack: 'in', dir: 'in' },
      action: { kind: 'connect', from: ['vco', 'saw'], to: ['vca', 'in'] },
    },
    {
      text: 'While you hold a key, MIDI·CV’s GATE output is “on” (10 V). That’s what starts the envelope.',
      task: 'Patch MIDI·CV’s GATE into the ADSR’s GATE input.',
      target: { mod: 'midi', jack: 'gate', dir: 'out' },
      action: { kind: 'connect', from: ['midi', 'gate'], to: ['adsr', 'gate'] },
    },
    {
      text: 'The envelope’s output is a voltage that rises and falls. Into the VCA’s CV, it becomes the note’s volume shape.',
      task: 'Patch the ADSR’s ENV into the VCA’s CV input.',
      target: { mod: 'adsr', jack: 'env', dir: 'out' },
      action: { kind: 'connect', from: ['adsr', 'env'], to: ['vca', 'cv'] },
    },
    {
      text: 'Now it plays like an instrument.',
      task: 'Play some notes on your computer keyboard: keys A S D F G H J K.',
      listen: 'Each note starts when you press and stops when you let go.',
      action: { kind: 'play', notes: [0, 4, 7, 12], spacing: 0.4, hold: 0.3 },
    },
    {
      text: 'ATTACK is how long a note takes to swell up to full volume.',
      task: 'Turn ATTACK up to about 1.2 s, then play a note.',
      listen: 'Notes now fade in slowly, like bowed strings.',
      target: { mod: 'adsr', param: 'a' },
      action: { kind: 'set', mod: 'adsr', param: 'a', value: 1.2 },
      then: [{ kind: 'play', notes: [0], hold: 2 }],
      thenNote: 'I played a note for you so you can hear the slow attack.',
    },
    {
      text: 'RELEASE is how long it takes to fade after you let go.',
      task: 'Turn RELEASE up to about 2 s, then play a note.',
      listen: 'Each note now lingers after the key comes up.',
      target: { mod: 'adsr', param: 'r' },
      action: { kind: 'set', mod: 'adsr', param: 'r', value: 2 },
      then: [{ kind: 'play', notes: [7], hold: 1 }],
      thenNote: 'I played a note for you so you can hear it fade out.',
    },
    {
      text: 'A pluck is the opposite: an instant attack, then a quick fall to nothing. First, the instant attack.',
      task: 'Turn ATTACK all the way down.',
      target: { mod: 'adsr', param: 'a' },
      action: { kind: 'set', mod: 'adsr', param: 'a', value: 0.002 },
    },
    {
      text: 'SUSTAIN is the level a held note settles at. At zero, every note dies away even while you hold the key.',
      task: 'Turn SUSTAIN down to 0, then play.',
      listen: 'Plucky, percussive notes — the DECAY knob sets how long the pluck rings.',
      target: { mod: 'adsr', param: 's' },
      action: { kind: 'set', mod: 'adsr', param: 's', value: 0 },
      then: [{ kind: 'play', notes: [0, 7, 12, 7], spacing: 0.3, hold: 0.25 }],
      thenNote: 'I played a few notes for you so you can hear the pluck.',
    },
    {
      text: 'Attack, Decay, Sustain, Release: ADSR. Gate in, shape out — and that shape can open a VCA or, just as well, sweep a filter. Next: modulation.',
    },
  ],
}

/** 4 — LFO modulation: wah and vibrato. */
const modulation: Lesson = {
  id: 'modulation',
  title: '4 · Modulation: movement',
  summary: 'An LFO moving the filter (wah) and the pitch (vibrato).',
  build() {
    const b = new RackBuilder()
    const vco = b.add('vco', 0, 0, { coarse: -1 })
    const vcf = b.add('vcf', 0, 14, { cutoff: 600, res: 0.5 })
    const lfo = b.add('lfo', 0, 26, { rate: 1.5 })
    const out = b.add('output', 0, 36, { vol: 0.35 })
    b.wire(vco, 'saw', vcf, 'in')
    b.wire(vcf, 'lp4', out, 'l')
    b.wire(vcf, 'lp4', out, 'r')
    return { patch: b.build(1), mods: { vco, vcf, lfo, out } }
  },
  steps: [
    {
      text: 'Modulation means one module turning another module’s knob for you. An LFO (low-frequency oscillator) vibrates too slowly to hear — perfect for movement.',
    },
    { text: 'Switch on.', task: 'Press POWER ON.', target: POWER, action: { kind: 'power' } },
    {
      text: 'The filter’s CV input lets a voltage move its cutoff.',
      task: 'Patch the LFO’s TRI output into the filter’s CV input.',
      target: { mod: 'lfo', jack: 'tri', dir: 'out' },
      action: { kind: 'connect', from: ['lfo', 'tri'], to: ['vcf', 'cv'] },
    },
    {
      text: 'CV AMT sets how far the LFO moves the cutoff.',
      task: 'Turn the filter’s CV AMT up to about 70 %.',
      listen: 'A rhythmic wah-wah as the filter opens and closes.',
      target: { mod: 'vcf', param: 'cv' },
      action: { kind: 'set', mod: 'vcf', param: 'cv', value: 0.7 },
    },
    {
      text: 'RATE is the LFO’s speed.',
      task: 'Turn the LFO’s RATE up to about 6 Hz.',
      listen: 'A fast bubbling wobble.',
      target: { mod: 'lfo', param: 'rate' },
      action: { kind: 'set', mod: 'lfo', param: 'rate', value: 6 },
    },
    {
      text: 'Slow movements feel like breathing.',
      task: 'Turn RATE down to about 0.3 Hz.',
      listen: 'The tone slowly opens and closes over several seconds.',
      target: { mod: 'lfo', param: 'rate' },
      action: { kind: 'set', mod: 'lfo', param: 'rate', value: 0.3 },
    },
    {
      text: 'The same LFO can move the pitch: that’s vibrato.',
      task: 'Patch the LFO’s TRI into the VCO’s FM input too.',
      target: { mod: 'vco', jack: 'fm', dir: 'in' },
      action: { kind: 'connect', from: ['lfo', 'tri'], to: ['vco', 'fm'] },
    },
    {
      text: 'FM is how much the incoming voltage bends the pitch. Vibrato needs only a little — and a faster LFO.',
      task: 'Turn the VCO’s FM up to about 6 %.',
      listen: 'The pitch wavers along with the wah (try RATE around 5 Hz for a singer’s vibrato).',
      target: { mod: 'vco', param: 'fm' },
      action: { kind: 'set', mod: 'vco', param: 'fm', value: 0.06 },
    },
    {
      text: 'That’s modulation: any output can turn any knob that has a CV input. Oscillators, filters, envelopes, VCAs and modulation — you now know the building blocks of every synth in this rack.',
    },
  ],
}

export const FUNDAMENTALS: Lesson[] = [firstSound, filters, envelopes, modulation]
