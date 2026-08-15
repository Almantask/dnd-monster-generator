import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

/** Load gitignored `.env` if present. Existing process env wins (Cloud Run, shell). */
export function loadLocalEnv(cwd = process.cwd()) {
  const path = resolve(cwd, '.env')
  if (existsSync(path)) process.loadEnvFile(path)
}

loadLocalEnv()
