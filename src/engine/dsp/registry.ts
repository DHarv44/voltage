import type { ModuleSpec } from '../../modules/types'
import { SPECS } from '../../modules'
import type { Dsp } from './base'
import { VcoDsp } from './vco'
import { LadderDsp } from './ladder'
import { AdsrDsp, LfoDsp } from './modulation'
import { VcaDsp, MixerDsp, MultDsp, NoiseDsp } from './utilities'
import { MidiCvDsp, OutputDsp, ScopeDsp } from './io'
import { AttenDsp, FolderDsp, QuantizerDsp, SampleHoldDsp, SlewDsp } from './shapers'
import { MsFilterDsp, SvfDsp } from './filters2'
import { ClockDsp, DividerDsp, Seq8Dsp } from './sequencing'
import { MonoSystemDsp } from './mono'
import { BbdDsp } from './bbd'
import { SpringDsp } from './spring'
import { ClapDsp, HatsDsp, KickDsp, SnareDsp } from './drums'
import { PadsDsp, Tr16Dsp } from './rhythm'
import { LooperDsp } from './looper'
import { GrooveDsp } from './groove'
import { RingDsp } from './ring'
import { StereoMixDsp, VcaMixDsp } from './mixing'
import { FollowDsp, FuncDsp, LogicDsp } from './control'
import { ComplexDsp } from './complex'
import { WaveDsp } from './wavetable'
import { ArpDsp, ChordDsp, SubDsp } from './pitch'
import { TapeDsp } from './tape'
import { EnsembleDsp, PhaserDsp } from './modfx'
import { PlateDsp } from './plate'

type DspCtor = new (spec: ModuleSpec, fs: number, seed: number) => Dsp

const CIRCUITS: Record<string, DspCtor> = {
  vco: VcoDsp,
  vcf: LadderDsp,
  vca: VcaDsp,
  adsr: AdsrDsp,
  lfo: LfoDsp,
  noise: NoiseDsp,
  mixer: MixerDsp,
  mult: MultDsp,
  midi: MidiCvDsp,
  output: OutputDsp,
  scope: ScopeDsp,
  fold: FolderDsp,
  sh: SampleHoldDsp,
  slew: SlewDsp,
  quant: QuantizerDsp,
  atten: AttenDsp,
  svf: SvfDsp,
  ms: MsFilterDsp,
  clock: ClockDsp,
  div: DividerDsp,
  seq8: Seq8Dsp,
  mono: MonoSystemDsp,
  bbd: BbdDsp,
  spring: SpringDsp,
  kick: KickDsp,
  snare: SnareDsp,
  clap: ClapDsp,
  hats: HatsDsp,
  pads: PadsDsp,
  tr16: Tr16Dsp,
  loop: LooperDsp,
  groove: GrooveDsp,
  ring: RingDsp,
  smix: StereoMixDsp,
  vcamix: VcaMixDsp,
  follow: FollowDsp,
  logic: LogicDsp,
  func: FuncDsp,
  complex: ComplexDsp,
  wave: WaveDsp,
  sub: SubDsp,
  arp: ArpDsp,
  chord: ChordDsp,
  tape: TapeDsp,
  phaser: PhaserDsp,
  ensemble: EnsembleDsp,
  plate: PlateDsp,
}

export function createDsp(type: string, fs: number, seed: number): Dsp | null {
  const spec = SPECS[type]
  const Ctor = CIRCUITS[type]
  return spec && Ctor ? new Ctor(spec, fs, seed) : null
}
