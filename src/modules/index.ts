import type { ModuleSpec } from './types'
import { vco } from './specs/vco'
import { vcf } from './specs/vcf'
import { vca } from './specs/vca'
import { adsr } from './specs/adsr'
import { lfo } from './specs/lfo'
import { noise, mixer, mult } from './specs/utilities'
import { midi, output, scope, tap } from './specs/io'
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
import { visioncore, visionview } from './specs/visionLink'
import { xy } from './specs/xy'
import { turntable } from './specs/turntable'
import { theremin } from './specs/theremin'
import { omnichord } from './specs/omnichord'
import { chordwheel } from './specs/chordwheel'
import { chorus, echo, fuzz, lpedal, octave, wah } from './specs/pedals'
import { musicbox } from './specs/musicbox'
import { amp } from './specs/amp'
import { talkbox } from './specs/talkbox'
import { tapekeys } from './specs/tapekeys'
import { fourtrack } from './specs/fourtrack'
import { tune } from './specs/tune'
import { chamber } from './specs/chamber'
import { strike } from './specs/strike'
import { tanpura } from './specs/tanpura'
import { gamelan } from './specs/gamelan'
import { bowl } from './specs/bowl'
import { djmix } from './specs/djmix'
import { harp } from './specs/harp'
import { chop } from './specs/chop'
import { pocket, pocketoffice } from './specs/pocket'
import { pocketarcade, pocketbass, pocketmelody, pocketrobot, pocketspeak } from './specs/pocketSynth'
import { stylophone } from './specs/stylophone'
import { bounce } from './specs/bounce'
import { tumbler } from './specs/tumbler'
import { sketchbook } from './specs/sketchbook'
import { kin } from './specs/kin'
import { undertone } from './specs/undertone'
import { lockstep } from './specs/lockstep'
import { lattice } from './specs/lattice'
import { console_, glue, master } from './specs/mixbus'
import { lpg, vocoder } from './specs/voiceFx'
import { fm4, swarm } from './specs/synthVoices'
import { motion } from './specs/motion'
import { grains, shift, shimmer } from './specs/ambient'
import { tally } from './specs/tally'
import { orbit } from './specs/orbit'
import { life } from './specs/life'
import { flock } from './specs/flock'
import { chaos } from './specs/chaos'
import { ecosystem } from './specs/ecosystem'
import { ghost } from './specs/ghost'
import { progression } from './specs/progression'
import { bandmate } from './specs/bandmate'
import { audioin, camera, gamepad } from './specs/inputs'
import { lightshow, vector, waterfall } from './specs/visualOut'
import { accident, macro, scenes } from './specs/perform'
import { coach, maelzel, metronome } from './specs/metronomes'
import { panner, widener } from './specs/stereoTools'
import { chance, qlfo, sswitch, trackhold } from './specs/cvTools'

/** Module registry. Adding a module = a spec here + a DSP class in engine/dsp/registry. */
export const SPEC_LIST: ModuleSpec[] = [
  mono,
  studio,
  groove,
  sketchbook,
  kin,
  undertone,
  lockstep,
  lattice,
  polycv,
  pvco,
  pvcf,
  padsr,
  pvca,
  polymix,
  fm4,
  swarm,
  tapekeys,
  kick,
  snare,
  clap,
  hats,
  tom,
  perc,
  pads,
  pocket,
  pocketbass,
  pocketmelody,
  pocketarcade,
  pocketrobot,
  pocketoffice,
  pocketspeak,
  tally,
  touch,
  tr16,
  euclid,
  turing,
  bounce,
  tumbler,
  orbit,
  life,
  flock,
  chaos,
  ecosystem,
  loop,
  sample,
  turntable,
  chop,
  fourtrack,
  vco,
  theremin,
  omnichord,
  chordwheel,
  musicbox,
  strike,
  tanpura,
  gamelan,
  bowl,
  harp,
  stylophone,
  complexOsc,
  wave,
  sub,
  noise,
  vcf,
  svf,
  ms,
  lpg,
  vca,
  vcamix,
  adsr,
  func,
  follow,
  lfo,
  qlfo,
  xy,
  sh,
  trackhold,
  chance,
  sswitch,
  fold,
  ring,
  slew,
  quant,
  clock,
  metronome,
  maelzel,
  coach,
  div,
  seq8,
  arp,
  chord,
  ghost,
  progression,
  bandmate,
  bbd,
  tape,
  spring,
  plate,
  phaser,
  ensemble,
  tune,
  chamber,
  shimmer,
  grains,
  shift,
  vocoder,
  fuzz,
  wah,
  octave,
  chorus,
  echo,
  lpedal,
  amp,
  talkbox,
  mixer,
  smix,
  panner,
  widener,
  console_,
  glue,
  master,
  djmix,
  mult,
  logic,
  atten,
  scenes,
  macro,
  motion,
  accident,
  scope,
  vision,
  visioncore,
  visionview,
  vector,
  waterfall,
  lightshow,
  midi,
  audioin,
  camera,
  gamepad,
  output,
  monitor,
  tap,
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
      if (c.kind === 'knob') {
        const ps = s.params.find((p) => p.id === c.param)
        if (ps?.curve === 'exp' && ps.min <= 0) errors.push(`${s.type}: exp knob ${ps.id} needs min > 0`)
      }
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
