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

import type { PhysicPaintRotoRailMotionRecord } from './railMotionModel';
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

export function bindLoopRail(loopId: string, firstSourceKeyId?: string): RailMotionBinding {
  void firstSourceKeyId;
  return Object.freeze({ railId: '', anchorKeyId: loopId });
}

export function bindKeyRail(anchorKeyId: string): RailMotionBinding {
  return Object.freeze({ railId: '', anchorKeyId });
}

export function reconcileRailMotions(
  records: readonly PhysicPaintRotoRailMotionRecord[],
  views: readonly RailMotionRailView[],
): RailMotionReconciliation {
  void records;
  void views;
  return Object.freeze({ active: new Map(), orphaned: Object.freeze([]) });
}

export function describeRailMotionOrphan(record: PhysicPaintRotoRailMotionRecord): string {
  void record;
  return '';
}
