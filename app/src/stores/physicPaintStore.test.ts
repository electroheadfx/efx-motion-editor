import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clampPhysicPaintFrameCount } from '../types/physicPaint';
import { resolveMissingRotoFrameDraw } from '../lib/rotoFrameDraw';
import { physicPaintStore, physicPaintVersion, _setPhysicPaintMarkDirtyCallback, registerRotoAlphaCanvasFrame, renderBlendedRotoInterpolationFrame } from './physicPaintStore';

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

const makeAlphaFrame = (frameIndex: number, appFrame: number, alphaSource: string) => ({
  ...makeFrame(frameIndex, appFrame),
  dataUrl: `data:image/png;base64,${btoa(alphaSource)}`,
  width: 2,
  height: 2,
});

const renderOptions = {
  tool: 'normal-paint' as const,
  color: '#103c65',
  opacity: 100,
  brushSize: 6,
  background: 'canvas1' as const,
  paperGrain: 'canvas1',
  grainStrength: 0.45,
  motion: { strokeDeformation: 10, strokePosition: 20 },
};

describe('physicPaintStore', () => {
  beforeEach(() => {
    _setPhysicPaintMarkDirtyCallback(() => {});
    physicPaintStore.reset();
  });

  it('defaults Roto interpolation mode to duplicate', () => {
    expect(physicPaintStore.getRotoInterpolationSettings('layer-1')).toEqual({ enabled: false, inBetweenCount: 1, mode: 'duplicate', position: 0, deform: 0 });

    physicPaintStore.setRotoInterpolationSettings('layer-1', { enabled: true, inBetweenCount: 1 });

    expect(physicPaintStore.getRotoInterpolationSettings('layer-1')).toEqual({ enabled: true, inBetweenCount: 1, mode: 'duplicate', position: 0, deform: 0 });
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

  it('stores explicit Roto background metadata from apply payloads for project reopen', () => {
    const result = physicPaintStore.applyCanvas({
      kind: 'apply-canvas',
      operationId: 'op-still-explicit-bg',
      layerId: 'layer-1',
      startFrame: 8,
      renderedFrame: makeFrame(0, 8),
      editableState: { ...editableState, settings: { ...editableState.settings, bgMode: 'transparent' } },
      rotoBackground: { background: 'canvas2', paperGrain: 'canvas3', grainStrength: 0.65 },
    });

    expect(result.ok).toBe(true);
    expect(physicPaintStore.getRotoBackgroundMetadata('layer-1')).toEqual({ background: 'canvas2', paperGrain: 'canvas3', grainStrength: 0.65 });
    expect(physicPaintStore.toMceOutputs()[0]).toEqual(expect.objectContaining({
      roto_background: { background: 'canvas2', paperGrain: 'canvas3', grainStrength: 0.65 },
    }));
  });

  it('recovers missing Roto background metadata from saved editable state on project reopen', () => {
    physicPaintStore.loadFromMceOutputs([{
      layer_id: 'layer-1',
      frames: [makeFrame(0, 8)],
      editable_state: editableState,
      roto_cache_metadata: [{ ...makeFrame(0, 8), source: 'real-key' }],
    }]);

    expect(physicPaintStore.getFrame('layer-1', 8)?.dataUrl).toContain('data:image/png');
    expect(physicPaintStore.getRotoBackgroundMetadata('layer-1')).toEqual({ background: 'canvas1', paperGrain: 'canvas1', grainStrength: 0.45 });
    expect(physicPaintStore.toMceOutputs()[0]).toEqual(expect.objectContaining({
      workflow_mode: 'roto',
      editable_source: 'roto',
      roto_background: { background: 'canvas1', paperGrain: 'canvas1', grainStrength: 0.45 },
    }));
  });

  it('marks no-stroke paper Roto applies as background-only cache frames', () => {
    const result = physicPaintStore.applyCanvas({
      kind: 'apply-canvas',
      operationId: 'op-background-only',
      layerId: 'layer-1',
      startFrame: 4,
      renderedFrame: makeFrame(0, 4),
      editableState: { ...editableState, strokes: [] },
      backgroundOnly: true,
    });

    expect(result.ok).toBe(true);
    expect(physicPaintStore.getFrame('layer-1', 4)?.dataUrl).toContain('data:image/png');
    expect(physicPaintStore.getRotoCacheFrames('layer-1')).toEqual([
      expect.objectContaining({ appFrame: 4, source: 'real-key', backgroundOnly: true }),
    ]);
  });

  it('uses saved Roto paper settings for interior and trailing missing frames', () => {
    physicPaintStore.applyCanvas({
      kind: 'apply-canvas',
      operationId: 'op-roto-1',
      layerId: 'layer-1',
      startFrame: 1,
      renderedFrame: makeFrame(0, 1),
      editableState,
    });
    physicPaintStore.applyCanvas({
      kind: 'apply-canvas',
      operationId: 'op-roto-3',
      layerId: 'layer-1',
      startFrame: 3,
      renderedFrame: makeFrame(0, 3),
      editableState,
    });

    const backgroundState = { mode: 'paper' as const, metadata: physicPaintStore.getRotoBackgroundMetadata('layer-1')! };

    expect(physicPaintStore.getRotoBackgroundMetadata('layer-1')).toEqual({ background: 'canvas1', paperGrain: 'canvas1', grainStrength: 0.45 });
    expect(resolveMissingRotoFrameDraw('layer-1', 2, { backgroundState, realKeyFrames: physicPaintStore.getRealRotoKeyFrames('layer-1') })).toEqual({ kind: 'background-only', color: '#f4efe3', paperTexture: 'canvas1', paperGrain: 'canvas1', grainStrength: 0.45, span: { kind: 'interior', previousRealKeyFrame: 1, nextRealKeyFrame: 3 }, materialize: true });
    expect(resolveMissingRotoFrameDraw('layer-1', 4, { backgroundState, realKeyFrames: physicPaintStore.getRealRotoKeyFrames('layer-1') })).toEqual({ kind: 'background-only', color: '#f4efe3', paperTexture: 'canvas1', paperGrain: 'canvas1', grainStrength: 0.45, span: { kind: 'trailing', previousRealKeyFrame: 3 }, materialize: false });
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

  it('removes a durable real Roto key through a delete payload', () => {
    physicPaintStore.applyCanvas({
      kind: 'apply-canvas',
      operationId: 'op-still',
      layerId: 'layer-1',
      startFrame: 8,
      renderedFrame: makeFrame(0, 8),
      editableState,
    });

    const result = physicPaintStore.deleteRotoFrame({
      kind: 'delete-roto-frame',
      operationId: 'op-delete-roto',
      layerId: 'layer-1',
      startFrame: 8,
    });

    expect(result).toMatchObject({ ok: true, kind: 'delete-roto-frame', appliedFrameCount: 0 });
    expect(physicPaintStore.getFrame('layer-1', 8)).toBeNull();
    expect(physicPaintStore.getRotoCacheFrames('layer-1')).toEqual([]);
    expect(physicPaintStore.toMceOutputs()[0]?.frames ?? []).toEqual([]);
  });

  it('does not treat Play output frames as real Roto keys', () => {
    physicPaintStore.applySequence({
      kind: 'apply-play-canvas',
      operationId: 'op-play-frames',
      layerId: 'layer-1',
      startFrame: 4,
      frameCount: 2,
      frames: [makeFrame(0, 4), makeFrame(1, 5)],
      editableState,
    });

    expect(physicPaintStore.getRealRotoKeyFrames('layer-1')).toEqual([]);
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
    expect(physicPaintStore.getPlayScriptRanges('layer-1')).toEqual([
      expect.objectContaining({ id: 'play-10-2', startFrame: 10, frameCount: 2, cacheStatus: 'stale' }),
    ]);
  });

  it('persists Play motion settings and replaces a selected script when duration changes', () => {
    physicPaintStore.applySequence({
      kind: 'apply-play-canvas',
      operationId: 'op-seq-original',
      layerId: 'layer-1',
      startFrame: 6,
      frameCount: 3,
      frames: [makeFrame(0, 6), makeFrame(1, 7), makeFrame(2, 8)],
      editableState,
      playMotion: { strokeDeformation: 10, strokePosition: 20 },
    });

    const originalId = physicPaintStore.getPlayScriptRanges('layer-1')[0].id;
    const result = physicPaintStore.applySequence({
      kind: 'apply-play-canvas',
      operationId: 'op-seq-resized',
      layerId: 'layer-1',
      startFrame: 6,
      frameCount: 4,
      frames: [makeFrame(0, 6), makeFrame(1, 7), makeFrame(2, 8), makeFrame(3, 9)],
      editableState,
      playScriptId: originalId,
      playMotion: { strokeDeformation: 30, strokePosition: 40 },
    });

    expect(result.ok).toBe(true);
    expect(physicPaintStore.getPlayScriptRanges('layer-1')).toEqual([
      expect.objectContaining({
        id: originalId,
        startFrame: 6,
        frameCount: 4,
        cacheStatus: 'cached',
        motion: { strokeDeformation: 30, strokePosition: 40 },
      }),
    ]);
    expect(physicPaintStore.getWorkflowMetadata('layer-1')).toEqual({
      workflowMode: 'play',
      playStartFrame: 6,
      playFrameCount: 4,
      editableSource: 'play',
      playMotion: { strokeDeformation: 30, strokePosition: 40 },
    });
  });

  it('updates one Play script render options and clears only its cached frames when changed', () => {
    physicPaintStore.applySequence({
      kind: 'apply-play-canvas',
      operationId: 'op-seq-a',
      layerId: 'layer-1',
      startFrame: 0,
      frameCount: 2,
      frames: [makeFrame(0, 0), makeFrame(1, 1)],
      editableState,
      playMotion: renderOptions.motion,
      renderOptions,
    });
    physicPaintStore.applySequence({
      kind: 'apply-play-canvas',
      operationId: 'op-seq-b',
      layerId: 'layer-1',
      startFrame: 8,
      frameCount: 2,
      frames: [makeFrame(0, 8), makeFrame(1, 9)],
      editableState,
      playMotion: renderOptions.motion,
      renderOptions,
    });
    const scriptId = physicPaintStore.getPlayScriptRanges('layer-1')[0].id;
    const before = physicPaintVersion.value;

    const result = physicPaintStore.updatePlayScriptRenderOptions('layer-1', scriptId, {
      ...renderOptions,
      tool: 'physics-paint',
      brushSize: 3,
      background: 'canvas3',
      motion: { strokeDeformation: 30, strokePosition: 40 },
    }, 'op-update-options');

    expect(result).toMatchObject({ ok: true, operationId: 'op-update-options', kind: 'update-play-render-options', appliedFrameCount: 2 });
    expect(physicPaintStore.getFrame('layer-1', 0)).toBeNull();
    expect(physicPaintStore.getFrame('layer-1', 1)).toBeNull();
    expect(physicPaintStore.getFrame('layer-1', 8)?.frameIndex).toBe(0);
    expect(physicPaintStore.getPlayScriptRanges('layer-1')[0]).toEqual(expect.objectContaining({
      id: scriptId,
      cacheStatus: 'stale',
      motion: { strokeDeformation: 30, strokePosition: 40 },
      renderOptions: expect.objectContaining({ tool: 'physics-paint', brushSize: 3, background: 'canvas3' }),
      editableState: expect.objectContaining({
        settings: editableState.settings,
        strokes: [expect.objectContaining({
          tool: 'paint',
          color: '#103c65',
          params: expect.objectContaining({ size: 6, opacity: 100 }),
        })],
      }),
    }));
    expect(physicPaintVersion.value).toBe(before + 1);
  });

  it('leaves cached Play frames and version unchanged when render options are identical', () => {
    physicPaintStore.applySequence({
      kind: 'apply-play-canvas',
      operationId: 'op-seq-identical',
      layerId: 'layer-1',
      startFrame: 4,
      frameCount: 2,
      frames: [makeFrame(0, 4), makeFrame(1, 5)],
      editableState,
      playMotion: renderOptions.motion,
      renderOptions,
    });
    const scriptId = physicPaintStore.getPlayScriptRanges('layer-1')[0].id;
    const before = physicPaintVersion.value;

    const result = physicPaintStore.updatePlayScriptRenderOptions('layer-1', scriptId, renderOptions, 'op-update-identical');

    expect(result).toMatchObject({ ok: true, operationId: 'op-update-identical', appliedFrameCount: 0 });
    expect(physicPaintStore.getFrame('layer-1', 4)?.frameIndex).toBe(0);
    expect(physicPaintStore.getFrame('layer-1', 5)?.frameIndex).toBe(1);
    expect(physicPaintStore.getPlayScriptRanges('layer-1')[0].cacheStatus).toBe('cached');
    expect(physicPaintVersion.value).toBe(before);
  });

  it('increments version for each successful mutation and marks dirty', () => {
    let dirtyCount = 0;
    _setPhysicPaintMarkDirtyCallback(() => { dirtyCount += 1; });
    const before = physicPaintVersion.value;

    physicPaintStore.setFrame('layer-1', 1, makeFrame(0, 1));
    physicPaintStore.setFrame('layer-1', 2, makeFrame(0, 2));
    physicPaintStore.setRotoBackgroundMetadata('layer-1', { background: 'canvas1', paperGrain: 'canvas1', grainStrength: 0.45 });

    expect(physicPaintVersion.value).toBe(before + 3);
    expect(dirtyCount).toBe(3);
  });

  it('tracks real Roto keys separately from generated cache and removes deleted real key output', () => {
    physicPaintStore.upsertRealRotoKeyFrame('layer-1', 2, makeFrame(0, 2));
    expect(physicPaintStore.getFrame('layer-1', 2)?.dataUrl).toContain('data:image/png');
    expect(physicPaintStore.getRealRotoKeyFrames('layer-1')).toEqual([2]);
    expect(physicPaintStore.getRotoCacheFrames('layer-1')).toEqual([
      expect.objectContaining({ appFrame: 2, source: 'real-key' }),
    ]);

    const beforeRemove = physicPaintVersion.value;
    expect(physicPaintStore.removeRealRotoKeyFrame('layer-1', 2)).toBe(true);
    expect(physicPaintStore.getFrame('layer-1', 2)).toBeNull();
    expect(physicPaintStore.getRealRotoKeyFrames('layer-1')).toEqual([]);
    expect(physicPaintVersion.value).toBe(beforeRemove + 1);
  });

  it('does not move source real keys when interpolation count changes', () => {
    const circle = makeFrame(0, 0);
    const square = makeFrame(1, 1);
    physicPaintStore.upsertRealRotoKeyFrame('layer-1', 0, circle);
    physicPaintStore.upsertRealRotoKeyFrame('layer-1', 1, square);

    physicPaintStore.setRotoInterpolationSettings('layer-1', { enabled: true, inBetweenCount: 1, mode: 'duplicate', deform: 0, position: 0 });
    expect(physicPaintStore.getRealRotoKeyFrames('layer-1')).toEqual([0, 1]);
    expect(physicPaintStore.getFrame('layer-1', 0)?.dataUrl).toBe(circle.dataUrl);
    expect(physicPaintStore.getFrame('layer-1', 1)?.dataUrl).toBe(square.dataUrl);
    expect(physicPaintStore.getRotoCacheFrames('layer-1')).toEqual([
      expect.objectContaining({ appFrame: 0, source: 'real-key', sourceFrame: 0, displayFrame: 0 }),
      expect.objectContaining({ appFrame: 1, source: 'generated-interpolation', nearestRealKeyFrame: 0, fromSourceFrame: 0, toSourceFrame: 1 }),
      expect.objectContaining({ appFrame: 2, source: 'real-key', sourceFrame: 1, displayFrame: 2 }),
    ]);
    expect(physicPaintStore.getRotoFrame('layer-1', 1)).toEqual(expect.objectContaining({ appFrame: 1, source: 'generated-interpolation' }));
    expect(physicPaintStore.getRotoFrame('layer-1', 2)).toEqual(expect.objectContaining({ appFrame: 2, source: 'real-key', sourceFrame: 1 }));

    physicPaintStore.setRotoInterpolationSettings('layer-1', { enabled: true, inBetweenCount: 2, mode: 'blend', deform: 0, position: 0 });
    expect(physicPaintStore.getRealRotoKeyFrames('layer-1')).toEqual([0, 1]);
    expect(physicPaintStore.getRotoCacheFrames('layer-1').filter(frame => frame.source === 'generated-interpolation').map(frame => frame.appFrame)).toEqual([1, 2]);

    physicPaintStore.setRotoInterpolationSettings('layer-1', { enabled: false });
    expect(physicPaintStore.getRotoCacheFrames('layer-1')).toEqual([
      expect.objectContaining({ appFrame: 0, source: 'real-key' }),
      expect.objectContaining({ appFrame: 1, source: 'real-key' }),
    ]);
  });

  it('duplicates each source key across expanded display frames and deletes shifted display keys by source frame', () => {
    const circle = makeAlphaFrame(0, 0, 'circle');
    const square = makeAlphaFrame(0, 1, 'square');
    const crossed = makeAlphaFrame(0, 2, 'crossed-lines');
    physicPaintStore.upsertRealRotoKeyFrame('layer-1', 0, circle);
    physicPaintStore.upsertRealRotoKeyFrame('layer-1', 1, square);
    physicPaintStore.upsertRealRotoKeyFrame('layer-1', 2, crossed);

    physicPaintStore.setRotoInterpolationSettings('layer-1', { enabled: true, inBetweenCount: 3, mode: 'duplicate', deform: 0, position: 0 });

    expect(physicPaintStore.getRealRotoKeyFrames('layer-1')).toEqual([0, 1, 2]);
    expect(physicPaintStore.getFrame('layer-1', 1)?.dataUrl).toBe(square.dataUrl);
    expect(physicPaintStore.getFrame('layer-1', 2)?.dataUrl).toBe(crossed.dataUrl);
    expect(physicPaintStore.getRotoCacheFrames('layer-1')).toEqual([
      expect.objectContaining({ appFrame: 0, source: 'real-key', sourceFrame: 0, displayFrame: 0, dataUrl: circle.dataUrl }),
      expect.objectContaining({ appFrame: 1, source: 'generated-interpolation', fromSourceFrame: 0, toSourceFrame: 1, dataUrl: circle.dataUrl }),
      expect.objectContaining({ appFrame: 2, source: 'generated-interpolation', fromSourceFrame: 0, toSourceFrame: 1, dataUrl: circle.dataUrl }),
      expect.objectContaining({ appFrame: 3, source: 'generated-interpolation', fromSourceFrame: 0, toSourceFrame: 1, dataUrl: circle.dataUrl }),
      expect.objectContaining({ appFrame: 4, source: 'real-key', sourceFrame: 1, displayFrame: 4, dataUrl: square.dataUrl }),
      expect.objectContaining({ appFrame: 5, source: 'generated-interpolation', fromSourceFrame: 1, toSourceFrame: 2, dataUrl: square.dataUrl }),
      expect.objectContaining({ appFrame: 6, source: 'generated-interpolation', fromSourceFrame: 1, toSourceFrame: 2, dataUrl: square.dataUrl }),
      expect.objectContaining({ appFrame: 7, source: 'generated-interpolation', fromSourceFrame: 1, toSourceFrame: 2, dataUrl: square.dataUrl }),
      expect.objectContaining({ appFrame: 8, source: 'real-key', sourceFrame: 2, displayFrame: 8, dataUrl: crossed.dataUrl }),
      expect.objectContaining({ appFrame: 9, source: 'generated-interpolation', fromSourceFrame: 2, dataUrl: crossed.dataUrl }),
      expect.objectContaining({ appFrame: 10, source: 'generated-interpolation', fromSourceFrame: 2, dataUrl: crossed.dataUrl }),
      expect.objectContaining({ appFrame: 11, source: 'generated-interpolation', fromSourceFrame: 2, dataUrl: crossed.dataUrl }),
    ]);
    expect(physicPaintStore.getRotoFrame('layer-1', 1)?.dataUrl).toBe(circle.dataUrl);
    expect(physicPaintStore.getRotoFrame('layer-1', 4)?.dataUrl).toBe(square.dataUrl);
    expect(physicPaintStore.getRotoFrame('layer-1', 8)?.dataUrl).toBe(crossed.dataUrl);
    expect(physicPaintStore.getRotoFrame('layer-1', 11)?.dataUrl).toBe(crossed.dataUrl);

    expect(physicPaintStore.deleteRotoFrame({ kind: 'delete-roto-frame', operationId: 'op-delete-crossed', layerId: 'layer-1', startFrame: 8, sourceFrame: 2 }).ok).toBe(true);

    expect(physicPaintStore.getRealRotoKeyFrames('layer-1')).toEqual([0, 1]);
    expect(physicPaintStore.getRotoCacheFrames('layer-1')).toEqual([
      expect.objectContaining({ appFrame: 0, source: 'real-key', sourceFrame: 0 }),
      expect.objectContaining({ appFrame: 1, source: 'generated-interpolation', fromSourceFrame: 0, toSourceFrame: 1, dataUrl: circle.dataUrl }),
      expect.objectContaining({ appFrame: 2, source: 'generated-interpolation', fromSourceFrame: 0, toSourceFrame: 1, dataUrl: circle.dataUrl }),
      expect.objectContaining({ appFrame: 3, source: 'generated-interpolation', fromSourceFrame: 0, toSourceFrame: 1, dataUrl: circle.dataUrl }),
      expect.objectContaining({ appFrame: 4, source: 'real-key', sourceFrame: 1, dataUrl: square.dataUrl }),
    ]);
    expect(physicPaintStore.getRotoFrame('layer-1', 8)).toBeNull();
  });

  it('replaces generated Roto cache through existing rendered frame storage', () => {
    physicPaintStore.upsertRealRotoKeyFrame('layer-1', 0, makeFrame(0, 0));
    physicPaintStore.replaceGeneratedRotoCache('layer-1', [
      { ...makeFrame(0, 1), source: 'generated-interpolation', nearestRealKeyFrame: 0 },
      { ...makeFrame(1, 2), source: 'generated-interpolation', nearestRealKeyFrame: 3 },
    ], { enabled: true, inBetweenCount: 2, mode: 'blend', deform: 10, position: 20 });

    expect(physicPaintStore.getRotoFrame('layer-1', 1)?.dataUrl).toContain('data:image/png');
    expect(physicPaintStore.getRotoCacheFrames('layer-1')).toEqual([
      expect.objectContaining({ appFrame: 0, source: 'real-key' }),
      expect.objectContaining({ appFrame: 1, source: 'generated-interpolation', nearestRealKeyFrame: 0 }),
      expect.objectContaining({ appFrame: 2, source: 'generated-interpolation', nearestRealKeyFrame: 3 }),
    ]);
    expect(physicPaintStore.getRotoInterpolationSettings('layer-1')).toEqual({ enabled: true, inBetweenCount: 2, mode: 'blend', deform: 10, position: 20 });

    physicPaintStore.replaceGeneratedRotoCache('layer-1', [
      { ...makeFrame(0, 4), source: 'generated-interpolation', nearestRealKeyFrame: 3 },
    ], { enabled: true, inBetweenCount: 1, mode: 'duplicate', deform: 0, position: 0 });
    expect(physicPaintStore.getFrame('layer-1', 1)).toBeNull();
    expect(physicPaintStore.getFrame('layer-1', 2)).toBeNull();
    expect(physicPaintStore.getRotoFrame('layer-1', 4)?.dataUrl).toContain('data:image/png');
  });

  it('round-trips Roto source metadata and interpolation settings without editable per-frame state', () => {
    physicPaintStore.upsertRealRotoKeyFrame('layer-1', 0, makeFrame(0, 0));
    physicPaintStore.setRotoBackgroundMetadata('layer-1', { background: 'canvas2', paperGrain: 'canvas3', grainStrength: 0.65 });
    physicPaintStore.replaceGeneratedRotoCache('layer-1', [
      { ...makeFrame(0, 1), source: 'generated-interpolation', nearestRealKeyFrame: 0 },
    ], { enabled: true, inBetweenCount: 1, mode: 'duplicate', deform: 5, position: 15 });

    const outputs = physicPaintStore.toMceOutputs();
    expect(outputs[0]).toEqual(expect.objectContaining({
      roto_cache_metadata: [
        expect.objectContaining({ appFrame: 0, source: 'real-key' }),
        expect.objectContaining({ appFrame: 1, source: 'generated-interpolation', nearestRealKeyFrame: 0 }),
      ],
      roto_interpolation_settings: { enabled: true, inBetweenCount: 1, mode: 'duplicate', deform: 5, position: 15 },
      roto_background: { background: 'canvas2', paperGrain: 'canvas3', grainStrength: 0.65 },
    }));
    expect(JSON.stringify(outputs)).not.toContain('editableStatesByFrame');

    physicPaintStore.reset();
    physicPaintStore.loadFromMceOutputs(outputs);

    expect(physicPaintStore.getRealRotoKeyFrames('layer-1')).toEqual([0]);
    expect(physicPaintStore.getRotoCacheFrames('layer-1')).toEqual([
      expect.objectContaining({ appFrame: 0, source: 'real-key' }),
      expect.objectContaining({ appFrame: 1, source: 'generated-interpolation', nearestRealKeyFrame: 0 }),
    ]);
    expect(physicPaintStore.getRotoBackgroundMetadata('layer-1')).toEqual({ background: 'canvas2', paperGrain: 'canvas3', grainStrength: 0.65 });
  });

  it('regenerates generated Roto frames on project load from source real keys and saved settings', () => {
    const realOne = makeAlphaFrame(0, 1, 'saved-real-one');
    const realFour = makeAlphaFrame(0, 4, 'saved-real-four');

    physicPaintStore.loadFromMceOutputs([{
      layer_id: 'layer-1',
      frames: [realOne, realFour],
      workflow_mode: 'roto',
      editable_source: 'roto',
      roto_cache_metadata: [
        { ...realOne, source: 'real-key' },
        { ...realFour, source: 'real-key' },
      ],
      roto_interpolation_settings: { enabled: true, inBetweenCount: 2, mode: 'blend', deform: 35, position: 45 },
    }]);

    expect(physicPaintStore.getRotoInterpolationSettings('layer-1')).toEqual({ enabled: true, inBetweenCount: 2, mode: 'blend', deform: 35, position: 45 });
    expect(physicPaintStore.getRealRotoKeyFrames('layer-1')).toEqual([1, 4]);
    expect(physicPaintStore.getFrame('layer-1', 1)?.dataUrl).toBe(realOne.dataUrl);
    expect(physicPaintStore.getFrame('layer-1', 4)?.dataUrl).toBe(realFour.dataUrl);
    expect(physicPaintStore.getRotoCacheFrames('layer-1')).toEqual([
      expect.objectContaining({ appFrame: 1, source: 'real-key' }),
      expect.objectContaining({ appFrame: 2, source: 'generated-interpolation', nearestRealKeyFrame: 1, fromSourceFrame: 1, toSourceFrame: 4, interpolationT: 1 / 3 }),
      expect.objectContaining({ appFrame: 3, source: 'generated-interpolation', nearestRealKeyFrame: 1, fromSourceFrame: 1, toSourceFrame: 4, interpolationT: 2 / 3 }),
      expect.objectContaining({ appFrame: 4, source: 'real-key' }),
    ]);
  });

  it('regenerates duplicate Roto in-betweens after project reopen from persisted real keys and settings', () => {
    const realCircle = makeFrame(0, 0);
    const realSquare = makeFrame(0, 1);
    const realCross = makeFrame(0, 2);

    physicPaintStore.loadFromMceOutputs([{
      layer_id: 'layer-1',
      frames: [realCircle, realSquare, realCross],
      workflow_mode: 'roto',
      editable_source: 'roto',
      roto_cache_metadata: [
        { ...realCircle, source: 'real-key' },
        { ...realSquare, source: 'real-key' },
        { ...realCross, source: 'real-key' },
      ],
      roto_interpolation_settings: { enabled: true, inBetweenCount: 3, mode: 'duplicate', deform: 0, position: 0 },
    }]);

    expect(physicPaintStore.getRotoInterpolationSettings('layer-1')).toEqual({ enabled: true, inBetweenCount: 3, mode: 'duplicate', deform: 0, position: 0 });
    expect(physicPaintStore.getRealRotoKeyFrames('layer-1')).toEqual([0, 1, 2]);
    expect(physicPaintStore.getRotoFrame('layer-1', 0)).toEqual(expect.objectContaining({ appFrame: 0, source: 'real-key', dataUrl: realCircle.dataUrl }));
    expect(physicPaintStore.getRotoFrame('layer-1', 1)).toEqual(expect.objectContaining({ appFrame: 1, source: 'generated-interpolation', dataUrl: realCircle.dataUrl }));
    expect(physicPaintStore.getRotoFrame('layer-1', 4)).toEqual(expect.objectContaining({ appFrame: 4, source: 'real-key', dataUrl: realSquare.dataUrl }));
    expect(physicPaintStore.getRotoFrame('layer-1', 11)).toEqual(expect.objectContaining({ appFrame: 11, source: 'generated-interpolation', dataUrl: realCross.dataUrl }));
  });

  it('keeps interpolation disabled after project load and does not regenerate generated Roto frames', () => {
    const realOne = makeAlphaFrame(0, 1, 'disabled-real-one');
    const realFour = makeAlphaFrame(0, 4, 'disabled-real-four');

    physicPaintStore.loadFromMceOutputs([{
      layer_id: 'layer-1',
      frames: [realOne, realFour],
      workflow_mode: 'roto',
      editable_source: 'roto',
      roto_cache_metadata: [
        { ...realOne, source: 'real-key' },
        { ...realFour, source: 'real-key' },
      ],
      roto_interpolation_settings: { enabled: false, inBetweenCount: 2, mode: 'blend', deform: 35, position: 45 },
    }]);

    expect(physicPaintStore.getRotoInterpolationSettings('layer-1')).toEqual({ enabled: false, inBetweenCount: 2, mode: 'blend', deform: 35, position: 45 });
    expect(physicPaintStore.getRealRotoKeyFrames('layer-1')).toEqual([1, 4]);
    expect(physicPaintStore.getRotoCacheFrames('layer-1')).toEqual([
      expect.objectContaining({ appFrame: 1, source: 'real-key' }),
      expect.objectContaining({ appFrame: 4, source: 'real-key' }),
    ]);
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

  it('preserves real Roto keys while toggling interpolation generated frames on and off', () => {
    physicPaintStore.upsertRealRotoKeyFrame('layer-1', 1, makeAlphaFrame(0, 1, 'alpha-real-one'));
    physicPaintStore.upsertRealRotoKeyFrame('layer-1', 4, makeAlphaFrame(0, 4, 'alpha-real-four'));

    physicPaintStore.setRotoInterpolationSettings('layer-1', { enabled: true, inBetweenCount: 2, mode: 'blend', position: 0, deform: 0 });

    expect(physicPaintStore.getRealRotoKeyFrames('layer-1')).toEqual([1, 4]);
    expect(physicPaintStore.getRotoCacheFrames('layer-1')).toEqual([
      expect.objectContaining({ appFrame: 1, source: 'real-key' }),
      expect.objectContaining({ appFrame: 2, source: 'generated-interpolation', nearestRealKeyFrame: 1 }),
      expect.objectContaining({ appFrame: 3, source: 'generated-interpolation', nearestRealKeyFrame: 1 }),
      expect.objectContaining({ appFrame: 4, source: 'real-key' }),
    ]);

    physicPaintStore.setRotoInterpolationSettings('layer-1', { enabled: false });

    expect(physicPaintStore.getRealRotoKeyFrames('layer-1')).toEqual([1, 4]);
    expect(physicPaintStore.getRotoCacheFrames('layer-1')).toEqual([
      expect.objectContaining({ appFrame: 1, source: 'real-key' }),
      expect.objectContaining({ appFrame: 4, source: 'real-key' }),
    ]);
    expect(physicPaintStore.toMceOutputs()[0]).toEqual(expect.objectContaining({
      roto_interpolation_settings: expect.objectContaining({ enabled: false }),
    }));
  });

  it('writes generated interpolation cache with source-neighbor provenance without moving real keys', () => {
    const realOne = makeAlphaFrame(0, 1, 'alpha-real-one');
    const realFour = makeAlphaFrame(0, 4, 'alpha-real-four');
    physicPaintStore.upsertRealRotoKeyFrame('layer-1', 1, realOne);
    physicPaintStore.upsertRealRotoKeyFrame('layer-1', 4, realFour);

    physicPaintStore.setRotoInterpolationSettings('layer-1', { enabled: true, inBetweenCount: 2, mode: 'blend', position: 0, deform: 0 });

    expect(physicPaintStore.getFrame('layer-1', 1)?.dataUrl).toBe(realOne.dataUrl);
    expect(physicPaintStore.getFrame('layer-1', 4)?.dataUrl).toBe(realFour.dataUrl);
    expect(physicPaintStore.getRotoCacheFrames('layer-1')).toEqual([
      expect.objectContaining({ appFrame: 1, source: 'real-key' }),
      expect.objectContaining({ appFrame: 2, source: 'generated-interpolation', nearestRealKeyFrame: 1, fromSourceFrame: 1, toSourceFrame: 4, interpolationT: 1 / 3 }),
      expect.objectContaining({ appFrame: 3, source: 'generated-interpolation', nearestRealKeyFrame: 1, fromSourceFrame: 1, toSourceFrame: 4, interpolationT: 2 / 3 }),
      expect.objectContaining({ appFrame: 4, source: 'real-key' }),
    ]);
  });

  it('generates alpha-only Roto interpolation cache across whole integer spans with real-key authority', () => {
    physicPaintStore.upsertRealRotoKeyFrame('layer-1', 1, makeAlphaFrame(0, 1, 'alpha-real-one'));
    physicPaintStore.upsertRealRotoKeyFrame('layer-1', 4, makeAlphaFrame(0, 4, 'alpha-real-four'));
    physicPaintStore.setRotoBackgroundMetadata('layer-1', { background: 'canvas1', paperGrain: 'canvas1', grainStrength: 0.45 });
    physicPaintStore.recomputeBackgroundOnlyRotoSupport('layer-1', [2, 3]);
    const before = physicPaintVersion.value;

    const generated = physicPaintStore.setRotoInterpolationSettings('layer-1', {
      enabled: true,
      inBetweenCount: 1,
      mode: 'blend',
      position: 25,
      deform: 50,
    });

    expect(generated.map(frame => frame.appFrame)).toEqual([2]);
    expect(generated.every(frame => frame.dataUrl.startsWith('data:image/png;base64,'))).toBe(true);
    expect(JSON.stringify(generated)).not.toContain('alpha-blend:');
    expect(JSON.stringify(generated)).not.toContain('background-only-support');
    expect(physicPaintStore.getRealRotoKeyFrames('layer-1')).toEqual([1, 4]);
    expect(physicPaintStore.getRotoCacheFrames('layer-1')).toEqual([
      expect.objectContaining({ appFrame: 1, source: 'real-key', sourceFrame: 1 }),
      expect.objectContaining({ appFrame: 2, source: 'generated-interpolation', nearestRealKeyFrame: 1 }),
      expect.objectContaining({ appFrame: 3, source: 'real-key', sourceFrame: 4, displayFrame: 3 }),
    ]);
    expect(physicPaintStore.getBackgroundOnlyRotoSupportFrames('layer-1')).toEqual([]);
    expect(physicPaintVersion.value).toBeGreaterThan(before);

    physicPaintStore.upsertRealRotoKeyFrame('layer-1', 2, makeAlphaFrame(0, 2, 'alpha-real-two'));
    expect(physicPaintStore.getRotoCacheFrames('layer-1')).toEqual([
      expect.objectContaining({ appFrame: 1, source: 'real-key', sourceFrame: 1 }),
      expect.objectContaining({ appFrame: 2, source: 'generated-interpolation', nearestRealKeyFrame: 1 }),
      expect.objectContaining({ appFrame: 3, source: 'real-key', sourceFrame: 2, displayFrame: 3 }),
      expect.objectContaining({ appFrame: 4, source: 'generated-interpolation', nearestRealKeyFrame: 2 }),
      expect.objectContaining({ appFrame: 5, source: 'real-key', sourceFrame: 4, displayFrame: 5 }),
      expect.objectContaining({ appFrame: 6, source: 'generated-interpolation', nearestRealKeyFrame: 4 }),
    ]);
    expect(physicPaintStore.getFrame('layer-1', 2)?.dataUrl).toBe(makeAlphaFrame(0, 2, 'alpha-real-two').dataUrl);
  });

  it('normalizes visible hold and alpha-blend modes to the selected generated render branch', () => {
    const previous = makeAlphaFrame(0, 1, 'alpha-previous');
    const next = makeAlphaFrame(0, 4, 'alpha-next');
    physicPaintStore.upsertRealRotoKeyFrame('layer-1', 1, previous);
    physicPaintStore.upsertRealRotoKeyFrame('layer-1', 4, next);

    physicPaintStore.setRotoInterpolationSettings('layer-1', { enabled: true, inBetweenCount: 1, mode: 'hold' as never, position: 0, deform: 0 });
    expect(physicPaintStore.getRotoInterpolationSettings('layer-1')).toEqual({ enabled: true, inBetweenCount: 1, mode: 'duplicate', position: 0, deform: 0 });
    expect(physicPaintStore.getRotoFrame('layer-1', 2)?.dataUrl).toBe(previous.dataUrl);

    physicPaintStore.setRotoInterpolationSettings('layer-1', { enabled: true, inBetweenCount: 1, mode: 'alpha-blend' as never, position: 0, deform: 0 });
    expect(physicPaintStore.getRotoInterpolationSettings('layer-1')).toEqual({ enabled: true, inBetweenCount: 1, mode: 'blend', position: 0, deform: 0 });
    expect(physicPaintStore.getRotoFrame('layer-1', 2)?.dataUrl).not.toBe(previous.dataUrl);
    expect(physicPaintStore.getRotoCacheFrames('layer-1')).toContainEqual(expect.objectContaining({ appFrame: 2, source: 'generated-interpolation', fromSourceFrame: 1, toSourceFrame: 4, interpolationT: 0.5 }));
  });

  it('renders blend interpolation as generated PNG data derived from both neighboring alpha sources', () => {
    const settings = { enabled: true, inBetweenCount: 1, mode: 'blend' as const, position: 33, deform: 44 };
    const first = makeAlphaFrame(0, 1, 'alpha-first');
    const second = makeAlphaFrame(0, 3, 'alpha-second');

    const blend = renderBlendedRotoInterpolationFrame(first, second, 2, 0.5, settings);
    const changedFirst = renderBlendedRotoInterpolationFrame(makeAlphaFrame(0, 1, 'alpha-first-changed'), second, 2, 0.5, settings);
    const changedSecond = renderBlendedRotoInterpolationFrame(first, makeAlphaFrame(0, 3, 'alpha-second-changed'), 2, 0.5, settings);
    const changedBackground = renderBlendedRotoInterpolationFrame({ ...first, backgroundOnly: true, nearestRealKeyFrame: 99 } as never, { ...second, onionDataUrl: 'data:image/png;base64,cGFwZXI=' } as never, 2, 0.5, settings);

    expect(blend).toMatchObject({ appFrame: 2, frameIndex: 0, source: 'generated-interpolation', width: 2, height: 2 });
    expect(blend.dataUrl).toMatch(/^data:image\/png;base64,/);
    expect(blend.dataUrl).not.toContain('alpha-blend:');
    expect(blend.dataUrl).not.toContain('pos=33');
    expect(blend.dataUrl).not.toContain('deform=44');
    expect(changedFirst.dataUrl).not.toBe(blend.dataUrl);
    expect(changedSecond.dataUrl).not.toBe(blend.dataUrl);
    expect(changedBackground.dataUrl).toBe(blend.dataUrl);
  });

  it('uses registered browser alpha canvases to produce a renderable blended PNG instead of a fake text payload', () => {
    const originalDocument = globalThis.document;
    const drawCalls: Array<{ alpha: number; source: string }> = [];
    const outputCanvas = {
      width: 0,
      height: 0,
      getContext: () => ({
        globalAlpha: 1,
        clearRect: vi.fn(),
        drawImage(source: { id: string }) {
          drawCalls.push({ alpha: this.globalAlpha, source: source.id });
        },
      }),
      toDataURL: () => 'data:image/png;base64,visible-blended-png',
    } as unknown as HTMLCanvasElement;
    Object.defineProperty(globalThis, 'document', {
      configurable: true,
      value: {
        createElement: (tagName: string) => {
          if (tagName !== 'canvas') throw new Error(`Unexpected element ${tagName}`);
          return outputCanvas;
        },
      },
    });
    const first = makeAlphaFrame(0, 1, 'canvas-first');
    const second = makeAlphaFrame(0, 4, 'canvas-second');
    registerRotoAlphaCanvasFrame(first.dataUrl, { id: 'first-canvas', width: 2, height: 2 } as unknown as HTMLCanvasElement);
    registerRotoAlphaCanvasFrame(second.dataUrl, { id: 'second-canvas', width: 2, height: 2 } as unknown as HTMLCanvasElement);

    try {
      const blend = renderBlendedRotoInterpolationFrame(first, second, 2, 1 / 3, { enabled: true, inBetweenCount: 1, mode: 'blend', position: 0, deform: 0 });

      expect(blend.dataUrl).toBe('data:image/png;base64,visible-blended-png');
      expect(blend.dataUrl).not.toContain('alpha-blend:');
      expect(drawCalls).toHaveLength(2);
      expect(drawCalls[0].source).toBe('first-canvas');
      expect(drawCalls[0].alpha).toBeCloseTo(2 / 3);
      expect(drawCalls[1].source).toBe('second-canvas');
      expect(drawCalls[1].alpha).toBeCloseTo(1 / 3);
    } finally {
      Object.defineProperty(globalThis, 'document', { configurable: true, value: originalDocument });
    }
  });

  it('D-07 persists bounded background-only support only inside real Roto key spans', () => {
    physicPaintStore.upsertRealRotoKeyFrame('layer-1', 2, makeFrame(0, 2));
    physicPaintStore.upsertRealRotoKeyFrame('layer-1', 6, makeFrame(0, 6));
    physicPaintStore.setRotoBackgroundMetadata('layer-1', { background: 'canvas2', paperGrain: 'canvas3', grainStrength: 0.65 });

    const support = physicPaintStore.recomputeBackgroundOnlyRotoSupport('layer-1', [4]);

    expect(support).toEqual([expect.objectContaining({ appFrame: 4, source: 'background-only-support', backgroundOnly: true, nearestRealKeyFrame: 2 })]);
    expect(physicPaintStore.getBackgroundOnlyRotoSupportFrames('layer-1')).toEqual([4]);
    expect(physicPaintStore.toMceOutputs()[0]).toEqual(expect.objectContaining({
      frames: [expect.objectContaining({ appFrame: 2 }), expect.objectContaining({ appFrame: 4 }), expect.objectContaining({ appFrame: 6 })],
      roto_cache_metadata: [
        expect.objectContaining({ appFrame: 2, source: 'real-key' }),
        expect.objectContaining({ appFrame: 4, source: 'background-only-support', backgroundOnly: true }),
        expect.objectContaining({ appFrame: 6, source: 'real-key' }),
      ],
    }));
  });

  it('D-05/D-06 does not persist leading or trailing background-only support', () => {
    physicPaintStore.upsertRealRotoKeyFrame('layer-1', 2, makeFrame(0, 2));
    physicPaintStore.upsertRealRotoKeyFrame('layer-1', 6, makeFrame(0, 6));
    physicPaintStore.setRotoBackgroundMetadata('layer-1', { background: 'canvas2', paperGrain: 'canvas3', grainStrength: 0.65 });

    const before = physicPaintStore.toMceOutputs();
    const support = physicPaintStore.recomputeBackgroundOnlyRotoSupport('layer-1', [1, 8]);

    expect(support).toEqual([]);
    expect(physicPaintStore.getFrame('layer-1', 1)).toBeNull();
    expect(physicPaintStore.getFrame('layer-1', 8)).toBeNull();
    expect(physicPaintStore.toMceOutputs()).toEqual(before);
  });

  it('D-05/D-06 ignores stale trailing rendered frames that are not real Roto keys', () => {
    physicPaintStore.setFrame('layer-1', 11, { ...makeFrame(0, 11), dataUrl: 'data:image/png;base64,c3RhbGUtcGFpbnQ=' });
    physicPaintStore.upsertRealRotoKeyFrame('layer-1', 5, makeFrame(0, 5));
    physicPaintStore.upsertRealRotoKeyFrame('layer-1', 7, makeFrame(0, 7));
    physicPaintStore.setRotoBackgroundMetadata('layer-1', { background: 'canvas1', paperGrain: 'canvas1', grainStrength: 0.45 });

    const result = resolveMissingRotoFrameDraw('layer-1', 11, {
      backgroundState: { mode: 'paper', metadata: physicPaintStore.getRotoBackgroundMetadata('layer-1')! },
      realKeyFrames: physicPaintStore.getRealRotoKeyFrames('layer-1'),
    });

    expect(physicPaintStore.getFrame('layer-1', 11)).toBeNull();
    expect(physicPaintStore.getRotoFrame('layer-1', 11)).toBeNull();
    expect(result).toEqual({ kind: 'background-only', color: '#f4efe3', paperTexture: 'canvas1', paperGrain: 'canvas1', grainStrength: 0.45, span: { kind: 'trailing', previousRealKeyFrame: 7 }, materialize: false });
  });

  it('D-05/D-06 prunes loaded stale trailing rendered frames outside Roto cache metadata', () => {
    physicPaintStore.loadFromMceOutputs([{
      layer_id: 'layer-1',
      workflow_mode: 'roto',
      editable_source: 'roto',
      roto_background: { background: 'canvas1', paperGrain: 'canvas1', grainStrength: 0.45 },
      frames: [makeFrame(0, 5), makeFrame(0, 7), { ...makeFrame(0, 11), dataUrl: 'data:image/png;base64,c3RhbGUtcGFpbnQ=' }],
      roto_cache_metadata: [
        { ...makeFrame(0, 5), source: 'real-key' },
        { ...makeFrame(0, 7), source: 'real-key' },
      ],
    }]);

    expect(physicPaintStore.getFrame('layer-1', 5)?.source).toBeUndefined();
    expect(physicPaintStore.getRotoFrame('layer-1', 5)?.dataUrl).toContain('data:image/png');
    expect(physicPaintStore.getFrame('layer-1', 11)).toBeNull();
    expect(physicPaintStore.getRotoFrame('layer-1', 11)).toBeNull();
    expect(physicPaintStore.getRealRotoKeyFrames('layer-1')).toEqual([5, 7]);
  });

  it('D-08/D-14/D-15 keeps derived support separate from editable real-key alpha content', () => {
    physicPaintStore.upsertRealRotoKeyFrame('layer-1', 2, { ...makeFrame(0, 2), dataUrl: 'data:image/png;base64,cmVhbC0y' });
    physicPaintStore.upsertRealRotoKeyFrame('layer-1', 6, { ...makeFrame(0, 6), dataUrl: 'data:image/png;base64,cmVhbC02' });
    physicPaintStore.setRotoBackgroundMetadata('layer-1', { background: 'canvas1', paperGrain: 'canvas1', grainStrength: 0.45 });

    physicPaintStore.recomputeBackgroundOnlyRotoSupport('layer-1', [4]);

    expect(physicPaintStore.getRealRotoKeyFrames('layer-1')).toEqual([2, 6]);
    expect(physicPaintStore.getFrame('layer-1', 2)?.dataUrl).toBe('data:image/png;base64,cmVhbC0y');
    expect(physicPaintStore.getFrame('layer-1', 6)?.dataUrl).toBe('data:image/png;base64,cmVhbC02');
    expect(physicPaintStore.getRotoCacheFrames('layer-1')).toContainEqual(expect.objectContaining({ appFrame: 4, source: 'background-only-support', backgroundOnly: true }));
  });

  it('36.11 merged repaint applyCanvas output stays a real-key alpha cache and not background-only support', () => {
    physicPaintStore.upsertRealRotoKeyFrame('layer-1', 2, makeFrame(0, 2));
    physicPaintStore.upsertRealRotoKeyFrame('layer-1', 6, makeFrame(0, 6));
    physicPaintStore.setRotoBackgroundMetadata('layer-1', { background: 'canvas2', paperGrain: 'canvas3', grainStrength: 0.65 });
    physicPaintStore.recomputeBackgroundOnlyRotoSupport('layer-1', [4]);

    const result = physicPaintStore.applyCanvas({
      kind: 'apply-canvas',
      operationId: 'op-merged-repaint-real-key',
      layerId: 'layer-1',
      startFrame: 4,
      renderedFrame: { ...makeFrame(0, 4), dataUrl: 'data:image/png;base64,bWVyZ2VkLWFscGhhLXJlcGFpbnQ=' },
      editableState,
    });

    expect(result.ok).toBe(true);
    expect(physicPaintStore.getRotoCacheFrames('layer-1')).toContainEqual(expect.objectContaining({
      appFrame: 4,
      source: 'real-key',
    }));
    expect(physicPaintStore.getRotoCacheFrames('layer-1')).not.toContainEqual(expect.objectContaining({
      appFrame: 4,
      source: 'background-only-support',
    }));
    expect(physicPaintStore.getRotoCacheFrames('layer-1')).not.toContainEqual(expect.objectContaining({
      appFrame: 4,
      backgroundOnly: true,
    }));
    expect(physicPaintStore.getBackgroundOnlyRotoSupportFrames('layer-1')).toEqual([]);
    expect(physicPaintStore.toMceOutputs()[0]).toEqual(expect.objectContaining({
      roto_cache_metadata: expect.arrayContaining([expect.objectContaining({ appFrame: 4, source: 'real-key' })]),
    }));
  });

  it('D-09 applyCanvas replaces only the same-frame background-only support with a real Roto key', () => {
    physicPaintStore.upsertRealRotoKeyFrame('layer-1', 2, makeFrame(0, 2));
    physicPaintStore.upsertRealRotoKeyFrame('layer-1', 6, makeFrame(0, 6));
    physicPaintStore.setRotoBackgroundMetadata('layer-1', { background: 'canvas2', paperGrain: 'canvas3', grainStrength: 0.65 });
    physicPaintStore.recomputeBackgroundOnlyRotoSupport('layer-1', [3, 4]);

    const result = physicPaintStore.applyCanvas({
      kind: 'apply-canvas',
      operationId: 'op-replace-support',
      layerId: 'layer-1',
      startFrame: 4,
      renderedFrame: { ...makeFrame(0, 4), dataUrl: 'data:image/png;base64,cmVhbC00' },
      editableState,
    });

    expect(result.ok).toBe(true);
    expect(physicPaintStore.getRotoCacheFrames('layer-1')).toEqual([
      expect.objectContaining({ appFrame: 2, source: 'real-key' }),
      expect.objectContaining({ appFrame: 3, source: 'background-only-support' }),
      expect.objectContaining({ appFrame: 4, source: 'real-key' }),
      expect.objectContaining({ appFrame: 6, source: 'real-key' }),
    ]);
    expect(physicPaintStore.getFrame('layer-1', 4)?.dataUrl).toBe('data:image/png;base64,cmVhbC00');
  });

  it('regenerates enabled interpolation after real-key upsert, removal, replacement, and disables cleanly', () => {
    physicPaintStore.upsertRealRotoKeyFrame('layer-1', 1, makeAlphaFrame(0, 1, 'alpha-one'));
    physicPaintStore.upsertRealRotoKeyFrame('layer-1', 4, makeAlphaFrame(0, 4, 'alpha-four'));
    physicPaintStore.setRotoInterpolationSettings('layer-1', { enabled: true, inBetweenCount: 1, mode: 'blend', position: 0, deform: 0 });
    const initialGenerated = physicPaintStore.getRotoFrame('layer-1', 2)?.dataUrl;

    physicPaintStore.upsertRealRotoKeyFrame('layer-1', 4, makeAlphaFrame(0, 4, 'alpha-four-changed'));
    expect(physicPaintStore.getRotoFrame('layer-1', 2)?.dataUrl).not.toBe(initialGenerated);
    expect(physicPaintStore.getRotoInterpolationFailureStatus('layer-1')).toBeNull();

    expect(physicPaintStore.removeRealRotoKeyFrame('layer-1', 4)).toBe(true);
    expect(physicPaintStore.getRotoCacheFrames('layer-1')).toEqual([
      expect.objectContaining({ appFrame: 1, source: 'real-key' }),
    ]);

    physicPaintStore.replaceRotoKeyFrames({
      kind: 'replace-roto-key-frames',
      operationId: 'op-replace-regenerate',
      layerId: 'layer-1',
      startFrame: 1,
      frames: [{ ...makeAlphaFrame(0, 2, 'alpha-two'), source: 'real-key' }, { ...makeAlphaFrame(0, 5, 'alpha-five'), source: 'real-key' }],
    });
    expect(physicPaintStore.getRotoCacheFrames('layer-1')).toEqual([
      expect.objectContaining({ appFrame: 2, source: 'real-key', sourceFrame: 2 }),
      expect.objectContaining({ appFrame: 3, source: 'generated-interpolation', nearestRealKeyFrame: 2 }),
      expect.objectContaining({ appFrame: 4, source: 'real-key', sourceFrame: 5, displayFrame: 4 }),
    ]);

    const beforeDisable = physicPaintVersion.value;
    expect(physicPaintStore.setRotoInterpolationSettings('layer-1', { enabled: false })).toEqual([]);
    expect(physicPaintStore.getRealRotoKeyFrames('layer-1')).toEqual([2, 5]);
    expect(physicPaintStore.getRotoCacheFrames('layer-1').map(frame => frame.source)).toEqual(['real-key', 'real-key']);
    expect(physicPaintVersion.value).toBeGreaterThan(beforeDisable);
  });

  it('replacement keeps source real keys and exposes compact failure status when regeneration fails', () => {
    physicPaintStore.upsertRealRotoKeyFrame('layer-1', 1, makeAlphaFrame(0, 1, 'alpha-one'));
    physicPaintStore.upsertRealRotoKeyFrame('layer-1', 4, makeAlphaFrame(0, 4, 'alpha-four'));
    physicPaintStore.setRotoInterpolationSettings('layer-1', { enabled: true, inBetweenCount: 1, mode: 'blend', position: 0, deform: 0 });
    const originalAtob = globalThis.atob;
    vi.stubGlobal('atob', () => { throw new Error('decode failed'); });

    try {
      physicPaintStore.replaceRotoKeyFrames({
        kind: 'replace-roto-key-frames',
        operationId: 'op-replace-failure-kept',
        layerId: 'layer-1',
        startFrame: 2,
        frames: [
          { ...makeAlphaFrame(0, 2, 'alpha-two-kept'), source: 'real-key' },
          { ...makeAlphaFrame(0, 5, 'alpha-five-kept'), source: 'real-key' },
        ],
      });
    } finally {
      vi.stubGlobal('atob', originalAtob);
    }

    expect(physicPaintStore.getRealRotoKeyFrames('layer-1')).toEqual([2, 5]);
    expect(physicPaintStore.getFrame('layer-1', 2)?.dataUrl).toBe(makeAlphaFrame(0, 2, 'alpha-two-kept').dataUrl);
    expect(physicPaintStore.getFrame('layer-1', 5)?.dataUrl).toBe(makeAlphaFrame(0, 5, 'alpha-five-kept').dataUrl);
    expect(physicPaintStore.getRotoCacheFrames('layer-1')).toEqual([
      expect.objectContaining({ appFrame: 2, source: 'real-key' }),
      expect.objectContaining({ appFrame: 5, source: 'real-key' }),
    ]);
    expect(physicPaintStore.getRotoInterpolationFailureStatus('layer-1')).toBe('Generated in-betweens could not regenerate. Real keys were kept.');
  });

  it('keeps real-key mutations and exposes compact failure status when regeneration fails', () => {
    physicPaintStore.upsertRealRotoKeyFrame('layer-1', 1, makeAlphaFrame(0, 1, 'alpha-one'));
    physicPaintStore.upsertRealRotoKeyFrame('layer-1', 4, makeAlphaFrame(0, 4, 'alpha-four'));
    physicPaintStore.setRotoInterpolationSettings('layer-1', { enabled: true, inBetweenCount: 1, mode: 'blend', position: 0, deform: 0 });
    const originalAtob = globalThis.atob;
    vi.stubGlobal('atob', () => { throw new Error('decode failed'); });

    try {
      physicPaintStore.upsertRealRotoKeyFrame('layer-1', 4, makeAlphaFrame(0, 4, 'alpha-failure-kept'));
    } finally {
      vi.stubGlobal('atob', originalAtob);
    }

    expect(physicPaintStore.getFrame('layer-1', 4)?.dataUrl).toBe(makeAlphaFrame(0, 4, 'alpha-failure-kept').dataUrl);
    expect(physicPaintStore.getRotoCacheFrames('layer-1')).toEqual([
      expect.objectContaining({ appFrame: 1, source: 'real-key' }),
      expect.objectContaining({ appFrame: 4, source: 'real-key' }),
    ]);
    expect(physicPaintStore.getRotoInterpolationFailureStatus('layer-1')).toBe('Generated in-betweens could not regenerate. Real keys were kept.');
  });

  it('D-10 replaceRotoKeyFrames removes stale support and recomputes only current bounded interiors', () => {
    physicPaintStore.upsertRealRotoKeyFrame('layer-1', 2, makeFrame(0, 2));
    physicPaintStore.upsertRealRotoKeyFrame('layer-1', 6, makeFrame(0, 6));
    physicPaintStore.setRotoBackgroundMetadata('layer-1', { background: 'canvas3', paperGrain: 'canvas3', grainStrength: 0.5 });
    physicPaintStore.recomputeBackgroundOnlyRotoSupport('layer-1', [4]);

    const result = physicPaintStore.replaceRotoKeyFrames({
      kind: 'replace-roto-key-frames',
      operationId: 'op-replace-keys',
      layerId: 'layer-1',
      startFrame: 2,
      frames: [{ ...makeFrame(0, 6), source: 'real-key' }, { ...makeFrame(0, 10), source: 'real-key' }],
    });

    expect(result.ok).toBe(true);
    expect(physicPaintStore.getFrame('layer-1', 4)).toBeNull();
    expect(physicPaintStore.getRotoCacheFrames('layer-1')).toEqual([
      expect.objectContaining({ appFrame: 6, source: 'real-key' }),
      expect.objectContaining({ appFrame: 10, source: 'real-key' }),
    ]);
    expect(physicPaintStore.recomputeBackgroundOnlyRotoSupport('layer-1', [8]).map(frame => frame.appFrame)).toEqual([8]);
  });
});
