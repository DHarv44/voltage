import type { Control, ModuleSpec, ParamSpec } from '../types'
import { HP_MM } from '../types'
import { BLACK } from './panels'

export const HC_VOICES = 6
export const HC_CHORUS = ['OFF', 'I', 'II', 'I+II']
/** The keyboard on the panel (MIDI notes). */
export const HC_KEYS_LO = 48
export const HC_KEYS_HI = 84
/** LEDs: the LFO, the arpeggio's step, then each voice's note (−1 silent). */
export const HCL = { lfo: 0, arp: 1, voice0: 2 } as const

const COL = Array.from({ length: 15 }, (_, i) => 10 + 15.5 * i)
const R1 = 31
const R2 = 54
const PATCH_X = [246.5, 257.5, 268.5, 279.5]
const IN_Y = 31
const OUT_Y = 51
const HP = 60

const inputs = [
  { id: 'voct', label: 'V/OCT', poly: true },
  { id: 'gate', label: 'GATE', poly: true },
  { id: 'clk', label: 'ARP CLK' },
  { id: 'cutoff', label: 'CUTOFF' },
]
const outputs = [
  { id: 'l', label: 'L' },
  { id: 'r', label: 'R' },
  { id: 'lfo', label: 'LFO' },
  { id: 'env', label: 'ENV' },
]

const level = (id: string, label: string, def: number): ParamSpec => ({ id, label, min: 0, max: 1, def, unit: '%' })
const time = (id: string, label: string, min: number, max: number, def: number): ParamSpec => ({ id, label, min, max, def, curve: 'exp', unit: 's' })
const pick = (id: string, label: string, options: string[], def: number): ParamSpec => ({ id, label, min: 0, max: options.length - 1, def, stepped: true, options })

const params: ParamSpec[] = [
  pick('arp', 'ARPEGGIO', ['OFF', 'ON', 'HOLD'], 0),
  { id: 'arprate', label: 'ARP RATE', min: 1, max: 20, def: 7, curve: 'exp', unit: 'Hz' },
  pick('arpmode', 'ARP MODE', ['UP', 'U&D', 'DOWN'], 0),
  pick('arprange', 'ARP RANGE', ['1', '2', '3'], 1),
  { id: 'lrate', label: 'LFO RATE', min: 0.1, max: 20, def: 4.5, curve: 'exp', unit: 'Hz' },
  time('ldelay', 'LFO DELAY', 0.001, 3, 0.4),
  pick('range', 'RANGE', ["16'", "8'", "4'"], 1),
  level('dlfo', 'DCO LFO', 0),
  level('pwm', 'PWM', 0.45),
  pick('pwmsrc', 'PWM FROM', ['LFO', 'MAN', 'ENV'], 0),
  pick('saw', 'SAW', ['OFF', 'ON'], 1),
  pick('pulse', 'PULSE', ['OFF', 'ON'], 1),
  level('sub', 'SUB', 0.35),
  level('noise', 'NOISE', 0),
  pick('hpf', 'HPF', ['0', '1', '2', '3'], 1),
  { id: 'cutoff', label: 'CUTOFF', min: 30, max: 16000, def: 1500, curve: 'exp', unit: 'Hz' },
  { id: 'res', label: 'RESONANCE', min: 0, max: 1, def: 0.2, unit: '%' },
  pick('envpol', 'ENV POLARITY', ['+', '−'], 0),
  level('fenv', 'VCF ENV', 0.3),
  level('flfo', 'VCF LFO', 0),
  level('kbd', 'VCF KYBD', 0.5),
  pick('vcamode', 'VCA', ['ENV', 'GATE'], 0),
  level('level', 'VCA LEVEL', 0.75),
  time('a', 'ATTACK', 0.001, 3, 0.02),
  time('d', 'DECAY', 0.002, 8, 0.8),
  level('s', 'SUSTAIN', 0.6),
  time('r', 'RELEASE', 0.002, 8, 0.6),
  pick('chorus', 'CHORUS', HC_CHORUS, 2),
  level('vol', 'VOLUME', 0.7),
]

const place = (id: string | null, x: number, y: number): Control[] => {
  if (!id) return []
  const ps = params.find((p) => p.id === id)!
  const sw = ps.stepped && (ps.options?.length ?? 9) <= 3
  return [sw ? { kind: 'switch', param: id, x, y } : { kind: 'knob', param: id, x, y }]
}
const ROW1 = ['arp', 'arprate', 'lrate', 'range', 'dlfo', 'pwm', 'pwmsrc', 'hpf', 'cutoff', 'res', 'envpol', 'vcamode', 'a', 'd', 'chorus']
const ROW2 = ['arpmode', 'arprange', 'ldelay', 'saw', 'pulse', 'sub', 'noise', null, 'fenv', 'flfo', 'kbd', 'level', 's', 'r', 'vol']
const box = (a: number, b: number, label: string): Control => ({ kind: 'section', x: COL[a] - 7, y: 16, w: COL[b] - COL[a] + 14, h: 50, label })

/** A six-voice poly in the tradition of the early-80s Japanese DCO polys (our
 *  own panel and sound): steady digitally-controlled oscillators with saw,
 *  pulse (width moved by the LFO, by hand or by the envelope), a sub
 *  oscillator an octave down and noise; a high-pass, a resonant four-pole
 *  low-pass; one envelope shape for every voice; an LFO that fades in; and
 *  the stereo BBD chorus (I, II, or both buttons: the fast, shallow one) that
 *  is half the sound. The arpeggiator plays what you hold (or the chord on a
 *  poly cable) up, up and down, or down over one to three octaves; HOLD
 *  keeps it going after you let go. Play the keyboard along the bottom. */
export const halcyon: ModuleSpec = {
  type: 'halcyon',
  title: 'HALCYON',
  name: 'HALCYON Six-Voice Poly',
  tagline: 'Six DCO voices (saw, pulse, sub, noise), HPF and resonant low-pass, one envelope, LFO with delay, the stereo chorus and an arpeggiator',
  category: 'Systems',
  hp: HP,
  panel: BLACK,
  inputs,
  outputs,
  params,
  leds: HCL.voice0 + HC_VOICES,
  controls: [
    box(0, 1, 'ARPEGGIO'),
    box(2, 2, 'LFO'),
    box(3, 6, 'DCO'),
    box(7, 7, 'HPF'),
    box(8, 10, 'VCF'),
    box(11, 11, 'VCA'),
    box(12, 13, 'ENV'),
    box(14, 14, 'CHORUS'),
    ...ROW1.flatMap((id, i) => place(id, COL[i], R1)),
    ...ROW2.flatMap((id, i) => place(id, COL[i], R2)),
    { kind: 'led', index: HCL.lfo, x: COL[2] + 5.5, y: 21.5, color: '#ff6a1a' },
    { kind: 'led', index: HCL.arp, x: COL[1] + 5.5, y: 21.5, color: '#ff6a1a' },
    { kind: 'section', x: 240, y: 16, w: 45.5, h: 50, label: 'JACKS' },
    ...inputs.map((j, i): Control => ({ kind: 'in', jack: j.id, x: PATCH_X[i], y: IN_Y })),
    ...outputs.map((j, i): Control => ({ kind: 'out', jack: j.id, x: PATCH_X[i], y: OUT_Y })),
    { kind: 'surface', name: 'halcyonkeys', x: 8, y: 71, w: HP * HP_MM - 16, h: 44 } as Control,
  ],
}
