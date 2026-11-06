/**
 * Phase 59 plan 14 — REL-01: "No new runtime dependencies".
 *
 * Enforced as a static import-surface law, not as prose: every module the phase
 * added or changed is read from DISK, its bare import specifiers are extracted
 * with a conservative regex, and each one must resolve to a package declared by
 * a workspace manifest. Relative paths, node: builtins and type-only imports
 * are allowed by construction (a type-only import still names a declared
 * package when it is bare).
 *
 * The second law is the phase's own delta: `app/package.json` `dependencies` is
 * frozen inline below from the manifest as it stood at the start of the phase
 * (commit 724bb6194, unchanged through every plan). A phase module importing a
 * package that happens to be a transitive/dev dependency would slip through a
 * "does it resolve?" check; the frozen literal closes that hole by asserting
 * the runtime dependency SET itself did not move.
 *
 * Both halves fail loudly instead of vacuously: the scan list is asserted
 * non-empty and the positive-control case names the bare packages the phase
 * really imports, so a broken extractor cannot pass by finding nothing.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// This file lives at `app/src/lib/`, so the app package root is two levels up
// and the repo root one more.
const APP_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const REPO_ROOT = resolve(APP_DIR, '..');

/** The `<interfaces>` scan set from 59-14-PLAN.md — the phase's touched modules. */
const PHASE_MODULES: readonly string[] = Object.freeze([
  'app/src/components/physic-paint/roto/railMotionModel.ts',
  'app/src/components/physic-paint/roto/railMotionEvaluator.ts',
  'app/src/components/physic-paint/roto/railMotionIdentity.ts',
  'app/src/components/physic-paint/roto/railMotionPivot.ts',
  'app/src/components/physic-paint/roto/railMotionCommands.ts',
  'app/src/components/physic-paint/roto/railMotionDocumentReconciler.ts',
  'app/src/components/physic-paint/roto/railMotionMergeNotice.ts',
  'app/src/components/physic-paint/roto/physicsPaintRotoRailSetCopy.ts',
  'app/src/components/physic-paint/view/TimelineMotionChannels.tsx',
  'app/src/components/physic-paint/view/timelineRailDesign.ts',
  'app/src/efx-paint/compositor/efxPaintCompositor.ts',
  'app/src/efx-paint/compositor/efxPaintCompositeCache.ts',
  'app/src/components/physic-paint/roto/physicsPaintRotoPhysicalModel.ts',
  'app/src/stores/physicPaintStore.ts',
  // Rust: crates are covered by the Cargo manifest, not the JS dependency set.
  // The scan reads it anyway so the list stays faithful to the plan's
  // `<interfaces>` block; a non-JS module contributes no specifiers.
  'app/src-tauri/src/services/script_library.rs',
]);

/**
 * `app/package.json` `dependencies` frozen at the phase start (724bb6194).
 * Versions are part of the pin: a silent major swap is a dependency change too.
 */
const FROZEN_APP_DEPENDENCIES: Readonly<Record<string, string>> = Object.freeze({
  '@efxlab/efx-paint-host': 'workspace:*',
  '@efxlab/efx-watercolor': 'workspace:*',
  '@efxlab/motion-canvas-2d': '4.0.0',
  '@efxlab/motion-canvas-core': '4.0.0',
  '@efxlab/motion-canvas-player': '4.0.0',
  '@preact/signals': '2.11.3',
  '@tauri-apps/api': '2.11.1',
  '@tauri-apps/plugin-dialog': '^2.7.3',
  '@tauri-apps/plugin-fs': '^2.5.2',
  '@tauri-apps/plugin-notification': '^2.4.0',
  '@tauri-apps/plugin-store': '^2.4.2',
  'audiobuffer-to-wav': '^1.0.0',
  'bezier-js': '^6.1.4',
  effect: '4.0.0-rc.115',
  'fit-curve': '^0.2.0',
  'lucide-preact': '^1.57.0',
  'p5.brush': '2.1.3-beta',
  'perfect-freehand': '^1.2.3',
  preact: '11.1.1',
  sortablejs: '^1.15.7',
  'stackblur-canvas': '^3.0.0',
  tinykeys: '^3.0.0',
  xstate: '6.0.0-alpha.53',
});

const DEP_FIELDS = [
  'dependencies',
  'devDependencies',
  'peerDependencies',
  'optionalDependencies',
] as const;

interface WorkspaceManifest {
  /** Repo-relative path — every failure message names its source. */
  readonly path: string;
  readonly data: Record<string, unknown>;
}

/** Remove block and line comments so a commented-out example never counts. */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1');
}

/**
 * Conservative extraction: `from '…'`, dynamic `import('…')` and side-effect
 * `import '…'`. The plan explicitly allows a conservative regex — anything it
 * misses cannot smuggle a dependency in, because the manifest-set half still
 * pins the declared runtime dependency set.
 */
function extractSpecifiers(source: string): string[] {
  const cleaned = stripComments(source);
  const specifiers = new Set<string>();
  for (const pattern of [
    /\bfrom\s*['"]([^'"]+)['"]/g,
    /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    /(?:^|[\n;])\s*import\s+['"]([^'"]+)['"]/g,
  ]) {
    for (const match of cleaned.matchAll(pattern)) {
      specifiers.add(match[1]);
    }
  }
  return Array.from(specifiers).sort();
}

function isRelativeSpecifier(specifier: string): boolean {
  return specifier.startsWith('.') || specifier.startsWith('/');
}

function isNodeBuiltin(specifier: string): boolean {
  return specifier.startsWith('node:');
}

/** `@scope/pkg/sub` → `@scope/pkg`; `pkg/sub` → `pkg`. */
function packageNameOf(specifier: string): string {
  if (specifier.startsWith('@')) {
    const [scope, name] = specifier.split('/');
    return `${scope}/${name}`;
  }
  return specifier.split('/')[0];
}

/** Root + app + packages/* manifests, deterministic order. */
function workspaceManifestPaths(): string[] {
  const paths = [join(REPO_ROOT, 'package.json')];
  const appPackage = join(REPO_ROOT, 'app', 'package.json');
  if (existsSync(appPackage)) paths.push(appPackage);
  const packagesDir = join(REPO_ROOT, 'packages');
  if (existsSync(packagesDir)) {
    for (const entry of readdirSync(packagesDir).sort()) {
      const manifest = join(packagesDir, entry, 'package.json');
      if (existsSync(manifest)) paths.push(manifest);
    }
  }
  return paths.sort();
}

function workspaceManifests(): WorkspaceManifest[] {
  return workspaceManifestPaths().map((absolutePath) => ({
    path: absolutePath.slice(REPO_ROOT.length + 1).split('\\').join('/'),
    data: JSON.parse(readFileSync(absolutePath, 'utf8')) as Record<string, unknown>,
  }));
}

function declaredPackageNames(manifests: readonly WorkspaceManifest[]): Set<string> {
  const declared = new Set<string>();
  for (const manifest of manifests) {
    for (const field of DEP_FIELDS) {
      const entries = manifest.data[field];
      if (entries === undefined || entries === null || typeof entries !== 'object') continue;
      for (const name of Object.keys(entries as Record<string, unknown>)) declared.add(name);
    }
  }
  return declared;
}

describe('REL-01: the phase dependency surface (59-14)', () => {
  it('scans a non-empty module list — every phase module exists on disk', () => {
    expect(PHASE_MODULES.length).toBe(15);
    for (const modulePath of PHASE_MODULES) {
      expect(existsSync(join(REPO_ROOT, modulePath)), `${modulePath} is in the scan set`).toBe(true);
    }
  });

  it('resolves every bare import to a workspace-declared package', () => {
    const declared = declaredPackageNames(workspaceManifests());
    const offenders: string[] = [];
    for (const modulePath of PHASE_MODULES) {
      const source = readFileSync(join(REPO_ROOT, modulePath), 'utf8');
      for (const specifier of extractSpecifiers(source)) {
        if (isRelativeSpecifier(specifier) || isNodeBuiltin(specifier)) continue;
        const packageName = packageNameOf(specifier);
        if (!declared.has(packageName)) {
          offenders.push(`${modulePath}: bare specifier "${specifier}" (package "${packageName}") is not declared by any workspace manifest`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('finds the bare specifiers the phase really imports — the scan is not vacuous', () => {
    const found = new Set<string>();
    for (const modulePath of PHASE_MODULES) {
      for (const specifier of extractSpecifiers(readFileSync(join(REPO_ROOT, modulePath), 'utf8'))) {
        if (!isRelativeSpecifier(specifier) && !isNodeBuiltin(specifier)) {
          found.add(packageNameOf(specifier));
        }
      }
    }
    // Positive control: each of these is a real bare import in the scan set.
    expect(found.has('@preact/signals')).toBe(true);
    expect(found.has('preact')).toBe(true);
    expect(found.has('lucide-preact')).toBe(true);
    expect(found.has('@efxlab/motion-canvas-core')).toBe(true);
  });

  it('adds no entry to app/package.json dependencies — frozen against the phase start', () => {
    const appManifest = JSON.parse(readFileSync(join(APP_DIR, 'package.json'), 'utf8')) as {
      dependencies?: Record<string, string>;
    };
    const current = appManifest.dependencies ?? {};
    const baseline = FROZEN_APP_DEPENDENCIES;

    const added = Object.keys(current).filter((name) => !(name in baseline)).sort();
    const removed = Object.keys(baseline).filter((name) => !(name in current)).sort();
    const moved = Object.keys(current)
      .filter((name) => name in baseline && current[name] !== baseline[name])
      .sort();

    const diff = [
      ...added.map((name) => `+ ${name}@${current[name]}`),
      ...removed.map((name) => `- ${name}@${baseline[name]}`),
      ...moved.map((name) => `~ ${name}: ${baseline[name]} -> ${current[name]}`),
    ];
    expect(diff, `app/package.json dependencies drifted from the frozen phase baseline:\n${diff.join('\n')}`).toEqual([]);
  });
});
