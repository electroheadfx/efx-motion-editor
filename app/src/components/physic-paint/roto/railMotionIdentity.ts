/**
 * Rail motion identity (Phase 59, Gate B).
 *
 * Durable rail identity for the rail-motion collection. A Loop Clip rail is
 * identified by its `loopId`; a bare Key Rail has no durable identity of its
 * own, so it receives a minted rail id and keeps its current first drawing key
 * as an `anchorKeyId` recovery hint. The hint is NEVER identity: resolution is
 * an exact rail-id match, and a record whose anchor no longer exists is
 * retained as an orphan rather than rebound.
 *
 * This module is pure: no store, no signal, no component and no bridge import.
 * View derivation reads the production Key Rail segments and Loop Clips; every
 * Gate B transition is a pure record-collection transform.
 */

import {
  createPhysicPaintRotoRailId,
  parsePhysicPaintRotoRailMotions,
  PHYSIC_PAINT_ROTO_RAIL_MOTIONS_EMPTY,
  type PhysicPaintRotoRailMotionRecord,
} from './railMotionModel';
import type { KeyRailSegment } from '../view/physicsPaintKeyRailPresentation';
import { resolveTimelineRailType, type TimelineRailType } from '../view/timelineRailDesign';

/**
 * The Loop Clip facts a rail view needs. Structural on purpose: the identity
 * module never imports the physical document model, so it cannot create a
 * module cycle with the persistence layer.
 */
export interface RailMotionLoopClipSource {
  readonly loopId: string;
  readonly placementStart: number;
  readonly sourceKeyIds: readonly string[];
  readonly repeat: number | 'infinity';
  readonly mode?: 'progressive' | 'static';
  readonly railKind?: 'playscript' | 'reveal';
}

/** Resolves the presentation rail type for a Loop Clip rail. */
export type RailMotionRailTypeResolver = (clip: RailMotionLoopClipSource) => TimelineRailType;

/** The merge outcome, so the settlement boundary can publish a drop notice. */
export interface RailMotionMergeTransitionResult {
  readonly records: readonly PhysicPaintRotoRailMotionRecord[];
  readonly adoptedRailId: string | null;
  readonly droppedRailId: string | null;
}

/** One member of a rail-set copy: source identity to fresh destination identity. */
export interface RailMotionCopyPlanEntry {
  readonly sourceRailId: string;
  readonly destinationRailId: string;
  readonly anchorKeyId: string;
}

/** The identity pair a rail adopts when it starts carrying motion. */
export interface RailMotionBinding {
  readonly railId: string;
  readonly anchorKeyId: string;
}

/** One live rail projection consumed by binding and reconciliation. */
export interface RailMotionRailView {
  readonly railId: string | null;
  readonly anchorKeyId: string;
  readonly startFrame: number;
  readonly endFrameExclusive: number;
  readonly keyIds: readonly string[];
  readonly railType: TimelineRailType;
  readonly loopId: string | null;
}

/**
 * Resolves a Loop Clip's real half-open end from the caller's loop-resolution
 * context. Structural on purpose: the identity module stays pure, so the span
 * arrives as an injected callback instead of a store or document import.
 */
export interface RailMotionRailViewSpanResolver {
  readonly resolveLoopEndExclusive: (loopId: string) => number | null;
}

/**
 * Builds a span resolver from the derived loop ranges. Lifecycle Infinity
 * fragments share one loopId, so the resolver keeps the maximum `effectiveEnd`
 * per loopId — the single span covering every fragment. An answer is returned
 * only when it is a finite positive integer; anything else means "unknown" and
 * the view keeps its single-occurrence fallback.
 */
export function createRailMotionViewSpanResolver(
  ranges: readonly { readonly loopId: string; readonly effectiveEnd: number }[],
): RailMotionRailViewSpanResolver {
  const endByLoopId = new Map<string, number>();
  for (const range of ranges) {
    const current = endByLoopId.get(range.loopId);
    if (current === undefined || range.effectiveEnd > current) {
      endByLoopId.set(range.loopId, range.effectiveEnd);
    }
  }

  return Object.freeze({
    resolveLoopEndExclusive: (loopId: string): number | null => {
      const end = endByLoopId.get(loopId);
      if (end === undefined || !Number.isFinite(end) || !Number.isInteger(end) || end <= 0) {
        return null;
      }
      return end;
    },
  }) as RailMotionRailViewSpanResolver;
}

export interface RailMotionReconciliation {
  readonly active: ReadonlyMap<string, PhysicPaintRotoRailMotionRecord>;
  readonly orphaned: readonly PhysicPaintRotoRailMotionRecord[];
}

function compareRailIds(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

/**
 * A Loop Clip rail binds by its `loopId`: rail identity and clip identity are
 * the same durable id, so nothing is minted. `firstSourceKeyId` is recorded as
 * the recovery hint only; when the caller omits it the loopId stands in as an
 * inert placeholder until the next view assignment re-stamps it.
 */
export function bindLoopRail(loopId: string, firstSourceKeyId?: string): RailMotionBinding {
  return Object.freeze({
    railId: loopId,
    anchorKeyId: firstSourceKeyId ?? loopId,
  }) as RailMotionBinding;
}

/**
 * A bare Key Rail has no durable id of its own: mint one and keep the current
 * first drawing key as the recovery hint. The drawing-key namespace is never
 * used here — rail identity is a separate namespace.
 */
export function bindKeyRail(anchorKeyId: string): RailMotionBinding {
  return Object.freeze({
    railId: createPhysicPaintRotoRailId(),
    anchorKeyId,
  }) as RailMotionBinding;
}

function freezeRailMotionRecord(
  record: PhysicPaintRotoRailMotionRecord,
): PhysicPaintRotoRailMotionRecord {
  if (Object.isFrozen(record)) return record;
  return Object.freeze({
    railId: record.railId,
    anchorKeyId: record.anchorKeyId,
    channels: Object.freeze([...record.channels]),
  }) as PhysicPaintRotoRailMotionRecord;
}

/**
 * Resolves stored records against the live rails.
 *
 * Identity is the exact `railId` match — nothing else. A record is ACTIVE as
 * long as a view carries its railId, even when its `anchorKeyId` is stale (the
 * anchor is a hint, never a filter). Every record without a matching view is
 * ORPHANED: retained byte-identically, never evaluated, never rebound to
 * another rail, and returned in canonical railId order so a snapshot or undo
 * comparison is stable. Orphaning is a legitimate stored state, never an error.
 */
export function reconcileRailMotions(
  records: readonly PhysicPaintRotoRailMotionRecord[],
  views: readonly RailMotionRailView[],
): RailMotionReconciliation {
  const liveRailIds = new Set<string>();
  for (const view of views) {
    if (view.railId !== null) liveRailIds.add(view.railId);
  }

  const active = new Map<string, PhysicPaintRotoRailMotionRecord>();
  const orphaned: PhysicPaintRotoRailMotionRecord[] = [];
  for (const record of records) {
    if (liveRailIds.has(record.railId)) {
      active.set(record.railId, freezeRailMotionRecord(record));
      continue;
    }
    orphaned.push(freezeRailMotionRecord(record));
  }

  orphaned.sort((left, right) => compareRailIds(left.railId, right.railId));

  return Object.freeze({
    active,
    orphaned: Object.freeze(orphaned) as readonly PhysicPaintRotoRailMotionRecord[],
  }) as RailMotionReconciliation;
}

/**
 * Short human-readable description of an orphaned record for a session warning
 * surface. This module never logs; the caller decides where the text appears.
 */
export function describeRailMotionOrphan(record: PhysicPaintRotoRailMotionRecord): string {
  return `Rail motion for rail "${record.railId}" no longer matches a live rail (last anchor key "${record.anchorKeyId}").`;
}

/**
 * The Loop Clip occurrence count used for the rail view span. An `infinity`
 * clip is a single visible occurrence here: this is the no-resolver fallback,
 * and the injected span resolver owns the real infinite duration.
 */
function railViewOccurrences(repeat: number | 'infinity'): number {
  if (typeof repeat !== 'number' || !Number.isFinite(repeat) || repeat < 1) return 1;
  return Math.floor(repeat);
}

function freezeRailView(view: RailMotionRailView): RailMotionRailView {
  return Object.freeze({
    railId: view.railId,
    anchorKeyId: view.anchorKeyId,
    startFrame: view.startFrame,
    endFrameExclusive: view.endFrameExclusive,
    keyIds: Object.freeze([...view.keyIds]),
    railType: view.railType,
    loopId: view.loopId,
  }) as RailMotionRailView;
}

/**
 * Projects every live rail into the shape reconciliation consumes.
 *
 * Loop Clips bind by their own durable `loopId`. Key Rail segments carry no
 * durable id, so their view is `railId: null` until a passed bound-id map
 * carries the record's authoritative rail id forward. `boundRailIdByAnchor` is
 * populated only by {@link assignRailMotionRailViews}' single first-bind
 * lookup. This function is additive: the production `deriveKeyRailSegments`
 * output and behavior are untouched.
 */
export function deriveRailMotionRailViews(
  loopClips: readonly RailMotionLoopClipSource[],
  keyRailSegments: readonly KeyRailSegment[],
  railTypeFor?: RailMotionRailTypeResolver,
  boundRailIdByAnchor?: ReadonlyMap<string, string>,
  viewSpanResolver?: RailMotionRailViewSpanResolver,
): readonly RailMotionRailView[] {
  const views: RailMotionRailView[] = [];

  for (const clip of loopClips) {
    const sourceKeyIds = clip.sourceKeyIds;
    const fallbackEnd = clip.placementStart + sourceKeyIds.length * railViewOccurrences(clip.repeat);
    // The resolved Loop Clip range is the rail/compositor authority: it already
    // accounts for the cycle's real extent after every shorten/re-extend. The
    // key-count product is only the no-answer fallback (261107-rrp).
    const resolvedEnd = viewSpanResolver?.resolveLoopEndExclusive(clip.loopId) ?? null;
    const endFrameExclusive = clip.repeat === 'infinity'
      ? Math.max(fallbackEnd, resolvedEnd ?? fallbackEnd)
      : resolvedEnd ?? fallbackEnd;
    views.push(freezeRailView({
      railId: clip.loopId,
      anchorKeyId: sourceKeyIds[0] ?? clip.loopId,
      startFrame: clip.placementStart,
      endFrameExclusive,
      keyIds: sourceKeyIds,
      railType: railTypeFor === undefined
        ? resolveTimelineRailType(clip.railKind, clip.mode ?? null)
        : railTypeFor(clip),
      loopId: clip.loopId,
    }));
  }

  for (const segment of keyRailSegments) {
    views.push(freezeRailView({
      railId: boundRailIdByAnchor?.get(segment.firstKeyId) ?? null,
      anchorKeyId: segment.firstKeyId,
      startFrame: segment.firstKeyFrame,
      endFrameExclusive: segment.lastKeyFrame + 1,
      keyIds: segment.keyIds,
      railType: 'standard',
      loopId: null,
    }));
  }

  return Object.freeze(views) as readonly RailMotionRailView[];
}

/**
 * The ONE band-width derivation for the Motion lane (261107-rrp).
 *
 * Every band consumer — lane width, header stack, curve sampling, drag clamp
 * and cursor writes — reads the width from here so they can never disagree
 * about how many frames the resolved rail span covers. A missing view has no
 * band (0, fail closed) and a degenerate span never goes negative.
 */
export function railMotionViewFrameCount(
  view: Pick<RailMotionRailView, 'startFrame' | 'endFrameExclusive'> | null,
): number {
  if (view === null) return 0;
  return Math.max(0, Math.floor(view.endFrameExclusive - view.startFrame));
}

/**
 * The ONE permitted anchor-based lookup (T-59-16).
 *
 * A bare Key Rail has no durable id, so the first time it needs its stored
 * record the only available join is `record.anchorKeyId === segment.firstKeyId`.
 * That lookup is confined to this function and happens before reconciliation;
 * once a record is bound, its `railId` is authoritative and every other path
 * matches on `railId` alone. A record whose railId is a live Loop Clip's
 * `loopId` is loop-owned and can never be captured by a key-rail anchor
 * coincidence.
 */
export function assignRailMotionRailViews(
  records: readonly PhysicPaintRotoRailMotionRecord[],
  loopClips: readonly RailMotionLoopClipSource[],
  keyRailSegments: readonly KeyRailSegment[],
  railTypeFor?: RailMotionRailTypeResolver,
  viewSpanResolver?: RailMotionRailViewSpanResolver,
): readonly RailMotionRailView[] {
  const liveLoopIds = new Set(loopClips.map((clip) => clip.loopId));
  const boundRailIdByAnchor = new Map<string, string>();

  for (const segment of keyRailSegments) {
    if (boundRailIdByAnchor.has(segment.firstKeyId)) continue;
    let boundRailId: string | null = null;
    for (const record of records) {
      if (record.anchorKeyId !== segment.firstKeyId) continue;
      if (liveLoopIds.has(record.railId)) continue;
      if (boundRailId === null || compareRailIds(record.railId, boundRailId) < 0) {
        boundRailId = record.railId;
      }
    }
    if (boundRailId !== null) boundRailIdByAnchor.set(segment.firstKeyId, boundRailId);
  }

  return deriveRailMotionRailViews(
    loopClips,
    keyRailSegments,
    railTypeFor,
    boundRailIdByAnchor,
    viewSpanResolver,
  );
}

/**
 * Converting a Key Rail into a Rail/Key Rail cycle changes identity from the
 * minted rail id to the Loop Clip's durable `loopId`. The edit mints a fresh
 * loop id, so the stored record must be RE-KEYED in the same commit or the
 * cycle rail would start unanimated and the motion would be lost.
 *
 * Every channel, key, value, easing and rail-local frame crosses verbatim;
 * only the identity pair changes. The loop's first source key becomes the
 * recovery hint. The transition fails closed (returns the input) when the rail
 * already carries the loop identity, when the source record is absent, or when
 * the destination loop id already carries a record — it never duplicates a
 * railId and never deletes the only copy.
 */
export function onConvertRailToLoopClip(
  records: readonly PhysicPaintRotoRailMotionRecord[],
  railId: string,
  loopId: string,
  anchorKeyId: string,
): readonly PhysicPaintRotoRailMotionRecord[] {
  if (railId === loopId) return records;
  const sourceIndex = records.findIndex((record) => record.railId === railId);
  if (sourceIndex < 0) return records;
  if (records.some((record) => record.railId === loopId)) return records;
  const source = records[sourceIndex];
  const converted = Object.freeze({
    railId: loopId,
    anchorKeyId,
    channels: source.channels,
  }) as PhysicPaintRotoRailMotionRecord;
  return Object.freeze(
    records.map((record, index) => (index === sourceIndex ? converted : record)),
  ) as readonly PhysicPaintRotoRailMotionRecord[];
}

/**
 * Deleting a rail's first drawing key re-stamps the recovery hint. Identity
 * (`railId`) and every rail-local key frame are unchanged: motion does not
 * ripple when a drawing key disappears.
 */
export function onDeleteFirstKey(
  record: PhysicPaintRotoRailMotionRecord,
  nextAnchorKeyId: string,
): PhysicPaintRotoRailMotionRecord {
  if (record.anchorKeyId === nextAnchorKeyId) return record;
  return Object.freeze({
    railId: record.railId,
    anchorKeyId: nextAnchorKeyId,
    channels: record.channels,
  }) as PhysicPaintRotoRailMotionRecord;
}

/**
 * Deleting a rail's only drawing key removes its motion in the same
 * operation (D-15 at the rail level). Unknown rails are a quiet no-op.
 */
export function onDeleteOnlyKey(
  records: readonly PhysicPaintRotoRailMotionRecord[],
  railId: string,
): readonly PhysicPaintRotoRailMotionRecord[] {
  const remaining = records.filter((record) => record.railId !== railId);
  if (remaining.length === records.length) return records;
  if (remaining.length === 0) return PHYSIC_PAINT_ROTO_RAIL_MOTIONS_EMPTY;
  return Object.freeze(remaining) as readonly PhysicPaintRotoRailMotionRecord[];
}

/**
 * Splitting a rail at a break keeps the `railId` on the head segment. The tail
 * has no motion of its own, so the collection is unchanged.
 */
export function onSplitRail(
  records: readonly PhysicPaintRotoRailMotionRecord[],
  railId: string,
): readonly PhysicPaintRotoRailMotionRecord[] {
  void railId;
  return records;
}

function findRecordIndexByAnchor(
  records: readonly PhysicPaintRotoRailMotionRecord[],
  anchorKeyId: string,
): number {
  return records.findIndex((record) => record.anchorKeyId === anchorKeyId);
}

function withAnchor(
  record: PhysicPaintRotoRailMotionRecord,
  anchorKeyId: string,
): PhysicPaintRotoRailMotionRecord {
  if (record.anchorKeyId === anchorKeyId) return record;
  return Object.freeze({
    railId: record.railId,
    anchorKeyId,
    channels: record.channels,
  }) as PhysicPaintRotoRailMotionRecord;
}

/**
 * Merging two Key Rail segments addresses records by the segment anchors that
 * survive the merge (`headAnchorKeyId` / `tailAnchorKeyId`), never by a railId
 * the head may not have.
 *
 * - Both sides animated: the head record wins, the tail record is removed and
 *   reported as `droppedRailId` so the settlement boundary can publish the
 *   confirmation row (D-08: never a silent loss).
 * - Only the tail animated: that record keeps its own `railId`, is re-anchored
 *   to `mergedAnchorKeyId` and is reported as `adoptedRailId` (there is no head
 *   record to re-key to).
 * - Only the head animated, or neither: unchanged.
 */
export function onMergeRails(
  records: readonly PhysicPaintRotoRailMotionRecord[],
  headAnchorKeyId: string,
  tailAnchorKeyId: string,
  mergedAnchorKeyId: string,
): RailMotionMergeTransitionResult {
  if (headAnchorKeyId === tailAnchorKeyId) {
    return Object.freeze({
      records,
      adoptedRailId: null,
      droppedRailId: null,
    }) as RailMotionMergeTransitionResult;
  }

  const headIndex = findRecordIndexByAnchor(records, headAnchorKeyId);
  const tailIndex = findRecordIndexByAnchor(records, tailAnchorKeyId);

  if (headIndex >= 0 && tailIndex >= 0) {
    const headRecord = withAnchor(records[headIndex], mergedAnchorKeyId);
    const droppedRailId = records[tailIndex].railId;
    const nextRecords = records
      .map((record, index) => (index === headIndex ? headRecord : record))
      .filter((_, index) => index !== tailIndex);
    return Object.freeze({
      records: Object.freeze(nextRecords) as readonly PhysicPaintRotoRailMotionRecord[],
      adoptedRailId: null,
      droppedRailId,
    }) as RailMotionMergeTransitionResult;
  }

  if (tailIndex >= 0) {
    const adopted = withAnchor(records[tailIndex], mergedAnchorKeyId);
    const nextRecords = adopted === records[tailIndex]
      ? records
      : Object.freeze(
        records.map((record, index) => (index === tailIndex ? adopted : record)),
      ) as readonly PhysicPaintRotoRailMotionRecord[];
    return Object.freeze({
      records: nextRecords,
      adoptedRailId: adopted.railId,
      droppedRailId: null,
    }) as RailMotionMergeTransitionResult;
  }

  return Object.freeze({
    records,
    adoptedRailId: null,
    droppedRailId: null,
  }) as RailMotionMergeTransitionResult;
}

/**
 * Moving or resizing a rail start never rewrites a rail-local key frame: the
 * motion is rail-local and shifts in application time with the rail.
 */
export function onRailStartMoved(
  record: PhysicPaintRotoRailMotionRecord,
): PhysicPaintRotoRailMotionRecord {
  return record;
}

function isBoundedIdentityId(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= 128;
}

/**
 * Re-keys a copied rail set's motion onto the copy's fresh identities.
 *
 * The plan is validated as a whole before anything is built: any unbounded id,
 * duplicate source or destination, destination already carrying a record, or
 * an animated copied source with no plan entry returns `null` and the caller
 * fails the paste. Nothing is ever partially applied, dropped or overwritten.
 *
 * A matched record adopts the destination `railId` and `anchorKeyId` and keeps
 * every channel and key frame verbatim — the copy's rail-local time is
 * identical. Records outside the copied set are retained by reference. The
 * assembled result is free-parsed through the 59-02 parser before it is
 * returned, so a re-key can never emit an unparseable collection.
 */
export function rekeyRailMotionsForCopy(
  records: readonly PhysicPaintRotoRailMotionRecord[],
  plan: readonly RailMotionCopyPlanEntry[],
  copiedSourceRailIds?: readonly string[],
): readonly PhysicPaintRotoRailMotionRecord[] | null {
  if (plan.length === 0) return records;

  const recordByRailId = new Map(records.map((record) => [record.railId, record]));
  const sources = new Set<string>();
  const destinations = new Set<string>();

  for (const entry of plan) {
    if (!isBoundedIdentityId(entry.sourceRailId)
      || !isBoundedIdentityId(entry.destinationRailId)
      || !isBoundedIdentityId(entry.anchorKeyId)) {
      return null;
    }
    if (sources.has(entry.sourceRailId)) return null;
    if (destinations.has(entry.destinationRailId)) return null;
    sources.add(entry.sourceRailId);
    destinations.add(entry.destinationRailId);
    if (recordByRailId.has(entry.destinationRailId)) return null;
  }

  if (copiedSourceRailIds !== undefined) {
    for (const sourceRailId of copiedSourceRailIds) {
      if (!recordByRailId.has(sourceRailId)) continue;
      if (!sources.has(sourceRailId)) return null;
    }
  }

  const rekeyed: PhysicPaintRotoRailMotionRecord[] = [];
  for (const entry of plan) {
    const source = recordByRailId.get(entry.sourceRailId);
    if (source === undefined) continue;
    rekeyed.push(Object.freeze({
      railId: entry.destinationRailId,
      anchorKeyId: entry.anchorKeyId,
      channels: source.channels,
    }) as PhysicPaintRotoRailMotionRecord);
  }

  if (rekeyed.length === 0) return records;

  const bystanders = records.filter((record) => !sources.has(record.railId));
  const assembled = Object.freeze([...bystanders, ...rekeyed].sort(
    (left, right) => compareRailIds(left.railId, right.railId),
  )) as readonly PhysicPaintRotoRailMotionRecord[];

  // Free-parse as a validation gate. The parsed copies are discarded so the
  // retained bystanders keep their original object identity.
  parsePhysicPaintRotoRailMotions(assembled);
  return assembled;
}
