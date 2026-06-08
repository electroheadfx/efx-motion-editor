import { beforeEach, describe, expect, it } from 'vitest';
import { clampPhysicPaintFrameCount } from '../types/physicPaint';
import { physicPaintStore, physicPaintVersion, _setPhysicPaintMarkDirtyCallback } from './physicPaintStore';

const makeFrame = (frameIndex: number, appFrame: number) => ({
  frameIndex,
  appFrame,
  dataUrl: `data:image/png;base64,${btoa(`frame-${frameIndex}`)}`,
  width: 1000,
  height: 650,
});

describe('physicPaintStore', () => {
  beforeEach(() => {
    _setPhysicPaintMarkDirtyCallback(() => {});
    physicPaintStore.reset();
  });

  it('stores a still apply payload at the start frame only', () => {
    const before = physicPaintVersion.value;
    const result = physicPaintStore.applyCanvas({
      kind: 'apply-canvas',
      operationId: 'op-still',
      layerId: 'layer-1',
      startFrame: 8,
      renderedFrame: makeFrame(0, 8),
    });

    expect(result.ok).toBe(true);
    expect(result.appliedFrameCount).toBe(1);
    expect(physicPaintStore.getFrame('layer-1', 8)?.dataUrl).toContain('data:image/png');
    expect(physicPaintStore.getFrame('layer-1', 9)).toBeNull();
    expect(physicPaintVersion.value).toBe(before + 1);
  });

  it('stores sequence frames starting at the app start frame', () => {
    const result = physicPaintStore.applySequence({
      kind: 'apply-play-canvas',
      operationId: 'op-seq',
      layerId: 'layer-1',
      startFrame: 10,
      frameCount: 3,
      frames: [makeFrame(0, 10), makeFrame(1, 11), makeFrame(2, 12)],
    });

    expect(result.ok).toBe(true);
    expect(physicPaintStore.getFrame('layer-1', 9)).toBeNull();
    expect(physicPaintStore.getFrame('layer-1', 10)?.frameIndex).toBe(0);
    expect(physicPaintStore.getFrame('layer-1', 11)?.frameIndex).toBe(1);
    expect(physicPaintStore.getFrame('layer-1', 12)?.frameIndex).toBe(2);
    expect(physicPaintStore.getFrame('layer-1', 13)).toBeNull();
  });

  it('increments version for each successful mutation and marks dirty', () => {
    let dirtyCount = 0;
    _setPhysicPaintMarkDirtyCallback(() => { dirtyCount += 1; });
    const before = physicPaintVersion.value;

    physicPaintStore.setFrame('layer-1', 1, makeFrame(0, 1));
    physicPaintStore.setFrame('layer-1', 2, makeFrame(0, 2));

    expect(physicPaintVersion.value).toBe(before + 2);
    expect(dirtyCount).toBe(2);
  });

  it('uses typed helpers to clamp invalid frame counts', () => {
    expect(clampPhysicPaintFrameCount(-10)).toBe(1);
    expect(clampPhysicPaintFrameCount(1000)).toBe(600);
    expect(clampPhysicPaintFrameCount(undefined)).toBe(120);
  });

  it('clears one layer and resets all output with version bumps', () => {
    physicPaintStore.setFrame('layer-1', 1, makeFrame(0, 1));
    physicPaintStore.setFrame('layer-2', 1, makeFrame(0, 1));
    const afterSet = physicPaintVersion.value;

    physicPaintStore.clearLayer('layer-1');
    expect(physicPaintStore.hasOutput('layer-1')).toBe(false);
    expect(physicPaintStore.hasOutput('layer-2')).toBe(true);
    expect(physicPaintVersion.value).toBe(afterSet + 1);

    physicPaintStore.reset();
    expect(physicPaintStore.hasOutput('layer-2')).toBe(false);
    expect(physicPaintVersion.value).toBe(afterSet + 2);
  });
});
