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
 * `formatVersion` gate; there is no back-compat branch here — a pre-52.2
 * `efx_paint_documents` carrier is dropped from the manifest rather than
 * migrated, and a pre-52.2 `cache/efx-paint/...` reference is a refusal in
 * `collectPackageCacheRefs` rather than a value that is normalized.
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

/**
 * The `project.mce` manifest: main-editor project passthrough plus the package
 * index (D-04). The project fields are carried verbatim and are not restated
 * here — this module owns the package's own keys, never the main editor's
 * schema, which is why no `MceProject` import exists.
 */
export type EfxPaintPackageManifest = Readonly<Record<string, unknown>> & {
  readonly formatVersion: typeof PKG_FORMAT_VERSION;
  readonly projectId: string;
  readonly efxPaint: Readonly<Record<string, EfxPaintLayerIndexEntry>>;
};

/**
 * The layer-content field names the manifest must never carry (D-04): a layer
 * sub-file owns them. They are refused rather than stripped because their
 * presence means a layer document was passed where the project belongs.
 */
const MANIFEST_FORBIDDEN_LAYER_KEYS = ['tracks', 'background', 'photoReference'] as const;

/**
 * The main-editor carrier the package format replaces (D-04): the layerId →
 * document map is now `layers/<layerId>.json`, so the manifest drops it
 * instead of shipping layer content in the project file.
 */
const MANIFEST_LEGACY_LAYER_CARRIER = 'efx_paint_documents';

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

/** The three inputs `buildPackageManifest` assembles from — all pure values. */
export interface EfxPaintPackageManifestInput {
  /** The main-editor project fields, carried through untouched. */
  readonly project: Readonly<Record<string, unknown>>;
  /** `layerId` → its sub-file entry (D-04). */
  readonly layerIndex: Readonly<Record<string, EfxPaintLayerIndexEntry>>;
  /** The package identity used as the machine cache-root key (D-05). */
  readonly projectId: string;
}

/**
 * Assemble the `project.mce` manifest (D-04): the main editor's project fields
 * passed through, plus `efxPaint` (the layer index), `formatVersion` and
 * `projectId`. Pure over plain objects, so the writer in plan 07 calls it
 * without touching a store.
 *
 * Two layer-content rules are enforced here rather than trusted:
 * the legacy `efx_paint_documents` carrier is DROPPED — its content is now the
 * layer sub-files, and shipping it would put a document back inside the
 * project file; and a project carrying `tracks`/`background`/`photoReference`
 * throws, because those names mean a layer document reached this call.
 */
export function buildPackageManifest(input: EfxPaintPackageManifestInput): EfxPaintPackageManifest {
  const { project, layerIndex, projectId } = input;
  for (const key of MANIFEST_FORBIDDEN_LAYER_KEYS) {
    if (Object.prototype.hasOwnProperty.call(project, key)) {
      throw new Error(
        `buildPackageManifest: project carries layer content in "${key}"; layer content belongs in the layer sub-file (D-04).`,
      );
    }
  }
  const manifestFields: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(project)) {
    if (key === MANIFEST_LEGACY_LAYER_CARRIER) continue;
    manifestFields[key] = value;
  }
  manifestFields.formatVersion = PKG_FORMAT_VERSION;
  manifestFields.projectId = projectId;
  manifestFields.efxPaint = layerIndex;
  return Object.freeze(manifestFields) as EfxPaintPackageManifest;
}

/**
 * A layer sub-file's persisted cache-reference site (D-05), declared
 * structurally so this module keeps its no-import rule while accepting the
 * document model's `EfxPaintDocument` verbatim. Only `cachePath` is
 * interpreted; `width`/`height` are named because the persisted record is a
 * `CachedFrameReference` and the shape is documented where it is walked.
 */
export interface EfxPaintCacheRefDocument {
  readonly tracks: readonly {
    readonly frames?: Readonly<Record<number, {
      readonly cachePath?: unknown;
      readonly width?: unknown;
      readonly height?: unknown;
    }>>;
  }[];
}

/**
 * Collect every persisted cache reference in the given layer documents (D-05)
 * and refuse any value that is not machine-relative.
 *
 * This is the enforcement point plan 07 runs over each changed layer document
 * immediately before that document is serialized into a layer sub-file: the
 * legacy `cache/efx-paint/...` shape and every absolute path are refusals
 * here, so a machine-coupled reference cannot reach a package at all. The
 * offending value is named in the message so a pre-52.2 package is
 * diagnosable. A frame with no `cachePath` is not a reference and is skipped;
 * a present-but-invalid value is never silently accepted.
 */
export function collectPackageCacheRefs(
  layerDocuments: Iterable<EfxPaintCacheRefDocument>,
): readonly string[] {
  const references: string[] = [];
  for (const document of layerDocuments) {
    for (const track of document.tracks) {
      const frames = track.frames;
      if (frames === undefined) continue;
      for (const frame of Object.values(frames)) {
        const cachePath = frame?.cachePath;
        if (cachePath === undefined) continue;
        if (!isSafeMachineCacheRelativePath(cachePath)) {
          throw new Error(
            `collectPackageCacheRefs: "${String(cachePath)}" is not a machine-relative reference `
            + `(expected an ${EFX_PAINT_MACHINE_CACHE_DIR}/... path); the legacy cache/efx-paint/... shape cannot be written into a package (D-05).`,
          );
        }
        references.push(cachePath);
      }
    }
  }
  return Object.freeze(references);
}
