import * as THREE from 'three'

const BLADES = 1600

/** The meadow the flowers grow in, built to read as 3D: a lawn of real grass
 *  blades (among the flowers too) that sway with the wind, a low dusk sun
 *  that casts soft shadows across it, and haze with distance. */
export function gardenGround(scene: THREE.Scene, ground: number, span: number, rnd: () => number): { sway(wind: number, t: number): void } {
  scene.fog = new THREE.Fog(0xc294a2, 3.2, 9) // the horizon's dusky rose

  const sun = new THREE.DirectionalLight(0xffd2a0, 1.9)
  sun.position.set(-2.2, 1.4, 1.6)
  sun.target.position.set(0, ground, 0.1)
  sun.castShadow = true
  sun.shadow.mapSize.set(1024, 1024)
  sun.shadow.bias = -0.0008
  sun.shadow.normalBias = 0.01
  sun.shadow.radius = 3
  const sc = sun.shadow.camera
  sc.left = -span * 0.6
  sc.right = span * 0.6
  sc.top = 1.6
  sc.bottom = -1.6
  sc.near = 0.5
  sc.far = 7
  scene.add(sun, sun.target)
  scene.add(new THREE.HemisphereLight(0xc9c0ff, 0x3a2a1a, 1.3))

  const lawn = new THREE.Mesh(new THREE.PlaneGeometry(span * 4, 9), new THREE.MeshStandardMaterial({ color: 0x35602a, roughness: 1 }))
  lawn.rotation.x = -Math.PI / 2
  lawn.position.set(0, ground, -1.5)
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
    // everywhere, among the flowers too, thinning into the distance (where
    // the haze takes over)
    const x = (rnd() - 0.5) * span * 1.6
    const z = 1.3 - rnd() ** 1.3 * 4.5
    v.set(x, ground, z)
    q.setFromEuler(e.set((rnd() - 0.5) * 0.3, rnd() * Math.PI, (rnd() - 0.5) * 0.3))
    const h = 0.05 + rnd() * 0.09
    sz.set(0.8 + rnd() * 0.8, h, 1)
    grass.setMatrixAt(i, m.compose(v, q, sz))
    grass.setColorAt(i, tint.setRGB(0.25 + rnd() * 0.15, 0.45 + rnd() * 0.2, 0.18 + rnd() * 0.08))
  }
  grass.receiveShadow = true
  scene.add(grass)

  return {
    sway(wind, t) {
      uWind.value = wind
      uT.value = t
    },
  }
}
