import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { sequenceStore } from '../stores/sequenceStore';
import type { Layer } from '../types/layer';
import { defaultTransform } from '../types/layer';
import type { Sequence } from '../types/sequence';
import { physicPaintStore } from '../stores/physicPaintStore';
import type { PreviewPhysicPaintFrameSource, PreviewRenderer } from './previewRenderer';
import { preloadExportImages } from './exportRenderer';
import { resolveMissingRotoFrameDraw } from './rotoFrameDraw';

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

beforeEach(() => {
  sequenceStore.reset();
  physicPaintStore.reset();
});

afterEach(() => {
  sequenceStore.reset();
  physicPaintStore.reset();
});

describe('physics paint cache-first preview/export contract', () => {
  it('uses cached physics paint frame lookup and subscribes to physics paint mutations in previewRenderer', () => {
    const source = readSource('src/lib/previewRenderer.ts');

    expect(source).toContain('void physicPaintVersion.value');
    expect(source).toContain('getPhysicPaintFrameForLayer(paintLayerId, paintLookupFrame)');
    expect(source).toContain('physicPaintStore.getRotoFrame(layerId, frame)');
    expect(source).toContain('resolveMissingRotoFrameDrawForLayer(layer, paintLookupFrame)');
    expect(source).toContain('physicPaintStore.getRealRotoKeyFrames(paintLayerId)');
    expect(source).toContain('drawMissingRotoBackground(ctx, backgroundDraw, logicalW, logicalH, paperTexture, paperCanvas)');
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
    expect(source).toContain('renderer.renderFrame(interpolatedLayers, localFrame, seqFrames, seq.fps, true, fadeOpacity, globalFrame)');
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
    expect(physicPaintStore.getRotoCacheFrames('phys-layer-1')).toEqual([]);
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
    expect(physicPaintStore.getRotoCacheFrames('phys-layer-1')).toEqual([]);
  });

  it('resolves persisted paper and canvas grain metadata for missing Roto frames without store mutation', () => {
    const setFrame = vi.spyOn(physicPaintStore, 'setFrame');

    const result = resolveMissingRotoFrameDraw('phys-layer-1', 26, { mode: 'paper', metadata: { background: 'canvas2', paperGrain: 'canvas3', grainStrength: 0.65 } });

    expect(result).toEqual({ kind: 'background-only', color: '#ebe3d2', paperTexture: 'canvas2', paperGrain: 'canvas3', grainStrength: 0.65, span: { kind: 'no-real-keys' }, materialize: false });
    expect(setFrame).not.toHaveBeenCalled();
    expect(physicPaintStore.getRotoCacheFrames('phys-layer-1')).toEqual([]);
  });

  it('collects generated interpolation cache frames for export through the preview renderer source contract', () => {
    const layer = makeRotoLayer();
    const sequence = makeSequence(layer);
    physicPaintStore.setRotoBackgroundMetadata('roto-layer', { background: 'canvas2', paperGrain: 'canvas3', grainStrength: 0.65 });
    physicPaintStore.upsertRealRotoKeyFrame('roto-layer', 0, { frameIndex: 0, appFrame: 0, dataUrl: 'data:image/png;base64,cmVhbC0w' });
    physicPaintStore.upsertRealRotoKeyFrame('roto-layer', 2, { frameIndex: 0, appFrame: 2, dataUrl: 'data:image/png;base64,cmVhbC0y' });
    physicPaintStore.replaceGeneratedRotoCache('roto-layer', [
      { frameIndex: 0, appFrame: 1, dataUrl: 'data:image/png;base64,Z2VuZXJhdGVkLWFscGhhLW9ubHk=', source: 'generated-interpolation', nearestRealKeyFrame: 0 },
    ]);
    const preloadedFrames: PreviewPhysicPaintFrameSource[] = [];
    const renderer = {
      onImageLoaded: null,
      collectRotoPaperTextures: vi.fn(() => []),
      collectPhysicPaintFrameSources: vi.fn((layers: readonly Layer[], frame: number) => {
        const paintLayer = layers.find((candidate) => candidate.type === 'physic-paint');
        const layerId = paintLayer?.source.type === 'physic-paint' ? paintLayer.source.layerId : null;
        const renderedFrame = layerId ? physicPaintStore.getRotoFrame(layerId, frame) : null;
        return renderedFrame && layerId ? [{ layerId, frame, renderedFrame }] : [];
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
          source: 'generated-interpolation',
          dataUrl: 'data:image/png;base64,Z2VuZXJhdGVkLWFscGhhLW9ubHk=',
        }),
      }),
    ]));
    expect(physicPaintStore.getRotoBackgroundMetadata('roto-layer')).toEqual({ background: 'canvas2', paperGrain: 'canvas3', grainStrength: 0.65 });
    expect(physicPaintStore.getRotoFrame('roto-layer', 1)?.dataUrl).toBe('data:image/png;base64,Z2VuZXJhdGVkLWFscGhhLW9ubHk=');
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
    physicPaintStore.upsertRealRotoKeyFrame('roto-layer', 0, { frameIndex: 0, appFrame: 0, dataUrl: 'data:image/png;base64,Y2lyY2xl' });
    physicPaintStore.upsertRealRotoKeyFrame('roto-layer', 1, { frameIndex: 0, appFrame: 1, dataUrl: 'data:image/png;base64,c3F1YXJl' });
    physicPaintStore.upsertRealRotoKeyFrame('roto-layer', 2, { frameIndex: 0, appFrame: 2, dataUrl: 'data:image/png;base64,Y3Jvc3NlZA==' });
    physicPaintStore.setRotoInterpolationSettings('roto-layer', { enabled: true, inBetweenCount: 3, mode: 'duplicate' });
    const { frameMap } = await import('./frameMap');
    const preloadedFrames: PreviewPhysicPaintFrameSource[] = [];
    const renderer = {
      onImageLoaded: null,
      collectRotoPaperTextures: vi.fn(() => []),
      collectPhysicPaintFrameSources: vi.fn((layers: readonly Layer[], frame: number) => {
        const paintLayer = layers.find((candidate) => candidate.type === 'physic-paint');
        const layerId = paintLayer?.source.type === 'physic-paint' ? paintLayer.source.layerId : null;
        const renderedFrame = layerId ? physicPaintStore.getRotoFrame(layerId, frame) : null;
        return renderedFrame && layerId ? [{ layerId, frame, renderedFrame }] : [];
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
    } as unknown as PreviewRenderer;

    preloadExportImages(renderer, frameMap.value, undefined, [sequence]);

    expect(renderer.collectPhysicPaintFrameSources).toHaveBeenCalledWith(sequence.layers, 11);
    expect(renderer.preloadPhysicPaintFrames).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({
        layerId: 'roto-layer',
        frame: 11,
        renderedFrame: expect.objectContaining({
          appFrame: 11,
          source: 'generated-interpolation',
          dataUrl: 'data:image/png;base64,Y3Jvc3NlZA==',
        }),
      }),
    ]));
  });

  it('preloads published generated interpolation cache frames after close/reopen load', () => {
    const layer = makeRotoLayer();
    const sequence = makeSequence(layer);
    physicPaintStore.upsertRealRotoKeyFrame('roto-layer', 0, { frameIndex: 0, appFrame: 0, dataUrl: 'data:image/png;base64,cmVhbC0w' });
    physicPaintStore.upsertRealRotoKeyFrame('roto-layer', 2, { frameIndex: 0, appFrame: 2, dataUrl: 'data:image/png;base64,cmVhbC0y' });
    physicPaintStore.replaceGeneratedRotoCache('roto-layer', [
      { frameIndex: 0, appFrame: 1, dataUrl: 'data:image/png;base64,Z2VuZXJhdGVkLXJlb3Blbi1leHBvcnQ=', source: 'generated-interpolation', nearestRealKeyFrame: 0 },
    ]);
    const persisted = structuredClone(physicPaintStore.toMceOutputs());
    physicPaintStore.reset();
    physicPaintStore.loadFromMceOutputs(persisted);
    const preloadedFrames: PreviewPhysicPaintFrameSource[] = [];
    const renderer = {
      onImageLoaded: null,
      collectRotoPaperTextures: vi.fn(() => []),
      collectPhysicPaintFrameSources: vi.fn((layers: readonly Layer[], frame: number) => {
        const paintLayer = layers.find((candidate) => candidate.type === 'physic-paint');
        const layerId = paintLayer?.source.type === 'physic-paint' ? paintLayer.source.layerId : null;
        const renderedFrame = layerId ? physicPaintStore.getRotoFrame(layerId, frame) : null;
        return renderedFrame && layerId ? [{ layerId, frame, renderedFrame }] : [];
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
          source: 'generated-interpolation',
          dataUrl: 'data:image/png;base64,Z2VuZXJhdGVkLXJlb3Blbi1leHBvcnQ=',
        }),
      }),
    ]));
    expect(physicPaintStore.getRotoFrame('roto-layer', 1)?.source).toBe('generated-interpolation');
    expect(physicPaintStore.getRotoCacheFrames('roto-layer').find((frame) => frame.appFrame === 1)).toMatchObject({ source: 'generated-interpolation', nearestRealKeyFrame: 0 });
  });

  it('keeps trailing background-only export resolution dynamic without serialized cache growth', () => {
    physicPaintStore.upsertRealRotoKeyFrame('phys-layer-1', 2, { frameIndex: 0, appFrame: 2, dataUrl: 'data:image/png;base64,cmVhbC0y' });
    physicPaintStore.upsertRealRotoKeyFrame('phys-layer-1', 6, { frameIndex: 0, appFrame: 6, dataUrl: 'data:image/png;base64,cmVhbC02' });
    const before = structuredClone(physicPaintStore.toMceOutputs());

    const result = resolveMissingRotoFrameDraw('phys-layer-1', 9, {
      backgroundState: { mode: 'paper', metadata: { background: 'canvas2', paperGrain: 'canvas3', grainStrength: 0.65 } },
      realKeyFrames: physicPaintStore.getRealRotoKeyFrames('phys-layer-1'),
    });

    expect(result).toEqual({ kind: 'background-only', color: '#ebe3d2', paperTexture: 'canvas2', paperGrain: 'canvas3', grainStrength: 0.65, span: { kind: 'trailing', previousRealKeyFrame: 6 }, materialize: false });
    expect(physicPaintStore.getFrame('phys-layer-1', 9)).toBeNull();
    expect(physicPaintStore.toMceOutputs()).toEqual(before);
  });
});

describe('exportRenderer', () => {
  describe('renderGlobalFrame', () => {
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
