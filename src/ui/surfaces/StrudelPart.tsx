import { useSyncExternalStore } from 'react'
import { patchStore } from '../../patch/store'
import { planLanes } from '../../strudel/lanes'
import { runStrudel } from '../../strudel/run'
import { PX } from '../geometry'
import type { SurfaceProps } from './common'

/** Part names per piece of code (the interpreter is run once per text). */
const names = new Map<string, string[]>()
function partNames(code: string): string[] {
  let n = names.get(code)
  if (!n) {
    const r = runStrudel(code)
    n = r.error ? [] : planLanes(r, 12).names
    if (names.size > 20) names.clear()
    names.set(code, n)
  }
  return n
}

/** STRUDEL PART's screen: which part it plays, by the sound the linked piece names there. */
export function StrudelPart({ inst, x, y, w, h }: SurfaceProps) {
  const text = useSyncExternalStore(patchStore.subscribe, () => {
    const p = patchStore.get()
    const c = p.cables.find((k) => k.to.mod === inst.id && k.to.jack === 'link')
    const host = c && c.from.jack === 'link' ? p.modules.find((m) => m.id === c.from.mod) : undefined
    const lane = Math.round(p.modules.find((m) => m.id === inst.id)?.params.lane ?? 1)
    if (!host) return `${lane}|`
    const list = partNames(host.text ?? '')
    return `${lane}|${list[lane - 1] ?? (list.length ? `only ${list.length} part${list.length === 1 ? '' : 's'}` : 'no piece')}`
  })
  const [lane, name] = text.split('|')
  return (
    <div
      style={{
        position: 'absolute',
        left: x * PX,
        top: y * PX,
        width: w * PX,
        height: h * PX,
        boxSizing: 'border-box',
        padding: '0.3em 0.5em',
        borderRadius: 3,
        background: '#0e1012',
        color: name ? '#d9e6c8' : '#6a6d75',
        font: `${Math.max(8, 2.2 * PX)}px/1.3 Bahnschrift, 'Arial Narrow', sans-serif`,
        overflow: 'hidden',
      }}
    >
      <div style={{ opacity: 0.6 }}>PART {lane}</div>
      <div style={{ fontWeight: 700, wordBreak: 'break-all' }}>{name || 'not linked'}</div>
    </div>
  )
}
