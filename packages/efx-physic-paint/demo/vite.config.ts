import { defineConfig } from 'vite'
import preact from '@preact/preset-vite'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  plugins: [preact()],
  resolve: {
    alias: {
      '@efxlab/efx-paint-host/animation': fileURLToPath(new URL('../../efx-paint-host/src/animation/index.ts', import.meta.url)),
      '@efxlab/efx-paint-host': fileURLToPath(new URL('../../efx-paint-host/src/index.ts', import.meta.url)),
      '@efxlab/efx-physic-paint/preact': fileURLToPath(new URL('../src/preact.tsx', import.meta.url)),
    },
  },
})
