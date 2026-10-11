import { MF_STRIDE } from '../modules/specs/midifile'
import { SCALA_MAX, TUNING_NAMES } from '../modules/specs/tuning'
import { actions, patchStore } from '../patch/store'
import { buffers } from './buffers'
import { parseMidi, parseScala } from './parsers'

/** LOAD .MID: parse the file and give the notes to a MIDI FILE player
 *  (as a buffer: beat, note, velocity, length, channel per note; rate = the
 *  file's tempo), switch it to the file at the file's tempo. */
export async function loadMidiFile(mod: string, slot: number, file: File): Promise<string | null> {
  try {
    const { notes, bpm } = parseMidi(await file.arrayBuffer())
    if (!notes.length) return 'That MIDI file has no notes in it.'
    const data = new Float32Array(notes.length * MF_STRIDE)
    notes.forEach((n, i) => data.set([n.beat, n.note, n.vel, n.dur, n.ch], i * MF_STRIDE))
    await buffers.loadData(mod, slot, bpm, data)
    actions.setParams(
      [
        [mod, 'src', 1],
        [mod, 'tempo', Math.max(30, Math.min(240, Math.round(bpm)))],
      ],
      `midi:${mod}`,
    )
    return null
  } catch (err) {
    return `Couldn't read that MIDI file (${String(err)})`
  }
}

/** LOAD .SCL: write the tuning's degrees into a TUNING module and switch it to SCALA. */
export async function loadScalaFile(mod: string, file: File): Promise<string | null> {
  try {
    const cents = parseScala(await file.text()).slice(0, SCALA_MAX)
    if (cents.some((c) => !Number.isFinite(c))) return 'That .scl file has a degree that isn’t a number or ratio.'
    const updates: [string, string, number][] = [
      [mod, 'preset', TUNING_NAMES.indexOf('SCALA')],
      [mod, 'sn', cents.length],
    ]
    cents.forEach((c, i) => updates.push([mod, `s${i}`, c]))
    if (patchStore.get().modules.some((m) => m.id === mod)) actions.setParams(updates, `scala:${mod}`)
    return null
  } catch (err) {
    return `Couldn't read that tuning (${String(err)})`
  }
}
