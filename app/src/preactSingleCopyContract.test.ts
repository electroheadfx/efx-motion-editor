import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// Pure fs/JSON contract assertions for the one-preact-copy law (D-05).
// Dual-preact failures are non-obvious at runtime (two signals runtimes,
// zombie state) — this pin must fail loudly at test time, never warn.

const APP_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const REPO_ROOT = resolve(APP_DIR, '..');

type DepField = 'dependencies' | 'devDependencies' | 'peerDependencies';

interface ManifestData {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  pnpm?: { overrides?: Record<string, string> };
}

interface Manifest {
  packagePath: string;
  data: ManifestData;
}

interface Offender {
  packagePath: string;
  field: string;
  value: string;
  reason: string;
}

function repoRelative(absPath: string): string {
  return relative(REPO_ROOT, absPath).split('\\').join('/');
}

function loadManifest(absPath: string): Manifest {
  // Do NOT swallow a missing manifest into a pass — readFileSync throws.
  const data = JSON.parse(readFileSync(absPath, 'utf8')) as ManifestData;
  return { packagePath: repoRelative(absPath), data };
}

/** Workspace manifests in deterministic sorted path order (root + pnpm-workspace packages). */
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
 * A range is on the 11.x-only line when it names major 11 and cannot resolve
 * to major 10. Dual-major floors (">=10.0.0", "^10 || ^11") are rejected —
 * the clean-break law (D-04) forbids them.
 */
function isPreactElevenLine(range: string): boolean {
  const r = range.trim();
  if (/(?:^|[^0-9])10(?:\.[0-9]+)*(?:$|[^0-9])/.test(r)) return false;
  return /(?:^|[^0-9])11(?:\.[0-9]+)*(?:$|[^0-9])/.test(r);
}

function isAtLeastVersion(range: string, min: [number, number, number]): boolean {
  const m = range.trim().match(/(\d+)\.(\d+)\.(\d+)/);
  if (!m) return false;
  const maj = Number(m[1]);
  const mino = Number(m[2]);
  const pat = Number(m[3]);
  if (maj !== min[0]) return maj > min[0];
  if (mino !== min[1]) return mino > min[1];
  return pat >= min[2];
}

function offenderMessage(o: Offender): string {
  return `${o.packagePath} ${o.field}: ${o.value} — ${o.reason}`;
}

/**
 * Collect every preact pin that would reopen a second-copy lane.
 * A package that declares no preact pin contributes zero offenders.
 * Reported in deterministic sorted package-path order, then field order.
 */
function collectOffenders(manifests: Manifest[]): Offender[] {
  const fields: DepField[] = ['dependencies', 'devDependencies', 'peerDependencies'];
  const offenders: Offender[] = [];
  for (const manifest of manifests) {
    for (const field of fields) {
      const value = manifest.data[field]?.['preact'];
      if (value === undefined) continue;
      if (field === 'peerDependencies') {
        if (!isPreactElevenLine(value)) {
          offenders.push({
            packagePath: manifest.packagePath,
            field: 'peerDependencies.preact',
            value,
            reason:
              'peerDependencies.preact must be >=11.0.0 or stricter on the 11 major (dual-major floor rejected)',
          });
        }
      } else if (!isPreactElevenLine(value)) {
        offenders.push({
          packagePath: manifest.packagePath,
          field: `${field}.preact`,
          value,
          reason: 'preact pin must stay on the 11.x singleton line (root pnpm.overrides.preact)',
        });
      }
    }
  }
  offenders.sort(
    (a, b) => a.packagePath.localeCompare(b.packagePath) || a.field.localeCompare(b.field),
  );
  return offenders;
}

describe('one-preact-copy contract pin (D-05)', () => {
  const root = loadManifest(join(REPO_ROOT, 'package.json'));
  const overrides = root.data.pnpm?.overrides ?? {};
  const manifests = workspaceManifests();

  it('root pnpm.overrides.preact is on the 11.x line (workspace singleton)', () => {
    const value = overrides['preact'];
    expect(typeof value, 'package.json pnpm.overrides.preact must be present').toBe('string');
    expect(
      isPreactElevenLine(value as string),
      `package.json pnpm.overrides.preact=${value} must be on the 11.x line (not the 10.x line)`,
    ).toBe(true);
  });

  it('root pnpm.overrides["@preact/signals"] is on the 2.11.3+ line', () => {
    const value = overrides['@preact/signals'];
    expect(typeof value, 'package.json pnpm.overrides["@preact/signals"] must be present').toBe(
      'string',
    );
    expect(
      isAtLeastVersion(value as string, [2, 11, 3]),
      `package.json pnpm.overrides["@preact/signals"]=${value} must be 2.11.3 or higher`,
    ).toBe(true);
  });

  it('no workspace package pins an off-line preact in dependencies or devDependencies', () => {
    const offenders = collectOffenders(manifests).filter(
      (o) => o.field === 'dependencies.preact' || o.field === 'devDependencies.preact',
    );
    expect(
      offenders.map(offenderMessage),
      'off-line dependencies/devDependencies.preact pins (would reintroduce a second copy)',
    ).toEqual([]);
  });

  it('every peerDependencies.preact range is >=11.0.0 or stricter on the 11 major', () => {
    const offenders = collectOffenders(manifests).filter(
      (o) => o.field === 'peerDependencies.preact',
    );
    expect(
      offenders.map(offenderMessage),
      'peerDependencies.preact dual-major floors or 10.x ranges',
    ).toEqual([]);
  });

  it('a workspace package that declares no preact pin contributes zero offenders', () => {
    const synthetic: Manifest[] = [
      {
        packagePath: 'synthetic/no-preact/package.json',
        data: { dependencies: { 'left-pad': '1.0.0' } },
      },
    ];
    expect(collectOffenders(synthetic)).toEqual([]);
  });

  it('offenders are reported in sorted package-path order and name package + field', () => {
    const offenders = collectOffenders(manifests);
    const paths = offenders.map((o) => o.packagePath);
    expect(paths).toEqual([...paths].sort((a, b) => a.localeCompare(b)));
    for (const o of offenders) {
      const message = offenderMessage(o);
      expect(message, `offender message for ${o.packagePath} ${o.field}`).toContain(o.packagePath);
      expect(message, `offender message for ${o.packagePath} ${o.field}`).toContain(o.field);
    }
  });
});
