import { st, type Style } from './style'

const SH = 1 / 3

/** Metal: thrash, double kick, gallops, doom, groove, blast beats, djent. */
export const METAL: Style[] = [
  st('THRASH', 'X.x.X.x.X.x.X.x. | ..X...X...X...X. | ', 'R.R.R.R.R.R.R.R.', { r: 'x.x.x.x.x.x.x.x.', gate: 0.6 }),
  st('DOUBLE KICK', 'XxXxXxXxXxXxXxXx | ....X.......X... | ', 'RRRRRRRRRRRRRRRR', { r: 'x.x.x.x.x.x.x.x.', gate: 0.6 }),
  st('HEAVY', 'X.....X.X....... | ....X.......X... | x.x.x.x.x.x.x.x.', 'R.....R.R.......'),
  st('GALLOP', 'X.XXX.XXX.XXX.XX | ....X.......X... | x.x.x.x.x.x.x.x.', 'R.RRR.RRR.RRR.RR', { gate: 0.55 }),
  st('DOOM', 'X............... | ........X....... | ', 'R---------------', { r: 'x.......x.......', gate: 1 }),
  st('GROOVE METAL', 'X..X..X.X..X.... | ....X.......X... | x.x.x.x.x.x.x.x.', 'R..R..R.R..R....', { gate: 0.6 }),
  st('BLAST', 'X.X.X.X.X.X.X.X. | .X.X.X.X.X.X.X.X | ', 'RRRRRRRRRRRRRRRR', { r: 'x.x.x.x.x.x.x.x.', gate: 0.6, fill: 'snare' }),
  st('DJENT', 'X.XX..X.X..XX.X. | ....X.......X... | x.......x.......', 'R.RR..R.R..RR.R.', { gate: 0.5 }),
  st('HALF-TIME METAL', 'XxXxXxXxXxXxXxXx | ........X....... | ', 'R.......R.......', { r: 'x...x...x...x...' }),
  st('METAL WALTZ', 'X.X.X.X.X.X. | ....X...X... | ', 'R.R.R.R.R.R.', { r: 'x...x...x...' }),
  st('DOOM 3/4', 'X........... | ........X... | ', 'R-----------', { r: 'x.......x...', gate: 1 }),
  st('GALLOP 3/4', 'X.XXX.XXX.XX | ....X...X... | x.x.x.x.x.x.', 'R.RRR.RRR.RR', { gate: 0.55 }),
]

/** Pop: pop rock, four on the floor, ballads, shuffles, island pop. */
export const POP: Style[] = [
  st('POP ROCK', 'X.......X.X..... | ....X.......X... | x.x.x.x.x.x.x.x.', 'R.R.R.R.R.R.R.R.'),
  st('FOUR ON FLOOR', 'X...X...X...X... | ....X.......X... | ..x...x...x...x.', 'R...R.R...R.R...', { p: '....X.......X...' }),
  st('POP BALLAD', 'X.......X....... | ....X.......X... | x.x.x.x.x.x.x.x.', 'R.......R...5...', { gate: 1 }),
  st('POP 16', 'X..X....X.X..... | ....X.......X... | xxxxxxxxxxxxxxxx', 'R..R....R.R..5..'),
  st('SHUFFLE POP', 'X.....X.X....... | ....X.......X... | x.x.x.x.x.x.x.x.', 'R.....R.R...5...', { swing: SH }),
  st('POWER POP', 'X.X...X.X.X..... | ....X.......X... | ', 'R.R.R.R.R.R.R.R.', { o: 'x.x.x.x.x.x.x.x.' }),
  st('ISLAND POP', 'X...X...X...X... | ...X..X....X..X. | x.x.x.x.x.x.x.x.', 'R..R..R.R..R..R.', { fill: 'latin' }),
  st('MOTOR POP', 'X...X...X...X... | ....X.......X... | xxxxxxxxxxxxxxxx', 'R.R.R.R.R.R.R.R.'),
  st('HALF-TIME POP', 'X.....X.......X. | ........X....... | x.x.x.x.x.x.x.x.', 'R.....R.......5.'),
  st('POP WALTZ', 'X........... | ....X...X... | x.x.x.x.x.x.', 'R...5...5...'),
  st('BALLAD 3/4', 'X.......x... | ........X... | x.x.x.x.x.x.', 'R.......5...', { gate: 1 }),
  st('FOLK POP 3/4', 'X.....x..... | ....X...X... | x.x.x.x.x.x.', 'R.....5.R...', { p: 'x.x.x.x.x.x.' }),
]

/** Electronic pop: house, synthpop, techno, electro, garage, synthwave. */
export const ELECTRO: Style[] = [
  st('HOUSE', 'X...X...X...X... |  | ..x...x...x...x.', '..R...R...R...R.', { p: '....X.......X...', o: '..X...X...X...X.', gate: 0.5, fill: 'roll' }),
  st('SYNTHPOP', 'X.......X....... | ....X.......X... | x.x.x.x.x.x.x.x.', 'R.R.R.R.R.R.R.R.', { gate: 0.6, fill: 'roll' }),
  st('TECHNO', 'X...X...X...X... |  | ..x...x...x...x.', '..RR..RR..RR..RR', { p: '....X.......X...', gate: 0.5, fill: 'roll' }),
  st('ELECTRO', 'X......X..X..... | ....X.......X... | xxxxxxxxxxxxxxxx', 'R......R..R.....', { fill: 'roll' }),
  st('DISCO HOUSE', 'X...X...X...X... | ....X.......X... | ', '8.R.8.R.8.R.8.R.', { o: '..X...X...X...X.', gate: 0.5, fill: 'roll' }),
  st('FUTURE BASS', 'X.........X..... | ........X....... | x.x.x.x.x.x.x.x.', 'R---------R-----', { gate: 1, fill: 'roll' }),
  st('DRUM & BASS', 'X.........X..... | ....X.......X... | x.x.x.x.x.x.x.x.', 'R.......R.....R.', { fill: 'roll' }),
  st('UK GARAGE', 'X......X..X..... | ....X.......X... | xxxxxxxxxxxxxxxx', 'R...R..R...R....', { swing16: 0.4, fill: 'roll' }),
  st('SYNTHWAVE', 'X...X...X...X... | ....X.......X... | x.x.x.x.x.x.x.x.', 'R8R8R8R8R8R8R8R8', { gate: 0.5, fill: 'roll' }),
  st('ELECTRO WALTZ', 'X...X...X... | ........X... | ..x...x...x.', 'R...R...R...', { gate: 0.6, fill: 'roll' }),
  st('DREAM 3/4', 'X........... | ........X... | x.x.x.x.x.x.', 'R-----------', { gate: 1, fill: 'roll' }),
  st('TRIP 3/4', 'X.....X..... | ........X... | x.xxx.xxx.xx', 'R.....R.....', { swing16: 0.3, fill: 'hiphop' }),
]

/** Hip-hop: boom bap, trap, lo-fi, West Coast, drill, G-funk, bounce. */
export const HIPHOP: Style[] = [
  st('BOOM BAP', 'X......X..X..... | ....X.......X... | x.x.x.x.x.x.x.x.', 'R......R..R.....', { swing16: 0.25, fill: 'hiphop' }),
  st('TRAP', 'X.........X..... | ........X....... | xxxxxxxxxxxxxxxx', 'R---------R-----', { gate: 1, fill: 'hiphop' }),
  st('LO-FI', 'X.....X...X..... | ....X.......X... | x.x.x.x.x.x.x.x.', 'R.....5...R.....', { swing16: 0.45, fill: 'hiphop' }),
  st('WEST COAST', 'X.....X.X....... | ....X.......X... | xxxxxxxxxxxxxxxx', 'R..R..5.R..R..7.', { fill: 'hiphop' }),
  st('DRILL', 'X.....X...X..... | ........X.....X. | x..x..x.x..x..x.', 'R-----R---R-----', { gate: 1, fill: 'hiphop' }),
  st('OLD SCHOOL', 'X.....X...X..... | ....X.......X... | x.x.x.x.x.x.x.x.', 'R.....R...R.....', { p: '....X.......X...', fill: 'hiphop' }),
  st('G-FUNK', 'X......X.XX..... | ....X.......X... | x.x.x.x.x.x.x.x.', 'R..R..5..R..3.5.', { swing16: 0.3, gate: 0.7, fill: 'hiphop' }),
  st('JAZZ HOP', 'X.......X.x..... | ....X.......X... | ', 'R...5...R...3...', { swing: SH, r: 'x...x.x.x...x.x.', fill: 'hiphop' }),
  st('BOUNCE', 'X..X..X.X..X..X. | ....X.......X... | x.x.x.x.x.x.x.x.', 'R..R..R.R..R..R.', { gate: 0.6, fill: 'hiphop' }),
  st('HIP-HOP WALTZ', 'X.....X..... | ....X...X... | x.x.x.x.x.x.', 'R.....R.....', { swing16: 0.25, fill: 'hiphop' }),
  st('TRAP 3/4', 'X.......X... | ........X... | xxxxxxxxxxxx', 'R-------R---', { gate: 1, fill: 'hiphop' }),
  st('LO-FI 3/4', 'X.....X..... | ....X...X... | x.x.x.x.x.x.', 'R.....5.....', { swing16: 0.45, fill: 'hiphop' }),
]
