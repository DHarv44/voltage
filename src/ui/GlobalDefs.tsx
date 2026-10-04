/** Shared SVG gradients referenced by every panel (url(#id) resolves document-wide). */
export function GlobalDefs() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden>
      <defs>
        <radialGradient id="knob-body" cx="40%" cy="35%" r="75%">
          <stop offset="0%" stopColor="#4a4b4f" />
          <stop offset="60%" stopColor="#1e1f22" />
          <stop offset="100%" stopColor="#0c0c0d" />
        </radialGradient>
        <radialGradient id="knob-cap" cx="40%" cy="35%" r="70%">
          <stop offset="0%" stopColor="#5a5b60" />
          <stop offset="100%" stopColor="#202124" />
        </radialGradient>
        <linearGradient id="knob-skirt" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#e6e8ea" />
          <stop offset="50%" stopColor="#9a9da1" />
          <stop offset="100%" stopColor="#d6d8db" />
        </linearGradient>
        <linearGradient id="jack-nut" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#f2f3f4" />
          <stop offset="55%" stopColor="#a4a7ab" />
          <stop offset="100%" stopColor="#d9dbdd" />
        </linearGradient>
        <radialGradient id="screw" cx="40%" cy="35%" r="70%">
          <stop offset="0%" stopColor="#f4f4f4" />
          <stop offset="100%" stopColor="#8b8e92" />
        </radialGradient>
        <radialGradient id="pad-rubber" cx="45%" cy="40%" r="80%">
          <stop offset="0%" stopColor="#56524d" />
          <stop offset="100%" stopColor="#2c2a28" />
        </radialGradient>
        <linearGradient id="panel-sheen" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#fff" stopOpacity="0.10" />
          <stop offset="50%" stopColor="#fff" stopOpacity="0" />
          <stop offset="100%" stopColor="#000" stopOpacity="0.10" />
        </linearGradient>
      </defs>
    </svg>
  )
}
