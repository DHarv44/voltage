import { DRUM_CHANNEL, type MidiEvent } from '../engine/protocol'
import { GM_PADS } from '../engine/drumMap'

type Send = (ev: MidiEvent) => void

/** Hardware MIDI via Web MIDI (all inputs, hot-plug aware). */
export async function initMidi(send: Send, status: (s: string) => void): Promise<void> {
  if (!navigator.requestMIDIAccess) {
    status('No Web MIDI')
    return
  }
  try {
    const access = await navigator.requestMIDIAccess()
    const bind = () => {
      let n = 0
      access.inputs.forEach((input) => {
        input.onmidimessage = (e) => parse(e.data, send)
        n++
      })
      status(n ? `MIDI: ${n} input${n > 1 ? 's' : ''}` : 'MIDI: none')
    }
    access.onstatechange = bind
    bind()
  } catch {
    status('MIDI blocked')
  }
}

function parse(d: Uint8Array | null, send: Send): void {
  if (!d || d.length < 2) return
  const type = d[0] & 0xf0
  const ch = (d[0] & 0x0f) + 1
  if (type === 0x90 && d[2] > 0) send({ kind: 'on', note: d[1], vel: d[2], ch })
  else if (type === 0x80 || type === 0x90) send({ kind: 'off', note: d[1], ch })
  else if (type === 0xb0) send({ kind: 'cc', cc: d[1], value: d[2] })
  else if (type === 0xe0) send({ kind: 'bend', value: (((d[2] << 7) | d[1]) - 8192) / 8192 })
}

const KEYS = ['a', 'w', 's', 'e', 'd', 'f', 't', 'g', 'y', 'h', 'u', 'j', 'k', 'o', 'l', 'p', ';', "'"]
/** Physical key codes, so Shift (= accent) doesn't turn 1 into '!'. */
const PAD_KEYS = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7', 'Digit8']

/** Computer keyboard as a one-and-a-half-octave keybed (Z/X shift octaves),
 *  and the number row 1–8 as a drum-pad controller on MIDI channel 10. */
export function initQwerty(send: Send): void {
  let octave = 0
  const held = new Map<string, number>()
  const heldPads = new Set<string>()
  const typing = (e: KeyboardEvent) => {
    const t = e.target as HTMLElement | null
    return !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)
  }

  window.addEventListener('keydown', (e) => {
    if (e.repeat || e.ctrlKey || e.metaKey || e.altKey || typing(e)) return
    const k = e.key.toLowerCase()
    const pad = PAD_KEYS.indexOf(e.code)
    if (pad >= 0) {
      if (heldPads.has(e.code)) return
      heldPads.add(e.code)
      send({ kind: 'on', note: GM_PADS[pad], vel: e.shiftKey ? 127 : 100, ch: DRUM_CHANNEL })
      return
    }
    if (k === 'z') octave = Math.max(-3, octave - 1)
    else if (k === 'x') octave = Math.min(3, octave + 1)
    const i = KEYS.indexOf(k)
    if (i < 0 || held.has(k)) return
    const note = 60 + octave * 12 + i
    held.set(k, note)
    send({ kind: 'on', note, vel: 100 })
  })
  window.addEventListener('keyup', (e) => {
    const pad = PAD_KEYS.indexOf(e.code)
    if (pad >= 0) {
      heldPads.delete(e.code)
      send({ kind: 'off', note: GM_PADS[pad], ch: DRUM_CHANNEL })
      return
    }
    const k = e.key.toLowerCase()
    const note = held.get(k)
    if (note === undefined) return
    held.delete(k)
    send({ kind: 'off', note })
  })
  window.addEventListener('blur', () => {
    held.clear()
    heldPads.clear()
    send({ kind: 'panic' })
  })
}
