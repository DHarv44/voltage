/** Strudel's own engine, loaded at runtime from a CDN for the A/B bench
 *  (dev only; nothing of it is bundled or shipped). Renders a snippet
 *  offline the way strudel.cc's "render" does, and hands back the audio. */

const BUNDLE = 'https://unpkg.com/@strudel/web@1.3.0/dist/index.mjs'
const SOUNDFONTS = 'https://unpkg.com/@strudel/soundfonts@1.2.6/dist/index.mjs'
const CDN = 'https://strudel.b-cdn.net'

/* eslint-disable @typescript-eslint/no-explicit-any */
type StrudelModule = Record<string, any>

let loading: Promise<StrudelModule> | null = null
export const strudelLog: string[] = []

/** The bundle, initialised once: synths, the drum machines and their aliases, the wavetables. */
export function loadStrudel(): Promise<StrudelModule> {
  return (loading ??= (async () => {
    const m: StrudelModule = await import(/* @vite-ignore */ BUNDLE)
    await m.initStrudel({
      prebake: async () => {
        await Promise.all([
          m.samples(`${CDN}/tidal-drum-machines.json`, `${CDN}/tidal-drum-machines/machines/`, { prebake: true, tag: 'drum-machines' }),
          m.samples(`${CDN}/uzu-wavetables.json`, `${CDN}/uzu-wavetables/`, { prebake: true }),
          m.samples(`${CDN}/piano.json`, `${CDN}/piano/`, { prebake: true }),
        ])
        await m.aliasBank(`${CDN}/tidal-drum-machines-alias.json`)
        try {
          await loadSoundfonts(m)
          strudelLog.push('soundfonts: loaded')
        } catch (e) {
          strudelLog.push(`soundfonts: ${(e as Error).message}`)
        }
      },
    })
    return m
  })())
}

/** The GM instruments come from @strudel/soundfonts, a separate bundle
 *  that imports `@strudel/core` and `@strudel/webaudio` as bare names. They
 *  must resolve to the very module we already loaded (its sound registry),
 *  so the bundle's text is fetched and those imports pointed at a blob that
 *  re-exports the loaded module; `sfumato` (the SF2 player) comes from unpkg. */
async function loadSoundfonts(m: StrudelModule): Promise<void> {
  const pkg = await (await fetch(SOUNDFONTS.replace(/dist\/index\.mjs$/, 'package.json'))).json()
  // esm.sh serves a package as an ES module with its CommonJS named exports kept (sfumato imports soundfont2 by name)
  const esm = (name: string, range: string) => `https://esm.sh/${name}@${String(range).replace(/^[\^~]/, '') || 'latest'}?bundle`
  const sfumato = esm('sfumato', pkg.dependencies?.sfumato)
  const w = window as unknown as Record<string, unknown>
  w.__strudelWeb = m
  const names = Object.keys(m).filter((k) => /^[A-Za-z_$][\w$]*$/.test(k) && k !== 'default')
  const shim = URL.createObjectURL(new Blob([`const __w = window.__strudelWeb;\n${names.map((n) => `export const ${n} = __w[${JSON.stringify(n)}];`).join('\n')}\n`], { type: 'text/javascript' }))
  let src = await (await fetch(SOUNDFONTS)).text()
  let n = 0
  src = src
    .replace(/from\s*(["'])@strudel\/(core|webaudio)\1/g, `from "${shim}"`)
    // anything else bare (sfumato, soundfont2 …) from jsdelivr at the version the package asks
    // for; those builds may only have a default export, so named imports become a destructure
    .replace(/import\s*\{([^}]+)\}\s*from\s*(["'])(?![./]|https?:|blob:)([^"']+)\2;?/g, (_, names: string, _q, name: string) => {
      const ns = `__dep${n++}`
      const url = name === 'sfumato' ? sfumato : esm(name, pkg.dependencies?.[name] ?? 'latest')
      return `import * as ${ns} from "${url}"; const {${names.replace(/\s+as\s+/g, ': ')}} = (${ns}.default && typeof ${ns}.default === 'object' ? { ...${ns}, ...${ns}.default } : ${ns});`
    })
  const sf: StrudelModule = await import(/* @vite-ignore */ URL.createObjectURL(new Blob([src], { type: 'text/javascript' })))
  await sf.registerSoundfonts()
}

/** The pattern a piece of code makes (no playback). */
async function patternOf(m: StrudelModule, code: string): Promise<any> {
  const r = await m.evaluate(code, false)
  const pat = r?.pattern ?? r
  if (!pat || typeof pat.queryArc !== 'function') throw new Error('no pattern from evaluate')
  return pat
}

/** Render `cycles` of the code at `cps` through superdough into an offline
 *  context (as renderPatternAudio does, without the download): mono audio. */
export async function renderStrudel(code: string, cps: number, cycles: number, rate = 48000): Promise<{ data: Float32Array; rate: number }> {
  const m = await loadStrudel()
  const pat = await patternOf(m, code)
  const live = m.getAudioContext()
  const seconds = cycles / cps
  const ctx = new OfflineAudioContext(2, Math.round(seconds * rate), rate)
  m.setAudioContext(ctx)
  m.setSuperdoughAudioController(null)
  await m.initAudio({})
  try {
    const haps = pat.queryArc(0, cycles, { _cps: cps }).sort((a: any, b: any) => a.whole.begin.valueOf() - b.whole.begin.valueOf())
    for (const hap of haps) {
      if (!hap.hasOnset()) continue
      hap.ensureObjectValue()
      const t = hap.whole.begin.valueOf() / cps
      try {
        await m.superdough(hap.value, t, hap.duration / cps, cps, t)
      } catch (e) {
        strudelLog.push(`${code}: ${(e as Error).message}`)
      }
    }
    const buf = await ctx.startRendering()
    const l = buf.getChannelData(0)
    const r = buf.numberOfChannels > 1 ? buf.getChannelData(1) : l
    const data = new Float32Array(l.length)
    for (let i = 0; i < l.length; i++) data[i] = (l[i] + r[i]) / 2
    return { data, rate }
  } finally {
    m.setSuperdoughAudioController(null)
    m.resetGlobalEffects()
    // back to a live context so the next render (or a play) has one
    m.setAudioContext(live && live.state !== 'closed' ? live : new AudioContext())
  }
}
