/// <reference types="vitest/config" />
import { fileURLToPath, URL } from 'node:url'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { dicePatchFingerprint, patchTtrpgDiceThrow } from './vite.patchTtrpgDiceThrow.ts'

const DICE_LIBRARY = /react-ttrpg-dice[/\\]dist[/\\]index\.js(?:\?|$)/

/**
 * Applies the dice tuning to both the production build and Vite's dependency
 * pre-bundle (dev serves the library from there, skipping normal transforms).
 * The fingerprint in the name is what retires a stale pre-bundle: Vite keys
 * that cache on plugin names, so without it a tuning change needs --force.
 */
function diceThrowPatch() {
  return {
    name: `stronger-dice-throw:${dicePatchFingerprint()}`,
    transform(code: string, id: string) {
      if (!DICE_LIBRARY.test(id)) return
      return { code: patchTtrpgDiceThrow(code), map: null }
    },
  }
}

export default defineConfig({
  base: process.env.VITE_BASE_PATH ?? '/',
  plugins: [{ ...diceThrowPatch(), enforce: 'pre' } satisfies Plugin, react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@shared': fileURLToPath(new URL('./shared', import.meta.url)),
    },
  },
  server: {
    proxy: {
      '/api': 'http://localhost:8080',
    },
    warmup: {
      clientFiles: ['./src/components/dice/DicePhysics.tsx'],
    },
  },
  optimizeDeps: {
    include: [
      'react-ttrpg-dice',
      '@react-three/fiber',
      '@react-three/rapier',
      '@dimforge/rapier3d-compat',
      'three',
    ],
    rolldownOptions: {
      plugins: [diceThrowPatch()],
    },
  },
  test: {
    environment: 'node',
    setupFiles: ['./src/test/setup.ts'],
  },
})
