import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { ShaderChunk } from 'three'
import { describe, expect, it } from 'vitest'
import { DICE_PATCH_EDITS, patchTtrpgDiceThrow } from '../../vite.patchTtrpgDiceThrow.ts'

const library = readFileSync(
  fileURLToPath(new URL('../../node_modules/react-ttrpg-dice/dist/index.js', import.meta.url)),
  'utf8',
)

type Vec3 = [number, number, number]

function editReplacement(name: string): string {
  const edit = DICE_PATCH_EDITS.find((candidate) => candidate.name === name)
  if (!edit) throw new Error(`no patch edit named "${name}"`)
  return edit.replace
}

/**
 * Evaluates the throw helpers straight out of the patch so the numbers that
 * decide how a roll looks are testable without booting WebGL and Rapier.
 */
function loadThrowHelpers() {
  const source = [
    editReplacement('calculateThrowVelocity'),
    editReplacement('calculateSpawnPositions'),
    'return { calculateThrowVelocity, calculateSpawnPositions };',
  ].join('\n')
  return new Function(source)() as {
    calculateThrowVelocity: (spawnPosition: Vec3) => { linear: Vec3; angular: Vec3 }
    calculateSpawnPositions: (
      count: number,
      halfX: number,
      halfZ: number,
    ) => Array<{ position: Vec3; rotation: Vec3 }>
  }
}

describe('patchTtrpgDiceThrow', () => {
  it('applies every edit to the installed library', () => {
    expect(() => patchTtrpgDiceThrow(library)).not.toThrow()
  })

  it('replaces the drop-from-above throw with an aimed sideways toss', () => {
    const patched = patchTtrpgDiceThrow(library)
    expect(patched).toContain('rb.setLinvel({')
    expect(patched).not.toContain('-s * 1.2')
    expect(patched).toContain('const MAX_LIN_SPEED = 22.0;')
    expect(patched).toContain('const MAX_ANG_SPEED = 34.0;')
    expect(patched).toContain('timeStep: 1 / 120,')
  })

  it('decodes face textures as sRGB and drops the log depth buffer', () => {
    const patched = patchTtrpgDiceThrow(library)
    expect(patched).toContain('material.defines.DECODE_VIDEO_TEXTURE = ')
    expect(patched).toContain('material.defines.DECODE_VIDEO_TEXTURE_EMISSIVE = ')
    expect(patched).not.toContain('logarithmicDepthBuffer')
  })

  // The sRGB fix switches on three.js's inline video-texture decode. That only
  // exists at runtime, so a three upgrade that drops it would silently bring
  // the washed-out dice back without failing the build.
  it('relies on shader decode switches that three.js still ships', () => {
    expect(ShaderChunk.map_fragment).toContain('#ifdef DECODE_VIDEO_TEXTURE\n')
    expect(ShaderChunk.map_fragment).toContain('sRGBTransferEOTF( sampledDiffuseColor )')
    expect(ShaderChunk.emissivemap_fragment).toContain('#ifdef DECODE_VIDEO_TEXTURE_EMISSIVE')
    expect(ShaderChunk.emissivemap_fragment).toContain('sRGBTransferEOTF( emissiveColor )')
  })

  it('leaves already-patched source alone', () => {
    const patched = patchTtrpgDiceThrow(library)
    expect(patchTtrpgDiceThrow(patched)).toBe(patched)
  })

  it('names the edits that no longer match when the library moves', () => {
    // Value-only edits tolerate a retuned number, so simulate a real refactor.
    const drifted = library
      .replace('const MAX_LIN_SPEED = 7.0;', 'const MAX_LINEAR_SPEED = 7.0;')
      .replace('gl.toneMappingExposure = 1.0;', 'gl.toneMappingExposure = exposure;')
    expect(() => patchTtrpgDiceThrow(drifted)).toThrow(
      /2 edit\(s\).*MAX_LIN_SPEED, tone mapping exposure/,
    )
  })
})

describe('dice throw geometry', () => {
  const { calculateThrowVelocity, calculateSpawnPositions } = loadThrowHelpers()

  // Half-extents of the walls. The tray is as wide as the viewport and as deep
  // as it is tall, so a letterboxed desktop and a tall phone are the extremes.
  const trays = [
    { name: 'landscape', halfX: 16, halfZ: 4.5 },
    { name: 'portrait', halfX: 3, halfZ: 9 },
    { name: 'square', halfX: 6, halfZ: 6 },
  ]

  /** Largest die's circumradius — a spawned hull must not overlap a wall. */
  const DIE_RADIUS = 0.7

  for (const tray of trays) {
    it(`spawns every die a die-width clear of the walls in a ${tray.name} tray`, () => {
      for (let attempt = 0; attempt < 200; attempt++) {
        for (const die of calculateSpawnPositions(20, tray.halfX, tray.halfZ)) {
          const [x, y, z] = die.position
          expect(Math.abs(x)).toBeLessThanOrEqual(tray.halfX - DIE_RADIUS)
          expect(Math.abs(z)).toBeLessThanOrEqual(tray.halfZ - DIE_RADIUS)
          expect(y).toBeGreaterThan(DIE_RADIUS) // clear of the floor at any rotation
        }
      }
    })

    // Overlapping hulls are pushed apart on the first physics step hard enough
    // to fling the whole handful into a wall.
    it(`never spawns two dice on top of each other in a ${tray.name} tray`, () => {
      for (let attempt = 0; attempt < 200; attempt++) {
        const dice = calculateSpawnPositions(20, tray.halfX, tray.halfZ).map((d) => d.position)
        for (let a = 0; a < dice.length; a++) {
          for (let b = a + 1; b < dice.length; b++) {
            const gap = Math.hypot(
              dice[a][0] - dice[b][0],
              dice[a][1] - dice[b][1],
              dice[a][2] - dice[b][2],
            )
            expect(gap).toBeGreaterThan(0.6) // a d6 is 0.6 across
          }
        }
      }
    })

    it(`throws every die toward the middle of a ${tray.name} tray`, () => {
      for (let attempt = 0; attempt < 50; attempt++) {
        for (const { position } of calculateSpawnPositions(8, tray.halfX, tray.halfZ)) {
          const { linear } = calculateThrowVelocity(position)
          const towardCentre = -(linear[0] * position[0] + linear[2] * position[2])
          expect(towardCentre).toBeGreaterThan(0)
          expect(linear[1]).toBeGreaterThan(0) // tossed, not dropped
        }
      }
    })
  }

  it('gives the same throw for the same spawn, so StrictMode re-runs cannot desync it', () => {
    const spawn: Vec3 = [4, 3, -2]
    const headings = Array.from({ length: 50 }, () => {
      const { linear } = calculateThrowVelocity(spawn)
      return Math.atan2(linear[2], linear[0])
    })
    const toCentre = Math.atan2(-spawn[2], -spawn[0])
    // Only the sideways fan varies: ±1 against ≥4.4 of forward speed.
    for (const heading of headings) {
      expect(Math.abs(heading - toCentre)).toBeLessThan(0.3)
    }
  })

  it('spins every throw at 6–12 rad/s about a mostly horizontal axis', () => {
    for (let attempt = 0; attempt < 500; attempt++) {
      const { angular } = calculateThrowVelocity([5, 3, 0])
      const rate = Math.hypot(...angular)
      expect(rate).toBeGreaterThanOrEqual(6)
      expect(rate).toBeLessThanOrEqual(12) // well under MAX_ANG_SPEED, so never clipped
      // A die spinning about its own vertical axis reads as a top, not a throw.
      expect(Math.abs(angular[1]) / rate).toBeLessThanOrEqual(0.55)
    }
  })
})
