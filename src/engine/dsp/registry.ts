import type { ModuleSpec } from '../../modules/types'
import { SPECS } from '../../modules'
import type { Dsp } from './base'
import { VcoDsp } from './vco'
import { LadderDsp } from './ladder'
import { AdsrDsp, LfoDsp } from './modulation'
import { VcaDsp, MixerDsp, MultDsp, NoiseDsp } from './utilities'
import { MidiCvDsp, OutputDsp, ScopeDsp, TapDsp } from './io'
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
import { VisionViewDsp } from './vision/view'
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
import { PocketArcadeDsp } from './pocketArcade'
import { PocketRobotDsp } from './pocketRobot'
import { PocketOfficeDsp } from './pocketOffice'
import { PocketSpeakDsp } from './pocketSpeak'
import { StylophoneDsp } from './stylophone'
import { BounceDsp } from './bounce'
import { TumblerDsp } from './tumbler'
import { SketchbookDsp } from './sketchbook'
import { KinDsp } from './kin'
import { UndertoneDsp } from './undertone'
import { LockstepDsp } from './lockstep'
import { LatticeDsp } from './lattice'
import { ConsoleDsp } from './console'
import { GlueDsp } from './glue'
import { MasterDsp } from './master'
import { VocoderDsp } from './vocoder'
import { LpgDsp } from './lpg'
import { Fm4Dsp } from './fm4'
import { StageDsp } from './stage'
import { GrandDsp } from './grand'
import { SwarmDsp } from './swarm'
import { MotionDsp } from './motion'
import { GrainsDsp } from './grains'
import { ShiftDsp, ShimmerDsp } from './ambient'
import { TallyDsp } from './tally'
import { OrbitDsp } from './orbit'
import { LifeDsp } from './life'
import { FlockDsp } from './flock'
import { ChaosDsp } from './chaos'
import { EcosystemDsp } from './ecosystem'
import { GhostDsp } from './ghost'
import { ProgressionDsp } from './progression'
import { BandmateDsp } from './bandmate'
import { ComboCoreDsp } from './combo/coreDsp'
import { ComboDsp } from './combo/comboDsp'
import { ComboFsDsp, ComboLooperDsp } from './combo/peripherals'
import { AudioInDsp, CameraDsp, GamepadDsp } from './inputs'
import { LightShowDsp, VectorDsp, WaterfallDsp } from './visualOut'
import { AccidentDsp, MacroDsp, ScenesDsp } from './perform'
import { CoachDsp, MetronomeDsp } from './metronome'
import { MaelzelDsp } from './maelzel'
import { PannerDsp, WidenerDsp } from './stereoTools'
import { ChanceDsp, QuadLfoDsp, SeqSwitchDsp, TrackHoldDsp } from './cvTools'
import { KaleidoDsp } from './kaleido'
import { ResonatorDsp } from './resonator'
import { AnalyserDsp, TunerDsp } from './meters'
import { PianoRollDsp } from './pianoroll'
import { ArrangerDsp } from './arranger'

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
  tap: TapDsp,
  scope: ScopeDsp,
  fold: FolderDsp,
  sh: SampleHoldDsp,
  trackhold: TrackHoldDsp,
  chance: ChanceDsp,
  sswitch: SeqSwitchDsp,
  qlfo: QuadLfoDsp,
  panner: PannerDsp,
  widener: WidenerDsp,
  kaleido: KaleidoDsp,
  resonator: ResonatorDsp,
  tuner: TunerDsp,
  analyser: AnalyserDsp,
  pianoroll: PianoRollDsp,
  arranger: ArrangerDsp,
  slew: SlewDsp,
  quant: QuantizerDsp,
  atten: AttenDsp,
  svf: SvfDsp,
  ms: MsFilterDsp,
  clock: ClockDsp,
  metronome: MetronomeDsp,
  maelzel: MaelzelDsp,
  coach: CoachDsp,
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
  pocketarcade: PocketArcadeDsp,
  pocketrobot: PocketRobotDsp,
  pocketoffice: PocketOfficeDsp,
  pocketspeak: PocketSpeakDsp,
  stylophone: StylophoneDsp,
  bounce: BounceDsp,
  tumbler: TumblerDsp,
  sketchbook: SketchbookDsp,
  kin: KinDsp,
  undertone: UndertoneDsp,
  lockstep: LockstepDsp,
  lattice: LatticeDsp,
  console: ConsoleDsp,
  glue: GlueDsp,
  master: MasterDsp,
  vocoder: VocoderDsp,
  lpg: LpgDsp,
  fm4: Fm4Dsp,
  stage: StageDsp,
  grand: GrandDsp,
  swarm: SwarmDsp,
  motion: MotionDsp,
  grains: GrainsDsp,
  shimmer: ShimmerDsp,
  shift: ShiftDsp,
  tally: TallyDsp,
  orbit: OrbitDsp,
  life: LifeDsp,
  flock: FlockDsp,
  chaos: ChaosDsp,
  ecosystem: EcosystemDsp,
  ghost: GhostDsp,
  progression: ProgressionDsp,
  bandmate: BandmateDsp,
  combocore: ComboCoreDsp,
  combo: ComboDsp,
  combofs: ComboFsDsp,
  combolooper: ComboLooperDsp,
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
