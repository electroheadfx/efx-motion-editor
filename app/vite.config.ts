import { existsSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import tailwindcss from '@tailwindcss/vite';
import motionCanvasModule from '@efxlab/motion-canvas-vite-plugin';

// CJS interop: handle both { default: fn } namespace and direct fn
const motionCanvas =
  typeof motionCanvasModule === 'function'
    ? motionCanvasModule
    : (motionCanvasModule as any).default;
const packageJson = JSON.parse(readFileSync(fileURLToPath(new URL('./package.json', import.meta.url)), 'utf8')) as { version: string };

// Resolved in the fix-preact-optimize-conflict plugin's configResolved hook;
// used by its writeBundle bundle guard when outputOptions.dir is unset.
let resolvedOutDir: string | undefined;

/**
 * Fail-closed production bundle guard (v0.8.1 hotfix).
 * v0.8.0 shipped a Tauri bundle with no frontend entry: motion-canvas:project
 * sets build.rollupOptions.input, which makes Vite skip its default index.html
 * entry, so dist/ contained no index.html at all. This guard runs inside the
 * same build (writeBundle) and fails it — hence beforeBuildCommand, hence the
 * Tauri packaging step — whenever the emitted bundle is incomplete:
 *   - index.html missing or empty
 *   - no local <script type="module" src=...> referenced
 *   - any referenced local src=/href= asset missing or empty on disk
 * Exported so app/src/viteBuild.test.ts can exercise it without a second build.
 */
export function assertProductionBundle(outDir: string): void {
  const fail = (message: string): never => {
    throw new Error(`Production bundle guard: ${message}`);
  };

  const indexPath = join(outDir, 'index.html');
  if (!existsSync(indexPath) || statSync(indexPath).size === 0) {
    fail(`index.html is missing or empty in ${outDir}`);
  }
  const html = readFileSync(indexPath, 'utf8');

  const moduleScripts = [...html.matchAll(/<script[^>]*>/g)]
    .map((match) => match[0])
    .filter(
      (tag) =>
        tag.includes('type="module"') && /src="(?![a-zA-Z][a-zA-Z0-9+.-]*:|#|\/\/)[^"]+"/.test(tag),
    );
  if (moduleScripts.length === 0) {
    fail('index.html references no local module script');
  }

  const refs = [...html.matchAll(/(?:src|href)="([^"]+)"/g)]
    .map((match) => match[1])
    .filter(
      // Local references only: exclude any URL scheme (http:, data:, mailto:,
      // blob:, ...), fragments, and protocol-relative URLs.
      (ref) => !/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(ref) && !ref.startsWith('#') && !ref.startsWith('//'),
    );
  for (const ref of refs) {
    const assetPath = join(outDir, ref.replace(/^\//, ''));
    if (!existsSync(assetPath) || statSync(assetPath).size === 0) {
      fail(`referenced asset is missing or empty: ${ref}`);
    }
  }
}

export default defineConfig({
  define: {
    'import.meta.env.PACKAGE_VERSION': JSON.stringify(packageJson.version),
  },
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
      config(config) {
        // motion-canvas:project contributes build.rollupOptions.input via its
        // own config hook; when input is set, Vite skips its default
        // resolve('index.html') entry, so v0.8.0 production builds emitted no
        // dist/index.html. Plugin config-hook returns are merged in order and
        // post plugins see (and win over) normal plugins' contributions, so we
        // can read the MC input here, preserve every entry verbatim, and add
        // the app HTML entry. Fail loudly if the contributed shape changes.
        const input = config.build?.rollupOptions?.input;
        if (!input || typeof input !== 'object' || Array.isArray(input)) {
          throw new Error(
            `Expected motion-canvas:project to contribute object build.rollupOptions.input, got: ${JSON.stringify(input)}`,
          );
        }
        for (const [key, value] of Object.entries(input)) {
          if (typeof value !== 'string') {
            throw new Error(
              `Unexpected build.rollupOptions.input entry "${key}": expected string, got ${typeof value}`,
            );
          }
        }
        return {
          build: {
            rollupOptions: {
              input: { ...input, app: fileURLToPath(new URL('./index.html', import.meta.url)) },
            },
          },
          // vite:esbuild snapshots config.esbuild at plugin-creation time,
          // before any user configResolved hook runs — so the esbuild repair
          // MUST be returned from a config hook to take effect. As a post
          // plugin this wins over MC's jsxImportSource ('@efxlab/.../lib'),
          // which is otherwise injected into workspace .tsx files (e.g.
          // packages/efx-physic-paint) that cannot resolve it under pnpm's
          // strict layout. Scene files keep MC's runtime via their per-file
          // @jsxImportSource pragmas, which override this config.
          esbuild: { jsx: 'automatic', jsxImportSource: 'preact' },
          optimizeDeps: {
            exclude: [],
          },
        };
      },
      configResolved(config) {
        // NOTE: `exclude` is optional in Vite's ResolvedConfig types; guard so
        // tsc --noEmit (the build's first step) stays green. Runtime behavior
        // unchanged — the splice repair only runs when the array exists.
        const exclude = config.optimizeDeps.exclude;
        if (exclude) {
          const preactEntries = ['preact', 'preact/jsx-runtime', 'preact/jsx-dev-runtime'];
          for (const entry of preactEntries) {
            const idx = exclude.indexOf(entry);
            if (idx !== -1) exclude.splice(idx, 1);
          }
          // Also remove wildcard 'preact/*' that matches sub-paths
          const wildcardIdx = exclude.indexOf('preact/*');
          if (wildcardIdx !== -1) exclude.splice(wildcardIdx, 1);
        }
        // Capture the resolved outDir so writeBundle can locate the bundle even
        // when outputOptions.dir is unset.
        resolvedOutDir = resolve(config.root, config.build.outDir);
      },
      writeBundle(outputOptions) {
        const outDir = outputOptions.dir ?? resolvedOutDir;
        if (!outDir) {
          throw new Error('Production bundle guard: unable to resolve the build output directory');
        }
        assertProductionBundle(outDir);
      },
    },
  ],
  resolve: {
    alias: {
      '@efxlab/efx-physic-paint/preact': fileURLToPath(new URL('../packages/efx-physic-paint/src/preact.tsx', import.meta.url)),
      '@efxlab/efx-physic-paint/animation': fileURLToPath(new URL('../packages/efx-physic-paint/src/animation/index.ts', import.meta.url)),
      '@efxlab/efx-physic-paint': fileURLToPath(new URL('../packages/efx-physic-paint/src/index.ts', import.meta.url)),
    },
  },
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
    exclude: ['p5.brush', '@efxlab/efx-physic-paint'],
  },
  build: {
    // NOTE: motion-canvas:project's config hook contributes build.target
    // 'modules', which silently overrides this 'safari13' (plugin config-hook
    // returns win over the config file). Pre-existing behavior — left as-is.
    target: 'safari13',
    // Desktop chunk budget (D-11): this is a packaged Tauri desktop app
    // loading local assets, so network-first web heuristics do not apply.
    // Vite's 500 kB default is a generic web threshold; 1100 is a monitored
    // desktop entry-bundle budget, not a performance claim, and it must not
    // be raised again without measurement.
    chunkSizeWarningLimit: 1100,
    minify: !process.env.TAURI_ENV_DEBUG ? 'esbuild' : false,
    sourcemap: !!process.env.TAURI_ENV_DEBUG,
  },
});
