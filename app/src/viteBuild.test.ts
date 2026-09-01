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
import { build, createLogger, type Plugin } from 'vite';

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

// D-12: capture every build warning through a customLogger wrap. Capture is
// unfiltered at ingestion — assertions filter, the capture never does.
// Consumed by plan 40-03's non-return assertions; named exactly `warnings`.
const warnings: string[] = [];
const logger = createLogger();
const origWarn = logger.warn;
logger.warn = (msg, options) => {
  warnings.push(String(msg));
  origWarn(msg, options);
};

// D-13: module paths of the mixed imports converted to static form in plan
// 40-03 (D-08 approve-all). Substrings exactly as the warning names the
// module subject (absolute in build output; the `app/src/...` suffix is
// matched in subject position via String.includes, robust to checkout path
// and Vite/Rollup wording changes). An empty array means preserve-all was
// approved — the assertion still ships.
const CORRECTED_MIXED_IMPORT_PATHS: string[] = [
  'app/src/lib/appConfig.ts',
  'app/src/lib/unsavedGuard.ts',
  'app/src/lib/themeManager.ts',
  'app/src/lib/paintPreferences.ts',
];

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
    const previousNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      await build({
        root: APP_DIR,
        configFile: join(APP_DIR, 'vite.config.ts'),
        // customLogger replaces logLevel gating — the wrap sees all warn calls.
        customLogger: logger,
        plugins: [createInputCapturePlugin(captured)],
        build: { outDir, emptyOutDir: true }, // hermetic — never touches app/dist
      });
    } finally {
      if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = previousNodeEnv;
    }
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
    'resolved chunkSizeWarningLimit is exactly the documented 1200 desktop budget',
    { timeout: 180_000 },
    () => {
      expect(captured.chunkLimit, 'chunkSizeWarningLimit must resolve to the documented 1200 desktop budget').toBe(1200);
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
    'PhysicsPaintStudio lazy chunk remains a separate bundle',
    { timeout: 180_000 },
    () => {
      // D-15: the efx-physic-paint engine code rides the intentional Studio
      // lazy chunk; pin the separation by stable prefix, never by content hash.
      const studioChunks = collectFiles(outDir).filter((rel) => /PhysicsPaintStudio-[^/]*\.js$/.test(rel));
      expect(studioChunks.length, 'the PhysicsPaintStudio lazy chunk must remain a separate bundle').toBeGreaterThan(0);
    },
  );

  it(
    'emits no chunk-size warning at the 1200 desktop budget',
    { timeout: 180_000 },
    () => {
      // Measured 2026-08-18: 1107.57 kB after Phase 43.6 (+7.57 kB vs the
      // 969.22 kB Phase 40 baseline); budget raised 1100 → 1110 in 43.6
      // (amends milestone criterion V09-C04). Measured 2026-08-20: 1117.4 kB
      // after the debug engine layers, 260819/260820 quicks, and the
      // warning-disposition fixes (+9.8 kB); budget raised 1110 → 1120.
      // Measured 2026-08-23: 1124.96 kB after the 45-05 v1.0 document funnel
      // (efxPaintStore + efxPaintPersistence + document model enter the main
      // chunk); budget raised 1120 → 1130.
      // Measured 2026-08-23: 1131.51 kB after the 46-03 track-scoped copy/cut/
      // paste/duplicate/clear ops and the cross-track Hold re-pointing engine
      // (rail-set copy engine + key-rail segmentation enter the main chunk);
      // budget raised 1130 → 1135.
      // Measured 2026-08-24: 1136.14 kB after the 46 UAT fixes (infinity-repeat
      // paste freeze + lifecycle synthesis, spacing-on-set loop retime);
      // budget raised 1135 → 1140.
      // Measured 2026-08-24: 1155.32 kB after the post-budget phase-46 rail/
      // capsule fixes (paste boundary law, capsule warning UX, cursor-capture
      // undo); budget raised 1140 → 1165.
      // Measured 2026-08-28: 1171.47 kB after 48-03's flattened-compositor
      // delivery entered the main chunk via physicPaintStore; budget raised
      // 1165 → 1180.
      // Measured 2026-08-31: 1180.63 kB after 49-05's Background-row surface
      // (Bg clip drag hook + rail presentation + strip wiring) entered the main
      // chunk; budget raised 1180 → 1190.
      // Measured 2026-09-01: 1190.19 kB after 50-02's photo reference store
      // stack (six photo/reference setters + the reference source registry +
      // reopen hydration) entered the main chunk via efxPaintStore/
      // physicPaintStore; budget raised 1190 → 1200.
      // The production build must not complain about chunk size at all.
      const chunkSizeWarnings = warnings.filter((w) => /chunk.*(size|larger than)/i.test(w));
      expect(
        chunkSizeWarnings.length,
        'no chunk-size warning may be emitted at the 1200 desktop budget',
      ).toBe(0);
    },
  );

  it(
    'no corrected mixed-import module path re-appears in build warnings (D-13 non-return)',
    { timeout: 180_000 },
    () => {
      // Subject-position module-path absence — never exact message matching.
      // The naive "path appears anywhere" check false-fails: corrected paths
      // (e.g. unsavedGuard.ts) legitimately appear as STATIC IMPORTERS inside
      // preserved warnings (e.g. the plugin-dialog guard). The non-return
      // contract is that a corrected module is no longer the SUBJECT of a
      // mixed-import warning, i.e. no warning line names it in subject
      // position ("<path> is dynamically imported by ..."). If a corrected
      // import is converted back to dynamic form, its subject warning
      // returns and this assertion fails.
      const returned = CORRECTED_MIXED_IMPORT_PATHS.filter((p) =>
        warnings.some((w) => w.includes(`${p} is dynamically imported by`)),
      );
      expect(
        returned,
        `corrected mixed imports must not re-appear as warning subjects: ${returned.join(', ')}`,
      ).toEqual([]);
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
