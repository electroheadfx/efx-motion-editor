import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import tailwindcss from '@tailwindcss/vite';
import motionCanvasModule from '@efxlab/motion-canvas-vite-plugin';

// CJS interop: handle both { default: fn } namespace and direct fn
const motionCanvas =
  typeof motionCanvasModule === 'function'
    ? motionCanvasModule
    : (motionCanvasModule as any).default;

export default defineConfig({
  plugins: [
    // Preact preset MUST come first to set default JSX runtime to Preact
    preact(),
    tailwindcss(),
    // Motion Canvas plugin returns array of Vite plugins
    ...motionCanvas({
      project: './src/project.ts',
    }),
    // Fix: Motion Canvas excludes preact from optimizeDeps, but @preact/preset-vite
    // includes it. esbuild can't have an entry point marked as external.
    {
      name: 'fix-preact-optimize-conflict',
      enforce: 'post' as const,
      config() {
        return {
          optimizeDeps: {
            exclude: [],
          },
        };
      },
      configResolved(config) {
        const exclude = config.optimizeDeps.exclude;
        const preactEntries = ['preact', 'preact/jsx-runtime', 'preact/jsx-dev-runtime'];
        for (const entry of preactEntries) {
          const idx = exclude.indexOf(entry);
          if (idx !== -1) exclude.splice(idx, 1);
        }
        // Also remove wildcard 'preact/*' that matches sub-paths
        const wildcardIdx = exclude.indexOf('preact/*');
        if (wildcardIdx !== -1) exclude.splice(wildcardIdx, 1);
      },
    },
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
