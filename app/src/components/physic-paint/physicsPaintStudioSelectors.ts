import type { PhysicPaintRenderedFrame } from '../../types/physicPaint';
import { clampPhysicPaintFrameCount } from '../../types/physicPaint';
import type { PhysicsPaintBridgeMode } from './usePhysicsPaintParentBridge';
import type { PhysicsPaintWorkflowMode } from './physicsPaintWorkflowState';

export type PhysicsPaintApplyReadinessInput = {
  engineReady: boolean;
  canvasMounted: boolean;
  hasLaunchContext: boolean;
  bridgeMode: PhysicsPaintBridgeMode;
  applyStatus: 'idle' | 'applying' | 'success' | 'error';
  isPlaying: boolean;
  rotoPlaybackActive: boolean;
};

export function selectPhysicsPaintMissingConditions(input: PhysicsPaintApplyReadinessInput): string[] {
  const missing: string[] = [];
  if (!input.engineReady) missing.push('Engine is still initializing');
  if (!input.canvasMounted) missing.push('Canvas is still mounting');
  if (!input.hasLaunchContext) missing.push('No app layer context received');
  if (input.bridgeMode === 'Unavailable') missing.push('App bridge is not connected');
  if (input.applyStatus === 'applying' || (input.isPlaying && !input.rotoPlaybackActive)) missing.push('Apply operation is still running');
  return missing;
}

export function selectPlayConversionMissingFrames(input: {
  hasLaunchContext: boolean;
  currentFrame: number;
  requestedFrameCount: number;
  latestFrames: readonly Pick<PhysicPaintRenderedFrame, 'appFrame'>[];
}): boolean {
  if (!input.hasLaunchContext) return true;
  const frameCount = clampPhysicPaintFrameCount(input.requestedFrameCount);
  const framesByAppFrame = new Set(input.latestFrames.map((frame) => frame.appFrame));
  return Array.from({ length: frameCount }, (_, index) => input.currentFrame + index).some((frame) => !framesByAppFrame.has(frame));
}

export type PlayCacheStatus = 'stale' | 'cached' | 'missing' | null;

export function selectCurrentPlayCacheStatus(input: {
  workflowMode: PhysicsPaintWorkflowMode;
  cacheDirty: boolean;
  hasCachedRange: boolean;
}): PlayCacheStatus {
  if (input.workflowMode !== 'play') return null;
  if (input.cacheDirty) return 'stale';
  return input.hasCachedRange ? 'cached' : 'missing';
}

export function selectRotoPlaybackAvailable(input: {
  workflowMode: PhysicsPaintWorkflowMode;
  hasLaunchContext: boolean;
  frames: readonly { frame: unknown }[];
}): boolean {
  return input.workflowMode === 'roto' && input.hasLaunchContext && input.frames.some(({ frame }) => Boolean(frame));
}
