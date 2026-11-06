/**
 * Rail-motion commit-point reconciler (Phase 59, 59-15; Gate B).
 *
 * Every structural edit that changes which rail exists must leave the stored
 * motion collection describing the rails that exist AFTER the edit, in the same
 * transaction and undo step as the records/loops/breaks write. This module is
 * the single commit-point router: it derives the production Key Rail segments
 * for the previous and next document snapshots, classifies each previously
 * ACTIVE record against the binding table, and invokes the ratified 59-06
 * transition by name. It never invents a second identity or a second merge
 * rule.
 *
 * Pure by construction: no store, bridge, signal or component import. The
 * segment derivation is the production `deriveKeyRailSegments`, fed with each
 * side's OWN group ownership (every `sourceKeyIds` id plus every
 * `frameOverrides[].keyId`, the resolver projection) and its own incoming-break
 * set — never an empty default, never the other side's clips.
 */

import {
  onDeleteFirstKey,
  onDeleteOnlyKey,
  onMergeRails,
  onRailStartMoved,
  onSplitRail,
} from './railMotionIdentity';
import {
  parsePhysicPaintRotoRailMotions,
  type PhysicPaintRotoRailMotionRecord,
} from './railMotionModel';
import {
  deriveKeyRailSegments,
  type KeyRailSegment,
} from '../view/physicsPaintKeyRailPresentation';

/**
 * The real-key facts a document snapshot carries. Only the display identity
 * pair is load-bearing here; richer records are structurally assignable.
 */
export interface RailMotionDocumentKeyRecord {
  readonly keyId: string;
  readonly appFrame: number;
}

/**
 * The Loop Clip facts that define group ownership. `sourceKeyIds` and
 * `frameOverrides[].keyId` are the production ownership projection; the extra
 * structural members are accepted so the document's clip collection can be
 * passed without copying.
 */
export interface RailMotionDocumentLoopClipFact {
  readonly loopId: string;
  readonly sourceKeyIds: readonly string[];
  readonly frameOverrides?: readonly { readonly keyId: string }[];
}

/** One side of the edit, carrying exactly the facts identity derives from. */
export interface RailMotionDocumentSnapshot {
  readonly realKeyRecords: readonly RailMotionDocumentKeyRecord[];
  readonly incomingInterpolationBreakKeyIds: ReadonlySet<string>;
  readonly loopClips: readonly RailMotionDocumentLoopClipFact[];
}

/** The prior app-frame span of a rail that a two-sided merge dropped. */
export interface RailMotionDroppedRailFrames {
  readonly startFrame: number;
  readonly endFrameExclusive: number;
}

/**
 * The reconciliation outcome. `droppedRailId` / `droppedRailFrames` are set
 * together ONLY when `onMergeRails` removed a tail record (both sides
 * animated); every other outcome — one-sided merge, delete, split, start move
 * or no change — reports `null` for both.
 */
export interface RailMotionDocumentReconciliation {
  readonly railMotions: readonly PhysicPaintRotoRailMotionRecord[];
  readonly adoptedRailId: string | null;
  readonly droppedRailId: string | null;
  readonly droppedRailFrames: RailMotionDroppedRailFrames | null;
}

export interface ReconcileRailMotionsForDocumentEditInput {
  readonly previous: RailMotionDocumentSnapshot;
  readonly next: RailMotionDocumentSnapshot;
  readonly railMotions: readonly PhysicPaintRotoRailMotionRecord[];
}

function compareKeyRecords(
  left: RailMotionDocumentKeyRecord,
  right: RailMotionDocumentKeyRecord,
): number {
  if (left.appFrame !== right.appFrame) return left.appFrame - right.appFrame;
  return left.keyId < right.keyId ? -1 : left.keyId > right.keyId ? 1 : 0;
}

/**
 * The production group-owned projection (resolver :2899-2902): every
 * `clip.sourceKeyIds` id plus every `clip.frameOverrides[].keyId`.
 */
function groupOwnedKeyIdsFor(snapshot: RailMotionDocumentSnapshot): ReadonlySet<string> {
  const groupOwnedKeyIds = new Set<string>();
  for (const clip of snapshot.loopClips) {
    clip.sourceKeyIds.forEach((keyId) => groupOwnedKeyIds.add(keyId));
    (clip.frameOverrides ?? []).forEach((override) => groupOwnedKeyIds.add(override.keyId));
  }
  return groupOwnedKeyIds;
}

/**
 * Derives the display-order Key Rail segments for one side. The key records are
 * sorted by app frame (key id tiebreak) so a staged array that is not already in
 * display order cannot shift segment boundaries.
 */
function deriveDocumentSegments(
  snapshot: RailMotionDocumentSnapshot,
): readonly KeyRailSegment[] {
  return deriveKeyRailSegments({
    orderedRealKeys: [...snapshot.realKeyRecords].sort(compareKeyRecords),
    incomingInterpolationBreakKeyIds: snapshot.incomingInterpolationBreakKeyIds,
    groupOwnedKeyIds: groupOwnedKeyIdsFor(snapshot),
  });
}

function findSegmentContainingKey(
  segments: readonly KeyRailSegment[],
  keyId: string,
): KeyRailSegment | null {
  for (const segment of segments) {
    if (segment.keyIds.includes(keyId)) return segment;
  }
  return null;
}

function sharesAnyKey(
  left: readonly string[],
  right: ReadonlySet<string>,
): boolean {
  return left.some((keyId) => right.has(keyId));
}

function isSuffixOf(candidate: readonly string[], parent: readonly string[]): boolean {
  if (candidate.length === 0 || candidate.length > parent.length) return false;
  const offset = parent.length - candidate.length;
  for (let index = 0; index < candidate.length; index += 1) {
    if (candidate[index] !== parent[offset + index]) return false;
  }
  return true;
}

function containsEveryKey(container: readonly string[], keys: readonly string[]): boolean {
  const containerSet = new Set(container);
  return keys.every((keyId) => containerSet.has(keyId));
}

type RailMotionEditClassification =
  | { readonly kind: 'unchanged' }
  | { readonly kind: 'delete-only-key' }
  | { readonly kind: 'delete-first-key'; readonly nextAnchorKeyId: string }
  | { readonly kind: 'split' }
  | {
      readonly kind: 'merge';
      readonly headAnchorKeyId: string;
      readonly tailAnchorKeyId: string;
      readonly mergedAnchorKeyId: string;
      readonly priorSegment: KeyRailSegment;
    }
  | { readonly kind: 'rail-start-moved' };

interface ClassifyInput {
  readonly record: PhysicPaintRotoRailMotionRecord;
  readonly previousSegments: readonly KeyRailSegment[];
  readonly nextSegments: readonly KeyRailSegment[];
  readonly nextSegmentKeyIds: ReadonlySet<string>;
  readonly previousLoopIds: ReadonlySet<string>;
  readonly nextLoopIds: ReadonlySet<string>;
}

/**
 * The binding classification table, in its binding order. Only records ACTIVE
 * on the previous side reach here: a record whose anchor is in no previous
 * segment is an orphan and is returned unchanged without a transition.
 */
function classifyRailMotionEdit(input: ClassifyInput): RailMotionEditClassification {
  const { record, previousSegments, nextSegments, nextSegmentKeyIds } = input;

  // Loop-owned rails bind by loopId; the loop surviving the edit keeps the
  // record, a removed loop removes it.
  if (input.previousLoopIds.has(record.railId)) {
    return input.nextLoopIds.has(record.railId)
      ? { kind: 'unchanged' }
      : { kind: 'delete-only-key' };
  }

  const priorSegment = findSegmentContainingKey(previousSegments, record.anchorKeyId);
  // Already orphaned before this edit: retain byte-identically, never transition.
  if (priorSegment === null) return { kind: 'unchanged' };

  const priorKeyIds = priorSegment.keyIds;
  const successorSegments = nextSegments.filter((segment) => (
    sharesAnyKey(segment.keyIds, new Set(priorKeyIds))
  ));

  // Delete-first-key: the successor starts exactly on the prior second key and
  // is a suffix of the prior segment. Identity and rail-local frames survive;
  // only the recovery hint is re-stamped.
  const secondKeyId = priorKeyIds[1];
  if (secondKeyId !== undefined) {
    const successor = successorSegments.find((segment) => (
      segment.firstKeyId === secondKeyId && isSuffixOf(segment.keyIds, priorKeyIds)
    ));
    if (successor !== undefined) {
      return { kind: 'delete-first-key', nextAnchorKeyId: successor.firstKeyId };
    }
  }

  // No successor shares any key: every key of the rail was deleted.
  if (successorSegments.length === 0) return { kind: 'delete-only-key' };

  // Split: the prior rail's anchor survives as one next segment's first key
  // while a second next segment covers the prior tail. The head keeps identity;
  // the tail carries no record.
  const headSurvivor = successorSegments.find((segment) => (
    segment.firstKeyId === priorSegment.firstKeyId
  ));
  const priorLastKeyId = priorKeyIds[priorKeyIds.length - 1];
  const tailSurvivor = successorSegments.find((segment) => (
    segment !== headSurvivor && segment.keyIds.includes(priorLastKeyId)
  ));
  if (headSurvivor !== undefined && tailSurvivor !== undefined) {
    return { kind: 'split' };
  }

  // Merge: one next segment contains every prior key that survives as an
  // ordinary rail key, is strictly larger, and starts before the prior segment.
  // The tail record is classified here; the head record matches no row and
  // stays unchanged, exactly as `onMergeRails` decides head-vs-tail.
  const survivingKeyIds = priorKeyIds.filter((keyId) => nextSegmentKeyIds.has(keyId));
  if (survivingKeyIds.length > 0) {
    const merger = successorSegments.find((segment) => (
      containsEveryKey(segment.keyIds, survivingKeyIds)
      && segment.keyIds.length > survivingKeyIds.length
      && !priorKeyIds.includes(segment.firstKeyId)
    ));
    if (merger !== undefined) {
      return {
        kind: 'merge',
        headAnchorKeyId: merger.firstKeyId,
        tailAnchorKeyId: priorSegment.firstKeyId,
        mergedAnchorKeyId: merger.firstKeyId,
        priorSegment,
      };
    }
  }

  // Rail start moved: identical key set and first key, different app frame.
  const sameKeysMovedStart = nextSegments.find((segment) => (
    segment.firstKeyId === priorSegment.firstKeyId
    && segment.keyIds.length === priorKeyIds.length
    && segment.keyIds.every((keyId, index) => keyId === priorKeyIds[index])
    && segment.firstKeyFrame !== priorSegment.firstKeyFrame
  ));
  if (sameKeysMovedStart !== undefined) return { kind: 'rail-start-moved' };

  return { kind: 'unchanged' };
}

/**
 * Reconciles the stored collection against one structural document edit.
 *
 * The classification reads the ORIGINAL previous/next snapshots and applies
 * each transition cumulatively to a working collection, so a merge that removes
 * a tail record cannot be re-added by that record's own turn. When no record
 * changes the INPUT collection reference is returned (no churn, no re-parse);
 * a changed collection is re-parsed through the 59-02 parser so ordering and
 * freezing are canonical.
 */
export function reconcileRailMotionsForDocumentEdit(
  input: ReconcileRailMotionsForDocumentEditInput,
): RailMotionDocumentReconciliation {
  const { previous, next, railMotions } = input;
  const previousSegments = deriveDocumentSegments(previous);
  const nextSegments = deriveDocumentSegments(next);
  const previousLoopIds = new Set(previous.loopClips.map((clip) => clip.loopId));
  const nextLoopIds = new Set(next.loopClips.map((clip) => clip.loopId));
  const nextSegmentKeyIds = new Set<string>();
  for (const segment of nextSegments) {
    for (const keyId of segment.keyIds) nextSegmentKeyIds.add(keyId);
  }

  let working: readonly PhysicPaintRotoRailMotionRecord[] = railMotions;
  let changed = false;
  let adoptedRailId: string | null = null;
  let droppedRailId: string | null = null;
  let droppedRailFrames: RailMotionDroppedRailFrames | null = null;

  for (const record of railMotions) {
    // A merge earlier in the walk may already have removed this record.
    if (!working.some((candidate) => candidate.railId === record.railId)) continue;

    const classification = classifyRailMotionEdit({
      record,
      previousSegments,
      nextSegments,
      nextSegmentKeyIds,
      previousLoopIds,
      nextLoopIds,
    });

    switch (classification.kind) {
      case 'unchanged':
        break;
      case 'delete-only-key': {
        const nextCollection = onDeleteOnlyKey(working, record.railId);
        if (nextCollection !== working) changed = true;
        working = nextCollection;
        break;
      }
      case 'delete-first-key': {
        const current = working.find((candidate) => candidate.railId === record.railId);
        if (current === undefined) break;
        const reanchored = onDeleteFirstKey(current, classification.nextAnchorKeyId);
        if (reanchored !== current) {
          changed = true;
          working = working.map((candidate) => (
            candidate === current ? reanchored : candidate
          ));
        }
        break;
      }
      case 'split':
        working = onSplitRail(working, record.railId);
        break;
      case 'merge': {
        const merged = onMergeRails(
          working,
          classification.headAnchorKeyId,
          classification.tailAnchorKeyId,
          classification.mergedAnchorKeyId,
        );
        if (merged.records !== working) changed = true;
        working = merged.records;
        if (adoptedRailId === null && merged.adoptedRailId !== null) {
          adoptedRailId = merged.adoptedRailId;
        }
        if (droppedRailId === null && merged.droppedRailId !== null) {
          droppedRailId = merged.droppedRailId;
          // The range the user just merged away: the dropped record's PRIOR
          // derived segment span, already in app frames. Never rail-local key
          // numbers, never derived from the merged document, never clamped.
          droppedRailFrames = Object.freeze({
            startFrame: classification.priorSegment.firstKeyFrame,
            endFrameExclusive: classification.priorSegment.lastKeyFrame + 1,
          });
        }
        break;
      }
      case 'rail-start-moved': {
        const current = working.find((candidate) => candidate.railId === record.railId);
        if (current === undefined) break;
        const moved = onRailStartMoved(current);
        if (moved !== current) {
          changed = true;
          working = working.map((candidate) => (
            candidate === current ? moved : candidate
          ));
        }
        break;
      }
    }
  }

  return {
    railMotions: changed ? parsePhysicPaintRotoRailMotions(working) : railMotions,
    adoptedRailId,
    droppedRailId,
    droppedRailFrames,
  };
}
