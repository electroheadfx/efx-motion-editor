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

import { Random } from '@efxlab/motion-canvas-core';
import type {
  PhysicPaintRotoRailMotionChannel,
  PhysicPaintRotoRailMotionChannelId,
  PhysicPaintRotoRailMotionKey,
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

function assertFiniteRailMotionFrame(frame: number): void {
  if (!Number.isFinite(frame)) {
    throw new Error(`PhysicPaintRotoRailMotionEvaluator: rail-local frame ${String(frame)} must be finite.`);
  }
}

/** The eased curve: monotone on 0..1, exact at both endpoints, no overshoot. */
function railMotionSmoothstep(t: number): number {
  return t * t * (3 - 2 * t);
}

interface RailMotionSegment {
  /** The channel value before wiggle, after endpoint hold / ease. */
  readonly value: number;
  /**
   * The OUTGOING key: the key at or before the evaluated frame. Null before
   * the first key, which is the one span that carries no wiggle amplitude.
   */
  readonly outgoingKey: PhysicPaintRotoRailMotionKey | null;
}

/**
 * Resolves the value segment at `frame`. Keys are canonical (strictly frame
 * ascending, at most 4096 per channel by the parser cap), so the linear scan
 * with its early exit is bounded and allocation-free.
 *
 * Before the first key the first value holds; at or after the last key the
 * last value holds. Between two keys the OUTGOING key decides: `hold` steps,
 * `ease` runs the smoothstep.
 */
function resolveRailMotionSegment(
  keys: readonly PhysicPaintRotoRailMotionKey[],
  frame: number,
): RailMotionSegment | null {
  if (keys.length === 0) return null;
  const first = keys[0];
  if (frame < first.frame) return { value: first.value, outgoingKey: null };

  for (let index = 0; index < keys.length; index += 1) {
    const current = keys[index];
    if (current.frame > frame) break;
    const next = keys[index + 1];
    if (next === undefined) return { value: current.value, outgoingKey: current };
    if (frame < next.frame) {
      if (current.easing === 'hold') return { value: current.value, outgoingKey: current };
      const span = next.frame - current.frame;
      const position = span <= 0 ? 1 : (frame - current.frame) / span;
      return {
        value: current.value + (next.value - current.value) * railMotionSmoothstep(position),
        outgoingKey: current,
      };
    }
  }

  // Unreachable for canonical ascending keys; keeps the evaluator total.
  const last = keys[keys.length - 1];
  return { value: last.value, outgoingKey: last };
}

/**
 * Appearance clamps, documented once here:
 * - Opacity is clamped to 0..1 after evaluation because the seeded wiggle can
 *   push a legal 0..1 key past either bound.
 * - Scale is floored at 0 because a negative scale would mirror the raster,
 *   which is not a shipped behavior (the parser already rejects negative
 *   stored keys).
 * Position and rotation are deliberately unclamped.
 */
function clampRailMotionChannelValue(
  channelId: PhysicPaintRotoRailMotionChannelId,
  value: number,
): number {
  switch (channelId) {
    case 'opacity':
      return Math.min(1, Math.max(0, value));
    case 'scale':
      return Math.max(0, value);
    default:
      return value;
  }
}

function railMotionChannelValueAt(
  railId: string,
  channel: PhysicPaintRotoRailMotionChannel,
  frame: number,
): number {
  const segment = resolveRailMotionSegment(channel.keys, frame);
  if (segment === null) return railMotionIdentityChannelValue(channel.id);

  const outgoing = segment.outgoingKey;
  const value = outgoing === null || outgoing.wiggle === 0
    ? segment.value
    : segment.value + outgoing.wiggle * railMotionWiggleAt(railId, channel.id, outgoing.frame, frame);

  return clampRailMotionChannelValue(channel.id, value);
}

export function evaluateRailMotionChannel(
  record: PhysicPaintRotoRailMotionRecord | null,
  channelId: PhysicPaintRotoRailMotionChannelId,
  railLocalFrame: number,
): number {
  assertFiniteRailMotionFrame(railLocalFrame);
  if (record === null) return railMotionIdentityChannelValue(channelId);

  const channel = record.channels.find((entry) => entry.id === channelId);
  if (channel === undefined) return railMotionIdentityChannelValue(channelId);

  return railMotionChannelValueAt(record.railId, channel, railLocalFrame);
}

export function evaluateRailMotion(
  record: PhysicPaintRotoRailMotionRecord | null,
  railLocalFrame: number,
): RailMotionTransform {
  assertFiniteRailMotionFrame(railLocalFrame);
  if (record === null || record.channels.length === 0) return RAIL_MOTION_IDENTITY_TRANSFORM;

  return Object.freeze({
    translateX: evaluateRailMotionChannel(record, 'position-x', railLocalFrame),
    translateY: evaluateRailMotionChannel(record, 'position-y', railLocalFrame),
    scale: evaluateRailMotionChannel(record, 'scale', railLocalFrame),
    // The ONE degrees -> radians conversion on the evaluator surface. The
    // channel value stays in degrees everywhere else and no consumer converts.
    rotationRadians: evaluateRailMotionChannel(record, 'rotation', railLocalFrame) * Math.PI / 180,
    opacity: evaluateRailMotionChannel(record, 'opacity', railLocalFrame),
  });
}

/**
 * The ONLY place the rail-local subtraction lives. Both inputs must be finite;
 * a malformed time is a programming error, not a frame to guess at.
 */
export function resolveRailLocalFrame(
  appFrame: number,
  railStart: number,
): number {
  if (!Number.isFinite(appFrame) || !Number.isFinite(railStart)) {
    throw new Error(
      `PhysicPaintRotoRailMotionEvaluator: resolveRailLocalFrame requires finite appFrame and railStart (got ${String(appFrame)} and ${String(railStart)}).`,
    );
  }
  return Math.max(0, appFrame - railStart);
}

export interface RailMotionCurvePathOptions {
  /** Overrides the design-token pitch; defaults to TIMELINE_GEOMETRY.cellPitch. */
  readonly cellPitch?: number;
  /** The record's railId so the curve samples the exact applied wiggle seed. */
  readonly railId?: string;
}

/**
 * Task 3 replaces this placeholder with the evaluator-sampled lane path.
 */
export function buildRailMotionCurvePath(
  _channel: PhysicPaintRotoRailMotionChannel,
  _railFrameCount: number,
  _laneHeight?: number,
  _options: Readonly<RailMotionCurvePathOptions> = {},
): string {
  return 'M0,0';
}

/**
 * FNV-1a 32-bit string hash over the stable seed components. Pure and
 * order-independent: the same (railId, channelId, keyFrame) triple always
 * yields the same 32-bit seed, whatever was evaluated before.
 */
function hashRailMotionWiggleSeed(seedText: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < seedText.length; index += 1) {
    hash ^= seedText.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/**
 * One draw per integer frame, mapped from [0,1) to [-1, 1). A fresh `Random`
 * per sample means no sequential PRNG state survives between calls, which is
 * what makes edit, Play and export agree bit for bit.
 */
function railMotionWiggleSample(seed: number, frame: number): number {
  return new Random((seed + frame) >>> 0).nextFloat(-1, 1);
}

/**
 * Seeded smooth wiggle in [-1, 1].
 *
 * The noise is sampled at the two neighbouring integer frames and interpolated
 * with the same smoothstep the ease curve uses, so it never jitters frame to
 * frame. The seed is a stable hash of (railId, channelId, keyFrame), so the
 * noise is a pure function of its arguments — no wall-clock time, no unseeded
 * randomness, no carried state.
 */
export function railMotionWiggleAt(
  railId: string,
  channelId: PhysicPaintRotoRailMotionChannelId,
  keyFrame: number,
  frame: number,
): number {
  const seed = hashRailMotionWiggleSeed(`${railId}|${channelId}|${keyFrame}`);
  const previousFrame = Math.floor(frame);
  const position = frame - previousFrame;
  const previous = railMotionWiggleSample(seed, previousFrame);
  const next = railMotionWiggleSample(seed, previousFrame + 1);
  return previous + (next - previous) * railMotionSmoothstep(position);
}
