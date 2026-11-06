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
  type PhysicPaintRotoRailMotionRecord,
} from './railMotionModel';
import type { TimelineRailType } from '../view/timelineRailDesign';

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
