import { describe, expect, it } from 'vitest';
import {
  PHYSIC_PAINT_DEFAULT_APPLY_FRAMES,
  PHYSIC_PAINT_MAX_APPLY_FRAMES,
  clampPhysicPaintFrameCount,
  isPhysicPaintApplyPayload,
  isPhysicPaintFrameSyncMessage,
  isPhysicPaintLaunchContext,
  isPhysicPaintRotoBackgroundMetadata,
  isPhysicPaintRotoCacheFrame,
  isPhysicPaintRotoInterpolationSettings,
  normalizePhysicPaintRotoSegmentSpacingOverrides,
} from './physicPaint';

const renderedFrame = { frameIndex: 0, appFrame: 12, dataUrl: 'data:image/png;base64,aGVsbG8=', width: 1000, height: 650 };

describe('physic paint payload contracts', () => {
  it('clamps generic apply frame counts to the established UI range', () => {
    expect(clampPhysicPaintFrameCount(3.8)).toBe(3);
    expect(clampPhysicPaintFrameCount(0)).toBe(1);
    expect(clampPhysicPaintFrameCount(9999)).toBe(PHYSIC_PAINT_MAX_APPLY_FRAMES);
    expect(clampPhysicPaintFrameCount('bad')).toBe(PHYSIC_PAINT_DEFAULT_APPLY_FRAMES);
  });

  it('accepts Roto launch context, project identity, cached keys, and background metadata', () => {
    expect(isPhysicPaintLaunchContext({ operationId: 'op-1', layerId: 'layer-1', startFrame: 4, fps: 24, project: { name: 'Project', saved: true, contextId: 'context-1' }, rotoBackground: { background: 'canvas2', paperGrain: 'canvas3', grainStrength: 0.65 } })).toBe(true);
    expect(isPhysicPaintLaunchContext({ operationId: 'op-1', layerId: 'layer-1', startFrame: 0, cachedRotoFrames: [{ frameIndex: 0, appFrame: 0, dataUrl: 'data:image/png;base64,a', source: 'real-key' }] })).toBe(true);
    expect(isPhysicPaintLaunchContext({ operationId: 'op-1', layerId: 'layer-1', startFrame: -1 })).toBe(false);
    expect(isPhysicPaintLaunchContext({ operationId: 'op-1', layerId: 'layer-1', startFrame: 4, fps: 0 })).toBe(false);
  });

  it('validates Roto interpolation settings and durable segment overrides', () => {
    expect(isPhysicPaintRotoInterpolationSettings({ enabled: true, inBetweenCount: 2, mode: 'blend', deform: 10, position: 20, segmentSpacingOverrides: [{ fromSourceFrame: 2, toSourceFrame: 6, inBetweenCount: 4 }] })).toBe(true);
    expect(isPhysicPaintRotoInterpolationSettings({ enabled: true, inBetweenCount: 0, mode: 'blend', deform: 10, position: 20 })).toBe(false);
    expect(normalizePhysicPaintRotoSegmentSpacingOverrides([
      { fromSourceFrame: 2, toSourceFrame: 6, inBetweenCount: 4 },
      { fromSourceFrame: 2, toSourceFrame: 6, inBetweenCount: 5 },
      { fromSourceFrame: 6, toSourceFrame: 2, inBetweenCount: 1 },
    ])).toEqual([{ fromSourceFrame: 2, toSourceFrame: 6, inBetweenCount: 4 }]);
  });

  it('validates Roto cache provenance and background metadata', () => {
    expect(isPhysicPaintRotoCacheFrame({ frameIndex: 0, appFrame: 4, dataUrl: 'data:image/png;base64,a', source: 'generated-interpolation', nearestRealKeyFrame: 2 })).toBe(true);
    expect(isPhysicPaintRotoCacheFrame({ frameIndex: 0, appFrame: 4, dataUrl: 'data:image/png;base64,a', source: 'background-only-support', backgroundOnly: true, nearestRealKeyFrame: 2 })).toBe(true);
    expect(isPhysicPaintRotoBackgroundMetadata({ background: 'transparent', paperGrain: 'canvas1', grainStrength: 0 })).toBe(true);
    expect(isPhysicPaintRotoBackgroundMetadata({ background: 'photo', paperGrain: 'canvas1', grainStrength: 0.5 })).toBe(false);
  });

  it('accepts still, interpolation, deletion, and authoritative real-key replacement payloads only', () => {
    expect(isPhysicPaintApplyPayload({ kind: 'apply-canvas', operationId: 'op-1', layerId: 'layer-1', startFrame: 12, renderedFrame, rotoBackground: { background: 'transparent', paperGrain: 'canvas1', grainStrength: 0 } })).toBe(true);
    expect(isPhysicPaintApplyPayload({ kind: 'update-roto-interpolation-settings', operationId: 'op-2', layerId: 'layer-1', startFrame: 12, settings: { enabled: true, inBetweenCount: 3, mode: 'duplicate', deform: 0, position: 0 } })).toBe(true);
    expect(isPhysicPaintApplyPayload({ kind: 'delete-roto-frame', operationId: 'op-3', layerId: 'layer-1', startFrame: 12 })).toBe(true);
    expect(isPhysicPaintApplyPayload({ kind: 'replace-roto-key-frames', operationId: 'op-4', layerId: 'layer-1', startFrame: 12, frames: [{ ...renderedFrame, source: 'real-key', sourceFrame: 12 }], rotoBackground: { background: 'canvas2', paperGrain: 'canvas3', grainStrength: 0.65 } })).toBe(true);
    expect(isPhysicPaintApplyPayload({ kind: 'apply-play-canvas', operationId: 'obsolete', layerId: 'layer-1', startFrame: 12, frames: [renderedFrame] })).toBe(false);
  });

  it('validates namespaced frame-sync messages', () => {
    expect(isPhysicPaintFrameSyncMessage({ type: 'physic-paint:seek-frame', frame: 12 })).toBe(true);
    expect(isPhysicPaintFrameSyncMessage({ type: 'physic-paint:seek-frame', frame: -1 })).toBe(false);
  });
});
