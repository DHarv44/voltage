import { useState } from 'react'
import { engine } from '../audio/engine'
import { rackName } from '../patch/rackName'
import { Kit } from '../patch/starters/kit'
import { actions, patchStore } from '../patch/store'
import { buildStrudelRack, decodeStrudelInput, type StrudelReport } from '../strudel/importer'
import { toast } from './Toast'

/** Explore ▸ From Strudel: paste code from strudel.cc (or a share link) and
 *  get a rack that plays it: STRUDEL running the code, our drums and voices
 *  on its lanes, a console with a plate, OUT. */
export function StrudelImport({ onDone }: { onDone: () => void }) {
  const [text, setText] = useState('')
  const [report, setReport] = useState<StrudelReport | null>(null)

  const go = () => {
    const code = decodeStrudelInput(text)
    const k = new Kit(patchStore.get().rail ?? 104)
    const r = buildStrudelRack(k, code)
    setReport(r)
    if (r.error) return
    actions.load(k.build())
    rackName.set('Strudel import')
    const power = engine.getStatus().power ? '' : ' Switch POWER on to hear it.'
    toast.show('Strudel', `Built a rack for the code.${power} (Ctrl+Z brings your rack back.)`)
    onDone()
  }

  return (
    <div className="cloud-list strudel-import">
      <div className="preset-group">Paste Strudel code, or a strudel.cc share link</div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        spellCheck={false}
        placeholder={'setcpm(120/4)\nstack(\n  s("bd*4, [~ sd]*2, hh*8").bank("tr909"),\n  note("<c2 eb2 f2 g2>*4").s("sawtooth").lpf(800)\n)'}
        onKeyDown={(e) => e.stopPropagation()}
      />
      <div className="strudel-actions">
        <button className="preset-item" onClick={go} disabled={!text.trim()}>
          <span className="preset-name">Build a rack for it</span>
          <span className="preset-desc">Replaces your rack (Ctrl+Z brings it back)</span>
        </button>
      </div>
      {report && (
        <div className="strudel-report">
          {report.error && <div className="strudel-error">{report.error}</div>}
          {report.lines.map((l) => (
            <div key={l}>{l}</div>
          ))}
          {report.warnings.map((w) => (
            <div key={w} className="strudel-warn">
              {w}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
