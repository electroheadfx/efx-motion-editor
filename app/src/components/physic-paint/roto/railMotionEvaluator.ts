/**
 * Rail motion evaluator (Phase 59).
 *
 * The ONE interpolation authority for rail motion: edit view, Play, export,
 * the gizmo read-out and the timeline lane curve all call these functions, so
 * any second interpolation anywhere else is a contract violation.
 *
 * Purity: this module reads no store, signal, Preact component, compositor or
 * DOM state, and it never reads drawing keys, key counts, raster bounds,
 * repeat counts or wall-clock time. Content cycling therefore stays
 * independent of motion evaluation.
 */

import type {
  PhysicPaintRotoRailMotionChannelId,
  PhysicPaintRotoRailMotionRecord,
} from './railMotionModel';

export interface RailMotionTransform {
  readonly translateX: number;
  readonly translateY: number;
  readonly scale: number;
  readonly rotationRadians: number;
  readonly opacity: number;
}

/**
 * The frozen identity transform. Returned by reference when the record is
 * absent or carries no channels, so the common no-motion path allocates
 * nothing and every consumer can compare by reference.
 */
export const RAIL_MOTION_IDENTITY_TRANSFORM: RailMotionTransform = Object.freeze({
  translateX: 0,
  translateY: 0,
  scale: 1,
  rotationRadians: 0,
  opacity: 1,
});

function railMotionIdentityChannelValue(
  channelId: PhysicPaintRotoRailMotionChannelId,
): number {
  switch (channelId) {
    case 'position-x':
    case 'position-y':
    case 'rotation':
      return 0;
    case 'scale':
    case 'opacity':
      return 1;
    default:
      return 0;
  }
}

export function evaluateRailMotion(
  _record: PhysicPaintRotoRailMotionRecord | null,
  _railLocalFrame: number,
): RailMotionTransform {
  return RAIL_MOTION_IDENTITY_TRANSFORM;
}

export function evaluateRailMotionChannel(
  _record: PhysicPaintRotoRailMotionRecord | null,
  channelId: PhysicPaintRotoRailMotionChannelId,
  _railLocalFrame: number,
): number {
  return railMotionIdentityChannelValue(channelId);
}

export function resolveRailLocalFrame(
  _appFrame: number,
  _railStart: number,
): number {
  return 0;
}

/**
 * Task 2 replaces this placeholder with the seeded, smooth, deterministic
 * implementation; it is exported so the determinism pin can address it
 * directly rather than inferring the noise from a composed channel.
 */
export function railMotionWiggleAt(
  _railId: string,
  _channelId: PhysicPaintRotoRailMotionChannelId,
  _keyFrame: number,
  _frame: number,
): number {
  return 0;
}
