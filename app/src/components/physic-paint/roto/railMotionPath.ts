/**
 * Rail-motion canvas path (quick 261108-kvw).
 *
 * The READ-ONLY spatial route of the selected rail's authored Position
 * channels, drawn on the canvas behind the rail-motion transform handles.
 *
 * THE AUTHORED-PATH LAW: the overlay draws the AUTHORED route. Wiggle is
 * display-only jitter applied by the evaluator, so every sample is taken from
 * a FROZEN PROBE record whose channel wiggle and every key wiggle are 0 —
 * `zeroRailMotionWiggle` builds it once per edit. With wiggle on, the polyline
 * stays fixed while the box shakes, and the cursor marker uses the same probe,
 * so the whole overlay is wiggle-neutral.
 *
 * Interpolation is NOT re-implemented here: every sampled point is
 * `evaluateRailMotion(probe, frame, snapFrames).translateX/translateY`, the
 * 59-05 evaluator's one authority. This module imports the evaluator and
 * nothing else — no Preact, no signal, no store, no DOM.
 *
 * Sampling budget: every integer frame in a stride grid, PLUS every position
 * motion-key frame and every stop-motion snap frame, deduped and sorted, under
 * a HARD cap of RAIL_MOTION_PATH_MAX_SAMPLES (2000) that holds for EVERY
 * input. Interior grid points yield to authored frames, and when the authored
 * set alone exceeds the budget (a position channel may carry up to 4096 keys)
 * the sampler decimates the sorted required list deterministically so exactly
 * 2000 samples remain with frame 0 and frameCount - 1 always present — the
 * tail is never truncated.
 *
 * Stop motion is represented by repeated integer samples that jump at a snap
 * frame: no epsilon left-limit points, because a SPATIAL path draws the
 * connector between two poses — the lane curve keeps the epsilon behavior.
 */

import type { PhysicPaintRotoRailMotionRecord } from './railMotionModel';
import { evaluateRailMotion } from './railMotionEvaluator';

/** The hard sample cap. Holds for every input, authored frames included. */
export const RAIL_MOTION_PATH_MAX_SAMPLES = 2000;

/** Two points closer than this on both axes are the same authored pose. */
export const RAIL_MOTION_PATH_DISTINCT_EPSILON = 1e-6;

/** One origin point on the authored route, in PROJECT pixels. */
export interface RailMotionPathSample {
  readonly frame: number;
  readonly x: number;
  readonly y: number;
}

/**
 * The frozen authored route. `pivotX`/`pivotY` are the rail-level compositor
 * pivot (normalized to the project raster) and are REQUIRED inputs of the
 * sampler: the canvas placement mirrors `getRailMotionBounds(...).center`,
 * which needs them to place every point. `signature` is a primitive memo key
 * the Studio's canvas-stack memo watches.
 */
export interface RailMotionPath {
  readonly railId: string;
  readonly startFrame: number;
  readonly frameCount: number;
  readonly pivotX: number;
  readonly pivotY: number;
  readonly samples: readonly RailMotionPathSample[];
  readonly keyFrames: readonly number[];
  readonly signature: string;
}

/**
 * The sampler's frozen output. `authoredRecord` is the wiggle-zeroed PROBE (the
 * only record the route and the cursor ever evaluate); `snapFrames` is the
 * reference the path was sampled with, so the cursor marker inherits it.
 */
export interface RailMotionPathEvaluation {
  readonly path: RailMotionPath;
  readonly authoredRecord: PhysicPaintRotoRailMotionRecord;
  readonly snapFrames: readonly number[];
}

export interface RailMotionPathSampleInput {
  readonly railId: string;
  readonly startFrame: number;
  readonly frameCount: number;
  readonly snapFrames: readonly number[];
  /** REQUIRED and never defaulted: the compositor's rail-level pivot. */
  readonly pivotX: number;
  readonly pivotY: number;
}

export interface RailMotionPathCachedInput extends RailMotionPathSampleInput {
  readonly record: PhysicPaintRotoRailMotionRecord | null;
}

/** One cursor point on the authored route, in PROJECT pixels. */
export interface RailMotionPathCursorPoint {
  readonly frame: number;
  readonly x: number;
  readonly y: number;
}

/**
 * The wiggle-zeroed authored PROBE.
 *
 * Returns the input record BY REFERENCE when it is already wiggle-free, so the
 * common record allocates nothing and the one-entry cache can keep it. A
 * record carrying any channel or key wiggle is cloned frozen with every wiggle
 * forced to 0; `wiggleGlobal` is kept as stored because it is irrelevant once
 * every wiggle is 0.
 */
export function zeroRailMotionWiggle(
  record: PhysicPaintRotoRailMotionRecord,
): PhysicPaintRotoRailMotionRecord {
  let wiggleFree = true;
  for (const channel of record.channels) {
    if (channel.wiggle !== 0) {
      wiggleFree = false;
      break;
    }
    for (const key of channel.keys) {
      if (key.wiggle !== 0) {
        wiggleFree = false;
        break;
      }
    }
    if (!wiggleFree) break;
  }
  if (wiggleFree) return record;

  return Object.freeze({
    railId: record.railId,
    anchorKeyId: record.anchorKeyId,
    channels: Object.freeze(record.channels.map((channel) => Object.freeze({
      id: channel.id,
      keys: Object.freeze(channel.keys.map((key) => Object.freeze({
        frame: key.frame,
        value: key.value,
        easing: key.easing,
        wiggle: 0,
      }))),
      wiggle: 0,
      wiggleGlobal: channel.wiggleGlobal,
    }))),
  }) as PhysicPaintRotoRailMotionRecord;
}

function clampRailMotionPathFrame(frame: number, lastFrame: number): number {
  if (frame < 0) return 0;
  if (frame > lastFrame) return lastFrame;
  return frame;
}

/**
 * The sample-frame law, in exactly two branches.
 *
 * Required set first: frame 0, the span tail (frameCount - 1), every position
 * motion-key frame clamped into the span, and every stop-motion snap frame
 * clamped into the span — deduped and sorted. Authored frames OUTRANK the
 * grid.
 *
 * (a) required.length <= RAIL_MOTION_PATH_MAX_SAMPLES: keep every required
 *     frame. The remaining interiorBudget is filled with a uniform stride:
 *     stride = max(1, ceil((frameCount - 2) / interiorBudget)), adding every
 *     interior frame from stride to lastFrame - 1 step stride. The grid count
 *     floor((frameCount - 2) / stride) <= interiorBudget, so the merged total
 *     can never exceed the cap; interiorBudget 0 adds no grid points.
 *
 * (b) required.length > RAIL_MOTION_PATH_MAX_SAMPLES: the authored frames
 *     alone already fill the budget, so NO grid points are added and the
 *     sorted required list is decimated deterministically:
 *
 *       required[Math.round(out * (required.length - 1) /
 *                          (RAIL_MOTION_PATH_MAX_SAMPLES - 1))]
 *
 *     for out = 0..RAIL_MOTION_PATH_MAX_SAMPLES - 1. The indices are strictly
 *     increasing, so exactly RAIL_MOTION_PATH_MAX_SAMPLES frames survive,
 *     always starting at frame 0 and ending at frameCount - 1.
 *
 * Frame 0 and the span tail are never dropped by either branch.
 */
function collectRailMotionPathFrames(
  positionChannels: readonly { readonly keys: readonly { readonly frame: number }[] }[],
  frameCount: number,
  snapFrames: readonly number[],
): number[] {
  const lastFrame = frameCount - 1;
  const required = new Set<number>();
  required.add(0);
  required.add(lastFrame);
  for (const channel of positionChannels) {
    for (const key of channel.keys) {
      if (!Number.isFinite(key.frame)) continue;
      required.add(clampRailMotionPathFrame(key.frame, lastFrame));
    }
  }
  for (const snap of snapFrames) {
    if (!Number.isFinite(snap)) continue;
    required.add(clampRailMotionPathFrame(snap, lastFrame));
  }
  const requiredFrames = [...required].sort((left, right) => left - right);

  if (requiredFrames.length > RAIL_MOTION_PATH_MAX_SAMPLES) {
    const decimated: number[] = [];
    for (let out = 0; out < RAIL_MOTION_PATH_MAX_SAMPLES; out += 1) {
      const index = Math.round(
        (out * (requiredFrames.length - 1)) / (RAIL_MOTION_PATH_MAX_SAMPLES - 1),
      );
      decimated.push(requiredFrames[index]);
    }
    return decimated;
  }

  const interiorBudget = RAIL_MOTION_PATH_MAX_SAMPLES - requiredFrames.length;
  if (interiorBudget <= 0) return requiredFrames;
  const stride = Math.max(1, Math.ceil((frameCount - 2) / interiorBudget));
  const frames = new Set<number>(requiredFrames);
  for (let frame = stride; frame < lastFrame; frame += stride) frames.add(frame);
  return [...frames].sort((left, right) => left - right);
}

/** FNV-1a 32-bit hash over the rounded sample coordinates. */
function hashRailMotionPathSamples(samples: readonly RailMotionPathSample[]): number {
  let hash = 0x811c9dc5;
  for (const sample of samples) {
    const text = `${Math.round(sample.x * 1000)},${Math.round(sample.y * 1000)};`;
    for (let index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 0x01000193);
    }
  }
  return hash >>> 0;
}

function buildRailMotionPathSignature(
  input: RailMotionPathSampleInput,
  frameCount: number,
  samples: readonly RailMotionPathSample[],
): string {
  return [
    input.railId,
    String(input.startFrame),
    String(frameCount),
    String(input.pivotX),
    String(input.pivotY),
    String(samples.length),
    hashRailMotionPathSamples(samples).toString(16),
  ].join('|');
}

function railMotionPositionChannels(
  record: PhysicPaintRotoRailMotionRecord,
): readonly { readonly keys: readonly { readonly frame: number }[] }[] {
  return record.channels.filter(
    (channel) => channel.id === 'position-x' || channel.id === 'position-y',
  );
}

/**
 * Samples the authored Position route across the rail span.
 *
 * Returns null when the record is absent, when it carries no Position channel,
 * when the span is shorter than two frames, or when every sampled origin is
 * the same point (the identity route). Every sample is the evaluator's
 * translateX/translateY in PROJECT pixels; the sample list is ascending and
 * every collected frame is evaluated exactly once.
 */
export function sampleRailMotionPath(
  record: PhysicPaintRotoRailMotionRecord | null,
  input: RailMotionPathSampleInput,
): RailMotionPathEvaluation | null {
  if (record === null) return null;
  if (!Number.isFinite(input.frameCount) || !Number.isFinite(input.startFrame)) return null;
  if (!Number.isFinite(input.pivotX) || !Number.isFinite(input.pivotY)) return null;
  const frameCount = Math.floor(input.frameCount);
  if (frameCount < 2) return null;

  const positionChannels = railMotionPositionChannels(record);
  if (positionChannels.length === 0) return null;

  const authoredRecord = zeroRailMotionWiggle(record);
  const authoredPositionChannels = railMotionPositionChannels(authoredRecord);
  const frames = collectRailMotionPathFrames(
    authoredPositionChannels,
    frameCount,
    input.snapFrames,
  );

  const samples: RailMotionPathSample[] = [];
  for (const frame of frames) {
    const evaluated = evaluateRailMotion(authoredRecord, frame, input.snapFrames);
    samples.push(Object.freeze({
      frame,
      x: evaluated.translateX,
      y: evaluated.translateY,
    }) as RailMotionPathSample);
  }

  const first = samples[0];
  let distinct = false;
  for (let index = 1; index < samples.length; index += 1) {
    if (Math.abs(samples[index].x - first.x) > RAIL_MOTION_PATH_DISTINCT_EPSILON
      || Math.abs(samples[index].y - first.y) > RAIL_MOTION_PATH_DISTINCT_EPSILON) {
      distinct = true;
      break;
    }
  }
  if (!distinct) return null;

  const lastFrame = frameCount - 1;
  const keyFrameSet = new Set<number>();
  for (const channel of authoredPositionChannels) {
    for (const key of channel.keys) {
      if (!Number.isFinite(key.frame)) continue;
      keyFrameSet.add(clampRailMotionPathFrame(key.frame, lastFrame));
    }
  }
  const keyFrames = Object.freeze(
    [...keyFrameSet].sort((left, right) => left - right),
  ) as readonly number[];

  const path = Object.freeze({
    railId: input.railId,
    startFrame: input.startFrame,
    frameCount,
    pivotX: input.pivotX,
    pivotY: input.pivotY,
    samples: Object.freeze(samples) as readonly RailMotionPathSample[],
    keyFrames,
    signature: buildRailMotionPathSignature(input, frameCount, samples),
  }) as RailMotionPath;

  return Object.freeze({
    path,
    authoredRecord,
    snapFrames: input.snapFrames,
  }) as RailMotionPathEvaluation;
}

interface RailMotionPathCacheEntry {
  readonly record: PhysicPaintRotoRailMotionRecord;
  readonly railId: string;
  readonly startFrame: number;
  readonly frameCount: number;
  readonly snapFrames: readonly number[];
  readonly pivotX: number;
  readonly pivotY: number;
  readonly evaluation: RailMotionPathEvaluation | null;
}

/**
 * The one-entry identity cache. The bundle is produced once per edit and
 * reused while scrubbing: a hit requires the SAME record, railId, span,
 * snap-list reference and pivot, so no edit can silently reuse a stale route.
 * A null result is cached too — an identity route costs one sampling pass, not
 * one per frame.
 */
let _railMotionPathCache: RailMotionPathCacheEntry | null = null;

export function sampleRailMotionPathCached(
  input: RailMotionPathCachedInput,
): RailMotionPathEvaluation | null {
  const cached = _railMotionPathCache;
  if (cached !== null
    && input.record !== null
    && Object.is(cached.record, input.record)
    && cached.railId === input.railId
    && Object.is(cached.startFrame, input.startFrame)
    && Object.is(cached.frameCount, input.frameCount)
    && Object.is(cached.snapFrames, input.snapFrames)
    && Object.is(cached.pivotX, input.pivotX)
    && Object.is(cached.pivotY, input.pivotY)) {
    return cached.evaluation;
  }

  const evaluation = input.record === null
    ? null
    : sampleRailMotionPath(input.record, {
      railId: input.railId,
      startFrame: input.startFrame,
      frameCount: input.frameCount,
      snapFrames: input.snapFrames,
      pivotX: input.pivotX,
      pivotY: input.pivotY,
    });

  _railMotionPathCache = input.record === null
    ? null
    : {
      record: input.record,
      railId: input.railId,
      startFrame: input.startFrame,
      frameCount: input.frameCount,
      snapFrames: input.snapFrames,
      pivotX: input.pivotX,
      pivotY: input.pivotY,
      evaluation,
    };
  return evaluation;
}

/**
 * The cursor's authored point on the route. Null when the rail-local frame is
 * non-finite or outside the span; the cursor marker is the ONLY cursor-owned
 * geometry, so scrubbing re-evaluates this function and nothing else.
 */
export function evaluateRailMotionPathCursor(
  evaluation: RailMotionPathEvaluation,
  railLocalFrame: number,
): RailMotionPathCursorPoint | null {
  if (!Number.isFinite(railLocalFrame)) return null;
  const lastFrame = evaluation.path.frameCount - 1;
  if (railLocalFrame < 0 || railLocalFrame > lastFrame) return null;
  const evaluated = evaluateRailMotion(
    evaluation.authoredRecord,
    railLocalFrame,
    evaluation.snapFrames,
  );
  return Object.freeze({
    frame: railLocalFrame,
    x: evaluated.translateX,
    y: evaluated.translateY,
  }) as RailMotionPathCursorPoint;
}

/**
 * Project-space authored point -> the handles' WORKING space (project→working
 * scaled by `zoom`), mirroring `getRailMotionBounds(...).center` — the ONE
 * canvas convention: the box centre is the pivot after translate, so the route
 * point is `zoom * (pivot * projectSize + translate)` per axis.
 */
export function placeRailMotionPathPoint(
  x: number,
  y: number,
  pivotX: number,
  pivotY: number,
  projectWidth: number,
  projectHeight: number,
  zoom: number,
): { readonly x: number; readonly y: number } {
  return Object.freeze({
    x: zoom * (pivotX * projectWidth + x),
    y: zoom * (pivotY * projectHeight + y),
  });
}

/** One decimal place at most, and never a trailing ".0" (the lane's law). */
function formatRailMotionPathCoordinate(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

/** The dashed polyline: one `M` then `L` per ascending sample. */
export function buildRailMotionPathD(
  path: RailMotionPath,
  projectWidth: number,
  projectHeight: number,
  zoom: number,
): string {
  let d = '';
  for (let index = 0; index < path.samples.length; index += 1) {
    const sample = path.samples[index];
    const point = placeRailMotionPathPoint(
      sample.x,
      sample.y,
      path.pivotX,
      path.pivotY,
      projectWidth,
      projectHeight,
      zoom,
    );
    d += `${index === 0 ? 'M' : ' L'}${formatRailMotionPathCoordinate(point.x)},${formatRailMotionPathCoordinate(point.y)}`;
  }
  return d;
}
