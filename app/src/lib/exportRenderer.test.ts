import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
// projectStore must finish evaluating before paintStore: the two stores form a
// late-bound callback cycle and projectStore wires the callback at module scope.
import '../stores/projectStore';
import { sequenceStore } from '../stores/sequenceStore';
import type { Layer } from '../types/layer';
import { defaultTransform } from '../types/layer';
import type { Sequence } from '../types/sequence';
import { physicPaintStore } from '../stores/physicPaintStore';
import { registerDocument, reset as resetEfxPaintStore } from '../stores/efxPaintStore';
import { createEfxPaintDocument } from '../efx-paint/document/efxPaintDocument';
import type { EfxPaintDocument } from '../efx-paint/document/efxPaintDocument';
import { buildPhysicPaintRotoPhysicalRevision, requirePhysicPaintRotoInlineBytes } from '../components/physic-paint/roto/physicsPaintRotoPhysicalModel';
import type { PreviewPhysicPaintFrameSource, PreviewRenderer } from './previewRenderer';
import type { FrameEntry } from '../types/timeline';
import { preloadExportImages, renderGlobalFrame } from './exportRenderer';
import { resolveMissingRotoFrameDraw } from './rotoFrameDraw';
import { testWebpBytes } from '../testUtils/testWebpBytes';
// 46-01: runtime state is per-track; tests exercise the document's ACTIVE track.
const TEST_TRACK_ID = 'track-1';

function makeTrackDocument(layerId: string): EfxPaintDocument {
  const document = createEfxPaintDocument(layerId);
  const track = document.tracks[0];
  return {
    ...document,
    activeTrackId: TEST_TRACK_ID,
    tracks: [{ ...track, id: TEST_TRACK_ID, frames: {}, rotoPhysical: null, loopClips: [] }],
  };
}

const root = resolve(__dirname, '../..');
const readSource = (path: string) => readFileSync(resolve(root, path), 'utf8');

function makeRotoLayer(): Layer {
  return {
    id: 'roto-layer',
    name: 'Roto',
    type: 'physic-paint',
    visible: true,
    opacity: 1,
    blendMode: 'normal',
    transform: defaultTransform(),
    source: { type: 'physic-paint', layerId: 'roto-layer' },
  };
}

function makeSequence(layer: Layer): Sequence {
  return {
    id: 'seq-1',
    kind: 'content',
    name: 'Sequence',
    fps: 24,
    width: 1000,
    height: 650,
    keyPhotos: [{ id: 'kp-1', imageId: 'base-image', holdFrames: 2 }],
    layers: [layer],
  };
}

function seedPhysicalRoto(
  keys: Array<{ keyId: string; appFrame: number; bytes: Uint8Array }>,
  options: { interpolationEnabled?: boolean; background?: { background: 'canvas2'; paperGrain: string; grainStrength: number } | null } = {},
): void {
  const records = keys.map((key) => ({
    keyId: key.keyId,
    appFrame: key.appFrame,
    kind: 'real-key' as const,
    payload: { frameIndex: 0, appFrame: key.appFrame, bytes: key.bytes },
  }));
  const interpolation = { enabled: options.interpolationEnabled ?? false, mode: 'duplicate' as const };
  const result = physicPaintStore.replaceRotoPhysicalDocument('roto-layer', TEST_TRACK_ID, {
    capacity: 600,
    realKeyRecords: records,
    interpolation,
    scriptMotion: { deformation: 0, position: 0 },
    background: options.background ?? null,
    selectedKeyId: null,
    cursorAppFrame: 0,
    revision: buildPhysicPaintRotoPhysicalRevision(records, interpolation, []),
  });
  if (!result.ok) throw new Error(result.error);
}

/** Mirror of the production renderer collector over the shared physical render-source resolver. */
function collectPhysicalFrameSources(layers: readonly Layer[], frame: number): PreviewPhysicPaintFrameSource[] {
  const paintLayer = layers.find((candidate) => candidate.type === 'physic-paint');
  const layerId = paintLayer?.source.type === 'physic-paint' ? paintLayer.source.layerId : null;
  const source = layerId ? physicPaintStore.getRotoPhysicalRenderSource(layerId, TEST_TRACK_ID, frame) : null;
  return source && source.kind !== 'loop-placeholder' && layerId
    ? [{ layerId, frame, renderedFrame: { ...source.renderedFrame, bytes: requirePhysicPaintRotoInlineBytes(source.renderedFrame) } }]
    : [];
}

beforeEach(() => {
  sequenceStore.reset();
  physicPaintStore.reset();
  resetEfxPaintStore();
  registerDocument(makeTrackDocument('roto-layer'));
});

afterEach(() => {
  sequenceStore.reset();
  physicPaintStore.reset();
});

describe('physics paint cache-first preview/export contract', () => {
  it('subscribes to physics paint mutations and resolves physic-paint content ONLY through the flattened delivery (48-03)', () => {
    const source = readSource('src/lib/previewRenderer.ts');

    expect(source).toContain('void physicPaintVersion.value');
    // 48-03 D-11/CMP-01: the renderer's sole physic-paint seam is the flattened
    // delivery — internal-track resolution (getRotoPhysicalRenderSource /
    // getFrame) and the renderer-owned paper background composite are gone.
    expect(source).toContain('physicPaintStore.getFlattenedFrame(paintLayerId, physicPaintLookupFrame)');
    expect(source).toContain('export {blendModeToCompositeOp}');
    expect(source).not.toMatch(/resolvePhysicPaintFrameSource/);
    expect(source).not.toMatch(/getRotoPhysicalRenderSource\(layerId, getActiveTrackId\(layerId\), frame\)/);
    expect(source).not.toMatch(/resolveMissingRotoFrameDrawForLayer/);
    expect(source).not.toMatch(/drawRotoFrameComposite/);
    expect(source).not.toMatch(/renderFromStrokes/);
  });

  it('keeps export delegated through PreviewRenderer without importing missing-frame or physics paint rendering', () => {
    const source = readSource('src/lib/exportRenderer.ts');

    expect(source).toContain('renderer.renderFrame(');
    expect(source).not.toMatch(/rotoFrameDraw/);
    expect(source).not.toMatch(/resolveMissingRotoFrameDraw/);
    expect(source).not.toMatch(/drawMissingRotoBackground/);
    expect(source).not.toMatch(/physicPaintStore/);
    expect(source).not.toMatch(/@efxlab\/efx-physic-paint/);
    expect(source).not.toMatch(/renderFromStrokes/);
    expect(source).not.toMatch(/forceDryAll/);
  });

  it('delegates both normal and transition export renders through PreviewRenderer frame rendering', () => {
    const source = readSource('src/lib/exportRenderer.ts');
    const renderFrameCalls = source.match(/\.renderFrame\(/g) ?? [];

    expect(renderFrameCalls.length).toBeGreaterThanOrEqual(4);
    expect(source).toMatch(/renderer\.renderFrame\(\s*interpolatedLayers,\s*localFrame,\s*seqFrames,\s*seq\.fps,\s*true,\s*fadeOpacity,\s*globalFrame,\s*localFrame\s*\)/);
    expect(source).not.toMatch(/if \([^)]*missing/i);
    expect(source).not.toMatch(/background-only/);
  });

  it('resolves missing transparent Roto frames as playback-only no-op without store mutation', () => {
    const setFrame = vi.spyOn(physicPaintStore, 'setFrame');
    const upsertRealRotoKeyFrame = vi.spyOn(physicPaintStore, 'upsertRealRotoKeyFrame');
    const replaceGeneratedRotoCache = vi.spyOn(physicPaintStore, 'replaceGeneratedRotoCache');

    const result = resolveMissingRotoFrameDraw('phys-layer-1', 24, { mode: 'transparent' });

    expect(result).toEqual({ kind: 'transparent', span: { kind: 'no-real-keys' }, materialize: false });
    expect(setFrame).not.toHaveBeenCalled();
    expect(upsertRealRotoKeyFrame).not.toHaveBeenCalled();
    expect(replaceGeneratedRotoCache).not.toHaveBeenCalled();
    expect(physicPaintStore.getRotoCacheFrames('phys-layer-1', TEST_TRACK_ID)).toEqual([]);
  });

  it('resolves missing background Roto frames as virtual background-only draw without store mutation', () => {
    const setFrame = vi.spyOn(physicPaintStore, 'setFrame');
    const upsertRealRotoKeyFrame = vi.spyOn(physicPaintStore, 'upsertRealRotoKeyFrame');
    const replaceGeneratedRotoCache = vi.spyOn(physicPaintStore, 'replaceGeneratedRotoCache');

    const result = resolveMissingRotoFrameDraw('phys-layer-1', 25, { mode: 'color', color: '#ffffff' });

    expect(result).toEqual({ kind: 'background-only', color: '#ffffff', span: { kind: 'no-real-keys' }, materialize: false });
    expect(setFrame).not.toHaveBeenCalled();
    expect(upsertRealRotoKeyFrame).not.toHaveBeenCalled();
    expect(replaceGeneratedRotoCache).not.toHaveBeenCalled();
    expect(physicPaintStore.getRotoCacheFrames('phys-layer-1', TEST_TRACK_ID)).toEqual([]);
  });

  it('resolves persisted paper and canvas grain metadata for missing Roto frames without store mutation', () => {
    const setFrame = vi.spyOn(physicPaintStore, 'setFrame');

    const result = resolveMissingRotoFrameDraw('phys-layer-1', 26, { mode: 'paper', metadata: { background: 'canvas2', paperGrain: 'canvas3', grainStrength: 0.65 } });

    expect(result).toEqual({ kind: 'background-only', color: '#ebe3d2', paperTexture: 'canvas2', paperGrain: 'canvas3', grainStrength: 0.65, span: { kind: 'no-real-keys' }, materialize: false });
    expect(setFrame).not.toHaveBeenCalled();
    expect(physicPaintStore.getRotoCacheFrames('phys-layer-1', TEST_TRACK_ID)).toEqual([]);
  });

  it('collects generated interpolation cache frames for export through the preview renderer source contract', async () => {
    const layer = makeRotoLayer();
    const sequence = makeSequence(layer);
    seedPhysicalRoto([
      { keyId: 'key-0', appFrame: 0, bytes: testWebpBytes('cmVhbC0w') },
      { keyId: 'key-2', appFrame: 2, bytes: testWebpBytes('cmVhbC0y') },
    ], { interpolationEnabled: true, background: { background: 'canvas2', paperGrain: 'canvas3', grainStrength: 0.65 } });
    const preloadedFrames: PreviewPhysicPaintFrameSource[] = [];
    const renderer = {
      onImageLoaded: null,
      collectRotoPaperTextures: vi.fn(() => []),
      collectPhysicPaintFrameSources: vi.fn((layers: readonly Layer[], frame: number) => collectPhysicalFrameSources(layers, frame)),
      preloadImages: vi.fn(),
      preloadPaperTextures: vi.fn(),
      preloadPhysicPaintFrames: vi.fn((frames: readonly PreviewPhysicPaintFrameSource[]) => {
        preloadedFrames.push(...frames);
      }),
      getImageSource: vi.fn(() => ({ naturalWidth: 1, naturalHeight: 1 })),
      isImageFailed: vi.fn(() => false),
      isPaperTextureResolved: vi.fn(() => true),
      isPhysicPaintFrameResolved: vi.fn((source: PreviewPhysicPaintFrameSource) => preloadedFrames.includes(source)),
      awaitPhysicPaintDecodes: vi.fn(async () => {}),
    } as unknown as PreviewRenderer;

    await preloadExportImages(renderer, [
      { kind: 'content' as const, globalFrame: 0, sequenceId: sequence.id, keyPhotoId: 'kp-1', imageId: 'base-image', localFrame: 0 },
      { kind: 'content' as const, globalFrame: 1, sequenceId: sequence.id, keyPhotoId: 'kp-1', imageId: 'base-image', localFrame: 1 },
    ], undefined, [sequence]);

    expect(renderer.collectPhysicPaintFrameSources).toHaveBeenCalledWith(sequence.layers, 1);
    expect(renderer.preloadPhysicPaintFrames).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({
        layerId: 'roto-layer',
        frame: 1,
        renderedFrame: expect.objectContaining({
          appFrame: 1,
          bytes: testWebpBytes('cmVhbC0w'),
        }),
      }),
    ]));
    expect(physicPaintStore.getRotoBackgroundMetadata('roto-layer', TEST_TRACK_ID)).toEqual({ background: 'canvas2', paperGrain: 'canvas3', grainStrength: 0.65, grainScale: 1 });
    expect(physicPaintStore.getRotoPhysicalRenderSource('roto-layer', TEST_TRACK_ID, 1)).toMatchObject({ kind: 'generated', appFrame: 1, leftKeyId: 'key-0', rightKeyId: 'key-2' });
  });

  it('36.13-PREVIEW-EXPORT-PARITY preloads store-regenerated 2 -> 6 span output at direct physical appFrame positions', async () => {
    const layer = makeRotoLayer();
    const sequence = { ...makeSequence(layer), kind: 'fx' as const, keyPhotos: [], inFrame: 4, outFrame: 9 };
    seedPhysicalRoto([
      { keyId: 'key-0', appFrame: 0, bytes: testWebpBytes('cmVhbC0w') },
      { keyId: 'key-1', appFrame: 1, bytes: testWebpBytes('cmVhbC0x') },
      { keyId: 'key-2', appFrame: 2, bytes: testWebpBytes('cmVhbC0y') },
      { keyId: 'key-6', appFrame: 6, bytes: testWebpBytes('cmVhbC02') },
    ], { interpolationEnabled: true });
    const projection = physicPaintStore.extractRuntimeStateForDocument('roto-layer', TEST_TRACK_ID);
    physicPaintStore.reset();
    physicPaintStore.installRuntimeStateFromDocument('roto-layer', TEST_TRACK_ID, projection);
    const preloadedFrames: PreviewPhysicPaintFrameSource[] = [];
    const renderer = {
      onImageLoaded: null,
      collectRotoPaperTextures: vi.fn(() => []),
      collectPhysicPaintFrameSources: vi.fn((layers: readonly Layer[], frame: number) => collectPhysicalFrameSources(layers, frame)),
      preloadImages: vi.fn(),
      preloadPaperTextures: vi.fn(),
      preloadPhysicPaintFrames: vi.fn((frames: readonly PreviewPhysicPaintFrameSource[]) => {
        preloadedFrames.push(...frames);
      }),
      getImageSource: vi.fn(() => ({ naturalWidth: 1, naturalHeight: 1 })),
      isImageFailed: vi.fn(() => false),
      isPaperTextureResolved: vi.fn(() => true),
      isPhysicPaintFrameResolved: vi.fn((source: PreviewPhysicPaintFrameSource) => preloadedFrames.includes(source)),
      awaitPhysicPaintDecodes: vi.fn(async () => {}),
    } as unknown as PreviewRenderer;

    // The 2 -> 6 span derives gap interiors at direct physical appFrames 3, 4, 5.
    const frameMap = Array.from({ length: 9 }, (_, globalFrame) => ({
      kind: 'content' as const,
      globalFrame,
      sequenceId: globalFrame === 8 ? sequence.id : 'content-seq',
      keyPhotoId: 'kp-1',
      imageId: 'base-image',
      localFrame: globalFrame === 8 ? 4 : globalFrame,
    }));

    await preloadExportImages(renderer, frameMap, undefined, [sequence]);

    expect(renderer.collectPhysicPaintFrameSources).toHaveBeenCalledWith(sequence.layers, 4);
    expect(renderer.preloadPhysicPaintFrames).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({
        layerId: 'roto-layer',
        frame: 4,
        renderedFrame: expect.objectContaining({
          appFrame: 4,
          bytes: testWebpBytes('cmVhbC0y'),
        }),
      }),
    ]));
  });

  it('preloads generated Roto frames past a stale FX sequence range after parent timeline expansion', async () => {
    const layer = makeRotoLayer();
    const contentSequence = {
      ...makeSequence(layer),
      id: 'content-seq',
      layers: [],
      keyPhotos: [
        { id: 'kp-0', imageId: 'circle', holdFrames: 1 },
        { id: 'kp-1', imageId: 'square', holdFrames: 1 },
        { id: 'kp-2', imageId: 'crossed', holdFrames: 1 },
      ],
    };
    const sequence = {
      ...makeSequence(layer),
      id: 'fx-roto',
      kind: 'fx' as const,
      keyPhotos: [],
      inFrame: 0,
      outFrame: 3,
    };
    sequenceStore.sequences.value = [contentSequence, sequence];
    // Physical real keys at direct appFrames 0, 4, 8 with interpolation enabled:
    // gap-derived interiors fill 1-3 and 5-7, so the physical end frame is 9.
    seedPhysicalRoto([
      { keyId: 'key-0', appFrame: 0, bytes: testWebpBytes('Y2lyY2xl') },
      { keyId: 'key-4', appFrame: 4, bytes: testWebpBytes('c3F1YXJl') },
      { keyId: 'key-8', appFrame: 8, bytes: testWebpBytes('Y3Jvc3NlZA==') },
    ], { interpolationEnabled: true });
    const { frameMap } = await import('./frameMap');
    const preloadedFrames: PreviewPhysicPaintFrameSource[] = [];
    const renderer = {
      onImageLoaded: null,
      collectRotoPaperTextures: vi.fn(() => []),
      collectPhysicPaintFrameSources: vi.fn((layers: readonly Layer[], frame: number) => collectPhysicalFrameSources(layers, frame)),
      preloadImages: vi.fn(),
      preloadPaperTextures: vi.fn(),
      preloadPhysicPaintFrames: vi.fn((frames: readonly PreviewPhysicPaintFrameSource[]) => {
        preloadedFrames.push(...frames);
      }),
      getImageSource: vi.fn(() => ({ naturalWidth: 1, naturalHeight: 1 })),
      isImageFailed: vi.fn(() => false),
      isPaperTextureResolved: vi.fn(() => true),
      isPhysicPaintFrameResolved: vi.fn((source: PreviewPhysicPaintFrameSource) => preloadedFrames.includes(source)),
      awaitPhysicPaintDecodes: vi.fn(async () => {}),
    } as unknown as PreviewRenderer;

    await preloadExportImages(renderer, frameMap.value, undefined, [sequence]);

    expect(renderer.collectPhysicPaintFrameSources).toHaveBeenCalledWith(sequence.layers, 8);
    expect(renderer.collectPhysicPaintFrameSources).not.toHaveBeenCalledWith(sequence.layers, 9);
    expect(renderer.preloadPhysicPaintFrames).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({
        layerId: 'roto-layer',
        frame: 8,
        renderedFrame: expect.objectContaining({
          appFrame: 8,
          bytes: testWebpBytes('Y3Jvc3NlZA=='),
        }),
      }),
    ]));
  });

  it('preloads published generated interpolation cache frames after close/reopen load', async () => {
    const layer = makeRotoLayer();
    const sequence = makeSequence(layer);
    seedPhysicalRoto([
      { keyId: 'key-0', appFrame: 0, bytes: testWebpBytes('cmVhbC0w') },
      { keyId: 'key-2', appFrame: 2, bytes: testWebpBytes('cmVhbC0y') },
    ], { interpolationEnabled: true });
    const projection = physicPaintStore.extractRuntimeStateForDocument('roto-layer', TEST_TRACK_ID);
    physicPaintStore.reset();
    physicPaintStore.installRuntimeStateFromDocument('roto-layer', TEST_TRACK_ID, projection);
    const preloadedFrames: PreviewPhysicPaintFrameSource[] = [];
    const renderer = {
      onImageLoaded: null,
      collectRotoPaperTextures: vi.fn(() => []),
      collectPhysicPaintFrameSources: vi.fn((layers: readonly Layer[], frame: number) => collectPhysicalFrameSources(layers, frame)),
      preloadImages: vi.fn(),
      preloadPaperTextures: vi.fn(),
      preloadPhysicPaintFrames: vi.fn((frames: readonly PreviewPhysicPaintFrameSource[]) => {
        preloadedFrames.push(...frames);
      }),
      getImageSource: vi.fn(() => ({ naturalWidth: 1, naturalHeight: 1 })),
      isImageFailed: vi.fn(() => false),
      isPaperTextureResolved: vi.fn(() => true),
      isPhysicPaintFrameResolved: vi.fn((source: PreviewPhysicPaintFrameSource) => preloadedFrames.includes(source)),
      awaitPhysicPaintDecodes: vi.fn(async () => {}),
    } as unknown as PreviewRenderer;

    await preloadExportImages(renderer, [
      { kind: 'content' as const, globalFrame: 0, sequenceId: sequence.id, keyPhotoId: 'kp-1', imageId: 'base-image', localFrame: 0 },
      { kind: 'content' as const, globalFrame: 1, sequenceId: sequence.id, keyPhotoId: 'kp-1', imageId: 'base-image', localFrame: 1 },
    ], undefined, [sequence]);

    expect(renderer.preloadPhysicPaintFrames).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({
        layerId: 'roto-layer',
        frame: 1,
        renderedFrame: expect.objectContaining({
          appFrame: 1,
          bytes: testWebpBytes('cmVhbC0w'),
        }),
      }),
    ]));
    expect(physicPaintStore.getRotoPhysicalRenderSource('roto-layer', TEST_TRACK_ID, 1)).toMatchObject({ kind: 'generated', appFrame: 1, leftKeyId: 'key-0', rightKeyId: 'key-2' });
  });

  it('keeps trailing background-only export resolution dynamic without serialized cache growth', () => {
    physicPaintStore.upsertRealRotoKeyFrame('phys-layer-1', TEST_TRACK_ID, 2, { frameIndex: 0, appFrame: 2, bytes: testWebpBytes('cmVhbC0y') });
    physicPaintStore.upsertRealRotoKeyFrame('phys-layer-1', TEST_TRACK_ID, 6, { frameIndex: 0, appFrame: 6, bytes: testWebpBytes('cmVhbC02') });
    const before = physicPaintStore.extractRuntimeStateForDocument('phys-layer-1', TEST_TRACK_ID);

    const result = resolveMissingRotoFrameDraw('phys-layer-1', 9, {
      backgroundState: { mode: 'paper', metadata: { background: 'canvas2', paperGrain: 'canvas3', grainStrength: 0.65 } },
      realKeyFrames: physicPaintStore.getRealRotoKeyFrames('phys-layer-1', TEST_TRACK_ID),
    });

    expect(result).toEqual({ kind: 'background-only', color: '#ebe3d2', paperTexture: 'canvas2', paperGrain: 'canvas3', grainStrength: 0.65, span: { kind: 'trailing', previousRealKeyFrame: 6 }, materialize: false });
    expect(physicPaintStore.getFrame('phys-layer-1', TEST_TRACK_ID, 9)).toBeNull();
    expect(physicPaintStore.extractRuntimeStateForDocument('phys-layer-1', TEST_TRACK_ID)).toEqual(before);
  });
});

describe('exportRenderer', () => {
  describe('renderGlobalFrame', () => {
    const makeFxPaintSequence = (layer: Layer): Sequence => ({
      id: 'fx-paint',
      kind: 'fx',
      name: 'Paint',
      fps: 24,
      width: 1000,
      height: 650,
      keyPhotos: [],
      inFrame: 0,
      outFrame: 100,
      layers: [layer],
    });

    const makeRendererStub = () => ({ renderFrame: vi.fn() }) as unknown as PreviewRenderer;
    // 52.3-01 Task 1: minimal no-op 2d context (save/restore/setTransform/
    // clearRect; the willReadFrequently options arg is accepted and ignored) so
    // the D-06 top-level clear — gated on !hasContentEntry — can fire on the
    // empty-fm cases below without a TypeError. Inert pre-GREEN: nothing calls
    // canvas.getContext on these paths today.
    const makeCanvasStub = () => ({
      width: 1000,
      height: 650,
      getContext: (contextId: string, _options?: unknown) =>
        contextId === '2d'
          ? { save() {}, restore() {}, setTransform() {}, clearRect() {} }
          : null,
    }) as unknown as HTMLCanvasElement;

    it('composites a physic-paint overlay with an empty frameMap (no Timeline key photos)', () => {
      const layer = makeRotoLayer();
      const fxSeq = makeFxPaintSequence(layer);
      sequenceStore.sequences.value = [fxSeq];
      // Mirrors the user report: paint keys at appFrames 41/44/47, zero Timeline key photos.
      seedPhysicalRoto([
        { keyId: 'key-41', appFrame: 41, bytes: testWebpBytes('cGFpbnQtNDE=') },
        { keyId: 'key-44', appFrame: 44, bytes: testWebpBytes('cGFpbnQtNDQ=') },
        { keyId: 'key-47', appFrame: 47, bytes: testWebpBytes('cGFpbnQtNDc=') },
      ]);
      const renderer = makeRendererStub();

      renderGlobalFrame(renderer, makeCanvasStub(), 41, [], [fxSeq], [], false);

      const renderFrame = vi.mocked(renderer.renderFrame);
      expect(renderFrame).toHaveBeenCalled();
      const call = renderFrame.mock.calls.find(
        (args) => (args[0] as Layer[]).some((candidate) => candidate.id === 'roto-layer'),
      );
      expect(call).toBeDefined();
      // Paint lookup is keyed by the global frame passed through (previewRenderer paintLookupFrame).
      expect(call?.[6]).toBe(41);
    });

    it('hydrated paint-only project renders after simulated reopen (no content sequences registered)', () => {
      const fxSeq = makeFxPaintSequence(makeRotoLayer());
      // Simulated reopen: zero content sequences registered, only the FX sequence survives.
      sequenceStore.sequences.value = [fxSeq];
      // replaceRotoPhysicalDocument installs exactly what installRuntimeStateFromDocument
      // restores on reopen — the physical document authority is layerId-keyed and never
      // touches timeline key photos. Persistence is NOT the defect; the render gate is.
      seedPhysicalRoto([
        { keyId: 'key-41', appFrame: 41, bytes: testWebpBytes('cGFpbnQtNDE=') },
        { keyId: 'key-44', appFrame: 44, bytes: testWebpBytes('cGFpbnQtNDQ=') },
        { keyId: 'key-47', appFrame: 47, bytes: testWebpBytes('cGFpbnQtNDc=') },
      ]);

      const source = physicPaintStore.getRotoPhysicalRenderSource('roto-layer', TEST_TRACK_ID, 41);
      expect(source).not.toBeNull();
      expect(source?.kind).not.toBe('loop-placeholder');

      const renderer = makeRendererStub();
      renderGlobalFrame(renderer, makeCanvasStub(), 41, [], [fxSeq], [], false);

      expect(vi.mocked(renderer.renderFrame)).toHaveBeenCalled();
    });

    it('content project renders unchanged (guard: content pass + overlay pass)', () => {
      const layer = makeRotoLayer();
      const contentSeq = makeSequence(layer);
      const fxSeq = makeFxPaintSequence(makeRotoLayer());
      sequenceStore.sequences.value = [contentSeq, fxSeq];
      seedPhysicalRoto([
        { keyId: 'key-0', appFrame: 0, bytes: testWebpBytes('cGFpbnQtMA==') },
      ]);
      const fm = [
        { kind: 'content' as const, globalFrame: 0, sequenceId: contentSeq.id, keyPhotoId: 'kp-1', imageId: 'base-image', localFrame: 0 },
        { kind: 'content' as const, globalFrame: 1, sequenceId: contentSeq.id, keyPhotoId: 'kp-1', imageId: 'base-image', localFrame: 1 },
      ];
      const renderer = makeRendererStub();

      renderGlobalFrame(renderer, makeCanvasStub(), 0, fm, [contentSeq, fxSeq], [], false);

      const renderFrame = vi.mocked(renderer.renderFrame);
      // Content pass clears the canvas; overlay pass composites on top.
      expect(renderFrame.mock.calls.some((args) => args[4] === true)).toBe(true);
      expect(renderFrame.mock.calls.some((args) => args[4] === false)).toBe(true);
    });

    it('fx overlay gates on entry.globalFrame (Pitfall 1)', () => {
      const layer = makeRotoLayer();
      const fxSeq: Sequence = {
        ...makeFxPaintSequence(layer),
        id: 'fx-p',
        inFrame: 2,
        outFrame: 7,
      };
      sequenceStore.sequences.value = [fxSeq];
      // Selected-fx export of an inFrame > 0 sequence (D-08): the exportEngine
      // filter at exportEngine.ts:148 re-bases fm positionally — gap entries at
      // true globals 0..1 are excluded — so positional index 0 maps to the entry
      // whose globalFrame is 2.
      const fm: FrameEntry[] = [2, 3, 4, 5, 6].map((globalFrame) => ({
        kind: 'paint' as const,
        globalFrame,
        sequenceId: fxSeq.id,
        layerId: 'roto-layer',
      }));
      const renderer = makeRendererStub();

      renderGlobalFrame(renderer, makeCanvasStub(), 0, fm, [fxSeq], [], false);

      const renderFrame = vi.mocked(renderer.renderFrame);
      const call = renderFrame.mock.calls.find(
        (args) => (args[0] as Layer[]).some((candidate) => candidate.id === 'roto-layer'),
      );
      expect(call).toBeDefined();
      // fxLocalFrame derives from the entry's own globalFrame (2 - inFrame 2 = 0),
      // never from the positional index — pre-fix the 0 < inFrame 2 gate skips
      // the overlay entirely and this assertion never reaches a call.
      expect(call?.[7]).toBe(0);
    });

    it('selected export keeps later-sequence overlays riding', () => {
      // RESEARCH Open Question 1 (shared fix): a content-selected export of a
      // non-first sequence positionally re-bases fm the same way — positional 0
      // maps to globalFrame 5 — and the fx overlay spanning 5..10 must still ride
      // (pre-fix it was silently dropped).
      const contentSeq: Sequence = {
        id: 'content-b',
        kind: 'content',
        name: 'Later content',
        fps: 24,
        width: 1000,
        height: 650,
        keyPhotos: [{ id: 'kp-b', imageId: 'base-image', holdFrames: 5 }],
        layers: [],
      };
      const fxSeq: Sequence = {
        ...makeFxPaintSequence(makeRotoLayer()),
        id: 'fx-overlay',
        inFrame: 5,
        outFrame: 10,
      };
      sequenceStore.sequences.value = [contentSeq, fxSeq];
      const fm: FrameEntry[] = [5, 6, 7, 8, 9].map((globalFrame, localFrame) => ({
        kind: 'content' as const,
        globalFrame,
        sequenceId: contentSeq.id,
        keyPhotoId: 'kp-b',
        imageId: 'base-image',
        localFrame,
      }));
      const renderer = makeRendererStub();

      renderGlobalFrame(renderer, makeCanvasStub(), 0, fm, [contentSeq, fxSeq], [], false);

      const renderFrame = vi.mocked(renderer.renderFrame);
      const call = renderFrame.mock.calls.find(
        (args) => (args[0] as Layer[]).some((candidate) => candidate.id === 'roto-layer'),
      );
      expect(call).toBeDefined();
      expect(call?.[7]).toBe(0);
    });

    it.todo('renders a single content frame identically to Preview.tsx');
    it.todo('renders cross-dissolve overlap with correct blending');
    it.todo('renders FX overlay sequences with keyframe interpolation');
    it.todo('renders content-overlay sequences with fade opacity');
    it.todo('handles solid fade overlay with computed alpha');
  });

  describe('canvas clear lifecycle (D-06, AC-CLEAR)', () => {
    // Op-recording 2d context (model: exportEngine.paintEnumeration.test.ts
    // RecordingCanvasContext) behind a canvas stub whose getContext('2d')
    // returns the recorder, so the D-06 top-level clear is observable.
    class RecordingCanvasContext {
      operations: Array<{ type: string }> = [];
      save(): void { this.operations.push({ type: 'save' }); }
      restore(): void { this.operations.push({ type: 'restore' }); }
      setTransform(): void { /* recorded paths never assert transforms */ }
      clearRect(): void { this.operations.push({ type: 'clearRect' }); }
      drawImage(..._args: unknown[]): void { this.operations.push({ type: 'drawImage' }); }
      fillRect(..._args: number[]): void { this.operations.push({ type: 'fillRect' }); }
    }

    const makeRecordingCanvasStub = (recorder: RecordingCanvasContext) => ({
      width: 1000,
      height: 650,
      getContext: (contextId: string, _options?: unknown) =>
        contextId === '2d' ? recorder : null,
    }) as unknown as HTMLCanvasElement;

    const makeRendererStub = () => ({ renderFrame: vi.fn() }) as unknown as PreviewRenderer;

    // Same shape as the renderGlobalFrame describe's helper (scoped copy —
    // describe closures do not share consts).
    const makeFxPaintSequence = (layer: Layer): Sequence => ({
      id: 'fx-paint',
      kind: 'fx',
      name: 'Paint',
      fps: 24,
      width: 1000,
      height: 650,
      keyPhotos: [],
      inFrame: 0,
      outFrame: 100,
      layers: [layer],
    });

    const expectClearBeforeAnyDraw = (recorder: RecordingCanvasContext) => {
      const firstClear = recorder.operations.findIndex((op) => op.type === 'clearRect');
      const firstDraw = recorder.operations.findIndex(
        (op) => op.type === 'drawImage' || op.type === 'fillRect',
      );
      expect(firstClear).toBeGreaterThanOrEqual(0);
      expect(firstDraw === -1 || firstClear < firstDraw).toBe(true);
    };

    it('records a clearRect before any draw op on an fx-owned (paint) frame', () => {
      const layer = makeRotoLayer();
      const fxSeq = makeFxPaintSequence(layer);
      sequenceStore.sequences.value = [fxSeq];
      const renderer = makeRendererStub();
      const recorder = new RecordingCanvasContext();
      // Post-D-01 union shape: a paint-kind entry owned by the fx sequence id
      // (no keyPhotoId/imageId — sentinel ids are the banned anti-pattern).
      const fm: FrameEntry[] = [
        { kind: 'paint', globalFrame: 0, sequenceId: fxSeq.id, layerId: 'roto-layer' },
      ];

      renderGlobalFrame(renderer, makeRecordingCanvasStub(recorder), 0, fm, [fxSeq], [], false);

      expectClearBeforeAnyDraw(recorder);
    });

    it('records a clearRect before any draw op on an empty frame map', () => {
      const layer = makeRotoLayer();
      const fxSeq = makeFxPaintSequence(layer);
      sequenceStore.sequences.value = [fxSeq];
      const renderer = makeRendererStub();
      const recorder = new RecordingCanvasContext();

      renderGlobalFrame(renderer, makeRecordingCanvasStub(recorder), 41, [], [fxSeq], [], false);

      expectClearBeforeAnyDraw(recorder);
    });

    it('content-owned entry: no additional top-level clearRect ahead of the content render path (byte-identical guard)', () => {
      const layer = makeRotoLayer();
      const contentSeq = makeSequence(layer);
      const fxSeq = makeFxPaintSequence(makeRotoLayer());
      sequenceStore.sequences.value = [contentSeq, fxSeq];
      seedPhysicalRoto([
        { keyId: 'key-0', appFrame: 0, bytes: testWebpBytes('cGFpbnQtMA==') },
      ]);
      const fm: FrameEntry[] = [
        { kind: 'content', globalFrame: 0, sequenceId: contentSeq.id, keyPhotoId: 'kp-1', imageId: 'base-image', localFrame: 0 },
        { kind: 'content', globalFrame: 1, sequenceId: contentSeq.id, keyPhotoId: 'kp-1', imageId: 'base-image', localFrame: 1 },
      ];
      const renderer = makeRendererStub();
      const recorder = new RecordingCanvasContext();

      renderGlobalFrame(renderer, makeRecordingCanvasStub(recorder), 0, fm, [contentSeq, fxSeq], [], false);

      expect(recorder.operations.filter((op) => op.type === 'clearRect')).toHaveLength(0);
    });
  });

  describe('preloadExportImages', () => {
    it('preloads cached Physics Paint frame PNGs before export renders', async () => {
      const frameSource: PreviewPhysicPaintFrameSource = {
        layerId: 'roto-layer',
        frame: 0,
        renderedFrame: { frameIndex: 0, appFrame: 0, bytes: testWebpBytes('cm90by1zdHJva2Vz') },
      };
      const preloadedFrames: PreviewPhysicPaintFrameSource[] = [];
      const renderer = {
        onImageLoaded: null,
        collectRotoPaperTextures: vi.fn(() => []),
        collectPhysicPaintFrameSources: vi.fn(() => [frameSource]),
        preloadImages: vi.fn(),
        preloadPaperTextures: vi.fn(),
        preloadPhysicPaintFrames: vi.fn((frames: readonly PreviewPhysicPaintFrameSource[]) => {
          preloadedFrames.push(...frames);
        }),
        getImageSource: vi.fn(() => ({ naturalWidth: 1, naturalHeight: 1 })),
        isImageFailed: vi.fn(() => false),
        isPaperTextureResolved: vi.fn(() => true),
        isPhysicPaintFrameResolved: vi.fn((source: PreviewPhysicPaintFrameSource) => preloadedFrames.includes(source)),
      awaitPhysicPaintDecodes: vi.fn(async () => {}),
      } as unknown as PreviewRenderer;
      const sequence = makeSequence(makeRotoLayer());

      await preloadExportImages(renderer, [{ kind: 'content' as const, globalFrame: 0, sequenceId: sequence.id, keyPhotoId: 'kp-1', imageId: 'base-image', localFrame: 0 }], undefined, [sequence]);

      expect(renderer.collectPhysicPaintFrameSources).toHaveBeenCalledWith(sequence.layers, 0);
      expect(renderer.preloadPhysicPaintFrames).toHaveBeenCalledWith([frameSource]);
      expect(renderer.isPhysicPaintFrameResolved).toHaveBeenCalledWith(frameSource);
    });

    it('preloads content Physics Paint from local F0 when the Sequence starts globally at F100', async () => {
      const sequence = { ...makeSequence(makeRotoLayer()), id: 'content-at-100', keyPhotos: [{ id: 'kp-local-0', imageId: '', holdFrames: 1 }] };
      seedPhysicalRoto([
        { keyId: 'key-0', appFrame: 0, bytes: testWebpBytes('bG9jYWwtMA==') },
      ]);
      const preloadedFrames: PreviewPhysicPaintFrameSource[] = [];
      const renderer = {
        onImageLoaded: null,
        collectRotoPaperTextures: vi.fn(() => []),
        collectPhysicPaintFrameSources: vi.fn((layers: readonly Layer[], frame: number) => collectPhysicalFrameSources(layers, frame)),
        preloadImages: vi.fn(),
        preloadPaperTextures: vi.fn(),
        preloadPhysicPaintFrames: vi.fn((frames: readonly PreviewPhysicPaintFrameSource[]) => {
          preloadedFrames.push(...frames);
        }),
        getImageSource: vi.fn(() => ({ naturalWidth: 1, naturalHeight: 1 })),
        isImageFailed: vi.fn(() => false),
        isPaperTextureResolved: vi.fn(() => true),
        isPhysicPaintFrameResolved: vi.fn((source: PreviewPhysicPaintFrameSource) => preloadedFrames.includes(source)),
      awaitPhysicPaintDecodes: vi.fn(async () => {}),
      } as unknown as PreviewRenderer;
      const frames = Array.from({ length: 101 }, (_, globalFrame) => ({
        kind: 'content' as const,
        globalFrame,
        sequenceId: globalFrame === 100 ? sequence.id : 'earlier-content',
        keyPhotoId: globalFrame === 100 ? 'kp-local-0' : 'kp-earlier',
        imageId: '',
        localFrame: globalFrame === 100 ? 0 : globalFrame,
      }));

      await preloadExportImages(renderer, frames, undefined, [sequence]);

      expect(renderer.collectPhysicPaintFrameSources).toHaveBeenCalledWith(sequence.layers, 0);
      expect(renderer.preloadPhysicPaintFrames).toHaveBeenCalledWith([
        expect.objectContaining({
          layerId: 'roto-layer',
          frame: 0,
          renderedFrame: expect.objectContaining({ appFrame: 0, bytes: testWebpBytes('bG9jYWwtMA==') }),
        }),
      ]);
    });

    it('preloads fx overlay Physics Paint frames for a selected export with fx inFrame > 0 (CR-01)', async () => {
      // 52.3 code-review CR-01: the export preload leg must share the render
      // gate's entry.globalFrame predicate — a selected (rebased, positional)
      // export of an fx sequence at inFrame > 0 must still kick + collect the
      // fx-local decodes, or the render loop cold-misses into transparent paint.
      const fxSequence = {
        ...makeSequence(makeRotoLayer()),
        id: 'fx-1',
        kind: 'fx' as const,
        keyPhotos: [],
        inFrame: 5,
        outFrame: 10,
      };
      seedPhysicalRoto([
        { keyId: 'key-0', appFrame: 0, bytes: testWebpBytes('bG9jYWwtMA==') },
        { keyId: 'key-1', appFrame: 1, bytes: testWebpBytes('bG9jYWwtMQ==') },
        { keyId: 'key-2', appFrame: 2, bytes: testWebpBytes('bG9jYWwtMg==') },
        { keyId: 'key-3', appFrame: 3, bytes: testWebpBytes('bG9jYWwtMw==') },
        { keyId: 'key-4', appFrame: 4, bytes: testWebpBytes('bG9jYWwtNA==') },
      ]);
      const collectedFrames: number[] = [];
      const preloadedFrames: PreviewPhysicPaintFrameSource[] = [];
      const renderer = {
        onImageLoaded: null,
        collectRotoPaperTextures: vi.fn(() => []),
        collectPhysicPaintFrameSources: vi.fn((layers: readonly Layer[], frame: number) => {
          collectedFrames.push(frame);
          return collectPhysicalFrameSources(layers, frame);
        }),
        preloadImages: vi.fn(),
        preloadPaperTextures: vi.fn(),
        preloadPhysicPaintFrames: vi.fn((frames: readonly PreviewPhysicPaintFrameSource[]) => {
          preloadedFrames.push(...frames);
        }),
        getImageSource: vi.fn(() => ({ naturalWidth: 1, naturalHeight: 1 })),
        isImageFailed: vi.fn(() => false),
        isPaperTextureResolved: vi.fn(() => true),
        isPhysicPaintFrameResolved: vi.fn((source: PreviewPhysicPaintFrameSource) => preloadedFrames.includes(source)),
      awaitPhysicPaintDecodes: vi.fn(async () => {}),
      } as unknown as PreviewRenderer;
      // Selected export re-bases fm positionally (exportEngine.ts:148): 5
      // entries, true global frames 5..9 owned by the fx.
      const frames: FrameEntry[] = Array.from({ length: 5 }, (_, index) => ({
        kind: 'paint' as const,
        globalFrame: 5 + index,
        sequenceId: 'fx-1',
        layerId: 'roto-layer',
      }));

      await preloadExportImages(renderer, frames, undefined, [fxSequence]);

      expect([...new Set(collectedFrames)].sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4]);
      expect(preloadedFrames.map((source) => source.frame).sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4]);
    });

    it.todo('resolves when all images are loaded');
    it.todo('resolves immediately if all images already cached');
  });

  // buildSequenceFrames is module-internal (not exported).
  // These tests require buildSequenceFrames to be exported or tested indirectly via renderGlobalFrame.
  // Plan 01/03 may export it or test solid behavior through renderGlobalFrame integration tests.
  describe('buildSequenceFrames solid/transparent', () => {
    it.todo('carries solidColor field from KeyPhoto to FrameEntry');
    it.todo('carries isTransparent field from KeyPhoto to FrameEntry');
    it.todo('produces empty imageId for solid/transparent entries');
  });

  describe('preloadExportImages with solids', () => {
    it.todo('filters empty imageId strings from preload set');
  });

  describe('solo mode (ENH-03)', () => {
    it.todo('renderGlobalFrame with soloActive=true skips overlay sequences entirely');
    it.todo('renderGlobalFrame with soloActive=false renders overlay sequences normally');
    it.todo('cross-dissolve transitions still render in solo mode');
  });

  describe('GL transition rendering (GLT-04)', () => {
    it.todo('renders GL transition overlap via dual-capture when overlap has glTransition');
    it.todo('calls renderGlslTransition with correct shader, canvases, and progress');
    it.todo('preserves existing cross-dissolve rendering when overlap has no glTransition');
    it.todo('creates and reuses offscreen canvases for dual-capture');
    it.todo('computes eased progress via computeTransitionProgress');
  });
});
