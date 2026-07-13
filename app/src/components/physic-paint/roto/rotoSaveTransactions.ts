import type { EfxPaintEngine } from '@efxlab/efx-physic-paint';
import type {
  PhysicPaintApplyPayload,
  PhysicPaintLaunchContext,
  PhysicPaintRenderedFrame,
  PhysicPaintRotoBackgroundMetadata,
  PhysicPaintRotoCacheFrame,
  PhysicPaintRotoInterpolationSettings,
} from '../../../types/physicPaint';

export type RotoEditableState = ReturnType<EfxPaintEngine['save']>;
export type RotoRenderedFrame = PhysicPaintRenderedFrame & Partial<Pick<PhysicPaintRotoCacheFrame, 'sourceFrame' | 'displayFrame' | 'fromSourceFrame' | 'toSourceFrame' | 'interpolationT' | 'backgroundOnly' | 'onionDataUrl'>>;

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

export function selectRotoEditableState(input: {
  frame: number;
  currentFrame: number;
  liveState: RotoEditableState;
  storedState?: RotoEditableState;
}): { editableState: RotoEditableState | undefined; previousState: RotoEditableState | null } {
  return input.frame === input.currentFrame
    ? { editableState: input.liveState, previousState: null }
    : { editableState: input.storedState, previousState: input.liveState };
}

export function shouldPersistRotoFrame(state: RotoEditableState): boolean {
  return state.strokes.length > 0 || state.settings.bgMode !== 'transparent';
}

export function isBackgroundOnlyRotoFrame(state: RotoEditableState): boolean {
  return state.strokes.length === 0 && state.settings.bgMode !== 'transparent';
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
    startFrame: input.frame,
    sourceFrame: input.sourceFrame,
  };
}

export function buildApplyCanvasPayload(input: {
  launchContext: PhysicPaintLaunchContext;
  frame: number;
  sourceFrame: number;
  editableState: RotoEditableState;
  renderedFrame: RotoRenderedFrame;
  backgroundMetadata: PhysicPaintRotoBackgroundMetadata;
  interpolationSettings: PhysicPaintRotoInterpolationSettings;
  backgroundOnly: boolean;
  onionFrame: RotoRenderedFrame | null;
  now: number;
}): PhysicPaintApplyPayload {
  return {
    operationId: `${input.launchContext.operationId}:canvas:${input.frame}:${input.now}`,
    kind: 'apply-canvas',
    layerId: input.launchContext.layerId,
    startFrame: input.frame,
    sourceFrame: input.sourceFrame,
    editableState: input.editableState,
    renderedFrame: input.renderedFrame,
    rotoBackground: input.backgroundMetadata,
    rotoInterpolationSettings: input.interpolationSettings,
    ...(input.backgroundOnly ? { backgroundOnly: true } : {}),
    ...(input.onionFrame?.dataUrl ? { onionDataUrl: input.onionFrame.dataUrl } : {}),
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
