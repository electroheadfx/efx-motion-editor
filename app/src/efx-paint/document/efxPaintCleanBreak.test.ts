import { describe, expect, it } from 'vitest';
import { PKG_FORMAT_VERSION } from '../../lib/efxPaintPackage';
import { findPackageFormatRejection } from './efxPaintCleanBreak';
import cleanPreV1Project from './__fixtures__/clean-pre-v1-project.mce.json';
import freshV1Project from './__fixtures__/fresh-v1-project.mce.json';
import prePackageProject from './__fixtures__/pre-52.2-project.mce.json';

/** A package directory path: the layout every 52.2 project lives in. */
const DIRECTORY = { pathKind: 'directory' } as const;
/** A plain file path: the pre-52.2 layout (`<dir>/<name>.mce` was a file). */
const FILE = { pathKind: 'file' } as const;

/**
 * A v1.0 package manifest: the main-editor fields plus the package keys the
 * writer emits (`formatVersion`, `projectId`, `efxPaint`).
 */
function makePackageManifest(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    version: 16,
    name: 'Package Project',
    fps: 24,
    width: 1920,
    height: 1080,
    created_at: '2026-09-01T10:00:00.000Z',
    modified_at: '2026-09-01T10:00:00.000Z',
    sequences: [],
    images: [],
    formatVersion: PKG_FORMAT_VERSION,
    projectId: '3f2b7c1e-9a4d-4c8b-8f0e-2d6a5b4c3d2e',
    efxPaint: {},
    ...overrides,
  };
}

describe('findPackageFormatRejection — the formatVersion gate', () => {
  it('accepts a package manifest carrying the current formatVersion', () => {
    expect(findPackageFormatRejection(makePackageManifest(), DIRECTORY)).toBeNull();
  });

  it('refuses a pre-52.2 project fixture with the older-format reason', () => {
    expect(findPackageFormatRejection(prePackageProject, DIRECTORY)).toEqual({
      kind: 'missing-format-version',
    });
  });

  it('refuses a plain file path as an old-layout project, whatever the content claims', () => {
    // The file layout decides before the content matters: `<dir>/<name>.mce`
    // was a file before the package format, so a plain file is the old layout
    // even when its JSON happens to carry a current `formatVersion`.
    expect(findPackageFormatRejection(makePackageManifest(), FILE)).toEqual({
      kind: 'old-project-layout',
    });
    expect(findPackageFormatRejection(prePackageProject, FILE)).toEqual({
      kind: 'old-project-layout',
    });
  });

  it('refuses a different formatVersion naming the found and the required version', () => {
    const reason = findPackageFormatRejection(makePackageManifest({ formatVersion: 2 }), DIRECTORY);
    // Both values ride the reason: what the manifest claimed and what this
    // build reads (PKG_FORMAT_VERSION — the single format literal).
    expect(reason).toEqual({
      kind: 'unsupported-format-version',
      found: 2,
      required: PKG_FORMAT_VERSION,
    });
    expect(JSON.stringify(reason)).toContain('"found":2');
    expect(JSON.stringify(reason)).toContain(`"required":${PKG_FORMAT_VERSION}`);
  });

  it('distinguishes "not a package manifest" from "older format"', () => {
    expect(findPackageFormatRejection(null, DIRECTORY)).toEqual({ kind: 'not-a-package-manifest' });
    expect(findPackageFormatRejection(makePackageManifest({ formatVersion: undefined }), DIRECTORY))
      .toEqual({ kind: 'missing-format-version' });
    // A version that is not a number is not a usable package version either.
    expect(findPackageFormatRejection(makePackageManifest({ formatVersion: '1' }), DIRECTORY))
      .toEqual({ kind: 'missing-format-version' });
  });

  it('never throws for malformed input — every case returns a rejection value', () => {
    const malformed: unknown[] = [
      null,
      undefined,
      [],
      'legacy',
      42,
      [{ nested: [{ deep: true }] }],
      { nested: { deeply: { value: [1, 2, { x: null }] } } },
      [],
    ];
    // No try/catch: the assertion is on the RETURNED value, not on an error.
    for (const input of malformed) {
      const reason = findPackageFormatRejection(input, DIRECTORY);
      expect(reason).not.toBeNull();
    }
    expect(findPackageFormatRejection(undefined, FILE)).toEqual({ kind: 'not-a-package-manifest' });
    expect(findPackageFormatRejection({}, FILE)).toEqual({ kind: 'old-project-layout' });
  });

  it('applies the fixed precedence: unreadable manifest, then layout, then version', () => {
    // 1. An unreadable manifest wins over everything else.
    expect(findPackageFormatRejection(null, FILE)).toEqual({ kind: 'not-a-package-manifest' });
    // 2. The plain-file layout wins over a satisfied version check.
    expect(findPackageFormatRejection(makePackageManifest(), FILE)).toEqual({
      kind: 'old-project-layout',
    });
    // 3. The version check follows: absent, then mismatched.
    expect(findPackageFormatRejection(makePackageManifest({ formatVersion: undefined }), DIRECTORY))
      .toEqual({ kind: 'missing-format-version' });
    expect(findPackageFormatRejection(makePackageManifest({ formatVersion: 99 }), DIRECTORY))
      .toEqual({ kind: 'unsupported-format-version', found: 99, required: PKG_FORMAT_VERSION });
    // The same input always yields the same reason (stateless, deterministic).
    const input = makePackageManifest({ formatVersion: 3 });
    expect(findPackageFormatRejection(input, DIRECTORY)).toEqual(
      findPackageFormatRejection(input, DIRECTORY),
    );
  });

  it('refuses a pre-52.2 project regardless of its paint content — no legacy carrier scan remains', () => {
    // Old, no Physic Paint data at all (accepted by the Phase 45 gate): the
    // clean break is now by version, not by paint-content discrimination.
    expect(findPackageFormatRejection(cleanPreV1Project, DIRECTORY)).toEqual({
      kind: 'missing-format-version',
    });
    // Old, with the v1.0 inline document carrier still riding the project file.
    expect(findPackageFormatRejection(freshV1Project, DIRECTORY)).toEqual({
      kind: 'missing-format-version',
    });
    // Old, with the opaque pre-v1.0 output carrier plus inline key payloads.
    expect(findPackageFormatRejection(prePackageProject, DIRECTORY)).toEqual({
      kind: 'missing-format-version',
    });
  });

  it('is pure — repeated calls return equal results and the input is deep-unchanged', () => {
    const input = JSON.parse(JSON.stringify(prePackageProject)) as unknown;
    const before = JSON.stringify(input);
    const first = findPackageFormatRejection(input, DIRECTORY);
    const second = findPackageFormatRejection(input, DIRECTORY);
    expect(second).toEqual(first);
    expect(JSON.stringify(input)).toBe(before);
  });
});
