/**
 * v1.0 EFX Paint document persistence service (Phase 45-04).
 *
 * The TS side of DOC-05: saving a v1.0 document stages derived-frame sidecars
 * under the MACHINE-LOCAL cache root via a `.efx-paint-staging-<uuid>`
 * basename, writes the `.mce` with the bound cache transaction, and settles
 * commit/rollback — the proven two-resource transaction shape copied from
 * `savePhysicPaintDataWithProjectWrite` (physicPaintPersistence.ts:320-340).
 * 52.2-07 (D-05): that root is `<app_data_dir>/frame-cache/<projectId>`, never
 * the project directory, and it is supplied by the caller; the native
 * publish/settle/hardlink commands (plan 05) take it as their own input and
 * address the `efx-paint/` generation under it (T-45-06).
 *
 * The persisted payload is the layerId → EfxPaintDocument map (the document
 * model's track frames are CachedFrameReference sidecar refs carrying a
 * machine-relative `efx-paint/<stableSegment>/<trackId>/frame-NNNN.webp`
 * reference; the runtime frame bytes travel alongside the documents in the
 * save input and are staged as sidecars). Loading validates every document
 * through the fail-closed `parseEfxPaintDocument` (T-45-13) and reads the
 * sidecar frames back through the plugin-fs idiom, guarding every reference
 * with plan 02's `isSafeMachineCacheRelativePath` (T-45-11, ASVS V12).
 *
 * IMMUTABILITY LAW (52.1 a2): canonical sidecars under `<cache root>/efx-paint/`
 * are NEVER written in place. They are replaced only by the native atomic
 * directory swap (`publish_physic_paint_cache_generation`). Incremental
 * staging hardlinks unchanged sidecars into the staging generation, so any
 * future in-place writer would silently alias through those hardlinks and
 * corrupt the canonical generation. Do not add an in-place write path.
 *
 * Incremental staging (52.1 a2): a save stages only the frames whose byte
 * token changed since the last save (`savedFrameTokens`), hardlinks the
 * unchanged frames into the staging generation, and lets the swap publish the
 * complete generation. A hardlink failure (EXDEV/EPERM — different volume or
 * unsupported filesystem) degrades to a full re-stage; a missing sidecar
 * (ENOENT) is written fresh. Deleted frames are simply absent from the
 * staging generation, so the swap releases their inode.
 */

import { exists, mkdir, remove, writeFile } from '@tauri-apps/plugin-fs';
import type { EfxPaintDocument } from '../efx-paint/document/efxPaintDocument';
import { parseEfxPaintDocument } from '../efx-paint/document/efxPaintDocumentParsers';
import { buildEfxPaintDocumentRevision } from '../efx-paint/document/efxPaintDocumentRevision';
import { buildFrameBytesToken, type PhysicPaintRenderedFrame } from '../types/physicPaint';
import type { MceProject } from '../types/project';
import { toTransportPayload } from './webpBytes';
import {
  bindEfxPaintPackageTransaction,
  hardlinkPhysicPaintCacheFrames,
  projectSave as ipcProjectSave,
  publishPhysicPaintCacheGeneration,
  settlePhysicPaintCacheGeneration,
} from './ipc';
// 52.2-07 (D-05): the machine-relative reference, its guard and its one
// absolute-path constructor all come from plan 02 — no second copy here.
import {
  collectPackageCacheRefs,
  EFX_PAINT_MACHINE_CACHE_DIR,
  isSafeMachineCacheRelativePath,
  resolveMachineCachePath,
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
 */
export interface EfxPaintLoadedDocument {
  readonly document: EfxPaintDocument;
  readonly frames: ReadonlyMap<string, ReadonlyMap<number, PhysicPaintRenderedFrame>>;
}

type PendingWrite = { readonly path: string; readonly bytes: Uint8Array };

/**
 * Content-fingerprint dedup cache (mirrors savedOutputCache): keyed by the
 * save fingerprint (document revisions + frame byte terms), populated only
 * after a successful commit. A no-op save reuses the prior persisted payload
 * and skips sidecar staging entirely (T-45-12 idempotency edge).
 */
const savedDocumentCache = new Map<string, Record<string, unknown>>();

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

interface PreparedEfxPaintSave {
  readonly persistedDocuments: Record<string, unknown>;
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

async function prepareEfxPaintSave(
  projectDir: string,
  documents: ReadonlyMap<string, EfxPaintDocumentSaveInput> | undefined,
  cacheRoot: string | null,
): Promise<PreparedEfxPaintSave> {
  if (!documents || documents.size === 0) {
    return {
      persistedDocuments: {},
      fingerprint: null,
      publication: null,
      removeCanonicalAfterCommit: true,
      deletions: [],
      frameTokens: new Map(),
    };
  }

  // 46-05 D-15 / 52.2-07 D-05: every deletion dir is machine-relative and must
  // pass the segment rules before it may ride the transaction (ASVS V12).
  // 52.2-07 (D-05, T-52.2-56): every layer document in the set is scanned for
  // its persisted cache references BEFORE anything is staged or cached — a
  // legacy `cache/efx-paint/...` shape (or an absolute path) is a refusal here,
  // so a machine-coupled reference can never reach a package.
  const deletions: string[] = [];
  for (const input of documents.values()) {
    collectPackageCacheRefs([input.document]);
    for (const deletion of input.deletions ?? []) {
      if (!isSafeMachineCacheRelativePath(deletion)) {
        throw new Error(`EFX Paint deletion "${deletion}" is not a safe cache path.`);
      }
      if (!deletions.includes(deletion)) deletions.push(deletion);
    }
  }

  const fingerprint = buildEfxPaintSaveFingerprint(projectDir, documents);
  const cached = savedDocumentCache.get(fingerprint);
  if (cached) {
    return {
      persistedDocuments: structuredClone(cached),
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
  const persistedDocuments: Record<string, unknown> = {};

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
    // 52.1 (D-05): the durable document carries real-key `bytes` as Uint8Array.
    // JSON.stringify turns a Uint8Array into an index object, so the persisted
    // form must carry bytes as base64 (the canonical JSON form). The loader
    // decodes base64 back to Uint8Array in cloneAndFreezeRealKeyPayload.
    persistedDocuments[layerId] = toTransportPayload(document);
  }

  // D-14 (52.2-07): with no machine cache root the caller cannot address the
  // derived-frame cache at all, so the whole cache leg is skipped — the
  // document payload still persists and the save never fails for a cache it
  // cannot find. `removeCanonicalAfterCommit` is false: there is no canonical
  // generation this save is entitled to remove.
  if (cacheRoot === null) {
    return {
      persistedDocuments,
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
      persistedDocuments,
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

async function settlePreparedEfxPaintSave(
  cacheRoot: string | null,
  prepared: PreparedEfxPaintSave,
  action: 'commit' | 'rollback',
): Promise<void> {
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
    savedDocumentCache.clear();
    if (prepared.fingerprint) {
      savedDocumentCache.set(prepared.fingerprint, structuredClone(prepared.persistedDocuments));
    }
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

/**
 * Save the v1.0 document map through the two-resource transaction: stage
 * sidecars under a UUID staging basename, publish the cache generation, then
 * write the project with the bound transaction id. A writeProject failure
 * settles rollback (the previously committed generation stays published) and
 * re-throws; success settles commit.
 *
 * 52.2-07 Task 2 (D-05): `cacheRoot` is the machine-local derived-frame cache
 * root (`<app_data_dir>/frame-cache/<projectId>`), the base every staging
 * write, publication, hardlink and track-deletion removal is addressed
 * against. It is never the project directory: nothing under the package is a
 * cache root. A missing root (`null`) means the caller cannot address the
 * machine cache and the whole cache leg is skipped — the leg is best-effort
 * (D-14), and a save never fails for a cache it cannot find.
 */
export async function saveEfxPaintDocumentsWithProjectWrite(
  projectDir: string,
  documents: ReadonlyMap<string, EfxPaintDocumentSaveInput> | undefined,
  writeProject: (
    persistedDocuments: Record<string, unknown>,
    cacheTransactionId: string | null,
  ) => Promise<void>,
  cacheRoot: string | null = null,
): Promise<Record<string, unknown>> {
  const prepared = await prepareEfxPaintSave(projectDir, documents, cacheRoot);
  try {
    await writeProject(
      prepared.persistedDocuments,
      prepared.publication?.transactionId ?? null,
    );
  } catch (error) {
    await settlePreparedEfxPaintSave(cacheRoot, prepared, 'rollback');
    throw error;
  }
  await settlePreparedEfxPaintSave(cacheRoot, prepared, 'commit');
  return prepared.persistedDocuments;
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
    loaded.set(layerId, { document, frames });
  }
  return loaded;
}
