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
import { VisionDsp, VisionViewDsp } from './vision'
import { XyDsp } from './xy'
import { TurntableDsp } from './turntable'
import { ThereminDsp } from './theremin'
import { OmnichordDsp } from './omnichord'
import { ChordWheelDsp } from './chordwheel'
import { FuzzDsp } from './pedals/fuzz'
import { WahDsp } from './pedals/wah'
import { OctaveDsp } from './pedals/octave'
import { ChorusDsp } from './pedals/chorus'
import { EchoDsp } from './pedals/echo'
import { LooperPedalDsp } from './pedals/looper'
import { MusicBoxDsp } from './musicbox'
import { AmpDsp } from './amp'
import { TalkBoxDsp } from './talkbox'
import { TapeKeysDsp } from './tapekeys'
import { FourTrackDsp } from './fourtrack'
import { TuneDsp } from './tune'
import { ChamberDsp } from './chamber'
import { StrikeDsp } from './strike'
import { TanpuraDsp } from './tanpura'
import { GamelanDsp } from './gamelan'
import { BowlDsp } from './bowl'
import { DjMixDsp } from './djmix'
import { HarpDsp } from './harp'
import { ChopDsp } from './chop'
import { PocketDsp } from './pocket'
import { PocketBassDsp } from './pocketBass'
import { PocketMelodyDsp } from './pocketMelody'
import { StylophoneDsp } from './stylophone'
import { BounceDsp } from './bounce'
import { TumblerDsp } from './tumbler'
import { SketchbookDsp } from './sketchbook'
import { KinDsp } from './kin'
import { UndertoneDsp } from './undertone'
import { LockstepDsp } from './lockstep'
import { OrbitDsp } from './orbit'
import { LifeDsp } from './life'
import { FlockDsp } from './flock'
import { ChaosDsp } from './chaos'
import { EcosystemDsp } from './ecosystem'
import { GhostDsp } from './ghost'
import { ProgressionDsp } from './progression'
import { BandmateDsp } from './bandmate'
import { AudioInDsp, CameraDsp, GamepadDsp } from './inputs'
import { LightShowDsp, VectorDsp, WaterfallDsp } from './visualOut'
import { AccidentDsp, MacroDsp, ScenesDsp } from './perform'

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
  visioncore: VisionDsp,
  visionview: VisionViewDsp,
  xy: XyDsp,
  turntable: TurntableDsp,
  theremin: ThereminDsp,
  omnichord: OmnichordDsp,
  chordwheel: ChordWheelDsp,
  fuzz: FuzzDsp,
  wah: WahDsp,
  octave: OctaveDsp,
  chorus: ChorusDsp,
  echo: EchoDsp,
  lpedal: LooperPedalDsp,
  musicbox: MusicBoxDsp,
  amp: AmpDsp,
  talkbox: TalkBoxDsp,
  tapekeys: TapeKeysDsp,
  fourtrack: FourTrackDsp,
  tune: TuneDsp,
  chamber: ChamberDsp,
  strike: StrikeDsp,
  tanpura: TanpuraDsp,
  gamelan: GamelanDsp,
  bowl: BowlDsp,
  djmix: DjMixDsp,
  harp: HarpDsp,
  chop: ChopDsp,
  pocket: PocketDsp,
  pocketbass: PocketBassDsp,
  pocketmelody: PocketMelodyDsp,
  stylophone: StylophoneDsp,
  bounce: BounceDsp,
  tumbler: TumblerDsp,
  sketchbook: SketchbookDsp,
  kin: KinDsp,
  undertone: UndertoneDsp,
  lockstep: LockstepDsp,
  orbit: OrbitDsp,
  life: LifeDsp,
  flock: FlockDsp,
  chaos: ChaosDsp,
  ecosystem: EcosystemDsp,
  ghost: GhostDsp,
  progression: ProgressionDsp,
  bandmate: BandmateDsp,
  audioin: AudioInDsp,
  camera: CameraDsp,
  gamepad: GamepadDsp,
  vector: VectorDsp,
  waterfall: WaterfallDsp,
  lightshow: LightShowDsp,
  scenes: ScenesDsp,
  macro: MacroDsp,
  accident: AccidentDsp,
}

export function createDsp(type: string, fs: number, seed: number): Dsp | null {
  const spec = SPECS[type]
  const Ctor = CIRCUITS[type]
  return spec && Ctor ? new Ctor(spec, fs, seed) : null
}
