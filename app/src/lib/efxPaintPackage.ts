/**
 * 52.2-02: the `.mce` package format contract (D-02, D-04, D-05, D-07).
 *
 * This module is the SINGLE source of the package's on-disk shape: the
 * format version literal the writer (plan 07) and the refusal gate (plan 08)
 * both import, the package-relative path rules, the `frames/<layerId>/<keyId>.webp`
 * media reference (D-02), and the machine-relative derived-frame cache
 * reference that keeps machine-local absolute paths out of the package (D-05).
 *
 * It is deliberately dependency-free — no module pulls anything in — so a
 * rescue script can load the format contract standalone, and no parse path in
 * this file can reach a store, an IPC module or a component.
 *
 * Identity: `projectId` is the package's own cache-root key. It is a
 * 36-character lower-case UUID (the shape `crypto.randomUUID()` produces and
 * the shape the manifest writer stores). It is carried IN the manifest and
 * never derived from the file path, so a package opens on a different machine
 * with the same identity.
 *
 * Break note (D-08): pre-52.2 packages are refused upstream by the
 * `formatVersion` gate; there is no back-compat branch here.
 */

/** The one format version literal: the manifest carries it, nothing duplicates it. */
export const PKG_FORMAT_VERSION = 1;

export const EFX_PAINT_LAYERS_DIR = 'layers';
export const EFX_PAINT_FRAMES_DIR = 'frames';
export const EFX_PAINT_MACHINE_CACHE_DIR = 'efx-paint';

/** One layer's per-file index entry (D-04). */
export interface EfxPaintLayerIndexEntry {
  readonly layerFile: string;
  readonly documentRevision: string;
  readonly compositeRevision: string;
}

/** The `project.mce` manifest: main-editor project passthrough plus the package index (D-04). */
export interface EfxPaintPackageManifest {
  readonly formatVersion: typeof PKG_FORMAT_VERSION;
  readonly projectId: string;
  readonly efxPaint: Readonly<Record<string, EfxPaintLayerIndexEntry>>;
}

/** The stable-hash segment algorithm `efxPaintPersistence.ts` has used since 45-01. */
function sanitizeSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 96) || 'layer';
}

/**
 * Deterministic FNV-1a stable segment for a layer id (T-45-11), byte-identical
 * to `efxPaintPersistence.ts`'s `stableSegment`. It is duplicated here on
 * purpose: importing the persistence module would pull the IPC module and the
 * Tauri fs plugin into a module the rescue script and the parser graph load,
 * and the emitted segment is pinned by test to the legacy value.
 */
function stableSegment(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `${sanitizeSegment(value)}-${(hash >>> 0).toString(16)}`;
}

/**
 * A single path segment that may be joined into a package path: non-empty, no
 * separator, no NUL, and neither the dot nor the parent segment. Layer ids and
 * key ids are opaque to this module, so this is the only thing standing between
 * a caller-supplied id and a traversal (T-52.2-05).
 */
function isSafePackageId(value: unknown): value is string {
  if (typeof value !== 'string' || value.length === 0) return false;
  if (value.includes('/') || value.includes('\\') || value.includes('\0')) return false;
  return value !== '.' && value !== '..';
}

function assertSafePackageId(value: unknown): string {
  if (!isSafePackageId(value)) throw new Error('unsafe package id');
  return value;
}

/**
 * The package-relative path rule (D-07, T-52.2-05): a plain POSIX relative
 * path with at least one segment. It rejects any leading `/` or a `\` anywhere
 * (so no absolute path and no Windows separator), any NUL, any Windows
 * drive-letter prefix, any UNC prefix, and any empty or `.`/`..` segment. This
 * is the guard that keeps absolute machine-local paths out of every package
 * file (D-05) and it is the accept-set every media reference must satisfy.
 */
export function isSafePackageRelativePath(relativePath: unknown): relativePath is string {
  if (typeof relativePath !== 'string' || relativePath.length === 0) return false;
  if (relativePath.startsWith('/') || relativePath.includes('\\') || relativePath.includes('\0')) return false;
  if (relativePath.startsWith('//')) return false;
  if (/^[A-Za-z]:/.test(relativePath)) return false;
  return relativePath
    .split('/')
    .every((segment) => segment.length > 0 && segment !== '.' && segment !== '..');
}

/** `layers/<layerId>.json` — the layer sub-file that holds the complete document (D-04). */
export function buildLayerFileRelativePath(layerId: string): string {
  return `${EFX_PAINT_LAYERS_DIR}/${assertSafePackageId(layerId)}.json`;
}

/**
 * `frames/<layerId>/<keyId>.webp` — the ONE media reference shape a persisted
 * real-key record may carry (D-02). A reference is computed before any
 * filesystem call, and an id that is not a single safe segment throws, so a
 * refusal never leaves a partially-built path behind.
 */
export function buildFrameMediaRelativePath(layerId: string, keyId: string): string {
  return `${EFX_PAINT_FRAMES_DIR}/${assertSafePackageId(layerId)}/${assertSafePackageId(keyId)}.webp`;
}

/**
 * The media reference a persisted raster owes its package (D-02, D-07): where
 * the pixels live, relative to the package root, plus the SHA-256 of the exact
 * bytes written there. This is the shape plans 06 and 09 import — the model
 * never owns it, so the dependency edge stays model-to-package.
 */
export interface FrameMediaReference {
  readonly relativePath: string;
  readonly digest: string;
  readonly width?: number;
  readonly height?: number;
}

const FRAME_MEDIA_KEYS = new Set(['relativePath', 'digest', 'width', 'height']);
const FRAME_MEDIA_DIGEST_PATTERN = /^[0-9a-f]{64}$/;

function isPositiveIntegerOrAbsent(value: unknown): boolean {
  return value === undefined || (typeof value === 'number' && Number.isInteger(value) && value > 0);
}

/**
 * Fail-closed parser for {@link FrameMediaReference} (T-52.2-05). `path` names
 * the reference's location in the message only; no filesystem call is ever
 * made here, so a refusal costs nothing and leaves nothing behind.
 *
 * Rejects non-records, unknown members, a `relativePath` that is not a safe
 * package-relative `frames/<layerId>/<keyId>.webp` reference, a `digest` that
 * is not 64 lower-case hex characters, and non-positive `width`/`height`.
 */
export function parseFrameMediaReference(value: unknown, path: string = 'media'): FrameMediaReference {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`${path}: expected a media reference record.`);
  }
  const record = value as Record<string, unknown>;
  if (!Object.keys(record).every((key) => FRAME_MEDIA_KEYS.has(key))) {
    throw new Error(`${path}: unknown members; expected exactly relativePath, digest, width, height.`);
  }
  const relativePath = record.relativePath;
  if (
    !isSafePackageRelativePath(relativePath)
    || !relativePath.startsWith(`${EFX_PAINT_FRAMES_DIR}/`)
    || !relativePath.endsWith('.webp')
  ) {
    throw new Error(`${path}: relativePath must be a safe frames/<layerId>/<keyId>.webp reference.`);
  }
  const digest = record.digest;
  if (typeof digest !== 'string' || !FRAME_MEDIA_DIGEST_PATTERN.test(digest)) {
    throw new Error(`${path}: digest must be 64 lower-case hex characters.`);
  }
  if (!isPositiveIntegerOrAbsent(record.width) || !isPositiveIntegerOrAbsent(record.height)) {
    throw new Error(`${path}: width and height must be positive integers when present.`);
  }
  return Object.freeze({
    relativePath,
    digest,
    ...(record.width !== undefined ? { width: record.width as number } : {}),
    ...(record.height !== undefined ? { height: record.height as number } : {}),
  });
}

/**
 * `efx-paint/<stableSegment(layerId)>/<trackId>/frame-NNNN.webp` — the
 * machine-RELATIVE derived-frame cache reference (D-05, D-14). The persisted
 * value is relative to `${app_data_dir}/frame-cache/<projectId>/`, so the very
 * same bytes resolve on another machine and no machine-local absolute path can
 * ever be recorded in a layer sub-file (T-52.2-06). This is the named producer
 * every call site converts to; the legacy `cache/efx-paint/...` package-
 * relative form is not produced here.
 */
export function buildMachineCacheRelativePath(layerId: string, trackId: string, appFrame: number): string {
  const segment = stableSegment(layerId);
  return `${EFX_PAINT_MACHINE_CACHE_DIR}/${segment}/${assertSafePackageId(trackId)}/frame-${String(appFrame).padStart(4, '0')}.webp`;
}

/** The machine cache reference rule: a package-relative path under `efx-paint/`, nothing else. */
export function isSafeMachineCacheRelativePath(relativePath: unknown): relativePath is string {
  if (!isSafePackageRelativePath(relativePath)) return false;
  return relativePath.startsWith(`${EFX_PAINT_MACHINE_CACHE_DIR}/`);
}

/**
 * The ONLY constructor of a machine-local absolute path (D-05): it joins a
 * validated cache reference under the machine cache root at read time. A
 * reference that fails its guard, or a missing root, returns null so the
 * caller re-derives the frame instead of reading an unvetted location.
 */
export function resolveMachineCachePath(machineCacheRoot: string, relativePath: unknown): string | null {
  if (typeof machineCacheRoot !== 'string' || machineCacheRoot.length === 0) return null;
  if (!isSafeMachineCacheRelativePath(relativePath)) return null;
  const root = machineCacheRoot.endsWith('/') ? machineCacheRoot.slice(0, -1) : machineCacheRoot;
  if (root.length === 0) return null;
  return `${root}/${relativePath}`;
}

/** Lower-case UUID shape, as produced by `crypto.randomUUID()`. */
const PROJECT_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/**
 * The manifest identity used as the cache-root key (D-05). It is stored in the
 * manifest rather than derived from the package path, so the same package
 * keeps the same identity — and therefore the same disposable cache — wherever
 * it is opened.
 */
export function isProjectId(value: unknown): value is string {
  return typeof value === 'string' && PROJECT_ID_PATTERN.test(value);
}
