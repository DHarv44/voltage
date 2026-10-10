import { checkStyle, type Style } from './style'
import { ALT, BLUES, RNB, ROCK } from './stylesA'
import { ELECTRO, HIPHOP, METAL, POP } from './stylesB'
import { COUNTRY, FOLK, JAZZ, LATIN } from './stylesC'

/** COMBO's twelve genres (twelve styles each: nine in 4/4, three in 3/4),
 *  and what each one's band sounds like: the bass player and the kit. */
export interface Genre {
  name: string
  styles: Style[]
  /** The bass: FINGER (electric, fingers), PICK (bright, driven), UPRIGHT
   *  (acoustic double bass), SYNTH (a filtered saw), SUB (a deep sine with a
   *  808's glide). */
  bass: 'FINGER' | 'PICK' | 'UPRIGHT' | 'SYNTH' | 'SUB'
  /** The kit: ACOUSTIC, ROOM (big rock drums), TIGHT (metal), JAZZ (small,
   *  with brushes and ride), MACHINE (drum machine), and what PERC is. */
  kit: 'ACOUSTIC' | 'ROOM' | 'TIGHT' | 'JAZZ' | 'MACHINE'
  perc: 'TAMB' | 'SHAKER' | 'CLAP' | 'CONGA' | 'RIM'
}

export const GENRES: Genre[] = [
  { name: 'BLUES', styles: BLUES, bass: 'FINGER', kit: 'ACOUSTIC', perc: 'TAMB' },
  { name: 'R&B', styles: RNB, bass: 'FINGER', kit: 'ACOUSTIC', perc: 'TAMB' },
  { name: 'ROCK', styles: ROCK, bass: 'PICK', kit: 'ROOM', perc: 'TAMB' },
  { name: 'ALT ROCK', styles: ALT, bass: 'PICK', kit: 'ROOM', perc: 'TAMB' },
  { name: 'METAL', styles: METAL, bass: 'PICK', kit: 'TIGHT', perc: 'TAMB' },
  { name: 'POP', styles: POP, bass: 'FINGER', kit: 'ACOUSTIC', perc: 'CLAP' },
  { name: 'ELECTRO POP', styles: ELECTRO, bass: 'SYNTH', kit: 'MACHINE', perc: 'CLAP' },
  { name: 'HIP-HOP', styles: HIPHOP, bass: 'SUB', kit: 'MACHINE', perc: 'CLAP' },
  { name: 'COUNTRY', styles: COUNTRY, bass: 'FINGER', kit: 'ACOUSTIC', perc: 'RIM' },
  { name: 'FOLK', styles: FOLK, bass: 'UPRIGHT', kit: 'ACOUSTIC', perc: 'SHAKER' },
  { name: 'LATIN', styles: LATIN, bass: 'FINGER', kit: 'ACOUSTIC', perc: 'CONGA' },
  { name: 'JAZZ', styles: JAZZ, bass: 'UPRIGHT', kit: 'JAZZ', perc: 'RIM' },
]
export const GENRE_NAMES = GENRES.map((g) => g.name)
export const STYLES_PER_GENRE = 12

export const styleOf = (genre: number, style: number): Style => {
  const g = GENRES[Math.max(0, Math.min(GENRES.length - 1, Math.round(genre)))]
  return g.styles[Math.max(0, Math.min(g.styles.length - 1, Math.round(style)))]
}

/** Startup check: twelve styles a genre, every chart the right length. */
export function validateCombo(): string[] {
  const errs: string[] = []
  for (const g of GENRES) {
    if (g.styles.length !== STYLES_PER_GENRE) errs.push(`${g.name}: ${g.styles.length} styles`)
    for (const s of g.styles) errs.push(...checkStyle(g.name, s))
  }
  return errs
}
