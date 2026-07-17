import { describe, expect, it } from 'vitest';
import { selectPhysicsPaintMissingConditions, selectRotoPlaybackAvailable } from './physicsPaintStudioSelectors';

describe('physicsPaintStudioSelectors', () => {
  it('preserves readiness messages and cached Roto playback rule', () => {
    expect(selectPhysicsPaintMissingConditions({ engineReady: false, canvasMounted: false, hasLaunchContext: false, bridgeMode: 'Unavailable', applyStatus: 'idle', isPlaying: true, rotoPlaybackActive: false })).toEqual([
      'Engine is still initializing', 'Canvas is still mounting', 'No app layer context received', 'App bridge is not connected', 'Apply operation is still running',
    ]);
    expect(selectPhysicsPaintMissingConditions({ engineReady: true, canvasMounted: true, hasLaunchContext: true, bridgeMode: 'Browser fallback', applyStatus: 'idle', isPlaying: true, rotoPlaybackActive: true })).toEqual([]);
    expect(selectRotoPlaybackAvailable({ workflowMode: 'roto', hasLaunchContext: true, frames: [{ frame: null }, { frame: {} }] })).toBe(true);
    expect(selectRotoPlaybackAvailable({ workflowMode: 'roto', hasLaunchContext: true, frames: [{ frame: null }] })).toBe(false);
  });
});
