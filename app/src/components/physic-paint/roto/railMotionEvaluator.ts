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
 *
 * Stop Motion samples the linear ramp only at the displayed-real-key frames:
 * that rail-local frame set arrives through the optional `snapFrames`
 * argument as pure DATA. This module never resolves it — the store owns the
 * one memoized resolver — so the evaluator still reads no raster state.
 *
 * The only non-model imports are the seeded `Random` PRNG and the pure
 * `TIMELINE_GEOMETRY` design-token block (data only — it carries no Preact,
 * store or DOM import), so the lane pitch has one source and no literal 18.
 */

import { Random } from '@efxlab/motion-canvas-core';
import { TIMELINE_GEOMETRY } from '../view/timelineRailDesign';
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
  /**
   * The frame the wiggle is evaluated at: the snapped frame for Stop Motion,
   * the evaluated frame everywhere else.
   */
  readonly sampleFrame: number;
}

/**
 * Greatest snap frame `s` with `floorFrame <= s <= frame`, or null when none
 * qualifies. Bounded binary search over the ascending list; no allocation.
 */
function greatestRailMotionSnapAtOrBefore(
  snapFrames: readonly number[] | undefined,
  floorFrame: number,
  frame: number,
): number | null {
  if (snapFrames === undefined || snapFrames.length === 0) return null;
  let low = 0;
  let high = snapFrames.length - 1;
  let best = -1;
  while (low <= high) {
    const middle = (low + high) >>> 1;
    if (snapFrames[middle] <= frame) {
      best = middle;
      low = middle + 1;
    } else {
      high = middle - 1;
    }
  }
  if (best < 0) return null;
  const candidate = snapFrames[best];
  return candidate >= floorFrame ? candidate : null;
}

/**
 * Resolves the value segment at `frame`. Keys are canonical (strictly frame
 * ascending, at most 4096 per channel by the parser cap), so the linear scan
 * with its early exit is bounded and allocation-free.
 *
 * Before the first key the first value holds; at or after the last key the
 * last value holds. Between two keys the OUTGOING key decides, through an
 * explicit exhaustive switch (261108-d5o) so a future token can never fall
 * through into the smoothstep default:
 * - `hold` steps at the outgoing value;
 * - `linear` ramps raw t (no smoothstep);
 * - `ease` runs the monotone smoothstep;
 * - `stop-motion` samples the same raw ramp at the greatest displayed-real-key
 *   snap frame in the outgoing span, so the value steps at paint keys and
 *   holds between them. With no snap list it falls back to the outgoing key
 *   frame, which is the documented no-interior-snap law (byte-identical to
 *   hold when the span carries no interior paint key).
 */
function resolveRailMotionSegment(
  keys: readonly PhysicPaintRotoRailMotionKey[],
  frame: number,
  snapFrames?: readonly number[],
): RailMotionSegment | null {
  if (keys.length === 0) return null;
  const first = keys[0];
  if (frame < first.frame) return { value: first.value, outgoingKey: null, sampleFrame: frame };

  for (let index = 0; index < keys.length; index += 1) {
    const current = keys[index];
    if (current.frame > frame) break;
    const next = keys[index + 1];
    if (next === undefined) {
      return { value: current.value, outgoingKey: current, sampleFrame: frame };
    }
    if (frame < next.frame) {
      const span = next.frame - current.frame;
      switch (current.easing) {
        case 'hold':
          return { value: current.value, outgoingKey: current, sampleFrame: frame };
        case 'linear': {
          const position = span <= 0 ? 1 : (frame - current.frame) / span;
          return {
            value: current.value + (next.value - current.value) * position,
            outgoingKey: current,
            sampleFrame: frame,
          };
        }
        case 'ease': {
          const position = span <= 0 ? 1 : (frame - current.frame) / span;
          return {
            value: current.value + (next.value - current.value) * railMotionSmoothstep(position),
            outgoingKey: current,
            sampleFrame: frame,
          };
        }
        case 'stop-motion': {
          const sampled = greatestRailMotionSnapAtOrBefore(
            snapFrames,
            current.frame,
            frame,
          );
          const sampleFrame = sampled ?? current.frame;
          const position = span <= 0 ? 1 : (sampleFrame - current.frame) / span;
          return {
            value: current.value + (next.value - current.value) * position,
            outgoingKey: current,
            sampleFrame,
          };
        }
        default: {
          const exhaustive: never = current.easing;
          throw new Error(
            `PhysicPaintRotoRailMotionEvaluator: unknown easing "${String(exhaustive)}".`,
          );
        }
      }
    }
  }

  // Unreachable for canonical ascending keys; keeps the evaluator total.
  const last = keys[keys.length - 1];
  return { value: last.value, outgoingKey: last, sampleFrame: frame };
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
  snapFrames?: readonly number[],
): number {
  const segment = resolveRailMotionSegment(channel.keys, frame, snapFrames);
  if (segment === null) return railMotionIdentityChannelValue(channel.id);

  const outgoing = segment.outgoingKey;
  const value = outgoing === null || outgoing.wiggle === 0
    ? segment.value
    : segment.value
      + outgoing.wiggle
        * railMotionWiggleAt(railId, channel.id, outgoing.frame, segment.sampleFrame);

  return clampRailMotionChannelValue(channel.id, value);
}

export function evaluateRailMotionChannel(
  record: PhysicPaintRotoRailMotionRecord | null,
  channelId: PhysicPaintRotoRailMotionChannelId,
  railLocalFrame: number,
  snapFrames?: readonly number[],
): number {
  assertFiniteRailMotionFrame(railLocalFrame);
  if (record === null) return railMotionIdentityChannelValue(channelId);

  const channel = record.channels.find((entry) => entry.id === channelId);
  if (channel === undefined) return railMotionIdentityChannelValue(channelId);

  return railMotionChannelValueAt(record.railId, channel, railLocalFrame, snapFrames);
}

export function evaluateRailMotion(
  record: PhysicPaintRotoRailMotionRecord | null,
  railLocalFrame: number,
  snapFrames?: readonly number[],
): RailMotionTransform {
  assertFiniteRailMotionFrame(railLocalFrame);
  if (record === null || record.channels.length === 0) return RAIL_MOTION_IDENTITY_TRANSFORM;

  return Object.freeze({
    translateX: evaluateRailMotionChannel(record, 'position-x', railLocalFrame, snapFrames),
    translateY: evaluateRailMotionChannel(record, 'position-y', railLocalFrame, snapFrames),
    scale: evaluateRailMotionChannel(record, 'scale', railLocalFrame, snapFrames),
    // The ONE degrees -> radians conversion on the evaluator surface. The
    // channel value stays in degrees everywhere else and no consumer converts.
    rotationRadians:
      evaluateRailMotionChannel(record, 'rotation', railLocalFrame, snapFrames) * Math.PI / 180,
    opacity: evaluateRailMotionChannel(record, 'opacity', railLocalFrame, snapFrames),
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
  /**
   * The rail-local displayed-real-key frames. Stop-Motion spans step at each
   * one, so the path gets a true vertical edge there instead of a slope.
   */
  readonly snapFrames?: readonly number[];
}

/** One sample per frame is the budget; longer rails are strided, never truncated. */
const RAIL_MOTION_CURVE_MAX_SAMPLES = 4096;
const RAIL_MOTION_CURVE_HOLD_EPSILON = 1e-6;
const RAIL_MOTION_CURVE_PREVIEW_RAIL_ID = 'rail-motion-lane-preview';

/**
 * The SPECS display range per channel, in model units. Position ±100 px,
 * Scale 0..200%, Rotation ±360°, Opacity 0..100%. Values outside the range
 * clamp to the lane edge rather than leaving the viewBox.
 */
function railMotionCurveDisplayRange(
  channelId: PhysicPaintRotoRailMotionChannelId,
): readonly [number, number] {
  switch (channelId) {
    case 'position-x':
    case 'position-y':
      return [-100, 100];
    case 'scale':
      return [0, 2];
    case 'rotation':
      return [-360, 360];
    case 'opacity':
      return [0, 1];
    default:
      return [0, 1];
  }
}

function railMotionCurveY(
  channelId: PhysicPaintRotoRailMotionChannelId,
  value: number,
  laneHeight: number,
): number {
  const [min, max] = railMotionCurveDisplayRange(channelId);
  const normalized = (value - min) / (max - min);
  return Math.min(laneHeight, Math.max(0, laneHeight - normalized * laneHeight));
}

/** One decimal place at most, and never a trailing ".0". */
function formatRailMotionCurveCoordinate(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

/**
 * Sample frames for the lane path.
 *
 * The uniform grid is capped at RAIL_MOTION_CURVE_MAX_SAMPLES. Key frames are
 * added on top (bounded by the parser's 4096-key cap), and for a hold or
 * stop-motion segment the left-limit sample at `key − ε` is kept so the step
 * renders as two points at the same x instead of a slope. Every interior snap
 * frame of a stop-motion span contributes the same `s − ε` / `s` pair, so the
 * staircase steps exactly where the applied transform steps.
 */
function collectRailMotionCurveFrames(
  keys: readonly PhysicPaintRotoRailMotionKey[],
  frameCount: number,
  snapFrames?: readonly number[],
): number[] {
  const lastFrame = frameCount - 1;
  const boundaryFrames: number[] = [];
  for (let index = 0; index < keys.length; index += 1) {
    const frame = keys[index].frame;
    if (frame <= 0 || frame > lastFrame) continue;
    const previousEasing = index > 0 ? keys[index - 1].easing : null;
    if (previousEasing === 'hold' || previousEasing === 'stop-motion') {
      boundaryFrames.push(frame - RAIL_MOTION_CURVE_HOLD_EPSILON);
    }
    boundaryFrames.push(frame);
  }
  if (snapFrames !== undefined) {
    for (let index = 0; index < keys.length - 1; index += 1) {
      if (keys[index].easing !== 'stop-motion') continue;
      const spanStart = keys[index].frame;
      const spanEnd = keys[index + 1].frame;
      for (const snap of snapFrames) {
        if (snap <= spanStart || snap >= spanEnd) continue;
        if (snap <= 0 || snap > lastFrame) continue;
        boundaryFrames.push(snap - RAIL_MOTION_CURVE_HOLD_EPSILON, snap);
      }
    }
  }

  const uniformBudget = Math.max(1, RAIL_MOTION_CURVE_MAX_SAMPLES - boundaryFrames.length);
  const stride = Math.max(1, Math.ceil(frameCount / uniformBudget));
  const frames = new Set<number>();
  frames.add(0);
  for (let frame = stride; frame < lastFrame; frame += stride) frames.add(frame);
  frames.add(lastFrame);
  for (const frame of boundaryFrames) frames.add(frame);
  return [...frames].sort((left, right) => left - right);
}

/**
 * The lane curve, in lane-local coordinates (viewBox `0 0 width laneHeight`).
 *
 * Every y is sampled THROUGH `evaluateRailMotionChannel`: the lane holds no
 * interpolation math of its own, so the drawn curve and the applied transform
 * cannot disagree. `x = railLocalFrame * cellPitch`; the pitch comes from the
 * design token unless the caller overrides it.
 */
export function buildRailMotionCurvePath(
  channel: PhysicPaintRotoRailMotionChannel,
  railFrameCount: number,
  laneHeight: number = TIMELINE_GEOMETRY.motionLaneHeight,
  options: Readonly<RailMotionCurvePathOptions> = {},
): string {
  const cellPitch = options.cellPitch ?? TIMELINE_GEOMETRY.cellPitch;
  if (!Number.isFinite(railFrameCount) || railFrameCount < 1) {
    throw new Error(
      `PhysicPaintRotoRailMotionEvaluator: buildRailMotionCurvePath needs a finite railFrameCount of at least 1 (got ${String(railFrameCount)}).`,
    );
  }
  if (!Number.isFinite(laneHeight) || laneHeight <= 0) {
    throw new Error(
      `PhysicPaintRotoRailMotionEvaluator: buildRailMotionCurvePath needs a finite positive laneHeight (got ${String(laneHeight)}).`,
    );
  }
  if (!Number.isFinite(cellPitch) || cellPitch <= 0) {
    throw new Error(
      `PhysicPaintRotoRailMotionEvaluator: buildRailMotionCurvePath needs a finite positive cellPitch (got ${String(cellPitch)}).`,
    );
  }

  const frameCount = Math.max(1, Math.floor(railFrameCount));
  // A one-channel probe lets the builder sample through the evaluator; the
  // railId seeds wiggle exactly like the record's applied transform.
  const probe: PhysicPaintRotoRailMotionRecord = {
    railId: options.railId ?? RAIL_MOTION_CURVE_PREVIEW_RAIL_ID,
    anchorKeyId: '',
    channels: [channel],
  };

  const frames = collectRailMotionCurveFrames(channel.keys, frameCount, options.snapFrames);
  let path = '';
  for (let index = 0; index < frames.length; index += 1) {
    const frame = frames[index];
    const value = evaluateRailMotionChannel(probe, channel.id, frame, options.snapFrames);
    const x = frame * cellPitch;
    const y = railMotionCurveY(channel.id, value, laneHeight);
    path += `${index === 0 ? 'M' : ' L'}${formatRailMotionCurveCoordinate(x)},${formatRailMotionCurveCoordinate(y)}`;
  }
  return path;
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
