import type { PhysicPaintRotoCacheFrame } from '../../../types/physicPaint';
import type { PhysicPaintRotoRealKeyPayload, PhysicPaintRotoRealKeyRecord } from './physicsPaintRotoPhysicalModel';

/**
 * Quick 261022-cfn Task 1: the ONE previous-real-key base resolver shared by
 * + Key (`useRotoKeyUtilities.addKey`) and the Studio auto-paint promotion.
 * A real key cloned from the nearest previous real key, a blank base when no
 * previous real key exists, or a fail-closed `unavailable` when the previous
 * key exists but neither carrier holds usable bytes.
 */
export type PreviousRealKeyBaseResolution =
  | { kind: 'clone'; payload: PhysicPaintRotoRealKeyPayload & { readonly bytes: Uint8Array } }
  | { kind: 'blank' }
  | { kind: 'unavailable' };

export interface PreviousRealKeyBaseInput {
  readonly records: readonly PhysicPaintRotoRealKeyRecord[];
  readonly cachedRotoFrames?: readonly PhysicPaintRotoCacheFrame[];
}

/** Shared failure text so both promotion call sites build the same message. */
export const PREVIOUS_KEY_BYTES_UNAVAILABLE_ERROR = 'previous key bytes unavailable';

function hasUsableBytes(bytes: Uint8Array | undefined): bytes is Uint8Array {
  return bytes instanceof Uint8Array && bytes.byteLength > 0;
}

function toDestinationPayload(
  carrier: { readonly frameIndex: number; readonly bytes: Uint8Array; readonly width?: number; readonly height?: number },
  destinationAppFrame: number,
): PhysicPaintRotoRealKeyPayload & { readonly bytes: Uint8Array } {
  return Object.freeze({
    frameIndex: carrier.frameIndex,
    appFrame: destinationAppFrame,
    bytes: carrier.bytes,
    ...(carrier.width !== undefined ? { width: carrier.width } : {}),
    ...(carrier.height !== undefined ? { height: carrier.height } : {}),
  }) as PhysicPaintRotoRealKeyPayload & { readonly bytes: Uint8Array };
}

/**
 * Build a frozen payload from a blank frame, relabeling only `appFrame` to the
 * destination. Used by the + Key blank branch and the promotion's blank base.
 */
export function toEmptyKeyPayload(blank: PhysicPaintRotoCacheFrame, destinationAppFrame: number): PhysicPaintRotoRealKeyPayload {
  return toDestinationPayload(blank, destinationAppFrame);
}

/**
 * D-04: resolve the + Key / auto-paint base from the nearest previous REAL key
 * (strictly earlier than the destination). Cached real-key bytes are preferred
 * over the durable record payload; a previous key with no usable bytes on
 * either carrier fails closed. Only a frame with NO previous real key receives
 * a blank resolution.
 */
export function resolvePreviousRealKeyBase(
  input: PreviousRealKeyBaseInput,
  destinationAppFrame: number,
): PreviousRealKeyBaseResolution {
  let previousFrame: number | null = null;
  for (const record of input.records) {
    if (!Number.isInteger(record.appFrame) || record.appFrame >= destinationAppFrame) continue;
    if (previousFrame === null || record.appFrame > previousFrame) previousFrame = record.appFrame;
  }
  if (previousFrame === null) return { kind: 'blank' };
  const cached = (input.cachedRotoFrames ?? []).find(
    (frame) => frame.appFrame === previousFrame && frame.source === 'real-key' && hasUsableBytes(frame.bytes),
  );
  if (cached) return { kind: 'clone', payload: toDestinationPayload(cached, destinationAppFrame) };
  const durable = input.records.find(
    (record) => record.appFrame === previousFrame && hasUsableBytes(record.payload.bytes),
  );
  if (durable && durable.payload.bytes) {
    return {
      kind: 'clone',
      payload: toDestinationPayload({ ...durable.payload, bytes: durable.payload.bytes }, destinationAppFrame),
    };
  }
  return { kind: 'unavailable' };
}
