/**
 * Rail motion snap frames (261108-d5o, Task 3).
 *
 * Stop Motion samples the linear ramp only at frames that DISPLAY a real
 * drawing key. This module resolves that rail-local frame list as pure DATA —
 * the same contract the evaluator's optional `snapFrames` argument carries —
 * so the store (compositor, Studio mirror, gizmo, lane) resolves it ONCE and
 * the evaluator never reads store, raster or signal state.
 *
 * The scan classifies each app frame with the ONE owning-target authority
 * (`classifyPhysicPaintRotoGroupFrameTarget`) and falls back to the per-frame
 * loop resolution only when the classifier answers `empty` (a lifecycle-less
 * loop occurrence has no group lifecycle to classify).
 *
 * Memoization mirrors `railMotionPivot.ts`: a bounded FIFO keyed by
 * `railId + span + capacity + rasterRevision`. The raster revision is
 * PIXEL identity, so a motion-only edit cannot invalidate a scan while a paint
 * edit must. Entries are frozen; the FIRST scan of a key builds the classifier
 * document once (the record array is never built per call).
 *
 * This module is PURE: no store, signal, component, raster or wall-clock
 * import — only the model types, the classifier and the loop resolver.
 */

import {
  type PhysicPaintRotoLoopClip,
  type PhysicPaintRotoRealKeyRecord,
} from './physicsPaintRotoPhysicalModel';
import {
  classifyPhysicPaintRotoGroupFrameTarget,
} from './physicsPaintRotoGroupLifecycle';
import {
  resolvePhysicPaintRotoLoopFrame,
  type PhysicPaintRotoLoopResolutionContext,
} from './physicsPaintRotoPhysicalResolver';

/**
 * Everything one scan needs. `startFrame` / `endFrameExclusive` are APP
 * frames (the rail view span); the resolved list subtracts `startFrame` so it
 * is rail-local, exactly what `evaluateRailMotion` consumes.
 */
export interface RailMotionSnapFrameRequest {
  readonly railId: string;
  readonly startFrame: number;
  readonly endFrameExclusive: number;
  readonly capacity: number;
  /** PIXEL identity (the raster revision), never the canonical revision. */
  readonly rasterRevision: string;
  readonly loopClips: readonly PhysicPaintRotoLoopClip[];
  readonly realKeyRecords: ReadonlyMap<string, PhysicPaintRotoRealKeyRecord>;
  readonly loopResolution: PhysicPaintRotoLoopResolutionContext;
}

/** Immutable empty list shared by every no-snap answer. */
export const RAIL_MOTION_SNAP_FRAMES_EMPTY: readonly number[] = Object.freeze([]);

/** Bounded memo (mirrors 59-08's pivot bound): one entry per rail identity. */
const RAIL_MOTION_SNAP_FRAMES_MEMO_MAX = 512;
const _railMotionSnapFramesMemo = new Map<string, readonly number[]>();

/** Test-only: keeps snap-frame memo assertions order-independent. */
export function __resetRailMotionSnapFramesMemoForTests(): void {
  _railMotionSnapFramesMemo.clear();
}

interface RailMotionSnapFrameClassifierDocument {
  readonly loopClips: readonly PhysicPaintRotoLoopClip[];
  readonly realKeyRecords: readonly PhysicPaintRotoRealKeyRecord[];
  readonly capacity: number;
}

function classifyRailMotionSnapFrame(
  document: RailMotionSnapFrameClassifierDocument,
  loopResolution: PhysicPaintRotoLoopResolutionContext,
  appFrame: number,
): boolean {
  const target = classifyPhysicPaintRotoGroupFrameTarget({ document, appFrame });
  switch (target.kind) {
    case 'override':
    case 'source-occurrence':
    case 'ordinary-key':
      return true;
    case 'generated-occurrence':
    case 'group-gap':
    case 'ambiguous-group':
    case 'unresolved-group':
      return false;
    case 'empty': {
      // The lifecycle-less fallback: only an exact renderable occurrence (a
      // real key or a linked loop occurrence) displays a drawing key. A
      // generated in-between is a rendered blend, never a paint key.
      const resolution = resolvePhysicPaintRotoLoopFrame(loopResolution, appFrame);
      return resolution.kind === 'real' || resolution.kind === 'linked';
    }
    default: {
      const exhaustive: never = target;
      throw new Error(
        `PhysicPaintRotoRailMotionSnapFrames: unknown frame target "${String(exhaustive)}".`,
      );
    }
  }
}

/**
 * The displayed-real-key predicate for one app frame. Exported for the
 * store-level parity test; the scan below uses the same classifier with the
 * document built once per scan.
 */
export function isRailMotionDisplayedRealFrame(
  input: RailMotionSnapFrameRequest,
  appFrame: number,
): boolean {
  const document: RailMotionSnapFrameClassifierDocument = {
    loopClips: input.loopClips,
    realKeyRecords: [...input.realKeyRecords.values()],
    capacity: input.capacity,
  };
  return classifyRailMotionSnapFrame(document, input.loopResolution, appFrame);
}

function resolveRailMotionSnapFramesMemoKey(input: RailMotionSnapFrameRequest): string {
  return `${input.railId}:${input.startFrame}:${input.endFrameExclusive}:${input.capacity}:${input.rasterRevision}`;
}

/**
 * The rail-local app frames whose displayed content is a real drawing key.
 *
 * Bounded linear scan over the view span; repeat calls with the same
 * rail/span/capacity/rasterRevision return the SAME frozen array without
 * re-scanning. A motion-only edit leaves the raster revision untouched, so the
 * compositor costs one scan per rail revision — never per frame.
 */
export function resolveRailMotionSnapFrames(
  input: RailMotionSnapFrameRequest,
): readonly number[] {
  const { startFrame, endFrameExclusive, capacity } = input;
  if (!Number.isFinite(startFrame) || !Number.isFinite(endFrameExclusive) || !Number.isFinite(capacity)) {
    return RAIL_MOTION_SNAP_FRAMES_EMPTY;
  }
  const limit = Math.min(endFrameExclusive, capacity);
  if (limit <= startFrame) return RAIL_MOTION_SNAP_FRAMES_EMPTY;

  const memoKey = resolveRailMotionSnapFramesMemoKey(input);
  const cached = _railMotionSnapFramesMemo.get(memoKey);
  if (cached !== undefined) return cached;

  // Built once per scan, inside the miss branch only.
  const document: RailMotionSnapFrameClassifierDocument = {
    loopClips: input.loopClips,
    realKeyRecords: [...input.realKeyRecords.values()],
    capacity: input.capacity,
  };
  const frames: number[] = [];
  for (let appFrame = startFrame; appFrame < limit; appFrame += 1) {
    if (classifyRailMotionSnapFrame(document, input.loopResolution, appFrame)) {
      frames.push(appFrame - startFrame);
    }
  }
  const resolved: readonly number[] = Object.freeze(frames);

  if (_railMotionSnapFramesMemo.size >= RAIL_MOTION_SNAP_FRAMES_MEMO_MAX) {
    const oldest = _railMotionSnapFramesMemo.keys().next();
    if (!oldest.done) _railMotionSnapFramesMemo.delete(oldest.value);
  }
  _railMotionSnapFramesMemo.set(memoKey, resolved);
  return resolved;
}
