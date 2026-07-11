import { describe, expect, it, vi } from 'vitest';
import type { PhysicPaintLaunchContext } from '../../../types/physicPaint';
import { applyPhysicsPaintLaunchContext, getLaunchWorkflowMode, parsePhysicsPaintLaunchContext } from '../bridge/physicsPaintLaunchContext';

function makeLocation(search: string, hash = ''): Location {
  return { search, hash } as Location;
}

function makeContext(overrides: Partial<PhysicPaintLaunchContext> = {}): PhysicPaintLaunchContext {
  return { layerId: 'layer-1', operationId: 'op-1', startFrame: 4, workflowMode: 'roto', ...overrides };
}

describe('physicsPaintLaunchContext', () => {
  it('parses encoded and flat launch contexts while rejecting incomplete input', () => {
    const encoded = encodeURIComponent(JSON.stringify(makeContext({ workflowMode: 'play', previewFrame: 9 })));
    expect(parsePhysicsPaintLaunchContext(makeLocation(`?context=${encoded}`))).toMatchObject({ workflowMode: 'play', previewFrame: 9 });
    expect(parsePhysicsPaintLaunchContext(makeLocation('?layer=layer-2&op=op-2&frame=7&workflowMode=play&previewFrame=8'))).toMatchObject({
      layerId: 'layer-2', operationId: 'op-2', startFrame: 7, workflowMode: 'play', previewFrame: 8,
    });
    expect(parsePhysicsPaintLaunchContext(makeLocation('?layer=layer-2&frame=7'))).toBeNull();
  });

  it('applies the complete launch-derived state reset contract', () => {
    const setters = {
      setLaunchContext: vi.fn(), setFramesToApply: vi.fn(), setWorkflowMode: vi.fn(),
      setLocalPlayPreviewFrame: vi.fn(), setSavedPlayCacheDirty: vi.fn(), setPlayWiggle: vi.fn(), setSettings: vi.fn(),
    };
    const settings = { source: 'play-options' };
    const context = makeContext({ workflowMode: 'play', playFrameCount: 12, previewFrame: 6, playCacheStatus: 'stale', playMotion: { strokeDeformation: 3, strokePosition: 2 } });
    applyPhysicsPaintLaunchContext(context, setters, () => settings);
    expect(getLaunchWorkflowMode(context)).toBe('play');
    expect(setters.setLaunchContext).toHaveBeenCalledWith(context);
    expect(setters.setFramesToApply).toHaveBeenCalledWith(12);
    expect(setters.setWorkflowMode).toHaveBeenCalledWith('play');
    expect(setters.setLocalPlayPreviewFrame).toHaveBeenCalledWith(6);
    expect(setters.setSavedPlayCacheDirty).toHaveBeenCalledWith(true);
    expect(setters.setPlayWiggle).toHaveBeenCalledWith({ strokeDeformation: 3, strokePosition: 2 });
    expect(setters.setSettings).toHaveBeenCalledWith(settings);
  });
});
