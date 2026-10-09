import * as THREE from 'three'

const UP = new THREE.Vector3(0, 1, 0)

/** Staghorn coral: branches forking up and out, as instanced cylinders.
 *  Returns the mesh and its branch tips (where the polyps feed). */
export function staghorn(rnd: () => number, color: THREE.Color, at: THREE.Vector3, size: number): { mesh: THREE.InstancedMesh; tips: THREE.Vector3[] } {
  const segs: { p: THREE.Vector3; d: THREE.Vector3; len: number; r: number }[] = []
  const tips: THREE.Vector3[] = []
  const grow = (p: THREE.Vector3, d: THREE.Vector3, len: number, r: number, depth: number) => {
    segs.push({ p, d, len, r })
    const end = p.clone().addScaledVector(d, len)
    if (depth >= 4) {
      tips.push(end)
      return
    }
    for (let k = 0; k < 2; k++) {
      const axis = new THREE.Vector3(rnd() - 0.5, 0, rnd() - 0.5).normalize()
      const nd = d.clone().applyAxisAngle(axis, 0.3 + rnd() * 0.45)
      nd.y = Math.max(0.25, nd.y) // they reach for the light
      grow(end, nd.normalize(), len * (0.7 + rnd() * 0.15), r * 0.72, depth + 1)
    }
  }
  const trunks = 3 + Math.floor(rnd() * 3)
  for (let k = 0; k < trunks; k++) {
    const a = rnd() * Math.PI * 2
    const d = new THREE.Vector3(Math.cos(a) * 0.45, 1, Math.sin(a) * 0.45).normalize()
    grow(at.clone().add(new THREE.Vector3(Math.cos(a) * 0.02, 0, Math.sin(a) * 0.02)), d, 0.09 * size, 0.012 * size, 0)
  }
  const geo = new THREE.CylinderGeometry(0.75, 1, 1, 6)
  geo.translate(0, 0.5, 0)
  const mesh = new THREE.InstancedMesh(geo, new THREE.MeshLambertMaterial({ color, emissive: color.clone(), emissiveIntensity: 0 }), segs.length)
  const m = new THREE.Matrix4()
  const q = new THREE.Quaternion()
  const s = new THREE.Vector3()
  segs.forEach((g, k) => mesh.setMatrixAt(k, m.compose(g.p, q.setFromUnitVectors(UP, g.d), s.set(g.r, g.len, g.r))))
  return { mesh, tips }
}

/** Brain coral: a squat dome folded into meandering ridges. */
export function brainCoral(rnd: () => number, color: THREE.Color, at: THREE.Vector3, size: number): THREE.Mesh {
  const geo = new THREE.SphereGeometry(1, 64, 24, 0, Math.PI * 2, 0, Math.PI / 2)
  const pos = geo.attributes.position as THREE.BufferAttribute
  const v = new THREE.Vector3()
  const seed = rnd() * 10
  for (let k = 0; k < pos.count; k++) {
    v.fromBufferAttribute(pos, k)
    const ridge = Math.sin(v.x * 14 + Math.sin(v.z * 6 + seed) * 3) * Math.sin(v.z * 14 + Math.sin(v.x * 5 - seed) * 3)
    v.multiplyScalar(1 + ridge * 0.035 * Math.min(1, v.y * 4))
    pos.setXYZ(k, v.x, v.y, v.z)
  }
  geo.computeVertexNormals()
  const mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color }))
  mesh.position.copy(at)
  mesh.scale.set(size, size * 0.62, size)
  return mesh
}

/** Sea fan: a lacy lattice standing across the current, leaning with the surge. */
export function seaFan(color: THREE.Color, at: THREE.Vector3, size: number, turn: number): { mesh: THREE.Mesh; uniforms: { uSurge: { value: number }; uT: { value: number } } } {
  const geo = new THREE.PlaneGeometry(size, size, 14, 14)
  geo.translate(0, size / 2, 0)
  const uniforms = { uSurge: { value: 0 }, uT: { value: 0 }, uColor: { value: color }, uSize: { value: size } }
  const mat = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: `
      uniform float uSurge; uniform float uT; uniform float uSize; varying vec2 vUv;
      void main(){
        vUv = uv;
        vec3 p = position;
        float h = p.y / uSize;
        p.z += (uSurge * 0.09 + sin(uT * 0.9 + p.x * 6.0) * 0.008) * h * h;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }`,
    fragmentShader: `
      uniform vec3 uColor; varying vec2 vUv;
      void main(){
        vec2 c = vec2(vUv.x - 0.5, vUv.y);
        float r = length(c * vec2(1.0, 0.95));
        if (r > 0.5 + 0.03 * sin(atan(c.x, c.y) * 9.0) || vUv.y < 0.02) discard;
        // a net of radiating ribs crossed by rings
        float ribs = abs(sin(atan(c.x, c.y + 0.05) * 22.0));
        float rings = abs(sin(r * 70.0));
        float net = max(smoothstep(0.85, 1.0, ribs), smoothstep(0.88, 1.0, rings));
        if (net < 0.35 && r > 0.06) discard;
        gl_FragColor = vec4(uColor * (0.6 + 0.6 * r), 1.0);
      }`,
    side: THREE.DoubleSide,
  })
  const mesh = new THREE.Mesh(geo, mat)
  mesh.position.copy(at)
  mesh.rotation.y = turn
  return { mesh, uniforms }
}

/** Anemone: a crown of tentacles swaying with the surge (instanced cones). */
export function anemone(rnd: () => number, color: THREE.Color, at: THREE.Vector3): { mesh: THREE.InstancedMesh; uniforms: { uSurge: { value: number }; uT: { value: number }; uShrink: { value: number } } } {
  const N = 90
  const geo = new THREE.ConeGeometry(0.007, 0.13, 5)
  geo.translate(0, 0.065, 0)
  const uniforms = { uSurge: { value: 0 }, uT: { value: 0 }, uShrink: { value: 0 }, uColor: { value: color } }
  const mat = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: `
      uniform float uSurge; uniform float uT; uniform float uShrink; varying float vH;
      void main(){
        vH = position.y / 0.13;
        vec4 p = instanceMatrix * vec4(position * vec3(1.0, 1.0 - uShrink * 0.6, 1.0), 1.0);
        p.x += (uSurge * 0.05 + sin(uT * 2.0 + p.z * 25.0 + p.x * 9.0) * 0.008) * vH * vH;
        gl_Position = projectionMatrix * modelViewMatrix * p;
      }`,
    fragmentShader: 'uniform vec3 uColor; varying float vH; void main(){ gl_FragColor = vec4(mix(uColor * 0.55, uColor * 1.3, vH), 1.0); }',
  })
  const mesh = new THREE.InstancedMesh(geo, mat, N)
  const m = new THREE.Matrix4()
  const q = new THREE.Quaternion()
  const e = new THREE.Euler()
  const p = new THREE.Vector3()
  const s = new THREE.Vector3(1, 1, 1)
  for (let k = 0; k < N; k++) {
    const a = rnd() * Math.PI * 2
    const r = Math.sqrt(rnd()) * 0.08
    p.set(at.x + Math.cos(a) * r, at.y, at.z + Math.sin(a) * r)
    // outer tentacles lean out
    e.set(Math.sin(a) * r * 7, 0, -Math.cos(a) * r * 7)
    s.setScalar(0.7 + rnd() * 0.6)
    mesh.setMatrixAt(k, m.compose(p, q.setFromEuler(e), s))
  }
  return { mesh, uniforms }
}
