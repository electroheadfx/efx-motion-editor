import { describe, expect, it } from 'vitest';
import type { PhysicPaintLaunchContext, PhysicPaintPlayRenderOptionsSnapshot } from '../../types/physicPaint';
import { applyRenderedPlayCache, markPlayLaunchCacheStale, resolvePlayFrameCountUpdate, resolvePlayOptionsUpdate } from './playLifecycleTransactions';

const renderOptions: PhysicPaintPlayRenderOptionsSnapshot = {
  tool: 'normal-paint', color: '#000000', opacity: 1, brushSize: 12,
  background: 'transparent', paperGrain: 'none', grainStrength: 0,
  motion: { strokeDeformation: 10, strokePosition: 20 },
};

function context(overrides: Partial<PhysicPaintLaunchContext> = {}): PhysicPaintLaunchContext {
  return {
    operationId: 'operation', layerId: 'layer', width: 100, height: 100, startFrame: 7,
    workflowMode: 'play', editableSource: 'play', selectedPlayScriptId: 'script', playStartFrame: 3,
    playCacheStatus: 'cached', cachedPlayFrames: [],
    ...overrides,
  } as PhysicPaintLaunchContext;
}

describe('playLifecycleTransactions', () => {
  it('clamps frame counts and preserves the exact limit reason', () => {
    expect(resolvePlayFrameCountUpdate({ requestedFrameCount: 20, maxFrameCount: 8, maxFrameCountReason: 'Selected range ends here.' }))
      .toEqual({ frameCount: 8, limitMessage: 'Selected range ends here.' });
  });

  it('marks Play cache stale while removing Roto-only limits', () => {
    const next = markPlayLaunchCacheStale(context({ workflowMode: 'roto', maxPlayFrameCount: 4, maxPlayFrameCountReason: 'gap' }), { playFrameCount: 6 });
    expect(next).toMatchObject({ playFrameCount: 6, playCacheStatus: 'stale', cachedPlayFrames: [] });
    expect(next.maxPlayFrameCount).toBeUndefined();
    expect(next.maxPlayFrameCountReason).toBeUndefined();
  });

  it('keeps an equal options update cached and makes a changed update stale', () => {
    const equal = resolvePlayOptionsUpdate({ context: context({ playRenderOptions: renderOptions, playMotion: renderOptions.motion }), renderOptions });
    expect(equal.changed).toBe(false);
    expect(equal.context.playCacheStatus).toBe('cached');

    const changedOptions = { ...renderOptions, brushSize: 24 };
    const changed = resolvePlayOptionsUpdate({ context: context({ playRenderOptions: renderOptions }), renderOptions: changedOptions });
    expect(changed.changed).toBe(true);
    expect(changed.context).toMatchObject({ playCacheStatus: 'stale', cachedPlayFrames: [], playRenderOptions: changedOptions });
  });

  it('publishes rendered frames against the selected script start frame', () => {
    const frames = [{ frameIndex: 0, appFrame: 3, dataUrl: 'data:image/png;base64,x', width: 100, height: 100 }];
    const next = applyRenderedPlayCache({ context: context(), currentFrame: 7, frameCount: 1, frames, motion: renderOptions.motion, renderOptions });
    expect(next).toMatchObject({ startFrame: 3, playStartFrame: 3, playFrameCount: 1, playCacheStatus: 'cached', cachedPlayFrames: frames, previewFrame: 0 });
  });
});
