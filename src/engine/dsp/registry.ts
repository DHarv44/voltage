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
import { PercDsp, TomDsp } from './drums2'
import { EuclidDsp, TuringDsp } from './generative'
import { TouchDsp } from './touch'
import { SampleDsp } from './sampler'
import { PolyAdsrDsp, PolyCvDsp, PolyLadderDsp, PolyMixDsp, PolyVcaDsp, PolyVcoDsp } from './poly'
import { MonitorDsp } from './monitor'
import { StudioDsp } from './studio'
import { VisionDsp } from './vision'
import { XyDsp } from './xy'
import { TurntableDsp } from './turntable'
import { ThereminDsp } from './theremin'
import { OmnichordDsp } from './omnichord'
import { FuzzDsp } from './pedals/fuzz'
import { WahDsp } from './pedals/wah'
import { OctaveDsp } from './pedals/octave'
import { ChorusDsp } from './pedals/chorus'
import { EchoDsp } from './pedals/echo'
import { LooperPedalDsp } from './pedals/looper'
import { MusicBoxDsp } from './musicbox'
import { AmpDsp } from './amp'
import { TalkBoxDsp } from './talkbox'

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
  tom: TomDsp,
  perc: PercDsp,
  euclid: EuclidDsp,
  turing: TuringDsp,
  touch: TouchDsp,
  sample: SampleDsp,
  polycv: PolyCvDsp,
  pvco: PolyVcoDsp,
  pvcf: PolyLadderDsp,
  padsr: PolyAdsrDsp,
  pvca: PolyVcaDsp,
  polymix: PolyMixDsp,
  monitor: MonitorDsp,
  studio: StudioDsp,
  vision: VisionDsp,
  xy: XyDsp,
  turntable: TurntableDsp,
  theremin: ThereminDsp,
  omnichord: OmnichordDsp,
  fuzz: FuzzDsp,
  wah: WahDsp,
  octave: OctaveDsp,
  chorus: ChorusDsp,
  echo: EchoDsp,
  lpedal: LooperPedalDsp,
  musicbox: MusicBoxDsp,
  amp: AmpDsp,
  talkbox: TalkBoxDsp,
}

export function createDsp(type: string, fs: number, seed: number): Dsp | null {
  const spec = SPECS[type]
  const Ctor = CIRCUITS[type]
  return spec && Ctor ? new Ctor(spec, fs, seed) : null
}
