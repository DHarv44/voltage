import { st, type Style } from './style'

const SH = 1 / 3 // a full triplet shuffle

/** Blues: shuffles, boogies, a 12/8 slow blues, and three waltzes. */
export const BLUES: Style[] = [
  st('SLOW SHUFFLE', 'X.......x....... | ....X.......X... | x.x.x.x.x.x.x.x.', 'R.3.5.6.8.6.5.3.', { swing: SH, fill: 'snare' }),
  st('TEXAS SHUFFLE', 'X...X...X...X... | ..g.X.g...g.X.g. | x.x.x.x.x.x.x.x.', 'R.3.5.6.8.6.5.3.', { swing: SH, fill: 'snare' }),
  st('CHICAGO', 'X.....x.X....... | ....X.......X... | x.x.x.x.x.x.x.x.', 'R.R.5.6.R.R.5.6.', { swing: SH }),
  st('SLOW 12/8', 'X.....X..... | ...X.....X.. | xxxxxxxxxxxx', 'R..3..5..6..', { tri: true, fill: 'snare', gate: 0.9 }),
  st('BOOGIE', 'X...X...X...X... | ....X.......X... | x.x.x.x.x.x.x.x.', 'R.3.5.6.7.6.5.3.'),
  st('JUMP BLUES', 'X.......X....... | ....X.......X... | ....x.......x...', 'W...W...W...W...', { swing: SH, r: 'x...x.x.x...x.x.', fill: 'jazz' }),
  st('BLUES ROCK', 'X.....X.X....... | ....X.......X... | x.x.x.x.x.x.x.x.', 'R.R.R.R.5.5.7.5.'),
  st('FUNKY BLUES', 'X......x..X..... | ....X..g.g..X..g | xxxxxxxxxxxxxxxx', 'R..R..7.5..R.3.5', { gate: 0.55, fill: 'snare' }),
  st('MINOR BLUES', 'X.......X.....x. | ....X.......X... | x.x.x.x.x.x.x.x.', 'R...5...7...5...', { swing: SH, gate: 0.95 }),
  st('BLUES WALTZ', 'X........... | ....X...X... | x.x.x.x.x.x.', 'R...5...5...'),
  st('SHUFFLE WALTZ', 'X.......x... | ....X...X... | x.x.x.x.x.x.', 'R...3...5...', { swing: SH }),
  st('GOSPEL 3/4', 'X.....x..... | ....x...X... | x.x.x.x.x.x.', 'R.....5...3.', { swing: SH, p: '....X...X...' }),
]

/** R&B and soul: Motown, funk, neo soul, gospel, new jack, disco. */
export const RNB: Style[] = [
  st('MOTOWN', 'X.....X...X..... | ....X.......X... | x.x.x.x.x.x.x.x.', 'R...R.5.8...7.5.', { p: '....X.......X...', gate: 0.7, fill: 'snare' }),
  st('SOUL', 'X......xX....... | ....X.......X... | x.x.x.x.x.x.x.x.', 'R.....R.5.....3.', { fill: 'snare' }),
  st('FUNK', 'X..x..X...X..x.. | ....X..g.g..X..g | XxxxXxxxXxxxXxxx', 'R..R..8.R..5.7.8', { gate: 0.5, fill: 'snare' }),
  st('NEO SOUL', 'X......x..X..... | ....X.......X... | x.xxx.xxx.xxx.xx', 'R.....3..5....7.', { swing16: 0.3, gate: 0.9, fill: 'hiphop' }),
  st('GOSPEL', 'X.....X.X....... | ....X.......X... | x.x.x.x.x.x.x.x.', 'R...R.5.6...5.3.', { swing: SH, p: '....X.......X...' }),
  st('SLOW JAM 12/8', 'X.....X..... | ...X.....X.. | xxxxxxxxxxxx', 'R.....5..3..', { tri: true, gate: 0.95, fill: 'snare' }),
  st('NEW JACK', 'X..X..X...X..... | ....X.......X..g | x.x.x.x.x.x.x.x.', 'R..R....R..5..8.', { swing16: 0.5, p: '....X.......X...', fill: 'hiphop' }),
  st('DISCO', 'X...X...X...X... | ....X.......X... | ..x...x...x...x.', '8.R.8.R.8.R.8.R.', { o: '..X...X...X...X.', gate: 0.5, fill: 'snare' }),
  st('SHUFFLE SOUL', 'X.......X.x..... | ....X.......X... | x.x.x.x.x.x.x.x.', 'R...5.8.R...5.3.', { swing: SH }),
  st('SOUL WALTZ', 'X........... | ....X...X... | x.x.x.x.x.x.', 'R...5...3...'),
  st('BALLAD 3/4', 'X.......x... | ........X... | x.x.x.x.x.x.', 'R.......5...', { gate: 1 }),
  st('JAZZY 3/4', 'X........... | ........g... | ....x...x...', 'R...5...3...', { swing: SH, r: 'x...x.x.x...', fill: 'jazz' }),
]

/** Rock: straight 8ths, four on the snare's backbeat, shuffles, gallops, punk. */
export const ROCK: Style[] = [
  st('STRAIGHT 8', 'X.......X.X..... | ....X.......X... | x.x.x.x.x.x.x.x.', 'R.R.R.R.R.R.R.R.'),
  st('ROCK 4', 'X...X...X...X... | ....X.......X... | x.x.x.x.x.x.x.x.', 'R...R...R...R...'),
  st('HALF TIME', 'X.....X.......X. | ........X....... | x.x.x.x.x.x.x.x.', 'R.......R.....5.'),
  st('DRIVING 16', 'X.X...X.X.X..... | ....X.......X... | xxxxxxxxxxxxxxxx', 'R.R.R.R.R.R.R.R.'),
  st('ROCK SHUFFLE', 'X.....X.X....... | ....X.......X... | x.x.x.x.x.x.x.x.', 'R.R.5.5.6.6.5.5.', { swing: SH }),
  st('CLASSIC ROCK', 'X......XX.X..... | ....X.......X... | x.x.x.x.x.x.x.x.', 'R.....R.8...5.R.'),
  st('ROCK BALLAD', 'X.......X....... | ....X.......X... | x.x.x.x.x.x.x.x.', 'R.......R...5...', { gate: 1 }),
  st('GALLOP', 'X.XXX.XXX.XXX.XX | ....X.......X... | x.x.x.x.x.x.x.x.', 'R.RRR.RRR.RRR.RR', { gate: 0.6 }),
  st('PUNK', 'X...X...X...X... | ..X...X...X...X. | x.x.x.x.x.x.x.x.', 'R.R.R.R.R.R.R.R.', { gate: 0.7 }),
  st('ROCK WALTZ', 'X.......X... | ....X...X... | x.x.x.x.x.x.', 'R...R...R...'),
  st('SLOW 3', 'X........... | ........X... | x.x.x.x.x.x.', 'R.......5...', { gate: 1 }),
  st('POWER WALTZ', 'X...x...x... | ....X...X... | x.x.x.x.x.x.', 'R.R.R.R.R.R.'),
]

/** Alternative: indie, grunge, tribal toms, dance punk, shoegaze, math rock. */
export const ALT: Style[] = [
  st('INDIE', 'X.....X...X..... | ....X.......X... | xxxxxxxxxxxxxxxx', 'R.R.R.R.R.R.R.R.'),
  st('GRUNGE', 'X.....X.X....... | ....X.......X... | ', 'R.....R.R.......', { o: 'x.x.x.x.x.x.x.x.' }),
  st('TRIBAL', 'X.....X...X..... | ............X... | ', 'R.....R...R.....', { t: 'x.x.x.x.x..x.x..' }),
  st('DANCE PUNK', 'X...X...X...X... | ....X.......X... | ..x...x...x...x.', '8.R.8.R.8.R.8.R.', { o: '..X...X...X...X.', gate: 0.5 }),
  st('SHOEGAZE', 'X.......X....... | ....X.......X... | ', 'R---------------', { r: 'x.x.x.x.x.x.x.x.', gate: 1, fill: 'roll' }),
  st('MATH', 'X..X..X...X..X.. | ....X.....X..... | x.x.x.x.x.x.x.x.', 'R..R..R...R..R..'),
  st('POST PUNK', 'X.X...X.X.X...X. | ....X.......X... | xxxxxxxxxxxxxxxx', 'R.R.R.R.8.8.5.5.'),
  st('BRITPOP', 'X......XX.X..... | ....X.......X... | x.x.x.x.x.x.x.x.', 'R...R.R.5...R...', { p: '....X.......X...' }),
  st('HALF-TIME ALT', 'X.........X..... | ........X....... | x.x.x.x.x.x.x.x.', 'R.........R.....'),
  st('ALT WALTZ', 'X.......X... | ....X...X... | xxxxxxxxxxxx', 'R...R...R...'),
  st('SLOWCORE 3', 'X........... | ........X... | ', 'R-----------', { r: 'x...x...x...', gate: 1 }),
  st('DREAMY 3', 'X.....x..... | ........X... | x.x.x.x.x.x.', 'R.....5.....', { gate: 1, fill: 'roll' }),
]
