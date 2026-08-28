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
import { buildPhysicPaintRotoPhysicalRevision } from '../components/physic-paint/roto/physicsPaintRotoPhysicalModel';
import type { PreviewPhysicPaintFrameSource, PreviewRenderer } from './previewRenderer';
import { preloadExportImages, renderGlobalFrame } from './exportRenderer';
import { resolveMissingRotoFrameDraw } from './rotoFrameDraw';
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
  keys: Array<{ keyId: string; appFrame: number; dataUrl: string }>,
  options: { interpolationEnabled?: boolean; background?: { background: 'canvas2'; paperGrain: string; grainStrength: number } | null } = {},
): void {
  const records = keys.map((key) => ({
    keyId: key.keyId,
    appFrame: key.appFrame,
    kind: 'real-key' as const,
    payload: { frameIndex: 0, appFrame: key.appFrame, dataUrl: key.dataUrl },
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
  return source && source.kind !== 'loop-placeholder' && layerId ? [{ layerId, frame, renderedFrame: source.renderedFrame }] : [];
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

  it('collects generated interpolation cache frames for export through the preview renderer source contract', () => {
    const layer = makeRotoLayer();
    const sequence = makeSequence(layer);
    seedPhysicalRoto([
      { keyId: 'key-0', appFrame: 0, dataUrl: 'data:image/png;base64,cmVhbC0w' },
      { keyId: 'key-2', appFrame: 2, dataUrl: 'data:image/png;base64,cmVhbC0y' },
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
    } as unknown as PreviewRenderer;

    preloadExportImages(renderer, [
      { globalFrame: 0, sequenceId: sequence.id, keyPhotoId: 'kp-1', imageId: 'base-image', localFrame: 0 },
      { globalFrame: 1, sequenceId: sequence.id, keyPhotoId: 'kp-1', imageId: 'base-image', localFrame: 1 },
    ], undefined, [sequence]);

    expect(renderer.collectPhysicPaintFrameSources).toHaveBeenCalledWith(sequence.layers, 1);
    expect(renderer.preloadPhysicPaintFrames).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({
        layerId: 'roto-layer',
        frame: 1,
        renderedFrame: expect.objectContaining({
          appFrame: 1,
          dataUrl: 'data:image/png;base64,cmVhbC0w',
        }),
      }),
    ]));
    expect(physicPaintStore.getRotoBackgroundMetadata('roto-layer', TEST_TRACK_ID)).toEqual({ background: 'canvas2', paperGrain: 'canvas3', grainStrength: 0.65 });
    expect(physicPaintStore.getRotoPhysicalRenderSource('roto-layer', TEST_TRACK_ID, 1)).toMatchObject({ kind: 'generated', appFrame: 1, leftKeyId: 'key-0', rightKeyId: 'key-2' });
  });

  it('36.13-PREVIEW-EXPORT-PARITY preloads store-regenerated 2 -> 6 span output at direct physical appFrame positions', () => {
    const layer = makeRotoLayer();
    const sequence = { ...makeSequence(layer), kind: 'fx' as const, keyPhotos: [], inFrame: 4, outFrame: 9 };
    seedPhysicalRoto([
      { keyId: 'key-0', appFrame: 0, dataUrl: 'data:image/png;base64,cmVhbC0w' },
      { keyId: 'key-1', appFrame: 1, dataUrl: 'data:image/png;base64,cmVhbC0x' },
      { keyId: 'key-2', appFrame: 2, dataUrl: 'data:image/png;base64,cmVhbC0y' },
      { keyId: 'key-6', appFrame: 6, dataUrl: 'data:image/png;base64,cmVhbC02' },
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
    } as unknown as PreviewRenderer;

    // The 2 -> 6 span derives gap interiors at direct physical appFrames 3, 4, 5.
    const frameMap = Array.from({ length: 9 }, (_, globalFrame) => ({
      globalFrame,
      sequenceId: globalFrame === 8 ? sequence.id : 'content-seq',
      keyPhotoId: 'kp-1',
      imageId: 'base-image',
      localFrame: globalFrame === 8 ? 4 : globalFrame,
    }));

    preloadExportImages(renderer, frameMap, undefined, [sequence]);

    expect(renderer.collectPhysicPaintFrameSources).toHaveBeenCalledWith(sequence.layers, 4);
    expect(renderer.preloadPhysicPaintFrames).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({
        layerId: 'roto-layer',
        frame: 4,
        renderedFrame: expect.objectContaining({
          appFrame: 4,
          dataUrl: 'data:image/png;base64,cmVhbC0y',
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
      { keyId: 'key-0', appFrame: 0, dataUrl: 'data:image/png;base64,Y2lyY2xl' },
      { keyId: 'key-4', appFrame: 4, dataUrl: 'data:image/png;base64,c3F1YXJl' },
      { keyId: 'key-8', appFrame: 8, dataUrl: 'data:image/png;base64,Y3Jvc3NlZA==' },
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
    } as unknown as PreviewRenderer;

    preloadExportImages(renderer, frameMap.value, undefined, [sequence]);

    expect(renderer.collectPhysicPaintFrameSources).toHaveBeenCalledWith(sequence.layers, 8);
    expect(renderer.collectPhysicPaintFrameSources).not.toHaveBeenCalledWith(sequence.layers, 9);
    expect(renderer.preloadPhysicPaintFrames).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({
        layerId: 'roto-layer',
        frame: 8,
        renderedFrame: expect.objectContaining({
          appFrame: 8,
          dataUrl: 'data:image/png;base64,Y3Jvc3NlZA==',
        }),
      }),
    ]));
  });

  it('preloads published generated interpolation cache frames after close/reopen load', () => {
    const layer = makeRotoLayer();
    const sequence = makeSequence(layer);
    seedPhysicalRoto([
      { keyId: 'key-0', appFrame: 0, dataUrl: 'data:image/png;base64,cmVhbC0w' },
      { keyId: 'key-2', appFrame: 2, dataUrl: 'data:image/png;base64,cmVhbC0y' },
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
    } as unknown as PreviewRenderer;

    preloadExportImages(renderer, [
      { globalFrame: 0, sequenceId: sequence.id, keyPhotoId: 'kp-1', imageId: 'base-image', localFrame: 0 },
      { globalFrame: 1, sequenceId: sequence.id, keyPhotoId: 'kp-1', imageId: 'base-image', localFrame: 1 },
    ], undefined, [sequence]);

    expect(renderer.preloadPhysicPaintFrames).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({
        layerId: 'roto-layer',
        frame: 1,
        renderedFrame: expect.objectContaining({
          appFrame: 1,
          dataUrl: 'data:image/png;base64,cmVhbC0w',
        }),
      }),
    ]));
    expect(physicPaintStore.getRotoPhysicalRenderSource('roto-layer', TEST_TRACK_ID, 1)).toMatchObject({ kind: 'generated', appFrame: 1, leftKeyId: 'key-0', rightKeyId: 'key-2' });
  });

  it('keeps trailing background-only export resolution dynamic without serialized cache growth', () => {
    physicPaintStore.upsertRealRotoKeyFrame('phys-layer-1', TEST_TRACK_ID, 2, { frameIndex: 0, appFrame: 2, dataUrl: 'data:image/png;base64,cmVhbC0y' });
    physicPaintStore.upsertRealRotoKeyFrame('phys-layer-1', TEST_TRACK_ID, 6, { frameIndex: 0, appFrame: 6, dataUrl: 'data:image/png;base64,cmVhbC02' });
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
    const makeCanvasStub = () => ({ width: 1000, height: 650 }) as unknown as HTMLCanvasElement;

    it('composites a physic-paint overlay with an empty frameMap (no Timeline key photos)', () => {
      const layer = makeRotoLayer();
      const fxSeq = makeFxPaintSequence(layer);
      sequenceStore.sequences.value = [fxSeq];
      // Mirrors the user report: paint keys at appFrames 41/44/47, zero Timeline key photos.
      seedPhysicalRoto([
        { keyId: 'key-41', appFrame: 41, dataUrl: 'data:image/png;base64,cGFpbnQtNDE=' },
        { keyId: 'key-44', appFrame: 44, dataUrl: 'data:image/png;base64,cGFpbnQtNDQ=' },
        { keyId: 'key-47', appFrame: 47, dataUrl: 'data:image/png;base64,cGFpbnQtNDc=' },
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
        { keyId: 'key-41', appFrame: 41, dataUrl: 'data:image/png;base64,cGFpbnQtNDE=' },
        { keyId: 'key-44', appFrame: 44, dataUrl: 'data:image/png;base64,cGFpbnQtNDQ=' },
        { keyId: 'key-47', appFrame: 47, dataUrl: 'data:image/png;base64,cGFpbnQtNDc=' },
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
        { keyId: 'key-0', appFrame: 0, dataUrl: 'data:image/png;base64,cGFpbnQtMA==' },
      ]);
      const fm = [
        { globalFrame: 0, sequenceId: contentSeq.id, keyPhotoId: 'kp-1', imageId: 'base-image', localFrame: 0 },
        { globalFrame: 1, sequenceId: contentSeq.id, keyPhotoId: 'kp-1', imageId: 'base-image', localFrame: 1 },
      ];
      const renderer = makeRendererStub();

      renderGlobalFrame(renderer, makeCanvasStub(), 0, fm, [contentSeq, fxSeq], [], false);

      const renderFrame = vi.mocked(renderer.renderFrame);
      // Content pass clears the canvas; overlay pass composites on top.
      expect(renderFrame.mock.calls.some((args) => args[4] === true)).toBe(true);
      expect(renderFrame.mock.calls.some((args) => args[4] === false)).toBe(true);
    });

    it.todo('renders a single content frame identically to Preview.tsx');
    it.todo('renders cross-dissolve overlap with correct blending');
    it.todo('renders FX overlay sequences with keyframe interpolation');
    it.todo('renders content-overlay sequences with fade opacity');
    it.todo('handles solid fade overlay with computed alpha');
  });

  describe('preloadExportImages', () => {
    it('preloads cached Physics Paint frame PNGs before export renders', async () => {
      const frameSource: PreviewPhysicPaintFrameSource = {
        layerId: 'roto-layer',
        frame: 0,
        renderedFrame: { frameIndex: 0, appFrame: 0, dataUrl: 'data:image/png;base64,cm90by1zdHJva2Vz' },
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
      } as unknown as PreviewRenderer;
      const sequence = makeSequence(makeRotoLayer());

      await preloadExportImages(renderer, [{ globalFrame: 0, sequenceId: sequence.id, keyPhotoId: 'kp-1', imageId: 'base-image', localFrame: 0 }], undefined, [sequence]);

      expect(renderer.collectPhysicPaintFrameSources).toHaveBeenCalledWith(sequence.layers, 0);
      expect(renderer.preloadPhysicPaintFrames).toHaveBeenCalledWith([frameSource]);
      expect(renderer.isPhysicPaintFrameResolved).toHaveBeenCalledWith(frameSource);
    });

    it('preloads content Physics Paint from local F0 when the Sequence starts globally at F100', async () => {
      const sequence = { ...makeSequence(makeRotoLayer()), id: 'content-at-100', keyPhotos: [{ id: 'kp-local-0', imageId: '', holdFrames: 1 }] };
      seedPhysicalRoto([
        { keyId: 'key-0', appFrame: 0, dataUrl: 'data:image/png;base64,bG9jYWwtMA==' },
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
      } as unknown as PreviewRenderer;
      const frames = Array.from({ length: 101 }, (_, globalFrame) => ({
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
          renderedFrame: expect.objectContaining({ appFrame: 0, dataUrl: 'data:image/png;base64,bG9jYWwtMA==' }),
        }),
      ]);
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
