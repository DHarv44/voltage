import { useSyncExternalStore } from 'react'
import { slotParam } from '../../modules/specs/strudelFamily'
import { patchStore } from '../../patch/store'
import { PX } from '../geometry'
import type { SurfaceProps } from './common'
import { linkedParts, partLabel } from './strudelNames'

const FONT = `Bahnschrift, 'Arial Narrow', sans-serif`

function screen(x: number, y: number, w: number, h: number, dim: boolean) {
  return {
    position: 'absolute' as const,
    left: x * PX,
    top: y * PX,
    width: w * PX,
    height: h * PX,
    boxSizing: 'border-box' as const,
    padding: '0.3em 0.5em',
    borderRadius: 3,
    background: '#0e1012',
    color: dim ? '#6a6d75' : '#d9e6c8',
    font: `${Math.max(8, 2.2 * PX)}px/1.3 ${FONT}`,
    overflow: 'hidden',
  }
}

/** STRUDEL PART's screen: which part it plays, by the sounds the linked piece puts there. */
export function StrudelPart({ inst, x, y, w, h }: SurfaceProps) {
  const text = useSyncExternalStore(patchStore.subscribe, () => {
    const p = patchStore.get()
    const lane = Math.round(p.modules.find((m) => m.id === inst.id)?.params.lane ?? 1)
    return `${lane}|${partLabel(linkedParts(p, inst.id), lane)}`
  })
  const [lane, name] = text.split('|')
  return (
    <div style={screen(x, y, w, h, !name)}>
      <div style={{ opacity: 0.6 }}>PART {lane}</div>
      <div style={{ fontWeight: 700, wordBreak: 'break-all' }}>{name || 'not linked'}</div>
    </div>
  )
}

/** STRUDEL PARTS ×4's screen: the four parts, a line each. */
export function StrudelParts({ inst, x, y, w, h }: SurfaceProps) {
  const text = useSyncExternalStore(patchStore.subscribe, () => {
    const p = patchStore.get()
    const me = p.modules.find((m) => m.id === inst.id)
    const names = linkedParts(p, inst.id)
    return [0, 1, 2, 3]
      .map((s) => {
        const lane = Math.round(me?.params[slotParam(s)] ?? s + 1)
        return `${lane}|${partLabel(names, lane)}`
      })
      .join('\n')
  })
  const rows = text.split('\n').map((r) => r.split('|'))
  const linked = rows.some(([, n]) => n)
  return (
    <div style={{ ...screen(x, y, w, h, !linked), display: 'flex', flexDirection: 'column', justifyContent: 'space-around' }}>
      {rows.map(([lane, name], s) => (
        <div key={s} style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          <span style={{ opacity: 0.6 }}>{'ABCD'[s]} · </span>
          <span style={{ fontWeight: 700 }}>{linked ? name || `part ${lane}` : 'not linked'}</span>
        </div>
      ))}
    </div>
  )
}
