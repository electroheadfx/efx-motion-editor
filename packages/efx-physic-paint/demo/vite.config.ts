import { defineConfig } from 'vite'
import preact from '@preact/preset-vite'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  plugins: [preact()],
  resolve: {
    alias: {
      '@efxlab/efx-physic-paint/preact': fileURLToPath(new URL('../src/preact.tsx', import.meta.url)),
    },
  },
})
