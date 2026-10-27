import { existsSync, readFileSync } from 'node:fs';
import { dirname, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * Phase-close suite gate (55-08 / R5.1 / R5.2 / R1.3 / RUN-05 non-regression).
 *
 * Thin standing gate over the host-split pin family: asserts every pin the
 * phase depends on is PRESENT and COLLECTABLE on the existing vitest setup,
 * and that the paintVersion discipline pin is still intact after the re-point.
 *
 * Pins covered:
 *   - hostGenericityRoundTrip.test.ts      (55-07, A5 automated / D-05)
 *   - hostImportGraphContract.test.ts      (55-07, D-07 import-graph)
 *   - hostSplitFailClosedApply.test.ts     (55-06, HOST-05 / DATA-02)
 *   - hostAnimationResidueContract.test.ts (55-09, HOST-01 residue)
 *   - paintVersionDisciplineContract.test.ts (RUN-05 / R1.3)
 *
 * Collectable = matches the shared app/vitest.config.ts include globs and
 * keeps the .test.ts suffix vitest collects. No one-off test config. This gate
 * does not execute the pins (the full suite does); it fails when a pin is
 * renamed, relocated out of the include, emptied, or stripped of tests.
 *
 * PINS_GREEN_AT_BIRTH: preservation gate over already-landed pins. A red here
 * is a pin-visibility regression, never a reason to weaken a pin (55-08).
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const APP_ROOT = resolve(HERE, '../../..');
const REPO_ROOT = resolve(APP_ROOT, '..');

const STANDING_PINS = [
  'app/src/efx-paint/host-split/hostGenericityRoundTrip.test.ts',
  'app/src/efx-paint/host-split/hostImportGraphContract.test.ts',
  'app/src/efx-paint/host-split/hostSplitFailClosedApply.test.ts',
  'app/src/efx-paint/host-split/hostAnimationResidueContract.test.ts',
  'app/src/paintVersionDisciplineContract.test.ts',
] as const;

const PIN_FIXTURES = [
  'app/src/efx-paint/host-split/fakeEngine2Fixture.ts',
] as const;

const VITEST_CONFIG = resolve(APP_ROOT, 'vitest.config.ts');

function readVitestIncludeGlobs(): string[] {
  const source = readFileSync(VITEST_CONFIG, 'utf8');
  const match = source.match(/include:\s*\[([^\]]+)\]/);
  if (!match) {
    throw new Error(
      'vitest.config.ts has no readable test.include array - cannot prove collectability',
    );
  }
  const globLiterals = [...match[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
  expect(globLiterals.length, 'vitest include must list at least one glob').toBeGreaterThan(0);
  return globLiterals;
}

/**
 * Minimal glob matcher for the include shapes this project uses, relative to
 * the vitest root (app/). Handles a double-star directory wildcard and a
 * single-star filename wildcard.
 */
function globToMatcher(glob: string): (relativeFromAppRoot: string) => boolean {
  const normalized = glob.replace(/\\/g, '/');
  const STAR = '\u0001';
  const escaped = normalized
    .split('')
    .map((ch) => (ch === '*' ? STAR : /[.*+?^${}()|[\]\\]/.test(ch) ? `\\${ch}` : ch))
    .join('');
  const regexSource = escaped
    .split(`${STAR}${STAR}/`)
    .join('(?:.*/)?')
    .split(`${STAR}${STAR}`)
    .join('.*')
    .split(STAR)
    .join('[^/]*');
  return (relativeFromAppRoot: string) =>
    new RegExp(`^${regexSource}$`).test(relativeFromAppRoot.replace(/\\/g, '/'));
}

function isCollectableBySharedConfig(repoRelativePath: string, includeGlobs: string[]): boolean {
  const fromAppRoot = repoRelativePath.startsWith('app/')
    ? repoRelativePath.slice('app/'.length)
    : repoRelativePath;
  return includeGlobs.some((glob) => globToMatcher(glob)(fromAppRoot));
}

function countVitestTests(source: string): number {
  return (source.match(/(?:^|[^.\w])(?:it|test)\s*\(/gm) ?? []).length;
}

describe('host-split phase-close suite gate (55-08 / R5.1)', () => {
  it('every standing host-split pin file is present and non-empty', () => {
    for (const pin of STANDING_PINS) {
      const abs = resolve(REPO_ROOT, pin);
      expect(existsSync(abs), `missing standing pin: ${pin}`).toBe(true);
      const source = readFileSync(abs, 'utf8');
      expect(source.trim().length, `standing pin is empty: ${pin}`).toBeGreaterThan(0);
    }
  });

  it('every standing pin is collectable by the shared vitest include (no one-off config)', () => {
    const includeGlobs = readVitestIncludeGlobs();
    for (const pin of STANDING_PINS) {
      expect(
        isCollectableBySharedConfig(pin, includeGlobs),
        `pin not matched by include globs ${JSON.stringify(includeGlobs)}: ${pin}`,
      ).toBe(true);
      expect(extname(pin), `pin must keep the .ts suffix: ${pin}`).toBe('.ts');
      expect(pin.endsWith('.test.ts'), `pin must end in .test.ts: ${pin}`).toBe(true);
    }
  });

  it('every standing pin still carries vitest tests (a pin emptied of tests is a green hole)', () => {
    for (const pin of STANDING_PINS) {
      const source = readFileSync(resolve(REPO_ROOT, pin), 'utf8');
      expect(countVitestTests(source), `standing pin declares zero tests: ${pin}`).toBeGreaterThan(0);
    }
  });

  it('pin fixtures the host-split pins import are present', () => {
    for (const fixture of PIN_FIXTURES) {
      const abs = resolve(REPO_ROOT, fixture);
      expect(existsSync(abs), `missing pin fixture: ${fixture}`).toBe(true);
      expect(
        readFileSync(abs, 'utf8').trim().length,
        `empty pin fixture: ${fixture}`,
      ).toBeGreaterThan(0);
    }
  });

  it('paintVersion discipline pin is still intact after the host re-point (R1.3 / RUN-05)', () => {
    const pinPath = resolve(REPO_ROOT, 'app/src/paintVersionDisciplineContract.test.ts');
    const source = readFileSync(pinPath, 'utf8');

    const requiredLegs = [
      'paintStore.paintVersion.value',
      'bumpTrackRevision',
      '_notifyVisualChange',
      'setRotoPlaybackSettings',
      'setRotoBackgroundMetadata',
    ];
    for (const leg of requiredLegs) {
      expect(source.includes(leg), `paintVersion pin lost required leg: ${leg}`).toBe(true);
    }

    expect(source, 'paintVersion pin must keep the subscribe-read regex source').toContain(
      'paintStore\\.paintVersion\\.value',
    );
    expect(countVitestTests(source)).toBeGreaterThanOrEqual(5);
  });

  it('suite gate itself stays collectable (self-check on the shared include)', () => {
    const includeGlobs = readVitestIncludeGlobs();
    const selfRepoRelative = 'app/src/efx-paint/host-split/hostSplitSuiteGate.test.ts';
    expect(existsSync(resolve(REPO_ROOT, selfRepoRelative))).toBe(true);
    expect(isCollectableBySharedConfig(selfRepoRelative, includeGlobs)).toBe(true);
  });
});
