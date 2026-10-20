import { useMemo, useSyncExternalStore } from 'react'
import { MAX_TEXT } from '../../patch/persist'
import { actions, patchStore } from '../../patch/store'
import { runStrudel } from '../../strudel/run'
import { PX } from '../geometry'
import type { SurfaceProps } from './common'

/** STRUDEL's panel: the code, live (it runs as you type; a broken edit keeps
 *  the last good version playing), with what we make of it underneath. */
export function Strudel({ inst, x, y, w, h }: SurfaceProps) {
  const text = useSyncExternalStore(patchStore.subscribe, () => patchStore.get().modules.find((m) => m.id === inst.id)?.text ?? '')
  const status = useMemo(() => {
    if (!text.trim()) return { err: '', ok: 'Paste Strudel code here, or build a rack from Explore ▸ From Strudel.' }
    const r = runStrudel(text)
    if (r.error) return { err: r.error, ok: '' }
    const lanes = r.pattern.layers?.length ?? 1
    const parts = [`${lanes} lane${lanes === 1 ? '' : 's'}`, r.pattern.cycles ? `${r.pattern.cycles} cycles` : 'endless', `${(r.cps * 60).toFixed(1)} cpm`]
    if (r.warnings.length) parts.push(r.warnings.join(' · '))
    return { err: '', ok: parts.join(' · ') }
  }, [text])
  const font = Math.max(9, 2.2 * PX)
  return (
    <div style={{ position: 'absolute', left: x * PX, top: y * PX, width: w * PX, height: h * PX, display: 'flex', flexDirection: 'column', gap: 2 }}>
      <textarea
        className="strudel-code"
        value={text}
        maxLength={MAX_TEXT}
        spellCheck={false}
        placeholder={'setcpm(120/4)\nstack(\n  s("bd*4, [~ sd]*2, hh*8"),\n  note("<c2 eb2 f2 g2>*4").s("sawtooth").lpf(800)\n)'}
        onChange={(e) => actions.setText(inst.id, e.target.value)}
        onPointerDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
        onWheel={(e) => e.stopPropagation()}
        style={{
          flex: 1,
          minHeight: 0,
          boxSizing: 'border-box',
          resize: 'none',
          border: 'none',
          borderRadius: 3,
          padding: '0.5em 0.7em',
          background: '#0e1012',
          color: '#d9e6c8',
          font: `${font}px/1.4 Consolas, 'Cascadia Mono', 'Courier New', monospace`,
          outline: 'none',
          whiteSpace: 'pre',
          overflow: 'auto',
        }}
      />
      <div
        style={{
          flex: 'none',
          padding: '2px 6px',
          borderRadius: 3,
          background: status.err ? '#3a1a18' : '#141618',
          color: status.err ? '#ff8a7a' : '#9aa89a',
          font: `${Math.max(8, 1.9 * PX)}px/1.3 Bahnschrift, 'Arial Narrow', sans-serif`,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
        title={status.err || status.ok}
      >
        {status.err || status.ok}
      </div>
    </div>
  )
}
