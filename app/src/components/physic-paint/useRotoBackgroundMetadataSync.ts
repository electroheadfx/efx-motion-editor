import { useEffect } from 'preact/hooks';
import type { PhysicPaintLaunchContext } from '../../types/physicPaint';
import { physicPaintStore } from '../../stores/physicPaintStore';
import type { PhysicsPaintStudioSettings } from './physicsPaintStudioSettings';
import { buildRotoBackgroundMetadata } from './physicsPaintStudioSettings';

export function persistRotoBackgroundMetadata(
  launchContext: PhysicPaintLaunchContext | null,
  workflowMode: 'play' | 'roto',
  settings: PhysicsPaintStudioSettings,
): void {
  if (!launchContext || workflowMode !== 'roto') return;
  physicPaintStore.setRotoBackgroundMetadata(launchContext.layerId, buildRotoBackgroundMetadata(settings));
}

export function useRotoBackgroundMetadataSync(input: {
  launchContext: PhysicPaintLaunchContext | null;
  workflowMode: 'play' | 'roto';
  settings: PhysicsPaintStudioSettings;
}): void {
  useEffect(() => {
    persistRotoBackgroundMetadata(input.launchContext, input.workflowMode, input.settings);
  }, [input.launchContext, input.settings, input.workflowMode]);
}
