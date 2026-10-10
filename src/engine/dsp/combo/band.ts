import { hitOf, stepsOf, type DrumKey, type Style } from '../../../modules/specs/combo/style'
import { bassNote, noteSpans, walkShift } from './bassline'
import { C, DRUM_SLOTS, fillStep, K, O, S, T, X } from './fills'

const KEYS: DrumKey[] = ['k', 's', 'h', 'o', 'r', 't', 'p']

/** A learned part: how many beats long, in what meter, at what tempo, and
 *  the chord on every beat (chord codes; −1 = no chord: the bass rests). */
export interface BandPart {
  beats: number
  meter: number
  bpm: number
  chords: Int16Array
}

/** How the band plays a part: its style, ALT TIME (×2 or ×½ the learned
 *  pulse, or 1), high intensity, the bass mode (0 active, 1 roots, 2 one
 *  root a bar). */
export interface PartFeel {
  style: Style
  alt: number
  hi: boolean
  bassMode: number
}

/** The band: drums and bass playing a learned part in a style, sample by
 *  sample. Each sample it reports what happened: drum hits (velocities),
 *  the bass note (a new note, its pitch, gate), the chord, and the clock. */
export class Band {
  readonly hit = new Float32Array(DRUM_SLOTS)
  tom = 1
  bassOn = false
  bassPitch = 36
  bassGate = false
  bassVel = 0
  chord = -1
  tick16 = false
  barStart = false
  partStart = false
  playing = false
  /** Where we are in the part, in learned beats. */
  pos = 0
  part = 0
  /** The part cued to come in at the end of this one (−1 none). */
  cued = -1
  private next = 0
  private countIn = 0
  private countNext = 0
  private ending = false
  private crashNext = true
  private bassOff = 0
  private passes = 0
  private walk = 0
  private walkChord = -1
  private shift = 0
  private lastBass = 36
  private spans: Int16Array = new Int16Array(16)
  private spansFor: Style | null = null
  private readonly fillHit = new Float32Array(DRUM_SLOTS)
  private readonly fillTom = new Int8Array(1)

  constructor(private readonly fs: number) {}

  /** Start the band on part p (after a bar of sticks with `count` on). */
  start(p: number, count: boolean, meter: number): void {
    this.part = p
    this.pos = 0
    this.next = 0
    this.passes = 0
    this.cued = -1
    this.ending = false
    this.crashNext = true
    this.countIn = count ? meter : 0
    this.countNext = 0
    this.playing = true
  }

  /** Back to the top of the part playing (RST), on the next sample. */
  restart(): void {
    this.pos = 0
    this.next = 0
    this.partStart = true
  }

  /** Stop at the next bar line with a last hit (or straight away). */
  stop(ending: boolean): void {
    if (ending && this.playing && this.countIn === 0) this.ending = true
    else this.playing = false
  }

  /** One sample. `rate` is learned beats per second. */
  step(parts: BandPart[], feel: PartFeel[], rate: number): void {
    this.hit.fill(0)
    this.bassOn = this.tick16 = this.barStart = this.partStart = false
    if (!this.playing) {
      if (this.bassGate && (this.bassOff -= 1) <= 0) this.bassGate = false
      return
    }
    const dt = rate / this.fs
    // the count-in: sticks on each beat, and the band on the beat after the last
    if (this.countIn > 0 || this.countNext > 0) {
      this.countNext -= dt
      if (this.countNext <= 0 && this.countIn > 0) {
        this.countNext += 1
        this.hit[X] = this.countIn === 1 ? 1 : 0.75
        this.countIn--
      }
      if (this.countIn > 0 || this.countNext > 0) return
    }
    const part = parts[this.part]
    const f = feel[this.part]
    const s = f.style
    if (s !== this.spansFor) {
      this.spans = noteSpans(s.bass)
      this.spansFor = s
    }
    const steps = stepsOf(s)
    const bandLen = part.beats * f.alt
    const bandPos = this.pos * f.alt
    while (this.stepTime(this.next, s) <= bandPos) this.fire(this.next++, s, steps, part, f, bandLen)
    if (this.bassGate && bandPos >= this.bassOff) this.bassGate = false
    this.pos += dt
    if (this.pos >= part.beats) {
      // round again, or into the cued part
      this.pos -= part.beats
      this.next = 0
      this.passes++
      this.bassOff -= bandLen
      this.partStart = true
      if (this.cued >= 0) {
        this.part = this.cued
        this.cued = -1
        this.crashNext = true
        this.passes = 0
      }
    }
  }

  /** When step n (from the part's start) lands, in band beats, with swing. */
  private stepTime(n: number, s: Style): number {
    const steps = stepsOf(s)
    const i = n % steps
    let t = Math.floor(n / steps) * s.beats + i / s.sub
    if (s.sub === 4) {
      if (i % 4 === 2) t += s.swing * 0.5
      if (i % 2 === 1) t += s.swing16 * 0.25
    }
    return t
  }

  private fire(n: number, s: Style, steps: number, part: BandPart, f: PartFeel, bandLen: number): void {
    const i = n % steps
    const bar = Math.floor(n / steps)
    const lastBar = Math.max(0, Math.ceil(bandLen / s.beats) - 1)
    const t = this.stepTime(n, s)
    if (t >= bandLen) return
    this.tick16 = true
    if (i === 0) this.barStart = true
    this.chord = part.chords[Math.min(part.beats - 1, Math.max(0, Math.floor(t / f.alt + 1e-6)))]
    // the ending: one last hit on the bar line, the bass holding the root
    if (i === 0 && this.ending) {
      this.hit[K] = 1
      this.hit[C] = 1
      this.playing = false
      this.ending = false
      this.playBass('R', part, f, t, s.sub)
      this.bassOff = Math.round(this.fs * 0.8) // samples, counted down while stopped
      return
    }
    // a fill into the next part (or into the ending)
    const filling = bar === lastBar && (this.cued >= 0 || this.ending) && s.fill !== 'none'
    if (filling && fillStep(s.fill, i, steps, s.sub, this.fillHit, this.fillTom)) {
      for (let d = 0; d < DRUM_SLOTS; d++) this.hit[d] = this.fillHit[d]
      this.tom = this.fillTom[0]
    } else {
      for (let d = 0; d < KEYS.length; d++) {
        let v = hitOf(s.drums[KEYS[d]]?.[i])
        if (v > 0 && f.hi) v = v < 0.4 ? 0.6 : Math.min(1, v * 1.15) // ghosts speak up, the rest digs in
        this.hit[d] = v
      }
      if (this.hit[T] > 0) this.tom = 2
      // high intensity: an open hat to lift the end of each bar
      if (f.hi && i === steps - s.sub / 2 && !this.hit[O]) this.hit[O] = 0.7
    }
    if (n === 0 && this.crashNext) {
      this.hit[C] = 0.9
      this.crashNext = false
    } else if (i === 0 && f.hi && bar % 4 === 0) this.hit[C] = 0.75
    // the bass
    const tok = s.bass[i]
    if (f.bassMode === 2) {
      if (i === 0) this.playBass('R', part, f, t, steps)
    } else if (tok !== '.' && tok !== '-') this.playBass(f.bassMode === 1 ? 'R' : tok, part, f, t, this.spans[i] * s.gate)
    if (f.bassMode === 2 && i === 0) this.bassOff = t + s.beats - 0.05
  }

  /** A bass note at band time t, sounding `len` steps (or a bar). */
  private playBass(tok: string, part: BandPart, f: PartFeel, t: number, len: number): void {
    const beat = Math.min(part.beats - 1, Math.max(0, Math.floor(t / f.alt + 1e-6)))
    const chord = part.chords[beat]
    const next = part.chords[(beat + 1) % part.beats]
    if (chord !== this.walkChord) {
      this.walk = 0
      this.walkChord = chord
      this.shift = chord >= 0 ? walkShift(chord, this.lastBass) : 0
    }
    const note = bassNote(tok, chord, next, this.walk, this.lastBass, this.shift)
    if (tok === 'W') this.walk++
    if (note < 0) {
      this.bassGate = false
      return
    }
    this.bassPitch = note
    this.lastBass = note
    this.bassOn = true
    this.bassGate = true
    this.bassVel = 0.85
    this.bassOff = t + len / f.style.sub
  }
}

/** COMBO CORE's drum gates, in jack order: which slot each output carries
 *  (kick, snare, hat, open hat, ride, tom, perc, crash). */
export const GATE_SLOTS = [K, S, 2, O, 4, T, 6, C]
