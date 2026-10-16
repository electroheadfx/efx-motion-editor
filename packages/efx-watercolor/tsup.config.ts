import { defineConfig } from 'tsup'

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    papers: 'src/papers/index.ts',
    brushes: 'src/brushes/index.ts',
    payload: 'src/payload/index.ts',
    bake: 'src/bake/index.ts',
  },
  format: ['esm'],
  dts: true,
  clean: true,
  sourcemap: true,
  tsconfig: 'tsconfig.build.json',
  outExtension: () => ({ js: '.mjs' }),
})
