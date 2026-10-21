import { useEffect } from 'preact/hooks';
import type { PhysicPaintLaunchContext } from '../../../types/physicPaint';
import { physicPaintStore } from '../../../stores/physicPaintStore';
import type { PhysicsPaintStudioSettings } from '../engine/physicsPaintStudioSettings';
import { buildRotoBackgroundMetadata } from '../engine/physicsPaintStudioSettings';

export function persistRotoBackgroundMetadata(
  launchContext: PhysicPaintLaunchContext | null,
  settings: PhysicsPaintStudioSettings,
  getActiveTrackId: (layerId: string) => string,
): void {
  if (!launchContext) return;
  // 46-01: background metadata is per-track; write the DOCUMENT's current
  // ACTIVE track — 47-01: the live document, not the launch snapshot (an
  // in-place track switch must target the track being edited).
  const trackId = getActiveTrackId(launchContext.layerId);
  const metadata = buildRotoBackgroundMetadata(settings);
  physicPaintStore.setRotoBackgroundMetadata(launchContext.layerId, trackId, metadata);
}

export function useRotoBackgroundMetadataSync(input: {
  launchContext: PhysicPaintLaunchContext | null;
  settings: PhysicsPaintStudioSettings;
  getActiveTrackId: (layerId: string) => string;
}): void {
  useEffect(() => {
    persistRotoBackgroundMetadata(input.launchContext, input.settings, input.getActiveTrackId);
  }, [input.launchContext, input.settings, input.getActiveTrackId]);
}
