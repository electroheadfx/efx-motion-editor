/**
 * 52.2-02 Task 1: the package path + identity primitives (D-02, D-05, D-07).
 *
 * Three contracts are pinned here:
 *
 * 1. a package-relative path is a plain POSIX relative path — no root, no
 *    `..`, no backslash, no NUL, no drive letter, no UNC (T-52.2-05);
 * 2. the media reference for a real key is exactly
 *    `frames/<layerId>/<keyId>.webp` and nothing else (D-02);
 * 3. the derived-frame cache reference is machine-RELATIVE (`efx-paint/...`),
 *    so no machine-local absolute path can reach a layer sub-file (D-05,
 *    T-52.2-06) — `resolveMachineCachePath` is the only place an absolute
 *    machine path is ever constructed, and only at read time.
 *
 * The layer segment literals below (`L1-17e1cc6e`) pin the FNV-1a stable
 * segment byte-for-byte to the one `efxPaintPersistence.ts` has produced since
 * 45-01, which is what lets plan 07 swap producer and guard in one step.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { createEfxPaintDocument } from '../efx-paint/document/efxPaintDocument';
import {
  EFX_PAINT_FRAMES_DIR,
  EFX_PAINT_LAYERS_DIR,
  EFX_PAINT_MACHINE_CACHE_DIR,
  PKG_FORMAT_VERSION,
  buildFrameMediaRelativePath,
  buildLayerFileRelativePath,
  buildMachineCacheRelativePath,
  buildPackageManifest,
  collectPackageCacheRefs,
  isProjectId,
  isSafeMachineCacheRelativePath,
  isSafePackageRelativePath,
  resolveMachineCachePath,
} from './efxPaintPackage';

const LAYER_ID = 'L1';
const LAYER_SEGMENT = 'L1-17e1cc6e';
const LAYER_UUID = '3f2504e0-4f89-11d3-9a0c-0305e82c3301';
const PROJECT_ID = LAYER_UUID;
const CACHE_ROOT = '/Users/x/Library/Application Support/app/frame-cache/PID';
const CACHE_REFERENCE = `efx-paint/${LAYER_SEGMENT}/T1/frame-0012.webp`;
const BACKSLASH = '\\';
const NUL = String.fromCharCode(0);
const UNSAFE_ID_MESSAGE = 'unsafe package id';

describe('package format constants', () => {
  it('exports one format-version literal every consumer imports', () => {
    expect(PKG_FORMAT_VERSION).toBe(1);
  });

  it('names the package directory segments', () => {
    expect(EFX_PAINT_LAYERS_DIR).toBe('layers');
    expect(EFX_PAINT_FRAMES_DIR).toBe('frames');
    expect(EFX_PAINT_MACHINE_CACHE_DIR).toBe('efx-paint');
  });
});

describe('layer sub-file paths (D-04)', () => {
  it('builds a layer sub-file path as layers/<layerId>.json', () => {
    expect(buildLayerFileRelativePath(LAYER_ID)).toBe('layers/L1.json');
    expect(buildLayerFileRelativePath(LAYER_UUID)).toBe(`layers/${LAYER_UUID}.json`);
  });

  const FORBIDDEN_LAYER_IDS: ReadonlyArray<readonly [string, string]> = [
    ['a forward slash', 'A/B'],
    ['a backslash', `A${BACKSLASH}B`],
    ['a NUL byte', `A${NUL}B`],
    ['the dot segment "."', '.'],
    ['the parent segment ".."', '..'],
    ['an empty id', ''],
  ];

  it.each(FORBIDDEN_LAYER_IDS)('refuses a layer id containing %s', (_label, layerId) => {
    expect(() => buildLayerFileRelativePath(layerId)).toThrow(UNSAFE_ID_MESSAGE);
  });
});

describe('frame media references (D-02)', () => {
  it('builds a media reference as frames/<layerId>/<keyId>.webp', () => {
    expect(buildFrameMediaRelativePath(LAYER_ID, 'K1')).toBe('frames/L1/K1.webp');
    expect(buildFrameMediaRelativePath(LAYER_UUID, 'key-01')).toBe(`frames/${LAYER_UUID}/key-01.webp`);
  });

  it('produces a media reference that the package path guard accepts', () => {
    expect(isSafePackageRelativePath(buildFrameMediaRelativePath(LAYER_ID, 'K1'))).toBe(true);
  });

  const FORBIDDEN_KEY_IDS: ReadonlyArray<readonly [string, string]> = [
    ['a forward slash', 'A/B'],
    ['a backslash', `A${BACKSLASH}B`],
    ['a NUL byte', `A${NUL}B`],
    ['the dot segment "."', '.'],
    ['the parent segment ".."', '..'],
    ['an empty id', ''],
  ];

  it.each(FORBIDDEN_KEY_IDS)('throws on a key id containing %s', (_label, keyId) => {
    expect(() => buildFrameMediaRelativePath(LAYER_ID, keyId)).toThrow(UNSAFE_ID_MESSAGE);
  });
});

describe('package-relative path guard (T-52.2-05)', () => {
  const SAFE_PACKAGE_PATHS = [
    'layers/L1.json',
    'frames/L1/K1.webp',
    'images/a.webp',
    'audio/take.wav',
    'scripts/x.efx-roto-script.json',
  ];

  it.each(SAFE_PACKAGE_PATHS)('accepts the package-relative path %s', (relativePath) => {
    expect(isSafePackageRelativePath(relativePath)).toBe(true);
  });

  const UNSAFE_PACKAGE_PATHS: ReadonlyArray<readonly [string, unknown]> = [
    ['an absolute POSIX path', '/abs/x.webp'],
    ['a Windows drive-letter path', `C:${BACKSLASH}Users${BACKSLASH}x.webp`],
    ['a parent traversal', '../escape'],
    ['an interior traversal', 'a/../../b'],
    ['a backslash separator', `a${BACKSLASH}b`],
    ['a NUL byte', `a${NUL}b`],
    ['an empty string', ''],
    ['the dot segment "."', '.'],
    ['a leading "./"', './a'],
    ['a UNC prefix', `${BACKSLASH}${BACKSLASH}server${BACKSLASH}share${BACKSLASH}x.webp`],
    ['a non-string value', 42],
    ['null', null],
  ];

  it.each(UNSAFE_PACKAGE_PATHS)('refuses %s as a package-relative path', (_label, relativePath) => {
    expect(isSafePackageRelativePath(relativePath)).toBe(false);
  });
});

describe('machine-local cache references (D-05)', () => {
  it('builds a cache reference as efx-paint/<layer segment>/<trackId>/frame-NNNN.webp', () => {
    expect(buildMachineCacheRelativePath('L1', 'T1', 12)).toBe('efx-paint/L1-17e1cc6e/T1/frame-0012.webp');
  });

  it('keeps the layer segment identical to the legacy FNV-1a stable segment', () => {
    expect(buildMachineCacheRelativePath(LAYER_UUID, 'T1', 1)).toBe(
      `efx-paint/${LAYER_UUID}-5e8d41a0/T1/frame-0001.webp`,
    );
  });

  it('never emits a leading cache/ prefix', () => {
    const reference = buildMachineCacheRelativePath('L1', 'T1', 12);
    expect(reference.startsWith('cache/')).toBe(false);
    expect(reference.startsWith(`${EFX_PAINT_MACHINE_CACHE_DIR}/`)).toBe(true);
  });

  it('emits a cache reference that its own guard accepts', () => {
    expect(isSafeMachineCacheRelativePath(CACHE_REFERENCE)).toBe(true);
  });

  const UNSAFE_CACHE_PATHS: ReadonlyArray<readonly [string, unknown]> = [
    ['an absolute POSIX path', '/Users/x/frame-cache/PID/efx-paint/L1/T1/frame-0001.webp'],
    ['a Windows drive-letter path', `C:${BACKSLASH}cache${BACKSLASH}efx-paint${BACKSLASH}L1${BACKSLASH}frame-0001.webp`],
    ['a UNC prefix', `${BACKSLASH}${BACKSLASH}server${BACKSLASH}share${BACKSLASH}frame-0001.webp`],
    ['the legacy package-relative cache path', 'cache/efx-paint/L1/T1/frame-0001.webp'],
    ['a parent traversal', '../efx-paint/L1/T1/frame-0001.webp'],
    ['a package path outside the cache tree', 'images/a.webp'],
    ['a bare directory name', 'efx-paint'],
    ['a non-string value', null],
  ];

  it.each(UNSAFE_CACHE_PATHS)('refuses %s as a machine cache reference', (_label, reference) => {
    expect(isSafeMachineCacheRelativePath(reference)).toBe(false);
  });
});

describe('resolveMachineCachePath (read-time absolute constructor)', () => {
  it('joins a cache reference under the machine cache root', () => {
    expect(resolveMachineCachePath(CACHE_ROOT, CACHE_REFERENCE)).toBe(`${CACHE_ROOT}/${CACHE_REFERENCE}`);
  });

  it('joins identically whether or not the root carries a trailing separator', () => {
    expect(resolveMachineCachePath(`${CACHE_ROOT}/`, CACHE_REFERENCE)).toBe(
      resolveMachineCachePath(CACHE_ROOT, CACHE_REFERENCE),
    );
  });

  it('is deterministic and idempotent for an accepted reference', () => {
    expect(resolveMachineCachePath(CACHE_ROOT, CACHE_REFERENCE)).toBe(
      resolveMachineCachePath(CACHE_ROOT, CACHE_REFERENCE),
    );
  });

  it('returns null when the reference fails the machine cache guard', () => {
    expect(resolveMachineCachePath(CACHE_ROOT, 'cache/efx-paint/L1/T1/frame-0001.webp')).toBeNull();
    expect(resolveMachineCachePath(CACHE_ROOT, '/abs/efx-paint/L1/T1/frame-0001.webp')).toBeNull();
    expect(resolveMachineCachePath(CACHE_ROOT, '../escape.webp')).toBeNull();
    expect(resolveMachineCachePath(CACHE_ROOT, '')).toBeNull();
  });

  it('returns null when the root is missing', () => {
    expect(resolveMachineCachePath('', CACHE_REFERENCE)).toBeNull();
  });
});

describe('project identity (D-05 cache root key)', () => {
  it('accepts a 36-character lower-case UUID-shaped project id', () => {
    expect(isProjectId(PROJECT_ID)).toBe(true);
  });

  const REJECTED_PROJECT_IDS: ReadonlyArray<readonly [string, unknown]> = [
    ['a short id', 'abc'],
    ['a non-uuid string', 'not-a-uuid'],
    ['an upper-case uuid', '3F2504E0-4F89-11D3-9A0C-0305E82C3301'],
    ['a uuid without dashes', '3f2504e04f8911d39a0c0305e82c3301'],
    ['a path separator', '3f2504e0/4f89/11d3/9a0c/0305e82c3301'],
    ['an empty string', ''],
    ['a non-string value', 7],
  ];

  it.each(REJECTED_PROJECT_IDS)('refuses %s as a project id', (_label, projectId) => {
    expect(isProjectId(projectId)).toBe(false);
  });
});

describe('module dependencies', () => {
  it('imports nothing, so a rescue script can load the format contract standalone', () => {
    const source = readFileSync(fileURLToPath(new URL('./efxPaintPackage.ts', import.meta.url)), 'utf8');
    const importLines = source.split('\n').filter((line) => /^\s*(import|export\s+.*\bfrom)\b/.test(line));
    expect(importLines).toEqual([]);
  });
});

/**
 * The manifest is `project.mce`: the main editor's own project fields carried
 * through untouched, plus this package's index and identity. Layer content
 * lives in `layers/<layerId>.json` only (D-04), so nothing that belongs to a
 * document may appear here.
 */
describe('package manifest assembly (D-04)', () => {
  const MAIN_EDITOR_PROJECT = Object.freeze({
    version: 14,
    name: 'demo',
    fps: 24,
    width: 1920,
    height: 1080,
    created_at: '2026-01-01T00:00:00Z',
    modified_at: '2026-01-02T00:00:00Z',
    sequences: [],
    images: [],
  });

  const LAYER_INDEX = Object.freeze({
    'layer-abc': Object.freeze({
      layerFile: 'layers/layer-abc.json',
      documentRevision: 'doc-rev-1',
      compositeRevision: 'composite-rev-1',
    }),
  });

  const LAYER_CONTENT_KEYS = ['tracks', 'background', 'photoReference'] as const;

  it('returns exactly the project fields plus efxPaint, formatVersion and projectId', () => {
    const manifest = buildPackageManifest({
      project: MAIN_EDITOR_PROJECT,
      layerIndex: LAYER_INDEX,
      projectId: PROJECT_ID,
    });
    expect(Object.keys(manifest).sort()).toEqual([
      'created_at',
      'efxPaint',
      'formatVersion',
      'fps',
      'height',
      'images',
      'modified_at',
      'name',
      'projectId',
      'sequences',
      'version',
      'width',
    ]);
  });

  it('carries the project fields, the index, the format version and the project id verbatim', () => {
    const manifest = buildPackageManifest({
      project: MAIN_EDITOR_PROJECT,
      layerIndex: LAYER_INDEX,
      projectId: PROJECT_ID,
    });
    expect(manifest.name).toBe('demo');
    expect(manifest.version).toBe(14);
    expect(manifest.sequences).toEqual([]);
    expect(manifest.efxPaint).toEqual(LAYER_INDEX);
    expect(manifest.formatVersion).toBe(PKG_FORMAT_VERSION);
    expect(manifest.projectId).toBe(PROJECT_ID);
  });

  it.each(LAYER_CONTENT_KEYS)('never carries a %s field (D-04)', (key) => {
    const manifest = buildPackageManifest({
      project: MAIN_EDITOR_PROJECT,
      layerIndex: LAYER_INDEX,
      projectId: PROJECT_ID,
    });
    expect(manifest).not.toHaveProperty(key);
  });

  it('drops the main-editor efx_paint_documents carrier, whose content is now the layer sub-files', () => {
    const manifest = buildPackageManifest({
      project: { ...MAIN_EDITOR_PROJECT, efx_paint_documents: { 'layer-abc': { version: 1 } } },
      layerIndex: LAYER_INDEX,
      projectId: PROJECT_ID,
    });
    expect(manifest).not.toHaveProperty('efx_paint_documents');
    expect(Object.keys(manifest).sort()).toEqual([
      'created_at',
      'efxPaint',
      'formatVersion',
      'fps',
      'height',
      'images',
      'modified_at',
      'name',
      'projectId',
      'sequences',
      'version',
      'width',
    ]);
  });

  it.each(LAYER_CONTENT_KEYS)('refuses a project carrying layer content in %s', (key) => {
    expect(() => buildPackageManifest({
      project: { ...MAIN_EDITOR_PROJECT, [key]: [] },
      layerIndex: LAYER_INDEX,
      projectId: PROJECT_ID,
    })).toThrow(new RegExp(key));
  });
});

/**
 * The D-05 enforcement point plan 07 runs over every changed layer document
 * before staging it: every reference collected here is machine-relative, and
 * the legacy package-relative `cache/efx-paint/...` shape is a refusal rather
 * than a value that silently reaches a package file.
 */
describe('collectPackageCacheRefs (D-05)', () => {
  const layerDocument = (
    frames: Record<number, { readonly cachePath?: unknown; readonly width?: unknown; readonly height?: unknown }>,
  ) => ({
    tracks: [{ id: 'T1', frames }],
  });

  it('accepts the real document model with no adapter', () => {
    expect(collectPackageCacheRefs([createEfxPaintDocument('layer-abc')])).toEqual([]);
  });

  it('returns every persisted cache reference in the layer documents', () => {
    const first = `efx-paint/${LAYER_SEGMENT}/T1/frame-0001.webp`;
    const second = `efx-paint/${LAYER_SEGMENT}/T1/frame-0002.webp`;
    const refs = collectPackageCacheRefs([
      layerDocument({ 1: { cachePath: first, width: 10, height: 10 } }),
      layerDocument({ 2: { cachePath: second, width: 10, height: 10 } }),
    ]);
    expect(refs).toEqual([first, second]);
  });

  it('emits only references its own machine cache guard accepts', () => {
    const refs = collectPackageCacheRefs([
      layerDocument({ 1: { cachePath: buildMachineCacheRelativePath('L1', 'T1', 1), width: 1, height: 1 } }),
    ]);
    expect(refs).toHaveLength(1);
    for (const reference of refs) expect(isSafeMachineCacheRelativePath(reference)).toBe(true);
  });

  it('resolves every collected reference deterministically and idempotently', () => {
    const refs = collectPackageCacheRefs([
      layerDocument({ 12: { cachePath: buildMachineCacheRelativePath('L1', 'T1', 12), width: 1, height: 1 } }),
    ]);
    for (const reference of refs) {
      const resolved = resolveMachineCachePath(CACHE_ROOT, reference);
      expect(resolved).toBe(`${CACHE_ROOT}/${reference}`);
      expect(resolveMachineCachePath(CACHE_ROOT, reference)).toBe(resolved);
    }
  });

  it('returns nothing for a document whose tracks carry no frames', () => {
    expect(collectPackageCacheRefs([{ tracks: [] }])).toEqual([]);
    expect(collectPackageCacheRefs([layerDocument({})])).toEqual([]);
  });

  it('skips a frame that carries no cache reference at all', () => {
    expect(collectPackageCacheRefs([layerDocument({ 1: { width: 10, height: 10 } })])).toEqual([]);
  });

  const REFUSED_CACHE_PATHS: ReadonlyArray<readonly [string, string]> = [
    ['the legacy package-relative cache path', 'cache/efx-paint/L1/T1/frame-0001.webp'],
    ['an absolute machine path', `${CACHE_ROOT}/efx-paint/L1/T1/frame-0001.webp`],
    ['a parent traversal', '../efx-paint/L1/T1/frame-0001.webp'],
    ['a Windows drive-letter path', `C:${BACKSLASH}efx-paint${BACKSLASH}L1${BACKSLASH}frame-0001.webp`],
    ['a path outside the cache tree', 'frames/L1/K1.webp'],
    ['a bare directory name', 'efx-paint'],
  ];

  it.each(REFUSED_CACHE_PATHS)('refuses %s as a persisted cache reference', (_label, cachePath) => {
    expect(() => collectPackageCacheRefs([
      layerDocument({ 1: { cachePath, width: 10, height: 10 } }),
    ])).toThrow(/legacy|machine-relative/);
  });

  it('names the offending value in the refusal so a legacy package is diagnosable', () => {
    expect(() => collectPackageCacheRefs([
      layerDocument({ 7: { cachePath: 'cache/efx-paint/L1/T1/frame-0007.webp', width: 10, height: 10 } }),
    ])).toThrow(/cache\/efx-paint\/L1\/T1\/frame-0007\.webp/);
  });
});
