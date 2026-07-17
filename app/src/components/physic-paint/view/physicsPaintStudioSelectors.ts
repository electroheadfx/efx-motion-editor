import type { PhysicsPaintBridgeMode } from '../bridge/usePhysicsPaintParentBridge';
import type { PhysicsPaintWorkflowMode } from './physicsPaintWorkflowPresentation';

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

export function selectRotoPlaybackAvailable(input: {
  workflowMode: PhysicsPaintWorkflowMode;
  hasLaunchContext: boolean;
  frames: readonly { frame: unknown }[];
}): boolean {
  return input.hasLaunchContext && input.frames.some(({ frame }) => Boolean(frame));
}
