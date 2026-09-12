import type { FrameMediaReference } from '../../../lib/efxPaintPackage';
import type {
  PhysicPaintRotoRealKeyPayload,
  PhysicPaintRotoRealKeyRecord,
} from './physicsPaintRotoPhysicalModel';
import { requirePhysicPaintRotoInlineBytes } from './physicsPaintRotoPhysicalModel';

/**
 * 52.2-06 (D-06/D-07): the two pure projections that move a roto real-key
 * record between the runtime shape (inline `bytes`) and the persisted shape
 * (`media` reference, no raster field).
 *
 * The module is deliberately collection-agnostic: `realKeyRecords` and
 * `groupOverrideRecords` share {@link PhysicPaintRotoRealKeyRecord}, so one
 * implementation serves both and the CALL SITES own coverage — each of them
 * (the serialize seam in `efxPaintStore`/`physicPaintStore`, the hydrate seam
 * in `physicPaintStore`) must pass both collections. A per-collection
 * overload, a collection flag or a pass-through branch here would be the bug
 * this contract exists to prevent.
 *
 * Media is never invented (T-52.2-18): the only source is the caller-supplied
 * `resolveRef`. A key with runtime bytes and no resolved reference is a typed
 * failure, never a record without media and never a fallback to the payload —
 * a fabricated digest would be refused on reopen and silently lose the key.
 *
 * The module is pure: no filesystem, no IPC, no store, no signal.
 */

/** Typed failure of the media path: the caller owes a reference for this key. */
export interface PhysicPaintRotoMediaProjectionFailure {
  readonly kind: 'unresolved-media-reference';
  readonly keyId: string;
}

/**
 * Result of {@link toPersistedRotoRecords}. Failure carries no partial
 * collection: a half-projected layer must never reach a writer.
 */
export type PhysicPaintRotoMediaProjectionResult =
  | { readonly ok: true; readonly records: readonly PhysicPaintRotoRealKeyRecord[] }
  | { readonly ok: false; readonly failure: PhysicPaintRotoMediaProjectionFailure };

/**
 * The caller's media authority — plans 07/09 supply the digests the native
 * package write returned, keyed by the record's stable `keyId`.
 */
export type PhysicPaintRotoMediaReferenceResolver = (keyId: string) => FrameMediaReference | undefined;

/**
 * Shipping vehicle for {@link PhysicPaintRotoMediaProjectionFailure} at seams
 * whose contract is a return value (`serializeRuntimeIntoDocument` returns a
 * document, so a failed projection can only be signalled by throwing). The
 * failure itself stays inspectable on `failure`; the message names the key so
 * a log or a caller-side catch is actionable without unwrapping.
 */
export class PhysicPaintRotoMediaProjectionError extends Error {
  readonly failure: PhysicPaintRotoMediaProjectionFailure;

  constructor(failure: PhysicPaintRotoMediaProjectionFailure) {
    super(
      `Roto media reference unresolved for key "${failure.keyId}" — a persisted record cannot carry an inline raster payload.`,
    );
    this.name = 'PhysicPaintRotoMediaProjectionError';
    this.failure = failure;
  }
}

/**
 * Build the media-carrying payload explicitly from allowlisted members only —
 * never by spreading the runtime payload, so no raster field can survive a
 * projection even if one is added to the runtime shape later.
 */
function buildMediaPayload(
  payload: PhysicPaintRotoRealKeyPayload,
  media: FrameMediaReference,
): PhysicPaintRotoRealKeyPayload {
  return Object.freeze({
    frameIndex: payload.frameIndex,
    appFrame: payload.appFrame,
    media,
    ...(payload.width !== undefined ? { width: payload.width } : {}),
    ...(payload.height !== undefined ? { height: payload.height } : {}),
  });
}

/**
 * Runtime records → persisted records. Each record keeps its identity
 * (`keyId`, `appFrame`) and payload metadata verbatim and takes its pixels'
 * reference from `resolveRef(keyId)`; the inline raster carrier is dropped.
 *
 * Fails closed the moment one key has no reference, naming that key.
 */
export function toPersistedRotoRecords(
  records: readonly PhysicPaintRotoRealKeyRecord[],
  resolveRef: PhysicPaintRotoMediaReferenceResolver,
): PhysicPaintRotoMediaProjectionResult {
  const projected: PhysicPaintRotoRealKeyRecord[] = [];
  for (const record of records) {
    const media = resolveRef(record.keyId);
    if (media === undefined) {
      return Object.freeze({
        ok: false as const,
        failure: Object.freeze({ kind: 'unresolved-media-reference' as const, keyId: record.keyId }),
      });
    }
    projected.push(
      Object.freeze({
        kind: 'real-key' as const,
        keyId: record.keyId,
        appFrame: record.appFrame,
        payload: buildMediaPayload(record.payload, media),
      }),
    );
  }
  return Object.freeze({ ok: true as const, records: Object.freeze(projected) });
}

/**
 * Persisted records → runtime records. A media-carrying record is rebuilt as
 * an immutable media-only record — no byte buffer is ever allocated for it,
 * because the pixels arrive from the package on demand (plan 09).
 *
 * A live bytes-carrying record (the in-memory resync path, which never left
 * the runtime) passes through untouched; a payload carrying neither carrier is
 * a contract violation and refuses loudly rather than installing a key with no
 * pixels.
 */
export function toRuntimeRotoRecords(
  records: readonly PhysicPaintRotoRealKeyRecord[],
): readonly PhysicPaintRotoRealKeyRecord[] {
  return Object.freeze(
    records.map((record) => {
      const media = record.payload.media;
      if (media === undefined) {
        requirePhysicPaintRotoInlineBytes(record.payload);
        return record;
      }
      return Object.freeze({
        kind: 'real-key' as const,
        keyId: record.keyId,
        appFrame: record.appFrame,
        payload: buildMediaPayload(record.payload, media),
      });
    }),
  );
}
