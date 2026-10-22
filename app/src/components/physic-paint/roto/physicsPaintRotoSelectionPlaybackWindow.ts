import type { KeyRailSegment } from '../view/physicsPaintKeyRailPresentation';
import type { PhysicPaintRotoLoopRange } from './physicsPaintRotoPhysicalResolver';
import type { RailSetIdentity } from './physicsPaintRotoRailSetSelection';

/**
 * JQ0 (261022-jq0): pure SELECTION RANGE derivation for Studio playback.
 *
 * A selected rail (a Key Rail segment, one or more Loop Clip rails, or a
 * rail-set selection) scopes the cached Roto playback enumeration to its own
 * contiguous half-open span [start, endExclusive): the earliest selected rail
 * start to the latest selected rail end. This is a RANGE only — no per-frame
 * hiding, no attribution, no cells, no solo reads. The intervening frames keep
 * their normal composite; the module never writes to the document, history,
 * persistence, the bridge, or export.
 *
 * Fail-closed contract (T-jq0-01): an empty or unknown member set, malformed
 * inputs, a non-positive/non-integer capacity, or a degenerate clamped window
 * return null — the caller then keeps the unchanged full-range enumeration
 * rather than inventing a range.
 */
export interface RotoSelectionPlaybackWindow {
  /** First selected placement start (inclusive), clamped to >= 0. */
  readonly start: number;
  /** Last selected effective end (exclusive), clamped to the composite capacity. */
  readonly endExclusive: number;
}

export interface DeriveRotoSelectionPlaybackWindowInput {
  readonly members: readonly RailSetIdentity[];
  readonly keyRailSegments: readonly KeyRailSegment[];
  readonly loopRanges: readonly PhysicPaintRotoLoopRange[];
  readonly capacity: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isBoundedId(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 256;
}

/**
 * Derive the selection playback window. Returns null (fail closed) for an
 * empty/unknown member set, malformed inputs, or a degenerate clamped range;
 * otherwise a frozen window whose [start, endExclusive) bounds the playback
 * enumeration.
 */
export function deriveRotoSelectionPlaybackWindow(
  input: DeriveRotoSelectionPlaybackWindowInput,
): RotoSelectionPlaybackWindow | null {
  if (!isRecord(input)) return null;
  if (!Array.isArray(input.members) || input.members.length === 0) return null;
  if (!Array.isArray(input.keyRailSegments)) return null;
  if (!Array.isArray(input.loopRanges)) return null;
  if (!Number.isInteger(input.capacity) || input.capacity <= 0) return null;

  // Resolve every member against the authorities. Unknown identities fail the
  // whole derivation closed (stale selection, T-jq0-01). A loop may own
  // several visible fragments, so every matching range joins the span.
  let start = Infinity;
  let endExclusive = -Infinity;
  for (const member of input.members) {
    if (!isRecord(member)) return null;
    if (member.kind === 'key-rail') {
      if (!isBoundedId(member.firstKeyId)) return null;
      const segment = input.keyRailSegments.find(
        (candidate) => candidate.firstKeyId === member.firstKeyId,
      );
      if (segment === undefined) return null;
      start = Math.min(start, segment.firstKeyFrame);
      endExclusive = Math.max(endExclusive, segment.lastKeyFrame + 1);
    } else if (member.kind === 'loop') {
      if (!isBoundedId(member.loopId)) return null;
      const ranges = input.loopRanges.filter(
        (candidate) => candidate.loopId === member.loopId,
      );
      if (ranges.length === 0) return null;
      for (const range of ranges) {
        start = Math.min(start, range.placementStart);
        endExclusive = Math.max(endExclusive, range.effectiveEnd);
      }
    } else {
      return null;
    }
  }

  start = Math.max(0, start);
  endExclusive = Math.min(endExclusive, input.capacity);
  if (!Number.isFinite(start) || !Number.isFinite(endExclusive)) return null;
  if (start >= endExclusive) return null;

  return Object.freeze({ start, endExclusive }) as RotoSelectionPlaybackWindow;
}
