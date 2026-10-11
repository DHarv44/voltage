import { useState } from 'react'
import { buffers } from '../../audio/buffers'
import { loadMidiFile, loadScalaFile } from '../../audio/fileLoaders'
import type { PanelStyle } from '../../modules/types'
import { BUTTON } from '../../modules/panelMetrics'

interface Props {
  mod: string
  slot: number
  x: number
  y: number
  label: string
  accept?: 'audio' | 'midi' | 'scl'
  panel: PanelStyle
}

const KINDS = {
  audio: { accept: 'audio/*', what: 'an audio file (WAV, MP3, OGG, FLAC…)' },
  midi: { accept: '.mid,.midi,audio/midi', what: 'a MIDI file (.mid)' },
  scl: { accept: '.scl,text/plain', what: 'a Scala tuning (.scl)' },
}

/** Push button that opens the file picker and loads the chosen file into the
 *  module: audio into a buffer slot (whatever the browser decodes), a MIDI
 *  file's notes, or a Scala tuning. The file never leaves your machine. */
export function FileButton({ mod, slot, x, y, label, accept = 'audio', panel }: Props) {
  const [busy, setBusy] = useState(false)
  const kind = KINDS[accept]

  const pick = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = kind.accept
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) return
      setBusy(true)
      const err =
        accept === 'midi' ? await loadMidiFile(mod, slot, file) : accept === 'scl' ? await loadScalaFile(mod, file) : await buffers.loadFile(mod, slot, file)
      setBusy(false)
      if (err) alert(err)
    }
    input.click()
  }

  return (
    <g
      className="pushbutton"
      transform={`translate(${x} ${y})`}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation()
        pick()
      }}
    >
      <title>{`${label}: load ${kind.what} from your computer; it stays on your machine`}</title>
      <circle r={BUTTON.r} fill="url(#jack-nut)" stroke="#5a5d61" strokeWidth={0.15} />
      <circle r={3} fill={busy ? '#6a5a2a' : '#3c3c3c'} stroke="#000" strokeWidth={0.2} />
      <path d="M -1.3 0.6 L 0 -1 L 1.3 0.6 M 0 -1 L 0 1.4" stroke="#ddd" strokeWidth={0.45} fill="none" strokeLinecap="round" />
      <text className="silk" y={BUTTON.labelY} fill={panel.fg} fontSize={BUTTON.labelSize}>
        {busy ? '…' : label}
      </text>
    </g>
  )
}
