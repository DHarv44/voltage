import { chainId, LOCK_PAGES, lockId, LS_CHAIN, LS_PAGES, LS_PATTERNS, LS_TRACK_COLORS, muteId, slideId } from '../../../modules/specs/lockstepDefs'
import { actions } from '../../../patch/store'
import { lsClip, lsNote } from './clipboard'
import { chainRec, CLUSTER_X, lockstepSel, PAGE_X, PAGE_Y, ROW_Y } from './layout'

export interface Button {
  label: string
  x: number
  y: number
  color?: string
  lit?: boolean
  /** Momentary: `press` on the way down, `release` on the way up. */
  press: () => void
  release?: () => void
  /** Hold (or right-click) does this instead; then `press` waits for a short tap. */
  hold?: () => void
}

const PAT_COLOR = '#c9cbd1'

/** LOCKSTEP's buttons: the pages; tracks (hold to mute); patterns A–D (a
 *  pattern picked while playing waits for the bar, and blinks till then) and
 *  CHAIN; PLAY, FILL, COPY, PASTE. With a step picked the pattern row
 *  becomes UNLOCK, CLEAR, SLIDE and DONE, and COPY / PASTE work on that step. */
export function lsButtons(mod: string, p: Record<string, number>, playing: number): Button[] {
  const set = (id: string, v: number) => actions.setParam(mod, id, v)
  const write = (writes: [string, number][], label: string) =>
    writes.length && actions.setParams(writes.map(([id, v]) => [mod, id, v] as [string, string, number]), `${label}:${mod}`)
  const s = lockstepSel.get(mod)
  const t = Math.round(p.trk)
  const pat = Math.round(p.pat ?? 0)
  const run = p.run >= 0.5
  const blink = Math.floor(performance.now() / 250) % 2 === 0
  const out: Button[] = [
    ...LS_PAGES.map((label, i) => ({ label, x: PAGE_X[i], y: PAGE_Y, lit: Math.round(p.page) === i, press: () => set('page', i) })),
    // tap selects a track; hold (or right-click) mutes it
    ...LS_TRACK_COLORS.map((color, k) => {
      const muted = (p[muteId(k)] ?? 0) >= 0.5
      return {
        label: muted ? `T${k + 1} ✕` : `T${k + 1}`,
        x: CLUSTER_X[k],
        y: ROW_Y[0],
        color: muted ? '#5a5c62' : color,
        lit: t === k,
        press: () => set('trk', k),
        hold: () => set(muteId(k), muted ? 0 : 1),
      }
    }),
    { label: run ? '■ STOP' : '▶ PLAY', x: CLUSTER_X[0], y: ROW_Y[2], lit: run, press: () => set('run', run ? 0 : 1) },
    { label: 'FILL', x: CLUSTER_X[1], y: ROW_Y[2], lit: p.fill >= 0.5, press: () => set('fill', 1), release: () => set('fill', 0) },
    // tap: the pattern (or the picked step); hold: just this track
    {
      label: 'COPY',
      x: CLUSTER_X[2],
      y: ROW_Y[2],
      press: () => lsNote.say(mod, s >= 0 ? lsClip.copyStep(p, t, s, pat) : lsClip.copyPattern(p, pat)),
      hold: () => lsNote.say(mod, lsClip.copyTrack(p, t, pat)),
    },
    {
      label: 'PASTE',
      x: CLUSTER_X[3],
      y: ROW_Y[2],
      press: () => {
        const { writes, say } = lsClip.paste(p, t, s, pat)
        write(writes, 'paste')
        lsNote.say(mod, say)
      },
    },
  ]
  if (s < 0) {
    const writing = chainRec.has(mod)
    const len = Math.round(p.chlen ?? 0)
    out.push(
      ...LS_PATTERNS.map((label, k) => {
        const cued = run && k === pat && k !== playing
        // writing a chain, a tap adds the pattern to it
        const press = writing
          ? () => len < LS_CHAIN && write([[chainId(len), k], ['chlen', len + 1]], 'chain')
          : () => set('pat', k)
        return { label, x: CLUSTER_X[k], y: ROW_Y[1], color: PAT_COLOR, lit: k === pat && (!cued || blink), press }
      }),
      // CHAIN: tap plays the chain (or stops it); hold writes a new one, tap to finish
      {
        label: writing ? (blink ? '● CHAIN' : 'CHAIN') : 'CHAIN',
        x: CLUSTER_X[4],
        y: ROW_Y[1],
        lit: writing ? blink : (p.chon ?? 0) >= 0.5,
        press: () => {
          if (writing) {
            chainRec.delete(mod)
            set('chon', len > 0 ? 1 : 0)
          } else if (len === 0) {
            chainRec.add(mod)
          } else set('chon', (p.chon ?? 0) >= 0.5 ? 0 : 1)
        },
        hold: () => {
          chainRec.add(mod)
          write([['chon', 0], ['chlen', 0]], 'chain')
          lsNote.say(mod, 'TAP PATTERNS, THEN CHAIN')
        },
      },
    )
  }
  else
    out.push(
      {
        label: 'UNLOCK',
        x: CLUSTER_X[0],
        y: ROW_Y[1],
        press: () => write(Array.from({ length: LOCK_PAGES }, (_, pg) => [lockId(t, s, pg, pat), 0]), 'unlock'),
      },
      { label: 'CLEAR', x: CLUSTER_X[1], y: ROW_Y[1], press: () => write(lsClip.clearStep(p, t, s, pat), 'clear') },
      // a slide glides into this step's note from the one before
      { label: 'SLIDE', x: CLUSTER_X[2], y: ROW_Y[1], lit: (p[slideId(t, s, pat)] ?? 0) >= 0.5, press: () => set(slideId(t, s, pat), (p[slideId(t, s, pat)] ?? 0) >= 0.5 ? 0 : 1) },
      { label: 'DONE', x: CLUSTER_X[3], y: ROW_Y[1], lit: true, press: () => lockstepSel.set(mod, -1) },
    )
  return out
}
