import type { ModuleSpec } from '../types'
import { opts } from './build'
import { simpleSpec } from './build'
import { BLACK, CREAM } from './panels'

export const WIRELESS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']
const MIDI_CH = Array.from({ length: 16 }, (_, i) => String(i + 1))

/** SEND: a cable without the cable. Whatever comes into IN arrives at every
 *  RECEIVE set to the same channel, anywhere in the rack (poly cables too);
 *  several SENDs on one channel are summed. */
export const send: ModuleSpec = simpleSpec({
  type: 'send',
  title: 'SEND',
  name: 'Wireless Send',
  tagline: 'Sends a signal to every RECEIVE on the same channel (A–H) without a cable; poly too',
  category: 'CV Tools',
  hp: 4,
  panel: BLACK,
  params: [opts('ch', 'CHANNEL', WIRELESS, 0)],
  inputs: [{ id: 'in', label: 'IN', poly: true }],
  outputs: [{ id: 'thru', label: 'THRU', poly: true }],
  leds: 1,
  rows: [['k:ch'], ['l:0'], ['i:in'], ['o:thru']],
})

/** RECEIVE: what the SENDs on its channel carry, here. */
export const recv: ModuleSpec = simpleSpec({
  type: 'recv',
  title: 'RECEIVE',
  name: 'Wireless Receive',
  tagline: 'Picks up every SEND on its channel (A–H): long or messy cable runs gone',
  category: 'CV Tools',
  hp: 4,
  panel: BLACK,
  params: [opts('ch', 'CHANNEL', WIRELESS, 0)],
  inputs: [],
  outputs: [{ id: 'out', label: 'OUT', poly: true }],
  leds: 1,
  rows: [['k:ch'], ['l:0'], ['o:out']],
})

/** MIDI OUT: play other synths (hardware, a DAW) from the rack. Notes from
 *  V/OCT + GATE (poly: chords), velocity from VEL, two CV inputs as
 *  controllers; on the channel you pick. */
export const midiout: ModuleSpec = simpleSpec({
  type: 'midiout',
  title: 'MIDI OUT',
  name: 'CV to MIDI',
  tagline: 'Turns V/OCT, GATE and VEL (poly) into MIDI notes, and two CVs into controllers, for synths outside the rack',
  category: 'Controllers',
  hp: 8,
  panel: CREAM,
  params: [
    opts('ch', 'MIDI CH', MIDI_CH, 0),
    { id: 'cc1', label: 'CC A', min: 0, max: 127, def: 1, stepped: true },
    { id: 'cc2', label: 'CC B', min: 0, max: 127, def: 74, stepped: true },
    { id: 'vel', label: 'VELOCITY', min: 1, max: 127, def: 100, stepped: true },
  ],
  inputs: [
    { id: 'voct', label: 'V/OCT', poly: true },
    { id: 'gate', label: 'GATE', poly: true },
    { id: 'vin', label: 'VEL', poly: true },
    { id: 'cva', label: 'CC A' },
    { id: 'cvb', label: 'CC B' },
  ],
  outputs: [],
  leds: 1,
  rows: [['ks:ch', 'ks:vel'], ['ks:cc1', 'ks:cc2'], ['l:0'], ['i:voct', 'i:gate'], ['i:vin'], ['i:cva', 'i:cvb']],
})
