import type { ModuleSpec } from './types'
import { vco } from './specs/vco'
import { vcf } from './specs/vcf'
import { vca } from './specs/vca'
import { adsr } from './specs/adsr'
import { lfo } from './specs/lfo'
import { noise, mixer, mult } from './specs/utilities'
import { midi, output, scope } from './specs/io'
import { atten, fold, quant, sh, slew } from './specs/shapers'
import { ms, svf } from './specs/filters2'
import { clock, div, seq8 } from './specs/sequencing'
import { mono } from './specs/mono'
import { bbd, spring } from './specs/effects'
import { clap, hats, kick, snare } from './specs/drums'
import { pads, tr16 } from './specs/rhythm'
import { loop } from './specs/looper'
import { groove } from './specs/groove'
import { ring } from './specs/ring'
import { smix, vcamix } from './specs/mixing'
import { follow, func, logic } from './specs/control'
import { complexOsc, sub, wave } from './specs/oscillators2'
import { arp, chord } from './specs/pitch'
import { ensemble, phaser, plate, tape } from './specs/effects2'
import { perc, tom } from './specs/drums2'
import { euclid, turing } from './specs/generative'
import { touch } from './specs/touch'
import { sample } from './specs/sampler'
import { padsr, polycv, polymix, pvca, pvcf, pvco } from './specs/poly'
import { monitor } from './specs/monitor'
import { studio } from './specs/studio'
import { vision } from './specs/vision'
import { xy } from './specs/xy'
import { turntable } from './specs/turntable'
import { theremin } from './specs/theremin'
import { omnichord } from './specs/omnichord'
import { chorus, echo, fuzz, lpedal, octave, wah } from './specs/pedals'

/** Module registry. Adding a module = a spec here + a DSP class in engine/dsp/registry. */
export const SPEC_LIST: ModuleSpec[] = [
  mono,
  studio,
  groove,
  polycv,
  pvco,
  pvcf,
  padsr,
  pvca,
  polymix,
  kick,
  snare,
  clap,
  hats,
  tom,
  perc,
  pads,
  touch,
  tr16,
  euclid,
  turing,
  loop,
  sample,
  turntable,
  vco,
  theremin,
  omnichord,
  complexOsc,
  wave,
  sub,
  noise,
  vcf,
  svf,
  ms,
  vca,
  vcamix,
  adsr,
  func,
  follow,
  lfo,
  xy,
  sh,
  fold,
  ring,
  slew,
  quant,
  clock,
  div,
  seq8,
  arp,
  chord,
  bbd,
  tape,
  spring,
  plate,
  phaser,
  ensemble,
  fuzz,
  wah,
  octave,
  chorus,
  echo,
  lpedal,
  mixer,
  smix,
  mult,
  logic,
  atten,
  scope,
  vision,
  midi,
  output,
  monitor,
]

export const SPECS: Record<string, ModuleSpec> = Object.fromEntries(SPEC_LIST.map((s) => [s.type, s]))

/** Dev-time sanity check: every control must reference a real param/jack, ids unique. */
export function validateSpecs(): string[] {
  const errors: string[] = []
  for (const s of SPEC_LIST) {
    for (const list of [s.inputs, s.outputs, s.params]) {
      const ids = list.map((x) => x.id)
      if (new Set(ids).size !== ids.length) errors.push(`${s.type}: duplicate ids in ${ids.join(',')}`)
    }
    for (const c of s.controls) {
      if ((c.kind === 'knob' || c.kind === 'switch' || c.kind === 'stomp') && !s.params.some((p) => p.id === c.param))
        errors.push(`${s.type}: control references unknown param ${c.param}`)
      if (c.kind === 'in' && !s.inputs.some((j) => j.id === c.jack)) errors.push(`${s.type}: unknown input ${c.jack}`)
      if (c.kind === 'out' && !s.outputs.some((j) => j.id === c.jack)) errors.push(`${s.type}: unknown output ${c.jack}`)
      if (c.kind === 'led' && c.index >= (s.leds ?? 0)) errors.push(`${s.type}: led ${c.index} out of range`)
      if (c.kind === 'steps')
        for (const r of c.rows)
          for (const id of [...r.p, c.pattern, c.length])
            if (id && !s.params.some((p) => p.id === id)) errors.push(`${s.type}: steps references unknown param ${id}`)
    }
  }
  return errors
}
