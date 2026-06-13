import { describe, expect, it } from 'vitest';
import {
  PHYSIC_PAINT_DEFAULT_APPLY_FRAMES,
  PHYSIC_PAINT_MAX_APPLY_FRAMES,
  clampPhysicPaintFrameCount,
  isPhysicPaintApplyPayload,
  isPhysicPaintFrameSyncMessage,
  isPhysicPaintLaunchContext,
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

  it('accepts launch contexts with positive finite project fps', () => {
    expect(isPhysicPaintLaunchContext({ operationId: 'op-1', layerId: 'layer-1', startFrame: 4 })).toBe(true);
    expect(isPhysicPaintLaunchContext({ operationId: 'op-1', layerId: 'layer-1', startFrame: 4, fps: 24 })).toBe(true);
    expect(isPhysicPaintLaunchContext({ operationId: 'op-1', layerId: 'layer-1', startFrame: 4, fps: 30 })).toBe(true);
    expect(isPhysicPaintLaunchContext({ operationId: 'op-1', layerId: 'layer-1', startFrame: 4, fps: 60 })).toBe(true);
    expect(isPhysicPaintLaunchContext({ operationId: 'op-1', layerId: 'layer-1', startFrame: -1 })).toBe(false);
    expect(isPhysicPaintLaunchContext({ operationId: 'op-1', layerId: 'layer-1', startFrame: 4, fps: 0 })).toBe(false);
    expect(isPhysicPaintLaunchContext({ operationId: 'op-1', layerId: 'layer-1', startFrame: 4, fps: -24 })).toBe(false);
    expect(isPhysicPaintLaunchContext({ operationId: 'op-1', layerId: 'layer-1', startFrame: 4, fps: Infinity })).toBe(false);
    expect(isPhysicPaintLaunchContext({ operationId: 'op-1', layerId: 'layer-1', startFrame: 4, fps: '24' })).toBe(false);
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
