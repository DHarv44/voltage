import { useRef, useState } from 'react'
import { differ, measure, type Measure } from './measure'
import { renderOurs } from './ourEngine'
import { SNIPPETS, type Snippet } from './snippets'
import { Spectro } from './Spectro'
import { renderStrudel, strudelLog } from './strudelEngine'

const CPS = 0.5
const RATE = 48000

interface Row {
  snippet: Snippet
  theirs?: { data: Float32Array; m: Measure }
  ours?: { data: Float32Array; m: Measure; report: string[] }
  error?: string
}

/** Dev bench (?ab): every snippet rendered by Strudel's own engine and by
 *  ours, measured and drawn side by side, with a Play for each. Red cells
 *  are the differences worth a look. */
export function AbPage() {
  const [rows, setRows] = useState<Row[]>(SNIPPETS.map((snippet) => ({ snippet })))
  const [busy, setBusy] = useState('')
  const [sel, setSel] = useState<string>('')
  const ctx = useRef<AudioContext | null>(null)

  const play = (data: Float32Array) => {
    const ac = (ctx.current ??= new AudioContext())
    const buf = ac.createBuffer(1, data.length, RATE)
    buf.getChannelData(0).set(data)
    const src = ac.createBufferSource()
    src.buffer = buf
    src.connect(ac.destination)
    src.start()
  }

  const run = async (which: Snippet[]) => {
    for (const snippet of which) {
      setBusy(snippet.id)
      const cycles = snippet.cycles ?? 2
      const row: Row = { snippet }
      try {
        const t = await renderStrudel(snippet.code, CPS, cycles, RATE)
        row.theirs = { data: t.data, m: measure(t.data, RATE) }
      } catch (e) {
        row.error = `Strudel: ${(e as Error).message}`
      }
      const o = renderOurs(snippet.code, cycles / CPS, RATE)
      if (o.error) row.error = `${row.error ? row.error + ' · ' : ''}ours: ${o.error}`
      else row.ours = { data: o.data, m: measure(o.data, RATE), report: o.report }
      setRows((rs) => rs.map((r) => (r.snippet.id === snippet.id ? row : r)))
    }
    setBusy('')
  }

  const fmt = (m: Measure) => `${m.rms.toFixed(0)} dB · a ${(m.attack * 1000).toFixed(0)} ms · d ${m.decay.toFixed(2)} s · ${(m.bright / 1000).toFixed(1)} kHz · n ${m.noise.toFixed(2)} · ${m.hits} hits`
  const cell = (v: number) => ({ background: v > 1 ? `rgba(220,60,40,${Math.min(0.8, v / 3)})` : v > 0.5 ? 'rgba(220,160,40,0.35)' : 'transparent', padding: '2px 6px', textAlign: 'right' as const })
  const groups = [...new Set(SNIPPETS.map((s) => s.group))]
  const selected = rows.find((r) => r.snippet.id === sel)

  return (
    <div style={{ padding: 16, color: '#d9e6c8', background: '#15171a', minHeight: '100vh', font: '13px/1.4 Bahnschrift, "Arial Narrow", sans-serif' }}>
      <h2 style={{ margin: '0 0 8px' }}>Sound A/B — Strudel's engine vs ours</h2>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 10 }}>
        <button onClick={() => void run(SNIPPETS)} disabled={!!busy}>
          Run all
        </button>
        {groups.map((g) => (
          <button key={g} onClick={() => void run(SNIPPETS.filter((s) => s.group === g))} disabled={!!busy}>
            {g}
          </button>
        ))}
        <span style={{ opacity: 0.7 }}>{busy ? `rendering ${busy}…` : `${CPS * 60} cpm · ${RATE} Hz · ${strudelLog.join(' · ')}`}</span>
      </div>
      <table style={{ borderCollapse: 'collapse', width: '100%' }}>
        <thead>
          <tr style={{ opacity: 0.7, textAlign: 'left' }}>
            <th>snippet</th>
            <th>Strudel</th>
            <th>ours</th>
            <th>Δ level</th>
            <th>Δ attack</th>
            <th>Δ decay</th>
            <th>Δ bright</th>
            <th>Δ noise</th>
            <th>Σ</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const d = r.theirs && r.ours ? differ(r.theirs.m, r.ours.m) : null
            return (
              <tr key={r.snippet.id} onClick={() => setSel(r.snippet.id)} style={{ cursor: 'pointer', background: sel === r.snippet.id ? '#23272c' : 'transparent', borderTop: '1px solid #2a2d31' }}>
                <td style={{ padding: '2px 6px', whiteSpace: 'nowrap' }}>
                  <b>{r.snippet.id}</b>
                  <div style={{ opacity: 0.6, font: '11px Consolas, monospace' }}>{r.snippet.code}</div>
                  {r.error && <div style={{ color: '#ff8a7a' }}>{r.error}</div>}
                </td>
                <td style={{ padding: '2px 6px', whiteSpace: 'nowrap' }}>
                  {r.theirs && (
                    <>
                      <button onClick={(e) => (e.stopPropagation(), play(r.theirs!.data))}>▶</button> {fmt(r.theirs.m)}
                    </>
                  )}
                </td>
                <td style={{ padding: '2px 6px', whiteSpace: 'nowrap' }}>
                  {r.ours && (
                    <>
                      <button onClick={(e) => (e.stopPropagation(), play(r.ours!.data))}>▶</button> {fmt(r.ours.m)}
                    </>
                  )}
                </td>
                {d ? (
                  <>
                    <td style={cell(d.level)}>{d.level.toFixed(1)}</td>
                    <td style={cell(d.attack)}>{d.attack.toFixed(1)}</td>
                    <td style={cell(d.decay)}>{d.decay.toFixed(1)}</td>
                    <td style={cell(d.bright)}>{d.bright.toFixed(1)}</td>
                    <td style={cell(d.noise)}>{d.noise.toFixed(1)}</td>
                    <td style={cell(d.total / 2)}>
                      <b>{d.total.toFixed(1)}</b>
                    </td>
                  </>
                ) : (
                  <td colSpan={6} />
                )}
              </tr>
            )
          })}
        </tbody>
      </table>
      {selected && (selected.theirs || selected.ours) && (
        <div style={{ display: 'flex', gap: 16, marginTop: 14, alignItems: 'flex-start' }}>
          <div>
            <div style={{ opacity: 0.7 }}>Strudel</div>
            {selected.theirs ? <Spectro data={selected.theirs.data} rate={RATE} width={420} height={120} /> : <div>—</div>}
          </div>
          <div>
            <div style={{ opacity: 0.7 }}>ours</div>
            {selected.ours ? <Spectro data={selected.ours.data} rate={RATE} width={420} height={120} /> : <div>—</div>}
            {selected.ours?.report.map((l) => (
              <div key={l} style={{ opacity: 0.7, font: '11px Consolas, monospace' }}>
                {l}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
