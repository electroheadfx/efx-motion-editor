import { beforeEach, describe, expect, it } from 'vitest';
import { clampPhysicPaintFrameCount } from '../types/physicPaint';
import { physicPaintStore, physicPaintVersion, _setPhysicPaintMarkDirtyCallback } from './physicPaintStore';

const editableState = {
  version: 2 as const,
  width: 1000,
  height: 650,
  strokes: [{
    tool: 'paint',
    pts: [[1, 2, 0.5, 0, 0, 0, 0] as [number, number, number, number, number, number, number]],
    color: '#103c65',
    params: { size: 6, opacity: 100, pressure: 70, waterAmount: 50, dryAmount: 30, edgeDetail: 4, pickup: 0, eraseStrength: 50, antiAlias: 0 },
    time: 123,
    diffusionFrames: 0,
  }],
  settings: { bgMode: 'canvas1', paperGrain: 'canvas1', embossStrength: 0.45, wetPaper: true },
};

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
      editableState,
    });

    expect(result.ok).toBe(true);
    expect(result.appliedFrameCount).toBe(1);
    expect(physicPaintStore.getFrame('layer-1', 8)?.dataUrl).toContain('data:image/png');
    expect(physicPaintStore.getFrame('layer-1', 9)).toBeNull();
    expect(physicPaintStore.getEditableState('layer-1')?.strokes).toHaveLength(1);
    expect(physicPaintVersion.value).toBe(before + 1);
  });

  it('stores sorted non-overlapping Play script ranges and finds only containing frames', () => {
    physicPaintStore.upsertPlayScriptRange('layer-1', { id: 'play-b', startFrame: 8, frameCount: 4, editableState, source: 'play', cacheStatus: 'cached' });
    physicPaintStore.upsertPlayScriptRange('layer-1', { id: 'play-a', startFrame: 0, frameCount: 5, editableState, source: 'play', cacheStatus: 'cached' });

    expect(physicPaintStore.getPlayScriptRanges('layer-1').map((range) => range.id)).toEqual(['play-a', 'play-b']);
    expect(physicPaintStore.findPlayScriptRangeAtFrame('layer-1', 8)?.id).toBe('play-b');
    expect(physicPaintStore.findPlayScriptRangeAtFrame('layer-1', 5)).toBeNull();
    expect(physicPaintStore.getMaxPlayFrameCountFromGap('layer-1', 5)).toBe(3);
    expect(physicPaintStore.getMaxPlayFrameCountFromGap('layer-1', 7)).toBe(1);
  });

  it('stores sequence frames starting at the app start frame with Play workflow metadata', () => {
    const result = physicPaintStore.applySequence({
      kind: 'apply-play-canvas',
      operationId: 'op-seq',
      layerId: 'layer-1',
      startFrame: 10,
      frameCount: 3,
      frames: [makeFrame(0, 10), makeFrame(1, 11), makeFrame(2, 12)],
      editableState,
    });

    expect(result.ok).toBe(true);
    expect(physicPaintStore.getFrame('layer-1', 9)).toBeNull();
    expect(physicPaintStore.getFrame('layer-1', 10)?.frameIndex).toBe(0);
    expect(physicPaintStore.getFrame('layer-1', 11)?.frameIndex).toBe(1);
    expect(physicPaintStore.getFrame('layer-1', 12)?.frameIndex).toBe(2);
    expect(physicPaintStore.getFrame('layer-1', 13)).toBeNull();
    expect(physicPaintStore.getWorkflowMetadata('layer-1')).toEqual({
      workflowMode: 'play',
      playStartFrame: 10,
      playFrameCount: 3,
      editableSource: 'play',
    });
  });

  it('converts play output into persisted roto frames', () => {
    const result = physicPaintStore.convertPlayToRoto({
      kind: 'convert-play-to-roto',
      operationId: 'op-convert-play',
      layerId: 'layer-1',
      startFrame: 10,
      frameCount: 2,
      frames: [makeFrame(0, 10), makeFrame(1, 11)],
      editableState,
    });

    expect(result).toMatchObject({ ok: true, kind: 'convert-play-to-roto', appliedFrameCount: 2 });
    expect(physicPaintStore.getFrame('layer-1', 10)?.frameIndex).toBe(0);
    expect(physicPaintStore.getFrame('layer-1', 11)?.frameIndex).toBe(1);
    expect(physicPaintStore.getEditableState('layer-1')?.strokes).toHaveLength(1);
    expect(physicPaintStore.getWorkflowMetadata('layer-1')).toEqual({ workflowMode: 'roto', editableSource: 'roto' });
  });

  it('converts roto frames into play source state by removing rendered frames', () => {
    physicPaintStore.setFrame('layer-1', 10, makeFrame(0, 10));
    physicPaintStore.setFrame('layer-1', 11, makeFrame(1, 11));
    physicPaintStore.setFrame('layer-1', 12, makeFrame(2, 12));

    const result = physicPaintStore.convertRotoToPlay({
      kind: 'convert-roto-to-play',
      operationId: 'op-convert-roto',
      layerId: 'layer-1',
      startFrame: 10,
      frameCount: 2,
      editableState,
    });

    expect(result).toMatchObject({ ok: true, kind: 'convert-roto-to-play', appliedFrameCount: 2 });
    expect(physicPaintStore.getFrame('layer-1', 10)).toBeNull();
    expect(physicPaintStore.getFrame('layer-1', 11)).toBeNull();
    expect(physicPaintStore.getFrame('layer-1', 12)?.frameIndex).toBe(2);
    expect(physicPaintStore.getEditableState('layer-1')?.strokes).toHaveLength(1);
    expect(physicPaintStore.getWorkflowMetadata('layer-1')).toEqual({
      workflowMode: 'play',
      playStartFrame: 10,
      playFrameCount: 2,
      editableSource: 'play',
    });
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

  it('serializes and hydrates rendered output by layer and app frame', () => {
    physicPaintStore.setFrame('layer-1', 12, makeFrame(0, 12));
    physicPaintStore.setFrame('layer-1', 10, makeFrame(0, 10));
    physicPaintStore.setFrame('layer-2', 4, makeFrame(0, 4));

    const outputs = physicPaintStore.toMceOutputs();

    expect(outputs).toEqual([
      { layer_id: 'layer-1', frames: [expect.objectContaining({ appFrame: 10 }), expect.objectContaining({ appFrame: 12 })] },
      { layer_id: 'layer-2', frames: [expect.objectContaining({ appFrame: 4 })] },
    ]);

    physicPaintStore.reset();
    physicPaintStore.loadFromMceOutputs(outputs);

    expect(physicPaintStore.getFrame('layer-1', 10)?.dataUrl).toContain('data:image/png');
    expect(physicPaintStore.getFrame('layer-1', 12)?.appFrame).toBe(12);
    expect(physicPaintStore.getFrame('layer-2', 4)?.width).toBe(1000);
  });

  it('rejects overlapping Play sequence applies without mutating the existing saved range', () => {
    physicPaintStore.applySequence({
      kind: 'apply-play-canvas',
      operationId: 'op-seq-a',
      layerId: 'layer-1',
      startFrame: 0,
      frameCount: 5,
      frames: [makeFrame(0, 0), makeFrame(1, 1), makeFrame(2, 2), makeFrame(3, 3), makeFrame(4, 4)],
      editableState,
    });

    const result = physicPaintStore.applySequence({
      kind: 'apply-play-canvas',
      operationId: 'op-seq-b',
      layerId: 'layer-1',
      startFrame: 4,
      frameCount: 5,
      frames: [makeFrame(0, 4), makeFrame(1, 5), makeFrame(2, 6), makeFrame(3, 7), makeFrame(4, 8)],
      editableState,
    });

    expect(result).toMatchObject({ ok: false, appliedFrameCount: 0 });
    expect(result.error).toContain('overlap');
    expect(physicPaintStore.getPlayScriptRanges('layer-1')).toHaveLength(1);
    expect(physicPaintStore.getFrame('layer-1', 8)).toBeNull();
  });

  it('round-trips multiple Play script ranges with rendered frames and per-range editable source state', () => {
    physicPaintStore.applySequence({
      kind: 'apply-play-canvas',
      operationId: 'op-seq-round-trip-a',
      layerId: 'layer-1',
      startFrame: 0,
      frameCount: 2,
      frames: [makeFrame(0, 0), makeFrame(1, 1)],
      editableState,
    });
    physicPaintStore.applySequence({
      kind: 'apply-play-canvas',
      operationId: 'op-seq-round-trip-b',
      layerId: 'layer-1',
      startFrame: 8,
      frameCount: 2,
      frames: [makeFrame(0, 8), makeFrame(1, 9)],
      editableState,
    });

    const outputs = physicPaintStore.toMceOutputs();
    expect(outputs[0]).toEqual(expect.objectContaining({
      play_script_ranges: [
        expect.objectContaining({ id: expect.any(String), startFrame: 0, frameCount: 2, editableState: expect.objectContaining({ strokes: expect.any(Array) }) }),
        expect.objectContaining({ id: expect.any(String), startFrame: 8, frameCount: 2, editableState: expect.objectContaining({ strokes: expect.any(Array) }) }),
      ],
    }));

    physicPaintStore.reset();
    physicPaintStore.loadFromMceOutputs(outputs);

    expect(physicPaintStore.getPlayScriptRanges('layer-1').map((range) => [range.startFrame, range.frameCount])).toEqual([[0, 2], [8, 2]]);
    expect(physicPaintStore.getFrame('layer-1', 9)?.frameIndex).toBe(1);
  });

  it('round-trips Play workflow metadata with rendered frames and editable source state', () => {
    physicPaintStore.applySequence({
      kind: 'apply-play-canvas',
      operationId: 'op-seq-round-trip',
      layerId: 'layer-1',
      startFrame: 24,
      frameCount: 4,
      frames: [makeFrame(0, 24), makeFrame(1, 25), makeFrame(2, 26), makeFrame(3, 27)],
      editableState,
    });

    const outputs = physicPaintStore.toMceOutputs();

    expect(outputs).toEqual([
      expect.objectContaining({
        layer_id: 'layer-1',
        workflow_mode: 'play',
        play_start_frame: 24,
        play_frame_count: 4,
        editable_source: 'play',
        editable_state: expect.objectContaining({ strokes: expect.any(Array) }),
        frames: [
          expect.objectContaining({ appFrame: 24 }),
          expect.objectContaining({ appFrame: 25 }),
          expect.objectContaining({ appFrame: 26 }),
          expect.objectContaining({ appFrame: 27 }),
        ],
      }),
    ]);

    physicPaintStore.reset();
    physicPaintStore.loadFromMceOutputs(outputs);

    expect(physicPaintStore.getFrame('layer-1', 27)?.frameIndex).toBe(3);
    expect(physicPaintStore.getEditableState('layer-1')?.strokes).toHaveLength(1);
    expect(physicPaintStore.getWorkflowMetadata('layer-1')).toEqual({
      workflowMode: 'play',
      playStartFrame: 24,
      playFrameCount: 4,
      editableSource: 'play',
    });
  });

  it('uses typed helpers to clamp invalid frame counts', () => {
    expect(clampPhysicPaintFrameCount(-10)).toBe(1);
    expect(clampPhysicPaintFrameCount(1000)).toBe(600);
    expect(clampPhysicPaintFrameCount(undefined)).toBe(4);
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
