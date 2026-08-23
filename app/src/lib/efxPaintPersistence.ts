/**
 * v1.0 EFX Paint document persistence service (Phase 45-04).
 *
 * The TS side of DOC-05: saving a v1.0 document stages PNG sidecars under
 * `cache/efx-paint` via a `.efx-paint-staging-<uuid>` basename, writes the
 * `.mce` with the bound cache transaction, and settles commit/rollback —
 * the proven two-resource transaction shape copied from
 * `savePhysicPaintDataWithProjectWrite` (physicPaintPersistence.ts:320-340).
 * The native publish/settle commands were re-pointed at `cache/efx-paint` in
 * 45-02 and are reused as-is (same command surface, T-45-06).
 *
 * The persisted payload is the layerId → EfxPaintDocument map (the document
 * model's track frames are CachedFrameReference sidecar refs; the runtime
 * frame bytes travel alongside the documents in the save input and are
 * staged as sidecars). Loading validates every document through the
 * fail-closed `parseEfxPaintDocument` (T-45-13) and reads the sidecar PNGs
 * back through the plugin-fs idiom, guarding every path with
 * `isSafeEfxPaintCachePath` (T-45-11, ASVS V12).
 */

import { exists, mkdir, readFile, remove, writeFile } from '@tauri-apps/plugin-fs';
import type { EfxPaintDocument } from '../efx-paint/document/efxPaintDocument';
import { parseEfxPaintDocument } from '../efx-paint/document/efxPaintDocumentParsers';
import { buildEfxPaintDocumentRevision } from '../efx-paint/document/efxPaintDocumentRevision';
import type { PhysicPaintRenderedFrame } from '../types/physicPaint';
import { publishPhysicPaintCacheGeneration, settlePhysicPaintCacheGeneration } from './ipc';

export const EFX_PAINT_CACHE_DIR = 'cache/efx-paint';
export const EFX_PAINT_CACHE_PARENT_DIR = 'cache';
export const EFX_PAINT_STAGING_PREFIX = '.efx-paint-staging-';
const DATA_URL_PREFIX = 'data:image/png;base64,';

/** One layer's save input: the document plus the runtime frame bytes to stage. */
export interface EfxPaintDocumentSaveInput {
  readonly document: EfxPaintDocument;
  readonly frames: ReadonlyMap<number, PhysicPaintRenderedFrame>;
}

/** One layer's load result: the validated document plus hydrated runtime frames. */
export interface EfxPaintLoadedDocument {
  readonly document: EfxPaintDocument;
  readonly frames: ReadonlyMap<number, PhysicPaintRenderedFrame>;
}

type PendingWrite = { readonly path: string; readonly bytes: Uint8Array };

/**
 * Content-fingerprint dedup cache (mirrors savedOutputCache): keyed by the
 * save fingerprint (document revisions + frame byte terms), populated only
 * after a successful commit. A no-op save reuses the prior persisted payload
 * and skips sidecar staging entirely (T-45-12 idempotency edge).
 */
const savedDocumentCache = new Map<string, Record<string, unknown>>();

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

function frameFileName(frame: Pick<PhysicPaintRenderedFrame, 'appFrame' | 'frameIndex'>): string {
  const appFrame = String(frame.appFrame).padStart(6, '0');
  const frameIndex = String(frame.frameIndex).padStart(4, '0');
  return `frame-${appFrame}-${frameIndex}.png`;
}

/**
 * Deterministic canonical sidecar path for one runtime frame. The projection
 * writes these into the document's CachedFrameReference records; the save
 * path stages the bytes at the matching staging path and the loader reads
 * them back from the canonical path after publication.
 */
export function buildEfxPaintFrameCachePath(
  layerId: string,
  frame: Pick<PhysicPaintRenderedFrame, 'appFrame' | 'frameIndex'>,
): string {
  return `${EFX_PAINT_CACHE_DIR}/${stableSegment(layerId)}/${frameFileName(frame)}`;
}

function decodePngDataUrl(dataUrl: string): Uint8Array | null {
  if (!dataUrl.startsWith(DATA_URL_PREFIX)) return null;
  try {
    const binary = atob(dataUrl.slice(DATA_URL_PREFIX.length));
    if (binary.length === 0) return null;
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    return bytes;
  } catch {
    return null;
  }
}

function encodePngDataUrl(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return DATA_URL_PREFIX + btoa(binary);
}

/**
 * Prefix-locked sidecar path guard (T-45-11, ASVS V12): the path must live
 * under `cache/efx-paint/`, contain no backslash, no absolute prefix, no NUL,
 * and no empty/dot segments.
 */
export function isSafeEfxPaintCachePath(cachePath: unknown): cachePath is string {
  if (typeof cachePath !== 'string' || !cachePath.startsWith(`${EFX_PAINT_CACHE_DIR}/`)) return false;
  if (cachePath.includes('\\') || cachePath.startsWith('/') || cachePath.includes('\0')) return false;
  return cachePath.split('/').every((segment) => segment.length > 0 && segment !== '.' && segment !== '..');
}

async function ensureDir(path: string): Promise<void> {
  if (!(await exists(path))) await mkdir(path, { recursive: true });
}

function createStagingBasename(): string {
  return `${EFX_PAINT_STAGING_PREFIX}${crypto.randomUUID()}`;
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
}

/**
 * Deterministic save fingerprint: the 45-01 document revision per layer plus
 * the runtime frame byte terms (dataUrls). The byte terms are required — a
 * repaint changes the bytes while the deterministic cachePath refs stay the
 * same, so a document-only fingerprint would wrongly skip re-staging.
 */
function buildEfxPaintSaveFingerprint(
  projectDir: string,
  documents: ReadonlyMap<string, EfxPaintDocumentSaveInput>,
): string {
  const terms: string[] = [];
  for (const [layerId, input] of documents) {
    const document = parseEfxPaintDocument(input.document);
    terms.push(`${layerId.length}:${layerId}:${buildEfxPaintDocumentRevision(document)}`);
    for (const [appFrame, frame] of input.frames) {
      terms.push(`${appFrame}:${frame.dataUrl.length}:${frame.dataUrl}`);
    }
  }
  return `${projectDir}\0${terms.sort().join('\0')}`;
}

async function prepareEfxPaintSave(
  projectDir: string,
  documents: ReadonlyMap<string, EfxPaintDocumentSaveInput> | undefined,
): Promise<PreparedEfxPaintSave> {
  if (!documents || documents.size === 0) {
    return {
      persistedDocuments: {},
      fingerprint: null,
      publication: null,
      removeCanonicalAfterCommit: true,
    };
  }

  const fingerprint = buildEfxPaintSaveFingerprint(projectDir, documents);
  const cached = savedDocumentCache.get(fingerprint);
  if (cached) {
    return {
      persistedDocuments: structuredClone(cached),
      fingerprint,
      publication: null,
      removeCanonicalAfterCommit: false,
    };
  }

  const pendingWrites: PendingWrite[] = [];
  const persistedDocuments: Record<string, unknown> = {};

  for (const [layerId, input] of documents) {
    const document = parseEfxPaintDocument(input.document);
    for (const track of document.tracks) {
      for (const [frameNumber, ref] of Object.entries(track.frames)) {
        const appFrame = Number(frameNumber);
        const runtimeFrame = input.frames.get(appFrame);
        if (!runtimeFrame) {
          throw new Error(`EFX Paint frame ${layerId}:${appFrame} has no runtime frame bytes.`);
        }
        const bytes = decodePngDataUrl(runtimeFrame.dataUrl);
        if (!bytes) {
          throw new Error(`EFX Paint frame ${layerId}:${appFrame} is not a canonical PNG data URL.`);
        }
        pendingWrites.push({ path: ref.cachePath, bytes });
      }
    }
    persistedDocuments[layerId] = document;
  }

  const stagingBasename = createStagingBasename();
  const stagingRelativeRoot = `${EFX_PAINT_CACHE_PARENT_DIR}/${stagingBasename}`;
  const stagingRoot = `${projectDir}/${stagingRelativeRoot}`;
  await ensureDir(`${projectDir}/${EFX_PAINT_CACHE_PARENT_DIR}`);

  try {
    await mkdir(stagingRoot, { recursive: true });
    const ensuredDirectories = new Set<string>();
    for (const write of pendingWrites) {
      const stagingRelativePath = `${stagingRelativeRoot}${write.path.slice(EFX_PAINT_CACHE_DIR.length)}`;
      const directory = stagingRelativePath.slice(0, stagingRelativePath.lastIndexOf('/'));
      if (!ensuredDirectories.has(directory)) {
        await mkdir(`${projectDir}/${directory}`, { recursive: true });
        ensuredDirectories.add(directory);
      }
      await writeFile(`${projectDir}/${stagingRelativePath}`, write.bytes);
    }

    const publication = await publishPhysicPaintCacheGeneration(projectDir, stagingBasename);
    if (!publication.ok) throw new Error(publication.error);
    return {
      persistedDocuments,
      fingerprint,
      publication: { transactionId: publication.data.transactionId },
      removeCanonicalAfterCommit: false,
    };
  } catch (error) {
    await removeStagingGeneration(stagingRoot);
    throw error;
  }
}

async function settlePreparedEfxPaintSave(
  projectDir: string,
  prepared: PreparedEfxPaintSave,
  action: 'commit' | 'rollback',
): Promise<void> {
  if (prepared.publication) {
    const result = await settlePhysicPaintCacheGeneration(
      projectDir,
      prepared.publication.transactionId,
      action,
    );
    if (!result.ok && action === 'rollback') throw new Error(result.error);
  }
  if (action === 'commit') {
    if (prepared.removeCanonicalAfterCommit) {
      const rootDir = `${projectDir}/${EFX_PAINT_CACHE_DIR}`;
      if (await exists(rootDir)) await remove(rootDir, { recursive: true });
    }
    savedDocumentCache.clear();
    if (prepared.fingerprint) {
      savedDocumentCache.set(prepared.fingerprint, structuredClone(prepared.persistedDocuments));
    }
  }
}

/**
 * Save the v1.0 document map through the two-resource transaction: stage
 * sidecars under a UUID staging basename, publish the cache generation, then
 * write the project with the bound transaction id. A writeProject failure
 * settles rollback (the previously committed generation stays published) and
 * re-throws; success settles commit.
 */
export async function saveEfxPaintDocumentsWithProjectWrite(
  projectDir: string,
  documents: ReadonlyMap<string, EfxPaintDocumentSaveInput> | undefined,
  writeProject: (
    persistedDocuments: Record<string, unknown>,
    cacheTransactionId: string | null,
  ) => Promise<void>,
): Promise<Record<string, unknown>> {
  const prepared = await prepareEfxPaintSave(projectDir, documents);
  try {
    await writeProject(
      prepared.persistedDocuments,
      prepared.publication?.transactionId ?? null,
    );
  } catch (error) {
    await settlePreparedEfxPaintSave(projectDir, prepared, 'rollback');
    throw error;
  }
  await settlePreparedEfxPaintSave(projectDir, prepared, 'commit');
  return prepared.persistedDocuments;
}

/**
 * Load the persisted layerId → document map. Every document passes the
 * fail-closed parser before any store hydration (T-45-13); sidecar PNGs are
 * read back through the plugin-fs idiom with every path guarded by
 * `isSafeEfxPaintCachePath` (T-45-11). Returns an empty map when the key is
 * absent.
 */
export async function loadEfxPaintDocuments(
  projectRoot: string,
  persistedMap: Record<string, unknown> | undefined,
): Promise<ReadonlyMap<string, EfxPaintLoadedDocument>> {
  const loaded = new Map<string, EfxPaintLoadedDocument>();
  if (persistedMap === undefined) return loaded;
  if (!isPlainRecord(persistedMap)) {
    throw new Error('EFX Paint documents must be a record.');
  }
  for (const [layerId, value] of Object.entries(persistedMap)) {
    const document = parseEfxPaintDocument(value);
    const frames = new Map<number, PhysicPaintRenderedFrame>();
    for (const track of document.tracks) {
      for (const [frameNumber, ref] of Object.entries(track.frames)) {
        const appFrame = Number(frameNumber);
        if (frames.has(appFrame)) {
          throw new Error(`EFX Paint document "${layerId}" claims frame ${appFrame} on multiple tracks.`);
        }
        if (!isSafeEfxPaintCachePath(ref.cachePath)) {
          throw new Error(`EFX Paint frame ${layerId}:${appFrame} has an unsafe sidecar path.`);
        }
        const bytes = await readFile(`${projectRoot}/${ref.cachePath}`);
        if (bytes.length === 0) {
          throw new Error(`EFX Paint sidecar is empty: ${ref.cachePath}`);
        }
        frames.set(appFrame, {
          frameIndex: 0,
          appFrame,
          dataUrl: encodePngDataUrl(bytes),
          width: ref.width,
          height: ref.height,
        });
      }
    }
    loaded.set(layerId, { document, frames });
  }
  return loaded;
}
