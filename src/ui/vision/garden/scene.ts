import * as THREE from 'three'
import {
  daylight,
  GARDEN,
  GARDEN_PLANTS,
  GARDEN_SEEDS,
  GARDEN_TREES,
  PLANT,
  PLANT_VALUES,
  SEED_VALUES,
  TREE,
  TREE_VALUES,
  treeDepth,
  treeHeight,
} from '../../../modules/specs/garden'
import { backdrop, CameraRig, disposeScene, glowPoints, rand, standardCamera, touchPoint, VIEW_H } from '../common'
import { leafGeometry, petalGeometry } from '../flowerParts'
import type { SceneFactory } from '../types'
import { BugsView } from './bugs'
import { Fluff } from './fluff'
import { gardenGround } from './ground'
import { LeafFall } from './leaves'
import { Plant, type PlantState, type PlantWorld } from './plant'
import { GARDEN_SKY, GardenSky } from './sky'
import { TreeView, treeX, type TreeState } from './tree'

const POLLEN = 160
/** CLOSE camera: seconds the focus takes to settle on a flower, and the least
 *  time a shot holds one before moving to a better bloom. */
const CLOSE_SETTLE = 2.2
const CLOSE_HOLD = 9
/** How slowly the camera pulls back for a growing tree (s). */
const REACH_EASE = 4
/** Highest a tree top may sit above the middle of the wide shot (radians:
 *  just inside the top of the 35° frame). */
const TOP_ROOM = ((17.5 * Math.PI) / 180) * 0.88

/** The WIDE camera at a given pull-back: where it stands and looks. */
function wideShot(reach: number, drift: number, pos: THREE.Vector3, at: THREE.Vector3): void {
  pos.set(drift, 0.3 + reach * 0.32, 3 + reach)
  at.set(0, -0.2 + reach * 0.3, -reach * 0.4)
}
const shotPos = new THREE.Vector3()
const shotAt = new THREE.Vector3()
const elevation = (dx: number, dy: number, dz: number) => Math.atan2(dy, Math.hypot(dx, dz))

/** How far the wide shot must pull back for a point (a tree top) to be in frame. */
function reachFor(x: number, y: number, z: number): number {
  for (let r = 0; r < 12; r += 0.1) {
    wideShot(r, 0, shotPos, shotAt)
    const look = elevation(shotAt.x - shotPos.x, shotAt.y - shotPos.y, shotAt.z - shotPos.z)
    if (elevation(x - shotPos.x, y - shotPos.y, z - shotPos.z) - look <= TOP_ROOM) return r
  }
  return 12
}

/** A garden at the edge of a meadow: flowers of several kinds living whole
 *  lives in the grass, trees growing (and dying) behind them, bees and
 *  butterflies working the flowers, all through the day and night. Everything
 *  alive is the engine's; this draws it. */
export const flowerScene: SceneFactory = (aspect, seed) => {
  const rnd = rand(seed)
  const scene = new THREE.Scene()
  const camera = standardCamera(aspect)
  camera.far = 40
  camera.updateProjectionMatrix()
  const sky = backdrop(aspect, GARDEN_SKY)
  scene.add(sky)

  const ground = -VIEW_H + 0.16
  const width = VIEW_H * aspect * 1.7
  const light = new GardenSky(scene, sky, ground, width)
  const land = gardenGround(scene, ground, width, rnd)

  const geo = {
    seg: new THREE.CylinderGeometry(1, 1, 1, 8, 1, true).translate(0, 0.5, 0),
    leaf: leafGeometry(),
    petal: petalGeometry(),
    ball: new THREE.SphereGeometry(1, 14, 10),
  }
  const plants = Array.from({ length: GARDEN_PLANTS }, () => {
    const p = new Plant(rnd, geo)
    scene.add(p.root, p.litter.group)
    return p
  })
  const heads = plants.map((p) => p.headPos)
  const fallen = new LeafFall(geo.leaf, rnd)
  scene.add(fallen.mesh)
  const wood = new THREE.CylinderGeometry(0.7, 1, 1, 7, 1, true).translate(0, 0.5, 0)
  const trees = Array.from({ length: GARDEN_TREES }, () => {
    const t = new TreeView(wood, geo.leaf, fallen, rnd)
    scene.add(t.root)
    return t
  })
  const bugs = new BugsView()
  scene.add(bugs.group)
  const fluff = new Fluff(rnd)
  scene.add(fluff.points)
  const seeds = Array.from({ length: GARDEN_SEEDS }, () => new THREE.Vector3(0, -100, 0))

  const state: PlantState = { x: 0, g: 0, open: 0, wilt: 0, fade: 0, species: 0, puff: 0, size: 1 }
  const tree: TreeState = { x: 0, g: 0, leaves: 0, autumn: 0, fall: 0, fade: 0 }
  const world: PlantWorld = { floor: ground, width, sway: 0, glow: 0, hue: 0, sunYaw: 0, light: 1, t: 0, dt: 0, px: 300 }

  const pollen = glowPoints(POLLEN, 0.016)
  pollen.renderOrder = 5
  scene.add(pollen)
  const pv = new Float32Array(POLLEN * 3)
  const life = new Float32Array(POLLEN)
  let emit = 0
  let next = 0

  const rig = new CameraRig(camera, sky)
  const hit = new THREE.Vector3()
  /** The plant CLOSE follows: the most open flower, else the tallest. */
  let star = 0
  let starAge = 0
  const score = new Float32Array(GARDEN_PLANTS)
  // CLOSE moves like a camera operator, not a lock-on: the focus point rides a
  // critically damped spring (eases out, settles, ignores sway twitches), the
  // shot holds a flower for a while before moving on, and drifts slowly round it.
  const focus = new THREE.Vector3()
  const focusV = new THREE.Vector3()
  const pull = new THREE.Vector3()
  let clock = 0
  let lastCam = -1
  /** How far the wide shots pull back to fit the tallest tree (eased), and
   *  how far they want to. */
  let reach = 0
  let wantReach = 0

  return {
    scene,
    camera,
    aim(cam, dt) {
      clock += dt
      reach += (wantReach - reach) * (1 - Math.exp(-dt / REACH_EASE))
      if (cam === 1) {
        // ANGLE: crouched at the end of the bed, eye level with the flowers
        rig.pos.set(1.9, ground + 0.35, 2.2 + reach * 0.4)
        rig.at.set(-0.1, ground + 0.4 + reach * 0.15, 0)
      } else if (cam === 2) {
        // CLOSE: in front of the best flower
        const h = plants[star].headPos
        if (lastCam !== 2) {
          focus.copy(h)
          focusV.set(0, 0, 0)
        } else {
          const w = 2 / CLOSE_SETTLE // spring rate
          pull.subVectors(h, focus).multiplyScalar(w * w).addScaledVector(focusV, -2 * w)
          focusV.addScaledVector(pull, dt)
          focus.addScaledVector(focusV, dt)
        }
        const swing = Math.sin(clock * 0.09) * 0.3 // slow orbit, ±17°
        rig.pos.set(focus.x + Math.sin(swing) * 1.2, focus.y + 0.03 + Math.sin(clock * 0.13) * 0.04, focus.z + Math.cos(swing) * 1.2)
        rig.at.set(focus.x, focus.y - 0.12, focus.z)
      } else {
        // WIDE: a little above the flowers looking across them, drifting side
        // to side so the depth reads, and pulled back (and up) far enough to
        // take in the tallest tree
        wideShot(reach, Math.sin(clock * 0.05) * 0.3, rig.pos, rig.at)
      }
      lastCam = cam
      rig.apply(cam, dt)
    },
    pick(u, v) {
      // the bed's plane: x across it, y = height above the ground (0 = ground)
      if (!touchPoint(camera, u, v, 0, hit)) return { x: -1, y: -1 }
      return { x: hit.x / width + 0.5, y: (hit.y - ground) / (2 * VIEW_H) }
    },
    update(s, dt, t, px, led) {
      sky.material.uniforms.uT.value = t
      const tod = led?.[GARDEN.tod] ?? 0.765
      light.update(tod, ground, reach)
      const day = daylight(tod)
      land.sway(s.sway, t)
      world.sway = s.sway
      world.glow = s.glow
      world.hue = s.hue
      world.sunYaw = light.sunYaw
      world.light = day
      world.t = t
      world.dt = dt
      world.px = px

      const pp = pollen.geometry.attributes.position.array as Float32Array
      const pt = pollen.geometry.attributes.tint.array as Float32Array
      plants.forEach((p, k) => {
        const b = GARDEN.plants + k * PLANT_VALUES
        state.x = led?.[b + PLANT.x] ?? 0.5
        state.g = led?.[b + PLANT.g] ?? (k === 0 ? 0.3 : 0)
        state.open = led?.[b + PLANT.open] ?? 0
        state.wilt = led?.[b + PLANT.wilt] ?? 0
        state.fade = led?.[b + PLANT.fade] ?? (k === 0 ? 1 : 0)
        state.species = led?.[b + PLANT.species] ?? 0
        state.puff = led?.[b + PLANT.puff] ?? 0
        state.size = led?.[b + PLANT.size] ?? 1
        p.update(state, world)
        if (p.released > 0) fluff.release(p.released, p.headPos)
        score[k] = state.fade * (state.open * 2 + state.g)
        // pollen from every open flower, a burst on TRIG
        if (state.fade > 0.5 && state.open > 0.2) {
          emit += dt * state.open * (0.5 + 25 * s.action)
          while (emit >= 1) {
            emit -= 1
            const i = next++ % POLLEN
            pp.set([p.headPos.x + (rnd() - 0.5) * 0.06, p.headPos.y, p.headPos.z + 0.03], i * 3)
            pv.set([(rnd() - 0.5) * 0.08, 0.04 + rnd() * 0.06, (rnd() - 0.5) * 0.04], i * 3)
            life[i] = 1
          }
        }
      })
      // Hold the shot: move to a better flower only after a while, or at once
      // when this one is going (wilted away to almost nothing).
      starAge += dt
      let best = star
      for (let k = 0; k < GARDEN_PLANTS; k++) if (score[k] > score[best]) best = k
      const leaving = score[star] < 0.25 * score[best]
      if (best !== star && (leaving || (starAge > CLOSE_HOLD && score[best] > score[star] + 0.15))) {
        star = best
        starAge = 0
      }

      // trees, and how far back the wide shots must stand to see the tallest
      let need = 0
      trees.forEach((tv, k) => {
        const b = GARDEN.trees + k * TREE_VALUES
        tree.x = led?.[b + TREE.x] ?? 0.3
        tree.g = led?.[b + TREE.g] ?? 0
        tree.leaves = led?.[b + TREE.leaves] ?? 0
        tree.autumn = led?.[b + TREE.autumn] ?? 0
        tree.fall = led?.[b + TREE.fall] ?? 0
        tree.fade = led?.[b + TREE.fade] ?? 0
        tv.update(tree, ground, width, s.sway, t)
        if (tree.fade > 0.01) {
          const tall = treeHeight(tree.x, tree.g) * Math.cos((tree.fall * Math.PI) / 2) * 1.08 // + the crown
          need = Math.max(need, reachFor(treeX(tree.x, width), ground + tall, treeDepth(tree.x)))
        }
      })
      wantReach = Math.max(0, need)
      fallen.update(dt, t, ground, s.sway)
      bugs.update(led, GARDEN.bugs, heads, width, ground, t, dt)

      seeds.forEach((v, k) => {
        const b = GARDEN.seeds + k * SEED_VALUES
        const y = led?.[b + 1] ?? -1
        v.set(((led?.[b] ?? 0) - 0.5) * width, y < 0 ? -100 : ground + y, led?.[b + 2] ?? 0)
      })
      fluff.update(dt, t, s.sway, px, 0.45 + 0.55 * day, seeds)

      for (let i = 0; i < POLLEN; i++) {
        const k = i * 3
        if (life[i] <= 0) {
          pt[k] = pt[k + 1] = pt[k + 2] = 0
          continue
        }
        life[i] -= dt / 4
        pp[k] += (pv[k] - s.sway * 0.05) * dt
        pp[k + 1] += pv[k + 1] * dt
        pp[k + 2] += pv[k + 2] * dt
        const b = Math.max(0, life[i]) * (0.4 + 0.6 * Math.sin(t * 6 + i) ** 2)
        pt[k] = b
        pt[k + 1] = b * 0.85
        pt[k + 2] = b * 0.45
      }
      pollen.geometry.attributes.position.needsUpdate = true
      pollen.geometry.attributes.tint.needsUpdate = true
      pollen.material.uniforms.uPx.value = px
    },
    dispose() {
      disposeScene(scene)
    },
  }
}
