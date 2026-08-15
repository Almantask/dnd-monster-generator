/// <reference types="vitest/config" />
import { readFile } from 'node:fs/promises'
import { fileURLToPath, URL } from 'node:url'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { patchTtrpgDiceThrow } from './vite.patchTtrpgDiceThrow.ts'

function strongerDiceThrowPlugin(): Plugin {
  return {
    name: 'stronger-dice-throw',
    enforce: 'pre',
    transform(code, id) {
      const normalized = id.replaceAll('\\', '/')
      if (!normalized.includes('react-ttrpg-dice')) return
      const patched = patchTtrpgDiceThrow(code)
      if (patched === code) return
      return { code: patched, map: null }
    },
  }
}

export default defineConfig({
  base: process.env.VITE_BASE_PATH ?? '/',
  plugins: [strongerDiceThrowPlugin(), react(), tailwindcss()],
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
    esbuildOptions: {
      plugins: [
        {
          name: 'stronger-dice-throw',
          setup(build) {
            build.onLoad(
              { filter: /react-ttrpg-dice[/\\]dist[/\\]index\.js$/ },
              async (args) => {
                const source = await readFile(args.path, 'utf8')
                return { contents: patchTtrpgDiceThrow(source), loader: 'js' }
              },
            )
          },
        },
      ],
    },
  },
  test: {
    environment: 'node',
    setupFiles: ['./src/test/setup.ts'],
  },
})
