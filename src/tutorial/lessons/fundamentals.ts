import { RackBuilder } from '../../patch/presets/builder'
import type { Lesson } from '../types'

const POWER = { ui: 'power' as const }

/** 1 — oscillators: pitch and timbre. */
const firstSound: Lesson = {
  id: 'first-sound',
  title: '1 · Your first sound',
  summary: 'Oscillators: pitch, octaves and wave shapes (timbre).',
  build() {
    const b = new RackBuilder()
    const vco = b.add('vco', 0, 0, { coarse: -1 })
    const mult = b.add('mult', 0, 13)
    const scope = b.add('scope', 0, 18, { time: 0.02 })
    const out = b.add('output', 0, 36, { vol: 0.3 })
    // the MULT splits one signal: one copy to the speakers, one to the scope
    b.wire(mult, 'a1', out, 'l')
    b.wire(mult, 'a2', scope, 'ch1')
    return { patch: b.build(1), mods: { vco, mult, scope, out } }
  },
  steps: [
    {
      text: 'Every synth sound starts with an oscillator (the VCO): a circuit that vibrates back and forth hundreds of times a second. Send those vibrations to a speaker and your ears hear a tone.',
    },
    {
      text: 'The small MULT is a splitter: whatever goes into its A input comes out of all its jacks. It’s already wired to your speakers (OUT) and to the SCOPE, a screen that draws a voltage over time — so you’ll hear and see the same thing.',
    },
    { text: 'First, switch the rack on.', task: 'Press POWER ON at the top left.', target: POWER, action: { kind: 'power' } },
    {
      text: 'Patch cables carry the vibration between modules. Outputs are the jacks on dark plates; inputs are plain. We’ll start with the gentlest wave there is: the sine.',
      task: 'Patch the VCO’s SIN output into the MULT’s A input.',
      listen: 'A soft, pure hum, and a smooth wave on the scope: the voltage rising and falling. (OUT plays its L input in both speakers while R is empty.)',
      action: { kind: 'connect', from: ['vco', 'sin'], to: ['mult', 'a'] },
    },
    {
      text: 'FREQ sets how fast it vibrates — the pitch. One octave up is exactly twice as many vibrations per second.',
      task: 'Turn FREQ up to 0 (scroll up over the knob, or drag it upward).',
      listen: 'The same tone, an octave higher. The waves on the scope squeeze closer together.',
      target: { mod: 'vco', param: 'coarse' },
      action: { kind: 'set', mod: 'vco', param: 'coarse', value: 0 },
    },
    {
      text: 'And back down: half as many vibrations, an octave lower.',
      task: 'Turn FREQ back down to −1.',
      listen: 'Lower and rounder; the waves spread out.',
      target: { mod: 'vco', param: 'coarse' },
      action: { kind: 'set', mod: 'vco', param: 'coarse', value: -1 },
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
      text: 'That’s an oscillator: FREQ for pitch, wave shape for timbre. Next lesson: filters, which carve those harmonics away.',
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
