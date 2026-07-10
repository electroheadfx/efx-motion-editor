import type { AnimationWiggleConfig } from '@efxlab/efx-physic-paint/animation';
import type { PhysicPaintLaunchContext, PhysicPaintRenderedFrame } from '../../types/physicPaint';
import { PHYSIC_PAINT_DEFAULT_APPLY_FRAMES, clampPhysicPaintFrameCount } from '../../types/physicPaint';

export type PlayFrameState = {
  strokes: Array<{ playFrame?: number }>;
};

export function getLaunchPlayPreviewFrame(context: PhysicPaintLaunchContext | null): number {
  const previewFrame = context?.previewFrame;
  if (!Number.isInteger(previewFrame) || previewFrame === undefined || previewFrame < 0) return 0;
  return previewFrame;
}

export function getActivePlayStartFrame(context: PhysicPaintLaunchContext, fallbackFrame: number): number {
  return Number.isInteger(context.playStartFrame) && context.playStartFrame !== undefined && context.playStartFrame >= 0
    ? context.playStartFrame
    : fallbackFrame;
}

export function normalizePlayWiggle(value: Partial<AnimationWiggleConfig> | null | undefined): AnimationWiggleConfig {
  return {
    strokeDeformation: clampPercentInteger(value?.strokeDeformation),
    strokePosition: clampPercentInteger(value?.strokePosition),
  };
}

function clampPercentInteger(value: unknown): number {
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.min(100, Math.trunc(numeric)));
}

export function annotatePlayFrameStrokes<T extends PlayFrameState>(state: T, assignments: ReadonlyMap<number, number>): T {
  if (assignments.size === 0) return state;
  return {
    ...state,
    strokes: state.strokes.map((stroke, index) => {
      const playFrame = assignments.get(index);
      if (typeof playFrame !== 'number' || !Number.isInteger(playFrame) || playFrame < 0) return stroke;
      return { ...stroke, playFrame };
    }),
  };
}

export function getPlayFrameEditAssignments(state: PlayFrameState): Map<number, number> {
  const assignments = new Map<number, number>();
  state.strokes.forEach((stroke, index) => {
    const playFrame = stroke.playFrame;
    if (typeof playFrame === 'number' && Number.isInteger(playFrame) && playFrame >= 0) assignments.set(index, playFrame);
  });
  return assignments;
}

export function getPlayFrameCountFromAssignments(assignments: ReadonlyMap<number, number>, fallback = PHYSIC_PAINT_DEFAULT_APPLY_FRAMES): number {
  if (assignments.size === 0) return fallback;
  return clampPhysicPaintFrameCount(Math.max(...assignments.values()) + 1);
}

export function findCachedPlayFrame<T extends PhysicPaintRenderedFrame>(input: {
  context: PhysicPaintLaunchContext | null;
  currentFrame: number;
  previewFrame: number;
  latestFrames: readonly T[];
  getStoredFrame: (layerId: string, appFrame: number) => T | null;
}): T | null {
  if (!input.context) return null;
  const appFrame = getActivePlayStartFrame(input.context, input.currentFrame) + input.previewFrame;
  return input.latestFrames.find((frame) => frame.appFrame === appFrame)
    ?? input.context.cachedPlayFrames?.find((frame) => frame.appFrame === appFrame) as T | undefined
    ?? input.getStoredFrame(input.context.layerId, appFrame);
}

export function getCachedPlayFramesForRange<T extends PhysicPaintRenderedFrame>(input: {
  frameCount: number;
  cacheDirty: boolean;
  findFrame: (previewFrame: number) => T | null;
}): T[] | null {
  if (input.cacheDirty) return null;
  const safeFrameCount = clampPhysicPaintFrameCount(input.frameCount);
  const frames = Array.from({ length: safeFrameCount }, (_, index) => input.findFrame(index));
  return frames.every(Boolean) ? frames as T[] : null;
}
