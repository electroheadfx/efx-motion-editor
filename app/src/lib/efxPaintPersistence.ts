/**
 * v1.0 EFX Paint package persistence service (Phase 45-04, package save 52.2-07).
 *
 * The TS side of the `.mce` package format: `savePackage` is the save funnel.
 * Every authoritative file — the `project.mce` manifest, one
 * `layers/<layerId>.json` sub-file per changed paint layer, and one
 * `frames/<layerId>/<keyId>.webp` media file per changed key (BOTH roto
 * collections) — is staged under `<package>/<staging basename>/` and reaches
 * its canonical path only through the plan-05 package transaction's publish
 * step. Only CHANGED files are written (D-11) and an empty change set touches
 * no disk at all. No path serializes the whole project into one string, and no
 * emitted file carries an image payload or a machine-local path (Law 1, D-05,
 * D-07).
 *
 * A second, MACHINE-LOCAL and best-effort leg stages derived-frame sidecars
 * under `<app_data_dir>/frame-cache/<projectId>` (D-05, D-14). It never rides
 * the authoritative transaction and a cache failure never fails the save.
 * IMMUTABILITY LAW (52.1 a2): canonical sidecars under `<cache root>/efx-paint/`
 * are NEVER written in place. They are replaced only by the native atomic
 * directory swap (`publish_physic_paint_cache_generation`). Incremental
 * staging hardlinks unchanged sidecars into the staging generation, so any
 * future in-place writer would silently alias through those hardlinks and
 * corrupt the canonical generation. Do not add an in-place write path.
 *
 * The document model's track frames are `CachedFrameReference` sidecar refs
 * carrying a machine-relative
 * `efx-paint/<stableSegment>/<trackId>/frame-NNNN.webp` reference. Loading
 * validates every document through the fail-closed
 * `parseEfxPaintDocument(value, 'reference-only')` door (T-45-13) and guards
 * every reference with plan 02's `isSafeMachineCacheRelativePath` (T-45-11,
 * ASVS V12).
 */

import { exists, mkdir, remove, writeFile } from '@tauri-apps/plugin-fs';
import type { EfxPaintDocument } from '../efx-paint/document/efxPaintDocument';
import { parseEfxPaintDocument } from '../efx-paint/document/efxPaintDocumentParsers';
import {
  buildEfxPaintCompositeRevision,
  buildEfxPaintDocumentRevision,
} from '../efx-paint/document/efxPaintDocumentRevision';
import { hashCanonicalPhysicalValue } from '../efx-paint/document/efxPaintCanonicalEncoder';
import {
  buildPhysicPaintRotoPayloadContentToken,
  buildPhysicPaintRotoPhysicalRevision,
  parsePhysicPaintRotoPhysicalDocument,
  type PhysicPaintRotoPhysicalDocument,
  type PhysicPaintRotoRealKeyPayload,
  type PhysicPaintRotoRealKeyRecord,
} from '../components/physic-paint/roto/physicsPaintRotoPhysicalModel';
import {
  PhysicPaintRotoMediaProjectionError,
  toPersistedRotoRecords,
  type PhysicPaintRotoMediaReferenceResolver,
} from '../components/physic-paint/roto/physicsPaintRotoMediaProjection';
import { buildFrameBytesToken, type PhysicPaintRenderedFrame } from '../types/physicPaint';
import type { MceProject } from '../types/project';
import {
  bindEfxPaintPackageTransaction,
  hardlinkPhysicPaintCacheFrames,
  ipcEfxPaintWriteFrameMedia,
  projectSave as ipcProjectSave,
  publishEfxPaintPackageTransaction,
  publishPhysicPaintCacheGeneration,
  settleEfxPaintPackageTransaction,
  settlePhysicPaintCacheGeneration,
  type EfxPaintMediaFailure,
} from './ipc';
// 52.2-07 (D-05): the machine-relative reference, its guard and its one
// absolute-path constructor all come from plan 02 — no second copy here.
import {
  buildLayerFileRelativePath,
  buildPackageManifest,
  collectPackageCacheRefs,
  EFX_PAINT_LAYERS_DIR,
  EFX_PAINT_MACHINE_CACHE_DIR,
  isSafeMachineCacheRelativePath,
  resolveMachineCachePath,
  type EfxPaintLayerIndexEntry,
  type EfxPaintPackageManifest,
  type FrameMediaReference,
} from './efxPaintPackage';

export const EFX_PAINT_STAGING_PREFIX = '.efx-paint-staging-';

/**
 * The package staging-root name rule, kept byte-identical to the Rust
 * `PACKAGE_STAGING_PREFIX` in `services/efx_paint_media.rs` (one prefix, two
 * readers): the caller NAMES the staging generation, and the Rust bind is the
 * authority that refuses a basename it does not recognize.
 */
export const EFX_PAINT_PACKAGE_STAGING_PREFIX = '.efx-paint-package-staging-';
/** The manifest file name inside the package (D-02). */
export const EFX_PAINT_PACKAGE_MANIFEST_FILE = 'project.mce';

/**
 * One layer's save input: the document plus the runtime frame bytes to stage.
 * Frames are carried per track (trackId → appFrame → frame) so two tracks may
 * persist frames at the same appFrame without collision (46-02, edge TRK-03
 * ordering resolved explicit). `deletions` lists machine-relative sidecar
 * directories under `efx-paint/` to remove in the same transaction as the save
 * (46-05 TRK-07 D-15, 52.2-07 D-05) — the commit arm removes them from the
 * machine cache root, rollback never touches them. Every entry must pass
 * `isSafeMachineCacheRelativePath`.
 */
export interface EfxPaintDocumentSaveInput {
  readonly document: EfxPaintDocument;
  readonly frames: ReadonlyMap<string, ReadonlyMap<number, PhysicPaintRenderedFrame>>;
  readonly deletions?: readonly string[];
}

/**
 * One layer's load result: the validated document plus hydrated runtime
 * frames keyed per track (trackId → appFrame → frame, 46-02).
 *
 * `frames` is EMPTY under the package format: a `PhysicPaintRenderedFrame`
 * requires `bytes`, the package carries references only (D-07) and no code path
 * reads a derived-frame cache FILE (D-14) — so the load installs no placeholder
 * buffer claiming to be content. `cacheLocations` carries the derived-frame
 * location the persisted machine-RELATIVE reference recomputes to
 * (trackId → appFrame → machine-local path, D-05); a null root or an absent
 * file yields no entry (the frame re-derives).
 */
export interface EfxPaintLoadedDocument {
  readonly document: EfxPaintDocument;
  readonly frames: ReadonlyMap<string, ReadonlyMap<number, PhysicPaintRenderedFrame>>;
  readonly cacheLocations: ReadonlyMap<string, ReadonlyMap<number, string>>;
}

type PendingWrite = { readonly path: string; readonly bytes: Uint8Array };

/**
 * Content-fingerprint dedup cache (mirrors savedOutputCache): keyed by the
 * save fingerprint (document revisions + frame byte terms), populated only
 * after a successful commit. A no-op save skips derived-frame staging entirely
 * (T-45-12 idempotency edge).
 */
const savedCacheFingerprints = new Set<string>();

/**
 * Last-saved per-frame byte tokens, keyed `layerId:trackId:appFrame` (52.1 a2).
 * Populated only after a successful commit; the changed set on the next save is
 * every frame whose current token differs from this map. Empty after a restart
 * (or a first save), which forces a full re-stage — the fail-closed default.
 */
const savedFrameTokens = new Map<string, string>();

// --- 52.2-07 Task 1 (D-11): the file-keyed change-token model -------------

/** The three kinds of authoritative file a package save can rewrite. */
export type PackageFileTokenKind = 'manifest' | 'layer' | 'frame';

/**
 * The file-identity token for one authoritative package file:
 * `frame:<layerId>:<keyId>` (one media file per key identity, D-09),
 * `layer:<layerId>` (one sub-file per layer, D-09) or `manifest` (the one
 * `project.mce`). Identity is the keyId — never the appFrame and never a
 * collection marker: keyIds are unique across `realKeyRecords` and
 * `groupOverrideRecords`, and one keyId placed at several frames owns exactly
 * one media file.
 */
export function packageFileToken(kind: 'manifest'): string;
export function packageFileToken(kind: 'layer', layerId: string): string;
export function packageFileToken(kind: 'frame', layerId: string, keyId: string): string;
export function packageFileToken(kind: PackageFileTokenKind, layerId?: string, keyId?: string): string {
  if (kind === 'manifest') return 'manifest';
  if (kind === 'layer') {
    if (typeof layerId !== 'string' || layerId.length === 0) {
      throw new Error('packageFileToken: a layer token needs its layerId.');
    }
    return `layer:${layerId}`;
  }
  if (kind === 'frame') {
    if (typeof layerId !== 'string' || layerId.length === 0 || typeof keyId !== 'string' || keyId.length === 0) {
      throw new Error('packageFileToken: a frame token needs its layerId and keyId.');
    }
    return `frame:${layerId}:${keyId}`;
  }
  throw new Error(`packageFileToken: unknown token kind "${String(kind)}".`);
}

/** One changed authoritative file: its token plus the value it must be saved at. */
export interface PackageChangedFile {
  readonly token: string;
  readonly value: string;
}

/**
 * The changed files between two token maps, sorted by token so the write set is
 * deterministic. Values are opaque: the payload content token of a key's media
 * for `frame:` tokens, the layer document's revision token for `layer:`, the
 * manifest's own revision for `manifest`. A token absent from `previousTokens`
 * counts as changed, so the first save against an empty map returns the
 * complete set and an identical input returns an empty set.
 */
export function computeChangedFiles(
  previousTokens: ReadonlyMap<string, string>,
  nextTokens: ReadonlyMap<string, string>,
): readonly PackageChangedFile[] {
  const changed: PackageChangedFile[] = [];
  for (const [token, value] of nextTokens) {
    if (previousTokens.get(token) !== value) changed.push(Object.freeze({ token, value }));
  }
  changed.sort((left, right) => (left.token < right.token ? -1 : left.token > right.token ? 1 : 0));
  return Object.freeze(changed);
}

/**
 * One roto document's media-bearing collections, structurally typed so this
 * module owns no roto import. `appFrame` is accepted and deliberately ignored:
 * a key's placement is not part of its media identity (one keyId, one file).
 */
export interface PackageRotoMediaSource {
  readonly realKeyRecords?: readonly { readonly keyId: string; readonly appFrame?: number }[];
  readonly groupOverrideRecords?: readonly { readonly keyId: string; readonly appFrame?: number }[];
}

/**
 * Every keyId a layer's media files are keyed by: BOTH persisted roto
 * collections of every source (track), deduplicated by keyId — one keyId placed
 * at several frames is ONE media file — and sorted so the write set is
 * deterministic. A keyId carried by both collections of one document is refused
 * before any media is written: the two records would share one
 * `frames/<layerId>/<keyId>.webp` and one record's pixels would silently
 * overwrite the other's.
 */
export function collectLayerMediaKeyIds(sources: Iterable<PackageRotoMediaSource>): readonly string[] {
  const keyIds = new Set<string>();
  for (const source of sources) {
    const ordinaryKeyIds = new Set<string>();
    for (const record of source.realKeyRecords ?? []) ordinaryKeyIds.add(record.keyId);
    for (const record of source.groupOverrideRecords ?? []) {
      if (ordinaryKeyIds.has(record.keyId)) {
        throw new Error(
          `EFX Paint package media keyId "${record.keyId}" is shared by realKeyRecords and groupOverrideRecords; one keyId owns exactly one media file.`,
        );
      }
      keyIds.add(record.keyId);
    }
    for (const keyId of ordinaryKeyIds) keyIds.add(keyId);
  }
  return Object.freeze(Array.from(keyIds).sort());
}

/**
 * The last committed token map — the baseline the next save compares against
 * (D-11). Populated only by a committed save; empty after a restart, which
 * forces a complete first save (the fail-closed default).
 */
const packageFileTokens = new Map<string, string>();

/** The last committed token map, read-only for the caller. */
export function getPackageFileTokens(): ReadonlyMap<string, string> {
  return packageFileTokens;
}

/**
 * Adopt a save's token map on commit, or drop it on rollback.
 *
 * Commit replaces the baseline with the saved set, so a second identical save
 * finds an empty change set. Rollback keeps the previous baseline: the files
 * the failed save had staged are still different from what is committed under
 * the canonical paths, so the next save re-writes exactly them.
 */
export function settlePackageFileTokens(
  action: 'commit' | 'rollback',
  nextTokens?: ReadonlyMap<string, string>,
): void {
  if (action === 'rollback') return;
  if (!nextTokens) throw new Error('settlePackageFileTokens: a commit needs the saved token map.');
  packageFileTokens.clear();
  for (const [token, value] of nextTokens) packageFileTokens.set(token, value);
}

/**
 * The package root the committed baseline (change tokens + media references)
 * belongs to. A token names a file identity INSIDE one package, so a baseline
 * carried across two package roots would report another package's files as
 * unchanged and silently skip their write — Save As would publish a
 * destination missing its layers. A save against a different root therefore
 * starts from an empty baseline, the fail-closed default.
 */
let packageBaselineRoot: string | null = null;

/**
 * The media references the last committed save minted, keyed
 * `<layerId>\0<keyId>`. They are reused for a key whose content token did not
 * change, so an unchanged key's digest is never re-derived (the digest is the
 * native write's SHA-256, which JS cannot compute) and never invented. A miss
 * is fail-closed: the key is written fresh.
 */
const savedMediaReferences = new Map<string, FrameMediaReference>();

function mediaReferenceKey(layerId: string, keyId: string): string {
  return `${layerId}\u0000${keyId}`;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function sanitizeSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 96) || 'layer';
}

/** Deterministic FNV-1a stable segment for a layer id (T-45-11). */
export function stableSegment(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `${sanitizeSegment(value)}-${(hash >>> 0).toString(16)}`;
}

/**
 * A machine-relative cache reference minus its `efx-paint/` generation
 * prefix — the path shape plan 05's cache transaction addresses (the Rust
 * side joins it onto the canonical generation AND onto the staging
 * generation; see `hardlink_cache_frames`). Staging writes use it so a staged
 * file lands at the same generation-relative location the canonical swap will
 * publish.
 */
function generationRelativeCachePath(cacheRef: string): string {
  return cacheRef.slice(EFX_PAINT_MACHINE_CACHE_DIR.length + 1);
}

async function ensureDir(path: string): Promise<void> {
  if (!(await exists(path))) await mkdir(path, { recursive: true });
}

function createStagingBasename(): string {
  return `${EFX_PAINT_STAGING_PREFIX}${crypto.randomUUID()}`;
}

/**
 * The package staging basename (52.2-05 Task 3). The caller names the
 * generation; the root the staged files land in is derived in Rust from the
 * package root, so no caller-supplied destination root ever crosses the
 * boundary (T-52.2-14). The basename is minted here — beside the cache
 * basename — so both prefixes have exactly one TS reader.
 */
export function createPackageStagingBasename(): string {
  return `${EFX_PAINT_PACKAGE_STAGING_PREFIX}${crypto.randomUUID()}`;
}

async function removeStagingGeneration(path: string): Promise<void> {
  try {
    await remove(path, { recursive: true });
  } catch {
    // Staging cleanup is non-authoritative. Canonical publication state is
    // determined only by the native publication result.
  }
}

/**
 * The machine-local derived-frame cache leg's prepared state (52.1 a2, D-14).
 *
 * 52.2-07 Task 3: this leg is deliberately SMALL — it stages, publishes and
 * settles the derived-frame generation under the machine cache root and knows
 * nothing about the package. It is best-effort by contract: it never rides the
 * authoritative package transaction, and no cache failure may fail the save.
 */
interface PreparedEfxPaintCacheLeg {
  readonly fingerprint: string | null;
  readonly publication: Readonly<{
    transactionId: string;
  }> | null;
  readonly removeCanonicalAfterCommit: boolean;
  /** Sidecar directories to remove in the commit arm (46-05 D-15). */
  readonly deletions: readonly string[];
  /** Per-frame byte tokens (`layerId:trackId:appFrame` → token) to cache on commit (52.1 a2). */
  readonly frameTokens: ReadonlyMap<string, string>;
}

/** One changed key's raster, resolved to the reference the sub-file will carry. */
interface PreparedPackageFrame {
  readonly keyId: string;
  /** The `frame:<layerId>:<keyId>` change token (D-09/D-11). */
  readonly token: string;
  /** The payload's content token: the byte token for runtime bytes, `media:<digest>` for a reference. */
  readonly contentToken: string;
  readonly payload: PhysicPaintRotoRealKeyPayload;
}

/**
 * One layer's complete write plan (52.2-07 Task 3, D-09/D-11): everything the
 * write phase needs is computed BEFORE the first disk write, so a refusal
 * (a legacy cache reference, a keyId shared by the layer's two roto
 * collections) happens before any file exists.
 */
interface PreparedPackageLayer {
  readonly layerId: string;
  readonly document: EfxPaintDocument;
  /** `layers/<layerId>.json`, the layer sub-file's package-relative path. */
  readonly layerFile: string;
  readonly documentRevision: string;
  readonly compositeRevision: string;
  /** The `layer:<layerId>` change token. */
  readonly layerToken: string;
  readonly frames: readonly PreparedPackageFrame[];
}

/**
 * A per-key media write the native command refused (D-13). The failure CLASS
 * is preserved — `missing` is the Phase 49 slate path, `refused` fails closed,
 * `io` covers everything else — and the layer/key pair is carried, so a caller
 * can route and name the refusal without re-deriving which record it was.
 */
export class EfxPaintMediaWriteError extends Error {
  readonly layerId: string;
  readonly keyId: string;
  readonly failure: EfxPaintMediaFailure;

  constructor(layerId: string, keyId: string, failure: EfxPaintMediaFailure) {
    super(`EFX Paint frame media write failed for layer "${layerId}" key "${keyId}" (${failure.kind}).`);
    this.name = 'EfxPaintMediaWriteError';
    this.layerId = layerId;
    this.keyId = keyId;
    this.failure = failure;
  }
}

/**
 * Project one roto record collection through plan 06's typed projection,
 * shipping its failure as the projection's own error (a seam whose contract is
 * a return value can only signal a failed projection by throwing).
 */
function projectRotoCollection(
  records: readonly PhysicPaintRotoRealKeyRecord[],
  resolveRef: PhysicPaintRotoMediaReferenceResolver,
): readonly PhysicPaintRotoRealKeyRecord[] {
  const projected = toPersistedRotoRecords(records, resolveRef);
  if (!projected.ok) throw new PhysicPaintRotoMediaProjectionError(projected.failure);
  return projected.records;
}

/**
 * Project one runtime layer document into its persisted (media-only) shape
 * (D-06/D-07, Law 1): every record of BOTH roto collections of EVERY track is
 * rebuilt from the reference `resolveRef` returns for its keyId, so no raster
 * payload can survive into the emitted JSON — enumerating only
 * `realKeyRecords` would stage a layer whose group overrides still carry
 * payloads, which plan 02's parser refuses wholesale on reopen.
 *
 * The track's physical `revision` is RECOMPUTED over the projected records:
 * the persisted revision is a function of the references (plan 02's
 * reference-total encoding), and the on-disk parser recomputes and compares
 * exactly this value — spreading the runtime revision would hand the read-back
 * leg a document it must refuse.
 *
 * A key with no resolvable reference is a typed
 * {@link PhysicPaintRotoMediaProjectionError}, never a record without media.
 */
export function projectLayerDocument(
  document: EfxPaintDocument,
  resolveRef: PhysicPaintRotoMediaReferenceResolver,
): EfxPaintDocument {
  const tracks = document.tracks.map((track) => {
    const physical: PhysicPaintRotoPhysicalDocument | null = track.rotoPhysical;
    if (physical === null) return track;
    const realKeyRecords = projectRotoCollection(physical.realKeyRecords, resolveRef);
    const groupOverrideRecords = projectRotoCollection(physical.groupOverrideRecords ?? [], resolveRef);
    const rotoPhysical = parsePhysicPaintRotoPhysicalDocument(
      {
        ...physical,
        realKeyRecords,
        groupOverrideRecords,
        revision: buildPhysicPaintRotoPhysicalRevision(
          realKeyRecords,
          physical.interpolation,
          physical.loopClips,
          physical.incomingInterpolationBreakKeyIds,
          groupOverrideRecords,
        ),
      },
      // The persisted reading: the projected records carry media references
      // and no bytes, which is exactly what the on-disk door accepts.
      'reference-only',
    );
    return { ...track, rotoPhysical };
  });
  return { ...document, tracks };
}

/**
 * Compute every write-plan field for one layer, purely: parse through the
 * fail-closed runtime parser, refuse a document whose cache references are not
 * machine-relative (`collectPackageCacheRefs`, T-52.2-56), refuse a keyId
 * shared by the layer's two roto collections BEFORE any media write
 * (`collectLayerMediaKeyIds`), and derive the frame/layer change tokens.
 */
function preparePackageLayer(layerId: string, input: EfxPaintDocumentSaveInput): PreparedPackageLayer {
  const document = parseEfxPaintDocument(input.document);
  // 52.2-07 (D-05, T-52.2-56): a legacy package-relative reference (or an
  // absolute path) is a refusal here rather than a value written into a
  // sub-file that would only open on the machine that wrote it.
  collectPackageCacheRefs([document]);

  const sources: PackageRotoMediaSource[] = [];
  const payloads = new Map<string, PhysicPaintRotoRealKeyPayload>();
  for (const track of document.tracks) {
    const physical = track.rotoPhysical;
    if (physical === null) continue;
    sources.push(physical);
    // keyIds are unique across a layer's two collections (the override-creation
    // path enforces it against the union), so the first payload per keyId is
    // the only one and no collection marker belongs in the key.
    for (const record of [...physical.realKeyRecords, ...(physical.groupOverrideRecords ?? [])]) {
      if (!payloads.has(record.keyId)) payloads.set(record.keyId, record.payload);
    }
  }

  const frames: PreparedPackageFrame[] = [];
  for (const keyId of collectLayerMediaKeyIds(sources)) {
    const payload = payloads.get(keyId);
    if (payload === undefined) {
      throw new Error(`EFX Paint package media keyId "${keyId}" has no record in layer "${layerId}".`);
    }
    frames.push(Object.freeze({
      keyId,
      token: packageFileToken('frame', layerId, keyId),
      contentToken: buildPhysicPaintRotoPayloadContentToken(payload),
      payload,
    }));
  }

  return Object.freeze({
    layerId,
    document,
    layerFile: buildLayerFileRelativePath(layerId),
    documentRevision: buildEfxPaintDocumentRevision(document),
    compositeRevision: buildEfxPaintCompositeRevision(document),
    layerToken: packageFileToken('layer', layerId),
    frames: Object.freeze(frames),
  });
}

/**
 * A semantic fingerprint of the manifest's own content, excluding its volatile
 * members: the caller re-mints `created_at`/`modified_at` on every build, so
 * including them would put the manifest in EVERY change set and break the
 * no-op-save contract (D-11, T-52.2-23). Everything else is a pure function of
 * store state, so an unchanged project yields an unchanged token.
 */
function buildManifestContentToken(manifest: EfxPaintPackageManifest): string {
  const stable: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(manifest)) {
    if (VOLATILE_MANIFEST_KEYS.has(key)) continue;
    stable[key] = value;
  }
  return `manifest-${hashCanonicalPhysicalValue(JSON.stringify(stable))}`;
}

/** The manifest members the caller re-mints on every build (never content). */
const VOLATILE_MANIFEST_KEYS: ReadonlySet<string> = new Set(['created_at', 'modified_at']);

/**
 * Deterministic save fingerprint: the 45-01 document revision per layer plus
 * the runtime frame byte terms (dataUrls). The byte terms are required — a
 * repaint changes the bytes while the document cachePath refs stay the same,
 * so a document-only fingerprint would wrongly skip re-staging. Every term
 * includes the trackId (trackId:appFrame:dataUrl) so identical bytes on
 * distinct tracks stay distinct terms (T-46-06).
 */
function buildEfxPaintSaveFingerprint(
  projectDir: string,
  documents: ReadonlyMap<string, EfxPaintDocumentSaveInput>,
): string {
  const terms: string[] = [];
  for (const [layerId, input] of documents) {
    const document = parseEfxPaintDocument(input.document);
    terms.push(`${layerId.length}:${layerId}:${buildEfxPaintDocumentRevision(document)}`);
    for (const track of document.tracks) {
      const trackFrames = input.frames.get(track.id);
      if (!trackFrames) continue;
      for (const [appFrame, frame] of trackFrames) {
        terms.push(`${track.id}:${appFrame}:${buildFrameBytesToken(frame.bytes)}`);
      }
    }
  }
  return `${projectDir}\0${terms.sort().join('\0')}`;
}

async function stageFrame(
  cacheRoot: string,
  stagingBasename: string,
  write: PendingWrite,
  ensuredDirectories: Set<string>,
): Promise<void> {
  const stagingRelativePath = `${stagingBasename}/${generationRelativeCachePath(write.path)}`;
  const directory = stagingRelativePath.slice(0, stagingRelativePath.lastIndexOf('/'));
  if (!ensuredDirectories.has(directory)) {
    await mkdir(`${cacheRoot}/${directory}`, { recursive: true });
    ensuredDirectories.add(directory);
  }
  await writeFile(`${cacheRoot}/${stagingRelativePath}`, write.bytes);
}

/**
 * Hardlink unchanged sidecars into the staging generation, returning the frames
 * that must instead be written fresh. A hardlink failure (EXDEV/EPERM — the
 * canonical and staging dirs are not on the same volume, or the filesystem
 * forbids hardlinks) degrades to a full re-stage of every unchanged frame;
 * a missing source (ENOENT) is written fresh for that frame only.
 *
 * 52.2-07 (D-05): the root passed to the native hardlink is the machine cache
 * root and every path handed over is GENERATION-relative (the reference minus
 * its `efx-paint/` prefix) — the Rust side joins it onto both the canonical
 * `efx-paint/` generation and the staging generation under that same root.
 */
async function hardlinkUnchangedFrames(
  cacheRoot: string,
  stagingBasename: string,
  unchangedFrames: ReadonlyArray<{ cachePath: string; bytes: Uint8Array }>,
): Promise<PendingWrite[]> {
  const byRelativePath = new Map<string, Uint8Array>();
  for (const frame of unchangedFrames) {
    byRelativePath.set(generationRelativeCachePath(frame.cachePath), frame.bytes);
  }
  const result = await hardlinkPhysicPaintCacheFrames(cacheRoot, stagingBasename, Array.from(byRelativePath.keys()));
  if (!result.ok) {
    return unchangedFrames.map((frame) => ({ path: frame.cachePath, bytes: frame.bytes }));
  }
  const missing = new Set(result.data.missing);
  return unchangedFrames
    .filter((frame) => missing.has(generationRelativeCachePath(frame.cachePath)))
    .map((frame) => ({ path: frame.cachePath, bytes: frame.bytes }));
}

async function prepareEfxPaintCacheLeg(
  projectDir: string,
  documents: ReadonlyMap<string, EfxPaintDocumentSaveInput> | undefined,
  cacheRoot: string | null,
): Promise<PreparedEfxPaintCacheLeg> {
  if (!documents || documents.size === 0) {
    return {
      fingerprint: null,
      publication: null,
      removeCanonicalAfterCommit: true,
      deletions: [],
      frameTokens: new Map(),
    };
  }

  // 46-05 D-15 / 52.2-07 D-05: every deletion dir is machine-relative and must
  // pass the segment rules before it may ride the transaction (ASVS V12).
  const deletions: string[] = [];
  for (const input of documents.values()) {
    for (const deletion of input.deletions ?? []) {
      if (!isSafeMachineCacheRelativePath(deletion)) {
        throw new Error(`EFX Paint deletion "${deletion}" is not a safe cache path.`);
      }
      if (!deletions.includes(deletion)) deletions.push(deletion);
    }
  }

  const fingerprint = buildEfxPaintSaveFingerprint(projectDir, documents);
  if (savedCacheFingerprints.has(fingerprint)) {
    return {
      fingerprint,
      publication: null,
      removeCanonicalAfterCommit: false,
      deletions,
      frameTokens: new Map(),
    };
  }

  const changedWrites: PendingWrite[] = [];
  const unchangedFrames: Array<{ cachePath: string; bytes: Uint8Array }> = [];
  const frameTokens = new Map<string, string>();

  for (const [layerId, input] of documents) {
    const document = parseEfxPaintDocument(input.document);
    for (const track of document.tracks) {
      const trackFrames = input.frames.get(track.id);
      for (const [frameNumber, ref] of Object.entries(track.frames)) {
        const appFrame = Number(frameNumber);
        const runtimeFrame = trackFrames?.get(appFrame);
        if (!runtimeFrame) {
          throw new Error(`EFX Paint frame ${layerId}:${track.id}:${appFrame} has no runtime frame bytes.`);
        }
        const bytes = runtimeFrame.bytes;
        if (!(bytes instanceof Uint8Array) || bytes.length === 0) {
          throw new Error(`EFX Paint frame ${layerId}:${track.id}:${appFrame} has no runtime frame bytes.`);
        }
        const key = `${layerId}:${track.id}:${appFrame}`;
        const token = buildFrameBytesToken(bytes);
        frameTokens.set(key, token);
        if (savedFrameTokens.get(key) === token) {
          unchangedFrames.push({ cachePath: ref.cachePath, bytes });
        } else {
          changedWrites.push({ path: ref.cachePath, bytes });
        }
      }
    }
  }

  // D-14 (52.2-07): with no machine cache root the caller cannot address the
  // derived-frame cache at all, so the whole cache leg is skipped — the
  // authoritative save still commits and never fails for a cache it cannot
  // find. `removeCanonicalAfterCommit` is false: there is no canonical
  // generation this save is entitled to remove.
  if (cacheRoot === null) {
    return {
      fingerprint,
      publication: null,
      removeCanonicalAfterCommit: false,
      deletions,
      frameTokens,
    };
  }

  const stagingBasename = createStagingBasename();
  const stagingRoot = `${cacheRoot}/${stagingBasename}`;
  await ensureDir(cacheRoot);

  try {
    await mkdir(stagingRoot, { recursive: true });
    const ensuredDirectories = new Set<string>();
    for (const write of changedWrites) {
      await stageFrame(cacheRoot, stagingBasename, write, ensuredDirectories);
    }
    if (unchangedFrames.length > 0) {
      const framesToWrite = await hardlinkUnchangedFrames(cacheRoot, stagingBasename, unchangedFrames);
      for (const write of framesToWrite) {
        await stageFrame(cacheRoot, stagingBasename, write, ensuredDirectories);
      }
    }

    const publication = await publishPhysicPaintCacheGeneration(cacheRoot, stagingBasename);
    if (!publication.ok) throw new Error(publication.error);
    // D-14: the cache leg is best-effort and reports a refusal SOFTLY
    // (`accepted: false` plus a diagnostic). There is then no cache
    // transaction to settle and the published canonical generation is left
    // exactly as it was — the authoritative save still commits.
    return {
      fingerprint,
      publication: publication.data.accepted
        ? { transactionId: publication.data.transactionId }
        : null,
      removeCanonicalAfterCommit: false,
      deletions,
      frameTokens,
    };
  } catch (error) {
    await removeStagingGeneration(stagingRoot);
    throw error;
  }
}

/**
 * Settle the derived-frame cache leg. `null` means the leg was skipped (no
 * documents, or no machine cache root): nothing to settle, nothing to remove.
 */
async function settlePreparedEfxPaintCacheLeg(
  cacheRoot: string | null,
  prepared: PreparedEfxPaintCacheLeg | null,
  action: 'commit' | 'rollback',
): Promise<void> {
  if (prepared === null) return;
  if (prepared.publication) {
    // A publication exists only when the save had a root to publish under.
    if (cacheRoot === null) throw new Error('EFX Paint cache settlement without a machine cache root.');
    const result = await settlePhysicPaintCacheGeneration(
      cacheRoot,
      prepared.publication.transactionId,
      action,
    );
    if (!result.ok && action === 'rollback') throw new Error(result.error);
  }
  if (action === 'commit') {
    // 46-05 D-15: the deleted track's sidecar directory rides the same
    // transaction as the save — settled only at commit, after the canonical
    // publication, before the cache record. A removal failure is
    // non-authoritative: the transaction already committed and the stale
    // directory is unreferenced by the fresh document. 52.2-07 (D-05): the
    // deletion is a machine-relative reference resolved against the machine
    // cache root — never the project directory.
    if (cacheRoot !== null) {
      for (const deletion of prepared.deletions) {
        const deletionPath = resolveMachineCachePath(cacheRoot, deletion);
        if (deletionPath === null) continue;
        if (!(await exists(deletionPath))) continue;
        try {
          await remove(deletionPath, { recursive: true });
        } catch {
          // Non-authoritative cleanup failure: the commit stands.
        }
      }
      if (prepared.removeCanonicalAfterCommit) {
        // The canonical generation ROOT (a directory, not a reference): the
        // reference guard requires a path under `efx-paint/`, so this join is
        // spelled here rather than through `resolveMachineCachePath`.
        const existingRootDir = `${cacheRoot}/${EFX_PAINT_MACHINE_CACHE_DIR}`;
        if (await exists(existingRootDir)) await remove(existingRootDir, { recursive: true });
      }
    }
    // One entry, mirroring the pre-52.2-07 cache's memory profile: the last
    // committed content set is the only one whose staging can be skipped.
    savedCacheFingerprints.clear();
    if (prepared.fingerprint) savedCacheFingerprints.add(prepared.fingerprint);
    savedFrameTokens.clear();
    for (const [key, token] of prepared.frameTokens) {
      savedFrameTokens.set(key, token);
    }
  }
}

/**
 * The staged package save seam (52.2-05 Task 3, D-10).
 *
 * Plan 07 drives the package funnel through here: every changed authoritative
 * file is first staged under `<package>/<staging basename>/` — the manifest by
 * this call, layer sub-files and frame media through their own writers — and
 * then the whole set is bound in ONE call. The single-file case is the same
 * call with nothing yet staged: the manifest alone, as a one-entry set, never
 * a parallel code path.
 *
 * Publish, settle and recover are the `ipc.ts` wrappers, each taking this
 * package root plus this staging basename; the staging ROOT is derived in
 * Rust, so the caller never supplies a destination root (T-52.2-14).
 */
export interface EfxPaintStagedPackageSave {
  readonly packageRoot: string;
  readonly stagingBasename: string;
  /** The staged manifest path the project write landed at, inside the staging root. */
  readonly stagedManifestPath: string;
  readonly transactionId: string;
  readonly aggregateDigest: string;
}

export async function stageEfxPaintPackageSave(
  project: MceProject,
  packageRoot: string,
  stagedPaths: readonly string[] = [],
): Promise<EfxPaintStagedPackageSave> {
  const stagingBasename = createPackageStagingBasename();
  const stagedManifestPath = `${packageRoot}/${stagingBasename}/${EFX_PAINT_PACKAGE_MANIFEST_FILE}`;
  const write = await ipcProjectSave(project, stagedManifestPath);
  if (!write.ok) throw new Error(write.error);
  const bound = await bindEfxPaintPackageTransaction(
    packageRoot,
    stagingBasename,
    // One set, deduplicated: the manifest can never be bound twice.
    Array.from(new Set([EFX_PAINT_PACKAGE_MANIFEST_FILE, ...stagedPaths])),
  );
  if (!bound.ok) throw new Error(bound.error);
  return {
    packageRoot,
    stagingBasename,
    stagedManifestPath,
    transactionId: bound.data.transactionId,
    aggregateDigest: bound.data.aggregateDigest,
  };
}

// --- 52.2-07 Task 3 (D-09/D-10/D-11): the package save --------------------

/** What a save writes, and nothing else: the manifest, its layers, their media. */
export interface EfxPaintPackageSaveInput {
  /**
   * The main-editor project fields the manifest is built from (D-04). The
   * legacy `efx_paint_documents` carrier is dropped by `buildPackageManifest`,
   * so a caller may pass the project object verbatim.
   */
  readonly project: MceProject;
  /** layerId → its save input (document + runtime frames + pending deletions). */
  readonly documents: ReadonlyMap<string, EfxPaintDocumentSaveInput> | undefined;
  /** The package identity carried in the manifest and used as the cache-root key (D-05). */
  readonly projectId: string;
  /**
   * The machine-local derived-frame cache root (`<app_data_dir>/frame-cache/<projectId>`),
   * or null when the caller cannot resolve one. The cache leg is best-effort
   * (D-14): a missing root skips it and the authoritative save still commits.
   */
  readonly cacheRoot?: string | null;
}

/**
 * Per-file save telemetry (T-52.2-24): the four terms the save is made of are
 * reported separately so a regression to one whole-project serialize shows up
 * as a single dominant stage instead of hiding inside one opaque total.
 */
export interface EfxPaintPackageSaveMetrics {
  readonly mediaMs: number;
  readonly layersMs: number;
  readonly manifestMs: number;
  readonly commitMs: number;
}

export interface EfxPaintPackageSaveResult {
  /** The manifest this save committed (or already had, for a no-op save). */
  readonly manifest: EfxPaintPackageManifest;
  /** The package-relative paths written into the staging root, in write order. */
  readonly changedFiles: readonly string[];
  readonly metrics: EfxPaintPackageSaveMetrics;
}

/**
 * Write one changed key's raster into the staging generation (D-02/D-13) and
 * return the reference the layer sub-file will carry.
 *
 * The reference is NEVER invented: it is the canonical `frames/<layerId>/<keyId>.webp`
 * path plus the SHA-256 the native write computed over the exact bytes it
 * staged. A key whose runtime payload already carries a reference (a document
 * reopened through plan 06's runtime projection) reuses it verbatim — there is
 * nothing to re-write and no digest JS could recompute.
 */
async function writeKeyMedia(
  packageDir: string,
  stagingBasename: string,
  layerId: string,
  frame: PreparedPackageFrame,
): Promise<FrameMediaReference> {
  const payload = frame.payload;
  const existing = payload.media;
  if (existing !== undefined) return existing;
  const bytes = payload.bytes;
  if (bytes === undefined || bytes.length === 0) {
    throw new Error(
      `EFX Paint key "${frame.keyId}" of layer "${layerId}" carries neither raster bytes nor a media reference.`,
    );
  }
  const write = await ipcEfxPaintWriteFrameMedia(packageDir, layerId, frame.keyId, bytes, stagingBasename);
  if (!write.ok) throw new EfxPaintMediaWriteError(layerId, frame.keyId, write.error);
  return Object.freeze({
    relativePath: write.data.relativePath,
    digest: write.data.digest,
    ...(payload.width !== undefined ? { width: payload.width } : {}),
    ...(payload.height !== undefined ? { height: payload.height } : {}),
  });
}

/**
 * Commit the staged set through the package transaction (D-10): bind every
 * staged file to one transaction, publish each into its canonical path, then
 * settle. A publish failure rolls the transaction back before re-throwing, so
 * no failure path can leave a half-published package (T-52.2-21).
 */
async function commitStagedPackage(
  packageRoot: string,
  stagingBasename: string,
  stagedPaths: readonly string[],
): Promise<void> {
  const binding = await bindEfxPaintPackageTransaction(packageRoot, stagingBasename, Array.from(stagedPaths));
  if (!binding.ok) throw new Error(binding.error);
  const publication = await publishEfxPaintPackageTransaction(packageRoot, binding.data.transactionId);
  if (!publication.ok) {
    await settleEfxPaintPackageTransaction(packageRoot, binding.data.transactionId, 'rollback');
    throw new Error(publication.error);
  }
  // Settle-commit is the transaction's own authority: it commits only on a
  // full digest match and rolls the package back otherwise, so a refusal here
  // has already restored the pre-save package.
  const settlement = await settleEfxPaintPackageTransaction(
    packageRoot,
    binding.data.transactionId,
    'commit',
  );
  if (!settlement.ok) throw new Error(settlement.error);
}

/**
 * The package save (52.2-07 Task 3, D-09/D-10/D-11).
 *
 * `packageDir` is the package root — the project folder itself. Every
 * authoritative file (the manifest, one `layers/<layerId>.json` per CHANGED
 * layer, one `frames/<layerId>/<keyId>.webp` per changed key) is staged under
 * `<packageDir>/<staging basename>/` and reaches its canonical path only
 * through the plan-05 transaction's publish step, so a refusal anywhere leaves
 * the pre-save package byte-identical (T-52.2-21).
 *
 * Only CHANGED files are written (D-11): the change set is computed from the
 * per-file tokens before anything is staged, and an empty change set touches no
 * disk at all — no staging root, no transaction, and the save still reports
 * success (T-52.2-23).
 *
 * Media is written BEFORE the sub-file that digests it: the digest is the
 * native write's SHA-256 and the sub-file must carry it, so the reverse order
 * would force either a second read pass or a fabricated digest.
 *
 * The machine-local derived-frame cache is a SEPARATE, best-effort leg (D-14):
 * it never rides the bound authoritative set and a cache failure never fails
 * the save.
 */
export async function savePackage(
  packageDir: string,
  input: EfxPaintPackageSaveInput,
): Promise<EfxPaintPackageSaveResult> {
  const cacheRoot = input.cacheRoot ?? null;

  // ---- Intake. Pure: nothing is staged, nothing is written, no IPC. ------
  const layers: PreparedPackageLayer[] = [];
  const nextTokens = new Map<string, string>();
  for (const [layerId, documentInput] of input.documents ?? new Map<string, EfxPaintDocumentSaveInput>()) {
    const layer = preparePackageLayer(layerId, documentInput);
    layers.push(layer);
    nextTokens.set(layer.layerToken, `${layer.documentRevision}+${layer.compositeRevision}`);
    for (const frame of layer.frames) nextTokens.set(frame.token, frame.contentToken);
  }
  const layerIndex: Record<string, EfxPaintLayerIndexEntry> = {};
  for (const layer of layers) {
    layerIndex[layer.layerId] = Object.freeze({
      layerFile: layer.layerFile,
      documentRevision: layer.documentRevision,
      compositeRevision: layer.compositeRevision,
    });
  }
  const manifest = buildPackageManifest({
    project: input.project as unknown as Readonly<Record<string, unknown>>,
    layerIndex,
    projectId: input.projectId,
  });
  nextTokens.set(packageFileToken('manifest'), buildManifestContentToken(manifest));

  // A token names a file identity INSIDE one package, so a baseline belonging
  // to another root would report the destination's files as unchanged and skip
  // their write (Save As). A different root starts from an empty baseline, the
  // fail-closed default.
  const previousTokens: ReadonlyMap<string, string> = packageBaselineRoot === packageDir
    ? packageFileTokens
    : new Map<string, string>();
  const changedTokens = new Set(computeChangedFiles(previousTokens, nextTokens).map((entry) => entry.token));

  const metrics = { mediaMs: 0, layersMs: 0, manifestMs: 0, commitMs: 0 };

  // An empty change set does not touch the PACKAGE: the plan-05 bind refuses
  // an empty set, and a no-op save must not mint a staging generation, write
  // the manifest, or open a transaction.
  if (changedTokens.size === 0) {
    // The derived-frame cache is its own best-effort leg with its own
    // fingerprint (D-14): a repaint changes the rendered frames while leaving
    // the document's own revision and its file set untouched, so skipping the
    // leg here would publish a package whose derived frames are stale. It only
    // has work when its fingerprint moved — a true no-op still stages nothing.
    const idleCacheLeg = await prepareEfxPaintCacheLeg(packageDir, input.documents, cacheRoot);
    await settlePreparedEfxPaintCacheLeg(cacheRoot, idleCacheLeg, 'commit');
    settlePackageFileTokens('commit', nextTokens);
    packageBaselineRoot = packageDir;
    return Object.freeze({
      manifest,
      changedFiles: Object.freeze([] as string[]),
      metrics: Object.freeze(metrics),
    });
  }

  const stagingBasename = createPackageStagingBasename();
  const stagingRoot = `${packageDir}/${stagingBasename}`;
  const stagedPaths: string[] = [];
  let cacheLeg: PreparedEfxPaintCacheLeg | null = null;

  try {
    // The staging ROOT is derived here from the package root the caller owns —
    // never a destination root handed to Rust, whose own bind derives it from
    // the package root anyway (T-52.2-14).
    await mkdir(stagingRoot, { recursive: true });

    let layersDirectoryEnsured = false;
    for (const layer of layers) {
      const layerChanged = changedTokens.has(layer.layerToken)
        || layer.frames.some((frame) => changedTokens.has(frame.token));
      if (!layerChanged) continue;

      // 4. Every changed key of BOTH roto collections reaches the staging
      // generation through the native writer; an unchanged key's reference is
      // reused from the last committed save. Step 4 writes nothing canonical.
      const mediaStartedAtMs = performance.now();
      const mediaRefs = new Map<string, FrameMediaReference>();
      for (const frame of layer.frames) {
        const referenceKey = mediaReferenceKey(layer.layerId, frame.keyId);
        if (!changedTokens.has(frame.token)) {
          const reused = savedMediaReferences.get(referenceKey);
          if (reused !== undefined) {
            mediaRefs.set(frame.keyId, reused);
            continue;
          }
        }
        const reference = await writeKeyMedia(packageDir, stagingBasename, layer.layerId, frame);
        mediaRefs.set(frame.keyId, reference);
        // The bound set IS the publish set: a staged media file that is not
        // bound is never published, so its reference would reach the sub-file
        // while its bytes stayed in the staging generation (T-52.2-21).
        stagedPaths.push(reference.relativePath);
        savedMediaReferences.set(referenceKey, reference);
      }
      metrics.mediaMs += performance.now() - mediaStartedAtMs;

      // 5. The sub-file: the runtime document projected to media references in
      // both collections, stringified on its own — the project is never one
      // string and a layer sub-file carries no raster payload. `mediaRefs` is
      // complete for this layer by now, and a miss is the projection's typed
      // failure rather than a record without media.
      const layersStartedAtMs = performance.now();
      if (!layersDirectoryEnsured) {
        await mkdir(`${stagingRoot}/${EFX_PAINT_LAYERS_DIR}`, { recursive: true });
        layersDirectoryEnsured = true;
      }
      const projected = projectLayerDocument(layer.document, (keyId) => mediaRefs.get(keyId));
      await writeFile(
        `${stagingRoot}/${layer.layerFile}`,
        new TextEncoder().encode(JSON.stringify(projected)),
      );
      stagedPaths.push(layer.layerFile);
      metrics.layersMs += performance.now() - layersStartedAtMs;
    }

    if (changedTokens.has(packageFileToken('manifest'))) {
      const manifestStartedAtMs = performance.now();
      // The manifest write takes the path it is handed (plan 05 made that
      // write path-parameterized) — pointed at the staging root, never at the
      // canonical `project.mce`.
      const write = await ipcProjectSave(
        manifest as unknown as MceProject,
        `${stagingRoot}/${EFX_PAINT_PACKAGE_MANIFEST_FILE}`,
      );
      if (!write.ok) throw new Error(write.error);
      stagedPaths.push(EFX_PAINT_PACKAGE_MANIFEST_FILE);
      metrics.manifestMs += performance.now() - manifestStartedAtMs;
    }

    // The derived-frame cache leg: staged under the MACHINE cache root, never
    // part of the bound authoritative set, and settled only after the package
    // transaction commits.
    cacheLeg = await prepareEfxPaintCacheLeg(packageDir, input.documents, cacheRoot);

    const commitStartedAtMs = performance.now();
    await commitStagedPackage(packageDir, stagingBasename, stagedPaths);
    metrics.commitMs = performance.now() - commitStartedAtMs;
  } catch (error) {
    await settlePreparedEfxPaintCacheLeg(cacheRoot, cacheLeg, 'rollback');
    await removeStagingGeneration(stagingRoot);
    throw error;
  }

  await settlePreparedEfxPaintCacheLeg(cacheRoot, cacheLeg, 'commit');
  // The baseline advances only after the package transaction committed: a
  // failed save keeps the previous baseline, so the next save re-writes
  // exactly what the failed one had staged (fail-safe direction).
  packageBaselineRoot = packageDir;
  settlePackageFileTokens('commit', nextTokens);
  // Keep only the committed keys' references: a removed key's entry can never
  // be reused, and the map must not grow with every edit of a session.
  const committedKeys = new Set<string>();
  for (const layer of layers) {
    for (const frame of layer.frames) committedKeys.add(mediaReferenceKey(layer.layerId, frame.keyId));
  }
  for (const key of Array.from(savedMediaReferences.keys())) {
    if (!committedKeys.has(key)) savedMediaReferences.delete(key);
  }
  return Object.freeze({
    manifest,
    changedFiles: Object.freeze(stagedPaths.slice()),
    metrics: Object.freeze(metrics),
  });
}

/**
 * Load the persisted layerId → document map. Every document passes the
 * fail-closed parser before any store hydration (T-45-13); every sidecar path
 * is guarded by `isSafeMachineCacheRelativePath` (T-45-11, T-46-04). D-08: the load
 * is refs-only — each frame carries its canonical `cachePath` ref with empty
 * bytes, and the decode path fetches the WebP sidecar on demand (never an
 * eager per-frame readFile on open). Frame refs are carried per track
 * (trackId → appFrame → frame) so two tracks may own frames at the same
 * appFrame without collision (46-02, TRK-03). Returns an empty map when the
 * key is absent.
 */
export async function loadEfxPaintDocuments(
  _projectRoot: string,
  persistedMap: Record<string, unknown> | undefined,
): Promise<ReadonlyMap<string, EfxPaintLoadedDocument>> {
  const loaded = new Map<string, EfxPaintLoadedDocument>();
  if (persistedMap === undefined) return loaded;
  if (!isPlainRecord(persistedMap)) {
    throw new Error('EFX Paint documents must be a record.');
  }
  for (const [layerId, value] of Object.entries(persistedMap)) {
    // 52.2-02 (D-07, Law 1): this is the on-disk READ door, so it selects the
    // persisted payload mode — a layer sub-file carrying an inline raster
    // payload in either roto collection is refused here. Every other caller of
    // `parseEfxPaintDocument` validates a live in-memory document and keeps the
    // 'runtime' default.
    const document = parseEfxPaintDocument(value, 'reference-only');
    const frames = new Map<string, Map<number, PhysicPaintRenderedFrame>>();
    for (const track of document.tracks) {
      const trackFrames = new Map<number, PhysicPaintRenderedFrame>();
      for (const [frameNumber, ref] of Object.entries(track.frames)) {
        const appFrame = Number(frameNumber);
        if (!isSafeMachineCacheRelativePath(ref.cachePath)) {
          throw new Error(`EFX Paint frame ${layerId}:${track.id}:${appFrame} has an unsafe sidecar path.`);
        }
        trackFrames.set(appFrame, {
          frameIndex: 0,
          appFrame,
          bytes: new Uint8Array(0),
          cachePath: ref.cachePath,
          width: ref.width,
          height: ref.height,
        });
      }
      frames.set(track.id, trackFrames);
    }
    loaded.set(layerId, { document, frames, cacheLocations: new Map() });
  }
  return loaded;
}

/**
 * The package load input (52.2-09 Task 2, D-13).
 *
 * `manifest` is the parsed `project.mce` the open leg already holds, typed
 * `unknown` on purpose: the manifest is Rust-authored data, so its `efxPaint`
 * index is validated here rather than trusted through a type.
 */
export interface EfxPaintPackageLoadInput {
  /** The opened package root — `project.mce`'s own directory. */
  readonly packageDir: string;
  /** The parsed manifest; only its `efxPaint` index is interpreted. */
  readonly manifest: unknown;
  /**
   * The machine-local derived-frame cache root the session resolved (D-05), or
   * null when it could not be resolved — then no location is recomputed and
   * every frame re-derives (D-14).
   */
  readonly machineCacheRoot: string | null;
}

export async function loadEfxPaintPackage(
  _input: EfxPaintPackageLoadInput,
): Promise<ReadonlyMap<string, EfxPaintLoadedDocument>> {
  // RED stub (52.2-09 Task 2): returns an empty map so every new case fails on
  // its own assertion. Replaced by the real manifest walk in the GREEN commit.
  return new Map();
}
