import type { PhysicPaintRotoRealKeyRecord } from './physicsPaintRotoPhysicalModel';

/**
 * Quick 261023-bxm Task 1: resolve what the bottom-timeline Duplicate action
 * must do about the SOURCE key's paint before cloning it.
 *
 * This is the + Key law (`resolvePreviousRealKeyBase`) applied to Duplicate's
 * source: cached/displayed bytes win, durable record bytes are the fallback,
 * and an unresolvable source fails closed — Duplicate never stages a
 * carrier-less key that would render blank.
 *
 * The display authority is `rotoPersistence.reference.findCachedRotoDisplayFrame`
 * (dirty preview for a real-key frame, else the accepted physical render
 * source). This resolver never invents bytes: a displayed paint is only
 * accepted when its bytes are non-empty and its `keyId` is absent or names the
 * source record's own key.
 */
export const ROTO_DUPLICATE_SOURCE_PAINT_UNAVAILABLE_ERROR = 'source key paint unavailable';

/**
 * The paint currently displayed for a key frame. `keyId` is optional because a
 * display frame from the physical render source always carries it, while a
 * caller-supplied composite may omit it; when present it must match the source
 * record or the paint belongs to someone else.
 */
export interface RotoDisplayedKeyPaint {
  readonly keyId?: string;
  readonly bytes: Uint8Array;
  readonly width?: number;
  readonly height?: number;
}

export type RotoDuplicateSourcePaintResolution =
  | { readonly kind: 'ready' }
  | { readonly kind: 'cook'; readonly paint: RotoDisplayedKeyPaint }
  | { readonly kind: 'unavailable' };

export interface RotoDuplicateSourcePaintInput {
  readonly record: PhysicPaintRotoRealKeyRecord;
  readonly displayed: RotoDisplayedKeyPaint | null;
}

function hasUsableBytes(bytes: Uint8Array | undefined): bytes is Uint8Array {
  return bytes instanceof Uint8Array && bytes.byteLength > 0;
}

/**
 * `ready` — the record already carries usable inline bytes; today's duplicate
 * path runs unchanged and nothing is rewritten.
 * `cook` — the record carries no bytes but the display does; publish exactly
 * those bytes onto the source key before duplicating.
 * `unavailable` — neither carrier resolves; fail closed, create no key.
 */
export function resolveRotoDuplicateSourcePaint(
  input: RotoDuplicateSourcePaintInput,
): RotoDuplicateSourcePaintResolution {
  if (hasUsableBytes(input.record.payload.bytes)) return { kind: 'ready' };
  const displayed = input.displayed;
  if (!displayed || !hasUsableBytes(displayed.bytes)) return { kind: 'unavailable' };
  if (displayed.keyId !== undefined && displayed.keyId !== input.record.keyId) {
    return { kind: 'unavailable' };
  }
  return { kind: 'cook', paint: displayed };
}
