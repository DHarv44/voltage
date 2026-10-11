/** File parsers with no app state (testable anywhere): Standard MIDI Files
 *  and Scala tunings. */

/** A note from a MIDI file, in beats. */
export interface FileNote {
  beat: number
  note: number
  vel: number
  dur: number
  ch: number
}

function vlq(d: DataView, at: number): [number, number] {
  let v = 0
  let i = at
  for (let k = 0; k < 4; k++) {
    const b = d.getUint8(i++)
    v = (v << 7) | (b & 0x7f)
    if (!(b & 0x80)) break
  }
  return [v, i]
}

/** Parse a Standard MIDI File: every note (on to off) in beats, and the first tempo. */
export function parseMidi(buf: ArrayBuffer): { notes: FileNote[]; bpm: number } {
  const d = new DataView(buf)
  const tag = (at: number) => String.fromCharCode(d.getUint8(at), d.getUint8(at + 1), d.getUint8(at + 2), d.getUint8(at + 3))
  if (tag(0) !== 'MThd') throw new Error('not a MIDI file')
  const tracks = d.getUint16(10)
  const division = d.getUint16(12)
  if (division & 0x8000) throw new Error('SMPTE-timed MIDI files aren’t supported')
  const notes: FileNote[] = []
  let bpm = 120
  let tempoSet = false
  let at = 8 + d.getUint32(4)
  for (let t = 0; t < tracks && at + 8 <= d.byteLength; t++) {
    if (tag(at) !== 'MTrk') break
    const end = Math.min(d.byteLength, at + 8 + d.getUint32(at + 4))
    let i = at + 8
    let tick = 0
    let status = 0
    const open = new Map<number, { tick: number; vel: number }>()
    try {
      readTrack()
    } catch {
      // a truncated or damaged track: keep the notes read so far
    }
    at = end

    function readTrack(): void {
    while (i < end) {
      const [delta, j] = vlq(d, i)
      tick += delta
      i = j
      const b = d.getUint8(i)
      if (b & 0x80) {
        status = b
        i++
      }
      const type = status & 0xf0
      const ch = status & 0x0f
      if (status === 0xff) {
        const meta = d.getUint8(i++)
        const [len, k] = vlq(d, i)
        if (meta === 0x51 && !tempoSet && len === 3) {
          bpm = 60000000 / ((d.getUint8(k) << 16) | (d.getUint8(k + 1) << 8) | d.getUint8(k + 2))
          tempoSet = true
        }
        i = k + len
      } else if (status === 0xf0 || status === 0xf7) {
        const [len, k] = vlq(d, i)
        i = k + len
      } else if (type === 0x90 || type === 0x80) {
        const note = d.getUint8(i)
        const vel = d.getUint8(i + 1)
        i += 2
        const key = ch * 128 + note
        if (type === 0x90 && vel > 0) open.set(key, { tick, vel })
        else {
          const o = open.get(key)
          if (o) {
            notes.push({ beat: o.tick / division, note, vel: o.vel, dur: Math.max(1 / 64, (tick - o.tick) / division), ch: ch + 1 })
            open.delete(key)
          }
        }
      } else if (type === 0xc0 || type === 0xd0) i += 1
      else i += 2
    }
    }
  }
  notes.sort((a, b) => a.beat - b.beat || a.note - b.note)
  return { notes, bpm }
}

/** Parse a Scala .scl file: each degree's cents above the root (the last is the period). */
export function parseScala(text: string): number[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => !l.startsWith('!'))
  // the description may be blank: it's the first line that isn't a comment
  const body = lines.slice(1).filter((l) => l)
  const count = parseInt(body[0], 10)
  if (!Number.isFinite(count) || count < 1) throw new Error('no note count')
  return body.slice(1, 1 + count).map((l) => {
    const v = l.split(/\s+/)[0]
    if (v.includes('.')) return parseFloat(v)
    const [a, b] = v.split('/').map(Number)
    return 1200 * Math.log2(a / (b || 1))
  })
}
