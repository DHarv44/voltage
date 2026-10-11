/** DRUM MAP's map: 3 × 3 grooves (X from straight to broken, Y from sparse
 *  to busy), each a level 0–9 per 16th for kick, snare and hat. Higher
 *  levels play at lower FILL; the highest are the accents. Our own grooves. */
const NODES: [string, string, string][][] = [
  [
    ['9000500090005000', '0000900000009000', '5050505050505050'], // plain backbeat
    ['9000900090009000', '0000700000007000', '0070007000700070'], // four on the floor, open offbeats
    ['9000600090200600', '0000800300008000', '7373737373737373'], // broken techno
  ],
  [
    ['9000005090000300', '0000900000009002', '6060606060606060'], // boom bap
    ['9000000090300000', '0000900002009004', '7050705070507050'], // breakbeat
    ['9000000500900000', '0000900000009000', '0505705005057050'], // two-step garage
  ],
  [
    ['9000000000900000', '0000900000009000', '6464646464646464'], // jungle / drum and bass
    ['9003009000300900', '0090000900900009', '7575757575757575'], // Latin-ish
    ['9030090300903009', '0000900300009030', '9797979797979797'], // footwork
  ],
]
export const DM_NODE_NAMES = [
  ['BACKBEAT', 'FOUR ON THE FLOOR', 'BROKEN TECHNO'],
  ['BOOM BAP', 'BREAKBEAT', '2-STEP'],
  ['JUNGLE', 'LATIN', 'FOOTWORK'],
]
const LEVEL = NODES.map((row) => row.map((node) => node.map((s) => Array.from(s, (c) => Number(c) / 9))))

/** Drum d's (0 kick, 1 snare, 2 hat) level at step s for map position (x, y) in 0..1. */
export function dmLevel(d: number, s: number, x: number, y: number): number {
  const gx = Math.min(1.999, Math.max(0, x) * 2)
  const gy = Math.min(1.999, Math.max(0, y) * 2)
  const ix = Math.floor(gx)
  const iy = Math.floor(gy)
  const fx = gx - ix
  const fy = gy - iy
  const a = LEVEL[iy][ix][d][s] * (1 - fx) + LEVEL[iy][ix + 1][d][s] * fx
  const b = LEVEL[iy + 1][ix][d][s] * (1 - fx) + LEVEL[iy + 1][ix + 1][d][s] * fx
  return a * (1 - fy) + b * fy
}
