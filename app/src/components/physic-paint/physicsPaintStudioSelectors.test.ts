import { describe, expect, it } from 'vitest';
import { selectCurrentPlayCacheStatus, selectPhysicsPaintMissingConditions, selectPlayConversionMissingFrames, selectRotoPlaybackAvailable } from './physicsPaintStudioSelectors';

describe('physicsPaintStudioSelectors', () => {
  it('preserves readiness messages and playback apply rule', () => {
    expect(selectPhysicsPaintMissingConditions({ engineReady: false, canvasMounted: false, hasLaunchContext: false, bridgeMode: 'Unavailable', applyStatus: 'idle', isPlaying: true, rotoPlaybackActive: false })).toEqual([
      'Engine is still initializing',
      'Canvas is still mounting',
      'No app layer context received',
      'App bridge is not connected',
      'Apply operation is still running',
    ]);
    expect(selectPhysicsPaintMissingConditions({ engineReady: true, canvasMounted: true, hasLaunchContext: true, bridgeMode: 'Browser fallback', applyStatus: 'idle', isPlaying: true, rotoPlaybackActive: true })).toEqual([]);
  });

  it('selects conversion availability and current cache status', () => {
    expect(selectPlayConversionMissingFrames({ hasLaunchContext: true, currentFrame: 4, requestedFrameCount: 2, latestFrames: [{ appFrame: 4 }, { appFrame: 5 }] })).toBe(false);
    expect(selectPlayConversionMissingFrames({ hasLaunchContext: true, currentFrame: 4, requestedFrameCount: 2, latestFrames: [{ appFrame: 4 }] })).toBe(true);
    expect(selectCurrentPlayCacheStatus({ workflowMode: 'play', cacheDirty: true, hasCachedRange: true })).toBe('stale');
    expect(selectCurrentPlayCacheStatus({ workflowMode: 'play', cacheDirty: false, hasCachedRange: true })).toBe('cached');
    expect(selectCurrentPlayCacheStatus({ workflowMode: 'play', cacheDirty: false, hasCachedRange: false })).toBe('missing');
    expect(selectCurrentPlayCacheStatus({ workflowMode: 'roto', cacheDirty: false, hasCachedRange: true })).toBeNull();
  });

  it('requires a resolved cached frame for roto playback', () => {
    expect(selectRotoPlaybackAvailable({ workflowMode: 'roto', hasLaunchContext: true, frames: [{ frame: null }, { frame: {} }] })).toBe(true);
    expect(selectRotoPlaybackAvailable({ workflowMode: 'roto', hasLaunchContext: true, frames: [{ frame: null }] })).toBe(false);
  });
});
