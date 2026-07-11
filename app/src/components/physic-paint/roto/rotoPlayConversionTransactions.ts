import type { SerializedProject } from '@efxlab/efx-physic-paint';
import type {
  PhysicPaintApplyPayload,
  PhysicPaintLaunchContext,
  PhysicPaintPlayRenderOptionsSnapshot,
  PhysicPaintPlayMotionSettings,
  PhysicPaintRenderedFrame,
} from '../../../types/physicPaint';
import { clampPhysicPaintFrameCount } from '../../../types/physicPaint';
import { PLAY_TO_ROTO_MISSING_FRAMES_MESSAGE } from '../physicsPaintWorkflowState';

export interface PlayToRotoConversionPlan {
  type: 'convert';
  payload: Extract<PhysicPaintApplyPayload, { kind: 'convert-play-to-roto' }>;
  expectedFrames: number[];
}

export type PlayToRotoConversionResult = PlayToRotoConversionPlan | {
  type: 'missing-frames';
  message: typeof PLAY_TO_ROTO_MISSING_FRAMES_MESSAGE;
};

export function planPlayToRotoConversion(input: {
  launchContext: PhysicPaintLaunchContext;
  currentFrame: number;
  requestedFrameCount: number;
  latestFrames: readonly PhysicPaintRenderedFrame[];
  editableState: SerializedProject;
  now: number;
}): PlayToRotoConversionResult {
  const frameCount = clampPhysicPaintFrameCount(input.requestedFrameCount);
  const expectedFrames = Array.from({ length: frameCount }, (_, index) => input.currentFrame + index);
  const framesByAppFrame = new Map(input.latestFrames.map((frame) => [frame.appFrame, frame]));
  if (!expectedFrames.every((frame) => framesByAppFrame.has(frame))) {
    return { type: 'missing-frames', message: PLAY_TO_ROTO_MISSING_FRAMES_MESSAGE };
  }
  return {
    type: 'convert',
    expectedFrames,
    payload: {
      operationId: `${input.launchContext.operationId}:convert-play-to-roto:${input.now}`,
      kind: 'convert-play-to-roto',
      layerId: input.launchContext.layerId,
      startFrame: input.currentFrame,
      frameCount,
      frames: expectedFrames.map((frame) => framesByAppFrame.get(frame)!),
      editableState: input.editableState,
    },
  };
}

export function buildRotoToPlayConversionPayload(input: {
  launchContext: PhysicPaintLaunchContext;
  currentFrame: number;
  requestedFrameCount: number;
  editableState: SerializedProject;
  playMotion: PhysicPaintPlayMotionSettings;
  renderOptions: PhysicPaintPlayRenderOptionsSnapshot;
  now: number;
}): Extract<PhysicPaintApplyPayload, { kind: 'convert-roto-to-play' }> {
  const frameCount = clampPhysicPaintFrameCount(input.requestedFrameCount);
  return {
    operationId: `${input.launchContext.operationId}:convert-roto-to-play:${input.now}`,
    kind: 'convert-roto-to-play',
    layerId: input.launchContext.layerId,
    startFrame: input.currentFrame,
    frameCount,
    editableState: input.editableState,
    playScriptId: input.launchContext.selectedPlayScriptId,
    playMotion: input.playMotion,
    renderOptions: input.renderOptions,
  };
}

export function transitionPlayToRotoContext(input: {
  context: PhysicPaintLaunchContext;
  cachedRotoFrames: PhysicPaintLaunchContext['cachedRotoFrames'];
}): PhysicPaintLaunchContext {
  return { ...input.context, cachedRotoFrames: input.cachedRotoFrames };
}

export function transitionRotoToPlayContext(input: {
  context: PhysicPaintLaunchContext;
  startFrame: number;
  frameCount: number;
  playMotion: PhysicPaintPlayMotionSettings;
  renderOptions: PhysicPaintPlayRenderOptionsSnapshot;
  cachedRotoFrames: PhysicPaintLaunchContext['cachedRotoFrames'];
}): PhysicPaintLaunchContext {
  const next = { ...input.context };
  delete next.maxPlayFrameCount;
  delete next.maxPlayFrameCountReason;
  return {
    ...next,
    workflowMode: 'play',
    editableSource: 'play',
    startFrame: input.startFrame,
    playStartFrame: input.startFrame,
    playFrameCount: input.frameCount,
    selectedPlayScriptId: input.context.selectedPlayScriptId ?? `play-${input.startFrame}-${input.frameCount}`,
    playCacheStatus: 'stale',
    playMotion: input.playMotion,
    playRenderOptions: input.renderOptions,
    cachedPlayFrames: [],
    cachedRotoFrames: input.cachedRotoFrames,
    previewFrame: 0,
  };
}
