import type { Control, ModuleSpec } from '../types'
import { SAND } from './panels'

const PATCH_X = [163.5, 174.5, 185.5, 196.5]
const IN_ROWS = [32, 50]
const OUT_ROWS = [80, 98]

const inputs = [
  { id: 'pitch', label: 'PITCH' },
  { id: 'gate', label: 'GATE' },
  { id: 'fm', label: 'FM' },
  { id: 'pwm', label: 'PWM' },
  { id: 'vcfin', label: 'VCF IN' },
  { id: 'cutoff', label: 'CUTOFF' },
  { id: 'vcain', label: 'VCA IN' },
  { id: 'vcacv', label: 'VCA CV' },
]

const outputs = [
  { id: 'vco', label: 'VCO' },
  { id: 'lfo', label: 'LFO' },
  { id: 'env', label: 'ENV' },
  { id: 'vcf', label: 'VCF' },
  { id: 'vca', label: 'VCA' },
  { id: 'key', label: 'KEY' },
  { id: 'kgate', label: 'GATE' },
]

/** A complete semi-modular voice in one panel. Internally pre-wired
 *  (keys→VCO→VCF→VCA, env→VCF+VCA, LFO→PWM); every patch-bay input
 *  breaks its internal connection, just like a switched jack on hardware. */
export const mono: ModuleSpec = {
  type: 'mono',
  title: 'MONO-1',
  name: 'MONO-1 Semi-Modular Voice',
  tagline: 'Pre-wired mono synth; plays straight away, patch bay overrides the normals',
  category: 'Systems',
  hp: 40,
  panel: SAND,
  inputs,
  outputs,
  params: [
    { id: 'tune', label: 'TUNE', min: -2, max: 2, def: 0, unit: 'oct' },
    { id: 'wave', label: 'SAW ⟷ PULSE', min: 0, max: 1, def: 0.35, unit: '%' },
    { id: 'pw', label: 'WIDTH', min: 0.05, max: 0.95, def: 0.5, unit: '%' },
    { id: 'pwm', label: 'PWM', min: 0, max: 1, def: 0.15, unit: '%' },
    { id: 'glide', label: 'GLIDE', min: 0, max: 1, def: 0, unit: 's' },
    { id: 'lrate', label: 'RATE', min: 0.05, max: 40, def: 4, curve: 'exp', unit: 'Hz' },
    { id: 'cutoff', label: 'CUTOFF', min: 30, max: 18000, def: 700, curve: 'exp', unit: 'Hz' },
    { id: 'res', label: 'RESONANCE', min: 0, max: 1.1, def: 0.35, unit: '%' },
    { id: 'envamt', label: 'ENV AMT', min: -1, max: 1, def: 0.5, unit: '%' },
    { id: 'lfoamt', label: 'LFO AMT', min: 0, max: 1, def: 0, unit: '%' },
    { id: 'drive', label: 'DRIVE', min: 0.5, max: 4, def: 1.2, curve: 'exp', unit: 'x' },
    { id: 'a', label: 'ATTACK', min: 0.001, max: 10, def: 0.005, curve: 'exp', unit: 's' },
    { id: 'd', label: 'DECAY', min: 0.001, max: 10, def: 0.4, curve: 'exp', unit: 's' },
    { id: 's', label: 'SUSTAIN', min: 0, max: 1, def: 0.5, unit: '%' },
    { id: 'r', label: 'RELEASE', min: 0.001, max: 10, def: 0.3, curve: 'exp', unit: 's' },
    { id: 'mode', label: 'VCA MODE', min: 0, max: 1, def: 0, stepped: true, options: ['ENV', 'DRONE'] },
    { id: 'vol', label: 'VOLUME', min: 0, max: 1, def: 0.6, unit: '%' },
  ],
  leds: 2,
  controls: [
    { kind: 'section', x: 3, y: 16, w: 46, h: 53, label: 'OSCILLATOR' },
    { kind: 'knob', param: 'tune', x: 15, y: 31, size: 'L' },
    { kind: 'knob', param: 'wave', x: 37, y: 31 },
    { kind: 'knob', param: 'pw', x: 11.5, y: 55 },
    { kind: 'knob', param: 'pwm', x: 26, y: 55 },
    { kind: 'knob', param: 'glide', x: 40.5, y: 55 },

    { kind: 'section', x: 3, y: 73, w: 46, h: 39, label: 'LFO' },
    { kind: 'knob', param: 'lrate', x: 18, y: 90 },
    { kind: 'led', index: 0, x: 36, y: 90, bipolar: true },

    { kind: 'section', x: 52, y: 16, w: 48, h: 96, label: 'FILTER' },
    { kind: 'knob', param: 'cutoff', x: 76, y: 33, size: 'L' },
    { kind: 'knob', param: 'res', x: 63, y: 58 },
    { kind: 'knob', param: 'envamt', x: 89, y: 58 },
    { kind: 'knob', param: 'lfoamt', x: 63, y: 82 },
    { kind: 'knob', param: 'drive', x: 89, y: 82 },
    { kind: 'text', text: 'LADDER 24dB', x: 76, y: 104, size: 2 },

    { kind: 'section', x: 103, y: 16, w: 50, h: 64, label: 'ENVELOPE' },
    { kind: 'knob', param: 'a', x: 115, y: 31 },
    { kind: 'knob', param: 'd', x: 141, y: 31 },
    { kind: 'knob', param: 's', x: 115, y: 55 },
    { kind: 'knob', param: 'r', x: 141, y: 55 },
    { kind: 'led', index: 1, x: 128, y: 71 },

    { kind: 'section', x: 103, y: 84, w: 50, h: 28, label: 'VCA' },
    { kind: 'switch', param: 'mode', x: 115, y: 99 },
    { kind: 'knob', param: 'vol', x: 141, y: 97 },

    { kind: 'section', x: 156, y: 16, w: 45.5, h: 96, label: 'PATCH BAY' },
    { kind: 'text', text: 'INPUTS', x: 178.5, y: 22.5, size: 1.8 },
    ...inputs.map((j, i): Control => ({ kind: 'in', jack: j.id, x: PATCH_X[i % 4], y: IN_ROWS[Math.floor(i / 4)] })),
    { kind: 'text', text: 'OUTPUTS', x: 178.5, y: 64, size: 1.8 },
    ...outputs.map((j, i): Control => ({ kind: 'out', jack: j.id, x: PATCH_X[i % 4], y: OUT_ROWS[Math.floor(i / 4)] })),
    { kind: 'text', text: 'PATCHING AN INPUT BREAKS ITS NORMAL', x: 178.5, y: 109, size: 1.5 },
  ],
}
