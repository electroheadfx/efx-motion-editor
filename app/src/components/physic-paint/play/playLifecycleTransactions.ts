import type { AnimationWiggleConfig } from '@efxlab/efx-physic-paint/animation';
import type { PhysicPaintLaunchContext, PhysicPaintPlayRenderOptionsSnapshot, PhysicPaintRenderedFrame } from '../../../types/physicPaint';
import { clampPhysicPaintFrameCount } from '../../../types/physicPaint';
import { getActivePlayStartFrame, normalizePlayWiggle } from './playFrameTransactions';

export function resolvePlayFrameCountUpdate(input: {
  requestedFrameCount: number;
  maxFrameCount?: number;
  maxFrameCountReason?: string;
}): { frameCount: number; limitMessage: string | null } {
  const frameCount = Math.min(clampPhysicPaintFrameCount(input.requestedFrameCount), input.maxFrameCount ?? Number.POSITIVE_INFINITY);
  return {
    frameCount,
    limitMessage: input.maxFrameCount !== undefined && input.requestedFrameCount > input.maxFrameCount
      ? input.maxFrameCountReason ?? `Play duration limited to ${input.maxFrameCount} frames.`
      : null,
  };
}

export function markPlayLaunchCacheStale(
  context: PhysicPaintLaunchContext,
  patch: Partial<Pick<PhysicPaintLaunchContext, 'playFrameCount' | 'playMotion' | 'playRenderOptions'>> = {},
): PhysicPaintLaunchContext {
  const next = context.workflowMode === 'play' ? context : omitRotoGapLimit(context);
  return { ...next, ...patch, playCacheStatus: 'stale', cachedPlayFrames: [] };
}

export function applyRenderedPlayCache<TFrame extends PhysicPaintRenderedFrame>(input: {
  context: PhysicPaintLaunchContext;
  currentFrame: number;
  frameCount: number;
  frames: TFrame[];
  motion: AnimationWiggleConfig;
  renderOptions: PhysicPaintPlayRenderOptionsSnapshot;
}): PhysicPaintLaunchContext {
  const startFrame = getActivePlayStartFrame(input.context, input.currentFrame);
  const next = input.context.workflowMode === 'play' ? input.context : omitRotoGapLimit(input.context);
  return {
    ...next,
    workflowMode: 'play',
    editableSource: 'play',
    startFrame,
    playStartFrame: startFrame,
    playFrameCount: input.frameCount,
    selectedPlayScriptId: input.context.selectedPlayScriptId ?? `play-${startFrame}-${input.frameCount}`,
    playCacheStatus: 'cached',
    playMotion: input.motion,
    playRenderOptions: input.renderOptions,
    cachedPlayFrames: input.frames,
    previewFrame: 0,
  };
}

export function resolvePlayOptionsUpdate(input: {
  context: PhysicPaintLaunchContext;
  renderOptions: PhysicPaintPlayRenderOptionsSnapshot;
}): { changed: boolean; context: PhysicPaintLaunchContext } {
  const changed = JSON.stringify(input.context.playRenderOptions ?? null) !== JSON.stringify(input.renderOptions);
  const next = input.context.workflowMode === 'play' ? input.context : omitRotoGapLimit(input.context);
  return {
    changed,
    context: changed
      ? markPlayLaunchCacheStale(next, { playRenderOptions: input.renderOptions, playMotion: input.renderOptions.motion })
      : { ...next, playRenderOptions: input.renderOptions, playMotion: input.renderOptions.motion },
  };
}

export function normalizePlayMotionUpdate(wiggle: AnimationWiggleConfig): AnimationWiggleConfig {
  return normalizePlayWiggle(wiggle);
}

function omitRotoGapLimit(context: PhysicPaintLaunchContext): PhysicPaintLaunchContext {
  const next = { ...context };
  delete next.maxPlayFrameCount;
  delete next.maxPlayFrameCountReason;
  return next;
}
