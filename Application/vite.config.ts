import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import tailwindcss from '@tailwindcss/vite';
import motionCanvas from '@efxlab/motion-canvas-vite-plugin';

export default defineConfig({
  plugins: [
    // Preact preset MUST come first to set default JSX runtime to Preact
    preact(),
    tailwindcss(),
    // Motion Canvas plugin adds scene/project transforms; spread because it returns array
    ...motionCanvas({
      project: './src/project.ts',
    }),
  ],
  // Tauri-specific config
  clearScreen: false,
  server: {
    port: 5173,
    strictPort: true,
    host: process.env.TAURI_DEV_HOST || false,
    hmr: process.env.TAURI_DEV_HOST
      ? { protocol: 'ws', host: process.env.TAURI_DEV_HOST, port: 1421 }
      : undefined,
    watch: { ignored: ['**/src-tauri/**'] },
  },
  envPrefix: ['VITE_', 'TAURI_ENV_*'],
  build: {
    target: 'safari13',
    minify: !process.env.TAURI_ENV_DEBUG ? 'esbuild' : false,
    sourcemap: !!process.env.TAURI_ENV_DEBUG,
  },
});
