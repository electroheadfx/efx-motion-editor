import { describe, expect, it } from 'vitest';
import {
  PHYSIC_PAINT_DEFAULT_APPLY_FRAMES,
  PHYSIC_PAINT_MAX_APPLY_FRAMES,
  clampPhysicPaintFrameCount,
  isPhysicPaintApplyPayload,
  isPhysicPaintFrameSyncMessage,
  isPhysicPaintLaunchContext,
  normalizePhysicPaintPlayScriptRanges,
} from './physicPaint';

const renderedFrame = {
  frameIndex: 0,
  appFrame: 12,
  dataUrl: 'data:image/png;base64,aGVsbG8=',
  width: 1000,
  height: 650,
};

const editableState = {
  version: 2,
  width: 1000,
  height: 650,
  strokes: [],
  settings: {},
};

describe('physic paint payload contracts', () => {
  it('clamps apply frame counts to the UI range', () => {
    expect(clampPhysicPaintFrameCount(3.8)).toBe(3);
    expect(clampPhysicPaintFrameCount(0)).toBe(1);
    expect(clampPhysicPaintFrameCount(9999)).toBe(PHYSIC_PAINT_MAX_APPLY_FRAMES);
    expect(clampPhysicPaintFrameCount('bad')).toBe(PHYSIC_PAINT_DEFAULT_APPLY_FRAMES);
  });

  it('accepts launch contexts with positive finite project fps, Play workflow metadata, and range constraints', () => {
    expect(isPhysicPaintLaunchContext({ operationId: 'op-1', layerId: 'layer-1', startFrame: 4 })).toBe(true);
    expect(isPhysicPaintLaunchContext({ operationId: 'op-1', layerId: 'layer-1', startFrame: 4, fps: 24 })).toBe(true);
    expect(isPhysicPaintLaunchContext({ operationId: 'op-1', layerId: 'layer-1', startFrame: 4, fps: 30 })).toBe(true);
    expect(isPhysicPaintLaunchContext({ operationId: 'op-1', layerId: 'layer-1', startFrame: 4, fps: 60 })).toBe(true);
    expect(isPhysicPaintLaunchContext({ operationId: 'op-1', layerId: 'layer-1', startFrame: 4, workflowMode: 'play', playStartFrame: 12, playFrameCount: 5, editableSource: 'play' })).toBe(true);
    expect(isPhysicPaintLaunchContext({ operationId: 'op-1', layerId: 'layer-1', startFrame: 4, selectedPlayScriptId: 'play-a', playCacheStatus: 'cached', playMotion: { strokeDeformation: 20, strokePosition: 30 }, previewFrame: 2, maxPlayFrameCount: 12, maxPlayFrameCountReason: 'Gap before play-b' })).toBe(true);
    expect(isPhysicPaintLaunchContext({ operationId: 'op-1', layerId: 'layer-1', startFrame: 4, cachedPlayFrames: [renderedFrame] })).toBe(true);
    expect(isPhysicPaintLaunchContext({ operationId: 'op-1', layerId: 'layer-1', startFrame: -1 })).toBe(false);
    expect(isPhysicPaintLaunchContext({ operationId: 'op-1', layerId: 'layer-1', startFrame: 4, fps: 0 })).toBe(false);
    expect(isPhysicPaintLaunchContext({ operationId: 'op-1', layerId: 'layer-1', startFrame: 4, fps: -24 })).toBe(false);
    expect(isPhysicPaintLaunchContext({ operationId: 'op-1', layerId: 'layer-1', startFrame: 4, fps: Infinity })).toBe(false);
    expect(isPhysicPaintLaunchContext({ operationId: 'op-1', layerId: 'layer-1', startFrame: 4, fps: '24' })).toBe(false);
    expect(isPhysicPaintLaunchContext({ operationId: 'op-1', layerId: 'layer-1', startFrame: 4, workflowMode: 'preview' })).toBe(false);
    expect(isPhysicPaintLaunchContext({ operationId: 'op-1', layerId: 'layer-1', startFrame: 4, workflowMode: 'play', playStartFrame: -1 })).toBe(false);
    expect(isPhysicPaintLaunchContext({ operationId: 'op-1', layerId: 'layer-1', startFrame: 4, workflowMode: 'play', playFrameCount: 0 })).toBe(false);
    expect(isPhysicPaintLaunchContext({ operationId: 'op-1', layerId: 'layer-1', startFrame: 4, selectedPlayScriptId: '' })).toBe(false);
    expect(isPhysicPaintLaunchContext({ operationId: 'op-1', layerId: 'layer-1', startFrame: 4, playCacheStatus: 'dirty' })).toBe(false);
    expect(isPhysicPaintLaunchContext({ operationId: 'op-1', layerId: 'layer-1', startFrame: 4, playMotion: { strokeDeformation: 101, strokePosition: 0 } })).toBe(false);
    expect(isPhysicPaintLaunchContext({ operationId: 'op-1', layerId: 'layer-1', startFrame: 4, previewFrame: -1 })).toBe(false);
    expect(isPhysicPaintLaunchContext({ operationId: 'op-1', layerId: 'layer-1', startFrame: 4, previewFrame: 1.5 })).toBe(false);
    expect(isPhysicPaintLaunchContext({ operationId: 'op-1', layerId: 'layer-1', startFrame: 4, maxPlayFrameCount: 0 })).toBe(false);
    expect(isPhysicPaintLaunchContext({ operationId: 'op-1', layerId: 'layer-1', startFrame: 4, maxPlayFrameCount: PHYSIC_PAINT_MAX_APPLY_FRAMES + 1 })).toBe(false);
    expect(isPhysicPaintLaunchContext({ operationId: 'op-1', layerId: 'layer-1', startFrame: 4, maxPlayFrameCountReason: 12 })).toBe(false);
    expect(isPhysicPaintLaunchContext({ operationId: 'op-1', layerId: 'layer-1', startFrame: 4, cachedPlayFrames: [{ ...renderedFrame, dataUrl: 'bad' }] })).toBe(false);
  });

  it('normalizes sorted non-overlapping saved Play script ranges', () => {
    const ranges = normalizePhysicPaintPlayScriptRanges([
      { id: 'play-b', startFrame: 8, frameCount: 4, editableState, source: 'play', cacheStatus: 'cached', motion: { strokeDeformation: 15, strokePosition: 25 } },
      { id: 'play-a', startFrame: 0, frameCount: 5, editableState, source: 'play', cacheStatus: 'cached' },
    ]);

    expect(ranges).toEqual([
      { id: 'play-a', startFrame: 0, frameCount: 5, editableState, source: 'play', cacheStatus: 'cached' },
      { id: 'play-b', startFrame: 8, frameCount: 4, editableState, source: 'play', cacheStatus: 'cached', motion: { strokeDeformation: 15, strokePosition: 25 } },
    ]);
  });

  it('rejects malformed saved Play script ranges', () => {
    expect(normalizePhysicPaintPlayScriptRanges([{ id: '', startFrame: 0, frameCount: 5, editableState }])).toBeNull();
    expect(normalizePhysicPaintPlayScriptRanges([{ id: 'play-a', startFrame: -1, frameCount: 5, editableState }])).toBeNull();
    expect(normalizePhysicPaintPlayScriptRanges([{ id: 'play-a', startFrame: 0, frameCount: 0, editableState }])).toBeNull();
    expect(normalizePhysicPaintPlayScriptRanges([
      { id: 'play-a', startFrame: 0, frameCount: 5, editableState },
      { id: 'play-a', startFrame: 8, frameCount: 4, editableState },
    ])).toBeNull();
    expect(normalizePhysicPaintPlayScriptRanges([
      { id: 'play-a', startFrame: 4, frameCount: 4, editableState },
      { id: 'play-b', startFrame: 7, frameCount: 2, editableState },
    ])).toBeNull();
    expect(normalizePhysicPaintPlayScriptRanges([{ id: 'play-a', startFrame: 0, frameCount: 5, editableState: { version: 2, width: 100, height: 100, strokes: [{ tool: 'paint' }], settings: {} } }])).toBeNull();
    expect(normalizePhysicPaintPlayScriptRanges([{ id: 'play-a', startFrame: 0, frameCount: 5, editableState, motion: { strokeDeformation: -1, strokePosition: 0 } }])).toBeNull();
  });

  it('validates namespaced frame-sync messages', () => {
    expect(isPhysicPaintFrameSyncMessage({ type: 'physic-paint:seek-frame', frame: 0 })).toBe(true);
    expect(isPhysicPaintFrameSyncMessage({ type: 'physic-paint:seek-frame', frame: 12 })).toBe(true);
    expect(isPhysicPaintFrameSyncMessage({ type: 'physic-paint:seek-frame' })).toBe(false);
    expect(isPhysicPaintFrameSyncMessage({ type: 'other', frame: 12 })).toBe(false);
    expect(isPhysicPaintFrameSyncMessage({ type: 'physic-paint:seek-frame', frame: -1 })).toBe(false);
    expect(isPhysicPaintFrameSyncMessage({ type: 'physic-paint:seek-frame', frame: 1.5 })).toBe(false);
    expect(isPhysicPaintFrameSyncMessage({ type: 'physic-paint:seek-frame', frame: Infinity })).toBe(false);
    expect(isPhysicPaintFrameSyncMessage({ type: 'physic-paint:seek-frame', frame: '12' })).toBe(false);
  });

  it('accepts rendered-output still and sequence payloads', () => {
    expect(isPhysicPaintApplyPayload({
      kind: 'apply-canvas',
      operationId: 'op-1',
      layerId: 'layer-1',
      startFrame: 12,
      renderedFrame,
      editableState,
    })).toBe(true);

    expect(isPhysicPaintApplyPayload({
      kind: 'apply-play-canvas',
      operationId: 'op-2',
      layerId: 'layer-1',
      startFrame: 12,
      frameCount: 1,
      frames: [renderedFrame],
      editableState,
    })).toBe(true);

    expect(isPhysicPaintApplyPayload({
      kind: 'convert-play-to-roto',
      operationId: 'op-3',
      layerId: 'layer-1',
      startFrame: 12,
      frameCount: 1,
      frames: [renderedFrame],
      editableState,
    })).toBe(true);

    expect(isPhysicPaintApplyPayload({
      kind: 'convert-roto-to-play',
      operationId: 'op-4',
      layerId: 'layer-1',
      startFrame: 12,
      frameCount: 1,
      editableState,
    })).toBe(true);
  });

  it('rejects editable engine internals in apply payloads', () => {
    expect(isPhysicPaintApplyPayload({
      kind: 'apply-canvas',
      operationId: 'op-1',
      layerId: 'layer-1',
      startFrame: 12,
      renderedFrame,
      strokes: [],
    })).toBe(false);

    expect(isPhysicPaintApplyPayload({
      kind: 'apply-play-canvas',
      operationId: 'op-2',
      layerId: 'layer-1',
      startFrame: 12,
      frameCount: 1,
      frames: [renderedFrame],
      engine: {},
    })).toBe(false);
  });
});
