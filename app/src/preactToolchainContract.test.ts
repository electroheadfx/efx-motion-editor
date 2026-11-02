import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// Pure fs/JSON contract assertions for the Preact 11 toolchain pins (RUN-03 /
// D-10 + D-13). The workspace is on the Preact 11 line; this pin keeps the
// lucide-preact floor and the @preact/preset-vite alignment from silently
// drifting back to the retired Preact 10 lane. Manifest scan only — no install,
// no network, no one-off vitest config (D-12).

const APP_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const REPO_ROOT = resolve(APP_DIR, '..');

const LUCIDE_PACKAGE = 'lucide-preact';
const PRESET_VITE_PACKAGE = '@preact/preset-vite';

/** First lucide-preact line whose peer range allows Preact 11 (D-10). */
const LUCIDE_MINIMUM: readonly [number, number, number] = [1, 57, 0];

/** D-13 aligned target — every declared preset-vite pin must equal this exactly. */
const PRESET_VITE_TARGET = '2.10.6';

const DEP_FIELDS = [
  'dependencies',
  'devDependencies',
  'peerDependencies',
  'optionalDependencies',
] as const;

type DepField = (typeof DEP_FIELDS)[number];

interface ManifestData {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  pnpm?: { overrides?: Record<string, string> };
}

interface Manifest {
  packagePath: string;
  data: ManifestData;
}

interface Pin {
  packagePath: string;
  field: string;
  value: string;
}

interface Offender extends Pin {
  reason: string;
}

interface ParsedVersion {
  major: number;
  minor: number;
  patch: number;
}

function repoRelative(absPath: string): string {
  return relative(REPO_ROOT, absPath).split('\\').join('/');
}

function loadManifest(absPath: string): Manifest {
  // Do NOT swallow a missing manifest into a pass — readFileSync throws.
  const data = JSON.parse(readFileSync(absPath, 'utf8')) as ManifestData;
  return { packagePath: repoRelative(absPath), data };
}

/** Workspace manifests in deterministic sorted path order (root + app + packages/*). */
function workspaceManifestPaths(): string[] {
  const paths: string[] = [join(REPO_ROOT, 'package.json')];
  const appPkg = join(REPO_ROOT, 'app', 'package.json');
  if (existsSync(appPkg)) paths.push(appPkg);
  const packagesDir = join(REPO_ROOT, 'packages');
  if (existsSync(packagesDir)) {
    for (const entry of readdirSync(packagesDir).sort()) {
      const pkg = join(packagesDir, entry, 'package.json');
      if (existsSync(pkg)) paths.push(pkg);
    }
  }
  return paths.sort((a, b) => repoRelative(a).localeCompare(repoRelative(b)));
}

function workspaceManifests(): Manifest[] {
  return workspaceManifestPaths().map(loadManifest);
}

/**
 * Parse the supported lucide-preact range forms: `^x.y.z`, `~x.y.z`, or bare
 * exact `x.y.z`. Returns null for any other operator, partial version, or
 * prerelease shape — the D-10 pin must stay a simple, auditable range.
 */
function parseLucideRange(value: string): ParsedVersion | null {
  const match = value.trim().match(/^[\^~]?(\d+)\.(\d+)\.(\d+)$/);
  if (!match) return null;
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
  };
}

function atLeast(minimum: readonly [number, number, number], parsed: ParsedVersion): boolean {
  if (parsed.major !== minimum[0]) return parsed.major > minimum[0];
  if (parsed.minor !== minimum[1]) return parsed.minor > minimum[1];
  return parsed.patch >= minimum[2];
}

function isLucideAtPreactElevenFloor(value: string): boolean {
  const parsed = parseLucideRange(value);
  return parsed !== null && atLeast(LUCIDE_MINIMUM, parsed);
}

/** Every declared pin for a package, in deterministic package-path + field order. */
function collectDeclaredPins(manifests: Manifest[], packageName: string): Pin[] {
  const pins: Pin[] = [];
  for (const manifest of manifests) {
    for (const field of DEP_FIELDS) {
      const value = manifest.data[field]?.[packageName];
      if (value === undefined) continue;
      pins.push({ packagePath: manifest.packagePath, field: `${field}.${packageName}`, value });
    }
  }
  return pins.sort(
    (a, b) => a.packagePath.localeCompare(b.packagePath) || a.field.localeCompare(b.field),
  );
}

function collectLucideOffenders(manifests: Manifest[]): Offender[] {
  return collectDeclaredPins(manifests, LUCIDE_PACKAGE)
    .filter((pin) => !isLucideAtPreactElevenFloor(pin.value))
    .map((pin) => ({
      ...pin,
      reason:
        `must be ^, ~, or exact on ${LUCIDE_MINIMUM.join('.')} or higher ` +
        '(1.57.0 is the first line whose peer range allows Preact 11; 0.x and 1.0-1.56.x exclude it)',
    }));
}

function collectPresetViteOffenders(manifests: Manifest[]): Offender[] {
  return collectDeclaredPins(manifests, PRESET_VITE_PACKAGE)
    .filter((pin) => pin.value !== PRESET_VITE_TARGET)
    .map((pin) => ({
      ...pin,
      reason: `must be exactly ${PRESET_VITE_TARGET} (D-13 aligned target; all declared pins must agree)`,
    }));
}

function pinMessage(pin: Pin): string {
  return `${pin.packagePath} ${pin.field}: ${pin.value}`;
}

function offenderMessage(offender: Offender): string {
  return `${pinMessage(offender)} — ${offender.reason}`;
}

/** Major only — the exact preact patch version is intentionally not pinned. */
function declaredMajor(range: string): number | null {
  const match = range.trim().match(/^[\^~=<>]*\s*(\d+)(?:\.|$)/);
  return match ? Number(match[1]) : null;
}

describe('preact 11 toolchain contract pin (RUN-03 / D-10 + D-13)', () => {
  const manifests = workspaceManifests();

  it('the workspace scan covers root, app, and every packages/*/package.json in sorted order', () => {
    const paths = workspaceManifestPaths().map(repoRelative);

    expect(paths, 'the workspace manifest scan must include the repo root manifest').toContain(
      'package.json',
    );
    expect(paths, 'the workspace manifest scan must include the app manifest').toContain(
      'app/package.json',
    );
    expect(paths, 'workspace manifest paths must be deterministically sorted').toEqual(
      [...paths].sort((a, b) => a.localeCompare(b)),
    );

    for (const path of paths) {
      expect(path, `workspace manifest scan must skip node_modules (saw ${path})`).not.toContain(
        'node_modules',
      );
      expect(path, `workspace manifest scan must skip dist (saw ${path})`).not.toContain('/dist/');
    }

    const packagesDir = join(REPO_ROOT, 'packages');
    if (existsSync(packagesDir)) {
      for (const entry of readdirSync(packagesDir).sort()) {
        const pkg = join(packagesDir, entry, 'package.json');
        if (!existsSync(pkg)) continue;
        expect(paths, `workspace manifest scan must include packages/${entry}/package.json`).toContain(
          repoRelative(pkg),
        );
      }
    }
  });

  it('every declared lucide-preact range is on ^1.57.0 or higher', () => {
    const pins = collectDeclaredPins(manifests, LUCIDE_PACKAGE);
    expect(
      pins.length,
      'the toolchain scan must see at least one declared lucide-preact pin (the Preact 11 peer floor cannot be pinned vacuously)',
    ).toBeGreaterThan(0);

    const offenders = collectLucideOffenders(manifests);
    expect(
      offenders.map(offenderMessage),
      'off-line lucide-preact ranges (0.x or 1.0-1.56.x exclude Preact 11; only ^, ~, or exact 1.57.0+ are accepted)',
    ).toEqual([]);
  });

  it('the lucide-preact range parser rejects 0.x and 1.0-1.56.x and accepts ^ / ~ / exact at or above 1.57.0', () => {
    // Accepted line (^1.57.0 is the current app pin).
    expect(isLucideAtPreactElevenFloor('^1.57.0'), '^1.57.0').toBe(true);
    expect(isLucideAtPreactElevenFloor('~1.57.0'), '~1.57.0').toBe(true);
    expect(isLucideAtPreactElevenFloor('1.57.0'), '1.57.0').toBe(true);
    expect(isLucideAtPreactElevenFloor('^1.58.0'), '^1.58.0').toBe(true);
    expect(isLucideAtPreactElevenFloor('^2.0.0'), '^2.0.0').toBe(true);

    // The retired range that excluded Preact 11, plus the rest of the 1.0-1.56 line.
    expect(isLucideAtPreactElevenFloor('^0.577.0'), '^0.577.0').toBe(false);
    expect(isLucideAtPreactElevenFloor('~1.56.9'), '~1.56.9').toBe(false);
    expect(isLucideAtPreactElevenFloor('1.0.0'), '1.0.0').toBe(false);
    // Unsupported range shapes are not silently accepted.
    expect(isLucideAtPreactElevenFloor('>=1.57.0'), '>=1.57.0').toBe(false);
    expect(isLucideAtPreactElevenFloor('^1.57'), '^1.57').toBe(false);
  });

  it('a stale lucide-preact range is reported by package path and field', () => {
    const offenders = collectLucideOffenders([
      {
        packagePath: 'synthetic/stale/package.json',
        data: { dependencies: { [LUCIDE_PACKAGE]: '^0.577.0' } },
      },
    ]);

    expect(offenders).toHaveLength(1);
    expect(offenders[0].packagePath).toBe('synthetic/stale/package.json');
    expect(offenders[0].field).toBe(`dependencies.${LUCIDE_PACKAGE}`);
    expect(offenderMessage(offenders[0])).toContain('synthetic/stale/package.json');
    expect(offenderMessage(offenders[0])).toContain(`dependencies.${LUCIDE_PACKAGE}`);
  });

  it('every declared @preact/preset-vite pin is exactly 2.10.6 and all declared pins agree', () => {
    const pins = collectDeclaredPins(manifests, PRESET_VITE_PACKAGE);
    const offenders = collectPresetViteOffenders(manifests);

    expect(
      offenders.map(offenderMessage),
      'declared @preact/preset-vite pins must all be exactly 2.10.6 (D-13 aligned target)',
    ).toEqual([]);

    const declaredValues = [...new Set(pins.map((pin) => pin.value))];
    expect(
      declaredValues.every((value) => value === PRESET_VITE_TARGET),
      `declared @preact/preset-vite values [${declaredValues.join(', ')}] must all agree on ${PRESET_VITE_TARGET}`,
    ).toBe(true);
  });

  it('the preset-vite pin reports a stale 2.10.x instance and accepts a missing declaration', () => {
    const offenders = collectPresetViteOffenders([
      {
        packagePath: 'synthetic/stale/package.json',
        data: { devDependencies: { [PRESET_VITE_PACKAGE]: '^2.10.5' } },
      },
      {
        packagePath: 'synthetic/aligned/package.json',
        data: { devDependencies: { [PRESET_VITE_PACKAGE]: '2.10.6' } },
      },
      {
        packagePath: 'synthetic/absent/package.json',
        data: { dependencies: { 'left-pad': '1.0.0' } },
      },
    ]);

    expect(offenders).toHaveLength(1);
    expect(offenders[0].packagePath).toBe('synthetic/stale/package.json');
    expect(offenders[0].field).toBe(`devDependencies.${PRESET_VITE_PACKAGE}`);
  });

  it('the workspace preact pins are on major 11 (the exact patch version is intentionally not pinned)', () => {
    const root = loadManifest(join(REPO_ROOT, 'package.json'));
    const override = root.data.pnpm?.overrides?.['preact'];
    expect(typeof override, 'package.json pnpm.overrides.preact must be present').toBe('string');
    expect(
      declaredMajor(override as string),
      `package.json pnpm.overrides.preact=${override} must be on major 11`,
    ).toBe(11);

    const app = loadManifest(join(REPO_ROOT, 'app', 'package.json'));
    const appPreact = app.data.dependencies?.['preact'];
    expect(typeof appPreact, 'app/package.json dependencies.preact must be present').toBe('string');
    expect(
      declaredMajor(appPreact as string),
      `app/package.json dependencies.preact=${appPreact} must be on major 11`,
    ).toBe(11);
  });
});
