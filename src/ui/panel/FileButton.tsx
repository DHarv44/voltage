import { useState } from 'react'
import { buffers } from '../../audio/buffers'
import type { PanelStyle } from '../../modules/types'

interface Props {
  mod: string
  slot: number
  x: number
  y: number
  label: string
  panel: PanelStyle
}

/** Push button that opens the file picker and loads the chosen audio file
 *  (WAV, MP3, OGG, FLAC… whatever the browser decodes) into a module slot.
 *  The file never leaves your machine. */
export function FileButton({ mod, slot, x, y, label, panel }: Props) {
  const [busy, setBusy] = useState(false)

  const pick = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'audio/*'
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) return
      setBusy(true)
      const err = await buffers.loadFile(mod, slot, file)
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
      <title>Load an audio file from your computer</title>
      <circle r={3.9} fill="url(#jack-nut)" stroke="#5a5d61" strokeWidth={0.15} />
      <circle r={3} fill={busy ? '#6a5a2a' : '#3c3c3c'} stroke="#000" strokeWidth={0.2} />
      <path d="M -1.3 0.6 L 0 -1 L 1.3 0.6 M 0 -1 L 0 1.4" stroke="#ddd" strokeWidth={0.45} fill="none" strokeLinecap="round" />
      <text className="silk" y={7.2} fill={panel.fg} fontSize={2}>
        {busy ? '…' : label}
      </text>
    </g>
  )
}
