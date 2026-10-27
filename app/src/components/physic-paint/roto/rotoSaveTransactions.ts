import type {
  PhysicPaintApplyPayload,
  PhysicPaintLaunchContext,
  PhysicPaintRenderedFrame,
  PhysicPaintRotoCacheFrame,
  PhysicPaintRotoInterpolationSettings,
} from '../../../types/physicPaint';
import { shouldPersistRotoFrameFromTruth } from './rotoFramePersistTruth';

export type { RotoEditableState } from '../types/paintCore';
export type RotoRenderedFrame = PhysicPaintRenderedFrame & Partial<Pick<PhysicPaintRotoCacheFrame, 'sourceFrame' | 'displayFrame' | 'fromSourceFrame' | 'toSourceFrame' | 'interpolationT' | 'backgroundOnly' | 'onionBytes'>>;

export interface RotoFlushOptions {
  force?: boolean;
  advanceToFrame?: number | null;
  sourceFrameOverride?: number;
  rotoInterpolationSettings?: PhysicPaintRotoInterpolationSettings;
  onPayload?: (payload: PhysicPaintApplyPayload) => void;
}

export type RotoFlushGuard =
  | { type: 'invalid' }
  | { type: 'clean' }
  | { type: 'in-flight' }
  | { type: 'flush' };

export function guardRotoFlush(input: {
  hasActionContext: boolean;
  frame: number;
  force?: boolean;
  dirty: boolean;
  inFlight: boolean;
}): RotoFlushGuard {
  if (!input.hasActionContext || !Number.isInteger(input.frame) || input.frame < 0) return { type: 'invalid' };
  if (!input.force && !input.dirty) return { type: 'clean' };
  if (input.inFlight) return { type: 'in-flight' };
  return { type: 'flush' };
}

/**
 * 3.5 (quick 261027-klx): the persist law reads the WATERCOLOR truth, not the
 * engine-1 document mirror. `state.tracks[].strokes` stops being populated the
 * moment stroke acceptance routes through the app-owned ledger, so a painted
 * watercolor frame would classify as EMPTY and Roto persistence would silently
 * drop real paint. The law itself is unchanged — `shouldPersistRotoFrameFromTruth`
 * states it over an explicit truth input.
 */
export function shouldPersistRotoFrame(input: {
  recordedStrokeCount: number;
  payloadEventCount: number;
  bgMode: string;
}): boolean {
  return shouldPersistRotoFrameFromTruth(input);
}

/** No live strokes but a non-transparent fond — unchanged law, truth input. */
export function isBackgroundOnlyRotoFrame(input: {
  recordedStrokeCount: number;
  payloadEventCount: number;
  bgMode: string;
}): boolean {
  const hasStrokes = shouldPersistRotoFrameFromTruth({ ...input, bgMode: 'transparent' });
  return !hasStrokes && input.bgMode !== 'transparent';
}

export function resolveRotoSaveSourceFrame(frame: number, sourceFrameOverride: number | undefined, resolvedSourceFrame: number): number {
  return sourceFrameOverride ?? resolvedSourceFrame ?? frame;
}

export function buildDeleteRotoFramePayload(input: {
  launchContext: PhysicPaintLaunchContext;
  frame: number;
  sourceFrame: number;
  now: number;
}): PhysicPaintApplyPayload {
  return {
    operationId: `${input.launchContext.operationId}:delete-roto:${input.frame}:${input.now}`,
    kind: 'delete-roto-frame',
    layerId: input.launchContext.layerId,
    // 46-01: apply payloads carry the target trackId (the launch IS the document).
    trackId: input.launchContext.document?.activeTrackId ?? '',
    startFrame: input.frame,
    sourceFrame: input.sourceFrame,
  };
}

export type RotoSaveFrameGuard =
  | { type: 'unavailable' }
  | { type: 'render-only'; message: string }
  | { type: 'no-new-paint'; message: string }
  | { type: 'save' };

export function guardRotoSaveFrame(input: {
  readyToApply: boolean;
  hasLaunchContext: boolean;
  currentFrame: number;
  selectionKind: 'real-key' | 'generated-interpolation' | 'empty';
  cachedRepaint: boolean;
  dirty: boolean;
  snapshotHasLiveOverlay: boolean;
}): RotoSaveFrameGuard {
  if (!input.readyToApply || !input.hasLaunchContext) return { type: 'unavailable' };
  if (input.selectionKind !== 'real-key') {
    const label = input.selectionKind === 'generated-interpolation' ? 'Generated' : 'Empty';
    return {
      type: 'render-only',
      message: `${label} frame ${input.currentFrame} is render-only. Navigate to a real Roto key to paint.`,
    };
  }
  if (input.cachedRepaint && !input.dirty && !input.snapshotHasLiveOverlay) {
    return { type: 'no-new-paint', message: `No new paint to save for frame ${input.currentFrame}.` };
  }
  return { type: 'save' };
}

export function sortedDirtyRotoFrames(frames: ReadonlySet<number>): number[] {
  return Array.from(frames).sort((a, b) => a - b);
}
