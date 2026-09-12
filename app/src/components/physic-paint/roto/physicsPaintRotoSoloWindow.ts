import type { KeyRailSegment } from '../view/physicsPaintKeyRailPresentation';
import type {
  PhysicPaintRotoLoopRange,
  PhysicPaintRotoPhysicalCell,
} from './physicsPaintRotoPhysicalResolver';
import type { RailSetIdentity } from './physicsPaintRotoRailSetSelection';

/**
 * Pure solo playback window derivation (D-19, A3, Open Question 4).
 *
 * The solo window is a session-only presentation filter: it derives the
 * effective play range and per-frame attribution for the selected rails from
 * the SAME authorities the timeline paint uses — the accepted physical cells,
 * the loopResolutionContext ranges, and the Key Rail segments — never from
 * session paint (Pattern 5 discipline). It never writes back to the document,
 * history, persistence, or the bridge.
 *
 * Fail-closed contract (T-43.6-02): an empty or unknown member set, malformed
 * inputs, or a degenerate clamped window return null — solo simply does not
 * arm a window.
 *
 * Attribution (A3): every physical frame's content belongs to at most one
 * rail (single-kind cells, single-owner render sources), so frame-granular
 * hiding is exact:
 *  - real cells attribute to a selected Key Rail (keyId in its keyIds) or a
 *    selected Group (keyId in its source/override keys);
 *  - generated cells attribute to the selected segment/loop that owns their
 *    interpolation pair;
 *  - empty cells inside a selected rail's span play transparent by
 *    construction (Open Question 4);
 *  - frames outside every selected rail's span are excluded.
 */
export interface SoloPlaybackWindow {
  /** First selected placement start (inclusive). */
  readonly start: number;
  /** Last selected effective end (exclusive), clamped to capacity. */
  readonly endExclusive: number;
  /** Attribution predicate: true iff the frame plays during solo. */
  includesFrame(appFrame: number): boolean;
}

export interface DeriveSoloPlaybackWindowInput {
  readonly members: readonly RailSetIdentity[];
  readonly keyRailSegments: readonly KeyRailSegment[];
  readonly loopRanges: readonly PhysicPaintRotoLoopRange[];
  readonly cells: readonly PhysicPaintRotoPhysicalCell[];
  readonly capacity: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * Derive the solo playback window for a rail set. Returns null (fail closed)
 * for an empty/unknown member set, malformed inputs, or a degenerate clamped
 * range; otherwise a window whose [start, endExclusive) bounds the playback
 * enumeration and whose includesFrame predicate hides unselected content.
 */
export function deriveSoloPlaybackWindow(
  input: DeriveSoloPlaybackWindowInput,
): SoloPlaybackWindow | null {
  if (!isRecord(input)) return null;
  if (!Array.isArray(input.members) || input.members.length === 0) return null;
  if (!Array.isArray(input.keyRailSegments)) return null;
  if (!Array.isArray(input.loopRanges)) return null;
  if (!Array.isArray(input.cells)) return null;
  if (!Number.isInteger(input.capacity) || input.capacity <= 0) return null;

  // Resolve the selected members against the authorities. Unknown identities
  // fail closed (stale selection, T-43.6-02). A loop may own several visible
  // fragments, so every matching range joins the selected set.
  const selectedSegments: KeyRailSegment[] = [];
  const selectedRanges: PhysicPaintRotoLoopRange[] = [];
  for (const member of input.members) {
    if (member.kind === 'key-rail') {
      const segment = input.keyRailSegments.find((candidate) => candidate.firstKeyId === member.firstKeyId);
      if (segment === undefined) return null;
      selectedSegments.push(segment);
    } else if (member.kind === 'loop') {
      const ranges = input.loopRanges.filter((candidate) => candidate.loopId === member.loopId);
      if (ranges.length === 0) return null;
      selectedRanges.push(...ranges);
    } else {
      return null;
    }
  }

  // Effective boundaries (D-19): first selected placement start to last
  // selected effective end (loop effectiveEnd includes generated/linked
  // occurrences; Key Rail = lastKeyFrame + 1), clamped to capacity.
  let start = Infinity;
  let endExclusive = -Infinity;
  for (const segment of selectedSegments) {
    start = Math.min(start, segment.firstKeyFrame);
    endExclusive = Math.max(endExclusive, segment.lastKeyFrame + 1);
  }
  for (const range of selectedRanges) {
    start = Math.min(start, range.placementStart);
    endExclusive = Math.max(endExclusive, range.effectiveEnd);
  }
  start = Math.max(0, start);
  endExclusive = Math.min(endExclusive, input.capacity);
  if (start >= endExclusive) return null;

  // Key sets for attribution.
  const selectedSegmentKeyIds = new Set<string>();
  for (const segment of selectedSegments) {
    for (const keyId of segment.keyIds) selectedSegmentKeyIds.add(keyId);
  }
  const selectedSourceKeyIds = new Set<string>();
  for (const range of selectedRanges) {
    for (const keyId of range.sourceKeyIds) selectedSourceKeyIds.add(keyId);
  }
  // Every segment/source key (selected or not) classifies group-owned
  // override keys: a real key in no segment and no source cycle is an
  // override key of the loop whose span covers it.
  const allSegmentKeyIds = new Set<string>();
  for (const segment of input.keyRailSegments) {
    for (const keyId of segment.keyIds) allSegmentKeyIds.add(keyId);
  }
  const allSourceKeyIds = new Set<string>();
  for (const range of input.loopRanges) {
    for (const keyId of range.sourceKeyIds) allSourceKeyIds.add(keyId);
  }

  const inSelectedSegmentSpan = (appFrame: number): boolean =>
    selectedSegments.some(
      (segment) => appFrame >= segment.firstKeyFrame && appFrame < segment.lastKeyFrame + 1,
    );
  const inSelectedLoopSpan = (appFrame: number): boolean =>
    selectedRanges.some(
      (range) => appFrame >= range.placementStart && appFrame < range.effectiveEnd,
    );

  const includesFrame = (appFrame: number): boolean => {
    if (!Number.isInteger(appFrame)) return false;
    if (appFrame < start || appFrame >= endExclusive) return false;
    const cell = input.cells[appFrame];
    if (cell === undefined) return false;

    if (cell.kind === 'real') {
      if (selectedSegmentKeyIds.has(cell.keyId)) return true;
      if (selectedSourceKeyIds.has(cell.keyId)) return true;
      // Group-owned override key: not in any Key Rail segment and not a
      // source key of any loop — attribute to the selected loop whose span
      // covers the frame.
      if (!allSegmentKeyIds.has(cell.keyId) && !allSourceKeyIds.has(cell.keyId)) {
        return inSelectedLoopSpan(appFrame);
      }
      return false;
    }

    if (cell.kind === 'generated') {
      const ownedBySelectedSegment = selectedSegments.some(
        (segment) =>
          appFrame >= segment.firstKeyFrame
          && appFrame < segment.lastKeyFrame + 1
          && (segment.keyIds.includes(cell.leftKeyId) || segment.keyIds.includes(cell.rightKeyId)),
      );
      if (ownedBySelectedSegment) return true;
      return selectedRanges.some(
        (range) =>
          appFrame >= range.placementStart
          && appFrame < range.effectiveEnd
          && (range.sourceKeyIds.includes(cell.leftKeyId) || range.sourceKeyIds.includes(cell.rightKeyId)),
      );
    }

    // Empty cell: transparent inside a selected rail's span (Open Question 4).
    return inSelectedSegmentSpan(appFrame) || inSelectedLoopSpan(appFrame);
  };

  return Object.freeze({ start, endExclusive, includesFrame }) as SoloPlaybackWindow;
}

/**
 * D-20/D-21/D-22: solo playback starts at the BEGINNING of the isolated
 * content — a review starts at the start of what was isolated.
 *
 * Two distinct solo systems feed one rule:
 *  - the session rail-set pill (`physicsPaintSoloArm.ts` arm + the derived
 *    `SoloPlaybackWindow`): its `start` IS the content start by construction
 *    (first selected placement start, D-21 first system);
 *  - the persisted row-S document track solo (`setTrackSolo` flags): the
 *    content start is the first painted key across the soloed tracks, falling
 *    back to project frame 0 when they carry none (D-21 second system).
 *
 * Precedence is the session window first, then row-S, then 0 — matching the
 * pill's own enumeration (which already restricts to its window). The caller
 * filters `paintedKeyFrames` to the soloed tracks; this resolver never reads
 * the document, persistence, the bridge, or session paint (pure, matching the
 * module's existing contract).
 *
 * Total function (T-52.2-12): clamped into [0, capacity - 1], a non-finite,
 * zero, or negative capacity collapses to 0, and no input can throw.
 */
export interface DeriveSoloContentStartInput {
  /** The armed session solo window (pill), or null when the pill is disarmed. */
  readonly sessionWindow: SoloPlaybackWindow | null;
  /** Persisted row-S document solo track ids (empty = no row-S solo). */
  readonly documentSoloTrackIds: readonly string[];
  /** Painted key appFrames, already filtered to the soloed tracks. */
  readonly paintedKeyFrames: readonly number[];
  /** Frame-list capacity (the playback range's frame count). */
  readonly capacity: number;
}

/** D-20/D-21: resolve the playback start index for the current solo state. */
export interface ResolvePlaybackStartIndexInput {
  /** True while any solo (session pill or persisted row-S) is active. */
  readonly soloActive: boolean;
  /** The solo content start (D-21) — unused while `soloActive` is false. */
  readonly contentStart: number;
  /** The shared application-frame cursor at Play press time (Phase 51 law). */
  readonly cursorAppFrame: number;
  /** The playback enumeration; only `appFrame` is read. */
  readonly cachedFrames: readonly { readonly appFrame: number }[];
}

/** Clamp a solo content start into [0, capacity - 1]; degenerate caps → 0. */
function clampSoloContentStart(value: number, capacity: number): number {
  const frameCount = Number.isFinite(capacity) ? Math.floor(capacity) : 0;
  const lastIndex = frameCount > 0 ? frameCount - 1 : 0;
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.min(Math.floor(value), lastIndex);
}

export function deriveSoloContentStart(input: DeriveSoloContentStartInput): number {
  if (!isRecord(input)) return 0;
  const capacity = typeof input.capacity === 'number' ? input.capacity : 0;

  if (isRecord(input.sessionWindow)) {
    return clampSoloContentStart(
      typeof input.sessionWindow.start === 'number' ? input.sessionWindow.start : 0,
      capacity,
    );
  }

  const soloTrackIds = Array.isArray(input.documentSoloTrackIds) ? input.documentSoloTrackIds : [];
  if (soloTrackIds.length === 0) return 0;

  const paintedFrames = Array.isArray(input.paintedKeyFrames) ? input.paintedKeyFrames : [];
  let firstPaintedKey = Infinity;
  for (const appFrame of paintedFrames) {
    if (Number.isFinite(appFrame)) firstPaintedKey = Math.min(firstPaintedKey, appFrame);
  }
  if (firstPaintedKey === Infinity) return 0; // no painted keys → frame 0 (D-21)
  return clampSoloContentStart(firstPaintedKey, capacity);
}

/**
 * D-20/D-22: the playback start index. With no solo active this reproduces the
 * Phase 51 play-from-cursor law byte-for-byte (the cursor's index, falling back
 * to index 0); with a solo active it returns the first cached frame at or after
 * the solo content start, falling back to index 0 when no frame reaches it —
 * always an index into `cachedFrames`, so no solo value can move the playhead
 * outside the frame list (T-52.2-11). Total function: an empty frame list
 * yields 0.
 */
export function resolvePlaybackStartIndex(input: ResolvePlaybackStartIndexInput): number {
  if (!isRecord(input)) return 0;
  const cachedFrames = Array.isArray(input.cachedFrames) ? input.cachedFrames : [];
  if (input.soloActive !== true) {
    const cursorIndex = cachedFrames.findIndex((entry) => entry.appFrame === input.cursorAppFrame);
    return cursorIndex >= 0 ? cursorIndex : 0;
  }
  const contentStart = Number.isFinite(input.contentStart) ? input.contentStart : 0;
  const soloIndex = cachedFrames.findIndex((entry) => entry.appFrame >= contentStart);
  return soloIndex >= 0 ? soloIndex : 0;
}
