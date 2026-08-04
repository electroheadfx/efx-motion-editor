import {
  cpSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { build, type Plugin } from 'vite';

// A real cold production build takes ~60-90s; keep the explicit per-test and
// hook timeouts generous so Vitest never kills the build mid-run.
const BUILD_TIMEOUT = 300_000;

const APP_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const tempDirs: string[] = [];

function makeTempDir(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

/** Extract local src=/href= references from emitted HTML (skips any URL scheme, fragments, protocol-relative). */
function extractLocalRefs(html: string): string[] {
  return [...html.matchAll(/(?:src|href)="([^"]+)"/g)]
    .map((match) => match[1])
    .filter((ref) => !/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(ref) && !ref.startsWith('#') && !ref.startsWith('//'));
}

/** Recursively collect file paths (relative to root) under a directory. */
function collectFiles(root: string, prefix = ''): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(join(root, prefix), { withFileTypes: true })) {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      out.push(...collectFiles(root, rel));
    } else if (entry.isFile()) {
      out.push(rel);
    }
  }
  return out;
}

function createInputCapturePlugin(captured: { input: unknown; chunkLimit?: number }): Plugin {
  return {
    name: 'test-capture-rollup-input',
    enforce: 'post',
    configResolved(config) {
      captured.input = config.build.rollupOptions.input;
      // D-14: capture the RESOLVED value so a config typo cannot false-pass.
      captured.chunkLimit = config.build.chunkSizeWarningLimit;
    },
  };
}

describe('production vite build', () => {
  let outDir: string;
  const captured: { input: unknown; chunkLimit?: number } = { input: undefined };

  beforeAll(async () => {
    outDir = makeTempDir('efx-build-');
    await build({
      root: APP_DIR,
      configFile: join(APP_DIR, 'vite.config.ts'),
      logLevel: 'silent',
      plugins: [createInputCapturePlugin(captured)],
      build: { outDir, emptyOutDir: true }, // hermetic — never touches app/dist
    });
  }, BUILD_TIMEOUT);

  afterAll(() => {
    for (const dir of tempDirs) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it(
    'rollup input preserves the Motion Canvas entry and adds the app HTML entry',
    { timeout: 180_000 },
    () => {
      const input = captured.input;
      expect(input).toBeTypeOf('object');
      expect(input).not.toBeNull();
      expect(Array.isArray(input)).toBe(false);
      const entries = input as Record<string, unknown>;
      // Motion Canvas project entry preserved verbatim (key contains a slash —
      // the project bundle emits under src/, not the outDir root).
      expect(entries['src/project']).toBe('./src/project.ts?project');
      // App HTML entry added with the absolute path to app/index.html.
      expect(entries['app']).toBe(join(APP_DIR, 'index.html'));
    },
  );

  it(
    'resolved chunkSizeWarningLimit is exactly the documented 1100 desktop budget',
    { timeout: 180_000 },
    () => {
      expect(captured.chunkLimit, 'chunkSizeWarningLimit must resolve to the documented 1100 desktop budget').toBe(1100);
    },
  );

  it(
    'emits a complete index.html with resolvable local assets and the project bundle',
    { timeout: 180_000 },
    () => {
      const indexPath = join(outDir, 'index.html');
      expect(existsSync(indexPath), 'index.html must be emitted').toBe(true);
      expect(statSync(indexPath).size, 'index.html must be non-empty').toBeGreaterThan(0);

      const html = readFileSync(indexPath, 'utf8');
      const refs = extractLocalRefs(html);
      expect(refs.length, 'index.html must reference local assets').toBeGreaterThan(0);
      for (const ref of refs) {
        const filePath = join(outDir, ref.replace(/^\//, ''));
        expect(existsSync(filePath), `referenced asset must exist: ${ref}`).toBe(true);
        expect(statSync(filePath).size, `referenced asset must be non-empty: ${ref}`).toBeGreaterThan(0);
      }

      const moduleScripts = [...html.matchAll(/<script[^>]*>/g)]
        .map((match) => match[0])
        .filter((tag) => tag.includes('type="module"') && /src="[^"]+"/.test(tag));
      expect(moduleScripts.length, 'index.html must reference at least one module script').toBeGreaterThan(0);

      // The slash in the input key "src/project" relocates the bundle under src/.
      const projectBundles = collectFiles(outDir).filter((rel) => /(^|\/)project-[^/]*\.js$/.test(rel));
      expect(projectBundles.length, 'a project-*.js bundle must be emitted').toBeGreaterThan(0);
    },
  );

  it(
    'bundle guard accepts the real production bundle',
    { timeout: 180_000 },
    async () => {
      const { assertProductionBundle } = await import('../vite.config');
      expect(() => assertProductionBundle(outDir)).not.toThrow();
    },
  );

  it('bundle guard rejects a bundle with a dangling asset reference', async () => {
    const { assertProductionBundle } = await import('../vite.config');
    const broken = makeTempDir('efx-broken-');
    writeFileSync(
      join(broken, 'index.html'),
      '<!doctype html><html><head><script type="module" src="/gone.js"></script></head><body></body></html>',
    );
    expect(() => assertProductionBundle(broken)).toThrowError(/gone\.js/);
  });

  it('bundle guard rejects an empty index.html', async () => {
    const { assertProductionBundle } = await import('../vite.config');
    const broken = makeTempDir('efx-broken-');
    writeFileSync(join(broken, 'index.html'), '');
    expect(() => assertProductionBundle(broken)).toThrowError(/index\.html/);
  });

  it('bundle guard rejects HTML without a local module script', async () => {
    const { assertProductionBundle } = await import('../vite.config');
    const broken = makeTempDir('efx-broken-');
    writeFileSync(
      join(broken, 'index.html'),
      '<!doctype html><html><head></head><body><script>console.log("inline only")</script></body></html>',
    );
    expect(() => assertProductionBundle(broken)).toThrowError(/module script/i);
  });

  it('bundle guard rejects a corrupted copy of the real bundle', async () => {
    const { assertProductionBundle } = await import('../vite.config');
    const indexPath = join(outDir, 'index.html');
    expect(existsSync(indexPath), 'real build must emit index.html before corruption test').toBe(true);
    const corrupted = makeTempDir('efx-corrupted-');
    cpSync(outDir, corrupted, { recursive: true });
    const html = readFileSync(join(corrupted, 'index.html'), 'utf8');
    const ref = extractLocalRefs(html)[0];
    expect(ref, 'real index.html must reference at least one local asset').toBeDefined();
    rmSync(join(corrupted, ref.replace(/^\//, '')));
    expect(() => assertProductionBundle(corrupted)).toThrowError();
  });
});
