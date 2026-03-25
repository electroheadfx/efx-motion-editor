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
    // Motion Canvas plugin returns array of Vite plugins.
    // Filter out the editor plugin — it hijacks '/' and serves MC's editor HTML
    // instead of our index.html. We only need scene/project/asset transforms.
    ...(motionCanvas({
      project: './src/project.ts',
    }) as any[]).filter((p: any) => p.name !== 'motion-canvas:editor'),
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
        // Restore Preact as default JSX runtime (MC projects plugin overrides to MC's runtime)
        // Scene files use per-file @jsxImportSource pragma for MC's JSX
        if (config.esbuild) {
          (config.esbuild as any).jsxImportSource = 'preact';
        }
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
  // p5.brush standalone uses WebGL2 internally with complex module-scoped state.
  // esbuild pre-bundling breaks its internal variable scoping (ReferenceError: v).
  optimizeDeps: {
    exclude: ['p5.brush'],
  },
  build: {
    target: 'safari13',
    minify: !process.env.TAURI_ENV_DEBUG ? 'esbuild' : false,
    sourcemap: !!process.env.TAURI_ENV_DEBUG,
  },
});
