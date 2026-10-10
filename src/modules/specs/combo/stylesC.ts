import { st, type Style } from './style'

const SH = 1 / 3

/** Country: the train beat, two-step, shuffles, bluegrass, Tex-Mex polka,
 *  honky-tonk, and boom-chick waltzes. */
export const COUNTRY: Style[] = [
  st('TRAIN BEAT', 'X.......X....... | xgxgXgxgxgxgXgxg | ', 'R...5...R...5...', { fill: 'snare' }),
  st('TWO STEP', 'X.......X....... | ....X.......X... | x.x.x.x.x.x.x.x.', 'R...5...R...5...'),
  st('COUNTRY ROCK', 'X.....X.X....... | ....X.......X... | x.x.x.x.x.x.x.x.', 'R...R.5.R...5...'),
  st('COUNTRY SHUFFLE', 'X.......X....... | ....X.......X... | x.x.x.x.x.x.x.x.', 'R...5...6...5...', { swing: SH }),
  st('COUNTRY BALLAD', 'X.......X....... |  | x.x.x.x.x.x.x.x.', 'R.......5.......', { p: '....x.......x...', gate: 1, fill: 'snare' }),
  st('BLUEGRASS', 'X.......X....... | ....X.......X... | x.x.x.x.x.x.x.x.', 'R...5...R...5...', { fill: 'snare' }),
  st('TEX-MEX', 'X...X...X...X... | ..X...X...X...X. | ', 'R...5...R...5...', { gate: 0.6, fill: 'snare' }),
  st('HONKY TONK', 'X...X...X...X... | ....X.......X... | x.x.x.x.x.x.x.x.', 'R...3...5...3...', { swing: SH }),
  st('MODERN COUNTRY', 'X.....X.X.X..... | ....X.......X... | xxxxxxxxxxxxxxxx', 'R.R.R.R.R.R.R.R.'),
  st('COUNTRY WALTZ', 'X........... | ....X...X... | x.x.x.x.x.x.', 'R...5...5...', { fill: 'snare' }),
  st('SLOW WALTZ', 'X........... | ........x... | x.x.x.x.x.x.', 'R.......5...', { gate: 1, fill: 'snare' }),
  st('BLUEGRASS WALTZ', 'X........... | ....X...X... | x.x.x.x.x.x.', 'R...5...3...', { fill: 'snare' }),
]

/** Folk: strums with shaker, folk rock, train, reels, stomp-clap, jigs. */
export const FOLK: Style[] = [
  st('FOLK STRUM', 'X.......X....... | ....x.......x... | ', 'R.......5.......', { p: 'x.x.x.x.x.x.x.x.', fill: 'none' }),
  st('FOLK ROCK', 'X.....X.X....... | ....X.......X... | x.x.x.x.x.x.x.x.', 'R...R...5...R...', { p: '....X.......X...', fill: 'snare' }),
  st('FOLK TRAIN', 'X...X...X...X... | gxgxgxgxgxgxgxgx | ', 'R...5...R...5...', { fill: 'snare' }),
  st('CELTIC REEL', 'X...X...X...X... | ....X.......X... | xxxxxxxxxxxxxxxx', 'R.......5.......', { fill: 'snare' }),
  st('STOMP CLAP', 'X.......X....... |  | ', 'R.......R.......', { p: '....X.......X...', fill: 'none' }),
  st('INDIE FOLK', 'X.......X.X..... | ............X... | ', 'R.......R.....5.', { t: 'x...x...x...x...', fill: 'toms' }),
  st('FOLK SHUFFLE', 'X.......X....... | ....x.......x... | ', 'R...5...R...5...', { swing: SH, p: 'x.x.x.x.x.x.x.x.', fill: 'none' }),
  st('FOLK BALLAD', 'X............... | ........x....... | ', 'R---------------', { p: 'x.x.x.x.x.x.x.x.', gate: 1, fill: 'none' }),
  st('JIG 12/8', 'X.....X..... | ...x.....x.. | ', 'R..5..R..5..', { tri: true, p: 'xxxxxxxxxxxx', fill: 'snare' }),
  st('FOLK WALTZ', 'X........... | ....x...x... | ', 'R...5...5...', { p: 'x.x.x.x.x.x.', fill: 'none' }),
  st('MOUNTAIN WALTZ', 'X........... | ....X...X... | x.x.x.x.x.x.', 'R...5...3...', { fill: 'snare' }),
  st('LULLABY 3/4', 'X........... |  | ', 'R-----------', { p: 'x...x...x...', gate: 1, fill: 'none' }),
]

/** Latin: bossa, samba, salsa, cha-cha, reggaeton, cumbia, mambo, merengue. */
export const LATIN: Style[] = [
  st('BOSSA NOVA', 'X..xX..xX..xX..x |  | x.x.x.x.x.x.x.x.', 'R.....5.R.....5.', { p: 'x..x..x...x..x..', fill: 'latin' }),
  st('SAMBA', 'X..xX..xX..xX..x |  | xxxxxxxxxxxxxxxx', 'R..5R..5R..5R..5', { p: 'x.xxx.xx.xx.x.xx', gate: 0.6, fill: 'latin' }),
  st('SALSA', 'X......x......x. |  | ', '......R.....5...', { p: '..x.x...x..x..x.', t: 'x..x..x.x..x..x.', fill: 'latin' }),
  st('CHA CHA', 'X.......X....... | ....X.......X... | ', 'R.......5...5.5.', { p: 'x...x...x...x.x.', fill: 'latin' }),
  st('REGGAETON', 'X...X...X...X... | ...X..X....X..X. | x.x.x.x.x.x.x.x.', 'R..R..R.R..R..R.', { gate: 0.6, fill: 'latin' }),
  st('CUMBIA', 'X.......X....... | ....X.......X... | ', 'R.......5.......', { p: 'x..xx..xx..xx..x', fill: 'latin' }),
  st('MAMBO', 'X......x......x. |  | ', '......R...5.....', { p: 'x..x..x...x.x...', t: 'x..x..x.x..x..x.', fill: 'latin' }),
  st('LATIN ROCK', 'X.....X.X....... | ....X.......X... | x.x.x.x.x.x.x.x.', 'R..R..R.R..R..5.', { p: 'x...x...x...x...', fill: 'latin' }),
  st('MERENGUE', 'X...X...X...X... |  | ', 'R...5...R...5...', { p: 'xxxxxxxxxxxxxxxx', t: 'x..xx..xx..xx..x', gate: 0.6, fill: 'latin' }),
  st('JOROPO 3/4', 'X.....X..... |  | ', 'R.....5.....', { p: 'x.x.x.x.x.x.', fill: 'latin' }),
  st('LATIN WALTZ', 'X........... | ....x...x... | x.x.x.x.x.x.', 'R...5...5...', { fill: 'latin' }),
  st('VALS PERUANO', 'X.......x... | ....X....... | ', 'R.......5...', { p: 'x..x..x..x..', fill: 'latin' }),
]

/** Jazz: swing (medium and up), brushes, two-feel, bossa, jazz funk, waltzes. */
export const JAZZ: Style[] = [
  st('MED SWING', 'g...g...g...g... | g.....g.......g. | ....x.......x...', 'W...W...W...W...', { swing: SH, r: 'x...x.x.x...x.x.', fill: 'jazz' }),
  st('UP SWING', 'g...g...g...g... | ......g.....g... | ....x.......x...', 'W...W...W...W...', { swing: 0.25, r: 'x...x.x.x...x.x.', fill: 'jazz' }),
  st('BRUSH BALLAD', 'g.......g....... | g.g.g.g.g.g.g.g. | ....x.......x...', 'R.......5.......', { swing: SH, gate: 1, fill: 'jazz' }),
  st('TWO FEEL', 'g.......g....... | ..........g..... | ....x.......x...', 'R.......5.......', { swing: SH, r: 'x...x.x.x...x.x.', fill: 'jazz' }),
  st('JAZZ BOSSA', 'X..xX..xX..xX..x |  | ', 'R.....5.R.....5.', { p: 'x..x..x...x..x..', r: 'x.x.x.x.x.x.x.x.', fill: 'latin' }),
  st('JAZZ FUNK', 'X..x..X...X..x.. | ....X..g.g..X..g | xxxxxxxxxxxxxxxx', 'R..R..8.R..5.7.8', { gate: 0.5, fill: 'snare' }),
  st('JAZZ SHUFFLE', 'X.......X....... | ..g...g...g...g. | ', 'W...W...W...W...', { swing: SH, r: 'x.x.x.x.x.x.x.x.', fill: 'jazz' }),
  st('MODAL', 'X.....x......... | g..g......g..... | ....x.......x...', 'W...W...W...W...', { swing: SH, r: 'x...x.x.x...x.x.', fill: 'jazz' }),
  st('LATIN JAZZ', 'X.....X...X..... | ...x..x...x..x.. | ', '......R.....5...', { r: 'x.x.x.x.x.x.x.x.', fill: 'latin' }),
  st('JAZZ WALTZ', 'X........... | ......g..... | ....x...x...', 'W...W...W...', { swing: SH, r: 'x...x.x.x...', fill: 'jazz' }),
  st('WALTZ BALLAD', 'g........... | g.g.g.g.g.g. | ....x...x...', 'R.......5...', { swing: SH, gate: 1, fill: 'jazz' }),
  st('FAST WALTZ', 'g........... | ........g... | ....x...x...', 'W...W...W...', { swing: 0.25, r: 'x...x...x...', fill: 'jazz' }),
]
