import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PHYSIC_PAINT_MAX_APPLY_FRAMES, clampPhysicPaintFrameCount } from '../types/physicPaint';
import { resolveMissingRotoFrameDraw } from '../lib/rotoFrameDraw';
import {
  buildPhysicPaintRotoPhysicalRevision,
  parsePhysicPaintRotoPhysicalDocument,
} from '../components/physic-paint/roto/physicsPaintRotoPhysicalModel';
import { physicPaintRotoPhysicalOperationLeaseVersion, physicPaintStore, physicPaintVersion, resolveContentToken, _setPhysicPaintMarkDirtyCallback, registerRotoAlphaCanvasFrame, hasRotoAlphaCanvasFrame, renderBlendedRotoInterpolationFrame, _setPhysicPaintCompositorSizeProvider, registerBackgroundSourceImage, hydrateBackgroundSourceImages } from './physicPaintStore';
import { buildEfxPaintDocumentRevision } from '../efx-paint/document/efxPaintDocumentRevision';
import { getDocument as getEfxPaintDocument, registerDocument, reset as resetEfxPaintStore, setTrackVisible } from './efxPaintStore';
import { createEfxPaintDocument } from '../efx-paint/document/efxPaintDocument';
import type { EfxPaintDocument, FrameLoopClip, InternalPaintTrack } from '../efx-paint/document/efxPaintDocument';
import type { PhysicPaintRotoLoopClip } from '../components/physic-paint/roto/physicsPaintRotoPhysicalModel';
import { deriveEfxPaintFlattenedCacheKey } from '../efx-paint/compositor/efxPaintCompositeCache';
import { resetProjectPaperRasterForTests } from '../lib/projectPaperRaster';
// 46-01: runtime state is per-track; tests exercise the document's ACTIVE track.
const TEST_TRACK_ID = 'track-1';



const editableState = {
  version: 1 as const,
  parentLayerId: 'layer-1',
  documentRevision: 0,
  activeTrackId: 'track-1',
  tracks: [{
    id: 'track-1',
    name: 'Paint',
    order: 0,
    visible: true,
    solo: false,
    opacity: 1,
    blendMode: 'normal' as const,
    revision: 0,
    frames: {},
    rotoPhysical: null,
    loopClips: [],
    strokes: [{ tool: 'paint', pts: [[1, 2, 0.5, 0, 0, 0, 0] as [number, number, number, number, number, number, number]], color: '#103c65', params: { size: 6, opacity: 100, pressure: 70, waterAmount: 50, dryAmount: 30, edgeDetail: 4, pickup: 0, eraseStrength: 50, antiAlias: 0 }, time: 123, diffusionFrames: 0 }],
    settings: { bgMode: 'canvas1', paperGrain: 'canvas1', embossStrength: 0.45, wetPaper: true },
  }],
  background: { id: 'background-1', clips: [], fallback: { mode: 'transparent' as const }, visible: true, revision: 0 },
  photoReference: null,
  compositeRevision: 0,
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



describe('physicPaintStore', () => {
  beforeEach(() => {
    _setPhysicPaintMarkDirtyCallback(() => {});
    physicPaintStore.reset();
  });

  it('defaults Roto interpolation mode to duplicate', () => {
    expect(physicPaintStore.getRotoInterpolationSettings('layer-1', TEST_TRACK_ID)).toEqual({ enabled: false, inBetweenCount: 1, mode: 'duplicate', position: 0, deform: 0 });

    physicPaintStore.setRotoInterpolationSettings('layer-1', TEST_TRACK_ID, { enabled: true, inBetweenCount: 1 });

    expect(physicPaintStore.getRotoInterpolationSettings('layer-1', TEST_TRACK_ID)).toEqual({ enabled: true, inBetweenCount: 1, mode: 'duplicate', position: 0, deform: 0 });
  });

  it('stores a still apply payload at the start frame only', () => {
    const before = physicPaintVersion.value;
    const result = physicPaintStore.applyCanvas({
      kind: 'apply-canvas',
      trackId: TEST_TRACK_ID,
      operationId: 'op-still',
      layerId: 'layer-1',
      startFrame: 8,
      renderedFrame: makeFrame(0, 8),
      editableState,
    });

    expect(result.ok).toBe(true);
    expect(result.appliedFrameCount).toBe(1);
    expect(physicPaintStore.getFrame('layer-1', TEST_TRACK_ID, 8)?.dataUrl).toContain('data:image/png');
    expect(physicPaintStore.getFrame('layer-1', TEST_TRACK_ID, 9)).toBeNull();
    expect(physicPaintVersion.value).toBe(before + 1);
  });

  it('stores explicit Roto background metadata from apply payloads as runtime state', () => {
    const result = physicPaintStore.applyCanvas({
      kind: 'apply-canvas',
      trackId: TEST_TRACK_ID,
      operationId: 'op-still-explicit-bg',
      layerId: 'layer-1',
      startFrame: 8,
      renderedFrame: makeFrame(0, 8),
      editableState: {
        ...editableState,
        tracks: editableState.tracks.map((track) => track.id === editableState.activeTrackId
          ? { ...track, settings: { ...track.settings, bgMode: 'transparent' } }
          : track),
      },
      rotoBackground: { background: 'canvas2', paperGrain: 'canvas3', grainStrength: 0.65 },
    });

    expect(result.ok).toBe(true);
    expect(physicPaintStore.getRotoBackgroundMetadata('layer-1', TEST_TRACK_ID)).toEqual({ background: 'canvas2', paperGrain: 'canvas3', grainStrength: 0.65 });
    // v1.0: applyCanvas publishes rendered frames only; the document projection
    // carries no rotoPhysical document until real key records exist.
    const projection = physicPaintStore.extractRuntimeStateForDocument('layer-1', TEST_TRACK_ID);
    expect(projection.rotoPhysical).toBeNull();
    expect(projection.frames.get(8)?.dataUrl).toContain('data:image/png');
  });


  it('marks no-stroke paper Roto applies as background-only cache frames', () => {
    const result = physicPaintStore.applyCanvas({
      kind: 'apply-canvas',
      trackId: TEST_TRACK_ID,
      operationId: 'op-background-only',
      layerId: 'layer-1',
      startFrame: 4,
      renderedFrame: makeFrame(0, 4),
      editableState: {
        ...editableState,
        tracks: editableState.tracks.map((track) => track.id === editableState.activeTrackId
          ? { ...track, strokes: [] }
          : track),
      },
      backgroundOnly: true,
    });

    expect(result.ok).toBe(true);
    expect(physicPaintStore.getFrame('layer-1', TEST_TRACK_ID, 4)?.dataUrl).toContain('data:image/png');
    expect(physicPaintStore.getRotoCacheFrames('layer-1', TEST_TRACK_ID)).toEqual([
      expect.objectContaining({ appFrame: 4, source: 'real-key', backgroundOnly: true }),
    ]);
  });

  it('uses saved Roto paper settings for interior and trailing missing frames', () => {
    physicPaintStore.applyCanvas({
      kind: 'apply-canvas',
      trackId: TEST_TRACK_ID,
      operationId: 'op-roto-1',
      layerId: 'layer-1',
      startFrame: 1,
      renderedFrame: makeFrame(0, 1),
      editableState,
      rotoBackground: { background: 'canvas1', paperGrain: 'canvas1', grainStrength: 0.45 },
    });
    physicPaintStore.applyCanvas({
      kind: 'apply-canvas',
      trackId: TEST_TRACK_ID,
      operationId: 'op-roto-3',
      layerId: 'layer-1',
      startFrame: 3,
      renderedFrame: makeFrame(0, 3),
      editableState,
    });

    const backgroundState = { mode: 'paper' as const, metadata: physicPaintStore.getRotoBackgroundMetadata('layer-1', TEST_TRACK_ID)! };

    expect(physicPaintStore.getRotoBackgroundMetadata('layer-1', TEST_TRACK_ID)).toEqual({ background: 'canvas1', paperGrain: 'canvas1', grainStrength: 0.45 });
    expect(resolveMissingRotoFrameDraw('layer-1', 2, { backgroundState, realKeyFrames: physicPaintStore.getRealRotoKeyFrames('layer-1', TEST_TRACK_ID) })).toEqual({ kind: 'background-only', color: '#f4efe3', paperTexture: 'canvas1', paperGrain: 'canvas1', grainStrength: 0.45, span: { kind: 'interior', previousRealKeyFrame: 1, nextRealKeyFrame: 3 }, materialize: true });
    expect(resolveMissingRotoFrameDraw('layer-1', 4, { backgroundState, realKeyFrames: physicPaintStore.getRealRotoKeyFrames('layer-1', TEST_TRACK_ID) })).toEqual({ kind: 'background-only', color: '#f4efe3', paperTexture: 'canvas1', paperGrain: 'canvas1', grainStrength: 0.45, span: { kind: 'trailing', previousRealKeyFrame: 3 }, materialize: false });
  });


  it('removes a durable real Roto key through a delete payload', () => {
    physicPaintStore.applyCanvas({
      kind: 'apply-canvas',
      trackId: TEST_TRACK_ID,
      operationId: 'op-still',
      layerId: 'layer-1',
      startFrame: 8,
      renderedFrame: makeFrame(0, 8),
      editableState,
    });

    const result = physicPaintStore.deleteRotoFrame({
      kind: 'delete-roto-frame',
      trackId: TEST_TRACK_ID,
      operationId: 'op-delete-roto',
      layerId: 'layer-1',
      startFrame: 8,
    });

    expect(result).toMatchObject({ ok: true, kind: 'delete-roto-frame', appliedFrameCount: 0 });
    expect(physicPaintStore.getFrame('layer-1', TEST_TRACK_ID, 8)).toBeNull();
    expect(physicPaintStore.getRotoCacheFrames('layer-1', TEST_TRACK_ID)).toEqual([]);
    expect(physicPaintStore.extractRuntimeStateForDocument('layer-1', TEST_TRACK_ID)).toEqual({ trackId: TEST_TRACK_ID, frames: new Map(), rotoPhysical: null });
  });








  it('increments version for each successful mutation and marks dirty', () => {
    let dirtyCount = 0;
    _setPhysicPaintMarkDirtyCallback(() => { dirtyCount += 1; });
    const before = physicPaintVersion.value;

    physicPaintStore.setFrame('layer-1', TEST_TRACK_ID, 1, makeFrame(0, 1));
    physicPaintStore.setFrame('layer-1', TEST_TRACK_ID, 2, makeFrame(0, 2));
    physicPaintStore.setRotoBackgroundMetadata('layer-1', TEST_TRACK_ID, { background: 'canvas1', paperGrain: 'canvas1', grainStrength: 0.45 });

    expect(physicPaintVersion.value).toBe(before + 3);
    expect(dirtyCount).toBe(3);
  });

  it('reports real-key, interpolation, and notification timing without changing the mutation', () => {
    const samples: Array<{ stage: string; mutationId?: number; sourceFrame?: number; branch?: string }> = [];
    physicPaintStore.setRotoInterpolationSettings('layer-1', TEST_TRACK_ID, { enabled: true, inBetweenCount: 1, mode: 'duplicate', deform: 0, position: 0 });
    physicPaintStore.upsertRealRotoKeyFrame('layer-1', TEST_TRACK_ID, 0, makeFrame(0, 0));
    const before = physicPaintVersion.value;

    physicPaintStore.upsertRealRotoKeyFrame('layer-1', TEST_TRACK_ID, 1, makeFrame(1, 1), false, {
      mutationId: 23,
      record: (sample) => samples.push(sample),
    });

    expect(physicPaintVersion.value).toBe(before + 1);
    expect(physicPaintStore.getRealRotoKeyFrames('layer-1', TEST_TRACK_ID)).toEqual([0, 1]);
    expect(physicPaintStore.getRotoCacheFrames('layer-1', TEST_TRACK_ID)).toEqual([
      expect.objectContaining({ source: 'real-key', sourceFrame: 0 }),
      expect.objectContaining({ source: 'generated-interpolation', fromSourceFrame: 0, toSourceFrame: 1 }),
      expect.objectContaining({ source: 'real-key', sourceFrame: 1 }),
    ]);
    expect(samples).toEqual(expect.arrayContaining([
      expect.objectContaining({ stage: 'store-real-key-insert', mutationId: 23, sourceFrame: 1 }),
      expect.objectContaining({ stage: 'store-interpolation-regeneration', mutationId: 23, sourceFrame: 1, branch: 'duplicate' }),
      expect.objectContaining({ stage: 'store-visual-notification', mutationId: 23 }),
    ]));
  });

  it('tracks real Roto keys separately from generated cache and removes deleted real key output', () => {
    physicPaintStore.upsertRealRotoKeyFrame('layer-1', TEST_TRACK_ID, 2, makeFrame(0, 2));
    expect(physicPaintStore.getFrame('layer-1', TEST_TRACK_ID, 2)?.dataUrl).toContain('data:image/png');
    expect(physicPaintStore.getRealRotoKeyFrames('layer-1', TEST_TRACK_ID)).toEqual([2]);
    expect(physicPaintStore.getRotoCacheFrames('layer-1', TEST_TRACK_ID)).toEqual([
      expect.objectContaining({ appFrame: 2, source: 'real-key' }),
    ]);

    const beforeRemove = physicPaintVersion.value;
    expect(physicPaintStore.removeRealRotoKeyFrame('layer-1', TEST_TRACK_ID, 2)).toBe(true);
    expect(physicPaintStore.getFrame('layer-1', TEST_TRACK_ID, 2)).toBeNull();
    expect(physicPaintStore.getRealRotoKeyFrames('layer-1', TEST_TRACK_ID)).toEqual([]);
    expect(physicPaintVersion.value).toBe(beforeRemove + 1);
  });

  it('does not move source real keys when interpolation count changes', () => {
    const circle = makeFrame(0, 0);
    const square = makeFrame(1, 1);
    physicPaintStore.upsertRealRotoKeyFrame('layer-1', TEST_TRACK_ID, 0, circle);
    physicPaintStore.upsertRealRotoKeyFrame('layer-1', TEST_TRACK_ID, 1, square);

    physicPaintStore.setRotoInterpolationSettings('layer-1', TEST_TRACK_ID, { enabled: true, inBetweenCount: 1, mode: 'duplicate', deform: 0, position: 0 });
    expect(physicPaintStore.getRealRotoKeyFrames('layer-1', TEST_TRACK_ID)).toEqual([0, 1]);
    expect(physicPaintStore.getFrame('layer-1', TEST_TRACK_ID, 0)?.dataUrl).toBe(circle.dataUrl);
    expect(physicPaintStore.getFrame('layer-1', TEST_TRACK_ID, 1)?.dataUrl).toBe(square.dataUrl);
    expect(physicPaintStore.getRotoCacheFrames('layer-1', TEST_TRACK_ID)).toEqual([
      expect.objectContaining({ appFrame: 0, source: 'real-key', sourceFrame: 0, displayFrame: 0 }),
      expect.objectContaining({ appFrame: 1, source: 'generated-interpolation', nearestRealKeyFrame: 0, fromSourceFrame: 0, toSourceFrame: 1 }),
      expect.objectContaining({ appFrame: 2, source: 'real-key', sourceFrame: 1, displayFrame: 2 }),
    ]);
    expect(physicPaintStore.getRotoFrame('layer-1', TEST_TRACK_ID, 1)).toEqual(expect.objectContaining({ appFrame: 1, source: 'generated-interpolation' }));
    expect(physicPaintStore.getRotoFrame('layer-1', TEST_TRACK_ID, 2)).toEqual(expect.objectContaining({ appFrame: 2, source: 'real-key', sourceFrame: 1 }));

    physicPaintStore.setRotoInterpolationSettings('layer-1', TEST_TRACK_ID, { enabled: true, inBetweenCount: 2, mode: 'duplicate', deform: 0, position: 0 });
    expect(physicPaintStore.getRealRotoKeyFrames('layer-1', TEST_TRACK_ID)).toEqual([0, 1]);
    expect(physicPaintStore.getRotoCacheFrames('layer-1', TEST_TRACK_ID).filter(frame => frame.source === 'generated-interpolation').map(frame => frame.appFrame)).toEqual([1, 2]);

    physicPaintStore.setRotoInterpolationSettings('layer-1', TEST_TRACK_ID, { enabled: false });
    expect(physicPaintStore.getRotoCacheFrames('layer-1', TEST_TRACK_ID)).toEqual([
      expect.objectContaining({ appFrame: 0, source: 'real-key' }),
      expect.objectContaining({ appFrame: 1, source: 'real-key' }),
    ]);
  });

  it('UAT truth table reconstructs normal and custom source/display projections through toggle and projection round-trip', () => {
    const zero = makeAlphaFrame(0, 0, 'zero');
    const one = makeAlphaFrame(0, 1, 'one');
    const two = makeAlphaFrame(0, 2, 'two');
    const normal = makeAlphaFrame(0, 9, 'normal');
    physicPaintStore.upsertRealRotoKeyFrame('normal-layer', TEST_TRACK_ID, 0, zero);
    physicPaintStore.upsertRealRotoKeyFrame('normal-layer', TEST_TRACK_ID, 1, one);
    physicPaintStore.upsertRealRotoKeyFrame('normal-layer', TEST_TRACK_ID, 2, two);
    physicPaintStore.upsertRealRotoKeyFrame('normal-layer', TEST_TRACK_ID, 3, { ...normal, appFrame: 3 });
    physicPaintStore.setRotoInterpolationSettings('normal-layer', TEST_TRACK_ID, { enabled: true, inBetweenCount: 2, mode: 'duplicate', deform: 0, position: 0 });

    expect(physicPaintStore.getRotoInterpolationSettings('normal-layer', TEST_TRACK_ID).segmentSpacingOverrides).toBeUndefined();
    expect(physicPaintStore.getRotoCacheFrames('normal-layer', TEST_TRACK_ID).filter(frame => frame.source === 'real-key').map(frame => frame.appFrame)).toEqual([0, 3, 6, 9]);

    physicPaintStore.setRotoInterpolationSettings('normal-layer', TEST_TRACK_ID, { enabled: false });
    expect(physicPaintStore.getRotoCacheFrames('normal-layer', TEST_TRACK_ID).filter(frame => frame.source === 'real-key').map(frame => frame.appFrame)).toEqual([0, 1, 2, 3]);
    physicPaintStore.setRotoInterpolationSettings('normal-layer', TEST_TRACK_ID, { enabled: true });
    expect(physicPaintStore.getRotoCacheFrames('normal-layer', TEST_TRACK_ID).filter(frame => frame.source === 'real-key').map(frame => frame.appFrame)).toEqual([0, 3, 6, 9]);

    const custom = makeAlphaFrame(0, 14, 'custom');
    physicPaintStore.upsertRealRotoKeyFrame('custom-layer', TEST_TRACK_ID, 0, zero);
    physicPaintStore.upsertRealRotoKeyFrame('custom-layer', TEST_TRACK_ID, 1, one);
    physicPaintStore.upsertRealRotoKeyFrame('custom-layer', TEST_TRACK_ID, 2, two);
    physicPaintStore.upsertRealRotoKeyFrame('custom-layer', TEST_TRACK_ID, 9, { ...custom, appFrame: 9 });
    physicPaintStore.setRotoInterpolationSettings('custom-layer', TEST_TRACK_ID, {
      enabled: true,
      inBetweenCount: 2,
      mode: 'duplicate',
      deform: 0,
      position: 0,
      segmentSpacingOverrides: [{ fromSourceFrame: 2, toSourceFrame: 9, inBetweenCount: 7 }],
    });

    expect(physicPaintStore.getRotoCacheFrames('custom-layer', TEST_TRACK_ID).filter(frame => frame.source === 'real-key').map(frame => frame.appFrame)).toEqual([0, 3, 6, 14]);
    expect(physicPaintStore.getRotoInterpolationSettings('custom-layer', TEST_TRACK_ID).segmentSpacingOverrides).toEqual([
      { fromSourceFrame: 2, toSourceFrame: 9, inBetweenCount: 7 },
    ]);

    physicPaintStore.setRotoInterpolationSettings('custom-layer', TEST_TRACK_ID, { enabled: false });
    expect(physicPaintStore.getRotoCacheFrames('custom-layer', TEST_TRACK_ID).filter(frame => frame.source === 'real-key').map(frame => frame.appFrame)).toEqual([0, 1, 2, 9]);
    physicPaintStore.setRotoInterpolationSettings('custom-layer', TEST_TRACK_ID, { enabled: true });
    expect(physicPaintStore.getRotoCacheFrames('custom-layer', TEST_TRACK_ID).filter(frame => frame.source === 'real-key').map(frame => frame.appFrame)).toEqual([0, 3, 6, 14]);

    // v1.0 persists rendered frames only; runtime interpolation settings are
    // runtime-only and reset to defaults after hydration.
    const customProjection = physicPaintStore.extractRuntimeStateForDocument('custom-layer', TEST_TRACK_ID);
    physicPaintStore.reset();
    physicPaintStore.installRuntimeStateFromDocument('custom-layer', TEST_TRACK_ID, customProjection);

    expect(physicPaintStore.getFrame('custom-layer', TEST_TRACK_ID, 0)?.dataUrl).toBe(zero.dataUrl);
    expect(physicPaintStore.getFrame('custom-layer', TEST_TRACK_ID, 1)?.dataUrl).toBe(one.dataUrl);
    expect(physicPaintStore.getFrame('custom-layer', TEST_TRACK_ID, 2)?.dataUrl).toBe(two.dataUrl);
    expect(physicPaintStore.getFrame('custom-layer', TEST_TRACK_ID, 9)?.dataUrl).toBe(custom.dataUrl);
    expect(physicPaintStore.getRotoInterpolationSettings('custom-layer', TEST_TRACK_ID)).toEqual({ enabled: false, inBetweenCount: 1, mode: 'duplicate', position: 0, deform: 0 });
  });

  it('UAT keeps a far-empty saved key at display #14 with a custom previous segment', () => {
    const zero = makeAlphaFrame(0, 0, 'zero');
    const one = makeAlphaFrame(0, 1, 'one');
    const two = makeAlphaFrame(0, 2, 'two');
    const three = makeAlphaFrame(0, 3, 'three');
    const five = makeAlphaFrame(0, 14, 'painted-five');
    physicPaintStore.upsertRealRotoKeyFrame('layer-1', TEST_TRACK_ID, 0, zero);
    physicPaintStore.upsertRealRotoKeyFrame('layer-1', TEST_TRACK_ID, 1, one);
    physicPaintStore.upsertRealRotoKeyFrame('layer-1', TEST_TRACK_ID, 2, two);
    physicPaintStore.upsertRealRotoKeyFrame('layer-1', TEST_TRACK_ID, 3, three);
    physicPaintStore.setRotoInterpolationSettings('layer-1', TEST_TRACK_ID, { enabled: true, inBetweenCount: 2, mode: 'duplicate', deform: 0, position: 0 });

    const customSettings = {
      enabled: true,
      inBetweenCount: 2,
      mode: 'duplicate' as const,
      deform: 0,
      position: 0,
      segmentSpacingOverrides: [{ fromSourceFrame: 3, toSourceFrame: 7, inBetweenCount: 4 }],
    };
    physicPaintStore.upsertRealRotoKeyFrame('layer-1', TEST_TRACK_ID, 7, { ...five, appFrame: 7 });
    physicPaintStore.setRotoInterpolationSettings('layer-1', TEST_TRACK_ID, customSettings);

    expect(physicPaintStore.getRealRotoKeyFrames('layer-1', TEST_TRACK_ID)).toEqual([0, 1, 2, 3, 7]);
    expect(physicPaintStore.getRotoCacheFrames('layer-1', TEST_TRACK_ID)).toEqual(expect.arrayContaining([
      expect.objectContaining({ appFrame: 0, source: 'real-key', sourceFrame: 0, displayFrame: 0, dataUrl: zero.dataUrl }),
      expect.objectContaining({ appFrame: 3, source: 'real-key', sourceFrame: 1, displayFrame: 3, dataUrl: one.dataUrl }),
      expect.objectContaining({ appFrame: 6, source: 'real-key', sourceFrame: 2, displayFrame: 6, dataUrl: two.dataUrl }),
      expect.objectContaining({ appFrame: 9, source: 'real-key', sourceFrame: 3, displayFrame: 9, dataUrl: three.dataUrl }),
      expect.objectContaining({ appFrame: 10, source: 'generated-interpolation', fromSourceFrame: 3, toSourceFrame: 7, dataUrl: three.dataUrl }),
      expect.objectContaining({ appFrame: 11, source: 'generated-interpolation', fromSourceFrame: 3, toSourceFrame: 7, dataUrl: three.dataUrl }),
      expect.objectContaining({ appFrame: 12, source: 'generated-interpolation', fromSourceFrame: 3, toSourceFrame: 7, dataUrl: three.dataUrl }),
      expect.objectContaining({ appFrame: 13, source: 'generated-interpolation', fromSourceFrame: 3, toSourceFrame: 7, dataUrl: three.dataUrl }),
      expect.objectContaining({ appFrame: 14, source: 'real-key', sourceFrame: 7, displayFrame: 14, dataUrl: five.dataUrl }),
    ]));
    expect(physicPaintStore.getRotoInterpolationSettings('layer-1', TEST_TRACK_ID).segmentSpacingOverrides).toEqual([
      { fromSourceFrame: 3, toSourceFrame: 7, inBetweenCount: 4 },
    ]);
    expect(physicPaintStore.getRotoFrame('layer-1', TEST_TRACK_ID, 14)).toEqual(expect.objectContaining({ appFrame: 14, source: 'real-key', sourceFrame: 7, dataUrl: five.dataUrl }));

    physicPaintStore.setRotoInterpolationSettings('layer-1', TEST_TRACK_ID, { enabled: false });

    expect(physicPaintStore.getRotoCacheFrames('layer-1', TEST_TRACK_ID)).toEqual([
      expect.objectContaining({ appFrame: 0, source: 'real-key', sourceFrame: 0, displayFrame: 0, dataUrl: zero.dataUrl }),
      expect.objectContaining({ appFrame: 1, source: 'real-key', sourceFrame: 1, displayFrame: 1, dataUrl: one.dataUrl }),
      expect.objectContaining({ appFrame: 2, source: 'real-key', sourceFrame: 2, displayFrame: 2, dataUrl: two.dataUrl }),
      expect.objectContaining({ appFrame: 3, source: 'real-key', sourceFrame: 3, displayFrame: 3, dataUrl: three.dataUrl }),
      expect.objectContaining({ appFrame: 7, source: 'real-key', sourceFrame: 7, displayFrame: 7, dataUrl: five.dataUrl }),
    ]);
  });

  it('preserves consecutive distant key identity and projection through ON/OFF/ON and projection round-trip', () => {
    const sourceFrames = [0, 1, 2, 3, 14, 15];
    const payloads = new Map(sourceFrames.map((sourceFrame) => [sourceFrame, makeAlphaFrame(0, sourceFrame, `paint-${sourceFrame}`)]));
    for (const sourceFrame of sourceFrames) physicPaintStore.upsertRealRotoKeyFrame('layer-1', TEST_TRACK_ID, sourceFrame, payloads.get(sourceFrame)!);
    physicPaintStore.setRotoInterpolationSettings('layer-1', TEST_TRACK_ID, {
      enabled: false,
      inBetweenCount: 2,
      mode: 'duplicate',
      deform: 0,
      position: 0,
      segmentSpacingOverrides: [{ fromSourceFrame: 3, toSourceFrame: 14, inBetweenCount: 4 }],
    });

    const expectRealKeys = (displayFrames: number[]) => {
      const realKeys = physicPaintStore.getRotoCacheFrames('layer-1', TEST_TRACK_ID).filter((frame) => frame.source === 'real-key');
      expect(realKeys.map((frame) => frame.sourceFrame)).toEqual(sourceFrames);
      expect(realKeys.map((frame) => frame.displayFrame)).toEqual(displayFrames);
      expect(realKeys.map((frame) => frame.dataUrl)).toEqual(sourceFrames.map((sourceFrame) => payloads.get(sourceFrame)!.dataUrl));
      expect(physicPaintStore.getRealRotoKeyFrames('layer-1', TEST_TRACK_ID)).toEqual(sourceFrames);
    };

    expectRealKeys([0, 1, 2, 3, 14, 15]);
    physicPaintStore.setRotoInterpolationSettings('layer-1', TEST_TRACK_ID, { enabled: true });
    expectRealKeys([0, 3, 6, 9, 14, 17]);
    expect(physicPaintStore.getRotoCacheFrames('layer-1', TEST_TRACK_ID)
      .filter((frame) => frame.source === 'generated-interpolation' && frame.fromSourceFrame === 14 && frame.toSourceFrame === 15)
      .map((frame) => frame.appFrame)).toEqual([15, 16]);
    physicPaintStore.setRotoInterpolationSettings('layer-1', TEST_TRACK_ID, { enabled: false });
    expectRealKeys([0, 1, 2, 3, 14, 15]);
    physicPaintStore.setRotoInterpolationSettings('layer-1', TEST_TRACK_ID, { enabled: true });
    expectRealKeys([0, 3, 6, 9, 14, 17]);

    const projectionOn = physicPaintStore.extractRuntimeStateForDocument('layer-1', TEST_TRACK_ID);
    physicPaintStore.reset();
    physicPaintStore.installRuntimeStateFromDocument('layer-1', TEST_TRACK_ID, projectionOn);
    // v1.0 persists rendered frames; runtime interpolation settings reset to defaults.
    expect(physicPaintStore.getFrame('layer-1', TEST_TRACK_ID, 0)?.dataUrl).toBe(payloads.get(0)!.dataUrl);
    expect(physicPaintStore.getFrame('layer-1', TEST_TRACK_ID, 14)?.dataUrl).toBe(payloads.get(14)!.dataUrl);
    expect(physicPaintStore.getFrame('layer-1', TEST_TRACK_ID, 15)?.dataUrl).toBe(payloads.get(15)!.dataUrl);
    expect(physicPaintStore.getRotoInterpolationSettings('layer-1', TEST_TRACK_ID)).toEqual({ enabled: false, inBetweenCount: 1, mode: 'duplicate', position: 0, deform: 0 });

    physicPaintStore.setRotoInterpolationSettings('layer-1', TEST_TRACK_ID, { enabled: false });
    const projectionOff = physicPaintStore.extractRuntimeStateForDocument('layer-1', TEST_TRACK_ID);
    physicPaintStore.reset();
    physicPaintStore.installRuntimeStateFromDocument('layer-1', TEST_TRACK_ID, projectionOff);
    expect(physicPaintStore.getFrame('layer-1', TEST_TRACK_ID, 0)?.dataUrl).toBe(payloads.get(0)!.dataUrl);
    expect(physicPaintStore.getFrame('layer-1', TEST_TRACK_ID, 15)?.dataUrl).toBe(payloads.get(15)!.dataUrl);
  });

  it('preserves independent distant segment spacing and changes only the targeted segment', () => {
    const sourceFrames = [0, 1, 2, 3, 14, 26];
    for (const sourceFrame of sourceFrames) {
      physicPaintStore.upsertRealRotoKeyFrame('layer-1', TEST_TRACK_ID, sourceFrame, makeAlphaFrame(0, sourceFrame, `independent-${sourceFrame}`));
    }
    physicPaintStore.setRotoInterpolationSettings('layer-1', TEST_TRACK_ID, {
      enabled: true,
      inBetweenCount: 2,
      mode: 'duplicate',
      deform: 0,
      position: 0,
      segmentSpacingOverrides: [
        { fromSourceFrame: 3, toSourceFrame: 14, inBetweenCount: 4 },
        { fromSourceFrame: 14, toSourceFrame: 26, inBetweenCount: 11 },
      ],
    });

    expect(physicPaintStore.getRotoCacheFrames('layer-1', TEST_TRACK_ID).filter((frame) => frame.source === 'real-key').map((frame) => frame.displayFrame)).toEqual([0, 3, 6, 9, 14, 26]);
    physicPaintStore.setRotoInterpolationSettings('layer-1', TEST_TRACK_ID, {
      segmentSpacingOverrides: [
        { fromSourceFrame: 3, toSourceFrame: 14, inBetweenCount: 6 },
        { fromSourceFrame: 14, toSourceFrame: 26, inBetweenCount: 11 },
      ],
    });

    expect(physicPaintStore.getRotoInterpolationSettings('layer-1', TEST_TRACK_ID).segmentSpacingOverrides).toEqual([
      { fromSourceFrame: 3, toSourceFrame: 14, inBetweenCount: 6 },
      { fromSourceFrame: 14, toSourceFrame: 26, inBetweenCount: 11 },
    ]);
    expect(physicPaintStore.getRotoCacheFrames('layer-1', TEST_TRACK_ID).filter((frame) => frame.source === 'real-key').map((frame) => frame.displayFrame)).toEqual([0, 3, 6, 9, 16, 28]);

    const projection = physicPaintStore.extractRuntimeStateForDocument('layer-1', TEST_TRACK_ID);
    physicPaintStore.reset();
    physicPaintStore.installRuntimeStateFromDocument('layer-1', TEST_TRACK_ID, projection);
    // v1.0 persists rendered frames; runtime interpolation settings reset to defaults.
    expect(physicPaintStore.getFrame('layer-1', TEST_TRACK_ID, 0)?.dataUrl).toBe(makeAlphaFrame(0, 0, 'independent-0').dataUrl);
    expect(physicPaintStore.getFrame('layer-1', TEST_TRACK_ID, 26)?.dataUrl).toBe(makeAlphaFrame(0, 26, 'independent-26').dataUrl);
    expect(physicPaintStore.getRotoInterpolationSettings('layer-1', TEST_TRACK_ID)).toEqual({ enabled: false, inBetweenCount: 1, mode: 'duplicate', position: 0, deform: 0 });
  });

  it('appends a distant real key saved while interpolation is enabled into compact source order through disable and projection round-trip', () => {
    const circle = makeAlphaFrame(0, 0, 'circle');
    const square = makeAlphaFrame(0, 1, 'square');
    const crossed = makeAlphaFrame(0, 2, 'crossed-lines');
    const distant = makeAlphaFrame(0, 37, 'distant-real-key');
    const appendedSourceFrame = 3;
    physicPaintStore.upsertRealRotoKeyFrame('layer-1', TEST_TRACK_ID, 0, circle);
    physicPaintStore.upsertRealRotoKeyFrame('layer-1', TEST_TRACK_ID, 1, square);
    physicPaintStore.upsertRealRotoKeyFrame('layer-1', TEST_TRACK_ID, 2, crossed);
    physicPaintStore.setRotoInterpolationSettings('layer-1', TEST_TRACK_ID, { enabled: true, inBetweenCount: 3, mode: 'duplicate', deform: 0, position: 0 });

    physicPaintStore.upsertRealRotoKeyFrame('layer-1', TEST_TRACK_ID, appendedSourceFrame, { ...distant, appFrame: appendedSourceFrame });

    expect(physicPaintStore.getRealRotoKeyFrames('layer-1', TEST_TRACK_ID)).toEqual([0, 1, 2, 3]);
    expect(physicPaintStore.getFrame('layer-1', TEST_TRACK_ID, appendedSourceFrame)?.dataUrl).toBe(distant.dataUrl);
    expect(physicPaintStore.getRotoCacheFrames('layer-1', TEST_TRACK_ID)).toEqual(expect.arrayContaining([
      expect.objectContaining({ appFrame: 12, source: 'real-key', sourceFrame: appendedSourceFrame, displayFrame: 12, dataUrl: distant.dataUrl }),
    ]));

    physicPaintStore.setRotoInterpolationSettings('layer-1', TEST_TRACK_ID, { enabled: false });

    expect(physicPaintStore.getRotoCacheFrames('layer-1', TEST_TRACK_ID)).toEqual([
      expect.objectContaining({ appFrame: 0, source: 'real-key', sourceFrame: 0, displayFrame: 0 }),
      expect.objectContaining({ appFrame: 1, source: 'real-key', sourceFrame: 1, displayFrame: 1 }),
      expect.objectContaining({ appFrame: 2, source: 'real-key', sourceFrame: 2, displayFrame: 2 }),
      expect.objectContaining({ appFrame: 3, source: 'real-key', sourceFrame: appendedSourceFrame, displayFrame: 3, dataUrl: distant.dataUrl }),
    ]);

    const projection = physicPaintStore.extractRuntimeStateForDocument('layer-1', TEST_TRACK_ID);
    physicPaintStore.reset();
    physicPaintStore.installRuntimeStateFromDocument('layer-1', TEST_TRACK_ID, projection);

    expect(physicPaintStore.getFrame('layer-1', TEST_TRACK_ID, 0)?.dataUrl).toBe(circle.dataUrl);
    expect(physicPaintStore.getFrame('layer-1', TEST_TRACK_ID, appendedSourceFrame)?.dataUrl).toBe(distant.dataUrl);
    expect(physicPaintStore.getRotoInterpolationSettings('layer-1', TEST_TRACK_ID)).toEqual({ enabled: false, inBetweenCount: 1, mode: 'duplicate', position: 0, deform: 0 });
  });

  it('duplicates each source key across expanded display frames and deletes shifted display keys by source frame', () => {
    const circle = makeAlphaFrame(0, 0, 'circle');
    const square = makeAlphaFrame(0, 1, 'square');
    const crossed = makeAlphaFrame(0, 2, 'crossed-lines');
    physicPaintStore.upsertRealRotoKeyFrame('layer-1', TEST_TRACK_ID, 0, circle);
    physicPaintStore.upsertRealRotoKeyFrame('layer-1', TEST_TRACK_ID, 1, square);
    physicPaintStore.upsertRealRotoKeyFrame('layer-1', TEST_TRACK_ID, 2, crossed);

    physicPaintStore.setRotoInterpolationSettings('layer-1', TEST_TRACK_ID, { enabled: true, inBetweenCount: 3, mode: 'duplicate', deform: 0, position: 0 });

    expect(physicPaintStore.getRealRotoKeyFrames('layer-1', TEST_TRACK_ID)).toEqual([0, 1, 2]);
    expect(physicPaintStore.getFrame('layer-1', TEST_TRACK_ID, 1)?.dataUrl).toBe(square.dataUrl);
    expect(physicPaintStore.getFrame('layer-1', TEST_TRACK_ID, 2)?.dataUrl).toBe(crossed.dataUrl);
    expect(physicPaintStore.getRotoCacheFrames('layer-1', TEST_TRACK_ID)).toEqual([
      expect.objectContaining({ appFrame: 0, source: 'real-key', sourceFrame: 0, displayFrame: 0, dataUrl: circle.dataUrl }),
      expect.objectContaining({ appFrame: 1, source: 'generated-interpolation', fromSourceFrame: 0, toSourceFrame: 1, dataUrl: circle.dataUrl }),
      expect.objectContaining({ appFrame: 2, source: 'generated-interpolation', fromSourceFrame: 0, toSourceFrame: 1, dataUrl: circle.dataUrl }),
      expect.objectContaining({ appFrame: 3, source: 'generated-interpolation', fromSourceFrame: 0, toSourceFrame: 1, dataUrl: circle.dataUrl }),
      expect.objectContaining({ appFrame: 4, source: 'real-key', sourceFrame: 1, displayFrame: 4, dataUrl: square.dataUrl }),
      expect.objectContaining({ appFrame: 5, source: 'generated-interpolation', fromSourceFrame: 1, toSourceFrame: 2, dataUrl: square.dataUrl }),
      expect.objectContaining({ appFrame: 6, source: 'generated-interpolation', fromSourceFrame: 1, toSourceFrame: 2, dataUrl: square.dataUrl }),
      expect.objectContaining({ appFrame: 7, source: 'generated-interpolation', fromSourceFrame: 1, toSourceFrame: 2, dataUrl: square.dataUrl }),
      expect.objectContaining({ appFrame: 8, source: 'real-key', sourceFrame: 2, displayFrame: 8, dataUrl: crossed.dataUrl }),
    ]);
    expect(physicPaintStore.getRotoFrame('layer-1', TEST_TRACK_ID, 1)?.dataUrl).toBe(circle.dataUrl);
    expect(physicPaintStore.getRotoFrame('layer-1', TEST_TRACK_ID, 4)?.dataUrl).toBe(square.dataUrl);
    expect(physicPaintStore.getRotoFrame('layer-1', TEST_TRACK_ID, 8)?.dataUrl).toBe(crossed.dataUrl);
    expect(physicPaintStore.getRotoFrame('layer-1', TEST_TRACK_ID, 9)).toBeNull();

    expect(physicPaintStore.deleteRotoFrame({ kind: 'delete-roto-frame', trackId: TEST_TRACK_ID, operationId: 'op-delete-crossed', layerId: 'layer-1', startFrame: 8, sourceFrame: 2 }).ok).toBe(true);

    expect(physicPaintStore.getRealRotoKeyFrames('layer-1', TEST_TRACK_ID)).toEqual([0, 1]);
    expect(physicPaintStore.getRotoCacheFrames('layer-1', TEST_TRACK_ID)).toEqual([
      expect.objectContaining({ appFrame: 0, source: 'real-key', sourceFrame: 0 }),
      expect.objectContaining({ appFrame: 1, source: 'generated-interpolation', fromSourceFrame: 0, toSourceFrame: 1, dataUrl: circle.dataUrl }),
      expect.objectContaining({ appFrame: 2, source: 'generated-interpolation', fromSourceFrame: 0, toSourceFrame: 1, dataUrl: circle.dataUrl }),
      expect.objectContaining({ appFrame: 3, source: 'generated-interpolation', fromSourceFrame: 0, toSourceFrame: 1, dataUrl: circle.dataUrl }),
      expect.objectContaining({ appFrame: 4, source: 'real-key', sourceFrame: 1, dataUrl: square.dataUrl }),
    ]);
    expect(physicPaintStore.getRotoFrame('layer-1', TEST_TRACK_ID, 8)).toBeNull();
  });

  it('replaces generated Roto cache through existing rendered frame storage', () => {
    physicPaintStore.upsertRealRotoKeyFrame('layer-1', TEST_TRACK_ID, 0, makeFrame(0, 0));
    physicPaintStore.replaceGeneratedRotoCache('layer-1', TEST_TRACK_ID, [
      { ...makeFrame(0, 1), source: 'generated-interpolation', nearestRealKeyFrame: 0 },
      { ...makeFrame(1, 2), source: 'generated-interpolation', nearestRealKeyFrame: 3 },
    ], { enabled: true, inBetweenCount: 2, mode: 'blend', deform: 10, position: 20 });

    expect(physicPaintStore.getRotoFrame('layer-1', TEST_TRACK_ID, 1)?.dataUrl).toContain('data:image/png');
    expect(physicPaintStore.getRotoCacheFrames('layer-1', TEST_TRACK_ID)).toEqual([
      expect.objectContaining({ appFrame: 0, source: 'real-key' }),
      expect.objectContaining({ appFrame: 1, source: 'generated-interpolation', nearestRealKeyFrame: 0 }),
      expect.objectContaining({ appFrame: 2, source: 'generated-interpolation', nearestRealKeyFrame: 3 }),
    ]);
    expect(physicPaintStore.getRotoInterpolationSettings('layer-1', TEST_TRACK_ID)).toEqual({ enabled: true, inBetweenCount: 2, mode: 'blend', deform: 10, position: 20 });

    physicPaintStore.replaceGeneratedRotoCache('layer-1', TEST_TRACK_ID, [
      { ...makeFrame(0, 4), source: 'generated-interpolation', nearestRealKeyFrame: 3 },
    ], { enabled: true, inBetweenCount: 1, mode: 'duplicate', deform: 0, position: 0 });
    expect(physicPaintStore.getFrame('layer-1', TEST_TRACK_ID, 1)).toBeNull();
    expect(physicPaintStore.getFrame('layer-1', TEST_TRACK_ID, 2)).toBeNull();
    expect(physicPaintStore.getRotoFrame('layer-1', TEST_TRACK_ID, 4)?.dataUrl).toContain('data:image/png');
  });

  it('v1.0 projection round-trips rendered frames without editable per-frame state', () => {
    physicPaintStore.upsertRealRotoKeyFrame('layer-1', TEST_TRACK_ID, 0, makeFrame(0, 0));
    physicPaintStore.setRotoBackgroundMetadata('layer-1', TEST_TRACK_ID, { background: 'canvas2', paperGrain: 'canvas3', grainStrength: 0.65 });
    physicPaintStore.replaceGeneratedRotoCache('layer-1', TEST_TRACK_ID, [
      { ...makeFrame(0, 1), source: 'generated-interpolation', nearestRealKeyFrame: 0 },
    ], { enabled: true, inBetweenCount: 1, mode: 'duplicate', deform: 5, position: 15 });

    const projection = physicPaintStore.extractRuntimeStateForDocument('layer-1', TEST_TRACK_ID);
    expect(projection.rotoPhysical).toBeNull();
    expect(projection.frames.get(0)?.dataUrl).toContain('data:image/png');
    expect(JSON.stringify(projection)).not.toContain('editableStatesByFrame');

    physicPaintStore.reset();
    physicPaintStore.installRuntimeStateFromDocument('layer-1', TEST_TRACK_ID, projection);

    expect(physicPaintStore.getFrame('layer-1', TEST_TRACK_ID, 0)?.dataUrl).toContain('data:image/png');
    expect(physicPaintStore.getRotoBackgroundMetadata('layer-1', TEST_TRACK_ID)).toBeNull();
  });

  it('derives generated Roto frames from persisted real keys and enabled interpolation state', () => {
    const realOne = makeAlphaFrame(0, 1, 'saved-real-one');
    const realFour = makeAlphaFrame(0, 4, 'saved-real-four');
    const records = [
      { keyId: 'key-1', appFrame: 1, kind: 'real-key' as const, payload: realOne },
      { keyId: 'key-4', appFrame: 4, kind: 'real-key' as const, payload: realFour },
    ];
    const interpolation = { enabled: true, mode: 'duplicate' as const };
    const document = parsePhysicPaintRotoPhysicalDocument({
      capacity: 600,
      realKeyRecords: records,
      interpolation,
      scriptMotion: { deformation: 0, position: 0 },
      background: null,
      selectedKeyId: null,
      cursorAppFrame: 0,
      revision: buildPhysicPaintRotoPhysicalRevision(records, interpolation, []),
      loopClips: [],
      incomingInterpolationBreakKeyIds: [],
    });
    expect(physicPaintStore.replaceRotoPhysicalDocument('layer-1', TEST_TRACK_ID, document).ok).toBe(true);

    // v1.0 save/load round-trip: the physical document survives hydration and
    // the render source derives generated frames at every interior appFrame.
    const projection = physicPaintStore.extractRuntimeStateForDocument('layer-1', TEST_TRACK_ID);
    physicPaintStore.reset();
    physicPaintStore.installRuntimeStateFromDocument('layer-1', TEST_TRACK_ID, projection);

    expect(physicPaintStore.getRotoPhysicalInterpolationState('layer-1', TEST_TRACK_ID)).toEqual({ enabled: true, mode: 'duplicate' });
    expect(physicPaintStore.getRotoPhysicalRenderSource('layer-1', TEST_TRACK_ID, 1)).toMatchObject({ kind: 'real', appFrame: 1, renderedFrame: { dataUrl: realOne.dataUrl } });
    expect(physicPaintStore.getRotoPhysicalRenderSource('layer-1', TEST_TRACK_ID, 2)).toMatchObject({ kind: 'generated', appFrame: 2, leftKeyId: 'key-1', rightKeyId: 'key-4', renderedFrame: { dataUrl: realOne.dataUrl } });
    expect(physicPaintStore.getRotoPhysicalRenderSource('layer-1', TEST_TRACK_ID, 3)).toMatchObject({ kind: 'generated', appFrame: 3, leftKeyId: 'key-1', rightKeyId: 'key-4', renderedFrame: { dataUrl: realOne.dataUrl } });
    expect(physicPaintStore.getRotoPhysicalRenderSource('layer-1', TEST_TRACK_ID, 4)).toMatchObject({ kind: 'real', appFrame: 4, renderedFrame: { dataUrl: realFour.dataUrl } });
  });

  const seedDebug08CustomRotoModel = () => {
    const sourceFrames = [0, 1, 2, 3, 14, 26] as const;
    const payloads = ['A', 'B', 'C', 'D', 'E', 'F'] as const;
    sourceFrames.forEach((sourceFrame, index) => {
      physicPaintStore.upsertRealRotoKeyFrame('layer-1', TEST_TRACK_ID, sourceFrame, makeAlphaFrame(0, sourceFrame, payloads[index]));
    });
    physicPaintStore.setRotoInterpolationSettings('layer-1', TEST_TRACK_ID, {
      enabled: true,
      inBetweenCount: 2,
      mode: 'duplicate',
      deform: 0,
      position: 0,
      segmentSpacingOverrides: [
        { fromSourceFrame: 3, toSourceFrame: 14, inBetweenCount: 4 },
        { fromSourceFrame: 14, toSourceFrame: 26, inBetweenCount: 11 },
      ],
    });
    return sourceFrames;
  };

  it('Debug 08 projection carries only durable rendered frames', () => {
    const sourceFrames = seedDebug08CustomRotoModel();

    const projection = physicPaintStore.extractRuntimeStateForDocument('layer-1', TEST_TRACK_ID);

    expect(projection.rotoPhysical).toBeNull();
    expect(Array.from(projection.frames.keys())).toEqual(sourceFrames);
  });

  it('Debug 08 ends the custom generated sequence at final real display 26', () => {
    seedDebug08CustomRotoModel();

    const cache = physicPaintStore.getRotoCacheFrames('layer-1', TEST_TRACK_ID);

    expect(cache.map((frame) => frame.appFrame)).toEqual(Array.from({ length: 27 }, (_, frame) => frame));
    expect(cache.filter((frame) => frame.source === 'real-key').map((frame) => ({
      displayFrame: frame.displayFrame,
      sourceFrame: frame.sourceFrame,
      dataUrl: frame.dataUrl,
    }))).toEqual([
      { displayFrame: 0, sourceFrame: 0, dataUrl: makeAlphaFrame(0, 0, 'A').dataUrl },
      { displayFrame: 3, sourceFrame: 1, dataUrl: makeAlphaFrame(0, 1, 'B').dataUrl },
      { displayFrame: 6, sourceFrame: 2, dataUrl: makeAlphaFrame(0, 2, 'C').dataUrl },
      { displayFrame: 9, sourceFrame: 3, dataUrl: makeAlphaFrame(0, 3, 'D').dataUrl },
      { displayFrame: 14, sourceFrame: 14, dataUrl: makeAlphaFrame(0, 14, 'E').dataUrl },
      { displayFrame: 26, sourceFrame: 26, dataUrl: makeAlphaFrame(0, 26, 'F').dataUrl },
    ]);
    expect(physicPaintStore.getRotoFrame('layer-1', TEST_TRACK_ID, 27)).toBeNull();
  });

  it('D-09 clamps excessive custom spacing and bounds generated cache output', () => {
    physicPaintStore.upsertRealRotoKeyFrame('layer-1', TEST_TRACK_ID, 2, makeAlphaFrame(0, 2, 'bounded-two'));
    physicPaintStore.upsertRealRotoKeyFrame('layer-1', TEST_TRACK_ID, 6, makeAlphaFrame(0, 6, 'bounded-six'));

    const generated = physicPaintStore.setRotoInterpolationSettings('layer-1', TEST_TRACK_ID, {
      enabled: true,
      inBetweenCount: 1,
      mode: 'duplicate',
      deform: 0,
      position: 0,
      segmentSpacingOverrides: [{ fromSourceFrame: 2, toSourceFrame: 6, inBetweenCount: PHYSIC_PAINT_MAX_APPLY_FRAMES + 50 }],
    });

    expect(physicPaintStore.getRotoInterpolationSettings('layer-1', TEST_TRACK_ID).segmentSpacingOverrides).toEqual([{ fromSourceFrame: 2, toSourceFrame: 6, inBetweenCount: PHYSIC_PAINT_MAX_APPLY_FRAMES }]);
    expect(generated).toHaveLength(PHYSIC_PAINT_MAX_APPLY_FRAMES);
    expect(physicPaintStore.getRotoCacheFrames('layer-1', TEST_TRACK_ID).filter(frame => frame.source === 'generated-interpolation')).toHaveLength(PHYSIC_PAINT_MAX_APPLY_FRAMES);
  });

  it('preserves custom segment spacing when the global count changes and invalidates the visual version', () => {
    physicPaintStore.upsertRealRotoKeyFrame('layer-1', TEST_TRACK_ID, 0, makeAlphaFrame(0, 0, 'global-zero'));
    physicPaintStore.upsertRealRotoKeyFrame('layer-1', TEST_TRACK_ID, 1, makeAlphaFrame(0, 1, 'global-one'));
    physicPaintStore.upsertRealRotoKeyFrame('layer-1', TEST_TRACK_ID, 2, makeAlphaFrame(0, 2, 'global-two'));
    physicPaintStore.upsertRealRotoKeyFrame('layer-1', TEST_TRACK_ID, 6, makeAlphaFrame(0, 6, 'global-six'));
    physicPaintStore.setRotoInterpolationSettings('layer-1', TEST_TRACK_ID, {
      enabled: true,
      inBetweenCount: 2,
      mode: 'duplicate',
      deform: 0,
      position: 0,
      segmentSpacingOverrides: [{ fromSourceFrame: 2, toSourceFrame: 6, inBetweenCount: 4 }],
    });
    const before = physicPaintVersion.value;

    physicPaintStore.setRotoInterpolationSettings('layer-1', TEST_TRACK_ID, { enabled: true, inBetweenCount: 1, mode: 'duplicate', deform: 0, position: 0 });

    expect(physicPaintVersion.value).toBeGreaterThan(before);
    expect(physicPaintStore.getRotoInterpolationSettings('layer-1', TEST_TRACK_ID)).toEqual({
      enabled: true,
      inBetweenCount: 1,
      mode: 'duplicate',
      deform: 0,
      position: 0,
      segmentSpacingOverrides: [{ fromSourceFrame: 2, toSourceFrame: 6, inBetweenCount: 4 }],
    });
    expect(physicPaintStore.getRotoCacheFrames('layer-1', TEST_TRACK_ID)).toEqual(expect.arrayContaining([
      expect.objectContaining({ appFrame: 0, source: 'real-key', sourceFrame: 0 }),
      expect.objectContaining({ appFrame: 1, source: 'generated-interpolation', fromSourceFrame: 0, toSourceFrame: 1 }),
      expect.objectContaining({ appFrame: 2, source: 'real-key', sourceFrame: 1 }),
      expect.objectContaining({ appFrame: 3, source: 'generated-interpolation', fromSourceFrame: 1, toSourceFrame: 2 }),
      expect.objectContaining({ appFrame: 4, source: 'real-key', sourceFrame: 2 }),
      expect.objectContaining({ appFrame: 5, source: 'generated-interpolation', fromSourceFrame: 2, toSourceFrame: 6 }),
      expect.objectContaining({ appFrame: 6, source: 'generated-interpolation', fromSourceFrame: 2, toSourceFrame: 6 }),
      expect.objectContaining({ appFrame: 7, source: 'generated-interpolation', fromSourceFrame: 2, toSourceFrame: 6 }),
      expect.objectContaining({ appFrame: 8, source: 'generated-interpolation', fromSourceFrame: 2, toSourceFrame: 6 }),
      expect.objectContaining({ appFrame: 9, source: 'real-key', sourceFrame: 6 }),
    ]));
  });

  it('derives duplicate Roto in-betweens from persisted real keys and enabled interpolation state', () => {
    const realCircle = makeFrame(0, 0);
    const realCross = makeFrame(0, 2);
    const records = [
      { keyId: 'key-0', appFrame: 0, kind: 'real-key' as const, payload: realCircle },
      { keyId: 'key-2', appFrame: 2, kind: 'real-key' as const, payload: realCross },
    ];
    const interpolation = { enabled: true, mode: 'duplicate' as const };
    const document = parsePhysicPaintRotoPhysicalDocument({
      capacity: 600,
      realKeyRecords: records,
      interpolation,
      scriptMotion: { deformation: 0, position: 0 },
      background: null,
      selectedKeyId: null,
      cursorAppFrame: 0,
      revision: buildPhysicPaintRotoPhysicalRevision(records, interpolation, []),
      loopClips: [],
      incomingInterpolationBreakKeyIds: [],
    });
    expect(physicPaintStore.replaceRotoPhysicalDocument('layer-1', TEST_TRACK_ID, document).ok).toBe(true);

    // v1.0 save/load round-trip: the physical document survives hydration and
    // the render source derives duplicate in-betweens at every interior appFrame.
    const projection = physicPaintStore.extractRuntimeStateForDocument('layer-1', TEST_TRACK_ID);
    physicPaintStore.reset();
    physicPaintStore.installRuntimeStateFromDocument('layer-1', TEST_TRACK_ID, projection);

    expect(physicPaintStore.getRotoPhysicalRenderSource('layer-1', TEST_TRACK_ID, 0)).toMatchObject({ kind: 'real', appFrame: 0, renderedFrame: { dataUrl: realCircle.dataUrl } });
    expect(physicPaintStore.getRotoPhysicalRenderSource('layer-1', TEST_TRACK_ID, 1)).toMatchObject({ kind: 'generated', appFrame: 1, leftKeyId: 'key-0', rightKeyId: 'key-2', renderedFrame: { dataUrl: realCircle.dataUrl } });
    expect(physicPaintStore.getRotoPhysicalRenderSource('layer-1', TEST_TRACK_ID, 2)).toMatchObject({ kind: 'real', appFrame: 2, renderedFrame: { dataUrl: realCross.dataUrl } });
    expect(physicPaintStore.getRotoPhysicalRenderSource('layer-1', TEST_TRACK_ID, 3)).toBeNull();
  });

  it('keeps interpolation disabled after project load and does not derive generated Roto frames', () => {
    const realOne = makeAlphaFrame(0, 1, 'disabled-real-one');
    const realFour = makeAlphaFrame(0, 4, 'disabled-real-four');
    const records = [
      { keyId: 'key-1', appFrame: 1, kind: 'real-key' as const, payload: realOne },
      { keyId: 'key-4', appFrame: 4, kind: 'real-key' as const, payload: realFour },
    ];
    const interpolation = { enabled: false, mode: 'blend' as const };
    const document = parsePhysicPaintRotoPhysicalDocument({
      capacity: 600,
      realKeyRecords: records,
      interpolation,
      scriptMotion: { deformation: 0, position: 0 },
      background: null,
      selectedKeyId: null,
      cursorAppFrame: 0,
      revision: buildPhysicPaintRotoPhysicalRevision(records, interpolation, []),
      loopClips: [],
      incomingInterpolationBreakKeyIds: [],
    });
    expect(physicPaintStore.replaceRotoPhysicalDocument('layer-1', TEST_TRACK_ID, document).ok).toBe(true);

    // v1.0 save/load round-trip: disabled interpolation state survives and no
    // generated frame is derived between the real keys.
    const projection = physicPaintStore.extractRuntimeStateForDocument('layer-1', TEST_TRACK_ID);
    physicPaintStore.reset();
    physicPaintStore.installRuntimeStateFromDocument('layer-1', TEST_TRACK_ID, projection);

    expect(physicPaintStore.getRotoPhysicalInterpolationState('layer-1', TEST_TRACK_ID)).toEqual({ enabled: false, mode: 'blend' });
    expect(physicPaintStore.getRotoPhysicalRenderSource('layer-1', TEST_TRACK_ID, 1)).toMatchObject({ kind: 'real', appFrame: 1, renderedFrame: { dataUrl: realOne.dataUrl } });
    expect(physicPaintStore.getRotoPhysicalRenderSource('layer-1', TEST_TRACK_ID, 4)).toMatchObject({ kind: 'real', appFrame: 4, renderedFrame: { dataUrl: realFour.dataUrl } });
    expect(physicPaintStore.getRotoPhysicalRenderSource('layer-1', TEST_TRACK_ID, 2)).toBeNull();
    expect(physicPaintStore.getRotoPhysicalRenderSource('layer-1', TEST_TRACK_ID, 3)).toBeNull();
  });

  it('extracts and installs rendered output by layer and app frame', () => {
    physicPaintStore.setFrame('layer-1', TEST_TRACK_ID, 12, makeFrame(0, 12));
    physicPaintStore.setFrame('layer-1', TEST_TRACK_ID, 10, makeFrame(0, 10));
    physicPaintStore.setFrame('layer-2', TEST_TRACK_ID, 4, makeFrame(0, 4));

    const projectionOne = physicPaintStore.extractRuntimeStateForDocument('layer-1', TEST_TRACK_ID);
    const projectionTwo = physicPaintStore.extractRuntimeStateForDocument('layer-2', TEST_TRACK_ID);

    expect(Array.from(projectionOne.frames.keys()).sort((a, b) => a - b)).toEqual([10, 12]);
    expect(Array.from(projectionTwo.frames.keys())).toEqual([4]);
    expect(projectionOne.rotoPhysical).toBeNull();
    expect(projectionTwo.rotoPhysical).toBeNull();

    physicPaintStore.reset();
    physicPaintStore.installRuntimeStateFromDocument('layer-1', TEST_TRACK_ID, projectionOne);
    physicPaintStore.installRuntimeStateFromDocument('layer-2', TEST_TRACK_ID, projectionTwo);

    expect(physicPaintStore.getFrame('layer-1', TEST_TRACK_ID, 10)?.dataUrl).toContain('data:image/png');
    expect(physicPaintStore.getFrame('layer-1', TEST_TRACK_ID, 12)?.appFrame).toBe(12);
    expect(physicPaintStore.getFrame('layer-2', TEST_TRACK_ID, 4)?.width).toBe(1000);
  });




  it('uses typed helpers to clamp invalid frame counts', () => {
    expect(clampPhysicPaintFrameCount(-10)).toBe(1);
    expect(clampPhysicPaintFrameCount(1000)).toBe(600);
    expect(clampPhysicPaintFrameCount(undefined)).toBe(4);
  });

  it('clears one layer and resets all output with version bumps', () => {
    physicPaintStore.setFrame('layer-1', TEST_TRACK_ID, 1, makeFrame(0, 1));
    physicPaintStore.setFrame('layer-2', TEST_TRACK_ID, 1, makeFrame(0, 1));
    physicPaintStore.setRotoBackgroundMetadata('layer-1', TEST_TRACK_ID, { background: 'canvas1', paperGrain: 'canvas1', grainStrength: 0.45 });
    physicPaintStore.setRotoBackgroundMetadata('layer-2', TEST_TRACK_ID, { background: 'canvas2', paperGrain: 'canvas3', grainStrength: 0.65 });
    const afterSet = physicPaintVersion.value;

    physicPaintStore.clearLayer('layer-1');
    expect(physicPaintStore.hasOutput('layer-1', TEST_TRACK_ID)).toBe(false);
    expect(physicPaintStore.getRotoBackgroundMetadata('layer-1', TEST_TRACK_ID)).toBeNull();
    expect(physicPaintStore.hasOutput('layer-2', TEST_TRACK_ID)).toBe(true);
    expect(physicPaintStore.getRotoBackgroundMetadata('layer-2', TEST_TRACK_ID)).toEqual({ background: 'canvas2', paperGrain: 'canvas3', grainStrength: 0.65 });
    expect(physicPaintVersion.value).toBe(afterSet + 1);

    physicPaintStore.reset();
    expect(physicPaintStore.hasOutput('layer-2', TEST_TRACK_ID)).toBe(false);
    expect(physicPaintStore.getRotoBackgroundMetadata('layer-2', TEST_TRACK_ID)).toBeNull();
    expect(physicPaintVersion.value).toBe(afterSet + 2);
  });

  it('clears and restores interpolation failure status with the layer snapshot', () => {
    physicPaintStore.upsertRealRotoKeyFrame('layer-1', TEST_TRACK_ID, 1, makeAlphaFrame(0, 1, 'failure-one'));
    physicPaintStore.upsertRealRotoKeyFrame('layer-1', TEST_TRACK_ID, 4, makeAlphaFrame(0, 4, 'failure-four'));
    physicPaintStore.setRotoInterpolationSettings('layer-1', TEST_TRACK_ID, { enabled: true, inBetweenCount: 1, mode: 'blend', position: 0, deform: 0 });
    const originalAtob = globalThis.atob;
    vi.stubGlobal('atob', () => { throw new Error('decode failed'); });
    try {
      physicPaintStore.upsertRealRotoKeyFrame('layer-1', TEST_TRACK_ID, 4, makeAlphaFrame(0, 4, 'failure-four-updated'));
    } finally {
      vi.stubGlobal('atob', originalAtob);
    }
    expect(physicPaintStore.getRotoInterpolationFailureStatus('layer-1', TEST_TRACK_ID)).toBe('Generated in-betweens could not regenerate. Real keys were kept.');
    const snapshot = physicPaintStore.snapshotLayer('layer-1', TEST_TRACK_ID);
    expect(snapshot).not.toBeNull();

    physicPaintStore.clearLayer('layer-1');
    expect(physicPaintStore.getRotoInterpolationFailureStatus('layer-1', TEST_TRACK_ID)).toBeNull();

    physicPaintStore.restoreLayer(snapshot!);
    expect(physicPaintStore.getRotoInterpolationFailureStatus('layer-1', TEST_TRACK_ID)).toBe('Generated in-betweens could not regenerate. Real keys were kept.');
    expect(physicPaintStore.getRealRotoKeyFrames('layer-1', TEST_TRACK_ID)).toEqual([1, 4]);
  });

  it('restores complete layer state without replacing a shared alpha canvas', () => {
    const originalDocument = globalThis.document;
    const drawCalls: string[] = [];
    const outputCanvas = {
      width: 0,
      height: 0,
      getContext: () => ({
        globalAlpha: 1,
        clearRect: vi.fn(),
        drawImage(source: { id: string }) {
          drawCalls.push(source.id);
        },
      }),
      toDataURL: () => 'data:image/png;base64,restored-alpha-blend',
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
    const targetOnly = makeAlphaFrame(0, 0, 'target-only-alpha');
    const shared = makeAlphaFrame(0, 2, 'shared-alpha');
    const survivorOnly = makeAlphaFrame(0, 4, 'survivor-only-alpha');
    registerRotoAlphaCanvasFrame(targetOnly.dataUrl, { id: 'target-original', width: 2, height: 2 } as unknown as HTMLCanvasElement);
    registerRotoAlphaCanvasFrame(shared.dataUrl, { id: 'shared-at-snapshot', width: 2, height: 2 } as unknown as HTMLCanvasElement);
    physicPaintStore.upsertRealRotoKeyFrame('target-layer', TEST_TRACK_ID, 0, targetOnly);
    physicPaintStore.upsertRealRotoKeyFrame('target-layer', TEST_TRACK_ID, 2, shared);
    physicPaintStore.setRotoInterpolationSettings('target-layer', TEST_TRACK_ID, { enabled: true, inBetweenCount: 1, mode: 'duplicate', position: 0, deform: 0 });
    physicPaintStore.setRotoBackgroundMetadata('target-layer', TEST_TRACK_ID, { background: 'canvas2', paperGrain: 'canvas3', grainStrength: 0.65 });
    const outputBefore = physicPaintStore.extractRuntimeStateForDocument('target-layer', TEST_TRACK_ID);
    const cacheBefore = physicPaintStore.getRotoCacheFrames('target-layer', TEST_TRACK_ID);
    const snapshot = physicPaintStore.snapshotLayer('target-layer', TEST_TRACK_ID);
    expect(snapshot).not.toBeNull();

    physicPaintStore.upsertRealRotoKeyFrame('survivor-layer', TEST_TRACK_ID, 2, shared);
    physicPaintStore.upsertRealRotoKeyFrame('survivor-layer', TEST_TRACK_ID, 4, survivorOnly);
    registerRotoAlphaCanvasFrame(shared.dataUrl, { id: 'shared-current', width: 2, height: 2 } as unknown as HTMLCanvasElement);
    registerRotoAlphaCanvasFrame(survivorOnly.dataUrl, { id: 'survivor-current', width: 2, height: 2 } as unknown as HTMLCanvasElement);

    try {
      physicPaintStore.clearLayer('target-layer');

      expect(physicPaintStore.extractRuntimeStateForDocument('target-layer', TEST_TRACK_ID)).toEqual({ trackId: TEST_TRACK_ID, frames: new Map(), rotoPhysical: null });
      expect(physicPaintStore.getRotoCacheFrames('target-layer', TEST_TRACK_ID)).toEqual([]);
      drawCalls.length = 0;
      expect(renderBlendedRotoInterpolationFrame(shared, survivorOnly, 3, 0.5, { enabled: true, inBetweenCount: 1, mode: 'blend', position: 0, deform: 0 })?.dataUrl).toBe('data:image/png;base64,restored-alpha-blend');
      expect(drawCalls).toEqual(['shared-current', 'survivor-current']);

      physicPaintStore.restoreLayer(snapshot!);

      expect(physicPaintStore.extractRuntimeStateForDocument('target-layer', TEST_TRACK_ID)).toEqual(outputBefore);
      expect(physicPaintStore.getRotoCacheFrames('target-layer', TEST_TRACK_ID)).toEqual(cacheBefore);
      expect(physicPaintStore.getRotoInterpolationSettings('target-layer', TEST_TRACK_ID)).toEqual({ enabled: true, inBetweenCount: 1, mode: 'duplicate', position: 0, deform: 0 });
      expect(physicPaintStore.getRotoBackgroundMetadata('target-layer', TEST_TRACK_ID)).toEqual({ background: 'canvas2', paperGrain: 'canvas3', grainStrength: 0.65 });
      drawCalls.length = 0;
      expect(renderBlendedRotoInterpolationFrame(targetOnly, shared, 1, 0.5, { enabled: true, inBetweenCount: 1, mode: 'blend', position: 0, deform: 0 })?.dataUrl).toBe('data:image/png;base64,restored-alpha-blend');
      expect(drawCalls).toEqual(['target-original', 'shared-current']);
    } finally {
      Object.defineProperty(globalThis, 'document', { configurable: true, value: originalDocument });
    }
  });

  it('preserves real Roto keys while toggling interpolation generated frames on and off', () => {
    physicPaintStore.upsertRealRotoKeyFrame('layer-1', TEST_TRACK_ID, 1, makeAlphaFrame(0, 1, 'alpha-real-one'));
    physicPaintStore.upsertRealRotoKeyFrame('layer-1', TEST_TRACK_ID, 4, makeAlphaFrame(0, 4, 'alpha-real-four'));

    physicPaintStore.setRotoInterpolationSettings('layer-1', TEST_TRACK_ID, { enabled: true, inBetweenCount: 2, mode: 'duplicate', position: 0, deform: 0 });

    expect(physicPaintStore.getRealRotoKeyFrames('layer-1', TEST_TRACK_ID)).toEqual([1, 4]);
    expect(physicPaintStore.getRotoCacheFrames('layer-1', TEST_TRACK_ID)).toEqual([
      expect.objectContaining({ appFrame: 1, source: 'real-key' }),
      expect.objectContaining({ appFrame: 2, source: 'generated-interpolation', nearestRealKeyFrame: 1 }),
      expect.objectContaining({ appFrame: 3, source: 'generated-interpolation', nearestRealKeyFrame: 1 }),
      expect.objectContaining({ appFrame: 4, source: 'real-key' }),
    ]);

    physicPaintStore.setRotoInterpolationSettings('layer-1', TEST_TRACK_ID, { enabled: false });

    expect(physicPaintStore.getRealRotoKeyFrames('layer-1', TEST_TRACK_ID)).toEqual([1, 4]);
    expect(physicPaintStore.getRotoCacheFrames('layer-1', TEST_TRACK_ID)).toEqual([
      expect.objectContaining({ appFrame: 1, source: 'real-key' }),
      expect.objectContaining({ appFrame: 4, source: 'real-key' }),
    ]);
    expect(physicPaintStore.getRotoInterpolationSettings('layer-1', TEST_TRACK_ID)).toEqual(expect.objectContaining({ enabled: false }));
  });

  it('writes generated interpolation cache with source-neighbor provenance without moving real keys', () => {
    const realOne = makeAlphaFrame(0, 1, 'alpha-real-one');
    const realFour = makeAlphaFrame(0, 4, 'alpha-real-four');
    physicPaintStore.upsertRealRotoKeyFrame('layer-1', TEST_TRACK_ID, 1, realOne);
    physicPaintStore.upsertRealRotoKeyFrame('layer-1', TEST_TRACK_ID, 4, realFour);

    physicPaintStore.setRotoInterpolationSettings('layer-1', TEST_TRACK_ID, { enabled: true, inBetweenCount: 2, mode: 'duplicate', position: 0, deform: 0 });

    expect(physicPaintStore.getFrame('layer-1', TEST_TRACK_ID, 1)?.dataUrl).toBe(realOne.dataUrl);
    expect(physicPaintStore.getFrame('layer-1', TEST_TRACK_ID, 4)?.dataUrl).toBe(realFour.dataUrl);
    expect(physicPaintStore.getRotoCacheFrames('layer-1', TEST_TRACK_ID)).toEqual([
      expect.objectContaining({ appFrame: 1, source: 'real-key' }),
      expect.objectContaining({ appFrame: 2, source: 'generated-interpolation', nearestRealKeyFrame: 1, fromSourceFrame: 1, toSourceFrame: 4, interpolationT: 1 / 3 }),
      expect.objectContaining({ appFrame: 3, source: 'generated-interpolation', nearestRealKeyFrame: 1, fromSourceFrame: 1, toSourceFrame: 4, interpolationT: 2 / 3 }),
      expect.objectContaining({ appFrame: 4, source: 'real-key' }),
    ]);
  });

  it('generates alpha-only Roto interpolation cache across whole integer spans with real-key authority', () => {
    physicPaintStore.upsertRealRotoKeyFrame('layer-1', TEST_TRACK_ID, 1, makeAlphaFrame(0, 1, 'alpha-real-one'));
    physicPaintStore.upsertRealRotoKeyFrame('layer-1', TEST_TRACK_ID, 4, makeAlphaFrame(0, 4, 'alpha-real-four'));
    physicPaintStore.setRotoBackgroundMetadata('layer-1', TEST_TRACK_ID, { background: 'canvas1', paperGrain: 'canvas1', grainStrength: 0.45 });
    physicPaintStore.recomputeBackgroundOnlyRotoSupport('layer-1', TEST_TRACK_ID, [2, 3]);
    const before = physicPaintVersion.value;

    const generated = physicPaintStore.setRotoInterpolationSettings('layer-1', TEST_TRACK_ID, {
      enabled: true,
      inBetweenCount: 1,
      mode: 'duplicate',
      position: 25,
      deform: 50,
    });

    expect(generated.map(frame => frame.appFrame)).toEqual([2]);
    expect(generated.every(frame => frame.dataUrl.startsWith('data:image/png;base64,'))).toBe(true);
    expect(JSON.stringify(generated)).not.toContain('alpha-blend:');
    expect(JSON.stringify(generated)).not.toContain('background-only-support');
    expect(physicPaintStore.getRealRotoKeyFrames('layer-1', TEST_TRACK_ID)).toEqual([1, 4]);
    expect(physicPaintStore.getRotoCacheFrames('layer-1', TEST_TRACK_ID)).toEqual([
      expect.objectContaining({ appFrame: 1, source: 'real-key', sourceFrame: 1 }),
      expect.objectContaining({ appFrame: 2, source: 'generated-interpolation', nearestRealKeyFrame: 1 }),
      expect.objectContaining({ appFrame: 3, source: 'real-key', sourceFrame: 4, displayFrame: 3 }),
    ]);
    expect(physicPaintStore.getBackgroundOnlyRotoSupportFrames('layer-1', TEST_TRACK_ID)).toEqual([]);
    expect(physicPaintVersion.value).toBeGreaterThan(before);

    physicPaintStore.upsertRealRotoKeyFrame('layer-1', TEST_TRACK_ID, 2, makeAlphaFrame(0, 2, 'alpha-real-two'));
    expect(physicPaintStore.getRotoCacheFrames('layer-1', TEST_TRACK_ID)).toEqual([
      expect.objectContaining({ appFrame: 1, source: 'real-key', sourceFrame: 1 }),
      expect.objectContaining({ appFrame: 2, source: 'generated-interpolation', nearestRealKeyFrame: 1 }),
      expect.objectContaining({ appFrame: 3, source: 'real-key', sourceFrame: 2, displayFrame: 3 }),
      expect.objectContaining({ appFrame: 4, source: 'generated-interpolation', nearestRealKeyFrame: 2 }),
      expect.objectContaining({ appFrame: 5, source: 'real-key', sourceFrame: 4, displayFrame: 5 }),
    ]);
    expect(physicPaintStore.getFrame('layer-1', TEST_TRACK_ID, 2)?.dataUrl).toBe(makeAlphaFrame(0, 2, 'alpha-real-two').dataUrl);
  });

  it('normalizes visible hold and alpha-blend modes to the selected generated render branch', () => {
    const previous = makeAlphaFrame(0, 1, 'alpha-previous');
    const next = makeAlphaFrame(0, 4, 'alpha-next');
    physicPaintStore.upsertRealRotoKeyFrame('layer-1', TEST_TRACK_ID, 1, previous);
    physicPaintStore.upsertRealRotoKeyFrame('layer-1', TEST_TRACK_ID, 4, next);

    physicPaintStore.setRotoInterpolationSettings('layer-1', TEST_TRACK_ID, { enabled: true, inBetweenCount: 1, mode: 'hold' as never, position: 0, deform: 0 });
    expect(physicPaintStore.getRotoInterpolationSettings('layer-1', TEST_TRACK_ID)).toEqual({ enabled: true, inBetweenCount: 1, mode: 'duplicate', position: 0, deform: 0 });
    expect(physicPaintStore.getRotoFrame('layer-1', TEST_TRACK_ID, 2)?.dataUrl).toBe(previous.dataUrl);

    const originalDocument = globalThis.document;
    Object.defineProperty(globalThis, 'document', {
      configurable: true,
      value: {
        createElement: (tagName: string) => {
          if (tagName !== 'canvas') throw new Error(`Unexpected element ${tagName}`);
          const drawn: string[] = [];
          return {
            width: 0,
            height: 0,
            getContext: () => ({
              globalAlpha: 1,
              clearRect: vi.fn(),
              drawImage(source: { id: string }) { drawn.push(source.id); },
            }),
            toDataURL: () => `data:image/png;base64,blend(${drawn.join('|')})`,
          };
        },
      },
    });
    registerRotoAlphaCanvasFrame(previous.dataUrl, { id: 'previous-canvas', width: 2, height: 2 } as unknown as HTMLCanvasElement);
    registerRotoAlphaCanvasFrame(next.dataUrl, { id: 'next-canvas', width: 2, height: 2 } as unknown as HTMLCanvasElement);

    try {
      physicPaintStore.setRotoInterpolationSettings('layer-1', TEST_TRACK_ID, { enabled: true, inBetweenCount: 1, mode: 'alpha-blend' as never, position: 0, deform: 0 });
      expect(physicPaintStore.getRotoInterpolationSettings('layer-1', TEST_TRACK_ID)).toEqual({ enabled: true, inBetweenCount: 1, mode: 'blend', position: 0, deform: 0 });
      expect(physicPaintStore.getRotoFrame('layer-1', TEST_TRACK_ID, 2)?.dataUrl).toBe('data:image/png;base64,blend(previous-canvas|next-canvas)');
      expect(physicPaintStore.getRotoFrame('layer-1', TEST_TRACK_ID, 2)?.dataUrl).not.toBe(previous.dataUrl);
      expect(physicPaintStore.getRotoCacheFrames('layer-1', TEST_TRACK_ID)).toContainEqual(expect.objectContaining({ appFrame: 2, source: 'generated-interpolation', fromSourceFrame: 1, toSourceFrame: 4, interpolationT: 0.5 }));
    } finally {
      Object.defineProperty(globalThis, 'document', { configurable: true, value: originalDocument });
    }
  });

  it('renders blend interpolation as generated PNG data derived from both neighboring alpha sources', () => {
    const settings = { enabled: true, inBetweenCount: 1, mode: 'blend' as const, position: 33, deform: 44 };
    const first = makeAlphaFrame(0, 1, 'alpha-first');
    const second = makeAlphaFrame(0, 3, 'alpha-second');
    const originalDocument = globalThis.document;
    Object.defineProperty(globalThis, 'document', {
      configurable: true,
      value: {
        createElement: (tagName: string) => {
          if (tagName !== 'canvas') throw new Error(`Unexpected element ${tagName}`);
          const drawn: string[] = [];
          return {
            width: 0,
            height: 0,
            getContext: () => ({
              globalAlpha: 1,
              clearRect: vi.fn(),
              drawImage(source: { id: string }) { drawn.push(source.id); },
            }),
            toDataURL: () => `data:image/png;base64,blend(${drawn.join('|')})`,
          };
        },
      },
    });
    registerRotoAlphaCanvasFrame(first.dataUrl, { id: 'first-canvas', width: 2, height: 2 } as unknown as HTMLCanvasElement);
    registerRotoAlphaCanvasFrame(second.dataUrl, { id: 'second-canvas', width: 2, height: 2 } as unknown as HTMLCanvasElement);
    registerRotoAlphaCanvasFrame(makeAlphaFrame(0, 1, 'alpha-first-changed').dataUrl, { id: 'first-changed-canvas', width: 2, height: 2 } as unknown as HTMLCanvasElement);
    registerRotoAlphaCanvasFrame(makeAlphaFrame(0, 3, 'alpha-second-changed').dataUrl, { id: 'second-changed-canvas', width: 2, height: 2 } as unknown as HTMLCanvasElement);

    try {
      const blend = renderBlendedRotoInterpolationFrame(first, second, 2, 0.5, settings);
      const changedFirst = renderBlendedRotoInterpolationFrame(makeAlphaFrame(0, 1, 'alpha-first-changed'), second, 2, 0.5, settings);
      const changedSecond = renderBlendedRotoInterpolationFrame(first, makeAlphaFrame(0, 3, 'alpha-second-changed'), 2, 0.5, settings);
      const changedBackground = renderBlendedRotoInterpolationFrame({ ...first, backgroundOnly: true, nearestRealKeyFrame: 99 } as never, { ...second, onionDataUrl: 'data:image/png;base64,cGFwZXI=' } as never, 2, 0.5, settings);

      expect(blend).toMatchObject({ appFrame: 2, frameIndex: 0, source: 'generated-interpolation', width: 2, height: 2 });
      if (!blend || !changedFirst || !changedSecond || !changedBackground) throw new Error('Expected blended frames from registered alpha canvases.');
      expect(blend.dataUrl).toMatch(/^data:image\/png;base64,/);
      expect(blend.dataUrl).toContain('first-canvas');
      expect(blend.dataUrl).toContain('second-canvas');
      expect(blend.dataUrl).not.toContain('alpha-blend:');
      expect(blend.dataUrl).not.toContain('pos=33');
      expect(blend.dataUrl).not.toContain('deform=44');
      expect(changedFirst.dataUrl).not.toBe(blend.dataUrl);
      expect(changedSecond.dataUrl).not.toBe(blend.dataUrl);
      expect(changedBackground.dataUrl).toBe(blend.dataUrl);
    } finally {
      Object.defineProperty(globalThis, 'document', { configurable: true, value: originalDocument });
    }
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

      expect(blend?.dataUrl).toBe('data:image/png;base64,visible-blended-png');
      expect(blend?.dataUrl).not.toContain('alpha-blend:');
      expect(drawCalls).toHaveLength(2);
      expect(drawCalls[0].source).toBe('first-canvas');
      expect(drawCalls[0].alpha).toBeCloseTo(2 / 3);
      expect(drawCalls[1].source).toBe('second-canvas');
      expect(drawCalls[1].alpha).toBeCloseTo(1 / 3);
    } finally {
      Object.defineProperty(globalThis, 'document', { configurable: true, value: originalDocument });
    }
  });

  it('D-07 projection carries bounded background-only support only inside real Roto key spans', () => {
    physicPaintStore.upsertRealRotoKeyFrame('layer-1', TEST_TRACK_ID, 2, makeFrame(0, 2));
    physicPaintStore.upsertRealRotoKeyFrame('layer-1', TEST_TRACK_ID, 6, makeFrame(0, 6));
    physicPaintStore.setRotoBackgroundMetadata('layer-1', TEST_TRACK_ID, { background: 'canvas2', paperGrain: 'canvas3', grainStrength: 0.65 });

    const support = physicPaintStore.recomputeBackgroundOnlyRotoSupport('layer-1', TEST_TRACK_ID, [4]);

    expect(support).toEqual([expect.objectContaining({ appFrame: 4, source: 'background-only-support', backgroundOnly: true, nearestRealKeyFrame: 2 })]);
    expect(physicPaintStore.getBackgroundOnlyRotoSupportFrames('layer-1', TEST_TRACK_ID)).toEqual([4]);
    const projection = physicPaintStore.extractRuntimeStateForDocument('layer-1', TEST_TRACK_ID);
    expect(Array.from(projection.frames.keys()).sort((a, b) => a - b)).toEqual([2, 4, 6]);
    expect(projection.rotoPhysical).toBeNull();
  });

  it('D-05/D-06 does not keep leading or trailing background-only support', () => {
    physicPaintStore.upsertRealRotoKeyFrame('layer-1', TEST_TRACK_ID, 2, makeFrame(0, 2));
    physicPaintStore.upsertRealRotoKeyFrame('layer-1', TEST_TRACK_ID, 6, makeFrame(0, 6));
    physicPaintStore.setRotoBackgroundMetadata('layer-1', TEST_TRACK_ID, { background: 'canvas2', paperGrain: 'canvas3', grainStrength: 0.65 });

    const before = physicPaintStore.extractRuntimeStateForDocument('layer-1', TEST_TRACK_ID);
    const support = physicPaintStore.recomputeBackgroundOnlyRotoSupport('layer-1', TEST_TRACK_ID, [1, 8]);

    expect(support).toEqual([]);
    expect(physicPaintStore.getFrame('layer-1', TEST_TRACK_ID, 1)).toBeNull();
    expect(physicPaintStore.getFrame('layer-1', TEST_TRACK_ID, 8)).toBeNull();
    expect(physicPaintStore.extractRuntimeStateForDocument('layer-1', TEST_TRACK_ID)).toEqual(before);
  });

  it('D-05/D-06 ignores stale trailing rendered frames that are not real Roto keys', () => {
    physicPaintStore.setFrame('layer-1', TEST_TRACK_ID, 11, { ...makeFrame(0, 11), dataUrl: 'data:image/png;base64,c3RhbGUtcGFpbnQ=' });
    physicPaintStore.upsertRealRotoKeyFrame('layer-1', TEST_TRACK_ID, 5, makeFrame(0, 5));
    physicPaintStore.upsertRealRotoKeyFrame('layer-1', TEST_TRACK_ID, 7, makeFrame(0, 7));
    physicPaintStore.setRotoBackgroundMetadata('layer-1', TEST_TRACK_ID, { background: 'canvas1', paperGrain: 'canvas1', grainStrength: 0.45 });

    const result = resolveMissingRotoFrameDraw('layer-1', 11, {
      backgroundState: { mode: 'paper', metadata: physicPaintStore.getRotoBackgroundMetadata('layer-1', TEST_TRACK_ID)! },
      realKeyFrames: physicPaintStore.getRealRotoKeyFrames('layer-1', TEST_TRACK_ID),
    });

    expect(physicPaintStore.getFrame('layer-1', TEST_TRACK_ID, 11)).toBeNull();
    expect(physicPaintStore.getRotoFrame('layer-1', TEST_TRACK_ID, 11)).toBeNull();
    expect(result).toEqual({ kind: 'background-only', color: '#f4efe3', paperTexture: 'canvas1', paperGrain: 'canvas1', grainStrength: 0.45, span: { kind: 'trailing', previousRealKeyFrame: 7 }, materialize: false });
  });

  it('D-08/D-14/D-15 keeps derived support separate from editable real-key alpha content', () => {
    physicPaintStore.upsertRealRotoKeyFrame('layer-1', TEST_TRACK_ID, 2, { ...makeFrame(0, 2), dataUrl: 'data:image/png;base64,cmVhbC0y' });
    physicPaintStore.upsertRealRotoKeyFrame('layer-1', TEST_TRACK_ID, 6, { ...makeFrame(0, 6), dataUrl: 'data:image/png;base64,cmVhbC02' });
    physicPaintStore.setRotoBackgroundMetadata('layer-1', TEST_TRACK_ID, { background: 'canvas1', paperGrain: 'canvas1', grainStrength: 0.45 });

    physicPaintStore.recomputeBackgroundOnlyRotoSupport('layer-1', TEST_TRACK_ID, [4]);

    expect(physicPaintStore.getRealRotoKeyFrames('layer-1', TEST_TRACK_ID)).toEqual([2, 6]);
    expect(physicPaintStore.getFrame('layer-1', TEST_TRACK_ID, 2)?.dataUrl).toBe('data:image/png;base64,cmVhbC0y');
    expect(physicPaintStore.getFrame('layer-1', TEST_TRACK_ID, 6)?.dataUrl).toBe('data:image/png;base64,cmVhbC02');
    expect(physicPaintStore.getRotoCacheFrames('layer-1', TEST_TRACK_ID)).toContainEqual(expect.objectContaining({ appFrame: 4, source: 'background-only-support', backgroundOnly: true }));
  });

  it('36.11 merged repaint applyCanvas output stays a real-key alpha cache and not background-only support', () => {
    physicPaintStore.upsertRealRotoKeyFrame('layer-1', TEST_TRACK_ID, 2, makeFrame(0, 2));
    physicPaintStore.upsertRealRotoKeyFrame('layer-1', TEST_TRACK_ID, 6, makeFrame(0, 6));
    physicPaintStore.setRotoBackgroundMetadata('layer-1', TEST_TRACK_ID, { background: 'canvas2', paperGrain: 'canvas3', grainStrength: 0.65 });
    physicPaintStore.recomputeBackgroundOnlyRotoSupport('layer-1', TEST_TRACK_ID, [4]);

    const result = physicPaintStore.applyCanvas({
      kind: 'apply-canvas',
      trackId: TEST_TRACK_ID,
      operationId: 'op-merged-repaint-real-key',
      layerId: 'layer-1',
      startFrame: 4,
      renderedFrame: { ...makeFrame(0, 4), dataUrl: 'data:image/png;base64,bWVyZ2VkLWFscGhhLXJlcGFpbnQ=' },
      editableState,
    });

    expect(result.ok).toBe(true);
    expect(physicPaintStore.getRotoCacheFrames('layer-1', TEST_TRACK_ID)).toContainEqual(expect.objectContaining({
      appFrame: 4,
      source: 'real-key',
    }));
    expect(physicPaintStore.getRotoCacheFrames('layer-1', TEST_TRACK_ID)).not.toContainEqual(expect.objectContaining({
      appFrame: 4,
      source: 'background-only-support',
    }));
    expect(physicPaintStore.getRotoCacheFrames('layer-1', TEST_TRACK_ID)).not.toContainEqual(expect.objectContaining({
      appFrame: 4,
      backgroundOnly: true,
    }));
    expect(physicPaintStore.getBackgroundOnlyRotoSupportFrames('layer-1', TEST_TRACK_ID)).toEqual([]);
    const projection = physicPaintStore.extractRuntimeStateForDocument('layer-1', TEST_TRACK_ID);
    expect(projection.rotoPhysical).toBeNull();
    expect(projection.frames.get(4)?.dataUrl).toBe('data:image/png;base64,bWVyZ2VkLWFscGhhLXJlcGFpbnQ=');
  });

  it('D-09 applyCanvas replaces only the same-frame background-only support with a real Roto key', () => {
    physicPaintStore.upsertRealRotoKeyFrame('layer-1', TEST_TRACK_ID, 2, makeFrame(0, 2));
    physicPaintStore.upsertRealRotoKeyFrame('layer-1', TEST_TRACK_ID, 6, makeFrame(0, 6));
    physicPaintStore.setRotoBackgroundMetadata('layer-1', TEST_TRACK_ID, { background: 'canvas2', paperGrain: 'canvas3', grainStrength: 0.65 });
    physicPaintStore.recomputeBackgroundOnlyRotoSupport('layer-1', TEST_TRACK_ID, [3, 4]);

    const result = physicPaintStore.applyCanvas({
      kind: 'apply-canvas',
      trackId: TEST_TRACK_ID,
      operationId: 'op-replace-support',
      layerId: 'layer-1',
      startFrame: 4,
      renderedFrame: { ...makeFrame(0, 4), dataUrl: 'data:image/png;base64,cmVhbC00' },
      editableState,
    });

    expect(result.ok).toBe(true);
    expect(physicPaintStore.getRotoCacheFrames('layer-1', TEST_TRACK_ID)).toEqual([
      expect.objectContaining({ appFrame: 2, source: 'real-key' }),
      expect.objectContaining({ appFrame: 3, source: 'background-only-support' }),
      expect.objectContaining({ appFrame: 4, source: 'real-key' }),
      expect.objectContaining({ appFrame: 6, source: 'real-key' }),
    ]);
    expect(physicPaintStore.getFrame('layer-1', TEST_TRACK_ID, 4)?.dataUrl).toBe('data:image/png;base64,cmVhbC00');
  });

  it('regenerates enabled interpolation after real-key upsert, removal, replacement, and disables cleanly', () => {
    const alphaOne = makeAlphaFrame(0, 1, 'alpha-one');
    const alphaFour = makeAlphaFrame(0, 4, 'alpha-four');
    const alphaFourChanged = makeAlphaFrame(0, 4, 'alpha-four-changed');
    const alphaTwo = makeAlphaFrame(0, 2, 'alpha-two');
    const alphaFive = makeAlphaFrame(0, 5, 'alpha-five');
    const originalDocument = globalThis.document;
    Object.defineProperty(globalThis, 'document', {
      configurable: true,
      value: {
        createElement: (tagName: string) => {
          if (tagName !== 'canvas') throw new Error(`Unexpected element ${tagName}`);
          const drawn: string[] = [];
          return {
            width: 0,
            height: 0,
            getContext: () => ({
              globalAlpha: 1,
              clearRect: vi.fn(),
              drawImage(source: { id: string }) { drawn.push(source.id); },
            }),
            toDataURL: () => `data:image/png;base64,blend(${drawn.join('|')})`,
          };
        },
      },
    });
    registerRotoAlphaCanvasFrame(alphaOne.dataUrl, { id: 'one-canvas', width: 2, height: 2 } as unknown as HTMLCanvasElement);
    registerRotoAlphaCanvasFrame(alphaFour.dataUrl, { id: 'four-canvas', width: 2, height: 2 } as unknown as HTMLCanvasElement);
    registerRotoAlphaCanvasFrame(alphaFourChanged.dataUrl, { id: 'four-changed-canvas', width: 2, height: 2 } as unknown as HTMLCanvasElement);
    registerRotoAlphaCanvasFrame(alphaTwo.dataUrl, { id: 'two-canvas', width: 2, height: 2 } as unknown as HTMLCanvasElement);
    registerRotoAlphaCanvasFrame(alphaFive.dataUrl, { id: 'five-canvas', width: 2, height: 2 } as unknown as HTMLCanvasElement);

    try {
      physicPaintStore.upsertRealRotoKeyFrame('layer-1', TEST_TRACK_ID, 1, alphaOne);
      physicPaintStore.upsertRealRotoKeyFrame('layer-1', TEST_TRACK_ID, 4, alphaFour);
      physicPaintStore.setRotoInterpolationSettings('layer-1', TEST_TRACK_ID, { enabled: true, inBetweenCount: 1, mode: 'blend', position: 0, deform: 0 });
      const initialGenerated = physicPaintStore.getRotoFrame('layer-1', TEST_TRACK_ID, 2)?.dataUrl;

      physicPaintStore.upsertRealRotoKeyFrame('layer-1', TEST_TRACK_ID, 4, alphaFourChanged);
      expect(physicPaintStore.getRotoFrame('layer-1', TEST_TRACK_ID, 2)?.dataUrl).not.toBe(initialGenerated);
      expect(physicPaintStore.getRotoInterpolationFailureStatus('layer-1', TEST_TRACK_ID)).toBeNull();

      expect(physicPaintStore.removeRealRotoKeyFrame('layer-1', TEST_TRACK_ID, 4)).toBe(true);
      expect(physicPaintStore.getRotoCacheFrames('layer-1', TEST_TRACK_ID)).toEqual([
        expect.objectContaining({ appFrame: 1, source: 'real-key' }),
      ]);

      physicPaintStore.replaceRotoKeyFrames({
        kind: 'replace-roto-key-frames',
        trackId: TEST_TRACK_ID,
        operationId: 'op-replace-regenerate',
        layerId: 'layer-1',
        startFrame: 1,
        frames: [{ ...alphaTwo, source: 'real-key' }, { ...alphaFive, source: 'real-key' }],
      });
      expect(physicPaintStore.getRotoCacheFrames('layer-1', TEST_TRACK_ID)).toEqual([
        expect.objectContaining({ appFrame: 2, source: 'real-key', sourceFrame: 2 }),
        expect.objectContaining({ appFrame: 3, source: 'generated-interpolation', nearestRealKeyFrame: 2 }),
        expect.objectContaining({ appFrame: 4, source: 'real-key', sourceFrame: 5, displayFrame: 4 }),
      ]);

      const beforeDisable = physicPaintVersion.value;
      expect(physicPaintStore.setRotoInterpolationSettings('layer-1', TEST_TRACK_ID, { enabled: false })).toEqual([]);
      expect(physicPaintStore.getRealRotoKeyFrames('layer-1', TEST_TRACK_ID)).toEqual([2, 5]);
      expect(physicPaintStore.getRotoCacheFrames('layer-1', TEST_TRACK_ID).map(frame => frame.source)).toEqual(['real-key', 'real-key']);
      expect(physicPaintVersion.value).toBeGreaterThan(beforeDisable);
    } finally {
      Object.defineProperty(globalThis, 'document', { configurable: true, value: originalDocument });
    }
  });

  it('replacement keeps source real keys and exposes compact failure status when regeneration fails', () => {
    physicPaintStore.upsertRealRotoKeyFrame('layer-1', TEST_TRACK_ID, 1, makeAlphaFrame(0, 1, 'alpha-one'));
    physicPaintStore.upsertRealRotoKeyFrame('layer-1', TEST_TRACK_ID, 4, makeAlphaFrame(0, 4, 'alpha-four'));
    physicPaintStore.setRotoInterpolationSettings('layer-1', TEST_TRACK_ID, { enabled: true, inBetweenCount: 1, mode: 'blend', position: 0, deform: 0 });
    const originalAtob = globalThis.atob;
    vi.stubGlobal('atob', () => { throw new Error('decode failed'); });

    try {
      physicPaintStore.replaceRotoKeyFrames({
        kind: 'replace-roto-key-frames',
        trackId: TEST_TRACK_ID,
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

    expect(physicPaintStore.getRealRotoKeyFrames('layer-1', TEST_TRACK_ID)).toEqual([2, 5]);
    expect(physicPaintStore.getFrame('layer-1', TEST_TRACK_ID, 2)?.dataUrl).toBe(makeAlphaFrame(0, 2, 'alpha-two-kept').dataUrl);
    expect(physicPaintStore.getFrame('layer-1', TEST_TRACK_ID, 5)?.dataUrl).toBe(makeAlphaFrame(0, 5, 'alpha-five-kept').dataUrl);
    expect(physicPaintStore.getRotoCacheFrames('layer-1', TEST_TRACK_ID)).toEqual([
      expect.objectContaining({ appFrame: 2, source: 'real-key' }),
      expect.objectContaining({ appFrame: 5, source: 'real-key' }),
    ]);
    expect(physicPaintStore.getRotoInterpolationFailureStatus('layer-1', TEST_TRACK_ID)).toBe('Generated in-betweens could not regenerate. Real keys were kept.');
  });

  it('keeps real-key mutations and exposes compact failure status when regeneration fails', () => {
    physicPaintStore.upsertRealRotoKeyFrame('layer-1', TEST_TRACK_ID, 1, makeAlphaFrame(0, 1, 'alpha-one'));
    physicPaintStore.upsertRealRotoKeyFrame('layer-1', TEST_TRACK_ID, 4, makeAlphaFrame(0, 4, 'alpha-four'));
    physicPaintStore.setRotoInterpolationSettings('layer-1', TEST_TRACK_ID, { enabled: true, inBetweenCount: 1, mode: 'blend', position: 0, deform: 0 });
    const originalAtob = globalThis.atob;
    vi.stubGlobal('atob', () => { throw new Error('decode failed'); });

    try {
      physicPaintStore.upsertRealRotoKeyFrame('layer-1', TEST_TRACK_ID, 4, makeAlphaFrame(0, 4, 'alpha-failure-kept'));
    } finally {
      vi.stubGlobal('atob', originalAtob);
    }

    expect(physicPaintStore.getFrame('layer-1', TEST_TRACK_ID, 4)?.dataUrl).toBe(makeAlphaFrame(0, 4, 'alpha-failure-kept').dataUrl);
    expect(physicPaintStore.getRotoCacheFrames('layer-1', TEST_TRACK_ID)).toEqual([
      expect.objectContaining({ appFrame: 1, source: 'real-key' }),
      expect.objectContaining({ appFrame: 4, source: 'real-key' }),
    ]);
    expect(physicPaintStore.getRotoInterpolationFailureStatus('layer-1', TEST_TRACK_ID)).toBe('Generated in-betweens could not regenerate. Real keys were kept.');
  });

  it('D-10 replaceRotoKeyFrames removes stale support and recomputes only current bounded interiors', () => {
    physicPaintStore.upsertRealRotoKeyFrame('layer-1', TEST_TRACK_ID, 2, makeFrame(0, 2));
    physicPaintStore.upsertRealRotoKeyFrame('layer-1', TEST_TRACK_ID, 6, makeFrame(0, 6));
    physicPaintStore.setRotoBackgroundMetadata('layer-1', TEST_TRACK_ID, { background: 'canvas3', paperGrain: 'canvas3', grainStrength: 0.5 });
    physicPaintStore.recomputeBackgroundOnlyRotoSupport('layer-1', TEST_TRACK_ID, [4]);

    const result = physicPaintStore.replaceRotoKeyFrames({
      kind: 'replace-roto-key-frames',
      trackId: TEST_TRACK_ID,
      operationId: 'op-replace-keys',
      layerId: 'layer-1',
      startFrame: 2,
      frames: [{ ...makeFrame(0, 6), source: 'real-key' }, { ...makeFrame(0, 10), source: 'real-key' }],
    });

    expect(result.ok).toBe(true);
    expect(physicPaintStore.getFrame('layer-1', TEST_TRACK_ID, 4)).toBeNull();
    expect(physicPaintStore.getRotoCacheFrames('layer-1', TEST_TRACK_ID)).toEqual([
      expect.objectContaining({ appFrame: 6, source: 'real-key' }),
      expect.objectContaining({ appFrame: 10, source: 'real-key' }),
    ]);
    expect(physicPaintStore.recomputeBackgroundOnlyRotoSupport('layer-1', TEST_TRACK_ID, [8]).map(frame => frame.appFrame)).toEqual([8]);
  });

  it('G-52-10: hasRotoAlphaCanvasFrame treats a zero-size entry as absent so a fresh registration can overwrite it', () => {
    const dataUrl = 'data:image/png;base64,cG9pc29uZWQ=';
    const canvas = { width: 4, height: 3 } as HTMLCanvasElement;
    registerRotoAlphaCanvasFrame(dataUrl, canvas);
    expect(hasRotoAlphaCanvasFrame(dataUrl)).toBe(true);
    expect(hasRotoAlphaCanvasFrame(dataUrl, { width: 4, height: 3 })).toBe(true);
    // The poison: a caller zeroed the canvas AFTER registration (the G-52-10
    // bug). The entry must read as absent — otherwise the early-return in
    // registerRotoAlphaCanvasFrameFromDataUrl would keep the poisoned canvas.
    canvas.width = 0;
    canvas.height = 0;
    expect(hasRotoAlphaCanvasFrame(dataUrl)).toBe(false);
    expect(hasRotoAlphaCanvasFrame(dataUrl, { width: 4, height: 3 })).toBe(false);
  });

  describe('canonical physical-operation lease registry', () => {
    const physicalDocument = (dataUrl = 'data:image/png;base64,AAAA') => {
      const realKeyRecords = [{
        kind: 'real-key' as const,
        keyId: 'key-1',
        appFrame: 1,
        payload: { frameIndex: 0, appFrame: 1, dataUrl, width: 2, height: 2 },
      }];
      const interpolation = { enabled: false, mode: 'duplicate' as const };
      return parsePhysicPaintRotoPhysicalDocument({
        capacity: 12,
        realKeyRecords,
        interpolation,
        scriptMotion: { deformation: 0, position: 0 },
        background: null,
        selectedKeyId: 'key-1',
        cursorAppFrame: 1,
        revision: buildPhysicPaintRotoPhysicalRevision(realKeyRecords, interpolation, [], []),
        loopClips: [],
        incomingInterpolationBreakKeyIds: [],
      });
    };

    it('acquires one unique project/layer exclusive or recovery token and rejects cross-scope or replayed tokens', () => {
      const exclusive = physicPaintStore.acquireRotoPhysicalOperationLease('project-1', 'layer-1', TEST_TRACK_ID);
      expect(exclusive).toMatchObject({ projectContextId: 'project-1', layerId: 'layer-1', owner: 'exclusive' });
      expect(physicPaintStore.acquireRotoPhysicalOperationLease('project-1', 'layer-1', TEST_TRACK_ID)).toBeNull();
      expect(physicPaintStore.acquireRotoPhysicalOperationLease('project-1', 'layer-2', TEST_TRACK_ID)).not.toBeNull();
      expect(physicPaintStore.validateRotoPhysicalOperationLease('project-1', 'layer-2', TEST_TRACK_ID, exclusive)).toEqual({ ok: false, reason: 'mismatched-token' });
      expect(physicPaintStore.releaseRotoPhysicalOperationLease(exclusive!)).toBe(true);
      expect(physicPaintStore.validateRotoPhysicalOperationLease('project-1', 'layer-1', TEST_TRACK_ID, exclusive)).toEqual({ ok: false, reason: 'replayed-token' });

      const recovery = physicPaintStore.acquireRotoPhysicalRecoveryLease({
        projectContextId: 'project-1',
        layerId: 'layer-1',
        trackId: TEST_TRACK_ID,
        generation: exclusive!.generation + 20,
      });
      expect(recovery).toMatchObject({ projectContextId: 'project-1', layerId: 'layer-1', owner: 'recovery' });
      expect(physicPaintStore.releaseRotoPhysicalOperationLease(recovery!)).toBe(true);
    });

    it('atomically transfers exclusive ownership to recovery and publishes reactive availability transitions', () => {
      const beforeVersion = physicPaintRotoPhysicalOperationLeaseVersion.value;
      expect(physicPaintStore.isRotoPhysicalOperationAvailable('project-1', 'layer-1', TEST_TRACK_ID)).toBe(true);

      const exclusive = physicPaintStore.acquireRotoPhysicalOperationLease('project-1', 'layer-1', TEST_TRACK_ID)!;
      expect(physicPaintRotoPhysicalOperationLeaseVersion.value).toBe(beforeVersion + 1);
      expect(physicPaintStore.isRotoPhysicalOperationAvailable('project-1', 'layer-1', TEST_TRACK_ID)).toBe(false);

      const recovery = physicPaintStore.transferRotoPhysicalOperationLeaseToRecovery(exclusive);
      expect(recovery).toEqual({ ...exclusive, owner: 'recovery' });
      expect(physicPaintRotoPhysicalOperationLeaseVersion.value).toBe(beforeVersion + 2);
      expect(physicPaintStore.validateRotoPhysicalOperationLease('project-1', 'layer-1', TEST_TRACK_ID, exclusive)).toEqual({ ok: false, reason: 'mismatched-token' });
      expect(physicPaintStore.validateRotoPhysicalOperationLease('project-1', 'layer-1', TEST_TRACK_ID, recovery)).toEqual({ ok: true });
      expect(physicPaintStore.acquireRotoPhysicalOperationLease('project-1', 'layer-1', TEST_TRACK_ID)).toBeNull();

      expect(physicPaintStore.releaseRotoPhysicalOperationLease(recovery!)).toBe(true);
      expect(physicPaintRotoPhysicalOperationLeaseVersion.value).toBe(beforeVersion + 3);
      expect(physicPaintStore.isRotoPhysicalOperationAvailable('project-1', 'layer-1', TEST_TRACK_ID)).toBe(true);
    });

    it('requires the exact active token for complete replacement and direct real-key publication without changing accepted state on rejection', () => {
      const beforeDocument = physicalDocument();
      expect(physicPaintStore.replaceRotoPhysicalDocument('layer-1', TEST_TRACK_ID, beforeDocument).ok).toBe(true);
      const lease = physicPaintStore.acquireRotoPhysicalOperationLease('project-1', 'layer-1', TEST_TRACK_ID)!;
      const beforeVersion = physicPaintVersion.value;
      const beforeRevisionSignal = physicPaintStore.getRotoPhysicalDocument('layer-1', TEST_TRACK_ID)!.revision;
      const nextDocument = physicalDocument('data:image/png;base64,BBBB');

      for (const token of [
        undefined,
        { ...lease, generation: lease.generation + 1 },
        { ...lease, layerId: 'layer-2' },
        { ...lease, trackId: 'track-other' },
      ]) {
        expect(physicPaintStore.replaceRotoPhysicalDocument('layer-1', TEST_TRACK_ID, nextDocument, token)).toEqual(expect.objectContaining({ ok: false }));
        expect(physicPaintStore.getRotoPhysicalDocument('layer-1', TEST_TRACK_ID)).toEqual(beforeDocument);
        expect(physicPaintVersion.value).toBe(beforeVersion);
      }

      expect(physicPaintStore.updateRotoPhysicalRealKeyPayload(
        'layer-1', TEST_TRACK_ID,
        'key-1',
        beforeRevisionSignal,
        nextDocument.realKeyRecords[0].payload,
      )).toEqual(expect.objectContaining({ ok: false }));
      expect(physicPaintStore.getRotoPhysicalDocument('layer-1', TEST_TRACK_ID)).toEqual(beforeDocument);
      expect(physicPaintVersion.value).toBe(beforeVersion);

      expect(physicPaintStore.updateRotoPhysicalRealKeyPayload(
        'layer-1', TEST_TRACK_ID,
        'key-1',
        beforeRevisionSignal,
        nextDocument.realKeyRecords[0].payload,
        undefined,
        lease,
      )).toEqual(expect.objectContaining({ ok: true, changed: true }));
      expect(physicPaintVersion.value).toBe(beforeVersion + 1);
    });

  });

  describe('regression-refresh-multi-paint Layer 2: content-token registry', () => {
    const contentDocument = (dataUrl = 'data:image/png;base64,AAAA') => {
      const realKeyRecords = [{
        kind: 'real-key' as const,
        keyId: 'key-1',
        appFrame: 1,
        payload: { frameIndex: 0, appFrame: 1, dataUrl, width: 2, height: 2 },
      }];
      const interpolation = { enabled: false, mode: 'duplicate' as const };
      return parsePhysicPaintRotoPhysicalDocument({
        capacity: 12,
        realKeyRecords,
        interpolation,
        scriptMotion: { deformation: 0, position: 0 },
        background: null,
        selectedKeyId: 'key-1',
        cursorAppFrame: 1,
        revision: buildPhysicPaintRotoPhysicalRevision(realKeyRecords, interpolation, [], []),
        loopClips: [],
        incomingInterpolationBreakKeyIds: [],
      });
    };

    it('assigns a monotonic CONTENT token per distinct content revision', () => {
      const tokenA1 = resolveContentToken('rev-A');
      const tokenA2 = resolveContentToken('rev-A');
      const tokenB = resolveContentToken('rev-B');
      expect(tokenA2, 'the same revision maps to the SAME token').toBe(tokenA1);
      expect(tokenB, 'a newer revision maps to a HIGHER token').toBeGreaterThan(tokenA1);
      expect(resolveContentToken(null), 'no revision maps to the base token 0').toBe(0);
      expect(resolveContentToken(undefined)).toBe(0);
    });

    it('getContentToken follows document replacement and stays monotonic', () => {
      expect(physicPaintStore.getContentToken('layer-1', TEST_TRACK_ID), 'no document yet → base token').toBe(0);
      const docA = contentDocument();
      expect(physicPaintStore.replaceRotoPhysicalDocument('layer-1', TEST_TRACK_ID, docA).ok).toBe(true);
      const tokenA = physicPaintStore.getContentToken('layer-1', TEST_TRACK_ID);
      expect(tokenA, 'an accepted document carries a positive content token').toBeGreaterThan(0);
      expect(physicPaintStore.getContentToken('layer-1', TEST_TRACK_ID), 'same document, same token').toBe(tokenA);

      const docB = contentDocument('data:image/png;base64,BBBB');
      expect(physicPaintStore.replaceRotoPhysicalDocument('layer-1', TEST_TRACK_ID, docB).ok).toBe(true);
      const tokenB = physicPaintStore.getContentToken('layer-1', TEST_TRACK_ID);
      expect(tokenB, 'replaced content advances the layer content token').toBeGreaterThan(tokenA);
    });
  });

  // -------------------------------------------------------------------------
  // 48-03 getFlattenedFrame — flattened straight-alpha delivery (D-11). The
  // store's composite path needs browser globals the rest of this file never
  // touches, so the nested beforeEach installs them (document.createElement →
  // recording canvas, Image → synchronous/deferred test images) and wires the
  // compositor size provider to 4×3. FlatTestCanvas.toDataURL is a
  // DETERMINISTIC serialization of the recorded draw log — not real pixels —
  // so the flattened renderedFrame.dataUrl IS the observable op log.
  // -------------------------------------------------------------------------
  describe('getFlattenedFrame', () => {
    type FlatOp =
      | { type: 'clearRect' }
      | { type: 'save' }
      | { type: 'restore' }
      | { type: 'fillRect'; fillStyle: string; globalAlpha: number; globalCompositeOperation: GlobalCompositeOperation }
      | { type: 'drawImage'; source: string; globalAlpha: number; globalCompositeOperation: GlobalCompositeOperation };

    class FlatRecordingContext {
      readonly ops: FlatOp[];
      constructor(ops: FlatOp[] = []) { this.ops = ops; }
      fillStyle: string | CanvasGradient | CanvasPattern = '#000000';
      globalAlpha = 1;
      globalCompositeOperation: GlobalCompositeOperation = 'source-over';
      private stack: Array<Pick<FlatRecordingContext, 'fillStyle' | 'globalAlpha' | 'globalCompositeOperation'>> = [];

      save(): void {
        this.ops.push({ type: 'save' });
        this.stack.push({ fillStyle: this.fillStyle, globalAlpha: this.globalAlpha, globalCompositeOperation: this.globalCompositeOperation });
      }
      restore(): void {
        this.ops.push({ type: 'restore' });
        const top = this.stack.pop();
        if (!top) return;
        this.fillStyle = top.fillStyle;
        this.globalAlpha = top.globalAlpha;
        this.globalCompositeOperation = top.globalCompositeOperation;
      }
      clearRect(): void { this.ops.push({ type: 'clearRect' }); }
      fillRect(): void { this.ops.push({ type: 'fillRect', fillStyle: String(this.fillStyle), globalAlpha: this.globalAlpha, globalCompositeOperation: this.globalCompositeOperation }); }
      drawImage(source?: unknown, ..._args: number[]): void {
        // Label any src-bearing image (FlatTestImage OR DeferredFlatTestImage)
        // by its src; canvases and other sources log as 'canvas'.
        const sourceLabel = source !== null && typeof source === 'object' && 'src' in source
          ? String((source as { src: unknown }).src)
          : 'canvas';
        this.ops.push({ type: 'drawImage', source: sourceLabel, globalAlpha: this.globalAlpha, globalCompositeOperation: this.globalCompositeOperation });
      }
      createPattern(): CanvasPattern { return 'pattern' as unknown as CanvasPattern; }
    }

    class FlatTestCanvas {
      width = 0;
      height = 0;
      constructor(readonly ops: FlatOp[]) {}
      getContext(kind: string): FlatRecordingContext | null { return kind === '2d' ? new FlatRecordingContext(this.ops) : null; }
      toDataURL(): string {
        const log = this.ops.map((op) => {
          switch (op.type) {
            case 'clearRect': return 'clear';
            case 'save': return 'save';
            case 'restore': return 'restore';
            case 'fillRect': return `fill(${op.fillStyle},${op.globalAlpha},${op.globalCompositeOperation})`;
            case 'drawImage': return `draw(${op.source},${op.globalAlpha},${op.globalCompositeOperation})`;
          }
        }).join('|');
        return `data:image/png;base64,${log}`;
      }
    }

    class FlatTestImage {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      crossOrigin = '';
      width = 4;
      height = 3;
      private currentSrc = '';
      set src(value: string) { this.currentSrc = value; this.onload?.(); }
      get src(): string { return this.currentSrc; }
    }

    class DeferredFlatTestImage {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      crossOrigin = '';
      width = 4;
      height = 3;
      static instances: DeferredFlatTestImage[] = [];
      private currentSrc = '';
      constructor() { DeferredFlatTestImage.instances.push(this); }
      set src(value: string) { this.currentSrc = value; }
      get src(): string { return this.currentSrc; }
    }

    const FLAT_LAYER = 'flat-layer';

    function flatTrack(id: string, overrides: Partial<Omit<InternalPaintTrack, 'id'>> = {}): InternalPaintTrack {
      return {
        id,
        name: id,
        order: 0,
        visible: true,
        solo: false,
        opacity: 1,
        blendMode: 'normal',
        revision: 0,
        frames: {},
        rotoPhysical: null,
        loopClips: [],
        ...overrides,
      };
    }

    function flatDocument(tracks: InternalPaintTrack[], background?: Partial<EfxPaintDocument['background']>): EfxPaintDocument {
      const base = createEfxPaintDocument(FLAT_LAYER);
      // The document model requires activeTrackId to match a track, so a
      // "background-only" document carries a hidden ghost track (hidden →
      // non-participating: it never draws and never appears in the missing
      // report or the flattened key).
      const effectiveTracks = tracks.length > 0 ? tracks : [flatTrack('ghost-track', { visible: false })];
      return {
        ...base,
        activeTrackId: effectiveTracks[0]?.id ?? base.activeTrackId,
        tracks: effectiveTracks,
        background: { ...base.background, ...background },
      };
    }

    function seedRoto(
      trackId: string,
      keys: Array<{ keyId: string; appFrame: number; dataUrl: string }>,
      options: { background?: { background: 'canvas1' | 'canvas2' | 'canvas3' | 'transparent'; paperGrain: string; grainStrength: number } | null; loopClips?: PhysicPaintRotoLoopClip[] } = {},
    ): void {
      const records = keys.map((key) => ({
        keyId: key.keyId,
        appFrame: key.appFrame,
        kind: 'real-key' as const,
        payload: { frameIndex: 0, appFrame: key.appFrame, dataUrl: key.dataUrl },
      }));
      const loopClips = options.loopClips ?? [];
      const interpolation = { enabled: false, mode: 'duplicate' as const };
      const result = physicPaintStore.replaceRotoPhysicalDocument(FLAT_LAYER, trackId, {
        capacity: 600,
        realKeyRecords: records,
        interpolation,
        scriptMotion: { deformation: 0, position: 0 },
        background: options.background ?? null,
        selectedKeyId: null,
        cursorAppFrame: 0,
        loopClips,
        revision: buildPhysicPaintRotoPhysicalRevision(records, interpolation, loopClips),
      });
      if (!result.ok) throw new Error(result.error);
    }

    let createdCanvases: FlatTestCanvas[];

    beforeEach(() => {
      resetEfxPaintStore();
      DeferredFlatTestImage.instances = [];
      createdCanvases = [];
      resetProjectPaperRasterForTests();
      _setPhysicPaintCompositorSizeProvider(() => ({ width: 4, height: 3 }));
      vi.stubGlobal('document', {
        createElement: (tag: string) => {
          if (tag === 'canvas') {
            const canvas = new FlatTestCanvas([]);
            createdCanvases.push(canvas);
            return canvas;
          }
          return {};
        },
      });
      vi.stubGlobal('Image', FlatTestImage);
      vi.stubGlobal('HTMLImageElement', FlatTestImage);
      vi.stubGlobal('HTMLCanvasElement', FlatTestCanvas);
    });

    afterEach(() => {
      _setPhysicPaintCompositorSizeProvider(null);
      vi.unstubAllGlobals();
    });

    it('RED 1 guard: returns null for an unknown layer and for non-integer/negative frames', () => {
      expect(physicPaintStore.getFlattenedFrame('unknown-layer', 5)).toBeNull();
      registerDocument(flatDocument([flatTrack('track-a')], { visible: false }));
      expect(physicPaintStore.getFlattenedFrame(FLAT_LAYER, 1.5)).toBeNull();
      expect(physicPaintStore.getFlattenedFrame(FLAT_LAYER, -1)).toBeNull();
      expect(physicPaintStore.getFlattenedFrame(FLAT_LAYER, NaN)).toBeNull();
    });

    it('RED 2 single-track parity: flattened dataUrl is the composite of fallback + the track frame', () => {
      const frameDataUrl = makeFrame(0, 5).dataUrl;
      registerDocument(flatDocument([flatTrack('track-a')], { visible: false }));
      seedRoto('track-a', [{ keyId: 'ka', appFrame: 5, dataUrl: frameDataUrl }]);

      const record = physicPaintStore.getFlattenedFrame(FLAT_LAYER, 5);
      expect(record).not.toBeNull();
      expect(record!.layerId).toBe(FLAT_LAYER);
      expect(record!.frame).toBe(5);
      expect(record!.cacheKey).toMatch(/^flattened-/);
      expect(record!.missing).toEqual([]);
      expect(record!.renderedFrame.frameIndex).toBe(5);
      expect(record!.renderedFrame.appFrame).toBe(5);
      expect(record!.renderedFrame.width).toBe(4);
      expect(record!.renderedFrame.height).toBe(3);

      // Reference: transparent fallback (clear) + a plain source-over draw of
      // the frame at the track's own opacity — NOT the old active-track accessor.
      const reference = new FlatTestCanvas([]);
      const refCtx = reference.getContext('2d')!;
      refCtx.clearRect();
      refCtx.save();
      refCtx.globalAlpha = 1;
      refCtx.globalCompositeOperation = 'source-over';
      const frameImage = new FlatTestImage();
      frameImage.src = frameDataUrl;
      refCtx.drawImage(frameImage);
      refCtx.restore();
      expect(record!.renderedFrame.dataUrl).toBe(reference.toDataURL());
    });

    it('G-52-8 (FIX 3): a hydrated payload composites from the alpha registry canvas — zero compositor Image decodes', () => {
      const frameDataUrl = makeFrame(0, 5).dataUrl;
      registerDocument(flatDocument([flatTrack('track-a')], { visible: false }));
      seedRoto('track-a', [{ keyId: 'ka', appFrame: 5, dataUrl: frameDataUrl }]);
      // Launch-hydration twin: the exact payload is already decoded off the
      // main thread in the alpha registry, so _preResolveTrackContent must
      // reuse that canvas instead of re-decoding the dataUrl (WebKit decodes
      // lazily at the first drawImage — the G-52-8 per-frame scrub cost).
      const hydratedCanvas = new FlatTestCanvas([]);
      hydratedCanvas.width = 4;
      hydratedCanvas.height = 3;
      registerRotoAlphaCanvasFrame(frameDataUrl, hydratedCanvas as unknown as HTMLCanvasElement);
      // A deferred Image proves the decode path: if the compositor re-decoded,
      // the image would never load and the flatten would return null.
      vi.stubGlobal('Image', DeferredFlatTestImage);
      vi.stubGlobal('HTMLImageElement', DeferredFlatTestImage);

      const record = physicPaintStore.getFlattenedFrame(FLAT_LAYER, 5);

      expect(record).not.toBeNull();
      expect(DeferredFlatTestImage.instances).toHaveLength(0);
      // The composite drew the registry canvas itself, not a decoded Image.
      const composite = record!.raster as unknown as FlatTestCanvas;
      expect(composite.ops).toContainEqual(expect.objectContaining({ type: 'drawImage', source: 'canvas' }));
      expect(composite.ops).not.toContainEqual(expect.objectContaining({ type: 'drawImage', source: frameDataUrl }));
    });

    it('G-52-10: a zero-size registry entry is skipped — the compositor falls back to decoding the dataUrl', () => {
      const frameDataUrl = makeFrame(0, 5).dataUrl;
      registerDocument(flatDocument([flatTrack('track-a')], { visible: false }));
      seedRoto('track-a', [{ keyId: 'ka', appFrame: 5, dataUrl: frameDataUrl }]);
      // The G-52-10 poison shape: a live canvas registered at bake time, zeroed
      // afterwards by a caller that still thought it owned the canvas. Handing
      // it to drawImage would throw InvalidStateError — the registry-first
      // branch must fall through to _compositorDecode instead.
      const poisoned = new FlatTestCanvas([]);
      poisoned.width = 4;
      poisoned.height = 3;
      registerRotoAlphaCanvasFrame(frameDataUrl, poisoned as unknown as HTMLCanvasElement);
      poisoned.width = 0;
      poisoned.height = 0;

      const record = physicPaintStore.getFlattenedFrame(FLAT_LAYER, 5);

      expect(record).not.toBeNull();
      const composite = record!.raster as unknown as FlatTestCanvas;
      expect(composite.ops).toContainEqual(expect.objectContaining({ type: 'drawImage', source: frameDataUrl }));
      expect(composite.ops).not.toContainEqual(expect.objectContaining({ type: 'drawImage', source: 'canvas' }));
    });

    it('G-52-8 (FIX 4): the flattened record carries its raster and encodes dataUrl lazily — once, on first read', () => {
      const frameDataUrl = makeFrame(0, 5).dataUrl;
      registerDocument(flatDocument([flatTrack('track-a')], { visible: false }));
      seedRoto('track-a', [{ keyId: 'ka', appFrame: 5, dataUrl: frameDataUrl }]);
      const encodeSpy = vi.spyOn(FlatTestCanvas.prototype, 'toDataURL');
      try {
        const record = physicPaintStore.getFlattenedFrame(FLAT_LAYER, 5);

        expect(record).not.toBeNull();
        // The flatten itself encodes NOTHING — draw surfaces consume the
        // raster; the PNG encode is no longer on the draw path.
        expect(encodeSpy).not.toHaveBeenCalled();
        expect(record!.raster).toBeDefined();

        const firstRead = record!.renderedFrame.dataUrl;
        expect(encodeSpy).toHaveBeenCalledTimes(1);
        expect(record!.renderedFrame.dataUrl).toBe(firstRead);
        expect(encodeSpy).toHaveBeenCalledTimes(1);

        // A memo hit returns the same record; the memoized encode survives.
        const again = physicPaintStore.getFlattenedFrame(FLAT_LAYER, 5)!;
        expect(again).toBe(record);
        expect(again.renderedFrame.dataUrl).toBe(firstRead);
        expect(encodeSpy).toHaveBeenCalledTimes(1);
      } finally {
        encodeSpy.mockRestore();
      }
    });

    it('RED 3 multi-track: draws both visible tracks bottom-to-top and cacheKey equals deriveEfxPaintFlattenedCacheKey', () => {
      const frameA = makeFrame(0, 5).dataUrl;
      const frameB = makeFrame(0, 5).dataUrl;
      registerDocument(flatDocument([
        flatTrack('track-b', { order: 1, opacity: 0.5, blendMode: 'multiply' }),
        flatTrack('track-a', { order: 0 }),
      ], { visible: false }));
      seedRoto('track-a', [{ keyId: 'ka', appFrame: 5, dataUrl: frameA }]);
      seedRoto('track-b', [{ keyId: 'kb', appFrame: 5, dataUrl: frameB }]);

      const record = physicPaintStore.getFlattenedFrame(FLAT_LAYER, 5)!;
      const log = record.renderedFrame.dataUrl;
      const firstDraw = log.indexOf('draw(');
      const secondDraw = log.indexOf('draw(', firstDraw + 1);
      expect(firstDraw).toBeGreaterThan(-1);
      expect(secondDraw).toBeGreaterThan(firstDraw);
      // Window sized for the full `draw(<34-char dataUrl>,<alpha>,<op>)` record
      // (a 40-char window cannot fit the ops after the dataUrl).
      expect(log.slice(firstDraw, firstDraw + 60)).toContain('source-over');
      expect(log.slice(secondDraw, secondDraw + 60)).toContain('multiply');
      expect(log.slice(secondDraw, secondDraw + 60)).toContain('0.5');

      const expectedKey = deriveEfxPaintFlattenedCacheKey({
        document: getEfxPaintDocument(FLAT_LAYER)!,
        trackContentRevisions: new Map([
          ['track-a', physicPaintStore.getRotoPhysicalContentRevision(FLAT_LAYER, 'track-a')!],
          ['track-b', physicPaintStore.getRotoPhysicalContentRevision(FLAT_LAYER, 'track-b')!],
        ]),
        backgroundClipRevisions: [],
        frame: 5,
      });
      expect(record.cacheKey).toBe(expectedKey);
    });

    it('RED 4 hidden track excluded: hiding track B removes its pixels and its content term from the key', () => {
      const frameA = makeFrame(0, 5).dataUrl;
      // Distinct dataUrl from track A so the hidden-track assertion can
      // distinguish whose pixels remain in the flattened log.
      const frameB = makeFrame(1, 5).dataUrl;
      registerDocument(flatDocument([
        flatTrack('track-a', { order: 0 }),
        flatTrack('track-b', { order: 1 }),
      ], { visible: false }));
      seedRoto('track-a', [{ keyId: 'ka', appFrame: 5, dataUrl: frameA }]);
      seedRoto('track-b', [{ keyId: 'kb', appFrame: 5, dataUrl: frameB }]);

      const visibleRecord = physicPaintStore.getFlattenedFrame(FLAT_LAYER, 5)!;
      expect(visibleRecord.renderedFrame.dataUrl.match(/draw\(/g)?.length).toBe(2);

      setTrackVisible(FLAT_LAYER, 'track-b', false);
      const hiddenRecord = physicPaintStore.getFlattenedFrame(FLAT_LAYER, 5)!;
      expect(hiddenRecord.renderedFrame.dataUrl.match(/draw\(/g)?.length).toBe(1);
      expect(hiddenRecord.renderedFrame.dataUrl).not.toContain(frameB);

      const expectedKey = deriveEfxPaintFlattenedCacheKey({
        document: getEfxPaintDocument(FLAT_LAYER)!,
        trackContentRevisions: new Map([['track-a', physicPaintStore.getRotoPhysicalContentRevision(FLAT_LAYER, 'track-a')!]]),
        backgroundClipRevisions: [],
        frame: 5,
      });
      expect(hiddenRecord.cacheKey).toBe(expectedKey);
    });

    it('RED 4b background source bytes rotate the flattened key (49-06 UAT round 6)', () => {
      const bgRef = 'bg-ref-1';
      const bgDataUrl = makeFrame(2, 5).dataUrl;
      const clip: FrameLoopClip = {
        id: 'bg-clip-1',
        startFrame: 0,
        sourceFrameRefs: Object.freeze([bgRef]),
        repeat: { mode: 'finite', count: 1 },
        sourceKind: 'imported-background',
        revision: 0,
      };
      registerDocument(flatDocument([flatTrack('track-a')], { id: 'background-1', clips: [clip] }));

      // Before the source bytes arrive the background resolves 'missing' — the
      // composite still returns a record (D-09 report), keyed WITHOUT the bytes.
      const before = physicPaintStore.getFlattenedFrame(FLAT_LAYER, 0)!;
      expect(before.missing).toContainEqual({ trackId: 'background-1', frame: 0, missingRefs: [bgRef] });

      // Bytes arriving MUST rotate the flattened key — the composite content
      // changes while the document does not, so the monitor's compare-then-draw
      // guard (cacheKey-based) must see a new key and redraw the background.
      registerBackgroundSourceImage(bgRef, bgDataUrl);
      const after = physicPaintStore.getFlattenedFrame(FLAT_LAYER, 0)!;
      expect(after.cacheKey).not.toBe(before.cacheKey);
      expect(after.missing).not.toContainEqual({ trackId: 'background-1', frame: 0, missingRefs: [bgRef] });
      expect(after.renderedFrame.dataUrl).toContain(bgDataUrl);
    });

    it('RED 5 missing content renders transparent + a report and never contributes pixels', () => {
      const frameA = makeFrame(0, 5).dataUrl;
      registerDocument(flatDocument([
        flatTrack('track-a', { order: 0 }),
        flatTrack('track-b', { order: 1 }),
      ], { visible: false }));
      seedRoto('track-a', [{ keyId: 'ka', appFrame: 5, dataUrl: frameA }]);
      // track-b has a real key at frame 0 only — frame 5 resolves null.
      seedRoto('track-b', [{ keyId: 'kb', appFrame: 0, dataUrl: makeFrame(0, 0).dataUrl }]);

      const record = physicPaintStore.getFlattenedFrame(FLAT_LAYER, 5)!;
      expect(record.missing).toEqual([{ trackId: 'track-b', frame: 5, missingRefs: [] }]);
      expect(record.renderedFrame.dataUrl.match(/draw\(/g)?.length).toBe(1);
      expect(record.renderedFrame.dataUrl).toContain(frameA);

      // Loop-placeholder case: a loop clip whose source ref has no resolvable
      // real key reports the missing refs (D-09) and contributes nothing.
      registerDocument(flatDocument([flatTrack('track-c')], { visible: false }));
      seedRoto('track-c', [{ keyId: 'kc', appFrame: 0, dataUrl: makeFrame(0, 0).dataUrl }], {
        loopClips: [{ loopId: 'loop-1', placementStart: 3, sourceKeyIds: ['missing-ref-1'], repeat: 'infinity', mode: 'progressive' }],
      });
      const loopRecord = physicPaintStore.getFlattenedFrame(FLAT_LAYER, 5)!;
      expect(loopRecord.missing).toEqual([{ trackId: 'track-c', frame: 5, missingRefs: ['missing-ref-1'] }]);
      expect(loopRecord.renderedFrame.dataUrl.match(/draw\(/g)).toBeNull();
    });

    it('RED 6 cache hit: unchanged inputs return the identical cached record with zero recompute', () => {
      registerDocument(flatDocument([flatTrack('track-a')], { visible: false }));
      seedRoto('track-a', [{ keyId: 'ka', appFrame: 5, dataUrl: makeFrame(0, 5).dataUrl }]);

      const first = physicPaintStore.getFlattenedFrame(FLAT_LAYER, 5)!;
      const canvasCountAfterFirst = createdCanvases.length;
      const second = physicPaintStore.getFlattenedFrame(FLAT_LAYER, 5);
      expect(second).toBe(first);
      expect(second!.renderedFrame).toBe(first.renderedFrame);
      expect(createdCanvases.length).toBe(canvasCountAfterFirst);
      expect(second!.renderedFrame.dataUrl).toBe(first.renderedFrame.dataUrl);
    });

    it('RED 7 decode pending: returns null for that tick and the raster after the decode completes', () => {
      vi.stubGlobal('Image', DeferredFlatTestImage);
      vi.stubGlobal('HTMLImageElement', DeferredFlatTestImage);
      registerDocument(flatDocument([flatTrack('track-a')], { visible: false }));
      seedRoto('track-a', [{ keyId: 'ka', appFrame: 5, dataUrl: makeFrame(0, 5).dataUrl }]);

      expect(physicPaintStore.getFlattenedFrame(FLAT_LAYER, 5)).toBeNull();
      const pendingImage = DeferredFlatTestImage.instances[0];
      expect(pendingImage).toBeDefined();
      pendingImage.onload?.();
      const record = physicPaintStore.getFlattenedFrame(FLAT_LAYER, 5);
      expect(record).not.toBeNull();
      expect(record!.renderedFrame.dataUrl).toContain('draw(');
    });

    it('RED 8 paper fond law: the per-track raster excludes paper; the fond draws once beneath the flattened composite', () => {
      const frameDataUrl = makeFrame(0, 5).dataUrl;
      // 49-03 (D-11): the fond comes from the DOCUMENT fallback — the per-track
      // roto background metadata walk is deleted. The seedRoto background option
      // is kept to prove the fallback is authoritative even when metadata exists.
      registerDocument(flatDocument([flatTrack('track-a')], {
        visible: false,
        fallback: { mode: 'paper', texture: 'canvas1', paperGrain: true, grainStrength: 0 },
      }));
      seedRoto('track-a', [{ keyId: 'ka', appFrame: 5, dataUrl: frameDataUrl }], {
        background: { background: 'canvas1', paperGrain: 'canvas1', grainStrength: 0 },
      });

      const record = physicPaintStore.getFlattenedFrame(FLAT_LAYER, 5)!;
      // The composite canvas consumed the track's BARE frame image — no paper
      // composite, no fill: an upper track can never mask a lower one.
      const compositeCanvas = createdCanvases[0];
      expect(compositeCanvas.toDataURL()).toBe(`data:image/png;base64,clear|save|draw(${frameDataUrl},1,source-over)|restore`);
      // The paper fond is drawn ONCE beneath the flattened raster (the
      // deterministic color-fill + grain fallback, texture-less by contract).
      expect(record.renderedFrame.dataUrl).toBe('data:image/png;base64,fill(#f4efe3,1,source-over)|draw(canvas,1,source-over)');
    });

    it('RED 8b two papered tracks: no masking — both frames composite and the fond draws exactly once beneath', () => {
      const frameA = makeFrame(0, 5).dataUrl;
      const frameB = makeFrame(1, 5).dataUrl;
      // 49-03 (D-11): the fond comes from the DOCUMENT fallback (canvas1 paper).
      registerDocument(flatDocument([
        flatTrack('track-a', { order: 0 }),
        flatTrack('track-b', { order: 1 }),
      ], {
        visible: false,
        fallback: { mode: 'paper', texture: 'canvas1', paperGrain: true, grainStrength: 0 },
      }));
      seedRoto('track-a', [{ keyId: 'ka', appFrame: 5, dataUrl: frameA }], {
        background: { background: 'canvas1', paperGrain: 'canvas1', grainStrength: 0 },
      });
      seedRoto('track-b', [{ keyId: 'kb', appFrame: 5, dataUrl: frameB }], {
        background: { background: 'canvas1', paperGrain: 'canvas1', grainStrength: 0 },
      });

      const record = physicPaintStore.getFlattenedFrame(FLAT_LAYER, 5)!;
      // Both tracks' bare frames draw in bottom-to-top order — no per-track
      // paper composite masking the lower track.
      const compositeCanvas = createdCanvases[0];
      expect(compositeCanvas.toDataURL()).toBe(`data:image/png;base64,clear|save|draw(${frameA},1,source-over)|restore|save|draw(${frameB},1,source-over)|restore`);
      // Exactly ONE fond fill beneath the composite, resolved from the
      // document fallback.
      expect(record.renderedFrame.dataUrl.match(/fill\(#f4efe3/g)?.length).toBe(1);
      expect(record.renderedFrame.dataUrl).toContain('draw(canvas,1,source-over)');
    });

    it('RED 8c fond-less variant (48-06 UAT-C): includeFond=false skips the paper fond and uses its own cache key', () => {
      const frameDataUrl = makeFrame(0, 5).dataUrl;
      // 49-03 (D-11): the fond comes from the DOCUMENT fallback (canvas1 paper).
      registerDocument(flatDocument([flatTrack('track-a')], {
        visible: false,
        fallback: { mode: 'paper', texture: 'canvas1', paperGrain: true, grainStrength: 0 },
      }));
      seedRoto('track-a', [{ keyId: 'ka', appFrame: 5, dataUrl: frameDataUrl }], {
        background: { background: 'canvas1', paperGrain: 'canvas1', grainStrength: 0 },
      });

      const withFond = physicPaintStore.getFlattenedFrame(FLAT_LAYER, 5)!;
      const noFond = physicPaintStore.getFlattenedFrame(FLAT_LAYER, 5, false)!;

      // The with-fond record carries the paper beneath the composite…
      expect(withFond.renderedFrame.dataUrl).toBe('data:image/png;base64,fill(#f4efe3,1,source-over)|draw(canvas,1,source-over)');
      // …the fond-less record is the bare composite (the Studio monitor reads
      // this; the paper lives on its own layer beneath the isolated tracks
      // group, so the active track's CSS blend never meets it).
      expect(noFond.renderedFrame.dataUrl).toBe(`data:image/png;base64,clear|save|draw(${frameDataUrl},1,source-over)|restore`);
      // Distinct memo entries: the `fond:0` key term separates the variants.
      expect(noFond.cacheKey).not.toBe(withFond.cacheKey);
      // The missing report is identical either way (the fond never contributes).
      expect(noFond.missing).toEqual(withFond.missing);
    });

    // 49-03 Task 1 (D-11 consumption half): the document fallback is the SINGLE
    // fond authority — the per-track roto background metadata walk is deleted.
    it('49-03 T1: solid white fallback fills white regardless of per-track roto background metadata', () => {
      const frameDataUrl = makeFrame(0, 5).dataUrl;
      registerDocument(flatDocument([flatTrack('track-a')], {
        visible: false,
        fallback: { mode: 'solid', color: '#ffffff' },
      }));
      seedRoto('track-a', [{ keyId: 'ka', appFrame: 5, dataUrl: frameDataUrl }], {
        background: { background: 'canvas1', paperGrain: 'canvas1', grainStrength: 0 },
      });

      const record = physicPaintStore.getFlattenedFrame(FLAT_LAYER, 5)!;
      // The document fallback is the single fond authority: solid white fills
      // beneath the composite even though the track carries canvas1 metadata.
      expect(record.renderedFrame.dataUrl).toBe('data:image/png;base64,fill(#ffffff,1,source-over)|draw(canvas,1,source-over)');
    });

    it('49-03 T2: paper canvas2 fallback draws the canvas2 paper; transparent fallback produces no fond', () => {
      const frameDataUrl = makeFrame(0, 5).dataUrl;
      registerDocument(flatDocument([flatTrack('track-a')], {
        visible: false,
        fallback: { mode: 'paper', texture: 'canvas2', paperGrain: false, grainStrength: 0 },
      }));
      seedRoto('track-a', [{ keyId: 'ka', appFrame: 5, dataUrl: frameDataUrl }]);

      const record = physicPaintStore.getFlattenedFrame(FLAT_LAYER, 5)!;
      // canvas2 paper draw beneath the composite (parity with the paper path
      // produced today via metadata).
      expect(record.renderedFrame.dataUrl).toBe('data:image/png;base64,fill(#ebe3d2,1,source-over)|draw(canvas,1,source-over)');

      // Transparent fallback → no fond instruction → the bare composite.
      registerDocument(flatDocument([flatTrack('track-a')], {
        visible: false,
        fallback: { mode: 'transparent' },
      }));
      const transparentRecord = physicPaintStore.getFlattenedFrame(FLAT_LAYER, 5)!;
      expect(transparentRecord.renderedFrame.dataUrl).toBe(`data:image/png;base64,clear|save|draw(${frameDataUrl},1,source-over)|restore`);
    });

    it('49-03 T4: deleting a per-track roto background metadata entry no longer changes the fond instruction', () => {
      const frameDataUrl = makeFrame(0, 5).dataUrl;
      registerDocument(flatDocument([flatTrack('track-a')], {
        visible: false,
        fallback: { mode: 'solid', color: '#ffffff' },
      }));
      seedRoto('track-a', [{ keyId: 'ka', appFrame: 5, dataUrl: frameDataUrl }], {
        background: { background: 'canvas1', paperGrain: 'canvas1', grainStrength: 0 },
      });

      const withMetadata = physicPaintStore.getFlattenedFrame(FLAT_LAYER, 5)!;
      expect(withMetadata.renderedFrame.dataUrl).toBe('data:image/png;base64,fill(#ffffff,1,source-over)|draw(canvas,1,source-over)');

      // Delete the metadata entry (re-seed with background: null) and force a
      // recompute (fresh content revision) — the fond instruction is unchanged
      // (the metadata walk is gone).
      const frameDataUrl2 = makeFrame(1, 5).dataUrl;
      seedRoto('track-a', [{ keyId: 'ka', appFrame: 5, dataUrl: frameDataUrl2 }], { background: null });
      const afterDelete = physicPaintStore.getFlattenedFrame(FLAT_LAYER, 5)!;
      expect(afterDelete.renderedFrame.dataUrl).toBe('data:image/png;base64,fill(#ffffff,1,source-over)|draw(canvas,1,source-over)');
    });

    it('RED 9 background port wiring: a resolvable clip draws its raster; an unresolvable clip reports missing', () => {
      const bgDataUrl = makeFrame(0, 0).dataUrl;
      registerBackgroundSourceImage('bg-ref-1', bgDataUrl);
      registerDocument(flatDocument([], {
        visible: true,
        clips: [{ id: 'clip-1', startFrame: 0, sourceFrameRefs: ['bg-ref-1'], repeat: { mode: 'finite', count: 1 }, sourceKind: 'imported-background', revision: 1 }],
      }));

      const record = physicPaintStore.getFlattenedFrame(FLAT_LAYER, 0)!;
      expect(record.missing).toEqual([]);
      expect(record.renderedFrame.dataUrl).toContain(`draw(${bgDataUrl},`);

      const badRef = 'missing-bg-ref';
      registerDocument(flatDocument([], {
        visible: true,
        clips: [{ id: 'clip-2', startFrame: 0, sourceFrameRefs: [badRef], repeat: { mode: 'finite', count: 1 }, sourceKind: 'imported-background', revision: 1 }],
      }));
      const missingRecord = physicPaintStore.getFlattenedFrame(FLAT_LAYER, 0)!;
      expect(missingRecord.missing).toEqual([{ trackId: getEfxPaintDocument(FLAT_LAYER)!.background.id, frame: 0, missingRefs: [badRef] }]);
      expect(missingRecord.renderedFrame.dataUrl).not.toContain('draw(');
    });

    it('RED 10 background source-image port: pending decode returns null this tick, raster after the decode completes', () => {
      vi.stubGlobal('Image', DeferredFlatTestImage);
      vi.stubGlobal('HTMLImageElement', DeferredFlatTestImage);
      const bgDataUrl = makeFrame(0, 0).dataUrl;
      registerBackgroundSourceImage('bg-ref-1', bgDataUrl);
      registerDocument(flatDocument([], {
        visible: true,
        clips: [{ id: 'clip-1', startFrame: 0, sourceFrameRefs: ['bg-ref-1'], repeat: { mode: 'finite', count: 1 }, sourceKind: 'imported-background', revision: 1 }],
      }));

      expect(physicPaintStore.getFlattenedFrame(FLAT_LAYER, 0)).toBeNull();
      const pendingImage = DeferredFlatTestImage.instances[0];
      expect(pendingImage).toBeDefined();
      pendingImage.onload?.();
      const record = physicPaintStore.getFlattenedFrame(FLAT_LAYER, 0);
      expect(record).not.toBeNull();
      expect(record!.renderedFrame.dataUrl).toContain(`draw(${bgDataUrl},`);
      expect(record!.missing).toEqual([]);
    });

    // 48-05 D-05: the excluding store variant threads the engine-supplied
    // track ids through the compositor ports and the flattened cache key (its
    // own `excl:` term) — an including and an excluding call for the same frame
    // never share a cache entry (different participating sets / missing
    // reports), and an empty exclude set stays byte-identical to the including
    // path (the 48-01/48-04 including-key contract).
    it('getFlattenedFrameExcluding omits the engine-supplied track pixels and uses its own `excl:` key term', () => {
      const frameA = makeFrame(0, 5).dataUrl;
      const frameB = makeFrame(1, 5).dataUrl;
      registerDocument(flatDocument([
        flatTrack('track-a', { order: 0 }),
        flatTrack('track-b', { order: 1 }),
      ], { visible: false }));
      seedRoto('track-a', [{ keyId: 'ka', appFrame: 5, dataUrl: frameA }]);
      seedRoto('track-b', [{ keyId: 'kb', appFrame: 5, dataUrl: frameB }]);

      const including = physicPaintStore.getFlattenedFrame(FLAT_LAYER, 5)!;
      const excluding = physicPaintStore.getFlattenedFrameExcluding(FLAT_LAYER, 5, new Set(['track-b']))!;

      expect(including.renderedFrame.dataUrl.match(/draw\(/g)?.length).toBe(2);
      expect(excluding.renderedFrame.dataUrl.match(/draw\(/g)?.length).toBe(1);
      expect(excluding.renderedFrame.dataUrl).toContain(frameA);
      expect(excluding.renderedFrame.dataUrl).not.toContain(frameB);
      expect(excluding.missing).toEqual([]);
      // Distinct cache keys: the `excl:` term separates the two paths.
      expect(excluding.cacheKey).not.toBe(including.cacheKey);
    });

    it('getFlattenedFrameExcluding with an empty set is byte-identical to getFlattenedFrame', () => {
      const frameA = makeFrame(0, 5).dataUrl;
      registerDocument(flatDocument([flatTrack('track-a', { order: 0 })], { visible: false }));
      seedRoto('track-a', [{ keyId: 'ka', appFrame: 5, dataUrl: frameA }]);

      const including = physicPaintStore.getFlattenedFrame(FLAT_LAYER, 5)!;
      const excludingEmpty = physicPaintStore.getFlattenedFrameExcluding(FLAT_LAYER, 5, new Set())!;

      expect(excludingEmpty.cacheKey).toBe(including.cacheKey);
      expect(excludingEmpty.renderedFrame.dataUrl).toBe(including.renderedFrame.dataUrl);
    });

    describe('background source-byte hydration (49-02 Task 3, BKG-09)', () => {
    // The hydration step is the SOLE production writer of the runtime source
    // registry on the reopen path (Pitfall 5): enumerate the document's
    // background clip sourceFrameRefs, dedupe, resolve each ref to its library
    // asset URL, decode bytes, and register. The tests inject a fake decoder
    // port so registration is observable without reaching into the private
    // registry; the fake `register` forwards to the real
    // registerBackgroundSourceImage so the compositor resolves the bytes.

    function hydrationPorts(registered: Map<string, string>) {
      return {
        resolveAssetUrls: (ref: string) => (ref.startsWith('asset-') ? [`efxasset://localhost/${ref}.png`] : []),
        decodeBytes: async (url: string) => `data:image/png;base64,${btoa(url)}`,
        register: (ref: string, dataUrl: string) => {
          registered.set(ref, dataUrl);
          registerBackgroundSourceImage(ref, dataUrl);
        },
      };
    }

    it('REGISTERS ALL: hydrating a document whose clips reference {a,b} and {b,c} registers each distinct ref exactly once with decoded bytes', async () => {
      const registered = new Map<string, string>();
      const registerCalls: string[] = [];
      const ports = {
        ...hydrationPorts(registered),
        register: (ref: string, dataUrl: string) => {
          registerCalls.push(ref);
          registered.set(ref, dataUrl);
          registerBackgroundSourceImage(ref, dataUrl);
        },
      };
      registerDocument(flatDocument([], {
        visible: true,
        clips: [
          { id: 'clip-1', startFrame: 0, sourceFrameRefs: ['asset-a', 'asset-b'], repeat: { mode: 'finite', count: 1 }, sourceKind: 'imported-background', revision: 1 },
          { id: 'clip-2', startFrame: 10, sourceFrameRefs: ['asset-b', 'asset-c'], repeat: { mode: 'finite', count: 1 }, sourceKind: 'imported-background', revision: 1 },
        ],
      }));
      await hydrateBackgroundSourceImages(getEfxPaintDocument(FLAT_LAYER)!, ports);

      // Dedupe across clips: a, b, c each register exactly once — never a
      // per-clip duplicate registration for the shared ref b.
      expect(registerCalls.sort()).toEqual(['asset-a', 'asset-b', 'asset-c']);
      expect(registered.get('asset-a')).toBe(`data:image/png;base64,${btoa('efxasset://localhost/asset-a.png')}`);
      expect(registered.get('asset-b')).toBe(`data:image/png;base64,${btoa('efxasset://localhost/asset-b.png')}`);
      expect(registered.get('asset-c')).toBe(`data:image/png;base64,${btoa('efxasset://localhost/asset-c.png')}`);
    });

    it('MISSING IS EXPLICIT: a clip referencing an asset absent from the library registers nothing and resolves to the missing verdict', async () => {
      const registered = new Map<string, string>();
      // The library resolver knows 'asset-present' but NOT 'asset-missing' —
      // resolveAssetUrl returns null for the absent id, so hydration skips it.
      const ports = {
        ...hydrationPorts(registered),
        resolveAssetUrls: (ref: string) => (ref === 'asset-present' ? ['efxasset://localhost/asset-present.png'] : []),
      };
      registerDocument(flatDocument([], {
        visible: true,
        clips: [
          { id: 'clip-1', startFrame: 0, sourceFrameRefs: ['asset-present'], repeat: { mode: 'finite', count: 1 }, sourceKind: 'imported-background', revision: 1 },
          { id: 'clip-2', startFrame: 10, sourceFrameRefs: ['asset-missing'], repeat: { mode: 'finite', count: 1 }, sourceKind: 'imported-background', revision: 1 },
        ],
      }));
      await hydrateBackgroundSourceImages(getEfxPaintDocument(FLAT_LAYER)!, ports);

      expect(registered.has('asset-present')).toBe(true);
      expect(registered.has('asset-missing')).toBe(false);

      // The present ref resolves to content; the absent ref yields the missing
      // verdict (transparent + missing report), never a throw and never
      // placeholder content (D-10).
      const presentRecord = physicPaintStore.getFlattenedFrame(FLAT_LAYER, 0)!;
      expect(presentRecord.missing).toEqual([]);
      expect(presentRecord.renderedFrame.dataUrl).toContain('draw(');

      const missingRecord = physicPaintStore.getFlattenedFrame(FLAT_LAYER, 10)!;
      expect(missingRecord.missing).toEqual([{ trackId: getEfxPaintDocument(FLAT_LAYER)!.background.id, frame: 10, missingRefs: ['asset-missing'] }]);
      expect(missingRecord.renderedFrame.dataUrl).not.toContain('draw(');
    });

    it('CONSERVATIVE DURING DECODE: a frame requested while an asset decode is pending resolves conservatively and re-renders on decode completion', async () => {
      vi.stubGlobal('Image', DeferredFlatTestImage);
      vi.stubGlobal('HTMLImageElement', DeferredFlatTestImage);
      const bgDataUrl = makeFrame(0, 0).dataUrl;
      const registered = new Map<string, string>();
      const ports = {
        resolveAssetUrls: (ref: string) => (ref === 'bg-ref-1' ? ['efxasset://localhost/bg.png'] : []),
        decodeBytes: async (url: string) => (url === 'efxasset://localhost/bg.png' ? bgDataUrl : null),
        register: (ref: string, dataUrl: string) => {
          registered.set(ref, dataUrl);
          registerBackgroundSourceImage(ref, dataUrl);
        },
      };
      registerDocument(flatDocument([], {
        visible: true,
        clips: [{ id: 'clip-1', startFrame: 0, sourceFrameRefs: ['bg-ref-1'], repeat: { mode: 'finite', count: 1 }, sourceKind: 'imported-background', revision: 1 }],
      }));
      await hydrateBackgroundSourceImages(getEfxPaintDocument(FLAT_LAYER)!, ports);
      expect(registered.get('bg-ref-1')).toBe(bgDataUrl);

      // The compositor decode is pending this tick → conservative null, never a
      // crash; hydration never blocked document registration.
      expect(physicPaintStore.getFlattenedFrame(FLAT_LAYER, 0)).toBeNull();
      const pendingImage = DeferredFlatTestImage.instances[0];
      expect(pendingImage).toBeDefined();
      pendingImage.onload?.();
      const record = physicPaintStore.getFlattenedFrame(FLAT_LAYER, 0);
      expect(record).not.toBeNull();
      expect(record!.renderedFrame.dataUrl).toContain(`draw(${bgDataUrl},`);
      expect(record!.missing).toEqual([]);
    });

    it('SAVE DEDUP: hydration registration touches no document revision — two save projections of the same hydrated document produce an identical dedup fingerprint', async () => {
      const registered = new Map<string, string>();
      registerDocument(flatDocument([], {
        visible: true,
        clips: [{ id: 'clip-1', startFrame: 0, sourceFrameRefs: ['asset-a'], repeat: { mode: 'finite', count: 1 }, sourceKind: 'imported-background', revision: 1 }],
      }));
      const before = getEfxPaintDocument(FLAT_LAYER)!;
      const beforeRevision = buildEfxPaintDocumentRevision(before);
      await hydrateBackgroundSourceImages(before, hydrationPorts(registered));
      expect(registered.has('asset-a')).toBe(true);

      // Registration is runtime-only: the document record is untouched, so the
      // save fingerprint (document revision + frame byte terms) is identical —
      // no revision churn from hydration registration itself.
      const after = getEfxPaintDocument(FLAT_LAYER)!;
      expect(after).toBe(before);
      expect(after.documentRevision).toBe(before.documentRevision);
      expect(buildEfxPaintDocumentRevision(after)).toBe(beforeRevision);
    });

    it('FALLBACK URL IS TRIED: when the primary URL fails to decode, the next candidate URL registers the ref (the Bg-picker import path)', async () => {
      const registered = new Map<string, string>();
      const decodeCalls: string[] = [];
      const ports = {
        resolveAssetUrls: (ref: string) => (ref === 'asset-a'
          ? ['efxasset://localhost/primary.png', 'efxasset://localhost/fallback.png']
          : []),
        decodeBytes: async (url: string) => {
          decodeCalls.push(url);
          return url === 'efxasset://localhost/fallback.png' ? 'data:image/png;base64,fallback' : null;
        },
        register: (ref: string, dataUrl: string) => {
          registered.set(ref, dataUrl);
          registerBackgroundSourceImage(ref, dataUrl);
        },
      };
      registerDocument(flatDocument([], {
        visible: true,
        clips: [{ id: 'clip-1', startFrame: 0, sourceFrameRefs: ['asset-a'], repeat: { mode: 'finite', count: 1 }, sourceKind: 'imported-background', revision: 1 }],
      }));
      await hydrateBackgroundSourceImages(getEfxPaintDocument(FLAT_LAYER)!, ports);

      // The primary URL failed to decode; the fallback URL succeeded and
      // registered the ref — the clip renders instead of staying paper fond.
      expect(decodeCalls).toEqual(['efxasset://localhost/primary.png', 'efxasset://localhost/fallback.png']);
      expect(registered.get('asset-a')).toBe('data:image/png;base64,fallback');
      const record = physicPaintStore.getFlattenedFrame(FLAT_LAYER, 0);
      expect(record).not.toBeNull();
      expect(record!.missing).toEqual([]);
    });
    });
  });
});
