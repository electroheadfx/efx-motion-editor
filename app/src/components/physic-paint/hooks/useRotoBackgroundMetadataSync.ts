import { useEffect } from 'preact/hooks';
import type { PhysicPaintLaunchContext } from '../../../types/physicPaint';
import { physicPaintStore } from '../../../stores/physicPaintStore';
import type { PhysicsPaintStudioSettings } from '../engine/physicsPaintStudioSettings';
import { buildRotoBackgroundMetadata } from '../engine/physicsPaintStudioSettings';

export function persistRotoBackgroundMetadata(
  launchContext: PhysicPaintLaunchContext | null,
  settings: PhysicsPaintStudioSettings,
): void {
  if (!launchContext) return;
  physicPaintStore.setRotoBackgroundMetadata(launchContext.layerId, buildRotoBackgroundMetadata(settings));
}

export function useRotoBackgroundMetadataSync(input: {
  launchContext: PhysicPaintLaunchContext | null;
  settings: PhysicsPaintStudioSettings;
}): void {
  useEffect(() => {
    persistRotoBackgroundMetadata(input.launchContext, input.settings);
  }, [input.launchContext, input.settings]);
}
