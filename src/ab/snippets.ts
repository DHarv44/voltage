/** The sounds to compare, one Strudel line each: every mapping the importer
 *  makes, as the smallest piece of code that exercises it. Each renders for
 *  `cycles` at `cpm` on both engines. */
export interface Snippet {
  id: string
  group: 'drums' | 'synths' | 'envelope' | 'filter' | 'effects' | 'instruments' | 'wavetables'
  code: string
  cycles?: number
}

const bank = (b: string) => [
  { id: `${b} bd`, group: 'drums' as const, code: `s("bd").bank("${b}")` },
  { id: `${b} sd`, group: 'drums' as const, code: `s("~ sd").bank("${b}")` },
  { id: `${b} hh`, group: 'drums' as const, code: `s("hh*4").bank("${b}")` },
  { id: `${b} oh`, group: 'drums' as const, code: `s("oh").bank("${b}")` },
  { id: `${b} cp`, group: 'drums' as const, code: `s("~ cp").bank("${b}")` },
]

export const SNIPPETS: Snippet[] = [
  ...bank('tr909'),
  ...bank('tr808'),
  ...bank('lm1'),
  ...bank('dmx'),
  ...bank('linn'),
  { id: 'sawtooth', group: 'synths', code: 'note("c3").s("sawtooth")' },
  { id: 'square', group: 'synths', code: 'note("c3").s("square")' },
  { id: 'triangle', group: 'synths', code: 'note("c3").s("triangle")' },
  { id: 'sine', group: 'synths', code: 'note("c3").s("sine")' },
  { id: 'pulse', group: 'synths', code: 'note("c3").s("pulse")' },
  { id: 'supersaw', group: 'synths', code: 'note("c3").s("supersaw")' },
  { id: 'supersaw chord', group: 'synths', code: 'note("[c3,eb3,g3]").s("supersaw")' },
  { id: 'white', group: 'synths', code: 's("white").decay(.2).sustain(0)' },
  { id: 'default env', group: 'envelope', code: 'note("c3*4").s("sawtooth")' },
  { id: 'attack .2', group: 'envelope', code: 'note("c3").s("sawtooth").attack(.2).release(.5)' },
  { id: 'decay .3 sustain 0', group: 'envelope', code: 'note("c3*2").s("sawtooth").decay(.3).sustain(0)' },
  { id: 'lpf 400', group: 'filter', code: 'note("c3").s("sawtooth").lpf(400)' },
  { id: 'lpf 2000 lpq 10', group: 'filter', code: 'note("c3").s("sawtooth").lpf(2000).lpq(10)' },
  { id: 'hpf 1000', group: 'filter', code: 'note("c3").s("sawtooth").hpf(1000)' },
  { id: 'lpf pattern', group: 'filter', code: 'note("c3*4").s("sawtooth").lpf("300 800 2000 5000")' },
  { id: 'distort 2', group: 'effects', code: 'note("c3").s("sawtooth").distort(2)' },
  { id: 'room .5', group: 'effects', code: 'note("c4").s("triangle").decay(.1).sustain(0).room(.5)' },
  { id: 'delay .4', group: 'effects', code: 'note("c4").s("triangle").decay(.1).sustain(0).delay(.4).delaytime(.25)' },
  { id: 'vowel a', group: 'effects', code: 'note("c3").s("sawtooth").vowel("a")' },
  { id: 'crush 6', group: 'effects', code: 'note("c3").s("sawtooth").crush(6)' },
  { id: 'gain .3', group: 'effects', code: 'note("c3").s("sawtooth").gain(.3)' },
  { id: 'gm piano', group: 'instruments', code: 'note("c4").s("gm_piano")' },
  { id: 'gm epiano', group: 'instruments', code: 'note("c4").s("gm_epiano1")' },
  { id: 'gm synth bass', group: 'instruments', code: 'note("c2").s("gm_synth_bass_1")' },
  { id: 'gm strings', group: 'instruments', code: 'note("[c4,e4,g4]").s("gm_synth_strings_1")' },
  { id: 'gm brass', group: 'instruments', code: 'note("c4").s("gm_brass_section")' },
  { id: 'gm sax', group: 'instruments', code: 'note("c4").s("gm_baritone_sax")' },
  { id: 'gm lead saw', group: 'instruments', code: 'note("c4").s("gm_lead_2_sawtooth")' },
  { id: 'gm pad', group: 'instruments', code: 'note("[c4,e4,g4]").s("gm_pad_warm")' },
  { id: 'wt bad day', group: 'wavetables', code: 'note("c3").s("wt_digital_bad_day")' },
  { id: 'wt vgame', group: 'wavetables', code: 'note("c3").s("wt_vgame")' },
]
