import { jackInfo, SIGNALS } from '../../modules/jackInfo'
import { formatParam } from '../../modules/params'
import { paramInfo } from '../../modules/paramInfo'
import type { ModuleSpec } from '../../modules/types'
import type { Patch } from '../../patch/types'

/** Every knob and switch on the panel with its value and what it does, then
 *  every jack with what it carries and whether it's patched: the panel's
 *  tooltips, all in one readable list. */
export function InspectorDetails({ spec, params, id, patch }: { spec: ModuleSpec; params: Record<string, number>; id: string; patch: Patch }) {
  const seen = new Set<string>()
  const controls = spec.controls.flatMap((c) => {
    if ((c.kind !== 'knob' && c.kind !== 'switch') || seen.has(c.param)) return []
    seen.add(c.param)
    const ps = spec.params.find((p) => p.id === c.param)
    if (!ps) return []
    const label = (c.kind === 'knob' && c.label) || ps.label
    return [{ id: ps.id, label, value: formatParam(ps, params[ps.id] ?? ps.def), what: paramInfo(spec, ps, c.kind === 'knob' ? c.label : undefined) }]
  })
  const plugged = (jack: string, dir: 'in' | 'out') => patch.cables.filter((c) => (dir === 'in' ? c.to : c.from).mod === id && (dir === 'in' ? c.to : c.from).jack === jack).length

  const jacks = (dir: 'in' | 'out') =>
    (dir === 'in' ? spec.inputs : spec.outputs).map((j) => {
      const info = jackInfo(spec, j.id, dir)
      const n = plugged(j.id, dir)
      return (
        <div key={`${dir}:${j.id}`} className="insp-item">
          <div className="insp-line">
            <b>{info.label}</b>
            <span className={`insp-signal sig-${info.signal}`}>{SIGNALS[info.signal].name}</span>
            {n > 0 && <span className="insp-plugged">{dir === 'out' && n > 1 ? `${n} cables` : 'patched'}</span>}
          </div>
          <p>{info.what}</p>
        </div>
      )
    })

  return (
    <>
      {controls.length > 0 && (
        <section className="insp-section">
          <h4>Knobs and switches</h4>
          {controls.map((c) => (
            <div key={c.id} className="insp-item">
              <div className="insp-line">
                <b>{c.label}</b>
                <span className="insp-value">{c.value}</span>
              </div>
              {c.what && <p>{c.what}</p>}
            </div>
          ))}
        </section>
      )}
      {spec.inputs.length > 0 && (
        <section className="insp-section">
          <h4>Inputs</h4>
          {jacks('in')}
        </section>
      )}
      {spec.outputs.length > 0 && (
        <section className="insp-section">
          <h4>Outputs</h4>
          {jacks('out')}
        </section>
      )}
    </>
  )
}
