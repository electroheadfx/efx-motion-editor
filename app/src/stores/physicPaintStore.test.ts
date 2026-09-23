import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PHYSIC_PAINT_MAX_APPLY_FRAMES, buildFrameBytesToken, clampPhysicPaintFrameCount } from '../types/physicPaint';
import { resolveMissingRotoFrameDraw } from '../lib/rotoFrameDraw';
import { frameLru } from '../lib/frameLru';
import {
  buildPhysicPaintRotoPhysicalRevision,
  parsePhysicPaintRotoPhysicalDocument,
} from '../components/physic-paint/roto/physicsPaintRotoPhysicalModel';
import { physicPaintRotoPhysicalOperationLeaseVersion, physicPaintStore, physicPaintVersion, resolveContentToken, _setPhysicPaintMarkDirtyCallback, registerRotoAlphaCanvasFrame, hasRotoAlphaCanvasFrame, renderBlendedRotoInterpolationFrame, _setPhysicPaintCompositorSizeProvider, _setPhysicPaintPackageDirProvider, getFrameMediaVerdict, hasFrameMediaBytes, installFrameMediaBytes, registerBackgroundSourceImage, registerReferenceSourceImage, hydrateBackgroundSourceImages, hydrateReferenceSourceImages, prefetchNeighborFrames } from './physicPaintStore';
import { buildEfxPaintDocumentRevision } from '../efx-paint/document/efxPaintDocumentRevision';
import { getDocument as getEfxPaintDocument, registerDocument, reset as resetEfxPaintStore, setBackgroundFallback, setActiveTrackId, setTrackVisible, setPhotoReferenceSource } from './efxPaintStore';
import { imageStore } from './imageStore';
import { assetUrl } from '../lib/ipc';
import { createEfxPaintDocument } from '../efx-paint/document/efxPaintDocument';
import type { EfxPaintDocument, FrameLoopClip, InternalPaintTrack } from '../efx-paint/document/efxPaintDocument';
import type { PhysicPaintRotoLoopClip } from '../components/physic-paint/roto/physicsPaintRotoPhysicalModel';
import { deriveEfxPaintFlattenedCacheKey } from '../efx-paint/compositor/efxPaintCompositeCache';
import { resetProjectPaperRasterForTests } from '../lib/projectPaperRaster';
import { testPngBytes, testWebpBytes } from '../testUtils/testWebpBytes';
import { buildFrameMediaRelativePath } from '../lib/efxPaintPackage';
import { encodeCanvasAsWebp } from '../lib/webpFrameCodec';

// 52.1-04 (D-13): the decode path invokes the Rust `decode_webp_frame` command
// (leaf module) then bridges raw RGBA → ImageData → createImageBitmap. The
// store imports `decodeWebpFrame` from webpFrameCodec; mock it here so the
// compositor decode is observable without reaching the Tauri boundary.
const { decodeWebpFrameMock } = vi.hoisted(() => ({
  decodeWebpFrameMock: vi.fn(),
}));

vi.mock('../lib/webpFrameCodec', () => ({
  decodeWebpFrame: decodeWebpFrameMock,
  encodeWebpFrame: vi.fn(),
  encodeCanvasAsWebp: vi.fn(async (canvas: { log?: () => string }) => {
    const seed = typeof canvas.log === 'function' ? canvas.log() : '';
    const bytes = new Uint8Array(32 + seed.length);
    bytes.set([0x52, 0x49, 0x46, 0x46], 0);
    bytes.set([0x57, 0x45, 0x42, 0x50], 8);
    bytes.set([0x56, 0x50, 0x38, 0x4c], 12);
    for (let index = 0; index < seed.length; index += 1) bytes[32 + index] = seed.charCodeAt(index) & 0xff;
    return bytes;
  }),
}));

// 52.2-09 Task 3 (D-13): the media READ leg crosses the Tauri boundary through
// `ipcEfxPaintReadFrameMedia` (a leaf in `lib/efxPaintMediaRead`). Mock that one
// member and keep the rest of the module real — the store's own `assetUrl`
// import must stay untouched.
const { readFrameMediaMock } = vi.hoisted(() => ({ readFrameMediaMock: vi.fn() }));

vi.mock('../lib/ipc', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../lib/ipc')>()),
  ipcEfxPaintReadFrameMedia: readFrameMediaMock,
}));

const decodeFlatLog = (bytes: Uint8Array): string => new TextDecoder().decode(bytes);
const webpDataUrl = (bytes: Uint8Array): string => `data:image/webp;base64,${btoa(String.fromCharCode(...bytes))}`;
const pngDataUrl = (bytes: Uint8Array): string => `data:image/png;base64,${btoa(String.fromCharCode(...bytes))}`;
/** Flush the microtask queue so a kicked-off async decode completes. */
const flushDecode = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));
// 46-01: runtime state is per-track; tests exercise the document's ACTIVE track.
const TEST_TRACK_ID = 'track-1';



const makeFrame = (frameIndex: number, appFrame: number) => ({
  frameIndex,
  appFrame,
  bytes: testWebpBytes(btoa(`frame-${frameIndex}`)),
  width: 1000,
  height: 650,
});

const makeAlphaFrame = (frameIndex: number, appFrame: number, alphaSource: string) => ({
  ...makeFrame(frameIndex, appFrame),
  bytes: testWebpBytes(btoa(alphaSource)),
  width: 2,
  height: 2,
});



describe('physicPaintStore', () => {
  beforeEach(() => {
    _setPhysicPaintMarkDirtyCallback(() => {});
    physicPaintStore.reset();
    vi.mocked(encodeCanvasAsWebp).mockClear();
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
    });

    expect(result.ok).toBe(true);
    expect(result.appliedFrameCount).toBe(1);
    expect(physicPaintStore.getFrame('layer-1', TEST_TRACK_ID, 8)?.bytes).toBeInstanceOf(Uint8Array);
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
      rotoBackground: { background: 'canvas2', paperGrain: 'canvas3', grainStrength: 0.65 },
    });

    expect(result.ok).toBe(true);
    expect(physicPaintStore.getRotoBackgroundMetadata('layer-1', TEST_TRACK_ID)).toEqual({ background: 'canvas2', paperGrain: 'canvas3', grainStrength: 0.65 });
    // v1.0: applyCanvas publishes rendered frames only; the document projection
    // carries no rotoPhysical document until real key records exist.
    const projection = physicPaintStore.extractRuntimeStateForDocument('layer-1', TEST_TRACK_ID);
    expect(projection.rotoPhysical).toBeNull();
    expect(projection.frames.get(8)?.bytes).toBeInstanceOf(Uint8Array);
  });


  it('marks no-stroke paper Roto applies as background-only cache frames', () => {
    const result = physicPaintStore.applyCanvas({
      kind: 'apply-canvas',
      trackId: TEST_TRACK_ID,
      operationId: 'op-background-only',
      layerId: 'layer-1',
      startFrame: 4,
      renderedFrame: makeFrame(0, 4),
      backgroundOnly: true,
    });

    expect(result.ok).toBe(true);
    expect(physicPaintStore.getFrame('layer-1', TEST_TRACK_ID, 4)?.bytes).toBeInstanceOf(Uint8Array);
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
      rotoBackground: { background: 'canvas1', paperGrain: 'canvas1', grainStrength: 0.45 },
    });
    physicPaintStore.applyCanvas({
      kind: 'apply-canvas',
      trackId: TEST_TRACK_ID,
      operationId: 'op-roto-3',
      layerId: 'layer-1',
      startFrame: 3,
      renderedFrame: makeFrame(0, 3),
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

  // 260923-bcm Task 1 (RED): the idempotence guard must compare the NORMALIZED
  // grain scale on both sides — otherwise a scale-only write (the only field
  // the Tools control changes) early-returns and the new value is silently
  // dropped from the track mirror.
  it('260923-bcm: a scale-only metadata write is not early-returned by the idempotence guard', () => {
    physicPaintStore.setRotoBackgroundMetadata('layer-grain-guard', TEST_TRACK_ID, {
      background: 'canvas1', paperGrain: 'canvas1', grainStrength: 0.45, grainScale: 1,
    });
    const before = physicPaintVersion.value;
    physicPaintStore.setRotoBackgroundMetadata('layer-grain-guard', TEST_TRACK_ID, {
      background: 'canvas1', paperGrain: 'canvas1', grainStrength: 0.45, grainScale: 2,
    });
    expect(physicPaintVersion.value).toBe(before + 1);
    expect(physicPaintStore.getRotoBackgroundMetadata('layer-grain-guard', TEST_TRACK_ID)?.grainScale).toBe(2);

    // An identical write (same normalized scale) stays a revision-stable no-op.
    const after = physicPaintVersion.value;
    physicPaintStore.setRotoBackgroundMetadata('layer-grain-guard', TEST_TRACK_ID, {
      background: 'canvas1', paperGrain: 'canvas1', grainStrength: 0.45, grainScale: 2,
    });
    expect(physicPaintVersion.value).toBe(after);
  });

  it('260923-bcm: getDocumentFondInstruction carries the grain scale from the mirror and the fallback', () => {
    const mirrorLayer = 'layer-grain-fond-mirror';
    const mirrorDoc = createEfxPaintDocument(mirrorLayer);
    registerDocument(mirrorDoc);
    physicPaintStore.setRotoBackgroundMetadata(mirrorLayer, mirrorDoc.activeTrackId, {
      background: 'canvas1', paperGrain: 'canvas1', grainStrength: 0.45, grainScale: 2,
    });
    expect(physicPaintStore.getDocumentFondInstruction(mirrorLayer)).toMatchObject({ grainScale: 2 });

    const fallbackLayer = 'layer-grain-fond-fallback';
    registerDocument(createEfxPaintDocument(fallbackLayer));
    expect(setBackgroundFallback(fallbackLayer, {
      mode: 'paper', texture: 'canvas1', paperGrain: true, grainStrength: 0.45, grainScale: 2,
    }).ok).toBe(true);
    expect(physicPaintStore.getDocumentFondInstruction(fallbackLayer)).toMatchObject({ grainScale: 2 });

    // Absent member on the fallback normalizes to 1 (type-shape law).
    const defaultLayer = 'layer-grain-fond-default';
    registerDocument(createEfxPaintDocument(defaultLayer));
    expect(setBackgroundFallback(defaultLayer, {
      mode: 'paper', texture: 'canvas2', paperGrain: true, grainStrength: 0.45,
    }).ok).toBe(true);
    expect(physicPaintStore.getDocumentFondInstruction(defaultLayer)).toMatchObject({ grainScale: 1 });
  });

  it('260923-bcm: _fondSourceSignature includes the normalized grain scale', () => {
    const storePath = resolve(dirname(fileURLToPath(import.meta.url)), './physicPaintStore.ts');
    const storeSource = readFileSync(storePath, 'utf8');
    const fnBody = storeSource.slice(storeSource.indexOf('function _fondSourceSignature'));
    expect(fnBody).toContain('grainScale');
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
    expect(physicPaintStore.getFrame('layer-1', TEST_TRACK_ID, 2)?.bytes).toBeInstanceOf(Uint8Array);
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
    expect(physicPaintStore.getFrame('layer-1', TEST_TRACK_ID, 0)?.bytes).toEqual(circle.bytes);
    expect(physicPaintStore.getFrame('layer-1', TEST_TRACK_ID, 1)?.bytes).toEqual(square.bytes);
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

    expect(physicPaintStore.getFrame('custom-layer', TEST_TRACK_ID, 0)?.bytes).toEqual(zero.bytes);
    expect(physicPaintStore.getFrame('custom-layer', TEST_TRACK_ID, 1)?.bytes).toEqual(one.bytes);
    expect(physicPaintStore.getFrame('custom-layer', TEST_TRACK_ID, 2)?.bytes).toEqual(two.bytes);
    expect(physicPaintStore.getFrame('custom-layer', TEST_TRACK_ID, 9)?.bytes).toEqual(custom.bytes);
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
      expect.objectContaining({ appFrame: 0, source: 'real-key', sourceFrame: 0, displayFrame: 0, bytes: zero.bytes }),
      expect.objectContaining({ appFrame: 3, source: 'real-key', sourceFrame: 1, displayFrame: 3, bytes: one.bytes }),
      expect.objectContaining({ appFrame: 6, source: 'real-key', sourceFrame: 2, displayFrame: 6, bytes: two.bytes }),
      expect.objectContaining({ appFrame: 9, source: 'real-key', sourceFrame: 3, displayFrame: 9, bytes: three.bytes }),
      expect.objectContaining({ appFrame: 10, source: 'generated-interpolation', fromSourceFrame: 3, toSourceFrame: 7, bytes: three.bytes }),
      expect.objectContaining({ appFrame: 11, source: 'generated-interpolation', fromSourceFrame: 3, toSourceFrame: 7, bytes: three.bytes }),
      expect.objectContaining({ appFrame: 12, source: 'generated-interpolation', fromSourceFrame: 3, toSourceFrame: 7, bytes: three.bytes }),
      expect.objectContaining({ appFrame: 13, source: 'generated-interpolation', fromSourceFrame: 3, toSourceFrame: 7, bytes: three.bytes }),
      expect.objectContaining({ appFrame: 14, source: 'real-key', sourceFrame: 7, displayFrame: 14, bytes: five.bytes }),
    ]));
    expect(physicPaintStore.getRotoInterpolationSettings('layer-1', TEST_TRACK_ID).segmentSpacingOverrides).toEqual([
      { fromSourceFrame: 3, toSourceFrame: 7, inBetweenCount: 4 },
    ]);
    expect(physicPaintStore.getRotoFrame('layer-1', TEST_TRACK_ID, 14)).toEqual(expect.objectContaining({ appFrame: 14, source: 'real-key', sourceFrame: 7, bytes: five.bytes }));

    physicPaintStore.setRotoInterpolationSettings('layer-1', TEST_TRACK_ID, { enabled: false });

    expect(physicPaintStore.getRotoCacheFrames('layer-1', TEST_TRACK_ID)).toEqual([
      expect.objectContaining({ appFrame: 0, source: 'real-key', sourceFrame: 0, displayFrame: 0, bytes: zero.bytes }),
      expect.objectContaining({ appFrame: 1, source: 'real-key', sourceFrame: 1, displayFrame: 1, bytes: one.bytes }),
      expect.objectContaining({ appFrame: 2, source: 'real-key', sourceFrame: 2, displayFrame: 2, bytes: two.bytes }),
      expect.objectContaining({ appFrame: 3, source: 'real-key', sourceFrame: 3, displayFrame: 3, bytes: three.bytes }),
      expect.objectContaining({ appFrame: 7, source: 'real-key', sourceFrame: 7, displayFrame: 7, bytes: five.bytes }),
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
      expect(realKeys.map((frame) => frame.bytes)).toEqual(sourceFrames.map((sourceFrame) => payloads.get(sourceFrame)!.bytes));
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
    expect(physicPaintStore.getFrame('layer-1', TEST_TRACK_ID, 0)?.bytes).toEqual(payloads.get(0)!.bytes);
    expect(physicPaintStore.getFrame('layer-1', TEST_TRACK_ID, 14)?.bytes).toEqual(payloads.get(14)!.bytes);
    expect(physicPaintStore.getFrame('layer-1', TEST_TRACK_ID, 15)?.bytes).toEqual(payloads.get(15)!.bytes);
    expect(physicPaintStore.getRotoInterpolationSettings('layer-1', TEST_TRACK_ID)).toEqual({ enabled: false, inBetweenCount: 1, mode: 'duplicate', position: 0, deform: 0 });

    physicPaintStore.setRotoInterpolationSettings('layer-1', TEST_TRACK_ID, { enabled: false });
    const projectionOff = physicPaintStore.extractRuntimeStateForDocument('layer-1', TEST_TRACK_ID);
    physicPaintStore.reset();
    physicPaintStore.installRuntimeStateFromDocument('layer-1', TEST_TRACK_ID, projectionOff);
    expect(physicPaintStore.getFrame('layer-1', TEST_TRACK_ID, 0)?.bytes).toEqual(payloads.get(0)!.bytes);
    expect(physicPaintStore.getFrame('layer-1', TEST_TRACK_ID, 15)?.bytes).toEqual(payloads.get(15)!.bytes);
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
    expect(physicPaintStore.getFrame('layer-1', TEST_TRACK_ID, 0)?.bytes).toEqual(makeAlphaFrame(0, 0, 'independent-0').bytes);
    expect(physicPaintStore.getFrame('layer-1', TEST_TRACK_ID, 26)?.bytes).toEqual(makeAlphaFrame(0, 26, 'independent-26').bytes);
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
    expect(physicPaintStore.getFrame('layer-1', TEST_TRACK_ID, appendedSourceFrame)?.bytes).toEqual(distant.bytes);
    expect(physicPaintStore.getRotoCacheFrames('layer-1', TEST_TRACK_ID)).toEqual(expect.arrayContaining([
      expect.objectContaining({ appFrame: 12, source: 'real-key', sourceFrame: appendedSourceFrame, displayFrame: 12, bytes: distant.bytes }),
    ]));

    physicPaintStore.setRotoInterpolationSettings('layer-1', TEST_TRACK_ID, { enabled: false });

    expect(physicPaintStore.getRotoCacheFrames('layer-1', TEST_TRACK_ID)).toEqual([
      expect.objectContaining({ appFrame: 0, source: 'real-key', sourceFrame: 0, displayFrame: 0 }),
      expect.objectContaining({ appFrame: 1, source: 'real-key', sourceFrame: 1, displayFrame: 1 }),
      expect.objectContaining({ appFrame: 2, source: 'real-key', sourceFrame: 2, displayFrame: 2 }),
      expect.objectContaining({ appFrame: 3, source: 'real-key', sourceFrame: appendedSourceFrame, displayFrame: 3, bytes: distant.bytes }),
    ]);

    const projection = physicPaintStore.extractRuntimeStateForDocument('layer-1', TEST_TRACK_ID);
    physicPaintStore.reset();
    physicPaintStore.installRuntimeStateFromDocument('layer-1', TEST_TRACK_ID, projection);

    expect(physicPaintStore.getFrame('layer-1', TEST_TRACK_ID, 0)?.bytes).toEqual(circle.bytes);
    expect(physicPaintStore.getFrame('layer-1', TEST_TRACK_ID, appendedSourceFrame)?.bytes).toEqual(distant.bytes);
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
    expect(physicPaintStore.getFrame('layer-1', TEST_TRACK_ID, 1)?.bytes).toEqual(square.bytes);
    expect(physicPaintStore.getFrame('layer-1', TEST_TRACK_ID, 2)?.bytes).toEqual(crossed.bytes);
    expect(physicPaintStore.getRotoCacheFrames('layer-1', TEST_TRACK_ID)).toEqual([
      expect.objectContaining({ appFrame: 0, source: 'real-key', sourceFrame: 0, displayFrame: 0, bytes: circle.bytes }),
      expect.objectContaining({ appFrame: 1, source: 'generated-interpolation', fromSourceFrame: 0, toSourceFrame: 1, bytes: circle.bytes }),
      expect.objectContaining({ appFrame: 2, source: 'generated-interpolation', fromSourceFrame: 0, toSourceFrame: 1, bytes: circle.bytes }),
      expect.objectContaining({ appFrame: 3, source: 'generated-interpolation', fromSourceFrame: 0, toSourceFrame: 1, bytes: circle.bytes }),
      expect.objectContaining({ appFrame: 4, source: 'real-key', sourceFrame: 1, displayFrame: 4, bytes: square.bytes }),
      expect.objectContaining({ appFrame: 5, source: 'generated-interpolation', fromSourceFrame: 1, toSourceFrame: 2, bytes: square.bytes }),
      expect.objectContaining({ appFrame: 6, source: 'generated-interpolation', fromSourceFrame: 1, toSourceFrame: 2, bytes: square.bytes }),
      expect.objectContaining({ appFrame: 7, source: 'generated-interpolation', fromSourceFrame: 1, toSourceFrame: 2, bytes: square.bytes }),
      expect.objectContaining({ appFrame: 8, source: 'real-key', sourceFrame: 2, displayFrame: 8, bytes: crossed.bytes }),
    ]);
    expect(physicPaintStore.getRotoFrame('layer-1', TEST_TRACK_ID, 1)?.bytes).toEqual(circle.bytes);
    expect(physicPaintStore.getRotoFrame('layer-1', TEST_TRACK_ID, 4)?.bytes).toEqual(square.bytes);
    expect(physicPaintStore.getRotoFrame('layer-1', TEST_TRACK_ID, 8)?.bytes).toEqual(crossed.bytes);
    expect(physicPaintStore.getRotoFrame('layer-1', TEST_TRACK_ID, 9)).toBeNull();

    expect(physicPaintStore.deleteRotoFrame({ kind: 'delete-roto-frame', trackId: TEST_TRACK_ID, operationId: 'op-delete-crossed', layerId: 'layer-1', startFrame: 8, sourceFrame: 2 }).ok).toBe(true);

    expect(physicPaintStore.getRealRotoKeyFrames('layer-1', TEST_TRACK_ID)).toEqual([0, 1]);
    expect(physicPaintStore.getRotoCacheFrames('layer-1', TEST_TRACK_ID)).toEqual([
      expect.objectContaining({ appFrame: 0, source: 'real-key', sourceFrame: 0 }),
      expect.objectContaining({ appFrame: 1, source: 'generated-interpolation', fromSourceFrame: 0, toSourceFrame: 1, bytes: circle.bytes }),
      expect.objectContaining({ appFrame: 2, source: 'generated-interpolation', fromSourceFrame: 0, toSourceFrame: 1, bytes: circle.bytes }),
      expect.objectContaining({ appFrame: 3, source: 'generated-interpolation', fromSourceFrame: 0, toSourceFrame: 1, bytes: circle.bytes }),
      expect.objectContaining({ appFrame: 4, source: 'real-key', sourceFrame: 1, bytes: square.bytes }),
    ]);
    expect(physicPaintStore.getRotoFrame('layer-1', TEST_TRACK_ID, 8)).toBeNull();
  });

  it('replaces generated Roto cache through existing rendered frame storage', () => {
    physicPaintStore.upsertRealRotoKeyFrame('layer-1', TEST_TRACK_ID, 0, makeFrame(0, 0));
    physicPaintStore.replaceGeneratedRotoCache('layer-1', TEST_TRACK_ID, [
      { ...makeFrame(0, 1), source: 'generated-interpolation', nearestRealKeyFrame: 0 },
      { ...makeFrame(1, 2), source: 'generated-interpolation', nearestRealKeyFrame: 3 },
    ], { enabled: true, inBetweenCount: 2, mode: 'blend', deform: 10, position: 20 });

    expect(physicPaintStore.getRotoFrame('layer-1', TEST_TRACK_ID, 1)?.bytes).toBeInstanceOf(Uint8Array);
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
    expect(physicPaintStore.getRotoFrame('layer-1', TEST_TRACK_ID, 4)?.bytes).toBeInstanceOf(Uint8Array);
  });

  it('v1.0 projection round-trips rendered frames without editable per-frame state', () => {
    physicPaintStore.upsertRealRotoKeyFrame('layer-1', TEST_TRACK_ID, 0, makeFrame(0, 0));
    physicPaintStore.setRotoBackgroundMetadata('layer-1', TEST_TRACK_ID, { background: 'canvas2', paperGrain: 'canvas3', grainStrength: 0.65 });
    physicPaintStore.replaceGeneratedRotoCache('layer-1', TEST_TRACK_ID, [
      { ...makeFrame(0, 1), source: 'generated-interpolation', nearestRealKeyFrame: 0 },
    ], { enabled: true, inBetweenCount: 1, mode: 'duplicate', deform: 5, position: 15 });

    const projection = physicPaintStore.extractRuntimeStateForDocument('layer-1', TEST_TRACK_ID);
    expect(projection.rotoPhysical).toBeNull();
    expect(projection.frames.get(0)?.bytes).toBeInstanceOf(Uint8Array);
    expect(JSON.stringify(projection)).not.toContain('editableStatesByFrame');

    physicPaintStore.reset();
    physicPaintStore.installRuntimeStateFromDocument('layer-1', TEST_TRACK_ID, projection);

    expect(physicPaintStore.getFrame('layer-1', TEST_TRACK_ID, 0)?.bytes).toBeInstanceOf(Uint8Array);
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
    expect(physicPaintStore.getRotoPhysicalRenderSource('layer-1', TEST_TRACK_ID, 1)).toMatchObject({ kind: 'real', appFrame: 1, renderedFrame: { bytes: realOne.bytes } });
    expect(physicPaintStore.getRotoPhysicalRenderSource('layer-1', TEST_TRACK_ID, 2)).toMatchObject({ kind: 'generated', appFrame: 2, leftKeyId: 'key-1', rightKeyId: 'key-4', renderedFrame: { bytes: realOne.bytes } });
    expect(physicPaintStore.getRotoPhysicalRenderSource('layer-1', TEST_TRACK_ID, 3)).toMatchObject({ kind: 'generated', appFrame: 3, leftKeyId: 'key-1', rightKeyId: 'key-4', renderedFrame: { bytes: realOne.bytes } });
    expect(physicPaintStore.getRotoPhysicalRenderSource('layer-1', TEST_TRACK_ID, 4)).toMatchObject({ kind: 'real', appFrame: 4, renderedFrame: { bytes: realFour.bytes } });
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
      bytes: frame.bytes,
    }))).toEqual([
      { displayFrame: 0, sourceFrame: 0, bytes: makeAlphaFrame(0, 0, 'A').bytes },
      { displayFrame: 3, sourceFrame: 1, bytes: makeAlphaFrame(0, 1, 'B').bytes },
      { displayFrame: 6, sourceFrame: 2, bytes: makeAlphaFrame(0, 2, 'C').bytes },
      { displayFrame: 9, sourceFrame: 3, bytes: makeAlphaFrame(0, 3, 'D').bytes },
      { displayFrame: 14, sourceFrame: 14, bytes: makeAlphaFrame(0, 14, 'E').bytes },
      { displayFrame: 26, sourceFrame: 26, bytes: makeAlphaFrame(0, 26, 'F').bytes },
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

    expect(physicPaintStore.getRotoPhysicalRenderSource('layer-1', TEST_TRACK_ID, 0)).toMatchObject({ kind: 'real', appFrame: 0, renderedFrame: { bytes: realCircle.bytes } });
    expect(physicPaintStore.getRotoPhysicalRenderSource('layer-1', TEST_TRACK_ID, 1)).toMatchObject({ kind: 'generated', appFrame: 1, leftKeyId: 'key-0', rightKeyId: 'key-2', renderedFrame: { bytes: realCircle.bytes } });
    expect(physicPaintStore.getRotoPhysicalRenderSource('layer-1', TEST_TRACK_ID, 2)).toMatchObject({ kind: 'real', appFrame: 2, renderedFrame: { bytes: realCross.bytes } });
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

    // 260911-s1j follow-up: Frame blending is retired — a persisted blend
    // state loads as Frame duplicate (the store coerces it at entry).
    expect(physicPaintStore.getRotoPhysicalInterpolationState('layer-1', TEST_TRACK_ID)).toEqual({ enabled: false, mode: 'duplicate' });
    expect(physicPaintStore.getRotoPhysicalRenderSource('layer-1', TEST_TRACK_ID, 1)).toMatchObject({ kind: 'real', appFrame: 1, renderedFrame: { bytes: realOne.bytes } });
    expect(physicPaintStore.getRotoPhysicalRenderSource('layer-1', TEST_TRACK_ID, 4)).toMatchObject({ kind: 'real', appFrame: 4, renderedFrame: { bytes: realFour.bytes } });
    expect(physicPaintStore.getRotoPhysicalRenderSource('layer-1', TEST_TRACK_ID, 2)).toBeNull();
    expect(physicPaintStore.getRotoPhysicalRenderSource('layer-1', TEST_TRACK_ID, 3)).toBeNull();
  });

  it('retires Frame blending at the interpolation-state setter — blend coerces to Frame duplicate and keeps enabled (260911-s1j follow-up)', () => {
    const armed = physicPaintStore.setRotoPhysicalInterpolationState('layer-1', TEST_TRACK_ID, { enabled: true, mode: 'blend' });
    expect(armed.ok).toBe(true);
    expect(physicPaintStore.getRotoPhysicalInterpolationState('layer-1', TEST_TRACK_ID)).toEqual({ enabled: true, mode: 'duplicate' });
    const disarmed = physicPaintStore.setRotoPhysicalInterpolationState('layer-1', TEST_TRACK_ID, { enabled: false, mode: 'blend' });
    expect(disarmed.ok).toBe(true);
    expect(physicPaintStore.getRotoPhysicalInterpolationState('layer-1', TEST_TRACK_ID)).toEqual({ enabled: false, mode: 'duplicate' });
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

    expect(physicPaintStore.getFrame('layer-1', TEST_TRACK_ID, 10)?.bytes).toBeInstanceOf(Uint8Array);
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
      toDataURL: () => pngDataUrl(testPngBytes('restored-alpha-blend')),
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
    registerRotoAlphaCanvasFrame(targetOnly.bytes, { id: 'target-original', width: 2, height: 2 } as unknown as HTMLCanvasElement);
    registerRotoAlphaCanvasFrame(shared.bytes, { id: 'shared-at-snapshot', width: 2, height: 2 } as unknown as HTMLCanvasElement);
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
    registerRotoAlphaCanvasFrame(shared.bytes, { id: 'shared-current', width: 2, height: 2 } as unknown as HTMLCanvasElement);
    registerRotoAlphaCanvasFrame(survivorOnly.bytes, { id: 'survivor-current', width: 2, height: 2 } as unknown as HTMLCanvasElement);

    try {
      physicPaintStore.clearLayer('target-layer');

      expect(physicPaintStore.extractRuntimeStateForDocument('target-layer', TEST_TRACK_ID)).toEqual({ trackId: TEST_TRACK_ID, frames: new Map(), rotoPhysical: null });
      expect(physicPaintStore.getRotoCacheFrames('target-layer', TEST_TRACK_ID)).toEqual([]);
      drawCalls.length = 0;
      expect(renderBlendedRotoInterpolationFrame(shared, survivorOnly, 3, 0.5, { enabled: true, inBetweenCount: 1, mode: 'blend', position: 0, deform: 0 })?.bytes).toEqual(testPngBytes('restored-alpha-blend'));
      expect(drawCalls).toEqual(['shared-current', 'survivor-current']);

      physicPaintStore.restoreLayer(snapshot!);

      expect(physicPaintStore.extractRuntimeStateForDocument('target-layer', TEST_TRACK_ID)).toEqual(outputBefore);
      expect(physicPaintStore.getRotoCacheFrames('target-layer', TEST_TRACK_ID)).toEqual(cacheBefore);
      expect(physicPaintStore.getRotoInterpolationSettings('target-layer', TEST_TRACK_ID)).toEqual({ enabled: true, inBetweenCount: 1, mode: 'duplicate', position: 0, deform: 0 });
      expect(physicPaintStore.getRotoBackgroundMetadata('target-layer', TEST_TRACK_ID)).toEqual({ background: 'canvas2', paperGrain: 'canvas3', grainStrength: 0.65 });
      drawCalls.length = 0;
      expect(renderBlendedRotoInterpolationFrame(targetOnly, shared, 1, 0.5, { enabled: true, inBetweenCount: 1, mode: 'blend', position: 0, deform: 0 })?.bytes).toEqual(testPngBytes('restored-alpha-blend'));
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

    expect(physicPaintStore.getFrame('layer-1', TEST_TRACK_ID, 1)?.bytes).toEqual(realOne.bytes);
    expect(physicPaintStore.getFrame('layer-1', TEST_TRACK_ID, 4)?.bytes).toEqual(realFour.bytes);
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
    expect(generated.every(frame => frame.bytes instanceof Uint8Array)).toBe(true);
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
    expect(physicPaintStore.getFrame('layer-1', TEST_TRACK_ID, 2)?.bytes).toEqual(makeAlphaFrame(0, 2, 'alpha-real-two').bytes);
  });

  it('normalizes visible hold and alpha-blend modes to the selected generated render branch', () => {
    const previous = makeAlphaFrame(0, 1, 'alpha-previous');
    const next = makeAlphaFrame(0, 4, 'alpha-next');
    physicPaintStore.upsertRealRotoKeyFrame('layer-1', TEST_TRACK_ID, 1, previous);
    physicPaintStore.upsertRealRotoKeyFrame('layer-1', TEST_TRACK_ID, 4, next);

    physicPaintStore.setRotoInterpolationSettings('layer-1', TEST_TRACK_ID, { enabled: true, inBetweenCount: 1, mode: 'hold' as never, position: 0, deform: 0 });
    expect(physicPaintStore.getRotoInterpolationSettings('layer-1', TEST_TRACK_ID)).toEqual({ enabled: true, inBetweenCount: 1, mode: 'duplicate', position: 0, deform: 0 });
    expect(physicPaintStore.getRotoFrame('layer-1', TEST_TRACK_ID, 2)?.bytes).toEqual(previous.bytes);

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
            toDataURL: () => pngDataUrl(testPngBytes(`blend(${drawn.join('|')})`)),
          };
        },
      },
    });
    registerRotoAlphaCanvasFrame(previous.bytes, { id: 'previous-canvas', width: 2, height: 2 } as unknown as HTMLCanvasElement);
    registerRotoAlphaCanvasFrame(next.bytes, { id: 'next-canvas', width: 2, height: 2 } as unknown as HTMLCanvasElement);

    try {
      physicPaintStore.setRotoInterpolationSettings('layer-1', TEST_TRACK_ID, { enabled: true, inBetweenCount: 1, mode: 'alpha-blend' as never, position: 0, deform: 0 });
      expect(physicPaintStore.getRotoInterpolationSettings('layer-1', TEST_TRACK_ID)).toEqual({ enabled: true, inBetweenCount: 1, mode: 'blend', position: 0, deform: 0 });
      expect(physicPaintStore.getRotoFrame('layer-1', TEST_TRACK_ID, 2)?.bytes).toEqual(testPngBytes('blend(previous-canvas|next-canvas)'));
      expect(physicPaintStore.getRotoFrame('layer-1', TEST_TRACK_ID, 2)?.bytes).not.toBe(previous.bytes);
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
            toDataURL: () => pngDataUrl(testPngBytes(`blend(${drawn.join('|')})`)),
          };
        },
      },
    });
    registerRotoAlphaCanvasFrame(first.bytes, { id: 'first-canvas', width: 2, height: 2 } as unknown as HTMLCanvasElement);
    registerRotoAlphaCanvasFrame(second.bytes, { id: 'second-canvas', width: 2, height: 2 } as unknown as HTMLCanvasElement);
    registerRotoAlphaCanvasFrame(makeAlphaFrame(0, 1, 'alpha-first-changed').bytes, { id: 'first-changed-canvas', width: 2, height: 2 } as unknown as HTMLCanvasElement);
    registerRotoAlphaCanvasFrame(makeAlphaFrame(0, 3, 'alpha-second-changed').bytes, { id: 'second-changed-canvas', width: 2, height: 2 } as unknown as HTMLCanvasElement);

    try {
      const blend = renderBlendedRotoInterpolationFrame(first, second, 2, 0.5, settings);
      const changedFirst = renderBlendedRotoInterpolationFrame(makeAlphaFrame(0, 1, 'alpha-first-changed'), second, 2, 0.5, settings);
      const changedSecond = renderBlendedRotoInterpolationFrame(first, makeAlphaFrame(0, 3, 'alpha-second-changed'), 2, 0.5, settings);
      const changedBackground = renderBlendedRotoInterpolationFrame({ ...first, backgroundOnly: true, nearestRealKeyFrame: 99 } as never, { ...second, onionBytes: 'data:image/png;base64,cGFwZXI=' } as never, 2, 0.5, settings);

      expect(blend).toMatchObject({ appFrame: 2, frameIndex: 0, source: 'generated-interpolation', width: 2, height: 2 });
      if (!blend || !changedFirst || !changedSecond || !changedBackground) throw new Error('Expected blended frames from registered alpha canvases.');
      expect(blend.bytes).toBeInstanceOf(Uint8Array);
      expect(decodeFlatLog(blend.bytes)).toContain('first-canvas');
      expect(decodeFlatLog(blend.bytes)).toContain('second-canvas');
      expect(decodeFlatLog(blend.bytes)).not.toContain('alpha-blend:');
      expect(decodeFlatLog(blend.bytes)).not.toContain('pos=33');
      expect(decodeFlatLog(blend.bytes)).not.toContain('deform=44');
      expect(changedFirst.bytes).not.toBe(blend.bytes);
      expect(changedSecond.bytes).not.toBe(blend.bytes);
      expect(changedBackground.bytes).toEqual(blend.bytes);
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
      toDataURL: () => pngDataUrl(testPngBytes('visible-blended-png')),
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
    registerRotoAlphaCanvasFrame(first.bytes, { id: 'first-canvas', width: 2, height: 2 } as unknown as HTMLCanvasElement);
    registerRotoAlphaCanvasFrame(second.bytes, { id: 'second-canvas', width: 2, height: 2 } as unknown as HTMLCanvasElement);

    try {
      const blend = renderBlendedRotoInterpolationFrame(first, second, 2, 1 / 3, { enabled: true, inBetweenCount: 1, mode: 'blend', position: 0, deform: 0 });

      expect(blend?.bytes).toEqual(testPngBytes('visible-blended-png'));
      expect(decodeFlatLog(blend!.bytes)).not.toContain('alpha-blend:');
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
    physicPaintStore.setFrame('layer-1', TEST_TRACK_ID, 11, { ...makeFrame(0, 11), bytes: testWebpBytes('c3RhbGUtcGFpbnQ=') });
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
    physicPaintStore.upsertRealRotoKeyFrame('layer-1', TEST_TRACK_ID, 2, { ...makeFrame(0, 2), bytes: testWebpBytes('cmVhbC0y') });
    physicPaintStore.upsertRealRotoKeyFrame('layer-1', TEST_TRACK_ID, 6, { ...makeFrame(0, 6), bytes: testWebpBytes('cmVhbC02') });
    physicPaintStore.setRotoBackgroundMetadata('layer-1', TEST_TRACK_ID, { background: 'canvas1', paperGrain: 'canvas1', grainStrength: 0.45 });

    physicPaintStore.recomputeBackgroundOnlyRotoSupport('layer-1', TEST_TRACK_ID, [4]);

    expect(physicPaintStore.getRealRotoKeyFrames('layer-1', TEST_TRACK_ID)).toEqual([2, 6]);
    expect(physicPaintStore.getFrame('layer-1', TEST_TRACK_ID, 2)?.bytes).toEqual(testWebpBytes('cmVhbC0y'));
    expect(physicPaintStore.getFrame('layer-1', TEST_TRACK_ID, 6)?.bytes).toEqual(testWebpBytes('cmVhbC02'));
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
      renderedFrame: { ...makeFrame(0, 4), bytes: testWebpBytes('bWVyZ2VkLWFscGhhLXJlcGFpbnQ=') },
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
    expect(projection.frames.get(4)?.bytes).toEqual(testWebpBytes('bWVyZ2VkLWFscGhhLXJlcGFpbnQ='));
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
      renderedFrame: { ...makeFrame(0, 4), bytes: testWebpBytes('cmVhbC00') },
    });

    expect(result.ok).toBe(true);
    expect(physicPaintStore.getRotoCacheFrames('layer-1', TEST_TRACK_ID)).toEqual([
      expect.objectContaining({ appFrame: 2, source: 'real-key' }),
      expect.objectContaining({ appFrame: 3, source: 'background-only-support' }),
      expect.objectContaining({ appFrame: 4, source: 'real-key' }),
      expect.objectContaining({ appFrame: 6, source: 'real-key' }),
    ]);
    expect(physicPaintStore.getFrame('layer-1', TEST_TRACK_ID, 4)?.bytes).toEqual(testWebpBytes('cmVhbC00'));
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
            toDataURL: () => pngDataUrl(testPngBytes(`blend(${drawn.join('|')})`)),
          };
        },
      },
    });
    registerRotoAlphaCanvasFrame(alphaOne.bytes, { id: 'one-canvas', width: 2, height: 2 } as unknown as HTMLCanvasElement);
    registerRotoAlphaCanvasFrame(alphaFour.bytes, { id: 'four-canvas', width: 2, height: 2 } as unknown as HTMLCanvasElement);
    registerRotoAlphaCanvasFrame(alphaFourChanged.bytes, { id: 'four-changed-canvas', width: 2, height: 2 } as unknown as HTMLCanvasElement);
    registerRotoAlphaCanvasFrame(alphaTwo.bytes, { id: 'two-canvas', width: 2, height: 2 } as unknown as HTMLCanvasElement);
    registerRotoAlphaCanvasFrame(alphaFive.bytes, { id: 'five-canvas', width: 2, height: 2 } as unknown as HTMLCanvasElement);

    try {
      physicPaintStore.upsertRealRotoKeyFrame('layer-1', TEST_TRACK_ID, 1, alphaOne);
      physicPaintStore.upsertRealRotoKeyFrame('layer-1', TEST_TRACK_ID, 4, alphaFour);
      physicPaintStore.setRotoInterpolationSettings('layer-1', TEST_TRACK_ID, { enabled: true, inBetweenCount: 1, mode: 'blend', position: 0, deform: 0 });
      const initialGenerated = physicPaintStore.getRotoFrame('layer-1', TEST_TRACK_ID, 2)?.bytes;

      physicPaintStore.upsertRealRotoKeyFrame('layer-1', TEST_TRACK_ID, 4, alphaFourChanged);
      expect(physicPaintStore.getRotoFrame('layer-1', TEST_TRACK_ID, 2)?.bytes).not.toBe(initialGenerated);
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
    expect(physicPaintStore.getFrame('layer-1', TEST_TRACK_ID, 2)?.bytes).toEqual(makeAlphaFrame(0, 2, 'alpha-two-kept').bytes);
    expect(physicPaintStore.getFrame('layer-1', TEST_TRACK_ID, 5)?.bytes).toEqual(makeAlphaFrame(0, 5, 'alpha-five-kept').bytes);
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

    expect(physicPaintStore.getFrame('layer-1', TEST_TRACK_ID, 4)?.bytes).toEqual(makeAlphaFrame(0, 4, 'alpha-failure-kept').bytes);
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
    const bytes = testWebpBytes('cG9pc29uZWQ=');
    const canvas = { width: 4, height: 3 } as HTMLCanvasElement;
    registerRotoAlphaCanvasFrame(bytes, canvas);
    expect(hasRotoAlphaCanvasFrame(bytes)).toBe(true);
    expect(hasRotoAlphaCanvasFrame(bytes, { width: 4, height: 3 })).toBe(true);
    // The poison: a caller zeroed the canvas AFTER registration (the G-52-10
    // bug). The entry must read as absent — otherwise the early-return in
    // registerRotoAlphaCanvasFrameFromDataUrl would keep the poisoned canvas.
    canvas.width = 0;
    canvas.height = 0;
    expect(hasRotoAlphaCanvasFrame(bytes)).toBe(false);
    expect(hasRotoAlphaCanvasFrame(bytes, { width: 4, height: 3 })).toBe(false);
  });

  describe('canonical physical-operation lease registry', () => {
    const physicalDocument = (bytes = testWebpBytes('AAAA')) => {
      const realKeyRecords = [{
        kind: 'real-key' as const,
        keyId: 'key-1',
        appFrame: 1,
        payload: { frameIndex: 0, appFrame: 1, bytes, width: 2, height: 2 },
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
      const nextDocument = physicalDocument(testWebpBytes('BBBB'));

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
    const contentDocument = (bytes = testWebpBytes('AAAA')) => {
      const realKeyRecords = [{
        kind: 'real-key' as const,
        keyId: 'key-1',
        appFrame: 1,
        payload: { frameIndex: 0, appFrame: 1, bytes, width: 2, height: 2 },
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

      const docB = contentDocument(testWebpBytes('BBBB'));
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
  // so the flattened renderedFrame.bytes IS the observable op log.
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
        // Label any src-bearing image (FlatTestBitmap) by its src; canvases
        // and other sources log as 'canvas'.
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
      log(): string {
        return this.ops.map((op) => {
          switch (op.type) {
            case 'clearRect': return 'clear';
            case 'save': return 'save';
            case 'restore': return 'restore';
            case 'fillRect': return `fill(${op.fillStyle},${op.globalAlpha},${op.globalCompositeOperation})`;
            case 'drawImage': return `draw(${op.source},${op.globalAlpha},${op.globalCompositeOperation})`;
          }
        }).join('|');
      }
      toDataURL(): string {
        return webpDataUrl(testWebpBytes(this.log()));
      }
    }

    class FlatTestBitmap {
      width = 4;
      height = 3;
      src = 'bitmap:test-frame';
      close = vi.fn();
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

    function flatDocument(tracks: InternalPaintTrack[], background?: Partial<EfxPaintDocument['background']>, layerId = FLAT_LAYER): EfxPaintDocument {
      const base = createEfxPaintDocument(layerId);
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
      keys: Array<{ keyId: string; appFrame: number; bytes: Uint8Array }>,
      options: { background?: { background: 'canvas1' | 'canvas2' | 'canvas3' | 'transparent'; paperGrain: string; grainStrength: number } | null; loopClips?: PhysicPaintRotoLoopClip[] } = {},
      layerId = FLAT_LAYER,
    ): void {
      const records = keys.map((key) => ({
        keyId: key.keyId,
        appFrame: key.appFrame,
        kind: 'real-key' as const,
        payload: { frameIndex: 0, appFrame: key.appFrame, bytes: key.bytes },
      }));
      const loopClips = options.loopClips ?? [];
      const interpolation = { enabled: false, mode: 'duplicate' as const };
      const result = physicPaintStore.replaceRotoPhysicalDocument(layerId, trackId, {
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
      createdCanvases = [];
      resetProjectPaperRasterForTests();
      _setPhysicPaintCompositorSizeProvider(() => ({ width: 4, height: 3 }));
      decodeWebpFrameMock.mockReset();
      decodeWebpFrameMock.mockResolvedValue({ width: 4, height: 3, rgba: new Uint8Array(4 * 3 * 4) });
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
      vi.stubGlobal('HTMLCanvasElement', FlatTestCanvas);
      vi.stubGlobal('ImageData', class {
        constructor(public data: Uint8ClampedArray, public width: number, public height: number) {}
      });
      vi.stubGlobal('createImageBitmap', async (_imageData: unknown, _options: unknown) => new FlatTestBitmap());
      // The paper fond path (projectPaperRaster) loads its texture via `new
      // Image()`; the stub never fires onload so the texture stays unresolved
      // and the deterministic color-fill fallback draws (the fond tests assert
      // the texture-less fallback).
      vi.stubGlobal('Image', class {
        src = '';
        onload: (() => void) | null = null;
        onerror: (() => void) | null = null;
      });
    });

    afterEach(() => {
      _setPhysicPaintCompositorSizeProvider(null);
      vi.unstubAllGlobals();
    });

    // 52.1-04 (D-13): the decode is async (decode_webp_frame → createImageBitmap).
    // A flatten that returns null this tick has kicked off a decode; flush the
    // microtask queue and re-query so the LRU hit resolves the raster. With N
    // tracks the flatten returns null as soon as the FIRST unresolved track's
    // decode is pending, so each re-query resolves one more track — loop until
    // the record materializes (bounded to avoid an infinite loop on a real bug).
    async function flattenAfterDecode(layerId: string, frame: number, includeFond = true) {
      for (let attempt = 0; attempt < 20; attempt += 1) {
        const record = physicPaintStore.getFlattenedFrame(layerId, frame, includeFond);
        if (record !== null) return record;
        await flushDecode();
      }
      return null;
    }

    it('RED 1 guard: returns null for an unknown layer and for non-integer/negative frames', () => {
      expect(physicPaintStore.getFlattenedFrame('unknown-layer', 5)).toBeNull();
      registerDocument(flatDocument([flatTrack('track-a')], { visible: false }));
      expect(physicPaintStore.getFlattenedFrame(FLAT_LAYER, 1.5)).toBeNull();
      expect(physicPaintStore.getFlattenedFrame(FLAT_LAYER, -1)).toBeNull();
      expect(physicPaintStore.getFlattenedFrame(FLAT_LAYER, NaN)).toBeNull();
    });

    it('RED 2 single-track parity: flattened dataUrl is the composite of fallback + the track frame', async () => {
      const frameDataUrl = makeFrame(0, 5).bytes;
      registerDocument(flatDocument([flatTrack('track-a')], { visible: false }));
      seedRoto('track-a', [{ keyId: 'ka', appFrame: 5, bytes: frameDataUrl }]);

      const record = await flattenAfterDecode(FLAT_LAYER, 5);
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
      const frameImage = new FlatTestBitmap();
      refCtx.drawImage(frameImage);
      refCtx.restore();
      expect((await record!.encodeBytes())).toEqual(testWebpBytes('clear|save|draw(bitmap:test-frame,1,source-over)|restore'));
    });

    it('G-52-8 (FIX 3): a hydrated payload composites from the alpha registry canvas — zero compositor Image decodes', async () => {
      const frameDataUrl = makeFrame(0, 5).bytes;
      registerDocument(flatDocument([flatTrack('track-a')], { visible: false }));
      seedRoto('track-a', [{ keyId: 'ka', appFrame: 5, bytes: frameDataUrl }]);
      // Launch-hydration twin: the exact payload is already decoded off the
      // main thread in the alpha registry, so _preResolveTrackContent must
      // reuse that canvas instead of re-decoding the bytes (the G-52-8
      // per-frame scrub cost). The registry canvas short-circuits the decode
      // path entirely — decodeWebpFrame must never be invoked.
      const hydratedCanvas = new FlatTestCanvas([]);
      hydratedCanvas.width = 4;
      hydratedCanvas.height = 3;
      registerRotoAlphaCanvasFrame(frameDataUrl, hydratedCanvas as unknown as HTMLCanvasElement);

      const record = await flattenAfterDecode(FLAT_LAYER, 5);

      expect(record).not.toBeNull();
      expect(decodeWebpFrameMock).not.toHaveBeenCalled();
      // The composite drew the registry canvas itself, not a decoded bitmap.
      const composite = record!.raster as unknown as FlatTestCanvas;
      expect(composite.ops).toContainEqual(expect.objectContaining({ type: 'drawImage', source: 'canvas' }));
      expect(composite.ops).not.toContainEqual(expect.objectContaining({ type: 'drawImage', source: 'bitmap:test-frame' }));
    });

    it('G-52-10: a zero-size registry entry is skipped — the compositor falls back to decoding the dataUrl', async () => {
      const frameDataUrl = makeFrame(0, 5).bytes;
      registerDocument(flatDocument([flatTrack('track-a')], { visible: false }));
      seedRoto('track-a', [{ keyId: 'ka', appFrame: 5, bytes: frameDataUrl }]);
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

      const record = await flattenAfterDecode(FLAT_LAYER, 5);

      expect(record).not.toBeNull();
      const composite = record!.raster as unknown as FlatTestCanvas;
      expect(composite.ops).toContainEqual(expect.objectContaining({ type: 'drawImage', source: 'bitmap:test-frame' }));
      expect(composite.ops).not.toContainEqual(expect.objectContaining({ type: 'drawImage', source: 'canvas' }));
    });

    it('D-14 premultiplyAlpha: the decode path premultiplies at bitmap creation (WKWebView draws straight-flagged bitmaps as premultiplied — the washed-out wash)', async () => {
      const createImageBitmapSpy = vi.fn(async (_imageData: unknown, _options: unknown) => new FlatTestBitmap());
      vi.stubGlobal('createImageBitmap', createImageBitmapSpy);
      registerDocument(flatDocument([flatTrack('track-a')], { visible: false }));
      seedRoto('track-a', [{ keyId: 'ka', appFrame: 5, bytes: makeFrame(0, 5).bytes }]);

      await flattenAfterDecode(FLAT_LAYER, 5);
      expect(createImageBitmapSpy).toHaveBeenCalledWith(expect.anything(), { premultiplyAlpha: 'premultiply' });
    });

    it('REPRO 52.1 refresh: a real-key payload update rotates the flattened memo and re-decodes the new bytes', async () => {
      const bytesA = testWebpBytes(btoa('refresh-content-A'));
      registerDocument(flatDocument([flatTrack('track-a')], { visible: false }));
      seedRoto('track-a', [{ keyId: 'ka', appFrame: 5, bytes: bytesA }]);

      const recordA = await flattenAfterDecode(FLAT_LAYER, 5);
      expect(recordA).not.toBeNull();
      const decodesBefore = decodeWebpFrameMock.mock.calls.length;

      // Close-time apply-canvas twin: new bytes land on the SAME key.
      const revision = physicPaintStore.getRotoPhysicalContentRevision(FLAT_LAYER, 'track-a')!;
      const bytesB = testWebpBytes(btoa('refresh-content-B-different'));
      const update = physicPaintStore.updateRotoPhysicalRealKeyPayload(FLAT_LAYER, 'track-a', 'ka', revision, { frameIndex: 0, appFrame: 5, bytes: bytesB });
      expect(update).toMatchObject({ ok: true, changed: true });

      const recordB = await flattenAfterDecode(FLAT_LAYER, 5);
      expect(recordB).not.toBeNull();
      expect(recordB!.cacheKey).not.toBe(recordA!.cacheKey);
      // The new bytes missed the registry and LRU, so a fresh Rust decode ran.
      expect(decodeWebpFrameMock.mock.calls.length).toBeGreaterThan(decodesBefore);
    });

    it('G-52-8 (FIX 4): the flattened record carries its raster and encodes dataUrl lazily — once, on first read', async () => {
      const frameDataUrl = makeFrame(0, 5).bytes;
      registerDocument(flatDocument([flatTrack('track-a')], { visible: false }));
      seedRoto('track-a', [{ keyId: 'ka', appFrame: 5, bytes: frameDataUrl }]);
      const encodeSpy = vi.mocked(encodeCanvasAsWebp);
      try {
        const record = await flattenAfterDecode(FLAT_LAYER, 5);

        expect(record).not.toBeNull();
        // The flatten itself encodes NOTHING — draw surfaces consume the
        // raster; the PNG encode is no longer on the draw path.
        expect(encodeSpy).not.toHaveBeenCalled();
        expect(record!.raster).toBeDefined();

        const firstRead = (await record!.encodeBytes());
        expect(encodeSpy).toHaveBeenCalledTimes(1);
        expect((await record!.encodeBytes())).toEqual(firstRead);
        expect(encodeSpy).toHaveBeenCalledTimes(1);

        // A memo hit returns the same record; the memoized encode survives.
        const again = physicPaintStore.getFlattenedFrame(FLAT_LAYER, 5)!;
        expect(again).toBe(record);
        expect((await again.encodeBytes())).toEqual(firstRead);
        expect(encodeSpy).toHaveBeenCalledTimes(1);
      } finally {
        encodeSpy.mockRestore();
      }
    });

    it('RED 3 multi-track: draws both visible tracks bottom-to-top and cacheKey equals deriveEfxPaintFlattenedCacheKey', async () => {
      const frameA = makeFrame(0, 5).bytes;
      const frameB = makeFrame(0, 5).bytes;
      registerDocument(flatDocument([
        flatTrack('track-b', { order: 1, opacity: 0.5, blendMode: 'multiply' }),
        flatTrack('track-a', { order: 0 }),
      ], { visible: false }));
      seedRoto('track-a', [{ keyId: 'ka', appFrame: 5, bytes: frameA }]);
      seedRoto('track-b', [{ keyId: 'kb', appFrame: 5, bytes: frameB }]);

      const record = (await flattenAfterDecode(FLAT_LAYER, 5))!;
      const log = decodeFlatLog((await record.encodeBytes()));
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

    it('RED 4 hidden track excluded: hiding track B removes its pixels and its content term from the key', async () => {
      const frameA = makeFrame(0, 5).bytes;
      // Distinct dataUrl from track A so the hidden-track assertion can
      // distinguish whose pixels remain in the flattened log.
      const frameB = makeFrame(1, 5).bytes;
      registerDocument(flatDocument([
        flatTrack('track-a', { order: 0 }),
        flatTrack('track-b', { order: 1 }),
      ], { visible: false }));
      seedRoto('track-a', [{ keyId: 'ka', appFrame: 5, bytes: frameA }]);
      seedRoto('track-b', [{ keyId: 'kb', appFrame: 5, bytes: frameB }]);

      const visibleRecord = (await flattenAfterDecode(FLAT_LAYER, 5))!;
      expect(decodeFlatLog((await visibleRecord.encodeBytes())).match(/draw\(/g)?.length).toBe(2);

      setTrackVisible(FLAT_LAYER, 'track-b', false);
      const hiddenRecord = (await flattenAfterDecode(FLAT_LAYER, 5))!;
      expect(decodeFlatLog((await hiddenRecord.encodeBytes())).match(/draw\(/g)?.length).toBe(1);
      expect(decodeFlatLog((await hiddenRecord.encodeBytes()))).not.toContain('bitmap:test-frame-b');

      const expectedKey = deriveEfxPaintFlattenedCacheKey({
        document: getEfxPaintDocument(FLAT_LAYER)!,
        trackContentRevisions: new Map([['track-a', physicPaintStore.getRotoPhysicalContentRevision(FLAT_LAYER, 'track-a')!]]),
        backgroundClipRevisions: [],
        frame: 5,
      });
      expect(hiddenRecord.cacheKey).toBe(expectedKey);
    });

    it('RED 4b background source bytes rotate the flattened key (49-06 UAT round 6)', async () => {
      const bgRef = 'bg-ref-1';
      const bgDataUrl = makeFrame(2, 5).bytes;
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
      const before = (await flattenAfterDecode(FLAT_LAYER, 0))!;
      expect(before.missing).toContainEqual({ trackId: 'background-1', frame: 0, missingRefs: [bgRef] });

      // Bytes arriving MUST rotate the flattened key — the composite content
      // changes while the document does not, so the monitor's compare-then-draw
      // guard (cacheKey-based) must see a new key and redraw the background.
      registerBackgroundSourceImage(bgRef, bgDataUrl);
      const after = (await flattenAfterDecode(FLAT_LAYER, 0))!;
      expect(after.cacheKey).not.toBe(before.cacheKey);
      expect(after.missing).not.toContainEqual({ trackId: 'background-1', frame: 0, missingRefs: [bgRef] });
      expect(decodeFlatLog((await after.encodeBytes()))).toContain('draw(');
    });

    it('RED 5 missing content renders transparent + a report and never contributes pixels', async () => {
      const frameA = makeFrame(0, 5).bytes;
      registerDocument(flatDocument([
        flatTrack('track-a', { order: 0 }),
        flatTrack('track-b', { order: 1 }),
      ], { visible: false }));
      seedRoto('track-a', [{ keyId: 'ka', appFrame: 5, bytes: frameA }]);
      // track-b has a real key at frame 0 only — frame 5 resolves null.
      seedRoto('track-b', [{ keyId: 'kb', appFrame: 0, bytes: makeFrame(0, 0).bytes }]);

      const record = (await flattenAfterDecode(FLAT_LAYER, 5))!;
      expect(record.missing).toEqual([{ trackId: 'track-b', frame: 5, missingRefs: [] }]);
      expect(decodeFlatLog((await record.encodeBytes())).match(/draw\(/g)?.length).toBe(1);
      expect(decodeFlatLog((await record.encodeBytes()))).toContain('draw(');

      // Loop-placeholder case: a loop clip whose source ref has no resolvable
      // real key reports the missing refs (D-09) and contributes nothing.
      registerDocument(flatDocument([flatTrack('track-c')], { visible: false }));
      seedRoto('track-c', [{ keyId: 'kc', appFrame: 0, bytes: makeFrame(0, 0).bytes }], {
        loopClips: [{ loopId: 'loop-1', placementStart: 3, sourceKeyIds: ['missing-ref-1'], repeat: 'infinity', mode: 'progressive' }],
      });
      const loopRecord = (await flattenAfterDecode(FLAT_LAYER, 5))!;
      expect(loopRecord.missing).toEqual([{ trackId: 'track-c', frame: 5, missingRefs: ['missing-ref-1'] }]);
      expect(decodeFlatLog((await loopRecord.encodeBytes())).match(/draw\(/g)).toBeNull();
    });

    it('RED 6 cache hit: unchanged inputs return the identical cached record with zero recompute', async () => {
      registerDocument(flatDocument([flatTrack('track-a')], { visible: false }));
      seedRoto('track-a', [{ keyId: 'ka', appFrame: 5, bytes: makeFrame(0, 5).bytes }]);

      const first = (await flattenAfterDecode(FLAT_LAYER, 5))!;
      const canvasCountAfterFirst = createdCanvases.length;
      const second = physicPaintStore.getFlattenedFrame(FLAT_LAYER, 5);
      expect(second).toBe(first);
      expect(second!.renderedFrame).toBe(first.renderedFrame);
      expect(createdCanvases.length).toBe(canvasCountAfterFirst);
      expect((await second!.encodeBytes())).toEqual((await first.encodeBytes()));
    });

    it('RED 7 decode pending: returns null for that tick and the raster after the decode completes', async () => {
      let resolveDecode!: (value: { width: number; height: number; rgba: Uint8Array }) => void;
      decodeWebpFrameMock.mockReturnValueOnce(new Promise((resolve) => { resolveDecode = resolve; }));
      registerDocument(flatDocument([flatTrack('track-a')], { visible: false }));
      seedRoto('track-a', [{ keyId: 'ka', appFrame: 5, bytes: makeFrame(0, 5).bytes }]);

      expect(physicPaintStore.getFlattenedFrame(FLAT_LAYER, 5)).toBeNull();
      resolveDecode({ width: 4, height: 3, rgba: new Uint8Array(4 * 3 * 4) });
      await flushDecode();
      const record = physicPaintStore.getFlattenedFrame(FLAT_LAYER, 5);
      expect(record).not.toBeNull();
      expect(decodeFlatLog((await record!.encodeBytes()))).toContain('draw(');
    });

    it('RED 8 paper fond law: the per-track raster excludes paper; the fond draws once beneath the flattened composite', async () => {
      const frameDataUrl = makeFrame(0, 5).bytes;
      // 49-03 (D-11): the fond comes from the DOCUMENT fallback — the per-track
      // roto background metadata walk is deleted. The seedRoto background option
      // is kept to prove the fallback is authoritative even when metadata exists.
      registerDocument(flatDocument([flatTrack('track-a')], {
        visible: false,
        fallback: { mode: 'paper', texture: 'canvas1', paperGrain: true, grainStrength: 0 },
      }));
      seedRoto('track-a', [{ keyId: 'ka', appFrame: 5, bytes: frameDataUrl }], {
        background: { background: 'canvas1', paperGrain: 'canvas1', grainStrength: 0 },
      });

      const record = (await flattenAfterDecode(FLAT_LAYER, 5))!;
      // The composite canvas consumed the track's BARE frame image — no paper
      // composite, no fill: an upper track can never mask a lower one.
      const compositeCanvas = createdCanvases[0];
      expect(compositeCanvas.log()).toBe('clear|save|draw(bitmap:test-frame,1,source-over)|restore');
      // The paper fond is drawn ONCE beneath the flattened raster (the
      // deterministic color-fill + grain fallback, texture-less by contract).
      expect((await record.encodeBytes())).toEqual(testWebpBytes('fill(#f4efe3,1,source-over)|draw(canvas,1,source-over)'));
    });

    it('RED 8b two papered tracks: no masking — both frames composite and the fond draws exactly once beneath', async () => {
      const frameA = makeFrame(0, 5).bytes;
      const frameB = makeFrame(1, 5).bytes;
      // 49-03 (D-11): the fond comes from the DOCUMENT fallback (canvas1 paper).
      registerDocument(flatDocument([
        flatTrack('track-a', { order: 0 }),
        flatTrack('track-b', { order: 1 }),
      ], {
        visible: false,
        fallback: { mode: 'paper', texture: 'canvas1', paperGrain: true, grainStrength: 0 },
      }));
      seedRoto('track-a', [{ keyId: 'ka', appFrame: 5, bytes: frameA }], {
        background: { background: 'canvas1', paperGrain: 'canvas1', grainStrength: 0 },
      });
      seedRoto('track-b', [{ keyId: 'kb', appFrame: 5, bytes: frameB }], {
        background: { background: 'canvas1', paperGrain: 'canvas1', grainStrength: 0 },
      });

      const record = (await flattenAfterDecode(FLAT_LAYER, 5))!;
      // Both tracks' bare frames draw in bottom-to-top order — no per-track
      // paper composite masking the lower track.
      const compositeCanvas = createdCanvases[0];
      expect(compositeCanvas.log()).toBe('clear|save|draw(bitmap:test-frame,1,source-over)|restore|save|draw(bitmap:test-frame,1,source-over)|restore');
      // Exactly ONE fond fill beneath the composite, resolved from the
      // document fallback.
      expect(decodeFlatLog((await record.encodeBytes())).match(/fill\(#f4efe3/g)?.length).toBe(1);
      expect(decodeFlatLog((await record.encodeBytes()))).toContain('draw(canvas,1,source-over)');
    });

    it('RED 8c fond-less variant (48-06 UAT-C): includeFond=false skips the paper fond and uses its own cache key', async () => {
      const frameDataUrl = makeFrame(0, 5).bytes;
      // 49-03 (D-11): the fond comes from the DOCUMENT fallback (canvas1 paper).
      registerDocument(flatDocument([flatTrack('track-a')], {
        visible: false,
        fallback: { mode: 'paper', texture: 'canvas1', paperGrain: true, grainStrength: 0 },
      }));
      seedRoto('track-a', [{ keyId: 'ka', appFrame: 5, bytes: frameDataUrl }], {
        background: { background: 'canvas1', paperGrain: 'canvas1', grainStrength: 0 },
      });

      const withFond = (await flattenAfterDecode(FLAT_LAYER, 5))!;
      const noFond = (await flattenAfterDecode(FLAT_LAYER, 5, false))!;

      // The with-fond record carries the paper beneath the composite…
      expect((await withFond.encodeBytes())).toEqual(testWebpBytes('fill(#f4efe3,1,source-over)|draw(canvas,1,source-over)'));
      // …the fond-less record is the bare composite (the Studio monitor reads
      // this; the paper lives on its own layer beneath the isolated tracks
      // group, so the active track's CSS blend never meets it).
      expect((await noFond.encodeBytes())).toEqual(testWebpBytes('clear|save|draw(bitmap:test-frame,1,source-over)|restore'));
      // Distinct memo entries: the `fond:0` key term separates the variants.
      expect(noFond.cacheKey).not.toBe(withFond.cacheKey);
      // The missing report is identical either way (the fond never contributes).
      expect(noFond.missing).toEqual(withFond.missing);
    });

    // 49-03 Task 1 (D-11 consumption half) — SUPERSEDED on its RESOLUTION half
    // by 260920-k34 / 53-CONTEXT D-09: the track's OWN paper governs the fond,
    // and the document fallback is consulted only when the track has no paper of
    // its own. D-11's STRUCTURAL half stands: the paper remains ONE
    // composite-level fond beneath the tracks, never per-track raster content.
    it('49-03 T1 (rewritten by 260920-k34): the active track\'s own paper governs the fond over the document fallback', async () => {
      const frameDataUrl = makeFrame(0, 5).bytes;
      registerDocument(flatDocument([flatTrack('track-a')], {
        visible: false,
        fallback: { mode: 'solid', color: '#ffffff' },
      }));
      seedRoto('track-a', [{ keyId: 'ka', appFrame: 5, bytes: frameDataUrl }], {
        background: { background: 'canvas1', paperGrain: 'canvas1', grainStrength: 0 },
      });

      const record = (await flattenAfterDecode(FLAT_LAYER, 5))!;
      // The track carries its own paper (canvas1): it governs, so the solid
      // white fallback never reaches the fond. The fallback-only path is pinned
      // by the rewritten 49-03 T4 below.
      expect((await record.encodeBytes())).toEqual(testWebpBytes('fill(#f4efe3,1,source-over)|draw(canvas,1,source-over)'));
    });

    it('49-03 T2: paper canvas2 fallback draws the canvas2 paper; transparent fallback produces no fond', async () => {
      const frameDataUrl = makeFrame(0, 5).bytes;
      registerDocument(flatDocument([flatTrack('track-a')], {
        visible: false,
        fallback: { mode: 'paper', texture: 'canvas2', paperGrain: false, grainStrength: 0 },
      }));
      seedRoto('track-a', [{ keyId: 'ka', appFrame: 5, bytes: frameDataUrl }]);

      const record = (await flattenAfterDecode(FLAT_LAYER, 5))!;
      // canvas2 paper draw beneath the composite (parity with the paper path
      // produced today via metadata).
      expect((await record.encodeBytes())).toEqual(testWebpBytes('fill(#ebe3d2,1,source-over)|draw(canvas,1,source-over)'));

      // Transparent fallback → no fond instruction → the bare composite.
      registerDocument(flatDocument([flatTrack('track-a')], {
        visible: false,
        fallback: { mode: 'transparent' },
      }));
      const transparentRecord = (await flattenAfterDecode(FLAT_LAYER, 5))!;
      expect((await transparentRecord.encodeBytes())).toEqual(testWebpBytes('clear|save|draw(bitmap:test-frame,1,source-over)|restore'));
    });

    // 49-03 T4 — rewritten by 260920-k34 to the precedence D-09 (53-CONTEXT)
    // supersedes it with: the fallback is no longer the single authority, it is
    // the FALLBACK OF THE FALLBACK. Deleting the track's own paper is exactly
    // the case that still reaches it.
    it('49-03 T4 (rewritten by 260920-k34): deleting the track\'s paper metadata falls back to the document fallback', async () => {
      const frameDataUrl = makeFrame(0, 5).bytes;
      registerDocument(flatDocument([flatTrack('track-a')], {
        visible: false,
        fallback: { mode: 'solid', color: '#ffffff' },
      }));
      seedRoto('track-a', [{ keyId: 'ka', appFrame: 5, bytes: frameDataUrl }], {
        background: { background: 'canvas1', paperGrain: 'canvas1', grainStrength: 0 },
      });

      const withMetadata = (await flattenAfterDecode(FLAT_LAYER, 5))!;
      expect((await withMetadata.encodeBytes())).toEqual(testWebpBytes('fill(#f4efe3,1,source-over)|draw(canvas,1,source-over)'));

      // …and once the entry is deleted (re-seed with background: null and force
      // a recompute with a fresh content revision) the document fallback fills
      // white again — the track has no paper of its own any more.
      const frameDataUrl2 = makeFrame(1, 5).bytes;
      seedRoto('track-a', [{ keyId: 'ka', appFrame: 5, bytes: frameDataUrl2 }], { background: null });
      const afterDelete = (await flattenAfterDecode(FLAT_LAYER, 5))!;
      expect((await afterDelete.encodeBytes())).toEqual(testWebpBytes('fill(#ffffff,1,source-over)|draw(canvas,1,source-over)'));
    });

    // -----------------------------------------------------------------------
    // 260920-k34 — the fond resolution (53-CONTEXT D-09). At the plan base the
    // DRAW authority (`_resolveDocumentFondInstruction`) reads ONLY the document
    // fallback while the PRELOAD GATE reads the active track's mirror: the
    // resolution is split across two sources. These legs pin the law that
    // replaces it — the ACTIVE TRACK's paper first, the fallback only when the
    // track has no paper of its own — and the raw RED output decides which
    // source won per surface.
    // -----------------------------------------------------------------------
    it('k34-A (RED): the active track\'s own paper governs the fond — not the document fallback', async () => {
      // The reported case: the Studio's own initial paper (canvas1 + grain
      // 0.45) lives in the active track's mirror; the document fallback is a
      // different paper (canvas2). The export must show canvas1 + grain.
      registerDocument(flatDocument([flatTrack('track-a')], {
        visible: false,
        fallback: { mode: 'paper', texture: 'canvas2', paperGrain: false, grainStrength: 0 },
      }));
      seedRoto('track-a', [{ keyId: 'ka', appFrame: 5, bytes: makeFrame(0, 5).bytes }], {
        background: { background: 'canvas1', paperGrain: 'canvas1', grainStrength: 0.45 },
      });

      const record = (await flattenAfterDecode(FLAT_LAYER, 5))!;
      const log = decodeFlatLog((await record.encodeBytes()));
      expect(log).toContain('fill(#f4efe3,1,source-over)');
      expect(log).toContain('fill(#000000,'); // the deterministic grain
      expect(log).not.toContain('#ebe3d2');
      expect(log).toContain('draw(canvas,1,source-over)');
    });

    it('k34-B (control, green): a track with no paper of its own still draws the document fond', async () => {
      registerDocument(flatDocument([flatTrack('track-a')], {
        visible: false,
        fallback: { mode: 'paper', texture: 'canvas1', paperGrain: true, grainStrength: 0 },
      }));
      seedRoto('track-a', [{ keyId: 'ka', appFrame: 5, bytes: makeFrame(0, 5).bytes }], { background: null });

      const record = (await flattenAfterDecode(FLAT_LAYER, 5))!;
      expect((await record.encodeBytes())).toEqual(testWebpBytes('fill(#f4efe3,1,source-over)|draw(canvas,1,source-over)'));
    });

    it('k34-C (RED): an active-track switch resolves the new track\'s paper and rotates the flattened memo', async () => {
      // `activeTrackId` is not a term of the flattened key, so the memo MUST be
      // rotated explicitly when the resolution changes with the active track.
      registerDocument(flatDocument([
        flatTrack('track-a'),
        flatTrack('track-b', { order: 1 }),
      ]));
      seedRoto('track-a', [{ keyId: 'ka', appFrame: 5, bytes: makeFrame(0, 5).bytes }], {
        background: { background: 'canvas1', paperGrain: 'canvas1', grainStrength: 0 },
      });
      seedRoto('track-b', [{ keyId: 'kb', appFrame: 5, bytes: makeFrame(1, 5).bytes }], {
        background: { background: 'canvas3', paperGrain: 'canvas3', grainStrength: 0 },
      });

      const trackARecord = (await flattenAfterDecode(FLAT_LAYER, 5))!;
      expect(decodeFlatLog((await trackARecord.encodeBytes()))).toContain('fill(#f4efe3,1,source-over)');

      expect(setActiveTrackId(FLAT_LAYER, 'track-b')).toBe(true);
      const trackBRecord = (await flattenAfterDecode(FLAT_LAYER, 5))!;
      const trackBLog = decodeFlatLog((await trackBRecord.encodeBytes()));
      expect(trackBLog).toContain('fill(#ded2bc,1,source-over)');
      expect(trackBLog).not.toContain('#f4efe3');
    });

    it('k34-D (RED): each layer resolves its own document\'s active-track paper', async () => {
      registerDocument(flatDocument([flatTrack('track-a')], {
        visible: false,
        fallback: { mode: 'solid', color: '#ffffff' },
      }));
      seedRoto('track-a', [{ keyId: 'ka', appFrame: 5, bytes: makeFrame(0, 5).bytes }], {
        background: { background: 'canvas1', paperGrain: 'canvas1', grainStrength: 0 },
      });
      registerDocument(flatDocument([flatTrack('track-a')], {
        visible: false,
        fallback: { mode: 'solid', color: '#ffffff' },
      }, 'flat-layer-b'));
      seedRoto('track-a', [{ keyId: 'kb', appFrame: 5, bytes: makeFrame(1, 5).bytes }], {
        background: { background: 'canvas2', paperGrain: 'canvas2', grainStrength: 0 },
      }, 'flat-layer-b');

      const first = (await flattenAfterDecode(FLAT_LAYER, 5))!;
      expect((await first.encodeBytes())).toEqual(testWebpBytes('fill(#f4efe3,1,source-over)|draw(canvas,1,source-over)'));
      const second = (await flattenAfterDecode('flat-layer-b', 5))!;
      expect((await second.encodeBytes())).toEqual(testWebpBytes('fill(#ebe3d2,1,source-over)|draw(canvas,1,source-over)'));
    });

    it('k34-E (control, green): the two-solo behavior never reaches the fond resolution', async () => {
      // The fond follows the ACTIVE track's paper and nothing else — neither the
      // solo arm nor the visibility flag may rotate it.
      registerDocument(flatDocument([
        flatTrack('track-a'),
        flatTrack('track-b', { order: 1 }),
      ], {
        visible: false,
        fallback: { mode: 'paper', texture: 'canvas1', paperGrain: false, grainStrength: 0 },
      }));
      seedRoto('track-a', [{ keyId: 'ka', appFrame: 5, bytes: makeFrame(0, 5).bytes }], {
        background: { background: 'canvas1', paperGrain: 'canvas1', grainStrength: 0 },
      });
      seedRoto('track-b', [{ keyId: 'kb', appFrame: 5, bytes: makeFrame(1, 5).bytes }], {
        background: { background: 'canvas2', paperGrain: 'canvas2', grainStrength: 0 },
      });

      const fondLog = async (): Promise<string> => {
        const record = (await flattenAfterDecode(FLAT_LAYER, 5))!;
        return decodeFlatLog((await record.encodeBytes()));
      };

      const baseline = await fondLog();
      expect(baseline).toContain('fill(#f4efe3,1,source-over)');

      // Solo armed on the OTHER track: the fond must not follow it.
      const document = getEfxPaintDocument(FLAT_LAYER)!;
      registerDocument({
        ...document,
        tracks: document.tracks.map((track) => (track.id === 'track-b' ? { ...track, solo: true } : track)),
      });
      const soloed = await fondLog();
      expect(soloed).toContain('fill(#f4efe3,1,source-over)');
      expect(soloed).not.toContain('#ebe3d2');

      // The active track hidden: the fond term still resolves the active paper.
      registerDocument({
        ...document,
        tracks: document.tracks.map((track) => (track.id === 'track-a' ? { ...track, visible: false } : track)),
      });
      const hidden = await fondLog();
      expect(hidden).toContain('fill(#f4efe3,1,source-over)');
      expect(hidden).not.toContain('#ebe3d2');
    });

    it('RED 9 background port wiring: a resolvable clip draws its raster; an unresolvable clip reports missing', async () => {
      const bgDataUrl = makeFrame(0, 0).bytes;
      registerBackgroundSourceImage('bg-ref-1', bgDataUrl);
      registerDocument(flatDocument([], {
        visible: true,
        clips: [{ id: 'clip-1', startFrame: 0, sourceFrameRefs: ['bg-ref-1'], repeat: { mode: 'finite', count: 1 }, sourceKind: 'imported-background', revision: 1 }],
      }));

      const record = (await flattenAfterDecode(FLAT_LAYER, 0))!;
      expect(record.missing).toEqual([]);
      expect(decodeFlatLog((await record.encodeBytes()))).toContain('draw(');

      const badRef = 'missing-bg-ref';
      registerDocument(flatDocument([], {
        visible: true,
        clips: [{ id: 'clip-2', startFrame: 0, sourceFrameRefs: [badRef], repeat: { mode: 'finite', count: 1 }, sourceKind: 'imported-background', revision: 1 }],
      }));
      const missingRecord = (await flattenAfterDecode(FLAT_LAYER, 0))!;
      expect(missingRecord.missing).toEqual([{ trackId: getEfxPaintDocument(FLAT_LAYER)!.background.id, frame: 0, missingRefs: [badRef] }]);
      expect(decodeFlatLog((await missingRecord.encodeBytes()))).not.toContain('draw(');
    });

    it('RED 10 background source-image port: pending decode returns null this tick, raster after the decode completes', async () => {
      let resolveDecode!: (value: { width: number; height: number; rgba: Uint8Array }) => void;
      decodeWebpFrameMock.mockReturnValueOnce(new Promise((resolve) => { resolveDecode = resolve; }));
      const bgDataUrl = makeFrame(0, 0).bytes;
      registerBackgroundSourceImage('bg-ref-1', bgDataUrl);
      registerDocument(flatDocument([], {
        visible: true,
        clips: [{ id: 'clip-1', startFrame: 0, sourceFrameRefs: ['bg-ref-1'], repeat: { mode: 'finite', count: 1 }, sourceKind: 'imported-background', revision: 1 }],
      }));

      expect(physicPaintStore.getFlattenedFrame(FLAT_LAYER, 0)).toBeNull();
      resolveDecode({ width: 4, height: 3, rgba: new Uint8Array(4 * 3 * 4) });
      await flushDecode();
      const record = physicPaintStore.getFlattenedFrame(FLAT_LAYER, 0);
      expect(record).not.toBeNull();
      expect(decodeFlatLog((await record!.encodeBytes()))).toContain('draw(');
      expect(record!.missing).toEqual([]);
    });

    // 48-05 D-05: the excluding store variant threads the engine-supplied
    // track ids through the compositor ports and the flattened cache key (its
    // own `excl:` term) — an including and an excluding call for the same frame
    // never share a cache entry (different participating sets / missing
    // reports), and an empty exclude set stays byte-identical to the including
    // path (the 48-01/48-04 including-key contract).
    it('getFlattenedFrameExcluding omits the engine-supplied track pixels and uses its own `excl:` key term', async () => {
      const frameA = makeFrame(0, 5).bytes;
      const frameB = makeFrame(1, 5).bytes;
      registerDocument(flatDocument([
        flatTrack('track-a', { order: 0 }),
        flatTrack('track-b', { order: 1 }),
      ], { visible: false }));
      seedRoto('track-a', [{ keyId: 'ka', appFrame: 5, bytes: frameA }]);
      seedRoto('track-b', [{ keyId: 'kb', appFrame: 5, bytes: frameB }]);

      const including = (await flattenAfterDecode(FLAT_LAYER, 5))!;
      // Both tracks' bytes are already decoded in the LRU, so the excluding
      // variant resolves synchronously (its own `excl:` memo entry).
      const excluding = physicPaintStore.getFlattenedFrameExcluding(FLAT_LAYER, 5, new Set(['track-b']))!;

      expect(decodeFlatLog((await including.encodeBytes())).match(/draw\(/g)?.length).toBe(2);
      expect(decodeFlatLog((await excluding.encodeBytes())).match(/draw\(/g)?.length).toBe(1);
      expect(decodeFlatLog((await excluding.encodeBytes()))).toContain('draw(');
      expect(decodeFlatLog((await excluding.encodeBytes()))).not.toContain(frameB);
      expect(excluding.missing).toEqual([]);
      // Distinct cache keys: the `excl:` term separates the two paths.
      expect(excluding.cacheKey).not.toBe(including.cacheKey);
    });

    it('getFlattenedFrameExcluding with an empty set is byte-identical to getFlattenedFrame', async () => {
      const frameA = makeFrame(0, 5).bytes;
      registerDocument(flatDocument([flatTrack('track-a', { order: 0 })], { visible: false }));
      seedRoto('track-a', [{ keyId: 'ka', appFrame: 5, bytes: frameA }]);

      const including = (await flattenAfterDecode(FLAT_LAYER, 5))!;
      const excludingEmpty = physicPaintStore.getFlattenedFrameExcluding(FLAT_LAYER, 5, new Set())!;

      expect(excludingEmpty.cacheKey).toBe(including.cacheKey);
      expect((await excludingEmpty.encodeBytes())).toEqual((await including.encodeBytes()));
    });

    describe('background source-byte hydration (49-02 Task 3, BKG-09)', () => {
    // The hydration step is the SOLE production writer of the runtime source
    // registry on the reopen path (Pitfall 5): enumerate the document's
    // background clip sourceFrameRefs, dedupe, resolve each ref to its library
    // asset URL, decode bytes, and register. The tests inject a fake decoder
    // port so registration is observable without reaching into the private
    // registry; the fake `register` forwards to the real
    // registerBackgroundSourceImage so the compositor resolves the bytes.

    function hydrationPorts(registered: Map<string, Uint8Array>) {
      return {
        resolveAssetUrls: (ref: string) => (ref.startsWith('asset-') ? [`efxasset://localhost/${ref}.png`] : []),
        decodeBytes: async (url: string) => testWebpBytes(url),
        register: (ref: string, bytes: Uint8Array) => {
          registered.set(ref, bytes);
          registerBackgroundSourceImage(ref, bytes);
        },
      };
    }

    /**
     * quick-260921-bjm (verdict (c)): the launch hydration was never the cause
     * — it relinks exactly the refs the MAIN library holds, so once the record
     * survives (Task 1 + the manifest round-trip lock) it does the rest with NO
     * change. These legs prove the two halves of that claim against the real
     * imageStore: the persisted ref relinks, and the absent one stays
     * fail-closed.
     */
    describe('quick-260921-bjm: the reopened library relinks the persisted refs', () => {
      const PROJECT_DIR = '/projects/reopened';
      const persistedRef = {
        id: 'asset-persisted',
        original_filename: 'shot_1.png',
        relative_path: 'images/shot_1_ab12cd34.png',
        thumbnail_relative_path: 'images/.thumbs/shot_1_ab12cd34.png',
        width: 640,
        height: 480,
        format: 'png',
      };

      /**
       * Mirrors `hydrateBackgroundSourceImagesFromLibrary`'s production
       * resolver: imageStore primary (`project_path`), picker list fallback.
       * Only the library record's existence decides — that IS the seam.
       */
      function reopenedResolveAssetUrls(ref: string): readonly string[] {
        const image = imageStore.getById(ref);
        return image ? [assetUrl(image.project_path)] : [];
      }

      function reopenedPorts(registered: Map<string, Uint8Array>) {
        return {
          resolveAssetUrls: reopenedResolveAssetUrls,
          decodeBytes: async (url: string) => testWebpBytes(url),
          register: (ref: string, bytes: Uint8Array) => {
            registered.set(ref, bytes);
            registerBackgroundSourceImage(ref, bytes);
          },
        };
      }

      /** quit → relaunch: the manifest's `images` array is the only input. */
      function reopenLibrary(): void {
        imageStore.reset();
        imageStore.loadFromMceImages([persistedRef], PROJECT_DIR);
      }

      beforeEach(reopenLibrary);
      afterEach(() => { imageStore.reset(); });

      it('RELINK LEG: a persisted ref resolves content — the untouched hydration is correct once the record exists', async () => {
        expect(imageStore.getById('asset-persisted')?.project_path).toBe(`${PROJECT_DIR}/images/shot_1_ab12cd34.png`);

        const registered = new Map<string, Uint8Array>();
        registerDocument(flatDocument([], {
          visible: true,
          clips: [{ id: 'clip-1', startFrame: 0, sourceFrameRefs: ['asset-persisted'], repeat: { mode: 'finite', count: 1 }, sourceKind: 'imported-background', revision: 1 }],
        }));
        const result = await hydrateBackgroundSourceImages(getEfxPaintDocument(FLAT_LAYER)!, reopenedPorts(registered));

        expect(result).toEqual({ registered: ['asset-persisted'], missing: [] });
        expect(registered.get('asset-persisted')).toEqual(testWebpBytes(assetUrl(`${PROJECT_DIR}/images/shot_1_ab12cd34.png`)));
        expect(physicPaintStore.getBackgroundFrameVerdict(FLAT_LAYER, 0)).toBe('content');
      });

      it('REFERENCE LEG: the same persisted ref used as a reference/reveal source relinks too', async () => {
        registerDocument(flatDocument([]));
        setPhotoReferenceSource(FLAT_LAYER, ['asset-persisted']);

        const result = await hydrateReferenceSourceImages(getEfxPaintDocument(FLAT_LAYER)!, {
          resolveAssetUrls: reopenedResolveAssetUrls,
          decodeBytes: async (url: string) => testWebpBytes(url),
          register: registerReferenceSourceImage,
        });

        expect(result).toEqual({ registered: ['asset-persisted'], missing: [] });
        expect(physicPaintStore.getReferenceSourceFrameVerdict(FLAT_LAYER, 0)).toEqual({
          ref: 'asset-persisted',
          bytes: testWebpBytes(assetUrl(`${PROJECT_DIR}/images/shot_1_ab12cd34.png`)),
          clamped: false,
        });
      });

      it('MISS LEG: a ref ABSENT from the reopened library still reports asset-not-found and registers nothing', async () => {
        // The defect's own signature: the document names a ref the manifest
        // never learned (it was written by the child realm). Fail-closed —
        // never a throw, never invented content.
        const registered = new Map<string, Uint8Array>();
        registerDocument(flatDocument([], {
          visible: true,
          clips: [{ id: 'clip-1', startFrame: 0, sourceFrameRefs: ['asset-never-persisted'], repeat: { mode: 'finite', count: 1 }, sourceKind: 'imported-background', revision: 1 }],
        }));
        const result = await hydrateBackgroundSourceImages(getEfxPaintDocument(FLAT_LAYER)!, reopenedPorts(registered));

        expect(result).toEqual({ registered: [], missing: [{ ref: 'asset-never-persisted', reason: 'asset-not-found' }] });
        expect(registered.size).toBe(0);
        expect(physicPaintStore.getBackgroundFrameVerdict(FLAT_LAYER, 0)).toBe('missing');
      });
    });

    it('REGISTERS ALL: hydrating a document whose clips reference {a,b} and {b,c} registers each distinct ref exactly once with decoded bytes', async () => {
      const registered = new Map<string, Uint8Array>();
      const registerCalls: string[] = [];
      const ports = {
        ...hydrationPorts(registered),
        register: (ref: string, bytes: Uint8Array) => {
          registerCalls.push(ref);
          registered.set(ref, bytes);
          registerBackgroundSourceImage(ref, bytes);
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
      expect(registered.get('asset-a')).toEqual(testWebpBytes('efxasset://localhost/asset-a.png'));
      expect(registered.get('asset-b')).toEqual(testWebpBytes('efxasset://localhost/asset-b.png'));
      expect(registered.get('asset-c')).toEqual(testWebpBytes('efxasset://localhost/asset-c.png'));
    });

    it('MISSING IS EXPLICIT: a clip referencing an asset absent from the library registers nothing and resolves to the missing verdict', async () => {
      const registered = new Map<string, Uint8Array>();
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
      const presentRecord = (await flattenAfterDecode(FLAT_LAYER, 0))!;
      expect(presentRecord.missing).toEqual([]);
      expect(decodeFlatLog((await presentRecord.encodeBytes()))).toContain('draw(');

      const missingRecord = (await flattenAfterDecode(FLAT_LAYER, 10))!;
      expect(missingRecord.missing).toEqual([{ trackId: getEfxPaintDocument(FLAT_LAYER)!.background.id, frame: 10, missingRefs: ['asset-missing'] }]);
      expect(decodeFlatLog((await missingRecord.encodeBytes()))).not.toContain('draw(');
    });

    it('CONSERVATIVE DURING DECODE: a frame requested while an asset decode is pending resolves conservatively and re-renders on decode completion', async () => {
      let resolveDecode!: (value: { width: number; height: number; rgba: Uint8Array }) => void;
      decodeWebpFrameMock.mockReturnValueOnce(new Promise((resolve) => { resolveDecode = resolve; }));
      const bgDataUrl = makeFrame(0, 0).bytes;
      const registered = new Map<string, Uint8Array>();
      const ports = {
        resolveAssetUrls: (ref: string) => (ref === 'bg-ref-1' ? ['efxasset://localhost/bg.png'] : []),
        decodeBytes: async (url: string) => (url === 'efxasset://localhost/bg.png' ? bgDataUrl : null),
        register: (ref: string, bytes: Uint8Array) => {
          registered.set(ref, bytes);
          registerBackgroundSourceImage(ref, bytes);
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
      resolveDecode({ width: 4, height: 3, rgba: new Uint8Array(4 * 3 * 4) });
      await flushDecode();
      const record = physicPaintStore.getFlattenedFrame(FLAT_LAYER, 0);
      expect(record).not.toBeNull();
      expect(decodeFlatLog((await record!.encodeBytes()))).toContain('draw(');
      expect(record!.missing).toEqual([]);
    });

    it('SAVE DEDUP: hydration registration touches no document revision — two save projections of the same hydrated document produce an identical dedup fingerprint', async () => {
      const registered = new Map<string, Uint8Array>();
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
      const registered = new Map<string, Uint8Array>();
      const decodeCalls: string[] = [];
      const ports = {
        resolveAssetUrls: (ref: string) => (ref === 'asset-a'
          ? ['efxasset://localhost/primary.png', 'efxasset://localhost/fallback.png']
          : []),
        decodeBytes: async (url: string) => {
          decodeCalls.push(url);
          return url === 'efxasset://localhost/fallback.png' ? testWebpBytes('fallback') : null;
        },
        register: (ref: string, bytes: Uint8Array) => {
          registered.set(ref, bytes);
          registerBackgroundSourceImage(ref, bytes);
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
      expect(registered.get('asset-a')).toEqual(testWebpBytes('fallback'));
      const record = await flattenAfterDecode(FLAT_LAYER, 0);
      expect(record).not.toBeNull();
      expect(record!.missing).toEqual([]);
    });
    });

    // 52.1-04 (D-10): neighbor prewarm — decode the adjacent frames (N+1, N+2,
    // N-1) through the existing decode path into the SAME 512 MB LRU. One
    // budget, one eviction policy; the just-drawn frame is most-recently-used
    // so prewarm only evicts the distant tail behind the playhead.
    it('prefetchNeighborFrames decodes N+1, N+2, and N-1 into the LRU (D-10)', async () => {
      registerDocument(flatDocument([flatTrack('track-a')], { visible: false }));
      seedRoto('track-a', [
        { keyId: 'k4', appFrame: 4, bytes: makeFrame(4, 4).bytes },
        { keyId: 'k5', appFrame: 5, bytes: makeFrame(5, 5).bytes },
        { keyId: 'k6', appFrame: 6, bytes: makeFrame(6, 6).bytes },
        { keyId: 'k7', appFrame: 7, bytes: makeFrame(7, 7).bytes },
      ]);

      prefetchNeighborFrames(FLAT_LAYER, 5);
      await flushDecode();

      expect(decodeWebpFrameMock).toHaveBeenCalledTimes(3);
      expect(frameLru.has(buildFrameBytesToken(makeFrame(4, 4).bytes))).toBe(true);
      expect(frameLru.has(buildFrameBytesToken(makeFrame(6, 6).bytes))).toBe(true);
      expect(frameLru.has(buildFrameBytesToken(makeFrame(7, 7).bytes))).toBe(true);
      expect(frameLru.has(buildFrameBytesToken(makeFrame(5, 5).bytes))).toBe(false);
    });

    it('prefetchNeighborFrames uses the existing decode path (decode_webp_frame → createImageBitmap → frameLru.put)', async () => {
      const createImageBitmapSpy = vi.fn(async (_imageData: unknown, _options: unknown) => new FlatTestBitmap());
      vi.stubGlobal('createImageBitmap', createImageBitmapSpy);
      registerDocument(flatDocument([flatTrack('track-a')], { visible: false }));
      seedRoto('track-a', [
        { keyId: 'k4', appFrame: 4, bytes: makeFrame(4, 4).bytes },
        { keyId: 'k5', appFrame: 5, bytes: makeFrame(5, 5).bytes },
        { keyId: 'k6', appFrame: 6, bytes: makeFrame(6, 6).bytes },
        { keyId: 'k7', appFrame: 7, bytes: makeFrame(7, 7).bytes },
      ]);

      prefetchNeighborFrames(FLAT_LAYER, 5);
      await flushDecode();

      expect(decodeWebpFrameMock).toHaveBeenCalledTimes(3);
      expect(createImageBitmapSpy).toHaveBeenCalledTimes(3);
      expect(createImageBitmapSpy).toHaveBeenCalledWith(expect.anything(), { premultiplyAlpha: 'premultiply' });
    });

    it('prefetchNeighborFrames never evicts the just-drawn frame (LRU ordering)', async () => {
      registerDocument(flatDocument([flatTrack('track-a')], { visible: false }));
      seedRoto('track-a', [
        { keyId: 'k4', appFrame: 4, bytes: makeFrame(4, 4).bytes },
        { keyId: 'k5', appFrame: 5, bytes: makeFrame(5, 5).bytes },
        { keyId: 'k6', appFrame: 6, bytes: makeFrame(6, 6).bytes },
        { keyId: 'k7', appFrame: 7, bytes: makeFrame(7, 7).bytes },
      ]);

      // Draw frame 5 first — it becomes most-recently-used in the LRU.
      await flattenAfterDecode(FLAT_LAYER, 5);
      const frame5Token = buildFrameBytesToken(makeFrame(5, 5).bytes);
      expect(frameLru.has(frame5Token)).toBe(true);

      // Prewarm the neighbors — the just-drawn frame must survive.
      prefetchNeighborFrames(FLAT_LAYER, 5);
      await flushDecode();

      expect(frameLru.has(frame5Token)).toBe(true);
    });

    // -----------------------------------------------------------------------
    // 52.2-09 Task 3 (D-13, T-52.2-29/31/32): a REOPENED package holds
    // REFERENCE-ONLY roto records — no inline bytes in either collection — so
    // the compositor seam must resolve the persisted media reference on demand:
    // read → digest verify → decode → LRU keyed by DIGEST. A missing file draws
    // the Phase 49 slate (named in the missing report); a digest mismatch is
    // refused without a bitmap and without reusing another frame's raster.
    // A reference names no collection, so both reach this one seam.
    // -----------------------------------------------------------------------
    describe('52.2-09 Task 3: on-demand media decode at the compositor seam', () => {
      const MEDIA_LAYER = 'media-layer';
      const MEDIA_TRACK = 'track-a';
      const PACKAGE_DIR = '/package';
      const INTERPOLATION = { enabled: false, mode: 'duplicate' as const };
      const OVERRIDE_KEY_ID = 'override-phase-1';

      const digestOf = (bytes: Uint8Array): string => createHash('sha256').update(bytes).digest('hex');

      function mediaRef(keyId: string, digest: string) {
        return { relativePath: buildFrameMediaRelativePath(MEDIA_LAYER, keyId), digest, width: 4, height: 3 };
      }

      function mediaRecord(keyId: string, appFrame: number, reference: unknown) {
        return {
          kind: 'real-key' as const,
          keyId,
          appFrame,
          payload: { frameIndex: 0, appFrame, media: reference, width: 4, height: 3 },
        };
      }

      /** Canonical finite Group carrying one override (the on-disk reference rule). */
      function groupLoopClip(overrideKeyId: string) {
        return {
          loopId: 'loop-phase',
          placementStart: 10,
          sourceKeyIds: ['key-1'],
          repeat: 3,
          mode: 'progressive' as const,
          syncState: 'modified' as const,
          provenanceState: 'attached' as const,
          phaseOrigin: 10,
          originalEndExclusive: 13,
          visibleRanges: [{ start: 10, endExclusive: 13 }],
          frameOverrides: [{ appFrame: 11, keyId: overrideKeyId }],
        };
      }

      function installReferenceOnly(
        realKeyRecords: readonly unknown[],
        groupOverrideRecords: readonly unknown[] = [],
        loopClips: readonly unknown[] = [],
      ): void {
        physicPaintStore.installRuntimeStateFromDocument(MEDIA_LAYER, MEDIA_TRACK, {
          trackId: MEDIA_TRACK,
          frames: new Map(),
          rotoPhysical: {
            capacity: 32,
            realKeyRecords,
            groupOverrideRecords,
            interpolation: INTERPOLATION,
            scriptMotion: { deformation: 0, position: 0 },
            background: null,
            selectedKeyId: null,
            cursorAppFrame: 0,
            loopClips,
            incomingInterpolationBreakKeyIds: [],
            revision: buildPhysicPaintRotoPhysicalRevision(
              realKeyRecords as never,
              INTERPOLATION,
              loopClips as never,
              [],
              groupOverrideRecords as never,
            ),
          } as never,
        });
      }

      /** The native read succeeds, returning the bytes the reference names. */
      function ipcReads(bytes: Uint8Array): void {
        readFrameMediaMock.mockResolvedValue({ ok: true, data: { bytes, digest: digestOf(bytes) } });
      }

      beforeEach(() => {
        _setPhysicPaintPackageDirProvider(() => PACKAGE_DIR);
        readFrameMediaMock.mockReset();
        // `flatDocument` keys the document by `parentLayerId`; the seam resolves
        // the layer through `getEfxPaintDocument(layerId)`, so the fixture must
        // live under the layer id this describe queries.
        registerDocument({ ...flatDocument([flatTrack(MEDIA_TRACK)]), parentLayerId: MEDIA_LAYER });
      });

      afterEach(() => {
        _setPhysicPaintPackageDirProvider(null);
      });

      it('a real-key media reference yields a bitmap the first time the compositor needs it', async () => {
        const bytes = testWebpBytes('media-key-1');
        const reference = mediaRef('key-1', digestOf(bytes));
        installReferenceOnly([mediaRecord('key-1', 0, reference)]);
        ipcReads(bytes);

        // The installed record carries a REFERENCE — never an inline payload.
        const installed = physicPaintStore.getRotoRealKeyRecords(MEDIA_LAYER, MEDIA_TRACK)[0];
        expect('bytes' in installed.payload).toBe(false);

        // Pending tick: the read is in flight, so the flatten is conservative —
        // never a fabricated raster.
        expect(physicPaintStore.getFlattenedFrame(MEDIA_LAYER, 0)).toBeNull();

        await flushDecode();
        expect(readFrameMediaMock).toHaveBeenCalledTimes(1);
        expect(readFrameMediaMock).toHaveBeenCalledWith(PACKAGE_DIR, 'frames/media-layer/key-1.webp');

        const record = physicPaintStore.getFlattenedFrame(MEDIA_LAYER, 0);
        expect(record).not.toBeNull();
        expect(record!.missing).toEqual([]);
        expect(decodeFlatLog(await record!.encodeBytes())).toContain('draw(');
      });

      it('a GROUP-OVERRIDE media reference resolves through the same seam and yields a bitmap', async () => {
        const sourceBytes = testWebpBytes('media-source-key');
        const overrideBytes = testWebpBytes('media-override');
        const overridePath = buildFrameMediaRelativePath(MEDIA_LAYER, OVERRIDE_KEY_ID);
        installReferenceOnly(
          [mediaRecord('key-1', 0, mediaRef('key-1', digestOf(sourceBytes)))],
          [mediaRecord(OVERRIDE_KEY_ID, 11, mediaRef(OVERRIDE_KEY_ID, digestOf(overrideBytes)))],
          [groupLoopClip(OVERRIDE_KEY_ID)],
        );
        readFrameMediaMock.mockImplementation(async (_packageDir: string, relativePath: string) => (
          relativePath === overridePath
            ? { ok: true, data: { bytes: overrideBytes, digest: digestOf(overrideBytes) } }
            : { ok: true, data: { bytes: sourceBytes, digest: digestOf(sourceBytes) } }
        ));

        expect(physicPaintStore.getFlattenedFrame(MEDIA_LAYER, 11)).toBeNull();
        await flushDecode();

        // The override's OWN media file is what the seam read — the second
        // collection is not a decode-path afterthought.
        expect(readFrameMediaMock).toHaveBeenCalledWith(PACKAGE_DIR, overridePath);
        const record = physicPaintStore.getFlattenedFrame(MEDIA_LAYER, 11);
        expect(record).not.toBeNull();
        expect(record!.missing).toEqual([]);
        expect(decodeFlatLog(await record!.encodeBytes())).toContain('draw(');
      });

      it('a missing media file draws the slate path, naming the unresolved reference', async () => {
        const reference = mediaRef('key-missing', digestOf(testWebpBytes('never-written')));
        installReferenceOnly([mediaRecord('key-missing', 0, reference)]);
        readFrameMediaMock.mockResolvedValue({ ok: false, error: { kind: 'missing' } });

        expect(physicPaintStore.getFlattenedFrame(MEDIA_LAYER, 0)).toBeNull();
        await flushDecode();

        const record = physicPaintStore.getFlattenedFrame(MEDIA_LAYER, 0);
        expect(record).not.toBeNull();
        // The Phase 49 missing-source branch by NAME — transparent track pixels
        // plus a report entry carrying the reference — never a blank bitmap.
        expect(record!.missing).toEqual([{ trackId: MEDIA_TRACK, frame: 0, missingRefs: [reference.relativePath] }]);
        expect(decodeFlatLog(await record!.encodeBytes())).not.toContain('draw(');
        expect(getFrameMediaVerdict(reference.digest)).toBe('missing');
      });

      it('a GROUP-OVERRIDE whose media file is missing stays on the slate path, named', async () => {
        const sourceBytes = testWebpBytes('media-source-key');
        const missingReference = mediaRef(OVERRIDE_KEY_ID, digestOf(testWebpBytes('never-written-override')));
        installReferenceOnly(
          [mediaRecord('key-1', 0, mediaRef('key-1', digestOf(sourceBytes)))],
          [mediaRecord(OVERRIDE_KEY_ID, 11, missingReference)],
          [groupLoopClip(OVERRIDE_KEY_ID)],
        );
        readFrameMediaMock.mockImplementation(async (_packageDir: string, relativePath: string) => (
          relativePath === missingReference.relativePath
            ? { ok: false, error: { kind: 'missing' } }
            : { ok: true, data: { bytes: sourceBytes, digest: digestOf(sourceBytes) } }
        ));

        expect(physicPaintStore.getFlattenedFrame(MEDIA_LAYER, 11)).toBeNull();
        await flushDecode();

        const record = physicPaintStore.getFlattenedFrame(MEDIA_LAYER, 11);
        expect(record).not.toBeNull();
        expect(record!.missing).toEqual([{ trackId: MEDIA_TRACK, frame: 11, missingRefs: [missingReference.relativePath] }]);
        expect(getFrameMediaVerdict(missingReference.digest)).toBe('missing');
      });

      it('a second frame referencing the same digest is served from the LRU with no IPC traffic', async () => {
        const sharedBytes = testWebpBytes('shared-raster');
        const digest = digestOf(sharedBytes);
        installReferenceOnly([
          mediaRecord('key-1', 0, mediaRef('key-1', digest)),
          mediaRecord('key-2', 3, mediaRef('key-2', digest)),
        ]);
        ipcReads(sharedBytes);

        expect(physicPaintStore.getFlattenedFrame(MEDIA_LAYER, 0)).toBeNull();
        await flushDecode();
        const first = physicPaintStore.getFlattenedFrame(MEDIA_LAYER, 0);
        expect(first?.missing).toEqual([]);
        expect(readFrameMediaMock).toHaveBeenCalledTimes(1);

        // The second key names a DIFFERENT file holding the same raster. The LRU
        // is keyed by digest, so it resolves synchronously with no second read
        // (T-52.2-31: the same raster decodes once however many keys name it).
        const second = physicPaintStore.getFlattenedFrame(MEDIA_LAYER, 3);
        expect(second).not.toBeNull();
        expect(second!.missing).toEqual([]);
        expect(decodeFlatLog(await second!.encodeBytes())).toContain('draw(');
        expect(readFrameMediaMock).toHaveBeenCalledTimes(1);
      });

      it('a digest mismatch refuses the frame and never reuses another frame\'s bitmap', async () => {
        const goodBytes = testWebpBytes('good-raster');
        const expectedBytes = testWebpBytes('expected-tampered-raster');
        const tamperedBytes = testWebpBytes('tampered-raster');
        const goodReference = mediaRef('key-good', digestOf(goodBytes));
        const tamperedReference = mediaRef('key-tampered', digestOf(expectedBytes));
        installReferenceOnly([
          mediaRecord('key-good', 0, goodReference),
          mediaRecord('key-tampered', 3, tamperedReference),
        ]);
        readFrameMediaMock.mockImplementation(async (_packageDir: string, relativePath: string) => (
          relativePath === tamperedReference.relativePath
            ? { ok: true, data: { bytes: tamperedBytes, digest: digestOf(tamperedBytes) } }
            : { ok: true, data: { bytes: goodBytes, digest: digestOf(goodBytes) } }
        ));

        // Frame 0 resolves first: its bitmap is live in the LRU when the
        // tampered frame is requested.
        expect(physicPaintStore.getFlattenedFrame(MEDIA_LAYER, 0)).toBeNull();
        await flushDecode();
        expect(physicPaintStore.getFlattenedFrame(MEDIA_LAYER, 0)?.missing).toEqual([]);

        expect(physicPaintStore.getFlattenedFrame(MEDIA_LAYER, 3)).toBeNull();
        await flushDecode();

        const record = physicPaintStore.getFlattenedFrame(MEDIA_LAYER, 3);
        expect(record).not.toBeNull();
        expect(record!.missing).toEqual([{ trackId: MEDIA_TRACK, frame: 3, missingRefs: [tamperedReference.relativePath] }]);
        // Nothing was cached under the tampered digest, and the frame drew no
        // pixels — so the good frame's bitmap was never reused for it (T-52.2-29).
        expect(frameLru.has(tamperedReference.digest)).toBe(false);
        expect(decodeFlatLog(await record!.encodeBytes())).not.toContain('draw(');
        expect(getFrameMediaVerdict(tamperedReference.digest)).toBe('digest-mismatch');
      });

      it('records a terminal verdict so a failed read is not re-issued on every compositor tick', async () => {
        const expectedBytes = testWebpBytes('expected-raster');
        const tamperedBytes = testWebpBytes('tampered-raster');
        const reference = mediaRef('key-1', digestOf(expectedBytes));
        installReferenceOnly([mediaRecord('key-1', 0, reference)]);
        readFrameMediaMock.mockResolvedValue({ ok: true, data: { bytes: tamperedBytes, digest: digestOf(tamperedBytes) } });

        expect(physicPaintStore.getFlattenedFrame(MEDIA_LAYER, 0)).toBeNull();
        await flushDecode();
        expect(getFrameMediaVerdict(reference.digest)).toBe('digest-mismatch');

        // Two more ticks: the recorded refusal answers them without another read.
        physicPaintStore.getFlattenedFrame(MEDIA_LAYER, 0);
        physicPaintStore.getFlattenedFrame(MEDIA_LAYER, 0);
        await flushDecode();
        expect(readFrameMediaMock).toHaveBeenCalledTimes(1);
      });

      it('bumps the version clock when the media decode lands (the compositor repaints)', async () => {
        const bytes = testWebpBytes('media-key-1');
        installReferenceOnly([mediaRecord('key-1', 0, mediaRef('key-1', digestOf(bytes)))]);
        ipcReads(bytes);

        expect(physicPaintStore.getFlattenedFrame(MEDIA_LAYER, 0)).toBeNull();
        const whilePending = physicPaintVersion.value;
        await flushDecode();

        expect(physicPaintVersion.value).toBeGreaterThan(whilePending);
        expect(physicPaintStore.getFlattenedFrame(MEDIA_LAYER, 0)?.missing).toEqual([]);
      });

      it('never fabricates an inline payload or a runtime frame to fill a missing media file', async () => {
        const reference = mediaRef('key-missing', digestOf(testWebpBytes('never-written')));
        installReferenceOnly([mediaRecord('key-missing', 0, reference)]);
        readFrameMediaMock.mockResolvedValue({ ok: false, error: { kind: 'missing' } });

        physicPaintStore.getFlattenedFrame(MEDIA_LAYER, 0);
        await flushDecode();

        // No placeholder buffer is ever allocated to fill the frame, and the
        // persisted reference is preserved verbatim.
        expect(physicPaintStore.getFrames(MEDIA_LAYER, MEDIA_TRACK).size).toBe(0);
        expect(physicPaintStore.getFrame(MEDIA_LAYER, MEDIA_TRACK, 0)).toBeNull();
        const record = physicPaintStore.getRotoRealKeyRecords(MEDIA_LAYER, MEDIA_TRACK)[0];
        expect('bytes' in record.payload).toBe(false);
        expect(record.payload.media?.relativePath).toBe(reference.relativePath);
        expect(getFrameMediaVerdict(reference.digest)).toBe('missing');
      });

      it('resolves a transport-installed digest from memory with zero package reads (52.2-10, D-12)', async () => {
        const bytes = testWebpBytes('bridged-media');
        const digest = digestOf(bytes);
        installReferenceOnly([mediaRecord('key-1', 0, mediaRef('key-1', digest))]);
        // The raster arrived over the bridge's digest-keyed byte channel. No
        // file exists at the reference in this fixture, so a package read is
        // exactly the regression this case catches (T-52.2-35: the receiver
        // answers "already held" from memory, never by re-reading).
        await installFrameMediaBytes(bytes, digest);
        expect(hasFrameMediaBytes(digest)).toBe(true);

        expect(physicPaintStore.getFlattenedFrame(MEDIA_LAYER, 0)).toBeNull();
        await flushDecode();

        expect(readFrameMediaMock).not.toHaveBeenCalled();
        const record = physicPaintStore.getFlattenedFrame(MEDIA_LAYER, 0);
        expect(record).not.toBeNull();
        expect(record!.missing).toEqual([]);
        expect(decodeFlatLog(await record!.encodeBytes())).toContain('draw(');
      });

      it('refuses bridged bytes whose digest claim does not match their content (52.2-10, T-52.2-33/34)', async () => {
        const claimedBytes = testWebpBytes('claimed-bridged');
        const tamperedBytes = testWebpBytes('tampered-bridged');
        const claimedDigest = digestOf(claimedBytes);
        const reference = mediaRef('key-1', claimedDigest);
        installReferenceOnly([mediaRecord('key-1', 0, reference)]);

        const result = await installFrameMediaBytes(tamperedBytes, claimedDigest);

        expect(result).toEqual({ ok: false, reason: 'digest-mismatch' });
        expect(hasFrameMediaBytes(claimedDigest)).toBe(false);
        expect(getFrameMediaVerdict(claimedDigest)).toBe('digest-mismatch');
        // The refusal is terminally recorded, so the seam answers missing from
        // the verdict without a read — a mislabelled entry cannot displace
        // correct content, and nothing was served from the tampered bytes
        // (T-52.2-34; a brand-new child frame has no package file yet).
        const record = physicPaintStore.getFlattenedFrame(MEDIA_LAYER, 0);
        expect(record).not.toBeNull();
        expect(record!.missing).toEqual([{ trackId: MEDIA_TRACK, frame: 0, missingRefs: [reference.relativePath] }]);
        await flushDecode();
        expect(readFrameMediaMock).not.toHaveBeenCalled();
      });
    });
  });
});

describe('52.2-06: reference-only roto records across the hydrate seam (D-06/D-07)', () => {
  const LAYER = 'layer-ref';
  const TRACK = TEST_TRACK_ID;
  const INTERPOLATION = { enabled: false, mode: 'duplicate' as const };

  const mediaRef = (keyId: string, digestCharacter = 'a') => ({
    relativePath: buildFrameMediaRelativePath(LAYER, keyId),
    digest: digestCharacter.repeat(64),
    width: 10,
    height: 10,
  });

  const mediaRecord = (keyId: string, appFrame: number, digestCharacter = 'a') => ({
    kind: 'real-key' as const,
    keyId,
    appFrame,
    payload: { frameIndex: 0, appFrame, media: mediaRef(keyId, digestCharacter), width: 10, height: 10 },
  });

  const bytesRecord = (keyId: string, appFrame: number) => ({
    kind: 'real-key' as const,
    keyId,
    appFrame,
    payload: { frameIndex: 0, appFrame, bytes: testWebpBytes(keyId), width: 10, height: 10 },
  });

  /** Canonical finite Group carrying one override (the on-disk reference rule). */
  const groupLoopClip = (overrideKeyId: string) => ({
    loopId: 'loop-phase',
    placementStart: 10,
    sourceKeyIds: ['key-1'],
    repeat: 3,
    mode: 'progressive' as const,
    syncState: 'modified' as const,
    provenanceState: 'attached' as const,
    phaseOrigin: 10,
    originalEndExclusive: 13,
    visibleRanges: [{ start: 10, endExclusive: 13 }],
    frameOverrides: [{ appFrame: 11, keyId: overrideKeyId }],
  });

  function install(physical: unknown): void {
    physicPaintStore.installRuntimeStateFromDocument(LAYER, TRACK, {
      trackId: TRACK,
      frames: new Map(),
      rotoPhysical: physical as never,
    });
  }

  function referenceOnlyPhysical(
    realKeyRecords: readonly unknown[],
    groupOverrideRecords: readonly unknown[] = [],
    loopClips: readonly unknown[] = [],
  ): Record<string, unknown> {
    return {
      capacity: 32,
      realKeyRecords,
      groupOverrideRecords,
      interpolation: INTERPOLATION,
      scriptMotion: { deformation: 0, position: 0 },
      background: null,
      selectedKeyId: null,
      cursorAppFrame: 0,
      loopClips,
      incomingInterpolationBreakKeyIds: [],
      revision: buildPhysicPaintRotoPhysicalRevision(
        realKeyRecords as never,
        INTERPOLATION,
        loopClips as never,
        [],
        groupOverrideRecords as never,
      ),
    };
  }

  beforeEach(() => {
    _setPhysicPaintMarkDirtyCallback(() => {});
    physicPaintStore.reset();
  });

  it('installs reference-only records in BOTH collections without allocating a byte buffer', () => {
    install(referenceOnlyPhysical(
      [mediaRecord('key-1', 0)],
      [mediaRecord('override-phase-1', 11)],
      [groupLoopClip('override-phase-1')],
    ));

    const realKeys = physicPaintStore.getRotoRealKeyRecords(LAYER, TRACK);
    expect(realKeys.map((record) => [record.keyId, record.appFrame])).toEqual([['key-1', 0]]);
    expect('bytes' in realKeys[0].payload).toBe(false);
    expect(realKeys[0].payload.media?.relativePath).toBe('frames/layer-ref/key-1.webp');

    const overrides = physicPaintStore.getRotoGroupOverrideRecords(LAYER, TRACK);
    expect(overrides.map((record) => [record.keyId, record.appFrame])).toEqual([['override-phase-1', 11]]);
    expect('bytes' in overrides[0].payload).toBe(false);
    expect(overrides[0].payload.media?.relativePath).toBe('frames/layer-ref/override-phase-1.webp');
  });

  it('refuses a group-override record carrying neither media nor bytes, naming the keyId', () => {
    const broken = {
      kind: 'real-key' as const,
      keyId: 'override-broken',
      appFrame: 11,
      payload: { frameIndex: 0, appFrame: 11, width: 10, height: 10 },
    };

    expect(() => install({
      ...referenceOnlyPhysical([mediaRecord('key-1', 0)], [], []),
      groupOverrideRecords: [broken],
      loopClips: [groupLoopClip('override-broken')],
      revision: 'unused-the-carrier-guard-fires-first',
    })).toThrow(/override-broken/);
    expect(physicPaintStore.getRotoGroupOverrideRecords(LAYER, TRACK)).toEqual([]);
  });

  it('recomputes the content revision for a reference-only document without reading a byte buffer', () => {
    install(referenceOnlyPhysical(
      [mediaRecord('key-1', 0), mediaRecord('key-2', 3)],
      [mediaRecord('override-phase-1', 11)],
      [groupLoopClip('override-phase-1')],
    ));

    const revision = physicPaintStore.getRotoPhysicalContentRevision(LAYER, TRACK);

    expect(typeof revision).toBe('string');
    expect(revision).toBeTruthy();
    expect(physicPaintStore.getRotoPhysicalInterpolationState(LAYER, TRACK)).toEqual(INTERPOLATION);
    expect(physicPaintStore.getRotoPhysicalLoopClips(LAYER, TRACK)).toHaveLength(1);
  });

  it('refuses to publish an empty frame for a duplicated key with no inline pixels', () => {
    install(referenceOnlyPhysical([mediaRecord('key-1', 0)]));

    const duplicated = physicPaintStore.duplicateTrackFrames(LAYER, TRACK, [0]);

    expect(duplicated.ok).toBe(false);
    if (duplicated.ok) throw new Error('reference-only duplicate must be refused');
    expect(duplicated.reason).toBe('unresolved-key-pixels');
    // Fail closed with zero mutation: no extra key, no width-0 runtime frame.
    expect(physicPaintStore.getRotoRealKeyRecords(LAYER, TRACK)).toHaveLength(1);
    expect(physicPaintStore.getFrames(LAYER, TRACK).size).toBe(0);
  });

  it('publishes a fresh frame from the available inline runtime source for a duplicated key', () => {
    install(referenceOnlyPhysical([bytesRecord('key-1', 0)]));

    const duplicated = physicPaintStore.duplicateTrackFrames(LAYER, TRACK, [0]);

    expect(duplicated.ok).toBe(true);
    const frames = [...physicPaintStore.getFrames(LAYER, TRACK).values()];
    expect(frames.length).toBeGreaterThan(0);
    for (const frame of frames) {
      expect(frame.width).toBeGreaterThan(0);
      expect(frame.height).toBeGreaterThan(0);
    }
  });
});
