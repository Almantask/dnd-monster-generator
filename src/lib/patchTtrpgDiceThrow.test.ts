import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { patchTtrpgDiceThrow } from '../../vite.patchTtrpgDiceThrow.ts'

describe('patchTtrpgDiceThrow', () => {
  const library = readFileSync(
    fileURLToPath(new URL('../../node_modules/react-ttrpg-dice/dist/index.js', import.meta.url)),
    'utf8',
  )

  it('replaces the drop-from-above impulse with a sideways toss', () => {
    const patched = patchTtrpgDiceThrow(library)
    expect(patched).toContain('_throwAim')
    expect(patched).not.toContain('-s * 1.2')
    expect(patched).not.toContain('s * 0.3')
    expect(patched).toContain('const MAX_LIN_SPEED = 14.0;')
    expect(patched).toContain('const MAX_ANG_SPEED = 30.0;')
  })
})
