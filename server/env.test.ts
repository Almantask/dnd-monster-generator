import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { loadLocalEnv } from './env.ts'

const KEY = 'OPENROUTER_API_KEY'

describe('loadLocalEnv', () => {
  let dir = ''
  const previous = process.env[KEY]

  afterEach(() => {
    if (previous === undefined) delete process.env[KEY]
    else process.env[KEY] = previous
    if (dir) rmSync(dir, { recursive: true, force: true })
    dir = ''
  })

  it('loads keys from .env when the file exists', () => {
    dir = mkdtempSync(join(tmpdir(), 'bestiary-env-'))
    writeFileSync(join(dir, '.env'), `${KEY}=test-local-key\n`)
    delete process.env[KEY]
    loadLocalEnv(dir)
    expect(process.env[KEY]).toBe('test-local-key')
  })

  it('does not override an already-set variable', () => {
    dir = mkdtempSync(join(tmpdir(), 'bestiary-env-'))
    writeFileSync(join(dir, '.env'), `${KEY}=from-file\n`)
    process.env[KEY] = 'from-shell'
    loadLocalEnv(dir)
    expect(process.env[KEY]).toBe('from-shell')
  })

  it('no-ops when .env is missing', () => {
    dir = mkdtempSync(join(tmpdir(), 'bestiary-env-'))
    expect(() => loadLocalEnv(dir)).not.toThrow()
  })
})
