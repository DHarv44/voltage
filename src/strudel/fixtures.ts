/** Pieces the importer must keep building (checked at startup in dev): the
 *  first piece the user brought (130 BPM, 51 cycles, three arranged layers). */
export const FIXTURE_ARRANGED = `setcpm(130/4)

const kick1 = sound("<[bd bd [bd*4] [bd*4]] [bd*4]>").bank("linn").decay(0.15)
const kick2 = sound("[bd*4]").bank("linn").decay(0.15)

const hats1 = sound("[oh oh*2]*4").bank("dmx").decay(0.1).gain(0.12)
const hats2 = sound("[- oh]*4").bank("dmx").decay(0.2).sustain(0.1).gain(0.12)

const snare = stack(
  sound("[- sd]*2").bank("linn").gain(0.5),
  sound("[- cp]*2").bank("linn").gain(0.1)
)

const drums1 = stack(kick1,hats1,snare)
const drums2 = stack(kick2,hats2,snare)
const drums3 = stack(
  sound("bd bd bd bd -").bank("linn").decay(0.15),
  sound("oh oh oh oh -").bank("dmx").decay(0.2).sustain(0.1).gain(0.2)
)

const bass1 = stack(
  note("<<[f1 f2*2]*2 [g1 g2*2]*2> [c1 c2*2]*2 [d1 d2*2]*2 [d1 d2*2]*2>*2"),
).sound("<sine, gm_synth_bass_1>").decay(0.2).sustain(0.1)

const bass2 = stack(
  note("<<[f1 f2]*2 [g1 g2]*2> [c1 c2]*2 [d1 d2]*2 [d1 d2]*2>*2"),
).sound("<sine, gm_synth_bass_1>").decay(0.2).sustain(0.4)

const synth = stack(
  n("<[[2 ~] [2 ~] 2 3] [[3 ~] [3 ~] 3 3]>@4 [-1 ~] -1 -1 [0 ~] 0 0 [0 ~] 0 0 [0 ~] 0 0"),
).sound("<gm_lead_2_sawtooth>").slow(2).scale("d4:minor").attack(0.05).hpf("<1000 2000>*12").gain("0.4")

stack(
  arrange([16,kick1],[16,drums1],[2,drums3],[16,drums2],[1,silence]).room(0.1),
  arrange([8,silence],[24,synth],[19,silence]).room(0.05),
  arrange([16,silence],[16,bass1],[2,silence],[16,bass2],[1,silence])
  )._pianoroll()
`

/** A piece by sound names (an arrange, so no layers): `square` and `pulse`
 *  must share one part, `sawtooth` and `gm_lead_2_sawtooth` another. */
export const FIXTURE_NAMED = `setcpm(120/4)
const a = note("c3 eb3 g3 bb3").s("square")
const b = note("c4 eb4").s("pulse").gain(0.5)
const c = note("c2*4").s("sawtooth").lpf(600)
const d = note("g4 f4 eb4 d4").s("gm_lead_2_sawtooth")
const e = note("<[c4,eb4,g4]>").s("gm_pad_2_warm")
arrange([4, stack(a, c)], [4, stack(a, b, c, d, e)], [2, stack(c, e)])
`

/** A piece in layers: a bass with a moving filter, supersaw and square
 *  chords, an electric piano, a vowelled and crushed lead with a delay,
 *  drums with a decay. */
export const FIXTURE_SOUNDS = `setcpm(120/4)
$: s("bd*4, [~ sd]*2, hh*8").bank("tr909").decay(0.2)
$: note("<c3 eb3 g3 bb3>*4").s("sawtooth").lpf("400 1200").gain(0.6)
$: note("<[c4,eb4,g4] [bb3,d4,f4]>").s("supersaw").attack(0.1).release(0.5).room(0.3)
$: note("<[c4,eb4,g4] [bb3,d4,f4]>/2").s("gm_epiano1").gain(0.5)
$: note("<[c3,g3,eb4] [f3,c4,ab4]>/2").s("square").gain(0.4)
$: note("c5 eb5 g5 c6").s("square").vowel("a").crush(6).delay(0.3).delaytime(0.25)
`
