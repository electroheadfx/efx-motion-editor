/**
 * D-07 static import-graph pin (HOST-04 / T-55-12).
 *
 * The host's public API must carry ZERO engine-1 types. A leak would drag
 * engine-1 into every future engine. This pin walks `packages/efx-paint-host/src`
 * (the whole host source tree — a superset of the named public entries
 * `index.ts`, `animation/index.ts`, `script/index.ts`, `time/index.ts`,
 * `bake/index.ts`) and fails if any import, re-export, or dynamic-import
 * string resolves into `efx-physic-paint`, `@efxlab/efx-physic-paint`, any
 * engine package path, or `app/` code.
 *
 * Comment-stripping: header prose naming the forbidden packages cannot
 * self-invalidate the count (PATTERNS gotcha / the clean-break contract's
 * stripper idiom).
 *
 * Family: paintVersionDisciplineContract / efxPaintCleanBreakContract /
 * hostAnimationResidueContract / hostSplitFailClosedApply — a normal
 * `.test.ts` on the existing vitest setup.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { EngineAdapter, StudioStroke } from '@efxlab/efx-paint-host';

const HOST_SPLIT_DIR = resolve(dirname(fileURLToPath(import.meta.url)));
const REPO_ROOT = resolve(HOST_SPLIT_DIR, '../../../..');
const HOST_SRC = resolve(REPO_ROOT, 'packages/efx-paint-host/src');
const HOST_PACKAGE_JSON = resolve(REPO_ROOT, 'packages/efx-paint-host/package.json');

/** Public entry points named by the plan (bake/ arrives with createBakeHost). */
const PUBLIC_ENTRIES = [
  'index.ts',
  'animation/index.ts',
  'script/index.ts',
  'time/index.ts',
  'bake/index.ts',
] as const;

/**
 * Forbidden resolution targets: engine packages (present and future) and
 * app/ code. The host is the seam BELOW engines — it may only depend on its
 * own relative modules and already-installed non-engine pins (e.g. `effect`).
 */
const FORBIDDEN_SPECIFIER_PATTERNS: ReadonlyArray<{ label: string; pattern: RegExp }> = [
  { label: 'engine-1 package (@efxlab/efx-physic-paint or efx-physic-paint)', pattern: /efx-physic-paint/ },
  { label: 'engine-2 package (efx-watercolor)', pattern: /efx-watercolor/ },
  { label: 'engine-3 package (efx-krita)', pattern: /efx-krita/ },
  { label: 'app/ code', pattern: /(^|\/)app\// },
  { label: 'Preact (D-17 host is Preact-free)', pattern: /(^|\/)@?preact(\/|$)/ },
];

// ---------------------------------------------------------------------------
// Comment stripper (stateful across lines; preserves string literals)
// ---------------------------------------------------------------------------

function createCommentStripper(): (line: string) => string {
  let inBlockComment = false;
  return (line: string): string => {
    let out = '';
    let i = 0;
    let inString: "'" | '"' | '`' | null = null;
    while (i < line.length) {
      const ch = line[i];
      const next = line[i + 1];
      if (inBlockComment) {
        if (ch === '*' && next === '/') {
          inBlockComment = false;
          i += 2;
        } else {
          i += 1;
        }
        continue;
      }
      if (inString !== null) {
        out += ch;
        if (ch === '\\' && next !== undefined) {
          out += next;
          i += 2;
          continue;
        }
        if (ch === inString) inString = null;
        i += 1;
        continue;
      }
      if (ch === '/' && next === '*') {
        inBlockComment = true;
        i += 2;
        continue;
      }
      if (ch === '/' && next === '/') break;
      if (ch === "'" || ch === '"' || ch === '`') {
        inString = ch;
        out += ch;
        i += 1;
        continue;
      }
      out += ch;
      i += 1;
    }
    return out;
  };
}

function stripComments(source: string): string {
  const strip = createCommentStripper();
  return source
    .split('\n')
    .map((line) => strip(line))
    .join('\n');
}

// ---------------------------------------------------------------------------
// Specifier extraction (static import/export + dynamic import strings)
// ---------------------------------------------------------------------------

const STATIC_SPECIFIER =
  /(?:^|[\s;}])(?:import|export)\s+(?:type\s+)?(?:[^'"\n]+?\s+from\s+)?['"]([^'"]+)['"]/g;
const DYNAMIC_SPECIFIER = /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

export function extractSpecifiers(strippedSource: string): string[] {
  const specifiers: string[] = [];
  for (const match of strippedSource.matchAll(STATIC_SPECIFIER)) {
    specifiers.push(match[1]);
  }
  for (const match of strippedSource.matchAll(DYNAMIC_SPECIFIER)) {
    specifiers.push(match[1]);
  }
  return specifiers;
}

export function findForbiddenSpecifiers(
  specifiers: readonly string[],
): Array<{ specifier: string; label: string }> {
  const hits: Array<{ specifier: string; label: string }> = [];
  for (const specifier of specifiers) {
    for (const { label, pattern } of FORBIDDEN_SPECIFIER_PATTERNS) {
      if (pattern.test(specifier)) {
        hits.push({ specifier, label });
      }
    }
  }
  return hits;
}

/** Shared gate: one source string must carry no forbidden import. */
function assertCleanSource(source: string, where: string): void {
  const stripped = stripComments(source);
  const specifiers = extractSpecifiers(stripped);
  const hits = findForbiddenSpecifiers(specifiers);
  expect(
    hits,
    `${where} resolves into a forbidden target (D-07 import-graph leak):\n` +
      hits.map((h) => `  import '${h.specifier}' → ${h.label}`).join('\n'),
  ).toEqual([]);
}

// ---------------------------------------------------------------------------
// Repo walk
// ---------------------------------------------------------------------------

function walkTsFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...walkTsFiles(full));
    } else if (entry.endsWith('.ts')) {
      out.push(full);
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Zero-engine-1 compile fixture — StudioStroke<unknown> / EngineAdapter<unknown>
// ---------------------------------------------------------------------------

/**
 * Type-level proof: the generic host contracts compile at P = unknown with
 * zero engine-1 imports (this file imports only vitest, node builtins, and
 * `@efxlab/efx-paint-host`). No engine-1 stroke type is referenced.
 */
function compileFixtureAtUnknown(): {
  stroke: StudioStroke<unknown>;
  adapterSurface: keyof EngineAdapter<unknown>;
} {
  const stroke: StudioStroke<unknown> = {
    pts: [],
    ticks: 1,
    cuisson: 0,
    motion: null,
    brushId: 'unknown-engine',
    toolOverrides: {},
    traceSeed: 1,
    recordedOrder: 0,
    playFrame: null,
    color: null,
    engine: { opaque: true },
  };
  // A single member reference forces EngineAdapter<unknown> to resolve.
  const adapterSurface: keyof EngineAdapter<unknown> = 'captureFrame';
  return { stroke, adapterSurface };
}

// ---------------------------------------------------------------------------

describe('D-07 static import-graph pin — zero engine-1 types in the host', () => {
  it('host source resolves no import into an engine package, app/, or Preact', () => {
    const files = walkTsFiles(HOST_SRC);
    expect(files.length, 'packages/efx-paint-host/src must contain source files to scan').toBeGreaterThan(0);

    for (const file of files) {
      const source = readFileSync(file, 'utf8');
      assertCleanSource(source, relative(REPO_ROOT, file));
    }
  });

  it('public entry points are present or explicitly deferred (bake/ with createBakeHost)', () => {
    for (const entry of PUBLIC_ENTRIES) {
      const full = join(HOST_SRC, entry);
      let exists = false;
      try {
        exists = statSync(full).isFile();
      } catch {
        exists = false;
      }
      if (entry === 'bake/index.ts') {
        // bake/ arrives with createBakeHost in this same plan (55-07 task 3).
        // When present it is scanned by the whole-tree walk above; when absent
        // this row is a no-op rather than a red pin that task 3 would race.
        continue;
      }
      expect(exists, `host public entry ${entry} must exist`).toBe(true);
    }
  });

  it('host package.json depends on no engine package and publishes no engine path', () => {
    const pkg = JSON.parse(readFileSync(HOST_PACKAGE_JSON, 'utf8')) as {
      dependencies?: Record<string, string>;
      peerDependencies?: Record<string, string>;
      exports?: Record<string, unknown>;
    };
    const depNames = [
      ...Object.keys(pkg.dependencies ?? {}),
      ...Object.keys(pkg.peerDependencies ?? {}),
    ];
    for (const name of depNames) {
      expect(
        FORBIDDEN_SPECIFIER_PATTERNS.some(({ pattern }) => pattern.test(name)),
        `packages/efx-paint-host/package.json must not depend on ${name}`,
      ).toBe(false);
    }
    const exportKeys = Object.keys(pkg.exports ?? {});
    for (const key of exportKeys) {
      expect(
        FORBIDDEN_SPECIFIER_PATTERNS.some(({ pattern }) => pattern.test(key)),
        `packages/efx-paint-host exports key ${key} must not name an engine path`,
      ).toBe(false);
    }
  });

  it('StudioStroke<unknown> / EngineAdapter<unknown> compile with zero engine-1 imports', () => {
    // The compile fixture: this file imports only vitest, node builtins, and
    // `@efxlab/efx-paint-host` (no engine-1 type appears in the import list).
    // We deliberately do NOT re-scan this file's string literals — the matcher
    // self-test below must be able to NAME the forbidden packages in plants
    // without self-invalidating (same allowlist idiom as the clean-break pin).
    const fixture = compileFixtureAtUnknown();
    expect(fixture.stroke.engine).toEqual({ opaque: true });
    expect(fixture.adapterSurface).toBe('captureFrame');
    expect(fixture.stroke.pts).toEqual([]);
    // The generic contracts resolve at P = unknown — the opaque slot holds anything.
    const wide: StudioStroke<unknown> = { ...fixture.stroke, engine: { any: 'shape' } };
    expect(wide.engine).toEqual({ any: 'shape' });
  });

  it('detects a planted engine-1 import and a dynamic-import leak in sample source', () => {
    // Matcher self-test (in-memory, no tree mutation): the acceptance criterion
    // "adding a fake import line to a host entry makes the pin fail" is proven
    // by feeding the matcher the exact plant.
    const plantedStatic = [
      `import { EfxPaintEngine } from '@efxlab/efx-physic-paint';`,
      `export type { PaintStroke } from '@efxlab/efx-physic-paint';`,
    ].join('\n');
    const staticHits = findForbiddenSpecifiers(extractSpecifiers(stripComments(plantedStatic)));
    expect(staticHits).toHaveLength(2);
    expect(staticHits[0].label).toMatch(/engine-1/);

    // Build the dynamic-import plant at runtime so the retired animation
    // subpath literal never appears in this file's source (the 55-09 residue
    // pin scans for that contiguous string and must not be self-invalidated).
    const plantedDynamicSpecifier = ['@efxlab/efx-physic-paint', 'animation'].join('/');
    const plantedDynamic = `const mod = await import('${plantedDynamicSpecifier}');`;
    const dynamicHits = findForbiddenSpecifiers(extractSpecifiers(stripComments(plantedDynamic)));
    expect(dynamicHits).toHaveLength(1);

    // Comment prose naming the forbidden package must NOT count.
    const commentOnly = [
      '// The host must never import from',
      '// @efxlab/efx-physic-paint',
      '/* nor from efx-physic-paint */',
    ].join('\n');
    expect(findForbiddenSpecifiers(extractSpecifiers(stripComments(commentOnly)))).toEqual([]);

    // Clean host-relative and allowed pin imports pass.
    const clean = [
      `import { AnimationPlayer } from './AnimationPlayer';`,
      `import { Effect, Queue } from 'effect';`,
      `export type { StudioStroke } from '../animation/types';`,
    ].join('\n');
    expect(findForbiddenSpecifiers(extractSpecifiers(stripComments(clean)))).toEqual([]);
  });
});
