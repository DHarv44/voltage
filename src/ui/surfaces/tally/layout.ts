/** TALLY's face geometry, as fractions of the canvas (x of its width, y of
 *  its height), shared by drawing and hit-testing. */

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

export const LCD: Rect = { x: 0.015, y: 0.03, w: 0.5, h: 0.25 }
export const ONE_KEY: Rect = { x: 0.535, y: 0.05, w: 0.27, h: 0.21 }
export const RHYTHM_BTN: Rect = { x: 0.82, y: 0.05, w: 0.165, h: 0.21 }

/** The calculator keys: two rows (ADSR is double width). */
export const PAD_ROWS: string[][] = [
  ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
  ['+', '−', '×', '÷', '=', '.', 'C', '♪', 'ADSR'],
]
const PAD_Y = [0.33, 0.495]
const PAD_H = 0.14
const PAD_X0 = 0.015
const PAD_W = 0.97
export function padRects(): { key: string; r: Rect }[] {
  const out: { key: string; r: Rect }[] = []
  PAD_ROWS.forEach((row, ri) => {
    const units = row.reduce((n, k) => n + (k === 'ADSR' ? 2 : 1), 0)
    const u = PAD_W / units
    let x = PAD_X0
    for (const key of row) {
      const w = u * (key === 'ADSR' ? 2 : 1)
      out.push({ key, r: { x: x + u * 0.06, y: PAD_Y[ri], w: w - u * 0.12, h: PAD_H } })
      x += w
    }
  })
  return out
}

/** The key strip: 29 keys from G (17 white, 12 black). Semitone offsets from
 *  the lowest key. */
const WHITE = [0, 2, 4, 5, 7, 9, 10, 12, 14, 16, 17, 19, 21, 22, 24, 26, 28]
/** Each black key's semitone and the white key it sits after. */
const BLACK: [number, number][] = [
  [1, 0], [3, 1], [6, 3], [8, 4], [11, 6], [13, 7], [15, 8], [18, 10], [20, 11], [23, 13], [25, 14], [27, 15],
]
const KB: Rect = { x: 0.015, y: 0.68, w: 0.97, h: 0.3 }
export function keyRects(): { key: number; black: boolean; r: Rect }[] {
  const ww = KB.w / WHITE.length
  const out: { key: number; black: boolean; r: Rect }[] = WHITE.map((key, i) => ({
    key,
    black: false,
    r: { x: KB.x + i * ww, y: KB.y, w: ww, h: KB.h },
  }))
  for (const [key, after] of BLACK) out.push({ key, black: true, r: { x: KB.x + (after + 1) * ww - ww * 0.32, y: KB.y, w: ww * 0.64, h: KB.h * 0.58 } })
  return out
}

export const inside = (r: Rect, fx: number, fy: number) => fx >= r.x && fx <= r.x + r.w && fy >= r.y && fy <= r.y + r.h

/** The key under a point (black keys first: they sit on top). */
export function keyAt(fx: number, fy: number): number | null {
  const keys = keyRects()
  const hit = keys.filter((k) => k.black).find((k) => inside(k.r, fx, fy)) ?? keys.filter((k) => !k.black).find((k) => inside(k.r, fx, fy))
  return hit ? hit.key : null
}
