import * as THREE from 'three'

const BLADES = 7000
/** The grass field: its front edge (just in front of the nearest camera),
 *  and how far back it runs (the haze has it by then). */
const FRONT = 1.3
const FIELD_DEPTH = 18

/** The meadow the garden grows in, built to read as 3D: a lawn running off
 *  into the haze, with real grass blades (among the flowers too) that sway
 *  with the wind. (The light and haze are the sky's: see sky.ts.) */
export function gardenGround(scene: THREE.Scene, ground: number, span: number, rnd: () => number): { sway(wind: number, t: number): void } {
  const lawn = new THREE.Mesh(new THREE.PlaneGeometry(span * 8, 40), new THREE.MeshStandardMaterial({ color: 0x3d6b2c, roughness: 1 })) // the grass's own average, so gaps don't show
  lawn.rotation.x = -Math.PI / 2
  lawn.position.set(0, ground, -12)
  lawn.receiveShadow = true
  scene.add(lawn)

  // grass: thin tapered blades, bending with the wind (in the vertex shader,
  // more toward the tip)
  const blade = new THREE.BufferGeometry()
  // a blade 1 tall (scaled per instance), a few mm wide, curving a little
  blade.setAttribute(
    'position',
    new THREE.Float32BufferAttribute([-0.006, 0, 0, 0.006, 0, 0, -0.004, 0.5, 0.02, 0.004, 0.5, 0.02, 0, 1, 0.07], 3),
  )
  blade.setIndex([0, 1, 2, 1, 3, 2, 2, 3, 4])
  blade.computeVertexNormals()
  const uWind = { value: 0 }
  const uT = { value: 0 }
  const grassMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, side: THREE.DoubleSide })
  // bend after placing the blade, so every blade leans the way the wind blows
  grassMat.onBeforeCompile = (s) => {
    s.uniforms.uWind = uWind
    s.uniforms.uT = uT
    s.vertexShader = s.vertexShader.replace('#include <common>', '#include <common>\nuniform float uWind; uniform float uT;').replace(
      '#include <project_vertex>',
      `vec4 mvPosition = instanceMatrix * vec4(transformed, 1.0);
      float bladeH = length(instanceMatrix[1].xyz);
      float ph = instanceMatrix[3].x * 3.0 + instanceMatrix[3].z * 5.0;
      mvPosition.x += (uWind * 0.35 + sin(uT * 1.7 + ph) * 0.08) * bladeH * position.y * position.y;
      mvPosition = modelViewMatrix * mvPosition;
      gl_Position = projectionMatrix * mvPosition;`,
    )
  }
  const grass = new THREE.InstancedMesh(blade, grassMat, BLADES)
  const m = new THREE.Matrix4()
  const q = new THREE.Quaternion()
  const e = new THREE.Euler()
  const v = new THREE.Vector3()
  const sz = new THREE.Vector3()
  const tint = new THREE.Color()
  for (let i = 0; i < BLADES; i++) {
    // The whole lawn the camera can see, however far it pulls back: densest
    // up front among the flowers, the field widening with distance as the
    // view does. Further back the blades are fewer but grow into bigger
    // clumps, so the cover reads as unbroken grass right into the haze.
    const d = FIELD_DEPTH * rnd() ** 1.6 // distance back from the front edge
    const half = span * 0.8 + d * 0.75
    v.set((rnd() - 0.5) * 2 * half, ground, FRONT - d)
    q.setFromEuler(e.set((rnd() - 0.5) * 0.3, rnd() * Math.PI, (rnd() - 0.5) * 0.3))
    const clump = 1 + d * 0.45
    const h = (0.05 + rnd() * 0.09) * (1 + d * 0.06)
    sz.set((0.8 + rnd() * 0.8) * clump, h, 1)
    grass.setMatrixAt(i, m.compose(v, q, sz))
    grass.setColorAt(i, tint.setRGB(0.25 + rnd() * 0.15, 0.45 + rnd() * 0.2, 0.18 + rnd() * 0.08))
  }
  grass.receiveShadow = true
  grass.frustumCulled = false // spans the whole field, not one blade's bounds
  scene.add(grass)

  return {
    sway(wind, t) {
      uWind.value = wind
      uT.value = t
    },
  }
}
