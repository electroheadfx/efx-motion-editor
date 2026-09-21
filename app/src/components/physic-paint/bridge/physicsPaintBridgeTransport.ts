import type { EfxPaintDocument, InternalPaintTrack } from '../../../efx-paint/document/efxPaintDocument';
import type { PhysicPaintApplyPayload, PhysicPaintRotoAuthorityRequest, PhysicPaintScriptLibraryRequest } from '../../../types/physicPaint';
import { buildPhysicPaintRotoPhysicalRevision } from '../roto/physicsPaintRotoPhysicalModel';
import type {
  PhysicPaintRotoRealKeyPayload,
  PhysicPaintRotoRealKeyRecord,
} from '../roto/physicsPaintRotoPhysicalModel';
import { toPersistedRotoRecords } from '../roto/physicsPaintRotoMediaProjection';
import { buildFrameMediaRelativePath, parseFrameMediaReference } from '../../../lib/efxPaintPackage';
import type { FrameMediaReference } from '../../../lib/efxPaintPackage';
import { base64ToWebpBytes, buildFrameBytesToken, fromTransportPayload, sha256HexBytes, toTransportPayload } from '../../../lib/webpBytes';
import { toUint8Array } from '../../../lib/webpFrameCodec';
import { PHYSIC_PAINT_APPLY_EVENT, PHYSIC_PAINT_AUDIO_OWNERSHIP_EVENT, PHYSIC_PAINT_EFX_PAINT_DOCUMENT_EVENT, PHYSIC_PAINT_ROTO_AUTHORITY_REQUEST_EVENT, PHYSIC_PAINT_SCRIPT_LIBRARY_REQUEST_EVENT } from '../../../lib/physicPaintBridge';
import type { RotoScriptThumbnailNativeEncoder } from '../roto/physicsPaintRotoScriptThumbnail';
import type { PhysicsPaintBridgeMode } from './usePhysicsPaintParentBridge';
import { recordPhysicsPaintPerformance } from '../performance/physicsPaintPerformanceTrace';

/** sessionStorage key for the crash-recovery document checkpoint (survives reload). */
export const PHYSIC_PAINT_SESSION_DOCUMENT_KEY = 'efx-paint-session-document';

export { encodeWebpFrame, decodeWebpFrame, type DecodedWebpFrame } from '../../../lib/webpFrameCodec';

export async function sendPhysicPaintFrameSyncMessage(frame: number, bridgeMode: PhysicsPaintBridgeMode): Promise<void> {
  const message = { type: 'physic-paint:seek-frame' as const, frame };
  if (bridgeMode === 'Tauri') {
    try {
      const eventApi = await import('@tauri-apps/api/event');
      await eventApi.emit?.('physic-paint:seek-frame', message);
      await eventApi.emitTo?.('main', 'physic-paint:seek-frame', message);
      return;
    } catch {
      // Browser fallback below keeps development and non-Tauri windows synced.
    }
  }
  window.opener?.postMessage?.(message, '*');
  window.dispatchEvent?.(new MessageEvent('message', { data: message }));
}

/**
 * 41-04 (D-05): child→main audio ownership claim/release — a lightweight
 * transient event (locked A5: never revisioned), targeting the 'main' window
 * label like the sibling request senders.
 */
export async function sendPhysicPaintAudioOwnership(claim: boolean, bridgeMode: PhysicsPaintBridgeMode): Promise<void> {
  const message = { claim };
  if (bridgeMode === 'Tauri') {
    const eventApi = await import('@tauri-apps/api/event');
    if (typeof eventApi.emitTo !== 'function') throw new Error('Tauri event emitTo API is unavailable');
    await eventApi.emitTo('main', PHYSIC_PAINT_AUDIO_OWNERSHIP_EVENT, message);
    return;
  }
  if (bridgeMode === 'Browser fallback' && window.opener) {
    window.opener.postMessage({ type: PHYSIC_PAINT_AUDIO_OWNERSHIP_EVENT, payload: message }, window.location.origin);
    return;
  }
  throw new Error('Audio ownership bridge is unavailable');
}

export async function sendPhysicPaintScriptLibraryRequest(request: PhysicPaintScriptLibraryRequest, bridgeMode: PhysicsPaintBridgeMode): Promise<void> {
  if (bridgeMode === 'Tauri') {
    const eventApi = await import('@tauri-apps/api/event');
    if (typeof eventApi.emitTo !== 'function') throw new Error('Tauri event emitTo API is unavailable');
    await eventApi.emitTo('main', PHYSIC_PAINT_SCRIPT_LIBRARY_REQUEST_EVENT, request);
    return;
  }
  if (bridgeMode === 'Browser fallback' && window.opener) {
    window.opener.postMessage({ type: PHYSIC_PAINT_SCRIPT_LIBRARY_REQUEST_EVENT, payload: request }, window.location.origin);
    return;
  }
  throw new Error('Project script library is unavailable');
}

/**
 * The child→main document sync payload (49-06 UAT round 11). The child carries
 * its runtime background source bytes alongside the document: the main window's
 * source registry is only hydrated at project load, so a clip added during the
 * child session (the Bg-picker import) would resolve 'missing' in the main
 * composite without this transfer (the "main app has no Bg render" symptom).
 *
 * 52.2-10 (D-12): the document crosses REFERENCE-SHAPED — every real-key
 * payload carries the same `frames/<layerId>/<keyId>.webp` reference + digest a
 * save would write, never an inline raster. Pixels ride the digest-keyed
 * `changedBytes` channel and only for a digest the companion window is not
 * known to hold, so the steady state ships no raster-sized string at all and a
 * raster referenced by several keys crosses once.
 */
export interface EfxPaintDocumentSyncPayload {
  readonly document: EfxPaintDocument;
  /**
   * digest → WebP bytes, for the frames this sync is actually shipping. The
   * channel stays in raw bytes here and is base64-encoded only at the JSON
   * boundary by `toTransportPayload` (D-19: the transport tokens live in the
   * allowlisted `webpBytes.ts`, never in this module).
   */
  readonly changedBytes?: Readonly<Record<string, Uint8Array>>;
  /** sourceRef → decoded dataUrl, for the refs this document's clips use. */
  readonly backgroundSources?: Readonly<Record<string, string>>;
}

/**
 * 52.2-10 (D-12): what the SENDER knows about the receiver's frame store. The
 * digest-keyed channel is only an optimization if it can be told what the
 * other window already holds — the caller (the persistence coordinator) knows
 * what it delivered and acknowledged.
 */
export interface EfxPaintDocumentSyncOptions {
  /**
   * Digests the companion window already holds; the sender ships only what is
   * missing. Adds to the sender's own delivered set — it never shrinks it, so
   * a caller that under-reports can only cost bytes, never lose a frame.
   */
  readonly knownDigests?: Iterable<string>;
}

interface DocumentSyncFrameEntry {
  /** O(1) content token of the bytes the digest was computed over. */
  readonly token: string;
  readonly digest: string;
}

/** Per (layer, track, collection, key) digest cache — re-hashing only on change. */
const documentSyncFrameEntries = new Map<string, DocumentSyncFrameEntry>();
/** Digests a successful sync already put on the wire. */
const documentSyncSentDigests = new Set<string>();

/**
 * Drop the sender-side transfer state. The delivered-digest set is a claim
 * about the companion window's frame store, so it must not survive that
 * window's lifetime (project close/open, window reload).
 */
export function resetEfxPaintDocumentSyncTransferState(): void {
  documentSyncFrameEntries.clear();
  documentSyncSentDigests.clear();
}

/**
 * quick-260913-52r (H): the crash-recovery checkpoint crosses the storage
 * boundary in the TRANSPORT shape — a raw `JSON.stringify` turns the
 * document's `Uint8Array` payloads into index objects the launch validator
 * refuses — and is BOUND to the launch operationId that wrote it. Only the
 * same launch (a watchdog reload of the same window re-fetches the same stored
 * context, hence the same operationId) may consume it; a checkpoint left by an
 * earlier Studio session can never substitute a newer launch's carried
 * document.
 */
export function writeEfxPaintSessionDocumentCheckpoint(operationId: string, document: EfxPaintDocument): void {
  try {
    sessionStorage.setItem(
      PHYSIC_PAINT_SESSION_DOCUMENT_KEY,
      JSON.stringify({ operationId, document: toTransportPayload(document) }),
    );
  } catch {
    // Quota exceeded — the launch-context fallback still applies on reload.
  }
}

export function readEfxPaintSessionDocumentCheckpoint(operationId: string): EfxPaintDocument | null {
  try {
    const raw = sessionStorage.getItem(PHYSIC_PAINT_SESSION_DOCUMENT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { operationId?: unknown; document?: unknown };
    if (parsed === null || typeof parsed !== 'object' || parsed.operationId !== operationId) return null;
    if (parsed.document === undefined) return null;
    return fromTransportPayload(parsed.document) as EfxPaintDocument;
  } catch {
    return null;
  }
}

/**
 * 52.2-10 (D-12, T-52.2-35): the sender-side counterpart of the receiver's
 * `has`/`install` port pair. The frame persistence coordinator marks a frame
 * whose bytes it just delivered through the apply channel, so the next
 * document sync treats that digest as receiver-held and withholds it — a
 * retry after a partial success re-sends only what the receiver actually
 * lacks.
 */
export async function markEfxPaintDocumentSyncFrameDelivered(
  layerId: string,
  trackId: string,
  keyId: string,
  bytes: Uint8Array,
): Promise<void> {
  const digest = await digestForFrame(JSON.stringify([layerId, trackId, 'real-key', keyId]), bytes);
  documentSyncSentDigests.add(digest);
}

function isFrameMediaReferenceValue(value: unknown): value is FrameMediaReference {
  try {
    parseFrameMediaReference(value, 'sync.media');
    return true;
  } catch {
    return false;
  }
}

/**
 * The inline raster carrier of a runtime payload: the live `Uint8Array`, or its
 * canonical base64 JSON form (the shape a checkpoint rehydrate produces).
 * `null` means the payload carries no inline raster — the caller must not
 * invent one (T-52.2-18).
 */
function rasterBytesOf(payload: PhysicPaintRotoRealKeyPayload): Uint8Array | null {
  const inline = payload.bytes as Uint8Array | string | undefined;
  if (inline instanceof Uint8Array) return inline;
  if (typeof inline === 'string') return base64ToWebpBytes(inline);
  return null;
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  // The shared helper (lib/webpBytes) is the one SHA-256 implementation: the
  // native media write hashes exactly these bytes, so the bridge digest and
  // the persisted one name the same content (plain SHA-256, lowercase hex).
  return sha256HexBytes(bytes);
}

async function digestForFrame(cacheKey: string, bytes: Uint8Array): Promise<string> {
  const token = buildFrameBytesToken(bytes);
  const cached = documentSyncFrameEntries.get(cacheKey);
  if (cached !== undefined && cached.token === token) return cached.digest;
  const digest = await sha256Hex(bytes);
  documentSyncFrameEntries.set(cacheKey, { token, digest });
  return digest;
}

/**
 * Project one real-key collection to its reference shape, filling
 * `changedBytes` for the digests the receiver is not known to hold. `null`
 * means a record carried neither carrier — the caller passes that collection
 * through untouched rather than fabricating a reference.
 */
async function projectRecordsForSync(
  records: readonly PhysicPaintRotoRealKeyRecord[],
  collection: string,
  layerId: string,
  trackId: string,
  knownDigests: ReadonlySet<string>,
  changedBytes: Record<string, Uint8Array>,
  shippedDigests: Set<string>,
): Promise<readonly PhysicPaintRotoRealKeyRecord[] | null> {
  const references = new Map<string, FrameMediaReference>();
  for (const record of records) {
    const payload = record.payload;
    const bytes = rasterBytesOf(payload);
    if (bytes === null) {
      if (!isFrameMediaReferenceValue(payload.media)) return null;
      references.set(record.keyId, payload.media);
      continue;
    }
    const digest = await digestForFrame(JSON.stringify([layerId, trackId, collection, record.keyId]), bytes);
    references.set(record.keyId, {
      relativePath: buildFrameMediaRelativePath(layerId, record.keyId),
      digest,
      ...(payload.width !== undefined ? { width: payload.width } : {}),
      ...(payload.height !== undefined ? { height: payload.height } : {}),
    });
    if (!knownDigests.has(digest) && changedBytes[digest] === undefined) {
      changedBytes[digest] = bytes;
      shippedDigests.add(digest);
    }
  }
  const projected = toPersistedRotoRecords(records, (keyId) => references.get(keyId));
  return projected.ok ? projected.records : null;
}

interface DocumentSyncProjection {
  readonly document: EfxPaintDocument;
  readonly changedBytes: Readonly<Record<string, Uint8Array>> | undefined;
  readonly shippedDigests: readonly string[];
}

async function projectEfxPaintDocumentForSync(
  document: EfxPaintDocument,
  knownDigests: ReadonlySet<string>,
): Promise<DocumentSyncProjection> {
  const changedBytes: Record<string, Uint8Array> = {};
  const shippedDigests = new Set<string>();
  const tracks: InternalPaintTrack[] = [];
  for (const track of document.tracks) {
    const roto = track.rotoPhysical;
    if (roto === null) {
      tracks.push(track);
      continue;
    }
    const realKeyRecords = await projectRecordsForSync(
      roto.realKeyRecords, 'real-key', document.parentLayerId, track.id, knownDigests, changedBytes, shippedDigests,
    );
    const overrides = roto.groupOverrideRecords;
    const groupOverrideRecords = overrides === undefined
      ? undefined
      : await projectRecordsForSync(
        overrides, 'group-override', document.parentLayerId, track.id, knownDigests, changedBytes, shippedDigests,
      );
    const projectedRealKeyRecords = realKeyRecords ?? roto.realKeyRecords;
    const projectedGroupOverrideRecords = groupOverrideRecords === undefined
      ? roto.groupOverrideRecords
      : groupOverrideRecords ?? overrides;
    tracks.push({
      ...track,
      rotoPhysical: {
        ...roto,
        realKeyRecords: projectedRealKeyRecords,
        ...(groupOverrideRecords === undefined ? {} : { groupOverrideRecords: projectedGroupOverrideRecords }),
        // 2026-09-21 (studio-origin-persist-loss): the shipped document is a
        // PROJECTED document, so its revision must be the canonical revision
        // OF THE PROJECTED collections (the media-reference terms) — the same
        // law every other projection seam honors (`extractRuntimeStateForDocument`
        // in physicPaintStore). Spreading the runtime revision here shipped
        // byte-token terms over media-carrying records, and the receiver's
        // fail-closed parse (physicPaintBridge.ts applyDocument) rejected
        // EVERY sync with 'canonical revision mismatch' — the whole
        // physic-paint:efx-paint-document channel was dead in the live app.
        revision: buildPhysicPaintRotoPhysicalRevision(
          projectedRealKeyRecords,
          roto.interpolation,
          roto.loopClips,
          roto.incomingInterpolationBreakKeyIds,
          projectedGroupOverrideRecords,
        ),
      },
    });
  }
  return {
    document: { ...document, tracks },
    changedBytes: Object.keys(changedBytes).length > 0 ? changedBytes : undefined,
    shippedDigests: Array.from(shippedDigests),
  };
}

/**
 * 47-01: child→main document sync. The Studio window owns its own
 * efxPaintStore instance; track CRUD (add/rename/reorder/duplicate/delete,
 * display props, active-track switch) mutates the CHILD document only. The
 * main window's save path serializes ITS document, so the child pushes its
 * current document here on every efxPaintVersion bump — the main window
 * re-registers it (idempotency guarded by revision) and the project save
 * re-projects frames/rotoPhysical from the main window's own runtime.
 *
 * 52.2-10 (D-12): the push projects the document to references first (both
 * roto collections) and ships pixels only for the digests the receiver is not
 * known to hold — the ~4.5 s `docSync` term was the per-sync base64 of every
 * frame's raster, so the steady-state payload is references + metadata.
 */
export async function sendEfxPaintDocumentSync(
  document: EfxPaintDocument,
  bridgeMode: PhysicsPaintBridgeMode,
  backgroundSources?: Readonly<Record<string, string>>,
  options?: EfxPaintDocumentSyncOptions,
): Promise<void> {
  const knownDigests = new Set<string>(documentSyncSentDigests);
  if (options?.knownDigests !== undefined) {
    for (const digest of options.knownDigests) knownDigests.add(digest);
  }
  const projectStartedAtMs = performance.now();
  const projection = await projectEfxPaintDocumentForSync(document, knownDigests);
  recordPhysicsPaintPerformance({
    stage: 'bridge.docSyncProject',
    category: 'sync-cpu',
    durationMs: performance.now() - projectStartedAtMs,
    timestamp: performance.now(),
  });
  const payload: EfxPaintDocumentSyncPayload = {
    document: projection.document,
    ...(projection.changedBytes === undefined ? {} : { changedBytes: projection.changedBytes }),
    ...(backgroundSources === undefined ? {} : { backgroundSources }),
  };
  const committed = (): void => {
    for (const digest of projection.shippedDigests) documentSyncSentDigests.add(digest);
  };
  if (bridgeMode === 'Tauri') {
    const eventApi = await import('@tauri-apps/api/event');
    if (typeof eventApi.emitTo !== 'function') throw new Error('Tauri event emitTo API is unavailable');
    // 52.1 (D-05): emitTo serializes as JSON, turning any remaining Uint8Array
    // into an index object. The document is reference-shaped by now, so this
    // encodes only the changed-frame channel and the background sources.
    const encodeStartedAtMs = performance.now();
    const encoded = toTransportPayload(payload);
    recordPhysicsPaintPerformance({
      stage: 'bridge.docSyncEncode',
      category: 'sync-cpu',
      durationMs: performance.now() - encodeStartedAtMs,
      timestamp: performance.now(),
    });
    const emitStartedAtMs = performance.now();
    await eventApi.emitTo('main', PHYSIC_PAINT_EFX_PAINT_DOCUMENT_EVENT, encoded);
    recordPhysicsPaintPerformance({
      stage: 'bridge.docSyncEmit',
      category: 'async-elapsed',
      durationMs: performance.now() - emitStartedAtMs,
      timestamp: performance.now(),
    });
    // Only a delivered sync may claim the receiver holds these digests.
    committed();
    return;
  }
  if (bridgeMode === 'Browser fallback') {
    if (!window.opener) throw new Error('Browser fallback bridge is unavailable');
    window.opener.postMessage({ type: PHYSIC_PAINT_EFX_PAINT_DOCUMENT_EVENT, payload: toTransportPayload(payload) }, window.location.origin);
    committed();
    return;
  }
  throw new Error('App bridge is not connected');
}

export async function sendPhysicPaintRotoAuthorityRequest(request: PhysicPaintRotoAuthorityRequest, bridgeMode: PhysicsPaintBridgeMode): Promise<void> {
  if (bridgeMode === 'Tauri') {
    const eventApi = await import('@tauri-apps/api/event');
    if (typeof eventApi.emitTo !== 'function') throw new Error('Tauri event emitTo API is unavailable');
    await eventApi.emitTo('main', PHYSIC_PAINT_ROTO_AUTHORITY_REQUEST_EVENT, request);
    return;
  }
  if (bridgeMode === 'Browser fallback' && window.opener) {
    window.opener.postMessage({ type: PHYSIC_PAINT_ROTO_AUTHORITY_REQUEST_EVENT, payload: request }, window.location.origin);
    return;
  }
  throw new Error('Roto authority is unavailable');
}

export function createPhysicPaintThumbnailNativeEncoder(): RotoScriptThumbnailNativeEncoder {
  return {
    async encodeWebp({ width, height, quality, rgba }) {
      const core = await import('@tauri-apps/api/core');
      if (typeof core.invoke !== 'function') throw new Error('Tauri thumbnail encoder invoke is unavailable');
      // 52.1 (D-05/D-07): raw byte-body invoke, mirroring encode_webp_frame —
      // never the event bridge, whose JSON serialization turns the rgba
      // Uint8Array into an index object the main-window validator rejects,
      // orphaning the request until the (silent) timeout kills the save.
      const result = await core.invoke('script_library_encode_thumbnail_webp', rgba, {
        headers: {
          operationid: `physics-paint-thumbnail-${Date.now()}-${crypto.randomUUID()}`,
          width: String(width),
          height: String(height),
          quality: String(quality),
        },
      });
      return { width, height, mimeType: 'image/webp', bytes: toUint8Array(result) };
    },
  };
}

export async function sendPhysicPaintApplyPayload(payload: PhysicPaintApplyPayload, bridgeMode: PhysicsPaintBridgeMode): Promise<void> {
  if (bridgeMode === 'Tauri') {
    const eventApi = await import('@tauri-apps/api/event');
    if (typeof eventApi.emitTo !== 'function') throw new Error('Tauri event emitTo API is unavailable');
    // 52.1 (D-05): emitTo serializes as JSON, which turns Uint8Array frame
    // bytes into index objects. Convert bytes -> base64 so the parent-side
    // validators see the canonical string form instead of a corrupted array.
    const encodeStartedAtMs = performance.now();
    const encoded = toTransportPayload(payload);
    recordPhysicsPaintPerformance({
      stage: 'bridge.applyEncode',
      category: 'sync-cpu',
      durationMs: performance.now() - encodeStartedAtMs,
      timestamp: performance.now(),
    });
    const emitStartedAtMs = performance.now();
    await eventApi.emitTo('main', PHYSIC_PAINT_APPLY_EVENT, encoded);
    recordPhysicsPaintPerformance({
      stage: 'bridge.applyEmit',
      category: 'async-elapsed',
      durationMs: performance.now() - emitStartedAtMs,
      timestamp: performance.now(),
    });
    return;
  }

  if (bridgeMode === 'Browser fallback') {
    if (!window.opener) throw new Error('Browser fallback bridge is unavailable');
    window.opener.postMessage({ type: PHYSIC_PAINT_APPLY_EVENT, payload }, window.location.origin);
    return;
  }

  throw new Error('App bridge is not connected');
}
